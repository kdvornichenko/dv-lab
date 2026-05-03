import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const repoRoot = resolve(apiRoot, '../..')

config({ path: resolve(repoRoot, '.env.local') })
config({ path: resolve(repoRoot, '.env') })
config({ path: resolve(apiRoot, '.env') })
config()

function cleanEnvValue(value: unknown) {
	if (typeof value !== 'string') return value
	const trimmedValue = value.trim()
	return trimmedValue.length > 0 ? trimmedValue : undefined
}

function firstEnvValue(...keys: string[]) {
	for (const key of keys) {
		const value = cleanEnvValue(process.env[key])
		if (value !== undefined) return value
	}
	return undefined
}

function firstOrigin(value: unknown) {
	const cleanedValue = cleanEnvValue(value)
	if (typeof cleanedValue !== 'string') return cleanedValue
	return cleanedValue.split(',')[0]?.trim() || undefined
}

const optionalString = z.preprocess(cleanEnvValue, z.string().optional())
const optionalUrl = z.preprocess(cleanEnvValue, z.string().url().optional())

const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
		PORT: z.preprocess(cleanEnvValue, z.coerce.number().int().positive().catch(4000)),
		APP_ORIGIN: z.preprocess(firstOrigin, z.string().url().catch('http://localhost:3000')),
		CORS_ORIGINS: optionalString,
		SUPABASE_URL: optionalUrl,
		SUPABASE_ANON_KEY: optionalString,
		SUPABASE_SERVICE_ROLE_KEY: optionalString,
		TEACHER_CRM_TEACHER_EMAILS: optionalString,
		DATABASE_URL: optionalString,
		POSTGRES_URL: optionalString,
		GOOGLE_CLIENT_ID: optionalString,
		GOOGLE_CLIENT_SECRET: optionalString,
		GOOGLE_REDIRECT_URI: optionalUrl,
		CALENDAR_TOKEN_ENCRYPTION_KEY: z.preprocess(cleanEnvValue, z.string().min(16).optional()),
	})
	.superRefine((env, context) => {
		const hasDatabaseUrl = Boolean(env.DATABASE_URL ?? env.POSTGRES_URL)

		if (env.NODE_ENV === 'production' && !hasDatabaseUrl) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['DATABASE_URL'],
				message: 'DATABASE_URL or POSTGRES_URL is required in production',
			})
		}

		if (env.NODE_ENV === 'production' && !env.SUPABASE_URL) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['SUPABASE_URL'],
				message: 'SUPABASE_URL is required in production',
			})
		}

		if (env.NODE_ENV === 'production' && !env.SUPABASE_ANON_KEY) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['SUPABASE_ANON_KEY'],
				message: 'SUPABASE_ANON_KEY is required in production',
			})
		}

		if (env.NODE_ENV === 'production' && hasDatabaseUrl && !env.CALENDAR_TOKEN_ENCRYPTION_KEY) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['CALENDAR_TOKEN_ENCRYPTION_KEY'],
				message: 'CALENDAR_TOKEN_ENCRYPTION_KEY is required in production when database storage is configured',
			})
		}
	})

const rawEnv = {
	...process.env,
	SUPABASE_URL: firstEnvValue('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
	SUPABASE_ANON_KEY: firstEnvValue(
		'SUPABASE_ANON_KEY',
		'NEXT_PUBLIC_SUPABASE_ANON_KEY',
		'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
	),
}

export const serverEnv = envSchema.parse(rawEnv)

export const databaseUrl =
	serverEnv.NODE_ENV === 'test' ? undefined : (serverEnv.DATABASE_URL ?? serverEnv.POSTGRES_URL)

export const isDatabaseConfigured = Boolean(databaseUrl)
