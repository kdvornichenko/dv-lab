import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
	LESSON_MINUTES_MAX,
	LESSON_MINUTES_MIN,
	PAYMENT_NOTE_MAX_LENGTH,
	isDisplayNameLength,
	isIsoDate,
	normalizeDisplayName,
} from '@dv-lab/contracts'
import type { Currency } from '@dv-lab/contracts'
import { parseMoney } from '@dv-lab/core'

import type { ImportPacket } from './packet.ts'

type Student = ImportPacket['students'][number]
type Payment = ImportPacket['unmatched'][number]
type Rate = NonNullable<Student['rate']>

export type ParseSummary = {
	students: number
	sections: number
	terms: number
	payments: number
	paymentsWithoutCurrency: number
	unmatched: number
	rates: number
	skippedRows: number
}

export class VaultParseError extends Error {}

type Table = { header: string[]; rows: string[][] }

const UNMATCHED_FILE = 'Unmatched transfers.md'
const UNMATCHED_KEY = 'unmatched'
const RATE_LINE = /^- Listed rate:/
const RATE_PATTERN = /^- Listed rate:\s*(?:(KZT|RUB)\s+)?(\d[\d\s.,]*?)\s*(₽|KZT|RUB)?\s*\/\s*(\d+)\s*min/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const EMPTY_CELL = '—'

const textLength = (value: string) => Array.from(value).length

function readText(path: string): string | null {
	if (!existsSync(path)) return null
	return readFileSync(path, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n')
}

function stripFrontmatter(text: string): string {
	return text.replace(/^---\n[\s\S]*?\n---\n/, '')
}

function splitRow(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, '')
		.replace(/\|$/, '')
		.split('|')
		.map((cell) => cell.trim())
}

function isSeparatorRow(cells: string[]): boolean {
	return cells.every((cell) => /^:?-+:?$/.test(cell))
}

function readTables(lines: string[]): Table[] {
	const tables: Table[] = []
	let index = 0
	while (index < lines.length) {
		if (!lines[index].trim().startsWith('|')) {
			index += 1
			continue
		}
		const block: string[][] = []
		while (index < lines.length && lines[index].trim().startsWith('|')) {
			block.push(splitRow(lines[index]))
			index += 1
		}
		if (block.length >= 2 && isSeparatorRow(block[1])) {
			tables.push({ header: block[0], rows: block.slice(2) })
		}
	}
	return tables
}

function columnIndex(header: string[], names: string[]): number {
	const lowered = header.map((cell) => cell.toLowerCase())
	for (const name of names) {
		const index = lowered.indexOf(name.toLowerCase())
		if (index !== -1) return index
	}
	return -1
}

function normalizeAmount(text: string): string {
	const compact = text.replace(/[\s    ]/g, '')
	return /^\d{1,3}(,\d{3})+$/.test(compact) ? compact.replace(/,/g, '') : compact
}

function parseCurrency(cell: string): Currency | null | undefined {
	const value = cell.trim()
	if (value === '₽' || value.toUpperCase() === 'RUB') return 'RUB'
	if (value === '₸' || value.toUpperCase() === 'KZT') return 'KZT'
	if (value === '' || value.toLowerCase() === 'not specified') return null
	return undefined
}

function optionalNote(value: string): string | null {
	const trimmed = value.trim()
	return trimmed === '' || trimmed === EMPTY_CELL ? null : trimmed
}

function paymentKey(owner: string, paidOn: string, amountMinor: number, currency: Currency | null, ordinal: number) {
	return createHash('sha256')
		.update(`${owner}|${paidOn}|${amountMinor}|${currency ?? ''}|${ordinal}`)
		.digest('hex')
}

type Context = {
	warnings: string[]
	summary: ParseSummary
}

function readPayments(
	text: string,
	owner: string,
	label: string,
	context: Context,
	noteOf: (header: string[], row: string[]) => string | null
): Payment[] {
	const payments: Payment[] = []
	const seen = new Map<string, number>()
	for (const table of readTables(stripFrontmatter(text).split('\n'))) {
		const date = columnIndex(table.header, ['Date'])
		const amount = columnIndex(table.header, ['Amount'])
		const currencyColumn = columnIndex(table.header, ['Currency'])
		if (date === -1 || amount === -1 || currencyColumn === -1) continue
		for (const row of table.rows) {
			const paidOn = (row[date] ?? '').trim()
			if (!ISO_DATE.test(paidOn) || !isIsoDate(paidOn)) {
				context.warnings.push(`warning: payment row without a valid date skipped (${label})`)
				context.summary.skippedRows += 1
				continue
			}
			const currency = parseCurrency(row[currencyColumn] ?? '')
			if (currency === undefined) {
				context.warnings.push(`warning: payment row with an unknown currency skipped (${label})`)
				context.summary.skippedRows += 1
				continue
			}
			const amountCell = (row[amount] ?? '').trim()
			if (amountCell === '' || amountCell === EMPTY_CELL) {
				context.warnings.push(`warning: payment row without an amount skipped (${label})`)
				context.summary.skippedRows += 1
				continue
			}
			const amountMinor = parseMoney(normalizeAmount(amountCell), currency)
			if (amountMinor === null) {
				context.warnings.push(`warning: payment row with an unreadable amount skipped (${label})`)
				context.summary.skippedRows += 1
				continue
			}
			const note = noteOf(table.header, row)
			if (note !== null && textLength(note) > PAYMENT_NOTE_MAX_LENGTH) {
				throw new VaultParseError(`payment note too long (${label})`)
			}
			const same = `${paidOn}|${amountMinor}|${currency ?? ''}`
			const ordinal = seen.get(same) ?? 0
			seen.set(same, ordinal + 1)
			payments.push({
				key: paymentKey(owner, paidOn, amountMinor, currency, ordinal),
				paidOn,
				amountMinor,
				currency,
				note,
			})
		}
	}
	return payments
}

