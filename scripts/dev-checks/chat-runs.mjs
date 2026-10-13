import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import * as core from '../../packages/core/src/index.ts'
import { ENV_TEST, ROOT, call, quote, sql, studentCookie, teacherCookie } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

process.env.CHAT_FAKE_DELAY_MS ??= '5'
await import('./chat-fake-anthropic.mjs')

const { createDb } = await import(`${ROOT}/packages/db/src/index.ts`)
const { createApp } = await import(`${ROOT}/apps/api/src/app.ts`)
const { createSignIn } = await import(`${ROOT}/apps/api/src/auth/sign-in.ts`)
const { createChat, inputUpperBound } = await import(`${ROOT}/apps/api/src/chat/runs.ts`)
const { ProviderFault, createChatProvider } = await import(`${ROOT}/apps/api/src/chat/provider.ts`)
const { CHAT_TOOLS } = await import(`${ROOT}/apps/api/src/chat/tools.ts`)
const budget = await import(`${ROOT}/apps/api/src/chat/budget.ts`)
const { resolveModelChoice } = await import(`${ROOT}/apps/api/src/chat/model-config.ts`)
const { readAssistantSettings, saveAssistantSettings } = await import(`${ROOT}/apps/api/src/settings/settings.ts`)
const { chatStreamEvent } = await import(`${ROOT}/packages/contracts/src/index.ts`)

const apiRequire = createRequire(new URL('../../apps/api/package.json', import.meta.url))
const pino = apiRequire('pino')
const { serve } = apiRequire('@hono/node-server')

const PORT = 4226
const NAME = 'Alex Example 2230'
const ACTIVE = ['accepted', 'running']
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const fake = {
	calls: [],
	script: [],
	availability: async () => true,
	stream(request, signal) {
		this.calls.push(request)
		const next = this.script.shift() ?? say('Fine.')
		return next(request, signal)
	},
}

function aborted() {
	return new ProviderFault('provider_unavailable', { aborted: true })
}

function pause(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal.aborted) return reject(aborted())
		const timer = setTimeout(resolve, ms)
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer)
				reject(aborted())
			},
			{ once: true }
		)
	})
}

function message(model, content, stop, usage = {}) {
	return {
		id: `msg_${randomUUID()}`,
		type: 'message',
		role: 'assistant',
		model,
		content,
		stop_reason: stop,
		stop_sequence: null,
		usage: {
			input_tokens: usage.input ?? 100,
			output_tokens: usage.output ?? 40,
			cache_creation_input_tokens: 0,
			cache_read_input_tokens: 0,
		},
	}
}

function say(text, { delay = 0, usage = {} } = {}) {
	return async function* answer(request, signal) {
		for (const piece of text.match(/\S+\s*/gu) ?? []) {
			if (delay > 0) await pause(delay, signal)
			yield { type: 'text', text: piece }
		}
		yield { type: 'text_end' }
		yield {
			type: 'final',
			message: message(request.model, [{ type: 'text', text, citations: null }], 'end_turn', usage),
		}
	}
}

function use(name, input) {
	return async function* toolUse(request) {
		const block = { type: 'tool_use', id: `toolu_${randomUUID().slice(0, 8)}`, name, input }
		yield { type: 'final', message: message(request.model, [block], 'tool_use') }
	}
}

function hang() {
	return async function* hung(_request, signal) {
		await new Promise((_, reject) => signal.addEventListener('abort', () => reject(aborted()), { once: true }))
		yield { type: 'text_end' }
	}
}

const seen = []
function capture(next) {
	return (request, signal) => {
		const last = request.messages.at(-1)
		seen.push(Array.isArray(last?.content) ? last.content.filter((part) => part.type === 'tool_result') : [])
		return next(request, signal)
	}
}

const cardBody = (displayName) => ({
	displayName,
	rateMinor: null,
	currency: null,
	defaultLessonMinutes: 60,
	parent: null,
	level: null,
	goals: null,
	timeZone: null,
})

