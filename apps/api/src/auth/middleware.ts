import { getConnInfo } from '@hono/node-server/conninfo'

import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { isIP } from 'node:net'
import type { z } from 'zod'

import { type AccountSummary, type Role, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@dv-lab/contracts'

import { errorBody } from '../request-context.ts'
import { type DbExecutor, readSession } from './sessions.ts'

export type AppEnv = {
	Variables: {
		requestId: string
		session: { account: AccountSummary; renewDue: boolean; token: string }
	}
}

const sessionCookie = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' } as const

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
