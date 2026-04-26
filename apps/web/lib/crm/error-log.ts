'use client'

export type CrmErrorLogEntry = {
	id: string
	source: string
	message: string
	createdAt: string
}

type SaveCrmErrorInput = {
	source: string
	message: string
}

const STORAGE_KEY = 'teacher-crm-error-log'
const ERROR_LOG_EVENT = 'teacher-crm-error-log-updated'
const MAX_ERRORS = 100

function hasStorage() {
	return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function createErrorId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `err_${crypto.randomUUID()}`
	return `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function parseErrors(value: string | null): CrmErrorLogEntry[] {
	if (!value) return []
	const parsed = JSON.parse(value) as unknown
	if (!Array.isArray(parsed)) return []
	return parsed.filter((item): item is CrmErrorLogEntry => {
		if (!item || typeof item !== 'object') return false
		const candidate = item as CrmErrorLogEntry
		return (
			typeof candidate.id === 'string' &&
			typeof candidate.source === 'string' &&
			typeof candidate.message === 'string' &&
			typeof candidate.createdAt === 'string'
		)
	})
}

function readErrors() {
	if (!hasStorage()) return []
	try {
		return parseErrors(window.localStorage.getItem(STORAGE_KEY))
	} catch {
		return []
	}
}

function writeErrors(errors: CrmErrorLogEntry[]) {
	if (!hasStorage()) return
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(errors))
	window.dispatchEvent(new CustomEvent(ERROR_LOG_EVENT))
}

export function listCrmErrors() {
	return readErrors()
}

export function saveCrmError(input: SaveCrmErrorInput) {
	const entry: CrmErrorLogEntry = {
		id: createErrorId(),
		source: input.source,
		message: input.message,
		createdAt: new Date().toISOString(),
	}
	writeErrors([entry, ...readErrors()].slice(0, MAX_ERRORS))
	return entry
}

export function deleteCrmError(errorId: string) {
	writeErrors(readErrors().filter((error) => error.id !== errorId))
}

export function clearCrmErrors() {
	writeErrors([])
}

export function subscribeCrmErrors(listener: () => void) {
	if (typeof window === 'undefined') return () => undefined
	const handleChange = () => listener()
	window.addEventListener(ERROR_LOG_EVENT, handleChange)
	window.addEventListener('storage', handleChange)
	return () => {
		window.removeEventListener(ERROR_LOG_EVENT, handleChange)
		window.removeEventListener('storage', handleChange)
	}
}
