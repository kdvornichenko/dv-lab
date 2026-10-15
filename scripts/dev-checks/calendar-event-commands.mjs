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
if (process.env.CALENDAR_EVENT_COMMANDS_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, CALENDAR_EVENT_COMMANDS_OFFLINE: '1' } }
	)
	process.exit(child.status ?? 1)
}

const core = await import(`${ROOT}/packages/core/src/index.ts`)
const { createDb, resolveDatabaseUrl, googleCommandStages } = await import(`${ROOT}/packages/db/src/index.ts`)
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
const { failUnsentCommand, readCommand, digest } = await import(`${ROOT}/apps/api/src/calendar/journal.ts`)
const { upsertEventFacts } = await import(`${ROOT}/apps/api/src/calendar/projection.ts`)
const { prepareEventCommand, readEventDetails } = await import(`${ROOT}/apps/api/src/calendar/event-commands.ts`)
const { eventVersion, opaqueVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)

const CARD_NAME = 'Alex Example 0003'
const CARD_KEY = 'calendar-event-commands:alex-example-0003'
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
const stamp = (date) => date.toISOString().replace('.000Z', 'Z').replaceAll('-', '').replaceAll(':', '')
const latency = () => new Promise((done) => setTimeout(done, 500))

function fail(check, message) {
	throw new Error(`check ${check}: ${message}`)
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

function localClock(instant, zone) {
	return core.zonedParts(instant, zone).time
}

function createStub() {
	const events = new Map()
	const modified = new Set()
	const calls = { patch: [], insert: [], observe: 0 }
	let counter = 0
	const etag = () => `"event-check-${Date.now()}-${(counter += 1)}"`
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
		const clock = localClock(first, zone)
		const list = []
		for (const [id, resource] of events) if (resource.recurringEventId === master.id) events.delete(id)
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
			list.push(instance)
		}
		return list
	}
	return {
		events,
		modified,
		calls,
		instances,
		async refresh() {
			return { access_token: `synthetic-access-${randomUUID()}`, expiry_date: Date.now() + 3600000 }
		},
		async primary() {
			throw new Error('primary calendar lookup is not expected')
		},
		async insert(_token, _calendarId, request, timeZone, generation) {
			calls.insert.push(request.eventId)
			const body = insertEventBody(request)
			const resource = googleTimes(
				clean({ ...body, id: request.eventId, etag: etag(), status: 'confirmed', eventType: 'default' }),
				timeZone
			)
			events.set(resource.id, resource)
			if (resource.recurrence?.length && request.payload.markers.entityKind === 'series') instances(resource)
			await latency()
			return {
				...verifyGoogleResult(structuredClone(resource), request, timeZone, generation, 200),
				recoveryIssue: null,
			}
		},
		async confirmedEvent(_token, _calendarId, request, timeZone, generation) {
			return { ...verifyGoogleResult(read(request.eventId), request, timeZone, generation, 200), recoveryIssue: null }
		},
		async observeEvent(_token, _calendarId, eventId, timeZone) {
			calls.observe += 1
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
			modified.add(updated.id)
			await latency()
			const response = request.payload.status === 'cancelled' ? { id: updated.id } : structuredClone(updated)
			return verifyGoogleResult(response, request, timeZone, generation, 200, true)
		},
	}
}

function resourceOf(row) {
	const resource = {
		id: row.event_id,
		etag: row.etag,
		status: row.status,
		eventType: row.event_type,
		transparency: row.transparency,
		summary: row.summary,
		start: row.start,
		end: row.end,
		...(row.recurring_event_id ? { recurringEventId: row.recurring_event_id } : {}),
		...(row.original_start ? { originalStartTime: row.original_start } : {}),
		...(row.color_id ? { colorId: row.color_id } : {}),
		...(row.description ? { description: row.description } : {}),
		...(row.location ? { location: row.location } : {}),
	}
	if (row.row_kind === 'master') {
		const weekday = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][(row.recurrence_weekday ?? 3) - 1]
		resource.recurrence =
			row.recurrence_kind === 'weekly'
				? [`RRULE:FREQ=WEEKLY;BYDAY=${weekday}`]
				: [`RRULE:FREQ=WEEKLY;INTERVAL=${row.recurrence_interval ?? 2};BYDAY=${weekday}`]
	}
	return resource
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
		`select event_id, event_key, etag, status, row_kind, color_id, location, description, starts_at, ends_at,
recurrence_kind, recurrence_weekday from google_calendar_events
where connection_id = ${quote(connectionId)} and event_id = ${quote(eventId)}`
	)
	return row
}

function revision(connectionId) {
	const [row] = rows(
		`select revision::text as revision from google_sync_state where connection_id = ${quote(connectionId)}`
	)
	return BigInt(row.revision)
}

