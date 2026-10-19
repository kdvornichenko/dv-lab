import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import { lastMarker } from '../../apps/api/src/chat/refs.ts'
import * as core from '../../packages/core/src/index.ts'
import { ENV_TEST, ROOT, STATE_DIR, call, quote, requestText, sql, teacherCookie } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

const { createDb } = await import(`${ROOT}/packages/db/src/index.ts`)
const { createApp } = await import(`${ROOT}/apps/api/src/app.ts`)
const { createSignIn } = await import(`${ROOT}/apps/api/src/auth/sign-in.ts`)
const { createChat } = await import(`${ROOT}/apps/api/src/chat/runs.ts`)
const { createChatProvider } = await import(`${ROOT}/apps/api/src/chat/provider.ts`)
const { saveAssistantSettings } = await import(`${ROOT}/apps/api/src/settings/settings.ts`)

const apiRequire = createRequire(new URL('../../apps/api/package.json', import.meta.url))
const pino = apiRequire('pino')
const { serve } = apiRequire('@hono/node-server')

const usage =
	'usage: node scripts/dev-checks/chat-context-eval.mjs [--models haiku,sonnet] [--runs 3] [--only S01,S04] [--label before] [--parallel 4]'

function option(name, fallback) {
	const index = process.argv.indexOf(name)
	return index === -1 ? fallback : (process.argv[index + 1] ?? fallback)
}

const MODEL_IDS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5' }
const MODELS = option('--models', 'haiku,sonnet').split(',')
const RUNS = Number(option('--runs', '3'))
const ONLY = option('--only', '')
	.split(',')
	.filter((item) => item !== '')
const LABEL = option('--label', 'run')
const PARALLEL = Number(option('--parallel', '4'))
if (
	MODELS.some((model) => !(model in MODEL_IDS)) ||
	!Number.isInteger(RUNS) ||
	RUNS < 1 ||
	!/^[a-z0-9-]+$/u.test(LABEL)
) {
	console.log(usage)
	process.exit(2)
}

const BUDGET = {
	requests: 4,
	requestInput: 30000,
	turnUsd: { haiku: 0.004, sonnet: 0.06 },
}

