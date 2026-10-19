import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import dns from 'node:dns'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

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
import { studentCleanupSql } from './fixture-cleanup.mjs'

const TARGET = 'test'
const PORT = 4225
if (process.env.CHAT_CALENDAR_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, CHAT_CALENDAR_OFFLINE: '1' } }
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
const { eventVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)
const { classifyRecurrence } = await import(`${ROOT}/apps/api/src/calendar/recurring.ts`)
const { markLesson, markOccurrence } = await import(`${ROOT}/apps/api/src/schedule/marks.ts`)
const { createConversation } = await import(`${ROOT}/apps/api/src/chat/conversations.ts`)
const { executeIntent, sendMessage, undoAction } = await import(`${ROOT}/apps/api/src/chat/actions.ts`)
const { confirmCalendarChange, checkCalendarAction } = await import(`${ROOT}/apps/api/src/chat/calendar.ts`)
const { declineAction } = await import(`${ROOT}/apps/api/src/chat/changes.ts`)
const { insertMessage, listMessages } = await import(`${ROOT}/apps/api/src/chat/messages.ts`)
const { chatBlock, calendarActionResponse } = await import(`${ROOT}/packages/contracts/src/index.ts`)

const KEY = 'chat-calendar:'
const NAME = 'Alex Example 229'
const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
const stamp = (date) => date.toISOString().replace('.000Z', 'Z').replaceAll('-', '').replaceAll(':', '')
const latency = () => new Promise((resolve) => setTimeout(resolve, 300))

let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
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

function purgeChats(conversations) {
	if (conversations.length === 0) return
	const ids = conversations.map(quote).join(', ')
	rows(`begin;
delete from chat_actions where conversation_id in (${ids});
delete from chat_messages where reply_to is not null and conversation_id in (${ids});
delete from chat_messages where conversation_id in (${ids});
delete from chat_conversations where id in (${ids});
commit;`)
}

function purgeCards() {
	const [before] = rows(`select count(*)::int as n from students where import_key like ${quote(`${KEY}%`)}`)
	rows(studentCleanupSql(`import_key like ${quote(`${KEY}%`)}`))
	return before.n
}

