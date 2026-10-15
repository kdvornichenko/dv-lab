import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import { chatActionResponse, chatConversationReadResponse, undoResponse } from '../../packages/contracts/src/index.ts'
import { ENV_TEST, call, quote, sql, teacherCookie } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

const PORT = 4259
const PREFIX = 'Alex Example 259'
const SECTIONS = { run: sectionRun, undo: sectionUndo, offer: sectionOffer }

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

function removeChats(where) {
	const conversations = `select id from chat_conversations where ${where}`
	sql(`delete from chat_actions where conversation_id in (${conversations})`)
	sql(`delete from chat_usage_attempts where conversation_id in (${conversations})`)
	sql(`delete from chat_turns where conversation_id in (${conversations})`)
	sql(`delete from chat_messages where reply_to is not null and conversation_id in (${conversations})`)
	sql(`delete from chat_messages where conversation_id in (${conversations})`)
	return sql(`delete from chat_conversations where ${where}`).rowCount
}

function removeFixtures(where) {
	const cards = `select id from students where ${where}`
	const conversations = `select distinct conversation_id from chat_actions where target->>'studentId' in (select id::text from students where ${where})`
	const chats = sql(`select id from chat_conversations where id in (${conversations})`).rows.map((row) => row.id)
	if (chats.length > 0) removeChats(`id in (${chats.map(quote).join(', ')})`)
	sql(`delete from student_terms where student_id in (${cards})`)
	sql(`delete from student_notes where student_id in (${cards})`)
	sql(`delete from note_reviews where student_id in (${cards})`)
	return removeCards(where)
}

const one = (text) => sql(text).rows[0]

const blockBody = (blockId) => one(`select body, revision from student_sections where id = ${quote(blockId)}`)

const reviewRow = (studentId) =>
	one(
		`select reviewed_at, running_conversation_id, offered_on::text as offered_on from note_reviews where student_id = ${quote(studentId)}`
	) ?? null

const termRow = (termId) =>
	one(`select term, note, removed_at, removed_by from student_terms where id = ${quote(termId)}`)

const entryRow = (entryId) => one(`select retracted_at, revision from student_notes where id = ${quote(entryId)}`)

const reviewActions = (studentId, state) =>
	one(
		`select count(*)::int as n from chat_actions where kind = 'note' and target->>'op' = 'review' and target->>'studentId' = ${quote(studentId)} and state = ${quote(state)}`
	).n

const snapshot = (studentId) =>
	JSON.stringify({
		blocks: sql(`select id, body, revision from student_sections where student_id = ${quote(studentId)} order by id`)
			.rows,
		terms: sql(
			`select id, term, note, removed_at from student_terms where student_id = ${quote(studentId)} order by id`
		).rows,
		notes: sql(
			`select id, retracted_at, revision from student_notes where student_id = ${quote(studentId)} order by id`
		).rows,
	})

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
	const use = (name, input, before) =>
		async function* toolUse(request) {
			if (before) await before(request)
			const block = { type: 'tool_use', id: `toolu_${randomUUID().slice(0, 8)}`, name, input }
			yield { type: 'final', message: reply(request.model, [block], 'tool_use') }
		}
	const hang = () =>
		async function* hung(_request, signal) {
			await new Promise((_, reject) =>
				signal.addEventListener('abort', () => reject(new ProviderFault('provider_unavailable', { aborted: true })), {
					once: true,
				})
			)
			yield { type: 'text_end' }
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
	const restart = () => createChat({ db, logger, provider: fake })
	const close = async () => {
		await chat.close()
		await new Promise((resolve) => server.close(() => resolve()))
		await pool.end()
	}
	return { api, fake, say, use, hang, lines, restart, close }
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
	const blocksRead = async (studentId) => (await as('GET', `/students/${studentId}/blocks`)).json
	const fresh = async () => {
		const created = await as('POST', '/chat/conversations')
		conversations.push(created.json.conversation.id)
		return created.json.conversation.id
	}
	const turnState = async (turnId) => (await as('GET', `/chat/turns/${turnId}`)).json.turn
	const settle = async (turnId) => {
		const deadline = Date.now() + 20000
		while (Date.now() < deadline) {
			const turn = await turnState(turnId)
			if (turn && !['accepted', 'running'].includes(turn.state)) return turn
			await new Promise((resolve) => setTimeout(resolve, 50))
		}
		throw new Error('turn did not finish in time')
	}
	const start = async (conversationId, text, mentions, steps) => {
		h.fake.script.push(...steps)
		const sent = await as('POST', `/chat/conversations/${conversationId}/messages`, {
			requestId: randomUUID(),
			text,
			mentions,
		})
		if (sent.status !== 201 || !sent.json.turn) throw new Error(`send returned ${sent.status}`)
		return sent.json.turn.id
	}
	const turn = async (conversationId, text, mentions, steps) => {
		const done = await settle(await start(conversationId, text, mentions, steps))
		h.fake.script.length = 0
		return done
	}
	const review = (conversationId, studentId, name, steps) =>
		turn(conversationId, `/review @${name}`, [{ studentId, text: name, start: 9, end: 9 + name.length }], steps)
	const read = async (conversationId) => {
		const res = await as('GET', `/chat/conversations/${conversationId}`)
		const parsed = chatConversationReadResponse.safeParse(res.json)
		if (!parsed.success) throw new Error(`conversation read failed the contract ${res.status}`)
		return parsed.data.messages
	}
	const blocksOfType = async (conversationId, type) =>
		(await read(conversationId)).flatMap((message) => message.blocks.filter((block) => block.type === type))
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
	return {
		as,
		cookie,
		card,
		blocksRead,
		fresh,
		start,
		settle,
		turn,
		review,
		read,
		blocksOfType,
		undo,
		decide,
		conversations,
	}
}

