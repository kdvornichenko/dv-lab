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
if (process.env.SCHEDULE_COMMENTS_SERIES_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, SCHEDULE_COMMENTS_SERIES_OFFLINE: '1' } }
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
const { readCalendarWindow } = await import(`${ROOT}/apps/api/src/calendar/read-model.ts`)
const { appendLessonComment, listLessonComments } = await import(`${ROOT}/apps/api/src/schedule/comments.ts`)
const { markOccurrence } = await import(`${ROOT}/apps/api/src/schedule/marks.ts`)

const CARD_NAME = 'Alex Example 0007'
const CARD_KEY = 'schedule-comments-series:alex-example-0007'
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

function projection(connectionId, eventId) {
	const [row] = rows(
		`select event_id, etag from google_calendar_events where connection_id = ${quote(connectionId)} and event_id = ${quote(eventId)}`
	)
	return row
}

function versionOf(connectionId, eventId) {
	const row = projection(connectionId, eventId)
	if (!row) throw new Error(`projection row ${hash(eventId)} is missing`)
	return eventVersion({ eventId: row.event_id, etag: row.etag })
}

function commentRows(where) {
	return rows(
		`select id, series_id::text as series_id, original_on::text as original_on, lesson_id::text as lesson_id, revision, retracted_at is not null as retracted
from lesson_comments where ${where} order by created_at, id`
	)
}

function singleMark(lessonId) {
	return rows(`select kind from lesson_marks where lesson_id = ${quote(lessonId)}`)[0]?.kind ?? null
}

