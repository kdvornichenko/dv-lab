import { registerHooks } from 'node:module'

import { lastMarker } from '../../apps/api/src/chat/refs.ts'
import { requestText } from './api.mjs'

const FAKE_EVENT_TITLES = `
const EVENTS = [
	{ day: '2026-06-03', title: 'Екатерина', time: '18:00', durationMinutes: 60 },
	{ day: '2026-06-10', title: 'Екатерина', time: '18:00', durationMinutes: 60 },
	{ day: '2026-07-01', title: 'Яна', time: '09:00', durationMinutes: 60 },
	{ day: '2026-07-08', title: 'Yekaterina IELTS 7.5', time: '10:00', durationMinutes: 90 },
	{ day: '2026-07-15', title: 'Yekaterina IELTS 7.5', time: '10:00', durationMinutes: 90 },
	{ day: '2026-08-05', title: 'Other event', time: '12:00', durationMinutes: 30 },
]
export function createEventTitles() {
	return async (_accountId, range) => ({
		timeZone: 'Asia/Ho_Chi_Minh',
		events: EVENTS.filter((event) => event.day >= range.from && event.day <= range.to),
	})
}
`

if (process.env.CHAT_FAKE_EVENTS === '1')
	registerHooks({
		load(url, context, nextLoad) {
			if (url.endsWith('/apps/api/src/calendar/event-titles.ts'))
				return { format: 'module', source: FAKE_EVENT_TITLES, shortCircuit: true }
			return nextLoad(url, context)
		},
	})

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

function messageAt(content) {
	return lastMarker(content)?.index ?? -1
}

function sourceOf(content) {
	return lastMarker(content)?.ref ?? 'm00000000'
}

