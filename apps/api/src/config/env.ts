import { config } from 'dotenv'
import { z } from 'zod'

config({ path: '../../.env.local' })
config()

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.coerce.number().int().positive().default(4000),
	APP_ORIGIN: z.string().url().default('http://localhost:3000'),
	SUPABASE_URL: z.string().url().optional(),
	SUPABASE_ANON_KEY: z.string().optional(),
	SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
	DATABASE_URL: z.string().optional(),
	POSTGRES_URL: z.string().optional(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	GOOGLE_REDIRECT_URI: z.string().url().optional(),
})

export const serverEnv = envSchema.parse(process.env)

export const databaseUrl =
	serverEnv.NODE_ENV === 'test' ? undefined : (serverEnv.DATABASE_URL ?? serverEnv.POSTGRES_URL)
