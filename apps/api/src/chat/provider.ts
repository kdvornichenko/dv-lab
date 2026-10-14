import Anthropic from '@anthropic-ai/sdk'

import type { ChatEffort } from '@dv-lab/contracts'

export type ProviderRequest = {
	model: string
	effort: ChatEffort
	maxOutputTokens: number
	system: string
	tools: Anthropic.Tool[]
	messages: Anthropic.MessageParam[]
}

export type CompleteRequest = Omit<ProviderRequest, 'tools'>

export type ProviderEvent =
	{ type: 'text'; text: string } | { type: 'text_end' } | { type: 'final'; message: Anthropic.Message }

export type ProviderFaultCode = 'credits_unavailable' | 'model_unavailable' | 'provider_unavailable'

export class ProviderFault extends Error {
	readonly code: ProviderFaultCode
	readonly aborted: boolean
	readonly answered: boolean
	constructor(code: ProviderFaultCode, options: { aborted?: boolean; answered?: boolean } = {}) {
		super(code)
		this.code = code
		this.aborted = options.aborted ?? false
		this.answered = options.answered ?? false
	}
}

export type ChatProvider = {
	stream: (request: ProviderRequest, signal: AbortSignal) => AsyncIterable<ProviderEvent>
	complete: (request: CompleteRequest, signal: AbortSignal) => Promise<Anthropic.Message>
	availability: (modelId: string) => Promise<boolean>
}

const AVAILABILITY_TTL_MS = 60 * 60 * 1000
const COMPLETE_TIMEOUT_MS = 30 * 1000

function faultCode(error: InstanceType<typeof Anthropic.APIError>): ProviderFaultCode {
	if (error.type === 'billing_error' || error.status === 402) return 'credits_unavailable'
	if (error instanceof Anthropic.NotFoundError || error instanceof Anthropic.PermissionDeniedError)
		return 'model_unavailable'
	return 'provider_unavailable'
}

function toFault(error: unknown, started: boolean): ProviderFault {
	if (error instanceof ProviderFault) return error
	if (error instanceof Anthropic.APIUserAbortError) return new ProviderFault('provider_unavailable', { aborted: true })
	if (error instanceof Anthropic.APIConnectionError) return new ProviderFault('provider_unavailable')
	if (error instanceof Anthropic.APIError)
		return new ProviderFault(faultCode(error), { answered: error.status !== undefined && !started })
	return new ProviderFault('provider_unavailable')
}

export function createChatProvider({ apiKey }: { apiKey: string }): ChatProvider {
	const client = new Anthropic({ apiKey, maxRetries: 0 })
	const known = new Map<string, { available: boolean; at: number }>()

	async function* stream(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ProviderEvent> {
		let started = false
		try {
			const running = client.messages.stream(
				{
					model: request.model,
					max_tokens: request.maxOutputTokens,
					output_config: { effort: request.effort },
					cache_control: { type: 'ephemeral' },
					system: request.system,
					tools: request.tools,
					tool_choice: { type: 'auto' },
					messages: request.messages,
				},
				{ signal }
			)
			let textBlock = false
			for await (const event of running) {
				if (event.type === 'message_start') started = true
				if (event.type === 'content_block_start') textBlock = event.content_block.type === 'text'
				if (event.type === 'content_block_delta' && event.delta.type === 'text_delta' && event.delta.text !== '')
					yield { type: 'text', text: event.delta.text }
				if (event.type === 'content_block_stop' && textBlock) {
					textBlock = false
					yield { type: 'text_end' }
				}
			}
			yield { type: 'final', message: await running.finalMessage() }
		} catch (error) {
			throw toFault(error, started)
		}
	}

	async function complete(request: CompleteRequest, signal: AbortSignal): Promise<Anthropic.Message> {
		try {
			return await client.messages.create(
				{
					model: request.model,
					max_tokens: request.maxOutputTokens,
					output_config: { effort: request.effort },
					system: request.system,
					messages: request.messages,
				},
				{ signal, timeout: COMPLETE_TIMEOUT_MS }
			)
		} catch (error) {
			throw toFault(error, false)
		}
	}

	async function availability(modelId: string): Promise<boolean> {
		const cached = known.get(modelId)
		if (cached && Date.now() - cached.at < AVAILABILITY_TTL_MS) return cached.available
		try {
			const model = await client.models.retrieve(modelId)
			const available = model.lifecycle !== 'retired'
			known.set(modelId, { available, at: Date.now() })
			return available
		} catch (error) {
			if (error instanceof Anthropic.NotFoundError || error instanceof Anthropic.PermissionDeniedError) {
				known.set(modelId, { available: false, at: Date.now() })
			}
			return false
		}
	}

	return { stream, complete, availability }
}
