export const VN = 'Asia/Ho_Chi_Minh'

function parts(now: Date, timeZone: string) {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(now)
}

function part(now: Date, timeZone: string, kind: Intl.DateTimeFormatPartTypes): string {
	const found = parts(now, timeZone).find((entry) => entry.type === kind)
	if (!found) throw new Error('Zoned clock is unavailable')
	return found.value
}

export function vnToday(now = new Date()): string {
	return zonedDate(now, VN)
}

export function zonedDate(now: Date, timeZone: string): string {
	return `${part(now, timeZone, 'year')}-${part(now, timeZone, 'month')}-${part(now, timeZone, 'day')}`
}

export function zonedTime(now: Date, timeZone: string): string {
	return `${part(now, timeZone, 'hour')}:${part(now, timeZone, 'minute')}`
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

function minuteNow(now: Date, timeZone: string): number {
	return Number(part(now, timeZone, 'hour')) * 60 + Number(part(now, timeZone, 'minute'))
}

export function assertDayWindow(timeZone = VN): void {
	const minute = minuteNow(new Date(), timeZone)
	if (minute < 10 || minute >= 1420) throw new Error('Account midnight is close; rerun outside the boundary window')
}

export function startedSlotToday(timeZone = VN): string {
	const slot = Math.max(0, Math.floor((minuteNow(new Date(), timeZone) - 30) / 15) * 15)
	return `${String(Math.floor(slot / 60)).padStart(2, '0')}:${String(slot % 60).padStart(2, '0')}`
}

export function shortDay(date: string): string {
	return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(
		new Date(`${date}T12:00:00Z`)
	)
}
