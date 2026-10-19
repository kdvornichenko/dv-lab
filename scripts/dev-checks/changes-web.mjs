import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createConnection } from 'node:net'

import { CHAT_FOLLOW_UP_TEXT, chatBlock, chatChangeProposalBlock } from '../../packages/contracts/src/chat.ts'
import * as core from '../../packages/core/src/index.ts'
import { BASE, ROOT, check, env, failures, shot, signIn, sql, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'
import { removeStudentCards } from './fixture-cleanup.mjs'

const NAME = 'Alex Example 2306'
const FORMS_NAME = 'Alex Example 2360'
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

async function startFakeModelApi(port, delay = '20') {
	if (!(await portFree(port))) throw new Error(`port ${port} is busy: this section starts its own api`)
	const env = {
		...process.env,
		PORT: String(port),
		APP_ORIGIN: BASE,
		ANTHROPIC_API_KEY: 'sk-ant-fake-check',
		LOG_LEVEL: 'info',
		CHAT_FAKE_DELAY_MS: delay,
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
			const res = await fetch(`http://127.0.0.1:${port}/healthz`)
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
	console.log(`fixture cards removed ${removeStudentCards(sql, where)}`)
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
	await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 30000 })
	return page.locator(CHANGE).last()
}

const PAYMENT_PORT = 4256

async function sectionPayment() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch('http://127.0.0.1:4000/healthz').catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer on 4000: this section needs the dev stack')
	const started = await startFakeModelApi(PAYMENT_PORT)
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
				await proposalsPrepare(page, apiOrigin, PAYMENT_PORT)
				await signIn(page)
				const zone = sql(`select default_time_zone as zone from teacher_settings where account_id = '${teacher}'`)
					.rows[0]?.zone
				const created = await formsApi(page, apiOrigin, 'POST', '/students', {
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
				const opening = await formsApi(page, apiOrigin, 'PUT', `/students/${studentId}/opening-balance`, {
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
					(await second.innerText()).includes(`Balance after this payment: ${after}.`),
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

				const profile = await formsApi(page, apiOrigin, 'GET', `/students/${studentId}`)
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

const CHANGED_PAYMENT =
	'This payment changed elsewhere. Your draft has been kept. Reload the current details before saving.'
const CHANGED_STUDENT =
	'This student changed elsewhere. Your draft has been kept. Reload the current details before saving.'
const GONE = 'This record is no longer available. Open the current records to continue.'

function removeFormsCards() {
	const where = `display_name = '${FORMS_NAME}' and import_key is null`
	console.log(`fixture cards removed ${removeStudentCards(sql, where)}`)
}

async function formsPrepare(page, apiOrigin) {
	await setTheme(page)
	if (apiOrigin === BASE) return
	await page.route('**/api/**', async (route) => {
		const headers = { ...(await route.request().allHeaders()), origin: apiOrigin }
		try {
			const response = await route.fetch({ headers })
			await route.fulfill({ response })
		} catch {
			await route.abort().catch(() => undefined)
		}
	})
}

async function formsApi(page, apiOrigin, method, path, body) {
	const response = await page.request.fetch(`${BASE}/api${path}`, {
		method,
		headers: { origin: apiOrigin, 'content-type': 'application/json' },
		data: body === undefined ? undefined : JSON.stringify(body),
	})
	let json = null
	try {
		json = await response.json()
	} catch {
		json = null
	}
	return { status: response.status(), json }
}

const paymentRows = (studentId) =>
	sql(
		`select id, source, created_at::text as created_at, amount_minor::text as amount, lessons_count::text as lessons, note, revision from payments where student_id = '${studentId}' order by created_at`
	).rows

async function detectApiOrigin() {
	const candidates = [...new Set([BASE, env.APP_ORIGIN].filter(Boolean))]
	for (const origin of candidates) {
		const response = await fetch(`${BASE}/api/auth/sign-in`, {
			method: 'POST',
			headers: { origin, 'content-type': 'application/json' },
			body: JSON.stringify({ login: 'origin-probe', password: 'origin-probe' }),
		}).catch(() => null)
		const body = response ? await response.json().catch(() => null) : null
		if (response && body?.error?.code !== 'forbidden_origin') return origin
	}
	throw new Error('the dev api accepts neither the web origin nor APP_ORIGIN from .env')
}

async function sectionForms() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	try {
		removeFormsCards()
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await formsPrepare(page, apiOrigin)
				await signIn(page)
				const call = (method, path, body) => formsApi(page, apiOrigin, method, path, body)
				const created = await call('POST', '/students', {
					displayName: FORMS_NAME,
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
				const profile = await call('GET', `/students/${studentId}`)
				const zone = profile.json.defaultTimeZone
				const opening = await call('PUT', `/students/${studentId}/opening-balance`, {
					lessonsHundredths: 200,
					on: core.addDays(core.scheduleToday(new Date(), zone), -1),
					expectedDefaultTimeZone: zone,
				})
				check('the opening balance is set', opening.status === 200, String(opening.status))

				await page.goto(`${BASE}/students/${studentId}`)
				await page.getByRole('heading', { name: FORMS_NAME, level: 1 }).waitFor({ timeout: 30000 })
				await page.locator('[data-slot="student-actions"]').click()
				await page.getByRole('menuitem', { name: 'Record payment' }).click()
				const dialog = page.getByRole('dialog')
				await dialog.getByLabel('Amount').fill('8000')
				await dialog.getByRole('button', { name: 'Record payment' }).click()
				await page.getByText('Payment recorded').waitFor({ timeout: 15000 })
				await dialog.waitFor({ state: 'detached', timeout: 15000 })
				const recorded = paymentRows(studentId)
				check('the form records exactly one payment', recorded.length === 1, String(recorded.length))
				const before = recorded[0]

				await page.getByRole('tab', { name: 'Payments' }).click()
				const editButton = page.getByRole('button', { name: /^Edit payment of / })
				await editButton.waitFor({ timeout: 15000 })
				await editButton.click()
				await dialog.getByRole('heading', { name: 'Edit payment' }).waitFor({ timeout: 10000 })
				const amountField = dialog.getByLabel('Amount')
				const lessonsField = dialog.getByLabel('Lessons')
				check(
					'Edit payment shows the student as plain text with the lock caption and the recorded values',
					(await dialog.innerText()).includes(FORMS_NAME) &&
						(await dialog.innerText()).includes('A payment stays with its student.') &&
						(await dialog.getByRole('combobox', { name: 'Student' }).count()) === 0 &&
						(await amountField.inputValue()) === '8000' &&
						(await lessonsField.inputValue()) === '2',
					`${await amountField.inputValue()} / ${await lessonsField.inputValue()}`
				)
				check(
					'the initial focus is on Amount',
					await page.evaluate(() => document.activeElement?.id === 'record-payment-amount')
				)
				await page.waitForTimeout(700)
				await shot(page, 'changes-forms', 'edit-payment')
				await amountField.fill('12000')
				check('Lessons follow the amount only after the amount changed', (await lessonsField.inputValue()) === '3')
				await lessonsField.fill('2.5')
				await dialog.getByRole('button', { name: 'Save payment' }).click()
				await page.getByText('Payment saved').waitFor({ timeout: 15000 })
				await dialog.waitFor({ state: 'detached', timeout: 15000 })
				const edited = paymentRows(studentId)
				check(
					'Save payment changes the same row: id, source and created_at are the same, no second row',
					edited.length === 1 &&
						edited[0].id === before.id &&
						edited[0].source === before.source &&
						edited[0].created_at === before.created_at &&
						edited[0].amount === '1200000' &&
						Number(edited[0].lessons) === 2.5 &&
						Number(edited[0].revision) === Number(before.revision) + 1,
					JSON.stringify(edited[0])
				)
				const after = await call('GET', `/students/${studentId}`)
				const minutes = after.json.student.balanceMinutes
				const phrase = core.balancePhrase(minutes, 60)
				const header = await page.locator('#content').innerText()
				await page.goto(`${BASE}/students`)
				const row = page.getByRole('row').filter({ hasText: FORMS_NAME })
				await row.waitFor({ timeout: 30000 })
				check(
					'the profile and Students show the same balance after the correction',
					header.includes(phrase) && (await row.innerText()).includes(core.balancePhrase(minutes, 60, { short: true })),
					phrase
				)

				await page.goto(`${BASE}/students/${studentId}?tab=payments`)
				await page.getByRole('button', { name: /^Edit payment of / }).click()
				await dialog.getByRole('heading', { name: 'Edit payment' }).waitFor({ timeout: 10000 })
				await dialog.getByLabel('Note').fill('draft note')
				const rows = (await call('GET', `/payments?student=${studentId}`)).json.payments
				const other = await call('PATCH', `/payments/${rows[0].id}`, {
					paidOn: rows[0].paidOn,
					expectedDefaultTimeZone: zone,
					amountMinor: rows[0].amountMinor,
					currency: rows[0].currency,
					lessonsHundredths: rows[0].lessonsHundredths,
					note: 'changed in the other tab',
					expectedRevision: rows[0].revision,
				})
				check('the other tab changes the payment', other.status === 200, String(other.status))
				const save = dialog.getByRole('button', { name: 'Save payment' })
				await save.click()
				await dialog.getByText(CHANGED_PAYMENT).waitFor({ timeout: 15000 })
				const reloadButton = dialog.getByRole('button', { name: 'Reload payment details' })
				check(
					'the conflict keeps the draft, blocks Save and the stale save wrote nothing',
					(await dialog.getByLabel('Note').inputValue()) === 'draft note' &&
						(await save.isDisabled()) &&
						(await reloadButton.isVisible()) &&
						paymentRows(studentId)[0].note === 'changed in the other tab' &&
						(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))),
					await page.evaluate(() => document.activeElement?.tagName ?? '')
				)
				await page.waitForTimeout(700)
				await shot(page, 'changes-forms', 'payment-conflict')
				await reloadButton.click()
				await dialog.getByText(CHANGED_PAYMENT).waitFor({ state: 'detached', timeout: 10000 })
				check(
					'Reload payment details loads the current values, enables Save and focuses Amount',
					(await dialog.getByLabel('Note').inputValue()) === 'changed in the other tab' &&
						(await amountField.inputValue()) === '12000' &&
						(await lessonsField.inputValue()) === '2.5' &&
						!(await save.isDisabled()) &&
						(await page.evaluate(() => document.activeElement?.id === 'record-payment-amount')),
					await page.evaluate(() => `${document.activeElement?.tagName}#${document.activeElement?.id}`)
				)
				await dialog.getByLabel('Note').fill('second correction')
				await save.click()
				await page.getByText('Payment saved').waitFor({ timeout: 15000 })
				await dialog.waitFor({ state: 'detached', timeout: 15000 })
				const corrected = paymentRows(studentId)
				check(
					'the second save after Reload changes the same row again',
					corrected.length === 1 && corrected[0].id === before.id && corrected[0].note === 'second correction'
				)

				await page.goto(`${BASE}/students/${studentId}`)
				await page.getByRole('button', { name: 'Edit details' }).click()
				const details = page.getByRole('dialog')
				await details.getByRole('heading', { name: `Edit ${FORMS_NAME}` }).waitFor({ timeout: 10000 })
				await details.getByLabel('Goals').fill('draft goals')
				const current = (await call('GET', `/students/${studentId}`)).json.student
				const changed = await call('PATCH', `/students/${studentId}`, {
					displayName: current.displayName,
					gender: current.gender,
					rateMinor: current.rateMinor,
					currency: current.currency,
					defaultLessonMinutes: current.defaultLessonMinutes,
					parent: current.parent,
					level: 'Level B',
					goals: current.goals,
					timeZone: current.timeZone,
					noShowDeducts: current.noShowDeducts,
					expectedRevision: current.revision,
				})
				check('the other tab changes the card', changed.status === 200, String(changed.status))
				const saveDetails = details.getByRole('button', { name: 'Save changes' })
				await saveDetails.click()
				await details.getByText(CHANGED_STUDENT).waitFor({ timeout: 15000 })
				const reloadStudent = details.getByRole('button', { name: 'Reload student details' })
				check(
					'the card conflict keeps the draft and blocks Save',
					(await details.getByLabel('Goals').inputValue()) === 'draft goals' &&
						(await saveDetails.isDisabled()) &&
						(await reloadStudent.isVisible()) &&
						(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))) &&
						sql(`select level from students where id = '${studentId}'`).rows[0]?.level === 'Level B'
				)
				await page.waitForTimeout(700)
				await shot(page, 'changes-forms', 'student-conflict')
				await reloadStudent.click()
				await details.getByText(CHANGED_STUDENT).waitFor({ state: 'detached', timeout: 10000 })
				check(
					'Reload student details loads the current card, enables Save and focuses Name',
					(await details.getByLabel('Level').inputValue()) === 'Level B' &&
						(await details.getByLabel('Goals').inputValue()) === '' &&
						!(await saveDetails.isDisabled()) &&
						(await page.evaluate(() => document.activeElement?.id === 'student-form-name'))
				)
				await details.getByLabel('Goals').fill('new goals')
				await saveDetails.click()
				await page.getByText('Changes saved').waitFor({ timeout: 15000 })
				await details.waitFor({ state: 'detached', timeout: 15000 })
				check(
					'the second card save after Reload keeps the other tab level',
					sql(`select level, goals from students where id = '${studentId}'`).rows[0]?.level === 'Level B' &&
						sql(`select goals from students where id = '${studentId}'`).rows[0]?.goals === 'new goals'
				)

				await page.locator('[data-slot="student-actions"]').click()
				await page.getByRole('menuitem', { name: 'Archive', exact: true }).click()
				await page.getByRole('button', { name: 'Archive student' }).click()
				await page.getByText('Student archived').waitFor({ timeout: 15000 })
				await page.locator('[data-slot="student-actions"]').click()
				await page.getByRole('menuitem', { name: 'Restore', exact: true }).click()
				await page.getByRole('button', { name: 'Restore student' }).click()
				await page.getByText('Student restored').waitFor({ timeout: 15000 })
				check(
					'archive and restore with a revision work',
					sql(`select status from students where id = '${studentId}'`).rows[0]?.status === 'active'
				)

				const extra = await call('POST', '/payments', {
					studentId,
					paidOn: core.scheduleToday(new Date(), zone),
					expectedDefaultTimeZone: zone,
					amountMinor: 100000,
					currency: 'RUB',
					lessonsHundredths: 100,
					note: 'extra',
				})
				check('an extra payment is created for the delete check', extra.status === 201, String(extra.status))
				await page.goto(`${BASE}/students/${studentId}?tab=payments`)
				await page.getByText('extra').waitFor({ timeout: 15000 })
				await page
					.getByRole('button', { name: /^Delete payment of / })
					.first()
					.click()
				await page.getByRole('button', { name: 'Delete payment', exact: true }).click()
				await page.getByText('Payment deleted').waitFor({ timeout: 15000 })
				check('delete with a revision removes exactly one row', paymentRows(studentId).length === 1)

				await page.goto(`${BASE}/students/${studentId}?tab=payments&payment=${before.id}`)
				await dialog.getByRole('heading', { name: 'Edit payment' }).waitFor({ timeout: 30000 })
				await page.waitForFunction(() => !location.search.includes('payment='), null, { timeout: 10000 })
				check(
					'the link opens Edit payment of that payment and drops payment from the address',
					(await dialog.getByLabel('Note').inputValue()) === 'second correction' &&
						new URL(page.url()).searchParams.get('tab') === 'payments'
				)
				await dialog.getByRole('button', { name: 'Close', exact: true }).click()
				await dialog.waitFor({ state: 'detached', timeout: 10000 })
				await page.goto(`${BASE}/students/${studentId}?tab=payments&payment=6f1c2b34-5a7d-4e8f-9b0a-1c2d3e4f5a6b`)
				await page.getByText(GONE).waitFor({ timeout: 30000 })
				check(
					'an unknown payment gives the unavailable line over the list and no editor',
					(await page.getByRole('dialog').count()) === 0 &&
						(await page.getByRole('button', { name: /^Edit payment of / }).count()) === 1
				)
				await page.waitForTimeout(700)
				await shot(page, 'changes-forms', 'payment-gone')

				await page.setViewportSize({ width: 390, height: 844 })
				await page.goto(`${BASE}/students/${studentId}?tab=payments`)
				await page.getByRole('button', { name: /^Edit payment of / }).click()
				await dialog.getByRole('heading', { name: 'Edit payment' }).waitFor({ timeout: 10000 })
				const amountBox = await amountField.boundingBox()
				const lessonsBox = await lessonsField.boundingBox()
				const footer = await dialog.getByRole('button', { name: 'Save payment' }).boundingBox()
				const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
				check(
					'at 390 px the fields are one column, the footer is visible and the page does not scroll sideways',
					amountBox !== null &&
						lessonsBox !== null &&
						footer !== null &&
						Math.abs(amountBox.x - lessonsBox.x) < 2 &&
						footer.x >= 0 &&
						footer.x + footer.width <= 390 &&
						footer.y + footer.height <= 844 &&
						overflow <= 0,
					JSON.stringify({ amountBox, lessonsBox, footer, overflow })
				)
				await page.waitForTimeout(700)
				await shot(page, 'changes-forms', 'phone')

				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			},
			() => removeFormsCards()
		)
	} finally {
		removeFormsCards()
	}
}

const PROPOSAL_PORT = 4252
const PN = {
	pay: 'Alex Example 2390',
	archive: 'Alex Example 2391',
	rate: 'Alex Example 2392',
	end: 'Alex Example 2393',
	created: 'Alex Example 2394',
}
const PROPOSAL_WHERE = `display_name like 'Alex Example 239_' and import_key is null`
const NOTE_BODY = 'Proposal check note about the weekly plan'
const VN = 'Asia/Ho_Chi_Minh'
const CALENDAR_CHANGE = '[data-slot="chat-calendar-change"]'
const q = (value) => `'${String(value).replaceAll("'", "''")}'`

function removeProposalCards() {
	const conversations = sql(
		`select distinct conversation_id as id from chat_actions where target->>'studentId' in (select id::text from students where ${PROPOSAL_WHERE})`
	).rows.map((row) => row.id)
	removeConversations(conversations)
	console.log(`fixture cards removed ${removeStudentCards(sql, PROPOSAL_WHERE)}`)
}

const cardRow = (name) =>
	sql(
		`select id, status, rate_minor::text as rate, revision from students where display_name = ${q(name)} and import_key is null`
	).rows[0]

const noteRow = (studentId) =>
	sql(`select id, retracted_at is not null as retracted from student_notes where student_id = ${q(studentId)}`).rows[0]

