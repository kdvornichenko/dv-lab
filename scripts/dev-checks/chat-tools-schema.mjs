import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isDeepStrictEqual, parseEnv } from 'node:util'

import { ROOT } from './paths.mjs'

const { CHAT_TOOLS, CHAT_TOOL_ENTRIES, ESSAY_TOOLS, REVIEW_TOOLS } = await import(`${ROOT}/apps/api/src/chat/tools.ts`)
const { allowedCommandTools, commandSchema, commandTools, isReadOnly, strictBudget, toAnthropicTool, withinBudget } =
	await import(`${ROOT}/apps/api/src/chat/tool-registry.ts`)
const { ESSAY_TOOL_NAME } = await import(`${ROOT}/apps/api/src/chat/essay.ts`)
const { CHAT_REQUEST_LIMITS, CHAT_STEP_TOOLS } = await import(`${ROOT}/packages/contracts/src/index.ts`)

const apiRequire = createRequire(new URL('../../apps/api/package.json', import.meta.url))
const Anthropic = apiRequire('@anthropic-ai/sdk').default

const MODEL = process.argv[2] ?? 'claude-haiku-5-5'

let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

function enumUnions(tools) {
	const found = []
	for (const tool of tools) {
		for (const [key, property] of Object.entries(tool.input_schema.properties ?? {})) {
			if (Array.isArray(property.type) && 'enum' in property) found.push(`${tool.name}.${key}`)
		}
	}
	return found
}

function apiKey() {
	if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
	const file = `${ROOT}/.env`
	if (!existsSync(file)) return null
	return parseEnv(readFileSync(file, 'utf8')).ANTHROPIC_API_KEY ?? null
}

const READ_ONLY_EFFECTS = new Set(['read', 'show', 'feedback'])
const EFFECTS = new Set([...READ_ONLY_EFFECTS, 'write', 'propose', 'page'])

function sameKeys(left, right) {
	return isDeepStrictEqual([...left].sort(), [...right].sort())
}

function entryIssues(entry) {
	const issues = []
	const shapeKeys = Object.keys(entry.input?.shape ?? {})
	const keys = Object.keys(entry.properties)
	if (!sameKeys(keys, shapeKeys)) issues.push(`json ${keys.join(',')} zod ${shapeKeys.join(',')}`)
	const strayOptional = entry.optional.filter((key) => !keys.includes(key))
	if (strayOptional.length > 0) issues.push(`optional not in json ${strayOptional.join(',')}`)
	for (const key of entry.optional) {
		const field = entry.input.shape?.[key]
		if (field && !field.safeParse(undefined).success) issues.push(`optional ${key} is required in zod`)
	}
	for (const [key, property] of Object.entries(entry.properties)) {
		const field = entry.input.shape?.[key]
		if (!field || !Array.isArray(property.enum)) continue
		const rejected = property.enum.filter((value) => !field.safeParse(value).success)
		if (rejected.length > 0) issues.push(`zod rejects json enum ${key}=${rejected.join('|')}`)
	}
	const sent = [...CHAT_TOOLS, ...REVIEW_TOOLS].find((tool) => tool.name === entry.name)
	const required = keys.filter((key) => !entry.optional.includes(key))
	if (!sent || !isDeepStrictEqual(sent.input_schema.required, required))
		issues.push(`required in json differs from keys without optional`)
	return issues
}

