import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import * as core from '../../packages/core/src/index.ts'
import { ENV_TEST, ROOT, call, quote, sql, studentCookie, teacherCookie } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

const SECTIONS = ['payment']
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
const PREFIX = 'Alex Example 230'
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

async function ask(conversationId, studentId, name, text, input, answer = QUIET) {
	fake.script.push(
		use('propose_payment', {
			student_id: studentId,
			amount_text: '8000',
			currency: null,
			paid_on: null,
			lessons_text: null,
			note: null,
			...input,
		}),
		say(answer)
	)
	const start = text.indexOf('@') + 1
	const sent = await as('POST', `/chat/conversations/${conversationId}/messages`, {
		requestId: randomUUID(),
		text,
		mentions: [{ studentId, text: name, start, end: start + name.length }],
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

let done = false
try {
	cookie = await teacherCookie(api)
	accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id ?? null
	if (!accountId) throw new Error('no active teacher fixture')
	original = sql(
		`select chat_monthly_cap_usd::text as cap, chat_models as models, chat_model as model, chat_effort as effort, chat_max_input_tokens as input, chat_max_output_tokens as output from teacher_settings where account_id = ${quote(accountId)}`
	).rows[0]
	removeChats(
		`id in (select conversation_id from chat_messages where body like ${quote(`%@${PREFIX}%`)} and role = 'teacher')`
	)
	removeCards(`display_name like ${quote(`${PREFIX}%`)} and import_key is null`)
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
		console.log(`LOG ${entry.msg}: ${entry.err?.message ?? ''}`)
	}

if (failures === 0 && done) console.log(`CHAT_CHANGES_${section.toUpperCase()}_OK`)
else console.log(`changes failures ${failures}`)
process.exit(failures === 0 && done ? 0 : 1)
