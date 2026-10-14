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

const TARGET = 'test'
const SECTIONS = ['zone', 'proposal']
const section = process.argv[2]
if (!SECTIONS.includes(section)) {
	console.log(`usage: node scripts/dev-checks/chat-bulk.mjs ${SECTIONS.join('|')}`)
	process.exit(2)
}
if (process.env.CHAT_BULK_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		[
			'--import',
			`${ROOT}/scripts/dev-checks/calendar-offline.mjs`,
			new URL(import.meta.url).pathname,
			...process.argv.slice(2),
		],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, CHAT_BULK_OFFLINE: '1' } }
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
const { checkCalendarConflicts } = await import(`${ROOT}/apps/api/src/schedule/calendar-conflicts.ts`)
const { markOccurrence } = await import(`${ROOT}/apps/api/src/schedule/marks.ts`)
const { seriesAnchor } = await import(`${ROOT}/apps/api/src/schedule/series.ts`)
const { createConversation } = await import(`${ROOT}/apps/api/src/chat/conversations.ts`)
const { insertMessage } = await import(`${ROOT}/apps/api/src/chat/messages.ts`)
const { runTool } = await import(`${ROOT}/apps/api/src/chat/tools.ts`)
const { chatBlock } = await import(`${ROOT}/packages/contracts/src/index.ts`)

const CARD_NAME = 'Alex Example 2320'
const KEY_PREFIX = 'chat-bulk:'
const CARD_KEY = `${KEY_PREFIX}alex-example-2320`
const VN = 'Asia/Ho_Chi_Minh'
const MSK = 'Europe/Moscow'
const BERLIN = 'Europe/Berlin'
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
	const card = `(select id from students where import_key like ${quote(`${KEY_PREFIX}%`)})`
	const series = `(select id from lesson_series where student_id in ${card})`
	const singles = `(select id from lessons where student_id in ${card})`
	rows(`begin;
delete from lesson_marks where series_id in ${series} or lesson_id in ${singles};
delete from lesson_exceptions where series_id in ${series};
delete from lessons where student_id in ${card};
delete from lesson_series where student_id in ${card};
delete from students where import_key like ${quote(`${KEY_PREFIX}%`)};
commit;`)
}

const conversations = []

function purgeChats() {
	if (conversations.length === 0) return
	const ids = conversations.map(quote).join(', ')
	rows(`begin;
delete from chat_actions where conversation_id in (${ids});
delete from chat_messages where reply_to is not null and conversation_id in (${ids});
delete from chat_messages where conversation_id in (${ids});
delete from chat_conversations where id in (${ids});
commit;`)
}

