import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import * as core from '../../packages/core/src/index.ts'
import { ENV_TEST, ROOT, call, quote, sql, studentCookie, teacherCookie } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

const SECTIONS = ['payment', 'cards', 'deletions']
const section = process.argv[2]
if (!SECTIONS.includes(section)) {
	console.log(`usage: node scripts/dev-checks/chat-changes.mjs ${SECTIONS.join('|')}`)
	process.exit(2)
}

const { createDb } = await import(`${ROOT}/packages/db/src/index.ts`)
const { createApp } = await import(`${ROOT}/apps/api/src/app.ts`)
const { createSignIn } = await import(`${ROOT}/apps/api/src/auth/sign-in.ts`)
const { createChat } = await import(`${ROOT}/apps/api/src/chat/runs.ts`)
const { readAssistantSettings, saveAssistantSettings } = await import(`${ROOT}/apps/api/src/settings/settings.ts`)
const { chatActionResponse, chatConversationReadResponse } = await import(`${ROOT}/packages/contracts/src/index.ts`)

const apiRequire = createRequire(new URL('../../apps/api/package.json', import.meta.url))
const pino = apiRequire('pino')
const { serve } = apiRequire('@hono/node-server')

const PORT = 4241
const PREFIXES = { payment: 'Alex Example 230', cards: 'Alex Example 234', deletions: 'Alex Example 235' }
const PREFIX = PREFIXES[section]
const ACTIVE = ['accepted', 'running']
const QUIET = 'I prepared the payment. Confirm it below.'
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