async function setBlock(ctx, studentId, key, body) {
	const block = (await ctx.blocksRead(studentId)).blocks.find((item) => item.key === key)
	const put = await ctx.as('PUT', `/students/${studentId}/blocks/${block.id}`, {
		body,
		expectedRevision: block.revision,
	})
	if (put.status !== 200) throw new Error(`block save returned ${put.status}`)
	return put.json.block
}

function addTerm(studentId, term, note) {
	return one(
		`insert into student_terms (student_id, term, note) values (${quote(studentId)}, ${quote(term)}, ${note === null ? 'null' : quote(note)}) returning id`
	).id
}

function addEntry(studentId, body) {
	return one(
		`insert into student_notes (student_id, section_kind, body) values (${quote(studentId)}, 'general_info', ${quote(body)}) returning id`
	).id
}

async function seed(ctx, name) {
	const studentId = await ctx.card(name)
	const general = await setBlock(ctx, studentId, 'general_info', 'Likes chess.\nLikes chess.\nWorks as a nurse.')
	const interests = await setBlock(ctx, studentId, 'interests', 'Plays the gutiar.\nReads novels.')
	const level = await setBlock(ctx, studentId, 'level', 'Speaking is B2.')
	const goals = await setBlock(ctx, studentId, 'goals', 'Speaking is B1 now.')
	const entry = addEntry(studentId, 'Prefers evening lessons.')
	const keep = addTerm(studentId, 'look forward to', 'wait with pleasure')
	const twin = addTerm(studentId, 'looking forward to', null)
	const typo = addTerm(studentId, 'recieve', 'get')
	return { studentId, name, general, interests, level, goals, entry, keep, twin, typo }
}

function fullApply(f, extra = {}) {
	return {
		student_id: f.studentId,
		blocks: [
			{ block_id: f.general.id, text: 'Likes chess.\nWorks as a nurse.\nPrefers evening lessons.' },
			{ block_id: f.interests.id, text: 'Plays the guitar.\nReads novels.' },
		],
		words: [{ term_id: f.typo, term: 'receive', note: 'get' }],
		remove_words: [f.twin],
		merged_entries: [f.entry],
		fixed: [
			{ text: 'Removed a repeated line.', block_id: f.general.id },
			{ text: 'Corrected a spelling mistake.', block_id: f.interests.id },
			{ text: 'Removed a duplicate word.', block_id: null },
		],
		found: [{ text: 'Level and Goals disagree about speaking.', block_id: f.level.id }],
		decisions: [{ text: 'Which speaking level is right?', block_id: f.goals.id }],
		...extra,
	}
}

