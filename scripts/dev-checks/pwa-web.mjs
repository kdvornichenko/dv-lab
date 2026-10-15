import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import { lessonLink, studentPaymentsLink } from '../../packages/contracts/src/links.ts'
import { BASE, ROOT, api, check, failures, shot, signIn, sql, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'

const EXPECTED_NOISE = /Failed to load resource|server caches disabled|Route "\/login": Next\.js encountered URL data/

const ICONS = ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-icon.png']

const sections = { install: sectionInstall, push: sectionPush, settings: sectionSettings, presence: sectionPresence }

const open = (path) => fetch(`${BASE}${path}`, { redirect: 'manual' })

async function sectionInstall() {
	const response = await open('/manifest.webmanifest')
	check('the manifest is served without a session', response.status === 200, response.status)
	const manifest = response.status === 200 ? await response.json() : {}
	check('the manifest is named dv-lab', manifest.name === 'dv-lab' && manifest.short_name === 'dv-lab')
	check(
		'the manifest is standalone from the root',
		manifest.display === 'standalone' && manifest.start_url === '/' && manifest.scope === '/'
	)
	check(
		'the manifest colours are #fafafa',
		String(manifest.theme_color).toLowerCase() === '#fafafa' &&
			String(manifest.background_color).toLowerCase() === '#fafafa'
	)
	const icons = Array.isArray(manifest.icons) ? manifest.icons : []
	const shape = icons.map((icon) => `${icon.src}:${icon.sizes}:${icon.purpose}`).join(' ')
	check(
		'the manifest lists any 192, any 512 and maskable 512',
		shape === '/icon-192.png:192x192:any /icon-512.png:512x512:any /icon-maskable-512.png:512x512:maskable',
		shape
	)
	for (const path of ICONS) {
		const icon = await open(path)
		const type = icon.headers.get('content-type') ?? ''
		check(
			`${path} is served without a session`,
			icon.status === 200 && type.startsWith('image/png'),
			`${icon.status} ${type}`
		)
	}
	const closed = await open('/students')
	check(
		'a page without a session still goes to /login',
		closed.status === 307 && (closed.headers.get('location') ?? '').endsWith('/login'),
		closed.status
	)
	const worker = await open('/sw.js')
	const cache = worker.headers.get('cache-control') ?? ''
	const workerType = worker.headers.get('content-type') ?? ''
	check('the service worker is served without a session', worker.status === 200, worker.status)
	check('the service worker is not cached', /no-store/.test(cache) && /no-cache/.test(cache), cache)
	check('the service worker is javascript', /^application\/javascript/.test(workerType), workerType)
	check(
		'the service worker has no fetch handler',
		!/addEventListener\(\s*['"]fetch['"]/.test(worker.status === 200 ? await worker.text() : '')
	)
	await withBrowser({ width: 1280, height: 800 }, async ({ page, problems }) => {
		const anonymous = await page.goto(`${BASE}/login`)
		check(
			'the sign-in page carries the manifest link',
			(await page.locator('link[rel="manifest"]').getAttribute('href')) === '/manifest.webmanifest'
		)
		check('the sign-in page answers without redirect', anonymous?.status() === 200)
		await signIn(page)
		await page.goto(`${BASE}/`)
		const head = await page.evaluate(() => ({
			manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null,
			touch: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? null,
			colors: [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => ({
				media: meta.getAttribute('media'),
				content: meta.getAttribute('content'),
				active: meta.getAttribute('media') ? window.matchMedia(meta.getAttribute('media')).matches : false,
			})),
		}))
		check('the page links the manifest', head.manifest === '/manifest.webmanifest', head.manifest)
		check('the page links the apple-touch-icon', (head.touch ?? '').startsWith('/apple-icon.png'), head.touch)
		const light = head.colors.find((color) => color.media === '(prefers-color-scheme: light)')
		const dark = head.colors.find((color) => color.media === '(prefers-color-scheme: dark)')
		check('theme-color is #fafafa for the light scheme', light?.content === '#fafafa', light?.content)
		check('theme-color is #171717 for the dark scheme', dark?.content === '#171717', dark?.content)
		const active = head.colors.find((color) => color.active)
		check(
			`the ${theme} scheme picks its own theme-color`,
			active?.content === (theme === 'dark' ? '#171717' : '#fafafa'),
			active?.content
		)
		const icons = ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', head.touch ?? '/apple-icon.png']
		await page.setContent(
			`<body style="margin:0;padding:24px;display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;background:${theme === 'dark' ? '#171717' : '#fafafa'}">${icons
				.map((src) => `<img src="${BASE}${src}" width="160" height="160">`)
				.join('')}</body>`
		)
		await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))
		check('the four icons decode', true)
		await shot(page, 'pwa-install', 'icons-1280')
		await page.setViewportSize({ width: 375, height: 800 })
		await shot(page, 'pwa-install', 'icons-375')
		const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
		check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
	})
}

const STUDENT_ID = '00000000-0000-4000-8000-000000000025'
const LESSON_URL = lessonLink('2026-10-12', { kind: 'series', seriesId: STUDENT_ID, originalOn: '2026-10-14' })
const PAYMENTS_URL = studentPaymentsLink(STUDENT_ID)

async function withNotifications(run) {
	const playwright = process.env.PLAYWRIGHT_CORE ?? '/Volumes/T7/personal/ielts/node_modules/playwright-core/index.mjs'
	const { chromium } = await import(playwright)
	const browser = await chromium.launch({ channel: 'chromium' })
	try {
		const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: theme })
		const page = await context.newPage()
		const problems = []
		page.on('console', (message) => {
			if (message.type() === 'error' || message.type() === 'warning')
				problems.push(`${message.type()}: ${message.text().slice(0, 300)}`)
		})
		page.on('pageerror', (error) => problems.push(`pageerror: ${String(error).slice(0, 300)}`))
		await run({ context, page, problems })
	} finally {
		await browser.close()
	}
}

