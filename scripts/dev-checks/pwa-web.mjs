import { BASE, check, failures } from './browser-context.ts'

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
