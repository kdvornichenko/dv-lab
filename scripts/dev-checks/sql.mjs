import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename } from 'node:path'
import { parseEnv } from 'node:util'

import { ROOT } from './paths.mjs'

const usage = 'usage: node scripts/dev-checks/sql.mjs ENV_FILE app|migrator SQL'

const [envFile, role, text] = process.argv.slice(2)
if (!envFile || (role !== 'app' && role !== 'migrator') || !text) {
	console.log(usage)
	process.exit(2)
}

const variable = role === 'app' ? 'DATABASE_URL' : 'MIGRATOR_DATABASE_URL'
let url
try {
	url = parseEnv(readFileSync(envFile, 'utf8'))[variable]
} catch {
	console.log('refused: cannot read env file')
	process.exit(2)
}
let database = ''
try {
	database = decodeURIComponent(new URL(url).pathname.slice(1))
} catch {
	database = ''
}
if (!/_(dev|test)$/.test(database)) {
	console.log('refused: database name must end with _dev or _test')
	process.exit(2)
}
const fileName = basename(envFile)
if (fileName === '.env.test' && !database.endsWith('_test')) {
	console.log('refused: .env.test must point to a database ending with _test')
	process.exit(2)
}
if (fileName === '.env' && !database.endsWith('_dev')) {
	console.log('refused: .env must point to a database ending with _dev')
	process.exit(2)
}

const require = createRequire(`${ROOT}/packages/db/package.json`)
const { Client } = require('pg')

const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 })
let exitCode = 0
try {
	await client.connect()
	const result = await client.query(text)
	const last = Array.isArray(result) ? result[result.length - 1] : result
	console.log(JSON.stringify({ command: last.command, rowCount: last.rowCount, rows: last.rows }))
} catch (err) {
	console.log(JSON.stringify({ error: { code: err?.code ?? null, constraint: err?.constraint ?? null } }))
	exitCode = 1
} finally {
	await client.end().catch(() => {})
}
process.exit(exitCode)
