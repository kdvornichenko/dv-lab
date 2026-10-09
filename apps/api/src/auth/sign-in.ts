import { and, eq } from 'drizzle-orm'
import type { Logger } from 'pino'

import { type AccountSummary, LOGIN_MAX_LENGTH, SIGN_IN_PASSWORD_MAX_LENGTH, normalizeLogin } from '@dv-lab/contracts'
import { type Database, accounts } from '@dv-lab/db'

import { accountSummaryColumns, toAccountSummary } from './account-rows.ts'
import { verifyDummyPassword, verifyPassword } from './passwords.ts'
import { issueSession } from './sessions.ts'
import { ipBucket, reserveSignInAttempt, settleSignInSuccess } from './throttle.ts'

const ADMISSION_RUNNING = 4
const ADMISSION_WAITING = 8
const PASSWORD_CHECK_RUNNING = 2
const PASSWORD_CHECK_WAITING = 8

type Refusal =
	| { kind: 'invalid_credentials' }
	| { kind: 'locked'; retryAfterSeconds: number }
	| { kind: 'busy' }
	| { kind: 'unavailable' }

export type SignInOutcome = { kind: 'ok'; token: string; account: AccountSummary } | Refusal

export type SignInAttempt = { login: string; password: string; ip: string | null | undefined }

export type SignIn = {
	attempt: (input: SignInAttempt) => Promise<SignInOutcome>
}

type SignInOptions = { db: Database; logger: Logger; requireClientIp: boolean }

type VerifiedAccount = AccountSummary & { passwordHash: string; authEpoch: number }

function createGate(maxRunning: number, maxWaiting: number) {
	let running = 0
	const waiting: Array<() => void> = []
	return async function enter(): Promise<(() => void) | null> {
		if (running < maxRunning) running += 1
		else if (waiting.length < maxWaiting) await new Promise<void>((resolve) => waiting.push(resolve))
		else return null
		let released = false
		return () => {
			if (released) return
			released = true
			const next = waiting.shift()
			if (next) next()
			else running -= 1
		}
	}
}

export function createSignIn({ db, logger, requireClientIp }: SignInOptions): SignIn {
	const admission = createGate(ADMISSION_RUNNING, ADMISSION_WAITING)
	const passwordCheck = createGate(PASSWORD_CHECK_RUNNING, PASSWORD_CHECK_WAITING)

	async function findActiveAccount(login: string): Promise<VerifiedAccount | undefined> {
		const [row] = await db
			.select({ ...accountSummaryColumns, passwordHash: accounts.passwordHash, authEpoch: accounts.authEpoch })
			.from(accounts)
			.where(and(eq(accounts.login, login), eq(accounts.status, 'active')))
			.limit(1)
		if (!row) return undefined
		return { ...toAccountSummary(row), passwordHash: row.passwordHash, authEpoch: row.authEpoch }
	}

	async function checkPassword(
		login: string,
		password: string,
		accepts: (account: VerifiedAccount) => boolean
	): Promise<VerifiedAccount | undefined> {
		const account = await findActiveAccount(login)
		if (!account || !accepts(account)) {
			await verifyDummyPassword(password)
			return undefined
		}
		return (await verifyPassword(password, account.passwordHash)) ? account : undefined
	}

	async function run<T extends { kind: 'ok' }>(
		input: SignInAttempt,
		accepts: (account: VerifiedAccount) => boolean,
		complete: (account: VerifiedAccount) => Promise<T>
	): Promise<T | Refusal> {
		const login = normalizeLogin(input.login)
		if (requireClientIp && ipBucket(input.ip) === null) return { kind: 'unavailable' }
		if (
			login === '' ||
			login.length > LOGIN_MAX_LENGTH ||
			input.password === '' ||
			input.password.length > SIGN_IN_PASSWORD_MAX_LENGTH
		) {
			return { kind: 'invalid_credentials' }
		}
		const leave = await admission()
		if (!leave) return { kind: 'busy' }
		try {
			const reservation = await reserveSignInAttempt(db, login, input.ip)
			if (reservation.kind === 'locked') return { kind: 'locked', retryAfterSeconds: reservation.retryAfterSeconds }
			const release = await passwordCheck()
			if (!release) return { kind: 'busy' }
			let account: VerifiedAccount | undefined
			try {
				account = await checkPassword(login, input.password, accepts)
			} finally {
				release()
			}
			if (!account) return { kind: 'invalid_credentials' }
			const result = await complete(account)
			if (reservation.kind === 'allowed') {
				try {
					await settleSignInSuccess(db, reservation.keys)
				} catch (err) {
					logger.warn({ err }, 'sign-in throttle settle failed')
				}
			}
			return result
		} finally {
			leave()
		}
	}

	return {
		attempt: (input) =>
			run(
				input,
				() => true,
				async (account) => ({
					kind: 'ok',
					token: await issueSession(db, { accountId: account.id, authEpoch: account.authEpoch }),
					account: toAccountSummary(account),
				})
			),
	}
}
