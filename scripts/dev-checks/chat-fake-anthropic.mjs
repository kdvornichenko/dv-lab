const HOST = 'api.anthropic.com'
const DELAY = Number.parseInt(process.env.CHAT_FAKE_DELAY_MS ?? '250', 10)
const ANSWER = [
	'Here is a short plan for the next lesson. ',
	'Start with a warm-up on the past tense. ',
	'Then read a short text from the course book and discuss it. ',
	'Finish with a speaking exercise about weekend plans. ',
	'That should fit well into one session.',
]

const realFetch = globalThis.fetch
const state = { messages: 0, models: 0, ids: 0 }
globalThis.__chatFake = state

function json(status, body) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'request-id': `req_fake_${++state.ids}` },
	})
}

function words(sentence) {
	return sentence.match(/\S+\s*/g) ?? [sentence]
}

function frame(event) {
	return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

function toolResultText(body) {
	const last = body.messages.at(-1)
	if (!Array.isArray(last?.content)) return ''
	const part = last.content.find((item) => item.type === 'tool_result')
	if (!part) return ''
	return typeof part.content === 'string' ? part.content : JSON.stringify(part.content)
}

function proposalPlan(marker, content, continued, body) {
	const message = content.slice(Math.max(0, content.indexOf('[Message]')))
	const studentId = /student_id: ([0-9a-f-]{36})/.exec(content)?.[1] ?? null
	const call = (name, input) => ({
		blocks: [{ kind: 'tool', id: `toolu_fake_${++state.ids}`, name, input }],
		stop: 'tool_use',
	})
	const say = (text) => ({ blocks: [{ kind: 'text', sentences: [text] }], stop: 'end_turn' })
	const result = continued ? toolResultText(body) : ''
	if (marker === 'card') {
		if (continued) return say('I prepared the change. Confirm it below.')
		const name = /name:\s*([^;\n]+)/.exec(message)?.[1]?.trim() ?? ''
		return call('propose_student', {
			display_name: name,
			rate_text: null,
			currency: null,
			lesson_minutes: null,
			gender: null,
		})
	}
	if (marker === 'rate') {
		if (continued) return say('I prepared the change. Confirm it below.')
		const rate = /rate:\s*(\S+)/.exec(message)?.[1] ?? null
		return call('propose_rate', { student_id: studentId, rate_text: rate, currency: null, clear: false })
	}
	if (marker === 'archive' || marker === 'delete-student') {
		if (continued) return say('I prepared the change. Confirm it below.')
		return call('propose_archive', { student_id: studentId, requested_deletion: marker === 'delete-student' })
	}
	if (marker === 'payments') {
		if (!continued) return call('student_payments', { student_id: studentId })
		const paymentId = /payment_id\W+([0-9a-f-]{36})/.exec(result)?.[1]
		if (paymentId) return call('propose_payment_delete', { student_id: studentId, payment_id: paymentId })
		return say('I prepared the deletion. Confirm it below.')
	}
	if (marker === 'remove-note') {
		if (!continued) return call('student_notes', { student_id: studentId })
		const noteId = /\[\[note:([0-9a-f-]{36})\]\]/.exec(result)?.[1]
		if (noteId) return call('propose_entry_removal', { student_id: studentId, entry_id: noteId })
		return say('I prepared the removal. Confirm it below.')
	}
	if (marker === 'end') {
		if (continued) return say('I could not prepare that change.')
		return call('propose_lesson_change', {
			student_id: studentId,
			operation: 'cancel',
			date: null,
			time: null,
			new_date: null,
			new_time: null,
			scope: 'series',
			from: null,
		})
	}
	return null
}

function plan(body) {
	const asked = body.messages.filter((message) => message.role === 'user' && typeof message.content === 'string')
	const marker = /\[fake:([a-z-]+)\]/.exec(asked.at(-1)?.content ?? '')?.[1] ?? 'answer'
	const last = body.messages.at(-1)
	const continued = Array.isArray(last?.content) && last.content.some((part) => part.type === 'tool_result')
	if (marker === 'tool' && !continued) {
		const id = `toolu_fake_${++state.ids}`
		return { blocks: [{ kind: 'tool', id, name: 'find_students', input: { query: 'Alex Example' } }], stop: 'tool_use' }
	}
	if (marker === 'payment') {
		if (continued)
			return { blocks: [{ kind: 'text', sentences: ['I prepared the payment. Confirm it below.'] }], stop: 'end_turn' }
		const content = asked.at(-1)?.content ?? ''
		const studentId = /student_id: ([0-9a-f-]{36})/.exec(content)?.[1] ?? null
		const amount = /amount:\s*(\S+)/.exec(content.slice(content.indexOf('[Message]')))?.[1] ?? null
		const input = {
			student_id: studentId,
			amount_text: amount,
			currency: null,
			paid_on: null,
			lessons_text: null,
			note: null,
		}
		return {
			blocks: [{ kind: 'tool', id: `toolu_fake_${++state.ids}`, name: 'propose_payment', input }],
			stop: 'tool_use',
		}
	}
	const proposal = proposalPlan(marker, asked.at(-1)?.content ?? '', continued, body)
	if (proposal) return proposal
	if (marker === 'hang') return { hang: true }
	if (marker === 'credits') return { error: 'billing_error' }
	return { blocks: [{ kind: 'text', sentences: ANSWER }], stop: 'end_turn' }
}

function sleep(ms, signal) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, ms)
		signal?.addEventListener('abort', () => {
			clearTimeout(timer)
			reject(new DOMException('The operation was aborted.', 'AbortError'))
		})
	})
}

