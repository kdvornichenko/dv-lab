import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import dns from 'node:dns'
import { readdirSync, readFileSync } from 'node:fs'
import net from 'node:net'
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

const [mode, argument] = process.argv.slice(2)
const target = mode === 'check' ? 'test' : argument
if (!['fixtures', 'check'].includes(mode) || !['test', 'dev'].includes(target)) {
	console.log('usage: node scripts/dev-checks/calendar-commands.mjs fixtures test|dev | check')
	process.exit(2)
}
if (process.env.CALENDAR_COMMANDS_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname, mode, target],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, CALENDAR_COMMANDS_OFFLINE: '1' } }
	)
	process.exit(child.status ?? 1)
}

const core = await import(`${ROOT}/packages/core/src/index.ts`)
const { createDb, resolveDatabaseUrl, googleCalendarEvents, googleCommands } = await import(
	`${ROOT}/packages/db/src/index.ts`
)
const { createConnectionLease } = await import(`${ROOT}/apps/api/src/calendar/lease.ts`)
const { createCredentials } = await import(`${ROOT}/apps/api/src/calendar/google-access.ts`)
const { createTokenEnvelope } = await import(`${ROOT}/apps/api/src/calendar/token-envelope.ts`)
const { createCalendarWorker } = await import(`${ROOT}/apps/api/src/calendar/worker.ts`)
const { createCalendarCommands } = await import(`${ROOT}/apps/api/src/calendar/commands.ts`)
const { insertEventBody, verifyGoogleResult, observeGoogleEvent } = await import(
	`${ROOT}/apps/api/src/calendar/command-result.ts`
)
const { parseMaster } = await import(`${ROOT}/apps/api/src/calendar/provider-events.ts`)
const { CalendarFault, GoogleWriteFault } = await import(`${ROOT}/apps/api/src/calendar/gateway.ts`)
const { projectCommand } = await import(`${ROOT}/apps/api/src/calendar/dispatch.ts`)
const { upsertEventFacts } = await import(`${ROOT}/apps/api/src/calendar/projection.ts`)
const { boundRowCondition } = await import(`${ROOT}/apps/api/src/calendar/event-mapping.ts`)
const { historyEligibility } = await import(`${ROOT}/apps/api/src/calendar/history.ts`)
const { eventVersion, opaqueVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)

const CARD_NAME = 'Alex Example 0002'
const CARD_KEY = 'calendar-commands:alex-example-0002'
const OTHER_PRIMARY = 'synthetic-primary-other'
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
const stamp = (date) => date.toISOString().replace('.000Z', 'Z').replaceAll('-', '').replaceAll(':', '')
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

function fail(check, message) {
	throw new Error(`check ${check}: ${message}`)
}

