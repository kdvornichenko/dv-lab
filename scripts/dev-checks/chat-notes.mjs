import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import { chatActionResponse, chatConversationReadResponse, undoResponse } from '../../packages/contracts/src/index.ts'
import { ENV_TEST, call, quote, sql, teacherCookie } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

const PORT = 4258
const PREFIX = 'Alex Example 258'
const SECTIONS = {
	append: sectionAppend,
	rewrite: sectionRewrite,
	blocks: sectionBlocks,
	words: sectionWords,
	note: sectionNote,
}

let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

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

function removeFixtures(where) {
	const conversations = `select distinct conversation_id from chat_actions where target->>'studentId' in (select id::text from students where ${where})`
	const chats = sql(`select id from chat_conversations where id in (${conversations})`).rows.map((row) => row.id)
	if (chats.length > 0) removeChats(`id in (${chats.map(quote).join(', ')})`)
	return removeCards(where)
}

function removeChats(where) {
	const conversations = `select id from chat_conversations where ${where}`
	sql(`delete from chat_actions where conversation_id in (${conversations})`)
	sql(`delete from chat_usage_attempts where conversation_id in (${conversations})`)
	sql(`delete from chat_turns where conversation_id in (${conversations})`)
	sql(`delete from chat_messages where reply_to is not null and conversation_id in (${conversations})`)
	sql(`delete from chat_messages where conversation_id in (${conversations})`)
	return sql(`delete from chat_conversations where ${where}`).rowCount
}

const blockRow = (blockId) =>
	sql(
		`select body, revision, deleted_at is not null as deleted, position from student_sections where id = ${quote(blockId)}`
	).rows[0]

const noteEntries = (studentId) =>
	sql(`select count(*)::int as n from student_notes where student_id = ${quote(studentId)}`).rows[0].n