function messagesResponse(body, signal) {
	state.messages++
	const shape = plan(body)
	if (shape.error) {
		return json(400, { type: 'error', error: { type: shape.error, message: 'Your credit balance is too low.' } })
	}
	const encoder = new TextEncoder()
	const stream = new ReadableStream({
		async start(controller) {
			const send = (event) => controller.enqueue(encoder.encode(frame(event)))
			try {
				send({
					type: 'message_start',
					message: {
						id: `msg_fake_${++state.ids}`,
						type: 'message',
						role: 'assistant',
						model: body.model,
						content: [],
						stop_reason: null,
						stop_sequence: null,
						usage: { input_tokens: 120, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
					},
				})
				if (shape.hang) {
					await new Promise((_, reject) =>
						signal?.addEventListener('abort', () =>
							reject(new DOMException('The operation was aborted.', 'AbortError'))
						)
					)
				}
				let output = 0
				for (const [index, block] of shape.blocks.entries()) {
					if (block.kind === 'text') {
						send({ type: 'content_block_start', index, content_block: { type: 'text', text: '', citations: null } })
						for (const sentence of block.sentences)
							for (const piece of words(sentence)) {
								await sleep(DELAY, signal)
								output++
								send({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: piece } })
							}
					} else {
						send({
							type: 'content_block_start',
							index,
							content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} },
						})
						send({
							type: 'content_block_delta',
							index,
							delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) },
						})
						output += 10
					}
					send({ type: 'content_block_stop', index })
				}
				send({
					type: 'message_delta',
					delta: { stop_reason: shape.stop, stop_sequence: null },
					usage: { output_tokens: output },
				})
				send({ type: 'message_stop' })
				controller.close()
			} catch (error) {
				controller.error(error)
			}
		},
	})
	return new Response(stream, {
		status: 200,
		headers: { 'content-type': 'text/event-stream', 'request-id': `req_fake_${++state.ids}` },
	})
}

function target(input) {
	if (typeof input === 'string') return new URL(input)
	if (input instanceof URL) return input
	return new URL(input.url)
}

globalThis.fetch = async function chatFakeFetch(input, init = {}) {
	const url = target(input)
	if (url.hostname !== HOST) return realFetch(input, init)
	const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
	const signal = init.signal ?? (input instanceof Request ? input.signal : undefined)
	const model = /^\/v1\/models\/([^/]+)$/.exec(url.pathname)
	if (method === 'GET' && model) {
		state.models++
		const id = decodeURIComponent(model[1])
		if (id.includes('absent'))
			return json(404, { type: 'error', error: { type: 'not_found_error', message: 'Not found' } })
		return json(200, {
			type: 'model',
			id,
			display_name: 'Fake model',
			created_at: '2026-01-01T00:00:00Z',
			deprecated_at: null,
			lifecycle: 'active',
			line: null,
			capabilities: null,
			max_input_tokens: 1000000,
			max_tokens: 128000,
		})
	}
	if (method === 'POST' && url.pathname === '/v1/messages') {
		const raw = typeof init.body === 'string' ? init.body : input instanceof Request ? await input.text() : ''
		return messagesResponse(JSON.parse(raw), signal)
	}
	return json(404, { type: 'error', error: { type: 'not_found_error', message: 'Not found' } })
}
