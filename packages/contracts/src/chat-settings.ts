import { z } from 'zod'

export const CHAT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export const chatEffort = z.enum(CHAT_EFFORTS)

export type ChatEffort = z.infer<typeof chatEffort>

export const CHAT_MODELS_MAX = 12
export const CHAT_MODEL_ID_MAX_LENGTH = 64
export const CHAT_MAX_INPUT_TOKENS_MIN = 1000
export const CHAT_MAX_INPUT_TOKENS_LIMIT = 100000
export const CHAT_MAX_OUTPUT_TOKENS_MIN = 1000
export const CHAT_MAX_OUTPUT_TOKENS_LIMIT = 128000
export const CHAT_MONTHLY_CAP_CENTS_MIN = 1
export const CHAT_MONTHLY_CAP_CENTS_MAX = 1000000

const priceText = z
	.string()
	.regex(/^\d{1,6}(\.\d{1,6})?$/)
	.refine((value) => /[1-9]/.test(value))

const capText = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/)

export function usdTextToCents(value: string): number {
	const [whole = '0', fraction = ''] = value.split('.')
	return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, '0'), 10)
}

const labelText = (max: number) => z.string().trim().min(1).max(max)

export const chatModelPricing = z.strictObject({
	inputPerMTok: priceText,
	cacheWrite5mPerMTok: priceText,
	cacheReadPerMTok: priceText,
	outputPerMTok: priceText,
})

export type ChatModelPricing = z.infer<typeof chatModelPricing>

export const chatModelEntry = z
	.strictObject({
		id: z
			.string()
			.max(CHAT_MODEL_ID_MAX_LENGTH)
			.regex(/^claude-[a-z0-9-]+$/),
		name: labelText(60),
		description: labelText(120),
		efforts: z
			.array(chatEffort)
			.min(1)
			.max(CHAT_EFFORTS.length)
			.refine((levels) => new Set(levels).size === levels.length),
		defaultEffort: chatEffort,
		recommendedEffort: chatEffort,
		pricing: chatModelPricing,
	})
	.refine((entry) => entry.efforts.includes(entry.defaultEffort) && entry.efforts.includes(entry.recommendedEffort))

export type ChatModelEntry = z.infer<typeof chatModelEntry>

export const chatModels = z
	.array(chatModelEntry)
	.min(1)
	.max(CHAT_MODELS_MAX)
	.refine((models) => new Set(models.map((model) => model.id)).size === models.length)

export const assistantSettings = z.strictObject({
	monthlyCapUsd: capText,
	maxInputTokens: z.number().int().min(CHAT_MAX_INPUT_TOKENS_MIN).max(CHAT_MAX_INPUT_TOKENS_LIMIT),
	maxOutputTokens: z.number().int().min(CHAT_MAX_OUTPUT_TOKENS_MIN).max(CHAT_MAX_OUTPUT_TOKENS_LIMIT),
	models: chatModels,
	model: z.string().nullable(),
	effort: chatEffort.nullable(),
})

export type AssistantSettings = z.infer<typeof assistantSettings>

export const saveAssistantSettingsRequest = z
	.strictObject({
		monthlyCapUsd: capText
			.refine((value) => {
				const cents = usdTextToCents(value)
				return cents >= CHAT_MONTHLY_CAP_CENTS_MIN && cents <= CHAT_MONTHLY_CAP_CENTS_MAX
			})
			.optional(),
		maxInputTokens: z.number().int().min(CHAT_MAX_INPUT_TOKENS_MIN).max(CHAT_MAX_INPUT_TOKENS_LIMIT).optional(),
		maxOutputTokens: z.number().int().min(CHAT_MAX_OUTPUT_TOKENS_MIN).max(CHAT_MAX_OUTPUT_TOKENS_LIMIT).optional(),
		models: chatModels.nullable().optional(),
		model: z.string().nullable().optional(),
		effort: chatEffort.nullable().optional(),
	})
	.refine((input) => Object.values(input).some((value) => value !== undefined))

export type SaveAssistantSettingsRequest = z.infer<typeof saveAssistantSettingsRequest>