const names = CHAT_TOOL_ENTRIES.map((entry) => entry.name)
check(
	'registry: tool names are unique',
	new Set(names).size === names.length,
	names.filter((name, index) => names.indexOf(name) !== index).join(',')
)
check(
	'registry: CHAT_TOOLS is the registry without the review tools in the same order',
	isDeepStrictEqual(CHAT_TOOLS, CHAT_TOOL_ENTRIES.filter((entry) => entry.review !== true).map(toAnthropicTool))
)
check(
	'registry: the review turn tools are review_read and apply_review only, review_read is read-only',
	isDeepStrictEqual(
		REVIEW_TOOLS.map((tool) => tool.name),
		['review_read', 'apply_review']
	) &&
		isDeepStrictEqual(REVIEW_TOOLS, CHAT_TOOL_ENTRIES.filter((entry) => entry.review === true).map(toAnthropicTool)) &&
		isReadOnly(CHAT_TOOL_ENTRIES.find((entry) => entry.name === 'review_read')) &&
		REVIEW_TOOLS.every((tool) => tool.strict !== true)
)
const drift = CHAT_TOOL_ENTRIES.map((entry) => [entry.name, entryIssues(entry)]).filter(
	([, issues]) => issues.length > 0
)
check(
	'registry: json properties, required and enums match the zod input of every tool',
	drift.length === 0,
	drift.map(([name, issues]) => `${name}: ${issues.join('; ')}`).join(' | ')
)
const badEffects = CHAT_TOOL_ENTRIES.filter((entry) => !EFFECTS.has(entry.effect)).map((entry) => entry.name)
check('registry: every tool declares a known effect', badEffects.length === 0, badEffects.join(','))
const readOnlyDrift = CHAT_TOOL_ENTRIES.filter(
	(entry) => isReadOnly(entry) !== READ_ONLY_EFFECTS.has(entry.effect)
).map((entry) => entry.name)
check('registry: read-only means read, show or feedback', readOnlyDrift.length === 0, readOnlyDrift.join(','))
const implicitStep = CHAT_TOOL_ENTRIES.filter((entry) => !Object.hasOwn(entry, 'step') || entry.step === undefined).map(
	(entry) => entry.name
)
check('registry: every tool declares its step rule or step null', implicitStep.length === 0, implicitStep.join(','))
const unnamedStep = CHAT_TOOL_ENTRIES.filter(
	(entry) => entry.step !== null && entry.step !== undefined && !CHAT_STEP_TOOLS.includes(entry.name)
).map((entry) => entry.name)
check(
	'registry: every tool with a step rule is named in CHAT_STEP_TOOLS',
	unnamedStep.length === 0,
	unnamedStep.join(',')
)
const lostStep = CHAT_STEP_TOOLS.filter(
	(name) =>
		!['answer', 'add_note'].includes(name) && !CHAT_TOOL_ENTRIES.some((entry) => entry.name === name && entry.step)
)
check('registry: every step tool of the contract has a registry rule', lostStep.length === 0, lostStep.join(','))
const badStepKeys = CHAT_TOOL_ENTRIES.filter((entry) => {
	if (!entry.step) return false
	const keys = Object.keys(entry.properties)
	const { student, search, period } = entry.step
	return (
		(student !== null && !keys.includes(student)) ||
		(search !== null && !keys.includes(search)) ||
		(period !== null && !(keys.includes('from') && keys.includes('to')))
	)
}).map((entry) => entry.name)
check('registry: step rules name inputs the tool has', badStepKeys.length === 0, badStepKeys.join(','))
const essayEntries = ESSAY_TOOLS.map((tool) => CHAT_TOOL_ENTRIES.find((entry) => entry.name === tool.name))
check(
	'registry: the essay turn tools are read-only and include essay_feedback',
	essayEntries.every((entry) => entry !== undefined && isReadOnly(entry)) &&
		ESSAY_TOOLS.some((tool) => tool.name === ESSAY_TOOL_NAME),
	ESSAY_TOOLS.map((tool) => tool.name).join(',')
)

for (const [label, tools] of [
	['chat tools', CHAT_TOOLS],
	['essay turn tools', ESSAY_TOOLS],
	['review turn tools', REVIEW_TOOLS],
]) {
	const found = strictBudget(tools)
	console.log(
		`${label}: strict ${found.strict} of ${tools.length}, unions ${found.union}, optional ${found.optional}`
	)
	const unions = enumUnions(tools)
	check(`${label}: no type array with enum`, unions.length === 0, unions.join(','))
	check(`${label}: strict tools within ${CHAT_REQUEST_LIMITS.strict}`, found.strict <= CHAT_REQUEST_LIMITS.strict)
	check(`${label}: strict union parameters within ${CHAT_REQUEST_LIMITS.union}`, found.union <= CHAT_REQUEST_LIMITS.union)
	check(
		`${label}: strict optional parameters within ${CHAT_REQUEST_LIMITS.optional}`,
		found.optional <= CHAT_REQUEST_LIMITS.optional
	)
	check(
		`${label}: every schema is a closed object`,
		tools.every((tool) => tool.input_schema.type === 'object' && tool.input_schema.additionalProperties === false)
	)
}

