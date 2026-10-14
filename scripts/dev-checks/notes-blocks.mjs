import { randomUUID } from 'node:crypto'

import { ROOT, call, quote, sql, startApi, teacherCookie } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

const PORT = 4256
const PREFIX = 'Alex Example 252'
const STANDARD = [
	['general_info', 'General info'],
	['interests', 'Interests'],
	['level', 'Level'],
	['goals', 'Goals'],
	['typical_mistakes', 'Typical mistakes'],
	['lesson_ideas', 'Lesson ideas'],
]

const SECTIONS = { blocks: sectionBlocks }

let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

let api = null
let cookie = null

const as = (method, path, body) =>
	call(api, method, path, {
		cookie,
		body,
		headers: body === undefined ? {} : { 'content-length': String(Buffer.byteLength(JSON.stringify(body))) },
	})

const conflict = (res, code = 'precondition_failed') => res.status === 409 && res.json?.error?.code === code

const cardBody = (displayName) => ({
	displayName,
	rateMinor: null,
	currency: null,
	defaultLessonMinutes: 60,
	parent: null,
	level: null,
	goals: null,
	timeZone: null,
})

async function card(name) {
	const res = await as('POST', '/students', cardBody(name))
	if (res.status !== 201) throw new Error(`card create returned ${res.status}`)
	return res.json.student.id
}

async function blocks(id) {
	const res = await as('GET', `/students/${id}/blocks`)
	if (res.status !== 200) throw new Error(`blocks read returned ${res.status}`)
	return res.json
}

function removeFixtures() {
	const cards = `select id from students where display_name like ${quote(`${PREFIX}%`)}`
	sql(`delete from lesson_comments where student_id in (${cards})`)
	sql(`delete from student_notes where student_id in (${cards})`)
	sql(`delete from student_sections where student_id in (${cards})`)
	sql(`delete from student_terms where student_id in (${cards})`)
	sql(`delete from note_reviews where student_id in (${cards})`)
	removeCards(`display_name like ${quote(`${PREFIX}%`)}`)
}

async function sectionBlocks() {
	const id = await card(`${PREFIX}0`)
	const other = await card(`${PREFIX}1`)
	const list = await blocks(id)
	check(
		'a new card lists six standard blocks in order with names, positions 1..6 and revision 1',
		list.blocks.length === 6 &&
			list.blocks.every(
				(block, index) =>
					block.key === STANDARD[index][0] &&
					block.name === STANDARD[index][1] &&
					block.position === index + 1 &&
					block.revision === 1 &&
					block.body === '' &&
					block.standard === true
			) &&
			list.reviewedAt === null &&
			list.reviewRunning === null,
		JSON.stringify(list.blocks.map((block) => [block.key, block.name, block.position]))
	)
	const goals = list.blocks.find((block) => block.key === 'goals')
	const saved = await as('PUT', `/students/${id}/blocks/${goals.id}`, { body: 'First text', expectedRevision: 1 })
	check(
		'saving with the current revision answers 200 and advances the revision',
		saved.status === 200 && saved.json.block.body === 'First text' && saved.json.block.revision === 2,
		JSON.stringify({ status: saved.status, revision: saved.json?.block?.revision })
	)
	const stale = await as('PUT', `/students/${id}/blocks/${goals.id}`, { body: 'Stale text', expectedRevision: 1 })
	const after = (await blocks(id)).blocks.find((block) => block.id === goals.id)
	check(
		'saving with a stale revision answers 409 precondition_failed and keeps the text',
		conflict(stale) && after.body === 'First text' && after.revision === 2,
		JSON.stringify({ status: stale.status, body: after.body, revision: after.revision })
	)
	const foreign = (await blocks(other)).blocks[0]
	const wrongCard = await as('PUT', `/students/${id}/blocks/${foreign.id}`, { body: 'x', expectedRevision: 1 })
	const unknown = await as('PUT', `/students/${id}/blocks/${randomUUID()}`, { body: 'x', expectedRevision: 1 })
	const unknownCard = await as('GET', `/students/${randomUUID()}/blocks`)
	const foreignAfter = (await blocks(other)).blocks[0]
	check(
		'a block of another card, an unknown block and an unknown card answer 404',
		wrongCard.status === 404 &&
			unknown.status === 404 &&
			unknownCard.status === 404 &&
			foreignAfter.body === '' &&
			foreignAfter.revision === 1,
		`${wrongCard.status} ${unknown.status} ${unknownCard.status}`
	)
	const noRevision = await as('PUT', `/students/${id}/blocks/${goals.id}`, { body: 'x' })
	check('saving without a revision answers 400', noRevision.status === 400, String(noRevision.status))
}

const wanted = process.argv.slice(2)
for (const name of wanted) {
	if (!(name in SECTIONS)) {
		console.log(`unknown section ${name}; known: ${Object.keys(SECTIONS).join(', ')}`)
		process.exit(2)
	}
}
const chosen = wanted.length > 0 ? wanted : Object.keys(SECTIONS)

let done = false
try {
	removeFixtures()
	api = await startApi({ port: PORT })
	cookie = await teacherCookie(api)
	for (const name of chosen) {
		console.log(`section ${name}`)
		await SECTIONS[name]()
	}
	done = true
} catch (err) {
	failures++
	console.log(`FAIL notes blocks crashed ${err instanceof Error ? err.message : String(err)}`)
} finally {
	if (api) await api.stop()
	removeFixtures()
}

if (failures === 0 && done) console.log(wanted.length > 0 ? `NOTES_BLOCKS_${chosen.join('_').toUpperCase()}_OK` : 'NOTES_BLOCKS_OK')
else console.log(`notes blocks failures ${failures}`)
process.exit(failures === 0 && done ? 0 : 1)