function createStub() {
	const events = new Map()
	const modified = new Set()
	let counter = 0
	const etag = () => `"chat-bulk-${Date.now()}-${(counter += 1)}"`
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
		`select id, weekday, time_zone, to_char(start_time, 'HH24:MI') as start_time, starts_on::text as starts_on, ends_on::text as ends_on
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

function teacherSetting(accountId) {
	return (
		rows(`select default_time_zone from teacher_settings where account_id = ${quote(accountId)}`)[0]
			?.default_time_zone ?? null
	)
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
			family.map((event) => resourceFact(event, event.start?.timeZone ?? fx.zone))
		)
	)
}

function moveSeries(fx, seriesId, input, expectedDefaultTimeZone = fx.zone) {
	return {
		operation: 'move_series',
		seriesId,
		input: {
			...input,
			expectedDefaultTimeZone,
			requestId: randomUUID(),
			expectedVersion: seriesVersion(seriesId),
		},
	}
}

async function zoneFixtures(pipeline) {
	purgeCard()
	const [connection] = rows(
		`select id, account_id, calendar_id from google_connections where calendar_id like '${SYNTHETIC_CALENDAR_ID}%' and retired_at is null`
	)
	const accountId = connection.account_id
	const setting = teacherSetting(accountId)
	const zone = setting ?? VN
	if (zone !== VN) fail(0, `the test teacher zone is ${zone}, expected ${VN}`)
	const today = core.scheduleToday(new Date(), zone)
	const lastTuesday = core.firstOnOrAfter(core.addDays(today, -7), 2)
	const startsOn = core.addDays(lastTuesday, -21)
	const doneOn = core.addDays(lastTuesday, -14)
	const from = core.firstOnOrAfter(core.addDays(today, 1), 2)
	const [card] = rows(
		`insert into students (display_name, status, import_key) values (${quote(CARD_NAME)}, 'active', ${quote(CARD_KEY)}) returning id`
	)
	const target = { accountId, connectionId: connection.id, calendarId: connection.calendar_id }
	const fx = { connection, accountId, zone, setting, today, card, target, from, doneOn }
	const before = new Set(cardSeries(card.id))
	await run(
		pipeline,
		accountId,
		{
			operation: 'create',
			input: {
				studentId: card.id,
				date: startsOn,
				startTime: '12:00',
				durationMinutes: 60,
				repeats: 'weekly',
				expectedDefaultTimeZone: zone,
				requestId: randomUUID(),
				expectedVersion: 'fixture-version',
			},
		},
		0
	)
	const id = cardSeries(card.id).find((item) => !before.has(item))
	if (!id) fail(0, 'the fixture series was not created')
	await project(pipeline, fx, mappingEvent(id, 'series'))
	const marked = await markOccurrence(pipeline.app.db, accountId, id, doneOn, { kind: 'done' }, new Date())
	if (marked.kind !== 'ok') fail(0, `mark done refused with ${marked.kind}`)
	console.log(
		`FIXTURES card ${hash(card.id)} series ${hash(id)} tuesday_12_vn ${seriesRow(id).weekday === 2 && seriesRow(id).start_time === '12:00'} today ${today} from ${from} zone ${zone}`
	)
	return { ...fx, main: id }
}

async function conflictRange(pipeline, fx, inputTimeZone) {
	const result = await checkCalendarConflicts(
		{ db: pipeline.app.db },
		{ accountId: fx.accountId, now: new Date() },
		{
			proposal: {
				operation: 'move_series',
				input: {
					from: fx.from,
					weekday: 3,
					startTime: '14:00',
					...(inputTimeZone ? { inputTimeZone } : {}),
					expectedDefaultTimeZone: fx.zone,
				},
			},
			editedRef: { kind: 'series', seriesId: fx.main, originalOn: fx.from },
			expectedVersion: seriesVersion(fx.main),
			checkThrough: core.addDays(fx.from, 14),
		}
	)
	return result
}

async function caseConflicts(pipeline, fx) {
	const wednesday = core.firstOnOrAfter(fx.from, 3)
	const named = await conflictRange(pipeline, fx, MSK)
	const plain = await conflictRange(pipeline, fx, undefined)
	const namedStart = core.zonedInstant(wednesday, '14:00', MSK).toISOString()
	const plainStart = core.zonedInstant(wednesday, '14:00', VN).toISOString()
	const ok =
		named.state === 'complete' &&
		named.checkedRange.timeZone === MSK &&
		named.checkedRange.start === namedStart &&
		plain.state === 'complete' &&
		plain.checkedRange.timeZone === VN &&
		plain.checkedRange.start === plainStart
	console.log(
		`case 1 conflicts for move_series: msk ${named.state} ${named.state === 'unavailable' ? named.reason : `range_zone ${named.checkedRange?.timeZone} first_at_14_msk ${named.checkedRange?.start === namedStart}`} | no_field ${plain.state} ${plain.state === 'unavailable' ? plain.reason : `range_zone ${plain.checkedRange?.timeZone} first_at_14_vn ${plain.checkedRange?.start === plainStart}`}`
	)
	if (!ok) fail(1, 'the conflict check did not count the intervals in the input zone')
}

async function caseSettingGuard(pipeline, fx) {
	const before = commandCount(fx.accountId)
	const result = await refusal(
		submit(
			pipeline,
			fx.accountId,
			moveSeries(fx, fx.main, { from: fx.from, weekday: 3, startTime: '14:00', inputTimeZone: MSK }, MSK)
		)
	)
	const after = commandCount(fx.accountId)
	console.log(`case 2 expectedDefaultTimeZone differs from the setting: ${result} command_rows ${before}->${after}`)
	if (result !== 'default_time_zone_changed' || after !== before)
		fail(2, 'a command with a stale expectedDefaultTimeZone was not refused before the journal')
}

function gapDate(from) {
	for (let offset = 0; offset <= 366; offset += 1) {
		const date = core.addDays(from, offset)
		if (core.localTimeCandidates(date, '02:30', BERLIN).length === 0) return date
	}
	return null
}

async function caseNonexistent(pipeline, fx) {
	const date = gapDate(fx.from)
	if (!date) fail(3, 'no Berlin date without 02:30 within a year')
	const before = commandCount(fx.accountId)
	const result = await refusal(
		submit(
			pipeline,
			fx.accountId,
			moveSeries(fx, fx.main, {
				from: fx.from,
				weekday: core.weekdayOf(date),
				startTime: '02:30',
				newStartsOn: date,
				inputTimeZone: BERLIN,
			})
		)
	)
	const after = commandCount(fx.accountId)
	console.log(
		`case 3 nonexistent local time in the input zone: gap_weekday ${core.weekdayOf(date)} ${result} command_rows ${before}->${after}`
	)
	if (result !== 'nonexistent_local_time' || after !== before)
		fail(3, 'a nonexistent local time in the input zone was not refused before the journal')
}

async function caseNamedZone(pipeline, fx) {
	const series = new Set(cardSeries(fx.card.id))
	await run(
		pipeline,
		fx.accountId,
		moveSeries(fx, fx.main, { from: fx.from, weekday: 3, startTime: '14:00', inputTimeZone: MSK }),
		4
	)
	const created = cardSeries(fx.card.id).find((id) => !series.has(id))
	const fresh = created ? seriesRow(created) : null
	const old = seriesRow(fx.main)
	const first = fresh ? core.zonedInstant(fresh.starts_on, fresh.start_time, fresh.time_zone) : null
	const firstVn = first ? core.zonedParts(first, VN) : null
	const masterEvent = created ? mappingEvent(created, 'series') : null
	const master = masterEvent ? pipeline.stub.events.get(masterEvent) : null
	const setting = teacherSetting(fx.accountId)
	const ok =
		fresh?.time_zone === MSK &&
		fresh.start_time === '14:00' &&
		Number(fresh.weekday) === 3 &&
		fresh.starts_on === core.firstOnOrAfter(fx.from, 3) &&
		firstVn?.time === '18:00' &&
		firstVn.date === fresh.starts_on &&
		master?.start?.timeZone === MSK &&
		core.sameTimeZone(old.time_zone, VN) &&
		old.start_time === '12:00' &&
		old.ends_on === core.addDays(fx.from, -1) &&
		occurrenceMark(fx.main, fx.doneOn) === 'done' &&
		setting === fx.setting
	console.log(
		`case 4 move with inputTimeZone MSK: new_zone ${fresh?.time_zone} new_time ${fresh?.start_time} new_weekday ${fresh?.weekday} first_vn ${firstVn?.time} google_zone ${master?.start?.timeZone} old_zone ${old.time_zone} old_ends_before_cut ${old.ends_on === core.addDays(fx.from, -1)} done_on_old_key ${occurrenceMark(fx.main, fx.doneOn)} teacher_setting_same ${setting === fx.setting}`
	)
	if (!ok) fail(4, 'the series did not move into the input zone or the old series and the setting changed')
	await project(pipeline, fx, masterEvent)
	return { id: created, startsOn: fresh.starts_on }
}

async function caseDefaultZone(pipeline, fx, moved) {
	const series = new Set(cardSeries(fx.card.id))
	await run(
		pipeline,
		fx.accountId,
		moveSeries(fx, moved.id, { from: moved.startsOn, weekday: 3, startTime: '14:00' }),
		5
	)
	const created = cardSeries(fx.card.id).find((id) => !series.has(id))
	const fresh = created ? seriesRow(created) : null
	const old = seriesRow(moved.id)
	const first = fresh ? core.zonedInstant(fresh.starts_on, fresh.start_time, fresh.time_zone) : null
	const firstVn = first ? core.zonedParts(first, VN) : null
	const setting = teacherSetting(fx.accountId)
	const ok =
		fresh &&
		core.sameTimeZone(fresh.time_zone, VN) &&
		fresh.start_time === '14:00' &&
		fresh.starts_on === moved.startsOn &&
		firstVn?.time === '14:00' &&
		old.time_zone === MSK &&
		old.ends_on < old.starts_on &&
		setting === fx.setting
	console.log(
		`case 5 same move without inputTimeZone from the MSK series: new_zone ${fresh?.time_zone} new_time ${fresh?.start_time} first_vn ${firstVn?.time} msk_series_emptied ${old.ends_on < old.starts_on} teacher_setting_same ${setting === fx.setting}`
	)
	if (!ok) fail(5, 'without inputTimeZone the new series is not in the teacher zone')
}

async function sectionZone(pipeline) {
	const fx = await zoneFixtures(pipeline)
	await caseConflicts(pipeline, fx)
	await caseSettingGuard(pipeline, fx)
	await caseNonexistent(pipeline, fx)
	const moved = await caseNamedZone(pipeline, fx)
	await caseDefaultZone(pipeline, fx, moved)
	return 'CHAT_BULK_ZONE_OK'
}

const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
let restoreZone = null

function freshAt(fx) {
	rows(
		`update google_sync_state set last_full_at = now(), last_incremental_at = now(), issue = null where connection_id = ${quote(fx.connection.id)}`
	)
}

function setTeacherZone(fx, zone) {
	if (restoreZone === null) restoreZone = { accountId: fx.accountId, zone: fx.setting }
	rows(`update teacher_settings set default_time_zone = ${quote(zone)} where account_id = ${quote(fx.accountId)}`)
}

function restoreTeacherZone() {
	if (restoreZone === null || restoreZone.zone === null) return
	rows(
		`update teacher_settings set default_time_zone = ${quote(restoreZone.zone)} where account_id = ${quote(restoreZone.accountId)}`
	)
}

function bulkCard(n) {
	const [row] = rows(
		`insert into students (display_name, status, import_key) values (${quote(`Alex Example ${n}`)}, 'active', ${quote(`${KEY_PREFIX}${n}-${randomUUID()}`)}) returning id`
	)
	return { id: row.id, name: `Alex Example ${n}` }
}

async function chatFixtures(pipeline) {
	purgeCard()
	const [connection] = rows(
		`select id, account_id, calendar_id from google_connections where calendar_id like '${SYNTHETIC_CALENDAR_ID}%' and retired_at is null`
	)
	const accountId = connection.account_id
	const setting = teacherSetting(accountId)
	const zone = setting ?? VN
	if (!core.sameTimeZone(zone, VN)) fail(0, `the test teacher zone is ${zone}, expected ${VN}`)
	const today = core.scheduleToday(new Date(), zone)
	const next = core.firstOnOrAfter(core.addDays(today, 1), 2)
	const target = { accountId, connectionId: connection.id, calendarId: connection.calendar_id }
	const conversation = await createConversation(pipeline.app.db, accountId)
	conversations.push(conversation.id)
	return { connection, accountId, zone, setting, today, next, target, conversationId: conversation.id }
}

async function createLessons(pipeline, fx, student, startsOn, repeats, time = '16:00') {
	const kind = repeats === 'weekly' ? 'series' : 'single'
	const table = kind === 'series' ? 'lesson_series' : 'lessons'
	const listed = () => rows(`select id from ${table} where student_id = ${quote(student.id)}`).map((row) => row.id)
	const before = new Set(listed())
	await run(
		pipeline,
		fx.accountId,
		{
			operation: 'create',
			input: {
				studentId: student.id,
				date: startsOn,
				startTime: time,
				durationMinutes: 60,
				repeats,
				expectedDefaultTimeZone: fx.zone,
				requestId: randomUUID(),
				expectedVersion: 'fixture-version',
			},
		},
		0
	)
	const id = listed().find((item) => !before.has(item))
	if (!id) fail(0, `the fixture ${kind} was not created`)
	await project(pipeline, fx, mappingEvent(id, kind))
	freshAt(fx)
	return id
}

function chatContext(fx, extra = {}) {
	return { accountId: fx.accountId, now: new Date(), defaultTimeZone: fx.zone, calendarEnabled: true, ...extra }
}

function actionCount(messageId) {
	return rows(`select count(*)::int as n from chat_actions where message_id = ${quote(messageId)}`)[0].n
}

async function askBulk(pipeline, fx, student, text, input, extra = {}) {
	const db = pipeline.app.db
	const teacher = await insertMessage(db, {
		accountId: fx.accountId,
		conversationId: fx.conversationId,
		role: 'teacher',
		body: `@${student.name} ${text}`,
		mentions: [{ studentId: student.id, text: student.name, start: 1, end: 1 + student.name.length }],
	})
	const persist = async (executor, block) => {
		await insertMessage(executor, {
			accountId: fx.accountId,
			conversationId: fx.conversationId,
			role: 'assistant',
			body: '',
			blocks: [block],
			replyTo: teacher.id,
		})
	}
	const outcome = await runTool(
		{
			db,
			chat: chatContext(fx, extra),
			source: { conversationId: fx.conversationId, messageId: teacher.id },
			persist,
			issued: new Map(),
			shown: new Set(),
		},
		'propose_bulk_move',
		{ student_id: student.id, time_zone: null, from: null, ...input }
	)
	if (outcome.block !== null && !chatBlock.safeParse(outcome.block).success)
		fail('shape', 'the proposal block does not match the contract')
	return { ...outcome, messageId: teacher.id, change: outcome.block?.change ?? null }
}

function refusedWith(outcome, code) {
	return outcome.isError === true && outcome.block === null && outcome.content.includes(code)
}

async function anchorOf(pipeline, fx, seriesId) {
	const row = rows(
		`select id, student_id, weekday, time_zone, to_char(start_time, 'HH24:MI') as start_time, duration_minutes, starts_on::text as starts_on, ends_on::text as ends_on from lesson_series where id = ${quote(seriesId)}`
	)[0]
	const rule = {
		id: row.id,
		studentId: row.student_id,
		weekday: Number(row.weekday),
		startTime: row.start_time,
		timeZone: row.time_zone,
		durationMinutes: Number(row.duration_minutes),
		startsOn: row.starts_on,
		endsOn: row.ends_on,
	}
	return seriesAnchor(pipeline.app.db, rule, fx.connection.id)
}

const moves = (fromDay, fromTime, toDay, toTime) => ({
	from_weekday: WEEKDAY_NAMES[fromDay - 1],
	from_time: fromTime,
	to_weekday: WEEKDAY_NAMES[toDay - 1],
	to_time: toTime,
})

async function proposalFixtures(pipeline) {
	const fx = await chatFixtures(pipeline)
	const main = bulkCard(2380)
	const singles = bulkCard(2381)
	const marked = bulkCard(2382)
	const mainSeries = await createLessons(pipeline, fx, main, fx.next, 'weekly')
	await createLessons(pipeline, fx, singles, fx.next, 'weekly')
	await createLessons(pipeline, fx, singles, core.addDays(fx.next, 7), 'once')
	const markedStart = core.addDays(fx.next, -21)
	const markedSeries = await createLessons(pipeline, fx, marked, markedStart, 'weekly')
	let lastMarked = null
	for (let date = markedStart; date < fx.next; date = core.addDays(date, 7)) {
		if (core.zonedInstant(date, '16:00', VN).getTime() >= Date.now()) break
		const result = await markOccurrence(pipeline.app.db, fx.accountId, markedSeries, date, { kind: 'done' }, new Date())
		if (result.kind !== 'ok') fail(0, `mark done refused with ${result.kind}`)
		lastMarked = date
	}
	if (lastMarked === null) fail(0, 'no started occurrence to mark')
	console.log(
		`FIXTURES cards 3 series ${hash(mainSeries)} ${hash(markedSeries)} next_tuesday ${fx.next} last_marked ${lastMarked} zone ${fx.zone}`
	)
	return { ...fx, main, singles, marked, mainSeries, markedSeries, lastMarked }
}

async function caseNamedProposal(pipeline, fx) {
	const before = commandCount(fx.accountId)
	const asked = await askBulk(pipeline, fx, fx.main, 'перенеси все уроки со вторника 12:00 на среду 14:00 MSK', {
		...moves(2, '12:00', 3, '14:00'),
		time_zone: 'MSK',
	})
	const change = asked.change
	const target = change?.targets?.[0]
	const expectedNow = target ? core.zonedInstant(core.firstOnOrAfter(target.from, 3), '14:00', MSK).toISOString() : null
	const expectedWas = target ? core.zonedInstant(target.from, '16:00', VN).toISOString() : null
	const ok =
		asked.block?.type === 'change_proposal' &&
		asked.block.state === 'proposed' &&
		change.operation === 'bulk_move' &&
		change.targets.length === 1 &&
		target.seriesId === fx.mainSeries &&
		target.state === 'planned' &&
		change.inputTimeZone === MSK &&
		change.zoneNamed === true &&
		target.nowStartsAt === expectedNow &&
		target.wasStartsAt === expectedWas &&
		target.from === fx.next &&
		change.singlesLeft === 0 &&
		actionCount(asked.messageId) === 1 &&
		commandCount(fx.accountId) === before
	console.log(
		`case 1 tuesday 12:00 to wednesday 14:00 MSK: targets ${change?.targets?.length} input_zone ${change?.inputTimeZone} named ${change?.zoneNamed} now_is_wednesday_14_msk ${target?.nowStartsAt === expectedNow} was_is_tuesday_16_vn ${target?.wasStartsAt === expectedWas} from_next_tuesday ${target?.from === fx.next} commands ${before}->${commandCount(fx.accountId)}`
	)
	if (!ok) fail(1, 'the named MSK proposal is wrong')
	const action = rows(`select kind, state, target from chat_actions where message_id = ${quote(asked.messageId)}`)[0]
	const children = action?.target?.children ?? []
	const sealed =
		action?.kind === 'change' &&
		action.state === 'proposed' &&
		children.length === 1 &&
		children[0].seriesId === fx.mainSeries &&
		children[0].from === fx.next &&
		children[0].weekday === 3 &&
		children[0].startTime === '14:00' &&
		action.target.inputTimeZone === MSK &&
		typeof children[0].requestId === 'string' &&
		rows(`select count(*)::int as n from google_commands where request_id = ${quote(children[0].requestId)}`)[0].n === 0
	console.log(
		`case 2 sealed target: kind ${action?.kind} state ${action?.state} children ${children.length} request_id_stored ${typeof children[0]?.requestId === 'string'} command_for_request 0`
	)
	if (!sealed) fail(2, 'the sealed target does not hold the child command')
}

async function caseUnnamedZone(pipeline, fx) {
	setTeacherZone(fx, MSK)
	const before = commandCount(fx.accountId)
	const asked = await askBulk(
		pipeline,
		fx,
		fx.main,
		'move all lessons from Tuesday 16:00 to Wednesday 18:00',
		moves(2, '16:00', 3, '18:00'),
		{ defaultTimeZone: MSK }
	)
	restoreTeacherZone()
	const change = asked.change
	const target = change?.targets?.[0]
	const expectedNow = target ? core.zonedInstant(core.firstOnOrAfter(target.from, 3), '18:00', VN).toISOString() : null
	const ok =
		change?.operation === 'bulk_move' &&
		change.inputTimeZone === VN &&
		change.zoneNamed === false &&
		change.accountTimeZone === MSK &&
		change.targets.length === 1 &&
		target.nowStartsAt === expectedNow &&
		teacherSetting(fx.accountId) === fx.setting &&
		commandCount(fx.accountId) === before
	console.log(
		`case 3 no zone named, teacher setting MSK: input_zone ${change?.inputTimeZone} named ${change?.zoneNamed} account_zone ${change?.accountTimeZone} now_is_wednesday_18_vn ${target?.nowStartsAt === expectedNow} setting_restored ${teacherSetting(fx.accountId) === fx.setting}`
	)
	if (!ok) fail(3, 'without a named zone the input zone is not Vietnam')
}

async function caseRefusals(pipeline, fx) {
	const before = commandCount(fx.accountId)
	const none = await askBulk(
		pipeline,
		fx,
		fx.main,
		'move all lessons from Monday 10:00 to Wednesday 14:00',
		moves(1, '10:00', 3, '14:00')
	)
	const unknown = await askBulk(pipeline, fx, fx.main, 'move all lessons from Tuesday 12:00 to Wednesday 14:00 XYZ', {
		...moves(2, '12:00', 3, '14:00'),
		time_zone: 'XYZ',
	})
	const absent = await askBulk(pipeline, fx, fx.main, 'move all lessons from Tuesday 12:00 to Wednesday 14:00', {
		...moves(2, '12:00', 3, '14:00'),
		time_zone: 'Europe/Berlin',
	})
	const ok =
		refusedWith(none, 'no_matching_lessons') &&
		actionCount(none.messageId) === 0 &&
		refusedWith(unknown, 'zone_unknown') &&
		actionCount(unknown.messageId) === 0 &&
		refusedWith(absent, 'zone_not_in_message') &&
		actionCount(absent.messageId) === 0 &&
		commandCount(fx.accountId) === before
	console.log(
		`case 4 refusals: zero_matches ${none.content} unknown_zone ${unknown.content} zone_not_in_text ${absent.content} actions ${actionCount(none.messageId) + actionCount(unknown.messageId) + actionCount(absent.messageId)} commands ${before}->${commandCount(fx.accountId)}`
	)
	if (!ok) fail(4, 'a refusal produced a proposal or an action')
}

async function caseSingles(pipeline, fx) {
	const asked = await askBulk(
		pipeline,
		fx,
		fx.singles,
		'move all lessons from Tuesday 16:00 to Wednesday 18:00',
		moves(2, '16:00', 3, '18:00')
	)
	const change = asked.change
	const ok = change?.operation === 'bulk_move' && change.targets.length === 1 && change.singlesLeft === 1
	console.log(
		`case 5 single lesson at the same time: targets ${change?.targets?.length} singles_left ${change?.singlesLeft}`
	)
	if (!ok) fail(5, 'the single lesson at the same time is not counted or is moved')
}

async function caseMarked(pipeline, fx) {
	const anchor = await anchorOf(pipeline, fx, fx.markedSeries)
	const asked = await askBulk(
		pipeline,
		fx,
		fx.marked,
		'move all lessons from Tuesday 16:00 to Wednesday 18:00',
		moves(2, '16:00', 3, '18:00')
	)
	const target = asked.change?.targets?.[0]
	const early = await askBulk(
		pipeline,
		fx,
		fx.marked,
		`move all lessons from Tuesday 16:00 to Wednesday 18:00 from ${fx.lastMarked}`,
		{ ...moves(2, '16:00', 3, '18:00'), from: fx.lastMarked }
	)
	const ok =
		target !== undefined &&
		anchor !== null &&
		target.from === anchor &&
		target.from > fx.lastMarked &&
		refusedWith(early, 'series_marked') &&
		actionCount(early.messageId) === 0
	console.log(
		`case 6 marked occurrence: from_is_all_from ${target?.from === anchor} after_last_mark ${target ? target.from > fx.lastMarked : false} explicit_marked_from ${early.content}`
	)
	if (!ok) fail(6, 'the marked occurrence is inside the move or an earlier from was accepted')
}

async function sectionProposal(pipeline) {
	const fx = await proposalFixtures(pipeline)
	const before = commandCount(fx.accountId)
	await caseNamedProposal(pipeline, fx)
	await caseUnnamedZone(pipeline, fx)
	await caseRefusals(pipeline, fx)
	await caseSingles(pipeline, fx)
	await caseMarked(pipeline, fx)
	const after = commandCount(fx.accountId)
	console.log(`case 7 commands in the journal before confirm: ${before}->${after}`)
	if (after !== before) fail(7, 'a proposal sent a command')
	return 'CHAT_BULK_PROPOSAL_OK'
}

let pipeline = null
let exitCode = 0
let marker = null
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
	if (section === 'zone') marker = await sectionZone(pipeline)
	if (section === 'proposal') marker = await sectionProposal(pipeline)
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`CHAT_BULK_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
	exitCode = 1
} finally {
	if (pipeline) await pipeline.close()
	try {
		restoreTeacherZone()
		purgeChats()
		seed('down', TARGET)
		purgeCard()
	} catch (error) {
		console.log(`cleanup failed: ${error instanceof Error ? error.message : 'unexpected failure'}`)
		exitCode = 1
	}
}
if (exitCode === 0 && marker) console.log(marker)
process.exit(exitCode)
