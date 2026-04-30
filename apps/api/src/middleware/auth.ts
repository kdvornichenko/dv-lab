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
import { apiError, errorResponse } from '../http/errors'
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
		storeNamespace: string | undefined
	}
}

let supabaseAuthClient: ReturnType<typeof createClient> | null = null
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type AuthClient = ReturnType<typeof createClient>
type AuthEnv = Pick<typeof serverEnv, 'NODE_ENV' | 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>

function getSupabaseAuthClient(env: AuthEnv = serverEnv) {
	if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null
	supabaseAuthClient ??= createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
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
	return ['teacher']
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

export function createOptionalAuth(options: { env?: AuthEnv; authClient?: AuthClient | null } = {}) {
	const env = options.env ?? serverEnv
	const authClient = options.authClient

	return createMiddleware<any, string, {}, Response>(async (context, next) => {
		const token = bearerToken(context.req.header('authorization'))
		if (token) {
			const supabase = authClient ?? getSupabaseAuthClient(env)
			if (!supabase) {
				return errorResponse(context, 500, apiError('AUTH_NOT_CONFIGURED', 'Supabase auth is not configured'))
			}

			const { data, error } = await supabase.auth.getUser(token)
			if (error || !data.user) {
				return errorResponse(context, 401, apiError('UNAUTHENTICATED', 'Invalid or expired access token'))
			}

			context.set('user', apiUserFromSupabase(data.user))
			await next()
			return
		}

		const demoUserId = context.req.header('x-demo-user')
		if (demoUserId && env.NODE_ENV !== 'production') {
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
}

export const optionalAuth = createOptionalAuth()

export function actorFromContext(context: Context): StoreScope {
	const user = context.get('user')
	if (!user) throw new Error('Authenticated user missing from request context')
	return { teacherId: user.id, email: user.email, storeNamespace: context.get('storeNamespace') }
}

export function requirePermission<D extends PermissionDomain>(domain: D, action: ActionOf<D>) {
	return createMiddleware<any, string, {}, Response>(async (context, next) => {
		const user = context.get('user')
		if (!user) {
			return errorResponse(context, 401, apiError('UNAUTHENTICATED', 'Authentication required'))
		}

		if (!user.roles.includes('teacher') && !can(new Set(user.permissions), domain, action)) {
			const requiredPermission = `${domain}.${action}`
			const details = {
				method: context.req.method,
				path: context.req.path,
				requiredPermission,
				userId: user.id,
				email: user.email,
				roles: user.roles,
				permissions: user.permissions,
			}

			console.warn('[teacher-crm] permission denied', details)

			return errorResponse(
				context,
				403,
				apiError('FORBIDDEN', `Permission denied: missing ${requiredPermission}`, details)
			)
		}

		await next()
	})
}

export const requireAuth = createMiddleware<any, string, {}, Response>(async (context, next) => {
	const user = context.get('user')
	if (!user) {
		return errorResponse(context, 401, apiError('UNAUTHENTICATED', 'Authentication required'))
	}

	await next()
})
