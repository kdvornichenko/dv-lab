import type { Context } from 'hono'

export type ApiErrorCode =
	| 'AUTH_NOT_CONFIGURED'
	| 'ERROR_NOT_FOUND'
	| 'FORBIDDEN'
	| 'INTERNAL_ERROR'
	| 'NOT_FOUND'
	| 'PAYMENT_NOT_FOUND'
	| 'STUDENT_NOT_FOUND'
	| 'UNAUTHENTICATED'
	| 'VALIDATION_FAILED'

export type ApiErrorBody = {
	ok: false
	error: {
		code: ApiErrorCode
		message: string
		requestId?: string
		details?: unknown
	}
}

const sensitiveValuePattern =
	/(service_role|jwt|secret|token|refresh_token|access_token|password|apikey|api_key|authorization)=([^&\s]+)/gi
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const urlCredentialPattern = /(\w+:\/\/)([^:@/\s]+):([^@/\s]+)@/gi
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export function redactSensitiveText(value: string) {
	return value
		.replace(bearerPattern, 'Bearer [REDACTED]')
		.replace(urlCredentialPattern, '$1[REDACTED]:[REDACTED]@')
		.replace(sensitiveValuePattern, '$1=[REDACTED]')
		.replace(emailPattern, '[REDACTED_EMAIL]')
}

export function sanitizeErrorDetails(value: unknown): unknown {
	if (typeof value === 'string') return redactSensitiveText(value)
	if (value instanceof Error) return { name: value.name, message: redactSensitiveText(value.message) }
	if (!value || typeof value !== 'object') return value
	if (Array.isArray(value)) return value.map(sanitizeErrorDetails)

	return Object.fromEntries(
		Object.entries(value).map(([key, entry]) => [
			key,
			/(secret|token|password|authorization|key|url)/i.test(key) ? '[REDACTED]' : sanitizeErrorDetails(entry),
		])
	)
}

export function apiError(code: ApiErrorCode, message: string, details?: unknown): ApiErrorBody {
	return {
		ok: false,
		error: {
			code,
			message: redactSensitiveText(message),
			...(details === undefined ? {} : { details: sanitizeErrorDetails(details) }),
		},
	}
}

export function errorResponse(context: Context, status: 400 | 401 | 403 | 404 | 500, body: ApiErrorBody) {
	const requestId = context.get('requestId')
	return context.json(
		{
			...body,
			error: {
				...body.error,
				...(typeof requestId === 'string' && requestId ? { requestId } : {}),
			},
		},
		status
	)
}

export function notFoundResponse(context: Context, message: string, code: ApiErrorCode = 'NOT_FOUND') {
	return errorResponse(context, 404, apiError(code, message))
}
