import { apiRequest } from '@/lib/api-client'
import { coveredCalendarWindow } from '@/lib/lesson-actions'

import {
	calendarCommandReceipt,
	calendarCommandSnapshot,
	googleConnectionSnapshot,
	errorCodes,
	googleScheduleWindow,
	googleUnresolvedCommandsResponse,
	timeZoneIdentity,
	type CalendarCommandSnapshot,
	type ErrorCode,
	type GoogleScheduleWindow,
} from '@dv-lab/contracts'
import { mondayOf, scheduleToday } from '@dv-lab/core'

export async function sameCalendarAccount(accountId: string): Promise<boolean> {
	const result = await apiRequest<unknown>('GET', '/auth/me')
	if (!result.ok || typeof result.data !== 'object' || result.data === null || !('account' in result.data)) return false
	const account = result.data.account
	return (
		typeof account === 'object' &&
		account !== null &&
		'id' in account &&
		account.id === accountId &&
		'role' in account &&
		account.role === 'teacher'
	)
}

export async function readCommand(
	path: string
): Promise<{ kind: 'ready'; command: CalendarCommandSnapshot } | { kind: 'missing' | 'unavailable' }> {
	const result = await apiRequest<unknown>('GET', path)
	if (!result.ok) return { kind: result.status === 404 ? 'missing' : 'unavailable' }
	const parsed = calendarCommandSnapshot.safeParse(result.data)
	return parsed.success ? { kind: 'ready', command: parsed.data } : { kind: 'unavailable' }
}

export async function readUnresolved() {
	const [commands, connection] = await Promise.all([
		apiRequest<unknown>('GET', '/google/commands?state=unresolved'),
		readCalendarConnection(),
	])
	if (!commands.ok || connection === null) return null
	const list = googleUnresolvedCommandsResponse.safeParse(commands.data)
	return list.success ? { commands: list.data.commands, connection } : null
}

export async function readCalendarConnection() {
	const result = await apiRequest<unknown>('GET', '/google/connection')
	if (!result.ok) return null
	const parsed = googleConnectionSnapshot.safeParse(result.data)
	return parsed.success ? parsed.data : null
}

export async function postCalendarCommand(
	path: string,
	body: object
): Promise<
	{ kind: 'accepted'; commandId: string } | { kind: 'rejected'; code: ErrorCode | null } | { kind: 'unknown' }
> {
	const result = await apiRequest<unknown>('POST', path, body)
	if (result.ok && result.status === 202) {
		const parsed = calendarCommandReceipt.safeParse(result.data)
		if (parsed.success) return { kind: 'accepted', commandId: parsed.data.commandId }
	}
	if (
		!result.ok &&
		typeof result.error === 'object' &&
		result.error !== null &&
		errorCodes.includes(result.error.code) &&
		[400, 401, 403, 409, 422].includes(result.status)
	)
		return { kind: 'rejected', code: result.error.code }
	return { kind: 'unknown' }
}

export async function resumeCalendarCommand(commandId: string) {
	return apiRequest<unknown>('POST', `/google/commands/${encodeURIComponent(commandId)}/resume`, {})
}

export async function readCalendarWeek(date?: string): Promise<GoogleScheduleWindow | null> {
	let start = date === undefined ? null : mondayOf(date)
	if (start === null) {
		const result = await apiRequest<unknown>('GET', '/settings')
		if (!result.ok || typeof result.data !== 'object' || result.data === null || !('settings' in result.data))
			return null
		const settings = result.data.settings
		if (
			typeof settings !== 'object' ||
			settings === null ||
			!('defaultTimeZone' in settings) ||
			typeof settings.defaultTimeZone !== 'string'
		)
			return null
		const timeZone = timeZoneIdentity(settings.defaultTimeZone)
		if (timeZone === null) return null
		start = mondayOf(scheduleToday(new Date(), timeZone))
	}
	const result = await apiRequest<unknown>('GET', `/schedule/week?start=${start}`)
	if (!result.ok) return null
	const parsed = googleScheduleWindow.safeParse(result.data)
	return parsed.success ? coveredCalendarWindow(parsed.data) : null
}