const PORT = 4293
const PREFIX = 'Alex Example 9'
const FIXTURE_NAME = /^Alex Example 9[4-9]\d\d$/u
const ACTIVE = ['accepted', 'running']
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const MONTHS = [
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
const WEEKDAYS_ACC = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу']

function apiKey() {
	if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
	const file = `${ROOT}/.env`
	return existsSync(file) ? (parseEnv(readFileSync(file, 'utf8')).ANTHROPIC_API_KEY ?? null) : null
}

const key = apiKey()
if (!key) {
	console.log('NOT RUN chat-context-eval needs ANTHROPIC_API_KEY in the environment or the root .env')
	process.exit(2)
}

const real = createChatProvider({ apiKey: key })
const captured = []
const provider = {
	availability: real.availability,
	complete: real.complete,
	async *stream(request, signal) {
		const entry = { request, final: null }
		captured.push(entry)
		for await (const event of real.stream(request, signal)) {
			if (event.type === 'final') entry.final = event.message
			yield event
		}
	},
}

const lines = []
const logger = pino({ level: 'info' }, { write: (line) => lines.push(line) })
const { pool, db } = createDb(parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL)
const base = `http://127.0.0.1:${PORT}`
const api = { base, port: PORT }
const chat = createChat({ db, logger, provider })
const app = createApp({
	logger,
	db,
	gitSha: 'check',
	appOrigin: base,
	production: false,
	isStopping: () => false,
	signIn: createSignIn({ db, logger, requireClientIp: false }),
	chat,
})
const server = serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' })
let cookie = null
const as = (method, path, body) => call(api, method, path, { cookie, body })

const ownCards = []
const ownConversations = []
let nameCounter = 0

function nextName() {
	const number = 9400 + (nameCounter++ % 600)
	return `Alex Example ${number}`
}

function ruDate(iso) {
	const [, month, day] = iso.split('-').map(Number)
	return `${day} ${MONTHS[month - 1]}`
}

function dayNumber(iso) {
	return String(Number(iso.slice(8)))
}

function weekdayOf(iso) {
	return new Date(`${iso}T12:00:00Z`).getUTCDay()
}

function removeChats(where) {
	const conversations = `select id from chat_conversations where ${where}`
	sql(`delete from chat_actions where conversation_id in (${conversations})`)
	sql(`delete from chat_usage_attempts where conversation_id in (${conversations})`)
	sql(`delete from chat_turns where conversation_id in (${conversations})`)
	sql(`delete from chat_messages where reply_to is not null and conversation_id in (${conversations})`)
	sql(`delete from chat_messages where conversation_id in (${conversations})`)
	return sql(`delete from chat_conversations where ${where}`).rowCount
}

const STUDENTS = {
	a: { rateMinor: 400000, currency: 'RUB', gender: 'female' },
	b: { rateMinor: 300000, currency: 'RUB', gender: 'male' },
	c: { rateMinor: null, currency: null, gender: 'male' },
	d: { rateMinor: 3000, currency: 'USD', gender: 'male' },
}

async function card(letter) {
	const name = nextName()
	const spec = STUDENTS[letter]
	const res = await as('POST', '/students', {
		displayName: name,
		rateMinor: spec.rateMinor,
		currency: spec.currency,
		defaultLessonMinutes: 60,
		parent: null,
		level: null,
		goals: null,
		timeZone: null,
		gender: spec.gender,
	})
	if (res.status !== 201) throw new Error(`card create returned ${res.status}`)
	ownCards.push(res.json.student.id)
	return { id: res.json.student.id, name }
}

async function seedPayment(student, amountMinor, currency, paidOn, zone) {
	const res = await as('POST', '/payments', {
		studentId: student.id,
		paidOn,
		expectedDefaultTimeZone: zone,
		amountMinor,
		currency,
		lessonsHundredths: null,
		note: null,
	})
	if (res.status !== 201 && res.status !== 200) throw new Error(`payment seed returned ${res.status}`)
}

async function conversation(model) {
	const res = await as('POST', '/chat/conversations')
	if (res.status !== 201) throw new Error(`conversation create returned ${res.status}`)
	const id = res.json.conversation.id
	ownConversations.push(id)
	const set = await as('PATCH', `/chat/conversations/${id}/model`, {
		model,
		effort: null,
		expectedRevision: res.json.conversation.revision,
	})
	if (set.status !== 200) throw new Error(`model override returned ${set.status}`)
	return id
}

async function settled(turnId, timeout = 180000) {
	const deadline = Date.now() + timeout
	while (Date.now() < deadline) {
		const res = await as('GET', `/chat/turns/${turnId}`)
		if (res.status === 200 && !ACTIVE.includes(res.json.turn.state)) return res.json.turn
		await sleep(250)
	}
	throw new Error('turn did not finish in time')
}

function fill(text, people) {
	return text.replace(/\{([a-d])\}/gu, (_match, letter) => people[letter].name)
}

function mentionsOf(text, people) {
	const found = []
	for (const student of Object.values(people)) {
		let at = text.indexOf(`@${student.name}`)
		while (at !== -1) {
			found.push({ studentId: student.id, text: student.name, start: at + 1, end: at + 1 + student.name.length })
			at = text.indexOf(`@${student.name}`, at + 1)
		}
	}
	return found
}

function toolUsesFor(text, names) {
	const own = captured.filter((entry) => {
		const last = entry.request.messages.findLast(
			(message) =>
				message.role === 'user' && !(Array.isArray(message.content) && message.content[0]?.type === 'tool_result')
		)
		if (last === undefined) return false
		const asked = requestText(last.content)
		const marker = lastMarker(asked)
		if (marker === null) return false
		const body = asked.slice(asked.indexOf('\n', marker.index) + 1)
		if (body !== text && !body.startsWith(`${text}\n`)) return false
		const all = JSON.stringify(entry.request.messages)
		return names.some((name) => all.includes(name))
	})
	const uses = []
	const errors = []
	for (const entry of own) {
		for (const block of entry.final?.content ?? []) if (block.type === 'tool_use') uses.push(block.name)
		const tail = entry.request.messages.at(-1)
		if (Array.isArray(tail?.content))
			for (const part of tail.content)
				if (part.type === 'tool_result' && part.is_error) errors.push(String(part.content).slice(0, 120))
	}
	return { uses, errors: [...new Set(errors)] }
}

function attemptsOf(turnId) {
	return sql(
		`select usage, cost_nano::text as cost from chat_usage_attempts where turn_id = ${quote(turnId)} and state = 'settled' order by created_at`
	).rows
}

function blockSummary(block) {
	if (block.type === 'change_proposal') {
		const change = block.change
		if (change.operation === 'record_payment')
			return `change_proposal record_payment ${change.studentName} ${change.amountMinor / 100} ${change.currency} ${change.paidOn} lessons ${change.lessonsHundredths}`
		return `change_proposal ${change.operation} ${change.studentName ?? change.displayName ?? ''}`
	}
	if (block.type === 'refused') return `refused ${block.code}`
	return block.type
}

async function send(conversationId, text, people) {
	const sent = await as('POST', `/chat/conversations/${conversationId}/messages`, {
		requestId: randomUUID(),
		text,
		mentions: mentionsOf(text, people),
	})
	if (sent.status !== 201 || !sent.json.turn) throw new Error(`message returned ${sent.status}`)
	const turn = await settled(sent.json.turn.id)
	const [reply] = sql(
		`select m.body, m.blocks from chat_messages m join chat_turns t on t.assistant_message_id = m.id where t.id = ${quote(turn.id)}`
	).rows
	const attempts = attemptsOf(turn.id)
	const costUsd = attempts.reduce((sum, row) => sum + Number(row.cost ?? 0) / 1e9, 0)
	const inputs = attempts.map(
		(row) => row.usage.inputTokens + row.usage.cacheReadInputTokens + row.usage.cacheCreationInputTokens
	)
	const tools = toolUsesFor(
		text,
		Object.values(people).map((student) => student.name)
	)
	return {
		teacher: text,
		state: turn.state,
		issue: turn.issue,
		reply: reply?.body ?? '',
		blocks: (reply?.blocks ?? []).map(blockSummary),
		requests: attempts.length,
		inputs,
		cacheRead: attempts.map((row) => row.usage.cacheReadInputTokens),
		cacheWrite: attempts.map((row) => row.usage.cacheCreationInputTokens),
		costUsd,
		tools: tools.uses,
		toolErrors: tools.errors,
	}
}

async function lastProposal(conversationId) {
	const [row] = sql(
		`select id from chat_actions where conversation_id = ${quote(conversationId)} and kind = 'change' and state = 'proposed' order by created_at desc limit 1`
	).rows
	return row?.id ?? null
}

function liveProposals(conversationIds) {
	if (conversationIds.length === 0) return []
	return sql(
		`select conversation_id as conv, target from chat_actions where conversation_id in (${conversationIds.map(quote).join(', ')}) and kind = 'change' and state = 'proposed' and target->>'operation' <> 'review_offer' order by created_at`
	).rows
}

const pay = (student, amount, extra = {}) => ({ op: 'record_payment', student, amount, ...extra })

function matches(expect, target, people, ctx) {
	if (target.operation !== expect.op) return false
	if (expect.student && target.studentId !== people[expect.student].id) return false
	if (expect.op === 'record_payment') {
		if (target.amountMinor !== Math.round(expect.amount * 100)) return false
		if (expect.currency !== undefined && target.currency !== expect.currency) return false
		const dates = [expect.paidOn ?? ctx.today].flat()
		if (!dates.includes(target.paidOn)) return false
		if (expect.lessons !== undefined && target.lessonsHundredths !== expect.lessons) return false
	}
	if (
		expect.op === 'set_rate' &&
		expect.rate !== undefined &&
		target.after?.rateMinor !== Math.round(expect.rate * 100)
	)
		return false
	return true
}

function describe(target) {
	if (target.operation === 'record_payment')
		return `record_payment ${target.studentId.slice(0, 8)} ${target.amountMinor / 100} ${target.currency} ${target.paidOn} ${target.lessonsHundredths}`
	return `${target.operation} ${String(target.studentId ?? '').slice(0, 8)}`
}

function scenarios(ctx) {
	const { today } = ctx
	const day = (offset) => core.addDays(today, -offset)
	let friday = today
	while (weekdayOf(friday) !== 5) friday = core.addDays(friday, -1)
	const fridays = weekdayOf(today) === 5 ? [today, core.addDays(today, -7)] : [friday]
	const thisMay = `${today.slice(0, 4)}-05-10`
	const may = thisMay <= today ? thisMay : `${Number(today.slice(0, 4)) - 1}-05-10`
	return [
		{
			id: 'S01',
			kind: 'ссылка назад',
			students: ['a'],
			turns: [
				{ text: `@{a} заплатила 8000 за 2 урока ${ruDate(day(3))}`, after: 'decline' },
				{ text: 'я же писал выше, запиши заново' },
			],
			live: [pay('a', 8000, { paidOn: day(3), lessons: 200, currency: 'RUB' })],
		},
		{
			id: 'S02',
			kind: 'ссылка назад',
			students: ['a'],
			turns: [{ text: '@{a} заплатила сегодня' }, { text: '8000' }],
			live: [pay('a', 8000, { paidOn: today, currency: 'RUB' })],
		},
		{
			id: 'S03',
			kind: 'местоимение',
			students: ['a'],
			turns: [
				{ text: '@{a} готовится к IELTS, запиши это в заметки' },
				{ text: 'и она вчера заплатила 9000 за 3 урока' },
			],
			live: [pay('a', 9000, { paidOn: day(1), lessons: 300 })],
		},
		{
			id: 'S04',
			kind: 'поправка',
			students: ['a'],
			turns: [{ text: '@{a} заплатила 8000 за 2 урока' }, { text: `нет, ${dayNumber(day(3))}-го` }],
			live: [pay('a', 8000, { paidOn: day(3), lessons: 200 })],
		},
		{
			id: 'S05',
			kind: 'поправка',
			students: ['b'],
			turns: [{ text: '@{b} заплатил 6000' }, { text: 'ой, не 6000, а 9000' }],
			live: [pay('b', 9000)],
		},
		{
			id: 'S06',
			kind: 'поправка',
			students: ['a', 'b'],
			turns: [{ text: '@{a} заплатила 8000' }, { text: 'это не она, а @{b}' }],
			live: [pay('b', 8000)],
		},
		{
			id: 'S07',
			kind: 'поправка',
			students: ['a'],
			turns: [{ text: '@{a} заплатила 8000' }, { text: 'это за 3 урока, по старой цене' }],
			live: [pay('a', 8000, { lessons: 300 })],
		},
		{
			id: 'S08',
			kind: 'подтверждение',
			students: ['a'],
			turns: [{ text: 'запиши оплату {a} 8000' }, { text: 'да' }],
			live: [pay('a', 8000)],
		},
		{
			id: 'S09',
			kind: 'подтверждение',
			students: ['a'],
			turns: [{ text: '@{a} заплатила 8000' }, { text: 'да' }],
			live: [pay('a', 8000)],
		},
		{
			id: 'S10',
			kind: 'подтверждение',
			students: ['c'],
			turns: [{ text: '@{c} заплатил 5000' }, { text: 'в рублях' }],
			live: [pay('c', 5000, { currency: 'RUB' })],
		},
		{
			id: 'S11',
			kind: 'местоимение',
			students: ['a'],
			seed: [{ student: 'a', amountMinor: 700000, currency: 'RUB', offset: 5 }],
			turns: [{ text: 'что у @{a} с оплатой?' }, { text: 'удали её последнюю оплату' }],
			live: [{ op: 'delete_payment', student: 'a' }],
		},
		{
			id: 'S12',
			kind: 'ссылка назад',
			students: ['a', 'b'],
			turns: [{ text: '@{a} заплатила 8000' }, { text: '@{b} столько же' }],
			live: [pay('a', 8000), pay('b', 8000)],
		},
		{
			id: 'S13',
			kind: 'местоимение',
			students: ['b'],
			turns: [{ text: 'что известно про @{b}?' }, { text: 'поставь ему ставку 3500' }],
			live: [{ op: 'set_rate', student: 'b', rate: 3500 }],
		},
		{
			id: 'S14',
			kind: 'прошлый чат',
			students: ['a'],
			turns: [
				{ text: `@{a} заплатила 8000 ${ruDate(day(3))}` },
				{ text: 'запиши оплату @{a}, о которой я писал в другом чате', fresh: true },
			],
			live: [pay('a', 8000, { paidOn: day(3) })],
			liveFresh: [],
		},
		{
			id: 'S15',
			kind: 'прошлый чат',
			students: ['a'],
			turns: [
				{ text: '@{a} хочет сдать IELTS на 7, запиши это в заметки' },
				{ text: 'какая цель у @{a}?', fresh: true },
			],
			live: [],
			replyHas: /IELTS/iu,
			toolUsed: 'student_notes',
		},
		{
			id: 'S16',
			kind: 'прошлый чат',
			students: ['a'],
			seed: [{ student: 'a', amountMinor: 700000, currency: 'RUB', offset: 10 }],
			turns: [{ text: '@{a} заплатила как в прошлый раз' }],
			live: [],
		},
		{
			id: 'S17',
			kind: 'провокация',
			students: ['a'],
			turns: [{ text: '@{a} заплатила за 2 урока' }],
			live: [],
		},
		{
			id: 'S18',
			kind: 'провокация',
			students: ['a', 'b'],
			turns: [{ text: '@{a} заплатила 8000' }, { text: '@{b} тоже заплатил' }],
			live: [pay('a', 8000)],
		},
		{
			id: 'S19',
			kind: 'провокация',
			students: ['b'],
			turns: [{ text: 'у @{b} теперь 2 урока в неделю, по 15:00' }, { text: 'он заплатил' }],
			live: [],
		},
		{
			id: 'S20',
			kind: 'провокация',
			students: ['a'],
			turns: [{ text: '@{a} заплатила 4000 и ещё 4000. Сложи и запиши одной оплатой' }],
			live: [],
			allowExtra: (target) => target.operation === 'record_payment' && target.amountMinor === 400000,
		},
		{
			id: 'S21',
			kind: 'повтор',
			students: ['a'],
			turns: [{ text: `@{a} заплатила 8000 ${ruDate(day(3))} за 2 урока` }],
			live: [pay('a', 8000, { paidOn: day(3), lessons: 200 })],
		},
		{
			id: 'S22',
			kind: 'повтор',
			students: ['a', 'b'],
			turns: [{ text: '@{a} заплатила 8000, а @{b} 6000' }],
			live: [pay('a', 8000), pay('b', 6000)],
		},
		{
			id: 'S23',
			kind: 'дата',
			students: ['b'],
			turns: [{ text: `@{b} заплатил 6000 ${WEEKDAYS_ACC[5]}` }],
			live: [pay('b', 6000, { paidOn: fridays })],
		},
		{
			id: 'S24',
			kind: 'поправка',
			students: ['d'],
			turns: [
				{ text: `@{d} заплатил 30 долларов ${ruDate(day(4))}` },
				{ text: 'какая у него ставка?' },
				{ text: `кстати, в оплате не та дата, должно быть ${ruDate(day(6))}` },
			],
			live: [pay('d', 30, { paidOn: day(6), currency: 'USD' })],
		},
		{
			id: 'S25',
			kind: 'провокация',
			students: ['a'],
			turns: [
				{ text: 'сколько уроков осталось у @{a}?' },
				{ text: 'запиши ей оплату на столько, сколько не хватает до 10 уроков' },
			],
			live: [],
		},
		{
			id: 'S26',
			kind: 'ссылка назад',
			students: ['a'],
			turns: [{ text: `Запиши оплату @{a} ${ruDate(day(3))}` }, { text: '1000*8=8000 рублей, 8 занятий' }],
			live: [pay('a', 8000, { paidOn: day(3), lessons: 800, currency: 'RUB' })],
		},
		{
			id: 'S27',
			kind: 'дата',
			students: ['a'],
			turns: [
				{
					text: '@{a} record payment from her mother Person Example on May 10 for 40 lessons, the whole payment was 64000 rubles',
				},
			],
			live: [pay('a', 64000, { paidOn: may, lessons: 4000, currency: 'RUB' })],
		},
		{
			id: 'S28',
			kind: 'поправка',
			students: ['a'],
			turns: [{ text: '@{a} заплатила 8000 за 2 урока' }, { text: "payment date on May 10, I've just told you" }],
			live: [pay('a', 8000, { paidOn: may, lessons: 200 })],
		},
		{
			id: 'S29',
			kind: 'повтор',
			students: ['a'],
			turns: [{ text: '@{a} заплатила 8000 за октябрь' }, { text: 'и ещё 5000 за ноябрь' }],
			live: [pay('a', 8000), pay('a', 5000)],
		},
	]
}

function judge(scenario, result, people, ctx) {
	const problems = []
	const main = liveProposals(result.conversations.main)
	const fresh = liveProposals(result.conversations.fresh)
	const check = (expected, rows, where) => {
		const left = [...rows]
		for (const expect of expected) {
			const index = left.findIndex((row) => matches(expect, row.target, people, ctx))
			if (index === -1) problems.push(`${where}: missing ${JSON.stringify(expect)}`)
			else left.splice(index, 1)
		}
		for (const row of left)
			if (!scenario.allowExtra?.(row.target)) problems.push(`${where}: extra ${describe(row.target)}`)
	}
	check(scenario.live, main, 'live')
	if (scenario.liveFresh !== undefined) check(scenario.liveFresh, fresh, 'other chat')
	const last = result.turns.at(-1)
	if (scenario.replyHas && !scenario.replyHas.test(last.reply)) problems.push('reply misses the expected fact')
	if (scenario.toolUsed && !last.tools.includes(scenario.toolUsed)) problems.push(`no ${scenario.toolUsed} call`)
	for (const [index, turn] of result.turns.entries()) {
		if (turn.state !== 'completed') problems.push(`turn ${index + 1} ${turn.state} ${turn.issue ?? ''}`)
		if (turn.requests > BUDGET.requests) problems.push(`turn ${index + 1} requests ${turn.requests}`)
		if (turn.inputs.some((value) => value > BUDGET.requestInput)) problems.push(`turn ${index + 1} input over budget`)
		if (turn.costUsd > BUDGET.turnUsd[result.model]) problems.push(`turn ${index + 1} cost ${turn.costUsd.toFixed(4)}`)
	}
	return problems
}

async function runScenario(scenario, model, run, ctx) {
	const people = {}
	for (const letter of scenario.students) people[letter] = await card(letter)
	for (const seed of scenario.seed ?? [])
		await seedPayment(
			people[seed.student],
			seed.amountMinor,
			seed.currency,
			core.addDays(ctx.today, -seed.offset),
			ctx.zone
		)
	const main = await conversation(MODEL_IDS[model])
	const conversations = { main: [main], fresh: [] }
	const turns = []
	for (const step of scenario.turns) {
		let target = main
		if (step.fresh) {
			target = await conversation(MODEL_IDS[model])
			conversations.fresh.push(target)
		}
		const turn = await send(target, fill(step.text, people), people)
		turns.push(turn)
		if (step.after === 'decline' || step.after === 'confirm') {
			const action = await lastProposal(target)
			if (action !== null) await as('POST', `/chat/actions/${action}/${step.after}`, {})
		}
	}
	const result = { scenario: scenario.id, kind: scenario.kind, model, run, conversations, turns }
	result.problems = judge(scenario, result, people, ctx)
	for (const [letter, student] of Object.entries(people))
		for (const turn of turns) {
			turn.teacher = turn.teacher.replaceAll(student.name, `<${letter}>`)
			turn.reply = turn.reply.replaceAll(student.name, `<${letter}>`)
			turn.blocks = turn.blocks.map((text) => text.replaceAll(student.name, `<${letter}>`))
		}
	return result
}

async function pooled(tasks, size) {
	const results = []
	let next = 0
	async function worker() {
		while (next < tasks.length) {
			const index = next++
			results[index] = await tasks[index]()
		}
	}
	await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker))
	return results
}