function removeChats(where) {
	const conversations = `select id from chat_conversations where ${where}`
	sql(`delete from chat_actions where conversation_id in (${conversations})`)
	sql(`delete from chat_usage_attempts where conversation_id in (${conversations})`)
	sql(`delete from chat_turns where conversation_id in (${conversations})`)
	sql(`delete from chat_messages where reply_to is not null and conversation_id in (${conversations})`)
	sql(`delete from chat_messages where conversation_id in (${conversations})`)
	return sql(`delete from chat_conversations where ${where}`).rowCount
}

function removeEntries(where) {
	const cards = `select id from students where ${where}`
	sql(`delete from lesson_comments where student_id in (${cards})`)
	sql(`delete from student_notes where student_id in (${cards})`)
	sql(`delete from student_sections where student_id in (${cards})`)
}

const lines = []
const logger = pino({ level: 'info' }, { write: (line) => lines.push(line) })
const url = parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL
const { pool, db } = createDb(url)
const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
const original = accountId
	? sql(
			`select chat_monthly_cap_usd::text as cap, chat_models as models, chat_model as model, chat_effort as effort, chat_max_input_tokens as input, chat_max_output_tokens as output from teacher_settings where account_id = ${quote(accountId)}`
		).rows[0]
	: undefined

function clearBudget() {
	if (!accountId) return 0
	sql(`delete from chat_usage_attempts where account_id = ${quote(accountId)} and turn_id is null`)
	return sql(
		`delete from chat_budget_periods where account_id = ${quote(accountId)} and id not in (select period_id from chat_usage_attempts)`
	).rowCount
}

const conversations = []
const ids = []
const base = `http://127.0.0.1:${PORT}`
const api = { base, port: PORT }
const signIn = createSignIn({ db, logger, requireClientIp: false })
const chat = createChat({ db, logger, provider: fake })
const app = createApp({
	logger,
	db,
	gitSha: 'check',
	appOrigin: base,
	production: false,
	isStopping: () => false,
	signIn,
	chat,
})
const server = serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' })
let cookie = null

const as = (method, path, body) => call(api, method, path, { cookie, body })

async function conversation() {
	const res = await as('POST', '/chat/conversations')
	if (res.status !== 201) throw new Error(`conversation create returned ${res.status}`)
	conversations.push(res.json.conversation.id)
	return res.json.conversation.id
}

const ask = (conversationId, text) =>
	as('POST', `/chat/conversations/${conversationId}/messages`, { requestId: randomUUID(), text, mentions: [] })

async function settled(turnId, timeout = 20000) {
	const deadline = Date.now() + timeout
	while (Date.now() < deadline) {
		const res = await as('GET', `/chat/turns/${turnId}`)
		if (res.status === 200 && !ACTIVE.includes(res.json.turn.state)) return res.json.turn
		await sleep(100)
	}
	throw new Error('turn did not finish in time')
}

const attempts = (turnId) =>
	sql(
		`select id, state, reserved_nano::text as reserved, cost_nano::text as cost from chat_usage_attempts where turn_id = ${quote(turnId)} order by created_at, id`
	).rows

const turnRow = (turnId) =>
	sql(`select state, issue, requests, seq, assistant_message_id as reply from chat_turns where id = ${quote(turnId)}`)
		.rows[0]

const replyOf = (turnId) =>
	sql(
		`select m.body, m.blocks from chat_messages m join chat_turns t on t.assistant_message_id = m.id where t.id = ${quote(turnId)}`
	).rows[0]

const markOf = (lessonId) =>
	sql(`select kind, revision from lesson_marks where lesson_id = ${quote(lessonId)}`).rows[0] ?? null

function events(turnId, { until = () => false, timeout = 10000 } = {}) {
	return new Promise((resolve, reject) => {
		const list = []
		let buffer = ''
		let done = false
		const finish = (request) => {
			if (done) return
			done = true
			request.destroy()
			resolve(list)
		}
		const request = http.get(
			{
				host: '127.0.0.1',
				port: PORT,
				path: `/chat/turns/${turnId}/stream`,
				headers: { cookie: `__Host-dvlab_session=${cookie}` },
			},
			(response) => {
				list.status = response.statusCode
				list.headers = response.headers
				response.setEncoding('utf8')
				response.on('data', (chunk) => {
					buffer += chunk
					let cut = buffer.indexOf('\n\n')
					while (cut >= 0) {
						const frame = buffer.slice(0, cut)
						buffer = buffer.slice(cut + 2)
						const data = frame
							.split('\n')
							.filter((line) => line.startsWith('data: '))
							.map((line) => line.slice(6))
							.join('\n')
						if (data) list.push(chatStreamEvent.parse(JSON.parse(data)))
						cut = buffer.indexOf('\n\n')
					}
					if (until(list)) finish(request)
				})
				response.on('end', () => finish(request))
			}
		)
		request.on('error', (err) => (done ? undefined : reject(err)))
		setTimeout(() => finish(request), timeout)
	})
}

