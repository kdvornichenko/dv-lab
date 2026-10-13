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
	targetEnvFile,
} from './calendar-env.mjs'

const SECTIONS = ['pass', 'claim', 'loop']
const section = process.argv[2]
if (!SECTIONS.includes(section)) {
	console.log(`usage: node scripts/dev-checks/calendar-sync.mjs ${SECTIONS.join('|')}`)
	process.exit(2)
}
if (process.env.CALENDAR_SYNC_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname, section],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, CALENDAR_SYNC_OFFLINE: '1' } }
	)
	process.exit(child.status ?? 1)
}

const core = await import(`${ROOT}/packages/core/src/index.ts`)
const { createDb, resolveDatabaseUrl } = await import(`${ROOT}/packages/db/src/index.ts`)
const store = await import(`${ROOT}/apps/api/src/calendar/sync-store.ts`)
const { parseSyncPage } = await import(`${ROOT}/apps/api/src/calendar/provider-events.ts`)
const { syncEventRead, masterFact } = await import(`${ROOT}/apps/api/src/calendar/sync-provider.ts`)
const { SyncTokenGone } = await import(`${ROOT}/apps/api/src/calendar/gateway-sync.ts`)
const { upsertEventFacts } = await import(`${ROOT}/apps/api/src/calendar/projection.ts`)

const CARD_KEY = 'calendar-commands:alex-example-0002'
const PALETTE = ['#a4bdfc', '#7ae7bf', '#dbadff'].map((background, index) => ({
	id: String(index + 1),
	background,
	foreground: '#1d1d1d',
}))
const CALENDAR_COLOR = '#5484ed'
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
const stamp = (date) => date.toISOString().replace('.000Z', 'Z').replaceAll('-', '').replaceAll(':', '')
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

function fail(check, message) {
	throw new Error(`${check}: ${message}`)
}

function rows(text) {
	return calendarSql('test', 'migrator', text).rows
}

function runScript(name, ...args) {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/${name}`, ...args], {
		cwd: ROOT,
		encoding: 'utf8',
		timeout: 180000,
	})
	const out = result.stdout ?? ''
	if (result.status !== 0)
		throw new Error(`${name} ${args.join(' ')} exited ${result.status}: ${out.trim().split('\n').pop()}`)
	return out
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
delete from students where import_key = ${quote(CARD_KEY)};
commit;`)
}

async function offline() {
	try {
		await dns.promises.lookup('www.googleapis.com')
		return false
	} catch (error) {
		return String(error?.message).includes('calendar-offline')
	}
}

function openDb() {
	const fileEnv = parseEnv(readFileSync(targetEnvFile('test'), 'utf8'))
	return createDb(resolveDatabaseUrl('app', { ...fileEnv, NODE_ENV: 'test' }))
}

async function fixtures() {
	const out = runScript('calendar-commands.mjs', 'fixtures', 'test')
	if (!out.includes('CALENDAR_FIXTURES_OK')) throw new Error('calendar-commands fixtures did not finish')
	const [connection] = rows(
		`select id, account_id, calendar_id, calendar_time_zone, generation::int as generation from google_connections
where calendar_id like '${SYNTHETIC_CALENDAR_ID}%' and retired_at is null`
	)
	const [{ zone }] = rows(
		`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(connection.account_id)}), 'Asia/Ho_Chi_Minh') as zone`
	)
	const mappings = rows(
		`select entity_kind, event_id from google_event_mappings where connection_id = ${quote(connection.id)} and state = 'active'`
	)
	const single = mappings.find((row) => row.entity_kind === 'single')?.event_id
	const master = mappings.find((row) => row.entity_kind === 'series')?.event_id
	if (!single || !master) throw new Error('fixtures have no bound single or series')
	rows(`update google_sync_state set claimed_until = null, next_poll_at = now() - interval '1 second', next_full_at = timestamptz '2999-01-01 00:00:00+00',
channel_id = null, channel_resource_id = null, channel_token_hash = null, channel_expires_at = null, failure_count = 0, issue = null
where connection_id = ${quote(connection.id)}`)
	const target = { accountId: connection.account_id, connectionId: connection.id, calendarId: connection.calendar_id }
	return { connection, zone, single, master, target }
}

function cleanup() {
	runScript('calendar-seed.mjs', 'down', 'test')
	purgeCard()
}

function syncState(connectionId) {
	const [row] = rows(
		`select revision::text as revision, epoch::int as epoch, sync_token, requested_seq::int as requested, processed_seq::int as processed,
claimed_until, next_poll_at, next_full_at, last_full_at, window_start, window_end, palette, calendar_color, issue, failure_count
from google_sync_state where connection_id = ${quote(connectionId)}`
	)
	return { ...row, revision: BigInt(row.revision) }
}

function eventRows(connectionId) {
	return new Map(
		rows(
			`select event_id, row_kind, status, etag, starts_at, ends_at, char_length(description) as description_length, seen_epoch::int as seen_epoch,
recurring_event_id, recurrence_kind, recurrence_weekday, recurrence_interval, recurrence_until::text as recurrence_until
from google_calendar_events where connection_id = ${quote(connectionId)}`
		).map((row) => [row.event_id, row])
	)
}