async function proposalsPrepare(page, apiOrigin, port) {
	await setTheme(page)
	if (apiOrigin !== BASE)
		await page.route('**/api/**', async (route) => {
			const headers = { ...(await route.request().allHeaders()), origin: apiOrigin }
			try {
				await route.fulfill({ response: await route.fetch({ headers }) })
			} catch {
				await route.abort().catch(() => undefined)
			}
		})
	await page.route('**/api/chat/**', async (route) => {
		const url = new URL(route.request().url())
		const target = `http://127.0.0.1:${port}${url.pathname.replace(/^\/api/, '')}${url.search}`
		const headers = { ...(await route.request().allHeaders()), origin: BASE, 'x-forwarded-for': '127.0.0.1' }
		try {
			await route.fulfill({ response: await route.fetch({ url: target, headers }) })
		} catch {
			await route.abort().catch(() => undefined)
		}
	})
}

async function sendIn(page, shown, text, mention) {
	const field = page.locator(FIELD)
	await field.waitFor({ timeout: 30000 })
	await page.waitForFunction(
		({ selector, count }) => document.querySelectorAll(selector).length === count,
		{ selector: CHANGE, count: shown },
		{ timeout: 30000 }
	)
	await field.click()
	if (mention !== null) {
		await page.keyboard.type(`@${mention}`)
		await page.locator(POPUP).waitFor({ timeout: 15000 })
		await page.keyboard.press('Enter')
		await page.locator(POPUP).waitFor({ state: 'detached', timeout: 5000 })
	}
	await page.keyboard.type(text)
	await page.locator(SEND).click()
}

async function askBlock(page, shown, text, mention) {
	await sendIn(page, shown, text, mention)
	await page.waitForFunction(
		({ selector, count }) => document.querySelectorAll(selector).length > count,
		{ selector: CHANGE, count: shown },
		{ timeout: 30000 }
	)
	await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 30000 })
	return page.locator(CHANGE).nth(shown)
}

function syntheticReply(conversation, body, block) {
	const now = new Date().toISOString()
	return {
		conversation,
		turn: null,
		messages: [
			{
				id: randomUUID(),
				role: 'teacher',
				body: body.text,
				mentions: body.mentions,
				blocks: [],
				steps: [],
				createdAt: now,
				finishedAt: null,
			},
			{
				id: randomUUID(),
				role: 'assistant',
				body: '',
				mentions: [],
				blocks: [block],
				steps: [],
				createdAt: now,
				finishedAt: now,
			},
		],
	}
}

function calendarBlock(operation, target, lesson) {
	return {
		type: 'calendar_proposal',
		actionId: randomUUID(),
		operation,
		studentName: PN.end,
		timeZone: VN,
		lesson,
		target,
		clearsNoShow: false,
		state: 'proposed',
		undo: null,
	}
}

async function fitsWidth(page, width) {
	const boxes = await page
		.locator(`${CHANGE} button, ${CHANGE} a, ${CALENDAR_CHANGE} button, ${CALENDAR_CHANGE} a`)
		.evaluateAll((nodes) =>
			nodes.map((node) => {
				const box = node.getBoundingClientRect()
				return { x: box.x, right: box.x + box.width, width: box.width }
			})
		)
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
	return {
		ok: boxes.length > 0 && boxes.every((box) => box.width > 0 && box.x >= 0 && box.right <= width) && overflow <= 0,
		boxes,
		overflow,
	}
}

