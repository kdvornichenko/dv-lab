import type { CalendarEventColor } from '@dv-lab/contracts'

interface EventPaint {
	fill: string
	ink: string
}

const INK_HEX = '#1d1d1d'
const WHITE_HEX = '#ffffff'
const EVENT_INK = 'var(--gcal-event-ink)'

const FALLBACK_PALETTE: Record<string, string> = {
	'1': '#a4bdfc',
	'2': '#7ae7bf',
	'3': '#dbadff',
	'4': '#ff887c',
	'5': '#fbd75b',
	'6': '#ffb878',
	'7': '#46d6db',
	'8': '#e1e1e1',
	'9': '#5484ed',
	'10': '#51b749',
	'11': '#dc2127',
}

function channels(hex: string): [number, number, number] {
	return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [number, number, number]
}

function luminance(hex: string): number {
	const [red, green, blue] = channels(hex).map((value) => {
		const unit = value / 255
		return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
	}) as [number, number, number]
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(first: string, second: string): number {
	const one = luminance(first)
	const two = luminance(second)
	return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05)
}

export function inkFor(background: string): string {
	return contrastRatio(background, WHITE_HEX) > contrastRatio(background, INK_HEX) ? WHITE_HEX : EVENT_INK
}

export function eventPaint(color: CalendarEventColor): EventPaint | null {
	if (color.background !== null) return { fill: color.background, ink: inkFor(color.background) }
	const fallback = color.id === null ? undefined : FALLBACK_PALETTE[color.id]
	if (fallback === undefined) return null
	return { fill: `var(--gcal-event-${color.id})`, ink: inkFor(fallback) }
}