function createStub() {
	const events = new Map()
	const modified = new Set()
	let counter = 0
	const etag = () => `"chat-calendar-${Date.now()}-${(counter += 1)}"`
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
		touch(eventId) {
			const resource = events.get(eventId)
			if (!resource) throw new Error('stub event is missing')
			resource.etag = etag()
		},
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

function versionOf(fx, eventId) {
	const [row] = rows(
		`select event_id, etag from google_calendar_events where connection_id = ${quote(fx.connection.id)} and event_id = ${quote(eventId)}`
	)
	return row ? eventVersion({ eventId: row.event_id, etag: row.etag }) : null
}

function freshAt(fx) {
	rows(
		`update google_sync_state set last_full_at = now(), last_incremental_at = now(), issue = null where connection_id = ${quote(fx.connection.id)}`
	)
}

function lessonMark(lessonId) {
	return rows(`select kind, revision from lesson_marks where lesson_id = ${quote(lessonId)}`)[0] ?? null
}

function action(id) {
	return rows(
		`select kind, state, target, before, after, result, undo_result, calendar_request_id, undo_calendar_request_id from chat_actions where id = ${quote(id)}`
	)[0]
}

function commandRows(fx) {
	return rows(
		`select id, request_id, operation, state, expected_version, plan from google_commands where account_id = ${quote(fx.accountId)} order by created_at`
	)
}

function commandByRequest(fx, requestId) {
	return commandRows(fx).find((row) => row.request_id === requestId) ?? null
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

async function project(pipeline, fx) {
	const facts = [...pipeline.stub.events.values()].map((event) => resourceFact(event, fx.zone))
	await pipeline.app.db.transaction((tx) => upsertEventFacts(tx, fx.target, facts))
}

async function dispatch(pipeline, fx, commandId) {
	const access = await pipeline.credentials.accessToken(fx.accountId)
	const command = await readCommand(pipeline.app.db, fx.accountId, commandId)
	if (command.plan.cut) await executeTransition(access, command, pipeline.stub)
	else await dispatchCommand(access, command, pipeline.stub)
	await latency()
	const after = await readCommand(pipeline.app.db, fx.accountId, commandId)
	if (after.state === 'projection_pending') await projectCommand(access, after)
	await project(pipeline, fx)
	freshAt(fx)
	return readCommand(pipeline.app.db, fx.accountId, commandId)
}

async function run(pipeline, fx, command) {
	const receipt = await pipeline.commands.submitCalendarCommand({ accountId: fx.accountId, now: new Date() }, command)
	const finished = await dispatch(pipeline, fx, receipt.commandId)
	if (finished.state !== 'applied')
		throw new Error(`${command.operation} ended ${finished.state} with ${finished.issue ?? 'no issue'}`)
}

function card(n) {
	const [row] = rows(
		`insert into students (display_name, status, import_key) values (${quote(`${NAME}${n}`)}, 'active', ${quote(`${KEY}${n}-${randomUUID()}`)}) returning id`
	)
	return { id: row.id, name: `${NAME}${n}` }
}

function minuteFloor(ms) {
	const date = new Date(ms)
	date.setUTCSeconds(0, 0)
	return date
}

async function createLesson(pipeline, fx, student, instant) {
	const parts = core.zonedParts(instant, fx.zone)
	const before = new Set(rows(`select id from lessons where student_id = ${quote(student.id)}`).map((row) => row.id))
	await run(pipeline, fx, {
		operation: 'create',
		input: {
			studentId: student.id,
			date: parts.date,
			startTime: parts.time,
			durationMinutes: 60,
			repeats: 'once',
			expectedDefaultTimeZone: fx.zone,
			requestId: randomUUID(),
			expectedVersion: 'fixture-version',
		},
	})
	const created = rows(`select id from lessons where student_id = ${quote(student.id)}`).find(
		(row) => !before.has(row.id)
	)
	if (!created) throw new Error('a fixture lesson was not created')
	return {
		id: created.id,
		startsAt: instant,
		day: core.lessonDay(instant, fx.zone),
		eventId: mappingEvent(created.id, 'single'),
	}
}

const EARLIEST_LESSON_MS = 145 * 60000

async function createSeries(pipeline, fx, student, instant) {
	const parts = core.zonedParts(instant, fx.zone)
	await run(pipeline, fx, {
		operation: 'create',
		input: {
			studentId: student.id,
			date: core.addDays(parts.date, -21),
			startTime: parts.time,
			durationMinutes: 60,
			repeats: 'weekly',
			expectedDefaultTimeZone: fx.zone,
			requestId: randomUUID(),
			expectedVersion: 'fixture-version',
		},
	})
	const [series] = rows(`select id from lesson_series where student_id = ${quote(student.id)}`)
	return { id: series.id, date: parts.date }
}

function chatContext(fx, extra = {}) {
	return { accountId: fx.accountId, now: new Date(), defaultTimeZone: fx.zone, calendarEnabled: true, ...extra }
}

async function say(pipeline, fx, student, rest, extra = {}) {
	const text = `@${student.name} ${rest}`
	const result = await sendMessage(pipeline.app.db, chatContext(fx, extra), fx.conversationId, {
		requestId: randomUUID(),
		text,
		mentions: [{ studentId: student.id, text: student.name, start: 1, end: 1 + student.name.length }],
	})
	if (result.kind !== 'sent') throw new Error(`send answered ${result.kind}`)
	const block = result.messages[1]?.blocks[0]
	if (!chatBlock.safeParse(block).success) throw new Error('the reply block does not match the contract')
	return block
}

function shape(outcome) {
	if (outcome.kind !== 'ok') return null
	return calendarActionResponse.safeParse({ block: outcome.block }).success ? outcome.block : null
}

async function confirm(pipeline, fx, actionId) {
	return shape(await confirmCalendarChange(pipeline.app.db, pipeline.commands, chatContext(fx), actionId))
}

async function checkAction(pipeline, fx, actionId) {
	return shape(await checkCalendarAction(pipeline.app.db, pipeline.commands, chatContext(fx), actionId))
}

async function undo(pipeline, fx, actionId) {
	const outcome = await undoAction(
		pipeline.app.db,
		chatContext(fx),
		actionId,
		{ requestId: randomUUID() },
		pipeline.commands
	)
	return outcome.kind === 'ok' ? outcome.block : { kind: outcome.kind }
}

async function confirmed(pipeline, fx, block, label) {
	const pending = await confirm(pipeline, fx, block.actionId)
	const row = action(block.actionId)
	const commandId = row?.result?.commandId
	if (!pending || !commandId)
		throw new Error(`${label}: confirm gave ${JSON.stringify(pending?.state)} ${row?.result?.issue}`)
	const finished = await dispatch(pipeline, fx, commandId)
	return { pending, commandId, finished, applied: await checkAction(pipeline, fx, block.actionId) }
}

function lineageOf(fx, commandId) {
	return commandRows(fx).find((row) => row.id === commandId)?.plan?.lineage?.[0] ?? null
}

async function caseMove(pipeline, fx, ids) {
	const lesson = ids.started
	const tomorrow = core.addDays(fx.today, 1)
	const before = commandRows(fx).length
	const block = await say(pipeline, fx, ids.a, `moved from ${lesson.day} to tomorrow 18:00`)
	const row = action(block.actionId)
	check(
		'moved to tomorrow 18:00: a proposal and no command',
		block.type === 'calendar_proposal' &&
			block.operation === 'move' &&
			block.state === 'proposed' &&
			block.target.kind === 'lesson' &&
			block.target.startsAt === core.zonedInstant(tomorrow, '18:00', fx.zone).toISOString() &&
			row.state === 'proposed' &&
			row.calendar_request_id !== null &&
			commandRows(fx).length === before,
		JSON.stringify(block)
	)
	check(
		'a move proposal carries the student, the lesson ref and day and the new day',
		block.type === 'calendar_proposal' &&
			block.studentId === ids.a.id &&
			block.lesson.ref?.kind === 'single' &&
			block.lesson.ref.lessonId === lesson.id &&
			block.lesson.date === lesson.day &&
			block.target.kind === 'lesson' &&
			block.target.date === tomorrow,
		JSON.stringify(block)
	)
	const version = versionOf(fx, lesson.eventId)
	const pending = await confirm(pipeline, fx, block.actionId)
	const afterConfirm = action(block.actionId)
	const command = commandByRequest(fx, afterConfirm.calendar_request_id)
	check(
		'Confirm: a move command with requestId = calendar_request_id and the event version, the block is not Saved yet',
		pending?.state === 'pending' &&
			command?.operation === 'move' &&
			command.id === afterConfirm.result.commandId &&
			command.expected_version === version &&
			commandRows(fx).length === before + 1,
		JSON.stringify({ state: pending?.state, operation: command?.operation })
	)
	const finished = await dispatch(pipeline, fx, command.id)
	const applied = await checkAction(pipeline, fx, block.actionId)
	const appliedRow = action(block.actionId)
	check(
		'Google answers: the command is applied and the block is applied with Undo',
		finished.state === 'applied' &&
			applied?.state === 'applied' &&
			applied.undo === 'available' &&
			appliedRow.state === 'applied' &&
			appliedRow.after?.version !== null,
		JSON.stringify({ command: finished.state, block: applied?.state, after: appliedRow.after })
	)
	const again = await confirm(pipeline, fx, block.actionId)
	check(
		'a repeated Confirm keeps the same commandId and sends nothing',
		again?.state === 'applied' &&
			action(block.actionId).result.commandId === command.id &&
			commandRows(fx).length === before + 1
	)
	return { block, commandId: command.id }
}

async function caseCancel(pipeline, fx, ids) {
	const lesson = ids.cancel
	const block = await say(pipeline, fx, ids.b, `didn't happen ${lesson.day}`)
	if (block.type !== 'calendar_proposal') {
		check("didn't happen proposes a cancel", false, JSON.stringify(block))
		return
	}
	const { pending, commandId, finished, applied } = await confirmed(pipeline, fx, block, 'cancel')
	const operation = commandRows(fx).find((row) => row.id === commandId)?.operation
	check(
		"didn't happen to a started unmarked lesson: cancel, applied, with the day of the cancelled lesson",
		block.operation === 'cancel' &&
			block.target.kind === 'cancelled' &&
			block.target.date === lesson.day &&
			pending.state === 'pending' &&
			operation === 'cancel' &&
			finished.state === 'applied' &&
			applied?.state === 'applied' &&
			applied.undo === 'available',
		JSON.stringify({ operation, finished: finished.state, applied: applied?.state })
	)
	const back = await undo(pipeline, fx, block.actionId)
	const undoRow = action(block.actionId)
	const restore = commandByRequest(fx, undoRow.undo_calendar_request_id)
	if (restore) await dispatch(pipeline, fx, restore.id)
	const shown = await checkAction(pipeline, fx, block.actionId)
	const status = rows(`select status from lessons where id = ${quote(lesson.id)}`)[0]?.status
	check(
		'Undo of a cancel: a restore command, the lesson is scheduled again, Undo done',
		back.undo === 'pending' && restore?.operation === 'restore' && shown?.undo === 'done' && status === 'scheduled',
		JSON.stringify({ undo: back.undo, operation: restore?.operation, shown: shown?.undo, status })
	)
}

async function caseDone(pipeline, fx, ids) {
	const before = commandRows(fx).length
	const block = await say(pipeline, fx, ids.c, `didn't happen ${ids.done.day}`)
	const proposed = rows(
		`select count(*)::int as n from chat_actions where conversation_id = ${quote(fx.conversationId)} and calendar_request_id is not null and target->>'key' = ${quote(`l:${ids.done.id}`)}`
	)[0].n
	check(
		'a done lesson: no proposal, lesson_done',
		block.type === 'refused' && block.code === 'lesson_done' && proposed === 0 && commandRows(fx).length === before,
		JSON.stringify(block)
	)
}

async function caseNoShowUndo(pipeline, fx, ids) {
	const lesson = ids.noShow
	const mark = await markLesson(pipeline.app.db, fx.accountId, lesson.id, { kind: 'no_show' }, new Date())
	const revision = mark.kind === 'ok' ? mark.mark.revision : null
	const block = await say(pipeline, fx, ids.d, `moved from ${lesson.day} to tomorrow 18:00`)
	if (block.type !== 'calendar_proposal' || revision === null) {
		check('no_show lesson moved later: a proposal', false, JSON.stringify({ block, revision }))
		return
	}
	const { applied } = await confirmed(pipeline, fx, block, 'no_show move')
	const cleared = lessonMark(lesson.id)
	check(
		'a no_show lesson moved later than now: the proposal says so, the mark becomes none R+1',
		block.clearsNoShow === true &&
			applied?.state === 'applied' &&
			cleared?.kind === 'none' &&
			cleared.revision === revision + 1,
		JSON.stringify({ cleared, revision })
	)
	const back = await undo(pipeline, fx, block.actionId)
	const undoRow = action(block.actionId)
	const reverse = commandByRequest(fx, undoRow.undo_calendar_request_id)
	const lineage = reverse ? lineageOf(fx, reverse.id) : null
	check(
		'Undo: a move back into the past with restoreMark no_show R+1',
		back.undo === 'pending' &&
			reverse?.operation === 'move' &&
			lineage?.restoreMark?.kind === 'no_show' &&
			lineage.restoreMark.revision === revision + 1,
		JSON.stringify({ undo: back.undo, operation: reverse?.operation, restore: lineage?.restoreMark })
	)
	if (!reverse) return
	await dispatch(pipeline, fx, reverse.id)
	const direct = lessonMark(lesson.id)
	check(
		'without any check call, the applying transaction returned no_show R+2',
		direct?.kind === 'no_show' && direct.revision === revision + 2,
		JSON.stringify(direct)
	)
	const shown = await checkAction(pipeline, fx, block.actionId)
	check('check then shows the Undo as done', shown?.undo === 'done' && action(block.actionId).state === 'undone')
}

async function caseRevisionRace(pipeline, fx, ids) {
	const lesson = ids.race
	await markLesson(pipeline.app.db, fx.accountId, lesson.id, { kind: 'no_show' }, new Date())
	const block = await say(pipeline, fx, ids.e, `moved from ${lesson.day} to tomorrow 19:00`)
	if (block.type !== 'calendar_proposal') {
		check('race lesson proposal', false, JSON.stringify(block))
		return
	}
	await confirmed(pipeline, fx, block, 'race move')
	rows(`update lesson_marks set revision = revision + 1, updated_at = now() where lesson_id = ${quote(lesson.id)}`)
	const before = commandRows(fx).length
	const back = await undo(pipeline, fx, block.actionId)
	check(
		'the mark revision changed between the move and Undo: stale, no command',
		back.undo === 'stale' && commandRows(fx).length === before && action(block.actionId).state === 'applied',
		JSON.stringify({ undo: back.undo })
	)
}

async function caseEarlier(pipeline, fx, ids) {
	const lesson = ids.earlier
	const mark = await markLesson(pipeline.app.db, fx.accountId, lesson.id, { kind: 'no_show' }, new Date())
	const revision = mark.kind === 'ok' ? mark.mark.revision : null
	const target = minuteFloor(Date.now() - 60 * 60000)
	const parts = core.zonedParts(target, fx.zone)
	const block = await say(pipeline, fx, ids.f, `moved from ${lesson.day} to ${parts.date} ${parts.time}`)
	if (block.type !== 'calendar_proposal') {
		check('earlier move proposal', false, JSON.stringify(block))
		return
	}
	await confirmed(pipeline, fx, block, 'earlier move')
	const kept = lessonMark(lesson.id)
	const back = await undo(pipeline, fx, block.actionId)
	const reverse = commandByRequest(fx, action(block.actionId).undo_calendar_request_id)
	const lineage = reverse ? lineageOf(fx, reverse.id) : null
	if (reverse) await dispatch(pipeline, fx, reverse.id)
	const shown = await checkAction(pipeline, fx, block.actionId)
	const after = lessonMark(lesson.id)
	check(
		'a move earlier than now keeps no_show; Undo goes without restoreMark',
		block.clearsNoShow === false &&
			kept?.kind === 'no_show' &&
			kept.revision === revision &&
			back.undo === 'pending' &&
			reverse?.operation === 'move' &&
			lineage?.restoreMark === undefined &&
			shown?.undo === 'done' &&
			after?.kind === 'no_show' &&
			after.revision === revision,
		JSON.stringify({ kept, after, undo: shown?.undo, restore: lineage?.restoreMark })
	)
}

async function caseGoogleEdit(pipeline, fx, ids, moved) {
	pipeline.stub.touch(ids.started.eventId)
	await project(pipeline, fx)
	freshAt(fx)
	const before = commandRows(fx).length
	const back = await undo(pipeline, fx, moved.block.actionId)
	check(
		'the event changed in Google before Undo: stale, no command',
		back.undo === 'stale' && commandRows(fx).length === before,
		JSON.stringify({ undo: back.undo })
	)
}

async function casePending(pipeline, fx, ids) {
	const lesson = ids.pending
	const block = await say(pipeline, fx, ids.g, `moved from ${lesson.day} to tomorrow 20:00`)
	if (block.type !== 'calendar_proposal') {
		check('pending proposal', false, JSON.stringify(block))
		return
	}
	const other = await pipeline.commands.submitCalendarCommand(
		{ accountId: fx.accountId, now: new Date() },
		{
			operation: 'create',
			input: {
				studentId: ids.g.id,
				date: core.addDays(fx.today, 3),
				startTime: '07:00',
				durationMinutes: 60,
				repeats: 'once',
				expectedDefaultTimeZone: fx.zone,
				requestId: randomUUID(),
				expectedVersion: 'fixture-version',
			},
		}
	)
	const before = commandRows(fx).length
	const refused = await confirm(pipeline, fx, block.actionId)
	check(
		'an unresolved command of the account: command_pending, nothing sent',
		refused?.state === 'failed' && refused.issue === 'command_pending' && commandRows(fx).length === before,
		JSON.stringify({ state: refused?.state, issue: refused?.issue })
	)
	await dispatch(pipeline, fx, other.commandId)
}

async function caseRefusals(pipeline, fx, ids) {
	const noLink = await say(pipeline, fx, ids.a, 'moved to tomorrow 18:00', { calendarEnabled: false })
	check(
		'Google not configured: connection_required, no proposal',
		noLink.type === 'refused' && noLink.code === 'connection_required',
		JSON.stringify(noLink)
	)
	const far = core.addDays(fx.today, 400)
	const outside = await say(pipeline, fx, ids.g, `moved from ${ids.pending.day} to ${far} 18:00`)
	check(
		'a target outside the sync window: outside_sync_window',
		outside.type === 'refused' && outside.code === 'outside_sync_window',
		JSON.stringify(outside)
	)
}

async function caseSeries(pipeline, fx, ids) {
	const day = core.addDays(fx.today, 3)
	const name = WEEKDAY_NAMES[core.weekdayOf(day) - 1]
	const before = commandRows(fx).length
	const block = await say(pipeline, fx, ids.s, `moved to ${name} 18:00 all lessons`)
	const ok =
		block.type === 'calendar_proposal' &&
		block.operation === 'move_series' &&
		block.target.kind === 'series' &&
		block.target.area === 'all' &&
		block.target.from === ids.series.date &&
		commandRows(fx).length === before
	check('move all lessons to a weekday: a series proposal from allFrom (today)', ok, JSON.stringify(block))
	if (!ok) return
	const { commandId, finished, applied } = await confirmed(pipeline, fx, block, 'series')
	const command = commandRows(fx).find((row) => row.id === commandId)
	const input = command?.plan?.input
	check(
		'Confirm: move_series from allFrom, applied, no Undo',
		command?.operation === 'move_series' &&
			input?.from === ids.series.date &&
			input?.weekday === core.weekdayOf(day) &&
			input?.startTime === '18:00' &&
			finished.state === 'applied' &&
			applied?.state === 'applied' &&
			applied.undo === null,
		JSON.stringify({ operation: command?.operation, from: input?.from, finished: finished.state, undo: applied?.undo })
	)
	const back = await undo(pipeline, fx, block.actionId)
	check('Undo of a series move is refused', back.kind === 'not_undoable')
	const marked = await say(
		pipeline,
		fx,
		ids.s,
		`moved to ${name} 18:00 all lessons from ${core.addDays(ids.series.date, -14)}`
	)
	check(
		'all lessons from a date before a marked occurrence: series_marked, no proposal',
		marked.type === 'refused' && marked.code === 'series_marked',
		JSON.stringify(marked)
	)
}

async function tell(pipeline, fx, student, intent, extra = {}) {
	const db = pipeline.app.db
	const teacher = await insertMessage(db, {
		accountId: fx.accountId,
		conversationId: fx.conversationId,
		role: 'teacher',
		body: `@${student.name} cancel all lessons`,
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
	const block = await executeIntent(
		db,
		chatContext(fx, extra),
		{ conversationId: fx.conversationId, messageId: teacher.id },
		{ kind: 'lesson', intent: { studentId: student.id, ...intent } },
		persist
	)
	if (!chatBlock.safeParse(block).success) throw new Error('the reply block does not match the contract')
	return block
}

function seriesRows(studentId) {
	const series = `(select id from lesson_series where student_id = ${quote(studentId)})`
	const [row] = rows(
		`select (select count(*)::int from lesson_series where student_id = ${quote(studentId)}) as series, (select count(*)::int from lesson_exceptions where series_id in ${series}) as exceptions, (select count(*)::int from lesson_marks where series_id in ${series}) as marks, (select count(*)::int from lessons where student_id = ${quote(studentId)}) as singles`
	)
	return row
}

async function shownBlock(pipeline, fx, actionId) {
	const messages = await listMessages(pipeline.app.db, fx.accountId, fx.conversationId)
	for (const message of messages)
		for (const block of message.blocks)
			if (block.type === 'calendar_proposal' && block.actionId === actionId) return block
	return null
}

async function caseEndSeries(pipeline, fx, ids) {
	const series = ids.ending
	const student = ids.t
	await markOccurrence(
		pipeline.app.db,
		fx.accountId,
		series.id,
		core.addDays(series.date, -7),
		{ kind: 'done' },
		new Date()
	)
	const before = commandRows(fx).length
	const counts = seriesRows(student.id)
	const block = await tell(pipeline, fx, student, { kind: 'cancel', scope: 'series' })
	const ok =
		block.type === 'calendar_proposal' &&
		block.operation === 'end_series' &&
		block.state === 'proposed' &&
		block.target.kind === 'series_end' &&
		block.target.lastOn === fx.calendarToday &&
		block.target.from === core.addDays(fx.calendarToday, 1) &&
		block.undo === null &&
		commandRows(fx).length === before
	check('cancel all lessons of a series: an end_series proposal and no command', ok, JSON.stringify(block))
	if (!ok) return
	const endsBefore = rows(`select ends_on::text as ends_on from lesson_series where id = ${quote(series.id)}`)[0]
	check('the series keeps its end until Confirm', endsBefore?.ends_on === null, JSON.stringify(endsBefore))
	const { pending, commandId, finished, applied } = await confirmed(pipeline, fx, block, 'end series')
	const command = commandRows(fx).find((row) => row.id === commandId)
	const ended = rows(`select ends_on::text as ends_on from lesson_series where id = ${quote(series.id)}`)[0]
	check(
		'Confirm: an end_series command through the journal, Saved only after Google and the projection',
		pending.state === 'pending' &&
			command?.operation === 'end_series' &&
			command.plan?.input?.lastOn === block.target.lastOn &&
			finished.state === 'applied' &&
			applied?.state === 'applied' &&
			applied.undo === null,
		JSON.stringify({ pending: pending.state, operation: command?.operation, finished: finished.state })
	)
	check(
		'the series ends on lastOn and its series, exception, mark and lesson rows stay',
		ended?.ends_on === block.target.lastOn && JSON.stringify(seriesRows(student.id)) === JSON.stringify(counts),
		JSON.stringify({ ended, counts, after: seriesRows(student.id) })
	)
	const back = await undo(pipeline, fx, block.actionId)
	check('Undo of a series end is refused', back.kind === 'not_undoable')
	const offline = await tell(pipeline, fx, student, { kind: 'cancel', scope: 'series' }, { calendarEnabled: false })
	check(
		'Google not configured: cancel all lessons is refused with connection_required',
		offline.type === 'refused' && offline.code === 'connection_required',
		JSON.stringify(offline)
	)
}

async function caseKeep(pipeline, fx, ids) {
	const lesson = ids.kept
	const block = await say(pipeline, fx, ids.k, `moved from ${lesson.day} to tomorrow 21:00`)
	if (block.type !== 'calendar_proposal') {
		check('keep: a move proposal', false, JSON.stringify(block))
		return null
	}
	const before = commandRows(fx).length
	const kept = await declineAction(pipeline.app.db, chatContext(fx), block.actionId)
	const row = action(block.actionId)
	check(
		'Keep stores declined on the server and sends nothing to Google',
		kept.kind === 'ok' &&
			kept.block.type === 'calendar_proposal' &&
			kept.block.state === 'declined' &&
			row.state === 'refused' &&
			row.result?.state === 'declined' &&
			commandRows(fx).length === before,
		JSON.stringify({ kept, state: row.state, result: row.result })
	)
	const reread = await shownBlock(pipeline, fx, block.actionId)
	check(
		'after rereading the conversation the proposal is declined',
		reread?.state === 'declined',
		JSON.stringify(reread)
	)
	const late = await confirm(pipeline, fx, block.actionId)
	const again = await declineAction(pipeline.app.db, chatContext(fx), block.actionId)
	check(
		'Confirm and a second Keep after Keep return the same block and send no command',
		late?.state === 'declined' &&
			again.kind === 'ok' &&
			again.block.state === 'declined' &&
			action(block.actionId).result?.state === 'declined' &&
			commandRows(fx).length === before,
		JSON.stringify({ late: late?.state, again: again.kind === 'ok' ? again.block.state : again.kind })
	)
	const status = rows(`select status, starts_at from lessons where id = ${quote(lesson.id)}`)[0]
	check(
		'the kept lesson stays in place',
		status?.status === 'scheduled' && new Date(status.starts_at).getTime() === lesson.startsAt.getTime(),
		JSON.stringify(status)
	)
	return block.actionId
}

async function caseRoutes(fx, actionId, markActionId, ids) {
	const api = await startCalendarApi({ port: PORT, envFile: '.env.test' })
	try {
		const cookie = await teacherCookie(api)
		const shown = await call(api, 'POST', `/chat/actions/${actionId}/check`, { cookie, body: {} })
		const again = await call(api, 'POST', `/chat/actions/${actionId}/confirm`, { cookie, body: {} })
		const unknown = await call(api, 'POST', `/chat/actions/${randomUUID()}/check`, { cookie, body: {} })
		const extra = await call(api, 'POST', `/chat/actions/${actionId}/confirm`, { cookie, body: { target: 'x' } })
		const mark = markActionId
			? await call(api, 'POST', `/chat/actions/${markActionId}/confirm`, { cookie, body: {} })
			: { status: 409 }
		check(
			'routes: check 200 and a repeated confirm 202 with the persisted block, unknown 404, extra body 400, a mark action 409',
			shown.status === 200 &&
				calendarActionResponse.safeParse(shown.json).success &&
				again.status === 202 &&
				again.json?.block?.state === shown.json?.block?.state &&
				unknown.status === 404 &&
				extra.status === 400 &&
				mark.status === 409,
			JSON.stringify([shown.status, again.status, unknown.status, extra.status, mark.status])
		)
		const facts = await call(api, 'GET', `/chat/records?studentId=${ids.s.id}`, { cookie })
		const next = facts.json?.nextLesson
		check(
			'the facts next lesson carries its ref and lesson day',
			facts.status === 200 &&
				next?.result === 'known' &&
				next.ref?.kind === 'series' &&
				rows(`select student_id from lesson_series where id = ${quote(next.ref.seriesId)}`)[0]?.student_id ===
					ids.s.id &&
				next.date === core.lessonDay(new Date(next.startsAt), fx.zone),
			JSON.stringify(next)
		)
		if (fx.keptActionId) {
			const declined = await call(api, 'POST', `/chat/actions/${fx.keptActionId}/decline`, { cookie, body: {} })
			check(
				'routes: decline of a kept calendar proposal answers 200 with the declined block',
				declined.status === 200 &&
					calendarActionResponse.safeParse(declined.json).success &&
					declined.json.block.state === 'declined',
				JSON.stringify([declined.status, declined.json?.block?.state])
			)
		}
		check('api log has no fixture name', !api.logs().includes('Alex Example'))
	} finally {
		await api.stop()
	}
}

let pipeline = null
let seeded = false
const fx = { conversations: [] }
try {
	if (!(await offline())) throw new Error('Google hosts resolve: the offline preload is not active')
	const [other] = rows(
		`select count(*)::int as n from google_commands c join google_connections g on g.id = c.connection_id
where c.state not in ('applied', 'failed') and g.calendar_id not like '${SYNTHETIC_CALENDAR_ID}%'`
	)
	if (other.n !== 0) throw new Error(`refused: ${other.n} unresolved commands outside the synthetic calendar`)
	seed('down', TARGET)
	console.log(`fixture tails removed ${purgeCards()}`)
	const up = seed('up', TARGET, 'week')
	if (!/SEED_UP test week/.test(up)) throw new Error('calendar-seed up did not finish')
	seeded = true
	pipeline = await startPipeline()
	const [connection] = rows(
		`select id, account_id, calendar_id from google_connections where calendar_id like '${SYNTHETIC_CALENDAR_ID}%' and retired_at is null`
	)
	const [{ zone }] = rows(
		`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(connection.account_id)}), 'Asia/Ho_Chi_Minh') as zone`
	)
	Object.assign(fx, {
		connection,
		accountId: connection.account_id,
		zone,
		today: core.lessonDay(new Date(), zone),
		calendarToday: core.scheduleToday(new Date(), zone),
		target: { accountId: connection.account_id, connectionId: connection.id, calendarId: connection.calendar_id },
	})
	const startedAgo = Date.now() - core.startOfLessonDay(fx.today, zone).getTime()
	if (startedAgo < EARLIEST_LESSON_MS)
		throw new Error(
			`the lesson day started less than ${EARLIEST_LESSON_MS / 60000} minutes ago: the fixture lessons of today would fall into the previous lesson day, run after ${core.zonedParts(new Date(core.startOfLessonDay(fx.today, zone).getTime() + EARLIEST_LESSON_MS), zone).time}`
		)
	const ids = {
		a: card(1),
		b: card(2),
		c: card(3),
		d: card(4),
		e: card(5),
		f: card(6),
		g: card(7),
		s: card(8),
		t: card(9),
		k: card(10),
	}
	const now = Date.now()
	ids.started = await createLesson(pipeline, fx, ids.a, minuteFloor(now - 30 * 60000))
	ids.cancel = await createLesson(pipeline, fx, ids.b, minuteFloor(now - 40 * 60000))
	ids.done = await createLesson(pipeline, fx, ids.c, minuteFloor(now - 50 * 60000))
	ids.noShow = await createLesson(pipeline, fx, ids.d, minuteFloor(now - 120 * 60000))
	ids.race = await createLesson(pipeline, fx, ids.e, minuteFloor(now - 130 * 60000))
	ids.earlier = await createLesson(pipeline, fx, ids.f, minuteFloor(now - 140 * 60000))
	ids.pending = await createLesson(pipeline, fx, ids.g, minuteFloor(now - 20 * 60000))
	ids.series = await createSeries(pipeline, fx, ids.s, minuteFloor(now - 30 * 60000))
	ids.ending = await createSeries(pipeline, fx, ids.t, minuteFloor(now - 35 * 60000))
	ids.kept = await createLesson(pipeline, fx, ids.k, minuteFloor(now - 25 * 60000))
	await project(pipeline, fx)
	const doneMark = await markLesson(pipeline.app.db, fx.accountId, ids.done.id, { kind: 'done' }, new Date())
	const held = [
		await markOccurrence(
			pipeline.app.db,
			fx.accountId,
			ids.series.id,
			core.addDays(ids.series.date, -14),
			{ kind: 'done' },
			new Date()
		),
		await markOccurrence(
			pipeline.app.db,
			fx.accountId,
			ids.series.id,
			core.addDays(ids.series.date, -7),
			{ kind: 'no_show' },
			new Date()
		),
	]
	if (doneMark.kind !== 'ok' || held.some((result) => result.kind !== 'ok'))
		throw new Error('fixture marks were refused')
	const conversation = await createConversation(pipeline.app.db, fx.accountId)
	fx.conversationId = conversation.id
	fx.conversations.push(conversation.id)
	freshAt(fx)
	console.log(`FIXTURES cards 10 series ${hash(ids.series.id)} today ${fx.today} zone_set ${fx.zone.length > 0}`)
	const moved = await caseMove(pipeline, fx, ids)
	await caseCancel(pipeline, fx, ids)
	await caseDone(pipeline, fx, ids)
	await caseNoShowUndo(pipeline, fx, ids)
	await caseRevisionRace(pipeline, fx, ids)
	await caseEarlier(pipeline, fx, ids)
	await caseGoogleEdit(pipeline, fx, ids, moved)
	await casePending(pipeline, fx, ids)
	await caseRefusals(pipeline, fx, ids)
	await caseSeries(pipeline, fx, ids)
	await caseEndSeries(pipeline, fx, ids)
	fx.keptActionId = await caseKeep(pipeline, fx, ids)
	await say(pipeline, fx, ids.c, `was ${ids.done.day}`)
	const [markAction] = rows(
		`select id from chat_actions where conversation_id = ${quote(fx.conversationId)} and kind = 'mark' limit 1`
	)
	await caseRoutes(fx, moved.block.actionId, markAction?.id ?? null, ids)
} catch (error) {
	failures++
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`FAIL calendar crashed ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
} finally {
	if (pipeline) await pipeline.close()
	try {
		purgeChats(fx.conversations)
		if (seeded) seed('down', TARGET)
		purgeCards()
		const [left] = rows(
			`select (select count(*)::int from students where import_key like ${quote(`${KEY}%`)}) as cards, (select count(*)::int from chat_conversations where id in (${fx.conversations.length ? fx.conversations.map(quote).join(', ') : 'null'})) as chats`
		)
		console.log(`fixture cards left ${left.cards} conversations left ${left.chats}`)
		if (left.cards !== 0 || left.chats !== 0) failures++
	} catch (error) {
		failures++
		console.log(`cleanup failed: ${error instanceof Error ? error.message : 'unexpected failure'}`)
	}
}
if (failures === 0) console.log('CHAT_CALENDAR_OK')
else console.log(`calendar failures ${failures}`)
process.exit(failures === 0 ? 0 : 1)