async function sectionProposals() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	const started = await startFakeModelApi(PROPOSAL_PORT)
	const conversations = []
	const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
	const period = teacher
		? sql(
				`select id, spent_nano::text as spent, held_nano::text as held from chat_budget_periods where account_id = '${teacher}' order by starts_on desc limit 1`
			).rows[0]
		: undefined
	try {
		removeProposalCards()
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await proposalsPrepare(page, apiOrigin, PROPOSAL_PORT)
				await signIn(page)
				const call = (method, path, body) => formsApi(page, apiOrigin, method, path, body)
				const zone = sql(`select default_time_zone as zone from teacher_settings where account_id = '${teacher}'`)
					.rows[0]?.zone
				const today = core.scheduleToday(new Date(), zone ?? core.SCHEDULE_TIME_ZONE)
				const make = async (name) => {
					const created = await call('POST', '/students', {
						displayName: name,
						rateMinor: 400000,
						currency: 'RUB',
						defaultLessonMinutes: 60,
						parent: null,
						level: null,
						goals: null,
						timeZone: null,
					})
					check(`the fixture card ${name} is created`, created.status === 201, String(created.status))
					const id = created.json.student.id
					const opening = await call('PUT', `/students/${id}/opening-balance`, {
						lessonsHundredths: 200,
						on: core.addDays(today, -1),
						expectedDefaultTimeZone: zone ?? core.SCHEDULE_TIME_ZONE,
					})
					check(`the opening balance of ${name} is set`, opening.status === 200, String(opening.status))
					return id
				}
				const pay = async (studentId, lessons, amountMinor, note) => {
					const res = await call('POST', '/payments', {
						studentId,
						paidOn: today,
						expectedDefaultTimeZone: zone ?? core.SCHEDULE_TIME_ZONE,
						amountMinor,
						currency: 'RUB',
						lessonsHundredths: lessons,
						note,
					})
					check(`a payment is created (${note})`, res.status === 201, String(res.status))
				}
				const payId = await make(PN.pay)
				await pay(payId, 200, 800000, 'first check payment')
				await pay(payId, 100, 400000, 'second check payment')
				sql(
					`insert into student_notes (student_id, section_kind, body) values (${q(payId)}, 'general_info', ${q(NOTE_BODY)})`
				)
				const archiveId = await make(PN.archive)
				const account = await call('POST', `/students/${archiveId}/account`, {
					login: 'alex.check2391',
					password: null,
				})
				check('the card with an account is prepared', account.status === 201, String(account.status))
				const rateId = await make(PN.rate)
				const endId = await make(PN.end)

				const decisions = []
				page.on('request', (request) => {
					if (request.method() === 'POST' && /\/api\/chat\/actions\/[^/]+\/(confirm|decline)$/.test(request.url()))
						decisions.push(request.url().split('/').pop())
				})
				const tally = () =>
					sql(
						`select (select count(*) from payments where student_id = ${q(payId)})::int as payments, (select count(*) from students where display_name like 'Alex Example 239_')::int as cards, (select count(*) from lesson_series where student_id = ${q(endId)})::int as series`
					).rows[0]

				await page.goto(`${BASE}/chat`)
				await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				let shown = 0
				let chatId = null
				const ask = async (text, mention) => {
					const block = await askBlock(page, shown, text, mention)
					shown++
					chatId ??= new URL(page.url()).searchParams.get('c')
					if (chatId && !conversations.includes(chatId)) conversations.push(chatId)
					return block
				}
				const back = async () => {
					await page.goto(`${BASE}/chat?c=${chatId}`)
					await page.locator(CHANGE).first().waitFor({ timeout: 30000 })
				}
				const stateOf = (block) => block.getAttribute('data-state')
				const buttonsOf = async (block) => (await block.getByRole('button').allInnerTexts()).map((text) => text.trim())
				const decline = async (block, label) => {
					await block.getByRole('button', { name: label }).click()
					await block.getByText(DECLINED).waitFor({ timeout: 15000 })
				}

				const card = await ask(`[fake:card] name: ${PN.created}`, null)
				let text = await card.innerText()
				let before = tally()
				check(
					'a new student shows the question, the name, No rate set, no sign-in and the two decisions',
					(await stateOf(card)) === 'proposed' &&
						text.includes('Create a student card?') &&
						text.includes(PN.created) &&
						text.includes('No rate set') &&
						text.includes('Same as the teacher') &&
						text.includes('This creates a student card. Sign-in access is not created.') &&
						JSON.stringify(await buttonsOf(card)) ===
							JSON.stringify(['Create student card', "Don't create the card"]) &&
						!cardRow(PN.created),
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-proposals', 'card')
				await decline(card, "Don't create the card")
				check('declining the card creates no card', (await stateOf(card)) === 'declined' && !cardRow(PN.created))
				await page.reload()
				const cardAgain = page.locator(CHANGE).first()
				await cardAgain.getByText(DECLINED).waitFor({ timeout: 30000 })
				check('after reload the declined card stays declined and no card exists', !cardRow(PN.created))

				const card2 = await ask(`[fake:card] name: ${PN.created}`, null)
				await card2.getByRole('button', { name: 'Create student card' }).click()
				await card2.getByText('Student card created.').waitFor({ timeout: 15000 })
				const createdRow = cardRow(PN.created)
				const open = card2.getByRole('link', { name: 'Open student' })
				check(
					'Create student card makes one card and links to its profile',
					(await stateOf(card2)) === 'applied' &&
						createdRow !== undefined &&
						(await open.getAttribute('href')) === `/students/${createdRow?.id}`,
					await card2.innerText()
				)
				await shot(page, 'changes-proposals', 'card-applied')
				await open.click()
				await page.getByRole('heading', { name: PN.created, level: 1 }).waitFor({ timeout: 30000 })
				check('Open student opens the new profile', true)
				await back()

				const rate = await ask('[fake:rate] rate: 3000', PN.rate)
				text = await rate.innerText()
				check(
					'a rate change shows the current and the new rate, the credit line and the decisions',
					(await stateOf(rate)) === 'proposed' &&
						text.includes(`Change ${PN.rate}'s rate?`) &&
						text.includes('Current rate') &&
						text.includes('New rate') &&
						text.includes('4,000') &&
						text.includes('3,000') &&
						text.includes('Existing payment lesson credit stays unchanged.') &&
						JSON.stringify(await buttonsOf(rate)) === JSON.stringify(['Save rate', 'Keep rate']) &&
						cardRow(PN.rate).rate === '400000',
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-proposals', 'rate')
				await rate.getByRole('button', { name: 'Save rate' }).click()
				await rate.getByText('Rate changed.').waitFor({ timeout: 15000 })
				const edit = rate.getByRole('link', { name: 'Edit details' })
				check(
					'Save rate changes only the rate and links to Edit details',
					cardRow(PN.rate).rate === '300000' &&
						(await edit.getAttribute('href')) === `/students/${rateId}?dialog=details`,
					await rate.innerText()
				)
				await edit.click()
				await page.getByRole('heading', { name: `Edit ${PN.rate}` }).waitFor({ timeout: 30000 })
				check('Edit details opens the card form', true)
				await back()

				const archive = await ask('[fake:archive]', PN.archive)
				text = await archive.innerText()
				check(
					'an archive proposal shows Active to Archived, what is kept and the sign-in line',
					(await stateOf(archive)) === 'proposed' &&
						text.includes(`Archive ${PN.archive}?`) &&
						text.includes('The account, payments and notes are kept.') &&
						text.includes('The account can still sign in; deactivate it separately.') &&
						!text.includes('Permanent student deletion') &&
						JSON.stringify(await buttonsOf(archive)) === JSON.stringify(['Archive student', 'Keep student active']),
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-proposals', 'archive')
				await decline(archive, 'Keep student active')
				check('Keep student active leaves the card active', cardRow(PN.archive).status === 'active')

				const removal = await ask('[fake:delete-student]', PN.rate)
				text = await removal.innerText()
				check(
					'asking to delete a student shows the unsupported sentence and the archive decision',
					(await stateOf(removal)) === 'proposed' &&
						text.includes('Permanent student deletion is not available. You can archive this student instead.') &&
						!text.includes('The account can still sign in') &&
						JSON.stringify(await buttonsOf(removal)) === JSON.stringify(['Review archive']),
					text.replace(/\n/g, ' | ')
				)
				await removal.getByRole('button', { name: 'Review archive' }).click()
				check(
					'Review archive opens the archive card in place',
					(await removal.getByRole('button', { name: 'Archive student' }).isVisible()) &&
						(await removal.getByRole('button', { name: 'Review archive' }).count()) === 0 &&
						JSON.stringify(await buttonsOf(removal)) === JSON.stringify(['Archive student', 'Keep student active'])
				)
				await shot(page, 'changes-proposals', 'delete-student')
				await removal.getByRole('button', { name: 'Archive student' }).click()
				await removal.getByText('Student archived.').waitFor({ timeout: 15000 })
				check(
					'Archive student archives the card and deletes nothing',
					cardRow(PN.rate)?.status === 'archived' &&
						(await removal.getByRole('link', { name: 'Open student' }).getAttribute('href')) === `/students/${rateId}`
				)

				const payments = await ask('[fake:payments]', PN.pay)
				text = await payments.innerText()
				before = tally()
				check(
					'a payment deletion shows the date, amount, credit, balance before and after and the decisions',
					(await stateOf(payments)) === 'proposed' &&
						text.includes(`Delete ${PN.pay}'s payment?`) &&
						text.includes('Payment date') &&
						text.includes('Amount') &&
						text.includes('Lesson credit') &&
						text.includes('Balance') &&
						text.includes('This removes only this payment. The balance will be recalculated.') &&
						JSON.stringify(await buttonsOf(payments)) === JSON.stringify(['Delete payment', 'Keep payment']) &&
						before.payments === 2,
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-proposals', 'delete-payment')
				await decline(payments, 'Keep payment')
				check('Keep payment deletes nothing', tally().payments === 2)
				await page.reload()
				await page
					.locator(CHANGE)
					.nth(shown - 1)
					.getByText(DECLINED)
					.waitFor({ timeout: 30000 })

				check('after reload the declined deletion stays declined and nothing is deleted', tally().payments === 2)

				const payments2 = await ask('[fake:payments]', PN.pay)
				await payments2.getByRole('button', { name: 'Delete payment' }).click()
				await payments2.getByText('Payment deleted.').waitFor({ timeout: 15000 })
				const viewPayments = payments2.getByRole('link', { name: 'View payments' })
				check(
					'Delete payment removes exactly one payment and links to the payments tab',
					tally().payments === 1 && (await viewPayments.getAttribute('href')) === `/students/${payId}?tab=payments`,
					await payments2.innerText()
				)
				await shot(page, 'changes-proposals', 'delete-payment-applied')
				await viewPayments.click()
				await page.getByRole('heading', { name: PN.pay, level: 1 }).waitFor({ timeout: 30000 })
				await page
					.getByRole('button', { name: /^Edit payment of / })
					.first()
					.waitFor({ timeout: 15000 })
				check(
					'View payments shows the payments tab with the one remaining payment',
					(await page.getByRole('button', { name: /^Edit payment of / }).count()) === 1
				)
				await back()

				const noteBlock = await ask('[fake:remove-note]', PN.pay)
				text = await noteBlock.innerText()
				check(
					'a note removal shows the student, the date, the bounded text and the decisions',
					(await stateOf(noteBlock)) === 'proposed' &&
						text.includes('Remove this note?') &&
						text.includes(PN.pay) &&
						text.includes(NOTE_BODY) &&
						text.includes('Later notes stay.') &&
						JSON.stringify(await buttonsOf(noteBlock)) === JSON.stringify(['Remove note', 'Keep note']) &&
						noteRow(payId)?.retracted === false,
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-proposals', 'remove-note')
				await decline(noteBlock, 'Keep note')
				check('Keep note keeps the note', noteRow(payId)?.retracted === false)
				const noteBlock2 = await ask('[fake:remove-note]', PN.pay)
				await noteBlock2.getByRole('button', { name: 'Remove note' }).click()
				await noteBlock2.getByText('Note removed.').waitFor({ timeout: 15000 })
				const viewNotes = noteBlock2.getByRole('link', { name: 'View notes' })
				check(
					'Remove note retracts the note and links to the notes tab',
					noteRow(payId)?.retracted === true &&
						(await viewNotes.getAttribute('href')) === `/students/${payId}?tab=notes`,
					await noteBlock2.innerText()
				)
				await viewNotes.click()
				await page.getByRole('heading', { name: PN.pay, level: 1 }).waitFor({ timeout: 30000 })
				await page.waitForTimeout(800)
				check(
					'View notes opens the notes tab without the removed note',
					(await page.getByText(NOTE_BODY).filter({ visible: true }).count()) === 0
				)
				await back()

				const changeCount = await page.locator(CHANGE).count()
				const seriesBefore = tally().series
				await sendIn(page, changeCount, '[fake:end]', PN.end)
				await page.getByText('I could not prepare that change.').waitFor({ timeout: 30000 })
				await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 30000 })
				check(
					'ending a series with no Google connection gives a refusal text, no decision block and no schedule write',
					(await page.locator(CHANGE).count()) === changeCount &&
						(await page.locator(CALENDAR_CHANGE).count()) === 0 &&
						tally().series === seriesBefore
				)

				const sentDecisions = decisions.length
				await page.reload()
				await page.locator(CHANGE).first().waitFor({ timeout: 30000 })
				await page.waitForTimeout(1500)
				check('reading the thread again sends no decision', decisions.length === sentDecisions)
				check(
					'the decisions went out once each: four declines and five confirms in order',
					JSON.stringify(decisions) ===
						JSON.stringify([
							'decline',
							'confirm',
							'confirm',
							'decline',
							'confirm',
							'decline',
							'confirm',
							'decline',
							'confirm',
						]),
					JSON.stringify(decisions)
				)

				await page.setViewportSize({ width: 390, height: 844 })
				await page.reload()
				await page.locator(CHANGE).first().waitFor({ timeout: 30000 })
				const phone = await ask('[fake:payments]', PN.pay)
				await phone.scrollIntoViewIfNeeded()
				const fit = await fitsWidth(page, 390)
				check(
					'at 390 px every button and link of the blocks is fully visible and the page does not scroll sideways',
					fit.ok,
					JSON.stringify(fit)
				)
				await shot(page, 'changes-proposals', 'phone')
				await decline(phone, 'Keep payment')
				const phoneLink = page.locator(CHANGE).filter({ hasText: 'Student card created.' }).getByRole('link')
				await phoneLink.scrollIntoViewIfNeeded()
				const linkFit = await fitsWidth(page, 390)
				check('at 390 px the receipt links are visible too', linkFit.ok, JSON.stringify(linkFit))
				await page.setViewportSize({ width: 1280, height: 800 })

				const declines = []
				await page.route('**/api/chat/actions/*/decline', (route) => {
					const url = route.request().url()
					declines.push(url)
					const block = syntheticBlocks.find((item) => url.includes(item.actionId))
					return route.fulfill({ status: 200, json: { block: { ...block, state: 'declined' } } })
				})
				const syntheticBlocks = []
				const target = core.addDays(today, 7)
				const lessonAt = core.zonedInstant(core.addDays(today, 1), '16:00', VN).toISOString()
				let conversation = null
				const created = page.waitForResponse(
					(response) => response.request().method() === 'POST' && response.url().endsWith('/api/chat/conversations')
				)
				await page.route('**/api/chat/conversations/*/messages', async (route) => {
					if (route.request().method() !== 'POST') return route.fallback()
					conversation ??= (await (await created).json()).conversation
					if (conversation?.id && !conversations.includes(conversation.id)) conversations.push(conversation.id)
					const body = route.request().postDataJSON()
					const block =
						syntheticBlocks.length === 0
							? calendarBlock(
									'move',
									{
										kind: 'lesson',
										startsAt: core.zonedInstant(core.addDays(today, 2), '18:00', VN).toISOString(),
										durationMinutes: 60,
									},
									{ key: `l:${randomUUID()}`, startsAt: lessonAt, durationMinutes: 60 }
								)
							: calendarBlock(
									'end_series',
									{ kind: 'series_end', from: target, lastOn: core.addDays(target, -7) },
									{
										key: `s:${randomUUID()}`,
										startsAt: core.zonedInstant(target, '16:00', VN).toISOString(),
										durationMinutes: 60,
									}
								)
					syntheticBlocks.push(block)
					return route.fulfill({ status: 201, json: syntheticReply(conversation, body, block) })
				})
				await page.goto(`${BASE}/chat`)
				await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				await page.locator(FIELD).waitFor({ timeout: 30000 })
				const syntheticAsk = async (index) => {
					await page.locator(FIELD).click()
					await page.keyboard.type(`@${PN.end}`)
					await page.locator(POPUP).waitFor({ timeout: 15000 })
					await page.keyboard.press('Enter')
					await page.locator(POPUP).waitFor({ state: 'detached', timeout: 5000 })
					await page.keyboard.type(' synthetic')
					await page.locator(SEND).click()
					await page.waitForFunction(
						({ selector, count }) => document.querySelectorAll(selector).length > count,
						{ selector: CALENDAR_CHANGE, count: index },
						{ timeout: 15000 }
					)

					return page.locator(CALENDAR_CHANGE).nth(index)
				}
				const moved = await syntheticAsk(0)
				await moved.getByRole('button', { name: 'Keep' }).click()
				await moved.getByText('Kept as it was. Nothing changed.').waitFor({ timeout: 15000 })
				check(
					'Keep on a move proposal sends decline to the server and shows Kept as it was',
					declines.length === 1 &&
						declines[0].endsWith(`/api/chat/actions/${syntheticBlocks[0].actionId}/decline`) &&
						(await stateOf(moved)) === 'declined'
				)
				const ending = await syntheticAsk(1)
				text = await ending.innerText()
				check(
					'an end-series proposal shows the question, Was and Now, the history line and End series with Keep series',
					text.includes(`End ${PN.end}'s weekly lessons?`) &&
						text.includes('Was') &&
						text.includes('Every ') &&
						text.includes('No lessons from') &&
						text.includes('An ended series cannot be undone from the chat.') &&
						JSON.stringify(await buttonsOf(ending)) === JSON.stringify(['End series', 'Keep series']),
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-proposals', 'end-series')
				await page.setViewportSize({ width: 390, height: 844 })
				await ending.scrollIntoViewIfNeeded()
				const endFit = await fitsWidth(page, 390)
				check(
					'at 390 px the end-series decisions are fully visible and the page does not scroll sideways',
					endFit.ok,
					JSON.stringify(endFit)
				)
				await shot(page, 'changes-proposals', 'end-series-phone')
				await page.setViewportSize({ width: 1280, height: 800 })
				await ending.getByRole('button', { name: 'Keep series' }).click()
				await ending.getByText('Kept as it was. Nothing changed.').waitFor({ timeout: 15000 })
				check(
					'Keep series sends decline for the end-series proposal',
					declines.length === 2 && declines[1].endsWith(`/api/chat/actions/${syntheticBlocks[1].actionId}/decline`)
				)
				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
				check('the api log has no message text', !started.logs().includes('rate: 3000'))
			},
			() => removeConversations(conversations),
			() => removeProposalCards(),
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

const BULK_PORT = 4253
const BULK_NAME = 'Alex Example 2388'
const BULK = '[data-operation="bulk_move"]'
const ESSAY = '[data-slot="chat-essay"]'
const STOP = '[data-slot="chat-stop"]'
const ASSISTANT = '[data-role="assistant"]'
const ESSAY_LABEL = 'Approximate estimate — not an official IELTS score.'
const TOO_LONG = 'This essay is too long for the current chat limit. Shorten it before sending.'
const OUTCOME_LINE = 'I could not prepare that change.'
const WIDTHS = [390, 375, 320]

function removeBulkCard() {
	removeStudentCards(sql, `display_name = ${q(BULK_NAME)} and import_key is null`)
	console.log('fixture card removed')
}

function readBudget(budgetAccount) {
	const period = budgetAccount
		? sql(
				`select id, spent_nano::text as spent, held_nano::text as held from chat_budget_periods where account_id = '${budgetAccount}' order by starts_on desc limit 1`
			).rows[0]
		: undefined
	return period
}

function restoreBudget(period) {
	if (period)
		sql(
			`update chat_budget_periods set spent_nano = ${period.spent}, held_nano = ${period.held} where id = '${period.id}'`
		)
}

async function newChat(page) {
	await page.goto(`${BASE}/chat`)
	await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
	await page.getByRole('button', { name: 'New chat', exact: true }).click()
	await page.locator(FIELD).waitFor({ timeout: 30000 })
}

async function typeSend(page, text, mention = null) {
	await page.locator(FIELD).click()
	if (mention !== null) {
		await page.keyboard.type(`@${mention}`)
		await page.locator(POPUP).waitFor({ timeout: 15000 })
		await page.keyboard.press('Enter')
		await page.locator(POPUP).waitFor({ state: 'detached', timeout: 5000 })
	}
	await page.keyboard.type(text)
	await page.locator(SEND).click()
}

async function widthFit(page, scope, width) {
	await page.setViewportSize({ width, height: 844 })
	await page.waitForTimeout(250)
	return page.evaluate(
		({ scope, width }) => {
			const boxes = [...document.querySelectorAll(`${scope} button, ${scope} a, ${scope} li, ${scope} p`)].map(
				(node) => {
					const box = node.getBoundingClientRect()
					return { x: box.x, right: box.x + box.width, width: box.width, text: (node.textContent ?? '').slice(0, 24) }
				}
			)
			const bad = boxes.filter((box) => box.width > 0 && (box.x < -0.5 || box.right > width + 0.5))
			return {
				count: boxes.length,
				bad: bad.slice(0, 3),
				overflow: document.documentElement.scrollWidth - window.innerWidth,
			}
		},
		{ scope, width }
	)
}

function targetsOf(today, shapes, zone, input) {
	return shapes.map((shape, index) => {
		const day = core.addDays(today, 1 + index)
		return {
			seriesId: randomUUID(),
			seriesTimeZone: zone,
			from: day,
			wasStartsAt: core.zonedInstant(day, '16:00', zone).toISOString(),
			nowStartsAt: core.zonedInstant(core.addDays(day, 1), '18:00', input).toISOString(),
			durationMinutes: 60,
			state: shape,
		}
	})
}

function bulkBlock(studentId, state, targets, extra = {}) {
	return chatChangeProposalBlock.parse({
		type: 'change_proposal',
		actionId: randomUUID(),
		state,
		...(extra.issue ? { issue: extra.issue } : {}),
		change: {
			operation: 'bulk_move',
			studentId,
			studentName: BULK_NAME,
			inputTimeZone: extra.input ?? 'Europe/Moscow',
			zoneNamed: extra.named ?? true,
			accountTimeZone: extra.account ?? VN,
			fromWeekday: 2,
			fromTime: '16:00',
			toWeekday: 3,
			toTime: '18:00',
			targets,
			singlesLeft: extra.singles ?? 0,
		},
		receipt: state === 'applied' ? { studentId } : null,
	})
}

const withStates = (targets, states) =>
	targets.map((target, index) => ({ ...target, state: states[index] ?? target.state }))

async function sectionBulk() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	const started = await startFakeModelApi(BULK_PORT)
	const conversations = []
	const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
	const period = readBudget(teacher)
	try {
		removeBulkCard()
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await proposalsPrepare(page, apiOrigin, BULK_PORT)
				await signIn(page)
				const call = (method, path, body) => formsApi(page, apiOrigin, method, path, body)
				const created = await call('POST', '/students', {
					displayName: BULK_NAME,
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
				const google = []
				page.on('request', (request) => {
					if (request.url().includes('/api/google'))
						google.push(`${request.method()} ${new URL(request.url()).pathname}`)
				})
				const commands = () => Number(sql(`select count(*)::int as n from google_commands`).rows[0]?.n ?? -1)

				await newChat(page)
				const commandsBefore = commands()
				await typeSend(page, '[fake:bulk] from: tuesday 16:00 to: wednesday 18:00', BULK_NAME)
				await page.getByText(OUTCOME_LINE).waitFor({ timeout: 30000 })
				await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 30000 })
				const realChat = new URL(page.url()).searchParams.get('c')
				if (realChat) conversations.push(realChat)
				check(
					'with no Google connection the bulk request gives a refusal text, no decision block and no command',
					(await page.locator(CHANGE).count()) === 0 && commands() === commandsBefore,
					`${await page.locator(CHANGE).count()} blocks, commands ${commandsBefore} -> ${commands()}`
				)
				await page.getByRole('button', { name: 'Show steps' }).click()
				check(
					'the step of the bulk tool names the lessons to move',
					(await page.getByText(/Checking .* lessons to move/).count()) > 0
				)
				check('the api log has no message text', !started.logs().includes('from: tuesday'))

				const today = core.scheduleToday(new Date(), core.SCHEDULE_TIME_ZONE)
				const planned = (n, zone, input) => targetsOf(today, Array(n).fill('planned'), zone, input)
				const scripts = new Map()
				const hits = { confirm: [], decline: [], check: [] }
				const idOf = (url) => new URL(url).pathname.split('/').at(-2)
				await page.route('**/api/chat/actions/*/confirm', (route) => {
					const id = idOf(route.request().url())
					hits.confirm.push(id)
					return route.fulfill({ status: 200, json: { block: scripts.get(id).afterConfirm } })
				})
				await page.route('**/api/chat/actions/*/decline', (route) => {
					const id = idOf(route.request().url())
					hits.decline.push(id)
					return route.fulfill({ status: 200, json: { block: scripts.get(id).afterDecline } })
				})
				await page.route('**/api/chat/actions/*/check', (route) => {
					const id = idOf(route.request().url())
					hits.check.push(id)
					const script = scripts.get(id)
					return route.fulfill({ status: 200, json: { block: script.checks[script.mode]() } })
				})

				const as = (block, id) => ({ ...block, actionId: id })
				const targetsA = planned(4, VN, 'Europe/Moscow')
				const blockA = bulkBlock(studentId, 'proposed', targetsA)
				const stateA = (state, list) => as(bulkBlock(studentId, state, withStates(targetsA, list)), blockA.actionId)
				scripts.set(blockA.actionId, {
					afterConfirm: stateA('pending', ['pending', 'not_started', 'not_started', 'not_started']),
					mode: 'mid',
					checks: {
						mid: () => stateA('pending', ['applied', 'pending', 'not_started', 'not_started']),
						done: () => stateA('applied', ['applied', 'applied', 'applied', 'applied']),
					},
				})

				const targetsB = planned(3, 'Europe/Moscow', VN)
				const optionsB = { named: false, input: VN, account: 'Europe/Moscow', singles: 1 }
				const blockB = bulkBlock(studentId, 'proposed', targetsB, optionsB)
				const stateB = (state, list, extra = {}) =>
					as(bulkBlock(studentId, state, withStates(targetsB, list), { ...optionsB, ...extra }), blockB.actionId)
				scripts.set(blockB.actionId, {
					afterConfirm: stateB('pending', ['pending', 'not_started', 'not_started']),
					mode: 'partial',
					checks: {
						partial: () => stateB('partial', ['applied', 'failed', 'not_started'], { issue: 'calendar_changed' }),
					},
				})

				const targetsC = planned(1, 'America/Argentina/Buenos_Aires', 'Europe/Moscow')
				const optionsC = { singles: 3, account: 'Europe/Moscow' }
				const blockC = bulkBlock(studentId, 'proposed', targetsC, optionsC)
				scripts.set(blockC.actionId, {
					afterDecline: as(bulkBlock(studentId, 'declined', targetsC, optionsC), blockC.actionId),
				})

				const targetsD = planned(2, VN, 'Europe/Moscow')
				const staleD = bulkBlock(studentId, 'stale', targetsD)
				const failedD = bulkBlock(studentId, 'failed', withStates(targetsD, ['failed', 'not_started']), {
					issue: 'provider_unavailable',
				})

				const queue = [[blockA], [blockB], [blockC], [staleD, failedD]]
				let conversation = null
				const createdChat = page.waitForResponse(
					(response) => response.request().method() === 'POST' && response.url().endsWith('/api/chat/conversations')
				)
				await page.route('**/api/chat/conversations/*/messages', async (route) => {
					if (route.request().method() !== 'POST') return route.fallback()
					conversation ??= (await (await createdChat).json()).conversation
					if (conversation?.id && !conversations.includes(conversation.id)) conversations.push(conversation.id)
					const body = route.request().postDataJSON()
					const blocks = queue.shift() ?? []
					const reply = syntheticReply(conversation, body, blocks[0])
					reply.messages[1].blocks = blocks
					return route.fulfill({ status: 201, json: reply })
				})
				await newChat(page)
				const askSynthetic = async (index) => {
					await page.locator(FIELD).fill(`synthetic bulk ${index}`)
					await page.locator(SEND).click()
					await page.waitForFunction(
						(count) => document.querySelectorAll('[data-role="assistant"]').length === count,
						index + 1,
						{
							timeout: 15000,
						}
					)
					await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 15000 })
				}
				const blockAt = (n) => page.locator(BULK).nth(n)
				const states = (block) =>
					block
						.locator('[data-slot="bulk-target"]')
						.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-state')))
				const buttons = async (block) => (await block.getByRole('button').allInnerTexts()).map((text) => text.trim())
				const dataState = (block) => block.getAttribute('data-state')

				await askSynthetic(0)
				const a = blockAt(0)
				let text = await a.innerText()
				check(
					'A named-zone proposal shows the student, the input zone MSK, the count, three of four changes and the decisions',
					text.includes(`Move ${BULK_NAME}'s weekly lessons?`) &&
						text.includes('Input time zone') &&
						text.includes('MSK') &&
						!text.includes('No time zone was named') &&
						text.includes('4 planned changes: 4 weekly series') &&
						text.includes('Series zone VN · New rule zone MSK') &&
						text.includes('And future occurrences') &&
						text.includes('Lessons with a mark or a comment, and the lessons before them, stay at their old time.') &&
						(await states(a)).length === 3 &&
						JSON.stringify(await buttons(a)) ===
							JSON.stringify(['Show all selected changes', 'Move lessons', 'Keep lesson times']),
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-bulk', 'proposed')
				await a.getByRole('button', { name: 'Show all selected changes' }).click()
				check(
					'Show all selected changes opens all four changes in the card',
					(await states(a)).length === 4 &&
						(await a.getByRole('button', { name: 'Show fewer selected changes' }).getAttribute('aria-expanded')) ===
							'true'
				)
				await shot(page, 'changes-bulk', 'proposed-open')
				await a.getByRole('button', { name: 'Show fewer selected changes' }).click()
				check('Show fewer selected changes folds the list back to three', (await states(a)).length === 3)
				await a.getByRole('button', { name: 'Move lessons' }).click()
				await a.locator('[data-slot="bulk-target"][data-state="pending"]').first().waitFor({ timeout: 15000 })
				text = await a.innerText()
				check(
					'after Move lessons the card is busy, waits for Google, shows each change state and offers Check status',
					(await dataState(a)) === 'pending' &&
						(await a.getAttribute('aria-busy')) === 'true' &&
						text.includes('Waiting for Google Calendar to confirm this change…') &&
						!text.includes('Lessons moved.') &&
						JSON.stringify(await states(a)) === JSON.stringify(['pending', 'not_started', 'not_started']) &&
						(await buttons(a)).includes('Check status') &&
						!(await buttons(a)).includes('Move lessons') &&
						hits.confirm.length === 1,
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-bulk', 'pending')
				const deadline = Date.now() + 8000
				while (hits.check.length === 0 && Date.now() < deadline) await page.waitForTimeout(200)
				await page.waitForFunction(
					(index) => {
						const nodes = document
							.querySelectorAll('[data-operation="bulk_move"]')
							[index]?.querySelectorAll('[data-slot="bulk-target"]')
						return nodes?.[0]?.getAttribute('data-state') === 'applied'
					},
					0,
					{ timeout: 8000 }
				)
				check(
					'the card checks the status by itself: the first change is Confirmed, the second waits, the move is not done',
					hits.check.length >= 1 &&
						JSON.stringify(await states(a)) === JSON.stringify(['applied', 'pending', 'not_started']) &&
						!(await a.innerText()).includes('Lessons moved.')
				)
				await shot(page, 'changes-bulk', 'pending-mid')
				scripts.get(blockA.actionId).mode = 'done'
				const checksBefore = hits.check.length
				await a.getByRole('button', { name: 'Check status' }).click()
				await a.getByText('Lessons moved.').waitFor({ timeout: 15000 })
				text = await a.innerText()
				const firstNew = targetsA
					.map((target) => core.zonedParts(new Date(target.nowStartsAt), 'Europe/Moscow').date)
					.sort()[0]
				const link = a.getByRole('link', { name: /^View schedule/ })
				check(
					'Check status gets the final state: Lessons moved. only when every change is applied, with View schedule',
					hits.check.length > checksBefore &&
						(await dataState(a)) === 'applied' &&
						text.includes('4 planned changes confirmed in Google Calendar.') &&
						(await link.getAttribute('href')) === `/schedule?week=${firstNew}&day=${firstNew}`,
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-bulk', 'applied')

				await askSynthetic(1)
				const b = blockAt(1)
				text = await b.innerText()
				check(
					'B without a named zone says Vietnam time is used, shows the display zone and the single lesson that stays',
					text.includes('No time zone was named. These times use Vietnam time (VN).') &&
						text.includes('Display time zone') &&
						text.includes('3 planned changes: 3 weekly series') &&
						text.includes('1 single lesson at this time is not moved.') &&
						!text.includes('Show all selected changes'),
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-bulk', 'no-zone')
				await b.getByRole('button', { name: 'Move lessons' }).click()
				await b.getByText('Some changes are confirmed. The move is not complete.').waitFor({ timeout: 15000 })
				text = await b.innerText()
				check(
					'a partial result keeps the confirmed change, counts planned changes: confirmed, unconfirmed, not started, and offers no Check status',
					(await dataState(b)) === 'partial' &&
						text.includes('1 planned change confirmed. 1 unconfirmed. 1 not started.') &&
						text.includes('The remaining lessons changed after you asked. The confirmed changes stay.') &&
						text.includes('Ask again to move the remaining lessons.') &&
						!text.includes('Lessons moved.') &&
						!text.includes('Saved') &&
						JSON.stringify(await states(b)) === JSON.stringify(['applied', 'failed', 'not_started']) &&
						(await b.getAttribute('aria-busy')) === 'false' &&
						!(await buttons(b)).includes('Check status'),
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-bulk', 'partial')

				await askSynthetic(2)
				const c = blockAt(2)
				text = await c.innerText()
				check(
					'C shows one change with a long zone name and the plural single lessons line',
					text.includes('3 single lessons at this time are not moved.') &&
						text.includes('1 planned change: 1 weekly series') &&
						text.includes('Series zone BUEN · New rule zone MSK') &&
						(await states(c)).length === 1,
					text.replace(/\n/g, ' | ')
				)
				await c.getByRole('button', { name: 'Keep lesson times' }).click()
				await c.getByText('Proposal declined. This proposal made no changes.').waitFor({ timeout: 15000 })
				check(
					'Keep lesson times sends decline once, no confirm, and the card is declined',
					hits.decline.length === 1 &&
						hits.decline[0] === blockC.actionId &&
						!hits.confirm.includes(blockC.actionId) &&
						(await dataState(c)) === 'declined'
				)

				await askSynthetic(3)
				const stale = blockAt(3)
				const failed = blockAt(4)
				const staleText = await stale.innerText()
				const failedText = await failed.innerText()
				check(
					'a stale proposal says nothing was changed and a failed one lists each change with the Google reason and Ask again',
					staleText.includes('This proposal is out of date. Nothing was changed.') &&
						staleText.includes('Ask again to use the current details.') &&
						failedText.includes('Google Calendar did not accept the change. Nothing was changed.') &&
						failedText.includes('Google Calendar is unavailable. Calendar changes are disabled.') &&
						failedText.includes('Ask again to move the remaining lessons.') &&
						JSON.stringify(await states(failed)) === JSON.stringify(['failed', 'not_started']),
					failedText.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-bulk', 'failed')

				check(
					'the browser sent no write to the Google endpoints and the decisions went out once each',
					google.every((entry) => entry.startsWith('GET ')) && hits.confirm.length === 2 && hits.decline.length === 1,
					`${[...new Set(google)].join(', ')}; ${hits.confirm.length} confirm, ${hits.decline.length} decline`
				)
				await a.getByRole('button', { name: 'Show all selected changes' }).click()
				for (const width of WIDTHS) {
					const fit = await widthFit(page, BULK, width)
					check(
						`at ${width} px every part of the bulk blocks stays inside the screen and the page does not scroll sideways`,
						fit.count > 0 && fit.bad.length === 0 && fit.overflow <= 0,
						JSON.stringify(fit)
					)
					await a.scrollIntoViewIfNeeded()
					await shot(page, 'changes-bulk', `phone-${width}`)
				}
				await page.setViewportSize({ width: 1280, height: 800 })
				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			},
			() => removeConversations(conversations),
			() => removeBulkCard(),
			() => restoreBudget(period)
		)
	} finally {
		await stopFakeModelApi(started)
	}
}

function assistantOnly(conversation, body, text, blocks) {
	const reply = syntheticReply(conversation, body, blocks[0])
	reply.messages[1].body = text
	reply.messages[1].blocks = blocks
	return reply
}

const ESSAY_TEXT =
	'Some people think that students should study abroad. Others believe it is better to stay at home. In my opinion, studying abroad brings many benefits because students learn independence.'

async function sectionEssay() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	const started = await startFakeModelApi(BULK_PORT, '120')
	const conversations = []
	const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
	const period = readBudget(teacher)
	try {
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await proposalsPrepare(page, apiOrigin, BULK_PORT)
				await signIn(page)
				let conversation = null
				page.on('response', async (response) => {
					if (response.request().method() !== 'POST' || !/\/messages$/.test(response.url()) || !response.ok()) return
					const parsed = await response.json().catch(() => null)
					if (parsed?.conversation && parsed.turn !== null) conversation = parsed.conversation
				})
				const essays = () => page.locator(ESSAY)
				const assistants = () => page.locator(ASSISTANT)
				const track = () => {
					const id = new URL(page.url()).searchParams.get('c')
					if (id && !conversations.includes(id)) conversations.push(id)
				}

				await page.goto(`${BASE}/chat`)
				await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				await page.locator(FIELD).waitFor({ timeout: 30000 })
				const listText = await page.locator('body').innerText()
				check(
					'the commands list of a new chat has /essay with its description',
					listText.includes('/essay') && listText.includes('Feedback on a pasted essay')
				)
				await page.locator(FIELD).click()
				await page.keyboard.type('/')
				await page.locator(POPUP).waitFor({ timeout: 15000 })
				check('typing / offers /essay in the command popup', (await page.locator(POPUP).innerText()).includes('/essay'))
				await page.keyboard.press('Escape')
				await page.locator(FIELD).fill('')

				await page.locator(FIELD).fill(`/essay [fake:essay] ${ESSAY_TEXT} ${'x'.repeat(140)}`)
				await page.locator(SEND).click()
				await assistants().first().waitFor({ timeout: 30000 })
				track()
				await page.waitForTimeout(1800)
				await page.reload()
				await essays().first().waitFor({ timeout: 30000 })
				const early = essays().first()
				const earlyText = await early.innerText()
				check(
					'while the reply is still running (reload mid-reply) the heading, the approximate label and the unassessed task are already there',
					(await early.getAttribute('data-outcome')) === 'streaming' &&
						earlyText.startsWith('Essay feedback') &&
						earlyText.includes(ESSAY_LABEL) &&
						earlyText.includes('Task criterion not assessed') &&
						earlyText.includes('No task prompt or task type was supplied.') &&
						!earlyText.includes('Lexical resource'),
					earlyText.replace(/\n/g, ' | ')
				)
				await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 40000 })
				const full = await essays().first().innerText()
				check(
					'after the reply the label stays above the feedback text, the outcome is complete and no incomplete line',
					(await essays().first().getAttribute('data-outcome')) === 'complete' &&
						full.indexOf(ESSAY_LABEL) >= 0 &&
						full.indexOf(ESSAY_LABEL) < full.indexOf('Coherence and cohesion') &&
						!full.includes('Feedback incomplete') &&
						(await essays().count()) === 1,
					full.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-essay', 'complete')
				const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
				check(
					'the long unbroken word of the teacher message wraps and the page does not scroll sideways',
					overflow <= 0,
					String(overflow)
				)
				await page.getByRole('button', { name: 'Show steps' }).click()
				check('the essay step reads Reading the essay', (await page.getByText('Reading the essay').count()) > 0)
				await page.reload()
				await essays().first().waitFor({ timeout: 30000 })
				const again = await essays().first().innerText()
				check(
					'after a reload the label is still above the feedback',
					again.startsWith('Essay feedback') &&
						again.indexOf(ESSAY_LABEL) >= 0 &&
						again.indexOf(ESSAY_LABEL) < again.indexOf('Coherence and cohesion')
				)

				await page.locator(FIELD).fill(`/essay [fake:essay] ${ESSAY_TEXT}`)
				await page.locator(SEND).click()
				await page.locator(STOP).waitFor({ timeout: 15000 })
				await page.waitForTimeout(1500)
				await page.locator(STOP).click()
				await page.getByText('Feedback incomplete').waitFor({ timeout: 30000 })
				await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 30000 })
				const second = essays().nth(1)
				const stoppedText = await second.innerText()
				check(
					'Stop leaves the label and a Feedback incomplete line, never a finished-looking feedback',
					(await second.getAttribute('data-outcome')) === 'incomplete' &&
						stoppedText.includes(ESSAY_LABEL) &&
						stoppedText.includes('Feedback incomplete') &&
						!stoppedText.includes('Grammatical range and accuracy'),
					stoppedText.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-essay', 'incomplete')
				const before = await assistants().count()
				await second.getByRole('button', { name: 'Ask another question' }).click()
				await page
					.waitForFunction(() => document.activeElement?.getAttribute('data-slot') === 'chat-composer-field', null, {
						timeout: 3000,
					})
					.catch(() => undefined)
				check(
					'Ask another question puts the cursor in the field and sends nothing',
					(await page.evaluate(() => document.activeElement?.getAttribute('data-slot'))) === 'chat-composer-field' &&
						(await assistants().count()) === before
				)

				await page.locator(FIELD).fill('a'.repeat(20001))
				await page.getByText(TOO_LONG).waitFor({ timeout: 5000 })
				await page.locator(FIELD).press('Enter')
				await page.waitForTimeout(400)
				check(
					'an essay over the limit shows the line under the field, Send is off and Enter sends nothing',
					(await page.locator(SEND).isDisabled()) && (await assistants().count()) === before
				)
				await shot(page, 'changes-essay', 'too-long')
				await page.locator(FIELD).fill('a'.repeat(20000))
				check(
					'exactly at the limit the line is gone and Send is on',
					(await page.getByText(TOO_LONG).count()) === 0 && (await page.locator(SEND).isEnabled())
				)
				await page.locator(FIELD).fill('')

				const current = new URL(page.url()).searchParams.get('c')
				const queue = []
				await page.route('**/api/chat/conversations/*/messages', async (route) => {
					if (route.request().method() !== 'POST') return route.fallback()
					const body = route.request().postDataJSON()
					const next = queue.shift()
					return route.fulfill({ status: 201, json: assistantOnly(conversation, body, next.text, next.blocks) })
				})
				queue.push({
					text: '',
					blocks: [
						{ type: 'essay', task: 'task2' },
						{ type: 'refused', code: 'model_refused' },
					],
				})
				queue.push({
					text: '**Task response** The position is clear and both views are covered.',
					blocks: [{ type: 'essay', task: 'task2' }],
				})
				for (const item of queue) for (const block of item.blocks) chatBlock.parse(block)
				const count = await essays().count()
				await page.locator(FIELD).fill('synthetic unavailable')
				await page.locator(SEND).click()
				await page.waitForFunction(
					(n) => document.querySelectorAll('[data-slot="chat-essay"]').length === n,
					count + 1,
					{ timeout: 15000 }
				)
				const unavailable = essays().nth(count)
				const unavailableText = await unavailable.innerText()
				check(
					'a refused essay reply shows Feedback unavailable with the label, the reason and Ask another question',
					(await unavailable.getAttribute('data-outcome')) === 'unavailable' &&
						unavailableText.includes(ESSAY_LABEL) &&
						unavailableText.includes('Feedback unavailable') &&
						unavailableText.includes('Could not complete feedback for this essay.') &&
						unavailableText.includes('Ask another question') &&
						!unavailableText.includes('Task criterion not assessed'),
					unavailableText.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-essay', 'unavailable')
				await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 15000 })
				await page.locator(FIELD).fill('synthetic task two')
				await page.locator(SEND).click()
				await page.waitForFunction(
					(n) => document.querySelectorAll('[data-slot="chat-essay"]').length === n,
					count + 2,
					{ timeout: 15000 }
				)
				const known = essays().nth(count + 1)
				const knownText = await known.innerText()
				check(
					'with a known task there is no unassessed line and the label is above the text',
					!knownText.includes('Task criterion not assessed') &&
						knownText.indexOf(ESSAY_LABEL) >= 0 &&
						knownText.indexOf(ESSAY_LABEL) < knownText.indexOf('Task response'),
					knownText.replace(/\n/g, ' | ')
				)
				check(
					'every essay reply has exactly one approximate label',
					(await page.locator('[data-slot="chat-essay-label"]').count()) === count + 2
				)
				for (const width of WIDTHS) {
					const fit = await widthFit(page, ESSAY, width)
					check(
						`at ${width} px the essay blocks and the teacher message stay inside the screen`,
						fit.count > 0 && fit.bad.length === 0 && fit.overflow <= 0,
						JSON.stringify(fit)
					)
					await essays().first().scrollIntoViewIfNeeded()
					await shot(page, 'changes-essay', `phone-${width}`)
				}
				await page.setViewportSize({ width: 1280, height: 800 })
				if (current) conversations.push(current)
				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
				check('the api log has no essay text', !started.logs().includes('Some people think'))
			},
			() => removeConversations([...new Set(conversations)]),
			() => restoreBudget(period)
		)
	} finally {
		await stopFakeModelApi(started)
	}
}

