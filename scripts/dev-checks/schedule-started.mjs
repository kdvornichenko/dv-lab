import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import dns from 'node:dns'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import {
	ROOT,
	SYNTHETIC_CALENDAR_ID,
	calendarSql,
	googleDateTime,
	googleTimes,
	syntheticTokenConfig,
	targetEnvFile,
} from './calendar-env.mjs'
import { studentCleanupSql } from './fixture-cleanup.mjs'

const TARGET = 'test'
if (process.env.SCHEDULE_STARTED_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, SCHEDULE_STARTED_OFFLINE: '1' } }
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
const { dispatchCommand } = await import(`${ROOT}/apps/api/src/calendar/dispatch.ts`)
const { readCommand } = await import(`${ROOT}/apps/api/src/calendar/journal.ts`)
const { upsertEventFacts } = await import(`${ROOT}/apps/api/src/calendar/projection.ts`)
const { eventVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)
const { readCalendarWindow } = await import(`${ROOT}/apps/api/src/calendar/read-model.ts`)
const { markLesson, markOccurrence } = await import(`${ROOT}/apps/api/src/schedule/marks.ts`)
const { filterHistoryBlocks } = await import(`${ROOT}/apps/api/src/schedule/rows.ts`)
const { cardFacts } = await import(`${ROOT}/apps/api/src/cards/card-facts.ts`)
const { readToday } = await import(`${ROOT}/apps/api/src/today/today.ts`)

const CARD_NAME = 'Alex Example 0004'
const CARD_KEY = 'schedule-started:alex-example-0004'
const OPENING_MINUTES = 6000
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
const stamp = (date) => date.toISOString().replace('.000Z', 'Z').replaceAll('-', '').replaceAll(':', '')
const latency = () => new Promise((resolve) => setTimeout(resolve, 300))

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
	rows(studentCleanupSql(`import_key = ${quote(CARD_KEY)}`))
}

