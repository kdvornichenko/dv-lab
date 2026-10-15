import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import dns from 'node:dns'
import { readFileSync } from 'node:fs'
import { isDeepStrictEqual, parseEnv } from 'node:util'

import { call, teacherCookie } from './api.mjs'
import {
	ROOT,
	SYNTHETIC_CALENDAR_ID,
	calendarSql,
	googleDateTime,
	googleTimes,
	startCalendarApi,
	syntheticTokenConfig,
	targetEnvFile,
} from './calendar-env.mjs'

const TARGET = 'test'
const PORT = 4203
if (process.env.MARK_REVISION_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, MARK_REVISION_OFFLINE: '1' } }
	)
	process.exit(child.status ?? 1)
}

const core = await import(`${ROOT}/packages/core/src/index.ts`)
const { createDb, resolveDatabaseUrl } = await import(`${ROOT}/packages/db/src/index.ts`)
const { createConnectionLease } = await import(`${ROOT}/apps/api/src/calendar/lease.ts`)
const { createCredentials } = await import(`${ROOT}/apps/api/src/calendar/google-access.ts`)
const { createTokenEnvelope } = await import(`${ROOT}/apps/api/src/calendar/token-envelope.ts`)
const { createCalendarCommands } = await import(`${ROOT}/apps/api/src/calendar/commands.ts`)
const { insertEventBody, verifyGoogleResult, observeGoogleEvent } = await import(
	`${ROOT}/apps/api/src/calendar/command-result.ts`
)
const { parseMaster } = await import(`${ROOT}/apps/api/src/calendar/provider-events.ts`)
const { GoogleWriteFault } = await import(`${ROOT}/apps/api/src/calendar/gateway.ts`)
const { dispatchCommand, projectCommand } = await import(`${ROOT}/apps/api/src/calendar/dispatch.ts`)
const { executeTransition } = await import(`${ROOT}/apps/api/src/calendar/transitions.ts`)
const { readCommand } = await import(`${ROOT}/apps/api/src/calendar/journal.ts`)
const { upsertEventFacts } = await import(`${ROOT}/apps/api/src/calendar/projection.ts`)
const { eventVersion, opaqueVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)
const { classifyRecurrence } = await import(`${ROOT}/apps/api/src/calendar/recurring.ts`)
const { markOccurrence } = await import(`${ROOT}/apps/api/src/schedule/marks.ts`)
const { readWindow } = await import(`${ROOT}/apps/api/src/schedule/schedule.ts`)
const { cardFacts } = await import(`${ROOT}/apps/api/src/cards/card-facts.ts`)

const CARD_NAME = 'Alex Example 0006'
const CARD_KEY = 'mark-revision:alex-example-0006'
const OPENING_MINUTES = 6000
const LESSON_MINUTES = 60
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
const stamp = (date) => date.toISOString().replace('.000Z', 'Z').replaceAll('-', '').replaceAll(':', '')
const latency = () => new Promise((resolve) => setTimeout(resolve, 300))

let deducted = 0

function fail(check, message) {
	throw new Error(`case ${check}: ${message}`)
}

function rows(text) {
	return calendarSql(TARGET, 'migrator', text).rows
}