async function pushed(client, registrationId, payload) {
	const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
	await client.send('ServiceWorker.deliverPushMessage', { origin: BASE, registrationId, data })
}

async function shown(page, tag) {
	const deadline = Date.now() + 8000
	while (Date.now() < deadline) {
		const found = await page.evaluate(async (wanted) => {
			const registration = await navigator.serviceWorker.getRegistration()
			const list = await registration.getNotifications()
			const hit = list.find((item) => item.tag === wanted)
			return hit ? { title: hit.title, body: hit.body, tag: hit.tag, icon: hit.icon, data: hit.data } : null
		}, tag)
		if (found) return found
		await new Promise((resolve) => setTimeout(resolve, 200))
	}
	return null
}

function loadWorker() {
	const listeners = {}
	const calls = { shown: [], closed: 0, focused: 0, navigated: [], opened: [], fetched: [], subscribed: [] }
	const state = { windows: [], navigateFails: false }
	const self = {
		location: { origin: BASE },
		skipWaiting: () => {},
		clients: {
			claim: () => Promise.resolve(),
			matchAll: () => Promise.resolve(state.windows),
			openWindow: (url) => {
				calls.opened.push(url)
				return Promise.resolve(null)
			},
		},
		registration: {
			showNotification: (title, options) => {
				calls.shown.push({ title, options })
				return Promise.resolve()
			},
			pushManager: {
				subscribe: (options) => {
					calls.subscribed.push(options)
					return Promise.resolve(fakeSubscription('https://push.example.test/new', 'new-p256dh', 'new-auth'))
				},
			},
		},
		addEventListener: (type, handler) => {
			listeners[type] = handler
		},
	}
	const fakeSubscription = (endpoint, p256dh, auth, key) => ({
		endpoint,
		options: { applicationServerKey: key ?? null },
		toJSON: () => ({ endpoint, keys: { p256dh, auth } }),
	})
	const network = { failPost: false, publicKey: 'AQID', offline: false }
	const fetchStub = (url, init = {}) => {
		if (network.offline) return Promise.reject(new Error('offline'))
		const method = init.method ?? 'GET'
		calls.fetched.push({
			method,
			url,
			body: init.body === undefined ? null : JSON.parse(init.body),
			credentials: init.credentials,
		})
		if (url === '/api/push/config')
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ enabled: true, publicKey: network.publicKey, devices: [] }),
			})
		return Promise.resolve({ ok: !(network.failPost && method === 'POST') })
	}
	vm.runInNewContext(readFileSync(`${ROOT}/apps/web/public/sw.js`, 'utf8'), {
		self,
		URL,
		console,
		atob,
		Uint8Array,
		fetch: fetchStub,
	})
	const windowAt = (url) => ({
		url,
		focus: () => {
			calls.focused += 1
			return Promise.resolve()
		},
		navigate: (target) => {
			if (state.navigateFails) return Promise.reject(new Error('navigate failed'))
			calls.navigated.push(target)
			return Promise.resolve()
		},
	})
	async function click(url, windows, navigateFails = false) {
		calls.focused = 0
		calls.navigated = []
		calls.opened = []
		state.windows = windows.map(windowAt)
		state.navigateFails = navigateFails
		let waiting = null
		await listeners.notificationclick({
			notification: { data: { url }, close: () => (calls.closed += 1) },
			waitUntil: (promise) => (waiting = promise),
		})
		await waiting
	}
	async function push(data) {
		let waiting = null
		await listeners.push({ data, waitUntil: (promise) => (waiting = promise) })
		await waiting
	}
	async function change({ previous, next, ...options }) {
		calls.fetched = []
		calls.subscribed = []
		Object.assign(network, { failPost: false, publicKey: 'AQID', offline: false }, options)
		let waiting = null
		await listeners.pushsubscriptionchange({
			oldSubscription: previous ?? null,
			newSubscription: next ?? null,
			waitUntil: (promise) => (waiting = promise),
		})
		await waiting
	}
	return { calls, click, push, change, fakeSubscription, listeners }
}

