import type { PushScreen } from '@dv-lab/contracts'

export const PRESENCE_FRESH_MS = 90_000

type Presence = { accountId: string; screen: PushScreen; studentId: string | null; at: number }

const signals = new Map<string, Presence>()

export function recordPresence(
	accountId: string,
	endpoint: string,
	screen: PushScreen,
	studentId: string | null,
	now = new Date()
): void {
	const at = now.getTime()
	for (const [key, signal] of signals) if (at - signal.at > PRESENCE_FRESH_MS) signals.delete(key)
	signals.set(endpoint, { accountId, screen, studentId, at })
}

export function isPresent(endpoint: string, screen: PushScreen, studentId: string | null, now = new Date()): boolean {
	const signal = signals.get(endpoint)
	if (!signal) return false
	const age = now.getTime() - signal.at
	if (age > PRESENCE_FRESH_MS || signal.screen !== screen) return false
	return screen !== 'payments' || (studentId !== null && signal.studentId === studentId)
}