function seed(...args) {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/calendar-seed.mjs`, ...args], {
		cwd: ROOT,
		encoding: 'utf8',
		timeout: 120000,
	})
	const out = result.stdout ?? ''
	if (result.status !== 0)
		throw new Error(`calendar-seed ${args.join(' ')} exited ${result.status}: ${out.trim().split('\n').pop()}`)
	return out
}

async function offline() {
	try {
		await dns.promises.lookup('www.googleapis.com')
		return false
	} catch (error) {
		return String(error?.message).includes('calendar-offline')
	}
}

function purgeCard() {
	const card = `(select id from students where import_key = ${quote(CARD_KEY)})`
	const series = `(select id from lesson_series where student_id in ${card})`
	const singles = `(select id from lessons where student_id in ${card})`
	rows(`begin;
delete from lesson_marks where series_id in ${series} or lesson_id in ${singles};
delete from lesson_exceptions where series_id in ${series};
delete from lessons where student_id in ${card};
delete from lesson_series where student_id in ${card};
delete from student_sections where student_id in ${card};
delete from students where import_key = ${quote(CARD_KEY)};
commit;`)
}

function createStub() {
	const events = new Map()
	const modified = new Set()
	let counter = 0
	const etag = () => `"mark-revision-${Date.now()}-${(counter += 1)}"`
	const read = (eventId) => {
		const resource = events.get(eventId)
		if (!resource) throw new GoogleWriteFault(404)
		return structuredClone(resource)
	}
	const clean = (resource) => {
		for (const key of Object.keys(resource)) if (resource[key] === null) delete resource[key]
		return resource
	}
	function instances(master) {
		const zone = master.start.timeZone
		const first = new Date(master.start.dateTime)
		const minutes = (Date.parse(master.end.dateTime) - first.getTime()) / 60000
		const date = core.scheduleDate(first, zone)
		const clock = core.zonedParts(first, zone).time
		for (let week = 0; week < 10; week += 1) {
			const start = core.zonedInstant(core.addDays(date, week * 7), clock, zone)
			const end = new Date(start.getTime() + minutes * 60000)
			const instance = {
				id: `${master.id}_${stamp(start)}`,
				etag: etag(),
				status: 'confirmed',
				eventType: 'default',
				summary: master.summary,
				start: { dateTime: googleDateTime(start, zone), timeZone: zone },
				end: { dateTime: googleDateTime(end, zone), timeZone: zone },
				recurringEventId: master.id,
				originalStartTime: { dateTime: googleDateTime(start, zone), timeZone: zone },
				extendedProperties: structuredClone(master.extendedProperties),
			}
			events.set(instance.id, instance)
		}
	}
	return {
		events,
		async refresh() {
			return { access_token: `synthetic-access-${randomUUID()}`, expiry_date: Date.now() + 3600000 }
		},
		async primary() {
			throw new Error('primary calendar lookup is not expected')
		},
		async insert(_token, _calendarId, request, timeZone, generation) {
			await latency()
			const body = insertEventBody(request)
			const resource = googleTimes(
				clean({ ...body, id: request.eventId, etag: etag(), status: 'confirmed', eventType: 'default' }),
				timeZone
			)
			events.set(resource.id, resource)
			if (resource.recurrence?.length && request.payload.markers.entityKind === 'series') instances(resource)
			return {
				...verifyGoogleResult(structuredClone(resource), request, timeZone, generation, 200),
				recoveryIssue: null,
			}
		},
		async confirmedEvent(_token, _calendarId, request, timeZone, generation) {
			return { ...verifyGoogleResult(read(request.eventId), request, timeZone, generation, 200), recoveryIssue: null }
		},
		async observeEvent(_token, _calendarId, eventId, timeZone) {
			return observeGoogleEvent(read(eventId), timeZone)
		},
		async master(_token, _calendarId, eventId, timeZone) {
			return parseMaster(read(eventId), timeZone)
		},
		async canonicalInstance(_token, _calendarId, masterEventId, originalStart) {
			const found = [...events.values()].filter(
				(item) =>
					item.recurringEventId === masterEventId &&
					Date.parse(item.originalStartTime.dateTime) === Date.parse(originalStart)
			)
			return found.length === 1 ? { kind: 'found', eventId: found[0].id } : { kind: 'missing' }
		},
		async cancelledEvent(_token, _calendarId, eventId) {
			const resource = read(eventId)
			return { id: resource.id, etag: resource.etag, status: resource.status }
		},
		async cancelledInstance(_token, _calendarId, eventId) {
			const resource = read(eventId)
			return {
				id: resource.id,
				recurringEventId: resource.recurringEventId,
				originalStartTime: resource.originalStartTime,
				status: resource.status,
			}
		},
		async identityEvents(_token, _calendarId, localEntityId) {
			return [...events.values()]
				.filter((item) => !item.recurringEventId && item.extendedProperties?.private?.dvLocalId === localEntityId)
				.map((item) => ({
					id: item.id,
					status: item.status,
					extendedProperties: structuredClone(item.extendedProperties),
				}))
		},
		async familyEvents(_token, _calendarId, masterId) {
			return [...events.values()]
				.filter((item) => item.recurringEventId === masterId && modified.has(item.id))
				.map((item) => ({
					id: item.id,
					recurringEventId: item.recurringEventId,
					originalStartTime: item.originalStartTime,
					status: item.status,
				}))
		},
		async patch(_token, _calendarId, request, timeZone, generation, privateProperties) {
			const resource = read(request.eventId)
			if (resource.etag !== request.ifMatch) throw new GoogleWriteFault(412)
			await latency()
			if (resource.recurringEventId) modified.add(resource.id)
			const body = insertEventBody(request)
			const updated = googleTimes(
				clean({
					...resource,
					...body,
					id: resource.id,
					etag: etag(),
					extendedProperties: {
						...body.extendedProperties,
						private: { ...privateProperties, ...body.extendedProperties.private },
					},
				}),
				timeZone
			)
			events.set(updated.id, updated)
			const response = request.payload.status === 'cancelled' ? { id: updated.id } : structuredClone(updated)
			return verifyGoogleResult(response, request, timeZone, generation, 200, true)
		},
	}
}

function resourceFact(resource, zone) {
	const fact = {
		eventId: resource.id,
		etag: resource.etag,
		status: resource.status,
		recurringEventId: resource.recurringEventId ?? null,
		originalStartTime: resource.originalStartTime ?? null,
		summary: resource.summary ?? null,
		start: resource.start,
		end: resource.end,
		eventType: 'default',
		transparency: 'opaque',
		factAt: new Date(),
	}
	return resource.recurrence?.length
		? { ...fact, master: true, recurrence: classifyRecurrence(resource.recurrence, zone) }
		: fact
}

function mappingEvent(localId, kind) {
	const [row] = rows(
		`select event_id from google_event_mappings where local_entity_id = ${quote(localId)} and entity_kind = ${quote(kind)} and state = 'active'`
	)
	return row?.event_id
}

function seriesVersion(seriesId) {
	const [mapping] = rows(
		`select id, representation_generation from google_event_mappings where local_entity_id = ${quote(seriesId)} and entity_kind = 'series' and state = 'active'`
	)
	return opaqueVersion([mapping.id, Number(mapping.representation_generation), seriesId])
}

function versionOf(connectionId, eventId) {
	const [row] = rows(
		`select event_id, etag from google_calendar_events where connection_id = ${quote(connectionId)} and event_id = ${quote(eventId)}`
	)
	if (!row) throw new Error(`projection row ${hash(eventId)} is missing`)
	return eventVersion({ eventId: row.event_id, etag: row.etag })
}

function occurrenceMarkRow(seriesId, originalOn) {
	return (
		rows(
			`select kind, revision from lesson_marks where series_id = ${quote(seriesId)} and original_on = ${quote(originalOn)}`
		)[0] ?? null
	)
}

function lessonMarkRow(lessonId) {
	return rows(`select kind, revision from lesson_marks where lesson_id = ${quote(lessonId)}`)[0] ?? null
}

function exceptionKind(seriesId, originalOn) {
	return (
		rows(
			`select kind from lesson_exceptions where series_id = ${quote(seriesId)} and original_on = ${quote(originalOn)}`
		)[0]?.kind ?? null
	)
}

function commandCount(accountId) {
	return rows(`select count(*)::int as n from google_commands where account_id = ${quote(accountId)}`)[0].n
}

function cardLessons(cardId) {
	return rows(`select id, starts_at from lessons where student_id = ${quote(cardId)}`)
}

async function refusal(promise) {
	try {
		await promise
		return 'accepted'
	} catch (error) {
		return error?.code ?? 'unexpected'
	}
}

async function startPipeline() {
	const fileEnv = parseEnv(readFileSync(targetEnvFile(TARGET), 'utf8'))
	const url = resolveDatabaseUrl('app', { ...fileEnv, NODE_ENV: 'test' })
	const app = createDb(url)
	const stub = createStub()
	const lease = createConnectionLease(app.pool)
	const envelope = createTokenEnvelope(syntheticTokenConfig())
	const credentials = createCredentials({
		db: app.db,
		lease,
		envelope,
		gateway: stub,
		observation: { accessRefreshed() {} },
	})
	const commands = createCalendarCommands({
		db: app.db,
		credentials,
		gateway: stub,
		wake: async () => undefined,
		resume: async () => undefined,
	})
	const close = async () => {
		await credentials.close()
		await lease.close()
		await app.pool.end()
	}
	return { app, stub, credentials, commands, close }
}

async function submit(pipeline, accountId, command) {
	const receipt = await pipeline.commands.submitCalendarCommand({ accountId, now: new Date() }, command)
	return receipt.commandId
}

async function dispatch(pipeline, accountId, commandId) {
	const access = await pipeline.credentials.accessToken(accountId)
	const command = await readCommand(pipeline.app.db, accountId, commandId)
	if (command.plan.cut) await executeTransition(access, command, pipeline.stub)
	else await dispatchCommand(access, command, pipeline.stub)
	await latency()
	const after = await readCommand(pipeline.app.db, accountId, commandId)
	if (after.state === 'projection_pending') await projectCommand(access, after)
	return readCommand(pipeline.app.db, accountId, commandId)
}

async function run(pipeline, accountId, command, check) {
	let commandId
	try {
		commandId = await submit(pipeline, accountId, command)
	} catch (error) {
		fail(check, `${command.operation} refused with ${error?.code ?? 'unexpected'}`)
	}
	const finished = await dispatch(pipeline, accountId, commandId)
	if (finished.state !== 'applied') fail(check, `${command.operation} ended ${finished.state} with ${finished.issue}`)
	return finished
}

async function project(pipeline, fx, ids) {
	const wanted = new Set(ids)
	const facts = [...pipeline.stub.events.values()].filter(
		(event) => wanted.has(event.id) || wanted.has(event.recurringEventId)
	)
	await pipeline.app.db.transaction((tx) =>
		upsertEventFacts(
			tx,
			fx.target,
			facts.map((event) => resourceFact(event, fx.zone))
		)
	)
}

function createCommand(fx, date, startTime, repeats) {
	return {
		operation: 'create',
		input: {
			studentId: fx.card.id,
			date,
			startTime,
			durationMinutes: LESSON_MINUTES,
			repeats,
			expectedDefaultTimeZone: fx.zone,
			requestId: randomUUID(),
			expectedVersion: 'fixture-version',
		},
	}
}

function instanceEvent(fx, date) {
	return `${fx.masterEvent}_${stamp(core.zonedInstant(date, '10:00', fx.zone))}`
}

function moveCommand(fx, date, instant, restoreMark) {
	const parts = core.zonedParts(instant, fx.zone)
	return {
		operation: 'move',
		ref: { kind: 'series', seriesId: fx.series.id, originalOn: date },
		input: {
			date: parts.date,
			startTime: parts.time,
			expectedDefaultTimeZone: fx.zone,
			requestId: randomUUID(),
			expectedVersion: versionOf(fx.connection.id, instanceEvent(fx, date)),
		},
		...(restoreMark ? { restoreMark } : {}),
	}
}

async function fixtures(pipeline) {
	purgeCard()
	const [connection] = rows(
		`select id, account_id, calendar_id from google_connections where calendar_id like '${SYNTHETIC_CALENDAR_ID}%' and retired_at is null`
	)
	const [{ zone }] = rows(
		`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(connection.account_id)}), 'Asia/Ho_Chi_Minh') as zone`
	)
	const today = core.scheduleToday(new Date(), zone)
	const openingOn = core.addDays(today, -60)
	const [card] = rows(
		`insert into students (display_name, status, import_key, no_show_deducts, opening_balance_minutes, opening_balance_on)