const TITLE_PORT = 4254
const AUTO_TITLE = 'Fake plan for the next lesson'
const LONG_TITLE = 'Fake plan for the next lesson with many'
const MANUAL_TITLE = 'Chat check Manual title'
const TITLE_REPLY_TEXT = 'Plan the next lesson for my group'

const conversationRow = (id) => sql(`select title, revision from chat_conversations where id = '${id}'`).rows[0]

function listReads(page) {
	const reads = { count: 0 }
	page.on('request', (request) => {
		if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/chat/conversations') reads.count++
	})
	return reads
}

async function finishTurn(page, text) {
	await typeSend(page, text)
	await page.locator(STOP).waitFor({ timeout: 15000 })
	await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 30000 })
	return Date.now()
}

const headerTitle = (page) => page.locator('h1[title]')

async function titleShown(page, id, title) {
	const row = page.locator('li').filter({ has: page.locator(`[data-row-id="${id}"]`) })
	return {
		header: (await headerTitle(page).count()) === 1 && (await headerTitle(page).innerText()) === title,
		list: (await row.count()) === 1 && (await row.innerText()).includes(title),
	}
}

async function sectionTitle() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	const started = await startFakeModelApi(TITLE_PORT)
	const conversations = []
	const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
	const period = readBudget(teacher)
	const idOf = (page) => new URL(page.url()).searchParams.get('c')
	try {
		await withBrowser(
			{ width: 1440, height: 800 },
			async ({ page, problems }) => {
				await proposalsPrepare(page, apiOrigin, TITLE_PORT)
				await signIn(page)
				await newChat(page)
				const reads = listReads(page)
				let navigations = 0
				page.on('framenavigated', (frame) => {
					if (frame === page.mainFrame()) navigations++
				})
				await page.evaluate(() => {
					window.__titleCheck = 'kept'
				})

				const endedAt = await finishTurn(page, TITLE_REPLY_TEXT)
				const first = idOf(page)
				if (first) conversations.push(first)
				const navigationsAtEnd = navigations
				const readsAtEnd = reads.count
				const before = await titleShown(page, first, 'New chat')
				check('right after the reply the header and the list still say New chat', before.header && before.list)
				await headerTitle(page).filter({ hasText: AUTO_TITLE }).waitFor({ timeout: 8000 })
				const elapsed = Date.now() - endedAt
				const shown = await titleShown(page, first, AUTO_TITLE)
				check(
					'the header and the list show the generated title without a reload',
					shown.header &&
						shown.list &&
						navigations === navigationsAtEnd &&
						(await page.evaluate(() => window.__titleCheck)) === 'kept',
					JSON.stringify({ shown, navigations })
				)
				check(
					'the title arrives after the first quiet re-read, not instantly',
					elapsed >= 1000 && elapsed <= 5000,
					`${elapsed} ms`
				)
				check('one quiet list read brought the title', reads.count - readsAtEnd === 1, String(reads.count - readsAtEnd))
				const stored = conversationRow(first)
				check(
					'the stored title and revision match the screen',
					stored.title === AUTO_TITLE && Number(stored.revision) === 2,
					JSON.stringify(stored)
				)
				await shot(page, 'changes-title', 'generated')
				const readsAtTitle = reads.count
				await page.waitForTimeout(7500)
				check(
					'after the title arrived no more list reads are made',
					reads.count === readsAtTitle,
					String(reads.count - readsAtTitle)
				)

				await finishTurn(page, 'Another plan please')
				await page.waitForTimeout(7000)
				const afterSecond = conversationRow(first)
				check(
					'a second turn keeps the title and the revision and reads the list only to refresh the preview (after sending and after the reply)',
					afterSecond.title === AUTO_TITLE &&
						Number(afterSecond.revision) === 2 &&
						(await titleShown(page, first, AUTO_TITLE)).header &&
						reads.count - readsAtTitle <= 2,
					JSON.stringify({ afterSecond, extra: reads.count - readsAtTitle })
				)

				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				await page.locator(FIELD).waitFor({ timeout: 15000 })
				await finishTurn(page, `[fake:title-slow] ${TITLE_REPLY_TEXT}`)
				const manual = idOf(page)
				if (manual) conversations.push(manual)
				const renamed = await formsApi(page, apiOrigin, 'PATCH', `/chat/conversations/${manual}`, {
					title: MANUAL_TITLE,
					expectedRevision: Number(conversationRow(manual).revision),
				})
				check('a manual rename before the generated title is accepted', renamed.status === 200, String(renamed.status))
				await headerTitle(page).filter({ hasText: MANUAL_TITLE }).waitFor({ timeout: 8000 })
				await page.waitForTimeout(6500)
				const kept = conversationRow(manual)
				const keptShown = await titleShown(page, manual, MANUAL_TITLE)
				check(
					'the manual title wins on the screen and in the database',
					kept.title === MANUAL_TITLE && Number(kept.revision) === 2 && keptShown.header && keptShown.list,
					JSON.stringify({ kept, keptShown })
				)
				await shot(page, 'changes-title', 'manual-wins')

				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				await page.locator(FIELD).waitFor({ timeout: 15000 })
				let blocking = false
				await page.route('**/api/chat/conversations', async (route) => {
					if (blocking && route.request().method() === 'GET') return route.abort()
					return route.fallback()
				})
				blocking = true
				await finishTurn(page, TITLE_REPLY_TEXT)
				const raced = idOf(page)
				if (raced) conversations.push(raced)
				const row = page.locator('li').filter({ has: page.locator(`[data-row-id="${raced}"]`) })
				await row.hover()
				await row.getByRole('button', { name: /^More:/ }).click()
				await page.getByRole('menuitem', { name: 'Rename conversation' }).click()
				const dialog = page.getByRole('dialog', { name: 'Rename conversation' })
				await dialog.waitFor({ timeout: 15000 })
				const field = dialog.getByLabel('Conversation title')
				check('the dialog opens with New chat while the list is stale', (await field.inputValue()) === 'New chat')
				await field.fill(MANUAL_TITLE)
				const deadline = Date.now() + 8000
				while (Date.now() < deadline && conversationRow(raced).title === 'New chat') await page.waitForTimeout(250)
				check(
					'the generated title landed on the server while the screen was stale',
					conversationRow(raced).title === AUTO_TITLE && (await field.inputValue()) === MANUAL_TITLE
				)
				blocking = false
				await dialog.getByRole('button', { name: 'Save title' }).click()
				await dialog.waitFor({ state: 'detached', timeout: 15000 })
				await headerTitle(page).filter({ hasText: MANUAL_TITLE }).waitFor({ timeout: 8000 })
				const retried = conversationRow(raced)
				check(
					'a conflict from the generated title repeats the typed name once and it wins',
					retried.title === MANUAL_TITLE && Number(retried.revision) === 3,
					JSON.stringify(retried)
				)
				await page.waitForTimeout(6500)
				check('no later read brings the generated title back', conversationRow(raced).title === MANUAL_TITLE)
				await shot(page, 'changes-title', 'rename-conflict')

				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				await page.locator(FIELD).waitFor({ timeout: 15000 })
				await finishTurn(page, `[fake:title-long] ${TITLE_REPLY_TEXT}`)
				const long = idOf(page)
				if (long) conversations.push(long)
				await headerTitle(page).filter({ hasText: LONG_TITLE }).waitFor({ timeout: 8000 })
				for (const width of WIDTHS) {
					await page.setViewportSize({ width, height: 844 })
					await page.goto(`${BASE}/chat?c=${long}`)
					await headerTitle(page).filter({ hasText: LONG_TITLE }).waitFor({ timeout: 30000 })
					const open = page.getByRole('button', { name: 'All chats', exact: true })
					if ((await open.count()) === 1 && (await open.getAttribute('aria-expanded')) !== 'true') await open.click()
					await page.waitForTimeout(400)
					const fit = await page.evaluate(
						({ width, long }) => {
							const header = document.querySelector('h1[title]')?.getBoundingClientRect()
							const row = document.querySelector(`[data-row-id="${long}"] span.truncate`)?.getBoundingClientRect()
							return {
								header: header ? { x: header.x, right: header.right } : null,
								row: row ? { x: row.x, right: row.right } : null,
								overflow: document.documentElement.scrollWidth - window.innerWidth,
								width,
							}
						},
						{ width, long }
					)
					check(
						`at ${width} px the long title stays inside the screen in the header and the list`,
						fit.header !== null &&
							fit.header.x >= 0 &&
							fit.header.right <= width + 0.5 &&
							(fit.row === null || (fit.row.x >= 0 && fit.row.right <= width + 0.5)) &&
							fit.overflow <= 0,
						JSON.stringify(fit)
					)
					await shot(page, 'changes-title', `phone-${width}`)
				}
				await page.setViewportSize({ width: 1440, height: 800 })

				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
				check('the api log has no message text or title', !started.logs().includes(TITLE_REPLY_TEXT))
			},
			() => removeConversations([...new Set(conversations)]),
			() => restoreBudget(period)
		)
	} finally {
		await stopFakeModelApi(started)
	}
}

