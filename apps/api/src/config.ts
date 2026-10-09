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

export type ApiConfig = z.infer<typeof schema> & { databaseUrl: string }

export function loadConfig(env: NodeJS.ProcessEnv): ApiConfig {
	const parsed = schema.safeParse(env)
	if (!parsed.success) throw new Error(`Invalid environment\n${z.prettifyError(parsed.error)}`)
	return { ...parsed.data, databaseUrl: resolveDatabaseUrl('app', env) }
}