async function sectionRun(h, ctx) {
	const f = await seed(ctx, `${PREFIX}0 Run`)
	const conversation = await ctx.fresh()
	let during = null
	const done = await ctx.review(conversation, f.studentId, f.name, [
		h.use('review_read', { student_id: f.studentId }),
		h.use('apply_review', fullApply(f), async () => {
			during = (await ctx.blocksRead(f.studentId)).reviewRunning
		}),
		h.say('The review is done.'),
	])
	const request = h.fake.calls.at(-3)
	check(
		'the /review turn offers only review_read and apply_review and the review task',
		JSON.stringify(request?.tools.map((tool) => tool.name)) === JSON.stringify(['review_read', 'apply_review']) &&
			String(request?.messages.at(-1)?.content).includes('Call review_read first'),
		JSON.stringify(request?.tools.map((tool) => tool.name))
	)
	const readResult = JSON.parse(toolResultOf(h.fake.calls.at(-2)))
	check(
		'review_read gives every live block with revision and text, the words and the older entries',
		readResult.blocks?.length === 6 &&
			readResult.blocks.some((block) => block.block_id === f.general.id && block.revision === f.general.revision) &&
			readResult.words?.length === 3 &&
			readResult.entries?.some((entry) => entry.entry_id === f.entry),
		JSON.stringify(Object.keys(readResult))
	)
	check(
		'while the review runs the blocks read gives Review in progress with the conversation',
		during?.conversationId === conversation,
		JSON.stringify(during)
	)
	check(
		'the repeated line is removed and the older entry is merged into General info',
		done.state === 'completed' &&
			blockBody(f.general.id).body === 'Likes chess.\nWorks as a nurse.\nPrefers evening lessons.',
		JSON.stringify({ state: done.state })
	)
	check('the misspelling is corrected', blockBody(f.interests.id).body === 'Plays the guitar.\nReads novels.')
	check(
		'the conflicting blocks stay as they were',
		blockBody(f.level.id).body === 'Speaking is B2.' && blockBody(f.goals.id).body === 'Speaking is B1 now.'
	)
	const twin = termRow(f.twin)
	check(
		'the duplicate word is in Removed by review and the misspelled word is corrected',
		twin.removed_at !== null &&
			twin.removed_by === 'review' &&
			termRow(f.typo).term === 'receive' &&
			termRow(f.keep).removed_at === null
	)
	check('the merged older entry is retracted', entryRow(f.entry).retracted_at !== null)
	check(
		'the review date is set and the running flag is cleared',
		reviewRow(f.studentId)?.reviewed_at != null && reviewRow(f.studentId)?.running_conversation_id === null
	)
	check('one applied receipt holds the whole review', reviewActions(f.studentId, 'applied') === 1)
	const result = (await ctx.blocksOfType(conversation, 'review_result'))[0]
	check(
		'the result block names fixed, found and decisions with block links and Undo available',
		result?.undo === 'available' &&
			result.fixed.length === 3 &&
			result.fixed[0].block?.blockId === f.general.id &&
			result.found.length === 1 &&
			result.found[0].block?.blockKey === 'level' &&
			result.decisions.length === 1 &&
			result.decisions[0].block?.blockId === f.goals.id,
		JSON.stringify({
			undo: result?.undo,
			fixed: result?.fixed.length,
			found: result?.found.length,
			decisions: result?.decisions.length,
		})
	)
	check(
		'the blocks read after the review gives no Review in progress',
		(await ctx.blocksRead(f.studentId)).reviewRunning === null
	)

	const g = await seed(ctx, `${PREFIX}1 Changed`)
	const changedChat = await ctx.fresh()
	const before = snapshot(g.studentId)
	let teacherText = null
	const changed = await ctx.review(changedChat, g.studentId, g.name, [
		h.use('review_read', { student_id: g.studentId }),
		h.use('apply_review', fullApply(g), async () => {
			const block = await setBlock(ctx, g.studentId, 'general_info', 'Teacher wrote this.')
			teacherText = block.body
		}),
		h.say('The notes changed.'),
	])
	const after = JSON.parse(snapshot(g.studentId))
	const general = after.blocks.find((block) => block.id === g.general.id)
	check(
		'a teacher edit between review_read and apply_review stops the review: only the teacher text is written',
		changed.state === 'completed' &&
			teacherText === 'Teacher wrote this.' &&
			general.body === 'Teacher wrote this.' &&
			JSON.stringify(after.terms) === JSON.stringify(JSON.parse(before).terms) &&
			JSON.stringify(after.notes) === JSON.stringify(JSON.parse(before).notes) &&
			after.blocks
				.filter((block) => block.id !== g.general.id)
				.every((block) =>
					JSON.parse(before).blocks.some(
						(old) => old.id === block.id && old.body === block.body && old.revision === block.revision
					)
				)
	)
	check(
		'after the refused review the date is not set and no receipt is applied',
		(reviewRow(g.studentId)?.reviewed_at ?? null) === null && reviewActions(g.studentId, 'applied') === 0
	)
	const refusedBlock = (await ctx.blocksOfType(changedChat, 'review_result'))[0]
	check(
		'the refused review shows a result with the issue changed and no Undo',
		refusedBlock?.issue === 'changed' && refusedBlock.undo === 'none',
		JSON.stringify(refusedBlock)
	)

	const s = await seed(ctx, `${PREFIX}2 Stop`)
	const stopChat = await ctx.fresh()
	const stopBefore = snapshot(s.studentId)
	const stopTurn = await ctx.start(
		stopChat,
		`/review @${s.name}`,
		[{ studentId: s.studentId, text: s.name, start: 9, end: 9 + s.name.length }],
		[h.use('review_read', { student_id: s.studentId }), h.hang()]
	)
	await waitFor(() => h.fake.script.length === 0)
	const running = (await ctx.blocksRead(s.studentId)).reviewRunning
	const stopped = await ctx.as('POST', `/chat/turns/${stopTurn}/stop`, {})
	const stopEnd = await ctx.settle(stopTurn)
	check(
		'a stopped review writes nothing, sets no date and clears Review in progress',
		running?.conversationId === stopChat &&
			stopped.status === 200 &&
			stopEnd.state === 'stopped' &&
			snapshot(s.studentId) === stopBefore &&
			(reviewRow(s.studentId)?.reviewed_at ?? null) === null &&
			(await ctx.blocksRead(s.studentId)).reviewRunning === null,
		JSON.stringify({ running, stop: stopped.status, state: stopEnd.state })
	)

	const k = await seed(ctx, `${PREFIX}3 Kept`)
	setBlockSql(k.general.id, 'Line one.\nLine two.\nLine thre.')
	const lonely = addEntry(k.studentId, 'Has a cat.')
	const keptChat = await ctx.fresh()
	await ctx.review(keptChat, k.studentId, k.name, [
		h.use('review_read', { student_id: k.studentId }),
		h.use('apply_review', {
			student_id: k.studentId,
			blocks: [{ block_id: k.general.id, text: 'Line one.\nLine three.' }],
			words: [],
			remove_words: [],
			merged_entries: [lonely],
			fixed: [{ text: 'Cleaned up General info.', block_id: k.general.id }],
			found: [],
			decisions: [],
		}),
		h.say('Done.'),
	])
	const kept = (await ctx.blocksOfType(keptChat, 'review_result'))[0]
	check(
		'a line that is not a repeat or a misspelling stays in the block; the typo is still fixed',
		blockBody(k.general.id).body === 'Line one.\nLine two.\nLine three.',
		JSON.stringify(blockBody(k.general.id))
	)
	check(
		'the kept line and the fixed item of that block are in decisions, not in fixed',
		kept?.fixed.length === 0 &&
			kept.decisions.some((item) => item.text.includes('Line two.') && item.block?.blockId === k.general.id) &&
			kept.decisions.some((item) => item.text === 'Cleaned up General info.'),
		JSON.stringify({ fixed: kept?.fixed.length, decisions: kept?.decisions.length })
	)
	check(
		'an entry whose text is not in the blocks stays visible and is in decisions',
		entryRow(lonely).retracted_at === null && kept?.decisions.some((item) => item.text.includes('Has a cat.'))
	)

	const r = await seed(ctx, `${PREFIX}4 Restart`)
	const restartChat = await ctx.fresh()
	const restartBefore = snapshot(r.studentId)
	await ctx.start(
		restartChat,
		`/review @${r.name}`,
		[{ studentId: r.studentId, text: r.name, start: 9, end: 9 + r.name.length }],
		[h.use('review_read', { student_id: r.studentId }), h.hang()]
	)
	await waitFor(() => h.fake.script.length === 0)
	const live = (await ctx.blocksRead(r.studentId)).reviewRunning
	const swept = await h.restart().sweepInterrupted()
	const flag = reviewRow(r.studentId)?.running_conversation_id
	check(
		'after a restart in the middle of a review the sweep ends the turn and Review in progress is gone',
		live?.conversationId === restartChat &&
			swept >= 1 &&
			flag === restartChat &&
			(await ctx.blocksRead(r.studentId)).reviewRunning === null,
		JSON.stringify({ live, swept, flagged: flag === restartChat })
	)
	check(
		'the review cut by the restart wrote nothing and set no date',
		snapshot(r.studentId) === restartBefore && (reviewRow(r.studentId)?.reviewed_at ?? null) === null
	)
	check(
		'a review needs one mentioned student: /review without a mention runs a normal turn',
		(await ctx.turn(await ctx.fresh(), '/review', [], [h.say('Which student?')])).state === 'completed' &&
			!h.fake.calls.at(-1).tools.some((tool) => tool.name === 'apply_review')
	)
	return { line: 'CHAT_REVIEW_RUN_OK', fixture: f }
}

