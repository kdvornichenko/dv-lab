import type Anthropic from '@anthropic-ai/sdk'

import { describe, expect, it } from 'vitest'

import { CHAT_TOOLS, ESSAY_TOOLS, REVIEW_TOOLS } from '../src/chat/tools.ts'

const STRICT_TOOLS_MAX = 8
const STRICT_UNIONS_MAX = 16
const STRICT_OPTIONAL_MAX = 24
const UNSUPPORTED_KEYWORDS = [
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
	'minLength',
	'maxLength',
	'pattern',
	'minItems',
	'maxItems',
	'uniqueItems',
	'contains',
	'patternProperties',
]

type Schema = Record<string, unknown>

const requests: [string, Anthropic.Tool[]][] = [
	['chat tools', CHAT_TOOLS],
	['essay turn tools', ESSAY_TOOLS],
	['review turn tools', REVIEW_TOOLS],
]

function nodes(schema: unknown, path: string): [string, Schema][] {
	if (schema === null || typeof schema !== 'object') return []
	if (Array.isArray(schema)) return schema.flatMap((item, index) => nodes(item, `${path}[${index}]`))
	const node = schema as Schema
	return [
		[path, node],
		...Object.entries(node).flatMap(([key, value]) => {
			if (key === 'enum' || key === 'const' || key === 'required') return []
			if (key === 'properties' && value !== null && typeof value === 'object')
				return Object.entries(value).flatMap(([name, child]) => nodes(child, `${path}.${name}`))
			return nodes(value, `${path}.${key}`)
		}),
	]
}

function strictTools(tools: Anthropic.Tool[]) {
	return tools.filter((tool) => tool.strict === true)
}

function properties(tool: Anthropic.Tool): [string, Schema][] {
	return Object.entries((tool.input_schema.properties ?? {}) as Record<string, Schema>)
}

function shapeProblems(tools: Anthropic.Tool[]): string[] {
	const problems: string[] = []
	const strict = strictTools(tools)
	if (strict.length > STRICT_TOOLS_MAX) problems.push(`strict tools ${strict.length} > ${STRICT_TOOLS_MAX}`)

	let unions = 0
	let optional = 0
	for (const tool of strict) {
		const required = new Set(tool.input_schema.required ?? [])
		for (const [key, property] of properties(tool)) {
			if (Array.isArray(property.type) || 'anyOf' in property) unions++
			if (!required.has(key)) optional++
		}
	}
	if (unions > STRICT_UNIONS_MAX) problems.push(`strict union parameters ${unions} > ${STRICT_UNIONS_MAX}`)
	if (optional > STRICT_OPTIONAL_MAX) problems.push(`strict optional parameters ${optional} > ${STRICT_OPTIONAL_MAX}`)

	for (const tool of tools) {
		for (const [path, node] of nodes(tool.input_schema, tool.name)) {
			if (Array.isArray(node.type) && 'enum' in node) problems.push(`${path}: type array with enum`)
			if (node.type === 'object' && node.additionalProperties !== false)
				problems.push(`${path}: object without additionalProperties false`)
			if (tool.strict !== true) continue
			for (const keyword of UNSUPPORTED_KEYWORDS)
				if (keyword in node) problems.push(`${path}: unsupported keyword ${keyword}`)
		}
	}
	return problems
}

describe('Anthropic strict tool schemas', () => {
	it.each(requests)('%s fit the strict schema limits', (_label, tools) => {
		expect(shapeProblems(tools)).toEqual([])
	})

	it('finds a type array with enum in a strict tool', () => {
		const broken: Anthropic.Tool = {
			name: 'broken',
			description: 'broken',
			strict: true,
			input_schema: {
				type: 'object',
				properties: { currency: { type: ['string', 'null'], enum: ['RUB', null], minLength: 1 } },
				required: ['currency'],
				additionalProperties: false,
			},
		}
		expect(shapeProblems([broken])).toEqual([
			'broken.currency: type array with enum',
			'broken.currency: unsupported keyword minLength',
		])
	})
})
