import type Anthropic from '@anthropic-ai/sdk'

import type { z } from 'zod'

import type { ChatBlock } from '@dv-lab/contracts'
import type { Database, DbExecutor } from '@dv-lab/db'

import type { EventTitles } from '../calendar/event-titles.ts'
import type { ActionSource, ChatContext } from './actions.ts'
import type { Issued } from './publish-gate.ts'

export type ToolContext = {
	db: Database
	chat: ChatContext
	source: ActionSource
	persist: (executor: DbExecutor, block: ChatBlock) => Promise<void>
	issued: Issued
	shown: Set<string>
	essay: boolean
	eventTitles?: EventTitles
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
	run: (context: ToolContext, input: unknown) => Promise<ToolOutcome>
}

type ChatToolSpec<Input extends z.ZodType> = Omit<ChatToolEntry, 'input' | 'optional' | 'run'> & {
	input: Input
	optional?: readonly string[]
	run: (context: ToolContext, input: z.output<Input>) => Promise<ToolOutcome>
}

const READ_ONLY: ReadonlySet<ToolEffect> = new Set(['read', 'show', 'feedback'])

export function chatTool<Input extends z.ZodType>(spec: ChatToolSpec<Input>): ChatToolEntry {
	return {
		...spec,
		optional: spec.optional ?? [],
		run: (context, input) => spec.run(context, spec.input.parse(input)),
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