async function reviewed(h, ctx, f) {
	const conversation = await ctx.fresh()
	await ctx.review(conversation, f.studentId, f.name, [
		h.use('review_read', { student_id: f.studentId }),
		h.use('apply_review', fullApply(f)),
		h.say('Done.'),
	])
	const block = (await ctx.blocksOfType(conversation, 'review_result'))[0]
	if (block?.undo !== 'available') throw new Error('the review left no Undo')
	return { conversation, block }
}

async function sectionUndo(h, ctx) {
	const f = await seed(ctx, `${PREFIX}5 Undo`)
	const before = snapshot(f.studentId)
	const first = await reviewed(h, ctx, f)
	const stamped = reviewRow(f.studentId)?.reviewed_at
	const requestId = randomUUID()
	const undone = await ctx.undo(first.block.actionId, requestId)
	check(
		'Undo right after the review puts back every block text, the corrected word and the removed word',
		undone.status === 200 &&
			undone.block?.type === 'review_result' &&
			undone.block.undo === 'undone' &&
			blockBody(f.general.id).body === 'Likes chess.\nLikes chess.\nWorks as a nurse.' &&
			blockBody(f.interests.id).body === 'Plays the gutiar.\nReads novels.' &&
			termRow(f.typo).term === 'recieve' &&
			termRow(f.twin).removed_at === null,
		JSON.stringify({ status: undone.status, undo: undone.block?.undo })
	)
	const notes = await ctx.as('GET', `/students/${f.studentId}/notes`)
	check(
		'Undo brings the merged older entry back into the notes list',
		entryRow(f.entry).retracted_at === null && notes.status === 200 && JSON.stringify(notes.json).includes(f.entry)
	)
	const restored = JSON.parse(snapshot(f.studentId))
	const original = JSON.parse(before)
	check(
		'after Undo the texts, words and entries are as before the review',
		JSON.stringify(restored.blocks.map((block) => [block.id, block.body])) ===
			JSON.stringify(original.blocks.map((block) => [block.id, block.body])) &&
			JSON.stringify(restored.terms.map((term) => [term.id, term.term, term.note, term.removed_at])) ===
				JSON.stringify(original.terms.map((term) => [term.id, term.term, term.note, term.removed_at])) &&
			restored.notes.every((note) => note.retracted_at === null)
	)
	check(
		'Undo keeps the review date',
		stamped != null && String(reviewRow(f.studentId)?.reviewed_at) === String(stamped)
	)
	const again = await ctx.undo(first.block.actionId, requestId)
	check(
		'a repeated Undo with the same request id gives the same answer and writes nothing',
		again.status === 200 && again.block?.undo === 'undone' && snapshot(f.studentId) === JSON.stringify(restored)
	)
	check(
		'after a reload the review result reads as undone',
		(await ctx.blocksOfType(first.conversation, 'review_result'))[0]?.undo === 'undone'
	)

	const g = await seed(ctx, `${PREFIX}5 Undo Edited`)
	const second = await reviewed(h, ctx, g)
	await setBlock(ctx, g.studentId, 'interests', 'Plays the guitar.\nReads novels.\nTeacher line.')
	const edited = snapshot(g.studentId)
	const refused = await ctx.undo(second.block.actionId)
	check(
		'Undo after the teacher changed one block is unavailable and changes nothing',
		refused.status === 200 &&
			refused.block?.type === 'review_result' &&
			refused.block.undo === 'unavailable' &&
			refused.block.issue === 'block_changed' &&
			snapshot(g.studentId) === edited,
		JSON.stringify({ status: refused.status, undo: refused.block?.undo })
	)
	check(
		'after a reload the review result reads as unavailable',
		(await ctx.blocksOfType(second.conversation, 'review_result'))[0]?.undo === 'unavailable'
	)
	return { line: 'CHAT_REVIEW_UNDO_OK' }
}

