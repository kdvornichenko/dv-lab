import { parseArgs } from 'node:util'

import {
	DISPLAY_NAME_MAX_LENGTH,
	MANUAL_PASSWORD_MAX_LENGTH,
	MANUAL_PASSWORD_MIN_LENGTH,
	isTeacherLogin,
	normalizeDisplayName,
	normalizeLogin,
	passwordLength,
} from '@dv-lab/contracts'
import { createDb, resolveDatabaseUrl } from '@dv-lab/db'
import type { Database } from '@dv-lab/db'

import { createTeacher, resetTeacherPassword } from './auth/accounts.ts'
import { generatePassword, hashPassword } from './auth/passwords.ts'

const USAGE = [
	'Usage: bootstrap-teacher --email <email> --name <name> [--password-stdin]',
	'       bootstrap-teacher --reset-password --email <email> [--password-stdin]',
].join('\n')
const USAGE_EXIT_CODE = 2
const REFUSED_EXIT_CODE = 3
const CAUSE_DEPTH = 5

type Options =
	| { mode: 'create'; login: string; displayName: string; passwordFromStdin: boolean }
	| { mode: 'reset'; login: string; passwordFromStdin: boolean }

function parseOptions(argv: string[]): Options | null {
	try {
		const { values } = parseArgs({
			args: argv,
			options: {
				email: { type: 'string' },
				name: { type: 'string' },
				'password-stdin': { type: 'boolean' },
				'reset-password': { type: 'boolean' },
			},
		})
		const login = normalizeLogin(values.email ?? '')
		const passwordFromStdin = values['password-stdin'] === true
		if (!isTeacherLogin(login)) return null
		if (values['reset-password'] === true) return { mode: 'reset', login, passwordFromStdin }
		const displayName = normalizeDisplayName(values.name ?? '')
		if (displayName.length < 1 || Array.from(displayName).length > DISPLAY_NAME_MAX_LENGTH) return null
		return { mode: 'create', login, displayName, passwordFromStdin }
	} catch {
		return null
	}
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = []
	for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
	return Buffer.concat(chunks)
		.toString('utf8')
		.replace(/\r?\n$/, '')
}

function postgresCode(error: unknown): string | null {
	let current: unknown = error
	for (let depth = 0; depth < CAUSE_DEPTH && current instanceof Error; depth += 1) {
		const code = (current as Error & { code?: unknown }).code
		if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code
		current = current.cause
	}
	return null
}

async function runCreate(
	db: Database,
	options: Extract<Options, { mode: 'create' }>,
	passwordHash: string
): Promise<string | null> {
	const outcome = await createTeacher(db, { login: options.login, displayName: options.displayName, passwordHash })
	if (outcome.kind === 'teacher_exists') {
		process.stderr.write('An active teacher already exists\n')
		return null
	}
	return `Teacher created. Login: ${outcome.login}\n`
}

async function runReset(
	db: Database,
	options: Extract<Options, { mode: 'reset' }>,
	passwordHash: string
): Promise<string | null> {
	const outcome = await resetTeacherPassword(db, { login: options.login, passwordHash })
	if (outcome.kind === 'not_found') {
		process.stderr.write('No active teacher with this email\n')
		return null
	}
	return `Password reset. Login: ${outcome.login}\n`
}

async function main(): Promise<number> {
	const options = parseOptions(process.argv.slice(2))
	if (!options) {
		process.stderr.write(`${USAGE}\n`)
		return USAGE_EXIT_CODE
	}
	let password: string
	if (options.passwordFromStdin) {
		password = await readStdin()
		const length = passwordLength(password)
		if (length < MANUAL_PASSWORD_MIN_LENGTH || length > MANUAL_PASSWORD_MAX_LENGTH) {
			process.stderr.write(`${USAGE}\n`)
			return USAGE_EXIT_CODE
		}
	} else {
		password = generatePassword()
	}
	let pool: ReturnType<typeof createDb>['pool'] | null = null
	try {
		const passwordHash = await hashPassword(password)
		const connection = createDb(resolveDatabaseUrl('app', process.env))
		pool = connection.pool
		const done =
			options.mode === 'reset'
				? await runReset(connection.db, options, passwordHash)
				: await runCreate(connection.db, options, passwordHash)
		if (done === null) return REFUSED_EXIT_CODE
		process.stdout.write(done)
		if (!options.passwordFromStdin) process.stdout.write(`Password (shown once): ${password}\n`)
		return 0
	} catch (error) {
		const code = postgresCode(error)
		process.stderr.write(code ? `Bootstrap failed (${code})\n` : 'Bootstrap failed\n')
		return 1
	} finally {
		await pool?.end()
	}
}

process.exitCode = await main()
