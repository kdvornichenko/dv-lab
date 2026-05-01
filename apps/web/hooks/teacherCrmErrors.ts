'use client'

import { toast } from 'sonner'

import { saveCrmError } from '@/lib/crm/error-log'

const sensitiveValuePattern =
	/(service_role|jwt|secret|token|refresh_token|access_token|password|apikey|api_key|authorization)=([^&\s]+)/gi
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const urlCredentialPattern = /(\w+:\/\/)([^:@/\s]+):([^@/\s]+)@/gi
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export function redactCrmErrorText(value: string) {
	return value
		.replace(bearerPattern, 'Bearer [REDACTED]')
		.replace(urlCredentialPattern, '$1[REDACTED]:[REDACTED]@')
		.replace(sensitiveValuePattern, '$1=[REDACTED]')
		.replace(emailPattern, '[REDACTED_EMAIL]')
}

export function crmErrorMessage(error: unknown) {
	return redactCrmErrorText(error instanceof Error ? error.message : 'Teacher CRM API request failed')
}

export function reportCrmError(source: string, error: unknown) {
	const message = crmErrorMessage(error)
	void saveCrmError({ source, message }).catch((logError) => {
		console.error('[teacher-crm] failed to persist CRM error', logError)
	})
	toast.error('CRM request failed', { description: message })
}
