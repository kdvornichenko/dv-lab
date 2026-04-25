export const PERMISSION_DOMAINS = {
	students: ['read', 'write', 'archive'],
	lessons: ['read', 'write', 'cancel'],
	attendance: ['read', 'mark', 'edit'],
	calendar: ['read', 'connect', 'sync'],
	payments: ['read', 'write', 'adjust'],
	dashboard: ['read'],
	settings: ['manage'],
	rbac: ['read', 'write'],
} as const

export type PermissionDomain = keyof typeof PERMISSION_DOMAINS
export type ActionOf<D extends PermissionDomain> = (typeof PERMISSION_DOMAINS)[D][number]
export type PermissionKey = {
	[D in PermissionDomain]: `${D}.${ActionOf<D>}`
}[PermissionDomain]

export const PERMISSION_KEYS = Object.entries(PERMISSION_DOMAINS).flatMap(([domain, actions]) =>
	actions.map((action) => `${domain}.${action}`)
) as PermissionKey[]