function studentNote(header: string[], row: string[]): string | null {
	const index = columnIndex(header, ['Note', 'Covers'])
	return index === -1 ? null : optionalNote(row[index] ?? '')
}

function unmatchedNote(header: string[], row: string[]): string | null {
	const parts = [columnIndex(header, ['Sender / label']), columnIndex(header, ['Status'])]
		.map((index) => (index === -1 ? null : optionalNote(row[index] ?? '')))
		.filter((part): part is string => part !== null)
	return parts.length === 0 ? null : parts.join(' — ')
}

function readRate(text: string, label: string, warnings: string[]): Rate | null {
	const line = stripFrontmatter(text)
		.split('\n')
		.find((candidate) => RATE_LINE.test(candidate))
	if (line === undefined) return null
	const match = RATE_PATTERN.exec(line)
	const symbol = match?.[1] ?? match?.[3]
	if (!match || symbol === undefined) {
		warnings.push(`warning: unreadable rate line, rate left empty (${label})`)
		return null
	}
	const currency: Currency = symbol === '₽' ? 'RUB' : (symbol as Currency)
	const amountMinor = parseMoney(normalizeAmount(match[2]), currency)
	const lessonMinutes = Number(match[4])
	if (amountMinor === null || lessonMinutes < LESSON_MINUTES_MIN || lessonMinutes > LESSON_MINUTES_MAX) {
		warnings.push(`warning: unreadable rate line, rate left empty (${label})`)
		return null
	}
	return { amountMinor, currency, lessonMinutes }
}

function readDisplayName(folderPath: string, folder: string, label: string): string {
	const main = readText(join(folderPath, `${folder}.md`))
	if (main !== null) {
		const heading = stripFrontmatter(main)
			.split('\n')
			.find((line) => line.startsWith('# '))
		if (heading !== undefined) {
			const name = normalizeDisplayName(heading.slice(2))
			if (isDisplayNameLength(name)) return name
		}
	}
	const fallback = normalizeDisplayName(folder)
	if (!isDisplayNameLength(fallback)) throw new VaultParseError(`display name does not fit (${label})`)
	return fallback
}

export function parseVault(dir: string): { packet: ImportPacket; summary: ParseSummary; warnings: string[] } {
	const context: Context = {
		warnings: [],
		summary: {
			students: 0,
			sections: 0,
			terms: 0,
			payments: 0,
			paymentsWithoutCurrency: 0,
			unmatched: 0,
			rates: 0,
			skippedRows: 0,
		},
	}
	const folders = readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
		.map((entry) => entry.name)
		.sort()
	const students: Student[] = folders.map((folder, index) => {
		const label = `folder #${index + 1}`
		const folderPath = join(dir, folder)
		const paymentsText = readText(join(folderPath, 'Payments.md'))
		const rate = paymentsText === null ? null : readRate(paymentsText, label, context.warnings)
		const payments = paymentsText === null ? [] : readPayments(paymentsText, folder, label, context, studentNote)
		context.summary.students += 1
		context.summary.rates += rate === null ? 0 : 1
		context.summary.payments += payments.length
		context.summary.paymentsWithoutCurrency += payments.filter((payment) => payment.currency === null).length
		return {
			key: folder,
			displayName: readDisplayName(folderPath, folder, label),
			rate,
			sections: [],
			terms: [],
			payments,
		}
	})
	const unmatchedText = readText(join(dir, UNMATCHED_FILE))
	const unmatched =
		unmatchedText === null ? [] : readPayments(unmatchedText, UNMATCHED_KEY, UNMATCHED_KEY, context, unmatchedNote)
	context.summary.unmatched = unmatched.length
	return { packet: { version: 1, students, unmatched }, summary: context.summary, warnings: context.warnings }
}
