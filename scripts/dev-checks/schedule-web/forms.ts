import type { Page } from 'playwright-core'

import type { ScheduleSeriesResponse, ErrorResponse } from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, failures, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import { seriesDialogFacts } from './dialogs.ts'
import { fieldValues } from './field-values.ts'
import { cleanupFixtures } from './fixtures.ts'
import { VN, setTheme } from './navigation.ts'
import { createCard } from './read-fixtures.ts'
import { seriesForms } from './series-forms.ts'

export const FORMS_LIKE = 'Alex Example 2131%'

export const FORMS_A = 'Alex Example 2131 A'

export const FORMS_B = 'Alex Example 2131 B'

export const FORMS_C = 'Alex Example 2131 C'

export const FORMS_D = 'Alex Example 2131 D'

export const FORMS_E = 'Alex Example 2131 E'

export const FORMS_F = 'Alex Example 2131 F'

export async function formsFixtures(page: Page) {
	const today = core.zonedParts(new Date(), VN).date
	const wednesday = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const make = async (name: string, startTime: string) => {
		const id = await createCard(page, name, 60, null)
		const result = await api<ScheduleSeriesResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
			studentId: id,
			date: wednesday,
			startTime,
			durationMinutes: 60,
			repeats: 'weekly',
		})
		check(`series ${name} at ${startTime} created`, result.status === 201, String(result.status))
		return id
	}
	await make(FORMS_A, '18:00')
	await make(FORMS_B, '02:00')
	await make(FORMS_C, '22:00')
	await createCard(page, FORMS_D, 60, null)
	await createCard(page, FORMS_E, 60, null)
	await createCard(page, FORMS_F, 60, null)
	return { today, wednesday }
}

export async function formsSeriesBox(page: Page) {
	return page
		.getByRole('dialog')
		.locator('[data-slot="lesson-series"]')
		.evaluate((element) => {
			const rect = (node: Element) => node.getBoundingClientRect()
			const main = element.querySelector<HTMLElement>('[data-slot="lesson-series-main"]')
			const second = element.querySelector<HTMLElement>('[data-slot="lesson-series-second"]')
			const actions = element.querySelector<HTMLElement>('[data-slot="lesson-series-actions"]')
			const title = element.querySelector<HTMLElement>('p')
			const style = (node: Element | null | undefined) => (node ? getComputedStyle(node) : null)
			return {
				title: title?.textContent,
				titleWeight: style(title)?.fontWeight,
				titleSize: style(title)?.fontSize,
				main: main?.textContent,
				mainClass: main?.className ?? '',
				second: second?.textContent ?? null,
				secondClass: second?.className ?? '',
				secondSize: style(second)?.fontSize ?? null,
				secondBottom: second ? rect(second).bottom : rect(main!).bottom,
				mainBottom: rect(main!).bottom,
				actionsTop: rect(actions!).top,
				buttons: Array.from(actions!.querySelectorAll<HTMLButtonElement>('button')).map((button) =>
					button.textContent?.trim()
				),
			}
		})
}

export async function formsSeriesDialogs(
	page: Page,
	name: string,
	expected: { label: string; time: string; when: string; line: string }
) {
	const dialog = page.getByRole('dialog')
	const label = expected.label
	const box = await formsSeriesBox(page)
	check(
		`${label}: Whole series box is a column with Move series and End series under the text`,
		box.title === 'Whole series' &&
			box.titleWeight === '600' &&
			box.buttons.join('|') === 'Move series|End series' &&
			box.actionsTop >= box.secondBottom,
		JSON.stringify({ title: box.title, buttons: box.buttons, top: box.actionsTop, bottom: box.secondBottom })
	)
	check(
		`${label}: caption line is caption and names the series in VN`,
		box.mainClass.includes('text-caption') && box.main!.includes(`Every Wednesday at ${expected.time} VN · from `),
		box.main
	)
	check(
		`${label}: second zone line is micro and reads "${expected.line}"`,
		box.second === expected.line && box.secondClass.includes('text-micro') && box.secondSize === '11px',
		`${box.second} ${box.secondClass} ${box.secondSize}`
	)
	await dialog.getByRole('button', { name: 'End series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'End this series?' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	let facts = await seriesDialogFacts(page)
	check(
		`${label}: End series description is "${name}, every ${expected.when}."`,
		facts.text.includes(`${name}, every ${expected.when}.`),
		facts.text.slice(0, 140)
	)
	check(
		`${label}: End series hint is caption and muted`,
		facts.hint !== null &&
			facts.hint.startsWith('The last lesson will be on ') &&
			facts.hintClass.includes('text-caption') &&
			facts.hintClass.includes('text-muted-foreground'),
		`${facts.hint} ${facts.hintClass}`
	)
	return facts
}

export async function valueFacts(page: Page, selector: string, valueSelector?: string) {
	return page.evaluate(
		({ selector, valueSelector }) => {
			const root = document.querySelector<HTMLElement>(selector)
			const node = valueSelector ? root!.querySelector<HTMLElement>(valueSelector) : root
			const style = getComputedStyle(node!)
			const rect = node!.getBoundingClientRect()
			const wrapper = node!.closest<HTMLElement>('span[class*="text-box"]')
			return {
				text: node!.textContent?.trim() ?? '',
				lineHeight: style.lineHeight,
				overflow: `${style.overflowX}/${style.overflowY}`,
				height: Math.round(rect.height * 100) / 100,
				clientHeight: node!.clientHeight,
				scrollHeight: node!.scrollHeight,
				trim: wrapper ? getComputedStyle(wrapper).getPropertyValue('text-box-trim') : 'none',
			}
		},
		{ selector, valueSelector }
	)
}

export function valueClear(facts: Awaited<ReturnType<typeof valueFacts>>) {
	return facts.height >= 20 && facts.scrollHeight <= facts.clientHeight && facts.lineHeight === '20px'
}

export async function listFade(page: Page) {
	return page.evaluate(() => {
		const viewports = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="scroll-area-viewport"]')).filter(
			(element) =>
				element.closest<HTMLElement>('[role="listbox"]') !== null ||
				element.querySelector<HTMLElement>('[role="listbox"]') !== null
		)
		const viewport = viewports[viewports.length - 1]
		return {
			size: getComputedStyle(viewport).getPropertyValue('--scroll-fade-size').trim(),
			height: viewport.getBoundingClientRect().height,
			fade: getComputedStyle(viewport).maskImage !== 'none',
		}
	})
}

export async function forms() {
	cleanupFixtures('forms start', FORMS_LIKE)

	await withBrowser(
		{ width: 1440, height: 900 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const fx = await formsFixtures(page)
			const nav = { monday: core.mondayOf(fx.today) }
			await seriesForms(page, fx, nav)
			await fieldValues(page, fx, nav)
			const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		},
		() => cleanupFixtures('forms end', FORMS_LIKE)
	)
	if (failures() === 0) console.log('SCHEDULE_WEB_FORMS_OK')
}