function makeDue(connectionId) {
	rows(
		`update google_sync_state set next_poll_at = now() - interval '1 second', claimed_until = null where connection_id = ${quote(connectionId)}`
	)
}

function createGoogle(zone) {
	let version = 0
	const google = {
		zone,
		items: new Map(),
		masters: new Map(),
		changes: [],
		pageSize: 2500,
		goneOnPage: null,
		missing: new Set(),
		failReads: false,
		onPage: null,
		calls: { page: 0, master: 0, palette: 0, color: 0 },
		timed(id, date, time, minutes, extra = {}) {
			const start = core.zonedInstant(date, time, zone)
			const end = new Date(start.getTime() + minutes * 60000)
			return google.put({
				id,
				status: 'confirmed',
				summary: `Synthetic sync ${id.slice(0, 12)}`,
				start: { dateTime: start.toISOString(), timeZone: zone },
				end: { dateTime: end.toISOString(), timeZone: zone },
				eventType: 'default',
				...extra,
			})
		},
		put(item) {
			version += 1
			const next = googleTimes(
				{
					...item,
					etag: `"synthetic-sync-${version}"`,
					updated: new Date(Date.now() + version).toISOString(),
				},
				zone
			)
			google.items.set(next.id, next)
			return next
		},
		cancel(id) {
			const current = google.items.get(id)
			version += 1
			const sparse = {
				id,
				etag: `"synthetic-sync-${version}"`,
				status: 'cancelled',
				updated: new Date(Date.now() + version).toISOString(),
				...(current?.recurringEventId
					? { recurringEventId: current.recurringEventId, originalStartTime: current.originalStartTime }
					: {}),
			}
			google.items.set(id, sparse)
			return sparse
		},
		masterItem(id, date, time, minutes, recurrence) {
			const start = core.zonedInstant(date, time, zone)
			const end = new Date(start.getTime() + minutes * 60000)
			version += 1
			const master = {
				id,
				etag: `"synthetic-master-${version}"`,
				status: 'confirmed',
				summary: `Synthetic series ${id}`,
				start: { dateTime: googleDateTime(start, zone), timeZone: zone },
				end: { dateTime: googleDateTime(end, zone), timeZone: zone },
				recurrence,
				updated: new Date().toISOString(),
			}
			google.masters.set(id, master)
			return master
		},
	}
	return google
}

function overlaps(item, timeMin, timeMax) {
	const start = item.start ?? item.originalStartTime
	if (!start) return false
	const begin = new Date(start.dateTime ?? `${start.date}T00:00:00Z`)
	const end = item.end ? new Date(item.end.dateTime ?? `${item.end.date}T00:00:00Z`) : begin
	return begin < timeMax && (end > timeMin || (!item.end && begin >= timeMin))
}

function syntheticSource(google, hooks = {}) {
	return {
		async page(read, query, pageToken) {
			google.calls.page += 1
			const index = pageToken ? Number(pageToken) : 0
			if ('syncToken' in query && google.goneOnPage === index) {
				google.goneOnPage = null
				throw new SyncTokenGone()
			}
			const onPage = hooks.onPage ?? google.onPage
			if (onPage) await onPage()
			const list =
				'syncToken' in query
					? google.changes
					: [...google.items.values()].filter((item) => overlaps(item, query.timeMin, query.timeMax))
			const chunk = list.slice(index * google.pageSize, (index + 1) * google.pageSize)
			const last = (index + 1) * google.pageSize >= list.length
			return parseSyncPage(
				{
					timeZone: google.zone,
					items: structuredClone(chunk),
					...(last ? { nextSyncToken: `synthetic-sync-${randomUUID()}` } : { nextPageToken: String(index + 1) }),
				},
				read.calendarTimeZone
			)
		},
		async master(read, eventId) {
			google.calls.master += 1
			if (google.failReads) throw new Error('synthetic read failure')
			if (google.missing.has(eventId)) return { kind: 'missing' }
			const raw = google.masters.get(eventId) ?? google.items.get(eventId)
			return syncEventRead(raw ? structuredClone(raw) : null, read.calendarTimeZone)
		},
		async palette() {
			google.calls.palette += 1
			return PALETTE
		},
		async calendarColor() {
			google.calls.color += 1
			return CALENDAR_COLOR
		},
	}
}