async function notesTurn(h, ctx, conversation, studentId, name) {
	const text = `What do the notes of @${name} say?`
	const start = text.indexOf('@') + 1
	return ctx.turn(
		conversation,
		text,
		[{ studentId, text: name, start, end: start + name.length }],
		[h.use('student_notes', { student_id: studentId }), h.say('The notes are short.')]
	)
}

const offersIn = (ctx, conversation) => ctx.blocksOfType(conversation, 'review_offer')

async function sectionOffer(h, ctx) {
	const name = `${PREFIX}6 Offer`
	const studentId = await ctx.card(name)
	await setBlock(ctx, studentId, 'general_info', 'Likes chess.')
	const first = await ctx.fresh()
	await notesTurn(h, ctx, first, studentId, name)
	const messages = await ctx.read(first)
	const holder = messages.find((message) => message.blocks.some((block) => block.type === 'review_offer'))
	const offer = holder?.blocks.find((block) => block.type === 'review_offer')
	check(
		'a turn that read the notes of a never reviewed student ends with a separate review question',
		messages.length === 3 &&
			holder?.role === 'assistant' &&
			holder.body === '' &&
			holder.blocks.length === 1 &&
			offer?.studentId === studentId &&
			offer.state === 'proposed' &&
			offer.lastReviewedAt === null &&
			reviewRow(studentId)?.offered_on != null,
		JSON.stringify({ messages: messages.length, state: offer?.state })
	)
	const today = reviewRow(studentId)?.offered_on
	sql(`update note_reviews set offered_on = ${quote(today)}::date - 1 where student_id = ${quote(studentId)}`)
	await notesTurn(h, ctx, first, studentId, name)
	check('a second notes turn in the same conversation asks nothing', (await offersIn(ctx, first)).length === 1)
	sql(`update note_reviews set offered_on = ${quote(today)}::date where student_id = ${quote(studentId)}`)
	const second = await ctx.fresh()
	await notesTurn(h, ctx, second, studentId, name)
	check('another conversation on the same day asks nothing', (await offersIn(ctx, second)).length === 0)

	const freshName = `${PREFIX}6 Offer Fresh`
	const freshId = await ctx.card(freshName)
	await setBlock(ctx, freshId, 'general_info', 'Reads novels.')
	addTerm(freshId, 'novel', null)
	sql(`update student_sections set updated_at = now() - interval '2 days' where student_id = ${quote(freshId)}`)
	sql(`update student_terms set created_at = now() - interval '2 days' where student_id = ${quote(freshId)}`)
	sql(
		`insert into note_reviews (student_id, reviewed_at) values (${quote(freshId)}, now() - interval '1 day') on conflict (student_id) do update set reviewed_at = excluded.reviewed_at, offered_on = null`
	)
	const stamp = String(reviewRow(freshId).reviewed_at)
	const third = await ctx.fresh()
	await notesTurn(h, ctx, third, freshId, freshName)
	check('a review yesterday with no change since asks nothing', (await offersIn(ctx, third)).length === 0)
	await setBlock(ctx, freshId, 'interests', 'Plays chess.')
	const fourth = await ctx.fresh()
	await notesTurn(h, ctx, fourth, freshId, freshName)
	const changed = (await offersIn(ctx, fourth))[0]
	check(
		'notes changed after the last review bring the question with the date of that review',
		changed?.state === 'proposed' && changed.lastReviewedAt !== null,
		JSON.stringify(changed)
	)

	const quietName = `${PREFIX}6 Offer Quiet`
	const quietId = await ctx.card(quietName)
	const quiet = await ctx.fresh()
	const text = `Hello about @${quietName}`
	const at = text.indexOf('@') + 1
	await ctx.turn(
		quiet,
		text,
		[{ studentId: quietId, text: quietName, start: at, end: at + quietName.length }],
		[h.say('Hello.')]
	)
	check('a turn without notes tools asks nothing', (await offersIn(ctx, quiet)).length === 0)

	const unanswered = (await offersIn(ctx, first))[0]
	const yes = await ctx.decide(offer.actionId, 'confirm')
	const no = await ctx.decide(changed.actionId, 'decline')
	check(
		'Yes answers the question as accepted and No as declined',
		unanswered?.state === 'proposed' &&
			yes.status === 200 &&
			yes.block?.type === 'review_offer' &&
			yes.block.state === 'accepted' &&
			no.status === 200 &&
			no.block?.type === 'review_offer' &&
			no.block.state === 'declined',
		JSON.stringify({ yes: yes.status, yesState: yes.block?.state, no: no.status, noState: no.block?.state })
	)
	check(
		'an answer does not change the review date',
		(reviewRow(studentId)?.reviewed_at ?? null) === null && String(reviewRow(freshId).reviewed_at) === stamp
	)
	check(
		'after a reload the answered questions read as accepted and declined',
		(await offersIn(ctx, first))[0]?.state === 'accepted' && (await offersIn(ctx, fourth))[0]?.state === 'declined'
	)
	return { line: 'CHAT_REVIEW_OFFER_OK' }
}

