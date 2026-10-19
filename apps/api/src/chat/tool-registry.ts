import type Anthropic from '@anthropic-ai/sdk'

import { z } from 'zod'

import { CHAT_PROMPT_MAX_LENGTH, CHAT_REQUEST_LIMITS, type ChatBlock, type CommandLimits } from '@dv-lab/contracts'
import type { Database, DbExecutor } from '@dv-lab/db'

import type { EventTitles } from '../calendar/event-titles.ts'
import type { ActionSource, ChatContext } from './actions.ts'
import type { Issued } from './publish-gate.ts'
import { type Cited, NO_CITE } from './refs.ts'
import type { ReviewSession } from './review.ts'

export type ToolContext = {
	db: Database
	chat: ChatContext
	source: ActionSource
	persist: (executor: DbExecutor, block: ChatBlock) => Promise<void>
	issued: Issued
	shown: Set<string>
	essay: boolean
	eventTitles?: EventTitles
	review?: ReviewSession
}

export type ToolOutcome = { content: string; isError: boolean; block: ChatBlock | null }

export type ToolEffect = 'read' | 'show' | 'write' | 'propose' | 'page' | 'feedback'

export type ToolStep = {
	student: string | null
	search: string | null
	period: 'range' | 'month' | null
}

export type ChatToolEntry = {
	name: string
	description: string
	input: z.ZodType
	properties: Record<string, object>
	optional: readonly string[]
	strict: boolean
	effect: ToolEffect
	step: ToolStep | null
	review?: boolean
	cites?: boolean
	run: (context: ToolContext, input: unknown) => Promise<ToolOutcome>
}

type ChatToolSpec<Input extends z.ZodObject> = Omit<ChatToolEntry, 'input' | 'optional' | 'run'> & {
	input: Input
	optional?: readonly string[]
	run: (context: ToolContext, input: z.output<Input>, cited: Cited) => Promise<ToolOutcome>
}

const READ_ONLY: ReadonlySet<ToolEffect> = new Set(['read', 'show', 'feedback'])

const CITE_PROPERTIES = {
	source_message: {
		type: 'string',
		description:
			'The id from the [Message …] line of the teacher message where the teacher wrote the main value of this call (for a payment, the amount), such as m1a2b3c4d. It may be an earlier message in this chat: the current message is always checked too, so when the current message only corrects a waiting proposal ("3 lessons", "the 16th"), keep the id of the message with the amount.',
	},
	replaces: {
		type: ['string', 'null'],
		description:
			'The p… id of a proposal waiting for the teacher under [Proposals] that this call corrects (another date, amount, number of lessons, value or student): the app marks it replaced. null for a new, separate proposal, such as a second payment of the same student or a payment of another student ("@B the same", "столько же").',
	},
}

const citeInput = {
	source_message: z.string().min(1).max(20),
	replaces: z
		.string()
		.min(1)
		.max(20)
		.nullish()
		.transform((value) => value ?? null),
}

const citeSchema = z.object(citeInput)

export function chatTool<Input extends z.ZodObject>(spec: ChatToolSpec<Input>): ChatToolEntry {
	if (spec.cites !== true)
		return {
			...spec,
			optional: spec.optional ?? [],
			run: (context, input) => spec.run(context, spec.input.parse(input), NO_CITE),
		}
	const input = spec.input.extend(citeInput)
	return {
		...spec,
		input,
		properties: { ...spec.properties, ...CITE_PROPERTIES },
		optional: spec.optional ?? [],
		run: (context, raw) => {
			const { source_message: _source, replaces: _replaces, ...rest } = input.parse(raw)
			const cite = citeSchema.parse(raw)
			return spec.run(context, spec.input.parse(rest), {
				sourceMessage: cite.source_message,
				replaces: cite.replaces,
			})
		},
	}
}

export function toAnthropicTool(entry: ChatToolEntry): Anthropic.Tool {
	return {
		name: entry.name,
		description: entry.description,
		...(entry.strict ? { strict: true } : {}),
		input_schema: {
			type: 'object',
			properties: entry.properties,
			required: Object.keys(entry.properties).filter((key) => !entry.optional.includes(key)),
			additionalProperties: false,
		},
	}
}

export function chatTools(entries: readonly ChatToolEntry[]): Anthropic.Tool[] {
	return entries.map(toAnthropicTool)
}

export function isReadOnly(entry: ChatToolEntry): boolean {
	return READ_ONLY.has(entry.effect)
}

export function toolEntry(entries: readonly ChatToolEntry[], name: string): ChatToolEntry | undefined {
	return entries.find((entry) => entry.name === name)
}

export function stepRule(entries: readonly ChatToolEntry[], name: string): ToolStep | null {
	return toolEntry(entries, name)?.step ?? null
}

export function allowedCommandTools(entries: readonly ChatToolEntry[]): ChatToolEntry[] {
	return entries.filter((entry) => (entry.effect === 'read' || entry.effect === 'show') && entry.review !== true)
}

export type CommandBlockSpec = { key: string; name: string; format: 'text' | 'list' }

const LIST_ITEMS_MAX = 200

export function commandSchema(blocks: readonly CommandBlockSpec[]) {
	const properties: Record<string, object> = {}
	const shape: Record<string, z.ZodType> = {}
	for (const block of blocks) {
		if (block.format === 'list') {
			properties[block.key] = { type: 'array', items: { type: 'string' }, description: block.name }
			shape[block.key] = z.array(z.string().max(CHAT_PROMPT_MAX_LENGTH)).max(LIST_ITEMS_MAX)
		} else {
			properties[block.key] = { type: 'string', description: block.name }
			shape[block.key] = z.string().max(CHAT_PROMPT_MAX_LENGTH)
		}
	}
	return {
		schema: {
			type: 'object',
			properties,
			required: blocks.map((block) => block.key),
			additionalProperties: false,
		},
		input: z.strictObject(shape),
	}
}

type SchemaShape = { properties?: unknown; required?: readonly string[] | null }

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function schemaCounts(schema: SchemaShape): { optional: number; union: number } {
	const properties = isRecord(schema.properties) ? schema.properties : {}
	const required = new Set(schema.required ?? [])
	let optional = 0
	let union = 0
	for (const [key, property] of Object.entries(properties)) {
		if (isRecord(property) && (Array.isArray(property.type) || 'anyOf' in property)) union++
		if (!required.has(key)) optional++
	}
	return { optional, union }
}

export function strictBudget(tools: readonly Anthropic.Tool[], format?: SchemaShape | null): CommandLimits {
	let strict = 0
	let optional = 0
	let union = 0
	for (const tool of tools) {
		if (tool.strict !== true) continue
		strict++
		const counts = schemaCounts(tool.input_schema)
		optional += counts.optional
		union += counts.union
	}
	if (format) {
		const counts = schemaCounts(format)
		optional += counts.optional
		union += counts.union
	}
	return { strict, optional, union }
}

export function withinBudget(limits: CommandLimits): boolean {
	return (
		limits.strict <= CHAT_REQUEST_LIMITS.strict &&
		limits.optional <= CHAT_REQUEST_LIMITS.optional &&
		limits.union <= CHAT_REQUEST_LIMITS.union
	)
}