async function sectionPush() {
	const worker = loadWorker()
	check(
		'the worker listens to install, activate, push, notificationclick and pushsubscriptionchange',
		['install', 'activate', 'push', 'notificationclick', 'pushsubscriptionchange'].every(
			(type) => type in worker.listeners
		)
	)
	await worker.click(LESSON_URL, [`${BASE}/`])
	check(
		'a tap focuses the open app window and navigates it to the lesson',
		worker.calls.focused === 1 &&
			worker.calls.navigated.length === 1 &&
			worker.calls.navigated[0] === `${BASE}${LESSON_URL}` &&
			worker.calls.opened.length === 0,
		worker.calls.navigated.join(',')
	)
	await worker.click(PAYMENTS_URL, [`${BASE}/students`])
	check('a tap opens the Payments tab of the student', worker.calls.navigated[0] === `${BASE}${PAYMENTS_URL}`)
	await worker.click(LESSON_URL, [])
	check(
		'a tap without a window opens one at the lesson',
		worker.calls.opened.length === 1 && worker.calls.opened[0] === `${BASE}${LESSON_URL}`
	)
	await worker.click(LESSON_URL, ['https://other.example/'])
	check(
		'a window of another origin is not reused',
		worker.calls.focused === 0 && worker.calls.opened.length === 1 && worker.calls.navigated.length === 0
	)
	await worker.click(LESSON_URL, [`${BASE}/`], true)
	check('a failed navigation falls back to a new window', worker.calls.opened[0] === `${BASE}${LESSON_URL}`)
	for (const hostile of [
		'//evil.example/x',
		'https://evil.example/x',
		'/\\evil.example',
		'javascript:alert(1)',
		'',
		null,
		7,
	]) {
		await worker.click(hostile, [])
		check(
			`an address outside the own origin goes to the root (${String(hostile)})`,
			worker.calls.opened[0] === `${BASE}/`,
			worker.calls.opened[0]
		)
	}
	await worker.push({ json: () => ({ title: 'T', body: 'B', tag: 'lesson:k', url: LESSON_URL }) })
	const first = worker.calls.shown.at(-1)
	check(
		'a push inside waitUntil shows title, body, tag, icon and the address',
		first?.title === 'T' &&
			first.options.body === 'B' &&
			first.options.tag === 'lesson:k' &&
			first.options.icon === '/icon-192.png' &&
			first.options.data.url === LESSON_URL
	)
	await worker.push({
		json: () => {
			throw new Error('bad body')
		},
	})
	check(
		'a broken body still shows a notification named dv-lab',
		worker.calls.shown.at(-1)?.title === 'dv-lab' && worker.calls.shown.at(-1)?.options.data.url === '/'
	)
	await worker.push(null)
	check('an empty push still shows a notification', worker.calls.shown.at(-1)?.title === 'dv-lab')

	const old = worker.fakeSubscription('https://push.example.test/old', 'old-p256dh', 'old-auth', new Uint8Array([9, 9]))
	const fresh = worker.fakeSubscription('https://push.example.test/fresh', 'fresh-p256dh', 'fresh-auth')
	const verbs = () => worker.calls.fetched.map((call) => `${call.method} ${call.url}`).join(', ')
	await worker.change({ previous: old, next: fresh })
	check(
		'a changed subscription is posted and the old one removed, without subscribing again',
		verbs() === 'POST /api/push/subscriptions, DELETE /api/push/subscriptions' &&
			worker.calls.subscribed.length === 0 &&
			worker.calls.fetched[0].body.endpoint === fresh.endpoint &&
			worker.calls.fetched[0].body.keys.p256dh === 'fresh-p256dh' &&
			worker.calls.fetched[1].body.endpoint === old.endpoint &&
			worker.calls.fetched.every((call) => call.credentials === 'same-origin'),
		verbs()
	)
	await worker.change({ previous: old })
	check(
		'without a new subscription the worker subscribes with the old key',
		worker.calls.subscribed.length === 1 &&
			worker.calls.subscribed[0].userVisibleOnly === true &&
			worker.calls.subscribed[0].applicationServerKey[0] === 9 &&
			verbs() === 'POST /api/push/subscriptions, DELETE /api/push/subscriptions',
		verbs()
	)
	await worker.change({})
	check(
		'without any subscription the worker reads the public key from the api',
		verbs() === 'GET /api/push/config, POST /api/push/subscriptions' &&
			worker.calls.subscribed.length === 1 &&
			[...worker.calls.subscribed[0].applicationServerKey].join(',') === '1,2,3',
		verbs()
	)
	await worker.change({ publicKey: null })
	check(
		'a disabled push config subscribes nothing',
		worker.calls.subscribed.length === 0 && verbs() === 'GET /api/push/config',
		verbs()
	)
	await worker.change({ previous: old, next: fresh, failPost: true })
	check(
		'the old subscription stays when the new one was not saved',
		verbs() === 'POST /api/push/subscriptions',
		verbs()
	)
	await worker.change({ previous: old, next: fresh, offline: true })
	check('a network failure ends quietly', worker.calls.fetched.length === 0)

	await withNotifications(async ({ context, page, problems }) => {
		await context.grantPermissions(['notifications'], { origin: BASE })
		await page.goto(`${BASE}/login`)
		const registered = await page.evaluate(async () => {
			const registration = await navigator.serviceWorker.register('/sw.js')
			await navigator.serviceWorker.ready
			return { scope: new URL(registration.scope).pathname, active: registration.active !== null }
		})
		check('the browser registers the worker at the root scope', registered.scope === '/' && registered.active)
		const client = await context.newCDPSession(page)
		const registrations = []
		client.on('ServiceWorker.workerRegistrationUpdated', (event) => registrations.push(...event.registrations))
		await client.send('ServiceWorker.enable')
		const deadline = Date.now() + 5000
		while (registrations.length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100))
		const registrationId = registrations.at(-1)?.registrationId
		check('the worker registration is visible to the browser', registrationId !== undefined)
		await pushed(client, registrationId, {
			title: 'Lesson with Alex Example 2500 in 10 minutes',
			body: 'Wed, 18:00 VN · 14:00 MSK',
			tag: 'lesson:series:check',
			url: LESSON_URL,
		})
		const lesson = await shown(page, 'lesson:series:check')
		check(
			'a lesson push becomes a shown notification',
			lesson?.title === 'Lesson with Alex Example 2500 in 10 minutes',
			lesson?.title
		)
		check('the shown notification carries the lesson address', lesson?.data?.url === LESSON_URL, lesson?.data?.url)
		check(
			'the shown notification carries body and icon',
			lesson?.body === 'Wed, 18:00 VN · 14:00 MSK' && /\/icon-192\.png$/.test(lesson?.icon ?? '')
		)
		await pushed(client, registrationId, {
			title: 'Alex Example 2500 has 1 lessons left',
			body: 'Pays soon. Open payments to record a payment.',
			tag: `pays:${STUDENT_ID}`,
			url: PAYMENTS_URL,
		})
		const pays = await shown(page, `pays:${STUDENT_ID}`)
		check(
			'a payments push becomes a shown notification with the Payments address',
			pays?.data?.url === PAYMENTS_URL,
			pays?.data?.url
		)
		await pushed(client, registrationId, {
			title: 'Hostile',
			tag: 'hostile',
			url: '//evil.example/steal',
		})
		const hostile = await shown(page, 'hostile')
		check('a foreign address in a push is stored as the root', hostile?.data?.url === '/', hostile?.data?.url)
		await pushed(client, registrationId, 'not json')
		const deadlineBroken = Date.now() + 8000
		let broken = null
		while (!broken && Date.now() < deadlineBroken) {
			broken = await page.evaluate(async () => {
				const registration = await navigator.serviceWorker.getRegistration()
				const list = await registration.getNotifications()
				return list.find((item) => item.title === 'dv-lab') ?? null
			})
			if (!broken) await new Promise((resolve) => setTimeout(resolve, 200))
		}
		check('a push with a broken body is still shown', broken !== null)
		const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
		check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
	})
}

