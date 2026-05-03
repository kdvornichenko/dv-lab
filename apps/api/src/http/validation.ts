import { zValidator } from '@hono/zod-validator'

import type { z, ZodType } from 'zod'

import type { ValidationErrorDetails } from '@teacher-crm/api-types'

import { apiError, errorResponse } from './errors'

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
		if (result.success !== false) return

		return errorResponse(
			context,
			400,
			apiError('VALIDATION_FAILED', 'Request body failed validation', validationDetails(result.error))
		)
	})
}

export function validateQuery<T extends ZodType>(schema: T) {
	return zValidator('query', schema, (result, context) => {
		if (result.success !== false) return

		return errorResponse(
			context,
			400,
			apiError('VALIDATION_FAILED', 'Request query failed validation', validationDetails(result.error))
		)
	})
}

export function validateParams<T extends ZodType>(schema: T) {
	return zValidator('param', schema, (result, context) => {
		if (result.success !== false) return

		return errorResponse(
			context,
			400,
			apiError('VALIDATION_FAILED', 'Request params failed validation', validationDetails(result.error))
		)
	})
}
