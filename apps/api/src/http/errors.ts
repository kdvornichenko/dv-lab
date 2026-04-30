import type { Context } from 'hono'

export type ApiErrorCode =
	| 'AUTH_NOT_CONFIGURED'
	| 'ERROR_NOT_FOUND'
	| 'FORBIDDEN'
	| 'INTERNAL_ERROR'
	| 'NOT_FOUND'
	| 'PAYMENT_NOT_FOUND'
	| 'UNAUTHENTICATED'
	| 'VALIDATION_FAILED'

export type ApiErrorBody = {
	ok: false
	error: {
		code: ApiErrorCode
		message: string
		details?: unknown
	}
}

export function apiError(code: ApiErrorCode, message: string, details?: unknown): ApiErrorBody {
	return {
		ok: false,
		error: {
			code,
			message,
			...(details === undefined ? {} : { details }),
		},
	}
}

export function errorResponse(context: Context, status: 400 | 401 | 403 | 404 | 500, body: ApiErrorBody) {
	return context.json(body, status)
}

export function notFoundResponse(context: Context, message: string, code: ApiErrorCode = 'NOT_FOUND') {
	return errorResponse(context, 404, apiError(code, message))
}