const texts = (list) =>
	list
		.filter((event) => event.type === 'text')
		.map((event) => event.text)
		.join('')

async function providerSmoke() {
	const fakeState = globalThis.__chatFake
	const real = createChatProvider({ apiKey: 'sk-ant-check-not-a-key' })
	const before = fakeState.models
	const available = await real.availability('claude-haiku-5-5')
	await real.availability('claude-haiku-5-5')
	check('availability reads the Models API once and caches it', available === true && fakeState.models === before + 1)
	const request = (text) => ({
		model: 'claude-haiku-5-5',
		effort: 'medium',
		maxOutputTokens: 1000,
		system: 'check',
		tools: CHAT_TOOLS,
		messages: [{ role: 'user', content: text }],
	})
	const collect = async (text, signal = new AbortController().signal) => {
		const out = []
		for await (const event of real.stream(request(text), signal)) out.push(event)
		return out
	}
	const answer = await collect('Plan the next lesson')
	const final = answer.find((event) => event.type === 'final')?.message
	check(
		'the SDK stream gives text deltas, a block end and the final message with usage',
		answer.filter((event) => event.type === 'text').length > 5 &&
			answer.some((event) => event.type === 'text_end') &&
			final?.stop_reason === 'end_turn' &&
			final.usage.input_tokens === 120 &&
			final.usage.output_tokens > 5
	)
	const tool = await collect('[fake:tool] find someone')
	const toolFinal = tool.find((event) => event.type === 'final')?.message
	const toolUse = toolFinal?.content.find((block) => block.type === 'tool_use')
	check(
		'a tool call arrives only in the final message with parsed input',
		toolFinal?.stop_reason === 'tool_use' && toolUse?.name === 'find_students' && toolUse.input.query === 'Alex Example'
	)
	let credits = null
	try {
		await collect('[fake:credits] hello')
	} catch (error) {
		credits = error
	}
	check(
		'a billing error is credits_unavailable and marked as answered before the stream',
		credits instanceof ProviderFault && credits.code === 'credits_unavailable' && credits.answered === true
	)
	const controller = new AbortController()
	let stopped = null
	try {
		for await (const event of real.stream(request('Plan the next lesson'), controller.signal))
			if (event.type === 'text') controller.abort()
	} catch (error) {
		stopped = error
	}
	check('an abort ends the stream as an aborted fault', stopped instanceof ProviderFault && stopped.aborted === true)
	const tools = CHAT_TOOLS.map((item) => item.name).join(',')
	check(
		'the tool list is the phase list, strict, without server tools',
		tools ===
			'find_students,student_facts,student_notes,lessons,mark_lesson,add_note,add_comment,propose_lesson_change' &&
			CHAT_TOOLS.every(
				(item) => item.strict === true && item.input_schema.additionalProperties === false && !('type' in item)
			)
	)
}

