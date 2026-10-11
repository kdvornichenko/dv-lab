export const VN = 'Asia/Ho_Chi_Minh'

function parts(now: Date) {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone: VN,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(now)
}

function part(now: Date, kind: Intl.DateTimeFormatPartTypes): string {
	const found = parts(now).find((entry) => entry.type === kind)
	if (!found) throw new Error('Vietnam clock is unavailable')
	return found.value
}

export function vnToday(now = new Date()): string {
	return `${part(now, 'year')}-${part(now, 'month')}-${part(now, 'day')}`
}

export function addDays(date: string, amount: number): string {
	const value = new Date(`${date}T00:00:00Z`)
	value.setUTCDate(value.getUTCDate() + amount)
	return value.toISOString().slice(0, 10)
}

export function mondayOf(date: string): string {
	const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7
	return addDays(date, 1 - weekday)
}

function minuteNow(now: Date): number {
	return Number(part(now, 'hour')) * 60 + Number(part(now, 'minute'))
}

export function assertDayWindow(): void {
	const minute = minuteNow(new Date())
	if (minute < 10 || minute >= 1420) throw new Error('Vietnam midnight is close: run after 00:10 VN')
}

export function startedSlotToday(): string {
	const slot = Math.max(0, Math.floor((minuteNow(new Date()) - 30) / 15) * 15)
	return `${String(Math.floor(slot / 60)).padStart(2, '0')}:${String(slot % 60).padStart(2, '0')}`
}

export function shortDay(date: string): string {
	return new Intl.DateTimeFormat('en-GB', { timeZone: VN, day: 'numeric', month: 'short' }).format(
		new Date(`${date}T12:00:00Z`)
	)
}
