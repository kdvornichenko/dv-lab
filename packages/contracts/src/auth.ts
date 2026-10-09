import { z } from 'zod'

export const signInRequest = z.object({
	login: z.string(),
	password: z.string(),
})

export const createStudentRequest = z.object({
	login: z.string(),
	displayName: z.string(),
	password: z.string().nullish(),
})

export const changePasswordRequest = z.object({
	currentPassword: z.string(),
	newPassword: z.string(),
})

export const errorCodes = [] as const
