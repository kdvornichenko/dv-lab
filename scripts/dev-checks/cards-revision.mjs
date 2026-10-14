import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import * as core from '../../packages/core/src/index.ts'
import { ENV_TEST, ROOT, call, quote, sql, startApi, teacherCookie } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

const { createDb } = await import(`${ROOT}/packages/db/src/index.ts`)
const { setCardRate } = await import(`${ROOT}/apps/api/src/cards/cards.ts`)

const PORT = 4242
const PREFIX = 'Alex Example 231'
const NOTE = 'cards-revision fixture'

let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const ids = []
let api = null
let cookie = null
let accountId = null
let zone = core.SCHEDULE_TIME_ZONE
let today = ''

const as = (method, path, body) => call(api, method, path, { cookie, body })

const cardBody = (displayName, over = {}) => ({
	displayName,
	rateMinor: 400000,
	currency: 'RUB',
	defaultLessonMinutes: 60,
	parent: 'Parent one',
	level: 'B1',
	goals: 'Goals one',
	timeZone: null,
	gender: 'female',
	...over,
})

async function card(name, over = {}) {
	const res = await as('POST', '/students', cardBody(name, over))
	if (res.status !== 201) throw new Error(`card create returned ${res.status}`)
	ids.push(res.json.student.id)
	return res.json.student
}

async function student(id) {
	const res = await as('GET', `/students/${id}`)
	if (res.status !== 200) throw new Error(`card read returned ${res.status}`)
	return res.json.student
}

const removePayment = (id, body) =>
	call(api, 'DELETE', `/payments/${id}`, {
		cookie,
		body,
		headers: { 'content-length': String(Buffer.byteLength(JSON.stringify(body))) },
	})

const conflict = (res) => res.status === 409 && res.json?.error?.code === 'precondition_failed'

const paymentRows = (studentId) =>
	sql(
		`select id, student_id, paid_on::text as paid_on, amount_minor as amount, credited_minutes as credited, source, created_at::text as created_at, revision from payments where student_id = ${quote(studentId)} order by created_at`
	).rows

