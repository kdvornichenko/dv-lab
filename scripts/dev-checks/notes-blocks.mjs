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

const SECTIONS = { blocks: sectionBlocks, ops: sectionOps, terms: sectionTerms, recent: sectionRecent }

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

const termRow = (id) =>
	sql(
		`select term, note, added_by, removed_at is not null as removed, removed_by from student_terms where id = ${quote(id)}`
	).rows[0]

async function addWord(id, term, note = null) {
	const res = await as('POST', `/students/${id}/terms`, { term, note })
	if (res.status !== 201) throw new Error(`term add returned ${res.status}`)
	return res.json.term
}

async function words(id, view) {
	const res = await as('GET', `/students/${id}/terms${view ? `?view=${view}` : ''}`)
	if (res.status !== 200) throw new Error(`terms read returned ${res.status}`)
	return res.json.terms
}

async function sectionTerms() {
	const { addTerm, purgeRemovedTerms, removeTerms } = await import(`${ROOT}/apps/api/src/cards/terms.ts`)
	const id = await card(`${PREFIX}4`)
	const apple = await addWord(id, 'apple')
	const banana = await addWord(id, 'banana')
	const cherry = await addWord(id, 'cherry')
	const old = await addWord(id, 'damson')
	const young = await addWord(id, 'elder')
	const kept = await addWord(id, 'fig')
	check(
		'a word added by the teacher has no source and is not removed',
		apple.addedBy === null && apple.removedAt === null && apple.removedBy === null,
		JSON.stringify(apple)
	)
	sql(
		`update student_terms set removed_at = now() - interval '2 minutes', removed_by = 'chat' where id = ${quote(apple.id)}`
	)
	sql(
		`update student_terms set removed_at = now() - interval '3 minutes', removed_by = 'review' where id = ${quote(banana.id)}`
	)
	const { pool, db } = appDb()
	try {
		const removed = await removeTerms(db, id, [cherry.id, apple.id], 'chat')
		check(
			'removeTerms marks only live words of the card with removed_at and the source',
			removed.length === 1 &&
				removed[0].id === cherry.id &&
				termRow(cherry.id).removed === true &&
				termRow(cherry.id).removed_by === 'chat',
			JSON.stringify(removed.map((term) => term.id))
		)
		const live = await words(id)
		const bin = await words(id, 'removed')
		const bad = await as('GET', `/students/${id}/terms?view=trash`)
		check(
			'Words lists only live words; Removed lists removed words newest first with date and source; a bad view is 400',
			live.map((term) => term.term).join() === 'damson,elder,fig' &&
				bin.map((term) => term.id).join() === [cherry.id, apple.id, banana.id].join() &&
				bin.every((term) => term.removedAt !== null) &&
				bin.map((term) => term.removedBy).join() === 'chat,chat,review' &&
				bad.status === 400,
			JSON.stringify({ live: live.map((term) => term.term), bin: bin.map((term) => term.term), bad: bad.status })
		)

		const restored = await as('POST', `/students/${id}/terms/${apple.id}/restore`)
		const restoreLive = await as('POST', `/students/${id}/terms/${old.id}/restore`)
		const restoreUnknown = await as('POST', `/students/${id}/terms/${randomUUID()}/restore`)
		check(
			'Restore returns a removed word to Words; a live or unknown word answers 404',
			restored.status === 200 &&
				restored.json.term.id === apple.id &&
				restored.json.term.removedAt === null &&
				restored.json.term.removedBy === null &&
				(await words(id)).some((term) => term.id === apple.id) &&
				restoreLive.status === 404 &&
				restoreUnknown.status === 404,
			`${restored.status} ${restoreLive.status} ${restoreUnknown.status}`
		)

		const again = await as('POST', `/students/${id}/terms`, { term: 'Banana', note: 'Yellow fruit' })
		const twice = await as('POST', `/students/${id}/terms`, { term: 'BANANA', note: null })
		check(
			'adding a removed word again restores the same row with the new note; adding a live word is 409 term_exists',
			again.status === 201 &&
				again.json.term.id === banana.id &&
				again.json.term.note === 'Yellow fruit' &&
				again.json.term.removedAt === null &&
				termRow(banana.id).removed === false &&
				conflict(twice, 'term_exists'),
			JSON.stringify({ status: again.status, id: again.json?.term?.id === banana.id, twice: twice.status })
		)
		const byChat = await addTerm(db, id, { term: 'cherry', note: null }, { addedBy: 'chat' })
		const fresh = await addTerm(db, id, { term: 'grape', note: null }, { addedBy: 'review' })
		check(
			'addTerm with a source restores a removed word and records the source on a new one',
			byChat.kind === 'added' &&
				byChat.restored === true &&
				byChat.term.id === cherry.id &&
				byChat.term.addedBy === 'chat' &&
				fresh.kind === 'added' &&
				fresh.restored === false &&
				fresh.term.addedBy === 'review',
			JSON.stringify({ byChat: byChat.kind, fresh: fresh.kind })
		)

		sql(
			`update student_terms set removed_at = now() - interval '31 days', removed_by = 'chat' where id = ${quote(old.id)}`
		)
		sql(
			`update student_terms set removed_at = now() - interval '29 days', removed_by = 'review' where id = ${quote(young.id)}`
		)
		const purged = await purgeRemovedTerms(db, new Date())
		check(
			'purgeRemovedTerms erases a word removed 31 days ago and keeps one removed 29 days ago and live words',
			purged >= 1 &&
				termRow(old.id) === undefined &&
				termRow(young.id)?.removed === true &&
				termRow(kept.id)?.removed === false &&
				termRow(apple.id)?.removed === false,
			String(purged)
		)

		const { createHousekeeping } = await import(`${ROOT}/apps/api/src/auth/housekeeping.ts`)
		const logged = []
		const logger = {
			info: (fields, message) => logged.push({ level: 'info', fields, message }),
			warn: (fields, message) => logged.push({ level: 'warn', fields, message }),
		}
		sql(`update student_terms set removed_at = now() - interval '31 days' where id = ${quote(young.id)}`)
		await createHousekeeping({ db, logger }).runOnce()
		const line = logged.find((entry) => entry.message === 'removed terms purged')
		check(
			'one housekeeping pass erases the old removed word and logs only the count',
			termRow(young.id) === undefined &&
				!logged.some((entry) => entry.level === 'warn') &&
				line !== undefined &&
				Object.keys(line.fields).join() === 'purgedTerms' &&
				typeof line.fields.purgedTerms === 'number',
			JSON.stringify(logged.map((entry) => entry.message))
		)
	} finally {
		await pool.end()
	}

	const deleted = await call(api, 'DELETE', `/students/${id}/terms/${kept.id}`, { cookie })
	check(
		'the teacher deletes a word physically',
		deleted.status === 204 && termRow(kept.id) === undefined,
		String(deleted.status)
	)
}