async function comment(pipeline, fx, ref, body) {
	const result = await pipeline.app.db.transaction((tx) => appendLessonComment(tx, fx.accountId, ref, body, new Date()))
	if (result.kind !== 'ok') fail(0, `comment refused with ${result.kind}`)
	return result.comment
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

function endSeries(fx, seriesId, lastOn) {
	return {
		operation: 'end_series',
		seriesId,
		input: {
			lastOn,
			expectedDefaultTimeZone: fx.zone,
			requestId: randomUUID(),
			expectedVersion: seriesVersion(seriesId),
		},
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
	const yesterday = core.addDays(today, -1)
	const openingOn = core.addDays(today, -60)
	const [card] = rows(
		`insert into students (display_name, status, import_key, no_show_deducts, opening_balance_minutes, opening_balance_on)
values (${quote(CARD_NAME)}, 'active', ${quote(CARD_KEY)}, true, ${OPENING_MINUTES}, ${quote(openingOn)}) returning id`
	)
	const accountId = connection.account_id
	const target = { accountId, connectionId: connection.id, calendarId: connection.calendar_id }
	const fx = { connection, accountId, zone, today, yesterday, card, openingOn, target }
	const first = core.addDays(yesterday, -35)
	const main = await createSeries(pipeline, fx, first, '10:00')
	const tail = await createSeries(pipeline, fx, first, '13:00')
	const race = await createSeries(pipeline, fx, first, '16:00')
	console.log(
		`FIXTURES card ${hash(card.id)} main ${hash(main.id)} tail ${hash(tail.id)} race ${hash(race.id)} today ${today} zone ${zone}`
	)
	return { ...fx, main, tail, race }
}

async function caseHeld(pipeline, fx) {
	const commentedOn = core.addDays(fx.yesterday, -14)
	const allFrom = core.addDays(fx.yesterday, -7)
	const ref = { kind: 'series', seriesId: fx.main.id, originalOn: commentedOn }
	const added = await comment(pipeline, fx, ref, 'Held comment')
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
	const before = commandCount(fx.accountId)
	const refused = await refusal(
		submit(
			pipeline,
			fx.accountId,
			moveSeries(fx, fx.main.id, { from: commentedOn, weekday: core.weekdayOf(commentedOn), startTime: '11:00' })
		)
	)
	const known = new Set(cardSeries(fx.card.id))
	await run(
		pipeline,
		fx.accountId,
		moveSeries(fx, fx.main.id, { from: allFrom, weekday: core.weekdayOf(allFrom), startTime: '11:00' }),
		1
	)
	const created = cardSeries(fx.card.id).find((id) => !known.has(id))
	const fresh = created ? seriesRow(created) : null
	const old = seriesRow(fx.main.id)
	const [kept] = commentRows(`id = ${quote(added.id)}`)
	const ok =
		context?.allFrom === allFrom &&
		refused === 'precondition_failed' &&
		commandCount(fx.accountId) === before + 1 &&
		fresh?.starts_on === allFrom &&
		old.ends_on === core.addDays(allFrom, -1) &&
		kept?.series_id === fx.main.id &&
		kept.original_on === commentedOn &&
		kept.lesson_id === null &&
		kept.revision === 1
	console.log(
		`case 1 comment holds the cut: all_from_after_comment ${context?.allFrom === allFrom} cut_at_comment ${refused} new_series_from_all_from ${fresh?.starts_on === allFrom} old_series_keeps_comment ${old.ends_on === core.addDays(allFrom, -1)} key_unchanged ${kept?.series_id === fx.main.id && kept.original_on === commentedOn} revision ${kept?.revision}`
	)
	if (!ok) fail(1, 'a commented started occurrence did not hold the cut or lost its key')
}

async function caseEnd(pipeline, fx) {
	const tailDate = core.addDays(fx.yesterday, 7)
	const natural = core.zonedInstant(tailDate, fx.tail.startTime, fx.zone)
	const eventId = `${fx.tail.masterEvent}_${stamp(natural)}`
	const past = core.zonedInstant(core.addDays(fx.today, -2), '17:30', fx.zone)
	const parts = core.zonedParts(past, fx.zone)
	const ref = { kind: 'series', seriesId: fx.tail.id, originalOn: tailDate }
	await run(
		pipeline,
		fx.accountId,
		{
			operation: 'move',
			ref,
			input: {
				date: parts.date,
				startTime: parts.time,
				expectedDefaultTimeZone: fx.zone,
				requestId: randomUUID(),
				expectedVersion: versionOf(fx.connection.id, eventId),
			},
		},
		2
	)
	const one = await comment(pipeline, fx, ref, 'Tail comment one')
	const two = await comment(pipeline, fx, ref, 'Tail comment two')
	await mark(pipeline, fx, fx.tail.id, tailDate, 'no_show')
	const total = commentRows(`student_id = ${quote(fx.card.id)}`).length
	const known = new Set(rows(`select id from lessons where student_id = ${quote(fx.card.id)}`).map((row) => row.id))
	await run(pipeline, fx.accountId, endSeries(fx, fx.tail.id, fx.today), 2)
	const single = rows(`select id, starts_at from lessons where student_id = ${quote(fx.card.id)}`).find(
		(row) => !known.has(row.id)
	)
	const moved = commentRows(`id in (${quote(one.id)}, ${quote(two.id)})`)
	const listed = single
		? await listLessonComments(pipeline.app.db, fx.accountId, { kind: 'single', lessonId: single.id })
		: []
	const ok =
		single !== undefined &&
		new Date(single.starts_at).getTime() === past.getTime() &&
		moved.length === 2 &&
		moved.every(
			(row) =>
				row.lesson_id === single.id &&
				row.series_id === null &&
				row.original_on === null &&
				row.revision === 2 &&
				!row.retracted
		) &&
		listed.map((item) => item.id).join() === [one.id, two.id].join() &&
		singleMark(single.id) === 'no_show' &&
		commentRows(`student_id = ${quote(fx.card.id)}`).length === total &&
		seriesRow(fx.tail.id).ends_on < tailDate
	console.log(
		`case 2 end of series turns a started moved tail occurrence into a single: single ${Boolean(single)} comments_on_single ${moved.filter((row) => row.lesson_id === single?.id).length} revision ${moved.map((row) => row.revision).join('/')} with_mark ${single ? singleMark(single.id) : null} rows ${total}->${commentRows(`student_id = ${quote(fx.card.id)}`).length}`
	)
	if (!ok) fail(2, 'the comments did not follow the occurrence to the new single lesson together with its mark')
}

async function caseRace(pipeline, fx) {
	const tailDate = core.addDays(fx.yesterday, 7)
	const commandId = await submit(pipeline, fx.accountId, endSeries(fx, fx.race.id, fx.today))
	rows(
		`insert into lesson_comments (series_id, original_on, student_id, body) values (${quote(fx.race.id)}, ${quote(tailDate)}, ${quote(fx.card.id)}, 'Raced comment')`
	)
	let thrown = null
	let finished = null
	try {
		finished = await dispatch(pipeline, fx.accountId, commandId)
	} catch (error) {
		thrown = error?.code ?? 'unexpected'
	}
	const [row] = commentRows(`series_id = ${quote(fx.race.id)}`)
	const ok =
		finished?.state !== 'applied' &&
		row?.lesson_id === null &&
		row.series_id === fx.race.id &&
		row.revision === 1 &&
		seriesRow(fx.race.id).ends_on === null
	console.log(
		`case 3 a comment that appears after the plan on a tail date without a lesson stops the cut: state ${finished?.state ?? thrown} issue ${finished?.issue ?? 'none'} comment_stays ${row?.series_id === fx.race.id} series_open ${seriesRow(fx.race.id).ends_on === null}`
	)
	if (!ok) fail(3, 'a tail comment outside the plan did not stop the end of the series')
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
	await caseHeld(pipeline, fx)
	await caseEnd(pipeline, fx)
	await caseRace(pipeline, fx)
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`SCHEDULE_COMMENTS_SERIES_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
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
if (exitCode === 0) console.log('SCHEDULE_COMMENTS_SERIES_OK')
process.exit(exitCode)