async function cardChecks() {
	const first = await card(`${PREFIX}0`)
	check('a new card starts at revision 1', first.revision === 1, String(first.revision))

	const fresh = await as('PATCH', `/students/${first.id}`, {
		...cardBody(first.displayName),
		goals: 'Goals two',
		expectedRevision: 1,
	})
	check(
		'PATCH with the current revision saves and advances the revision',
		fresh.status === 200 && fresh.json.student.goals === 'Goals two' && fresh.json.student.revision === 2,
		JSON.stringify({ status: fresh.status, revision: fresh.json?.student?.revision })
	)

	const stale = await as('PATCH', `/students/${first.id}`, {
		...cardBody(first.displayName),
		goals: 'Goals three',
		parent: 'Parent three',
		rateMinor: null,
		currency: null,
		gender: 'male',
		expectedRevision: 1,
	})
	const kept = await student(first.id)
	check(
		'PATCH with a stale revision gives 409 precondition_failed and changes no field',
		conflict(stale) &&
			kept.goals === 'Goals two' &&
			kept.parent === 'Parent one' &&
			kept.rateMinor === 400000 &&
			kept.currency === 'RUB' &&
			kept.gender === 'female' &&
			kept.revision === 2,
		JSON.stringify({ status: stale.status, error: stale.json?.error, kept })
	)

	const legacy = await as('PATCH', `/students/${first.id}`, { ...cardBody(first.displayName), level: 'B2' })
	check(
		'PATCH without a revision still saves and advances the revision',
		legacy.status === 200 && legacy.json.student.level === 'B2' && legacy.json.student.revision === 3,
		JSON.stringify({ status: legacy.status, revision: legacy.json?.student?.revision })
	)

	const archiveStale = await as('POST', `/students/${first.id}/archive`, { expectedRevision: 1 })
	const archived = await as('POST', `/students/${first.id}/archive`, { expectedRevision: 3 })
	check(
		'archive refuses a stale revision and archives with the current one',
		conflict(archiveStale) &&
			archived.status === 200 &&
			archived.json.student.status === 'archived' &&
			archived.json.student.revision === 4,
		JSON.stringify({ stale: archiveStale.status, status: archived.status, revision: archived.json?.student?.revision })
	)

	const restoreStale = await as('POST', `/students/${first.id}/restore`, { expectedRevision: 3 })
	const restored = await as('POST', `/students/${first.id}/restore`)
	check(
		'restore refuses a stale revision and restores without a body',
		conflict(restoreStale) &&
			restored.status === 200 &&
			restored.json.student.status === 'active' &&
			restored.json.student.revision === 5,
		JSON.stringify({ stale: restoreStale.status, status: restored.status, revision: restored.json?.student?.revision })
	)

	const bare = await as('POST', `/students/${first.id}/archive`)
	const again = await as('POST', `/students/${first.id}/archive`)
	check(
		'POST archive without a body archives and a repeat keeps the revision',
		bare.status === 200 &&
			bare.json.student.status === 'archived' &&
			bare.json.student.revision === 6 &&
			again.status === 200 &&
			again.json.student.revision === 6,
		JSON.stringify({ bare: bare.status, again: again.status, revision: again.json?.student?.revision })
	)
	const repeatCurrent = await as('POST', `/students/${first.id}/archive`, { expectedRevision: 6 })
	const repeatStale = await as('POST', `/students/${first.id}/archive`, { expectedRevision: 5 })
	check(
		'a repeated archive with the current revision is 200 and with a stale one 409',
		repeatCurrent.status === 200 && repeatCurrent.json.student.revision === 6 && conflict(repeatStale),
		`${repeatCurrent.status} ${repeatStale.status}`
	)
	const junk = await call(api, 'POST', `/students/${first.id}/archive`, { cookie, body: { expectedRevision: 0 } })
	check('archive with an invalid revision gives 400', junk.status === 400, String(junk.status))
	await as('POST', `/students/${first.id}/restore`)

	const opening = { lessonsHundredths: 200, on: core.addDays(today, -2), expectedDefaultTimeZone: zone }
	const openStale = await as('PUT', `/students/${first.id}/opening-balance`, { ...opening, expectedRevision: 1 })
	const before = (await student(first.id)).revision
	const opened = await as('PUT', `/students/${first.id}/opening-balance`, { ...opening, expectedRevision: before })
	const openedLegacy = await as('PUT', `/students/${first.id}/opening-balance`, opening)
	check(
		'opening balance refuses a stale revision and advances the revision with and without it',
		conflict(openStale) &&
			opened.status === 200 &&
			opened.json.student.revision === before + 1 &&
			openedLegacy.status === 200 &&
			openedLegacy.json.student.revision === before + 2,
		JSON.stringify({ stale: openStale.status, opened: opened.status, legacy: openedLegacy.status })
	)

	const url = parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL
	const { pool, db } = createDb(url)
	try {
		const context = { accountId, now: new Date(), defaultTimeZone: zone }
		const current = (await student(first.id)).revision
		const narrowStale = await db.transaction((tx) =>
			setCardRate(tx, first.id, { rateMinor: 500000, currency: 'USD' }, current - 1, context)
		)
		const narrow = await db.transaction((tx) =>
			setCardRate(tx, first.id, { rateMinor: 500000, currency: 'USD' }, current, context)
		)
		const cleared = await db.transaction((tx) =>
			setCardRate(tx, first.id, { rateMinor: null, currency: null }, current + 1, context)
		)
		const missing = await db.transaction((tx) =>
			setCardRate(tx, randomUUID(), { rateMinor: null, currency: null }, 1, context)
		)
		const after = await student(first.id)
		check(
			'setCardRate changes only the rate pair under a required revision',
			narrowStale.kind === 'changed' &&
				narrow.kind === 'ok' &&
				narrow.detail.rateMinor === 500000 &&
				narrow.detail.currency === 'USD' &&
				narrow.detail.revision === current + 1 &&
				cleared.kind === 'ok' &&
				missing.kind === 'not_found' &&
				after.rateMinor === null &&
				after.currency === null &&
				after.goals === 'Goals one' &&
				after.level === 'B2' &&
				after.parent === 'Parent one' &&
				after.gender === 'female' &&
				after.revision === current + 2,
			JSON.stringify({
				narrowStale: narrowStale.kind,
				narrow: narrow.kind,
				cleared: cleared.kind,
				missing: missing.kind,
			})
		)

		const raced = await student(first.id)
		const holder = await pool.connect()
		let racing = null
		let waited = false
		try {
			await holder.query('begin')
			await holder.query('update students set revision = revision + 1 where id = $1', [first.id])
			racing = as('PATCH', `/students/${first.id}`, {
				...cardBody(first.displayName, { level: 'C1' }),
				expectedRevision: raced.revision,
			})
			const deadline = Date.now() + 5000
			while (!waited && Date.now() < deadline) {
				const { rows } = await pool.query(
					`select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and query ilike 'update "students"%'`
				)
				waited = rows[0].n > 0
				if (!waited) await new Promise((resolve) => setTimeout(resolve, 50))
			}
			await holder.query('commit')
		} finally {
			holder.release()
		}
		const racedReply = await racing
		check(
			'a PATCH that waits on a concurrent commit of the same card gives 409 changed, not 500',
			waited && conflict(racedReply) && (await student(first.id)).level !== 'C1',
			JSON.stringify({ waited, status: racedReply.status, error: racedReply.json?.error?.code })
		)
	} finally {
		await pool.end()
	}

	const unknown = await as('PATCH', `/students/${randomUUID()}`, { ...cardBody(`${PREFIX}9`), expectedRevision: 1 })
	check('PATCH of an unknown card gives 404', unknown.status === 404, String(unknown.status))
}

