import { config } from 'dotenv'
import { z } from 'zod'

config({ path: '../../.env.local' })
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

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.preprocess(cleanEnvValue, z.coerce.number().int().positive().catch(4000)),
	APP_ORIGIN: z.preprocess(firstOrigin, z.string().url().catch('http://localhost:3000')),
	CORS_ORIGINS: optionalString,
	SUPABASE_URL: optionalUrl,
	SUPABASE_ANON_KEY: optionalString,
	SUPABASE_SERVICE_ROLE_KEY: optionalString,
	DATABASE_URL: optionalString,
	POSTGRES_URL: optionalString,
	GOOGLE_CLIENT_ID: optionalString,
	GOOGLE_CLIENT_SECRET: optionalString,
	GOOGLE_REDIRECT_URI: optionalUrl,
	CALENDAR_TOKEN_ENCRYPTION_KEY: z.preprocess(cleanEnvValue, z.string().min(16).optional()),
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
