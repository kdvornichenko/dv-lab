import { parseArgs } from 'node:util'

import { normalizeDisplayName, normalizeLogin } from '@dv-lab/contracts'
import { createDb, resolveDatabaseUrl } from '@dv-lab/db'

import { createTeacher } from './auth/accounts.ts'
import { generatePassword, hashPassword } from './auth/passwords.ts'

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: { email: { type: 'string' }, name: { type: 'string' } },
})

const login = normalizeLogin(values.email ?? '')
const displayName = normalizeDisplayName(values.name ?? '')
const password = generatePassword()
const passwordHash = await hashPassword(password)

const { db, pool } = createDb(resolveDatabaseUrl('app', process.env))
try {
	const outcome = await createTeacher(db, { login, displayName, passwordHash })
	if (outcome.kind === 'created') {
		process.stdout.write(`Teacher created. Login: ${outcome.login}\n`)
		process.stdout.write(`Password (shown once): ${password}\n`)
	} else {
		process.stderr.write('An active teacher already exists\n')
		process.exitCode = 3
	}
} finally {
	await pool.end()
}
