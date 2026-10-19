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
if (process.env.SCHEDULE_STARTED_SERIES_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, SCHEDULE_STARTED_SERIES_OFFLINE: '1' } }
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
const { opaqueVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)
const { classifyRecurrence } = await import(`${ROOT}/apps/api/src/calendar/recurring.ts`)
const { readCalendarWindow } = await import(`${ROOT}/apps/api/src/calendar/read-model.ts`)
const { applyInbound } = await import(`${ROOT}/apps/api/src/schedule/inbound-apply.ts`)
const { markOccurrence } = await import(`${ROOT}/apps/api/src/schedule/marks.ts`)
const { cardFacts } = await import(`${ROOT}/apps/api/src/cards/card-facts.ts`)
const { readToday } = await import(`${ROOT}/apps/api/src/today/today.ts`)

const CARD_NAME = 'Alex Example 0005'
const CARD_KEY = 'schedule-started-series:alex-example-0005'
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
	const modified = new Set()
	let counter = 0
	const etag = () => `"started-series-${Date.now()}-${(counter += 1)}"`
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

function seriesRow(id) {
	return rows(
		`select id, weekday, to_char(start_time, 'HH24:MI') as start_time, starts_on::text as starts_on, ends_on::text as ends_on
from lesson_series where id = ${quote(id)}`
	)[0]
}

function cardSeries(cardId) {
	return rows(`select id from lesson_series where student_id = ${quote(cardId)}`).map((row) => row.id)
}

