import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { ENV_TEST, ROOT, call, quote, sql, startApi, teacherCookie } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

const { createDb } = await import(`${ROOT}/packages/db/src/index.ts`)

const appDb = () => createDb(parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL)

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

const SECTIONS = { blocks: sectionBlocks, ops: sectionOps }

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

const blockRow = (id) =>
	sql(
		`select kind, name, position, revision, deleted_at is not null as deleted, body from student_sections where id = ${quote(id)}`
	).rows[0]

async function sectionOps() {
	const id = await card(`${PREFIX}2`)
	const created = await as('POST', `/students/${id}/blocks`, { name: '  Reading list  ' })
	const block = created.json?.block
	check(
		'creating a block answers 201 with a b_ key, a trimmed name, empty text, the last position and revision 1',
		created.status === 201 &&
			/^b_[0-9a-f]{32}$/.test(block.key) &&
			block.name === 'Reading list' &&
			block.body === '' &&
			block.position === 7 &&
			block.revision === 1 &&
			block.standard === false,
		JSON.stringify({ status: created.status, block })
	)
	const taken = await as('POST', `/students/${id}/blocks`, { name: 'reading LIST', body: 'x' })
	const takenStandard = await as('POST', `/students/${id}/blocks`, { name: 'goals' })
	const empty = await as('POST', `/students/${id}/blocks`, { name: '   ' })
	const long = await as('POST', `/students/${id}/blocks`, { name: 'x'.repeat(61) })
	check(
		'a taken name in any case answers 409 block_name_taken; an empty or a 61-character name answers 400',
		conflict(taken, 'block_name_taken') &&
			conflict(takenStandard, 'block_name_taken') &&
			empty.status === 400 &&
			long.status === 400 &&
			(await blocks(id)).blocks.length === 7,
		`${taken.status} ${takenStandard.status} ${empty.status} ${long.status}`
	)

	const renamed = await as('PATCH', `/students/${id}/blocks/${block.id}`, { name: 'Books', expectedRevision: 1 })
	const renameStale = await as('PATCH', `/students/${id}/blocks/${block.id}`, { name: 'Films', expectedRevision: 1 })
	const renameTaken = await as('PATCH', `/students/${id}/blocks/${block.id}`, {
		name: 'INTERESTS',
		expectedRevision: 2,
	})
	check(
		'rename with the current revision saves; a stale revision answers 409; a taken name answers block_name_taken',
		renamed.status === 200 &&
			renamed.json.block.name === 'Books' &&
			renamed.json.block.revision === 2 &&
			conflict(renameStale) &&
			conflict(renameTaken, 'block_name_taken') &&
			blockRow(block.id).name === 'Books' &&
			blockRow(block.id).revision === 2,
		`${renamed.status} ${renameStale.status} ${renameTaken.status}`
	)

	const interests = (await blocks(id)).blocks.find((item) => item.key === 'interests')
	await as('PUT', `/students/${id}/blocks/${interests.id}`, { body: 'Chess', expectedRevision: 1 })
	const deleteStale = await as('DELETE', `/students/${id}/blocks/${interests.id}`, { expectedRevision: 1 })
	const deleted = await as('DELETE', `/students/${id}/blocks/${interests.id}`, { expectedRevision: 2 })
	const afterDelete = await blocks(id)
	const row = blockRow(interests.id)
	check(
		'delete refuses a stale revision, then hides the block with text; the row stays with deleted_at',
		conflict(deleteStale) &&
			deleted.status === 200 &&
			deleted.json.block.revision === 3 &&
			!afterDelete.blocks.some((item) => item.id === interests.id) &&
			row.deleted === true &&
			row.body === 'Chess' &&
			row.revision === 3,
		`${deleteStale.status} ${deleted.status} ${JSON.stringify(row)}`
	)
	const sectionsHidden = await as('GET', `/students/${id}/sections`)
	check(
		'GET sections leaves out a deleted standard block',
		sectionsHidden.status === 200 && !sectionsHidden.json.sections.some((item) => item.kind === 'interests'),
		JSON.stringify(sectionsHidden.json?.sections?.map((item) => item.kind))
	)
	const deleteAgain = await as('DELETE', `/students/${id}/blocks/${interests.id}`, { expectedRevision: 3 })
	const saveDeleted = await as('PUT', `/students/${id}/blocks/${interests.id}`, { body: 'x', expectedRevision: 3 })
	check(
		'a deleted block is not found for delete and save',
		deleteAgain.status === 404 && saveDeleted.status === 404,
		`${deleteAgain.status} ${saveDeleted.status}`
	)
	const restoreStale = await as('POST', `/students/${id}/blocks/${interests.id}/restore`, { expectedRevision: 2 })
	const restored = await as('POST', `/students/${id}/blocks/${interests.id}/restore`, { expectedRevision: 3 })
	const afterRestore = await blocks(id)
	check(
		'restore refuses a stale revision and returns the block to its old place with its text',
		conflict(restoreStale) &&
			restored.status === 200 &&
			restored.json.block.revision === 4 &&
			afterRestore.blocks[1].id === interests.id &&
			afterRestore.blocks[1].body === 'Chess' &&
			afterRestore.blocks.length === 7,
		`${restoreStale.status} ${restored.status} ${afterRestore.blocks.map((item) => item.key).join()}`
	)

	const levelBlock = afterRestore.blocks.find((item) => item.key === 'level')
	await as('DELETE', `/students/${id}/blocks/${levelBlock.id}`, { expectedRevision: levelBlock.revision })
	await as('POST', `/students/${id}/blocks`, { name: 'Level' })
	const restoreTaken = await as('POST', `/students/${id}/blocks/${levelBlock.id}/restore`, {
		expectedRevision: levelBlock.revision + 1,
	})
	check(
		'restore answers block_name_taken when a live block took the name',
		conflict(restoreTaken, 'block_name_taken') && blockRow(levelBlock.id).deleted === true,
		String(restoreTaken.status)
	)

	const current = (await blocks(id)).blocks
	const reversed = [...current].reverse()
	const ordered = await as('PUT', `/students/${id}/blocks/order`, {
		blocks: reversed.map((item) => ({ id: item.id, expectedRevision: item.revision })),
	})
	const afterOrder = (await blocks(id)).blocks
	const expectedRevision = (item, index) => {
		const old = current.find((entry) => entry.id === item.id)
		return old.revision + (old.position === index + 1 ? 0 : 1)
	}
	check(
		'PUT blocks/order with the full list answers 200 (not the block route) and GET returns the new order',
		ordered.status === 200 &&
			afterOrder.map((item) => item.id).join() === reversed.map((item) => item.id).join() &&
			afterOrder.every((item, index) => item.position === index + 1) &&
			afterOrder.every((item, index) => item.revision === expectedRevision(item, index)),
		JSON.stringify({ status: ordered.status, error: ordered.json?.error })
	)
	const staleOrder = await as('PUT', `/students/${id}/blocks/order`, {
		blocks: current.map((item) => ({ id: item.id, expectedRevision: item.revision })),
	})
	const missing = await as('PUT', `/students/${id}/blocks/order`, {
		blocks: afterOrder.slice(1).map((item) => ({ id: item.id, expectedRevision: item.revision })),
	})
	const extra = await as('PUT', `/students/${id}/blocks/order`, {
		blocks: [
			...afterOrder.map((item) => ({ id: item.id, expectedRevision: item.revision })),
			{ id: levelBlock.id, expectedRevision: levelBlock.revision + 1 },
		],
	})
	const duplicate = await as('PUT', `/students/${id}/blocks/order`, {
		blocks: [afterOrder[0], afterOrder[0]].map((item) => ({ id: item.id, expectedRevision: item.revision })),
	})
	const kept = (await blocks(id)).blocks
	check(
		'order with a stale revision, a missing or an extra block answers 409 and keeps the order; a duplicate id answers 400',
		conflict(staleOrder) &&
			conflict(missing) &&
			conflict(extra) &&
			duplicate.status === 400 &&
			kept.map((item) => `${item.id}:${item.revision}`).join() ===
				afterOrder.map((item) => `${item.id}:${item.revision}`).join(),
		`${staleOrder.status} ${missing.status} ${extra.status} ${duplicate.status}`
	)

	const fresh = await card(`${PREFIX}3`)
	const freshBlocks = (await blocks(fresh)).blocks
	const put = await as('PUT', `/students/${fresh}/sections/goals`, { body: 'Exam in May' })
	const sections = await as('GET', `/students/${fresh}/sections`)
	const goalsBlock = (await blocks(fresh)).blocks.find((item) => item.key === 'goals')
	check(
		'a new card has six blocks; PUT and GET sections work over the blocks and advance the block revision',
		freshBlocks.length === 6 &&
			put.status === 200 &&
			put.json.section.kind === 'goals' &&
			put.json.section.body === 'Exam in May' &&
			sections.status === 200 &&
			sections.json.sections.length === 6 &&
			sections.json.sections.map((item) => item.kind).join() === STANDARD.map(([kind]) => kind).join() &&
			sections.json.sections.find((item) => item.kind === 'goals').body === 'Exam in May' &&
			goalsBlock.body === 'Exam in May' &&
			goalsBlock.revision === 2,
		JSON.stringify({ put: put.status, sections: sections.status, revision: goalsBlock?.revision })
	)
	const goalsFresh = (await blocks(fresh)).blocks.find((item) => item.key === 'goals')
	await as('DELETE', `/students/${fresh}/blocks/${goalsFresh.id}`, { expectedRevision: goalsFresh.revision })
	const putDeleted = await as('PUT', `/students/${fresh}/sections/goals`, { body: 'Exam in June' })
	const goalsBack = (await blocks(fresh)).blocks.find((item) => item.key === 'goals')
	check(
		'PUT sections on a deleted standard block restores it with the new text',
		putDeleted.status === 200 && goalsBack?.body === 'Exam in June' && goalsBack.position === 4,
		JSON.stringify({ status: putDeleted.status, block: goalsBack })
	)

	const { applyPacket } = await import(`${ROOT}/apps/api/src/import/apply-packet.ts`)
	const { pool, db } = appDb()
	try {
		const packet = {
			version: 1,
			students: [
				{
					key: 'dev-check-notes-blocks-2529',
					displayName: `${PREFIX}9`,
					rate: null,
					sections: [{ kind: 'lesson_ideas', body: 'Imported idea' }],
					terms: [],
					payments: [],
				},
			],
			unmatched: [],
		}
		const first = await applyPacket(db, packet)
		const importedId = sql(`select id from students where import_key = 'dev-check-notes-blocks-2529'`).rows[0].id
		const imported = (await blocks(importedId)).blocks
		const ideas = imported.find((item) => item.key === 'lesson_ideas')
		const second = await applyPacket(db, packet)
		const again = (await blocks(importedId)).blocks.find((item) => item.key === 'lesson_ideas')
		check(
			'an imported card gets six blocks, the section text lands in its standard block, a repeat writes nothing',
			first.students.inserted === 1 &&
				first.sections.inserted === 1 &&
				imported.length === 6 &&
				ideas.body === 'Imported idea' &&
				ideas.revision === 2 &&
				second.students.inserted === 0 &&
				second.sections.inserted === 0 &&
				second.sections.skipped === 1 &&
				again.body === 'Imported idea' &&
				again.revision === 2,
			JSON.stringify({ first: first.sections, second: second.sections, count: imported.length })
		)
	} finally {
		await pool.end()
	}
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

if (failures === 0 && done)
	console.log(wanted.length > 0 ? `NOTES_BLOCKS_${chosen.join('_').toUpperCase()}_OK` : 'NOTES_BLOCKS_OK')
else console.log(`notes blocks failures ${failures}`)
process.exit(failures === 0 && done ? 0 : 1)
