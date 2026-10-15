import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isDeepStrictEqual, parseEnv } from 'node:util'

import { ROOT } from './paths.mjs'

const { CHAT_TOOLS, CHAT_TOOL_ENTRIES, ESSAY_TOOLS } = await import(`${ROOT}/apps/api/src/chat/tools.ts`)
const { isReadOnly, toAnthropicTool } = await import(`${ROOT}/apps/api/src/chat/tool-registry.ts`)
const { ESSAY_TOOL_NAME } = await import(`${ROOT}/apps/api/src/chat/essay.ts`)
const { CHAT_STEP_TOOLS } = await import(`${ROOT}/packages/contracts/src/index.ts`)

const apiRequire = createRequire(new URL('../../apps/api/package.json', import.meta.url))
const Anthropic = apiRequire('@anthropic-ai/sdk').default

const MODEL = process.argv[2] ?? 'claude-haiku-5-5'
const UNIONS_MAX = 16
const OPTIONAL_MAX = 24

let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const isUnion = (property) => Array.isArray(property.type) || 'anyOf' in property

function shape(tools) {
	let unions = 0
	let optional = 0
	const enumUnions = []
	for (const tool of tools) {
		const properties = tool.input_schema.properties ?? {}
		const required = new Set(tool.input_schema.required ?? [])
		for (const [key, property] of Object.entries(properties)) {
			if (Array.isArray(property.type) && 'enum' in property) enumUnions.push(`${tool.name}.${key}`)
			if (tool.strict !== true) continue
			if (isUnion(property)) unions++
			if (!required.has(key)) optional++
		}
	}
	return { unions, optional, enumUnions }
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
	const sent = CHAT_TOOLS.find((tool) => tool.name === entry.name)
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
	'registry: CHAT_TOOLS is the registry in the same order',
	isDeepStrictEqual(CHAT_TOOLS, CHAT_TOOL_ENTRIES.map(toAnthropicTool))
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
]) {
	const found = shape(tools)
	console.log(
		`${label}: strict ${tools.filter((tool) => tool.strict === true).length} of ${tools.length}, unions ${found.unions}, optional ${found.optional}`
	)
	check(`${label}: no type array with enum`, found.enumUnions.length === 0, found.enumUnions.join(','))
	check(`${label}: strict union parameters within ${UNIONS_MAX}`, found.unions <= UNIONS_MAX)
	check(`${label}: strict optional parameters within ${OPTIONAL_MAX}`, found.optional <= OPTIONAL_MAX)
	check(
		`${label}: every schema is a closed object`,
		tools.every((tool) => tool.input_schema.type === 'object' && tool.input_schema.additionalProperties === false)
	)
}

const key = apiKey()
let live = 'NOT RUN'
if (key === null) {
	console.log('NOT RUN live request: ANTHROPIC_API_KEY is not set')
} else {
	const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 180000 })
	for (const [label, tools] of [
		['chat tools', CHAT_TOOLS],
		['essay turn tools', ESSAY_TOOLS],
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
	live = 'RUN'
}

if (failures === 0) console.log(live === 'RUN' ? 'CHAT_TOOLS_SCHEMA_OK' : 'CHAT_TOOLS_SCHEMA_OK (live NOT RUN)')
else console.log(`chat tools schema failures ${failures}`)
process.exit(failures === 0 ? 0 : 1)