export const modelCapability = z.strictObject({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	efforts: z.array(chatEffort),
	recommendedEffort: chatEffort,
	defaultEffort: chatEffort,
	available: z.boolean(),
})

export type ModelCapability = z.infer<typeof modelCapability>

export const BUDGET_WARNING_PERCENT = 80

export const budgetState = z.enum(['ok', 'warning', 'reached'])

export const budgetSnapshot = z.strictObject({
	capUsd: z.string(),
	spentUsd: z.string(),
	heldUsd: z.string(),
	remainingUsd: z.string(),
	unknownAttempts: z.number().int().min(0),
	resetOn: z.string(),
	state: budgetState,
})

export type BudgetSnapshot = z.infer<typeof budgetSnapshot>

export const conversationUsage = z.strictObject({
	conversationId: z.string(),
	title: z.string(),
	costUsd: z.string(),
	attempts: z.number().int().min(0),
	models: z.array(z.string()),
})

export type ConversationUsage = z.infer<typeof conversationUsage>

export type AssistantSettingsResponse = {
	settings: AssistantSettings
	capabilities: ModelCapability[]
	budget: BudgetSnapshot
	usage: ConversationUsage[]
}

export const CHAT_SETTINGS_DEFAULT: AssistantSettings = {
	monthlyCapUsd: '10.00',
	maxInputTokens: 100000,
	maxOutputTokens: 16000,
	models: [
		{
			id: 'claude-haiku-5-5',
			name: 'Haiku 5.5',
			description: 'Fast, lowest cost',
			efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
			defaultEffort: 'medium',
			recommendedEffort: 'medium',
			pricing: { inputPerMTok: '0.10', cacheWrite5mPerMTok: '0.125', cacheReadPerMTok: '0.01', outputPerMTok: '0.50' },
		},
		{
			id: 'claude-sonnet-5-5',
			name: 'Sonnet 5.5',
			description: 'Balanced speed and cost',
			efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
			defaultEffort: 'high',
			recommendedEffort: 'medium',
			pricing: { inputPerMTok: '2.00', cacheWrite5mPerMTok: '2.50', cacheReadPerMTok: '0.10', outputPerMTok: '10.00' },
		},
		{
			id: 'claude-opus-5-5',
			name: 'Opus 5.5',
			description: 'Smart, higher cost',
			efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
			defaultEffort: 'medium',
			recommendedEffort: 'medium',
			pricing: { inputPerMTok: '4.00', cacheWrite5mPerMTok: '5.00', cacheReadPerMTok: '0.20', outputPerMTok: '20.00' },
		},
	],
	model: null,
	effort: null,
}

export const CHAT_PROMPT_COMMANDS = ['/recap', '/essay'] as const

export type ChatPromptCommand = (typeof CHAT_PROMPT_COMMANDS)[number]

export const CHAT_PROMPT_MAX_LENGTH = 8000

const promptBody = z
	.string()
	.transform((value) => value.trim())
	.refine((value) => {
		const length = [...value].length
		return length >= 1 && length <= CHAT_PROMPT_MAX_LENGTH && !value.includes('\u0000')
	})

export const commandPrompt = z.strictObject({
	command: z.enum(CHAT_PROMPT_COMMANDS),
	body: z.string(),
	isDefault: z.boolean(),
	defaultBody: z.string(),
	revision: z.number().int().min(0),
})

export type CommandPrompt = z.infer<typeof commandPrompt>

export const commandPromptsResponse = z.strictObject({ prompts: z.array(commandPrompt) })

export type CommandPromptsResponse = z.infer<typeof commandPromptsResponse>

export const commandPromptResponse = z.strictObject({ prompt: commandPrompt })

export type CommandPromptResponse = z.infer<typeof commandPromptResponse>

export const saveCommandPromptRequest = z.strictObject({
	body: promptBody.nullable(),
	expectedRevision: z.number().int().min(0),
})

export type SaveCommandPromptRequest = z.infer<typeof saveCommandPromptRequest>

export const CHAT_COMMAND_NAME = /^\/[a-z][a-z0-9_-]{0,31}$/