const FAKE_ENDPOINTS = 'https://push.example.test/dvlab-pwa/%'
const FIXTURE_PREFIX = 'Alex Example 262'

function installFakes() {
	const read = (key, fallback) => {
		try {
			return sessionStorage.getItem(key) ?? fallback
		} catch {
			return fallback
		}
	}
	const write = (key, value) => {
		try {
			if (value === null) sessionStorage.removeItem(key)
			else sessionStorage.setItem(key, value)
		} catch {}
	}
	const random = (size) =>
		btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(size))))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '')
	if (read('fake.unsupported', '') === '1') delete window.PushManager
	Object.defineProperty(Notification, 'permission', {
		configurable: true,
		get: () => read('fake.permission', 'default'),
	})
	Notification.requestPermission = async () => {
		if (read('fake.hold', '') === '1')
			await new Promise((resolve) => {
				window.__release = resolve
			})
		const answer = read('fake.answer', 'granted')
		if (answer === 'dismiss') return 'default'
		write('fake.permission', answer)
		return answer
	}
	const current = () => {
		const raw = read('fake.sub', '')
		if (!raw) return null
		const stored = JSON.parse(raw)
		return {
			endpoint: stored.endpoint,
			options: {},
			toJSON: () => ({ endpoint: stored.endpoint, keys: { p256dh: stored.p256dh, auth: stored.auth } }),
			unsubscribe: async () => {
				write('fake.sub', null)
				return true
			},
		}
	}
	if (window.PushManager) {
		PushManager.prototype.getSubscription = async () => current()
		PushManager.prototype.subscribe = async () => {
			if (!read('fake.sub', ''))
				write(
					'fake.sub',
					JSON.stringify({
						endpoint: `https://push.example.test/dvlab-pwa/${crypto.randomUUID()}`,
						p256dh: random(65),
						auth: random(16),
					})
				)
			return current()
		}
	}
}