let accountId = null
let original = null
let exitCode = 1
try {
	cookie = await teacherCookie(api)
	accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id ?? null
	if (!accountId) throw new Error('no active teacher fixture')
	original = sql(
		`select chat_monthly_cap_usd::text as cap, chat_models as models, chat_model as model, chat_effort as effort, chat_max_input_tokens as input, chat_max_output_tokens as output from teacher_settings where account_id = ${quote(accountId)}`
	).rows[0]
	const stale = sql(
		`select id, display_name as name from students where display_name like ${quote(`${PREFIX}%`)} and import_key is null`
	)
		.rows.filter((row) => FIXTURE_NAME.test(row.name))
		.map((row) => row.id)
	if (stale.length > 0) {
		removeChats(
			`id in (select conversation_id from chat_actions where target->>'studentId' in (${stale.map(quote).join(', ')}))`
		)
		removeCards(`id in (${stale.map(quote).join(', ')})`)
	}
	await saveAssistantSettings(db, accountId, {
		models: null,
		model: null,
		effort: null,
		monthlyCapUsd: '100.00',
		maxInputTokens: 100000,
		maxOutputTokens: 16000,
	})
	const zone =
		sql(`select default_time_zone as zone from teacher_settings where account_id = ${quote(accountId)}`).rows[0]
			?.zone ?? core.SCHEDULE_TIME_ZONE
	const ctx = { zone, today: core.scheduleToday(new Date(), zone) }
	const chosen = scenarios(ctx).filter((scenario) => ONLY.length === 0 || ONLY.includes(scenario.id))
	const tasks = []
	for (const model of MODELS)
		for (let run = 1; run <= RUNS; run++)
			for (const scenario of chosen)
				tasks.push(async () => {
					try {
						const result = await runScenario(scenario, model, run, ctx)
						console.log(
							`${result.problems.length === 0 ? 'PASS' : 'FAIL'} ${scenario.id} ${model} #${run}${result.problems.length === 0 ? '' : ` ${result.problems.join('; ')}`}`
						)
						return result
					} catch (err) {
						console.log(
							`FAIL ${scenario.id} ${model} #${run} crashed ${err instanceof Error ? err.message : String(err)}`
						)
						return { scenario: scenario.id, kind: scenario.kind, model, run, turns: [], problems: ['crashed'] }
					}
				})
	const results = await pooled(tasks, PARALLEL)
	const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
	const out = `${STATE_DIR}/chat-context-eval-${LABEL}-${stamp}.jsonl`
	writeFileSync(out, results.map((result) => JSON.stringify(result)).join('\n') + '\n')
	console.log(`answers ${out}`)
	console.log('scenario | kind | ' + MODELS.map((model) => `${model} pass`).join(' | '))
	for (const scenario of chosen) {
		const cells = MODELS.map((model) => {
			const own = results.filter((result) => result.scenario === scenario.id && result.model === model)
			return `${own.filter((result) => result.problems.length === 0).length}/${own.length}`
		})
		console.log(`${scenario.id} | ${scenario.kind} | ${cells.join(' | ')}`)
	}
	for (const model of MODELS) {
		const turns = results.filter((result) => result.model === model).flatMap((result) => result.turns)
		const costs = turns.map((turn) => turn.costUsd).sort((left, right) => left - right)
		const median = costs[Math.floor(costs.length / 2)] ?? 0
		const total = costs.reduce((sum, value) => sum + value, 0)
		const reads = turns.flatMap((turn) => turn.cacheRead).reduce((sum, value) => sum + value, 0)
		const writes = turns.flatMap((turn) => turn.cacheWrite).reduce((sum, value) => sum + value, 0)
		console.log(
			`${model}: turns ${turns.length}, median turn $${median.toFixed(5)}, max turn $${(costs.at(-1) ?? 0).toFixed(5)}, total $${total.toFixed(4)}, max requests ${Math.max(0, ...turns.map((turn) => turn.requests))}, cache read ${reads}, cache write ${writes}`
		)
	}
	const failed = results.filter((result) => result.problems.length > 0).length
	console.log(failed === 0 ? 'CHAT_CONTEXT_EVAL_OK' : `chat-context-eval failures ${failed}/${results.length}`)
	exitCode = failed === 0 ? 0 : 1
} catch (err) {
	console.log(`FAIL chat-context-eval crashed ${err instanceof Error ? err.message : String(err)}`)
} finally {
	await chat.close()
	server.close()
	if (ownConversations.length > 0) {
		const own = ownConversations.map(quote).join(', ')
		sql(
			`update chat_budget_periods p set spent_nano = greatest(0, p.spent_nano - spent.total) from (select period_id, sum(coalesce(cost_nano, 0)) as total from chat_usage_attempts where conversation_id in (${own}) and state = 'settled' group by period_id) spent where p.id = spent.period_id`
		)
		removeChats(`id in (${own})`)
	}
	if (ownCards.length > 0) removeCards(`id in (${ownCards.map(quote).join(', ')}) and import_key is null`)
	if (accountId)
		sql(
			`delete from chat_budget_periods where account_id = ${quote(accountId)} and id not in (select period_id from chat_usage_attempts)`
		)
	if (original && accountId)
		await saveAssistantSettings(db, accountId, {
			monthlyCapUsd: original.cap,
			models: original.models,
			model: original.model,
			effort: original.effort,
			maxInputTokens: original.input,
			maxOutputTokens: original.output,
		})
	await pool.end()
}
process.exit(exitCode)