function message(model, content, stop) {
	return {
		id: `msg_${randomUUID()}`,
		type: 'message',
		role: 'assistant',
		model,
		content,
		stop_reason: stop,
		stop_sequence: null,
		usage: { input_tokens: 100, output_tokens: 40, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
	}
}

function say(text) {
	return async function* answer(request) {
		for (const piece of text.match(/\S+\s*/gu) ?? []) yield { type: 'text', text: piece }
		yield { type: 'text_end' }
		yield { type: 'final', message: message(request.model, [{ type: 'text', text, citations: null }], 'end_turn') }
	}
}

function use(name, input) {
	return async function* toolUse(request) {
		const block = { type: 'tool_use', id: `toolu_${randomUUID().slice(0, 8)}`, name, input }
		yield { type: 'final', message: message(request.model, [block], 'tool_use') }
	}
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

function removeCardRows(where) {
	const cards = `select id from students where ${where}`
	sql(`delete from student_notes where student_id in (${cards})`)
	sql(`delete from lesson_comments where student_id in (${cards})`)
	sql(`delete from student_sections where student_id in (${cards})`)
	sql(`delete from accounts where student_id in (${cards}) and role = 'student'`)
	return removeCards(where)
}

const lines = []
const logger = pino({ level: 'info' }, { write: (line) => lines.push(line) })
const url = parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL
const { pool, db } = createDb(url)

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
let accountId = null
let original = null
let originalZone = null

const as = (method, path, body) => call(api, method, path, { cookie, body })

function clearBudget() {
	if (!accountId) return 0
	sql(`delete from chat_usage_attempts where account_id = ${quote(accountId)} and turn_id is null`)
	return sql(
		`delete from chat_budget_periods where account_id = ${quote(accountId)} and id not in (select period_id from chat_usage_attempts)`
	).rowCount
}

async function conversation() {
	const res = await as('POST', '/chat/conversations')
	if (res.status !== 201) throw new Error(`conversation create returned ${res.status}`)
	conversations.push(res.json.conversation.id)
	return res.json.conversation.id
}

async function card(name, { rate = true, opening = null } = {}) {
	const res = await as('POST', '/students', {
		displayName: name,
		rateMinor: rate ? 400000 : null,
		currency: rate ? 'RUB' : null,
		defaultLessonMinutes: 60,
		parent: null,
		level: null,
		goals: null,
		timeZone: null,
	})
	if (res.status !== 201) throw new Error(`card create returned ${res.status}`)
	const studentId = res.json.student.id
	ids.push(studentId)
	if (opening !== null) {
		const set = await as('PUT', `/students/${studentId}/opening-balance`, opening)
		if (set.status !== 200) throw new Error(`opening balance returned ${set.status}`)
	}
	return studentId
}

async function settled(turnId, timeout = 20000) {
	const deadline = Date.now() + timeout
	while (Date.now() < deadline) {
		const res = await as('GET', `/chat/turns/${turnId}`)
		if (res.status === 200 && !ACTIVE.includes(res.json.turn.state)) return res.json.turn
		await sleep(50)
	}
	throw new Error('turn did not finish in time')
}

const replyRow = (turnId) =>
	sql(
		`select m.body, m.blocks from chat_messages m join chat_turns t on t.assistant_message_id = m.id where t.id = ${quote(turnId)}`
	).rows[0]

const paymentsOf = (studentId) =>
	sql(
		`select id, amount_minor as amount, currency, paid_on::text as paid_on, lessons_count::text as lessons, credited_minutes as credited, note, source from payments where student_id = ${quote(studentId)} order by created_at`
	).rows

const actionsOf = (messageId) =>
	sql(`select id, kind, state from chat_actions where message_id = ${quote(messageId)}`).rows

function lastToolResult() {
	const last = fake.calls.at(-1)?.messages.at(-1)
	if (!Array.isArray(last?.content)) return null
	return last.content.find((part) => part.type === 'tool_result') ?? null
}

function ask(conversationId, studentId, name, text, input, answer = QUIET) {
	const payment = {
		student_id: studentId,
		amount_text: '8000',
		currency: null,
		paid_on: null,
		lessons_text: null,
		note: null,
		...input,
	}
	return askTool(conversationId, 'propose_payment', payment, text, { studentId, name }, answer)
}

async function askTool(conversationId, tool, input, text, mention = null, answer = QUIET) {
	fake.script.push(use(tool, input), say(answer))
	const start = text.indexOf('@') + 1
	const sent = await as('POST', `/chat/conversations/${conversationId}/messages`, {
		requestId: randomUUID(),
		text,
		mentions:
			mention === null
				? []
				: [{ studentId: mention.studentId, text: mention.name, start, end: start + mention.name.length }],
	})
	if (sent.status !== 201 || !sent.json.turn) throw new Error(`message returned ${sent.status}`)
	const turn = await settled(sent.json.turn.id)
	const reply = replyRow(turn.id)
	const teacherId = sent.json.messages.find((item) => item.role === 'teacher').id
	return {
		turn,
		reply,
		teacherId,
		block: reply.blocks.find((block) => block.type === 'change_proposal') ?? null,
		tool: lastToolResult(),
	}
}

const confirm = (actionId) => as('POST', `/chat/actions/${actionId}/confirm`, {})
const decline = (actionId) => as('POST', `/chat/actions/${actionId}/decline`, {})

async function shown(conversationId, actionId) {
	const res = await as('GET', `/chat/conversations/${conversationId}`)
	const parsed = chatConversationReadResponse.safeParse(res.json)
	if (!parsed.success) return null
	for (const item of parsed.data.messages)
		for (const block of item.blocks) if (block.type === 'change_proposal' && block.actionId === actionId) return block
	return null
}

const valid = (res) => res.status === 200 && chatActionResponse.safeParse(res.json).success

function refusedWith(result, code) {
	return result.tool?.is_error === true && String(result.tool.content).includes(code) && result.block === null
}

async function payment() {
	const zone =
		sql(`select default_time_zone as zone from teacher_settings where account_id = ${quote(accountId)}`).rows[0]
			?.zone ?? core.SCHEDULE_TIME_ZONE
	const today = core.scheduleToday(new Date(), zone)
	const opening = { lessonsHundredths: 200, on: core.addDays(today, -1), expectedDefaultTimeZone: zone }
	const first = await conversation()

	const nameA = `${PREFIX}1`
	const cardA = await card(nameA, { opening })
	const text = `@${nameA} заплатил 8000`
	const proposed = await ask(first, cardA, nameA, text, {})
	const rows = actionsOf(proposed.teacherId)
	check(
		'propose_payment stores one proposed change action and writes no payment',
		rows.length === 1 && rows[0].kind === 'change' && rows[0].state === 'proposed' && paymentsOf(cardA).length === 0,
		JSON.stringify(rows)
	)
	const block = proposed.block
	check(
		'the reply carries the change_proposal block with values computed by code',
		block !== null &&
			block.state === 'proposed' &&
			block.receipt === null &&
			block.change.operation === 'record_payment' &&
			block.change.studentId === cardA &&
			block.change.studentName === nameA &&
			block.change.amountMinor === 800000 &&
			block.change.currency === 'RUB' &&
			block.change.paidOn === today &&
			block.change.lessonsHundredths === 200 &&
			block.change.creditedMinutes === 120 &&
			block.change.lessonMinutes === 60 &&
			block.change.balanceMinutes === 120 &&
			block.change.balanceAfterMinutes === 240 &&
			block.change.timeZone === zone,
		JSON.stringify(block)
	)
	check(
		'the tool result says proposed and carries no amount',
		proposed.tool?.is_error !== true &&
			String(proposed.tool?.content).includes('"status":"proposed"') &&
			!String(proposed.tool?.content).includes('8000'),
		JSON.stringify(proposed.tool)
	)
	check(
		'a sentence without numbers is published without withheld',
		proposed.reply.body.trim() === QUIET && !proposed.reply.blocks.some((item) => item.type === 'withheld'),
		JSON.stringify(proposed.reply)
	)
	const read = await shown(first, block.actionId)
	check('the conversation read returns the proposal', read?.state === 'proposed', JSON.stringify(read))

	const anonymous = await call(api, 'POST', `/chat/actions/${block.actionId}/confirm`, { body: {} })
	const student = await studentCookie(api)
	const asStudent = await call(api, 'POST', `/chat/actions/${block.actionId}/confirm`, { cookie: student, body: {} })
	const unknown = await confirm(randomUUID())
	const unknownDecline = await decline(randomUUID())
	check(
		'confirm needs a teacher session and an own action',
		anonymous.status === 401 && asStudent.status === 403 && unknown.status === 404 && unknownDecline.status === 404,
		`${anonymous.status} ${asStudent.status} ${unknown.status} ${unknownDecline.status}`
	)
	check('nothing was written by refused requests', paymentsOf(cardA).length === 0)

	const confirmed = await confirm(block.actionId)
	const recorded = paymentsOf(cardA)
	const applied = confirmed.json?.block
	check(
		'Record payment writes one payment through the payments owner with the previewed values',
		valid(confirmed) &&
			recorded.length === 1 &&
			Number(recorded[0].amount) === 800000 &&
			recorded[0].currency === 'RUB' &&
			recorded[0].paid_on === today &&
			recorded[0].lessons === '2.00' &&
			Number(recorded[0].credited) === 120 &&
			recorded[0].note === null &&
			recorded[0].source === 'manual',
		JSON.stringify({ status: confirmed.status, recorded })
	)
	check(
		'the confirmed block is applied with a receipt of the same payment',
		applied?.state === 'applied' &&
			applied.receipt?.studentId === cardA &&
			applied.receipt?.paymentId === recorded[0]?.id &&
			actionsOf(proposed.teacherId)[0]?.state === 'applied',
		JSON.stringify(applied)
	)
	const readApplied = await shown(first, block.actionId)
	check(
		'after reload the conversation shows the applied block with the payment receipt',
		readApplied?.state === 'applied' && readApplied.receipt?.paymentId === recorded[0]?.id,
		JSON.stringify(readApplied)
	)
	const profile = await as('GET', `/students/${cardA}`)
	check(
		'the profile balance equals the balance after payment in the block',
		profile.status === 200 && profile.json.student.balanceMinutes === block.change.balanceAfterMinutes,
		JSON.stringify(profile.json?.student?.balanceMinutes)
	)
	const again = await confirm(block.actionId)
	check(
		'a repeated confirm returns the same block and writes nothing',
		valid(again) && JSON.stringify(again.json.block) === JSON.stringify(applied) && paymentsOf(cardA).length === 1
	)
	const declinedLate = await decline(block.actionId)
	check(
		'decline after confirm changes nothing',
		valid(declinedLate) && declinedLate.json.block.state === 'applied' && paymentsOf(cardA).length === 1
	)

	const listed = await as('GET', `/payments?student=${cardA}`)
	const chatPayment = listed.json?.payments?.[0]
	const corrected = await as('PATCH', `/payments/${chatPayment?.id}`, {
		paidOn: chatPayment?.paidOn,
		expectedDefaultTimeZone: zone,
		amountMinor: 1200000,
		currency: 'RUB',
		lessonsHundredths: 300,
		note: null,
		expectedRevision: chatPayment?.revision,
	})
	const correctedRows = paymentsOf(cardA)
	const correctedCard = (await as('GET', `/students/${cardA}`)).json?.student
	const coreBalance = core.studentBalance(
		{
			openingMinutes: correctedCard?.openingBalance?.minutes ?? null,
			openingOn: correctedCard?.openingBalance?.on ?? null,
			noShowDeducts: correctedCard?.noShowDeducts ?? true,
		},
		correctedRows.map((row) => ({ paidOn: row.paid_on, creditedMinutes: Number(row.credited) })),
		[],
		zone
	)
	check(
		'the chat payment is corrected by PATCH of the same row and the balance equals core',
		corrected.status === 200 &&
			corrected.json.payment.id === recorded[0]?.id &&
			corrected.json.payment.revision === chatPayment.revision + 1 &&
			correctedRows.length === 1 &&
			correctedRows[0].id === recorded[0]?.id &&
			correctedRows[0].source === 'manual' &&
			Number(correctedRows[0].amount) === 1200000 &&
			Number(correctedRows[0].credited) === 180 &&
			correctedCard?.balanceMinutes === coreBalance &&
			coreBalance === 300,
		JSON.stringify({
			status: corrected.status,
			rows: correctedRows.length,
			balance: correctedCard?.balanceMinutes,
			coreBalance,
		})
	)
	const history = await shown(first, block.actionId)
	check(
		'after the correction the chat block stays applied with its original preview',
		history?.state === 'applied' &&
			history.receipt?.paymentId === recorded[0]?.id &&
			history.change.amountMinor === 800000 &&
			history.change.lessonsHundredths === 200 &&
			history.change.balanceAfterMinutes === block.change.balanceAfterMinutes,
		JSON.stringify(history)
	)

	const nameB = `${PREFIX}2`
	const cardB = await card(nameB)
	const raced = await ask(first, cardB, nameB, `@${nameB} заплатил 8000 за 3 урока`, { lessons_text: '3' })
	check(
		'explicit lessons from the message win over the rate suggestion',
		raced.block?.change.lessonsHundredths === 300 &&
			raced.block.change.creditedMinutes === 180 &&
			raced.block.change.balanceMinutes === null &&
			raced.block.change.balanceAfterMinutes === null,
		JSON.stringify(raced.block)
	)
	const both = await Promise.all([confirm(raced.block.actionId), confirm(raced.block.actionId)])
	const racedRows = paymentsOf(cardB)
	check(
		'two parallel confirms write one payment',
		both.every(valid) &&
			both.every((res) => res.json.block.state === 'applied') &&
			racedRows.length === 1 &&
			racedRows[0].lessons === '3.00' &&
			Number(racedRows[0].credited) === 180,
		JSON.stringify(racedRows)
	)

	const nameC = `${PREFIX}3`
	const cardC = await card(nameC)
	const kept = await ask(first, cardC, nameC, `@${nameC} заплатил 8000`, {})
	const declined = await decline(kept.block.actionId)
	const declinedAgain = await decline(kept.block.actionId)
	const confirmAfter = await confirm(kept.block.actionId)
	const raceRows = await Promise.all([decline(kept.block.actionId), confirm(kept.block.actionId)])
	check(
		'Don’t record declines without a payment; repeats and confirm after decline write nothing',
		valid(declined) &&
			declined.json.block.state === 'declined' &&
			declined.json.block.receipt === null &&
			valid(declinedAgain) &&
			declinedAgain.json.block.state === 'declined' &&
			valid(confirmAfter) &&
			confirmAfter.json.block.state === 'declined' &&
			raceRows.every((res) => valid(res) && res.json.block.state === 'declined') &&
			paymentsOf(cardC).length === 0 &&
			actionsOf(kept.teacherId)[0]?.state === 'refused',
		JSON.stringify(declined.json)
	)

	const readDeclined = await shown(first, kept.block.actionId)
	check(
		'after reload the conversation shows the declined block',
		readDeclined?.state === 'declined' && readDeclined.receipt === null,
		JSON.stringify(readDeclined)
	)

	const nameD = `${PREFIX}4`
	const cardD = await card(nameD, { rate: false })
	const noCurrency = await ask(first, cardD, nameD, `@${nameD} заплатил 8000`, {})
	check(
		'no currency in the text or on the card refuses with currency_required and no action',
		refusedWith(noCurrency, 'currency_required') && actionsOf(noCurrency.teacherId).length === 0,
		JSON.stringify(noCurrency.tool)
	)
	const changed = await ask(first, cardD, nameD, `@${nameD} заплатил 8000 рублей`, { currency: 'RUB' })
	check(
		'without a rate the preview says no lesson credit',
		changed.block?.change.lessonsHundredths === null && changed.block.change.creditedMinutes === 0,
		JSON.stringify(changed.block)
	)
	const edited = await as('PATCH', `/students/${cardD}`, {
		displayName: nameD,
		rateMinor: null,
		currency: null,
		defaultLessonMinutes: 60,
		parent: null,
		level: null,
		goals: 'Goals after the proposal',
		timeZone: null,
	})
	if (edited.status !== 200) throw new Error(`card edit returned ${edited.status}`)
	const staleCard = await confirm(changed.block.actionId)
	check(
		'any card edit between the proposal and Record payment makes it stale without a payment',
		valid(staleCard) &&
			staleCard.json.block.state === 'stale' &&
			staleCard.json.block.issue === 'student_changed' &&
			paymentsOf(cardD).length === 0,
		JSON.stringify(staleCard.json)
	)

	const nameE = `${PREFIX}5`
	const cardE = await card(nameE)
	const zoned = await ask(first, cardE, nameE, `@${nameE} заплатил 8000`, {})
	const other = zone === 'Europe/Moscow' ? 'Asia/Ho_Chi_Minh' : 'Europe/Moscow'
	originalZone = zone
	const moved = sql(
		`update teacher_settings set default_time_zone = ${quote(other)} where account_id = ${quote(accountId)}`
	).rowCount
	const staleZone = await confirm(zoned.block.actionId)
	sql(`update teacher_settings set default_time_zone = ${quote(zone)} where account_id = ${quote(accountId)}`)
	originalZone = null
	check(
		'a changed teacher time zone makes the proposal stale without a payment',
		moved === 1 &&
			valid(staleZone) &&
			staleZone.json.block.state === 'stale' &&
			staleZone.json.block.issue === 'time_zone_changed' &&
			paymentsOf(cardE).length === 0,
		JSON.stringify(staleZone.json)
	)

	const legacy = await ask(first, cardE, nameE, `@${nameE} заплатил 8000`, {})
	const legacyGuard = { lessonMinutes: 60, rateMinor: 400000, rateCurrency: 'RUB', timeZone: zone }
	sql(
		`update chat_actions set target = jsonb_set(target, '{guard}', ${quote(JSON.stringify(legacyGuard))}::jsonb) where id = ${quote(legacy.block.actionId)}`
	)
	const staleLegacy = await confirm(legacy.block.actionId)
	check(
		'a proposal with the old field guard is stale on confirm without a payment',
		valid(staleLegacy) &&
			staleLegacy.json.block.state === 'stale' &&
			staleLegacy.json.block.issue === 'student_changed' &&
			paymentsOf(cardE).length === 0,
		JSON.stringify(staleLegacy.json)
	)

	const foreign = await ask(first, cardE, nameE, `@${nameE} заплатил 8000`, { amount_text: '9000' })
	check(
		'an amount that is not in the teacher message refuses with amount_not_in_message',
		refusedWith(foreign, 'amount_not_in_message') && actionsOf(foreign.teacherId).length === 0,
		JSON.stringify(foreign.tool)
	)
	const precise = await ask(first, cardE, nameE, `@${nameE} заплатил 8000.555`, { amount_text: '8000.555' })
	check(
		'extra decimal places refuse with invalid_amount',
		refusedWith(precise, 'invalid_amount') && actionsOf(precise.teacherId).length === 0,
		JSON.stringify(precise.tool)
	)
	const huge = await ask(first, cardE, nameE, `@${nameE} заплатил 99999999999`, { amount_text: '99999999999' })
	check(
		'an amount over the contract limit refuses with invalid_amount',
		refusedWith(huge, 'invalid_amount') && actionsOf(huge.teacherId).length === 0,
		JSON.stringify(huge.tool)
	)
	const future = await ask(first, cardE, nameE, `@${nameE} заплатит 8000`, { paid_on: core.addDays(today, 1) })
	check(
		'a future payment date refuses with date_in_future',
		refusedWith(future, 'date_in_future') && actionsOf(future.teacherId).length === 0,
		JSON.stringify(future.tool)
	)
	const boasted = await ask(first, cardE, nameE, `@${nameE} заплатил 8000`, {}, 'Записал оплату 8000 ₽.')
	check(
		'a reply that claims the amount is withheld',
		boasted.block !== null &&
			!boasted.reply.body.includes('8000') &&
			boasted.reply.blocks.some((item) => item.type === 'withheld'),
		JSON.stringify(boasted.reply)
	)
	const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(
		new Date(`${today}T12:00:00Z`)
	)
	const dated = `I prepared the payment for ${Number(today.slice(8, 10))} ${month}. Confirm it below.`
	const spoken = await ask(first, cardE, nameE, `@${nameE} заплатил 8000`, {}, dated)
	check(
		'a sentence with the payment date and no numbers about money is published',
		spoken.reply.body.trim() === dated && !spoken.reply.blocks.some((item) => item.type === 'withheld'),
		JSON.stringify(spoken.reply)
	)
	check('refused and kept proposals left the payments of the card untouched', paymentsOf(cardE).length === 0)

	const second = await conversation()
	const waiting = await ask(second, cardE, nameE, `@${nameE} заплатил 8000`, {})
	const current = await as('GET', `/chat/conversations/${second}`)
	const body = { expectedRevision: current.json.conversation.revision }
	const removed = await call(api, 'DELETE', `/chat/conversations/${second}`, {
		cookie,
		body,
		headers: { 'content-length': String(Buffer.byteLength(JSON.stringify(body))) },
	})
	const left = sql(
		`select state, result->>'kind' as kind from chat_actions where id = ${quote(waiting.block.actionId)}`
	).rows[0]
	const late = await confirm(waiting.block.actionId)
	const lateDecline = await decline(waiting.block.actionId)
	check(
		'deleting the conversation makes its waiting proposal stale and the old id records nothing',
		removed.status === 204 &&
			left?.state === 'refused' &&
			left.kind === 'stale' &&
			late.status === 404 &&
			lateDecline.status === 404 &&
			paymentsOf(cardE).length === 0,
		JSON.stringify({ removed: removed.status, left, late: late.status })
	)

	const note = sql(
		`insert into chat_actions (account_id, conversation_id, message_id, kind, state, result) values (${quote(accountId)}, ${quote(first)}, ${quote(proposed.teacherId)}, 'note', 'applied', '{"kind":"applied"}') returning id`
	).rows[0].id
	const noteDecline = await decline(note)
	check('a note action cannot be declined', noteDecline.status === 409, String(noteDecline.status))
}

const QUIET_CARD = 'I prepared the change. Confirm it below.'

const cardRow = (studentId) =>
	sql(
		`select id, display_name as name, rate_minor::text as rate, currency, default_lesson_minutes as minutes, no_show_deducts as no_show, time_zone as zone, parent, level, goals, gender, status, revision from students where id = ${quote(studentId)}`
	).rows[0]

const namedCards = (name) =>
	sql(`select id from students where lower(display_name) = lower(${quote(name)}) order by created_at`).rows

const tableCounts = () =>
	sql(
		`select (select count(*) from students)::int as students, (select count(*) from payments)::int as payments, (select count(*) from student_notes)::int as notes, (select count(*) from lesson_series)::int as series, (select count(*) from lessons)::int as lessons`
	).rows[0]

const sameCounts = (left, right) => JSON.stringify(left) === JSON.stringify(right)

function fullBody(row, change = {}) {
	return {
		displayName: row.name,
		rateMinor: row.rate === null ? null : Number(row.rate),
		currency: row.currency,
		defaultLessonMinutes: row.minutes,
		parent: row.parent,
		level: row.level,
		goals: row.goals,
		timeZone: row.zone,
		noShowDeducts: row.no_show,
		gender: row.gender,
		...change,
	}
}

async function cards() {
	const { appendStudentNote } = await import(`${ROOT}/apps/api/src/cards/notes.ts`)
	const zone =
		sql(`select default_time_zone as zone from teacher_settings where account_id = ${quote(accountId)}`).rows[0]
			?.zone ?? core.SCHEDULE_TIME_ZONE
	const today = core.scheduleToday(new Date(), zone)
	const opening = { lessonsHundredths: 200, on: core.addDays(today, -1), expectedDefaultTimeZone: zone }
	const chatId = await conversation()
	const student = (text, input) => askTool(chatId, 'propose_student', input, text, null, QUIET_CARD)

	const newName = `${PREFIX}7`
	const createText = `Добавь нового ученика ${newName}, ставка 3500 рублей, урок 90 минут`
	const created = await student(createText, {
		display_name: newName,
		rate_text: '3500',
		currency: 'RUB',
		lesson_minutes: 90,
		gender: null,
	})
	const createBlock = created.block
	check(
		'propose_student stores one proposed change and creates no card',
		actionsOf(created.teacherId).length === 1 &&
			actionsOf(created.teacherId)[0].state === 'proposed' &&
			namedCards(newName).length === 0,
		JSON.stringify(actionsOf(created.teacherId))
	)
	check(
		'the new card preview carries the name, rate and lesson length from the message and the form defaults',
		createBlock !== null &&
			createBlock.state === 'proposed' &&
			createBlock.receipt === null &&
			createBlock.change.operation === 'create_card' &&
			createBlock.change.displayName === newName &&
			createBlock.change.rateMinor === 350000 &&
			createBlock.change.currency === 'RUB' &&
			createBlock.change.lessonMinutes === 90 &&
			createBlock.change.noShowDeducts === true &&
			createBlock.change.timeZone === null &&
			createBlock.change.gender === null &&
			createBlock.change.duplicateName === false,
		JSON.stringify(createBlock)
	)
	check(
		'the tool result says proposed, names the student and carries no amount',
		created.tool?.is_error !== true &&
			String(created.tool?.content).includes('"status":"proposed"') &&
			String(created.tool?.content).includes(newName) &&
			!String(created.tool?.content).includes('3500'),
		JSON.stringify(created.tool)
	)
	check(
		'a sentence without numbers is published after the card proposal',
		created.reply.body.trim() === QUIET_CARD && !created.reply.blocks.some((item) => item.type === 'withheld'),
		JSON.stringify(created.reply)
	)
	const createConfirmed = await confirm(createBlock.actionId)
	const createdId = createConfirmed.json?.block?.receipt?.studentId
	if (createdId) ids.push(createdId)
	const createdRow = createdId ? cardRow(createdId) : null
	check(
		'Create student card writes one card through the cards owner with the previewed values and form defaults',
		valid(createConfirmed) &&
			createConfirmed.json.block.state === 'applied' &&
			namedCards(newName).length === 1 &&
			createdRow?.name === newName &&
			createdRow.rate === '350000' &&
			createdRow.currency === 'RUB' &&
			createdRow.minutes === 90 &&
			createdRow.no_show === true &&
			createdRow.zone === null &&
			createdRow.parent === null &&
			createdRow.level === null &&
			createdRow.goals === null &&
			createdRow.gender === null &&
			createdRow.status === 'active',
		JSON.stringify({ status: createConfirmed.status, block: createConfirmed.json?.block, createdRow })
	)
	const createAgain = await confirm(createBlock.actionId)
	check(
		'a repeated confirm returns the same block and creates no second card',
		valid(createAgain) &&
			JSON.stringify(createAgain.json.block) === JSON.stringify(createConfirmed.json.block) &&
			namedCards(newName).length === 1
	)
	const createRead = await shown(chatId, createBlock.actionId)
	check(
		'after reload the card proposal is applied with the new card in the receipt',
		createRead?.state === 'applied' && createRead.receipt?.studentId === createdId,
		JSON.stringify(createRead)
	)

	const name0 = `${PREFIX}0`
	const card0 = await card(name0)
	const duplicate = await student(`Добавь ещё одного ученика ${name0}`, {
		display_name: name0,
		rate_text: null,
		currency: null,
		lesson_minutes: null,
		gender: 'female',
	})
	check(
		'a name of an existing card is marked duplicateName and takes the default lesson length',
		duplicate.block?.change.duplicateName === true &&
			duplicate.block.change.rateMinor === null &&
			duplicate.block.change.currency === null &&
			duplicate.block.change.lessonMinutes === 60 &&
			duplicate.block.change.gender === 'female' &&
			namedCards(name0).length === 1,
		JSON.stringify(duplicate.block)
	)
	const duplicateConfirmed = await confirm(duplicate.block.actionId)
	const duplicateId = duplicateConfirmed.json?.block?.receipt?.studentId
	if (duplicateId) ids.push(duplicateId)
	const sameName = namedCards(name0)
	check(
		'after confirm the two cards with the same name stay separate',
		valid(duplicateConfirmed) &&
			sameName.length === 2 &&
			duplicateId !== card0 &&
			sameName.some((row) => row.id === card0) &&
			sameName.some((row) => row.id === duplicateId) &&
			cardRow(duplicateId)?.gender === 'female',
		JSON.stringify(sameName)
	)
	const lower = name0.toLowerCase()
	const folded = await student(`добавь ${lower}`, {
		display_name: lower,
		rate_text: null,
		currency: null,
		lesson_minutes: null,
		gender: null,
	})
	const foldedDeclined = await decline(folded.block?.actionId)
	check(
		'the duplicate check ignores case and Don’t create the card creates nothing',
		folded.block?.change.duplicateName === true &&
			valid(foldedDeclined) &&
			foldedDeclined.json.block.state === 'declined' &&
			namedCards(name0).length === 2,
		JSON.stringify({ block: folded.block, declined: foldedDeclined.json })
	)
	const invented = await student('Добавь нового ученика', {
		display_name: `${PREFIX}6`,
		rate_text: null,
		currency: null,
		lesson_minutes: null,
		gender: null,
	})
	check(
		'a name that is not in the teacher message refuses with name_not_in_message',
		refusedWith(invented, 'name_not_in_message') &&
			actionsOf(invented.teacherId).length === 0 &&
			namedCards(`${PREFIX}6`).length === 0,
		JSON.stringify(invented.tool)
	)
	const noCurrency = await student(`Добавь ученика ${PREFIX}6, ставка 3500`, {
		display_name: `${PREFIX}6`,
		rate_text: '3500',
		currency: null,
		lesson_minutes: null,
		gender: null,
	})
	const minutes = await student(`Добавь ученика ${PREFIX}6`, {
		display_name: `${PREFIX}6`,
		rate_text: null,
		currency: null,
		lesson_minutes: 45,
		gender: null,
	})
	check(
		'a rate without a currency and a lesson length not in the message refuse without a card',
		refusedWith(noCurrency, 'currency_required') &&
			refusedWith(minutes, 'lesson_minutes_not_in_message') &&
			namedCards(`${PREFIX}6`).length === 0,
		JSON.stringify({ noCurrency: noCurrency.tool, minutes: minutes.tool })
	)

	const name1 = `${PREFIX}1`
	const card1 = await card(name1, { opening })
	const kept = cardRow(card1)
	const filled = await as('PATCH', `/students/${card1}`, {
		...fullBody(kept, { parent: 'Parent of the check', goals: 'Goals before', gender: 'female' }),
		expectedRevision: kept.revision,
	})
	if (filled.status !== 200) throw new Error(`card fill returned ${filled.status}`)
	const paid = await as('POST', '/payments', {
		studentId: card1,
		paidOn: today,
		expectedDefaultTimeZone: zone,
		amountMinor: 800000,
		currency: 'RUB',
		lessonsHundredths: 200,
		note: null,
	})
	if (paid.status !== 201) throw new Error(`payment create returned ${paid.status}`)
	const creditsBefore = paymentsOf(card1).map((row) => Number(row.credited))
	const balanceBefore = (await as('GET', `/students/${card1}`)).json?.student?.balanceMinutes
	const rate = (text, input) =>
		askTool(
			chatId,
			'propose_rate',
			{ student_id: card1, ...input },
			text,
			{ studentId: card1, name: name1 },
			QUIET_CARD
		)
	const rated = await rate(`@${name1} новая ставка 5000`, { rate_text: '5000', currency: null, clear: false })
	check(
		'propose_rate shows the current and the new rate pair and changes nothing',
		rated.block?.change.operation === 'set_rate' &&
			rated.block.change.studentId === card1 &&
			rated.block.change.studentName === name1 &&
			rated.block.change.before.rateMinor === 400000 &&
			rated.block.change.before.currency === 'RUB' &&
			rated.block.change.after.rateMinor === 500000 &&
			rated.block.change.after.currency === 'RUB' &&
			cardRow(card1).rate === '400000',
		JSON.stringify(rated.block)
	)
	const beforeEdit = cardRow(card1)
	const edited = await as('PATCH', `/students/${card1}`, {
		...fullBody(beforeEdit, { goals: 'Goals after the proposal' }),
		expectedRevision: beforeEdit.revision,
	})
	if (edited.status !== 200) throw new Error(`card edit returned ${edited.status}`)
	const staleRate = await confirm(rated.block.actionId)
	check(
		'a card edit between the proposal and Save rate makes it stale and keeps the rate',
		valid(staleRate) &&
			staleRate.json.block.state === 'stale' &&
			staleRate.json.block.issue === 'student_changed' &&
			cardRow(card1).rate === '400000',
		JSON.stringify(staleRate.json)
	)
	const fresh = await rate(`@${name1} новая ставка 5000`, { rate_text: '5000', currency: null, clear: false })
	const ready = cardRow(card1)
	const rateConfirmed = await confirm(fresh.block.actionId)
	const rateRow = cardRow(card1)
	const balanceAfter = (await as('GET', `/students/${card1}`)).json?.student?.balanceMinutes
	check(
		'Save rate changes only the rate pair and moves the revision by one',
		valid(rateConfirmed) &&
			rateConfirmed.json.block.state === 'applied' &&
			rateConfirmed.json.block.receipt?.studentId === card1 &&
			rateRow.rate === '500000' &&
			rateRow.currency === 'RUB' &&
			rateRow.goals === 'Goals after the proposal' &&
			rateRow.parent === 'Parent of the check' &&
			rateRow.gender === 'female' &&
			rateRow.minutes === ready.minutes &&
			rateRow.name === ready.name &&
			rateRow.revision === ready.revision + 1,
		JSON.stringify({ ready, rateRow })
	)
	check(
		'existing payments keep their lesson credit and the balance stays the same',
		JSON.stringify(paymentsOf(card1).map((row) => Number(row.credited))) === JSON.stringify(creditsBefore) &&
			typeof balanceBefore === 'number' &&
			balanceAfter === balanceBefore,
		JSON.stringify({ creditsBefore, balanceBefore, balanceAfter })
	)
	const foreignRate = await rate(`@${name1} новая ставка`, { rate_text: '6000', currency: null, clear: false })
	check(
		'a rate that is not in the teacher message refuses with amount_not_in_message',
		refusedWith(foreignRate, 'amount_not_in_message') && cardRow(card1).rate === '500000',
		JSON.stringify(foreignRate.tool)
	)
	const cleared = await rate(`@${name1} убери ставку`, { rate_text: null, currency: null, clear: true })
	const clearConfirmed = await confirm(cleared.block?.actionId)
	const clearedRow = cardRow(card1)
	check(
		'clear true removes the rate pair',
		cleared.block?.change.after.rateMinor === null &&
			cleared.block.change.after.currency === null &&
			valid(clearConfirmed) &&
			clearConfirmed.json.block.state === 'applied' &&
			clearedRow.rate === null &&
			clearedRow.currency === null &&
			clearedRow.goals === 'Goals after the proposal',
		JSON.stringify({ block: cleared.block, clearedRow })
	)
	const unchanged = await rate(`@${name1} убери ставку`, { rate_text: null, currency: null, clear: true })
	check(
		'the same pair again refuses with no_change',
		refusedWith(unchanged, 'no_change') && actionsOf(unchanged.teacherId).length === 0,
		JSON.stringify(unchanged.tool)
	)

	const name2 = `${PREFIX}2`
	const card2 = await card(name2)
	const linked = await as('POST', `/students/${card2}/account`, { login: 'alex-example-2342', password: null })
	if (linked.status !== 201) throw new Error(`card account returned ${linked.status}`)
	const studentAccount = linked.json.account.id
	const paidArchive = await as('POST', '/payments', {
		studentId: card2,
		paidOn: today,
		expectedDefaultTimeZone: zone,
		amountMinor: 400000,
		currency: 'RUB',
		lessonsHundredths: 100,
		note: null,
	})
	if (paidArchive.status !== 201) throw new Error(`payment create returned ${paidArchive.status}`)
	const note = await appendStudentNote(db, accountId, card2, { sectionKind: 'general_info', body: 'Note of the check' })
	if (note === null) throw new Error('note append failed')
	const accountState = () => sql(`select status from accounts where id = ${quote(studentAccount)}`).rows[0]?.status
	const archive = (studentId, name, text, requestedDeletion) =>
		askTool(
			chatId,
			'propose_archive',
			{ student_id: studentId, requested_deletion: requestedDeletion },
			text,
			{ studentId, name },
			QUIET_CARD
		)
	const removal = await archive(card2, name2, `@${name2} удали этого ученика`, true)
	check(
		'a request to delete gives an archive proposal marked requestedDeletion with the active account flag',
		removal.block?.change.operation === 'archive_card' &&
			removal.block.change.studentId === card2 &&
			removal.block.change.requestedDeletion === true &&
			removal.block.change.accountActive === true &&
			cardRow(card2).status === 'active' &&
			String(removal.tool?.content).includes('Permanent deletion is not available'),
		JSON.stringify({ block: removal.block, tool: removal.tool })
	)
	const countsBefore = tableCounts()
	const archived = await confirm(removal.block.actionId)
	const countsAfter = tableCounts()
	check(
		'Archive student archives the same card and removes no rows',
		valid(archived) &&
			archived.json.block.state === 'applied' &&
			archived.json.block.receipt?.studentId === card2 &&
			cardRow(card2).status === 'archived' &&
			sameCounts(countsBefore, countsAfter) &&
			paymentsOf(card2).length === 1,
		JSON.stringify({ countsBefore, countsAfter, block: archived.json?.block })
	)
	check('the account of the archived student keeps its status', accountState() === 'active', String(accountState()))
	const twice = await askTool(
		chatId,
		'propose_archive',
		{ student_id: card2, requested_deletion: false },
		`${name2} в архив`,
		null,
		QUIET_CARD
	)
	check(
		'an archived card refuses with already_archived',
		refusedWith(twice, 'already_archived') && actionsOf(twice.teacherId).length === 0,
		JSON.stringify(twice.tool)
	)

	const name3 = `${PREFIX}3`
	const card3 = await card(name3)
	const toArchive = await archive(card3, name3, `@${name3} в архив`, false)
	check(
		'a plain archive proposal has no deletion mark and no active account',
		toArchive.block?.change.requestedDeletion === false && toArchive.block.change.accountActive === false,
		JSON.stringify(toArchive.block)
	)
	const formArchive = await as('POST', `/students/${card3}/archive`, {})
	if (formArchive.status !== 200) throw new Error(`form archive returned ${formArchive.status}`)
	const restored = await as('POST', `/students/${card3}/restore`, {})
	if (restored.status !== 200) throw new Error(`form restore returned ${restored.status}`)
	const staleArchive = await confirm(toArchive.block.actionId)
	check(
		'a card changed after the archive proposal makes it stale and the card stays active',
		valid(staleArchive) &&
			staleArchive.json.block.state === 'stale' &&
			staleArchive.json.block.issue === 'student_changed' &&
			cardRow(card3).status === 'active',
		JSON.stringify(staleArchive.json)
	)
	const name4 = `${PREFIX}4`
	const card4 = await card(name4)
	const keptActive = await archive(card4, name4, `@${name4} в архив`, false)
	const keptDeclined = await decline(keptActive.block?.actionId)
	check(
		'Keep student active declines the archive without a change',
		valid(keptDeclined) && keptDeclined.json.block.state === 'declined' && cardRow(card4).status === 'active',
		JSON.stringify(keptDeclined.json)
	)
}

const QUIET_DELETE = 'I prepared the deletion. Confirm it below.'

function toolRecords(result) {
	try {
		return JSON.parse(String(result.tool?.content)).records ?? null
	} catch {
		return null
	}
}

async function deletions() {
	const zone =
		sql(`select default_time_zone as zone from teacher_settings where account_id = ${quote(accountId)}`).rows[0]
			?.zone ?? core.SCHEDULE_TIME_ZONE
	const today = core.scheduleToday(new Date(), zone)
	const opening = { lessonsHundredths: 200, on: core.addDays(today, -1), expectedDefaultTimeZone: zone }
	const chatId = await conversation()
	const pay = async (studentId, note = null) => {
		const res = await as('POST', '/payments', {
			studentId,
			paidOn: today,
			expectedDefaultTimeZone: zone,
			amountMinor: 800000,
			currency: 'RUB',
			lessonsHundredths: 200,
			note,
		})
		if (res.status !== 201) throw new Error(`payment create returned ${res.status}`)
		return res.json.payment
	}
	const ask = (studentId, name, tool, input, text) =>
		askTool(chatId, tool, { student_id: studentId, ...input }, text, { studentId, name }, QUIET_DELETE)

	const name0 = `${PREFIX}0`
	const card0 = await card(name0, { opening })
	const first = await pay(card0)
	const second = await pay(card0)
	const listed = await ask(card0, name0, 'student_payments', {}, `@${name0} покажи оплаты`)
	const records = toolRecords(listed)
	check(
		'student_payments returns both payments with the same amount and date under different ids',
		listed.tool?.is_error !== true &&
			listed.block === null &&
			Array.isArray(records) &&
			records.length === 2 &&
			records.every((record) => record.paid_on === today && record.amount_minor === 800000) &&
			new Set(records.map((record) => record.payment_id)).size === 2 &&
			records.some((record) => record.payment_id === first.id) &&
			records.some((record) => record.payment_id === second.id),
		JSON.stringify(records)
	)
	const balanceBefore = (await as('GET', `/students/${card0}`)).json?.student?.balanceMinutes
	const proposed = await ask(card0, name0, 'propose_payment_delete', { payment_id: first.id }, `@${name0} удали оплату`)
	const block = proposed.block
	check(
		'propose_payment_delete stores one proposed change and deletes nothing',
		actionsOf(proposed.teacherId).length === 1 &&
			actionsOf(proposed.teacherId)[0].state === 'proposed' &&
			paymentsOf(card0).length === 2,
		JSON.stringify(actionsOf(proposed.teacherId))
	)
	check(
		'the preview carries the date, amount, lessons, note and the balance after deletion computed by code',
		block?.state === 'proposed' &&
			block.change.operation === 'delete_payment' &&
			block.change.studentId === card0 &&
			block.change.studentName === name0 &&
			block.change.paymentId === first.id &&
			block.change.paidOn === today &&
			block.change.amountMinor === 800000 &&
			block.change.currency === 'RUB' &&
			block.change.lessonsHundredths === 200 &&
			block.change.creditedMinutes === 120 &&
			block.change.note === null &&
			block.change.balanceMinutes === balanceBefore &&
			block.change.balanceAfterMinutes === balanceBefore - 120,
		JSON.stringify({ block, balanceBefore })
	)
	check(
		'the tool result says proposed and carries no amount',
		proposed.tool?.is_error !== true &&
			String(proposed.tool?.content).includes('"status":"proposed"') &&
			!String(proposed.tool?.content).includes('8000'),
		JSON.stringify(proposed.tool)
	)
	const confirmed = await confirm(block.actionId)
	const left = paymentsOf(card0)
	const profile = (await as('GET', `/students/${card0}`)).json?.student
	check(
		'Delete payment removes only the chosen row through the payments owner',
		valid(confirmed) &&
			confirmed.json.block.state === 'applied' &&
			confirmed.json.block.receipt?.studentId === card0 &&
			left.length === 1 &&
			left[0].id === second.id,
		JSON.stringify({ block: confirmed.json?.block, left })
	)
	check(
		'the profile balance equals the balance after deletion in the block',
		profile?.balanceMinutes === block.change.balanceAfterMinutes,
		JSON.stringify(profile?.balanceMinutes)
	)
	const again = await confirm(block.actionId)
	check(
		'a repeated confirm returns the same block and deletes nothing else',
		valid(again) &&
			JSON.stringify(again.json.block) === JSON.stringify(confirmed.json.block) &&
			paymentsOf(card0).length === 1
	)
	const readApplied = await shown(chatId, block.actionId)
	check('after reload the deletion block is applied', readApplied?.state === 'applied', JSON.stringify(readApplied))

	const edited = await ask(card0, name0, 'propose_payment_delete', { payment_id: second.id }, `@${name0} удали оплату`)
	const fixed = await as('PATCH', `/payments/${second.id}`, {
		paidOn: second.paidOn,
		expectedDefaultTimeZone: zone,
		amountMinor: second.amountMinor,
		currency: second.currency,
		lessonsHundredths: second.lessonsHundredths,
		note: 'Corrected in the form',
		expectedRevision: second.revision,
	})
	if (fixed.status !== 200) throw new Error(`payment edit returned ${fixed.status}`)
	const staleEdit = await confirm(edited.block?.actionId)
	check(
		'a payment edit between the proposal and Delete payment makes it stale and keeps the row',
		valid(staleEdit) &&
			staleEdit.json.block.state === 'stale' &&
			staleEdit.json.block.issue === 'payment_changed' &&
			paymentsOf(card0).some((row) => row.id === second.id),
		JSON.stringify(staleEdit.json)
	)

	const name1 = `${PREFIX}1`
	const card1 = await card(name1)
	const foreign = await pay(card1)
	const crossed = await ask(
		card0,
		name0,
		'propose_payment_delete',
		{ payment_id: foreign.id },
		`@${name0} удали оплату`
	)
	check(
		'a payment of another student refuses with payment_not_found and no action',
		refusedWith(crossed, 'payment_not_found') &&
			actionsOf(crossed.teacherId).length === 0 &&
			paymentsOf(card1).length === 1,
		JSON.stringify(crossed.tool)
	)
	const kept = await ask(card1, name1, 'propose_payment_delete', { payment_id: foreign.id }, `@${name1} удали оплату`)
	const declined = await decline(kept.block?.actionId)
	const confirmAfter = await confirm(kept.block?.actionId)
	check(
		'Keep payment declines without a deletion and confirm after decline deletes nothing',
		valid(declined) &&
			declined.json.block.state === 'declined' &&
			valid(confirmAfter) &&
			confirmAfter.json.block.state === 'declined' &&
			paymentsOf(card1).length === 1,
		JSON.stringify(declined.json)
	)

	await entries(chatId, ask)
}

const noteRow = (id) =>
	sql(`select revision, retracted_at is not null as retracted from student_notes where id = ${quote(id)}`).rows[0] ??
	null

const commentRow = (id) =>
	sql(`select revision, retracted_at is not null as retracted from lesson_comments where id = ${quote(id)}`).rows[0] ??
	null

async function entries(chatId, ask) {
	const { appendStudentNote, retractStudentNote } = await import(`${ROOT}/apps/api/src/cards/notes.ts`)
	const { appendLessonComment } = await import(`${ROOT}/apps/api/src/schedule/comments.ts`)
	const zone =
		sql(`select default_time_zone as zone from teacher_settings where account_id = ${quote(accountId)}`).rows[0]
			?.zone ?? core.SCHEDULE_TIME_ZONE
	const note = async (studentId, body) => {
		const saved = await appendStudentNote(db, accountId, studentId, { sectionKind: 'general_info', body })
		if (saved === null) throw new Error('note append failed')
		return saved
	}
	const comment = async (studentId, body) => {
		const startsAt = new Date(Date.now() - 3 * 3600000)
		const lessonId = sql(
			`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(studentId)}, ${quote(startsAt.toISOString())}, 60, 'scheduled') returning id`
		).rows[0].id
		const saved = await appendLessonComment(db, accountId, { kind: 'single', lessonId }, body, new Date())
		if (saved.kind !== 'ok') throw new Error(`comment append returned ${saved.kind}`)
		return { ...saved.comment, lessonId, day: core.lessonDay(startsAt, zone) }
	}
	const remove = (studentId, name, entryId) =>
		ask(studentId, name, 'propose_entry_removal', { entry_id: entryId }, `@${name} удали запись`)

	const name2 = `${PREFIX}2`
	const card2 = await card(name2)
	const longBody = `Note of the check ${'x'.repeat(400)}`
	const kept = await note(card2, longBody)
	const removal = await remove(card2, name2, kept.id)
	check(
		'propose_entry_removal for a note stores one proposed change and keeps the note live',
		removal.block?.state === 'proposed' &&
			removal.block.change.operation === 'remove_note' &&
			removal.block.change.studentId === card2 &&
			removal.block.change.noteId === kept.id &&
			removal.block.change.sectionKind === 'general_info' &&
			Array.from(removal.block.change.body).length === 300 &&
			removal.block.change.body.endsWith('…') &&
			removal.block.change.createdAt === kept.createdAt &&
			actionsOf(removal.teacherId).length === 1 &&
			noteRow(kept.id)?.retracted === false,
		JSON.stringify({ block: removal.block, row: noteRow(kept.id) })
	)
	const confirmedNote = await confirm(removal.block.actionId)
	const retractedNote = noteRow(kept.id)
	check(
		'Remove note retracts the note through the notes owner and keeps the row',
		valid(confirmedNote) &&
			confirmedNote.json.block.state === 'applied' &&
			confirmedNote.json.block.receipt?.studentId === card2 &&
			retractedNote?.retracted === true &&
			retractedNote.revision === kept.revision + 1,
		JSON.stringify({ block: confirmedNote.json?.block, row: retractedNote })
	)
	const twice = await remove(card2, name2, kept.id)
	check(
		'a retracted note is not proposed again',
		refusedWith(twice, 'entry_not_found') && actionsOf(twice.teacherId).length === 0,
		JSON.stringify(twice.tool)
	)

	const said = await comment(card2, 'Comment of the check')
	const commentRemoval = await remove(card2, name2, said.id)
	check(
		'propose_entry_removal for a lesson comment shows the lesson and keeps the comment live',
		commentRemoval.block?.state === 'proposed' &&
			commentRemoval.block.change.operation === 'remove_comment' &&
			commentRemoval.block.change.commentId === said.id &&
			commentRemoval.block.change.lessonRef.kind === 'single' &&
			commentRemoval.block.change.lessonRef.lessonId === said.lessonId &&
			commentRemoval.block.change.lessonDate === said.day &&
			commentRemoval.block.change.body === 'Comment of the check' &&
			commentRow(said.id)?.retracted === false,
		JSON.stringify(commentRemoval.block)
	)
	const confirmedComment = await confirm(commentRemoval.block.actionId)
	const retractedComment = commentRow(said.id)
	check(
		'Remove comment retracts the comment through the comments owner and keeps the row',
		valid(confirmedComment) &&
			confirmedComment.json.block.state === 'applied' &&
			retractedComment?.retracted === true &&
			retractedComment.revision === said.revision + 1,
		JSON.stringify({ block: confirmedComment.json?.block, row: retractedComment })
	)

	const raced = await note(card2, 'Note retracted before confirm')
	const racedRemoval = await remove(card2, name2, raced.id)
	const early = await retractStudentNote(db, accountId, raced.id, raced.revision, card2)
	const staleNote = await confirm(racedRemoval.block?.actionId)
	check(
		'a note retracted between the proposal and confirm makes it stale',
		early.kind === 'retracted' &&
			valid(staleNote) &&
			staleNote.json.block.state === 'stale' &&
			staleNote.json.block.issue === 'entry_changed' &&
			noteRow(raced.id)?.revision === raced.revision + 1,
		JSON.stringify(staleNote.json)
	)
	const edited = await comment(card2, 'Comment changed before confirm')
	const editedRemoval = await remove(card2, name2, edited.id)
	sql(`update lesson_comments set revision = revision + 1, updated_at = now() where id = ${quote(edited.id)}`)
	const staleComment = await confirm(editedRemoval.block?.actionId)
	check(
		'a comment changed between the proposal and confirm makes it stale and stays live',
		valid(staleComment) &&
			staleComment.json.block.state === 'stale' &&
			staleComment.json.block.issue === 'entry_changed' &&
			commentRow(edited.id)?.retracted === false,
		JSON.stringify(staleComment.json)
	)

	const name3 = `${PREFIX}3`
	const card3 = await card(name3)
	const otherNote = await note(card3, 'Note of another student')
	const otherComment = await comment(card3, 'Comment of another student')
	const crossedNote = await remove(card2, name2, otherNote.id)
	const crossedComment = await remove(card2, name2, otherComment.id)
	check(
		'an entry of another student refuses with entry_not_found and stays live',
		refusedWith(crossedNote, 'entry_not_found') &&
			refusedWith(crossedComment, 'entry_not_found') &&
			noteRow(otherNote.id)?.retracted === false &&
			commentRow(otherComment.id)?.retracted === false,
		JSON.stringify({ note: crossedNote.tool, comment: crossedComment.tool })
	)
	const keptRemoval = await remove(card3, name3, otherNote.id)
	const keptDeclined = await decline(keptRemoval.block?.actionId)
	check(
		'Keep entry declines without a retraction',
		valid(keptDeclined) && keptDeclined.json.block.state === 'declined' && noteRow(otherNote.id)?.retracted === false,
		JSON.stringify(keptDeclined.json)
	)
}

let done = false
try {
	cookie = await teacherCookie(api)
	accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id ?? null
	if (!accountId) throw new Error('no active teacher fixture')
	original = sql(
		`select chat_monthly_cap_usd::text as cap, chat_models as models, chat_model as model, chat_effort as effort, chat_max_input_tokens as input, chat_max_output_tokens as output from teacher_settings where account_id = ${quote(accountId)}`
	).rows[0]
	removeChats(
		`id in (select conversation_id from chat_messages where body ilike ${quote(`%${PREFIX}%`)} and role = 'teacher')`
	)
	removeCardRows(`display_name ilike ${quote(`${PREFIX}%`)} and import_key is null`)
	clearBudget()
	await saveAssistantSettings(db, accountId, {
		models: null,
		model: null,
		effort: null,
		monthlyCapUsd: '10.00',
		maxInputTokens: 100000,
		maxOutputTokens: 16000,
	})
	await readAssistantSettings(db, accountId)
	if (section === 'payment') await payment()
	if (section === 'cards') await cards()
	if (section === 'deletions') await deletions()
	done = true
} catch (err) {
	failures++
	console.log(`FAIL changes crashed ${err instanceof Error ? err.message : String(err)}`)
} finally {
	await chat.close()
	server.close()
	if (originalZone !== null && accountId)
		sql(`update teacher_settings set default_time_zone = ${quote(originalZone)} where account_id = ${quote(accountId)}`)
	if (conversations.length > 0) removeChats(`id in (${conversations.map(quote).join(', ')})`)
	if (ids.length > 0) removeCardRows(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
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
		console.log(`LOG ${entry.msg}: ${entry.err?.message ?? ''}`)
	}

if (failures === 0 && done) console.log(`CHAT_CHANGES_${section.toUpperCase()}_OK`)
else console.log(`changes failures ${failures}`)
process.exit(failures === 0 && done ? 0 : 1)