const routeSafe = (page, pattern, handler) =>
	page.route(pattern, async (route) => {
		try {
			await handler(route)
		} catch {}
	})

const setFake = (page, entries) =>
	page.evaluate((list) => {
		for (const [key, value] of list) {
			if (value === null) sessionStorage.removeItem(key)
			else sessionStorage.setItem(key, value)
		}
	}, Object.entries(entries))

const fakeEndpoint = (page) =>
	page.evaluate(() => {
		const raw = sessionStorage.getItem('fake.sub')
		return raw ? JSON.parse(raw).endpoint : null
	})

const deviceSwitch = (page) => page.getByRole('switch', { name: 'Push notifications' })
const deviceHint = (page) => page.locator('#settings-notifications-device-hint')

async function openSettings(page) {
	await page.goto(`${BASE}/settings?tab=general`)
	await page.getByText('Notifications on this device', { exact: true }).waitFor({ timeout: 30000 })
	await page.waitForFunction(
		() => (document.getElementById('settings-notifications-device-hint')?.textContent ?? '') !== '',
		undefined,
		{ timeout: 15000 }
	)
}

async function hintStarts(page, text, timeout = 8000) {
	try {
		await page.waitForFunction(
			(expected) =>
				(document.getElementById('settings-notifications-device-hint')?.textContent ?? '').startsWith(expected),
			text,
			{ timeout }
		)
		return true
	} catch {
		return false
	}
}

const rows = () =>
	sql(
		`select count(*)::int as total, count(revoked_at)::int as revoked from push_subscriptions where endpoint like '${FAKE_ENDPOINTS}'`
	).rows[0]

function removeFixtures() {
	const cards = `select id from students where display_name like '${FIXTURE_PREFIX}%' and import_key is null`
	sql(`delete from push_payment_alerts where student_id in (${cards})`)
	sql(`delete from student_notes where student_id in (${cards})`)
	sql(`delete from student_sections where student_id in (${cards})`)
	sql(`delete from student_terms where student_id in (${cards})`)
	sql(`delete from note_reviews where student_id in (${cards})`)
	sql(`delete from students where display_name like '${FIXTURE_PREFIX}%' and import_key is null`)
	sql(`delete from push_subscriptions where endpoint like '${FAKE_ENDPOINTS}'`)
}

async function restoreNotifySettings(page) {
	await api(page, 'PATCH', '/settings', { notifyLessonSoon: true, notifyLessonMinutes: 30, notifyPaysSoon: true })
}