function occurrenceMark(seriesId, originalOn) {
	return (
		rows(`select kind from lesson_marks where series_id = ${quote(seriesId)} and original_on = ${quote(originalOn)}`)[0]
			?.kind ?? null
	)
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

async function project(pipeline, fx, masterEvent) {
	const family = [...pipeline.stub.events.values()].filter(
		(event) => event.id === masterEvent || event.recurringEventId === masterEvent
	)
	await pipeline.app.db.transaction((tx) =>
		upsertEventFacts(
			tx,
			fx.target,
			family.map((event) => resourceFact(event, fx.zone))
		)
	)
}

async function createSeries(pipeline, fx, date, startTime) {
	const before = new Set(cardSeries(fx.card.id))
	await run(
		pipeline,
		fx.accountId,
		{
			operation: 'create',
			input: {
				studentId: fx.card.id,
				date,
				startTime,
				durationMinutes: 60,
				repeats: 'weekly',
				expectedDefaultTimeZone: fx.zone,
				requestId: randomUUID(),
				expectedVersion: 'fixture-version',
			},
		},
		0
	)
	const id = cardSeries(fx.card.id).find((item) => !before.has(item))
	if (!id) fail(0, 'the fixture series was not created')
	const masterEvent = mappingEvent(id, 'series')
	await project(pipeline, fx, masterEvent)
	return { id, masterEvent, startTime }
}

async function mark(pipeline, fx, seriesId, date, kind) {
	const result = await markOccurrence(pipeline.app.db, fx.accountId, seriesId, date, { kind }, new Date())
	if (result.kind !== 'ok') fail(0, `mark ${kind} refused with ${result.kind}`)
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
	const yesterday = core.addDays(today, -1)
	const openingOn = core.addDays(today, -60)
	const [card] = rows(
		`insert into students (display_name, status, import_key, no_show_deducts, opening_balance_minutes, opening_balance_on)
values (${quote(CARD_NAME)}, 'active', ${quote(CARD_KEY)}, true, ${OPENING_MINUTES}, ${quote(openingOn)}) returning id`
	)
	const accountId = connection.account_id
	const target = { accountId, connectionId: connection.id, calendarId: connection.calendar_id }
	const fx = { connection, accountId, zone, today, yesterday, card, openingOn, target }
	const main = await createSeries(pipeline, fx, core.addDays(yesterday, -35), '10:00')
	await mark(pipeline, fx, main.id, core.addDays(yesterday, -14), 'done')
	await mark(pipeline, fx, main.id, core.addDays(yesterday, -7), 'no_show')
	const inbound = await createSeries(pipeline, fx, core.addDays(today, -21), '00:00')
	await mark(pipeline, fx, inbound.id, core.addDays(today, -14), 'done')
	console.log(
		`FIXTURES card ${hash(card.id)} main ${hash(main.id)} inbound ${hash(inbound.id)} today ${today} zone ${zone}`
	)
	return { ...fx, main, inbound }
}

function moveSeries(fx, seriesId, input) {
	return {
		operation: 'move_series',
		seriesId,
		input: {
			...input,
			expectedDefaultTimeZone: fx.zone,
			requestId: randomUUID(),
			expectedVersion: seriesVersion(seriesId),
		},
	}
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

async function caseAllFrom(pipeline, fx) {
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
	const context = window.series.find((item) => item.series.id === fx.main.id)
	console.log(
		`case 1 allFrom in the week: read ${window.read.state} context ${Boolean(context)} all_from_yesterday ${context?.allFrom === fx.yesterday}`
	)
	if (context?.allFrom !== fx.yesterday) fail(1, 'the series context does not carry allFrom = yesterday')
}

async function caseHeld(pipeline, fx) {
	const before = commandCount(fx.accountId)
	const noShowOn = core.addDays(fx.yesterday, -7)
	const result = await refusal(
		submit(
			pipeline,
			fx.accountId,
			moveSeries(fx, fx.main.id, { from: noShowOn, weekday: core.weekdayOf(noShowOn), startTime: '11:00' })
		)
	)
	const ok = result === 'precondition_failed' && commandCount(fx.accountId) === before
	console.log(`case 3 from before a no_show: ${result} command_rows ${before}->${commandCount(fx.accountId)}`)
	if (!ok) fail(3, 'a cut that takes a no_show occurrence was not refused')
}

async function caseWindow(pipeline, fx) {
	const [sync] = rows(`select window_start from google_sync_state where connection_id = ${quote(fx.connection.id)}`)
	const narrow = core.startOfZonedDay(fx.today, fx.zone)
	let result
	rows(
		`update google_sync_state set window_start = ${quote(narrow.toISOString())}::timestamptz where connection_id = ${quote(fx.connection.id)}`
	)
	try {
		result = await refusal(
			submit(
				pipeline,
				fx.accountId,
				moveSeries(fx, fx.main.id, {
					from: fx.yesterday,
					weekday: core.weekdayOf(fx.yesterday),
					startTime: '11:00',
				})
			)
		)
	} finally {
		rows(
			`update google_sync_state set window_start = ${quote(new Date(sync.window_start).toISOString())}::timestamptz where connection_id = ${quote(fx.connection.id)}`
		)
	}
	console.log(`case 4 from before the sync window: ${result}`)
	if (result !== 'outside_sync_window') fail(4, 'a cut before the sync window was not refused')
}

async function caseMoveAll(pipeline, fx) {
	const before = await balance(pipeline, fx)
	const doneOn = core.addDays(fx.yesterday, -14)
	const noShowOn = core.addDays(fx.yesterday, -7)
	const weekday = core.weekdayOf(fx.yesterday)
	const series = new Set(cardSeries(fx.card.id))
	await run(pipeline, fx.accountId, moveSeries(fx, fx.main.id, { from: fx.yesterday, weekday, startTime: '11:00' }), 2)
	const created = cardSeries(fx.card.id).find((id) => !series.has(id))
	const fresh = created ? seriesRow(created) : null
	const old = seriesRow(fx.main.id)
	const after = await balance(pipeline, fx)
	const ok =
		fresh?.starts_on === fx.yesterday &&
		fresh.start_time === '11:00' &&
		old.start_time === '10:00' &&
		old.ends_on === core.addDays(fx.yesterday, -1) &&
		occurrenceMark(fx.main.id, doneOn) === 'done' &&
		occurrenceMark(fx.main.id, noShowOn) === 'no_show' &&
		after === before
	console.log(
		`case 2 all from allFrom: applied true new_from_yesterday ${fresh?.starts_on === fx.yesterday} new_time ${fresh?.start_time} old_time ${old.start_time} old_ends_before_yesterday ${old.ends_on === core.addDays(fx.yesterday, -1)} done ${occurrenceMark(fx.main.id, doneOn)} no_show ${occurrenceMark(fx.main.id, noShowOn)} balance_delta ${after - before}`
	)
	if (!ok) fail(2, 'All lessons did not move the started unmarked occurrence or moved a marked one')
	await project(pipeline, fx, mappingEvent(created, 'series'))
	const shifted = new Set(cardSeries(fx.card.id))
	const newStartsOn = core.addDays(fx.yesterday, 3)
	const shiftWeekday = core.weekdayOf(fx.today)
	await run(
		pipeline,
		fx.accountId,
		moveSeries(fx, created, { from: fx.yesterday, weekday: shiftWeekday, startTime: '12:00', newStartsOn }),
		2
	)
	const next = cardSeries(fx.card.id).find((id) => !shifted.has(id))
	const nextRow = next ? seriesRow(next) : null
	const expected = core.firstOnOrAfter(newStartsOn, shiftWeekday)
	console.log(
		`case 2b all with newStartsOn after from: starts_on_first_after_new_start ${nextRow?.starts_on === expected} skips_from_week ${expected !== core.firstOnOrAfter(fx.yesterday, shiftWeekday)}`
	)
	if (nextRow?.starts_on !== expected) fail('2b', 'the new series did not start from newStartsOn')
}

async function caseTodayIntoPast(pipeline, fx) {
	const local = core.zonedParts(new Date(), fx.zone)
	const [hour, minute] = local.time.split(':').map(Number)
	const minutes = hour * 60 + minute
	if (core.lessonDayMinutes(new Date(), fx.zone) < 60 || minutes > 22 * 60) {
		console.log('case 5 skipped: an hour ago is before the start of the lesson day or later is past midnight')
		return
	}
	const clock = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
	const later = clock(Math.ceil((minutes + 60) / 5) * 5)
	const earlier = clock(Math.floor((minutes - 60) / 5) * 5)
	const own = await createSeries(pipeline, fx, fx.today, later)
	const series = new Set(cardSeries(fx.card.id))
	await run(
		pipeline,
		fx.accountId,
		moveSeries(fx, own.id, { from: fx.today, weekday: core.weekdayOf(fx.today), startTime: earlier }),
		5
	)
	const created = cardSeries(fx.card.id).find((id) => !series.has(id))
	const row = created ? seriesRow(created) : null
	if (created) await project(pipeline, fx, mappingEvent(created, 'series'))
	const today = await readToday(
		pipeline.app.db,
		{ accountId: fx.accountId, now: new Date(), defaultTimeZone: fx.zone },
		2
	)
	const key = `s:${created}:${fx.today}`
	const waiting = today.lessons.some(
		(block) => block.key === key && core.awaitsMark(block.outcome, new Date(block.startsAt), new Date())
	)
	const ok = row?.starts_on === fx.today && row.start_time === earlier && waiting && !occurrenceMark(created, fx.today)
	console.log(
		`case 5 today's upcoming lesson moved to a passed time today: starts_today ${row?.starts_on === fx.today} time_passed ${row?.start_time === earlier} waits_for_mark ${waiting}`
	)
	if (!ok) fail(5, "today's lesson moved to a passed time did not stay today waiting for a mark")
}

async function caseInbound(pipeline, fx) {
	const master = pipeline.stub.events.get(fx.inbound.masterEvent)
	const doneOn = core.addDays(fx.today, -14)
	const startedOn = core.addDays(fx.today, -7)
	const first = core.scheduleDate(new Date(master.start.dateTime), fx.zone)
	const startsAt = core.zonedInstant(first, '00:30', fx.zone)
	const changed = {
		...master,
		etag: `"started-series-inbound-${Date.now()}"`,
		start: { dateTime: googleDateTime(startsAt, fx.zone), timeZone: fx.zone },
		end: { dateTime: googleDateTime(startsAt.getTime() + 3600000, fx.zone), timeZone: fx.zone },
	}
	pipeline.stub.events.set(changed.id, changed)
	await pipeline.app.db.transaction((tx) => upsertEventFacts(tx, fx.target, [resourceFact(changed, fx.zone)]))
	const series = new Set(cardSeries(fx.card.id))
	const outcome = await pipeline.app.db.transaction((tx) =>
		applyInbound(tx, {
			accountId: fx.accountId,
			connectionId: fx.connection.id,
			eventId: fx.inbound.masterEvent,
			now: new Date(),
		})
	)
	const created = cardSeries(fx.card.id).find((id) => !series.has(id))
	const fresh = created ? seriesRow(created) : null
	const old = seriesRow(fx.inbound.id)
	const ok =
		outcome.result === 'applied' &&
		fresh?.starts_on === startedOn &&
		fresh.start_time === '00:30' &&
		old.start_time === '00:00' &&
		old.ends_on === core.addDays(startedOn, -1) &&
		occurrenceMark(fx.inbound.id, doneOn) === 'done' &&
		core.isSeriesDate({ ...fresh, weekday: Number(fresh.weekday), startsOn: fresh.starts_on, endsOn: null }, fx.today)
	console.log(
		`case 6 Google master time changed: ${outcome.result} new_from_started_unmarked ${fresh?.starts_on === startedOn} today_follows ${fresh?.starts_on <= fx.today} new_time ${fresh?.start_time} done_on_old_time ${old.start_time === '00:00' && old.ends_on === core.addDays(startedOn, -1)} done ${occurrenceMark(fx.inbound.id, doneOn)}`
	)
	if (!ok) fail(6, 'the started unmarked occurrences did not follow Google or the done one did')
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
	await caseAllFrom(pipeline, fx)
	await caseHeld(pipeline, fx)
	await caseWindow(pipeline, fx)
	await caseMoveAll(pipeline, fx)
	await caseTodayIntoPast(pipeline, fx)
	await caseInbound(pipeline, fx)
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`SCHEDULE_STARTED_SERIES_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
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
if (exitCode === 0) console.log('SCHEDULE_STARTED_SERIES_OK')
process.exit(exitCode)