async function record(studentId, body = {}) {
	const res = await as('POST', '/payments', {
		studentId,
		paidOn: core.addDays(today, -1),
		expectedDefaultTimeZone: zone,
		amountMinor: 800000,
		currency: 'RUB',
		lessonsHundredths: 200,
		note: null,
		...body,
	})
	if (res.status !== 201) throw new Error(`payment record returned ${res.status}`)
	return res.json.payment
}

async function paymentChecks() {
	const owner = await card(`${PREFIX}1`)
	const opened = await as('PUT', `/students/${owner.id}/opening-balance`, {
		lessonsHundredths: 100,
		on: core.addDays(today, -3),
		expectedDefaultTimeZone: zone,
	})
	if (opened.status !== 200) throw new Error(`opening balance returned ${opened.status}`)
	const payment = await record(owner.id)
	check('a new payment starts at revision 1', payment.revision === 1, String(payment.revision))
	const originalRow = paymentRows(owner.id)[0]

	const lengthChange = await as('PATCH', `/students/${owner.id}`, {
		...cardBody(owner.displayName),
		defaultLessonMinutes: 45,
	})
	if (lengthChange.status !== 200) throw new Error(`lesson length change returned ${lengthChange.status}`)

	const fix = {
		paidOn: today,
		expectedDefaultTimeZone: zone,
		amountMinor: 900000,
		currency: 'RUB',
		lessonsHundredths: 300,
		note: 'Corrected',
		expectedRevision: 1,
	}
	const fixed = await as('PATCH', `/payments/${payment.id}`, fix)
	const rows = paymentRows(owner.id)
	check(
		'PATCH /payments/:id corrects the same row and recalculates the credit from the current lesson length',
		fixed.status === 200 &&
			fixed.json.payment.id === payment.id &&
			fixed.json.payment.source === 'manual' &&
			fixed.json.payment.studentId === owner.id &&
			fixed.json.payment.createdAt === payment.createdAt &&
			fixed.json.payment.amountMinor === 900000 &&
			fixed.json.payment.paidOn === today &&
			fixed.json.payment.lessonsHundredths === 300 &&
			fixed.json.payment.note === 'Corrected' &&
			fixed.json.payment.creditedMinutes === core.creditedMinutes(300, 45) &&
			fixed.json.payment.revision === 2 &&
			rows.length === 1 &&
			rows[0].id === payment.id &&
			rows[0].created_at === originalRow.created_at,
		JSON.stringify({ status: fixed.status, payment: fixed.json?.payment, rows: rows.length })
	)

	const detail = await student(owner.id)
	const expected = core.studentBalance(
		{
			openingMinutes: detail.openingBalance?.minutes ?? null,
			openingOn: detail.openingBalance?.on ?? null,
			noShowDeducts: detail.noShowDeducts,
		},
		rows.map((row) => ({ paidOn: row.paid_on, creditedMinutes: Number(row.credited) })),
		[],
		zone
	)
	check(
		'the profile balance equals studentBalance from core over the payment rows',
		detail.balanceMinutes === expected && expected !== null,
		`${detail.balanceMinutes} ${expected}`
	)

	const repeat = await as('PATCH', `/payments/${payment.id}`, fix)
	check(
		'a repeated correction with the old revision gives 409 and writes no second payment',
		conflict(repeat) && paymentRows(owner.id).length === 1 && paymentRows(owner.id)[0].revision === 2,
		String(repeat.status)
	)

	const future = await as('PATCH', `/payments/${payment.id}`, {
		...fix,
		paidOn: core.addDays(today, 1),
		expectedRevision: 2,
	})
	const other = zone === 'Europe/Moscow' ? 'Asia/Ho_Chi_Minh' : 'Europe/Moscow'
	const zoneMoved = await as('PATCH', `/payments/${payment.id}`, {
		...fix,
		expectedDefaultTimeZone: other,
		expectedRevision: 2,
	})
	const noRevision = await as('PATCH', `/payments/${payment.id}`, { ...fix, expectedRevision: undefined })
	const unknown = await as('PATCH', `/payments/${randomUUID()}`, fix)
	check(
		'a future date gives 400, a moved teacher zone 409, no revision 400, an unknown payment 404',
		future.status === 400 &&
			zoneMoved.status === 409 &&
			zoneMoved.json?.error?.code === 'default_time_zone_changed' &&
			noRevision.status === 400 &&
			unknown.status === 404 &&
			paymentRows(owner.id)[0].revision === 2,
		`${future.status} ${zoneMoved.status} ${noRevision.status} ${unknown.status}`
	)

	const loose = sql(
		`insert into payments (student_id, paid_on, amount_minor, currency, source, note) values (null, ${quote(today)}, 100000, 'RUB', 'manual', ${quote(NOTE)}) returning id`
	).rows[0].id
	const looseFix = await as('PATCH', `/payments/${loose}`, fix)
	check('an unassigned payment is not corrected by PATCH (400)', looseFix.status === 400, String(looseFix.status))

	const assignStale = await as('POST', `/payments/${loose}/assign`, {
		studentId: owner.id,
		currency: null,
		lessonsHundredths: 100,
		expectedRevision: 4,
	})
	const assigned = await as('POST', `/payments/${loose}/assign`, {
		studentId: owner.id,
		currency: null,
		lessonsHundredths: 100,
		expectedRevision: 1,
	})
	check(
		'assign refuses a stale revision and advances the revision',
		conflict(assignStale) &&
			assigned.status === 200 &&
			assigned.json.payment.revision === 2 &&
			assigned.json.payment.id === loose,
		`${assignStale.status} ${assigned.status} ${assigned.json?.payment?.revision}`
	)

	const doomed = await record(owner.id)
	const deleteStale = await removePayment(doomed.id, { expectedRevision: 2 })
	const stillThere = paymentRows(owner.id).some((row) => row.id === doomed.id)
	const deleted = await removePayment(doomed.id, { expectedRevision: 1 })
	const plain = await record(owner.id)
	const deletedBare = await call(api, 'DELETE', `/payments/${plain.id}`, { cookie })
	const deletedAgain = await call(api, 'DELETE', `/payments/${plain.id}`, { cookie })
	check(
		'DELETE refuses a stale revision, deletes with the current one and without a body',
		conflict(deleteStale) &&
			stillThere &&
			deleted.status === 204 &&
			deletedBare.status === 204 &&
			deletedAgain.status === 404 &&
			!paymentRows(owner.id).some((row) => row.id === doomed.id || row.id === plain.id),
		`${deleteStale.status} ${deleted.status} ${deletedBare.status} ${deletedAgain.status}`
	)

	const before = paymentRows(owner.id).length
	const second = await as('PATCH', `/payments/${payment.id}`, { ...fix, amountMinor: 950000, expectedRevision: 2 })
	check(
		'corrections never add payment rows',
		second.status === 200 &&
			second.json.payment.revision === 3 &&
			paymentRows(owner.id).length === before &&
			before === 2,
		`${second.status} ${before}`
	)
}