const FACTS_WHERE = `display_name like 'Alex Example 240_' and import_key is null`
const FN = { pay: 'Alex Example 2400', none: 'Alex Example 2401' }
const FACTS = '[data-slot="chat-facts"]'
const FOLLOW_UP = '[data-slot="chat-follow-up"]'
const DATES = '[data-slot="chat-lesson-dates"]'
const REPLY_FOOTER = '[data-slot="chat-reply-footer"]'

function removeFactsCards(conversations = []) {
	removeConversations(conversations)
	const left = sql(
		`select distinct conversation_id as id from chat_actions where target->>'studentId' in (select id::text from students where ${FACTS_WHERE})`
	).rows.map((row) => row.id)
	removeConversations(left)
	console.log(`fixture cards removed ${removeStudentCards(sql, FACTS_WHERE)}`)
}

function factsLayout(group) {
	const grid = group.querySelector('[data-slot="chat-facts-grid"]')
	const checked = group.querySelector('[data-slot="chat-facts-checked"]')
	const avatar = group.querySelector('span')
	const name = group.querySelector('span[title]')
	const box = group.getBoundingClientRect()
	const gridBox = grid.getBoundingClientRect()
	const checkedBox = checked.getBoundingClientRect()
	const gridStyle = getComputedStyle(grid)
	const groupStyle = getComputedStyle(group)
	const checkedStyle = getComputedStyle(checked)
	const cells = [...grid.children].map((cell) => {
		const rect = cell.getBoundingClientRect()
		return { left: rect.left, width: rect.width }
	})
	return {
		padding: groupStyle.paddingLeft,
		left: box.left,
		avatarLeft: avatar.getBoundingClientRect().left,
		cells,
		columns: gridStyle.gridTemplateColumns.split(' ').length,
		columnGap: gridStyle.columnGap,
		rowGap: gridStyle.rowGap,
		gridBottom: gridBox.bottom,
		checkedLeft: checkedBox.left,
		checkedTop: checkedBox.top,
		checkedBorder: checkedStyle.borderTopWidth,
		checkedPadding: checkedStyle.paddingTop,
		title: name?.getAttribute('title') ?? null,
		truncates: name !== null && getComputedStyle(name).textOverflow === 'ellipsis',
	}
}

async function sectionFacts() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	const conversations = []
	const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
	try {
		removeFactsCards()
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await formsPrepare(page, apiOrigin)
				await signIn(page)
				const call = (method, path, body) => formsApi(page, apiOrigin, method, path, body)
				const zone =
					sql(`select default_time_zone as zone from teacher_settings where account_id = '${teacher}'`).rows[0]?.zone ??
					core.SCHEDULE_TIME_ZONE
				const today = core.scheduleToday(new Date(), zone)
				const make = async (name) => {
					const created = await call('POST', '/students', {
						displayName: name,
						rateMinor: 400000,
						currency: 'RUB',
						defaultLessonMinutes: 60,
						parent: null,
						level: null,
						goals: null,
						timeZone: null,
					})
					check(`the fixture card ${name} is created`, created.status === 201, String(created.status))
					const id = created.json.student.id
					const opening = await call('PUT', `/students/${id}/opening-balance`, {
						lessonsHundredths: 200,
						on: core.addDays(today, -1),
						expectedDefaultTimeZone: zone,
					})
					check(`the opening balance of ${name} is set`, opening.status === 200, String(opening.status))
					return id
				}
				const ids = { pay: await make(FN.pay), none: await make(FN.none) }
				const paid = await call('POST', '/payments', {
					studentId: ids.pay,
					paidOn: today,
					expectedDefaultTimeZone: zone,
					amountMinor: 800000,
					currency: 'RUB',
					lessonsHundredths: 200,
					note: 'facts check payment',
				})
				check('the fixture payment is created', paid.status === 201, String(paid.status))
				const facts = {}
				for (const key of ['pay', 'none']) {
					const read = await call('GET', `/chat/records?studentId=${ids[key]}`)
					facts[key] = chatBlock.parse({ type: 'facts', facts: read.json })
				}
				check(
					'the server offers the follow-up only to the card with a payment',
					facts.pay.facts.followUp === 'since_payment' && facts.none.facts.followUp === undefined
				)
				const months = []
				for (let step = 7; step >= 0; step -= 1) months.push(core.addDays(today, -31 * step))
				const longDates = chatBlock.parse({
					type: 'lesson_dates',
					studentId: ids.pay,
					studentName: FN.pay,
					from: months[0],
					to: today,
					scope: 'since_payment',
					defaultTimeZone: zone,
					asOf: new Date().toISOString(),
					dates: months,
					leftOut: { noShow: 0, ahead: 0 },
					coverage: 'complete',
					sinceFrom: months[0],
					lastPaidOn: months[0],
				})

				let conversation = null
				const created = page.waitForResponse(
					(response) => response.request().method() === 'POST' && response.url().endsWith('/api/chat/conversations')
				)
				const followBodies = []
				let syntheticDates = null
				await page.route('**/api/chat/conversations/*/messages', async (route) => {
					if (route.request().method() !== 'POST') return route.fallback()
					conversation ??= (await (await created).json()).conversation
					if (conversation?.id && !conversations.includes(conversation.id)) conversations.push(conversation.id)
					const body = route.request().postDataJSON()
					if (body.text.endsWith(CHAT_FOLLOW_UP_TEXT)) {
						followBodies.push(body)
						await new Promise((resolve) => setTimeout(resolve, 900))
						if (syntheticDates === null) return route.fallback()
						return route.fulfill({ status: 201, json: syntheticReply(conversation, body, syntheticDates) })
					}
					const key = body.mentions[0]?.studentId === ids.none ? 'none' : 'pay'
					return route.fulfill({ status: 201, json: syntheticReply(conversation, body, facts[key]) })
				})
				await page.goto(`${BASE}/chat`)
				await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				await page.locator(FIELD).waitFor({ timeout: 30000 })

				await sendIn(page, 0, 'how many lessons are left', FN.pay)
				await page.locator(FACTS).first().waitFor({ timeout: 30000 })
				await page.locator(REPLY_FOOTER).first().waitFor({ timeout: 30000 })
				const wide = await page.locator(FACTS).first().evaluate(factsLayout)
				const edge = wide.left + 16
				check(
					'the facts block has 16 px padding and one left edge for the avatar, the cells and the read time',
					wide.padding === '16px' &&
						Math.abs(wide.avatarLeft - edge) < 1.5 &&
						Math.abs(wide.cells[0].left - edge) < 1.5 &&
						Math.abs(wide.checkedLeft - edge) < 1.5,
					JSON.stringify(wide)
				)
				check(
					'the cells are two columns of equal width with 24 px and 12 px gaps',
					wide.columns === 2 &&
						Math.abs(wide.cells[0].width - wide.cells[1].width) < 1.5 &&
						wide.columnGap === '24px' &&
						wide.rowGap === '12px',
					JSON.stringify(wide)
				)
				check(
					'Checked sits under a hairline with 8 px of padding below the cells',
					wide.checkedBorder === '1px' && wide.checkedPadding === '8px' && wide.checkedTop > wide.gridBottom,
					JSON.stringify(wide)
				)
				check(
					'the name is one line with an ellipsis and the full name in title',
					wide.title === FN.pay && wide.truncates
				)
				const reply = page.locator(ASSISTANT).first()
				check(
					'a reply that is only a block has no Copy reply and no sentence',
					(await reply.getByRole('button', { name: 'Copy reply' }).count()) === 0 &&
						(await reply.evaluate(
							(node, selectors) => {
								const copy = node.cloneNode(true)
								for (const selector of selectors) for (const part of copy.querySelectorAll(selector)) part.remove()
								return copy.textContent.trim()
							},
							[FACTS, REPLY_FOOTER, FOLLOW_UP]
						)) === '' &&
						/^\d{1,2}:\d{2}$/.test((await reply.locator(REPLY_FOOTER).innerText()).trim())
				)
				const followText = await page.locator(FOLLOW_UP).first().innerText()
				check(
					'the follow-up button carries the contract text, once',
					(await page.locator(FOLLOW_UP).count()) === 1 && followText.trim() === CHAT_FOLLOW_UP_TEXT,
					followText
				)
				const followRow = await page.locator(FOLLOW_UP).evaluate((button) => {
					const icon = button.querySelector('svg').getBoundingClientRect()
					const label = button.querySelector('span[class*="text-box"]').getBoundingClientRect()
					const frame = button.getBoundingClientRect()
					return {
						arrowBeforeText: icon.right <= label.left + 1,
						sameLine: Math.abs(icon.top + icon.height / 2 - (label.top + label.height / 2)) < 4,
						height: frame.height,
						iconWidth: icon.width,
					}
				})
				check(
					'the follow-up is one row: the 14 px arrow before the text',
					followRow.arrowBeforeText && followRow.sameLine && followRow.height <= 32 && followRow.iconWidth === 14,
					JSON.stringify(followRow)
				)
				await shot(page, 'changes-facts', 'desktop')

				await sendIn(page, 0, 'and for the other card', FN.none)
				await page.locator(FACTS).nth(1).waitFor({ timeout: 30000 })
				await page.locator(REPLY_FOOTER).nth(1).waitFor({ timeout: 30000 })
				check(
					'a card without a payment has no follow-up',
					(await page.locator(FOLLOW_UP).count()) === 1 &&
						(await page.locator(ASSISTANT).nth(1).locator(FOLLOW_UP).count()) === 0
				)

				await page.locator(FOLLOW_UP).click()
				await page
					.waitForFunction((selector) => document.querySelector(selector)?.disabled === true, FOLLOW_UP, {
						timeout: 3000,
					})
					.then(
						() => check('the follow-up is off while the request is sent', true),
						() => check('the follow-up is off while the request is sent', false)
					)
				await page.locator(DATES).first().waitFor({ timeout: 30000 })
				const sent = followBodies[0]
				check(
					'the follow-up sends the contract text with the mention of its student',
					sent?.text === `@${FN.pay} ${CHAT_FOLLOW_UP_TEXT}` &&
						sent.mentions.length === 1 &&
						sent.mentions[0].studentId === ids.pay,
					JSON.stringify(sent)
				)
				check('the follow-up button is gone from that reply', (await page.locator(FOLLOW_UP).count()) === 0)
				const empty = page.locator(DATES).first()
				const emptyText = await empty.innerText()
				check(
					'nothing since the payment: the head, the empty line and the last payment date, no Copy dates',
					emptyText.includes(`Lessons of ${FN.pay}`) &&
						emptyText.includes('No lessons since the last payment.') &&
						/Last payment: [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}\./.test(emptyText) &&
						(await empty.getByRole('button', { name: 'Copy dates' }).count()) === 0,
					emptyText
				)
				const answer = page.locator(ASSISTANT).last()
				check(
					'the dates answer has no Copy reply',
					(await answer.getByRole('button', { name: 'Copy reply' }).count()) === 0 &&
						/^\d{1,2}:\d{2}$/.test((await answer.locator(REPLY_FOOTER).innerText()).trim())
				)

				syntheticDates = longDates
				await sendIn(page, 0, 'once more', FN.pay)
				await page.locator(FACTS).nth(2).waitFor({ timeout: 30000 })
				await page.locator(REPLY_FOOTER).nth(3).waitFor({ timeout: 30000 })
				check('a later facts reply offers the follow-up again', (await page.locator(FOLLOW_UP).count()) === 1)
				await page.locator(FOLLOW_UP).click()
				await page.locator(DATES).nth(1).waitFor({ timeout: 30000 })
				const long = page.locator(DATES).nth(1)
				const longText = await long.innerText()
				check(
					'the dates block names the payment day in the scope line',
					/Held lessons since the last payment \([A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}( \d{4})?\) · 8 dates/.test(
						longText
					),
					longText.slice(0, 200)
				)
				check(
					'a long list shows six months and folds the rest',
					(await long.locator('[data-slot="chat-dates-month"]').count()) === 8 &&
						(await long.getByRole('button', { name: 'Show all 8 months' }).isVisible()) &&
						(await long.getByRole('button', { name: 'Copy dates' }).count()) === 1
				)
				await long.getByRole('button', { name: 'Show all 8 months' }).click()
				check(
					'Show all opens the rest in place',
					(await long.getByRole('button', { name: 'Show fewer months' }).getAttribute('aria-expanded')) === 'true'
				)
				const fold = await long.getByRole('button', { name: 'Show fewer months' }).evaluate((button) => {
					const icon = button.querySelector('svg').getBoundingClientRect()
					const label = button.querySelector('span[class*="text-box"]').getBoundingClientRect()
					return {
						chevronAfterText: icon.left >= label.right - 1,
						sameLine: Math.abs(icon.top + icon.height / 2 - (label.top + label.height / 2)) < 4,
						height: button.getBoundingClientRect().height,
					}
				})
				check(
					'the fold button is one row: the chevron after the text',
					fold.chevronAfterText && fold.sameLine && fold.height <= 32,
					JSON.stringify(fold)
				)
				await shot(page, 'changes-facts', 'dates')

				for (const width of [768, 375]) {
					await page.setViewportSize({ width, height: width === 375 ? 812 : 1024 })
					await page.waitForTimeout(400)
					const narrow = await page.locator(FACTS).first().evaluate(factsLayout)
					const boxes = await page
						.locator(`${FACTS} a, ${FOLLOW_UP}, ${DATES} button, ${DATES} a`)
						.evaluateAll((nodes) =>
							nodes
								.map((node) => node.getBoundingClientRect())
								.map((box) => ({ left: box.left, right: box.right, width: box.width }))
						)
					const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
					check(
						`at ${width} px the facts are ${width === 375 ? 'one column' : 'two columns'}, everything fits and the page does not scroll sideways`,
						narrow.columns === (width === 375 ? 1 : 2) &&
							boxes.every((box) => box.width > 0 && box.left >= 0 && box.right <= width) &&
							overflow <= 0,
						JSON.stringify({ columns: narrow.columns, overflow, boxes: boxes.length })
					)
					if (width === 375) await shot(page, 'changes-facts', 'phone')
				}
				await page.setViewportSize({ width: 1280, height: 800 })

				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			},
			() => removeFactsCards(conversations)
		)
	} finally {
		removeFactsCards(conversations)
	}
}

const DETAILS_PORT = 4257
const DN = { one: 'Alex Example 2410', many: 'Alex Example 2411', stale: 'Alex Example 2412' }
const DETAILS_WHERE = `display_name like 'Alex Example 241_' and import_key is null`

function removeDetailsCards(conversations = []) {
	removeConversations(conversations)
	const left = sql(
		`select distinct conversation_id as id from chat_actions where target->>'studentId' in (select id::text from students where ${DETAILS_WHERE})`
	).rows.map((row) => row.id)
	removeConversations(left)
	console.log(`fixture cards removed ${removeStudentCards(sql, DETAILS_WHERE)}`)
}

const detailsRow = (name) =>
	sql(
		`select id, level, goals, default_lesson_minutes as minutes, no_show_deducts as deducts, time_zone as zone, revision from students where display_name = ${q(name)} and import_key is null`
	).rows[0]

