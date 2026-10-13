import { z } from 'zod'

import { resolveDatabaseUrl } from '@dv-lab/db'

const origin = z
	.url({ protocol: /^https?$/ })
	.transform((value) => new URL(value))
	.refine(
		(url) => url.pathname === '/' && url.search === '' && url.hash === '',
		'APP_ORIGIN must be an origin without path, query or hash'
	)
	.transform((url) => url.origin)

const schema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.coerce.number().int().min(1).max(65535),
	APP_ORIGIN: origin,
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
	SHUTDOWN_DEADLINE_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
	GIT_SHA: z.string().min(1).default('unknown'),
})

const keyId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
const keyring = z.record(
	keyId,
	z
		.string()
		.regex(/^[A-Za-z0-9+/]{43}=$/)
		.refine((value) => Buffer.from(value, 'base64').toString('base64') === value)
		.transform((value) => Buffer.from(value, 'base64'))
)

const calendarSchema = z.object({
	GOOGLE_CLIENT_ID: z.string().trim().min(1),
	GOOGLE_CLIENT_SECRET: z.string().trim().min(1),
	GOOGLE_REDIRECT_URI: z.string().min(1),
	GOOGLE_TOKEN_KEY_ID: keyId,
	GOOGLE_TOKEN_KEYRING: z.string().min(1),
})

const CALLBACK_PATH = '/api/google/callback'

type BaseConfig = Pick<z.infer<typeof schema>, 'NODE_ENV' | 'APP_ORIGIN'>

function redirectAllowed(value: string, base: BaseConfig): boolean {
	let url: URL
	try {
		url = new URL(value)
	} catch {
		return false
	}
	if (url.username !== '' || url.password !== '' || value !== `${url.origin}${CALLBACK_PATH}`) return false
	if (base.NODE_ENV === 'production')
		return base.APP_ORIGIN.startsWith('https://') && value === `${base.APP_ORIGIN}${CALLBACK_PATH}`
	if (url.protocol === 'https:') return true
	return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
}

export type CalendarConfig =
	| { enabled: false }
	| {
			enabled: true
			clientId: string
			clientSecret: string
			redirectUri: string
			activeKeyId: string
			keyring: Readonly<Record<string, Buffer>>
	  }

export type ChatConfig = { enabled: false } | { enabled: true; apiKey: string }

export type ApiConfig = z.infer<typeof schema> & {
	databaseUrl: string
	calendar: CalendarConfig
	chat: ChatConfig
}

export function loadConfig(env: NodeJS.ProcessEnv): ApiConfig {
	const parsed = schema.safeParse(env)
	if (!parsed.success) throw new Error(`Invalid environment\n${z.prettifyError(parsed.error)}`)
	return {
		...parsed.data,
		databaseUrl: resolveDatabaseUrl('app', env),
		calendar: loadCalendarConfig(env, parsed.data),
		chat: loadChatConfig(env),
	}
}

function loadChatConfig(env: NodeJS.ProcessEnv): ChatConfig {
	const raw = env.ANTHROPIC_API_KEY
	if (raw === undefined) return { enabled: false }
	const apiKey = raw.trim()
	if (apiKey === '') throw new Error('Invalid ANTHROPIC_API_KEY')
	return { enabled: true, apiKey }
}

function loadCalendarConfig(env: NodeJS.ProcessEnv, base: BaseConfig): CalendarConfig {
	const enabled = z.enum(['true', 'false']).default('false').safeParse(env.GOOGLE_CALENDAR_ENABLED)
	if (!enabled.success) throw new Error('Invalid GOOGLE_CALENDAR_ENABLED')
	if (enabled.data === 'false') return { enabled: false }
	const parsed = calendarSchema.safeParse(env)
	if (!parsed.success || !redirectAllowed(parsed.data.GOOGLE_REDIRECT_URI, base))
		throw new Error('Invalid Google Calendar configuration')
	const config = parsed.data
	try {
		const keys: unknown = JSON.parse(config.GOOGLE_TOKEN_KEYRING)
		const validated = keyring.safeParse(keys)
		if (!validated.success || !Object.hasOwn(validated.data, config.GOOGLE_TOKEN_KEY_ID)) {
			throw new Error('Invalid Google Calendar keyring')
		}
		return {
			enabled: true,
			clientId: config.GOOGLE_CLIENT_ID,
			clientSecret: config.GOOGLE_CLIENT_SECRET,
			redirectUri: config.GOOGLE_REDIRECT_URI,
			activeKeyId: config.GOOGLE_TOKEN_KEY_ID,
			keyring: validated.data,
		}
	} catch {
		throw new Error('Invalid Google Calendar keyring')
	}
}
