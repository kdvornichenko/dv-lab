import { randomBytes } from 'node:crypto'

import { ROOT } from './paths.mjs'

const { loadConfig } = await import(`${ROOT}/apps/api/src/config.ts`)

const CALLBACK = '/api/google/callback'
const PRODUCTION_ORIGIN = 'https://app.example.test'
const TUNNEL_ORIGIN = 'https://tunnel.example.test'

function env(nodeEnv, appOrigin, redirectUri) {
	return {
		NODE_ENV: nodeEnv,
		PORT: '4000',
		APP_ORIGIN: appOrigin,
		DATABASE_URL: 'postgres://synthetic:synthetic@localhost:5432/dvlab_dev',
		GOOGLE_CALENDAR_ENABLED: 'true',
		GOOGLE_CLIENT_ID: 'synthetic-client-id',
		GOOGLE_CLIENT_SECRET: 'synthetic-client-secret',
		GOOGLE_REDIRECT_URI: redirectUri,
		GOOGLE_TOKEN_KEY_ID: 'synthetic',
		GOOGLE_TOKEN_KEYRING: JSON.stringify({ synthetic: randomBytes(32).toString('base64') }),
	}
}

function outcome(values) {
	try {
		const config = loadConfig(values)
		return config.calendar.enabled && config.calendar.redirectUri === values.GOOGLE_REDIRECT_URI
			? 'accepted'
			: 'mismatch'
	} catch (error) {
		return error instanceof Error && error.message === 'Invalid Google Calendar configuration' ? 'rejected' : 'other'
	}
}

const cases = [
	[
		'production, callback on APP_ORIGIN',
		env('production', PRODUCTION_ORIGIN, `${PRODUCTION_ORIGIN}${CALLBACK}`),
		'accepted',
	],
	[
		'production, callback on another origin',
		env('production', PRODUCTION_ORIGIN, `https://other.example.test${CALLBACK}`),
		'rejected',
	],
	[
		'production, localhost callback',
		env('production', PRODUCTION_ORIGIN, `http://localhost:3000${CALLBACK}`),
		'rejected',
	],
	[
		'production, http APP_ORIGIN',
		env('production', 'http://app.example.test', `http://app.example.test${CALLBACK}`),
		'rejected',
	],
	[
		'development, localhost callback',
		env('development', 'http://localhost:3000', `http://localhost:3000${CALLBACK}`),
		'accepted',
	],
	[
		'development, 127.0.0.1 callback',
		env('development', 'http://127.0.0.1:3000', `http://127.0.0.1:3000${CALLBACK}`),
		'accepted',
	],
	['development, tunnel callback', env('development', TUNNEL_ORIGIN, `${TUNNEL_ORIGIN}${CALLBACK}`), 'accepted'],
	[
		'development, plain http host',
		env('development', 'http://localhost:3000', `http://lan.example.test${CALLBACK}`),
		'rejected',
	],
	[
		'development, query in callback',
		env('development', 'http://localhost:3000', `http://localhost:3000${CALLBACK}?x=1`),
		'rejected',
	],
	[
		'development, hash in callback',
		env('development', 'http://localhost:3000', `http://localhost:3000${CALLBACK}#x`),
		'rejected',
	],
	[
		'development, credentials in callback',
		env('development', TUNNEL_ORIGIN, `https://user:pass@tunnel.example.test${CALLBACK}`),
		'rejected',
	],
]

for (const [mode, appOrigin, origin] of [
	['production', PRODUCTION_ORIGIN, PRODUCTION_ORIGIN],
	['development', 'http://localhost:3000', 'http://localhost:3000'],
	['development', TUNNEL_ORIGIN, TUNNEL_ORIGIN],
	['test', 'http://localhost:3000', 'http://localhost:3000'],
]) {
	for (const path of ['/api/google/other', '/google/callback', `${CALLBACK}/`, '/']) {
		const values = env(mode, appOrigin, `${origin}${path}`)
		if (mode === 'test') values.DATABASE_URL = 'postgres://synthetic:synthetic@localhost:5432/dvlab_test'
		cases.push([`${mode}, path ${path} on ${new URL(origin).protocol}`, values, 'rejected'])
	}
}

const failed = []
for (const [name, values, expected] of cases) {
	const actual = outcome(values)
	if (actual !== expected) failed.push(`${name}: expected ${expected}, got ${actual}`)
}

if (failed.length) {
	for (const line of failed) console.log(`FAIL ${line}`)
	process.exit(1)
}
console.log(`checked ${cases.length} cases`)
console.log('CALENDAR_CONFIG_OK')
