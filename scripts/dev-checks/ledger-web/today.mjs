import { api, check, failures, launch, signIn } from '../web.mjs'
import { cleanupFixtures, setTheme, withTeacherSettings } from './common.mjs'
import { todayPart3 } from './today-due.mjs'
import { todayFixtures, todayPart1 } from './today-read.mjs'
import { todayPart2 } from './today-rows.mjs'

export async function todaySection() {
	cleanupFixtures('today start')
	await withTeacherSettings(async () => {
		const { browser, context, page, problems } = await launch({
			width: 1280,
			height: 800,
			timezoneId: 'America/New_York',
		})
		try {
			await setTheme(page)
			await signIn(page)
			const settings = await api(page, 'GET', '/settings')
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
		} finally {
			await browser.close()
			cleanupFixtures('today end')
		}
	})
	if (failures() === 0) console.log('LEDGER_WEB_TODAY_OK')
}