async function drivePass(db, fx, source, kind, options = {}) {
	makeDue(fx.connection.id)
	const [claimed] = await store.claim(db, fx.connection.id)
	if (!claimed) fail('drive', 'no claim')
	let current = claimed
	const read = {
		token: 'synthetic',
		calendarId: claimed.calendarId,
		calendarTimeZone: claimed.calendarTimeZone,
		signal: new AbortController().signal,
	}
	let full = kind === 'full'
	let gone = false
	const window = store.syncWindow(new Date(), fx.zone)
	const collect = async () => {
		const facts = []
		let skipped = 0
		let truncated = 0
		let pageToken
		let nextSyncToken
		do {
			const page = await source.page(
				read,
				full ? { timeMin: window.start, timeMax: window.end } : { syncToken: current.syncToken },
				pageToken
			)
			facts.push(...page.facts)
			skipped += page.skipped
			truncated += page.truncated
			pageToken = page.nextPageToken
			nextSyncToken = page.nextSyncToken
		} while (pageToken)
		return { facts, skipped, truncated, nextSyncToken }
	}
	if (full) current = await store.startFull(db, current, { tokenGone: false })
	let collected
	try {
		collected = await collect()
	} catch (error) {
		if (!(error instanceof SyncTokenGone)) throw error
		gone = true
		current = await store.startFull(db, current, { tokenGone: true })
		if (options.afterGone) options.afterGone()
		full = true
		collected = await collect()
	}
	const families = await store.masterCandidates(db, fx.connection.id, collected.facts, 50)
	const masters = []
	for (const family of families) {
		const result = await source.master(read, family)
		if (result.kind !== 'event') continue
		const fact = masterFact(result, read.calendarTimeZone)
		if (fact) masters.push(fact)
	}
	const result = await store.applyPass(db, current, {
		kind: full ? 'full' : 'incremental',
		facts: [...collected.facts, ...masters],
		nextSyncToken: collected.nextSyncToken,
		skipped: collected.skipped,
		truncated: collected.truncated,
		pollMinutes: { channel: 30, none: 2 },
		...(full ? { window, nextFullAt: new Date('2999-01-01T00:00:00Z') } : {}),
	})
	if (!result.applied) fail('drive', `${kind} pass was discarded`)
	return { ...result, gone, epoch: current.epoch, masters: masters.length }
}

