import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { ROOT, SYNTHETIC_CALENDAR_ID, calendarSql, targetEnvFile } from './calendar-env.mjs'
import { descriptionFixtures, hugeFixtures, placeFixtures } from './event-description-fixtures.mjs'

const TARGET = 'test'
const DETAIL_EVENTS = [
	['dvseed01', 'zoom'],
	['dvseed03', 'plain'],
	['dvseed04', 'tags-only'],
]

const contracts = await import(`${ROOT}/packages/contracts/src/index.ts`)
const { readDescription } = await import(`${ROOT}/apps/api/src/calendar/event-description.ts`)

const results = []
const quote = (value) => (value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`)

function record(name, ok, detail = '') {
	results.push(ok)
	console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` ${detail}` : ''}`)
}

function runsOf(blocks) {
	const runs = []
	for (const block of blocks) {
		if (block.kind === 'paragraph') runs.push(...block.runs)
		if (block.kind === 'list') for (const item of block.items) runs.push(...item)
	}
	return runs
}

function expectations(name, reading, expect) {
	const runs = runsOf(reading.blocks)
	const texts = runs.filter((run) => run.kind === 'text').map((run) => run.text)
	const all = runs.filter((run) => run.kind !== 'break').map((run) => run.text)
	const hrefs = runs.filter((run) => run.kind === 'link').map((run) => run.href)
	const kinds = reading.blocks.map((block) => block.kind)
	const schema = contracts.eventDescriptionBlocks.safeParse(reading.blocks)
	record(`${name} schema`, schema.success, schema.success ? '' : schema.error.issues[0]?.message)
	if (expect.formatted !== undefined)
		record(`${name} formatted`, reading.formatted === expect.formatted, `${reading.formatted}`)
	if (expect.kinds) record(`${name} blocks`, kinds.join() === expect.kinds.join(), kinds.join('|') || 'none')
	if (expect.first) record(`${name} first block`, kinds[0] === expect.first, kinds[0])
	if (expect.last) record(`${name} last block`, kinds.at(-1) === expect.last, kinds.at(-1))
	if (expect.breaks !== undefined) {
		const breaks = runs.filter((run) => run.kind === 'break').length
		record(`${name} breaks`, breaks === expect.breaks, `${breaks}`)
	}
	if (expect.hrefs) record(`${name} links`, hrefs.join('\n') === expect.hrefs.join('\n'), `${hrefs.length}`)
	for (const text of expect.plain ?? [])
		record(`${name} text`, texts.some((value) => value.includes(text)), JSON.stringify(text))
	for (const text of expect.absent ?? [])
		record(`${name} absent`, !all.some((value) => value.includes(text)), JSON.stringify(text))
	for (const flag of ['bold', 'italic', 'underline'])
		for (const text of expect[flag] ?? [])
			record(
				`${name} ${flag}`,
				runs.some((run) => run.kind !== 'break' && run[flag] && run.text.includes(text)),
				JSON.stringify(text)
			)
	if (expect.lists) {
		const lists = reading.blocks
			.filter((block) => block.kind === 'list')
			.map((block) => `${block.ordered ? 'ol' : 'ul'}:${block.items.length}`)
		record(`${name} lists`, lists.join() === expect.lists.join(), lists.join('|'))
	}
}

async function parse() {
	for (const fixture of descriptionFixtures) expectations(fixture.id, readDescription(fixture.raw), fixture.expect)
	for (const fixture of hugeFixtures) {
		const started = performance.now()
		const reading = readDescription(fixture.raw)
		const elapsed = performance.now() - started
		const schema = contracts.eventDescriptionBlocks.safeParse(reading.blocks)
		record(`huge ${fixture.id} schema`, schema.success && fixture.raw.length === 8192, `${fixture.raw.length} chars`)
		record(`huge ${fixture.id} time`, elapsed < 50, `${elapsed.toFixed(2)} ms`)
	}
}