values (${quote(CARD_NAME)}, 'active', ${quote(CARD_KEY)}, true, ${OPENING_MINUTES}, ${quote(openingOn)}) returning id`
	)
	const accountId = connection.account_id
	const target = { accountId, connectionId: connection.id, calendarId: connection.calendar_id }
	const fx = { connection, accountId, zone, today, openingOn, card, target }
	const seriesStart = core.addDays(today, -35)
	await run(pipeline, accountId, createCommand(fx, seriesStart, '10:00', 'weekly'), 0)
	const [series] = rows(`select id from lesson_series where student_id = ${quote(card.id)}`)
	const masterEvent = mappingEvent(series.id, 'series')
	await project(pipeline, fx, [masterEvent])
	const dates = {
		sequence: seriesStart,
		restore: core.addDays(seriesStart, 7),
		refuse: core.addDays(seriesStart, 14),
		tail: core.addDays(today, 7),
	}
	let todayLesson = null
	const started = new Date(Date.now() - 5 * 60000)
	started.setUTCSeconds(0, 0)
	const local = core.zonedParts(started, zone)
	const [hour, minute] = local.time.split(':').map(Number)
	if (local.date === today && hour * 60 + minute >= 10) {
		await run(pipeline, accountId, createCommand(fx, local.date, local.time, 'once'), 0)
		const [lesson] = cardLessons(card.id)
		if (!lesson) fail(0, 'the started single was not created')
		const eventId = mappingEvent(lesson.id, 'single')
		await project(pipeline, fx, [eventId])
		todayLesson = { id: lesson.id, eventId }
	}
	console.log(
		`FIXTURES card ${hash(card.id)} series ${hash(series.id)} today ${today} started_single ${todayLesson !== null}`
	)
	return { ...fx, series, masterEvent, dates, todayLesson }
}

function expectedBalance() {
	return OPENING_MINUTES - deducted * LESSON_MINUTES
}

async function checkBalance(pipeline, fx, check) {
	const context = { accountId: fx.accountId, now: new Date(), defaultTimeZone: fx.zone }
	const facts = await cardFacts(
		pipeline.app.db,
		[
			{
				id: fx.card.id,
				openingBalanceMinutes: OPENING_MINUTES,
				openingBalanceOn: fx.openingOn,
				noShowDeducts: true,
			},
		],
		context
	)
	const balance = facts.get(fx.card.id).balanceMinutes
	if (balance !== expectedBalance()) fail(check, `balance ${balance} differs from expected ${expectedBalance()}`)
	return balance
}

async function httpBalance(api, cookie, fx, check) {
	const res = await call(api, 'GET', `/students/${fx.card.id}`, { cookie })
	const balance = res.json?.student?.balanceMinutes
	if (res.status !== 200 || balance !== expectedBalance())
		fail(check, `GET /students/:id ${res.status} balance ${balance} expected ${expectedBalance()}`)
	return balance
}

function postMark(api, cookie, fx, date, body) {
	return call(api, 'POST', `/schedule/series/${fx.series.id}/occurrences/${date}/mark`, { cookie, body })
}

async function httpMarks(api, cookie, pipeline, fx) {
	const date = fx.dates.sequence
	const steps = []
	for (const kind of ['done', 'no_show', 'done', 'done']) {
		const res = await postMark(api, cookie, fx, date, { kind })
		steps.push(`${kind}:${res.status}:${res.json?.mark?.revision}`)
		if (res.status !== 200) fail(1, `mark ${kind} answered ${res.status}`)
	}
	const revisions = steps.map((step) => Number(step.split(':')[2]))
	if (!isDeepStrictEqual(revisions, [1, 2, 3, 4])) fail(1, `revisions ${revisions.join(',')} are not 1,2,3,4`)
	deducted += 1
	await checkBalance(pipeline, fx, 1)
	const stale = await postMark(api, cookie, fx, date, { kind: 'no_show', expectedRevision: 3 })
	const afterStale = occurrenceMarkRow(fx.series.id, date)
	const absent = await postMark(api, cookie, fx, date, { kind: 'no_show', expectedRevision: null })
	const afterAbsent = occurrenceMarkRow(fx.series.id, date)
	const staleOk =
		stale.status === 409 &&
		stale.json?.error?.code === 'lesson_changed' &&
		absent.status === 409 &&
		absent.json?.error?.code === 'lesson_changed' &&
		afterStale?.kind === 'done' &&
		afterStale.revision === 4 &&
		afterAbsent?.kind === 'done' &&
		afterAbsent.revision === 4
	console.log(
		`case 1 done no_show done done: revisions ${revisions.join(',')} stale_3 ${stale.status} ${stale.json?.error?.code} null_on_row ${absent.status} row ${afterAbsent?.kind}/${afterAbsent?.revision}`
	)
	if (!staleOk) fail(1, 'a stale or null expectedRevision did not refuse with lesson_changed')
	const cleared = await postMark(api, cookie, fx, date, { kind: 'none', expectedRevision: 4 })
	const clearedRow = occurrenceMarkRow(fx.series.id, date)
	deducted -= 1
	const balance = await httpBalance(api, cookie, fx, 2)
	const clearedOk =
		cleared.status === 200 &&
		cleared.json?.mark?.kind === 'none' &&
		cleared.json?.mark?.revision === 5 &&
		clearedRow?.kind === 'none' &&
		clearedRow.revision === 5
	console.log(
		`case 2 none keeps the row: ${cleared.status} revision ${cleared.json?.mark?.revision} row ${clearedRow?.kind}/${clearedRow?.revision} balance_ok ${balance === expectedBalance()}`
	)
	if (!clearedOk) fail(2, 'none did not raise the revision or removed the row')
	for (const key of ['restore', 'refuse']) {
		const res = await postMark(api, cookie, fx, fx.dates[key], { kind: 'no_show', expectedRevision: null })
		if (res.status !== 200 || res.json?.mark?.revision !== 1)
			fail(3, `fresh no_show with expectedRevision null answered ${res.status} revision ${res.json?.mark?.revision}`)
		deducted += 1
	}
	await httpBalance(api, cookie, fx, 3)
	console.log('case 3 fresh no_show with expectedRevision null: 200 revision 1 on both keys')
	if (fx.todayLesson) {
		const res = await call(api, 'POST', `/schedule/lessons/${fx.todayLesson.id}/mark`, {
			cookie,
			body: { kind: 'done', expectedRevision: null },
		})
		if (res.status !== 200 || res.json?.mark?.revision !== 1)
			fail(4, `single done answered ${res.status} revision ${res.json?.mark?.revision}`)
		deducted += 1
		await httpBalance(api, cookie, fx, 4)
	}
}

async function readRevisions(api, cookie, pipeline, fx, check) {
	const today = await call(api, 'GET', '/today', { cookie })
	if (today.status !== 200) fail(check, `GET /today answered ${today.status}`)
	const blocks = [...(today.json.lessons ?? []), ...(today.json.earlier ?? [])]
	const shaped = blocks.every(
		(block) => block.markRevision === null || (Number.isInteger(block.markRevision) && block.markRevision >= 1)
	)
	const single = fx.todayLesson ? today.json.lessons.find((block) => block.key === `l:${fx.todayLesson.id}`) : undefined
	const singleOk = !fx.todayLesson || (single?.mark === 'done' && single.markRevision === 1)
	const context = { now: new Date(), defaultTimeZone: fx.zone }
	const day = (date) =>
		readWindow(
			pipeline.app.db,
			core.startOfZonedDay(date, fx.zone),
			core.startOfZonedDay(core.addDays(date, 1), fx.zone),
			context
		)
	const sequence = (await day(fx.dates.sequence)).blocks.find(
		(block) => block.key === `s:${fx.series.id}:${fx.dates.sequence}`
	)
	const ok = shaped && singleOk && sequence?.mark === 'none' && sequence.markRevision === 5
	console.log(
		`case ${check} revision in blocks: today_blocks ${blocks.length} shaped ${shaped} today_single ${fx.todayLesson ? `${single?.mark}/${single?.markRevision}` : 'skipped'} week_block ${sequence?.mark}/${sequence?.markRevision}`
	)
	if (!ok) fail(check, 'Today or the week block does not carry the mark revision')
}

async function caseRestore(pipeline, fx) {
	const date = fx.dates.restore
	const natural = core.zonedInstant(date, '10:00', fx.zone)
	const tomorrow = core.zonedInstant(core.addDays(fx.today, 1), '11:00', fx.zone)
	const forward = await run(pipeline, fx.accountId, moveCommand(fx, date, tomorrow), 6)
	await project(pipeline, fx, [fx.masterEvent])
	const cleared = occurrenceMarkRow(fx.series.id, date)
	deducted -= 1
	await checkBalance(pipeline, fx, 6)
	const clearOk = forward.plan.lineage[0]?.clearMark === true && cleared?.kind === 'none' && cleared.revision === 2
	console.log(
		`case 6 no_show moved to tomorrow: clear_mark ${forward.plan.lineage[0]?.clearMark === true} row ${cleared?.kind}/${cleared?.revision}`
	)
	if (!clearOk) fail(6, 'the move with clearMark did not raise the revision')
	const restoreMark = { kind: 'no_show', revision: 2 }
	const back = await run(pipeline, fx.accountId, moveCommand(fx, date, natural, restoreMark), 7)
	await project(pipeline, fx, [fx.masterEvent])
	const restored = occurrenceMarkRow(fx.series.id, date)
	deducted += 1
	await checkBalance(pipeline, fx, 7)
	const ok =
		isDeepStrictEqual(back.plan.lineage[0]?.restoreMark, restoreMark) &&
		restored?.kind === 'no_show' &&
		restored.revision === 3 &&
		exceptionKind(fx.series.id, date) === 'restored'
	console.log(
		`case 7 reverse move with restoreMark: ${back.state} lineage_restore ${isDeepStrictEqual(back.plan.lineage[0]?.restoreMark, restoreMark)} row ${restored?.kind}/${restored?.revision} exception ${exceptionKind(fx.series.id, date)}`
	)
	if (!ok) fail(7, 'the reverse move did not return no_show in the applying transaction')
}

async function caseRestoreRefused(pipeline, fx) {
	const date = fx.dates.refuse
	const natural = core.zonedInstant(date, '10:00', fx.zone)
	await run(
		pipeline,
		fx.accountId,
		moveCommand(fx, date, core.zonedInstant(core.addDays(fx.today, 1), '12:00', fx.zone)),
		8
	)
	await project(pipeline, fx, [fx.masterEvent])
	deducted -= 1
	await checkBalance(pipeline, fx, 8)
	const moved = occurrenceMarkRow(fx.series.id, date)
	if (moved?.kind !== 'none' || moved.revision !== 2) fail(8, `row after the move is ${moved?.kind}/${moved?.revision}`)
	const before = commandCount(fx.accountId)
	const wrongRevision = await refusal(
		submit(pipeline, fx.accountId, moveCommand(fx, date, natural, { kind: 'no_show', revision: 1 }))
	)
	const later = core.zonedInstant(core.addDays(fx.today, 2), '10:00', fx.zone)
	const futureTarget = await refusal(
		submit(pipeline, fx.accountId, moveCommand(fx, date, later, { kind: 'no_show', revision: 2 }))
	)
	const after = commandCount(fx.accountId)
	const refusedOk =
		wrongRevision === 'precondition_failed' && futureTarget === 'precondition_failed' && after === before
	console.log(
		`case 8 restoreMark refused: other_revision ${wrongRevision} future_target ${futureTarget} command_rows ${before}->${after}`
	)
	if (!refusedOk) fail(8, 'a restoreMark with another revision or a future target was accepted')
	const commandId = await submit(
		pipeline,
		fx.accountId,
		moveCommand(fx, date, natural, { kind: 'no_show', revision: 2 })
	)
	rows(
		`update lesson_marks set revision = revision + 1, updated_at = now() where series_id = ${quote(fx.series.id)} and original_on = ${quote(date)}`
	)
	const finished = await dispatch(pipeline, fx.accountId, commandId)
	await project(pipeline, fx, [fx.masterEvent])
	const raced = occurrenceMarkRow(fx.series.id, date)
	await checkBalance(pipeline, fx, 9)
	const ok =
		finished.state === 'applied' &&
		raced?.kind === 'none' &&
		raced.revision === 3 &&
		exceptionKind(fx.series.id, date) === 'restored'
	console.log(
		`case 9 revision changed before dispatch: ${finished.state} row ${raced?.kind}/${raced?.revision} exception ${exceptionKind(fx.series.id, date)}`
	)
	if (!ok) fail(9, 'the reverse move with a stale restoreMark failed or touched the mark')
}

async function restoreCycle(pipeline, fx, date, check) {
	const natural = core.zonedInstant(date, '10:00', fx.zone)
	const away = core.zonedInstant(core.addDays(date, 1), '11:00', fx.zone)
	await run(pipeline, fx.accountId, moveCommand(fx, date, away), check)
	await project(pipeline, fx, [fx.masterEvent])
	await run(pipeline, fx.accountId, moveCommand(fx, date, natural), check)
	await project(pipeline, fx, [fx.masterEvent])
	const exception = exceptionKind(fx.series.id, date)
	const mark = occurrenceMarkRow(fx.series.id, date)
	if (exception !== 'restored' || mark !== null)
		fail(check, `the restored occurrence has exception ${exception} and mark ${mark?.kind ?? 'none'}`)
}

async function caseRestoredTail(pipeline, base) {
	const known = new Set(
		rows(`select id from lesson_series where student_id = ${quote(base.card.id)}`).map((row) => row.id)
	)
	const first = core.addDays(base.today, 2)
	await run(pipeline, base.accountId, createCommand(base, first, '10:00', 'weekly'), 12)
	const [series] = rows(`select id from lesson_series where student_id = ${quote(base.card.id)}`).filter(
		(row) => !known.has(row.id)
	)
	if (!series) fail(12, 'the second series was not created')
	const fx = { ...base, series, masterEvent: mappingEvent(series.id, 'series') }
	await project(pipeline, fx, [fx.masterEvent])
	const restored = core.addDays(first, 14)
	await restoreCycle(pipeline, fx, restored, 12)
	const commandsBefore = commandCount(fx.accountId)
	const lessonsBefore = cardLessons(fx.card.id).length
	const move = await refusal(
		submit(pipeline, fx.accountId, {
			operation: 'move_series',
			seriesId: fx.series.id,
			input: {
				from: restored,
				weekday: core.weekdayOf(restored),
				startTime: '11:00',
				expectedDefaultTimeZone: fx.zone,
				requestId: randomUUID(),
				expectedVersion: seriesVersion(fx.series.id),
			},
		})
	)
	const end = await refusal(
		submit(pipeline, fx.accountId, {
			operation: 'end_series',
			seriesId: fx.series.id,
			input: {
				lastOn: core.addDays(first, 7),
				expectedDefaultTimeZone: fx.zone,
				requestId: randomUUID(),
				expectedVersion: seriesVersion(fx.series.id),
			},
		})
	)
	const ok =
		move === 'external_change' &&
		end === 'external_change' &&
		commandCount(fx.accountId) === commandsBefore &&
		cardLessons(fx.card.id).length === lessonsBefore
	console.log(
		`case 12 restored unmarked occurrence in the tail: move_series ${move} end_series ${end} command_rows ${commandsBefore}->${commandCount(fx.accountId)}`
	)
	if (!ok) fail(12, 'a cut over a restored occurrence was not refused at admission')
}

async function caseEndSeries(pipeline, fx) {
	const date = fx.dates.tail
	const yesterday = core.zonedInstant(core.addDays(fx.today, -1), '15:00', fx.zone)
	await run(pipeline, fx.accountId, moveCommand(fx, date, yesterday), 10)
	await project(pipeline, fx, [fx.masterEvent])
	for (const kind of ['done', 'done']) {
		const result = await markOccurrence(pipeline.app.db, fx.accountId, fx.series.id, date, { kind }, new Date())
		if (result.kind !== 'ok') fail(10, `mark of the moved tail occurrence refused with ${result.kind}`)
	}
	deducted += 1
	await checkBalance(pipeline, fx, 10)
	const held = occurrenceMarkRow(fx.series.id, date)
	const lessonsBefore = new Set(cardLessons(fx.card.id).map((row) => row.id))
	await run(
		pipeline,
		fx.accountId,
		{
			operation: 'end_series',
			seriesId: fx.series.id,
			input: {
				lastOn: fx.today,
				expectedDefaultTimeZone: fx.zone,
				requestId: randomUUID(),
				expectedVersion: seriesVersion(fx.series.id),
			},
		},
		10
	)
	const created = cardLessons(fx.card.id).filter((row) => !lessonsBefore.has(row.id))
	const single = created.find((row) => new Date(row.starts_at).getTime() === yesterday.getTime())
	const singleMark = single ? lessonMarkRow(single.id) : null
	const occurrence = occurrenceMarkRow(fx.series.id, date)
	await checkBalance(pipeline, fx, 10)
	const ok =
		held?.kind === 'done' &&
		held.revision === 2 &&
		created.length === 1 &&
		singleMark?.kind === 'done' &&
		singleMark.revision === 1 &&
		occurrence?.kind === 'done' &&
		occurrence.revision === 2
	console.log(
		`case 10 end_series with a marked moved tail occurrence: new_singles ${created.length} single_mark ${singleMark?.kind}/${singleMark?.revision} occurrence_row ${occurrence?.kind}/${occurrence?.revision}`
	)
	if (!ok) fail(10, 'end_series did not copy the mark as a new row with revision 1')
}

async function withApi(fn) {
	const api = await startCalendarApi({ port: PORT, envFile: '.env.test' })
	try {
		const cookie = await teacherCookie(api)
		return await fn(api, cookie)
	} finally {
		await api.stop()
	}
}

let pipeline = null
let exitCode = 0
try {
	if (!(await offline())) throw new Error('Google hosts resolve: the offline preload is not active')
	const [other] = rows(
		`select count(*)::int as n from google_commands c join google_connections g on g.id = c.connection_id
