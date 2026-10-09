import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { resolveDatabaseUrl } from '@dv-lab/db'

const bin = fileURLToPath(new URL('../dist/migrate.mjs', import.meta.url))
const migrationsDir = fileURLToPath(new URL('../../../packages/db/drizzle', import.meta.url))
const folders = readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length

function run(env: NodeJS.ProcessEnv) {
	return new Promise<{ code: number | null; stdout: string; output: string }>((resolve, reject) => {
		const child = spawn(process.execPath, [bin], { env })
		let stdout = ''
		let stderr = ''
		child.stdout.on('data', (chunk) => (stdout += chunk))
		child.stderr.on('data', (chunk) => (stderr += chunk))
		child.on('error', reject)
		child.on('close', (code) => resolve({ code, stdout, output: stdout + stderr }))
	})
}

function migrationsCount(stdout: string) {
	const records = stdout
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line))
	return records.find((record) => 'migrations' in record)?.migrations
}

describe('migrate.mjs', () => {
	it('migrator role applies migrations', async () => {
		const result = await run({ ...process.env })

		expect(result.code).toBe(0)
		expect(folders).toBeGreaterThan(0)
		expect(migrationsCount(result.stdout)).toBe(folders)
	})

	it('app role cannot apply migrations', async () => {
		const appUrl = resolveDatabaseUrl('app', process.env)
		const result = await run({ ...process.env, MIGRATOR_DATABASE_URL: appUrl })

		expect(result.code).not.toBe(0)
		expect(result.output).toContain('"code":"42501"')
		expect(result.output).toContain('migrations failed')
		expect(result.output).not.toContain(appUrl)
	})

	it('concurrent runs both succeed', async () => {
		const [first, second] = await Promise.all([run({ ...process.env }), run({ ...process.env })])

		expect(first.code).toBe(0)
		expect(second.code).toBe(0)
		expect(migrationsCount(first.stdout)).toBe(folders)
		expect(migrationsCount(second.stdout)).toBe(folders)
	})
})
