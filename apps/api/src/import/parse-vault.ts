import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
	LESSON_MINUTES_MAX,
	LESSON_MINUTES_MIN,
	PAYMENT_NOTE_MAX_LENGTH,
	SECTION_BODY_MAX_LENGTH,
	TERM_MAX_LENGTH,
	TERM_NOTE_MAX_LENGTH,
	isDisplayNameLength,
	isIsoDate,
	normalizeDisplayName,
} from '@dv-lab/contracts'
import type { Currency, SectionKind } from '@dv-lab/contracts'
import { parseMoney } from '@dv-lab/core'

import type { ImportPacket } from './packet.ts'

type Student = ImportPacket['students'][number]
type Payment = ImportPacket['unmatched'][number]
type Rate = NonNullable<Student['rate']>
type Section = Student['sections'][number]
type Term = Student['terms'][number]

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

type Context = {
	warnings: string[]
	summary: ParseSummary
}

const UNMATCHED_FILE = 'Unmatched transfers.md'
const UNMATCHED_KEY = 'unmatched'
const VOCABULARY_FILE = 'Learnt vocabulary.md'
const RATE_LINE = /^- Listed rate:/
const RATE_PATTERN = /^- Listed rate:\s*(?:(KZT|RUB)\s+)?(\d[\d\s.,]*?)\s*(₽|₸|KZT|RUB)?\s*\/\s*(\d+)\s*min/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const EMPTY_CELL = '—'

const SECTION_FILES: [SectionKind, string[]][] = [
	['general_info', ['General info.md']],
	['interests', ['Interests and Hobbies.md']],
	['level', ['Level info.md']],
	['goals', ['Goals and IELTS.md', 'Goals.md']],
	['typical_mistakes', ['Typical mistakes.md']],
	['lesson_ideas', ['Lesson ideas.md']],
]

const TERM_COLUMNS = [
	'Item',
	'Word or phrase',
	'Word or chunk',
	'Word/chunk',
	'Preferred form',
	'Stored form',
	'More precise option',
]
const TERM_NOTE_COLUMNS = ['Meaning/use', 'Russian meaning', 'Checked meaning', 'Note', 'Usage note']
const DENIED_HEADINGS = [
	'links',
	'status',
	'recycling guidance',
	'teaching note',
	'teaching priorities',
	'useful future clusters',
	'vocabulary log template',
	'tracking table',
	'suggested tracking',
	'vocabulary tracking',
]

const textLength = (value: string) => Array.from(value).length

