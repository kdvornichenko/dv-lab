import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import { isDeepStrictEqual, parseEnv } from 'node:util'

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
const { chatConversationReadResponse, chatStreamEvent } = await import(`${ROOT}/packages/contracts/src/index.ts`)

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
			'find_students,student_facts,student_notes,lessons,lesson_dates,mark_lesson,add_note,add_comment,propose_lesson_change,propose_payment,propose_student,propose_rate,propose_archive,student_payments,propose_payment_delete,propose_entry_removal,open_page' &&
			CHAT_TOOLS.every(
				(item) => item.strict === true && item.input_schema.additionalProperties === false && !('type' in item)
			)
	)
}

const RU_MONTHS = [
	'января',
	'февраля',
	'марта',
	'апреля',
	'мая',
	'июня',
	'июля',
	'августа',
	'сентября',
	'октября',
	'ноября',
	'декабря',
]
const spoken = (date) => `${Number(date.slice(8, 10))} ${RU_MONTHS[Number(date.slice(5, 7)) - 1]}`
const weekdayRu = (date, zone) =>
	new Intl.DateTimeFormat('ru-RU', { weekday: 'long', timeZone: zone }).format(core.zonedInstant(date, '12:00', zone))

function mentionOf(text, studentId) {
	const start = text.indexOf('@') + 1
	return { studentId, text: NAME, start, end: start + NAME.length }
}

function askAbout(conversationId, text, studentId) {
	return as('POST', `/chat/conversations/${conversationId}/messages`, {
		requestId: randomUUID(),
		text,
		mentions: [mentionOf(text, studentId)],
	})
}

async function datedAnswers(conversationId, studentId, wall, zone, startsAt) {
	const day = core.lessonDay(new Date(startsAt), zone)
	const todayText = `были сегодня уроки у @${NAME}?`
	fake.script.push(
		use('lessons', { student_id: studentId, from: day, to: day, show: true }),
		capture(
			say(
				`Сегодня, ${weekdayRu(day, zone)} ${spoken(day)}, у ${NAME} был урок в ${wall.time}. Отметку видно в блоке ниже.`
			)
		)
	)
	const todaySent = await askAbout(conversationId, todayText, studentId)
	if (todaySent.status !== 201) throw new Error(`mention ask returned ${todaySent.status}`)
	const today = await settled(todaySent.json.turn.id)
	const todayReply = replyOf(today.id)
	const todayBlocks = todayReply.blocks.filter((block) => block.type === 'lessons')
	const todayView = JSON.parse(seen.at(-1)?.[0]?.content ?? '{}')
	check(
		'the lessons tool gives the date, weekday and time of each lesson in the teacher time zone',
		todayView.records?.[0]?.date === wall.date &&
			todayView.records[0].time === wall.time &&
			typeof todayView.records[0].weekday === 'string' &&
			todayView.from === day &&
			todayView.shown === true,
		JSON.stringify(todayView)
	)
	check(
		'an answer about a lesson with its date, time and the student name is published whole, without withheld',
		today.state === 'completed' &&
			todayReply.body.includes(spoken(day)) &&
			todayReply.body.includes(wall.time) &&
			todayReply.body.includes(NAME) &&
			todayReply.body.includes('Отметку видно в блоке ниже.') &&
			!todayReply.blocks.some((block) => block.type === 'withheld'),
		JSON.stringify(todayReply)
	)
	check(
		'a question about the lesson of one day shows one lessons block with that lesson',
		todayBlocks.length === 1 &&
			todayBlocks[0].date === day &&
			todayBlocks[0].lessons.length === 1 &&
			todayBlocks[0].lessons[0].studentId === studentId &&
			todayBlocks[0].lessons[0].startsAt === startsAt,
		JSON.stringify(todayBlocks)
	)

	const yesterday = core.addDays(day, -1)
	fake.script.push(
		use('lessons', { student_id: studentId, from: yesterday, to: yesterday, show: true }),
		say(`Вчера, ${weekdayRu(yesterday, zone)} ${spoken(yesterday)}, уроков у ${NAME} не было.`)
	)
	const before = await settled((await askAbout(conversationId, `а вчера у @${NAME}?`, studentId)).json.turn.id)
	const beforeReply = replyOf(before.id)
	check(
		'an answer about yesterday names the checked date, is published whole and an empty day shows no block',
		before.state === 'completed' &&
			beforeReply.body.includes(spoken(yesterday)) &&
			!beforeReply.blocks.some((block) => block.type === 'withheld' || block.type === 'lessons'),
		JSON.stringify(beforeReply)
	)

	const far = core.addDays(core.zonedParts(new Date(), zone).date, 10)
	fake.script.push(say(`Сначала повторите тему. Встретимся ${spoken(far)}. Удачи.`))
	const invented = await settled((await ask(conversationId, 'Что дальше?')).json.turn.id)
	const inventedReply = replyOf(invented.id)
	check(
		'a sentence with a date that is not in the turn data is withheld',
		inventedReply.body.includes('Сначала повторите тему.') &&
			inventedReply.body.includes('Удачи.') &&
			!inventedReply.body.includes('Встретимся') &&
			inventedReply.blocks.some((block) => block.type === 'withheld'),
		JSON.stringify(inventedReply)
	)

	fake.script.push(say('Оплата прошла. Он оплатил 1500 рублей. Спасибо.'))
	const paid = await settled((await ask(conversationId, 'Он заплатил?')).json.turn.id)
	const paidReply = replyOf(paid.id)
	check(
		'a sentence with a sum is withheld',
		paidReply.body.includes('Оплата прошла.') &&
			!paidReply.body.includes('1500') &&
			paidReply.blocks.some((block) => block.type === 'withheld'),
		JSON.stringify(paidReply)
	)

	fake.script.push(
		use('student_facts', { student_id: studentId, show: false }),
		say(`${NAME} занимается по общему курсу.`)
	)
	const about = await settled((await askAbout(conversationId, `расскажи про @${NAME}`, studentId)).json.turn.id)
	const aboutReply = replyOf(about.id)
	const listed = [
		`Вот что было ${spoken(day)}:`,
		'- времена глаголов;',
		'- **чтение** коротких текстов.',
		'',
		'1. Повторить `present perfect`.',
		`2. Начать в ${wall.time}.`,
		'',
		'**Итог:** тема закрыта.',
	].join('\n')
	fake.script.push(use('lessons', { student_id: studentId, from: day, to: day, show: false }), say(listed))
	const markdown = await settled((await askAbout(conversationId, `что прошли с @${NAME}?`, studentId)).json.turn.id)
	const markdownReply = replyOf(markdown.id)
	check(
		'an answer with markdown lists, bold and code is published whole with its line breaks',
		markdown.state === 'completed' &&
			markdownReply.body === listed &&
			!markdownReply.blocks.some((block) => block.type === 'withheld' || block.type === 'lessons'),
		JSON.stringify(markdownReply)
	)
	check(
		'student_facts with show false reads the facts and shows no facts block',
		about.state === 'completed' &&
			aboutReply.body.includes(NAME) &&
			!aboutReply.blocks.some((block) => block.type === 'facts' || block.type === 'withheld'),
		JSON.stringify(aboutReply)
	)
}