function setBlockSql(blockId, body) {
	sql(`update student_sections set body = ${quote(body)}, revision = revision + 1 where id = ${quote(blockId)}`)
}

async function waitFor(test) {
	const deadline = Date.now() + 10000
	while (Date.now() < deadline) {
		if (test()) {
			await new Promise((resolve) => setTimeout(resolve, 200))
			return
		}
		await new Promise((resolve) => setTimeout(resolve, 50))
	}
	throw new Error('wait timed out')
}

function toolResultOf(request) {
	const part = request?.messages.at(-1)?.content?.find?.((item) => item.type === 'tool_result')
	return typeof part?.content === 'string' ? part.content : '{}'
}

const asked = process.argv.slice(2)
const names = asked.length === 0 ? Object.keys(SECTIONS) : asked
const unknown = names.filter((name) => !(name in SECTIONS))
if (unknown.length > 0) {
	console.log(`usage: node scripts/dev-checks/chat-review.mjs [${Object.keys(SECTIONS).join('|')}]...`)
	process.exit(2)
}

const fixtures = `display_name like ${quote(`${PREFIX}%`)} and import_key is null`
console.log(`fixture tails removed ${removeFixtures(fixtures)}`)

let h = null
let ctx = null
let original = null
const passed = []
try {
	h = await harness()
	ctx = await context(h)
	const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
	original = {
		teacher,
		row: sql(
			`select chat_models as models, chat_model as model, chat_effort as effort, chat_monthly_cap_usd::text as cap from teacher_settings where account_id = ${quote(teacher)}`
		).rows[0],
	}
	await ctx.as('PATCH', '/settings/assistant', { models: null, model: null, effort: null, monthlyCapUsd: '10.00' })
	const shared = {}
	for (const name of names) {
		const before = failures
		const done = await SECTIONS[name](h, ctx, shared)
		if (done?.fixture) shared.run = done.fixture
		if (failures === before && done) passed.push(done.line)
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
if (failures === 0 && asked.length === 0) console.log('CHAT_REVIEW_OK')
else if (failures > 0) console.log(`chat-review failures ${failures}`)
process.exit(failures === 0 ? 0 : 1)
