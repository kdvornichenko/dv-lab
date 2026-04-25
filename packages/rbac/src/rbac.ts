import { PERMISSION_DOMAINS, type ActionOf, type PermissionDomain, type PermissionKey } from './domains'
import { ROLE_REGISTRY, normaliseRoleKeys, type RoleConfig, type RoleGrant, type RoleKey } from './roles'

function expandDomainGrant<D extends PermissionDomain>(domain: D, grant: Array<ActionOf<D> | '*'>): Array<ActionOf<D>> {
	if (grant.includes('*')) return [...PERMISSION_DOMAINS[domain]] as Array<ActionOf<D>>
	return Array.from(new Set(grant as Array<ActionOf<D>>))
}

function expandGrants(grants: RoleGrant | undefined): Set<PermissionKey> {
	const keys = new Set<PermissionKey>()
	if (!grants) return keys

	for (const domain of Object.keys(grants) as PermissionDomain[]) {
		const actions = expandDomainGrant(domain, (grants[domain] ?? []) as Array<ActionOf<typeof domain> | '*'>)
		for (const action of actions) keys.add(`${domain}.${action}` as PermissionKey)
	}

	return keys
}

function expandRole(roleKey: RoleKey, seen: Set<RoleKey> = new Set()): Set<PermissionKey> {
	if (seen.has(roleKey)) return new Set()
	seen.add(roleKey)

	const role: RoleConfig = ROLE_REGISTRY[roleKey]
	const permissions = expandGrants(role.grants)

	for (const parent of role.inherits ?? []) {
		for (const permission of expandRole(parent, seen)) permissions.add(permission)
	}

	return permissions
}

export function buildPermissionSet(roles: ReadonlyArray<string> | undefined): Set<PermissionKey> {
	const permissions = new Set<PermissionKey>()
	for (const roleKey of normaliseRoleKeys(roles)) {
		for (const permission of expandRole(roleKey)) permissions.add(permission)
	}
	return permissions
}

export function can<D extends PermissionDomain>(
	permissions: ReadonlySet<PermissionKey>,
	domain: D,
	action: ActionOf<D>
): boolean
export function can(permissions: ReadonlySet<PermissionKey>, key: PermissionKey): boolean
export function can(permissions: ReadonlySet<PermissionKey>, domainOrKey: unknown, action?: unknown): boolean {
	if (typeof domainOrKey === 'string' && action === undefined) return permissions.has(domainOrKey as PermissionKey)

	if (typeof domainOrKey === 'string' && typeof action === 'string') {
		const domain = domainOrKey as PermissionDomain
		const allowedActions = (PERMISSION_DOMAINS[domain] ?? []) as readonly string[]
		return allowedActions.includes(action) && permissions.has(`${domain}.${action}` as PermissionKey)
	}

	return false
}