function proposalPlan(marker, content, continued, body) {
	const message = content.slice(Math.max(0, messageAt(content)))
	const source_message = sourceOf(content)
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
			source_message,
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
		return call('propose_rate', {
			student_id: studentId,
			source_message,
			rate_text: rate,
			currency: null,
			clear: false,
		})
	}
	if (marker === 'details-level' || marker === 'details-many') {
		if (continued) return say('I prepared the change. Confirm it below.')
		return call(
			'propose_details',
			marker === 'details-level'
				? { student_id: studentId, source_message, level_text: 'B2' }
				: {
						student_id: studentId,
						source_message,
						lesson_minutes_text: '90',
						no_show_deducts: false,
						goals_text: 'Exam preparation',
						time_zone: 'Asia/Tokyo',
					}
		)
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
	if (marker === 'essay') {
		if (!continued) return call('essay_feedback', { task: null })
		return {
			blocks: [
				{
					kind: 'text',
					sentences: [
						'**Task response** The task criterion is not assessed: no task prompt or task type was given.\n',
						'**Coherence and cohesion** The ideas follow in a clear order and the linking words help the reader.\n',
						'**Lexical resource** The words fit the topic; "make a research" should be "do research".\n',
						'**Grammatical range and accuracy** Most sentences are simple; try a complex sentence with "although".',
					],
				},
			],
			stop: 'end_turn',
		}
	}
	if (['note-write', 'note-create', 'note-delete', 'words-add', 'words-remove'].includes(marker)) {
		if (continued) return say('Done.')
		const field = (name) => new RegExp(`${name}:\\s*([^;\\n]+)`).exec(message)?.[1]?.trim() ?? ''
		const text = (/text:\s*([\s\S]*)$/.exec(message)?.[1] ?? '').trim().replaceAll('\\n', '\n')
		if (marker === 'note-write') return call('note_write', { student_id: studentId, block_id: field('block'), text })
		if (marker === 'note-create') return call('note_block_create', { student_id: studentId, name: field('name'), text })
		if (marker === 'note-delete') return call('note_block_delete', { student_id: studentId, block_id: field('block') })
		if (marker === 'words-add')
			return call('vocabulary_add', {
				student_id: studentId,
				words: field('terms')
					.split(',')
					.map((term) => ({ term: term.trim(), note: null })),
			})
		return call('vocabulary_remove', {
			student_id: studentId,
			term_ids: field('ids')
				.split(',')
				.map((id) => id.trim()),
		})
	}
	if (marker === 'bulk') {
		if (continued) return say('I could not prepare that change.')
		const from = /from:\s*([a-z]+)\s+(\d{1,2}:\d{2})/i.exec(message)
		const to = /to:\s*([a-z]+)\s+(\d{1,2}:\d{2})/i.exec(message)
		const zone = /zone:\s*([^;\n]+)/i.exec(message)?.[1]?.trim() ?? null
		return call('propose_bulk_move', {
			student_id: studentId,
			source_message,
			from_weekday: from?.[1]?.toLowerCase() ?? null,
			from_time: from?.[2] ?? null,
			to_weekday: to?.[1]?.toLowerCase() ?? null,
			to_time: to?.[2] ?? null,
			time_zone: zone,
			from: null,
		})
	}
	if (marker === 'calendar' || marker === 'calendar-merge') {
		if (continued)
			return say(
				marker === 'calendar'
					? 'I found the events with Екатерина from 3 June to 15 July, Yekaterina IELTS 7.5 runs 10:00–11:30.'
					: 'Here are all these events in one list.'
			)
		return call('calendar_events', {
			from: '2026-06-01',
			to: '2026-08-31',
			title: 'Екатерина',
			...(marker === 'calendar-merge' ? { merge: true } : {}),
		})
	}
	if (marker === 'help') {
		if (continued) return { blocks: [], stop: 'end_turn' }
		return call('show_help', {})
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

function reviewPlan(marker, content, continued, body) {
	const studentId = /student_id: ([0-9a-f-]{36})/.exec(content)?.[1] ?? null
	const call = (name, input) => ({
		blocks: [{ kind: 'tool', id: `toolu_fake_${++state.ids}`, name, input }],
		stop: 'tool_use',
	})
	const say = (text) => ({ blocks: [{ kind: 'text', sentences: [text] }], stop: 'end_turn' })
	if (marker === 'review-hang') return { hang: true }
	if (!continued)
		return marker === 'review-skip'
			? say('I could not review the notes.')
			: call('review_read', { student_id: studentId })
	let read = null
	try {
		read = JSON.parse(toolResultText(body))
	} catch {
		return say('I could not review the notes.')
	}
	if (typeof read?.status === 'string') return say('The review is finished.')
	const blocks = Array.isArray(read?.blocks) ? read.blocks : []
	const repeated = blocks.find((block) => {
		const lines = String(block.text).split('\n')
		return new Set(lines).size !== lines.length
	})
	const other = blocks.find((block) => block !== repeated) ?? repeated
	const item = (text, block) => ({ text, block_id: block?.block_id ?? null })
	const input = {
		student_id: studentId,
		blocks: [],
		words: [],
		remove_words: [],
		merged_entries: [],
		fixed: [],
		found: [],
		decisions: [],
	}
	if (marker === 'review-questions') {
		input.decisions = [item('Is the exam date still the fifth of March?', other)]
		return call('apply_review', input)
	}
	if (marker === 'review-clean' || repeated === undefined) return call('apply_review', input)
	input.blocks = [{ block_id: repeated.block_id, text: [...new Set(String(repeated.text).split('\n'))].join('\n') }]
	input.fixed = [item('Removed a repeated line.', repeated)]
	input.found = [item('The level says B2 here and B1 in the lesson comments: both are kept.', null)]
	input.decisions = [item('Is the exam date still the fifth of March?', other)]
	return call('apply_review', input)
}

function plan(body) {
	const asked = body.messages
		.filter(
			(message) =>
				message.role === 'user' &&
				(typeof message.content === 'string' || !message.content.some((part) => part.type === 'tool_result'))
		)
		.map((message) => ({ ...message, content: requestText(message.content) }))
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
		const amount = /amount:\s*(\S+)/.exec(content.slice(messageAt(content)))?.[1] ?? null
		const input = {
			student_id: studentId,
			source_message: sourceOf(content),
			replaces: null,
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
	const reviewContent = asked.at(-1)?.content ?? ''
	if (reviewContent.includes('Call review_read first')) return reviewPlan(marker, reviewContent, continued, body)
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
	state.lastBody = body
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

const TITLES = {
	answer: '"Fake plan for the next lesson."',
	long: 'Fake plan for the next lesson with many extra words at the end',
	empty: '  ""  ',
}

async function titleResponse(body, signal) {
	state.titles = (state.titles ?? 0) + 1
	const asked = body.messages.at(-1)?.content
	const marker = /\[fake:title-([a-z]+)\]/.exec(typeof asked === 'string' ? asked : '')?.[1] ?? 'answer'
	if (marker === 'error') return json(500, { type: 'error', error: { type: 'api_error', message: 'Internal error' } })
	if (marker === 'slow') await sleep(1500, signal)
	return json(200, {
		id: `msg_fake_${++state.ids}`,
		type: 'message',
		role: 'assistant',
		model: body.model,
		content: [{ type: 'text', text: TITLES[marker] ?? TITLES.answer, citations: null }],
		stop_reason: 'end_turn',
		stop_sequence: null,
		usage: { input_tokens: 60, output_tokens: 9, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
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
		const body = JSON.parse(raw)
		return body.stream === true ? messagesResponse(body, signal) : titleResponse(body, signal)
	}
	return json(404, { type: 'error', error: { type: 'not_found_error', message: 'Not found' } })
}