function slowUse(name, input, ms = 300) {
	return async function* toolUse(request, signal) {
		await pause(ms, signal)
		const block = { type: 'tool_use', id: `toolu_${randomUUID().slice(0, 8)}`, name, input }
		yield { type: 'final', message: message(request.model, [block], 'tool_use') }
	}
}

const finished = (list) => list.some((event) => event.type === 'state' && !ACTIVE.includes(event.turn.state))

async function readThread(conversationId) {
	const res = await as('GET', `/chat/conversations/${conversationId}`)
	return chatConversationReadResponse.parse(res.json)
}

async function stepsAndMentions(studentId, zone) {
	const thread = await conversation()
	const day = core.lessonDay(new Date(), zone)
	const ghost = randomUUID()
	const replyText = `${NAME} is doing well. Later ${NAME} reads more.`
	fake.script.push(
		slowUse('student_facts', { student_id: studentId, show: false }),
		use('lessons', { student_id: studentId, from: day, to: day, show: false }),
		use('student_notes', { student_id: ghost }),
		say(replyText, { delay: 40 })
	)
	const sent = await askAbout(thread, `как дела у @${NAME}?`, studentId)
	const list = await events(sent.json.turn.id, { until: finished, timeout: 15000 })
	const turn = await settled(sent.json.turn.id)
	const live = list.filter((event) => event.type === 'step').map((event) => event.step)
	const byTool = (tool) => live.filter((step) => step.tool === tool)
	check(
		'the stream carries step events: a running then a done step per tool with the student name and the range',
		byTool('student_facts')
			.map((step) => step.state)
			.join(',') === 'running,done' &&
			byTool('student_facts')[0].studentId === studentId &&
			byTool('student_facts')[0].studentName === NAME &&
			byTool('lessons')[0]?.from === day &&
			byTool('lessons')[0]?.to === day &&
			byTool('lessons').at(-1)?.state === 'done',
		JSON.stringify(live)
	)
	check(
		'a tool that fails gives a failed step without a name it cannot know',
		byTool('student_notes').at(-1)?.state === 'failed' && byTool('student_notes')[0].studentName === undefined,
		JSON.stringify(byTool('student_notes'))
	)
	check(
		'Writing the answer is a step that starts with the first text and ends done',
		byTool('answer').length >= 2 && byTool('answer')[0].state === 'running' && byTool('answer').at(-1).state === 'done'
	)
	const seqs = list.filter((event) => 'seq' in event && event.type !== 'snapshot').map((event) => event.seq)
	check(
		'step events take part in the turn sequence',
		seqs.every((seq, index) => index === 0 || seq > seqs[index - 1]),
		JSON.stringify(seqs)
	)
	const last = list.findLast((event) => event.type === 'state')
	const stored = sql(
		`select m.steps, m.mentions, m.body from chat_messages m join chat_turns t on t.assistant_message_id = m.id where t.id = ${quote(turn.id)}`
	).rows[0]
	check(
		'the steps are stored with the reply, all closed, in the order they started',
		turn.state === 'completed' &&
			stored.steps.map((step) => `${step.tool}:${step.state}`).join(',') ===
				'student_facts:done,lessons:done,student_notes:failed,answer:done',
		JSON.stringify(stored.steps)
	)
	const expected = { studentId, text: NAME, start: 0, end: NAME.length }
	check(
		'the reply marks the first use of a known name as a mention range over the stored text',
		stored.body === replyText &&
			stored.mentions.length === 1 &&
			isDeepStrictEqual(stored.mentions[0], expected) &&
			stored.body.slice(stored.mentions[0].start, stored.mentions[0].end) === NAME,
		JSON.stringify(stored.mentions)
	)
	const read = await readThread(thread)
	const reply = read.messages.find((item) => item.role === 'assistant')
	const teacher = read.messages.find((item) => item.role === 'teacher')
	check(
		'reading the conversation gives the steps, the mentions and finishedAt of the reply, none for the teacher',
		isDeepStrictEqual(reply?.steps, stored.steps) &&
			isDeepStrictEqual(reply?.mentions, [expected]) &&
			typeof reply?.finishedAt === 'string' &&
			Date.parse(reply.finishedAt) >= Date.parse(reply.createdAt) &&
			teacher?.finishedAt === null &&
			teacher.steps.length === 0
	)
	check(
		'the last state event carries the finished message with closed steps, mentions and finishedAt',
		last?.message?.id === reply?.id &&
			isDeepStrictEqual(last.message.steps, stored.steps) &&
			isDeepStrictEqual(last.message.mentions, [expected]) &&
			last.message.finishedAt === reply.finishedAt
	)
	check(
		'step words carry no figure: only ids, names and dates',
		stored.steps.every((step) =>
			Object.keys(step).every((key) => ['id', 'tool', 'state', 'studentId', 'studentName', 'from', 'to'].includes(key))
		)
	)

	const other = await as('POST', '/students', cardBody(`${NAME} Found`))
	ids.push(other.json.student.id)
	fake.script.push(use('find_students', { query: `${NAME} Found` }), say(`${NAME} Found is the one. Ask ${NAME} too.`))
	const found = await settled((await askAbout(thread, `найди @${NAME}`, studentId)).json.turn.id)
	const foundRow = sql(
		`select m.steps, m.mentions, m.body from chat_messages m join chat_turns t on t.assistant_message_id = m.id where t.id = ${quote(found.id)}`
	).rows[0]
	const at = foundRow.body.indexOf(`Ask ${NAME}`) + 4
	check(
		'a name read in this turn is marked, a longer name wins over its prefix and each student once',
		isDeepStrictEqual(foundRow.mentions, [
			{ studentId: other.json.student.id, text: `${NAME} Found`, start: 0, end: `${NAME} Found`.length },
			{ studentId, text: NAME, start: at, end: at + NAME.length },
		]),
		JSON.stringify(foundRow.mentions)
	)
	check(
		'find_students with one match ends with that student in the step',
		foundRow.steps[0]?.tool === 'find_students' &&
			foundRow.steps[0].state === 'done' &&
			foundRow.steps[0].studentId === other.json.student.id &&
			foundRow.steps[0].studentName === `${NAME} Found`,
		JSON.stringify(foundRow.steps)
	)

	fake.script.push(say('One part. Two parts. Three parts. Four parts. Five parts.', { delay: 300 }))
	const stopping = await ask(thread, 'Tell me a story')
	await events(stopping.json.turn.id, {
		until: (list) => list.some((event) => event.type === 'step' && event.step.tool === 'answer'),
	})
	await as('POST', `/chat/turns/${stopping.json.turn.id}/stop`, {})
	const stoppedRow = sql(
		`select m.steps from chat_messages m join chat_turns t on t.assistant_message_id = m.id where t.id = ${quote(stopping.json.turn.id)}`
	).rows[0]
	check(
		'Stop reply closes the running step as stopped',
		stoppedRow.steps.length === 1 && stoppedRow.steps[0].tool === 'answer' && stoppedRow.steps[0].state === 'stopped',
		JSON.stringify(stoppedRow.steps)
	)

	const raw = sql(
		`insert into chat_messages (account_id, conversation_id, role, body) values (${quote(accountId)}, ${quote(thread)}, 'assistant', 'Old reply.') returning id`
	).rows[0].id
	const old = (await readThread(thread)).messages.find((item) => item.id === raw)
	check(
		'a reply stored without steps and without a turn reads with no steps and its own time as finishedAt',
		old !== undefined && old.steps.length === 0 && old.finishedAt === old.createdAt
	)
	return thread
}