function rows(text) {
	return calendarSql(target, 'migrator', text).rows
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

function portFree(port) {
	return new Promise((done) => {
		const socket = net.connect(port, '127.0.0.1')
		socket.once('connect', () => {
			socket.destroy()
			done(false)
		})
		socket.once('error', () => done(true))
	})
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

function localClock(instant, zone) {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(instant)
}

function createStub(state) {
	const events = new Map()
	let counter = 0
	const etag = () => `"synthetic-${Date.now()}-${(counter += 1)}"`
	const allowed = (method) => {
		if (state.mode === 'fixtures' && !['refresh', 'insert', 'observeEvent', 'confirmedEvent'].includes(method))
			throw new Error(`stub gateway refused ${method} in fixtures mode`)
	}
	const read = (eventId) => {
		const resource = events.get(eventId)
		if (!resource) throw new GoogleWriteFault(404)
		return structuredClone(resource)
	}
	function instances(master) {
		const zone = master.start.timeZone
		const first = new Date(master.start.dateTime)
		const minutes = (Date.parse(master.end.dateTime) - first.getTime()) / 60000
		const date = core.scheduleDate(first, zone)
		const clock = localClock(first, zone)
		const list = []
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
		state.instances.set(master.id, list)
	}
	return {
		events,
		async refresh() {
			allowed('refresh')
			return { access_token: `synthetic-access-${randomUUID()}`, expiry_date: Date.now() + 3600000 }
		},
		async primary() {
			allowed('primary')
			state.calls.primary += 1
			return { id: OTHER_PRIMARY, label: 'Other', timeZone: 'UTC' }
		},
		async insert(_token, _calendarId, request, timeZone, generation) {
			allowed('insert')
			const body = insertEventBody(request)
			const resource = googleTimes(
				{ ...body, id: request.eventId, etag: etag(), status: 'confirmed', eventType: 'default' },
				timeZone
			)
			events.set(resource.id, resource)
			if (resource.recurrence?.length) instances(resource)
			return {
				...verifyGoogleResult(structuredClone(resource), request, timeZone, generation, 200),
				recoveryIssue: null,
			}
		},
		async confirmedEvent(_token, _calendarId, request, timeZone, generation) {
			allowed('confirmedEvent')
			return { ...verifyGoogleResult(read(request.eventId), request, timeZone, generation, 200), recoveryIssue: null }
		},
		async observeEvent(_token, _calendarId, eventId, timeZone) {
			allowed('observeEvent')
			return observeGoogleEvent(read(eventId), timeZone)
		},
		async master(_token, _calendarId, eventId, timeZone) {
			allowed('master')
			return parseMaster(read(eventId), timeZone)
		},
		async canonicalInstance(_token, _calendarId, masterEventId, originalStart) {
			allowed('canonicalInstance')
			const found = [...events.values()].filter(
				(item) =>
					item.recurringEventId === masterEventId &&
					Date.parse(item.originalStartTime.dateTime) === Date.parse(originalStart)
			)
			return found.length === 1 ? { kind: 'found', eventId: found[0].id } : { kind: 'missing' }
		},
		async patch(_token, _calendarId, request, timeZone, generation, privateProperties) {
			allowed('patch')
			const resource = read(request.eventId)
			if (resource.etag !== request.ifMatch) throw new GoogleWriteFault(412)
			const body = insertEventBody(request)
			const updated = googleTimes(
				{
					...resource,
					...body,
					id: resource.id,
					etag: etag(),
					extendedProperties: {
						...body.extendedProperties,
						private: { ...privateProperties, ...body.extendedProperties.private },
					},
				},
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

async function startPipeline() {
	const fileEnv = parseEnv(readFileSync(targetEnvFile(target), 'utf8'))
	const url = resolveDatabaseUrl('app', { ...fileEnv, NODE_ENV: target === 'test' ? 'test' : 'development' })
	const app = createDb(url)
	const state = { mode, calls: { primary: 0 }, instances: new Map() }
	const stub = createStub(state)
	const lease = createConnectionLease(app.pool)
	const envelope = createTokenEnvelope(syntheticTokenConfig())
	const credentials = createCredentials({
		db: app.db,
		lease,
		envelope,
		gateway: stub,
		observation: { accessRefreshed() {} },
	})
	const warnings = []
	const worker = createCalendarWorker({
		db: app.db,
		databaseUrl: url,
		credentials,
		lease,
		gateway: stub,
		logger: { warn: (message) => warnings.push(message), info() {}, error() {} },
		isStopping: () => false,
	})
	await worker.start()
	const commands = createCalendarCommands({
		db: app.db,
		credentials,
		gateway: stub,
		wake: worker.admit,
		resume: worker.resume,
	})
	const close = async () => {
		await worker.close()
		await credentials.close()
		await lease.close()
		await app.pool.end()
	}
	return { app, stub, state, credentials, worker, commands, close, warnings }
}

async function settle(pipeline, commandId, check) {
	const deadline = Date.now() + 30000
	while (Date.now() < deadline) {
		const [row] = rows(`select state, issue from google_commands where id = ${quote(commandId)}`)
		if (row?.state === 'applied') return
		if (['failed', 'recovery_required', 'partial_recovery'].includes(row?.state))
			fail(check, `command ended ${row.state} with ${row.issue}; worker notes ${pipeline.warnings.length}`)
		await sleep(250)
	}
	fail(check, 'command did not reach applied in 30 s')
}

async function submit(pipeline, context, command, check) {
	const receipt = await pipeline.commands.submitCalendarCommand({ ...context, now: new Date() }, command)
	await settle(pipeline, receipt.commandId, check)
	return receipt.commandId
}

async function refusal(promise) {
	try {
		await promise
		return 'accepted'
	} catch (error) {
		return error instanceof CalendarFault || error?.code ? error.code : 'unexpected'
	}
}

function projectionRow(connectionId, eventId) {
	const [row] = rows(
		`select event_id, etag, status, row_kind, starts_at, ends_at from google_calendar_events
where connection_id = ${quote(connectionId)} and event_id = ${quote(eventId)}`
	)
	return row
}

function syncCounters(connectionId) {
	const [row] = rows(
		`select revision::text as revision, requested_seq::int as requested from google_sync_state where connection_id = ${quote(connectionId)}`
	)
	return { revision: BigInt(row.revision), requested: row.requested }
}

function mappingEvent(lessonOrSeriesId, kind) {
	const [row] = rows(
		`select event_id from google_event_mappings where local_entity_id = ${quote(lessonOrSeriesId)} and entity_kind = ${quote(kind)} and state = 'active'`
	)
	return row?.event_id
}

async function fixtures(pipeline) {
	const up = seed('up', target, 'week')
	const monday = /monday (\d{4}-\d{2}-\d{2})/.exec(up)?.[1]
	if (!monday) throw new Error('calendar-seed up printed no monday')
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
			expectedVersion: 'stale-version',
		},
	})
	await submit(pipeline, context, create(core.addDays(monday, 8), 'once'), 1)
	await submit(pipeline, context, create(core.addDays(monday, 9), 'weekly'), 1)
	const [single] = rows(`select id from lessons where student_id = ${quote(card.id)}`)
	const [series] = rows(`select id, weekday from lesson_series where student_id = ${quote(card.id)}`)
	const singleEvent = mappingEvent(single.id, 'single')
	const masterEvent = mappingEvent(series.id, 'series')
	if (!singleEvent || !masterEvent) fail(1, 'created lessons have no active mapping')
	const target_ = { accountId: connection.account_id, connectionId: connection.id, calendarId: connection.calendar_id }
	const instanceList = pipeline.state.instances.get(masterEvent) ?? []
	await pipeline.app.db.transaction((tx) =>
		upsertEventFacts(tx, target_, [
			...instanceList.map(resourceFact),
			{
				eventId: masterEvent,
				status: 'confirmed',
				master: true,
				recurrence: {
					recurrenceKind: 'weekly',
					recurrenceWeekday: Number(series.weekday),
					recurrenceFrequency: 'weekly',
					recurrenceInterval: 1,
					recurrenceUntil: null,
				},
				factAt: new Date(),
			},
		])
	)
	console.log(
		`FIXTURES ${target} single ${hash(single.id)} event ${hash(singleEvent)} series ${hash(series.id)} master ${hash(masterEvent)} instances ${instanceList.length} card ${hash(card.id)} monday ${monday}`
	)
	return { monday, zone, connection, card, single, series, singleEvent, masterEvent, instanceList, context, target_ }
}

async function preflight() {
	if (!(await offline())) throw new Error('Google hosts resolve: the offline preload is not active')
	const [other] = rows(
		`select count(*)::int as n from google_commands c join google_connections g on g.id = c.connection_id
where c.state not in ('applied', 'failed') and g.calendar_id not like '${SYNTHETIC_CALENDAR_ID}%'`
	)
	if (other.n !== 0) throw new Error(`refused: ${other.n} unresolved commands outside the synthetic calendar`)
	if (target === 'dev' && !(await portFree(4000)))
		throw new Error('refused: an api listens on port 4000 and would take the fixture jobs; stop it first')
}

async function check(pipeline) {
	const fx = await fixtures(pipeline)
	const { connection, context, zone, monday, card } = fx
	const singleRow = projectionRow(connection.id, fx.singleEvent)
	const masterRow = projectionRow(connection.id, fx.masterEvent)
	const acked =
		singleRow?.etag === pipeline.stub.events.get(fx.singleEvent)?.etag &&
		masterRow?.etag === pipeline.stub.events.get(fx.masterEvent)?.etag &&
		masterRow.row_kind === 'master'
	const shifted = createCalendarCommands({
		db: pipeline.app.db,
		credentials: {
			...pipeline.credentials,
			async accessToken(accountId, signal) {
				const access = await pipeline.credentials.accessToken(accountId, signal)
				return { ...access, connection: { ...access.connection, generation: access.connection.generation + 1 } }
			},
		},
		gateway: pipeline.stub,
		wake: async () => undefined,
		resume: async () => undefined,
	})
	const generationRefusal = await refusal(
		shifted.submitCalendarCommand(
			{ ...context, now: new Date() },
			{
				operation: 'create',
				input: {
					studentId: card.id,
					date: core.addDays(monday, 10),
					startTime: '18:00',
					durationMinutes: 60,
					repeats: 'once',
					expectedDefaultTimeZone: zone,
					requestId: randomUUID(),
					expectedVersion: 'stale-version',
				},
			}
		)
	)
	console.log(
		`check 1 create: stale_version_applied true acknowledged_etags ${acked} changed_generation ${generationRefusal}`
	)
	if (!acked || generationRefusal !== 'precondition_failed') fail(1, 'create admission or acknowledgement is wrong')

	const singleRef = { kind: 'single', lessonId: fx.single.id }
	const versionBefore = eventVersion({ eventId: singleRow.event_id, etag: singleRow.etag })
	const move = (ref, date, startTime, expectedVersion) => ({
		operation: 'move',
		ref,
		input: { date, startTime, expectedDefaultTimeZone: zone, requestId: randomUUID(), expectedVersion },
	})
	const before = syncCounters(connection.id)
	const moveSingle = await submit(
		pipeline,
		context,
		move(singleRef, core.addDays(monday, 11), '18:00', versionBefore),
		2
	)
	const afterSingle = syncCounters(connection.id)
	const stale = await refusal(
		pipeline.commands.submitCalendarCommand(
			{ ...context, now: new Date() },
			move(singleRef, core.addDays(monday, 12), '18:00', versionBefore)
		)
	)
	console.log(`check 2 move admission: current_version applied, old_etag_version ${stale}`)
	if (stale !== 'precondition_failed') fail(2, 'an old etag version was admitted')

	const conflict = (date) =>
		pipeline.commands.checkCalendarConflicts(
			{ ...context, now: new Date() },
			{
				proposal: {
					operation: 'create',
					input: {
						studentId: card.id,
						date,
						startTime: '11:00',
						durationMinutes: 60,
						repeats: 'once',
						expectedDefaultTimeZone: zone,
					},
				},
				expectedVersion: 'stale-version',
			}
		)
	const inside = await conflict(monday)
	const far = await conflict(core.addDays(monday, 420))
	const expectedKey = opaqueVersion([connection.id, 'dvseed06'])
	const insideOk =
		inside.state === 'complete' &&
		inside.events.length === 1 &&
		inside.events[0].eventKey === expectedKey &&
		inside.events[0].color.background !== null
	const farOk = far.state === 'unavailable' && far.reason === 'outside_sync_window'
	console.log(
		`check 3 overlap: inside ${inside.state} keys ${inside.state === 'complete' ? inside.events.length : 0} expected ${insideOk} far ${far.state}/${far.reason ?? '-'}`
	)
	if (!insideOk || !farOk) fail(3, 'overlap check over the projection is wrong')

	const instance = fx.instanceList[1]
	const instanceRow = projectionRow(connection.id, instance.id)
	const originalOn = core.scheduleDate(new Date(instance.originalStartTime.dateTime), zone)
	const occurrenceRef = { kind: 'series', seriesId: fx.series.id, originalOn }
	const moveOccurrence = await submit(
		pipeline,
		context,
		move(occurrenceRef, originalOn, '19:00', eventVersion({ eventId: instanceRow.event_id, etag: instanceRow.etag })),
		5
	)
	const afterOccurrence = syncCounters(connection.id)
	const singleAcked =
		projectionRow(connection.id, fx.singleEvent)?.etag === pipeline.stub.events.get(fx.singleEvent).etag
	const occurrenceAcked = projectionRow(connection.id, instance.id)?.etag === pipeline.stub.events.get(instance.id).etag
	const [applied] = (await pipeline.app.db.select().from(googleCommands)).filter((item) => item.id === moveOccurrence)
	await projectCommand({ db: pipeline.app.db, signal: new AbortController().signal }, applied)
	const afterRepeat = syncCounters(connection.id)
	const seqOk =
		afterSingle.requested === before.requested + 1 && afterOccurrence.requested === afterSingle.requested + 1
	const repeatOk =
		afterRepeat.revision === afterOccurrence.revision && afterRepeat.requested === afterOccurrence.requested
	console.log(
		`check 5 apply: requested_seq +${afterSingle.requested - before.requested} +${afterOccurrence.requested - afterSingle.requested} acknowledged_etags ${singleAcked && occurrenceAcked} revision_rose ${afterOccurrence.revision > before.revision} repeat_unchanged ${repeatOk} single ${hash(moveSingle)}`
	)
	if (!seqOk || !singleAcked || !occurrenceAcked || !repeatOk) fail(5, 'confirmed apply did not reach the projection')

	const current = () => {
		const row = projectionRow(connection.id, fx.singleEvent)
		return eventVersion({ eventId: row.event_id, etag: row.etag })
	}
	const action = (operation, expectedVersion) => ({
		operation,
		ref: singleRef,
		input: { requestId: randomUUID(), expectedVersion },
	})
	await submit(pipeline, context, action('cancel', current()), 5)
	const cancelled = projectionRow(connection.id, fx.singleEvent)
	await submit(pipeline, context, action('restore', current()), 5)
	const restored = projectionRow(connection.id, fx.singleEvent)
	const primaryCalls = pipeline.state.calls.primary
	console.log(
		`check 5 non-primary calendar: move, cancel, restore applied; cancelled_row ${cancelled.status} times_kept ${cancelled.starts_at !== null} restored_row ${restored.status} primary_lookups ${primaryCalls}`
	)
	if (cancelled.status !== 'cancelled' || cancelled.starts_at === null || restored.status !== 'confirmed')
		fail(5, 'cancel or restore did not reach the projection')
	if (primaryCalls !== 0) fail(5, 'a write path asked for the primary calendar')

	await submit(
		pipeline,
		context,
		{
			operation: 'create',
			input: {
				studentId: card.id,
				date: core.addDays(monday, 12),
				startTime: '18:00',
				durationMinutes: 60,
				repeats: 'once',
				expectedDefaultTimeZone: zone,
				requestId: randomUUID(),
				expectedVersion: 'stale-version',
			},
		},
		4
	)
	const [history] = rows(
		`select l.id from lessons l join google_event_mappings m on m.local_entity_id = l.id and m.state = 'active'
where l.student_id = ${quote(card.id)} order by l.created_at desc limit 1`
	)
	const historyEvent = mappingEvent(history.id, 'single')
	const past = new Date(Date.now() - 86400000)
	past.setUTCSeconds(0, 0)
	const pastEnd = new Date(past.getTime() + 3600000)
	rows(`begin;
update google_connections set history_cutover_at = now() - interval '30 days' where id = ${quote(connection.id)};
update lessons set starts_at = ${quote(past.toISOString())}::timestamptz where id = ${quote(history.id)};
commit;`)
	await pipeline.app.db.transaction((tx) =>
		upsertEventFacts(tx, fx.target_, [
			{
				...resourceFact(pipeline.stub.events.get(historyEvent)),
				etag: `"synthetic-history-${Date.now()}"`,
				start: { dateTime: googleDateTime(past, zone), timeZone: zone },
				end: { dateTime: googleDateTime(pastEnd, zone), timeZone: zone },
			},
		])
	)
	const subject = (mark, startsAt = past) => ({
		ref: { kind: 'single', lessonId: history.id },
		studentId: card.id,
		startsAt,
		durationMinutes: 60,
		mark,
	})
	const key = `l:${history.id}`
	const matching = (await historyEligibility(pipeline.app.db, connection.account_id, [subject(null)])).has(key)
	seed('bump', target, historyEvent)
	const moved = (await historyEligibility(pipeline.app.db, connection.account_id, [subject(null)])).has(key)
	const marked = (await historyEligibility(pipeline.app.db, connection.account_id, [subject('done')])).has(key)
	console.log(`check 4 marks: matching_row ${matching} moved_row ${moved} marked ${marked}`)
	if (!matching || moved || !marked) fail(4, 'mark eligibility does not follow the bound projection row')

	await pipeline.app.db.transaction((tx) =>
		upsertEventFacts(tx, fx.target_, [
			{
				eventId: 'dvmarker01',
				etag: '"synthetic-marker"',
				status: 'confirmed',
				recurringEventId: null,
				summary: 'Synthetic event 99',
				start: { dateTime: googleDateTime(pastEnd, zone), timeZone: zone },
				end: { dateTime: googleDateTime(pastEnd.getTime() + 3600000, zone), timeZone: zone },
				markerLocalId: randomUUID(),
				markerKind: 'single',
				factAt: new Date(),
			},
		])
	)
	const bound = new Set(
		(await pipeline.app.db.select().from(googleCalendarEvents).where(boundRowCondition(connection.id)))
			.filter((row) => row.connectionId === connection.id)
			.map((row) => row.eventId)
	)
	const instanceIds = fx.instanceList.map((item) => item.id)
	const boundOk =
		bound.has(fx.singleEvent) &&
		bound.has(fx.masterEvent) &&
		instanceIds.every((id) => bound.has(id)) &&
		bound.has('dvmarker01') &&
		bound.has(historyEvent) &&
		!bound.has('dvseed06') &&
		[...bound].every((id) => !id.startsWith('dvseed'))
	console.log(`check 6 bound rows: ${bound.size} selected, expected ${boundOk}`)
	if (!boundOk) fail(6, 'boundRowCondition selects the wrong rows')

	const offenders = []
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = `${dir}/${entry.name}`
			if (entry.isDirectory()) walk(path)
			else if (
				/google_read_windows|google_read_events|google_next_lessons|googleReadWindows|googleReadEvents|googleNextLessons/.test(
					readFileSync(path, 'utf8')
				)
			)
				offenders.push(path.slice(ROOT.length + 1))
		}
	}
	walk(`${ROOT}/apps/api/src`)
	console.log(`check 7 snapshot tables in apps/api/src: ${offenders.length}`)
	if (offenders.length) fail(7, offenders.join(', '))
}

let pipeline = null
let exitCode = 0
try {
	await preflight()
	pipeline = await startPipeline()
	if (mode === 'fixtures') await fixtures(pipeline)
	else await check(pipeline)
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`CALENDAR_COMMANDS_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
	exitCode = 1
} finally {
	if (pipeline) await pipeline.close()
	if (mode === 'check') {
		try {
			seed('down', 'test')
			purgeCard()
		} catch (error) {
			console.log(`cleanup failed: ${error instanceof Error ? error.message : 'unexpected failure'}`)
			exitCode = 1
		}
	}
}
if (exitCode === 0) console.log(mode === 'check' ? 'CALENDAR_COMMANDS_OK' : 'CALENDAR_FIXTURES_OK')
process.exit(exitCode)
