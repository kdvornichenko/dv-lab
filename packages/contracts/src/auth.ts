import { z } from 'zod'

import {
	LOGIN_MAX_LENGTH,
	MANUAL_PASSWORD_MAX_LENGTH,
	MANUAL_PASSWORD_MIN_LENGTH,
	SIGN_IN_PASSWORD_MAX_LENGTH,
	isDisplayNameLength,
	isStudentLogin,
	normalizeDisplayName,
	normalizeLogin,
	passwordLength,
} from './identity.ts'

const isManualPasswordLength = (password: string) => {
	const length = passwordLength(password)
	return length >= MANUAL_PASSWORD_MIN_LENGTH && length <= MANUAL_PASSWORD_MAX_LENGTH
}

export const signInRequest = z.object({
	login: z.string().trim().toLowerCase().min(1).max(LOGIN_MAX_LENGTH),
	password: z.string().min(1).max(SIGN_IN_PASSWORD_MAX_LENGTH),
})

export const createStudentRequest = z.object({
	login: z.string().transform(normalizeLogin).refine(isStudentLogin),
	displayName: z.string().transform(normalizeDisplayName).refine(isDisplayNameLength),
	password: z
		.string()
		.nullish()
		.transform((password) => (password === undefined || password === null || password === '' ? null : password))
		.refine((password) => password === null || isManualPasswordLength(password)),
})

export const createStudentAccountRequest = createStudentRequest.omit({ displayName: true })

export const changePasswordRequest = z.object({
	currentPassword: z.string().min(1).max(SIGN_IN_PASSWORD_MAX_LENGTH),
	newPassword: z.string().refine(isManualPasswordLength),
})

export const errorCodes = [
	'invalid_request',
	'unauthenticated',
	'invalid_credentials',
	'forbidden',
	'forbidden_origin',
	'not_found',
	'login_taken',
	'wrong_current_password',
	'password_unchanged',
	'card_has_account',
	'account_already_linked',
	'term_exists',
	'payment_already_assigned',
	'locked',
	'busy',
	'unavailable',
	'internal_error',
] as const

export type ErrorCode = (typeof errorCodes)[number]

export type ErrorResponse = {
	error: { code: ErrorCode; message: string; requestId?: string; retryAfterSeconds?: number }
}

export type Role = 'teacher' | 'student'

export type AccountStatus = 'active' | 'deactivated'

export type AccountSummary = { id: string; login: string; displayName: string; role: Role }

export type SignInResponse = { account: AccountSummary }

export type MeResponse = { account: AccountSummary; renewDue: boolean }

export type StudentAccount = {
	id: string
	login: string
	displayName: string
	status: AccountStatus
	createdAt: string
}

export type CreateStudentAccountResponse = { account: StudentAccount; generatedPassword: string | null }

export type StudentAccountResponse = { account: StudentAccount }

export type AccountCandidatesResponse = { accounts: StudentAccount[] }
