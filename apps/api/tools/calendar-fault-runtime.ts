import { readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

import { createDb } from '@dv-lab/db'

import { faultManifest, hash, type CalendarFaultManifest } from '../../../e2e/support/calendar-fault-protocol.ts'
import { credentialBinding, findConnection } from '../src/calendar/credentials.ts'
import { createTokenEnvelope } from '../src/calendar/token-envelope.ts'
import { loadConfig } from '../src/config.ts'

const databaseIdentity = z.strictObject({
	database: z.string(),
	address: z.string(),
	port: z.number().int(),
	oid: z.string(),
})

export async function verifyCalendarFaultRuntime(input: unknown, ownProcess = true): Promise<string> {
	try {
		const manifest = faultManifest.parse(input)
		if ((ownProcess && manifest.pid !== process.pid) || Date.parse(manifest.expiresAt) <= Date.now())
			throw new Error('Invalid process lease')
		const env = verifyProcess(manifest)
		const config = loadConfig(env)
		if (config.GIT_SHA !== manifest.apiBuildSha || config.APP_ORIGIN !== manifest.origin || !config.calendar.enabled)
			throw new Error('Invalid runtime binding')
		return await verifyPersistence(config, manifest)
	} catch {
		throw new Error('Calendar fault runtime attestation failed')
	}
}

function verifyProcess(manifest: CalendarFaultManifest): NodeJS.ProcessEnv {
	const root = realpathSync(manifest.runtimeRoot)
	if (root !== realpathSync(process.cwd()) || realpathSync(`/proc/${manifest.pid}/cwd`) !== root)
		throw new Error('Invalid runtime root')
	const entry = realpathSync(resolve(root, 'apps/api/dist/server.mjs'))
	const loader = realpathSync(resolve(root, 'apps/api/dist/calendar-faults.mjs'))
	if (hash(readFileSync(entry)) !== manifest.entrySha256 || hash(readFileSync(loader)) !== manifest.loaderSha256)
		throw new Error('Invalid executable hashes')
	const stat = readFileSync(`/proc/${manifest.pid}/stat`, 'utf8')
	const fields = stat
		.slice(stat.lastIndexOf(')') + 2)
		.trim()
		.split(/\s+/)
	if (fields[19] !== manifest.processStartTicks) throw new Error('Process PID was reused')
	const command = readFileSync(`/proc/${manifest.pid}/cmdline`, 'utf8').split('\0')
	const index = command.indexOf('--import')
	if (index < 0 || command[index + 1] !== loader || !command.includes(entry)) throw new Error('Loader not installed')
	const env: NodeJS.ProcessEnv = {}
	for (const pair of readFileSync(`/proc/${manifest.pid}/environ`, 'utf8').split('\0')) {
		const separator = pair.indexOf('=')
		if (separator > 0) env[pair.slice(0, separator)] = pair.slice(separator + 1)
	}
	if (env.E2E_CALENDAR_FAULTS !== process.env.E2E_CALENDAR_FAULTS) throw new Error('Invalid control binding')
	return env
}

async function verifyPersistence(
	config: ReturnType<typeof loadConfig>,
	manifest: CalendarFaultManifest
): Promise<string> {
	const { pool, db } = createDb(config.databaseUrl)
	try {
		const role = await pool.query<{ role: string }>('select current_user as role')
		if (role.rows.length !== 1 || role.rows[0]?.role !== 'dvlab_app') throw new Error('Invalid application role')
		const result = await pool.query<Record<string, unknown>>(`select current_database() as database,
inet_server_addr()::text as address, inet_server_port() as port,
(select oid::text from pg_database where datname = current_database()) as oid`)
		const rows = z.tuple([databaseIdentity]).parse(result.rows)
		const databaseIsLocal = /_(dev|test)$/.test(rows[0].database)
		const expectsLocalDatabase = config.NODE_ENV !== 'production'
		if (databaseIsLocal !== expectsLocalDatabase) throw new Error('Invalid database environment')
		if (hash(JSON.stringify(rows[0])) !== manifest.persistenceFingerprint)
			throw new Error('Invalid persistence binding')
		const account = await pool.query<{ role: string; status: string }>(
			'select role, status from accounts where id = $1::uuid',
			[manifest.accountId]
		)
		if (account.rows[0]?.role !== 'teacher' || account.rows[0]?.status !== 'active')
			throw new Error('Invalid fault account')
		const row = await findConnection(db, manifest.accountId)
		if (!row || row.id !== manifest.connectionId || row.generation !== manifest.connectionGeneration)
			throw new Error('Invalid connection lease')
		if (row.calendarId !== manifest.primaryCalendarId || row.state !== 'connected' || row.credentialMode !== 'active')
			throw new Error('Invalid PRIMARY binding')
		if (!config.calendar.enabled || !row.encryptedRefreshToken) throw new Error('Missing owned grant')
		return hash(createTokenEnvelope(config.calendar).open(row.encryptedRefreshToken, credentialBinding(row)))
	} finally {
		await pool.end()
	}
}
