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
if (process.env.CHAT_TARGET_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, CHAT_TARGET_OFFLINE: '1' } }
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
const { markLesson, markOccurrence } = await import(`${ROOT}/apps/api/src/schedule/marks.ts`)
const { readLessonDay, readToday } = await import(`${ROOT}/apps/api/src/today/today.ts`)
const { validateMentions } = await import(`${ROOT}/apps/api/src/chat/mentions.ts`)
const { parseQuickCommand } = await import(`${ROOT}/apps/api/src/chat/quick-command.ts`)
const { resolveLessonTarget } = await import(`${ROOT}/apps/api/src/chat/lesson-target.ts`)
const { lessonTargetResult, mentionBinding } = await import(`${ROOT}/packages/contracts/src/index.ts`)

const KEY = 'chat-target:'
const TEST_TEACHER = 'teacher.fixture@example.test'
const NAME = 'Alex Example 228'
const DST_ZONE = 'Europe/Berlin'
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

function purge() {
	const cards = `(select id from students where import_key like ${quote(`${KEY}%`)})`
	const series = `(select id from lesson_series where student_id in ${cards})`
	const singles = `(select id from lessons where student_id in ${cards})`
	const [before] = rows(`select count(*)::int as n from students where import_key like ${quote(`${KEY}%`)}`)
	rows(`begin;
delete from lesson_comments where student_id in ${cards};
delete from lesson_marks where series_id in ${series} or lesson_id in ${singles};
delete from lesson_exceptions where series_id in ${series};
delete from lessons where student_id in ${cards};
delete from lesson_series where student_id in ${cards};
delete from students where import_key like ${quote(`${KEY}%`)};
commit;`)
	return before.n
}

function tableCounts() {
	return rows(
		`select table_name as t, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`
	)
		.map((row) => `${row.t}=${row.n}`)
		.join(',')
}