async function passSection(db, fx) {
	const { connection, zone } = fx
	const google = createGoogle(zone)
	const source = syntheticSource(google)
	const monday = core.mondayOf(core.scheduleToday(new Date(), zone))
	const day = (offset) => core.addDays(monday, offset)
	google.timed('dvsync01', day(1), '08:00', 60, { colorId: '2' })
	google.timed('dvsync02', day(2), '08:00', 60)
	google.timed('dvsync03', day(3), '08:00', 0)
	google.timed('dvsync04', day(3), '10:00', 60, { description: 'd'.repeat(9000), location: 'Synthetic room' })
	google.timed('dvsync05', day(7 * 60), '08:00', 60)
	const tombstoneStart = core.zonedInstant(day(4), '08:00', zone)
	google.items.set(`dvsync06_${stamp(tombstoneStart)}`, {
		id: `dvsync06_${stamp(tombstoneStart)}`,
		etag: '"synthetic-tombstone"',
		status: 'cancelled',
		recurringEventId: 'dvsync06',
		originalStartTime: { dateTime: googleDateTime(tombstoneStart, zone), timeZone: zone },
	})
	google.timed('dvsync07', day(5), '08:00', 60)
	google.masterItem('dvsync08', day(-14), '12:00', 60, ['RRULE:FREQ=WEEKLY;BYDAY=WE;UNTIL=20991231T050000Z'])
	google.masterItem('dvsync09', day(-14), '13:00', 60, ['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE'])
	for (const [family, time] of [
		['dvsync08', '12:00'],
		['dvsync09', '13:00'],
	]) {
		for (const week of [0, 1]) {
			const start = core.zonedInstant(day(2 + week * 7), time, zone)
			google.timed(`${family}_${stamp(start)}`, day(2 + week * 7), time, 60, {
				recurringEventId: family,
				originalStartTime: { dateTime: start.toISOString(), timeZone: zone },
			})
		}
	}

	const start = syncState(connection.id)
	const first = await drivePass(db, fx, source, 'full')
	const afterFirst = syncState(connection.id)
	let events = eventRows(connection.id)
	const tombstone = events.get(`dvsync06_${stamp(tombstoneStart)}`)
	const weekly = events.get('dvsync08')
	const other = events.get('dvsync09')
	const firstOk =
		afterFirst.revision === start.revision + 1n &&
		events.has('dvsync01') &&
		!events.has('dvsync03') &&
		events.get('dvsync04')?.description_length === 8192 &&
		!events.has('dvsync05') &&
		tombstone?.status === 'cancelled' &&
		new Date(tombstone.starts_at).getTime() === tombstoneStart.getTime() &&
		tombstone.ends_at === null &&
		first.skipped === 1 &&
		first.truncated === 1 &&
		weekly?.recurrence_kind === 'weekly' &&
		weekly.recurrence_weekday === 3 &&
		weekly.recurrence_until === '2099-12-31' &&
		other?.recurrence_kind === 'other' &&
		other.recurrence_interval === 2 &&
		[...events.keys()].every((id) => !id.startsWith('dvseed')) &&
		events.has(fx.single) &&
		events.has(fx.master)
	console.log(
		`pass 1 full: revision +${afterFirst.revision - start.revision} upserted ${first.upserted} removed ${first.removed} skipped ${first.skipped} truncated ${first.truncated} masters ${first.masters} tombstone_end_null ${tombstone?.ends_at === null} weekly ${weekly?.recurrence_kind}/${weekly?.recurrence_until} other ${other?.recurrence_kind}/${other?.recurrence_interval}`
	)
	if (!firstOk) fail('pass 1', 'full pass did not store the synthetic page as expected')

	google.changes = []
	await drivePass(db, fx, source, 'incremental')
	const afterEmpty = syncState(connection.id)
	console.log(`pass 2 empty incremental: revision +${afterEmpty.revision - afterFirst.revision}`)
	if (afterEmpty.revision !== afterFirst.revision) fail('pass 2', 'an empty incremental pass raised revision')

	google.changes = [google.put({ ...google.items.get('dvsync01'), summary: 'Synthetic sync changed' })]
	await drivePass(db, fx, source, 'incremental')
	const afterEtag = syncState(connection.id)
	console.log(`pass 3 changed etag: revision +${afterEtag.revision - afterEmpty.revision}`)
	if (afterEtag.revision !== afterEmpty.revision + 1n) fail('pass 3', 'a changed etag did not raise revision once')

	const before02 = eventRows(connection.id).get('dvsync02')
	google.changes = [google.cancel('dvsync02')]
	await drivePass(db, fx, source, 'incremental')
	const after02 = eventRows(connection.id).get('dvsync02')
	const afterCancel = syncState(connection.id)
	const cancelOk =
		after02?.status === 'cancelled' &&
		new Date(after02.starts_at).getTime() === new Date(before02.starts_at).getTime() &&
		new Date(after02.ends_at).getTime() === new Date(before02.ends_at).getTime()
	console.log(
		`pass 4 cancelled item: status ${after02?.status} times_kept ${cancelOk} revision +${afterCancel.revision - afterEtag.revision}`
	)
	if (!cancelOk) fail('pass 4', 'a cancelled item did not keep the stored times')

	const oldStart = core.zonedInstant(day(-12 * 7), '18:00', zone)
	const oldId = `${fx.master}_${stamp(oldStart)}`
	await db.transaction((tx) =>
		upsertEventFacts(tx, fx.target, [
			{
				eventId: oldId,
				etag: '"synthetic-old-instance"',
				status: 'confirmed',
				recurringEventId: fx.master,
				originalStartTime: { dateTime: googleDateTime(oldStart, zone), timeZone: zone },
				summary: 'Synthetic old instance',
				start: { dateTime: googleDateTime(oldStart, zone), timeZone: zone },
				end: { dateTime: googleDateTime(oldStart.getTime() + 3600000, zone), timeZone: zone },
				factAt: new Date(),
			},
			{
				eventId: 'dvsyncmarker',
				etag: '"synthetic-marker"',
				status: 'confirmed',
				recurringEventId: null,
				summary: 'Synthetic marker only',
				start: { dateTime: googleDateTime(core.zonedInstant(day(3), '20:00', zone), zone), timeZone: zone },
				end: { dateTime: googleDateTime(core.zonedInstant(day(3), '21:00', zone), zone), timeZone: zone },
				markerLocalId: randomUUID(),
				markerKind: 'single',
				factAt: new Date(),
			},
		])
	)

	google.items.delete('dvsync07')
	const beforeHard = syncState(connection.id)
	const hard = await drivePass(db, fx, source, 'full')
	const afterHard = syncState(connection.id)
	events = eventRows(connection.id)
	const returned = [...google.items.values()]
		.filter((item) => overlaps(item, new Date(beforeHard.window_start), new Date(beforeHard.window_end)))
		.map((item) => item.id)
		.filter((id) => events.has(id))
	const stampsOk = returned.length > 0 && returned.every((id) => events.get(id).seen_epoch === afterHard.epoch)
	console.log(
		`pass 5 hard delete: dvsync07_gone ${!events.has('dvsync07')} removed ${hard.removed} revision +${afterHard.revision - beforeHard.revision} stamped ${returned.length} at epoch ${afterHard.epoch} masters_kept ${events.has('dvsync08') && events.has('dvsync09')} unseen_bound ${hard.unseenBound.length}`
	)
	if (events.has('dvsync07') || afterHard.revision !== beforeHard.revision + 1n || !stampsOk)
		fail('pass 5', 'a full pass did not delete the hard-deleted row or stamp the rest')
	if (!events.has('dvsync08') || !events.has('dvsync09')) fail('pass 5', 'cleanup removed a master with live instances')

	const moved = google.put({
		...google.items.get('dvsync01'),
		start: { dateTime: core.zonedInstant(day(7 * 60), '08:00', zone).toISOString(), timeZone: zone },
		end: { dateTime: core.zonedInstant(day(7 * 60), '09:00', zone).toISOString(), timeZone: zone },
	})
	google.changes = [moved]
	await drivePass(db, fx, source, 'incremental')
	const afterMove = syncState(connection.id)
	events = eventRows(connection.id)
	console.log(
		`pass 6 moved outside the window: row_deleted ${!events.has('dvsync01')} revision +${afterMove.revision - afterHard.revision}`
	)
	if (events.has('dvsync01')) fail('pass 6', 'an incremental fact outside the window kept the unbound row')

	const [lessonsBefore] = rows(
		`select (select count(*)::int from lessons) as lessons, (select count(*)::int from lesson_series) as series`
	)
	google.items.delete('dvsync04')
	google.changes = [google.timed('dvsync10', day(4), '18:00', 60), google.timed('dvsync11', day(4), '20:00', 60)]
	google.pageSize = 1
	google.goneOnPage = 1
	let goneState = null
	const gone = await drivePass(db, fx, source, 'incremental', {
		afterGone: () => {
			goneState = syncState(connection.id)
		},
	})
	google.pageSize = 2500
	const afterGone = syncState(connection.id)
	events = eventRows(connection.id)
	const [lessonsAfter] = rows(
		`select (select count(*)::int from lessons) as lessons, (select count(*)::int from lesson_series) as series`
	)
	const instanceIds = [...events.values()]
		.filter((row) => row.recurring_event_id === fx.master)
		.map((row) => row.event_id)
	const goneOk =
		gone.gone &&
		goneState?.sync_token === null &&
		goneState.epoch === afterMove.epoch + 1 &&
		afterGone.sync_token !== null &&
		!events.has('dvsync04') &&
		events.has(fx.single) &&
		events.has(fx.master) &&
		events.has(oldId) &&
		events.has('dvsyncmarker') &&
		instanceIds.length >= 9 &&
		lessonsBefore.lessons === lessonsAfter.lessons &&
		lessonsBefore.series === lessonsAfter.series
	console.log(
		`pass 7 410 on page 2: token_null ${goneState?.sync_token === null} epoch +${(goneState?.epoch ?? 0) - afterMove.epoch} unseen_unbound_removed ${!events.has('dvsync04')} bound_single ${events.has(fx.single)} series_instances ${instanceIds.length} old_instance ${events.has(oldId)} marker ${events.has('dvsyncmarker')} lessons ${lessonsBefore.lessons}->${lessonsAfter.lessons} series ${lessonsBefore.series}->${lessonsAfter.series}`
	)
	if (!goneOk) fail('pass 7', '410 recovery or bound-row cleanup is wrong')
	console.log('PASS_OK')
}

