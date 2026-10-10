import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { ROOT, STATE_DIR } from './paths.mjs'

const playwright = process.env.PLAYWRIGHT_CORE ?? '/Volumes/T7/personal/ielts/node_modules/playwright-core/index.mjs'
const { chromium } = await import(playwright)

export { ROOT, STATE_DIR }
export const BASE = 'http://localhost:3000'
export const env = parseEnv(readFileSync(`${ROOT}/.env`, 'utf8'))
export const theme = process.argv.includes('dark') ? 'dark' : 'light'

let failed = 0
export function check(name, ok, detail = '') {
	console.log(`${ok ? 'PASS' : 'FAIL'} [${theme}] ${name}${detail ? ` (${detail})` : ''}`)
	if (!ok) failed += 1
}
export function failures() {
	return failed
}

export function sql(text) {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/sql.mjs`, `${ROOT}/.env`, 'migrator', text], {
		encoding: 'utf8',
	})
	try {
		return JSON.parse(result.stdout.trim().split('\n').pop())
	} catch {
		return { raw: (result.stdout + result.stderr).trim().slice(0, 200) }
	}
}

export async function launch({ width = 1280, height = 800, colorScheme = theme, timezoneId } = {}) {
	const browser = await chromium.launch()
	const context = await browser.newContext({
		viewport: { width, height },
		colorScheme,
		...(timezoneId ? { timezoneId } : {}),
	})
	const page = await context.newPage()
	const problems = []
	page.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning')
			problems.push(`${message.type()}: ${message.text().slice(0, 300)}`)
	})
	page.on('pageerror', (error) => problems.push(`pageerror: ${String(error).slice(0, 300)}`))
	return { browser, context, page, problems }
}

export async function signIn(page, login = env.DEV_TEACHER_LOGIN, password = env.DEV_TEACHER_PASSWORD) {
	await page.goto(`${BASE}/login`)
	await page.getByLabel('Login or email').fill(login)
	await page.locator('#password').fill(password)
	await page.getByRole('button', { name: 'Sign in to dv-lab' }).click()
	await page.waitForURL(`${BASE}/`, { timeout: 30000 })
}

export async function openStudents(page) {
	await page.goto(`${BASE}/students`)
	await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
}

export async function api(page, method, path, body) {
	const response = await page.request.fetch(`${BASE}/api${path}`, {
		method,
		headers: { origin: BASE, 'content-type': 'application/json' },
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

export async function shot(page, prefix, name) {
	const path = `${STATE_DIR}/${prefix}-${theme}-${name}.png`
	await page.screenshot({ path })
	return path
}
