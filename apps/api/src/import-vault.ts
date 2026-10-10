import { parseArgs } from 'node:util'

import { createDb, postgresCode, resolveDatabaseUrl } from '@dv-lab/db'

import { applyPacket } from './import/apply-packet.ts'
import { type ImportPacket, importPacket } from './import/packet.ts'
import { VaultParseError, parseVault } from './import/parse-vault.ts'
import type { ParseSummary } from './import/parse-vault.ts'

const USAGE = ['Usage: import-vault parse <students-dir>', '       import-vault apply < packet.json'].join('\n')
const USAGE_EXIT_CODE = 2
const FAILED_EXIT_CODE = 1

type Command = { kind: 'parse'; dir: string } | { kind: 'apply' }

function parseCommand(argv: string[]): Command | null {
	try {
		const { positionals } = parseArgs({ args: argv, options: {}, allowPositionals: true })
		if (positionals.length === 1 && positionals[0] === 'apply') return { kind: 'apply' }
		if (positionals.length !== 2 || positionals[0] !== 'parse' || positionals[1] === '') return null
		return { kind: 'parse', dir: positionals[1] }
	} catch {
		return null
	}
}

function summaryLine(summary: ParseSummary): string {
	return [
		`students=${summary.students}`,
		`sections=${summary.sections}`,
		`terms=${summary.terms}`,
		`payments=${summary.payments}`,
		`payments_without_currency=${summary.paymentsWithoutCurrency}`,
		`unmatched=${summary.unmatched}`,
		`rates=${summary.rates}`,
		`skipped_rows=${summary.skippedRows}`,
	].join(' ')
}

function runParse(dir: string): number {
	let result: ReturnType<typeof parseVault>
	try {
		result = parseVault(dir)
	} catch (error) {
		const reason = error instanceof VaultParseError ? error.message : 'cannot read the students directory'
		process.stderr.write(`Parse failed: ${reason}\n`)
		return FAILED_EXIT_CODE
	}
	for (const warning of result.warnings) process.stderr.write(`${warning}\n`)
	if (!importPacket.safeParse(result.packet).success) {
		process.stderr.write('Parse failed: packet does not match the schema\n')
		return FAILED_EXIT_CODE
	}
	process.stdout.write(`${JSON.stringify(result.packet)}\n`)
	process.stderr.write(`${summaryLine(result.summary)}\n`)
	return 0
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = []
	for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
	return Buffer.concat(chunks).toString('utf8')
}

function readPacket(text: string): ImportPacket | null {
	let value: unknown
	try {
		value = JSON.parse(text)
	} catch {
		return null
	}
	const parsed = importPacket.safeParse(value)
	return parsed.success ? parsed.data : null
}

async function runApply(): Promise<number> {
	const packet = readPacket(await readStdin())
	if (!packet) {
		process.stderr.write('Invalid packet\n')
		return USAGE_EXIT_CODE
	}
	let pool: ReturnType<typeof createDb>['pool'] | null = null
	try {
		const connection = createDb(resolveDatabaseUrl('app', process.env))
		pool = connection.pool
		const result = await applyPacket(connection.db, packet)
		for (const [table, { inserted, skipped }] of Object.entries(result)) {
			process.stdout.write(`${table} inserted=${inserted} skipped=${skipped}\n`)
		}
		return 0
	} catch (error) {
		const code = postgresCode(error)
		process.stderr.write(code ? `Import failed (${code})\n` : 'Import failed\n')
		return FAILED_EXIT_CODE
	} finally {
		await pool?.end()
	}
}

async function main(): Promise<number> {
	const command = parseCommand(process.argv.slice(2))
	if (command === null) {
		process.stderr.write(`${USAGE}\n`)
		return USAGE_EXIT_CODE
	}
	return command.kind === 'apply' ? runApply() : runParse(command.dir)
}

process.exitCode = await main()