async function todayFromLessonDay(conversationId, zone) {
	const day = core.lessonDay(new Date(), zone)
	fake.script.push(say(`Сегодня ${spoken(day)}. Хорошего дня.`))
	const turn = await settled((await ask(conversationId, 'Какое сегодня число?')).json.turn.id)
	const request = String(fake.calls.at(-1).messages.at(-1).content)
	const reply = replyOf(turn.id)
	check(
		'the turn context has a Lesson day line from lessonDay and the answer with that date is published',
		request.includes(`\nLesson day: ${day} (`) &&
			request.includes(`\nNow: ${core.zonedParts(new Date(), zone).date} `) &&
			reply.body.includes(spoken(day)) &&
			!reply.blocks.some((block) => block.type === 'withheld'),
		JSON.stringify({ request: request.split('\n').slice(0, 5), reply })
	)
	check(
		'the system prompt says today and yesterday count from the lesson day',
		String(fake.calls.at(-1).system).includes('Lesson day line')
	)
}

async function lessonDates(conversationId) {
	const zone = core.SCHEDULE_TIME_ZONE
	const card = await as('POST', '/students', cardBody(`${NAME} Dates`))
	const studentId = card.json.student.id
	ids.push(studentId)
	const today = core.lessonDay(new Date(), zone)
	const first = core.addDays(today, -14)
	const series = sql(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values (${quote(studentId)}, ${core.weekdayOf(first)}, '10:00', 60, ${quote(first)}, null) returning id`
	).rows[0].id
	const movedOn = core.addDays(today, -7)
	const movedTo = core.addDays(today, -6)
	sql(`insert into lesson_marks (series_id, original_on, kind) values (${quote(series)}, ${quote(first)}, 'no_show')`)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(series)}, ${quote(movedOn)}, 'moved', ${quote(core.zonedInstant(movedTo, '11:00', zone).toISOString())}, 60)`
	)
	sql(`insert into lesson_marks (series_id, original_on, kind) values (${quote(series)}, ${quote(movedOn)}, 'done')`)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind) values (${quote(series)}, ${quote(today)}, 'cancelled')`
	)
	const to = core.addDays(today, 14)
	fake.script.push(
		use('lesson_dates', { student_id: studentId, from: first, to, scope: 'held', show: true }),
		use('lesson_dates', { student_id: studentId, from: first, to, scope: 'all', show: true }),
		capture(say('Here are the held lessons.'))
	)
	const turn = await settled((await ask(conversationId, 'Which lessons were held?')).json.turn.id)
	const reply = replyOf(turn.id)
	const blocks = reply.blocks.filter((block) => block.type === 'lesson_dates')
	const view = JSON.parse(seen.at(-1)?.[0]?.content ?? '{}')
	check(
		'lesson_dates gives one block per student: held dates on the day a lesson was moved to, the cancelled and moved-away days left out',
		blocks.length === 1 &&
			blocks[0].studentId === studentId &&
			blocks[0].studentName === `${NAME} Dates` &&
			blocks[0].from === first &&
			blocks[0].to === to &&
			blocks[0].scope === 'held' &&
			isDeepStrictEqual(blocks[0].dates, [movedTo]) &&
			isDeepStrictEqual(blocks[0].leftOut, { noShow: 1, ahead: 2 }) &&
			blocks[0].coverage === 'complete',
		JSON.stringify(blocks)
	)
	check(
		'the second call reads all lessons for the model without a second block and gives no counts',
		isDeepStrictEqual(view.dates, [first, movedTo, core.addDays(today, 7), to]) &&
			view.shown === false &&
			!('leftOut' in view) &&
			reply.body === 'Here are the held lessons.',
		JSON.stringify(view)
	)
	const steps = sql(
		`select m.steps from chat_messages m join chat_turns t on t.assistant_message_id = m.id where t.id = ${quote(turn.id)}`
	).rows[0].steps
	check(
		'the lesson_dates step has the student and the period',
		steps[0]?.tool === 'lesson_dates' &&
			steps[0].from === first &&
			steps[0].to === to &&
			steps[0].studentName === `${NAME} Dates`,
		JSON.stringify(steps)
	)
	const refreshed = await as('POST', '/chat/records/refresh', {
		key: { kind: 'lesson_dates', studentId, from: first, to, scope: 'held' },
	})
	check(
		'Refresh records by the lesson_dates key reads the same block',
		refreshed.status === 200 &&
			isDeepStrictEqual({ ...refreshed.json.block, asOf: null }, { ...blocks[0], asOf: null }),
		JSON.stringify(refreshed.json)
	)

	const monthStart = `${today.slice(0, 8)}01`
	const monthEnd = core.addDays(`${core.addDays(monthStart, 32).slice(0, 8)}01`, -1)
	const pastFrom = core.addDays(first, -60)
	const pastTo = core.addDays(first, -31)
	fake.script.push(
		use('lesson_dates', { student_id: studentId, from: null, to: null, scope: 'no_show', show: true }),
		use('lesson_dates', { student_id: ids[0], from: pastFrom, to: pastTo, scope: 'all', show: true }),
		say('Done.')
	)
	const second = await settled((await ask(conversationId, 'Lessons this month?')).json.turn.id)
	const shown = replyOf(second.id).blocks.filter((block) => block.type === 'lesson_dates')
	const inMonth = (date) => date >= monthStart && date <= monthEnd
	check(
		'without a period the block is the current month of lesson days',
		shown[0]?.from === monthStart &&
			shown[0].to === monthEnd &&
			isDeepStrictEqual(shown[0].dates, inMonth(first) ? [first] : []) &&
			shown[0].leftOut.noShow === 0,
		JSON.stringify(shown[0])
	)
	check(
		'an empty period is still one block with no dates and nothing left out',
		shown[1]?.studentId === ids[0] &&
			shown[1].dates.length === 0 &&
			isDeepStrictEqual(shown[1].leftOut, { noShow: 0, ahead: 0 }),
		JSON.stringify(shown[1])
	)
	fake.script.push(
		use('lesson_dates', { student_id: studentId, from: first, to: core.addDays(first, 400), scope: 'all', show: true }),
		capture(say('Too long.'))
	)
	await settled((await ask(conversationId, 'All lessons ever?')).json.turn.id)
	check(
		'a period over the limit is a tool error',
		JSON.parse(seen.at(-1)?.[0]?.content ?? '{}').error === 'range_too_long'
	)
}

async function linkFields(conversationId, studentId, lessonId, startsAt, zone) {
	const day = core.lessonDay(new Date(startsAt), zone)
	fake.script.push(use('lessons', { student_id: studentId, from: day, to: day, show: true }), say('Here it is.'))
	const shownTurn = await settled((await ask(conversationId, 'That lesson?')).json.turn.id)
	const lessonsBlock = replyOf(shownTurn.id).blocks.find((block) => block.type === 'lessons')
	const shownLesson = lessonsBlock?.lessons.find((item) => item.startsAt === startsAt)
	check(
		'a lesson in the lessons block has its ref and main-zone lesson day',
		isDeepStrictEqual(shownLesson?.ref, { kind: 'single', lessonId }) && shownLesson.date === day,
		JSON.stringify(lessonsBlock)
	)
	const commentId = sql(
		`insert into lesson_comments (lesson_id, student_id, body) values (${quote(lessonId)}, ${quote(studentId)}, 'Worked on linking words.') returning id`
	).rows[0].id
	const noteId = sql(
		`insert into student_notes (student_id, section_kind, body) values (${quote(studentId)}, 'general_info', 'Likes podcasts.') returning id`
	).rows[0].id
	fake.script.push(
		use('student_notes', { student_id: studentId }),
		say(`Notes. [[note:${noteId}]] Comment. [[comment:${commentId}]] Goal. [[section:${studentId}:goals]]`)
	)
	const quoted = await settled((await ask(conversationId, 'Quote them')).json.turn.id)
	const excerpts = replyOf(quoted.id).blocks.filter((block) => block.type === 'excerpt')
	const note = excerpts.find((block) => block.source === 'note')
	const comment = excerpts.find((block) => block.source === 'comment')
	const section = excerpts.find((block) => block.source === 'section')
	check(
		'excerpts carry the note entry, the section key and tab and the lesson ref and day of a comment',
		note?.entry === noteId &&
			isDeepStrictEqual(section?.section, { key: 'goals', tab: 'notes' }) &&
			isDeepStrictEqual(comment?.lesson, { ref: { kind: 'single', lessonId }, date: day }),
		JSON.stringify(excerpts)
	)
	sql(`update student_notes set retracted_at = now() where id = ${quote(noteId)}`)
	sql(`update lesson_comments set retracted_at = now() where id = ${quote(commentId)}`)
	const read = await readThread(conversationId)
	const readBlocks = read.messages.flatMap((item) => item.blocks).filter((block) => block.type === 'excerpt')
	const readNote = readBlocks.find((block) => block.source === 'note' && block.id === noteId)
	const readComment = readBlocks.find((block) => block.source === 'comment' && block.id === commentId)
	check(
		'a quote of a removed note or comment is read without its link fields',
		readNote !== undefined &&
			!('entry' in readNote) &&
			readComment !== undefined &&
			!('lesson' in readComment) &&
			readBlocks.some((block) => block.source === 'section' && block.section?.key === 'goals')
	)
}

async function genderOfCard(studentId) {
	const name = `${NAME} Gender`
	const created = await as('POST', '/students', { ...cardBody(name), gender: 'female' })
	if (created.status !== 201) throw new Error(`gender card create returned ${created.status}`)
	const id = created.json.student.id
	ids.push(id)
	const detail = await as('GET', `/students/${id}`)
	const list = await as('GET', '/students')
	const options = await as('GET', '/students/options')
	const row = list.json.students.find((item) => item.id === id)
	check(
		'a card is created with a gender that the card reads, the list and the options do not carry it',
		created.json.student.gender === 'female' &&
			detail.json.student.gender === 'female' &&
			row !== undefined &&
			!('gender' in row) &&
			options.json.students.every((item) => !('gender' in item)),
		JSON.stringify({ created: created.json.student.gender, row })
	)
	const kept = await as('PATCH', `/students/${id}`, cardBody(name))
	const male = await as('PATCH', `/students/${id}`, { ...cardBody(name), gender: 'male' })
	const cleared = await as('PATCH', `/students/${id}`, { ...cardBody(name), gender: null })
	const stored = sql(`select gender from students where id = ${quote(id)}`).rows[0].gender
	const wrong = await as('PATCH', `/students/${id}`, { ...cardBody(name), gender: 'other' })
	const fresh = await as('POST', '/students', cardBody(`${NAME} Unset`))
	if (fresh.status === 201) ids.push(fresh.json.student.id)
	check(
		'a save without gender keeps it, male changes it, null clears it, an unknown value is 400 and a new card starts without one',
		kept.json.student.gender === 'female' &&
			male.json.student.gender === 'male' &&
			cleared.json.student.gender === null &&
			stored === null &&
			wrong.status === 400 &&
			fresh.json.student.gender === null,
		JSON.stringify([kept.status, male.status, cleared.status, wrong.status, fresh.status])
	)
	await as('PATCH', `/students/${id}`, { ...cardBody(name), gender: 'male' })

	const thread = await conversation()
	const text = `как дела у @${name}?`
	const start = text.indexOf('@') + 1
	const calls = fake.calls.length
	fake.script.push(
		use('find_students', { query: name }),
		capture(use('student_facts', { student_id: id, show: true })),
		capture(say('Он молодец.'))
	)
	const turn = await settled(
		(
			await as('POST', `/chat/conversations/${thread}/messages`, {
				requestId: randomUUID(),
				text,
				mentions: [{ studentId: id, text: name, start, end: start + name.length }],
			})
		).json.turn.id
	)
	const request = fake.calls[calls]
	const found = JSON.parse(seen.at(-2)?.[0]?.content ?? '{}')
	const facts = JSON.parse(seen.at(-1)?.[0]?.content ?? '{}')
	const block = replyOf(turn.id).blocks.find((item) => item.type === 'facts')
	check(
		'the gender reaches the model: the mentioned students line, find_students and student_facts, and the prompt has the rule',
		String(request?.messages.at(-1).content).includes(`- ${name} (student_id: ${id}, gender: male)`) &&
			String(request?.system).includes('Choose the grammatical gender') &&
			String(request?.system).includes('never guess it from the name') &&
			found.students?.[0]?.gender === 'male' &&
			facts.gender === 'male',
		JSON.stringify({ found, gender: facts.gender })
	)
	check(
		'the facts block and the facts the model reads carry no gender',
		block !== undefined && !JSON.stringify(block).includes('gender') && !('gender' in (facts.facts ?? {})),
		JSON.stringify(block)
	)
	fake.script.push(say('Fine.'))
	await settled((await askAbout(thread, `и @${NAME}?`, studentId)).json.turn.id)
	check(
		'a mentioned student without a gender goes to the model as gender null',
		String(fake.calls.at(-1).messages.at(-1).content).includes(`- ${NAME} (student_id: ${studentId}, gender: null)`)
	)
}

async function pageLinks(studentId) {
	const thread = await conversation()
	const sentence = "I can't record payments from the chat."
	const payment = { kind: 'payments', student_id: studentId, date: null, tab: null, dialog: 'payment' }
	fake.script.push(
		use('open_page', payment),
		capture(use('open_page', { kind: 'settings', student_id: null, date: null, tab: 'assistant', dialog: null })),
		capture(say(sentence))
	)
	const sent = await askAbout(thread, `@${NAME} добавь оплату 8 уроков`, studentId)
	const list = await events(sent.json.turn.id, { until: finished, timeout: 15000 })
	const turn = await settled(sent.json.turn.id)
	const reply = replyOf(turn.id)
	const links = reply.blocks.filter((block) => block.type === 'action_link')
	const firstResult = JSON.parse(seen.at(-2)?.[0]?.content ?? '{}')
	const secondResult = JSON.parse(seen.at(-1)?.[0]?.content ?? '{}')
	check(
		'a request without a tool gives one action_link block to the payments with the Record payment dialog and no value',
		links.length === 1 &&
			isDeepStrictEqual(links[0], {
				type: 'action_link',
				kind: 'payments',
				studentId,
				studentName: NAME,
				date: null,
				tab: null,
				dialog: 'payment',
			}) &&
			firstResult.status === 'shown' &&
			secondResult.status === 'not_shown',
		JSON.stringify({ links, firstResult, secondResult })
	)
	check(
		'the reply is the one sentence, without the amount from the request and without withheld',
		reply.body.trim() === sentence &&
			!/\p{Nd}/u.test(reply.body) &&
			!JSON.stringify(reply.blocks.map((block) => ({ ...block, studentId: null }))).includes('8') &&
			!reply.blocks.some((block) => block.type === 'withheld'),
		JSON.stringify(reply)
	)
	const read = await readThread(thread)
	const streamed = list.filter((event) => event.type === 'block' && event.block.type === 'action_link')
	check(
		'the block is read back with the conversation and sent once in the stream, and open_page has no step',
		read.messages.some((item) => item.blocks.some((block) => block.type === 'action_link')) &&
			streamed.length === 1 &&
			!sql(
				`select m.steps from chat_messages m join chat_turns t on t.assistant_message_id = m.id where t.id = ${quote(turn.id)}`
			).rows[0].steps.some((step) => step.tool === 'open_page'),
		JSON.stringify(streamed)
	)

	fake.script.push(
		use('open_page', { ...payment, dialog: null }),
		say('Я не могу записать оплату из чата. Вы просили 8 уроков.')
	)
	const echoed = replyOf(
		(await settled((await askAbout(thread, `@${NAME} запиши оплату 8 уроков`, studentId)).json.turn.id)).id
	)
	check(
		'a sentence that repeats the number from the request is withheld, the short sentence and the block stay, the block before withheld',
		echoed.body.trim() === 'Я не могу записать оплату из чата.' &&
			echoed.blocks.map((block) => block.type).join(',') === 'action_link,withheld' &&
			echoed.blocks[0].dialog === null,
		JSON.stringify(echoed)
	)

	fake.script.push(
		use('open_page', { kind: 'overview', student_id: studentId, date: null, tab: null, dialog: 'details' }),
		use('student_facts', { student_id: studentId, show: true }),
		say('This is the profile.')
	)
	const ordered = replyOf(
		(await settled((await askAbout(thread, `@${NAME} измени профиль`, studentId)).json.turn.id)).id
	)
	check(
		'the action block stands after the facts even when the page was asked first',
		ordered.blocks.map((block) => block.type).join(',') === 'facts,action_link' &&
			ordered.blocks[1].kind === 'overview' &&
			ordered.blocks[1].dialog === 'details',
		JSON.stringify(ordered.blocks.map((block) => block.type))
	)

	const day = core.lessonDay(new Date(), core.SCHEDULE_TIME_ZONE)
	fake.script.push(
		use('open_page', { kind: 'messages', student_id: studentId, date: null, tab: null, dialog: null }),
		capture(use('open_page', { kind: 'payments', student_id: null, date: null, tab: null, dialog: null })),
		capture(use('open_page', { kind: 'payments', student_id: studentId, date: null, tab: null, dialog: 'details' })),
		capture(use('open_page', { kind: 'notes', student_id: randomUUID(), date: null, tab: null, dialog: null })),
		capture(use('open_page', { kind: 'schedule_day', student_id: studentId, date: day, tab: null, dialog: null })),
		capture(say('Here is the day.'))
	)
	const checked = await settled((await ask(thread, 'Open things')).json.turn.id)
	const errors = seen.slice(-5, -1).map((results) => JSON.parse(results[0]?.content ?? '{}').error)
	const dayLinks = replyOf(checked.id).blocks.filter((block) => block.type === 'action_link')
	check(
		'no page, a missing student, a dialog of another page and an unknown student give errors and no block; a day link has only its date',
		isDeepStrictEqual(errors, ['no_page', 'invalid_arguments', 'invalid_arguments', 'student_not_found']) &&
			isDeepStrictEqual(dayLinks, [
				{
					type: 'action_link',
					kind: 'schedule_day',
					studentId: null,
					studentName: null,
					date: day,
					tab: null,
					dialog: null,
				},
			]),
		JSON.stringify({ errors, dayLinks })
	)
	check(
		'a past action block goes to the model as a short note',
		JSON.stringify(fake.calls.at(-1).messages).includes(`[Showed a link to the payments page of ${NAME}]`)
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
			answerRequest.tools.length === 17 &&
			answerRequest.tools.some((item) => item.name === 'open_page' && item.strict === true)
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
		'a mark receipt carries the student, the lesson ref and its lesson day',
		action?.studentId === studentId &&
			isDeepStrictEqual(action.lessonRef, { kind: 'single', lessonId }) &&
			action.lessonDate === core.lessonDay(new Date(startsAt), zone),
		JSON.stringify(action)
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

	const movedCard = await as('POST', '/students', cardBody(`${NAME} Moved`))
	if (movedCard.status !== 201) throw new Error(`moved card create returned ${movedCard.status}`)
	const movedId = movedCard.json.student.id
	ids.push(movedId)
	const movedDate = core.addDays(core.zonedParts(new Date(), core.SCHEDULE_TIME_ZONE).date, -3)
	const movedSeries = sql(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values (${quote(movedId)}, ${core.weekdayOf(movedDate)}, '16:00', 60, ${quote(core.addDays(movedDate, -14))}, null) returning id`
	).rows[0].id
	const movedStart = core.zonedInstant(movedDate, '17:00', core.SCHEDULE_TIME_ZONE).toISOString()
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(movedSeries)}, ${quote(movedDate)}, 'moved', ${quote(movedStart)}, 60)`
	)
	sql(
		`insert into lesson_marks (series_id, original_on, kind) values (${quote(movedSeries)}, ${quote(movedDate)}, 'done')`
	)
	fake.script.push(
		use('lessons', {
			student_id: movedId,
			from: core.addDays(movedDate, -1),
			to: core.addDays(movedDate, 1),
			show: true,
		}),
		capture(say('Here are the lessons.'))
	)
	const movedTurn = await settled((await ask(first, 'What lessons did that student have?')).json.turn.id)
	const movedView = JSON.parse(seen.at(-1)?.[0]?.content ?? '{}')
	const movedOn = (movedView.records ?? []).filter(
		(record) => core.zonedParts(new Date(record.starts_at), core.SCHEDULE_TIME_ZONE).date === movedDate
	)
	check(
		'a series lesson moved within its day and marked done is one record in the lessons tool, at the new time',
		movedOn.length === 1 && movedOn[0].starts_at === movedStart && movedOn[0].outcome === 'done',
		JSON.stringify(movedView.records)
	)
	check(
		'lessons over a period with show true read the records but show no block',
		movedView.shown === false && !replyOf(movedTurn.id).blocks.some((block) => block.type === 'lessons')
	)
	fake.script.push(
		use('lessons', { student_id: movedId, from: movedDate, to: movedDate, show: true }),
		use('lessons', { student_id: movedId, from: movedDate, to: movedDate, show: true }),
		say('Here is that lesson.')
	)
	const movedShown = await settled((await ask(first, 'What about that lesson?')).json.turn.id)
	const movedBlocks = replyOf(movedShown.id).blocks.filter((block) => block.type === 'lessons')
	check(
		'lessons of one day with show true give one block with the moved lesson once, at the new time',
		movedBlocks.length === 1 &&
			movedBlocks[0].date === movedDate &&
			movedBlocks[0].day === null &&
			movedBlocks[0].calendarRead === null &&
			movedBlocks[0].lessons.length === 1 &&
			movedBlocks[0].lessons[0].startsAt === movedStart &&
			movedBlocks[0].lessons[0].movedTo === null &&
			movedBlocks[0].lessons[0].outcome === 'done',
		JSON.stringify(movedBlocks)
	)

	await datedAnswers(first, studentId, wall, zone, startsAt)

	const quoteText = 'Prefers short reading texts, about 7 pages a week.'
	const sectionText = 'Studies for the 2027 exam.'
	sql(
		`insert into student_notes (student_id, section_kind, body) values (${quote(studentId)}, 'general_info', ${quote(quoteText)})`
	)
	sql(
		`insert into student_sections (student_id, kind, body) values (${quote(studentId)}, 'goals', ${quote(sectionText)})`
	)
	const quotedId = sql(
		`select id from student_notes where student_id = ${quote(studentId)} and body = ${quote(quoteText)}`
	).rows[0].id
	const oldestId = sql(`select id from student_notes where student_id = ${quote(studentId)} and body = 'Note 1'`)
		.rows[0].id
	fake.script.push(
		use('student_notes', { student_id: studentId }),
		capture(
			say(
				`Short texts work well. [[note:${quotedId}]] Keep it up. The goal is clear. [[section:${studentId}:goals]] [[note:${quotedId.toUpperCase()}]]`
			)
		)
	)
	const cited = await settled((await ask(first, 'What do the notes say?')).json.turn.id)
	const citedReply = replyOf(cited.id)
	const excerpts = citedReply.blocks.filter((block) => block.type === 'excerpt')
	const noteView = JSON.parse(seen.at(-1)?.[0]?.content ?? '{}')
	check(
		'the tool result carries cite markers and ids for the kept records',
		noteView.records?.some((record) => record.cite === `[[note:${quotedId}]]`) &&
			noteView.sections?.some((record) => record.cite === `[[section:${studentId}:goals]]`)
	)
	check(
		'a cite of an issued note and section is replaced by blocks with the stored text, once each',
		cited.state === 'completed' &&
			excerpts.length === 2 &&
			excerpts[0].source === 'note' &&
			excerpts[0].id === quotedId &&
			excerpts[0].body === quoteText &&
			excerpts[0].studentId === studentId &&
			typeof excerpts[0].createdAt === 'string' &&
			excerpts[1].source === 'section' &&
			excerpts[1].sectionKind === 'goals' &&
			excerpts[1].body === sectionText,
		JSON.stringify(citedReply.blocks.map((block) => block.type))
	)
	check(
		'the reply text keeps the sentences, loses the markers and has no stored text',
		citedReply.body.includes('Short texts work well.') &&
			citedReply.body.includes('Keep it up.') &&
			citedReply.body.includes('The goal is clear.') &&
			!citedReply.body.includes('[[') &&
			!citedReply.body.includes(quoteText) &&
			!citedReply.blocks.some((block) => block.type === 'withheld'),
		JSON.stringify(citedReply.body)
	)

	fake.script.push(
		use('student_notes', { student_id: studentId }),
		say(`See [[note:${randomUUID()}]] for details. Fine. Also [[note:${oldestId}]] now. Done. Plain [[ text. End.`)
	)
	const invented = await settled((await ask(first, 'Quote something')).json.turn.id)
	const inventedReply = replyOf(invented.id)
	check(
		'an invented id, a stored id not issued in the turn and a stray marker hold the sentence back',
		invented.state === 'completed' &&
			!inventedReply.blocks.some((block) => block.type === 'excerpt') &&
			inventedReply.blocks.some((block) => block.type === 'withheld') &&
			inventedReply.body.includes('Fine.') &&
			inventedReply.body.includes('Done.') &&
			inventedReply.body.includes('End.') &&
			!inventedReply.body.includes('details') &&
			!inventedReply.body.includes('[[') &&
			!inventedReply.body.includes('now'),
		JSON.stringify(inventedReply)
	)
	fake.script.push(say(`Straight to the point. [[note:${quotedId}]]`))
	const unread = await settled((await ask(first, 'Quote without reading')).json.turn.id)
	check(
		'a real note id is not quoted when no tool issued it in this turn',
		!replyOf(unread.id).blocks.some((block) => block.type === 'excerpt') &&
			replyOf(unread.id).blocks.some((block) => block.type === 'withheld')
	)

	fake.script.push(
		use('student_notes', { student_id: studentId }),
		say(`Sections: [[section:${studentId}:goals]], [[note:${quotedId}]].`)
	)
	const listed = await settled((await ask(first, 'List the records')).json.turn.id)
	const listedReply = replyOf(listed.id)
	check(
		'markers in a list leave no stray punctuation and still give both blocks',
		listedReply.body.trim() === 'Sections.' &&
			listedReply.blocks.filter((block) => block.type === 'excerpt').length === 2,
		JSON.stringify(listedReply.body)
	)

	fake.script.push(
		use('student_facts', { student_id: studentId, show: true }),
		use('student_facts', { student_id: studentId, show: true }),
		capture(say('Here is the balance. You have 3 lessons left. Nothing else to add.'))
	)
	const factsTurn = await settled((await ask(first, 'How many lessons are left?')).json.turn.id)
	const factsReply = replyOf(factsTurn.id)
	const factsBlocks = factsReply.blocks.filter((block) => block.type === 'facts')
	const factsRead = await as('GET', `/chat/records?studentId=${studentId}`)
	const toolFacts = JSON.parse(seen.at(-1)?.[0]?.content ?? '{}')
	check(
		'a question about lessons gets one facts block equal to the records read and no number in the text',
		factsTurn.state === 'completed' &&
			factsBlocks.length === 1 &&
			factsBlocks[0].facts.student.id === studentId &&
			factsBlocks[0].facts.balanceMinutes === factsRead.json.balanceMinutes &&
			isDeepStrictEqual(factsBlocks[0].facts.nextLesson, factsRead.json.nextLesson) &&
			toolFacts.facts?.balanceMinutes === factsRead.json.balanceMinutes &&
			!/\p{Nd}/u.test(factsReply.body) &&
			factsReply.body.includes('Here is the balance.') &&
			factsReply.body.includes('Nothing else to add.') &&
			factsReply.blocks.some((block) => block.type === 'withheld'),
		JSON.stringify(factsReply)
	)

	await todayFromLessonDay(first, zone)
	await lessonDates(first)
	await linkFields(first, studentId, lessonId, startsAt, zone)
	await stepsAndMentions(studentId, zone)
	await genderOfCard(studentId)
	await pageLinks(studentId)

	fake.script.push(say('Which student?'))
	await settled((await ask(first, '/recap')).json.turn.id)
	const recapRequest = fake.calls.at(-1)
	const recapText = String(recapRequest.messages.at(-1).content)
	check(
		'/recap goes to the model as a recap task with the tools',
		recapText.includes('Prepare a recap for the mentioned student') &&
			!recapText.includes('[Message]\n/recap') &&
			recapRequest.tools.some((item) => item.name === 'student_notes')
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
