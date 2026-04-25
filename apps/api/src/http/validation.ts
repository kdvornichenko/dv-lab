import { zValidator } from '@hono/zod-validator'

import type { z, ZodType } from 'zod'

import type { ValidationErrorDetails } from '@teacher-crm/api-types'

function validationDetails(error: z.ZodError): ValidationErrorDetails {
	return {
		issues: error.issues.map((issue) => ({
			field: issue.path.map(String).join('.'),
			message: issue.message,
			code: issue.code,
		})),
	}
}

export function validateJson<T extends ZodType>(schema: T) {
	return zValidator('json', schema, (result, context) => {
		if (result.success) return

		return context.json(
			{
				ok: false,
				error: {
					code: 'VALIDATION_FAILED',
					message: 'Request body failed validation',
					details: validationDetails(result.error as z.ZodError),
				},
			},
			400
		)
	})
}

export function validateQuery<T extends ZodType>(schema: T) {
	return zValidator('query', schema, (result, context) => {
		if (result.success) return

		return context.json(
			{
				ok: false,
				error: {
					code: 'VALIDATION_FAILED',
					message: 'Request query failed validation',
					details: validationDetails(result.error as z.ZodError),
				},
			},
			400
		)
	})
}