async function sectionSettings() {
	removeFixtures()
	try {
		await withNotifications(async ({ context, page, problems }) => {
			await context.grantPermissions(['notifications'], { origin: BASE })
			await page.addInitScript(installFakes)
			await signIn(page)
			await restoreNotifySettings(page)
			const posts = []
			page.on('request', (request) => {
				if (request.method() === 'POST' && request.url().endsWith('/api/push/subscriptions')) posts.push(request.url())
			})

			await openSettings(page)
			check('the device card starts off with the device in the hint', await hintStarts(page, 'Off on this device ('))
			check(
				'the device is named by browser and system',
				/^Off on this device \(\w+ on [\w ]+\)\.$/.test(await deviceHint(page).innerText())
			)
			check('the card ends with Saved on this device.', (await page.getByText('Saved on this device.').count()) === 1)
			check(
				'the events card says to turn on this device',
				(await page.getByText('Turn on notifications on this device to receive these.').count()) === 1
			)

			await setFake(page, { 'fake.hold': '1' })
			await deviceSwitch(page).click()
			await page.getByText('Waiting for your answer in the browser…').waitFor({ timeout: 5000 })
			check(
				'while the browser asks nothing is saved and the switch waits',
				posts.length === 0 && (await deviceSwitch(page).isDisabled())
			)
			await shot(page, 'pwa-settings', 'waiting')
			await setFake(page, { 'fake.hold': null })
			await page.evaluate(() => window.__release())
			check('an allowed permission turns the switch on', await hintStarts(page, 'On for this device ('))
			check(
				'the subscription is saved on the server',
				rows().total === 1 && rows().revoked === 0,
				JSON.stringify(rows())
			)
			check('the switch is on', (await deviceSwitch(page).getAttribute('aria-checked')) === 'true')
			check(
				'the muted row is gone while this device is on',
				(await page.getByText('Turn on notifications on this device to receive these.').count()) === 0
			)
			const config = await api(page, 'GET', '/push/config')
			const device = config.json?.devices?.find((entry) => (entry.deviceLabel ?? '').includes(' on '))
			check(
				'the config lists this device with its label and not revoked',
				device !== undefined && device.revoked === false
			)
			await shot(page, 'pwa-settings', 'on')

			await page.locator('#settings-notify-minutes').fill('4')
			await page.locator('#settings-notify-minutes').blur()
			await page.getByText('Use a whole number from 5 to 120.').waitFor({ timeout: 5000 })
			check(
				'minutes 4 shows the error and the invalid ring',
				(await page.locator('#settings-notify-minutes').getAttribute('aria-invalid')) === 'true'
			)
			check(
				'nothing is saved for minutes 4',
				(await api(page, 'GET', '/settings')).json?.settings?.notifyLessonMinutes === 30
			)
			await page.waitForFunction(() => document.getElementById('settings-notify-minutes')?.value === '30', undefined, {
				timeout: 6000,
			})
			check('the last saved minutes come back', true)
			await page.locator('#settings-notify-minutes').fill('45')
			await page.locator('#settings-notify-minutes').press('Enter')
			await page.getByText('Saved', { exact: true }).first().waitFor({ timeout: 5000 })
			check(
				'minutes 45 are saved on Enter',
				(await api(page, 'GET', '/settings')).json?.settings?.notifyLessonMinutes === 45
			)
			await page.getByRole('switch', { name: 'A student is about to pay' }).click()
			await page.waitForTimeout(800)
			check(
				'the Pays soon notification can be turned off on its own',
				(await api(page, 'GET', '/settings')).json?.settings?.notifyPaysSoon === false
			)
			check(
				'the lesson notification stayed on',
				(await api(page, 'GET', '/settings')).json?.settings?.notifyLessonSoon === true
			)

			const second = await api(page, 'POST', '/push/subscriptions', {
				endpoint: 'https://push.example.test/dvlab-pwa/other-device',
				keys: { p256dh: 'BAAA', auth: 'AAAA' },
				deviceLabel: 'Other device',
			})
			check('a second device is subscribed for the check', second.status === 201, String(second.status))
			await deviceSwitch(page).click()
			check('turning off says Off on this device', await hintStarts(page, 'Off on this device ('))
			const left = sql(
				`select endpoint, revoked_at is not null as revoked from push_subscriptions where endpoint like '${FAKE_ENDPOINTS}' order by endpoint`
			).rows
			check(
				'turning off removes only this device',
				left.length === 2 &&
					left.filter((row) => row.revoked).length === 1 &&
					left.find((row) => !row.revoked)?.endpoint.endsWith('/other-device'),
				JSON.stringify(left.map((row) => row.revoked))
			)

			await deviceSwitch(page).click()
			check('the device turns on again after being off', await hintStarts(page, 'On for this device ('))
			const endpoint = await fakeEndpoint(page)
			await api(page, 'DELETE', '/push/subscriptions', { endpoint })
			check('the server side revoke is visible', rows().revoked >= 1)
			await page.reload()
			check(
				'after a reload the app restores the subscription and the card is on',
				await hintStarts(page, 'On for this device (')
			)
			const restored = sql(`select revoked_at is null as live from push_subscriptions where endpoint = '${endpoint}'`)
				.rows[0]
			check('the restored subscription is not revoked on the server', restored?.live === true)

			await routeSafe(page, '**/api/push/config', async (route) => {
				const response = await route.fetch()
				const body = await response.json()
				const id = await page.evaluate(() => localStorage.getItem('dv-lab.push.device-id'))
				body.devices = body.devices.map((entry) => (entry.id === id ? { ...entry, revoked: true } : entry))
				await route.fulfill({ response, json: body })
			})
			await page.reload()
			check('a revoked device says Stopped on this device', await hintStarts(page, 'Stopped on this device ('))
			check(
				'the revoked card has the warning row and Turn on again',
				(await page
					.getByText(
						'Notifications stopped working on this device. The browser or the system removed the subscription.'
					)
					.count()) === 1 && (await page.getByRole('button', { name: 'Turn on again' }).count()) === 1
			)
			await page.locator('#settings-notifications-device-hint').scrollIntoViewIfNeeded()
			const message = await page.getByText('Notifications stopped working on this device.').boundingBox()
			const action = await page.getByRole('button', { name: 'Turn on again' }).boundingBox()
			check(
				'the Turn on again button sits right of the warning text',
				message !== null &&
					action !== null &&
					action.x >= message.x + message.width - 2 &&
					action.y < message.y + message.height
			)
			await shot(page, 'pwa-settings', 'revoked')
			await routeSafe(page, '**/api/push/subscriptions', async (route) => {
				if (route.request().method() === 'POST') await route.abort()
				else await route.continue()
			})
			await page.getByRole('button', { name: 'Turn on again' }).click()
			await page.getByText('Could not turn on notifications. Try again.').waitFor({ timeout: 8000 })
			check(
				'a failed Turn on again stays revoked with the error',
				(await hintStarts(page, 'Stopped on this device (')) &&
					(await page.getByRole('button', { name: 'Turn on again' }).count()) === 1
			)
			await page.unroute('**/api/push/subscriptions')
			await routeSafe(page, '**/api/push/subscriptions', async (route) => {
				if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 1200))
				await route.continue()
			})
			await page.unroute('**/api/push/config')
			await routeSafe(page, '**/api/push/config', async (route) => {
				const response = await route.fetch()
				const body = await response.json()
				const id = await page.evaluate(() => localStorage.getItem('dv-lab.push.device-id'))
				const reviving = await page.evaluate(() => window.__revived === true)
				body.devices = body.devices.map((entry) => (entry.id === id ? { ...entry, revoked: !reviving } : entry))
				await route.fulfill({ response, json: body })
			})
			await page.evaluate(() => {
				window.__revived = true
			})
			await page.getByRole('button', { name: 'Turn on again' }).click()
			await page.getByText('Turning notifications on again…').waitFor({ timeout: 5000 })
			check('Turn on again shows Turning on… and the caption', (await page.getByText('Turning on…').count()) === 1)
			check('Turn on again ends in the normal on state', await hintStarts(page, 'On for this device ('))
			await page.unroute('**/api/push/subscriptions')
			await page.unroute('**/api/push/config')

			await setFake(page, { 'fake.permission': 'denied' })
			await page.reload()
			check('a denied permission is Blocked', await hintStarts(page, 'Blocked in this browser.'))
			check('the blocked switch cannot be changed', await deviceSwitch(page).isDisabled())
			check(
				'the blocked card says where to allow it',
				(await page
					.getByText(
						"Notifications are blocked for this site. Allow them in the browser's site settings, then check again."
					)
					.count()) === 1
			)
			await shot(page, 'pwa-settings', 'blocked')
			await setFake(page, { 'fake.permission': 'granted' })
			await page.getByRole('button', { name: 'Check again' }).click()
			check('Check again reads the permission again', await hintStarts(page, 'On for this device ('))

			await setFake(page, { 'fake.sub': null, 'fake.permission': 'default', 'fake.answer': 'dismiss' })
			await page.reload()
			await hintStarts(page, 'Off on this device (')
			const before = posts.length
			await deviceSwitch(page).click()
			await page.waitForTimeout(500)
			check(
				'a dismissed question leaves the switch off without an error',
				(await hintStarts(page, 'Off on this device (')) &&
					(await page.getByText('Could not turn on notifications. Try again.').count()) === 0 &&
					posts.length === before
			)
			await setFake(page, { 'fake.answer': 'denied' })
			await deviceSwitch(page).click()
			check('a refused permission becomes Blocked', await hintStarts(page, 'Blocked in this browser.'))

			await setFake(page, { 'fake.permission': 'granted', 'fake.answer': 'granted' })
			await page.reload()
			await hintStarts(page, 'Off on this device (')
			await routeSafe(page, '**/api/push/subscriptions', async (route) => {
				if (route.request().method() === 'POST') await route.abort()
				else await route.continue()
			})
			await deviceSwitch(page).click()
			await page.getByText('Could not turn on notifications. Try again.').waitFor({ timeout: 8000 })
			check(
				'a subscription that could not be saved leaves the switch off with the error',
				(await deviceSwitch(page).getAttribute('aria-checked')) === 'false' && (await fakeEndpoint(page)) === null
			)
			await page.unroute('**/api/push/subscriptions')

			await routeSafe(page, '**/api/push/config', (route) =>
				route.fulfill({ json: { enabled: false, publicKey: null, devices: [] } })
			)
			await page.reload()
			check('a server without push says Not set up on the server.', await hintStarts(page, 'Not set up on the server.'))
			check('the not-set-up switch cannot be changed', await deviceSwitch(page).isDisabled())
			check(
				'the not-set-up row is the info text with Check again',
				(await page
					.getByText('Push notifications are not set up on the server. Once they are, turn them on here.')
					.count()) === 1 && (await page.getByRole('button', { name: 'Check again' }).count()) === 1
			)
			check(
				'the events card stays usable',
				(await page.getByRole('switch', { name: 'A lesson starts soon' }).isDisabled()) === false
			)
			await shot(page, 'pwa-settings', 'server-off')
			await page.unroute('**/api/push/config')
			await page.getByRole('button', { name: 'Check again' }).click()
			check('Check again asks the server again', await hintStarts(page, 'Off on this device ('))

			await setFake(page, { 'fake.unsupported': '1' })
			await page.reload()
			check(
				'a browser without push says Not available in this browser.',
				await hintStarts(page, 'Not available in this browser.')
			)
			check(
				'the not-available card explains the Home Screen',
				(await page
					.getByText(
						'This browser cannot show notifications. On iPhone and iPad, add dv-lab to the Home Screen first and open it from there.'
					)
					.count()) === 1 && (await deviceSwitch(page).isDisabled())
			)
			await setFake(page, { 'fake.unsupported': null })

			await page.setViewportSize({ width: 375, height: 800 })
			await page.reload()
			await hintStarts(page, 'Off on this device (')
			check(
				'at 375 px the page does not scroll sideways',
				await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
			)
			await page.locator('#settings-notifications-device-hint').scrollIntoViewIfNeeded()
			await shot(page, 'pwa-settings', 'phone')
			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			await restoreNotifySettings(page)
		})
	} finally {
		removeFixtures()
	}
}