function readText(path: string): string | null {
	if (!existsSync(path)) return null
	return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
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

const isTableLine = (line: string) => line.trim().startsWith('|')

function tableAt(lines: string[], start: number): { table: Table | null; next: number } {
	const block: string[][] = []
	let index = start
	while (index < lines.length && isTableLine(lines[index])) {
		block.push(splitRow(lines[index]))
		index += 1
	}
	const table = block.length >= 2 && isSeparatorRow(block[1]) ? { header: block[0], rows: block.slice(2) } : null
	return { table, next: index }
}

function readTables(lines: string[]): Table[] {
	const tables: Table[] = []
	let index = 0
	while (index < lines.length) {
		if (!isTableLine(lines[index])) {
			index += 1
			continue
		}
		const { table, next } = tableAt(lines, index)
		if (table) tables.push(table)
		index = next
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
	const compact = text.replace(/\s/g, '')
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
	const currency = symbol === undefined ? null : parseCurrency(symbol)
	if (!match || !currency) {
		warnings.push(`warning: unreadable rate line, rate left empty (${label})`)
		return null
	}
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

function linkText(target: string): string {
	const path = target.split('#')[0]
	return path.split('/').pop() || target
}

function sectionBody(text: string): string {
	const lines = stripFrontmatter(text).split('\n')
	const first = lines.findIndex((line) => line.trim() !== '')
	if (first !== -1 && lines[first].startsWith('# ')) lines.splice(first, 1)
	const links = lines.findLastIndex((line) => /^## Links\s*$/.test(line))
	return (links === -1 ? lines : lines.slice(0, links))
		.join('\n')
		.replace(/!\[\[[^\]]*\]\]/g, '')
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
		.replace(/\[\[([^\]]+)\]\]/g, (_match, target: string) => linkText(target))
		.trim()
}

function readSections(folderPath: string, label: string, warnings: string[]): Section[] {
	const sections: Section[] = []
	for (const [kind, files] of SECTION_FILES) {
		const found = files.map((file) => readText(join(folderPath, file))).filter((text) => text !== null)
		if (found.length === 0) continue
		if (found.length > 1) warnings.push(`warning: two goals files, Goals and IELTS used (${label})`)
		const body = sectionBody(found[0])
		if (body === '') continue
		if (textLength(body) > SECTION_BODY_MAX_LENGTH) throw new VaultParseError(`section too long (${label})`)
		sections.push({ kind, body })
	}
	return sections
}

function cleanText(value: string): string {
	return normalizeDisplayName(normalizeDisplayName(value.replace(/\*\*/g, '').replace(/`/g, '')).replace(/;$/, ''))
}

function isDeniedHeading(heading: string): boolean {
	const lowered = heading.toLowerCase()
	return DENIED_HEADINGS.some((denied) => lowered === denied || lowered.startsWith(denied))
}

function splitBullet(text: string): { term: string; note: string | null } | null {
	if (text.includes('[[')) return null
	const arrow = text.indexOf('→')
	if (arrow !== -1) {
		const bold = /\*\*(.+?)\*\*/.exec(text.slice(arrow + 1))
		return bold ? { term: bold[1], note: null } : null
	}
	const dash = /\s[—–]\s/.exec(text)
	if (!dash) return { term: text, note: null }
	return { term: text.slice(0, dash.index), note: text.slice(dash.index + dash[0].length) }
}

function readTerms(text: string, label: string, warnings: string[]): Term[] {
	const terms: Term[] = []
	const byLower = new Map<string, Term>()
	const add = (rawTerm: string, rawNote: string | null) => {
		const term = cleanText(rawTerm)
		if (term === '' || term === EMPTY_CELL) return
		if (textLength(term) > TERM_MAX_LENGTH) {
			warnings.push(`warning: term too long skipped (${label})`)
			return
		}
		let note = rawNote === null ? null : cleanText(rawNote)
		if (note === '' || note === EMPTY_CELL) note = null
		if (note !== null && textLength(note) > TERM_NOTE_MAX_LENGTH) {
			warnings.push(`warning: term note too long dropped (${label})`)
			note = null
		}
		const existing = byLower.get(term.toLowerCase())
		if (existing) {
			if (existing.note === null && note !== null) existing.note = note
			return
		}
		const entry = { term, note }
		byLower.set(term.toLowerCase(), entry)
		terms.push(entry)
	}
	const lines = stripFrontmatter(text).split('\n')
	let heading = ''
	let index = 0
	while (index < lines.length) {
		const line = lines[index]
		if (isTableLine(line)) {
			const { table, next } = tableAt(lines, index)
			index = next
			if (!table) continue
			const termColumn = columnIndex(table.header, TERM_COLUMNS)
			if (termColumn === -1) continue
			const noteColumn = columnIndex(table.header, TERM_NOTE_COLUMNS)
			for (const row of table.rows) add(row[termColumn] ?? '', noteColumn === -1 ? null : (row[noteColumn] ?? null))
			continue
		}
		index += 1
		const headingMatch = /^#{2,3}\s+(.*)$/.exec(line)
		if (headingMatch) {
			heading = headingMatch[1].trim()
			continue
		}
		if (!line.startsWith('- ') || isDeniedHeading(heading)) continue
		const bullet = splitBullet(line.slice(2))
		if (bullet) add(bullet.term, bullet.note)
	}
	return terms
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
		const vocabularyText = readText(join(folderPath, VOCABULARY_FILE))
		const sections = readSections(folderPath, label, context.warnings)
		const terms = vocabularyText === null ? [] : readTerms(vocabularyText, label, context.warnings)
		context.summary.students += 1
		context.summary.sections += sections.length
		context.summary.terms += terms.length
		context.summary.rates += rate === null ? 0 : 1
		context.summary.payments += payments.length
		context.summary.paymentsWithoutCurrency += payments.filter((payment) => payment.currency === null).length
		return {
			key: folder,
			displayName: readDisplayName(folderPath, folder, label),
			rate,
			sections,
			terms,
			payments,
		}
	})
	const unmatchedText = readText(join(dir, UNMATCHED_FILE))
	const unmatched =
		unmatchedText === null ? [] : readPayments(unmatchedText, UNMATCHED_KEY, UNMATCHED_KEY, context, unmatchedNote)
	context.summary.unmatched = unmatched.length
	return { packet: { version: 1, students, unmatched }, summary: context.summary, warnings: context.warnings }
}
