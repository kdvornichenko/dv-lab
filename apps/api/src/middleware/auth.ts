import { createClient, type User } from '@supabase/supabase-js'

import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { createHash } from 'node:crypto'

import {
	buildPermissionSet,
	can,
	normaliseRoleKeys,
	type ActionOf,
	type PermissionDomain,
	type PermissionKey,
	type RoleKey,
} from '@teacher-crm/rbac'

import { serverEnv } from '../config/env'
import type { StoreScope } from '../services/store-scope'

export type ApiUser = {
	id: string
	email: string | null
	roles: RoleKey[]
	permissions: PermissionKey[]
}

declare module 'hono' {
	interface ContextVariableMap {
		user: ApiUser | undefined
	}
}

let supabaseAuthClient: ReturnType<typeof createClient> | null = null
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getSupabaseAuthClient() {
	if (!serverEnv.SUPABASE_URL || !serverEnv.SUPABASE_ANON_KEY) return null
	supabaseAuthClient ??= createClient(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_ANON_KEY, {
		auth: { persistSession: false, autoRefreshToken: false },
	})
	return supabaseAuthClient
}

function bearerToken(value: string | undefined) {
	if (!value?.startsWith('Bearer ')) return null
	return value.slice('Bearer '.length).trim() || null
}

function devAuthUserId(value: string) {
	const trimmedValue = value.trim()
	if (uuidPattern.test(trimmedValue)) return trimmedValue.toLowerCase()

	const digest = createHash('sha256').update(`teacher-crm-demo-user:${trimmedValue}`).digest('hex')
	const variant = ((Number.parseInt(digest[16] ?? '8', 16) & 0x3) | 0x8).toString(16)
	return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}

function rolesFromUser(user: User): RoleKey[] {
	const appRoles = Array.isArray(user.app_metadata.roles) ? user.app_metadata.roles : []
	const userRoles = Array.isArray(user.user_metadata.roles) ? user.user_metadata.roles : []
	const roles = [...appRoles, ...userRoles].filter((role): role is string => typeof role === 'string')
	const normalisedRoles = normaliseRoleKeys(roles)
	if (normalisedRoles.length > 0) return normalisedRoles
	if (serverEnv.NODE_ENV !== 'production') return ['teacher']
	return []
}

function apiUserFromSupabase(user: User): ApiUser {
	const roles = rolesFromUser(user)
	return {
		id: user.id,
		email: user.email ?? null,
		roles,
		permissions: Array.from(buildPermissionSet(roles)),
	}
}

export const optionalAuth = createMiddleware(async (context, next) => {
	const token = bearerToken(context.req.header('authorization'))
	if (token) {
		const supabase = getSupabaseAuthClient()
		if (!supabase) {
			return context.json(
				{ ok: false, error: { code: 'AUTH_NOT_CONFIGURED', message: 'Supabase auth is not configured' } },
				500
			)
		}

		const { data, error } = await supabase.auth.getUser(token)
		if (error || !data.user) {
			return context.json(
				{ ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired access token' } },
				401
			)
		}

		context.set('user', apiUserFromSupabase(data.user))
		await next()
		return
	}

	const demoUserId = context.req.header('x-demo-user')
	if (demoUserId && serverEnv.NODE_ENV !== 'production') {
		const roles: RoleKey[] = ['teacher']
		context.set('user', {
			id: devAuthUserId(demoUserId),
			email: context.req.header('x-demo-email') ?? 'teacher@example.com',
			roles,
			permissions: Array.from(buildPermissionSet(roles)),
		})
	}

	await next()
})

export function actorFromContext(context: Context): StoreScope {
	const user = context.get('user')
	if (!user) throw new Error('Authenticated user missing from request context')
	return { teacherId: user.id, email: user.email }
}

export function requirePermission<D extends PermissionDomain>(domain: D, action: ActionOf<D>) {
	return createMiddleware(async (context, next) => {
		const user = context.get('user')
		if (!user) {
			return context.json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }, 401)
		}

		if (!can(new Set(user.permissions), domain, action)) {
			return context.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } }, 403)
		}

		await next()
	})
}

export const requireAuth = createMiddleware(async (context, next) => {
	const user = context.get('user')
	if (!user) {
		return context.json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }, 401)
	}

	await next()
})