async function sectionDetails() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	const started = await startFakeModelApi(DETAILS_PORT)
	const conversations = []
	try {
		removeDetailsCards()
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await proposalsPrepare(page, apiOrigin, DETAILS_PORT)
				await signIn(page)
				const call = (method, path, body) => formsApi(page, apiOrigin, method, path, body)
				for (const name of Object.values(DN)) {
					const created = await call('POST', '/students', {
						displayName: name,
						rateMinor: 400000,
						currency: 'RUB',
						defaultLessonMinutes: 60,
						parent: null,
						level: null,
						goals: null,
						timeZone: null,
					})
					check(`the fixture card ${name} is created`, created.status === 201, String(created.status))
				}
				await page.goto(`${BASE}/chat`)
				await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				let shown = 0
				let chatId = null
				const ask = async (text, mention) => {
					const block = await askBlock(page, shown, text, mention)
					shown++
					chatId ??= new URL(page.url()).searchParams.get('c')
					if (chatId && !conversations.includes(chatId)) conversations.push(chatId)
					return block
				}
				const stateOf = (block) => block.getAttribute('data-state')
				const buttonsOf = async (block) => (await block.getByRole('button').allInnerTexts()).map((text) => text.trim())

				const one = await ask('[fake:details-level] level B2', DN.one)
				let text = await one.innerText()
				check(
					'one field names the card and the buttons and shows the row was to will be',
					(await stateOf(one)) === 'proposed' &&
						text.includes(`Change ${DN.one}'s level?`) &&
						text.includes('Level') &&
						text.includes('Not set') &&
						(await one.locator('[data-slot="change-after"]').innerText()).trim() === 'B2' &&
						text.includes('Only the fields above change. Payments and notes are not touched.') &&
						JSON.stringify(await buttonsOf(one)) === JSON.stringify(['Save level', 'Keep level']),
					text.replace(/\n/g, ' | ')
				)
				check('a proposal alone writes nothing', detailsRow(DN.one).level === null)
				await shot(page, 'changes-details', 'one')
				await one.getByRole('button', { name: 'Save level' }).click()
				await one.getByText('Level changed.').waitFor({ timeout: 15000 })
				const href = await one.getByRole('link', { name: /Edit details/ }).getAttribute('href')
				check(
					'Save level writes the level and the receipt names the value and links to the details form',
					detailsRow(DN.one).level === 'B2' &&
						(await one.innerText()).includes(`${DN.one}: Level B2.`) &&
						(href ?? '').includes('dialog=details'),
					href
				)

				const many = await ask('[fake:details-many] 90 minutes, no-show off, Exam preparation, Asia/Tokyo', DN.many)
				text = await many.innerText()
				const labels = (await many.locator('p.text-caption').allInnerTexts()).map((label) => label.trim())
				check(
					'several fields come in one card in the Details order with the city and offset of the zone',
					(await stateOf(many)) === 'proposed' &&
						text.includes(`Change ${DN.many}'s details?`) &&
						JSON.stringify(
							labels.filter((label) => ['Lesson length', 'No-show', 'Goals', 'Time zone'].includes(label))
						) === JSON.stringify(['Lesson length', 'No-show', 'Goals', 'Time zone']) &&
						text.includes('60 min') &&
						text.includes('90 min') &&
						text.includes('Deducts a lesson') &&
						text.includes('Deducts nothing') &&
						text.includes('Same as teacher') &&
						text.includes('Tokyo (UTC+9)') &&
						!text.includes('Asia/Tokyo'),
					text.replace(/\n/g, ' | ')
				)
				check(
					'a long value stacks Now over New and is not struck through',
					text.includes('Now') &&
						text.includes('New') &&
						text.includes('Exam preparation') &&
						(await many.locator('.line-through').count()) === 0
				)
				check(
					'the one line is the balance line and the buttons are Save changes and Keep details',
					text.includes('The balance is recalculated for all lessons.') &&
						JSON.stringify(await buttonsOf(many)) === JSON.stringify(['Save changes', 'Keep details'])
				)
				await shot(page, 'changes-details', 'several')
				await many.getByRole('button', { name: 'Save changes' }).click()
				await many.getByText('Details changed.').waitFor({ timeout: 15000 })
				const written = detailsRow(DN.many)
				const receipt = await many.innerText()
				check(
					'Save changes writes the fields and the receipt lists the values',
					written.minutes === 90 &&
						written.deducts === false &&
						written.goals === 'Exam preparation' &&
						written.zone === 'Asia/Tokyo' &&
						receipt.includes('Lesson length 90 min') &&
						receipt.includes('Time zone Tokyo (UTC+9)'),
					JSON.stringify(written)
				)

				const staleCard = await ask('[fake:details-level] level B2', DN.stale)
				sql(
					`update students set level = 'A1', revision = revision + 1 where display_name = ${q(DN.stale)} and import_key is null`
				)
				await staleCard.getByRole('button', { name: 'Save level' }).click()
				await staleCard.getByText('This proposal is out of date. Nothing was changed.').waitFor({ timeout: 15000 })
				check(
					'a card changed after the proposal makes it stale with no buttons and keeps the new value',
					(await stateOf(staleCard)) === 'stale' &&
						(await staleCard.getByRole('button').count()) === 0 &&
						detailsRow(DN.stale).level === 'A1'
				)

				const stepButtons = page.getByRole('button', { name: 'Show steps' })
				for (let index = (await stepButtons.count()) - 1; index >= 0; index -= 1) await stepButtons.nth(index).click()
				check(
					'the step of the details tool names the student and carries no figure',
					(await page.getByText(`Changing ${DN.one}'s details`).count()) > 0
				)

				await page.setViewportSize({ width: 375, height: 812 })
				await page.reload()
				await page.locator(CHANGE).first().waitFor({ timeout: 30000 })
				const rowsBox = await page
					.locator(CHANGE)
					.nth(1)
					.evaluate((node) => {
						const box = node.getBoundingClientRect()
						return { left: box.left, right: box.right }
					})
				const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
				check(
					'at 375 px the details card stays inside the screen and the page does not scroll sideways',
					rowsBox.left >= 0 && rowsBox.right <= 375 && overflow <= 0,
					JSON.stringify({ rowsBox, overflow })
				)
				await page.locator(CHANGE).nth(1).scrollIntoViewIfNeeded()
				await shot(page, 'changes-details', 'phone')
				await page.setViewportSize({ width: 1280, height: 800 })

				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			},
			() => removeDetailsCards(conversations)
		)
	} finally {
		await stopFakeModelApi(started)
		removeDetailsCards(conversations)
	}
}

const NOTES_PORT = 4260
const NN = { add: 'Alex Example 2420', rewrite: 'Alex Example 2421' }
const NOTES_WHERE = `display_name like 'Alex Example 242_' and import_key is null`
const NOTE_BLOCK = '[data-slot="chat-note-change"]'
const NOTE_DECLINED = 'Proposal declined. This proposal made no changes.'
const NOTE_STALE = 'This proposal is out of date. Nothing was changed.'
const CANT_UNDO = "Can't undo: this block changed after the edit."
const ESSAY_WORDS = Array.from({ length: 90 }, (_, index) => `word${index + 1}`).join(' ')

function removeNotesCards(conversations = []) {
	removeConversations(conversations)
	const left = sql(
		`select distinct conversation_id as id from chat_actions where target->>'studentId' in (select id::text from students where ${NOTES_WHERE})`
	).rows.map((row) => row.id)
	removeConversations(left)
	console.log(`fixture cards removed ${removeStudentCards(sql, NOTES_WHERE)}`)
}

const sectionOf = (name, kind) =>
	sql(
		`select id, name, body, revision, deleted_at is not null as deleted from student_sections where kind = ${q(kind)} and student_id in (select id from students where display_name = ${q(name)} and import_key is null)`
	).rows[0]

const sectionByName = (name, blockName) =>
	sql(
		`select id, name, body, revision, deleted_at is not null as deleted from student_sections where name = ${q(blockName)} and student_id in (select id from students where display_name = ${q(name)} and import_key is null)`
	).rows[0]

const setSection = (name, kind, body) =>
	sql(
		`update student_sections set body = ${q(body)}, revision = revision + 1 where kind = ${q(kind)} and student_id in (select id from students where display_name = ${q(name)} and import_key is null)`
	)

const termIds = (name) =>
	sql(
		`select id from student_terms where student_id in (select id from students where display_name = ${q(name)} and import_key is null) order by term`
	).rows.map((row) => row.id)

async function askNote(page, text, mention) {
	const before = await page.locator(NOTE_BLOCK).count()
	await sendIn(page, 0, text, mention)
	await page.waitForFunction(
		({ selector, count }) => document.querySelectorAll(selector).length > count,
		{ selector: NOTE_BLOCK, count: before },
		{ timeout: 30000 }
	)
	await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 30000 })
	return page.locator(NOTE_BLOCK).nth(before)
}

const noteHead = (block) => block.locator('p').first().innerText()
const noteButtons = async (block) => (await block.getByRole('button').allInnerTexts()).map((text) => text.trim())
const noteLines = (block, kind) => block.locator(`[data-slot="note-diff-line"][data-kind="${kind}"]`)
const noteAttr = (block, name) => block.getAttribute(name)

async function sectionNotes() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	const started = await startFakeModelApi(NOTES_PORT)
	const conversations = []
	try {
		removeNotesCards()
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await proposalsPrepare(page, apiOrigin, NOTES_PORT)
				await signIn(page)
				const call = (method, path, body) => formsApi(page, apiOrigin, method, path, body)
				for (const name of Object.values(NN)) {
					const created = await call('POST', '/students', {
						displayName: name,
						rateMinor: 400000,
						currency: 'RUB',
						defaultLessonMinutes: 60,
						parent: null,
						level: null,
						goals: null,
						timeZone: null,
					})
					check(`the fixture card ${name} is created`, created.status === 201, String(created.status))
				}
				await page.goto(`${BASE}/chat`)
				await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				await page.locator('[data-slot="chat-commands"]').waitFor({ timeout: 30000 })
				const centred = await page.evaluate(() => {
					const list = document.querySelector('[data-slot="chat-commands"]').getBoundingClientRect()
					const area = document
						.querySelector('[data-slot="chat-commands"]')
						.closest('[data-slot="scroll-area-viewport"]')
						.getBoundingClientRect()
					return {
						dy: Math.abs((list.top + list.bottom) / 2 - (area.top + area.bottom) / 2),
						dx: Math.abs((list.left + list.right) / 2 - (area.left + area.right) / 2),
					}
				})
				check(
					'the empty new chat shows the commands list centred in the messages area, with no card',
					centred.dy < 40 && centred.dx < 40,
					JSON.stringify(centred)
				)

				let chatId = null
				const track = () => {
					chatId ??= new URL(page.url()).searchParams.get('c')
					if (chatId && !conversations.includes(chatId)) conversations.push(chatId)
				}
				let shown = 0
				const ask = async (text, mention) => {
					const block = await askNote(page, text, mention)
					track()
					shown++
					return block
				}
				const reloaded = async (index) => {
					await page.reload()
					await page
						.locator(NOTE_BLOCK)
						.nth(shown - 1)
						.waitFor({ timeout: 30000 })
					return page.locator(NOTE_BLOCK).nth(index)
				}
				const at = (index) => page.locator(NOTE_BLOCK).nth(index)

				setSection(NN.add, 'goals', 'Line one')
				const goals = sectionOf(NN.add, 'goals')
				const first = await ask(`[fake:note-write] block: ${goals.id}; text: Line one\\nLine two added`, NN.add)
				let text = await first.innerText()
				const firstHref = await first.getByRole('link').first().getAttribute('href')
				check(
					'an added line is written at once: receipt with the sentence, one added line, one unchanged line, Undo and the block link',
					(await noteAttr(first, 'data-mode')) === 'receipt' &&
						(await noteAttr(first, 'data-change')) === 'updated' &&
						(await noteAttr(first, 'data-undo')) === 'available' &&
						/^Updated .+\.$/.test(await noteHead(first)) &&
						(await noteLines(first, 'added').count()) === 1 &&
						(await noteLines(first, 'removed').count()) === 0 &&
						(await noteLines(first, 'same').count()) === 1 &&
						text.includes('Line two added') &&
						text.includes('Added 1 line to the block.') &&
						JSON.stringify(await noteButtons(first)) === JSON.stringify(['Undo']) &&
						/tab=notes/.test(firstHref ?? '') &&
						/section=(goals|b_[0-9a-f]{32})/.test(firstHref ?? ''),
					text.replace(/\n/g, ' | ')
				)
				check('the receipt wrote the block', sectionOf(NN.add, 'goals').body === 'Line one\nLine two added')
				await shot(page, 'changes-notes', 'receipt')
				let again = await reloaded(0)
				check(
					'after a reload the receipt is drawn as the api states it: Undo still available',
					(await noteAttr(again, 'data-undo')) === 'available' &&
						JSON.stringify(await noteButtons(again)) === JSON.stringify(['Undo'])
				)
				await again.getByRole('button', { name: /^Undo/ }).click()
				await page.waitForFunction(
					(selector) => document.querySelector(selector)?.getAttribute('data-undo') === 'undone',
					NOTE_BLOCK,
					{ timeout: 15000 }
				)
				text = await at(0).innerText()
				check(
					'Undo puts the text back and the receipt becomes Change undone. with no diff and no Undo',
					(await noteHead(at(0))) === 'Change undone.' &&
						sectionOf(NN.add, 'goals').body === 'Line one' &&
						(await noteButtons(at(0))).length === 0 &&
						(await at(0).locator('[data-slot="note-diff"]').count()) === 0,
					text.replace(/\n/g, ' | ')
				)
				again = await reloaded(0)
				check(
					'after a reload the undone receipt stays undone with no active button',
					(await noteAttr(again, 'data-undo')) === 'undone' && (await noteButtons(again)).length === 0
				)

				const second = await ask(`[fake:note-write] block: ${goals.id}; text: Line one\\nLine two added`, NN.add)
				check('a second receipt is available', (await noteAttr(second, 'data-undo')) === 'available')
				setSection(NN.add, 'goals', 'Teacher edit')
				await second.getByRole('button', { name: /^Undo/ }).click()
				await second.getByText(CANT_UNDO).waitFor({ timeout: 15000 })
				check(
					'Undo after the block was edited elsewhere says it cannot undo, drops the button and leaves the teacher text',
					(await noteAttr(second, 'data-undo')) === 'unavailable' &&
						(await noteButtons(second)).length === 0 &&
						sectionOf(NN.add, 'goals').body === 'Teacher edit'
				)
				again = await reloaded(1)
				check(
					'after a reload the receipt still says it cannot undo',
					(await noteAttr(again, 'data-undo')) === 'unavailable' && (await again.innerText()).includes(CANT_UNDO)
				)

				const created = await ask(`[fake:note-create] name: Exam dates; text: Exam on 5 March`, NN.add)
				text = await created.innerText()
				check(
					'a new block is written at once: receipt with the quoted name, the no-block-fitted line and a link to the block',
					(await noteAttr(created, 'data-change')) === 'created' &&
						(await noteHead(created)) === 'Created the block “Exam dates”.' &&
						text.includes("No block of Alex Example 2420's notes fitted.") &&
						(await noteLines(created, 'added').count()) === 1 &&
						/section=b_/.test((await created.getByRole('link').first().getAttribute('href')) ?? ''),
					text.replace(/\n/g, ' | ')
				)
				await created.getByRole('button', { name: /^Undo/ }).click()
				await page.waitForFunction(
					(selector) => document.querySelectorAll(selector)[2]?.getAttribute('data-undo') === 'undone',
					NOTE_BLOCK,
					{ timeout: 15000 }
				)
				check(
					'Undo of a created block removes it and the link goes to Notes',
					sectionByName(NN.add, 'Exam dates').deleted === true &&
						(await created.getByRole('link').first().innerText()) === 'Open Notes'
				)

				const added = await ask(`[fake:words-add] terms: alpha, beta`, NN.add)
				text = await added.innerText()
				check(
					'words added at once: receipt with the count, the words as chips and a link to the vocabulary',
					(await noteAttr(added, 'data-change')) === 'words_added' &&
						(await noteHead(added)) === "Added 2 words to Alex Example 2420's vocabulary." &&
						(await added.locator('[data-slot="note-words"] li').allInnerTexts()).join(',') === 'alpha,beta' &&
						(await added.getByRole('link').first().innerText()) === 'Open vocabulary' &&
						/tab=vocabulary/.test((await added.getByRole('link').first().getAttribute('href')) ?? ''),
					text.replace(/\n/g, ' | ')
				)
				const ids = termIds(NN.add)
				const removed = await ask(`[fake:words-remove] ids: ${ids.join(', ')}`, NN.add)
				text = await removed.innerText()
				check(
					'words removed at once: receipt with struck chips, the 30 days line and Undo',
					(await noteAttr(removed, 'data-change')) === 'words_removed' &&
						(await noteHead(removed)) === "Removed 2 words from Alex Example 2420's vocabulary." &&
						(await removed.locator('[data-slot="note-words"] li[data-state="removed"]').count()) === 2 &&
						text.includes('They stay in Removed for 30 days.') &&
						(await noteAttr(removed, 'data-undo')) === 'available',
					text.replace(/\n/g, ' | ')
				)

				setSection(NN.rewrite, 'goals', 'Line one\nLine two')
				const target = sectionOf(NN.rewrite, 'goals')
				const rewriteText = (suffix) => `[fake:note-write] block: ${target.id}; text: Line one\\nLine two ${suffix}`
				const base = shown
				const update = await ask(rewriteText('changed'), NN.rewrite)
				text = await update.innerText()
				check(
					'a rewrite is proposed, not written: Update card with removed and added lines, the caption and Save to notes / Keep the notes',
					(await noteAttr(update, 'data-mode')) === 'proposal' &&
						(await noteAttr(update, 'data-state')) === 'proposed' &&
						/^Update .+\?$/.test(await noteHead(update)) &&
						(await noteLines(update, 'removed').allInnerTexts()).join('|').includes('Line two') &&
						(await noteLines(update, 'added').allInnerTexts()).join('|').includes('Line two changed') &&
						text.includes('Only this block changes. The old text can be restored with Undo after it is saved.') &&
						JSON.stringify(await noteButtons(update)) === JSON.stringify(['Save to notes', 'Keep the notes']) &&
						sectionOf(NN.rewrite, 'goals').body === 'Line one\nLine two',
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-notes', 'update')
				await update.getByRole('button', { name: 'Save to notes' }).click()
				await page.waitForFunction(
					({ selector, index }) => document.querySelectorAll(selector)[index]?.getAttribute('data-state') === 'applied',
					{ selector: NOTE_BLOCK, index: base },
					{ timeout: 15000 }
				)
				check(
					'Save to notes writes the text and the card becomes updated with Undo and Open',
					sectionOf(NN.rewrite, 'goals').body === 'Line one\nLine two changed' &&
						/ updated\.$/.test(await noteHead(update)) &&
						(await noteAttr(update, 'data-undo')) === 'available' &&
						JSON.stringify(await noteButtons(update)) === JSON.stringify(['Undo']) &&
						(await update.getByRole('link').first().innerText()).startsWith('Open ')
				)
				again = await reloaded(base)
				check(
					'after a reload the saved card is applied with only Undo active',
					(await noteAttr(again, 'data-state')) === 'applied' &&
						JSON.stringify(await noteButtons(again)) === JSON.stringify(['Undo'])
				)
				await again.getByRole('button', { name: /^Undo/ }).click()
				await page.waitForFunction(
					({ selector, index }) => document.querySelectorAll(selector)[index]?.getAttribute('data-undo') === 'undone',
					{ selector: NOTE_BLOCK, index: base },
					{ timeout: 15000 }
				)
				check(
					'Undo of the saved rewrite restores the old text',
					sectionOf(NN.rewrite, 'goals').body === 'Line one\nLine two' &&
						(await noteHead(at(base))) === 'Change undone.'
				)

				const keep = await ask(rewriteText('kept'), NN.rewrite)
				await keep.getByRole('button', { name: 'Keep the notes' }).click()
				await keep.getByText(NOTE_DECLINED).waitFor({ timeout: 15000 })
				check(
					'Keep the notes declines: dimmed diff, the declined line, no buttons and no write',
					(await noteAttr(keep, 'data-state')) === 'declined' &&
						(await noteButtons(keep)).length === 0 &&
						sectionOf(NN.rewrite, 'goals').body === 'Line one\nLine two'
				)
				again = await reloaded(base + 1)
				check(
					'after a reload the declined card has no active buttons',
					(await noteAttr(again, 'data-state')) === 'declined' && (await noteButtons(again)).length === 0
				)

				const stale = await ask(rewriteText('stale'), NN.rewrite)
				setSection(NN.rewrite, 'goals', 'Teacher text')
				await stale.getByRole('button', { name: 'Save to notes' }).click()
				await page.getByText(NOTE_STALE).waitFor({ timeout: 15000 })
				const staleCard = page.locator(NOTE_BLOCK).nth(base + 2)
				check(
					'a block edited after the proposal makes it stale: warning, no buttons, the teacher text kept',
					(await noteAttr(staleCard, 'data-state')) === 'stale' &&
						(await noteButtons(staleCard)).length === 0 &&
						sectionOf(NN.rewrite, 'goals').body === 'Teacher text'
				)
				again = await reloaded(base + 2)
				check(
					'after a reload the stale card stays stale with no buttons',
					(await noteAttr(again, 'data-state')) === 'stale' && (await noteButtons(again)).length === 0
				)

				await ask(`[fake:note-create] name: Exam dates; text: Exam on 5 March`, NN.rewrite)
				const exam = sectionByName(NN.rewrite, 'Exam dates')
				const del = await ask(`[fake:note-delete] block: ${exam.id}`, NN.rewrite)
				text = await del.innerText()
				check(
					'a block with text is not deleted at once: Delete card with the text as removed lines, Keep block first',
					(await noteAttr(del, 'data-state')) === 'proposed' &&
						(await noteHead(del)) === 'Delete Exam dates?' &&
						(await noteLines(del, 'removed').count()) === 1 &&
						text.includes('The block and its text will be deleted.') &&
						JSON.stringify(await noteButtons(del)) === JSON.stringify(['Keep block', 'Delete block']) &&
						sectionByName(NN.rewrite, 'Exam dates').deleted === false,
					text.replace(/\n/g, ' | ')
				)
				await shot(page, 'changes-notes', 'delete')
				const deleteIndex = base + 4
				await del.getByRole('button', { name: 'Delete block' }).click()
				await page.waitForFunction(
					({ selector, index }) => document.querySelectorAll(selector)[index]?.getAttribute('data-state') === 'applied',
					{ selector: NOTE_BLOCK, index: deleteIndex },
					{ timeout: 15000 }
				)
				check(
					'Delete block removes the block and the card says deleted with Undo and Open Notes',
					sectionByName(NN.rewrite, 'Exam dates').deleted === true &&
						(await noteHead(del)) === 'Exam dates deleted.' &&
						(await del.getByRole('link').first().innerText()) === 'Open Notes' &&
						(await noteAttr(del, 'data-undo')) === 'available'
				)
				again = await reloaded(deleteIndex)
				check(
					'after a reload the deleted card is applied with only Undo active',
					(await noteAttr(again, 'data-state')) === 'applied' &&
						JSON.stringify(await noteButtons(again)) === JSON.stringify(['Undo'])
				)
				await again.getByRole('button', { name: /^Undo/ }).click()
				await page.waitForFunction(
					({ selector, index }) => document.querySelectorAll(selector)[index]?.getAttribute('data-undo') === 'undone',
					{ selector: NOTE_BLOCK, index: deleteIndex },
					{ timeout: 15000 }
				)
				check('Undo of the deletion brings the block back', sectionByName(NN.rewrite, 'Exam dates').deleted === false)

				const lines = (prefix) => Array.from({ length: 8 }, (_, index) => `${prefix}${index + 1}`)
				setSection(NN.rewrite, 'general_info', lines('old').join('\n'))
				const wide = sectionOf(NN.rewrite, 'general_info')
				const many = await ask(`[fake:note-write] block: ${wide.id}; text: ${lines('new').join('\\n')}`, NN.rewrite)
				const changed = (await noteLines(many, 'added').count()) + (await noteLines(many, 'removed').count())
				const moreText = await many.locator('[data-slot="note-diff-more"]').innerText()
				check(
					'a long rewrite draws at most six changed lines and then says how many more changes there are',
					changed <= 6 && /^\d+ more changes?$/.test(moreText.trim()),
					JSON.stringify({ changed, moreText })
				)

				await page.setViewportSize({ width: 375, height: 812 })
				await page.reload()
				await page
					.locator(NOTE_BLOCK)
					.nth(shown - 1)
					.waitFor({ timeout: 30000 })
				const fits = await page.evaluate((selector) => {
					const boxes = [...document.querySelectorAll(selector)].map((node) => {
						const box = node.getBoundingClientRect()
						return { left: Math.round(box.left), right: Math.round(box.right) }
					})
					return {
						count: boxes.length,
						bad: boxes.filter((box) => box.left < 0 || box.right > 375).length,
						overflow: document.documentElement.scrollWidth - window.innerWidth,
					}
				}, NOTE_BLOCK)
				check(
					'at 375 px every note card stays inside the screen and the page does not scroll sideways',
					fits.count > 0 && fits.bad === 0 && fits.overflow <= 0,
					JSON.stringify(fits)
				)
				await page.setViewportSize({ width: 1280, height: 800 })

				await page.getByRole('button', { name: 'New chat', exact: true }).click()
				await page.locator('[data-slot="chat-commands"]').waitFor({ timeout: 30000 })
				await page.locator(FIELD).fill(`/essay [fake:essay] ${ESSAY_WORDS}`)
				await page.locator(SEND).click()
				await page.locator('[data-role="teacher"]').first().waitFor({ timeout: 30000 })
				track()
				await page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 30000 })
				const bubble = page.locator('[data-role="teacher"] [data-slot="chat-essay-bubble"]').first()
				await bubble.waitFor({ timeout: 15000 })
				const essayHeight = await bubble
					.locator('p')
					.first()
					.evaluate((node) => ({
						box: node.getBoundingClientRect().height,
						line: Number.parseFloat(getComputedStyle(node).lineHeight),
					}))
				const wordsNow = (await bubble.innerText()).match(/(\d+) words/)?.[1]
				check(
					'a pasted essay in the teacher bubble is cut to four lines with its word count and Show full text',
					(await noteAttr(bubble, 'data-clamped')) === 'true' &&
						Math.abs(essayHeight.box - essayHeight.line * 4) < 4 &&
						Number(wordsNow) === ESSAY_WORDS.split(' ').length + 1 &&
						(await bubble.getByRole('button', { name: 'Show full text' }).count()) === 1,
					JSON.stringify({ essayHeight, wordsNow })
				)
				await shot(page, 'changes-notes', 'essay')
				const bottomGap = await page.evaluate(() => {
					const viewport = document
						.querySelector('[data-slot="chat-messages"]')
						.closest('[data-slot="scroll-area-viewport"]')
						.getBoundingClientRect()
					const list = document.querySelector('[data-slot="chat-messages"]').getBoundingClientRect()
					return Math.round(viewport.bottom - list.bottom)
				})
				check(
					'a short conversation sits against the composer, not at the top of the area',
					bottomGap < 60,
					String(bottomGap)
				)
				await bubble.getByRole('button', { name: 'Show full text' }).click()
				check(
					'Show full text opens the essay in place once',
					(await bubble.getByRole('button', { name: 'Show full text' }).count()) === 0 &&
						(await bubble
							.locator('p')
							.first()
							.evaluate((node) => node.getBoundingClientRect().height)) >
							essayHeight.box + 10
				)

				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			},
			() => removeNotesCards(conversations)
		)
	} finally {
		await stopFakeModelApi(started)
		removeNotesCards(conversations)
	}
}

