import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import { chatActionResponse, chatConversationReadResponse, undoResponse } from '../../packages/contracts/src/index.ts'
import { ENV_TEST, call, quote, sql, teacherCookie } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

const PORT = 4258
const PREFIX = 'Alex Example 258'
const SECTIONS = { append: sectionAppend }

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
	const cards = `select id from students where ${where}`
	const conversations = `select distinct conversation_id from chat_actions where target->>'studentId' in (select id::text from students where ${where})`
	const chats = sql(`select id from chat_conversations where id in (${conversations})`).rows.map((row) => row.id)
	if (chats.length > 0) removeChats(`id in (${chats.map(quote).join(', ')})`)
	sql(`delete from student_terms where student_id in (${cards})`)
	sql(`delete from student_notes where student_id in (${cards})`)
	sql(`delete from note_reviews where student_id in (${cards})`)
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
	return { as, card, blocks, fresh, turn, read, noteBlocks, shown, undo, decide, conversations }
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