function createStub() {
	const events = new Map()
	let counter = 0
	const etag = () => `"chat-target-${Date.now()}-${(counter += 1)}"`
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
		async patch() {
			throw new Error('patch is not expected')
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

function mappingEvent(localId, kind) {
	const [row] = rows(
		`select event_id from google_event_mappings where local_entity_id = ${quote(localId)} and entity_kind = ${quote(kind)} and state = 'active'`
	)
	return row?.event_id
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

async function run(pipeline, accountId, command) {
	const receipt = await pipeline.commands.submitCalendarCommand({ accountId, now: new Date() }, command)
	const access = await pipeline.credentials.accessToken(accountId)
	const pending = await readCommand(pipeline.app.db, accountId, receipt.commandId)
	await dispatchCommand(access, pending, pipeline.stub)
	const finished = await readCommand(pipeline.app.db, accountId, receipt.commandId)
	if (finished.state !== 'applied')
		throw new Error(`${command.operation} ended ${finished.state} with ${finished.issue ?? 'no issue'}`)
}

function card(n, status = 'active') {
	const [row] = rows(
		`insert into students (display_name, status, import_key, archived_at) values (${quote(`${NAME}${n}`)}, ${quote(status)}, ${quote(`${KEY}${n}-${randomUUID()}`)}, ${status === 'archived' ? 'now()' : 'null'}) returning id`
	)
	return row.id
}

function binding(text, name, studentId) {
	const start = text.indexOf(`@${name}`) + 1
	return mentionBinding.parse({ studentId, text: name, start, end: start + name.length })
}

async function fixtures(pipeline) {
	const [connection] = rows(
		`select id, account_id from google_connections where calendar_id like '${SYNTHETIC_CALENDAR_ID}%' and retired_at is null`
	)
	const accountId = connection.account_id
	const [{ zone }] = rows(
		`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(accountId)}), 'Asia/Ho_Chi_Minh') as zone`
	)
	const today = core.lessonDay(new Date(), zone)
	const now = new Date(core.startOfLessonDay(today, zone).getTime() + 10 * 3600000)
	return { connection, accountId, zone, today, now }
}

async function createLesson(pipeline, fx, studentId, date, time) {
	const before = new Set(rows(`select id from lessons where student_id = ${quote(studentId)}`).map((row) => row.id))
	await run(pipeline, fx.accountId, {
		operation: 'create',
		input: {
			studentId,
			date,
			startTime: time,
			durationMinutes: 60,
			repeats: 'once',
			expectedDefaultTimeZone: fx.zone,
			requestId: randomUUID(),
			expectedVersion: 'fixture-version',
		},
	})
	const created = rows(`select id from lessons where student_id = ${quote(studentId)}`).find(
		(row) => !before.has(row.id)
	)
	if (!created) throw new Error('a fixture lesson was not created')
	return created.id
}

async function createSeries(pipeline, fx, studentId, startsOn, time) {
	await run(pipeline, fx.accountId, {
		operation: 'create',
		input: {
			studentId,
			date: startsOn,
			startTime: time,
			durationMinutes: 60,
			repeats: 'weekly',
			expectedDefaultTimeZone: fx.zone,
			requestId: randomUUID(),
			expectedVersion: 'fixture-version',
		},
	})
	const [series] = rows(`select id from lesson_series where student_id = ${quote(studentId)}`)
	const master = mappingEvent(series.id, 'series')
	const instances = [...pipeline.stub.events.values()].filter((event) => event.recurringEventId === master)
	await pipeline.app.db.transaction((tx) =>
		upsertEventFacts(
			tx,
			{ accountId: fx.accountId, connectionId: fx.connection.id, calendarId: SYNTHETIC_CALENDAR_ID },
			[
				...instances.map(resourceFact),
				{
					eventId: master,
					status: 'confirmed',
					master: true,
					recurrence: {
						recurrenceKind: 'weekly',
						recurrenceWeekday: core.weekdayOf(startsOn),
						recurrenceFrequency: 'weekly',
						recurrenceInterval: 1,
						recurrenceUntil: null,
					},
					factAt: new Date(),
				},
			]
		)
	)
	return series.id
}

function freshAt(fx) {
	rows(
		`update google_sync_state set last_full_at = ${quote(fx.now.toISOString())}::timestamptz, last_incremental_at = ${quote(fx.now.toISOString())}::timestamptz, issue = null where connection_id = ${quote(fx.connection.id)}`
	)
}

function dstGap(today) {
	for (let offset = 1; offset <= 366; offset += 1) {
		const date = core.addDays(today, offset)
		if (core.localTimeCandidates(date, '02:30', DST_ZONE).length === 0) return date
	}
	return null
}

function place(zone, date, time) {
	return core.zonedInstant(date, time, zone).toISOString()
}

async function cases(pipeline, fx, ids) {
	const db = pipeline.app.db
	const context = { accountId: fx.accountId, now: fx.now, defaultTimeZone: fx.zone }
	const tomorrow = core.addDays(fx.today, 1)
	const say = (studentId, name, rest) => {
		const text = `@${name} ${rest}`
		return { text, bindings: [binding(text, name, studentId)] }
	}
	const parse = (message, ctx = context) =>
		parseQuickCommand(message.text, message.bindings, ctx.now, ctx.defaultTimeZone)
	const resolve = async (message, ctx = context) => {
		const intent = parse(message, ctx)
		if (!intent) return { kind: 'unparsed' }
		const result = await resolveLessonTarget(db, ctx, intent)
		if (!lessonTargetResult.safeParse(result).success) return { kind: 'invalid', result }
		return result
	}
	const nameOf = (n) => `${NAME}${n}`
	const counts = tableCounts()

	const twinText = `@${nameOf(0)} was`
	const twinCheck = await validateMentions(db, fx.accountId, twinText, [binding(twinText, nameOf(0), ids.twinB)])
	const twinIntent = parse({ text: twinText, bindings: [binding(twinText, nameOf(0), ids.twinB)] })
	const twinResult = await resolve({ text: twinText, bindings: [binding(twinText, nameOf(0), ids.twinB)] })
	check(
		'two students with one name: the binding keeps the chosen id and the other one is never picked',
		twinCheck.kind === 'ok' &&
			twinCheck.bindings[0].studentId === ids.twinB &&
			twinIntent?.studentId === ids.twinB &&
			twinResult.kind === 'clarify' &&
			twinResult.question === 'date_time' &&
			twinResult.options.length === 0,
		JSON.stringify(twinResult)
	)
	const renamedText = `@${nameOf(9)} was`
	const renamed = await validateMentions(db, fx.accountId, renamedText, [binding(renamedText, nameOf(9), ids.renamed)])
	const archivedText = `@${nameOf(8)} was`
	const archived = await validateMentions(db, fx.accountId, archivedText, [
		binding(archivedText, nameOf(8), ids.archived),
	])
	const editedText = `@Alex Exampel 2281 was`
	const edited = await validateMentions(db, fx.accountId, editedText, [
		{ studentId: ids.a, text: nameOf(1), start: 1, end: 1 + nameOf(1).length },
	])
	const outside = await validateMentions(db, fx.accountId, `@${nameOf(1)}`, [
		{ studentId: ids.a, text: nameOf(1), start: 1, end: 40 },
	])
	check(
		'renamed, archived, edited and misplaced bindings are stale',
		renamed.kind === 'stale' &&
			renamed.studentId === ids.renamed &&
			archived.kind === 'stale' &&
			edited.kind === 'stale' &&
			outside.kind === 'stale'
	)
	check(
		'a binding that cuts a surrogate pair is refused by the contract',
		!mentionBinding.safeParse({ studentId: ids.a, text: '\ud83d', start: 0, end: 1 }).success
	)
	const typed = parseQuickCommand(`@${nameOf(1)} was`, [], fx.now, fx.zone)
	check('a name typed without a binding is not parsed into a student', typed === null)

	const forms = [
		['was', { kind: 'done' }],
		['was at the lesson today', { kind: 'done', date: fx.today }],
		['was yesterday', { kind: 'done', date: core.addDays(fx.today, -1) }],
		['no-show', { kind: 'no_show' }],
		["didn't come", { kind: 'no_show' }],
		['didn’t happen', { kind: 'cancel' }],
		['didnt happen today', { kind: 'cancel', date: fx.today }],
		['moved to tomorrow 18:00', { kind: 'move', target: { date: tomorrow, time: '18:00' } }],
		[
			`moved to ${core.addDays(fx.today, 3)} 18:00`,
			{ kind: 'move', target: { date: core.addDays(fx.today, 3), time: '18:00' } },
		],
		['moved to ', { kind: 'move' }],
		['moved to tomorrow 18:00 all lessons', { kind: 'move', scope: 'series' }],
		['Was.', { kind: 'done' }],
	]
	for (const [rest, expected] of forms) {
		const intent = parse(say(ids.a, nameOf(1), rest))
		const ok =
			intent !== null &&
			intent.studentId === ids.a &&
			intent.kind === expected.kind &&
			(expected.date === undefined || intent.date === expected.date) &&
			(expected.target === undefined ||
				(intent.target?.date === expected.target.date && intent.target?.time === expected.target.time)) &&
			intent.scope === (expected.scope ?? 'one')
		check(`quick form "${rest.trim()}" parses to ${expected.kind}`, ok, JSON.stringify(intent))
	}
	for (const rest of ['was great today', 'pays 2000', 'moved to the moon', 'was at the lesson all lessons']) {
		check(`free text "${rest}" is left to the model`, parse(say(ids.a, nameOf(1), rest)) === null)
	}

	const two = await resolve(say(ids.b, nameOf(2), 'was'))
	check(
		'no date and two started lessons today: clarify with both, in start order, without personal fields',
		two.kind === 'clarify' &&
			two.question === 'which_lesson' &&
			two.options.length === 2 &&
			two.options[0].time === '08:00' &&
			two.options[1].time === '10:00' &&
			Object.keys(two.options[0]).sort().join() === 'date,startsAt,time,timeZone',
		JSON.stringify(two)
	)
	const twoTime = await resolve(say(ids.b, nameOf(2), 'was today 10:00'))
	check(
		'a date and a time narrow two lessons to one',
		twoTime.kind === 'lesson' && twoTime.lesson.startsAt === place(fx.zone, fx.today, '10:00'),
		JSON.stringify(twoTime)
	)
	const none = await resolve(say(ids.b, nameOf(2), 'no-show yesterday'))
	check(
		'a day with no lesson: clarify asking for the date and time',
		none.kind === 'clarify' && none.question === 'date_time' && none.options.length === 0
	)

	const markA = await resolve(say(ids.a, nameOf(1), 'was'))
	check(
		'no date and one started unmarked lesson today: that lesson, with its key, outcome and started flag',
		markA.kind === 'lesson' &&
			markA.intent === 'done' &&
			markA.lesson.ref.kind === 'single' &&
			markA.lesson.ref.lessonId === ids.aLesson &&
			markA.lesson.outcome === 'planned' &&
			markA.lesson.mark === null &&
			markA.lesson.started === true,
		JSON.stringify(markA)
	)
	const moveA = await resolve(say(ids.a, nameOf(1), 'moved to tomorrow 18:00'))
	check(
		'moved to tomorrow 18:00 moves one started lesson to tomorrow in the teacher zone',
		moveA.kind === 'lesson' &&
			moveA.intent === 'move' &&
			moveA.lesson.ref.lessonId === ids.aLesson &&
			moveA.move?.startsAt === place(fx.zone, tomorrow, '18:00') &&
			moveA.move?.durationMinutes === 60,
		JSON.stringify(moveA)
	)
	const isoDay = core.addDays(fx.today, 3)
	const moveIso = await resolve(say(ids.a, nameOf(1), `moved to ${isoDay} 18:00`))
	check(
		'moved to an ISO date and time',
		moveIso.kind === 'lesson' && moveIso.move?.startsAt === place(fx.zone, isoDay, '18:00')
	)
	const moveOpen = await resolve(say(ids.a, nameOf(1), 'moved to '))
	check(
		'moved to without a date: clarify asking for the date and time',
		moveOpen.kind === 'clarify' && moveOpen.question === 'date_time'
	)
	const far = core.addDays(fx.today, 400)
	const moveFar = await resolve(say(ids.a, nameOf(1), `moved to ${far} 18:00`))
	check(
		'a target outside the sync window: outside_sync_window',
		moveFar.kind === 'refused' && moveFar.code === 'outside_sync_window'
	)

	const future = await resolve(say(ids.d, nameOf(4), 'was at the lesson today'))
	const futureBare = await resolve(say(ids.d, nameOf(4), 'was'))
	const futureMove = await resolve(say(ids.d, nameOf(4), 'moved to tomorrow 16:00'))
	const futureComment = await resolveLessonTarget(db, context, {
		kind: 'comment',
		studentId: ids.d,
		date: fx.today,
		scope: 'one',
	})
	check(
		'a lesson later today: was gives lesson_not_started, a bare was asks, the move finds it from the calendar',
		future.kind === 'refused' &&
			future.code === 'lesson_not_started' &&
			futureBare.kind === 'clarify' &&
			futureMove.kind === 'lesson' &&
			futureMove.lesson.ref.lessonId === ids.dLesson &&
			futureMove.lesson.started === false &&
			futureComment.kind === 'refused' &&
			futureComment.code === 'lesson_not_started',
		JSON.stringify({ future, futureMove })
	)

	const done = await resolve(say(ids.e, nameOf(5), "didn't happen"))
	const doneMove = await resolve(say(ids.e, nameOf(5), 'moved to tomorrow 18:00'))
	check(
		'a done lesson: cancel and move are lesson_done',
		done.kind === 'refused' &&
			done.code === 'lesson_done' &&
			doneMove.kind === 'refused' &&
			doneMove.code === 'lesson_done'
	)

	const oldMark = await resolve(say(ids.f, nameOf(6), `was ${ids.fDate}`))
	const oldMove = await resolve(say(ids.f, nameOf(6), `moved from ${ids.fDate} to tomorrow 18:00`))
	check(
		'a week outside the sync window: the move is outside_sync_window, the mark of that week is allowed',
		oldMark.kind === 'lesson' &&
			oldMark.lesson.ref.lessonId === ids.fLesson &&
			oldMove.kind === 'refused' &&
			oldMove.code === 'outside_sync_window',
		JSON.stringify({ oldMark, oldMove })
	)

	const nextWeek = await resolve(say(ids.g, nameOf(7), `moved from ${ids.gDate} to ${ids.gDate} 12:00`))
	check(
		'a dated lesson in another week is read from that week of the calendar',
		nextWeek.kind === 'lesson' &&
			nextWeek.lesson.ref.lessonId === ids.gLesson &&
			nextWeek.move?.startsAt === place(fx.zone, ids.gDate, '12:00'),
		JSON.stringify(nextWeek)
	)

	const bare = { accountId: randomUUID(), now: fx.now, defaultTimeZone: fx.zone }
	const noLink = await resolve(say(ids.a, nameOf(1), 'moved to tomorrow 18:00'), bare)
	const noLinkCancel = await resolve(say(ids.a, nameOf(1), "didn't happen"), bare)
	const noLinkMark = await resolve(say(ids.a, nameOf(1), 'was'), bare)
	check(
		'no Google connection: move and cancel are connection_required, the mark still resolves',
		noLink.kind === 'refused' &&
			noLink.code === 'connection_required' &&
			noLinkCancel.kind === 'refused' &&
			noLinkCancel.code === 'connection_required' &&
			noLinkMark.kind === 'lesson' &&
			noLinkMark.lesson.ref.lessonId === ids.aLesson
	)

	const gap = dstGap(fx.today)
	const berlin = { ...context, defaultTimeZone: DST_ZONE }
	const dst = gap ? await resolve(say(ids.a, nameOf(1), `moved to ${gap} 02:30`), berlin) : null
	check(
		`a target time that does not exist in the teacher zone (${DST_ZONE}, ${gap}): clarify`,
		dst?.kind === 'clarify' && dst.question === 'date_time',
		JSON.stringify(dst)
	)

	const all = await resolve(say(ids.s, nameOf(3), 'moved to tomorrow 11:00 all lessons'))
	check(
		'all lessons: the series from allFrom, today started unmarked occurrence after the last mark included',
		all.kind === 'series' &&
			all.seriesId === ids.series &&
			all.area === 'all' &&
			all.from === fx.today &&
			all.allFrom === fx.today &&
			all.move?.startsAt === place(fx.zone, tomorrow, '11:00'),
		JSON.stringify(all)
	)
	const marked = await resolve(
		say(ids.s, nameOf(3), `moved to tomorrow 11:00 all lessons from ${core.addDays(fx.today, -14)}`)
	)
	check(
		'all lessons from a date before the no_show occurrence: series_marked',
		marked.kind === 'refused' && marked.code === 'series_marked',
		JSON.stringify(marked)
	)
	const fromToday = await resolve(say(ids.s, nameOf(3), `moved to tomorrow 11:00 every week from ${fx.today}`))
	check(
		'every week from allFrom: following from the named date',
		fromToday.kind === 'series' && fromToday.area === 'following' && fromToday.from === fx.today
	)
	const single = await resolve(say(ids.a, nameOf(1), 'moved to tomorrow 18:00 whole series'))
	check('series words on a single lesson: clarify', single.kind === 'clarify', JSON.stringify(single))

	const note = await resolveLessonTarget(db, context, { kind: 'note', studentId: ids.a, scope: 'one' })
	check('a note needs no lesson', note.kind === 'student' && note.studentId === ids.a)

	const day = await readLessonDay(db, context, fx.today)
	const today = await readToday(db, context, 2)
	check(
		'readToday is readLessonDay of today plus pays soon',
		JSON.stringify(day.lessons) === JSON.stringify(today.lessons) &&
			JSON.stringify(day.earlier) === JSON.stringify(today.earlier) &&
			today.date === fx.today
	)
	check('the resolver wrote nothing', tableCounts() === counts)
}

let pipeline = null
let seeded = false
try {
	if (!(await offline())) throw new Error('Google hosts resolve: the offline preload is not active')
	const [other] = rows(
		`select count(*)::int as n from google_commands c join google_connections g on g.id = c.connection_id
where c.state not in ('applied', 'failed') and g.calendar_id not like '${SYNTHETIC_CALENDAR_ID}%'`
	)
	if (other.n !== 0) throw new Error(`refused: ${other.n} unresolved commands outside the synthetic calendar`)
	seed('down', TARGET)
	console.log(`fixture tails removed ${purge()}`)
	const ids = {
		a: card(1),
		b: card(2),
		s: card(3),
		d: card(4),
		e: card(5),
		f: card(6),
		g: card(7),
		twinA: card(0),
		twinB: card(0),
		archived: card(8, 'archived'),
		renamed: card(9),
	}
	rows(`update students set display_name = ${quote(`${NAME}9 Renamed`)} where id = ${quote(ids.renamed)}`)
	const [{ zone: preZone }] = rows(
		`select coalesce((select s.default_time_zone from teacher_settings s join accounts a on a.id = s.account_id where a.login = ${quote(TEST_TEACHER)}), 'Asia/Ho_Chi_Minh') as zone`
	)
	ids.fDate = core.addDays(core.lessonDay(new Date(), preZone), -70)
	const [old] = rows(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(ids.f)}, ${quote(core.zonedInstant(ids.fDate, '10:00', preZone).toISOString())}, 60, 'scheduled') returning id`
	)
	ids.fLesson = old.id
	const up = seed('up', TARGET, 'week')
	if (!/SEED_UP test week/.test(up)) throw new Error('calendar-seed up did not finish')
	seeded = true
	pipeline = await startPipeline()
	const fx = await fixtures(pipeline)
	if (fx.zone !== preZone) throw new Error('the teacher zone changed while seeding')
	ids.aLesson = await createLesson(pipeline, fx, ids.a, fx.today, '10:00')
	await createLesson(pipeline, fx, ids.b, fx.today, '08:00')
	await createLesson(pipeline, fx, ids.b, fx.today, '10:00')
	ids.dLesson = await createLesson(pipeline, fx, ids.d, fx.today, '15:00')
	const eLesson = await createLesson(pipeline, fx, ids.e, fx.today, '09:00')
	ids.gDate = core.addDays(core.mondayOf(fx.today), 7)
	ids.gLesson = await createLesson(pipeline, fx, ids.g, ids.gDate, '10:00')
	ids.series = await createSeries(pipeline, fx, ids.s, core.addDays(fx.today, -21), '10:00')
	const marks = [
		await markLesson(pipeline.app.db, fx.accountId, eLesson, { kind: 'done' }, fx.now),
		await markOccurrence(
			pipeline.app.db,
			fx.accountId,
			ids.series,
			core.addDays(fx.today, -14),
			{ kind: 'done' },
			fx.now
		),
		await markOccurrence(
			pipeline.app.db,
			fx.accountId,
			ids.series,
			core.addDays(fx.today, -7),
			{ kind: 'no_show' },
			fx.now
		),
	]
	if (marks.some((result) => result.kind !== 'ok'))
		throw new Error(`fixture marks refused: ${marks.map((result) => result.kind).join(' ')}`)
	freshAt(fx)
	console.log(`FIXTURES cards 11 lessons 7 series ${hash(ids.series)} today ${fx.today} now ${fx.now.toISOString()}`)
	await cases(pipeline, fx, ids)
} catch (error) {
	failures++
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`FAIL target crashed ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
} finally {
	if (pipeline) await pipeline.close()
	try {
		if (seeded) seed('down', TARGET)
		purge()
		const [left] = rows(`select count(*)::int as n from students where import_key like ${quote(`${KEY}%`)}`)
		console.log(`fixture cards left ${left.n}`)
		if (left.n !== 0) failures++
	} catch (error) {
		failures++
		console.log(`cleanup failed: ${error instanceof Error ? error.message : 'unexpected failure'}`)
	}
}
if (failures === 0) console.log('CHAT_TARGET_OK')
else console.log(`target failures ${failures}`)
process.exit(failures === 0 ? 0 : 1)
