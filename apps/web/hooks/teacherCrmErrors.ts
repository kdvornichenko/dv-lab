'use client'

import { toast } from 'sonner'

import { saveCrmError } from '@/lib/crm/error-log'

export function crmErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'Teacher CRM API request failed'
}

export function reportCrmError(source: string, error: unknown) {
	const message = crmErrorMessage(error)
	void saveCrmError({ source, message }).catch((logError) => {
		console.error('[teacher-crm] failed to persist CRM error', logError)
	})
	toast.error('CRM request failed', { description: message })
}
