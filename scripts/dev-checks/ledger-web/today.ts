import type { SettingsResponse, ErrorResponse } from '../../../packages/contracts/src/index.ts'
import { api, check, failures, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import { cleanupFixtures, setTheme, withTeacherSettings } from './common.mjs'
import { todayPart3 } from './today-due.mjs'
import { todayFixtures, todayPart1 } from './today-read.mjs'
import { todayPart2 } from './today-rows.mjs'

export async function todaySection() {
	cleanupFixtures('today start')
	await withTeacherSettings(async () => {
		await withBrowser(
			{
				width: 1280,
				height: 800,
				timezoneId: 'America/New_York',
			},
			async ({ context, page, problems }) => {
				await setTheme(page)
				await signIn(page)
				const settings = await api<SettingsResponse & Partial<ErrorResponse>>(page, 'GET', '/settings')
				if (settings.json?.settings?.paysSoonLessons !== 2)
					throw new Error('Today journey requires threshold 2; account settings are read-only')
				const fx = await todayFixtures(page)
				await todayPart1(page, context, fx)
				await todayPart2(page, fx)
				await todayPart3(page, fx)
				const real = problems.filter(
					(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409|500)/.test(problem)
				)
				check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
			},
			() => cleanupFixtures('today end')
		)
	})
	if (failures() === 0) console.log('LEDGER_WEB_TODAY_OK')
}