async function creditChecks() {
	const owner = await card(`${PREFIX}2`)
	const payment = await record(owner.id, { lessonsHundredths: 300 })
	const longer = await as('PATCH', `/students/${owner.id}`, {
		...cardBody(owner.displayName),
		defaultLessonMinutes: 90,
	})
	if (longer.status !== 200) throw new Error(`lesson length change returned ${longer.status}`)
	const base = {
		paidOn: payment.paidOn,
		expectedDefaultTimeZone: zone,
		amountMinor: payment.amountMinor,
		currency: payment.currency,
		lessonsHundredths: 300,
		note: 'Only the note',
		expectedRevision: payment.revision,
	}
	const noted = await as('PATCH', `/payments/${payment.id}`, base)
	const notedRow = paymentRows(owner.id)[0]
	check(
		'a correction that keeps the lesson count keeps the stored credit after the lesson length changed',
		payment.creditedMinutes === core.creditedMinutes(300, 60) &&
			noted.status === 200 &&
			noted.json.payment.note === 'Only the note' &&
			noted.json.payment.creditedMinutes === payment.creditedMinutes &&
			Number(notedRow.credited) === payment.creditedMinutes,
		JSON.stringify({
			status: noted.status,
			before: payment.creditedMinutes,
			after: noted.json?.payment?.creditedMinutes,
		})
	)
	const recount = await as('PATCH', `/payments/${payment.id}`, {
		...base,
		lessonsHundredths: 400,
		expectedRevision: noted.json.payment.revision,
	})
	const recountRow = paymentRows(owner.id)[0]
	check(
		'a correction of the lesson count recalculates the credit from the current lesson length',
		recount.status === 200 &&
			recount.json.payment.creditedMinutes === core.creditedMinutes(400, 90) &&
			Number(recountRow.credited) === core.creditedMinutes(400, 90),
		JSON.stringify({ status: recount.status, after: recount.json?.payment?.creditedMinutes })
	)
}

let done = false
try {
	sql(`delete from payments where student_id is null and note = ${quote(NOTE)}`)
	removeCards(`display_name like ${quote(`${PREFIX}%`)} and import_key is null`)
	api = await startApi({ port: PORT })
	cookie = await teacherCookie(api)
	accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id ?? null
	if (!accountId) throw new Error('no active teacher fixture')
	zone =
		sql(`select default_time_zone as zone from teacher_settings where account_id = ${quote(accountId)}`).rows[0]
			?.zone ?? core.SCHEDULE_TIME_ZONE
	today = core.scheduleToday(new Date(), zone)
	await cardChecks()
	await paymentChecks()
	await creditChecks()
	done = true
} catch (err) {
	failures++
	console.log(`FAIL cards revision crashed ${err instanceof Error ? err.message : String(err)}`)
} finally {
	if (api) await api.stop()
	sql(`delete from payments where student_id is null and note = ${quote(NOTE)}`)
	if (ids.length > 0) removeCards(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
	removeCards(`display_name like ${quote(`${PREFIX}%`)} and import_key is null`)
}

if (failures === 0 && done) console.log('CARDS_REVISION_OK')
else console.log(`cards revision failures ${failures}`)
process.exit(failures === 0 && done ? 0 : 1)