async function sectionPresence() {
	removeFixtures()
	try {
		await withNotifications(async ({ context, page, problems }) => {
			await context.grantPermissions(['notifications'], { origin: BASE })
			await page.addInitScript(installFakes)
			await signIn(page)
			const student = await api(page, 'POST', '/students', {
				displayName: `${FIXTURE_PREFIX}0`,
				rateMinor: null,
				currency: null,
				defaultLessonMinutes: 60,
				parent: null,
				level: null,
				goals: null,
				timeZone: null,
			})
			const studentId = student.json?.student?.id
			check('the fixture card is created', student.status === 201 && typeof studentId === 'string')
			await openSettings(page)
			await deviceSwitch(page).click()
			check('the device is subscribed for the check', await hintStarts(page, 'On for this device ('))
			const endpoint = await fakeEndpoint(page)
			const signals = []
			page.on('response', async (response) => {
				const request = response.request()
				if (request.method() === 'POST' && request.url().endsWith('/api/push/presence'))
					signals.push({ body: JSON.parse(request.postData() ?? '{}'), status: response.status() })
			})
			let from = 0
			const mark = () => (from = signals.length)
			const waitSignal = async (match, timeout = 8000) => {
				const deadline = Date.now() + timeout
				while (Date.now() < deadline) {
					const found = signals.slice(from).find(match)
					if (found) return found
					await page.waitForTimeout(150)
				}
				return null
			}

			mark()
			await page.goto(`${BASE}/schedule`)
			const schedule = await waitSignal((signal) => signal.body.screen === 'schedule')
			check(
				'the Schedule screen reports schedule',
				schedule !== null && schedule.body.endpoint === endpoint && schedule.status === 204,
				String(schedule?.status)
			)
			check('the signal carries the second time zone', typeof schedule?.body.secondTimeZone === 'string')

			mark()
			await page.goto(`${BASE}/students/${studentId}?tab=payments`)
			const payments = await waitSignal((signal) => signal.body.screen === 'payments')
			check(
				'Payments of a student reports payments and the student',
				payments?.body.studentId === studentId && payments.status === 204
			)

			mark()
			await page.goto(`${BASE}/students/${studentId}`)
			const overview = await waitSignal((signal) => signal.body.screen === 'other')
			check('the profile outside Payments reports other', overview !== null && overview.body.studentId === undefined)

			mark()
			await page.goto(`${BASE}/schedule`)
			await waitSignal((signal) => signal.body.screen === 'schedule')
			mark()
			await page.evaluate(() => {
				Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
				document.dispatchEvent(new Event('visibilitychange'))
			})
			const hidden = await waitSignal((signal) => signal.body.screen === 'other')
			check('a hidden page reports other', hidden !== null && hidden.status === 204)
			const afterHide = signals.length
			await page.evaluate(() => {
				Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
				document.dispatchEvent(new Event('visibilitychange'))
			})
			await page.waitForTimeout(800)
			check(
				'a visible page reports again at once',
				signals.length > afterHide && signals.at(-1).body.screen === 'schedule'
			)

			await api(page, 'DELETE', '/push/subscriptions', { endpoint })
			await page.evaluate(() => sessionStorage.removeItem('fake.sub'))
			const quiet = signals.length
			await page.goto(`${BASE}/schedule`)
			await page.waitForTimeout(1500)
			check('a device without a subscription sends no signal', signals.length === quiet)
			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		})
	} finally {
		removeFixtures()
	}
}

const wanted = process.argv.slice(2).find((value) => value in sections)
const run = wanted === undefined ? Object.entries(sections) : [[wanted, sections[wanted]]]

try {
	for (const [name, section] of run) {
		await section()
		console.log(`section ${name} done`)
	}
} catch (error) {
	check('sections completed', false, String(error).slice(0, 1500))
}
if (failures() === 0) console.log('PWA_WEB_OK')
process.exit(failures())