where c.state not in ('applied', 'failed') and g.calendar_id not like '${SYNTHETIC_CALENDAR_ID}%'`
	)
	if (other.n !== 0) throw new Error(`refused: ${other.n} unresolved commands outside the synthetic calendar`)
	const up = seed('up', TARGET, 'week')
	if (!/SEED_UP test week/.test(up)) throw new Error('calendar-seed up did not finish')
	pipeline = await startPipeline()
	const fx = await fixtures(pipeline)
	await withApi(async (api, cookie) => {
		await httpMarks(api, cookie, pipeline, fx)
		await readRevisions(api, cookie, pipeline, fx, 5)
	})
	await caseRestore(pipeline, fx)
	await caseRestoreRefused(pipeline, fx)
	await withApi(async (api, cookie) => {
		const balance = await httpBalance(api, cookie, fx, 11)
		console.log(`case 11 balance over http after the moves: ${balance === expectedBalance()}`)
	})
	await caseEndSeries(pipeline, fx)
	await caseRestoredTail(pipeline, fx)
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`MARK_REVISION_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
	exitCode = 1
} finally {
	if (pipeline) await pipeline.close()
	try {
		seed('down', TARGET)
		purgeCard()
	} catch (error) {
		console.log(`cleanup failed: ${error instanceof Error ? error.message : 'unexpected failure'}`)
		exitCode = 1
	}
}
if (exitCode === 0) console.log('MARK_REVISION_OK')
process.exit(exitCode)