function place() {
	for (const fixture of placeFixtures) {
		const view = contracts.placeView(fixture.raw)
		const expect = fixture.expect
		if (expect === null) {
			record(`place ${fixture.id} none`, view === null, JSON.stringify(view))
			continue
		}
		if (expect.kind === 'text') {
			record(`place ${fixture.id} text`, view?.kind === 'text' && view.text === fixture.raw, view?.kind)
			continue
		}
		const label = view?.kind === 'address' ? view.label : ''
		record(`place ${fixture.id} label`, label === expect.label, JSON.stringify(label))
		record(
			`place ${fixture.id} label hides query and credentials`,
			Boolean(label) && !['?', '#', 'pwd', '@', '://', 'secret'].some((part) => label.includes(part)) && !/^https?/i.test(label)
		)
		record(`place ${fixture.id} href`, view?.kind === 'address' && view.href === fixture.raw.trim())
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
	if (result.status !== 0)
		throw new Error(`calendar-seed ${args.join(' ')} exited ${result.status}: ${(result.stdout ?? '').trim().split('\n').pop()}`)
}

async function details() {
	const { createDb, resolveDatabaseUrl } = await import(`${ROOT}/packages/db/src/index.ts`)
	const { readEventDetails } = await import(`${ROOT}/apps/api/src/calendar/event-commands.ts`)
	const { opaqueVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)
	let app = null
	seed('up', TARGET)
	try {
		const [connection] = rows(
			`select id, account_id from google_connections where calendar_id like '${SYNTHETIC_CALENDAR_ID}%' and retired_at is null`
		)
		if (!connection) throw new Error('no synthetic connection after calendar-seed up')
		const fileEnv = parseEnv(readFileSync(targetEnvFile(TARGET), 'utf8'))
		app = createDb(resolveDatabaseUrl('app', { ...fileEnv, NODE_ENV: 'test' }))
		for (const [eventId, fixtureId] of DETAIL_EVENTS) {
			const fixture = descriptionFixtures.find((entry) => entry.id === fixtureId)
			rows(
				`update google_calendar_events set description = ${quote(fixture.raw)}, location = ${quote(fixture.location)}
where connection_id = ${quote(connection.id)} and event_id = ${quote(eventId)}`
			)
			const found = await app.db.transaction((tx) =>
				readEventDetails(tx, connection.account_id, opaqueVersion([connection.id, eventId]))
			)
			const parsed = contracts.calendarEventDetails.safeParse(found)
			record(`details ${eventId} contract`, parsed.success)
			if (!parsed.success) continue
			const event = parsed.data
			const expected = readDescription(fixture.raw)
			record(
				`details ${eventId} blocks`,
				JSON.stringify(event.descriptionBlocks) === JSON.stringify(expected.blocks),
				`${event.descriptionBlocks.length}`
			)
			record(`details ${eventId} raw description`, event.description === fixture.raw)
			record(`details ${eventId} location`, event.location === fixture.location)
			expectations(`details ${eventId}`, { blocks: event.descriptionBlocks, formatted: event.descriptionFormatted }, fixture.expect)
		}
	} finally {
		if (app) await app.pool.end()
		seed('down', TARGET)
	}
}

const SECTIONS = { parse, place, details }
const requested = process.argv[2]
if (requested && !SECTIONS[requested]) {
	console.log(`usage: node scripts/dev-checks/event-description.mjs [${Object.keys(SECTIONS).join('|')}]`)
	process.exit(2)
}

let failed = false
for (const [name, section] of Object.entries(SECTIONS)) {
	if (requested && requested !== name) continue
	try {
		await section()
	} catch (error) {
		failed = true
		const message = error instanceof Error ? error.message : 'unexpected failure'
		console.log(`FAIL ${name} ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
	}
}
if (!failed && results.length && results.every(Boolean)) console.log('EVENT_DESCRIPTION_OK')
else {
	console.log('EVENT_DESCRIPTION_FAILED')
	process.exitCode = 1
}