function versionOf(connectionId, eventId) {
	const row = projection(connectionId, eventId)
	return eventVersion({ eventId: row.event_id, etag: row.etag })
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

async function dispatch(pipeline, accountId, commandId) {
	const access = await pipeline.credentials.accessToken(accountId)
	const command = await readCommand(pipeline.app.db, accountId, commandId)
	await dispatchCommand(access, command, pipeline.stub)
	return readCommand(pipeline.app.db, accountId, commandId)
}

async function submitAndDispatch(pipeline, context, command, check) {
	const scope = `${command.operation}${command.input.scope ? ` ${command.input.scope}` : ''}`
	try {
		const receipt = await pipeline.commands.submitCalendarCommand({ ...context, now: new Date() }, command)
		const finished = await dispatch(pipeline, context.accountId, receipt.commandId)
		if (finished.state !== 'applied') fail(check, `${scope} ended ${finished.state} with ${finished.issue}`)
		return finished
	} catch (error) {
		if (String(error?.message).startsWith('check ')) throw error
		fail(check, `${scope} refused with ${error?.code ?? 'unexpected'}`)
	}
}

function prepareOnly(pipeline, context, command) {
	return pipeline.app.db.transaction((tx) => prepareEventCommand(tx, command, { ...context, now: new Date() }))
}

function mappingEvent(localId, kind) {
	const [row] = rows(
		`select event_id from google_event_mappings where local_entity_id = ${quote(localId)} and entity_kind = ${quote(kind)} and state = 'active'`
	)
	return row?.event_id
}

function weeklyRecurrence(series) {
	return {
		recurrenceKind: 'weekly',
		recurrenceWeekday: Number(series.weekday),
		recurrenceFrequency: 'weekly',
		recurrenceInterval: 1,
		recurrenceUntil: null,
	}
}

async function lessonFixtures(pipeline, monday) {
	purgeCard()
	const [connection] = rows(
		`select id, account_id, calendar_id from google_connections where calendar_id like '${SYNTHETIC_CALENDAR_ID}%' and retired_at is null`
	)
	const [{ zone }] = rows(
		`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(connection.account_id)}), 'Asia/Ho_Chi_Minh') as zone`
	)
	const [card] = rows(
		`insert into students (display_name, status, import_key) values (${quote(CARD_NAME)}, 'active', ${quote(CARD_KEY)}) returning id`
	)
	const context = { accountId: connection.account_id }
	const create = (date, repeats) => ({
		operation: 'create',
		input: {
			studentId: card.id,
			date,
			startTime: '18:00',
			durationMinutes: 60,
			repeats,
			expectedDefaultTimeZone: zone,
			requestId: randomUUID(),
			expectedVersion: 'fixture-version',
		},
	})
	await submitAndDispatch(pipeline, context, create(core.addDays(monday, 8), 'once'), 0)
	await submitAndDispatch(pipeline, context, create(core.addDays(monday, 9), 'weekly'), 0)
	await submitAndDispatch(pipeline, context, create(core.addDays(monday, 10), 'weekly'), 0)
	const [single] = rows(`select id from lessons where student_id = ${quote(card.id)}`)
	const series = rows(
		`select id, weekday, starts_on::text as starts_on, start_time, time_zone from lesson_series
where student_id = ${quote(card.id)} order by starts_on`
	)
	const target = { accountId: connection.account_id, connectionId: connection.id, calendarId: connection.calendar_id }
	const masters = series.map((item) => mappingEvent(item.id, 'series'))
	const facts = []
	for (const [index, item] of series.entries()) {
		const list = [...pipeline.stub.events.values()].filter((event) => event.recurringEventId === masters[index])
		facts.push(...list.map(resourceFact), {
			eventId: masters[index],
			status: 'confirmed',
			master: true,
			recurrence: weeklyRecurrence(item),
			factAt: new Date(),
		})
	}
	await pipeline.app.db.transaction((tx) => upsertEventFacts(tx, target, facts))
	console.log(
		`FIXTURES single ${hash(single.id)} series ${series.length} masters ${masters.map(hash).join(' ')} card ${hash(card.id)} monday ${monday}`
	)
	return {
		connection,
		zone,
		card,
		context,
		target,
		single,
		singleEvent: mappingEvent(single.id, 'single'),
		seriesA: series[0],
		masterA: masters[0],
		seriesB: series[1],
		masterB: masters[1],
	}
}

function loadEventResources(pipeline, connectionId) {
	const list = rows(
		`select event_id, etag, status, event_type, transparency, summary, start, "end", recurring_event_id, original_start,
color_id, description, location, row_kind, recurrence_kind, recurrence_weekday, recurrence_interval
from google_calendar_events where connection_id = ${quote(connectionId)} and event_id like 'dvseed%'`
	)
	for (const row of list) pipeline.stub.events.set(row.event_id, resourceOf(row))
	return list.length
}

function seededInstances(connectionId, masterId) {
	return rows(
		`select event_id, event_key, etag, starts_at from google_calendar_events
where connection_id = ${quote(connectionId)} and recurring_event_id = ${quote(masterId)} order by starts_at`
	)
}

function keyOf(connectionId, eventId) {
	return opaqueVersion([connectionId, eventId])
}

async function admissionCases(pipeline, fx) {
	const { connection, context, zone } = fx
	const week = seededInstances(connection.id, 'dvseed12')
	const [previous, current, next] = week
	const master = projection(connection.id, 'dvseed12')
	const update = (eventId, scope, changes, version = versionOf(connection.id, eventId)) => ({
		operation: 'event_update',
		eventKey: keyOf(connection.id, eventId),
		input: { requestId: randomUUID(), expectedVersion: version, scope, changes },
	})
	const remove = (eventId, scope, version = versionOf(connection.id, eventId)) => ({
		operation: 'event_delete',
		eventKey: keyOf(connection.id, eventId),
		input: { requestId: randomUUID(), expectedVersion: version, scope },
	})
	const create = (repeats) => ({
		operation: 'event_create',
		input: {
			requestId: randomUUID(),
			expectedVersion: 'create-version',
			title: 'Synthetic event 31',
			date: core.addDays(fx.monday, 3),
			startTime: '10:00',
			durationMinutes: 45,
			repeats,
			colorId: '5',
			description: 'Synthetic description 31',
			location: 'Synthetic room 31',
			expectedDefaultTimeZone: zone,
		},
	})

	const once = await prepareOnly(pipeline, context, create('once'))
	const weekly = await prepareOnly(pipeline, context, create('weekly'))
	const payloadOk = (request) =>
		request.method === 'insert' &&
		request.payload.summary === 'Synthetic event 31' &&
		request.payload.colorId === '5' &&
		request.payload.location === 'Synthetic room 31' &&
		request.payload.description === 'Synthetic description 31' &&
		request.payload.markers.entityKind === 'event' &&
		request.payload.start.timeZone === zone &&
		Date.parse(request.payload.end.dateTime) - Date.parse(request.payload.start.dateTime) === 45 * 60000 &&
		insertEventBody(request).extendedProperties.private.dvKind === 'event'
	const weekday = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][core.weekdayOf(core.addDays(fx.monday, 3)) - 1]
	const createOk =
		payloadOk(once.prepared.request) &&
		!once.prepared.request.payload.recurrence &&
		payloadOk(weekly.prepared.request) &&
		weekly.prepared.request.payload.recurrence?.[0] === `RRULE:FREQ=WEEKLY;BYDAY=${weekday}`
	console.log(
		`check 1 create: once ${once.prepared.operation} ${hash(JSON.stringify(once.prepared.request))} weekly ${hash(JSON.stringify(weekly.prepared.request))} payload ${createOk}`
	)
	if (!createOk) fail(1, 'event_create payload is wrong')

	const one = await prepareOnly(pipeline, context, update(next.event_id, 'one', { colorId: '4' }))
	const following = await prepareOnly(
		pipeline,
		context,
		update(next.event_id, 'following', { title: 'Synthetic event 32' })
	)
	const all = await prepareOnly(pipeline, context, update(next.event_id, 'all', { colorId: '2' }))
	const toWeekly = await prepareOnly(pipeline, context, update('dvseed06', 'one', { repeats: 'weekly' }))
	const scopeOk =
		one.prepared.request.eventId === next.event_id &&
		one.prepared.request.ifMatch === next.etag &&
		one.prepared.request.instance?.masterEventId === 'dvseed12' &&
		one.prepared.request.instance?.lookupVerified === true &&
		following.prepared.request.eventId === 'dvseed12' &&
		following.prepared.request.ifMatch === master.etag &&
		/UNTIL=/.test(following.prepared.request.payload.recurrence?.[0] ?? '') &&
		following.companion?.method === 'insert' &&
		following.companion.payload.summary === 'Synthetic event 32' &&
		following.companion.payload.colorId === '9' &&
		following.companion.payload.markers.stage === 2 &&
		all.prepared.request.eventId === 'dvseed12' &&
		all.prepared.request.ifMatch === master.etag &&
		all.prepared.request.payload.colorId === '2' &&
		/BYDAY=/.test(toWeekly.prepared.request.payload.recurrence?.[0] ?? '')
	console.log(
		`check 2 update scopes: one patch(instance) ${hash(JSON.stringify(one.prepared.request))} following trim+create_master ${hash(JSON.stringify(following.prepared.request))}/${hash(JSON.stringify(following.companion))} all patch(master) ${hash(JSON.stringify(all.prepared.request))} once_to_weekly ${Boolean(toWeekly.prepared.request.payload.recurrence)} expected ${scopeOk}`
	)
	if (!scopeOk) fail(2, 'update scopes build the wrong Google requests')

	const delOne = await prepareOnly(pipeline, context, remove(current.event_id, 'one'))
	const delFollowing = await prepareOnly(pipeline, context, remove(next.event_id, 'following'))
	const delAll = await prepareOnly(pipeline, context, remove(previous.event_id, 'all'))
	const deleteOk =
		delOne.prepared.request.payload.status === 'cancelled' &&
		delOne.prepared.request.eventId === current.event_id &&
		delFollowing.prepared.request.eventId === 'dvseed12' &&
		/UNTIL=/.test(delFollowing.prepared.request.payload.recurrence?.[0] ?? '') &&
		delFollowing.companion === null &&
		delAll.prepared.request.eventId === 'dvseed12' &&
		delAll.prepared.request.payload.status === 'cancelled'
	console.log(
		`check 3 delete scopes: one ${hash(JSON.stringify(delOne.prepared.request))} following ${hash(JSON.stringify(delFollowing.prepared.request))} all ${hash(JSON.stringify(delAll.prepared.request))} expected ${deleteOk}`
	)
	if (!deleteOk) fail(3, 'delete scopes build the wrong Google requests')

	const other = seededInstances(connection.id, 'dvseed13')[0]
	const singleRow = projection(connection.id, fx.singleEvent)
	const boundInstance = seededInstances(connection.id, fx.masterA)[1]
	const refusals = {
		stale: await refusal(prepareOnly(pipeline, context, update('dvseed06', 'one', { colorId: '3' }, 'stale'))),
		focus: await refusal(prepareOnly(pipeline, context, update('dvseed14', 'one', { colorId: '3' }))),
		otherFollowing: await refusal(
			prepareOnly(pipeline, context, update(other.event_id, 'following', { startTime: '16:00' }))
		),
		otherField: await refusal(
			prepareOnly(pipeline, context, update(other.event_id, 'one', { title: 'Synthetic event 33' }))
		),
		otherTime: await refusal(prepareOnly(pipeline, context, update(other.event_id, 'one', { startTime: '16:00' }))),
		allDayUpdate: await refusal(prepareOnly(pipeline, context, update('dvseed10', 'one', { colorId: '3' }))),
		allDayDelete: await refusal(prepareOnly(pipeline, context, remove('dvseed10', 'one'))),
		allDayFollowing: await refusal(prepareOnly(pipeline, context, remove('dvseed10', 'following'))),
	}
	const bound = []
	for (const eventId of [singleRow.event_id, boundInstance.event_id])
		for (const scope of ['one', 'following', 'all']) {
			bound.push(await refusal(prepareOnly(pipeline, context, update(eventId, scope, { colorId: '3' }))))
			bound.push(await refusal(prepareOnly(pipeline, context, remove(eventId, scope))))
		}
	const refusalOk =
		refusals.stale === 'precondition_failed' &&
		refusals.focus === 'read_only_event' &&
		refusals.otherFollowing === 'unsupported_recurrence' &&
		refusals.otherField === 'unsupported_recurrence' &&
		refusals.otherTime === 'accepted' &&
		refusals.allDayUpdate === 'read_only_event' &&
		refusals.allDayDelete === 'accepted' &&
		refusals.allDayFollowing === 'read_only_event' &&
		bound.length === 12 &&
		bound.every((code) => code === 'invalid_request')
	console.log(
		`check 4 refusals: ${Object.entries(refusals)
			.map(([key, value]) => `${key} ${value}`)
			.join(
				', '
			)}; bound lesson rows ${bound.filter((code) => code === 'invalid_request').length}/12 invalid_request; expected ${refusalOk}`
	)
	if (!refusalOk) fail(4, 'event admission refusals are wrong')

	const details = async (eventId) =>
		pipeline.app.db.transaction((tx) => readEventDetails(tx, connection.account_id, keyOf(connection.id, eventId)))
	const weeklyDetails = await details(next.event_id)
	const otherDetails = await details(other.event_id)
	const allDayDetails = await details('dvseed10')
	const placeDetails = await details('dvseed15')
	const missing = await pipeline.app.db.transaction((tx) => readEventDetails(tx, connection.account_id, 'missing-key'))
	const detailsOk =
		weeklyDetails?.repeat.kind === 'weekly' &&
		weeklyDetails.repeat.weekday === 3 &&
		weeklyDetails.scopes.edit.join() === 'one,following,all' &&
		weeklyDetails.scopes.delete.join() === 'one,following,all' &&
		weeklyDetails.scopes.reason === null &&
		otherDetails?.repeat.kind === 'other' &&
		otherDetails.repeat.interval === 2 &&
		otherDetails.scopes.edit.join() === 'one' &&
		otherDetails.scopes.reason === 'unsupported_recurrence' &&
		allDayDetails?.repeat.kind === 'once' &&
		allDayDetails.scopes.edit.length === 0 &&
		allDayDetails.scopes.delete.join() === 'one' &&
		placeDetails?.location !== null &&
		placeDetails?.description !== null &&
		placeDetails?.color.id === '6' &&
		missing === null
	console.log(
		`check 5 details: weekly ${weeklyDetails?.repeat.kind}/${weeklyDetails?.scopes.edit.join('|')} other ${otherDetails?.repeat.kind}/${otherDetails?.scopes.edit.join('|')}/${otherDetails?.scopes.reason} all_day ${allDayDetails?.scopes.edit.length}/${allDayDetails?.scopes.delete.join('|')} place_and_description ${placeDetails?.location !== null && placeDetails?.description !== null} missing ${missing === null ? 404 : 'found'} expected ${detailsOk}`
	)
	if (!detailsOk) fail(5, 'event details from SQL are wrong')

	const markedRows = `connection_id = ${quote(connection.id)} and (event_id in ('dvseed12', 'dvseed15') or recurring_event_id = 'dvseed12')`
	const savedMarkers = rows(
		`select event_id, marker_local_id, marker_kind from google_calendar_events where ${markedRows}`
	)
	rows(
		`update google_calendar_events set marker_local_id = ${quote(randomUUID())}, marker_kind = 'series' where connection_id = ${quote(connection.id)} and (event_id = 'dvseed12' or recurring_event_id = 'dvseed12')`
	)
	const staleDetails = await details(next.event_id)
	const staleAdmission = await refusal(prepareOnly(pipeline, context, update(next.event_id, 'one', { colorId: '3' })))
	rows(`begin;
update google_calendar_events set marker_local_id = ${quote(fx.single.id)}, marker_kind = 'single' where connection_id = ${quote(connection.id)} and event_id = 'dvseed15';
update google_event_mappings set state = 'retired', retired_at = now() where local_entity_id = ${quote(fx.single.id)} and event_id = ${quote(fx.singleEvent)} and state = 'active';
commit;`)
	const historyDetails = await details('dvseed15')
	const historyAdmission = await refusal(prepareOnly(pipeline, context, update('dvseed15', 'one', { colorId: '3' })))
	rows(`begin;
update google_event_mappings set state = 'active', retired_at = null where local_entity_id = ${quote(fx.single.id)} and event_id = ${quote(fx.singleEvent)} and state = 'retired';
${savedMarkers
	.map(
		(row) =>
			`update google_calendar_events set marker_local_id = ${row.marker_local_id === null ? 'null' : quote(row.marker_local_id)}, marker_kind = ${row.marker_kind === null ? 'null' : quote(row.marker_kind)} where connection_id = ${quote(connection.id)} and event_id = ${quote(row.event_id)};`
	)
	.join('\n')}
commit;`)
	const markerOk =
		staleDetails?.scopes.edit.join() === 'one,following,all' &&
		staleDetails.scopes.reason === null &&
		staleAdmission === 'accepted' &&
		historyDetails?.scopes.edit.length === 0 &&
		historyDetails.scopes.reason === 'read_only_event' &&
		historyAdmission === 'invalid_request' &&
		mappingEvent(fx.single.id, 'single') === fx.singleEvent
	console.log(
		`check 5b lesson markers: unresolved ${staleDetails?.scopes.edit.join('|')}/${staleAdmission} history_only ${historyDetails?.scopes.reason}/${historyAdmission} expected ${markerOk}`
	)
	if (!markerOk) fail('5b', 'an unresolved lesson marker blocked editing or a resolved one allowed it')
}

