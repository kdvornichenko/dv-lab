import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'

import * as core from '../../packages/core/src/index.ts'
import { BASE, ROOT, api, check, failures, shot, signIn, sql, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'

const NAME = 'Alex Example 2306'
const FIELD = '[data-slot="chat-composer-field"]'
const POPUP = '[data-slot="mention-popup"]'
const SEND = '[data-slot="chat-send"]'
const CHANGE = '[data-slot="chat-change"]'
const DECLINED = 'Proposal declined. This proposal made no changes.'
const EXPECTED_NOISE =
	/status of 500|Failed to load resource|server caches disabled|Route "\/login": Next\.js encountered URL data/

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

async function startFakeModelApi() {
	if (!(await portFree(4000))) throw new Error('port 4000 is busy: stop the dev api first, this section starts its own')
	const env = {
		...process.env,
		PORT: '4000',
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
		{ cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }
	)
	let output = ''
	child.stdout.on('data', (chunk) => (output += chunk))
	child.stderr.on('data', (chunk) => (output += chunk))
	const deadline = Date.now() + 30000
	while (Date.now() < deadline) {
		if (child.exitCode !== null) break
		try {
			const res = await fetch('http://127.0.0.1:4000/healthz')
			if (res.status === 200) return { child, logs: () => output }
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 300))
	}
	child.kill('SIGTERM')
	throw new Error('the api with the fake model did not answer /healthz in 30 s')
}

function stopFakeModelApi(started) {
	if (!started || started.child.exitCode !== null) return Promise.resolve()
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			started.child.kill('SIGKILL')
			resolve()
		}, 15000)
		started.child.once('exit', () => {
			clearTimeout(timer)
			resolve()
		})
		started.child.kill('SIGTERM')
	})
}

function removeConversations(ids) {
	if (ids.length === 0) return
	const list = ids.map((id) => `'${id}'`).join(', ')
	sql(`delete from chat_actions where conversation_id in (${list})`)
	sql(`delete from chat_usage_attempts where conversation_id in (${list})`)
	sql(`delete from chat_turns where conversation_id in (${list})`)
	sql(`delete from chat_messages where reply_to is not null and conversation_id in (${list})`)
	sql(`delete from chat_messages where conversation_id in (${list})`)
	const result = sql(`delete from chat_conversations where id in (${list})`)
	console.log(`fixture conversations removed ${result.rowCount}`)
}

function removeCards() {
	const where = `display_name = '${NAME}' and import_key is null`
	const conversations = sql(
		`select distinct conversation_id as id from chat_actions where target->>'studentId' in (select id::text from students where ${where})`
	).rows.map((row) => row.id)
	removeConversations(conversations)
	sql(`delete from payments where student_id in (select id from students where ${where})`)
	const result = sql(`delete from students where ${where}`)
	console.log(`fixture cards removed ${result.rowCount}`)
}

function setTheme(page) {
	return page.addInitScript((value) => {
		try {
			localStorage.setItem('theme', value)
		} catch {}
	}, theme)
}

const paymentCount = (studentId) =>
	Number(sql(`select count(*)::int as n from payments where student_id = '${studentId}'`).rows[0]?.n ?? -1)

async function askPayment(page, before) {
	const field = page.locator(FIELD)
	await field.waitFor({ timeout: 30000 })
	await page.waitForFunction(
		({ selector, count }) => document.querySelectorAll(selector).length === count,
		{ selector: '[data-slot="chat-change"]', count: before },
		{ timeout: 30000 }
	)
	await field.click()
	await page.keyboard.type(`@${NAME}`)
	await page.locator(POPUP).waitFor({ timeout: 15000 })
	await page.keyboard.press('Enter')
	await page.locator(POPUP).waitFor({ state: 'detached', timeout: 5000 })
	await page.keyboard.type('[fake:payment] amount: 8000')
	await page.locator(SEND).click()
	await page.waitForFunction(
		({ selector, count }) => document.querySelectorAll(selector).length > count,
		{ selector: '[data-slot="chat-change"]', count: before },
		{ timeout: 30000 }
	)
	await page.locator(SEND).waitFor({ timeout: 30000 })
	return page.locator(CHANGE).last()
}

