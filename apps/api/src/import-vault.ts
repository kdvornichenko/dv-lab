import { parseArgs } from 'node:util'

import { importPacket } from './import/packet.ts'
import { VaultParseError, parseVault } from './import/parse-vault.ts'
import type { ParseSummary } from './import/parse-vault.ts'

const USAGE = 'Usage: import-vault parse <students-dir>'
const USAGE_EXIT_CODE = 2
const FAILED_EXIT_CODE = 1

function parseCommand(argv: string[]): string | null {
	try {
		const { positionals } = parseArgs({ args: argv, options: {}, allowPositionals: true })
		if (positionals.length !== 2 || positionals[0] !== 'parse' || positionals[1] === '') return null
		return positionals[1]
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

function main(): number {
	const dir = parseCommand(process.argv.slice(2))
	if (dir === null) {
		process.stderr.write(`${USAGE}\n`)
		return USAGE_EXIT_CODE
	}
	return runParse(dir)
}

process.exitCode = main()
