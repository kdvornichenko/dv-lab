const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatDateOnly(value: Date) {
	return [
		value.getFullYear(),
		String(value.getMonth() + 1).padStart(2, '0'),
		String(value.getDate()).padStart(2, '0'),
	].join('-')
}

export function todayDateOnly(now = new Date()) {
	return formatDateOnly(now)
}

export function teacherDateOnlyFromInstant(value: string | Date) {
	const date = value instanceof Date ? value : new Date(value)
	return Number.isNaN(date.getTime()) ? '' : formatDateOnly(date)
}

export function parseDateOnly(value: string) {
	const match = DATE_ONLY_PATTERN.exec(value)
	if (!match) return undefined

	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	const date = new Date(year, month - 1, day)

	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
		return undefined
	}

	return date
}

export function isDateOnly(value: string) {
	return Boolean(parseDateOnly(value))
}

export function dateOnlyFromApiValue(value: string | Date) {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : formatDateOnly(value)
	const prefix = value.slice(0, 10)
	if (parseDateOnly(prefix)) return prefix
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? '' : formatDateOnly(date)
}

export function dateOnlyToApiIso(value: string) {
	return parseDateOnly(value) ? `${value}T00:00:00.000Z` : ''
}

export function isSameTeacherMonth(value: string | Date, anchor = new Date()) {
	const date = value instanceof Date ? value : new Date(value)
	return (
		!Number.isNaN(date.getTime()) &&
		date.getFullYear() === anchor.getFullYear() &&
		date.getMonth() === anchor.getMonth()
	)
}
