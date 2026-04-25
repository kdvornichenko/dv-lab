import type { ActionOf, PermissionDomain } from './domains'

export type RoleKey = 'teacher' | 'assistant'

export type RoleGrant = {
	[D in PermissionDomain]?: Array<ActionOf<D> | '*'>
}

export type RoleConfig = {
	label: string
	grants: RoleGrant
	inherits?: RoleKey[]
}

export const ROLE_REGISTRY = {
	teacher: {
		label: 'Teacher',
		grants: {
			students: ['*'],
			lessons: ['*'],
			attendance: ['*'],
			calendar: ['*'],
			payments: ['*'],
			dashboard: ['*'],
			settings: ['*'],
			rbac: ['*'],
		},
	},
	assistant: {
		label: 'Assistant',
		grants: {
			students: ['read', 'write'],
			lessons: ['read', 'write'],
			attendance: ['read', 'mark'],
			calendar: ['read', 'sync'],
			payments: ['read'],
			dashboard: ['read'],
		},
	},
} as const satisfies Record<RoleKey, RoleConfig>

export const ROLE_KEYS = Object.keys(ROLE_REGISTRY) as RoleKey[]

export const ROLES_LIST = ROLE_KEYS.map((key) => ({
	key,
	label: ROLE_REGISTRY[key].label,
}))

export function normaliseRoleKeys(input: ReadonlyArray<string> | undefined): RoleKey[] {
	if (!input?.length) return []
	return input.filter((role): role is RoleKey => ROLE_KEYS.includes(role as RoleKey))
}
