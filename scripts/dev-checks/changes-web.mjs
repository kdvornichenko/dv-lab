import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'

import * as core from '../../packages/core/src/index.ts'
import { BASE, ROOT, api, check, env, failures, shot, signIn, sql, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'

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

const CHANGED_PAYMENT =
	'This payment changed elsewhere. Your draft has been kept. Reload the current details before saving.'
const CHANGED_STUDENT =
	'This student changed elsewhere. Your draft has been kept. Reload the current details before saving.'
const GONE = 'This record is no longer available. Open the current records to continue.'

function removeFormsCards() {
	const where = `display_name = '${FORMS_NAME}' and import_key is null`
	sql(`delete from payments where student_id in (select id from students where ${where})`)
	const result = sql(`delete from students where ${where}`)
	console.log(`fixture cards removed ${result.rowCount}`)
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
	const health = await fetch('http://127.0.0.1:4000/healthz').catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer on 4000: this section needs the dev stack')
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
				await page.getByRole('button', { name: 'Record payment' }).click()
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
					header.includes(phrase) && (await row.innerText()).includes(phrase),
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

				const archive = page.getByRole('button', { name: 'Archive', exact: true })
				await archive.click()
				await page.getByRole('button', { name: 'Archive student' }).click()
				await page.getByText('Student archived').waitFor({ timeout: 15000 })
				await page.getByRole('button', { name: 'Restore', exact: true }).click()
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
				await dialog.getByRole('button', { name: 'Discard changes' }).click()
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

const sections = { payment: sectionPayment, forms: sectionForms }
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