async function claimSection(db, fx) {
	const { connection } = fx
	const pair = await Promise.all([store.claim(db, connection.id), store.claim(db, connection.id)])
	const won = pair.filter((list) => list.length === 1).length
	console.log(`claim 1 concurrent: winners ${won}`)
	if (won !== 1) fail('claim 1', 'two concurrent claims did not give exactly one row')
	const again = await store.claim(db, connection.id)
	if (again.length !== 0) fail('claim 1', 'a held claim was claimed again')
	rows(
		`update google_sync_state set claimed_until = now() - interval '1 second' where connection_id = ${quote(connection.id)}`
	)
	const taken = await store.claim(db, connection.id)
	console.log(`claim 2 expired claim taken over: ${taken.length === 1}`)
	if (taken.length !== 1) fail('claim 2', 'an expired claim was not taken over')

	const retired = randomUUID()
	const channel = randomUUID()
	rows(`begin;
insert into google_connections (id, account_id, calendar_id, calendar_label, calendar_time_zone, history_cutover_at, generation,
credential_generation, state, created_at, retired_at) values (${quote(retired)}, ${quote(connection.account_id)},
${quote(`${SYNTHETIC_CALENDAR_ID}-retired`)}, 'Synthetic retired', ${quote(fx.zone)}, now() - interval '2 days', 1, 1, 'not_connected',
now() - interval '2 days', now() - interval '1 day');
insert into google_sync_state (connection_id, account_id, calendar_id, window_start, window_end, next_poll_at, next_full_at,
requested_seq, channel_id, channel_resource_id, channel_token_hash, channel_expires_at) values (${quote(retired)},
${quote(connection.account_id)}, ${quote(`${SYNTHETIC_CALENDAR_ID}-retired`)}, now() - interval '8 weeks', now() + interval '53 weeks',
now() - interval '1 hour', now() - interval '1 hour', 0, ${quote(channel)}, 'synthetic-resource-retired',
${quote(createHash('sha256').update('synthetic').digest('hex'))}, now() + interval '3 days');
commit;`)
	const direct = await store.claim(db, retired)
	const sweep = await store.claim(db, null)
	const bumped = await store.requestPass(db, channel)
	const [retiredRow] = rows(
		`select requested_seq::int as requested, claimed_until from google_sync_state where connection_id = ${quote(retired)}`
	)
	const ensured = await store.ensureSyncRows(db, new Date())
	console.log(
		`claim 3 retired connection: direct ${direct.length} sweep_has_it ${sweep.some((row) => row.connectionId === retired)} request_pass ${bumped} requested_seq ${retiredRow.requested} claimed ${retiredRow.claimed_until !== null} ensured_rows ${ensured}`
	)
	if (
		direct.length ||
		sweep.some((row) => row.connectionId === retired) ||
		bumped !== null ||
		retiredRow.requested !== 0
	)
		fail('claim 3', 'a retired connection was claimed or woken')

	rows(`delete from google_sync_state where connection_id = ${quote(connection.id)}`)
	const created = await store.ensureSyncRows(db, new Date())
	const window = store.syncWindow(new Date(), fx.zone)
	const [fresh] = rows(
		`select sync_token, epoch::int as epoch, window_start, window_end, revision::text as revision, next_poll_at <= now() as poll_due,
next_full_at <= now() as full_due, claimed_until from google_sync_state where connection_id = ${quote(connection.id)}`
	)
	const bootstrap = await store.claim(db, connection.id)
	const bootstrapOk =
		created === 1 &&
		fresh?.sync_token === null &&
		fresh.epoch === 0 &&
		fresh.revision === '0' &&
		new Date(fresh.window_start).getTime() === window.start.getTime() &&
		new Date(fresh.window_end).getTime() === window.end.getTime() &&
		fresh.poll_due &&
		fresh.full_due &&
		fresh.claimed_until === null &&
		bootstrap.length === 1 &&
		bootstrap[0].syncToken === null
	console.log(
		`claim 4 bootstrap row: created ${created} token_null ${fresh?.sync_token === null} epoch ${fresh?.epoch} window_matches ${new Date(fresh?.window_start).getTime() === window.start.getTime()} due ${Boolean(fresh?.poll_due && fresh?.full_due)} claimed_for_full_pass ${bootstrap.length === 1 && bootstrap[0].syncToken === null}`
	)
	if (!bootstrapOk) fail('claim 4', 'a connection without a sync row did not get a due row ready for a full pass')
	console.log('CLAIM_OK')
}

