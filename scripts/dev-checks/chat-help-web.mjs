import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'

import { BASE, ROOT, check, failures, shot, signIn, sql, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'

const FAKE_PORT = 4262
const FIELD = '[data-slot="chat-composer-field"]'
const POPUP = '[data-slot="mention-popup"]'
const SEND = '[data-slot="chat-send"]'
const HELP = '[data-slot="chat-help"]'
const TEACHER = '[data-role="teacher"]'
const ASSISTANT = '[data-role="assistant"]'
const COMMANDS = ['/today', '/tomorrow', '/payments', '/note', '/recap', '/essay', '/review', '/help']
const SECTIONS = [
	'Students',
	'Lessons',
	'Payments',
	'Notes and vocabulary',
	'Google Calendar',
	'Study materials',
	'App pages',
]
const MODEL_ASK = '[fake:help] what can you do?'
const EXPECTED_NOISE = /Failed to load resource|server caches disabled|Route "\/login": Next\.js encountered URL data/
const oneLine = (text) => text.replace(/\s+/g, ' ').trim()
const q = (value) => `'${String(value).replaceAll("'", "''")}'`

function portFree(port) {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host: '127.0.0.1' })
		socket.setTimeout(1500)
		socket.on('connect', () => {
			socket.destroy()
			resolve(false)
		})
		socket.on('timeout', () => {
			socket.destroy()
			resolve(true)
		})
		socket.on('error', () => resolve(true))
	})
}

async function startFakeApi() {
	if (!(await portFree(FAKE_PORT))) throw new Error(`port ${FAKE_PORT} is busy: this check starts its own api`)
	const env = {
		...process.env,
		PORT: String(FAKE_PORT),
		APP_ORIGIN: BASE,
		ANTHROPIC_API_KEY: 'sk-ant-fake-check',
		LOG_LEVEL: 'info',
		CHAT_FAKE_DELAY_MS: '20',
	}
	delete env.DATABASE_URL
	delete env.MIGRATOR_DATABASE_URL
	const child = spawn(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/chat-fake-anthropic.mjs`, '--env-file=.env', 'apps/api/src/server.ts'],
		{ cwd: ROOT, env, stdio: ['ignore', 'ignore', 'ignore'] }
	)
	const deadline = Date.now() + 30000
	while (Date.now() < deadline) {
		if (child.exitCode !== null) break
		try {
			const res = await fetch(`http://127.0.0.1:${FAKE_PORT}/healthz`)
			if (res.status === 200) return child
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 300))
	}
	child.kill('SIGTERM')
	throw new Error('the api with the fake model did not answer /healthz in 30 s')
}

function stopFakeApi(child) {
	if (!child || child.exitCode !== null) return Promise.resolve()
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			child.kill('SIGKILL')
			resolve()
		}, 15000)
		child.once('exit', () => {
			clearTimeout(timer)
			resolve()
		})
		child.kill('SIGTERM')
	})
}

function removeConversations(ids) {
	if (ids.length === 0) return
	const list = ids.map(q).join(', ')
	sql(`delete from chat_actions where conversation_id in (${list})`)
	sql(`delete from chat_usage_attempts where conversation_id in (${list})`)
	sql(`delete from chat_turns where conversation_id in (${list})`)
	sql(`delete from chat_messages where reply_to is not null and conversation_id in (${list})`)
	sql(`delete from chat_messages where conversation_id in (${list})`)
	const result = sql(`delete from chat_conversations where id in (${list})`)
	console.log(`fixture conversations removed ${result.rowCount}`)
}

async function routeChatTo(page) {
	await page.route('**/api/chat/**', async (route) => {
		const url = new URL(route.request().url())
		const target = `http://127.0.0.1:${FAKE_PORT}${url.pathname.replace(/^\/api/, '')}${url.search}`
		const headers = { ...(await route.request().allHeaders()), origin: BASE, 'x-forwarded-for': '127.0.0.1' }
		try {
			await route.fulfill({ response: await route.fetch({ url: target, headers }) })
		} catch {
			await route.abort().catch(() => undefined)
		}
	})
}

