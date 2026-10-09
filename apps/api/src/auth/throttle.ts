import { eq, inArray, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

import { normalizeLogin } from '@dv-lab/contracts'
import { type Database, type DbExecutor, signInThrottles } from '@dv-lab/db'

export const MAX_PAIR_FAILURES = 5
export const MAX_LOGIN_FAILURES = 20
export const WINDOW_SECONDS = 900
export const LOCK_SECONDS = 900

export type ThrottleKeys = { loginKey: string; pairKey: string }

export type SignInReservation =
	{ kind: 'allowed'; keys: ThrottleKeys } | { kind: 'locked'; retryAfterSeconds: number } | { kind: 'unthrottled' }

type ThrottleState = { failure_count: number; locked: boolean; remaining: number; expired: boolean }

export function ipBucket(ip: string | null | undefined): string | null {
	const raw = ip?.trim().toLowerCase()
	if (!raw) return null
	const address = raw.replace(/%.*$/, '')
	const kind = isIP(address)
	if (kind === 4) return address
	if (kind !== 6) return raw

	const dotted = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address)
	const text = dotted
		? `${dotted[1]}${((Number(dotted[2]) << 8) | Number(dotted[3])).toString(16)}:${((Number(dotted[4]) << 8) | Number(dotted[5])).toString(16)}`
		: address
	const [head = '', tail, ...surplus] = text.split('::')
	if (surplus.length > 0) return raw
	const headGroups = head === '' ? [] : head.split(':')
	const tailGroups = tail === undefined || tail === '' ? [] : tail.split(':')
	const zeros = tail === undefined ? 0 : 8 - headGroups.length - tailGroups.length
	const groups = [...headGroups, ...Array.from({ length: Math.max(0, zeros) }, () => '0'), ...tailGroups].map((group) =>
		Number.parseInt(group, 16)
	)
	if (groups.length !== 8 || groups.some((group) => Number.isNaN(group))) return raw

	const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [number, number, number, number, number, number, number, number]
	if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
		return `${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`
	}
	return `${[g0, g1, g2, g3].map((group) => group.toString(16)).join(':')}::/64`
}

function throttleKeys(login: string, bucket: string): ThrottleKeys {
	const normalized = normalizeLogin(login)
	return {
		loginKey: createHash('sha256')
			.update(`login:${encodeURIComponent(normalized)}`)
			.digest('hex'),
		pairKey: createHash('sha256').update(`${normalized}\n${bucket}`).digest('hex'),
	}
}

async function lockThrottleRow(tx: DbExecutor, key: string): Promise<ThrottleState> {
	for (let tries = 0; tries < 3; tries += 1) {
		await tx
			.insert(signInThrottles)
			.values({ keyHash: key, failureCount: 0, windowStartedAt: sql`now()` })
			.onConflictDoNothing()
		const result = await tx.execute<ThrottleState>(sql`
			select failure_count,
			       (locked_until is not null and locked_until > now()) as locked,
			       coalesce(ceil(extract(epoch from locked_until - now())), 0)::int as remaining,
			       (window_started_at <= now() - make_interval(secs => ${WINDOW_SECONDS})) as expired
			from sign_in_throttles
			where key_hash = ${key}
			for update`)
		const row = result.rows[0]
		if (row) return row
	}
	throw new Error('sign_in_throttles row missing after insert')
}

async function advanceThrottleRow(tx: DbExecutor, key: string, row: ThrottleState, max: number): Promise<void> {
	const count = row.expired ? 1 : row.failure_count + 1
	await tx
		.update(signInThrottles)
		.set({
			failureCount: count,
			lockedUntil: count >= max ? sql`now() + make_interval(secs => ${LOCK_SECONDS})` : null,
			...(row.expired ? { windowStartedAt: sql`now()` } : {}),
		})
		.where(eq(signInThrottles.keyHash, key))
}

export async function reserveSignInAttempt(
	db: Database,
	login: string,
	ip: string | null | undefined
): Promise<SignInReservation> {
	const bucket = ipBucket(ip)
	if (bucket === null) return { kind: 'unthrottled' }
	const keys = throttleKeys(login, bucket)
	return db.transaction(async (tx): Promise<SignInReservation> => {
		const loginRow = await lockThrottleRow(tx, keys.loginKey)
		const pairRow = await lockThrottleRow(tx, keys.pairKey)
		const locked = [loginRow, pairRow].filter((row) => row.locked)
		if (locked.length > 0) {
			return { kind: 'locked', retryAfterSeconds: Math.max(1, ...locked.map((row) => row.remaining)) }
		}
		await advanceThrottleRow(tx, keys.loginKey, loginRow, MAX_LOGIN_FAILURES)
		await advanceThrottleRow(tx, keys.pairKey, pairRow, MAX_PAIR_FAILURES)
		return { kind: 'allowed', keys }
	})
}

export async function settleSignInSuccess(db: DbExecutor, keys: ThrottleKeys): Promise<void> {
	await db.delete(signInThrottles).where(inArray(signInThrottles.keyHash, [keys.loginKey, keys.pairKey]))
}

export async function pruneSignInThrottles(db: DbExecutor): Promise<void> {
	await db
		.delete(signInThrottles)
		.where(
			sql`${signInThrottles.windowStartedAt} <= now() - make_interval(secs => ${WINDOW_SECONDS}) and (${signInThrottles.lockedUntil} is null or ${signInThrottles.lockedUntil} <= now())`
		)
}
