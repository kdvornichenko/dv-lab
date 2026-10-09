const spaces = /[\s   ]/g
const maxHundredths = 9999999

function roundHalfAway(value: number): number {
	const rounded = Math.round(Math.abs(value))
	return value < 0 ? 0 - rounded : rounded
}

export function parseLessons(text: string): number | null {
	const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.replace(spaces, ''))
	if (!match) return null
	const hundredths = Number(match[1] + (match[2] ?? '').padEnd(2, '0'))
	if (!Number.isSafeInteger(hundredths) || hundredths > maxHundredths) return null
	return hundredths
}

export function hundredthsToDecimal(hundredths: number): string {
	const sign = hundredths < 0 ? '-' : ''
	const text = String(Math.abs(hundredths)).padStart(3, '0')
	return `${sign}${text.slice(0, -2)}.${text.slice(-2)}`
}

export function decimalToHundredths(decimal: string): number {
	const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(decimal.trim())
	if (!match) throw new Error(`Invalid lessons decimal: ${decimal}`)
	const value = Number(match[2] + (match[3] ?? '').padEnd(2, '0'))
	return match[1] === '-' ? 0 - value : value
}

export function formatHundredths(hundredths: number): string {
	return hundredthsToDecimal(hundredths).replace(/\.?0+$/, '')
}

export function suggestLessons(
	amountMinor: number,
	currency: string | null,
	rate: { rateMinor: number; currency: string } | null
): number | null {
	if (rate === null || currency === null || rate.currency !== currency || rate.rateMinor <= 0) return null
	const hundredths = Math.round((amountMinor * 100) / rate.rateMinor)
	return hundredths > maxHundredths ? null : hundredths
}

export function creditedMinutes(hundredths: number | null, lessonMinutes: number): number {
	if (hundredths === null) return 0
	return roundHalfAway((hundredths * lessonMinutes) / 100)
}

export function lessonsToMinutes(hundredths: number, lessonMinutes: number): number {
	return roundHalfAway((hundredths * lessonMinutes) / 100)
}

export function formatLessons(minutes: number, lessonMinutes: number): string {
	return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, signDisplay: 'negative' }).format(
		minutes / lessonMinutes
	)
}

export function lessonsPhrase(minutes: number, lessonMinutes: number): string {
	const count = formatLessons(minutes, lessonMinutes)
	return count === '1' ? '1 lesson' : `${count} lessons`
}

export function localIsoDate(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
		date
	)
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
	return `${part('year')}-${part('month')}-${part('day')}`
}
