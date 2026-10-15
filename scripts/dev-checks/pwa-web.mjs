import { BASE, check, failures, shot, signIn, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'

const EXPECTED_NOISE = /Failed to load resource|server caches disabled|Route "\/login": Next\.js encountered URL data/

const ICONS = ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-icon.png']

const sections = { install: sectionInstall }

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
