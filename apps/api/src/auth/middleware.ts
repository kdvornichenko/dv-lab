import { getConnInfo } from '@hono/node-server/conninfo'

import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { isIP } from 'node:net'
import type { z } from 'zod'

import { type AccountSummary, type Role, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@dv-lab/contracts'

import { errorBody } from '../request-context.ts'
import { type DbExecutor, readSession } from './sessions.ts'
import type { SignInOutcome } from './sign-in.ts'

export type AppEnv = {
	Variables: {
		requestId: string
		session: { account: AccountSummary; renewDue: boolean; token: string }
	}
}

type Refusal = Extract<SignInOutcome, { kind: 'locked' | 'busy' | 'unavailable' }>

const sessionCookie = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' } as const

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function originMatches(c: Context, appOrigin: string): boolean {
	return c.req.header('origin') === appOrigin
}

export const sameOrigin =
	(appOrigin: string): MiddlewareHandler =>
	async (c, next) => {
		if (SAFE_METHODS.has(c.req.method)) return next()
		const proven =
			c.req.header('origin') !== undefined
				? originMatches(c, appOrigin)
				: c.req.header('sec-fetch-site') === 'same-origin'
		if (!proven) return c.json(errorBody('forbidden_origin', 'Forbidden'), 403)
		await next()
	}

export function refusalResponse(c: Context, outcome: Refusal) {
	if (outcome.kind === 'locked') {
		c.header('Retry-After', String(outcome.retryAfterSeconds))
		return c.json(
			errorBody('locked', 'Too many attempts, try again in 15 minutes', {
				retryAfterSeconds: outcome.retryAfterSeconds,
			}),
			429
		)
	}
	if (outcome.kind === 'busy') {
		c.header('Retry-After', '1')
		return c.json(errorBody('busy', 'Sign-in is busy, try again in a moment'), 503)
	}
	return c.json(errorBody('unavailable', 'Sign-in is unavailable'), 503)
}

export function clientIp(c: Context, production: boolean): string | null {
	const forwarded = c.req.header('x-forwarded-for')
	if (forwarded !== undefined) {
		const nearest = forwarded.split(',').at(-1)?.trim() ?? ''
		return isIP(nearest) === 0 ? null : nearest
	}
	if (production) return null
	try {
		return getConnInfo(c).remote.address ?? null
	} catch {
		return null
	}
}

export const requireSession =
	(db: DbExecutor): MiddlewareHandler<AppEnv> =>
	async (c, next) => {
		const token = getCookie(c, SESSION_COOKIE)
		const session = await readSession(db, token)
		if (!session || token === undefined) return c.json(errorBody('unauthenticated', 'Sign in required'), 401)
		c.set('session', { ...session, token })
		await next()
	}

export const requireRole =
	(role: Role): MiddlewareHandler<AppEnv> =>
	async (c, next) => {
		if (c.get('session').account.role !== role) return c.json(errorBody('forbidden', 'Forbidden'), 403)
		await next()
	}

export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T> | null> {
	const contentType = c.req.header('content-type') ?? ''
	if (!contentType.toLowerCase().startsWith('application/json')) return null
	let body: unknown
	try {
		body = await c.req.json()
	} catch {
		return null
	}
	const parsed = schema.safeParse(body)
	return parsed.success ? parsed.data : null
}

export function setSessionCookie(c: Context, token: string): void {
	setCookie(c, SESSION_COOKIE, token, { ...sessionCookie, maxAge: SESSION_TTL_SECONDS })
}

export function clearSessionCookie(c: Context): void {
	setCookie(c, SESSION_COOKIE, '', { ...sessionCookie, maxAge: 0 })
}

export const noStore: MiddlewareHandler = async (c, next) => {
	await next()
	c.header('Cache-Control', 'no-store')
}