function bump(connectionId, extra = '') {
	rows(
		`update google_sync_state set requested_seq = requested_seq + 1, claimed_until = null${extra} where connection_id = ${quote(connectionId)}`
	)
}

const near = (value, expected, toleranceMs) => Math.abs(new Date(value).getTime() - expected) <= toleranceMs

async function loopSection(db, fx) {
	const { createCalendarSync, nextNightly } = await import(`${ROOT}/apps/api/src/calendar/sync.ts`)
	const { createCalendarWatch } = await import(`${ROOT}/apps/api/src/calendar/watch.ts`)
	const { googleConnections } = await import(`${ROOT}/packages/db/src/index.ts`)
	const { connection, zone } = fx
	const id = connection.id
	const google = createGoogle(zone)
	const projected = rows(
		`select event_id, etag, status, summary, start, "end", recurring_event_id, original_start, event_type, google_updated_at
from google_calendar_events where connection_id = ${quote(id)} and row_kind <> 'master'
and (event_id = ${quote(fx.single)} or recurring_event_id = ${quote(fx.master)})`
	)
	for (const row of projected)
		google.items.set(row.event_id, {
			id: row.event_id,
			etag: row.etag,
			status: row.status,
			...(row.summary === null ? {} : { summary: row.summary }),
			start: row.start,
			end: row.end,
			eventType: row.event_type,
			...(row.recurring_event_id
				? { recurringEventId: row.recurring_event_id, originalStartTime: row.original_start }
				: {}),
			updated: new Date(row.google_updated_at).toISOString(),
		})
	const monday = core.mondayOf(core.scheduleToday(new Date(), zone))
	google.timed('dvloop01', core.addDays(monday, 2), '07:00', 60)

	const notes = []
	const logger = {
		info: (_fields, message) => notes.push(message),
		warn: (_fields, message) => notes.push(message),
		debug() {},
	}
	const credentials = {
		async accessToken(accountId, signal) {
			const row = (await db.select().from(googleConnections)).find(
				(item) => item.accountId === accountId && item.retiredAt === null
			)
			return { accessToken: 'synthetic', connection: row, db, signal }
		},
		evict() {},
	}
	const watch = createCalendarWatch({
		db,
		source: {
			async watch() {
				throw new Error('synthetic watch is offline')
			},
			async stopChannel() {},
		},
		appOrigin: 'http://localhost:4106',
		logger,
	})
	const make = (source) => createCalendarSync({ db, source, watch, credentials, logger, isStopping: () => false })
	const sync = make(syntheticSource(google))
	const loops = [sync]
	let release = () => {}
	try {
		bump(id)
		const started = Date.now()
		const woke = await Promise.race([sync.wake(id).then(() => true), sleep(2000).then(() => false)])
		const elapsed = Date.now() - started
		const afterWake = syncState(id)
		const pollOk = near(afterWake.next_poll_at, Date.now() + 2 * 60000, 15000)
		console.log(
			`loop 1 wake: pass_in ${elapsed} ms processed_caught_up ${afterWake.processed === afterWake.requested} next_poll_plus_2min ${pollOk} next_full_kept ${new Date(afterWake.next_full_at).getUTCFullYear() === 2999}`
		)
		if (!woke || elapsed > 2000 || afterWake.processed !== afterWake.requested || !pollOk)
			fail('loop 1', 'wake did not run a pass within 2 s or the poll schedule is wrong')

		rows(`update google_sync_state set window_start = window_start - interval '70 days', window_end = window_end - interval '70 days',
next_full_at = now() - interval '1 second', palette = null, calendar_color = null, claimed_until = null where connection_id = ${quote(id)}`)
		const beforeFull = syncState(id)
		await sync.wake(id)
		const afterFull = syncState(id)
		const at = new Date()
		const window = store.syncWindow(at, zone)
		const nightly = nextNightly(at, zone)
		const nextFull = new Date(afterFull.next_full_at)
		const nightlyOk =
			nextFull.getTime() === nightly.getTime() &&
			core.zonedParts(nextFull, zone).time === '03:00' &&
			nextFull.getTime() > at.getTime() - 60000 &&
			nextFull.getTime() <= at.getTime() + 86400000
		const fullOk =
			afterFull.epoch === beforeFull.epoch + 1 &&
			afterFull.sync_token !== null &&
			afterFull.sync_token !== beforeFull.sync_token &&
			new Date(afterFull.window_start).getTime() === window.start.getTime() &&
			new Date(afterFull.window_end).getTime() === window.end.getTime() &&
			nightlyOk &&
			Array.isArray(afterFull.palette) &&
			afterFull.palette.length === PALETTE.length &&
			afterFull.calendar_color === CALENDAR_COLOR
		console.log(
			`loop 2 forced full with a token: epoch +${afterFull.epoch - beforeFull.epoch} window_reanchored ${new Date(afterFull.window_start).getTime() === window.start.getTime()} next_full_03_00 ${nightlyOk} palette ${afterFull.palette?.length ?? 0} calendar_color ${afterFull.calendar_color === CALENDAR_COLOR}`
		)
		if (!fullOk) fail('loop 2', 'a past next_full_at did not force a full pass with the nightly schedule')

		bump(
			id,
			`, channel_id = gen_random_uuid(), channel_resource_id = 'synthetic-resource', channel_token_hash = repeat('a', 64), channel_expires_at = now() + interval '3 days'`
		)
		await sync.wake(id)
		const withChannel = syncState(id)
		const channelPollOk = near(withChannel.next_poll_at, Date.now() + 30 * 60000, 15000)
		console.log(`loop 3 active channel: next_poll_plus_30min ${channelPollOk}`)
		if (!channelPollOk) fail('loop 3', 'an active channel did not stretch the poll to 30 minutes')
		rows(`update google_sync_state set channel_id = null, channel_resource_id = null, channel_token_hash = null, channel_expires_at = null
where connection_id = ${quote(id)}`)

		const locks = []
		google.onPage = async () => {
			locks.push(rows(`select count(*)::int as n from pg_locks where locktype = 'advisory'`)[0].n)
		}
		bump(id)
		await sync.wake(id)
		google.onPage = null
		console.log(`loop 4 advisory locks during the pass: ${locks.join(',')}`)
		if (!locks.length || locks.some((count) => count !== 0)) fail('loop 4', 'an advisory lock was held during the pass')

		let reached
		const gate = new Promise((done) => (release = done))
		const arrived = new Promise((done) => (reached = done))
		const stuck = make(
			syntheticSource(google, {
				onPage: async () => {
					reached()
					await gate
				},
			})
		)
		loops.push(stuck)
		bump(id)
		const stuckTask = stuck.wake(id)
		await arrived
		const restarted = make(syntheticSource(google))
		loops.push(restarted)
		rows(`update google_sync_state set requested_seq = requested_seq + 1 where connection_id = ${quote(id)}`)
		const held = syncState(id)
		await restarted.wake(id)
		const whileHeld = syncState(id)
		rows(`update google_sync_state set claimed_until = now() - interval '1 second' where connection_id = ${quote(id)}`)
		await restarted.wake(id)
		const resumed = syncState(id)
		release()
		await stuckTask
		const afterStale = syncState(id)
		const restartOk =
			whileHeld.processed === held.processed &&
			whileHeld.claimed_until !== null &&
			resumed.processed === resumed.requested &&
			afterStale.revision === resumed.revision &&
			afterStale.processed === resumed.processed &&
			notes.includes('Calendar sync pass discarded')
		console.log(
			`loop 5 restart mid-pass: blocked_while_claimed ${whileHeld.processed === held.processed} resumed_after_expiry ${resumed.processed === resumed.requested} stale_pass_discarded ${notes.includes('Calendar sync pass discarded')} revision_unchanged_by_stale ${afterStale.revision === resumed.revision}`
		)
		if (!restartOk) fail('loop 5', 'a pass left behind by a stopped loop was not taken over safely')

		const [beforeMissing] = rows(
			`select starts_at, ends_at, status from google_calendar_events where connection_id = ${quote(id)} and event_id = ${quote(fx.single)}`
		)
		const rawSingle = google.items.get(fx.single)
		google.items.delete(fx.single)
		google.missing.add(fx.single)
		rows(
			`update google_sync_state set next_full_at = now() - interval '1 second', claimed_until = null where connection_id = ${quote(id)}`
		)
		await sync.wake(id)
		const [afterMissing] = rows(
			`select starts_at, ends_at, status from google_calendar_events where connection_id = ${quote(id)} and event_id = ${quote(fx.single)}`
		)
		const missingOk =
			beforeMissing.status !== 'cancelled' &&
			afterMissing.status === 'cancelled' &&
			afterMissing.starts_at === beforeMissing.starts_at &&
			afterMissing.ends_at === beforeMissing.ends_at
		console.log(
			`loop 6 unseen bound single with a 404 read: status ${afterMissing.status} times_kept ${afterMissing.starts_at === beforeMissing.starts_at && afterMissing.ends_at === beforeMissing.ends_at}`
		)
		if (!missingOk) fail('loop 6', 'an unseen bound row was not cancelled with its times')

		rows(
			`update google_calendar_events set status = 'confirmed' where connection_id = ${quote(id)} and event_id = ${quote(fx.single)}`
		)
		google.missing.delete(fx.single)
		google.masters.set(fx.single, {
			...rawSingle,
			etag: '"synthetic-live-single"',
			summary: 'Synthetic live single',
			updated: new Date().toISOString(),
		})
		rows(
			`update google_sync_state set next_full_at = now() - interval '1 second', claimed_until = null where connection_id = ${quote(id)}`
		)
		await sync.wake(id)
		const [live] = rows(
			`select status, etag, summary, starts_at from google_calendar_events where connection_id = ${quote(id)} and event_id = ${quote(fx.single)}`
		)
		const liveOk =
			live.status === 'confirmed' &&
			live.etag === '"synthetic-live-single"' &&
			live.summary === 'Synthetic live single' &&
			live.starts_at === beforeMissing.starts_at
		console.log(`loop 6 unseen bound single with a live read: status ${live.status} as_returned ${liveOk}`)
		if (!liveOk) fail('loop 6', 'a live read did not keep the row as Google returned it')

		const failure = () => {
			const [row] = rows(
				`select failure_count, issue, claimed_until, full_started_at, next_poll_at, processed_seq::int as processed, requested_seq::int as requested
from google_sync_state where connection_id = ${quote(id)}`
			)
			return row
		}
		google.onPage = async () => {
			throw new Error('synthetic provider failure')
		}
		bump(id)
		await sync.wake(id)
		const first = failure()
		const firstOk =
			first.failure_count === 1 &&
			first.issue === 'provider_unavailable' &&
			first.claimed_until === null &&
			first.full_started_at === null &&
			near(first.next_poll_at, Date.now() + 60000, 15000) &&
			first.processed < first.requested
		bump(id)
		await sync.wake(id)
		const backedOff = failure()
		rows(`update google_sync_state set next_poll_at = now() - interval '1 second' where connection_id = ${quote(id)}`)
		await sync.wake(id)
		const second = failure()
		const secondOk =
			backedOff.failure_count === 1 &&
			second.failure_count === 2 &&
			near(second.next_poll_at, Date.now() + 120000, 15000)
		google.onPage = null
		rows(`update google_sync_state set next_poll_at = now() - interval '1 second' where connection_id = ${quote(id)}`)
		await sync.wake(id)
		const recovered = failure()
		const recoveredOk =
			recovered.failure_count === 0 && recovered.issue === null && recovered.processed === recovered.requested
		console.log(
			`loop 7 failed pass: failure_count ${first.failure_count} issue ${first.issue} claim_released ${first.claimed_until === null} backoff_1min ${near(first.next_poll_at, Date.now() + 60000, 15000)} request_waits_for_backoff ${backedOff.failure_count === 1} second_backoff_2min ${secondOk} recovered ${recoveredOk}`
		)
		if (!firstOk || !secondOk || !recoveredOk) fail('loop 7', 'a failed pass did not back off or recover')
	} finally {
		release()
		for (const loop of loops) await loop.close()
	}
	console.log('LOOP_OK')
}

const handlers = { pass: passSection, claim: claimSection, loop: loopSection }

let db = null
let exitCode = 0
try {
	if (!(await offline())) throw new Error('Google hosts resolve: the offline preload is not active')
	const fx = await fixtures()
	console.log(
		`FIXTURES connection ${hash(fx.connection.id)} single ${hash(fx.single)} master ${hash(fx.master)} zone ${fx.zone}`
	)
	db = openDb()
	await handlers[section](db.db, fx, { sleep })
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`CALENDAR_SYNC_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
	exitCode = 1
} finally {
	if (db) await db.pool.end()
	try {
		cleanup()
	} catch (error) {
		console.log(`cleanup failed: ${error instanceof Error ? error.message : 'unexpected failure'}`)
		exitCode = 1
	}
}
process.exit(exitCode)