export const CHAT_COMMAND_BLOCK_FORMATS = ['text', 'list'] as const

export const CHAT_COMMAND_STATUSES = ['active', 'archived'] as const

export const CHAT_COMMAND_BLOCKS_MAX = 8

export const CHAT_COMMAND_BLOCK_NAME_MAX = 60

export const CHAT_COMMAND_DESCRIPTION_MAX = 120

export const CHAT_COMMAND_TOOLS_MAX = 40

export const CHAT_REQUEST_LIMITS = { strict: 20, optional: 24, union: 16 } as const

const commandText = (min: number, max: number) =>
	z
		.string()
		.transform((value) => value.trim())
		.refine((value) => {
			const length = [...value].length
			return length >= min && length <= max && !value.includes('\u0000')
		})

const commandBlockFields = {
	name: commandText(1, CHAT_COMMAND_BLOCK_NAME_MAX),
	format: z.enum(CHAT_COMMAND_BLOCK_FORMATS),
	template: commandText(0, CHAT_PROMPT_MAX_LENGTH),
}

export const commandBlockInput = z.strictObject(commandBlockFields)

export type CommandBlockInput = z.infer<typeof commandBlockInput>

export const commandBlock = z.strictObject({
	key: z.string().regex(/^block_[1-9]$/),
	name: z.string(),
	format: z.enum(CHAT_COMMAND_BLOCK_FORMATS),
	template: z.string(),
})

export type CommandBlock = z.infer<typeof commandBlock>

export const commandLimits = z.strictObject({
	strict: z.number().int().min(0),
	optional: z.number().int().min(0),
	union: z.number().int().min(0),
})

export type CommandLimits = z.infer<typeof commandLimits>

export const storedCommand = z.strictObject({
	id: z.uuid(),
	name: z.string(),
	description: z.string(),
	prompt: z.string(),
	student: z.boolean(),
	tools: z.array(z.string()),
	blocks: z.array(commandBlock),
	status: z.enum(CHAT_COMMAND_STATUSES),
	revision: z.number().int().min(1),
	limits: commandLimits,
})

export type StoredCommand = z.infer<typeof storedCommand>

export const allowedCommandTool = z.strictObject({ name: z.string(), effect: z.enum(['read', 'show']) })

export const commandsResponse = z.strictObject({
	commands: z.array(storedCommand),
	allowedTools: z.array(allowedCommandTool),
	limits: commandLimits,
})

export type CommandsResponse = z.infer<typeof commandsResponse>

export const commandResponse = z.strictObject({ command: storedCommand })

export type CommandResponse = z.infer<typeof commandResponse>

const commandTools = z
	.array(z.string().min(1).max(64))
	.max(CHAT_COMMAND_TOOLS_MAX)
	.refine((names) => new Set(names).size === names.length)

const commandBlocks = z.array(commandBlockInput).max(CHAT_COMMAND_BLOCKS_MAX)

const commandFields = {
	description: commandText(1, CHAT_COMMAND_DESCRIPTION_MAX),
	prompt: promptBody,
	student: z.boolean(),
	tools: commandTools,
	blocks: commandBlocks,
}

export const createCommandRequest = z.strictObject({
	name: z.string().regex(CHAT_COMMAND_NAME),
	...commandFields,
})

export type CreateCommandRequest = z.infer<typeof createCommandRequest>

export const updateCommandRequest = z.strictObject({
	...commandFields,
	expectedRevision: z.number().int().min(1),
})

export type UpdateCommandRequest = z.infer<typeof updateCommandRequest>

export const commandStatusRequest = z.strictObject({ expectedRevision: z.number().int().min(1) })

export type CommandStatusRequest = z.infer<typeof commandStatusRequest>

export const commandLimitsRequest = z.strictObject({ tools: commandTools, blocks: commandBlocks })

export type CommandLimitsRequest = z.infer<typeof commandLimitsRequest>

export const commandLimitsResponse = z.strictObject({ limits: commandLimits })

export type CommandLimitsResponse = z.infer<typeof commandLimitsResponse>
