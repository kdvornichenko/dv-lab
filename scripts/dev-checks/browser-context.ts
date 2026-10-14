import type { BrowserType, Page } from '@playwright/test'

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { ROOT, STATE_DIR } from './paths.mjs'

const playwright = process.env.PLAYWRIGHT_CORE ?? '/Volumes/T7/personal/ielts/node_modules/playwright-core/index.mjs'
const loaded: unknown = await import(playwright)
const engine = process.env.DEV_CHECK_BROWSER === 'firefox' ? 'firefox' : 'chromium'
if (!loaded || typeof loaded !== 'object' || !(engine in loaded)) throw new Error(`${engine} loader is unavailable`)
const browserType = (loaded as Record<string, BrowserType>)[engine]!

export const firefox = engine === 'firefox'

export { ROOT, STATE_DIR }
export const BASE = 'http://localhost:3000'
export const env = parseEnv(readFileSync(`${ROOT}/.env`, 'utf8'))
export const theme = process.argv.includes('dark') ? 'dark' : 'light'

let failed = 0
export function check(
	name: string,
	ok: boolean | string | number | null | undefined,
	detail: string | number | null | undefined = ''
): void {
	console.log(`${ok ? 'PASS' : 'FAIL'} [${theme}] ${name}${detail ? ` (${detail})` : ''}`)
	if (!ok) failed += 1
}
export function failures(): number {
	return failed
}

export type SqlRow = Record<string, string | number | boolean | null>
export function sql<T extends object = SqlRow>(text: string): { rows: T[]; rowCount: number; command: string } {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/sql.mjs`, `${ROOT}/.env`, 'migrator', text], {
		encoding: 'utf8',
	})
	if (result.status !== 0 || result.error) throw new Error('Fixture SQL failed')
	let parsed: unknown
	try {
		parsed = JSON.parse(result.stdout.trim().split('\n').pop() ?? '')
	} catch {
		throw new Error('Fixture SQL returned an invalid result')
	}
	if (!parsed || typeof parsed !== 'object' || !('rows' in parsed) || !Array.isArray(parsed.rows))
		throw new Error('Fixture SQL returned no rows')
	if (!('rowCount' in parsed) || !('command' in parsed)) throw new Error('Fixture SQL returned no metadata')
	return { rows: parsed.rows as T[], rowCount: Number(parsed.rowCount), command: String(parsed.command) }
}

async function acceptedApiOrigin(): Promise<string> {
	const candidates = [
		...new Set([BASE, process.env.APP_ORIGIN, env.APP_ORIGIN].filter((origin): origin is string => !!origin)),
	]
	for (const origin of candidates) {
		const response = await fetch(`${BASE}/api/auth/sign-in`, {
			method: 'POST',
			headers: { origin, 'content-type': 'application/json' },
			body: JSON.stringify({ login: 'origin-probe', password: 'origin-probe' }),
		}).catch(() => null)
		const body: unknown = response ? await response.json().catch(() => null) : null
		const code =
			body && typeof body === 'object' && 'error' in body && body.error && typeof body.error === 'object'
				? (body.error as { code?: unknown }).code
				: null
		if (response && code !== 'forbidden_origin') return origin
	}
	return BASE
}

export async function launch({
	width = 1280,
	height = 800,
	colorScheme = theme,
	timezoneId,
}: {
	width?: number
	height?: number
	colorScheme?: 'dark' | 'light'
	timezoneId?: string
} = {}) {
	const browser = await browserType.launch()
	try {
		const context = await browser.newContext({
			viewport: { width, height },
			colorScheme,
			...(timezoneId ? { timezoneId } : {}),
		})
		const apiOrigin = await acceptedApiOrigin()
		if (apiOrigin !== BASE)
			await context.route('**/api/**', async (route) => {
				const headers = { ...(await route.request().allHeaders()), origin: apiOrigin }
				try {
					await route.fulfill({ response: await route.fetch({ headers }) })
				} catch {
					await route.abort().catch(() => undefined)
				}
			})
		const page = await context.newPage()
		const problems: string[] = []
		page.on('console', (message) => {
			if (message.type() === 'error' || message.type() === 'warning')
				problems.push(`${message.type()}: ${message.text().slice(0, 300)}`)
		})
		page.on('pageerror', (error) => problems.push(`pageerror: ${String(error).slice(0, 300)}`))
		return { browser, context, page, problems }
	} catch (error) {
		try {
			await browser.close()
		} catch (closeError) {
			throw new AggregateError([error, closeError], 'Browser preparation and close failed')
		}
		throw error
	}
}

export async function signIn(
	page: Page,
	login = env.DEV_TEACHER_LOGIN,
	password = env.DEV_TEACHER_PASSWORD
): Promise<void> {
	if (!login || !password) throw new Error('Dev teacher credentials are unavailable')
	await page.goto(`${BASE}/login`)
	await page.getByLabel('Login or email').fill(login)
	await page.locator('#password').fill(password)
	await page.getByRole('button', { name: 'Sign in to dv-lab' }).click()
	await page.waitForURL(`${BASE}/`, { timeout: 30000 })
}

export async function api<T>(
	page: Page,
	method: string,
	path: string,
	body?: object
): Promise<{ status: number; json: T | null }> {
	const response = await page.request.fetch<unknown>(`${BASE}/api${path}`, {
		method,
		headers: { origin: BASE, 'content-type': 'application/json' },
		data: body === undefined ? undefined : JSON.stringify(body),
	})
	let json: unknown = null
	try {
		json = await response.json()
	} catch {
		json = null
	}
	return { status: response.status(), json: json as T | null }
}

export async function shot(page: Page, prefix: string, name: string): Promise<string> {
	const path = `${STATE_DIR}/${prefix}-${theme}-${name}.png`
	await page.screenshot({ path })
	return path
}