const value = (page) => page.locator(FIELD).inputValue()
const fieldFocused = (page) =>
	page.evaluate(() => document.activeElement?.getAttribute('data-slot') === 'chat-composer-field')
const row = (page, name) => page.locator(HELP).last().locator(`button[data-command="${name}"]`)

async function send(page, text) {
	const field = page.locator(FIELD)
	await field.fill(text)
	await page.locator(SEND).click()
}

async function waitIdle(page) {
	await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 30000 })
	await page.waitForFunction((selector) => document.querySelector(selector)?.disabled === false, FIELD, {
		timeout: 30000,
	})
}

async function helpShape(block) {
	return block.evaluate((node) => ({
		label: node.getAttribute('aria-label'),
		commands: Array.from(node.querySelectorAll('button[data-command]')).map((button) => ({
			name: button.getAttribute('data-command'),
			label: button.getAttribute('aria-label'),
		})),
		sections: Array.from(node.querySelectorAll('[data-slot="chat-help-section"]')).map(
			(section) => section.firstElementChild?.textContent ?? ''
		),
		text: node.innerText,
	}))
}

async function desktop(page, conversations) {
	await page.addInitScript((value) => {
		try {
			localStorage.setItem('theme', value)
		} catch {}
	}, theme)
	await page.goto(`${BASE}/chat`)
	await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
	await page.getByRole('button', { name: 'New chat', exact: true }).first().click()
	await page.locator('[data-slot="chat-commands"]').waitFor({ timeout: 30000 })
	const listRows = (await page.locator('[data-slot="chat-commands"] button').allInnerTexts()).map(oneLine)
	check(
		'the new-chat list has nine rows: @ and the eight commands with /review and /help at the end',
		listRows.length === 9 &&
			listRows[0].startsWith('@') &&
			COMMANDS.every((name, index) => listRows[index + 1]?.startsWith(name)) &&
			listRows[7].includes("Review a student's notes") &&
			listRows[8].includes('What I can do'),
		listRows.join(' | ')
	)
	await page.locator(FIELD).click()
	await page.keyboard.type('/')
	await page.locator(POPUP).waitFor({ timeout: 15000 })
	const options = (await page.locator(POPUP).getByRole('option').allInnerTexts()).map(oneLine)
	check(
		'typing / offers the same eight commands in the same order',
		options.length === 8 && COMMANDS.every((name, index) => options[index]?.startsWith(name)),
		options.join(' | ')
	)
	await page.keyboard.type('rev')
	await page.keyboard.press('Enter')
	check('/review from the popup inserts "/review @" and opens the student list', (await value(page)) === '/review @')
	await page.locator(POPUP).waitFor({ timeout: 5000 })
	await page.keyboard.press('Escape')
	await page.locator(FIELD).fill('')

	await send(page, '/help')
	await page.locator(HELP).first().waitFor({ timeout: 30000 })
	await waitIdle(page)
	await page.waitForURL((url) => url.searchParams.has('c'), { timeout: 15000 }).catch(() => undefined)
	const conversationId = new URL(page.url()).searchParams.get('c')
	if (conversationId) conversations.push(conversationId)
	check('the /help send opened a conversation', conversationId !== null)
	const id = q(conversationId ?? '00000000-0000-0000-0000-000000000000')
	const turns = Number(sql(`select count(*)::int as n from chat_turns where conversation_id = ${id}`).rows[0]?.n)
	const attempts = Number(
		sql(`select count(*)::int as n from chat_usage_attempts where conversation_id = ${id}`).rows[0]?.n
	)
	const reply = sql(
		`select body, blocks::text as blocks, steps::text as steps from chat_messages where conversation_id = ${id} and role = 'assistant'`
	).rows
	check(
		'/help is answered by the app: no turn, no budget attempt, one reply with only the help block, no text and no steps',
		turns === 0 &&
			attempts === 0 &&
			reply.length === 1 &&
			reply[0].body === '' &&
			JSON.parse(String(reply[0].blocks)).length === 1 &&
			JSON.parse(String(reply[0].blocks))[0].type === 'help' &&
			JSON.parse(String(reply[0].steps)).length === 0,
		JSON.stringify({ turns, attempts, reply: reply.map((item) => ({ ...item, body: item.body.length })) })
	)
	const teacherBubble = await page.locator(TEACHER).last().innerText()
	check('the teacher /help stays a plain bubble', teacherBubble.startsWith('/help'), teacherBubble)
	const answer = page.locator(ASSISTANT).last()
	check(
		'the /help reply has no progress line, no Stop and no Copy reply; the field is free',
		(await answer.getByRole('status').count()) === 0 &&
			(await page.locator('[data-slot="chat-stop"]').count()) === 0 &&
			(await answer.getByRole('button', { name: 'Copy reply' }).count()) === 0 &&
			(await page.locator(FIELD).isEnabled())
	)
	const shape = await helpShape(page.locator(HELP).last())
	check(
		'the block is a group named Help with the eight commands named by command and description',
		shape.label === 'Help' &&
			shape.commands.length === 8 &&
			COMMANDS.every((name, index) => shape.commands[index]?.name === name) &&
			shape.commands[3]?.label === '/note, Add a note to a student',
		JSON.stringify(shape.commands)
	)
	check(
		'the block shows the seven sections, the caption and the foot line',
		shape.sections.length === 7 &&
			SECTIONS.every((name, index) => shape.sections[index] === name) &&
			shape.text.includes('Type a command, or ask in your own words. @ mentions a student.') &&
			shape.text.includes('You confirm every change in the chat.'),
		shape.sections.join(' | ')
	)
	const heights = await page
		.locator(HELP)
		.last()
		.locator('button[data-command]')
		.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)))
	check(
		'at 1280 the command rows are 40 px',
		heights.every((height) => height === 40),
		heights.join(',')
	)

	const sentBefore = await page.locator(TEACHER).count()
	await row(page, '/today').click()
	await page.waitForTimeout(800)
	check(
		'a click on /today puts "/today " in the field with focus and sends nothing',
		(await value(page)) === '/today ' &&
			(await fieldFocused(page)) &&
			(await page.locator(TEACHER).count()) === sentBefore,
		JSON.stringify(await value(page))
	)
	const offState = await page
		.locator(HELP)
		.last()
		.locator('button[data-command]')
		.evaluateAll((nodes) =>
			nodes.map((node) => ({ off: node.getAttribute('aria-disabled'), opacity: getComputedStyle(node).opacity }))
		)
	check(
		'with text in the field every row is aria-disabled at 50%',
		offState.every((item) => item.off === 'true' && item.opacity === '0.5'),
		JSON.stringify(offState.slice(0, 2))
	)
	await row(page, '/note').hover({ force: true })
	const hoverFill = await row(page, '/note').evaluate((node) => getComputedStyle(node).backgroundColor)
	await row(page, '/note').click({ force: true })
	await page.waitForTimeout(300)
	check(
		'an off row has no hover fill and its click keeps the typed text',
		(await value(page)) === '/today ' && /rgba\(0, 0, 0, 0\)|transparent/.test(hoverFill),
		hoverFill
	)
	await page.locator(FIELD).fill('')
	await page.waitForTimeout(200)
	check('with an empty field the rows are on again', (await row(page, '/note').getAttribute('aria-disabled')) === null)
	await row(page, '/note').click()
	await page.locator(POPUP).waitFor({ timeout: 5000 })
	check(
		'a click on /note puts "/note @" in the field and opens the student list',
		(await value(page)) === '/note @' && (await fieldFocused(page)) && (await page.locator(POPUP).isVisible())
	)
	await page.keyboard.press('Escape')
	await page.locator(FIELD).fill('')
	await row(page, '/essay').focus()
	await page.keyboard.press('Enter')
	await page.waitForTimeout(300)
	check(
		'Enter on /essay puts "/essay " in the field and sends nothing',
		(await value(page)) === '/essay ' && (await page.locator(TEACHER).count()) === sentBefore
	)
	await page.locator(FIELD).fill('')
	await page.locator(HELP).last().scrollIntoViewIfNeeded()
	await shot(page, 'chat-help', '1280-help')

	await routeChatTo(page)
	await send(page, MODEL_ASK)
	await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 2, HELP, {
		timeout: 30000,
	})
	await waitIdle(page)
	const modelTurns = sql(`select state from chat_turns where conversation_id = ${id}`).rows
	const modelReply = sql(
		`select body, blocks::text as blocks from chat_messages where conversation_id = ${id} and role = 'assistant' order by created_at desc limit 1`
	).rows[0]
	const modelBlocks = JSON.parse(String(modelReply?.blocks ?? '[]'))
	check(
		'asked in words, the model calls show_help and the reply is the same block alone, no text and no withheld',
		modelTurns.length === 1 &&
			modelTurns[0].state === 'completed' &&
			modelReply?.body === '' &&
			modelBlocks.length === 1 &&
			modelBlocks[0].type === 'help',
		JSON.stringify({ turns: modelTurns, blocks: modelBlocks.map((block) => block.type) })
	)
	const blocks = page.locator(HELP)
	const first = await helpShape(blocks.first())
	const second = await helpShape(blocks.last())
	check(
		'both help blocks show the same content and the model reply has no Copy reply',
		first.text === second.text &&
			(await page.locator(ASSISTANT).last().getByRole('button', { name: 'Copy reply' }).count()) === 0
	)
	await page.unroute('**/api/chat/**')
	await blocks.last().scrollIntoViewIfNeeded()
	await shot(page, 'chat-help', '1280-model')

	await page.setViewportSize({ width: 390, height: 844 })
	await page.waitForTimeout(500)
	await blocks.last().scrollIntoViewIfNeeded()
	const phone = await page.evaluate((selector) => {
		const block = document.querySelectorAll(selector)
		const last = block[block.length - 1]
		const viewport = last.closest('[data-slot="scroll-area-viewport"]')
		const rows = Array.from(last.querySelectorAll('button[data-command]')).map((node) =>
			Math.round(node.getBoundingClientRect().height)
		)
		const sections = Array.from(last.querySelectorAll('[data-slot="chat-help-section"]')).map((section) => {
			const [name, detail] = Array.from(section.children).map((child) => child.getBoundingClientRect())
			return name !== undefined && detail !== undefined && name.bottom <= detail.top + 1
		})
		const box = last.getBoundingClientRect()
		return {
			page: document.documentElement.scrollWidth - window.innerWidth,
			feed: viewport ? viewport.scrollWidth - viewport.clientWidth : -1,
			rows,
			stacked: sections.every(Boolean),
			inside: box.left >= 0 && box.right <= window.innerWidth,
		}
	}, HELP)
	check(
		'at 390 px the block fits with no sideways scroll, rows are 44 px and a section stacks its name over the text',
		phone.page <= 0 &&
			phone.feed <= 0 &&
			phone.inside &&
			phone.rows.length === 8 &&
			phone.rows.every((height) => height === 44) &&
			phone.stacked,
		JSON.stringify(phone)
	)
	await shot(page, 'chat-help', '390-help')
}

const conversations = []
let fake = null
try {
	fake = await startFakeApi()
	await withBrowser({ width: 1280, height: 1100 }, async ({ page, problems }) => {
		await signIn(page)
		await desktop(page, conversations)
		const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
		check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
	})
} catch (error) {
	check('the check completed', false, String(error).slice(0, 1500))
} finally {
	try {
		const asked = sql(`select distinct conversation_id as id from chat_messages where body = ${q(MODEL_ASK)}`).rows
		removeConversations([...new Set([...conversations, ...asked.map((row) => row.id)])])
	} catch (error) {
		check('the fixture conversations were removed', false, String(error).slice(0, 300))
	}
	await stopFakeApi(fake)
}
if (failures() === 0) console.log('CHAT_HELP_WEB_OK')
process.exit(failures())
