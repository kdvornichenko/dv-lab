'use client'

import type { CrmErrorLogEntry, SaveCrmErrorInput } from '@teacher-crm/api-types'

import { teacherCrmApi } from './api'

const ERROR_LOG_EVENT = 'teacher-crm-error-log-updated'

function notifyErrorLogChanged() {
	if (typeof window === 'undefined') return
	window.dispatchEvent(new CustomEvent(ERROR_LOG_EVENT))
}

export type { CrmErrorLogEntry }

export async function listCrmErrors() {
	return (await teacherCrmApi.listCrmErrors()).errors
}

export async function saveCrmError(input: SaveCrmErrorInput) {
	const entry = (await teacherCrmApi.saveCrmError(input)).error
	notifyErrorLogChanged()
	return entry
}

export async function deleteCrmError(errorId: string) {
	const entry = (await teacherCrmApi.deleteCrmError(errorId)).error
	notifyErrorLogChanged()
	return entry
}

export async function clearCrmErrors() {
	await teacherCrmApi.clearCrmErrors()
	notifyErrorLogChanged()
}

export function subscribeCrmErrors(listener: () => void) {
	if (typeof window === 'undefined') return () => undefined
	const handleChange = () => listener()
	window.addEventListener(ERROR_LOG_EVENT, handleChange)
	return () => {
		window.removeEventListener(ERROR_LOG_EVENT, handleChange)
	}
}
