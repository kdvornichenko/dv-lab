import type { Page, Locator } from 'playwright-core'

import { check } from '../browser-context.ts'

export async function readBlocks(page: Page) {
	return page.evaluate(() => {
		const probe = document.createElement('div')
		probe.style.background = 'var(--selected)'
		document.body.append(probe)
		const selected = getComputedStyle(probe).backgroundColor
		probe.remove()
		const columns = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="week-grid-column"]'))
		const blocks = Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-slot="week-grid-column"] button[data-key]')
		).map((element) => {
			const column = element.closest<HTMLElement>('[data-slot="week-grid-column"]')
			const rect = element.getBoundingClientRect()
			const columnRect = column!.getBoundingClientRect()
			const style = getComputedStyle(element)
			const name = element.querySelector<HTMLElement>('span')
			return {
				key: element.dataset.key,
				slot: element.getAttribute('data-slot'),
				label: element.getAttribute('aria-label'),
				text: element.textContent,
				lines: Array.from(element.querySelectorAll<HTMLElement>('span')).map((span) => span.textContent),
				title: element.getAttribute('title'),
				date: column!.dataset.date,
				left: rect.left - columnRect.left,
				width: rect.width,
				top: rect.top - columnRect.top,
				height: rect.height,
				background: style.backgroundColor,
				color: style.color,
				outlineStyle: style.outlineStyle,
				outlineWidth: style.outlineWidth,
				decoration: name ? getComputedStyle(name).textDecorationLine : '',
			}
		})
		return {
			selected,
			transparent: 'rgba(0, 0, 0, 0)',
			columnWidth: columns[0]?.getBoundingClientRect().width ?? 0,
			blocks,
			description:
				document.querySelector<HTMLElement>('h1')?.parentElement?.querySelector<HTMLElement>('div')?.textContent ?? '',
			live: document.querySelector<HTMLElement>('[aria-live="polite"].sr-only')?.textContent ?? '',
			h1: document.querySelector<HTMLElement>('h1')?.textContent,
		}
	})
}

export const ofCard = (data: Awaited<ReturnType<typeof readBlocks>>, name: string) =>
	data.blocks.filter((block) => block.label!.startsWith(`${name},`))

export const blockLocator = (page: Page, name: string, date: string) =>
	page.locator(`[data-slot="week-grid-column"][data-date="${date}"] button[aria-label^="${name}, "]`).first()

export async function pairOf(locator: Locator) {
	return locator.evaluate((root) => {
		const main = root.querySelector<HTMLElement>('[data-slot="time-main"]')
		const second = root.querySelector<HTMLElement>('[data-slot="time-second"]')
		const style = second ? getComputedStyle(second) : null
		return {
			main: main?.textContent ?? null,
			second: second?.textContent ?? null,
			size: style?.fontSize,
			line: style?.lineHeight,
			muted: second ? second.className.includes('text-muted-foreground') : false,
			numeric: style?.fontVariantNumeric ?? '',
			after: main && second ? Boolean(main.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) : false,
			stacked: main && second ? second.getBoundingClientRect().top >= main.getBoundingClientRect().bottom - 1 : false,
		}
	})
}

export function checkPair(
	label: string,
	pair: Awaited<ReturnType<typeof pairOf>>,
	main: string,
	second: string | null
) {
	check(`${label}: main line is ${main}`, pair.main === main, String(pair.main))
	if (second === null) {
		check(`${label}: no second line without a second zone`, pair.second === null, String(pair.second))
		return
	}
	check(`${label}: second line is ${second}`, pair.second === second, String(pair.second))
	check(
		`${label}: second line is 11px over 14px`,
		pair.size === '11px' && pair.line === '14px',
		`${pair.size}/${pair.line}`
	)
	check(
		`${label}: second line is muted, tabular and under the main line`,
		pair.muted && pair.numeric.includes('tabular-nums') && pair.after && pair.stacked,
		JSON.stringify(pair)
	)
}

export async function tooltipFacts(page: Page) {
	return page.evaluate(() => {
		const content = document.querySelector<HTMLElement>('[data-slot="event-tooltip"]')
		if (!content) return null
		const surface = content.parentElement
		const style = getComputedStyle(surface!)
		const probe = document.createElement('div')
		probe.style.background = 'var(--surface-4)'
		document.body.append(probe)
		const expected = getComputedStyle(probe).backgroundColor
		probe.className = 'rounded-xl'
		const expectedRadius = getComputedStyle(probe).borderTopLeftRadius
		probe.remove()
		return {
			nameWeight: getComputedStyle(content.querySelector<HTMLElement>('span')!).fontWeight,
			expectedRadius,
			text: content.textContent,
			background: style.backgroundColor,
			expected,
			width: surface!.getBoundingClientRect().width,
			radius: style.borderTopLeftRadius,
			padding: style.paddingTop,
			shadow: style.boxShadow,
			focusable: surface!.querySelector<HTMLInputElement>('button, a, input, [tabindex]') !== null,
		}
	})
}