function createStub() {
	const events = new Map()
	const calls = { patch: [], insert: [] }
	let counter = 0
	const etag = () => `"started-check-${Date.now()}-${(counter += 1)}"`
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
		for (let week = 0; week < 8; week += 1) {
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
		calls,
		async refresh() {
			return { access_token: `synthetic-access-${randomUUID()}`, expiry_date: Date.now() + 3600000 }
		},
		async primary() {
			throw new Error('primary calendar lookup is not expected')
		},
		async insert(_token, _calendarId, request, timeZone, generation) {
			await latency()
			calls.insert.push(request.eventId)
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
		async patch(_token, _calendarId, request, timeZone, generation, privateProperties) {
			const resource = read(request.eventId)
			if (resource.etag !== request.ifMatch) throw new GoogleWriteFault(412)
			await latency()
			calls.patch.push(request.eventId)
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

function resourceFact(resource) {
	return {
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
}

function projection(connectionId, eventId) {
	const [row] = rows(
		`select event_id, etag, status, starts_at from google_calendar_events
where connection_id = ${quote(connectionId)} and event_id = ${quote(eventId)}`
	)
	return row
}

function versionOf(connectionId, eventId) {
	const row = projection(connectionId, eventId)
	if (!row) throw new Error(`projection row ${hash(eventId)} is missing`)
	return eventVersion({ eventId: row.event_id, etag: row.etag })
}

function mappingEvent(localId, kind) {
	const [row] = rows(
		`select event_id from google_event_mappings where local_entity_id = ${quote(localId)} and entity_kind = ${quote(kind)} and state = 'active'`
	)
	return row?.event_id
}

function lessonRow(id) {
	return rows(`select starts_at, duration_minutes, status from lessons where id = ${quote(id)}`)[0]
}

function lessonMark(id) {
	return rows(`select kind from lesson_marks where lesson_id = ${quote(id)}`)[0]?.kind ?? null
}

function occurrenceMark(seriesId, originalOn) {
	return (
		rows(`select kind from lesson_marks where series_id = ${quote(seriesId)} and original_on = ${quote(originalOn)}`)[0]
			?.kind ?? null
	)
}

function exceptionOf(seriesId, originalOn) {
	return rows(
		`select series_id, original_on::text as original_on, kind, starts_at from lesson_exceptions
where series_id = ${quote(seriesId)} and original_on = ${quote(originalOn)}`
	)[0]
}

function markCount(cardId) {
	const card = quote(cardId)
	return rows(`select count(*)::int as n from lesson_marks
where lesson_id in (select id from lessons where student_id = ${card})
or series_id in (select id from lesson_series where student_id = ${card})`)[0].n
}

function commandCount(accountId) {
	return rows(`select count(*)::int as n from google_commands where account_id = ${quote(accountId)}`)[0].n
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
	await dispatchCommand(access, command, pipeline.stub)
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
	const create = (date, startTime, repeats) => ({
		operation: 'create',
		input: {
			studentId: card.id,
			date,
			startTime,
			durationMinutes: 60,
			repeats,
			expectedDefaultTimeZone: zone,
			requestId: randomUUID(),
			expectedVersion: 'fixture-version',
		},
	})
	const seriesStart = core.addDays(today, -35)
	await run(pipeline, accountId, create(seriesStart, '10:00', 'weekly'), 0)
	const [series] = rows(`select id from lesson_series where student_id = ${quote(card.id)}`)
	const masterEvent = mappingEvent(series.id, 'series')
	const instanceList = [...pipeline.stub.events.values()].filter((event) => event.recurringEventId === masterEvent)
	await pipeline.app.db.transaction((tx) =>
		upsertEventFacts(tx, target, [
			...instanceList.map(resourceFact),
			{
				eventId: masterEvent,
				status: 'confirmed',
				master: true,
				recurrence: {
					recurrenceKind: 'weekly',
					recurrenceWeekday: core.weekdayOf(seriesStart),
					recurrenceFrequency: 'weekly',
					recurrenceInterval: 1,
					recurrenceUntil: null,
				},
				factAt: new Date(),
			},
		])
	)
	const occurrences = [0, 1, 2, 3, 4, 5, 6].map((week) => {
		const date = core.addDays(seriesStart, week * 7)
		const natural = core.zonedInstant(date, '10:00', zone)
		return { date, natural, eventId: `${masterEvent}_${stamp(natural)}` }
	})
	const singles = {}
	for (const [name, offset] of [
		['moveTomorrow', -2],
		['clearToday', -3],
		['keepToday', -4],
		['done', -5],
		['cancelRestore', -6],
		['future', 3],
	]) {
		const before = new Set(rows(`select id from lessons where student_id = ${quote(card.id)}`).map((row) => row.id))
		await run(pipeline, accountId, create(core.addDays(today, offset), '12:00', 'once'), 0)
		const created = rows(`select id from lessons where student_id = ${quote(card.id)}`).find(
			(row) => !before.has(row.id)
		)
		if (!created) fail(0, `single ${name} was not created`)
		singles[name] = { id: created.id, eventId: mappingEvent(created.id, 'single') }
	}
	console.log(
		`FIXTURES card ${hash(card.id)} series ${hash(series.id)} instances ${instanceList.length} singles ${Object.keys(singles).length} today ${today}`
	)
	return { connection, accountId, zone, today, card, openingOn, series, masterEvent, occurrences, singles, target }
}

function moveCommand(fx, ref, eventId, instant) {
	const parts = core.zonedParts(instant, fx.zone)
	return {
		operation: 'move',
		ref,
		input: {
			date: parts.date,
			startTime: parts.time,
			expectedDefaultTimeZone: fx.zone,
			requestId: randomUUID(),
			expectedVersion: versionOf(fx.connection.id, eventId),
		},
	}
}

function actionCommand(fx, operation, ref, eventId) {
	return {
		operation,
		ref,
		input: { requestId: randomUUID(), expectedVersion: versionOf(fx.connection.id, eventId) },
	}
}

const singleRef = (single) => ({ kind: 'single', lessonId: single.id })
const occurrenceRef = (fx, occurrence) => ({ kind: 'series', seriesId: fx.series.id, originalOn: occurrence.date })

async function setMarks(pipeline, fx) {
	const now = new Date()
	const results = [
		await markLesson(pipeline.app.db, fx.accountId, fx.singles.clearToday.id, { kind: 'no_show' }, now),
		await markLesson(pipeline.app.db, fx.accountId, fx.singles.keepToday.id, { kind: 'no_show' }, now),
		await markLesson(pipeline.app.db, fx.accountId, fx.singles.done.id, { kind: 'done' }, now),
	]
	for (const index of [0, 1, 2, 3])
		results.push(
			await markOccurrence(
				pipeline.app.db,
				fx.accountId,
				fx.series.id,
				fx.occurrences[index].date,
				{ kind: 'no_show' },
				now
			)
		)
	if (results.some((result) => result.kind !== 'ok'))
		fail(0, `marks refused: ${results.map((result) => result.kind).join(' ')}`)
}

function tomorrowAt(fx, time) {
	return core.zonedInstant(core.addDays(fx.today, 1), time, fx.zone)
}

function roundedMinute(offsetMs) {
	const instant = new Date(Date.now() + offsetMs)
	instant.setUTCSeconds(0, 0)
	return instant
}

async function caseCreatedInPast(pipeline, fx) {
	const context = { accountId: fx.accountId, now: new Date(), defaultTimeZone: fx.zone }
	const today = await readToday(pipeline.app.db, context, 2)
	const key = `l:${fx.singles.moveTomorrow.id}`
	const waiting = today.earlier.some((block) => block.key === key)
	console.log(`case 7 created in the past: waits_for_mark ${waiting} earlier ${today.earlier.length}`)
	if (!waiting) fail(7, 'a lesson created in the past is not in Earlier, not marked')
}

async function caseStartedSingle(pipeline, fx) {
	const single = fx.singles.moveTomorrow
	const target = tomorrowAt(fx, '10:00')
	const patches = pipeline.stub.calls.patch.length
	await run(pipeline, fx.accountId, moveCommand(fx, singleRef(single), single.eventId, target), 1)
	const lesson = lessonRow(single.id)
	const google = pipeline.stub.events.get(single.eventId)
	const ok =
		new Date(lesson.starts_at).getTime() === target.getTime() &&
		Date.parse(google.start.dateTime) === target.getTime() &&
		pipeline.stub.calls.patch.length === patches + 1
	console.log(
		`case 1 started single moved to tomorrow: applied true lesson_moved ${new Date(lesson.starts_at).getTime() === target.getTime()} google_start ${Date.parse(google.start.dateTime) === target.getTime()}`
	)
	if (!ok) fail(1, 'the started single did not move with its Google event')
}

async function balance(pipeline, fx) {
	const context = { accountId: fx.accountId, now: new Date(), defaultTimeZone: fx.zone }
	const facts = await cardFacts(
		pipeline.app.db,
		[{ id: fx.card.id, openingBalanceMinutes: OPENING_MINUTES, openingBalanceOn: fx.openingOn, noShowDeducts: true }],
		context
	)
	return facts.get(fx.card.id).balanceMinutes
}

async function caseNoShowTomorrow(pipeline, fx) {
	const occurrence = fx.occurrences[0]
	const before = await balance(pipeline, fx)
	const marksBefore = markCount(fx.card.id)
	const target = tomorrowAt(fx, '11:00')
	const applied = await run(
		pipeline,
		fx.accountId,
		moveCommand(fx, occurrenceRef(fx, occurrence), occurrence.eventId, target),
		2
	)
	const exception = exceptionOf(fx.series.id, occurrence.date)
	const mark = occurrenceMark(fx.series.id, occurrence.date)
	const after = await balance(pipeline, fx)
	const ok =
		applied.plan.lineage[0]?.clearMark === true &&
		exception?.kind === 'moved' &&
		new Date(exception.starts_at).getTime() === target.getTime() &&
		mark === 'none' &&
		markCount(fx.card.id) === marksBefore &&
		after === before + 60
	console.log(
		`case 2 no_show occurrence moved to tomorrow: same_key ${exception?.kind === 'moved'} mark ${mark} mark_rows ${marksBefore}->${markCount(fx.card.id)} balance_delta ${after - before}`
	)
	if (!ok) fail(2, 'moving a no_show occurrence to tomorrow did not clear the mark on the same key')
}

async function caseNoShowPast(pipeline, fx) {
	const occurrence = fx.occurrences[1]
	const target = core.zonedInstant(occurrence.date, '15:00', fx.zone)
	const applied = await run(
		pipeline,
		fx.accountId,
		moveCommand(fx, occurrenceRef(fx, occurrence), occurrence.eventId, target),
		3
	)
	const exception = exceptionOf(fx.series.id, occurrence.date)
	const mark = occurrenceMark(fx.series.id, occurrence.date)
	const ok =
		applied.plan.lineage[0]?.clearMark === undefined &&
		exception?.kind === 'moved' &&
		new Date(exception.starts_at).getTime() === target.getTime() &&
		mark === 'no_show'
	console.log(`case 3 no_show occurrence moved within the past: moved ${exception?.kind === 'moved'} mark ${mark}`)
	if (!ok) fail(3, 'moving a no_show occurrence within the past changed the mark')
}

async function caseNoShowToday(pipeline, fx) {
	const later = fx.singles.clearToday
	const laterTarget = roundedMinute(2 * 3600000)
	await run(pipeline, fx.accountId, moveCommand(fx, singleRef(later), later.eventId, laterTarget), 4)
	const earlier = fx.singles.keepToday
	const earlierTarget = roundedMinute(-2 * 3600000)
	await run(pipeline, fx.accountId, moveCommand(fx, singleRef(earlier), earlier.eventId, earlierTarget), 4)
	const laterMark = lessonMark(later.id)
	const earlierMark = lessonMark(earlier.id)
	const ok =
		new Date(lessonRow(later.id).starts_at).getTime() === laterTarget.getTime() &&
		new Date(lessonRow(earlier.id).starts_at).getTime() === earlierTarget.getTime() &&
		laterMark === 'none' &&
		earlierMark === 'no_show'
	console.log(`case 4 no_show single moved around now: later_than_now ${laterMark} earlier_than_now ${earlierMark}`)
	if (!ok) fail(4, 'the no_show rule around the current moment is wrong')
}

async function caseDone(pipeline, fx) {
	const single = fx.singles.done
	const before = commandCount(fx.accountId)
	const move = await refusal(
		submit(pipeline, fx.accountId, moveCommand(fx, singleRef(single), single.eventId, tomorrowAt(fx, '13:00')))
	)
	const cancel = await refusal(
		submit(pipeline, fx.accountId, actionCommand(fx, 'cancel', singleRef(single), single.eventId))
	)
	const ok = move === 'lesson_done' && cancel === 'lesson_done' && commandCount(fx.accountId) === before
	console.log(`case 5 done lesson: move ${move} cancel ${cancel} command_rows ${before}->${commandCount(fx.accountId)}`)
	if (!ok) fail(5, 'a done lesson was not refused with lesson_done')
}

async function caseCancelRestore(pipeline, fx) {
	const single = fx.singles.cancelRestore
	await run(pipeline, fx.accountId, actionCommand(fx, 'cancel', singleRef(single), single.eventId), 6)
	const cancelled = lessonRow(single.id).status
	await run(pipeline, fx.accountId, actionCommand(fx, 'restore', singleRef(single), single.eventId), 6)
	const restored = lessonRow(single.id).status
	console.log(`case 6 started single cancelled then restored: ${cancelled} -> ${restored}`)
	if (cancelled !== 'cancelled' || restored !== 'scheduled') fail(6, 'cancel or restore of a started lesson failed')
}

async function caseFutureToPast(pipeline, fx) {
	const single = fx.singles.future
	const target = core.zonedInstant(core.addDays(fx.today, -8), '12:00', fx.zone)
	await run(pipeline, fx.accountId, moveCommand(fx, singleRef(single), single.eventId, target), 7)
	const moved = new Date(lessonRow(single.id).starts_at).getTime() === target.getTime()
	console.log(`case 7 future lesson moved into the past: ${moved}`)
	if (!moved) fail(7, 'a future lesson did not move into the past')
}

async function caseWindow(pipeline, fx) {
	const far = core.zonedInstant(core.addDays(fx.today, 420), '12:00', fx.zone)
	const single = fx.singles.future
	const singleTarget = await refusal(
		submit(pipeline, fx.accountId, moveCommand(fx, singleRef(single), single.eventId, far))
	)
	const occurrence = fx.occurrences[6]
	const occurrenceTarget = await refusal(
		submit(pipeline, fx.accountId, moveCommand(fx, occurrenceRef(fx, occurrence), occurrence.eventId, far))
	)
	const [sync] = rows(`select window_start from google_sync_state where connection_id = ${quote(fx.connection.id)}`)
	const narrow = core.startOfZonedDay(core.addDays(fx.today, -1), fx.zone)
	let startOutside
	rows(
		`update google_sync_state set window_start = ${quote(narrow.toISOString())}::timestamptz where connection_id = ${quote(fx.connection.id)}`
	)
	try {
		const cancel = fx.singles.cancelRestore
		startOutside = await refusal(
			submit(pipeline, fx.accountId, actionCommand(fx, 'cancel', singleRef(cancel), cancel.eventId))
		)
	} finally {
		rows(
			`update google_sync_state set window_start = ${quote(new Date(sync.window_start).toISOString())}::timestamptz where connection_id = ${quote(fx.connection.id)}`
		)
	}
	const ok =
		singleTarget === 'outside_sync_window' &&
		occurrenceTarget === 'outside_sync_window' &&
		startOutside === 'outside_sync_window'
	console.log(
		`case 8 sync window: single_target ${singleTarget} occurrence_target ${occurrenceTarget} lesson_start ${startOutside}`
	)
	if (!ok) fail(8, 'a change outside the sync window was not refused')
}

async function caseWeekMarks(pipeline, fx) {
	const window = await readCalendarWindow(
		pipeline.app.db,
		{ accountId: fx.accountId, now: new Date() },
		{
			kind: 'window',
			start: core.startOfZonedDay(core.addDays(fx.today, -10), fx.zone),
			end: core.startOfZonedDay(core.addDays(fx.today, 2), fx.zone),
			displayTimeZone: fx.zone,
		}
	)
	const markOf = (single) =>
		window.events.find((event) => event.binding.kind === 'lesson' && event.binding.ref.lessonId === single.id)?.binding
			.mark
	const done = markOf(fx.singles.done)
	const noShow = markOf(fx.singles.keepToday)
	const unmarked = markOf(fx.singles.cancelRestore)
	const ok = done === 'done' && noShow === 'no_show' && unmarked === null
	console.log(`case 9 week binding marks: done ${done} no_show ${noShow} unmarked ${unmarked}`)
	if (!ok) fail(9, 'the week projection does not carry the lesson mark')
}

function historyBlock(fx, occurrence, mark) {
	return {
		ref: occurrenceRef(fx, occurrence),
		studentId: fx.card.id,
		startsAt: occurrence.natural.toISOString(),
		durationMinutes: 60,
		mark,
	}
}

async function casePendingMark(pipeline, fx) {
	const occurrence = fx.occurrences[2]
	const commandId = await submit(
		pipeline,
		fx.accountId,
		moveCommand(fx, occurrenceRef(fx, occurrence), occurrence.eventId, tomorrowAt(fx, '14:00'))
	)
	const pending = await readCommand(pipeline.app.db, fx.accountId, commandId)
	const written = await markOccurrence(
		pipeline.app.db,
		fx.accountId,
		fx.series.id,
		occurrence.date,
		{ kind: 'done' },
		new Date()
	)
	const heldMark = occurrenceMark(fx.series.id, occurrence.date)
	const other = fx.occurrences[4]
	const otherWritten = await markOccurrence(
		pipeline.app.db,
		fx.accountId,
		fx.series.id,
		other.date,
		{ kind: 'done' },
		new Date()
	)
	const visible = await filterHistoryBlocks(pipeline.app.db, fx.accountId, [historyBlock(fx, occurrence, 'no_show')])
	const finished = await dispatch(pipeline, fx.accountId, commandId)
	const settled = occurrenceMark(fx.series.id, occurrence.date)
	const raced = fx.occurrences[3]
	const racedId = await submit(
		pipeline,
		fx.accountId,
		moveCommand(fx, occurrenceRef(fx, raced), raced.eventId, tomorrowAt(fx, '15:00'))
	)
	const racedPlan = (await readCommand(pipeline.app.db, fx.accountId, racedId)).plan
	rows(
		`update lesson_marks set kind = 'done', updated_at = now() where series_id = ${quote(fx.series.id)} and original_on = ${quote(raced.date)}`
	)
	const racedFinished = await dispatch(pipeline, fx.accountId, racedId)
	const racedMark = occurrenceMark(fx.series.id, raced.date)
	const ok =
		pending.state === 'pending' &&
		pending.plan.lineage[0]?.clearMark === true &&
		written.kind === 'changed' &&
		heldMark === 'no_show' &&
		otherWritten.kind === 'ok' &&
		visible.length === 1 &&
		finished.state === 'applied' &&
		settled === 'none' &&
		racedPlan.lineage[0]?.clearMark === true &&
		racedFinished.state === 'applied' &&
		racedFinished.issue !== 'precondition_failed' &&
		racedMark === 'done'
	console.log(
		`case 10 mark while the move is pending: write ${written.kind} held ${heldMark} other_key ${otherWritten.kind} history_visible ${visible.length === 1} applied ${finished.state} mark_after ${settled} race_applied ${racedFinished.state} race_mark ${racedMark}`
	)
	if (!ok) fail(10, 'the mark of a key with a pending command was not protected')
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
	await setMarks(pipeline, fx)
	await caseCreatedInPast(pipeline, fx)
	await caseStartedSingle(pipeline, fx)
	await caseNoShowTomorrow(pipeline, fx)
	await caseNoShowPast(pipeline, fx)
	await caseNoShowToday(pipeline, fx)
	await caseDone(pipeline, fx)
	await caseCancelRestore(pipeline, fx)
	await caseFutureToPast(pipeline, fx)
	await caseWindow(pipeline, fx)
	await caseWeekMarks(pipeline, fx)
	await casePendingMark(pipeline, fx)
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`SCHEDULE_STARTED_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
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
if (exitCode === 0) console.log('SCHEDULE_STARTED_OK')
process.exit(exitCode)