async function sectionRecent() {
	const id = await card(`${PREFIX}5`)
	const lessons = [1, 2, 3, 4, 5].map(
		(days) =>
			sql(
				`insert into lessons (student_id, starts_at, duration_minutes) values (${quote(id)}, now() - interval '${days} days', 60) returning id, starts_at`
			).rows[0]
	)
	const comment = (lesson, hours, body, retracted = false) =>
		sql(
			`insert into lesson_comments (lesson_id, student_id, body, created_at, retracted_at) values (${quote(lesson.id)}, ${quote(id)}, ${quote(body)}, now() - interval '${hours} hours', ${retracted ? 'now()' : 'null'}) returning id`
		).rows[0].id
	const hidden = comment(lessons[0], 1, 'Retracted comment', true)
	const first = comment(lessons[1], 2, 'Comment one')
	const second = comment(lessons[2], 3, 'Comment two')
	const third = comment(lessons[3], 4, 'Comment three')
	const fourth = comment(lessons[4], 5, 'Comment four')
	const latest = await as('GET', `/students/${id}/comments`)
	const items = latest.json?.comments ?? []
	check(
		'GET comments answers the three newest live comments with the lesson key, date and start',
		latest.status === 200 &&
			items.map((item) => item.id).join() === [first, second, third].join() &&
			!items.some((item) => item.id === hidden) &&
			items.every((item, index) => {
				const lesson = lessons[index + 1]
				return (
					item.lesson.key === `l:${lesson.id}` &&
					/^\d{4}-\d{2}-\d{2}$/.test(item.lesson.date) &&
					new Date(item.lesson.startsAt).getTime() === new Date(lesson.starts_at).getTime()
				)
			}) &&
			items[0].body === 'Comment one',
		JSON.stringify({ status: latest.status, ids: items.map((item) => item.id) })
	)
	const ten = await as('GET', `/students/${id}/comments?limit=10`)
	const eleven = await as('GET', `/students/${id}/comments?limit=11`)
	const zero = await as('GET', `/students/${id}/comments?limit=0`)
	const unknown = await as('GET', `/students/${randomUUID()}/comments`)
	check(
		'limit=10 answers all four live comments; limit=11 and limit=0 answer 400; an unknown card answers 404',
		ten.status === 200 &&
			ten.json.comments.map((item) => item.id).join() === [first, second, third, fourth].join() &&
			eleven.status === 400 &&
			zero.status === 400 &&
			unknown.status === 404,
		`${ten.status} ${eleven.status} ${zero.status} ${unknown.status}`
	)

	const before = await blocks(id)
	sql(`insert into note_reviews (student_id, reviewed_at) values (${quote(id)}, '2026-10-01T10:00:00Z')`)
	const after = await blocks(id)
	const conversation = randomUUID()
	sql(`update note_reviews set running_conversation_id = ${quote(conversation)} where student_id = ${quote(id)}`)
	const running = await blocks(id)
	check(
		'the review date is null on a new card and read from note_reviews; a review conversation without a live turn is not shown as running',
		before.reviewedAt === null &&
			before.reviewRunning === null &&
			after.reviewedAt === '2026-10-01T10:00:00.000Z' &&
			after.reviewRunning === null &&
			running.reviewRunning === null,
		JSON.stringify({ before: before.reviewedAt, after: after.reviewedAt, running: running.reviewRunning })
	)
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
