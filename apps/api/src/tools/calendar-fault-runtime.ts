import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

import { createDb } from '@dv-lab/db'

import { loadConfig } from '../config.ts'

const identity = z.object({
	runId: z.uuid(),
	pid: z.number().int().positive(),
	apiBuildSha: z.string().regex(/^[a-f0-9]{40}$/),
	entrySha256: z.string().regex(/^[a-f0-9]{64}$/),
	origin: z.literal('https://dv-lab.dev'),
	persistenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
	calendarFaultsAuthorized: z.literal(true),
	exclusiveSyntheticProcess: z.literal(true),
	expiresAt: z.iso.datetime(),
})

const databaseIdentity = z.strictObject({
	database: z.string(),
	address: z.string(),
	port: z.number().int(),
	oid: z.string(),
})

export async function verifyCalendarFaultRuntime(input: unknown): Promise<void> {
	try {
		const manifest = identity.parse(input)
		if (manifest.pid !== process.pid || Date.parse(manifest.expiresAt) <= Date.now())
			throw new Error('Invalid process lease')
		const entry = realpathSync(process.argv[1] ?? '')
		const expected = realpathSync(fileURLToPath(new URL('./server.mjs', import.meta.url)))
		if (entry !== expected || createHash('sha256').update(readFileSync(entry)).digest('hex') !== manifest.entrySha256)
			throw new Error('Invalid process entry')
		const config = loadConfig(process.env)
		if (config.GIT_SHA !== manifest.apiBuildSha || config.APP_ORIGIN !== manifest.origin || !config.calendar.enabled)
			throw new Error('Invalid runtime binding')
		await verifyPersistence(config.databaseUrl, manifest.persistenceFingerprint)
	} catch {
		throw new Error('Calendar fault runtime attestation failed')
	}
}

async function verifyPersistence(connectionString: string, expected: string): Promise<void> {
	const { pool } = createDb(connectionString)
	try {
		const role = await pool.query<{ role: string }>('select current_user as role')
		if (role.rows.length !== 1 || role.rows[0]?.role !== 'dvlab_app') throw new Error('Invalid application role')
		const result = await pool.query<Record<string, unknown>>(`select current_database() as database,
inet_server_addr()::text as address, inet_server_port() as port,
(select oid::text from pg_database where datname = current_database()) as oid`)
		const rows = z.tuple([databaseIdentity]).parse(result.rows)
		if (/_(dev|test)$/.test(rows[0].database)) throw new Error('Invalid prelaunch database')
		const fingerprint = createHash('sha256').update(JSON.stringify(rows[0])).digest('hex')
		if (fingerprint !== expected) throw new Error('Invalid persistence binding')
	} finally {
		await pool.end()
	}
}