function lessonCounts(cardId) {
	const card = quote(cardId)
	const [row] = rows(`select
(select count(*)::int from lessons where student_id = ${card}) as lessons,
(select count(*)::int from lesson_series where student_id = ${card}) as series,
(select count(*)::int from lesson_exceptions where series_id in (select id from lesson_series where student_id = ${card})) as exceptions,
(select count(*)::int from lesson_marks where series_id in (select id from lesson_series where student_id = ${card})) as marks`)
	return row
}

async function lessonCases(pipeline, fx) {
	const { connection, context, zone, card } = fx
	const seriesVersion = (seriesId) => {
		const [mapping] = rows(
			`select id, representation_generation from google_event_mappings where local_entity_id = ${quote(seriesId)} and entity_kind = 'series' and state = 'active'`
		)
		return opaqueVersion([mapping.id, Number(mapping.representation_generation), seriesId])
	}
	const moveSeries = (seriesId, from, startTime, durationMinutes) => ({
		operation: 'move_series',
		seriesId,
		input: {
			from,
			weekday: core.weekdayOf(from),
			startTime,
			...(durationMinutes ? { durationMinutes } : {}),
			expectedDefaultTimeZone: zone,
			requestId: randomUUID(),
			expectedVersion: seriesVersion(seriesId),
		},
	})
	const admitted = async (command) => {
		const receipt = await pipeline.commands.submitCalendarCommand({ ...context, now: new Date() }, command)
		const row = await readCommand(pipeline.app.db, context.accountId, receipt.commandId)
		await failUnsentCommand(pipeline.app.db, receipt.commandId)
		return row
	}

	const resized = await admitted(moveSeries(fx.seriesA.id, fx.seriesA.starts_on, '18:00', 75))
	const resizeRule = resized.plan.newRule
	const seriesResizeOk =
		resized.operation === 'move_series' &&
		resizeRule?.durationMinutes === 75 &&
		resizeRule.startTime === '18:00' &&
		resizeRule.startsOn === fx.seriesA.starts_on &&
		resized.plan.input.durationMinutes === 75
	console.log(
		`check 6 series resize admitted: new_rule_minutes ${resizeRule?.durationMinutes} starts_on_same ${resizeRule?.startsOn === fx.seriesA.starts_on} expected ${seriesResizeOk}`
	)
	if (!seriesResizeOk) fail(6, 'a duration-only move_series was not admitted with the new length')

	const before = lessonCounts(card.id)
	const singleRow = projection(connection.id, fx.singleEvent)
	const [lesson] = rows(`select starts_at from lessons where id = ${quote(fx.single.id)}`)
	const lessonStart = new Date(lesson.starts_at)
	await submitAndDispatch(
		pipeline,
		context,
		{
			operation: 'move',
			ref: { kind: 'single', lessonId: fx.single.id },
			input: {
				date: core.scheduleDate(lessonStart, zone),
				startTime: core.zonedParts(lessonStart, zone).time,
				durationMinutes: 600,
				expectedDefaultTimeZone: zone,
				requestId: randomUUID(),
				expectedVersion: eventVersion({ eventId: singleRow.event_id, etag: singleRow.etag }),
			},
		},
		6
	)
	const [afterSingle] = rows(`select starts_at, duration_minutes from lessons where id = ${quote(fx.single.id)}`)
	const singleOk =
		Number(afterSingle.duration_minutes) === 600 && new Date(afterSingle.starts_at).getTime() === lessonStart.getTime()
	const instance = seededInstances(connection.id, fx.masterA)[1]
	const natural = new Date(instance.starts_at)
	const originalOn = core.scheduleDate(natural, zone)
	await submitAndDispatch(
		pipeline,
		context,
		{
			operation: 'move',
			ref: { kind: 'series', seriesId: fx.seriesA.id, originalOn },
			input: {
				date: originalOn,
				startTime: core.zonedParts(natural, zone).time,
				durationMinutes: 90,
				expectedDefaultTimeZone: zone,
				requestId: randomUUID(),
				expectedVersion: eventVersion({ eventId: instance.event_id, etag: instance.etag }),
			},
		},
		6
	)
	const [exception] = rows(
		`select kind, starts_at, duration_minutes from lesson_exceptions where series_id = ${quote(fx.seriesA.id)} and original_on = ${quote(originalOn)}`
	)
	const occurrenceOk =
		exception?.kind === 'moved' &&
		new Date(exception.starts_at).getTime() === natural.getTime() &&
		Number(exception.duration_minutes) === 90
	const after = lessonCounts(card.id)
	const keptOk =
		after.lessons === before.lessons &&
		after.series === before.series &&
		after.exceptions === before.exceptions + 1 &&
		after.marks === before.marks
	console.log(
		`check 6 lesson resize: single_minutes ${afterSingle.duration_minutes} start_kept ${singleOk} occurrence ${exception?.kind} minutes ${exception?.duration_minutes} natural_start ${occurrenceOk} rows lessons ${before.lessons}->${after.lessons} series ${before.series}->${after.series} exceptions ${before.exceptions}->${after.exceptions} marks ${before.marks}->${after.marks}`
	)
	if (!singleOk || !occurrenceOk || !keptOk) fail(6, 'lesson resize did not reach the lesson rows')

	const seriesB = fx.seriesB
	const pastStart = core.addDays(seriesB.starts_on, -14)
	const startTime = String(seriesB.start_time).slice(0, 5)
	rows(`begin;
update lesson_series set starts_on = ${quote(pastStart)} where id = ${quote(seriesB.id)};
insert into lesson_marks (series_id, original_on, kind) values (${quote(seriesB.id)}, ${quote(pastStart)}, 'done');
commit;`)
	const masterB = pipeline.stub.events.get(fx.masterB)
	const shiftedStart = core.zonedInstant(pastStart, startTime, seriesB.time_zone)
	masterB.start = { dateTime: googleDateTime(shiftedStart, seriesB.time_zone), timeZone: seriesB.time_zone }
	masterB.end = {
		dateTime: googleDateTime(shiftedStart.getTime() + 3600000, seriesB.time_zone),
		timeZone: seriesB.time_zone,
	}
	let firstFuture = pastStart
	while (!core.canChange(core.zonedInstant(firstFuture, startTime, seriesB.time_zone), new Date()))
		firstFuture = core.addDays(firstFuture, 7)
	const marksBefore = lessonCounts(card.id).marks
	const cut = await admitted(moveSeries(seriesB.id, firstFuture, '19:00'))
	const [ruleAfter] = rows(
		`select starts_on::text as starts_on, ends_on::text as ends_on from lesson_series where id = ${quote(seriesB.id)}`
	)
	const [mark] = rows(
		`select kind from lesson_marks where series_id = ${quote(seriesB.id)} and original_on = ${quote(pastStart)}`
	)
	const pastRefusal = await refusal(
		pipeline.commands.submitCalendarCommand({ ...context, now: new Date() }, moveSeries(seriesB.id, pastStart, '19:00'))
	)
	const cutOk =
		cut.plan.oldEndsOn === core.addDays(firstFuture, -1) &&
		cut.plan.newRule?.startsOn === firstFuture &&
		cut.plan.newRule.startTime === '19:00' &&
		cut.plan.cut?.preparedMarks.every((item) => item.originalOn >= firstFuture) &&
		ruleAfter.starts_on === pastStart &&
		ruleAfter.ends_on === null &&
		mark?.kind === 'done' &&
		lessonCounts(card.id).marks === marksBefore &&
		(pastRefusal === 'precondition_failed' || pastRefusal === 'lesson_changed')
	console.log(
		`check 6a lesson scope all: cut_from_first_future ${cut.plan.newRule?.startsOn === firstFuture} old_ends_day_before ${cut.plan.oldEndsOn === core.addDays(firstFuture, -1)} past_mark_kept ${mark?.kind === 'done'} series_row_unchanged ${ruleAfter.starts_on === pastStart && ruleAfter.ends_on === null} past_from ${pastRefusal} expected ${cutOk}`
	)
	if (!cutOk) fail('6a', 'lesson scope all is not a cut from the first changeable occurrence')
}