async function main() {
	removeEntries(`display_name like ${quote(`${NAME}%`)} and import_key is null`)
	removeCards(`display_name like ${quote(`${NAME}%`)} and import_key is null`)
	console.log(`fixture budget periods removed ${clearBudget()}`)
	await providerSmoke()

	cookie = await teacherCookie(api)
	await saveAssistantSettings(db, accountId, {
		models: null,
		model: null,
		effort: null,
		monthlyCapUsd: '10.00',
		maxInputTokens: 100000,
		maxOutputTokens: 16000,
	})
	const settings = await readAssistantSettings(db, accountId)
	const choice = resolveModelChoice(settings, null)
	const card = await as('POST', '/students', cardBody(NAME))
	if (card.status !== 201) throw new Error(`card create returned ${card.status}`)
	const studentId = card.json.student.id
	ids.push(studentId)
	const zone =
		sql(`select default_time_zone as zone from teacher_settings where account_id = ${quote(accountId)}`).rows[0]
			?.zone ?? core.SCHEDULE_TIME_ZONE
	const wall = core.zonedParts(new Date(Date.now() - 30 * 60000), zone)
	const startsAt = core.zonedInstant(wall.date, wall.time, zone).toISOString()
	const lessonId = sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(studentId)}, ${quote(startsAt)}, 60, 'scheduled') returning id`
	).rows[0].id
	const markInput = { student_id: studentId, outcome: 'done', date: wall.date, time: wall.time }

	fake.script.push(say('Привет. У ученика осталось 3 урока. Дальше работайте над Unit 5.'))
	const first = await conversation()
	const sent = await ask(first, 'How is the student doing?')
	check(
		'a free question returns 201 with an accepted turn and an empty reply',
		sent.status === 201 &&
			ACTIVE.includes(sent.json.turn?.state) &&
			sent.json.messages.length === 2 &&
			sent.json.messages[1].body === ''
	)
	const answered = await settled(sent.json.turn.id)
	const answerReply = replyOf(answered.id)
	const answerRequest = fake.calls.at(-1)
	check(
		'the turn completes, sentences without counts are published and the count is withheld',
		answered.state === 'completed' &&
			answerReply.body.includes('Привет.') &&
			answerReply.body.includes('Unit 5') &&
			!answerReply.body.includes('3') &&
			answerReply.blocks.some((block) => block.type === 'withheld'),
		JSON.stringify(answerReply)
	)
	check(
		'the request uses the settings model, effort, output limit and the phase tools',
		answerRequest.model === choice.model.id &&
			answerRequest.effort === choice.effort &&
			answerRequest.maxOutputTokens === 16000 &&
			answerRequest.tools.length === 8
	)
	const firstAttempts = attempts(answered.id)
	check(
		'one request is one settled attempt linked to the turn',
		firstAttempts.length === 1 && firstAttempts[0].state === 'settled' && turnRow(answered.id).requests === 1
	)
	const baseBound = inputUpperBound({
		system: answerRequest.system,
		tools: answerRequest.tools,
		messages: answerRequest.messages,
	})

	fake.script.push(use('mark_lesson', markInput), capture(say('The lesson is recorded.')))
	const markTurn = await ask(first, 'Mark today please')
	const marked = await settled(markTurn.json.turn.id)
	const markReply = replyOf(marked.id)
	const action = markReply.blocks.find((block) => block.type === 'action_result')
	const markResult = seen.at(-1)?.[0]
	check(
		'mark_lesson writes the mark through the chat executor with a receipt block in the reply',
		marked.state === 'completed' &&
			markOf(lessonId)?.kind === 'done' &&
			action?.kind === 'mark' &&
			action.mark === 'done',
		JSON.stringify(markReply.blocks)
	)
	check(
		'the tool result comes back to the model in the next request',
		markResult?.tool_use_id !== undefined && markResult.is_error !== true && markResult.content.includes('saved')
	)
	const markAttempts = attempts(marked.id)
	check(
		'two requests in one turn are two reserves and two settlements',
		markAttempts.length === 2 &&
			markAttempts.every((item) => item.state === 'settled') &&
			turnRow(marked.id).requests === 2
	)
	const undo = await as('POST', `/chat/actions/${action?.actionId}/undo`, { requestId: randomUUID() })
	check(
		'Undo of the model-made mark finds its block (200) and returns the lesson to none',
		undo.status === 200 && undo.json.block.undo === 'done' && markOf(lessonId)?.kind === 'none'
	)

	const marksBefore = markOf(lessonId)
	const actionsBefore = sql(`select count(*)::int as n from chat_actions where conversation_id = ${quote(first)}`)
		.rows[0].n
	fake.script.push(
		use('mark_lesson', { student_id: 'not-a-student', outcome: 'done', date: null, time: null }),
		capture(say('I could not do that.'))
	)
	const invalid = await settled((await ask(first, 'Mark it again')).json.turn.id)
	const invalidResult = seen.at(-1)?.[0]
	check(
		'invalid tool arguments give is_error and no effect',
		invalid.state === 'completed' &&
			invalidResult?.is_error === true &&
			invalidResult.content.includes('invalid_arguments') &&
			JSON.stringify(markOf(lessonId)) === JSON.stringify(marksBefore) &&
			sql(`select count(*)::int as n from chat_actions where conversation_id = ${quote(first)}`).rows[0].n ===
				actionsBefore
	)

	await saveAssistantSettings(db, accountId, { monthlyCapUsd: '0.01' })
	let calls = fake.calls.length
	const poor = await settled((await ask(first, 'Anything new?')).json.turn.id)
	check(
		'a reserve that does not fit refuses before the provider is called',
		poor.state === 'completed' &&
			poor.issue === 'budget_insufficient' &&
			replyOf(poor.id).blocks.some((block) => block.type === 'refused' && block.code === 'budget_insufficient') &&
			attempts(poor.id).length === 0 &&
			fake.calls.length === calls
	)
	await saveAssistantSettings(db, accountId, { monthlyCapUsd: '10.00', maxInputTokens: 1000 })
	const tight = await settled((await ask(first, 'Anything new?')).json.turn.id)
	check(
		'an input limit below the instruction and the message refuses budget_insufficient without a call or attempt',
		tight.state === 'completed' &&
			tight.issue === 'budget_insufficient' &&
			attempts(tight.id).length === 0 &&
			fake.calls.length === calls
	)

	const history = await conversation()
	const old = 'Old message number NN about grammar practice. '.repeat(60)
	for (let index = 1; index <= 6; index++) {
		for (const role of ['teacher', 'assistant']) {
			sql(
				`insert into chat_messages (account_id, conversation_id, role, body) values (${quote(accountId)}, ${quote(history)}, '${role}', ${quote(old.replaceAll('NN', `${role}${index}`))})`
			)
		}
	}
	await saveAssistantSettings(db, accountId, { maxInputTokens: baseBound + 7000 })
	fake.script.push(say('Here is what I remember.'))
	const trimmed = await settled((await ask(history, 'What did we discuss?')).json.turn.id)
	const trimmedRequest = fake.calls.at(-1)
	const sentText = JSON.stringify(trimmedRequest.messages)
	check(
		'a long history drops the oldest messages and the answer still comes',
		trimmed.state === 'completed' &&
			!sentText.includes('number teacher1 ') &&
			sentText.includes('number assistant6 ') &&
			inputUpperBound({
				system: trimmedRequest.system,
				tools: trimmedRequest.tools,
				messages: trimmedRequest.messages,
			}) <=
				baseBound + 7000 &&
			trimmedRequest.messages[0].role === 'user'
	)
	await saveAssistantSettings(db, accountId, { maxInputTokens: 100000 })

	for (let index = 1; index <= 35; index++)
		sql(
			`insert into student_notes (student_id, section_kind, body) values (${quote(studentId)}, 'general_info', ${quote(`Note ${index}`)})`
		)
	fake.script.push(use('student_notes', { student_id: studentId }), capture(say('Here are the notes.')))
	await settled((await ask(first, 'Show the notes')).json.turn.id)
	const notes = JSON.parse(seen.at(-1)?.[0]?.content ?? '{}')
	check(
		'a tool result over 30 records is cut to 30 and says truncated',
		notes.truncated === true && notes.records?.length === 30
	)

	const periodBefore = sql(
		`select coalesce(sum(spent_nano), 0)::text as spent from chat_budget_periods where account_id = ${quote(accountId)}`
	).rows[0].spent
	fake.script.push(say('All good.', { usage: { input: 50000, output: 100000 } }))
	const costly = await settled((await ask(first, 'Summarise')).json.turn.id)
	const [costlyAttempt] = attempts(costly.id)
	const periodAfter = sql(
		`select coalesce(sum(spent_nano), 0)::text as spent from chat_budget_periods where account_id = ${quote(accountId)}`
	).rows[0].spent
	const expected = budget.costNano(choice.model.pricing, {
		inputTokens: 50000,
		outputTokens: 100000,
		cacheCreationInputTokens: 0,
		cacheReadInputTokens: 0,
	})
	check(
		'usage above the reserve is spent by fact and logged',
		BigInt(costlyAttempt.cost) === expected &&
			expected > BigInt(costlyAttempt.reserved) &&
			BigInt(periodAfter) - BigInt(periodBefore) === expected &&
			lines.some((line) => line.includes('chat usage cost above reserve'))
	)

	const live = await conversation()
	fake.script.push(
		use('mark_lesson', markInput),
		say(
			'First we review the homework together. Then we read a short story aloud. After that we discuss new words. We finish with a short role play. That closes the session nicely.',
			{ delay: 250 }
		)
	)
	calls = fake.calls.length
	const running = await ask(live, 'Plan the lesson and mark today')
	const runningId = running.json.turn.id
	const one = await events(runningId, { until: (list) => list.filter((event) => event.type === 'text').length >= 2 })
	const snapshotOne = one.find((event) => event.type === 'snapshot')
	check(
		'the stream answers with no-store, no-transform and starts with a snapshot',
		one.status === 200 &&
			String(one.headers['cache-control']).includes('no-store') &&
			String(one.headers['cache-control']).includes('no-transform') &&
			one[0]?.type === 'snapshot'
	)
	check(
		'live events after the snapshot have a higher seq',
		one.filter((event) => event.type === 'text').every((event) => event.seq > snapshotOne.seq)
	)
	const seenText = `${snapshotOne.message.body}${texts(one)}`
	const two = await events(runningId, { until: (list) => list.length >= 1 })
	check(
		'reconnecting gives a snapshot with the same text and no new request',
		two[0]?.type === 'snapshot' && two[0].message.body.startsWith(seenText) && fake.calls.length === calls + 2,
		`${JSON.stringify(seenText)} / ${JSON.stringify(two[0]?.message?.body)}`
	)
	const busyCount = sql(`select count(*)::int as n from chat_messages where conversation_id = ${quote(live)}`).rows[0].n
	const busy = await ask(live, 'Another question')
	check(
		'a second message during the turn is 409 busy and stores nothing',
		busy.status === 409 &&
			busy.json?.error?.code === 'busy' &&
			sql(`select count(*)::int as n from chat_messages where conversation_id = ${quote(live)}`).rows[0].n === busyCount
	)
	const stop = await as('POST', `/chat/turns/${runningId}/stop`, {})
	const stoppedAttempts = attempts(runningId)
	const stoppedReply = replyOf(runningId)
	await sleep(600)
	check(
		'Stop reply stops the turn, keeps the tool effect and leaves the attempt in flight unknown',
		stop.status === 200 &&
			stop.json.turn.state === 'stopped' &&
			markOf(lessonId)?.kind === 'done' &&
			stoppedAttempts.length === 2 &&
			stoppedAttempts[0].state === 'settled' &&
			stoppedAttempts[1].state === 'unknown' &&
			stoppedReply.blocks.some((block) => block.type === 'action_result') &&
			stoppedReply.blocks.at(-1)?.type === 'stopped' &&
			fake.calls.length === calls + 2,
		JSON.stringify(stoppedAttempts)
	)
	const again = await as('POST', `/chat/turns/${runningId}/stop`, {})
	check('a second Stop answers with the same stopped turn', again.status === 200 && again.json.turn.state === 'stopped')

	const student = await studentCookie(api)
	const asStudent = await call(api, 'GET', `/chat/turns/${runningId}/stream`, { cookie: student })
	const anonymous = await call(api, 'GET', `/chat/turns/${runningId}`, {})
	const unknown = await as('GET', `/chat/turns/${randomUUID()}/stream`)
	check(
		'turn routes need a teacher session and an own turn',
		asStudent.status === 403 && anonymous.status === 401 && unknown.status === 404
	)

	const swept = await conversation()
	const teacherRow = sql(
		`insert into chat_messages (account_id, conversation_id, role, body) values (${quote(accountId)}, ${quote(swept)}, 'teacher', 'sweep check') returning id`
	).rows[0].id
	const replyRow = sql(
		`insert into chat_messages (account_id, conversation_id, role, body, reply_to) values (${quote(accountId)}, ${quote(swept)}, 'assistant', '', ${quote(teacherRow)}) returning id`
	).rows[0].id
	const orphan = sql(
		`insert into chat_turns (account_id, conversation_id, teacher_message_id, assistant_message_id, state, model, effort) values (${quote(accountId)}, ${quote(swept)}, ${quote(teacherRow)}, ${quote(replyRow)}, 'running', ${quote(choice.model.id)}, ${quote(choice.effort)}) returning id`
	).rows[0].id
	const reservedOne = await db.transaction((tx) =>
		budget.reserveAttempt(tx, accountId, swept, choice, new Date(), orphan)
	)
	const reservedTwo = await db.transaction((tx) =>
		budget.reserveAttempt(tx, accountId, swept, choice, new Date(), orphan)
	)
	await budget.markDispatched(db, reservedTwo.attemptId)
	const restarted = createChat({ db, logger, provider: fake })
	calls = fake.calls.length
	await restarted.sweepInterrupted()
	const sweptAttempts = attempts(orphan)
	check(
		'sweepInterrupted marks the turn interrupted, releases the reserved attempt and leaves the sent one unknown',
		turnRow(orphan).state === 'interrupted' &&
			sweptAttempts.find((item) => item.id === reservedOne.attemptId)?.state === 'released' &&
			sweptAttempts.find((item) => item.id === reservedTwo.attemptId)?.state === 'unknown' &&
			replyOf(orphan).blocks.at(-1)?.type === 'interrupted' &&
			fake.calls.length === calls
	)

	fake.script.push(hang())
	const crash = await conversation()
	const beforeCrash = fake.calls.length
	const hung = (await ask(crash, 'Will this crash?')).json.turn.id
	const deadline = Date.now() + 10000
	while (Date.now() < deadline && (attempts(hung)[0]?.state !== 'dispatched' || fake.calls.length === beforeCrash))
		await sleep(100)
	calls = fake.calls.length
	await restarted.sweepInterrupted()
	await chat.close()
	await sleep(300)
	const crashReply = replyOf(hung)
	check(
		'after a simulated crash the turn is interrupted, its attempt unknown, and nothing is sent again',
		turnRow(hung).state === 'interrupted' &&
			attempts(hung)[0]?.state === 'unknown' &&
			crashReply.blocks.filter((block) => block.type === 'interrupted').length === 1 &&
			fake.calls.length === calls,
		JSON.stringify({
			turn: turnRow(hung),
			attempts: attempts(hung).map((item) => item.state),
			blocks: crashReply.blocks.map((block) => block.type),
		})
	)

	const denied = []
	for (const statement of ['delete from chat_turns where false', 'truncate chat_turns']) {
		try {
			sql(statement, 'app')
			denied.push('done')
		} catch (err) {
			denied.push(String(err.message))
		}
	}
	check(
		'the application role cannot DELETE or TRUNCATE chat turns',
		denied.every((text) => text.includes('42501')),
		denied.join(' | ')
	)
	const log = lines.join('')
	check(
		'the log has turn and attempt ids but no message text or student name',
		log.includes('chat turn finished') &&
			log.includes('chat attempt settled') &&
			!log.includes('Unit 5') &&
			!log.includes('Привет') &&
			!log.includes(NAME) &&
			!log.includes('Mark today')
	)
}

let done = false
try {
	if (!accountId) throw new Error('no active teacher fixture; run another chat-api section first')
	await main()
	done = true
} catch (err) {
	failures++
	console.log(`FAIL runs crashed ${err instanceof Error ? err.message : String(err)}`)
} finally {
	await chat.close()
	server.close()
	if (conversations.length > 0) removeChats(`id in (${conversations.map(quote).join(', ')})`)
	if (ids.length > 0) removeEntries(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
	if (ids.length > 0) removeCards(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
	clearBudget()
	if (original && accountId) {
		await saveAssistantSettings(db, accountId, {
			monthlyCapUsd: original.cap,
			models: original.models,
			model: original.model,
			effort: original.effort,
			maxInputTokens: original.input,
			maxOutputTokens: original.output,
		})
	}
	await pool.end()
}

if (failures > 0)
	for (const line of lines.filter((item) => item.includes('"level":50')).slice(0, 5)) {
		const entry = JSON.parse(line)
		console.log(
			`LOG ${entry.msg}: ${entry.err?.message ?? ''} ${(entry.err?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
		)
	}

if (failures === 0 && done) console.log('CHAT_RUNS_OK')
else console.log(`runs failures ${failures}`)
process.exit(failures === 0 && done ? 0 : 1)