async function sectionPayment() {
	const started = await startFakeModelApi()
	const conversations = []
	const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
	const period = teacher
		? sql(
				`select id, spent_nano::text as spent, held_nano::text as held from chat_budget_periods where account_id = '${teacher}' order by starts_on desc limit 1`
			).rows[0]
		: undefined
	try {
		removeCards()
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await setTheme(page)
				await signIn(page)
				const zone = sql(`select default_time_zone as zone from teacher_settings where account_id = '${teacher}'`)
					.rows[0]?.zone
				const created = await api(page, 'POST', '/students', {
					displayName: NAME,
					rateMinor: 400000,
					currency: 'RUB',
					defaultLessonMinutes: 60,
					parent: null,
					level: null,
					goals: null,
					timeZone: null,
				})
				check('the fixture card is created', created.status === 201, String(created.status))
				const studentId = created.json.student.id
				const opening = await api(page, 'PUT', `/students/${studentId}/opening-balance`, {
					lessonsHundredths: 200,
					on: core.addDays(core.scheduleToday(new Date(), zone ?? core.SCHEDULE_TIME_ZONE), -1),
					expectedDefaultTimeZone: zone ?? core.SCHEDULE_TIME_ZONE,
				})
				check('the opening balance is set', opening.status === 200, String(opening.status))

				const decisions = []
				page.on('request', (request) => {
					const url = request.url()
					if (request.method() === 'POST' && /\/api\/chat\/actions\/[^/]+\/(confirm|decline)$/.test(url))
						decisions.push(url.split('/').pop())
				})

				await page.goto(`${BASE}/chat`)
				await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				const first = await askPayment(page, 0)
				const conversationId = new URL(page.url()).searchParams.get('c')
				if (conversationId) conversations.push(conversationId)
				const record = first.getByRole('button', { name: 'Record payment' })
				const keep = first.getByRole('button', { name: "Don't record this payment" })
				check(
					'the proposal shows Record payment and Don’t record this payment and records nothing',
					(await first.getAttribute('data-state')) === 'proposed' &&
						(await record.isVisible()) &&
						(await keep.isVisible()) &&
						paymentCount(studentId) === 0,
					await first.innerText()
				)
				const text = await first.innerText()
				check(
					'the preview shows the amount, the date, the lesson credit and the balance before and after',
					text.includes(`Record ${NAME}'s payment?`) &&
						text.includes('Amount') &&
						text.includes('Payment date') &&
						text.includes('2 lessons') &&
						text.includes('2 lessons left') &&
						text.includes('4 lessons left'),
					text.replace(/\n/g, ' | ')
				)
				check(
					'the arrival does not take focus from the composer to the decision',
					await page.evaluate(() => !document.activeElement?.closest('[data-slot="chat-change"]'))
				)
				await shot(page, 'changes-payment', 'proposed')

				await keep.click()
				await first.getByText(DECLINED).waitFor({ timeout: 15000 })
				check(
					'Don’t record declines and writes no payment',
					(await first.getAttribute('data-state')) === 'declined' &&
						(await first.getByRole('button').count()) === 0 &&
						paymentCount(studentId) === 0
				)
				await shot(page, 'changes-payment', 'declined')
				await page.reload()
				const declinedAgain = page.locator(CHANGE).first()
				await declinedAgain.getByText(DECLINED).waitFor({ timeout: 30000 })
				check(
					'after reload the declined proposal stays declined',
					(await declinedAgain.getAttribute('data-state')) === 'declined' && paymentCount(studentId) === 0
				)

				const second = await askPayment(page, 1)
				const after = (await second.locator('[data-slot="change-balance-after"]').innerText()).trim()
				await second.getByRole('button', { name: 'Record payment' }).click()
				await second.getByText('Payment recorded.').waitFor({ timeout: 15000 })
				const edit = second.getByRole('link', { name: 'Edit payment' })
				const paymentId = sql(`select id from payments where student_id = '${studentId}'`).rows[0]?.id
				check(
					'Record payment records exactly one payment and shows Payment recorded with Edit payment',
					(await second.getAttribute('data-state')) === 'applied' &&
						paymentCount(studentId) === 1 &&
						(await edit.getAttribute('href')) === `/students/${studentId}?tab=payments&payment=${paymentId}`,
					await second.innerText()
				)
				check(
					'the applied line names the balance after payment',
					(await second.innerText()).includes(`Balance is now ${after}.`),
					after
				)
				await shot(page, 'changes-payment', 'applied')
				const sentBefore = decisions.length
				await page.reload()
				const appliedAgain = page.locator(CHANGE).last()
				await appliedAgain.getByText('Payment recorded.').waitFor({ timeout: 30000 })
				await page.waitForTimeout(1500)
				check(
					'after reload the block is applied and no decision is sent again',
					(await appliedAgain.getAttribute('data-state')) === 'applied' &&
						decisions.length === sentBefore &&
						JSON.stringify(decisions) === '["decline","confirm"]' &&
						paymentCount(studentId) === 1,
					JSON.stringify(decisions)
				)

				const profile = await api(page, 'GET', `/students/${studentId}`)
				const minutes = profile.json?.student?.balanceMinutes
				await page.goto(`${BASE}/students/${studentId}`)
				await page.getByRole('heading', { name: NAME, level: 1 }).waitFor({ timeout: 30000 })
				const header = await page.locator('#content').innerText()
				check(
					'the profile balance equals the after value of the block',
					typeof minutes === 'number' && core.balancePhrase(minutes, 60) === after && header.includes(after),
					`${after} / ${minutes}`
				)

				await page.setViewportSize({ width: 390, height: 844 })
				await page.goto(`${BASE}/chat?c=${conversationId}`)
				const third = await askPayment(page, 2)
				const buttons = third.getByRole('button')
				const boxes = []
				for (let index = 0; index < (await buttons.count()); index++) boxes.push(await buttons.nth(index).boundingBox())
				const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
				check(
					'at 390 px both decisions are fully visible and the page does not scroll sideways',
					boxes.length === 2 &&
						boxes.every((box) => box !== null && box.x >= 0 && box.x + box.width <= 390) &&
						overflow <= 0,
					JSON.stringify({ boxes, overflow })
				)
				await third.scrollIntoViewIfNeeded()
				await shot(page, 'changes-payment', 'phone')
				await third.getByRole('button', { name: "Don't record this payment" }).click()
				await third.getByText(DECLINED).waitFor({ timeout: 15000 })
				check('the phone decline records nothing', paymentCount(studentId) === 1)

				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
				console.log(`console noise from the login route ${problems.length - unexpected.length}`)
				check('the api log has no message text', !started.logs().includes('amount: 8000'))
			},
			() => removeConversations(conversations),
			() => removeCards(),
			() => {
				if (period)
					sql(
						`update chat_budget_periods set spent_nano = ${period.spent}, held_nano = ${period.held} where id = '${period.id}'`
					)
			}
		)
	} finally {
		await stopFakeModelApi(started)
	}
}

const sections = { payment: sectionPayment }
const section = process.argv[2]
const run = sections[section]
if (!run) {
	console.log(`usage: node scripts/dev-checks/changes-web.mjs ${Object.keys(sections).join('|')} light|dark`)
	process.exit(2)
}

try {
	await run()
} catch (error) {
	check('section completed', false, String(error).slice(0, 1500))
}
if (failures() === 0) console.log(`CHANGES_WEB_${section.toUpperCase()}_OK`)
process.exit(failures())
