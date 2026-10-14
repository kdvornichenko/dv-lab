import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import { ROOT } from './paths.mjs'

const { CHAT_TOOLS } = await import(`${ROOT}/apps/api/src/chat/tools.ts`)
const { ESSAY_FEEDBACK_TOOL } = await import(`${ROOT}/apps/api/src/chat/essay.ts`)

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

for (const [label, tools] of [
	['chat tools', CHAT_TOOLS],
	['essay turn tools', [ESSAY_FEEDBACK_TOOL]],
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
		['essay turn tools', [ESSAY_FEEDBACK_TOOL]],
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