const REVIEW_PORT = 4261
const RV = {
	no: 'Alex Example 2430',
	yes: 'Alex Example 2431',
	pending: 'Alex Example 2432',
	variants: 'Alex Example 2433',
	stamp: 'Alex Example 2434',
	running: 'Alex Example 2435',
}
const REVIEW_WHERE = `display_name like 'Alex Example 243_' and import_key is null`
const OFFER = '[data-slot="chat-review"][data-state="offer"]'
const RESULT = '[data-slot="chat-review"][data-state="result"]'
const FAILED = '[data-slot="chat-review"][data-state="failed"]'
const TEACHER = '[data-role="teacher"]'
const DUPLICATED = 'Line one\nLine one\nLine two'
const DEDUPED = 'Line one\nLine two'
const REVIEW_CANT_UNDO = "Can't undo: a block changed after the review."
const REVIEW_UNDONE = 'Changes undone. The notes are as they were before the review.'
const REVIEW_DAY = /[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}/

function removeReviewCards(conversations = []) {
	const cards = `select id from students where ${REVIEW_WHERE}`
	sql(`delete from note_reviews where student_id in (${cards})`)
	removeConversations(conversations)
	const left = sql(
		`select distinct conversation_id as id from chat_actions where target->>'studentId' in (select id::text from students where ${REVIEW_WHERE})`
	).rows.map((row) => row.id)
	const mentioned = sql(
		`select distinct m.conversation_id as id from chat_messages m join students s on position(s.id::text in m.mentions::text) > 0 where s.display_name like 'Alex Example 243_' and s.import_key is null`
	).rows.map((row) => row.id)
	removeConversations([...new Set([...left, ...mentioned])])
	console.log(`fixture cards removed ${removeStudentCards(sql, REVIEW_WHERE)}`)
}

async function sendReview(page, name, tail = '') {
	const field = page.locator(FIELD)
	await field.waitFor({ timeout: 30000 })
	await field.click()
	await page.keyboard.type('/review ')
	await page.keyboard.type(`@${name}`)
	await page.locator(POPUP).waitFor({ timeout: 15000 })
	await page.keyboard.press('Enter')
	await page.locator(POPUP).waitFor({ state: 'detached', timeout: 5000 })
	if (tail !== '') await page.keyboard.type(tail)
	await page.locator(SEND).click()
}

async function sectionReview() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	const started = await startFakeModelApi(REVIEW_PORT)
	const conversations = []
	try {
		removeReviewCards()
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await proposalsPrepare(page, apiOrigin, REVIEW_PORT)
				await signIn(page)
				const call = (method, path, body) => formsApi(page, apiOrigin, method, path, body)
				const ids = {}
				for (const [key, name] of Object.entries(RV)) {
					const created = await call('POST', '/students', {
						displayName: name,
						rateMinor: 400000,
						currency: 'RUB',
						defaultLessonMinutes: 60,
						parent: null,
						level: null,
						goals: null,
						timeZone: null,
					})
					check(`the fixture card ${name} is created`, created.status === 201, String(created.status))
					ids[key] = created.json.student.id
				}
				const track = () => {
					const id = new URL(page.url()).searchParams.get('c')
					if (id && !conversations.includes(id)) conversations.push(id)
				}
				const newChat = async () => {
					await page.goto(`${BASE}/chat?new=1`)
					await page.locator('[data-slot="chat-commands"]').waitFor({ timeout: 30000 })
				}
				const count = (selector) => page.locator(selector).count()
				const messages = () => count('[data-message-id]')
				const idle = () => page.locator('[data-slot="chat-stop"]').waitFor({ state: 'detached', timeout: 30000 })
				const askAbout = async (key) => {
					setSection(RV[key], 'goals', 'Line one')
					const goals = sectionOf(RV[key], 'goals')
					await newChat()
					await askNote(page, `[fake:note-write] block: ${goals.id}; text: Line one\\nLine one\\nLine two`, RV[key])
					track()
					await page.locator(OFFER).waitFor({ timeout: 20000 })
					return page.locator(OFFER)
				}
				const reviewed = async (selector, total) => {
					await page.reload()
					await page.locator(selector).first().waitFor({ timeout: 30000 })
					return total === undefined ? null : count(selector)
				}

				const noOffer = await askAbout('no')
				const never = await noOffer.innerText()
				const apart = await page.evaluate(() => {
					const offer = document.querySelector('[data-slot="chat-review"][data-state="offer"]')?.closest('li')
					const receipt = document.querySelector('[data-slot="chat-note-change"]')?.closest('li')
					return offer !== null && receipt !== null && offer !== receipt
				})
				check(
					'after a turn about the notes the question is a message of its own: never reviewed, Yes and No',
					apart &&
						never.includes(`${RV.no}'s notes and vocabulary have never been reviewed. Run a review?`) &&
						(await noOffer.getByRole('button', { name: 'Yes', exact: true }).isVisible()) &&
						(await noOffer.getByRole('button', { name: 'No', exact: true }).isVisible()),
					never
				)
				await shot(page, 'changes-review', 'offer')
				const before = await messages()
				await noOffer.getByRole('button', { name: 'No', exact: true }).click()
				await page.locator(OFFER).waitFor({ state: 'detached', timeout: 15000 })
				check(
					'No takes the question away without a trace: no message of its own is left',
					(await messages()) === before - 1 && (await count(TEACHER)) === 1
				)
				await reviewed('[data-slot="chat-note-change"]')
				check(
					'after a reload the answered No does not come back',
					(await count(OFFER)) === 0 && (await messages()) === before - 1
				)

				const yesOffer = await askAbout('yes')
				await yesOffer.getByRole('button', { name: 'Yes', exact: true }).click()
				await page.locator(RESULT).waitFor({ timeout: 40000 })
				await idle()
				track()
				const teacher = await page.locator(TEACHER).allInnerTexts()
				check(
					'Yes takes the question away and sends the review command with the student',
					(await count(OFFER)) === 0 && teacher.some((text) => text.includes('/review') && text.includes(RV.yes)),
					teacher.join(' | ')
				)
				const result = page.locator(RESULT)
				const body = await result.innerText()
				const links = await result
					.getByRole('link')
					.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))
				const last = await page.evaluate(() => {
					const items = [...document.querySelectorAll('[data-slot="chat-messages"] > li')]
					return items.at(-1)?.querySelector('[data-slot="chat-review"][data-state="result"]') !== null
				})
				check(
					'the result names the student with the day, has the three sections, a block link and Undo changes, and is the last message',
					body.includes('Review finished') &&
						new RegExp(`${RV.yes}'s notes and vocabulary · ${REVIEW_DAY.source}`).test(body) &&
						body.includes('Fixed') &&
						body.includes('Found and left as it is') &&
						body.includes('Needs your decision') &&
						links.some((href) => href?.startsWith(`/students/${ids.yes}?tab=notes&section=`)) &&
						(await result.getByRole('button', { name: 'Undo changes' }).isVisible()) &&
						last,
					body
				)
				check('the review wrote the block once', sectionOf(RV.yes, 'goals').body === DEDUPED)
				const progress = page.locator('li', { has: page.locator(RESULT) }).locator('[data-slot="chat-progress"]')
				await progress.getByRole('button', { name: /Show steps/ }).click()
				const steps = await progress.innerText()
				check(
					'the review steps are named by the design',
					steps.includes(`Reading ${RV.yes}'s notes and vocabulary`) &&
						steps.includes('Looking for duplicates and conflicts'),
					steps
				)
				await shot(page, 'changes-review', 'result')

				await page.setViewportSize({ width: 375, height: 800 })
				const narrow = await page.evaluate(() => ({
					overflow: document.documentElement.scrollWidth - window.innerWidth,
					right: document.querySelector('[data-slot="chat-review"][data-state="result"]').getBoundingClientRect().right,
				}))
				check(
					'at 375 px the result stays inside the screen',
					narrow.overflow <= 0 && narrow.right <= 375,
					JSON.stringify(narrow)
				)
				await page.setViewportSize({ width: 1280, height: 800 })

				await reviewed(RESULT)
				check(
					'after a reload the answered question does not come back and the result keeps Undo changes',
					(await count(OFFER)) === 0 &&
						(await page.locator(RESULT).getByRole('button', { name: 'Undo changes' }).isVisible())
				)
				await page.locator(RESULT).getByRole('button', { name: 'Undo changes' }).click()
				await page.getByText(REVIEW_UNDONE).waitFor({ timeout: 30000 })
				check(
					'Undo changes puts the block back and leaves the mark of the rollback without the button',
					sectionOf(RV.yes, 'goals').body === DUPLICATED &&
						(await page.locator(RESULT).getByRole('button', { name: 'Undo changes' }).count()) === 0
				)
				await reviewed(RESULT)
				check(
					'after a reload the rollback mark stays and Undo changes is not offered again',
					(await page.getByText(REVIEW_UNDONE).count()) === 1 &&
						(await page.getByRole('button', { name: 'Undo changes' }).count()) === 0
				)

				await askAbout('pending')
				await page.reload()
				await page.locator(OFFER).waitFor({ timeout: 30000 })
				check(
					'an unanswered question survives a reload with Yes and No',
					(await page.locator(OFFER).getByRole('button', { name: 'Yes', exact: true }).isVisible()) &&
						(await page.locator(OFFER).getByRole('button', { name: 'No', exact: true }).isVisible())
				)
				const assistants = await count('[data-role="assistant"]')
				await page.locator(FIELD).click()
				await page.keyboard.type('hello')
				await page.locator(SEND).click()
				await page.waitForFunction(
					(total) => document.querySelectorAll('[data-role="assistant"]').length > total,
					assistants,
					{ timeout: 30000 }
				)
				await idle()
				check('a new message does not remove the waiting question', (await count(OFFER)) === 1)

				setSection(RV.variants, 'goals', DUPLICATED)
				await newChat()
				await sendReview(page, RV.variants, ' [fake:review-clean]')
				await page.locator(RESULT).waitFor({ timeout: 40000 })
				await idle()
				track()
				const clean = await page.locator(RESULT).last().innerText()
				check(
					'a review with nothing to fix says so, names the student and has no Undo',
					clean.includes(`Nothing to fix. ${RV.variants}'s notes and vocabulary are consistent.`) &&
						REVIEW_DAY.test(clean) &&
						(await page.getByRole('button', { name: 'Undo changes' }).count()) === 0,
					clean
				)
				await sendReview(page, RV.variants, ' [fake:review-questions]')
				await page.waitForFunction(
					(total) => document.querySelectorAll('[data-slot="chat-review"][data-state="result"]').length > total,
					1,
					{
						timeout: 40000,
					}
				)
				await idle()
				const questions = await page.locator(RESULT).last().innerText()
				check(
					'a review with only questions shows Needs your decision with a block link and no Undo',
					questions.includes('Needs your decision') &&
						!questions.includes('Fixed') &&
						(await page
							.locator(RESULT)
							.last()
							.getByRole('link', { name: /^Open / })
							.count()) === 1 &&
						(await page.getByRole('button', { name: 'Undo changes' }).count()) === 0,
					questions
				)
				const asked = await count(TEACHER)
				await sendReview(page, RV.variants, ' [fake:review-skip]')
				await page.locator(FAILED).waitFor({ timeout: 40000 })
				await idle()
				const failed = await page.locator(FAILED).innerText()
				check(
					'a turn that ended without a result says the review did not finish and offers Run again',
					failed.includes('The review did not finish. Nothing was changed.') &&
						failed.includes(`${RV.variants}'s notes are as they were.`) &&
						(await page.locator(FAILED).getByRole('button', { name: 'Run again' }).isVisible()) &&
						(await count(RESULT)) === 2,
					failed
				)
				await page.locator(FAILED).getByRole('button', { name: 'Run again' }).click()
				await page.waitForFunction(
					(total) => document.querySelectorAll('[data-slot="chat-review"][data-state="result"]').length > total,
					2,
					{
						timeout: 40000,
					}
				)
				await idle()
				check(
					'Run again sends the review command once more',
					(await count(TEACHER)) === asked + 2 && sectionOf(RV.variants, 'goals').body === DEDUPED
				)
				setSection(RV.variants, 'goals', 'Teacher edit')
				await page.locator(RESULT).last().getByRole('button', { name: 'Undo changes' }).click()
				await page.getByText(REVIEW_CANT_UNDO).waitFor({ timeout: 30000 })
				check(
					'after a block changed Undo changes is gone with the explanation and the teacher text stays',
					(await page.locator(RESULT).last().getByRole('button', { name: 'Undo changes' }).count()) === 0 &&
						sectionOf(RV.variants, 'goals').body === 'Teacher edit'
				)

				setSection(RV.stamp, 'goals', DUPLICATED)
				await page.goto(`${BASE}/students/${ids.stamp}?tab=notes`)
				const stamp = page.locator('[data-slot="review-stamp"]')
				await stamp.waitFor({ timeout: 30000 })
				const now = page.locator('[data-slot="review-now"]')
				check(
					'the Notes stamp offers Review now beside Never reviewed',
					(await stamp.innerText()).includes('Never reviewed') &&
						(await now.getAttribute('href')) === `/chat?new=1&student=${ids.stamp}&review=1`
				)
				await now.click()
				await page.locator(RESULT).waitFor({ timeout: 60000 })
				await idle()
				track()
				const arrival = new URL(page.url())
				check(
					'Review now opens a chat with the review already running, without the question, and drops the parameter',
					arrival.pathname === '/chat' &&
						!arrival.searchParams.has('review') &&
						(await count(TEACHER)) === 1 &&
						(await count(OFFER)) === 0 &&
						sectionOf(RV.stamp, 'goals').body === DEDUPED,
					page.url()
				)
				await reviewed(RESULT)
				check('after a reload no second review starts', (await count(TEACHER)) === 1 && (await count(RESULT)) === 1)
				await page.goto(`${BASE}/students/${ids.stamp}?tab=vocabulary`)
				await stamp.waitFor({ timeout: 30000 })
				check(
					'the Vocabulary tab shows the same stamp with the new date and Review now',
					(await stamp.innerText()).includes('Reviewed today') &&
						(await page.locator('[data-slot="review-now"]').isVisible())
				)

				const made = await call('POST', '/chat/conversations')
				const conversationId = made.json.conversation.id
				conversations.push(conversationId)
				const text = `/review @${RV.running} [fake:review-hang]`
				const start = '/review @'.length
				const sent = await call('POST', `/chat/conversations/${conversationId}/messages`, {
					requestId: randomUUID(),
					text,
					mentions: [{ studentId: ids.running, text: RV.running, start, end: start + RV.running.length }],
				})
				check(
					'the long review is started through the chat',
					sent.status === 200 || sent.status === 201,
					String(sent.status)
				)
				await page.goto(`${BASE}/students/${ids.running}?tab=notes`)
				await stamp.waitFor({ timeout: 30000 })
				await page.getByText('Review in progress').waitFor({ timeout: 30000 })
				const open = page.locator('[data-slot="review-open-chat"]')
				check(
					'while the review runs the Notes stamp says Review in progress with Open chat in place of Review now',
					(await open.getAttribute('href')) === `/chat?c=${conversationId}` &&
						(await page.locator('[data-slot="review-now"]').count()) === 0
				)
				await shot(page, 'changes-review', 'running')
				await page.goto(`${BASE}/students/${ids.running}?tab=vocabulary`)
				await page.getByText('Review in progress').waitFor({ timeout: 30000 })
				check(
					'the Vocabulary tab shows the same state',
					(await page.locator('[data-slot="review-open-chat"]').isVisible()) &&
						(await page.locator('[data-slot="review-now"]').count()) === 0
				)
				const stopped = await call('POST', `/chat/turns/${sent.json.turn.id}/stop`, {})
				check('the long review is stopped', stopped.status === 200, String(stopped.status))
				await page.locator('[data-slot="review-now"]').waitFor({ timeout: 20000 })
				check(
					'when the review ends the stamp comes back by itself with Review now and the old date',
					(await stamp.innerText()).includes('Never reviewed')
				)
				await page.goto(`${BASE}/chat?c=${conversationId}`)
				await page.locator(FAILED).waitFor({ timeout: 30000 })
				check(
					'a stopped review shows the did not finish message with Run again',
					(await page.locator(FAILED).getByRole('button', { name: 'Run again' }).isVisible()) &&
						(await count(RESULT)) === 0
				)

				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			},
			() => removeReviewCards(conversations)
		)
	} finally {
		await stopFakeModelApi(started)
		removeReviewCards(conversations)
	}
}