async function dispatchCases(pipeline, fx) {
	const { connection, context } = fx
	const accountId = connection.account_id
	const resources = loadEventResources(pipeline, connection.id)
	const week = seededInstances(connection.id, 'dvseed12')
	const [previous, current, next] = week
	const update = (eventId, scope, changes) => ({
		operation: 'event_update',
		eventKey: keyOf(connection.id, eventId),
		input: { requestId: randomUUID(), expectedVersion: versionOf(connection.id, eventId), scope, changes },
	})
	const remove = (eventId, scope) => ({
		operation: 'event_delete',
		eventKey: keyOf(connection.id, eventId),
		input: { requestId: randomUUID(), expectedVersion: versionOf(connection.id, eventId), scope },
	})
	const stubEtag = (eventId) => pipeline.stub.events.get(eventId)?.etag
	const results = []

	const revisionBefore = revision(connection.id)
	await submitAndDispatch(
		pipeline,
		context,
		update(next.event_id, 'one', { startTime: '16:00', colorId: '4', location: 'Synthetic room 2' }),
		8
	)
	const revisionAfter = revision(connection.id)
	const nextRow = projection(connection.id, next.event_id)
	const oneOk =
		nextRow.etag === stubEtag(next.event_id) &&
		nextRow.color_id === '4' &&
		nextRow.location === 'Synthetic room 2' &&
		new Date(nextRow.starts_at).getTime() !== new Date(next.starts_at).getTime()
	console.log(
		`check 7 acknowledged update: etag ${nextRow.etag === stubEtag(next.event_id)} colour ${nextRow.color_id === '4'} place ${nextRow.location === 'Synthetic room 2'} revision +${revisionAfter - revisionBefore}`
	)
	if (!oneOk || revisionAfter - revisionBefore !== 1n) fail(7, 'the acknowledged update did not refresh the projection')
	results.push(['update_one', oneOk])

	await submitAndDispatch(pipeline, context, update('dvseed08', 'one', { colorId: '3' }), 8)
	const tentative = projection(connection.id, 'dvseed08')
	results.push(['tentative_colour', tentative.status === 'tentative' && tentative.color_id === '3'])

	await submitAndDispatch(pipeline, context, update(previous.event_id, 'all', { colorId: '2' }), 8)
	const masterRow = projection(connection.id, 'dvseed12')
	results.push(['update_all', masterRow.etag === stubEtag('dvseed12') && masterRow.color_id === '2'])

	const insertsBefore = pipeline.stub.calls.insert.length
	await submitAndDispatch(pipeline, context, update(next.event_id, 'following', { title: 'Synthetic event 34' }), 8)
	const newMasterId = pipeline.stub.calls.insert.at(-1)
	const trimmed = projection(connection.id, 'dvseed12')
	const newMaster = projection(connection.id, newMasterId)
	const [companion] = (
		await pipeline.app.db
			.select({ state: googleCommandStages.state, kind: googleCommandStages.kind, stage: googleCommandStages.stage })
			.from(googleCommandStages)
	).filter((stage) => stage.kind === 'create_master')
	results.push([
		'update_following',
		pipeline.stub.calls.insert.length === insertsBefore + 1 &&
			/UNTIL=/.test(pipeline.stub.events.get('dvseed12').recurrence?.[0] ?? '') &&
			trimmed.etag === stubEtag('dvseed12') &&
			newMaster?.row_kind === 'master' &&
			newMaster.recurrence_kind === 'weekly' &&
			newMaster.color_id === '2' &&
			companion?.state === 'acknowledged' &&
			companion.stage === 2,
	])

	await submitAndDispatch(pipeline, context, remove(current.event_id, 'one'), 8)
	results.push(['delete_one', projection(connection.id, current.event_id).status === 'cancelled'])

	await submitAndDispatch(pipeline, context, remove(previous.event_id, 'all'), 8)
	results.push(['delete_all', projection(connection.id, 'dvseed12').status === 'cancelled'])

	const created = await submitAndDispatch(
		pipeline,
		context,
		{
			operation: 'event_create',
			input: {
				requestId: randomUUID(),
				expectedVersion: 'create-version',
				title: 'Synthetic event 35',
				date: core.addDays(fx.monday, 4),
				startTime: '08:00',
				durationMinutes: 30,
				repeats: 'weekly',
				colorId: '7',
				description: null,
				location: 'Synthetic room 35',
				expectedDefaultTimeZone: fx.zone,
			},
		},
		8
	)
	const createdRow = projection(connection.id, created.plan.input.eventId)
	results.push([
		'create_weekly',
		createdRow?.row_kind === 'master' &&
			createdRow.recurrence_kind === 'weekly' &&
			createdRow.etag === stubEtag(created.plan.input.eventId) &&
			createdRow.color_id === '7' &&
			createdRow.location === 'Synthetic room 35',
	])

	const patchesBefore = pipeline.stub.calls.patch.length
	const receipt = await pipeline.commands.submitCalendarCommand(
		{ ...context, now: new Date() },
		update('dvseed15', 'one', { location: 'Synthetic room 3' })
	)
	pipeline.stub.events.get('dvseed15').etag = '"changed-in-google"'
	await dispatch(pipeline, accountId, receipt.commandId).catch(() => undefined)
	const changed = await readCommand(pipeline.app.db, accountId, receipt.commandId)
	results.push([
		'external_change',
		changed.state === 'failed' &&
			changed.issue === 'external_change' &&
			pipeline.stub.calls.patch.length === patchesBefore,
	])

	const assignMaster = pipeline.stub.events.get(newMasterId)
	const localId = randomUUID()
	const commandId = randomUUID()
	const payload = {}
	const markerDigest = digest(JSON.stringify({ eventId: newMasterId, ...payload }))
	const markers = {
		entityKind: 'series',
		localEntityId: localId,
		representationGeneration: 0,
		commandId,
		stage: 0,
		digest: markerDigest,
		schemaVersion: 1,
	}
	const request = {
		method: 'patch',
		eventId: newMasterId,
		ifMatch: assignMaster.etag,
		digest: markerDigest,
		payload: { markers },
	}
	const response = {
		...structuredClone(assignMaster),
		etag: '"assign-shape"',
		extendedProperties: { private: insertEventBody(request).extendedProperties.private },
	}
	const assign = verifyGoogleResult(response, request, fx.zone, connection.generation ?? 1, 200)
	results.push(['marker_only_master', assign.acknowledgement.kind === 'master'])

	const allOk = results.every(([, ok]) => ok)
	console.log(
		`check 8 dispatch: resources ${resources} ${results.map(([name, ok]) => `${name} ${ok}`).join(', ')} patches ${pipeline.stub.calls.patch.length} inserts ${pipeline.stub.calls.insert.length}`
	)
	if (!allOk) fail(8, 'an event operation did not reach applied through dispatch')
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
	const monday = /monday (\d{4}-\d{2}-\d{2})/.exec(up)?.[1]
	if (!monday) throw new Error('calendar-seed up printed no monday')
	pipeline = await startPipeline()
	const fx = { ...(await lessonFixtures(pipeline, monday)), monday }
	await admissionCases(pipeline, fx)
	await lessonCases(pipeline, fx)
	await dispatchCases(pipeline, fx)
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`CALENDAR_EVENT_COMMANDS_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
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
if (exitCode === 0) console.log('CALENDAR_EVENT_COMMANDS_OK')
process.exit(exitCode)
