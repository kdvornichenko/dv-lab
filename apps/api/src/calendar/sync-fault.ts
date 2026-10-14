import { postgresCode, postgresErrorFields } from '@dv-lab/db'

import { CalendarFault, GoogleWriteFault } from './gateway.ts'

export type SyncStage =
	'token' | 'full_start' | 'page' | 'palette' | 'masters' | 'apply' | 'unseen' | 'inbound' | 'channel'
export type SyncTrace = { stage: SyncStage; pages: number }

const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

function safeName(error: unknown) {
	const name = error instanceof Error ? error.name : typeof error
	return SAFE_NAME.test(name) ? name : 'unknown'
}

function databaseFields(error: unknown) {
	const code = postgresCode(error)
	if (!code) return {}
	const fields = postgresErrorFields(error)
	return fields.code === code && fields.constraint ? { code, constraint: fields.constraint } : { code }
}

export function syncFault(error: unknown, signals: { stopped: AbortSignal; pass?: AbortSignal }) {
	return {
		errorName: safeName(error),
		...(error instanceof Error && error.cause !== undefined ? { causeName: safeName(error.cause) } : {}),
		...(error instanceof CalendarFault ? { code: error.code } : databaseFields(error)),
		...(error instanceof GoogleWriteFault ? { httpStatus: error.httpStatus, rateLimited: error.rateLimited } : {}),
		aborted: signals.stopped.aborted ? 'stop' : signals.pass?.aborted ? 'timeout' : null,
	}
}