const PROMPT_BLOCK = (command) => `[data-slot="command-prompt"][data-command="${command}"]`
const PROMPT_ACCOUNTS = `select id from accounts where role = 'teacher'`
const PROMPTS_NOISE = EXPECTED_NOISE

function removePrompts() {
	const result = sql(`delete from chat_command_prompts where account_id in (${PROMPT_ACCOUNTS})`)
	console.log(`fixture prompts removed ${result.rowCount}`)
}

const promptRows = () =>
	sql(
		`select command, body, revision from chat_command_prompts where account_id in (${PROMPT_ACCOUNTS}) order by command`
	).rows

async function sectionPrompts() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	try {
		removePrompts()
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await setTheme(page)
				await signIn(page)
				const call = (method, path, body) => formsApi(page, apiOrigin, method, path, body)
				const listed = await call('GET', '/settings/assistant/prompts')
				const defaults = Object.fromEntries(listed.json.prompts.map((item) => [item.command, item.defaultBody]))
				await page.goto(`${BASE}/settings?tab=assistant`)
				const recap = page.locator(PROMPT_BLOCK('/recap'))
				const essay = page.locator(PROMPT_BLOCK('/essay'))
				await recap.waitFor({ timeout: 30000 })
				const field = recap.locator('textarea')
				const badge = (block) => block.getAttribute('data-badge')
				const buttons = async (block) => ({
					restore: await block.getByRole('button', { name: 'Restore default' }).isDisabled(),
					discard: await block.getByRole('button', { name: 'Discard' }).isDisabled(),
					save: await block.getByRole('button', { name: 'Save', exact: true }).isDisabled(),
				})

				check(
					'the Assistant tab lists Command prompts after Budget and Privacy last',
					await page.evaluate(() => {
						const titles = [...document.querySelectorAll('h2')].map((node) => node.textContent?.trim())
						return (
							titles.indexOf('Budget') >= 0 &&
							titles.indexOf('Command prompts') === titles.indexOf('Budget') + 1 &&
							titles.indexOf('Privacy') === titles.indexOf('Command prompts') + 1 &&
							titles.at(-1) === 'Privacy'
						)
					})
				)
				const noteShown = await page.getByText('Only the wording is edited here.').first().isVisible()
				check('the card says that only the wording is edited', noteShown)
				check(
					'nothing saved: both commands read Default with Restore default, Discard and Save off',
					(await badge(recap)) === 'Default' &&
						(await badge(essay)) === 'Default' &&
						JSON.stringify(await buttons(recap)) === JSON.stringify({ restore: true, discard: true, save: true }) &&
						(await field.inputValue()) === defaults['/recap'] &&
						(await recap.locator('[data-slot="prompt-counter"]').innerText()).endsWith(' / 8,000') &&
						(await recap.locator(`#settings-prompt-recap-status`).innerText()) === 'Saved to your account.'
				)
				const privacy = page.getByText('sends them to the model provider with your question.')
				check(
					'the Privacy line states that event titles go to the model provider',
					(await privacy.isVisible()) &&
						(await page.getByText('What leaves the app when you use the assistant.').isVisible())
				)

				await field.fill(`${defaults['/recap']} Answer in Russian.`)
				check(
					'typing marks the command Edited, shows Unsaved changes and turns Discard and Save on',
					(await badge(recap)) === 'Edited' &&
						(await recap.locator(`#settings-prompt-recap-status`).innerText()) === 'Unsaved changes' &&
						JSON.stringify(await buttons(recap)) === JSON.stringify({ restore: false, discard: false, save: false }) &&
						(await badge(essay)) === 'Default'
				)
				await shot(page, 'changes-prompts', 'edited')
				await recap.getByRole('button', { name: 'Discard' }).click()
				check(
					'Discard puts the saved text back',
					(await field.inputValue()) === defaults['/recap'] && (await badge(recap)) === 'Default'
				)

				await field.fill('')
				check(
					'an empty prompt shows the sentence and keeps Save off, Discard and Restore default on',
					(await recap.locator(`#settings-prompt-recap-status`).innerText()) === 'The prompt cannot be empty.' &&
						(await field.getAttribute('aria-invalid')) === 'true' &&
						JSON.stringify(await buttons(recap)) === JSON.stringify({ restore: false, discard: false, save: true })
				)
				await field.fill('x'.repeat(8001))
				check(
					'a prompt over the limit shows how far over it is and keeps Save off',
					(await recap.locator(`#settings-prompt-recap-status`).innerText()) ===
						'The prompt is 1 character over the 8,000 limit.' &&
						(await recap.locator('[data-slot="prompt-counter"]').innerText()) === '8,001 / 8,000' &&
						(await buttons(recap)).save === true
				)
				await recap.getByRole('button', { name: 'Discard' }).click()

				const custom = 'Summarise the lessons in three sentences. Answer in Russian.'
				await field.fill(custom)
				await recap.getByRole('button', { name: 'Save', exact: true }).click()
				await page.getByText('/recap prompt saved.').waitFor({ timeout: 15000 })
				const stored = promptRows().find((row) => row.command === '/recap')
				check(
					'Save writes the text with revision 1, the badge reads Customised and the buttons turn off',
					stored?.body === custom &&
						Number(stored.revision) === 1 &&
						(await badge(recap)) === 'Customised' &&
						JSON.stringify(await buttons(recap)) === JSON.stringify({ restore: false, discard: true, save: true }) &&
						(await recap.locator(`#settings-prompt-recap-status`).innerText()) === 'Saved to your account.' &&
						(await badge(essay)) === 'Default'
				)
				await shot(page, 'changes-prompts', 'customised')

				await recap.getByRole('button', { name: 'Restore default' }).click()
				check(
					'Restore default puts the default text in the field without saving',
					(await field.inputValue()) === defaults['/recap'] &&
						(await badge(recap)) === 'Edited' &&
						(await recap.locator(`#settings-prompt-recap-status`).innerText()) ===
							'Default text restored. Save to use it.' &&
						promptRows().find((row) => row.command === '/recap')?.body === custom &&
						(await buttons(recap)).restore === true
				)
				await recap.getByRole('button', { name: 'Save', exact: true }).click()
				await page.waitForFunction(
					(selector) => document.querySelector(selector)?.getAttribute('data-badge') === 'Default',
					PROMPT_BLOCK('/recap'),
					{ timeout: 15000 }
				)
				const reset = promptRows().find((row) => row.command === '/recap')
				check(
					'Save of the default text stores no text, bumps the revision and the badge reads Default again',
					reset?.body === null && Number(reset.revision) === 2
				)

				await field.fill('Draft from this tab.')
				const rival = await call('PUT', '/settings/assistant/prompts/recap', {
					body: 'Written in another tab.',
					expectedRevision: 2,
				})
				check('the other tab saves its text', rival.status === 200, String(rival.status))
				await recap.getByRole('button', { name: 'Save', exact: true }).click()
				await recap.getByRole('button', { name: 'Reload prompt' }).waitFor({ timeout: 15000 })
				check(
					'a competing edit keeps the draft, says the prompt changed elsewhere and turns Save off',
					(await field.inputValue()) === 'Draft from this tab.' &&
						(await recap.getByText('This prompt changed elsewhere.').isVisible()) &&
						(await buttons(recap)).save === true &&
						promptRows().find((row) => row.command === '/recap')?.body === 'Written in another tab.'
				)
				await shot(page, 'changes-prompts', 'conflict')
				await recap.getByRole('button', { name: 'Reload prompt' }).click()
				await recap.getByRole('button', { name: 'Reload prompt' }).waitFor({ state: 'detached', timeout: 15000 })
				check(
					'Reload prompt shows the saved text and clears the row',
					(await field.inputValue()) === 'Written in another tab.' && (await badge(recap)) === 'Customised'
				)

				await essay.locator('textarea').fill('Review the essay briefly.')
				await essay.getByRole('button', { name: 'Save', exact: true }).click()
				await page.getByText('/essay prompt saved.').waitFor({ timeout: 15000 })
				check(
					'each command saves by itself',
					promptRows().find((row) => row.command === '/essay')?.body === 'Review the essay briefly.' &&
						promptRows().find((row) => row.command === '/recap')?.body === 'Written in another tab.'
				)

				await page.goto(`${BASE}/settings?tab=calendar`)
				await page.getByRole('tab', { name: 'Google Calendar' }).waitFor({ timeout: 30000 })
				check('the Google Calendar tab does not repeat the privacy line', !(await privacy.isVisible()))

				await page.setViewportSize({ width: 375, height: 812 })
				await page.goto(`${BASE}/settings?tab=assistant`)
				await recap.waitFor({ timeout: 30000 })
				await recap.locator('textarea').fill('Narrow check.')
				const narrow = await page.evaluate((selector) => {
					const block = document.querySelector(selector)
					const box = block.getBoundingClientRect()
					const area = block.querySelector('textarea').getBoundingClientRect()
					return {
						left: box.left,
						right: box.right,
						areaHeight: Math.round(area.height),
						overflow: document.documentElement.scrollWidth - window.innerWidth,
					}
				}, PROMPT_BLOCK('/recap'))
				check(
					'at 375 px the block stays inside the screen, the field is 168 px tall and the page does not scroll sideways',
					narrow.left >= 0 && narrow.right <= 375 && narrow.areaHeight === 168 && narrow.overflow <= 0,
					JSON.stringify(narrow)
				)
				await shot(page, 'changes-prompts', 'phone')
				await page.setViewportSize({ width: 1280, height: 800 })

				const unexpected = problems.filter((line) => !PROMPTS_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			},
			() => removePrompts()
		)
	} finally {
		removePrompts()
	}
}

const CALENDAR_PORT = 4257
const CALENDAR_EVENTS = '[data-slot="chat-calendar-events"]'
const CALENDAR_GROUP = '[data-slot="chat-calendar-group"]'
const CALENDAR_COPY = '[data-slot="chat-calendar-copy"]'
const WITHHELD = 'Could not verify this answer from the available records.'

async function sectionCalendar() {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch(`${BASE}/api/healthz`).catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer through the web proxy: this section needs the dev stack')
	process.env.CHAT_FAKE_EVENTS = '1'
	const started = await startFakeModelApi(CALENDAR_PORT)
	const conversations = []
	const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
	const period = readBudget(teacher)
	try {
		await withBrowser(
			{ width: 1440, height: 900 },
			async ({ page, problems }) => {
				await proposalsPrepare(page, apiOrigin, CALENDAR_PORT)
				await page.addInitScript(() => {
					window.__copied = []
					Object.defineProperty(navigator, 'clipboard', {
						configurable: true,
						value: {
							writeText: async (text) => {
								window.__copied.push(text)
							},
							readText: async () => '',
						},
					})
				})
				await signIn(page)
				await newChat(page)
				await finishTurn(page, '[fake:calendar] find all events with Екатерина this summer')
				const id = new URL(page.url()).searchParams.get('c')
				if (id) conversations.push(id)
				const blocks = page.locator(CALENDAR_EVENTS)
				await blocks.first().waitFor({ timeout: 15000 })
				const first = blocks.first()
				const labels = await first.locator(`${CALENDAR_GROUP} p.font-semibold`).allInnerTexts()
				check(
					'the search shows one block with the Екатерина and Yekaterina groups and no Яна',
					(await blocks.count()) === 1 &&
						labels.join('|') === 'Екатерина|Yekaterina' &&
						!(await first.innerText()).includes('Яна'),
					JSON.stringify(labels)
				)
				check('each group has its own Copy dates button', (await first.locator(CALENDAR_COPY).count()) === 2)
				await first.locator(CALENDAR_COPY).nth(0).click()
				await first.locator(CALENDAR_COPY).nth(1).click()
				const copied = await page.evaluate(() => window.__copied)
				check(
					'Copy dates copies the Count lessons format per group',
					copied.join('||') === '3, 10 - June||8, 15 - July',
					JSON.stringify(copied)
				)
				const answer = page.locator(ASSISTANT).last()
				check(
					'the answer with dates, an end time and a title with digits is published',
					(await answer.innerText()).includes('Yekaterina IELTS 7.5 runs 10:00–11:30') &&
						(await page.getByText(WITHHELD).count()) === 0,
					(await answer.innerText()).slice(0, 300)
				)
				await first.getByRole('button', { name: 'Show times and titles' }).first().click()
				await page.waitForTimeout(400)
				const rows = first.locator(CALENDAR_GROUP).first().locator('li')
				const listHeight = await rows.first().evaluate((node) => node.parentElement.getBoundingClientRect().height)
				check(
					'the opened group lists the date, time and title of each event',
					(await rows.count()) === 2 && listHeight > 20 && (await rows.first().innerText()).includes('18:00'),
					String(listHeight)
				)
				await shot(page, 'changes-calendar', 'groups')

				await finishTurn(page, '[fake:calendar-merge] объедини их одним списком')
				await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 2, CALENDAR_EVENTS, {
					timeout: 15000,
				})
				const merged = blocks.nth(1)
				check(
					'the merge request shows one group with all four events',
					(await merged.locator(CALENDAR_GROUP).count()) === 1 &&
						(await merged.locator(CALENDAR_COPY).count()) === 1 &&
						(await merged.locator(`${CALENDAR_GROUP} p.font-semibold`).innerText()) === 'Екатерина'
				)
				await merged.locator(CALENDAR_COPY).click()
				const all = await page.evaluate(() => window.__copied.at(-1))
				check('the merged Copy dates has every date', all === '3, 10 - June\n8, 15 - July', JSON.stringify(all))
				check('no answer is withheld', (await page.getByText(WITHHELD).count()) === 0)
				await shot(page, 'changes-calendar', 'merged')
				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			},
			() => removeConversations([...new Set(conversations)]),
			() => restoreBudget(period)
		)
	} finally {
		await stopFakeModelApi(started)
	}
}

const sections = {
	calendar: sectionCalendar,
	notes: sectionNotes,
	review: sectionReview,
	prompts: sectionPrompts,
	details: sectionDetails,
	facts: sectionFacts,
	payment: sectionPayment,
	forms: sectionForms,
	proposals: sectionProposals,
	bulk: sectionBulk,
	essay: sectionEssay,
	title: sectionTitle,
}
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