async function harness() {
	const { createDb } = await import('../../packages/db/src/index.ts')
	const { createApp } = await import('../../apps/api/src/app.ts')
	const { createSignIn } = await import('../../apps/api/src/auth/sign-in.ts')
	const { createChat } = await import('../../apps/api/src/chat/runs.ts')
	const { ProviderFault } = await import('../../apps/api/src/chat/provider.ts')
	const apiRequire = createRequire(new URL('../../apps/api/package.json', import.meta.url))
	const pino = apiRequire('pino')
	const { serve } = apiRequire('@hono/node-server')

	const reply = (model, content, stop) => ({
		id: `msg_${randomUUID()}`,
		type: 'message',
		role: 'assistant',
		model,
		content,
		stop_reason: stop,
		stop_sequence: null,
		usage: { input_tokens: 100, output_tokens: 40, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
	})
	const say = (text) =>
		async function* answer(request) {
			yield { type: 'text', text }
			yield { type: 'text_end' }
			yield { type: 'final', message: reply(request.model, [{ type: 'text', text, citations: null }], 'end_turn') }
		}
	const use = (name, input) =>
		async function* toolUse(request) {
			const block = { type: 'tool_use', id: `toolu_${randomUUID().slice(0, 8)}`, name, input }
			yield { type: 'final', message: reply(request.model, [block], 'tool_use') }
		}
	const fake = {
		calls: [],
		script: [],
		availability: async () => true,
		async complete() {
			throw new ProviderFault('model_unavailable', { answered: true })
		},
		stream(request, signal) {
			this.calls.push(request)
			return (this.script.shift() ?? say('Done.'))(request, signal)
		},
	}

	const url = parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL
	const { pool, db } = createDb(url)
	const lines = []
	const logger = pino({ level: 'info' }, { write: (line) => lines.push(line) })
	const base = `http://127.0.0.1:${PORT}`
	const chat = createChat({ db, logger, provider: fake })
	const app = createApp({
		logger,
		db,
		gitSha: 'check',
		appOrigin: base,
		production: false,
		isStopping: () => false,
		signIn: createSignIn({ db, logger, requireClientIp: false }),
		chat,
	})
	const server = serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' })
	const api = { base, port: PORT }
	const close = async () => {
		await chat.close()
		await new Promise((resolve) => server.close(() => resolve()))
		await pool.end()
	}
	return { api, db, fake, say, use, lines, close }
}

async function context(h) {
	const cookie = await teacherCookie(h.api)
	const as = (method, path, body) => call(h.api, method, path, { cookie, body })
	const conversations = []
	const card = async (name) => {
		const res = await as('POST', '/students', cardBody(name))
		if (res.status !== 201) throw new Error(`card create returned ${res.status}`)
		return res.json.student.id
	}
	const blocks = async (studentId) => (await as('GET', `/students/${studentId}/blocks`)).json.blocks
	const fresh = async () => {
		const created = await as('POST', '/chat/conversations')
		conversations.push(created.json.conversation.id)
		return created.json.conversation.id
	}
	const settle = async (turnId) => {
		const deadline = Date.now() + 20000
		while (Date.now() < deadline) {
			const res = await as('GET', `/chat/turns/${turnId}`)
			if (res.status === 200 && !['accepted', 'running'].includes(res.json.turn.state)) return res.json.turn
			await new Promise((resolve) => setTimeout(resolve, 50))
		}
		throw new Error('turn did not finish in time')
	}
	const turn = async (conversationId, text, steps) => {
		h.fake.script.push(...steps)
		const sent = await as('POST', `/chat/conversations/${conversationId}/messages`, {
			requestId: randomUUID(),
			text,
			mentions: [],
		})
		if (sent.status !== 201 || !sent.json.turn) throw new Error(`send returned ${sent.status}`)
		const done = await settle(sent.json.turn.id)
		h.fake.script.length = 0
		return done
	}
	const read = async (conversationId) => {
		const res = await as('GET', `/chat/conversations/${conversationId}`)
		const parsed = chatConversationReadResponse.safeParse(res.json)
		if (!parsed.success) throw new Error(`conversation read failed the contract ${res.status}`)
		return parsed.data.messages
	}
	const noteBlocks = async (conversationId) =>
		(await read(conversationId)).flatMap((message) => message.blocks.filter((block) => block.type === 'note_change'))
	const shown = async (conversationId, actionId) =>
		(await noteBlocks(conversationId)).find((block) => block.actionId === actionId)
	const undo = async (actionId, requestId = randomUUID()) => {
		const res = await as('POST', `/chat/actions/${actionId}/undo`, { requestId })
		const parsed = res.status === 200 ? undoResponse.safeParse(res.json) : null
		return { status: res.status, block: parsed?.success ? parsed.data.block : null }
	}
	const decide = async (actionId, verb) => {
		const res = await as('POST', `/chat/actions/${actionId}/${verb}`, {})
		const parsed = res.status === 200 ? chatActionResponse.safeParse(res.json) : null
		return { status: res.status, block: parsed?.success ? parsed.data.block : null }
	}
	return { as, cookie, card, blocks, fresh, turn, read, noteBlocks, shown, undo, decide, conversations }
}

const linesOf = (block, kind) => block.hunks.flatMap((hunk) => hunk.lines.filter((line) => line.kind === kind))

async function sectionAppend(h, ctx) {
	const studentId = await ctx.card(`${PREFIX}0 Append`)
	const general = (await ctx.blocks(studentId)).find((block) => block.key === 'general_info')
	const first = 'Prefers morning lessons.'
	const put = await ctx.as('PUT', `/students/${studentId}/blocks/${general.id}`, {
		body: first,
		expectedRevision: general.revision,
	})
	if (put.status !== 200) throw new Error(`block save returned ${put.status}`)
	const startRevision = put.json.block.revision
	const added = 'Works in marketing.'
	const conversation = await ctx.fresh()
	const done = await ctx.turn(conversation, 'Add to the notes that the student works in marketing.', [
		h.use('student_notes', { student_id: studentId }),
		h.use('note_write', { student_id: studentId, block_id: general.id, text: `${first}\n${added}` }),
		h.say('Added it to the notes.'),
	])
	const read = JSON.parse(notesResultOf(h.fake.calls.at(-2)))
	check(
		'student_notes gives every live block with block_id, name, revision and the full text, and the vocabulary',
		Array.isArray(read.blocks) &&
			read.blocks.length === 6 &&
			read.blocks.some(
				(block) =>
					block.block_id === general.id && block.revision === startRevision && block.text === first && block.cite
			) &&
			read.blocks.every((block) => typeof block.name === 'string') &&
			Array.isArray(read.vocabulary),
		JSON.stringify(Object.keys(read))
	)
	const row = blockRow(general.id)
	check(
		'an addition is written at once: the block keeps the old line, gets the new one and its revision grows by one',
		done.state === 'completed' && row.body === `${first}\n${added}` && row.revision === startRevision + 1,
		JSON.stringify({ state: done.state, revision: row.revision })
	)
	const receipt = (await ctx.noteBlocks(conversation))[0]
	check(
		'the receipt is a note_change block with the added line, the block and Undo available',
		receipt?.mode === 'receipt' &&
			receipt.change === 'updated' &&
			receipt.target.kind === 'block' &&
			receipt.target.blockId === general.id &&
			receipt.target.blockName === 'General info' &&
			receipt.undo === 'available' &&
			receipt.state === null &&
			linesOf(receipt, 'added')
				.map((line) => line.text)
				.join() === added &&
			linesOf(receipt, 'removed').length === 0 &&
			linesOf(receipt, 'same')
				.map((line) => line.text)
				.join() === first,
		JSON.stringify(receipt?.hunks)
	)
	check(
		'the receipt is stored as a chat action of kind note, applied, with the old text and the new revision',
		sql(
			`select count(*)::int as n from chat_actions where id = ${quote(receipt.actionId)} and kind = 'note' and state = 'applied' and before->>'body' = ${quote(first)} and (after->>'revision')::int = ${startRevision + 1}`
		).rows[0].n === 1
	)
	check('no separate note entry was created', noteEntries(studentId) === 0)

	const requestId = randomUUID()
	const undone = await ctx.undo(receipt.actionId, requestId)
	check(
		'Undo puts the old text back and answers with the receipt marked undone',
		undone.status === 200 &&
			undone.block?.type === 'note_change' &&
			undone.block.undo === 'undone' &&
			blockRow(general.id).body === first &&
			blockRow(general.id).revision === startRevision + 2,
		JSON.stringify({ status: undone.status, undo: undone.block?.undo })
	)
	const again = await ctx.undo(receipt.actionId, requestId)
	check(
		'the same Undo again answers the same and writes nothing',
		again.status === 200 && again.block?.undo === 'undone' && blockRow(general.id).revision === startRevision + 2
	)
	check(
		'after a reload the receipt reads as undone',
		(await ctx.shown(conversation, receipt.actionId))?.undo === 'undone'
	)

	const second = 'Has a dog.'
	const secondTurn = await ctx.fresh()
	await ctx.turn(secondTurn, 'Note that the student has a dog.', [
		h.use('note_write', { student_id: studentId, block_id: general.id, text: `${first}\n\n${second}` }),
		h.say('Added.'),
	])
	const fresh = (await ctx.noteBlocks(secondTurn))[0]
	check(
		'a new receipt reads as available after a reload',
		fresh?.undo === 'available' && blockRow(general.id).body === `${first}\n\n${second}`,
		JSON.stringify({ undo: fresh?.undo })
	)
	const teacherText = `${first}\n\n${second}\nEdited by the teacher.`
	const edited = await ctx.as('PUT', `/students/${studentId}/blocks/${general.id}`, {
		body: teacherText,
		expectedRevision: blockRow(general.id).revision,
	})
	const late = await ctx.undo(fresh.actionId)
	check(
		'Undo after the teacher edited the block is unavailable and keeps the text of the teacher',
		edited.status === 200 &&
			late.status === 200 &&
			late.block?.type === 'note_change' &&
			late.block.undo === 'unavailable' &&
			late.block.issue === 'block_changed' &&
			blockRow(general.id).body === teacherText,
		JSON.stringify({ status: late.status, undo: late.block?.undo, issue: late.block?.issue })
	)
	const reloaded = await ctx.shown(secondTurn, fresh.actionId)
	check(
		'after a reload the refused Undo reads as unavailable with the reason',
		reloaded?.undo === 'unavailable' && reloaded.issue === 'block_changed'
	)

	const before = blockRow(general.id)
	const sameTurn = await ctx.fresh()
	await ctx.turn(sameTurn, 'Note that the student has a dog.', [
		h.use('note_write', { student_id: studentId, block_id: general.id, text: `${teacherText}\n` }),
		h.say('That is already in the notes.'),
	])
	const already = (await ctx.noteBlocks(sameTurn))[0]
	check(
		'the same text gives an already receipt without Undo and the revision does not grow',
		already?.change === 'already' &&
			already.undo === null &&
			blockRow(general.id).revision === before.revision &&
			blockRow(general.id).body === teacherText,
		JSON.stringify({ change: already?.change, undo: already?.undo })
	)
	const refusedUndo = await ctx.undo(already.actionId)
	check('Undo of an already receipt is refused', refusedUndo.status === 409, String(refusedUndo.status))
	return 'CHAT_NOTES_APPEND_OK'
}

const lastToolResult = (h) => {
	const part = h.fake.calls
		.at(-1)
		?.messages.at(-1)
		?.content?.find?.((item) => item.type === 'tool_result')
	return { text: typeof part?.content === 'string' ? part.content : '', error: part?.is_error === true }
}

async function setBlock(ctx, studentId, key, body) {
	const block = (await ctx.blocks(studentId)).find((item) => item.key === key)
	const put = await ctx.as('PUT', `/students/${studentId}/blocks/${block.id}`, {
		body,
		expectedRevision: block.revision,
	})
	if (put.status !== 200) throw new Error(`block save returned ${put.status}`)
	return put.json.block
}

async function writeTurn(h, ctx, studentId, blockId, text) {
	const conversation = await ctx.fresh()
	await ctx.turn(conversation, 'Update the notes.', [
		h.use('note_write', { student_id: studentId, block_id: blockId, text }),
		h.say('Done.'),
	])
	const result = lastToolResult(h)
	return { conversation, block: (await ctx.noteBlocks(conversation))[0], result }
}

async function sectionRewrite(h, ctx) {
	const studentId = await ctx.card(`${PREFIX}1 Rewrite`)
	const original = 'Line one\nLine two\nLine three'
	const block = await setBlock(ctx, studentId, 'typical_mistakes', original)
	const cases = [
		['a removed line', 'Line one\nLine three'],
		['a changed line', 'Line one\nLine 2\nLine three'],
		['reordered lines', 'Line two\nLine one\nLine three'],
		['a word added to the end of a line', 'Line one\nLine two more\nLine three'],
		['a cleared block', ''],
	]
	const proposals = {}
	for (const [label, text] of cases) {
		const made = await writeTurn(h, ctx, studentId, block.id, text)
		const row = blockRow(block.id)
		proposals[label] = made
		check(
			`${label} gives an Update proposal and writes nothing`,
			made.block?.mode === 'proposal' &&
				made.block.change === 'update_block' &&
				made.block.state === 'proposed' &&
				made.block.undo === null &&
				linesOf(made.block, 'removed').length > 0 &&
				row.body === original &&
				row.revision === block.revision &&
				made.result.text.includes('"status":"proposed"'),
			JSON.stringify({ mode: made.block?.mode, state: made.block?.state, revision: row.revision })
		)
	}
	check(
		'the proposal of a cleared block shows every old line as removed',
		linesOf(proposals['a cleared block'].block, 'removed')
			.map((line) => line.text)
			.join('|') === 'Line one|Line two|Line three'
	)

	const saved = await ctx.decide(proposals['a removed line'].block.actionId, 'confirm')
	check(
		'Save to notes writes the new text and answers applied with Undo available',
		saved.status === 200 &&
			saved.block?.type === 'note_change' &&
			saved.block.state === 'applied' &&
			saved.block.undo === 'available' &&
			blockRow(block.id).body === 'Line one\nLine three' &&
			blockRow(block.id).revision === block.revision + 1,
		JSON.stringify({ status: saved.status, state: saved.block?.state })
	)
	const again = await ctx.decide(proposals['a removed line'].block.actionId, 'confirm')
	check(
		'a second Save writes nothing',
		again.status === 200 && again.block?.state === 'applied' && blockRow(block.id).revision === block.revision + 1
	)
	const reloadedSave = await ctx.shown(proposals['a removed line'].conversation, saved.block.actionId)
	check(
		'after a reload the saved proposal reads as the endpoint answered',
		reloadedSave?.state === saved.block.state && reloadedSave.undo === saved.block.undo
	)
	const undone = await ctx.undo(saved.block.actionId)
	check(
		'Undo of a saved rewrite puts the old text back',
		undone.status === 200 &&
			undone.block?.type === 'note_change' &&
			undone.block.state === 'applied' &&
			undone.block.undo === 'undone' &&
			blockRow(block.id).body === original,
		JSON.stringify({ status: undone.status, undo: undone.block?.undo })
	)
	const reloadedUndo = await ctx.shown(proposals['a removed line'].conversation, saved.block.actionId)
	check(
		'after a reload the undone rewrite reads as undone',
		reloadedUndo?.state === 'applied' && reloadedUndo.undo === 'undone'
	)

	const stale = proposals['a changed line'].block
	const teacherText = 'Line one\nLine two\nLine three\nTeacher line.'
	await setBlock(ctx, studentId, 'typical_mistakes', teacherText)
	const staleAnswer = await ctx.decide(stale.actionId, 'confirm')
	check(
		'Save after the teacher edited the block is stale and the text of the teacher stays',
		staleAnswer.status === 200 &&
			staleAnswer.block?.state === 'stale' &&
			staleAnswer.block.issue === 'block_changed' &&
			staleAnswer.block.undo === null &&
			blockRow(block.id).body === teacherText,
		JSON.stringify({ state: staleAnswer.block?.state, issue: staleAnswer.block?.issue })
	)
	const reloadedStale = await ctx.shown(proposals['a changed line'].conversation, stale.actionId)
	check(
		'after a reload the stale proposal reads as stale',
		reloadedStale?.state === 'stale' && reloadedStale.issue === 'block_changed'
	)

	const kept = await ctx.decide(proposals['reordered lines'].block.actionId, 'decline')
	const keptRow = blockRow(block.id)
	check(
		'Keep the notes declines the proposal and writes nothing',
		kept.status === 200 && kept.block?.state === 'declined' && keptRow.body === teacherText,
		JSON.stringify({ state: kept.block?.state })
	)
	const reloadedKept = await ctx.shown(proposals['reordered lines'].conversation, kept.block.actionId)
	check('after a reload the declined proposal reads as declined', reloadedKept?.state === 'declined')
	const lateSave = await ctx.decide(kept.block.actionId, 'confirm')
	check(
		'Save after Keep writes nothing',
		lateSave.block?.state === 'declined' && blockRow(block.id).revision === keptRow.revision
	)
	return 'CHAT_NOTES_REWRITE_OK'
}

async function blockTurn(h, ctx, studentId, name, input) {
	const conversation = await ctx.fresh()
	await ctx.turn(conversation, 'Change the notes.', [h.use(name, { student_id: studentId, ...input }), h.say('Done.')])
	return { conversation, block: (await ctx.noteBlocks(conversation))[0], result: lastToolResult(h) }
}

const liveBlocks = (studentId) =>
	sql(`select count(*)::int as n from student_sections where student_id = ${quote(studentId)} and deleted_at is null`)
		.rows[0].n

async function sectionBlocks(h, ctx) {
	const studentId = await ctx.card(`${PREFIX}2 Blocks`)
	const created = await blockTurn(h, ctx, studentId, 'note_block_create', {
		name: 'Exam dates',
		text: 'First exam in June.',
	})
	const createdRow = created.block ? blockRow(created.block.target.blockId) : null
	check(
		'a new block is created at once with a created receipt and Undo',
		created.block?.mode === 'receipt' &&
			created.block.change === 'created' &&
			created.block.target.blockName === 'Exam dates' &&
			created.block.undo === 'available' &&
			createdRow?.body === 'First exam in June.' &&
			createdRow.deleted === false &&
			liveBlocks(studentId) === 7,
		JSON.stringify({ change: created.block?.change })
	)
	const createdUndo = await ctx.undo(created.block.actionId)
	check(
		'Undo of a created block deletes it softly',
		createdUndo.block?.undo === 'undone' &&
			blockRow(created.block.target.blockId).deleted === true &&
			liveBlocks(studentId) === 6
	)
	check(
		'after a reload the created receipt reads as undone',
		(await ctx.shown(created.conversation, created.block.actionId))?.undo === 'undone'
	)

	const taken = await blockTurn(h, ctx, studentId, 'note_block_create', { name: 'goals', text: 'Pass the exam.' })
	check(
		'a taken name is refused with a hint to write into the existing block and creates nothing',
		taken.block === undefined &&
			taken.result.error &&
			taken.result.text.includes('block_name_taken') &&
			taken.result.text.includes('note_write') &&
			liveBlocks(studentId) === 6,
		taken.result.text
	)

	const empty = (await ctx.blocks(studentId)).find((item) => item.key === 'lesson_ideas')
	const emptyPosition = blockRow(empty.id).position
	const deletedEmpty = await blockTurn(h, ctx, studentId, 'note_block_delete', { block_id: empty.id })
	check(
		'an empty block is deleted at once with a deleted receipt and Undo',
		deletedEmpty.block?.mode === 'receipt' &&
			deletedEmpty.block.change === 'deleted' &&
			deletedEmpty.block.undo === 'available' &&
			blockRow(empty.id).deleted === true,
		JSON.stringify({ change: deletedEmpty.block?.change })
	)
	const emptyUndo = await ctx.undo(deletedEmpty.block.actionId)
	check(
		'Undo puts the empty block back in its place',
		emptyUndo.block?.undo === 'undone' &&
			blockRow(empty.id).deleted === false &&
			blockRow(empty.id).position === emptyPosition
	)
	check(
		'after a reload the deleted receipt reads as undone',
		(await ctx.shown(deletedEmpty.conversation, deletedEmpty.block.actionId))?.undo === 'undone'
	)

	const filled = await setBlock(ctx, studentId, 'interests', 'Football\nChess')
	const filledPosition = blockRow(filled.id).position
	const proposed = await blockTurn(h, ctx, studentId, 'note_block_delete', { block_id: filled.id })
	check(
		'a block with text gives a Delete proposal with its lines as removed and deletes nothing',
		proposed.block?.mode === 'proposal' &&
			proposed.block.change === 'delete_block' &&
			proposed.block.state === 'proposed' &&
			linesOf(proposed.block, 'removed')
				.map((line) => line.text)
				.join('|') === 'Football|Chess' &&
			blockRow(filled.id).deleted === false &&
			blockRow(filled.id).revision === filled.revision,
		JSON.stringify({ mode: proposed.block?.mode, change: proposed.block?.change })
	)
	const confirmed = await ctx.decide(proposed.block.actionId, 'confirm')
	check(
		'Delete block deletes the block softly',
		confirmed.block?.state === 'applied' &&
			confirmed.block.undo === 'available' &&
			blockRow(filled.id).deleted === true &&
			blockRow(filled.id).body === 'Football\nChess'
	)
	const filledUndo = await ctx.undo(proposed.block.actionId)
	check(
		'Undo brings the block back with its text and its place',
		filledUndo.block?.undo === 'undone' &&
			blockRow(filled.id).deleted === false &&
			blockRow(filled.id).body === 'Football\nChess' &&
			blockRow(filled.id).position === filledPosition
	)
	const reloaded = await ctx.shown(proposed.conversation, proposed.block.actionId)
	check(
		'after a reload the deleted block proposal reads as the endpoint answered',
		reloaded?.state === 'applied' && reloaded.undo === 'undone'
	)
	return 'CHAT_NOTES_BLOCKS_OK'
}

const termRow = (termId) =>
	sql(
		`select term, note, added_by, removed_at is not null as removed, removed_by from student_terms where id = ${quote(termId)}`
	).rows[0]

const termId = (studentId, term) =>
	sql(`select id from student_terms where student_id = ${quote(studentId)} and lower(term) = lower(${quote(term)})`)
		.rows[0]?.id

async function sectionWords(h, ctx) {
	const studentId = await ctx.card(`${PREFIX}3 Words`)
	for (const term of ['apple', 'banana']) {
		const res = await ctx.as('POST', `/students/${studentId}/terms`, { term, note: null })
		if (res.status !== 201 && res.status !== 200) throw new Error(`term add returned ${res.status}`)
	}
	sql(
		`update student_terms set removed_at = now(), removed_by = 'chat' where id = ${quote(termId(studentId, 'banana'))}`
	)
	const added = await blockTurn(h, ctx, studentId, 'vocabulary_add', {
		words: [
			{ term: 'cherry', note: 'a small fruit' },
			{ term: 'grape', note: null },
			{ term: 'apple', note: null },
			{ term: 'banana', note: null },
		],
	})
	const states = Object.fromEntries((added.block?.words ?? []).map((word) => [word.term, word.state]))
	check(
		'new words are added at once, a live word is already written and a removed word comes back from Removed',
		added.block?.mode === 'receipt' &&
			added.block.change === 'words_added' &&
			added.block.target.kind === 'vocabulary' &&
			added.block.undo === 'available' &&
			states.cherry === 'added' &&
			states.grape === 'added' &&
			states.apple === 'already' &&
			states.banana === 'restored' &&
			termRow(termId(studentId, 'cherry'))?.added_by === 'chat' &&
			termRow(termId(studentId, 'banana'))?.removed === false,
		JSON.stringify(states)
	)
	const cherry = termId(studentId, 'cherry')
	const edited = await ctx.as('PATCH', `/students/${studentId}/terms/${cherry}`, { note: 'edited by the teacher' })
	const late = await ctx.undo(added.block.actionId)
	check(
		'Undo of added words after the teacher edited one of them is unavailable and removes nothing',
		edited.status === 200 &&
			late.block?.undo === 'unavailable' &&
			late.block.issue === 'words_changed' &&
			termRow(cherry)?.note === 'edited by the teacher' &&
			termRow(termId(studentId, 'grape'))?.removed === false,
		JSON.stringify({ status: edited.status, undo: late.block?.undo, issue: late.block?.issue })
	)
	check(
		'after a reload the refused Undo of words reads as unavailable',
		(await ctx.shown(added.conversation, added.block.actionId))?.undo === 'unavailable'
	)

	sql(
		`update student_terms set removed_at = now(), removed_by = 'chat' where id = ${quote(termId(studentId, 'banana'))}`
	)
	const second = await blockTurn(h, ctx, studentId, 'vocabulary_add', {
		words: [
			{ term: 'melon', note: null },
			{ term: 'banana', note: null },
		],
	})
	const melon = termId(studentId, 'melon')
	const secondUndo = await ctx.undo(second.block.actionId)
	check(
		'Undo of added words erases the new word and puts the restored word back into Removed',
		secondUndo.block?.undo === 'undone' &&
			melon !== undefined &&
			termRow(melon) === undefined &&
			termRow(termId(studentId, 'banana'))?.removed === true,
		JSON.stringify({ undo: secondUndo.block?.undo })
	)
	check(
		'after a reload the undone words receipt reads as undone',
		(await ctx.shown(second.conversation, second.block.actionId))?.undo === 'undone'
	)

	const grape = termId(studentId, 'grape')
	const apple = termId(studentId, 'apple')
	const removed = await blockTurn(h, ctx, studentId, 'vocabulary_remove', { term_ids: [grape, apple] })
	check(
		'removing two words puts them into Removed at once by the chat',
		removed.block?.change === 'words_removed' &&
			removed.block.undo === 'available' &&
			removed.block.words.length === 2 &&
			removed.block.words.every((word) => word.state === 'removed') &&
			termRow(grape)?.removed === true &&
			termRow(grape)?.removed_by === 'chat' &&
			termRow(apple)?.removed === true,
		JSON.stringify({ change: removed.block?.change })
	)
	const restored = await ctx.undo(removed.block.actionId)
	check(
		'Undo of removed words restores them',
		restored.block?.undo === 'undone' && termRow(grape)?.removed === false && termRow(apple)?.removed === false
	)
	check(
		'after a reload the removed words receipt reads as undone',
		(await ctx.shown(removed.conversation, removed.block.actionId))?.undo === 'undone'
	)
	return 'CHAT_NOTES_WORDS_OK'
}

async function noteCommand(ctx, studentId, name, line) {
	const conversation = await ctx.fresh()
	const text = `/note @${name} ${line}`
	const sent = await ctx.as('POST', `/chat/conversations/${conversation}/messages`, {
		requestId: randomUUID(),
		text,
		mentions: [{ studentId, text: name, start: 7, end: 7 + name.length }],
	})
	const block = sent.json?.messages?.[1]?.blocks?.[0]
	return { conversation, status: sent.status, block }
}

async function sectionNote(h, ctx) {
	const name = `${PREFIX}4 Note`
	const studentId = await ctx.card(name)
	const general = await setBlock(ctx, studentId, 'general_info', 'Lives near the school.')
	const first = await noteCommand(ctx, studentId, name, 'Likes board games.')
	check(
		'/note adds a line to General info at once with a receipt',
		first.status === 201 &&
			first.block?.type === 'note_change' &&
			first.block.change === 'updated' &&
			first.block.target.blockKey === 'general_info' &&
			first.block.undo === 'available' &&
			blockRow(general.id).body === 'Lives near the school.\nLikes board games.' &&
			noteEntries(studentId) === 0,
		JSON.stringify({ status: first.status, type: first.block?.type })
	)
	const undone = await ctx.undo(first.block.actionId)
	check(
		'Undo of /note puts the block text back',
		undone.block?.undo === 'undone' && blockRow(general.id).body === 'Lives near the school.'
	)
	check(
		'after a reload the /note receipt reads as undone',
		(await ctx.shown(first.conversation, first.block.actionId))?.undo === 'undone'
	)
	const remove = (blockId) => {
		const body = { expectedRevision: blockRow(blockId).revision }
		return call(h.api, 'DELETE', `/students/${studentId}/blocks/${blockId}`, {
			cookie: ctx.cookie,
			body,
			headers: { 'content-length': String(Buffer.byteLength(JSON.stringify(body))) },
		})
	}
	const gone = await remove(general.id)
	const firstLive = (await ctx.blocks(studentId))[0]
	const second = await noteCommand(ctx, studentId, name, 'Plays chess.')
	check(
		'after General info is deleted /note writes into the first live block',
		gone.status === 200 &&
			second.block?.type === 'note_change' &&
			second.block.target.blockId === firstLive.id &&
			blockRow(firstLive.id).body === 'Plays chess.' &&
			blockRow(general.id).deleted === true,
		JSON.stringify({ deleted: gone.status, key: second.block?.target?.blockKey })
	)
	for (const block of await ctx.blocks(studentId)) await remove(block.id)
	const third = await noteCommand(ctx, studentId, name, 'Starts in May.')
	const live = await ctx.blocks(studentId)
	check(
		'without live blocks /note creates General info and writes the line',
		third.block?.type === 'note_change' &&
			live.length === 1 &&
			live[0].name === 'General info' &&
			live[0].body === 'Starts in May.' &&
			third.block.target.blockId === live[0].id,
		JSON.stringify({ live: live.length })
	)
	check('no separate note entry was created by /note', noteEntries(studentId) === 0)
	return 'CHAT_NOTES_NOTE_OK'
}

function notesResultOf(request) {
	const part = request?.messages.at(-1)?.content?.find?.((item) => item.type === 'tool_result')
	return typeof part?.content === 'string' ? part.content : '{}'
}

const asked = process.argv.slice(2)
const names = asked.length === 0 ? Object.keys(SECTIONS) : asked
const unknown = names.filter((name) => !(name in SECTIONS))
if (unknown.length > 0) {
	console.log(`usage: node scripts/dev-checks/chat-notes.mjs [${Object.keys(SECTIONS).join('|')}]...`)
	process.exit(2)
}

const fixtures = `display_name like ${quote(`${PREFIX}%`)} and import_key is null`
console.log(`fixture tails removed ${removeFixtures(fixtures)}`)

const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
let h = null
let ctx = null
let original = null
const passed = []
try {
	h = await harness()
	ctx = await context(h)
	const teacher = accountId ?? sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
	original = {
		teacher,
		row: sql(
			`select chat_models as models, chat_model as model, chat_effort as effort, chat_monthly_cap_usd::text as cap from teacher_settings where account_id = ${quote(teacher)}`
		).rows[0],
	}
	await ctx.as('PATCH', '/settings/assistant', { models: null, model: null, effort: null, monthlyCapUsd: '10.00' })
	for (const name of names) {
		const before = failures
		const done = await SECTIONS[name](h, ctx)
		if (failures === before && done) passed.push(done)
	}
	check('the log has no fixture name', !h.lines.join('').includes(PREFIX))
} catch (err) {
	failures++
	console.log(`FAIL crashed ${err instanceof Error ? err.message : String(err)}`)
} finally {
	if (h) await h.close()
	if (ctx && ctx.conversations.length > 0) removeChats(`id in (${ctx.conversations.map(quote).join(', ')})`)
	console.log(`fixtures removed ${removeFixtures(fixtures)}`)
	if (original?.row) {
		const row = original.row
		sql(
			`update teacher_settings set chat_monthly_cap_usd = ${row.cap ?? 'null'}, chat_models = ${row.models == null ? 'null' : `${quote(JSON.stringify(row.models))}::jsonb`}, chat_model = ${row.model == null ? 'null' : quote(row.model)}, chat_effort = ${row.effort == null ? 'null' : quote(row.effort)} where account_id = ${quote(original.teacher)}`
		)
	}
}

for (const line of passed) console.log(line)
if (failures === 0 && asked.length === 0) console.log('CHAT_NOTES_CHANGES_OK')
else if (failures > 0) console.log(`chat-notes failures ${failures}`)
process.exit(failures === 0 ? 0 : 1)