const blockSpecs = Array.from({ length: 8 }, (_, index) => ({
	key: `block_${index + 1}`,
	name: `Block ${index + 1}`,
	format: index % 2 === 0 ? 'list' : 'text',
}))
const allowed = allowedCommandTools(CHAT_TOOL_ENTRIES)
check(
	'commands: allowed tools are read or show and never review',
	allowed.length > 0 && allowed.every((entry) => ['read', 'show'].includes(entry.effect) && entry.review !== true),
	allowed.map((entry) => entry.name).join(',')
)
check('commands: the today tool is allowed in a command', allowed.some((entry) => entry.name === 'today'))
const everything = strictBudget(
	commandTools(
		CHAT_TOOL_ENTRIES,
		allowed.map((entry) => entry.name)
	).map(toAnthropicTool),
	commandSchema(blockSpecs).schema
)
check('commands: every allowed tool and eight blocks stay within the limits', withinBudget(everything), JSON.stringify(everything))
const syntheticStrict = Array.from({ length: CHAT_REQUEST_LIMITS.strict + 1 }, (_, index) => ({
	name: `synthetic_${index}`,
	strict: true,
	input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
}))
check('commands: 21 strict tools are over the limit', !withinBudget(strictBudget(syntheticStrict)))
const homeworkBlocks = [
	{ key: 'block_1', name: 'Exercises', format: 'list' },
	{ key: 'block_2', name: 'Message', format: 'text' },
]
const homework = commandSchema(homeworkBlocks)
const schemaText = JSON.stringify(homework.schema)
check(
	'commands: the response schema has only block keys, types and names',
	isDeepStrictEqual(Object.keys(homework.schema.properties), ['block_1', 'block_2']) &&
		isDeepStrictEqual(homework.schema.required, ['block_1', 'block_2']) &&
		homework.schema.additionalProperties === false &&
		!/anyOf|null|minLength|maxLength|minItems|maxItems/.test(schemaText),
	schemaText
)
console.log(`commands: /homework response schema ${schemaText}`)
const homeworkTools = commandTools(CHAT_TOOL_ENTRIES, ['student_notes', 'lesson_dates']).map(toAnthropicTool)
check('commands: the /homework tool set and schema are within the limits', withinBudget(strictBudget(homeworkTools, homework.schema)))

const key = apiKey()
let live = 'NOT RUN'
if (key === null) {
	console.log('NOT RUN live request: ANTHROPIC_API_KEY is not set')
} else {
	const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 180000 })
	for (const [label, tools] of [
		['chat tools', CHAT_TOOLS],
		['essay turn tools', ESSAY_TOOLS],
		['review turn tools', REVIEW_TOOLS],
	]) {
		try {
			const message = await client.messages.create({
				model: MODEL,
				max_tokens: 64,
				output_config: { effort: 'medium' },
				tools,
				tool_choice: { type: 'auto' },
				messages: [{ role: 'user', content: 'Say ok.' }],
			})
			check(`${label}: ${MODEL} accepts the tool list (${message.stop_reason})`, true)
		} catch (error) {
			const detail = error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : String(error)
			check(`${label}: ${MODEL} accepts the tool list`, false, detail.replaceAll(key, '***'))
		}
	}
	try {
		const message = await client.messages.create({
			model: MODEL,
			max_tokens: 256,
			output_config: { effort: 'medium', format: { type: 'json_schema', schema: homework.schema } },
			tools: homeworkTools,
			tool_choice: { type: 'auto' },
			messages: [{ role: 'user', content: 'Write one exercise and one short message for a student.' }],
		})
		check(`commands: ${MODEL} accepts the /homework tools with the response schema (${message.stop_reason})`, true)
	} catch (error) {
		const detail = error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : String(error)
		check(`commands: ${MODEL} accepts the /homework tools with the response schema`, false, detail.replaceAll(key, '***'))
	}
	live = 'RUN'
}

if (failures === 0) console.log(live === 'RUN' ? 'CHAT_TOOLS_SCHEMA_OK' : 'CHAT_TOOLS_SCHEMA_OK (live NOT RUN)')
else console.log(`chat tools schema failures ${failures}`)
process.exit(failures === 0 ? 0 : 1)
