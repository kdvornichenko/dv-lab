import {
	DESCRIPTION_BLOCKS_LIMIT,
	DESCRIPTION_HREF_LIMIT,
	DESCRIPTION_ITEMS_LIMIT,
	DESCRIPTION_RUNS_LIMIT,
	DESCRIPTION_TEXT_LIMIT,
	type EventDescriptionBlock,
	type EventTextRun,
} from '@dv-lab/contracts'

import { DESCRIPTION_LIMIT } from './provider-events.ts'

export type DescriptionReading = { blocks: EventDescriptionBlock[]; formatted: boolean }

type Token =
	| { kind: 'text'; start: number; end: number }
	| { kind: 'open'; name: string; href: string | null }
	| { kind: 'close'; name: string }

type TagRead = { name: string; href: string | null; end: number }
type Inline = Extract<EventTextRun, { kind: 'text' | 'link' }>
type Line = Inline[]
type Piece = { text: string; href: string | null }
type Seen = { entity: boolean }

const SKIPPED = new Set(['script', 'style', 'iframe'])
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const PARAGRAPHS = new Set(['p', 'div'])
const SCHEMES = ['https://', 'http://', 'mailto:', 'tel:']
const TRAILING = new Set(['.', ',', ';', ':', '!', '?', "'", '"', '‘', '’', '“', '”', '«', '»'])
const DIAL = new Set([44, 59, 35, 42])

const ENTITIES = new Map<string, string>([
	['amp', '&'],
	['AMP', '&'],
	['lt', '<'],
	['LT', '<'],
	['gt', '>'],
	['GT', '>'],
	['quot', '"'],
	['QUOT', '"'],
	['apos', "'"],
	['nbsp', ' '],
	['ensp', ' '],
	['emsp', ' '],
	['thinsp', ' '],
	['zwnj', '‌'],
	['zwj', '‍'],
	['shy', '­'],
	['Tab', '\t'],
	['NewLine', '\n'],
	['colon', ':'],
	['ndash', '–'],
	['mdash', '—'],
	['minus', '−'],
	['lsquo', '‘'],
	['rsquo', '’'],
	['sbquo', '‚'],
	['ldquo', '“'],
	['rdquo', '”'],
	['bdquo', '„'],
	['laquo', '«'],
	['raquo', '»'],
	['hellip', '…'],
	['bull', '•'],
	['middot', '·'],
	['copy', '©'],
	['reg', '®'],
	['trade', '™'],
	['euro', '€'],
	['pound', '£'],
	['yen', '¥'],
	['cent', '¢'],
	['deg', '°'],
	['times', '×'],
	['divide', '÷'],
	['plusmn', '±'],
	['sect', '§'],
	['para', '¶'],
	['iexcl', '¡'],
	['iquest', '¿'],
	['larr', '←'],
	['rarr', '→'],
	['uarr', '↑'],
	['darr', '↓'],
	['harr', '↔'],
	['frac12', '½'],
	['frac14', '¼'],
	['frac34', '¾'],
])

const at = (text: string, index: number) => text.charCodeAt(index)
const isLetter = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122)
const isDigit = (c: number) => c >= 48 && c <= 57
const isHex = (c: number) => isDigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)
const lower = (c: number) => (c >= 65 && c <= 90 ? c + 32 : c)
const isTagSpace = (c: number) => c === 32 || c === 9 || c === 10 || c === 12 || c === 13
const isNameEnd = (c: number) => isTagSpace(c) || c === 47 || c === 62
const isTrim = (c: number) => c <= 0x20 || c === 0xa0

function isHrefBreak(c: number) {
	return (
		c <= 0x20 ||
		(c >= 0x7f && c <= 0xa0) ||
		c === 0x1680 ||
		(c >= 0x2000 && c <= 0x200a) ||
		c === 0x2028 ||
		c === 0x2029 ||
		c === 0x202f ||
		c === 0x205f ||
		c === 0x3000 ||
		c === 0xfeff
	)
}

function isDividerChar(c: number) {
	return (
		c === 45 || c === 95 || c === 61 || (c >= 0x2010 && c <= 0x2015) || c === 0x2212 || (c >= 0x2500 && c <= 0x257f)
	)
}

function isWordChar(text: string, index: number) {
	if (index < 0) return false
	const ch = text[index] ?? ''
	return isDigit(at(text, index)) || ch.toLowerCase() !== ch.toUpperCase()
}

function asciiLower(text: string) {
	let out = ''
	for (let i = 0; i < text.length; i += 1) out += String.fromCharCode(lower(at(text, i)))
	return out
}

function startsWithAscii(text: string, from: number, prefix: string) {
	if (from + prefix.length > text.length) return false
	for (let i = 0; i < prefix.length; i += 1) if (lower(at(text, from + i)) !== at(prefix, i)) return false
	return true
}

function readTag(input: string, from: number): TagRead | null {
	const n = input.length
	let i = from
	while (i < n && !isNameEnd(at(input, i))) i += 1
	const name = asciiLower(input.slice(from, i))
	let href: string | null = null
	while (i < n) {
		const c = at(input, i)
		if (c === 62) return { name, href, end: i + 1 }
		if (isTagSpace(c) || c === 47) {
			i += 1
			continue
		}
		const nameStart = i
		while (i < n) {
			const d = at(input, i)
			if (isTagSpace(d) || d === 47 || d === 62 || (d === 61 && i > nameStart)) break
			i += 1
		}
		const attribute = asciiLower(input.slice(nameStart, i))
		let j = i
		while (j < n && isTagSpace(at(input, j))) j += 1
		if (j >= n || at(input, j) !== 61) continue
		j += 1
		while (j < n && isTagSpace(at(input, j))) j += 1
		let value: string
		const quote = at(input, j)
		if (quote === 34 || quote === 39) {
			const close = input.indexOf(quote === 34 ? '"' : "'", j + 1)
			if (close < 0) return null
			value = input.slice(j + 1, close)
			i = close + 1
		} else {
			let k = j
			while (k < n && !isTagSpace(at(input, k)) && at(input, k) !== 62) k += 1
			value = input.slice(j, k)
			i = k
		}
		if (attribute === 'href' && href === null) href = value
	}
	return null
}

function skipContent(input: string, from: number, name: string) {
	const n = input.length
	let i = from
	for (;;) {
		const open = input.indexOf('</', i)
		if (open < 0) return n
		let k = 0
		while (k < name.length && open + 2 + k < n && lower(at(input, open + 2 + k)) === at(name, k)) k += 1
		const after = open + 2 + k
		if (k === name.length && (after >= n || isNameEnd(at(input, after)))) {
			const gt = input.indexOf('>', after)
			return gt < 0 ? n : gt + 1
		}
		i = open + 2
	}
}

function tokenize(input: string) {
	const tokens: Token[] = []
	const n = input.length
	let markup = false
	let textStart = 0
	let i = 0
	const flushText = (end: number) => {
		if (end > textStart) tokens.push({ kind: 'text', start: textStart, end })
	}
	while (i < n) {
		const lt = input.indexOf('<', i)
		if (lt < 0) break
		const next = at(input, lt + 1)
		if (isLetter(next)) {
			const tag = readTag(input, lt + 1)
			if (!tag) break
			flushText(lt)
			markup = true
			tokens.push({ kind: 'open', name: tag.name, href: tag.href })
			i = SKIPPED.has(tag.name) ? skipContent(input, tag.end, tag.name) : tag.end
			textStart = i
		} else if (next === 47 && isLetter(at(input, lt + 2))) {
			const tag = readTag(input, lt + 2)
			if (!tag) break
			flushText(lt)
			markup = true
			tokens.push({ kind: 'close', name: tag.name })
			i = tag.end
			textStart = i
		} else if (next === 33 && input.startsWith('<!--', lt)) {
			const close = input.indexOf('-->', lt + 4)
			flushText(lt)
			markup = true
			i = close < 0 ? n : close + 3
			textStart = i
		} else if (next === 33 || next === 63) {
			const gt = input.indexOf('>', lt + 2)
			if (gt < 0) break
			flushText(lt)
			markup = true
			i = gt + 1
			textStart = i
		} else {
			i = lt + 1
		}
	}
	flushText(n)
	return { tokens, markup }
}

function readEntity(text: string, from: number): { value: string; end: number } | null {
	const n = text.length
	let i = from + 1
	if (at(text, i) === 35) {
		i += 1
		const hex = at(text, i) === 120 || at(text, i) === 88
		if (hex) i += 1
		const start = i
		while (i < n && (hex ? isHex(at(text, i)) : isDigit(at(text, i)))) i += 1
		if (i === start || at(text, i) !== 59) return null
		const value = i - start > (hex ? 6 : 7) ? -1 : Number.parseInt(text.slice(start, i), hex ? 16 : 10)
		const bad = value <= 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)
		return { value: bad ? '�' : String.fromCodePoint(value), end: i + 1 }
	}
	const start = i
	while (i < n && i - start < 32 && (isLetter(at(text, i)) || isDigit(at(text, i)))) i += 1
	if (i === start || at(text, i) !== 59) return null
	const value = ENTITIES.get(text.slice(start, i))
	return value === undefined ? null : { value, end: i + 1 }
}

function decodeEntities(text: string, seen: Seen) {
	let out = ''
	let last = 0
	let i = text.indexOf('&')
	while (i >= 0) {
		const entity = readEntity(text, i)
		if (entity) {
			out += text.slice(last, i) + entity.value
			last = entity.end
			seen.entity = true
			i = text.indexOf('&', entity.end)
		} else {
			i = text.indexOf('&', i + 1)
		}
	}
	return last === 0 ? text : out + text.slice(last)
}

function collapse(text: string) {
	let out = ''
	let start = 0
	let i = 0
	while (i < text.length) {
		if (isTagSpace(at(text, i))) {
			out += text.slice(start, i) + ' '
			while (i < text.length && isTagSpace(at(text, i))) i += 1
			start = i
		} else {
			i += 1
		}
	}
	return out + text.slice(start)
}

function safeHref(raw: string | null, seen: Seen) {
	if (raw === null) return null
	const decoded = decodeEntities(raw, seen)
	let start = 0
	let end = decoded.length
	while (start < end && at(decoded, start) <= 0x20) start += 1
	while (end > start && at(decoded, end - 1) <= 0x20) end -= 1
	let value = ''
	for (let i = start; i < end; i += 1) {
		const c = at(decoded, i)
		if (c !== 9 && c !== 10 && c !== 13) value += decoded[i]
	}
	const scheme = SCHEMES.find((prefix) => startsWithAscii(value, 0, prefix))
	if (!scheme || value.length === scheme.length || value.length > DESCRIPTION_HREF_LIMIT) return null
	for (let i = 0; i < value.length; i += 1) if (isHrefBreak(at(value, i))) return null
	return scheme + value.slice(scheme.length)
}

function bareUrl(text: string, from: number): { end: number; piece: Piece | null } | null {
	const scheme = startsWithAscii(text, from, 'https://') ? 8 : startsWithAscii(text, from, 'http://') ? 7 : 0
	if (!scheme) return null
	const n = text.length
	let end = from + scheme
	const counts = { '(': 0, ')': 0, '[': 0, ']': 0 }
	while (end < n) {
		const c = at(text, end)
		if (isHrefBreak(c) || c === 60 || c === 62 || c === 34) break
		const ch = text[end] as keyof typeof counts
		if (ch in counts) counts[ch] += 1
		end += 1
	}
	const scanned = end
	while (end > from + scheme) {
		const ch = text[end - 1] ?? ''
		if (TRAILING.has(ch)) end -= 1
		else if (ch === ')' && counts[')'] > counts['(']) {
			counts[')'] -= 1
			end -= 1
		} else if (ch === ']' && counts[']'] > counts['[']) {
			counts[']'] -= 1
			end -= 1
		} else break
	}
	const raw = text.slice(from, end)
	if (end === from + scheme || raw.length > DESCRIPTION_HREF_LIMIT) return { end: scanned, piece: null }
	return { end, piece: { text: raw, href: asciiLower(raw.slice(0, scheme)) + raw.slice(scheme) } }
}

function barePhone(text: string, from: number): { end: number; piece: Piece | null } | null {
	if (isWordChar(text, from - 1) || at(text, from - 1) === 43) return null
	let end = from + 1
	while (end < text.length && isDigit(at(text, end))) end += 1
	const digits = end - from - 1
	if (!digits) return null
	if (digits < 7 || digits > 15 || DIAL.has(at(text, end))) return { end, piece: null }
	const raw = text.slice(from, end)
	return { end, piece: { text: raw, href: `tel:${raw}` } }
}

function linkify(text: string) {
	const pieces: Piece[] = []
	let last = 0
	let i = 0
	while (i < text.length) {
		const c = at(text, i)
		const found =
			(c === 104 || c === 72) && !isWordChar(text, i - 1) ? bareUrl(text, i) : c === 43 ? barePhone(text, i) : null
		if (!found) {
			i += 1
			continue
		}
		if (found.piece) {
			if (i > last) pieces.push({ text: text.slice(last, i), href: null })
			pieces.push(found.piece)
			last = found.end
		}
		i = found.end
	}
	if (last < text.length) pieces.push({ text: text.slice(last), href: null })
	return pieces
}

function trimLine(line: Line): Line {
	const runs = line.map((run) => ({ ...run }))
	while (runs.length) {
		const first = runs[0] as Inline
		let k = 0
		while (k < first.text.length && isTrim(at(first.text, k))) k += 1
		if (k < first.text.length) {
			first.text = first.text.slice(k)
			break
		}
		runs.shift()
	}
	while (runs.length) {
		const last = runs[runs.length - 1] as Inline
		let k = last.text.length
		while (k > 0 && isTrim(at(last.text, k - 1))) k -= 1
		if (k > 0) {
			last.text = last.text.slice(0, k)
			break
		}
		runs.pop()
	}
	return runs
}

function isDivider(line: Line) {
	let count = 0
	for (const run of line)
		for (let i = 0; i < run.text.length; i += 1) {
			const c = at(run.text, i)
			if (isTrim(c)) continue
			if (!isDividerChar(c)) return false
			count += 1
		}
	return count >= 5
}

function joinLines(lines: Line[]) {
	const runs: EventTextRun[] = []
	for (const [index, line] of lines.entries()) {
		if (index > 0) {
			if (runs.length >= DESCRIPTION_RUNS_LIMIT - 1) break
			runs.push({ kind: 'break' })
		}
		for (const run of line) {
			if (runs.length >= DESCRIPTION_RUNS_LIMIT) return runs
			runs.push(run)
		}
	}
	return runs
}

function sameRun(run: Inline, href: string | null, bold: boolean, italic: boolean, underline: boolean) {
	const runHref = run.kind === 'link' ? run.href : null
	return runHref === href && run.bold === bold && run.italic === italic && run.underline === underline
}

function isBlank(text: string) {
	for (let i = 0; i < text.length; i += 1) if (!isTrim(at(text, i))) return false
	return true
}

function build(input: string, tokens: Token[], markup: boolean, seen: Seen) {
	const blocks: EventDescriptionBlock[] = []
	let lines: Line[] = [[]]
	let list: { ordered: boolean; items: EventTextRun[][] } | null = null
	let item: Line[] | null = null
	let depth = 0
	let bold = 0
	let italic = 0
	let underline = 0
	let heading = 0
	let anchors = 0
	let href: string | null = null

	const pushBlock = (block: EventDescriptionBlock) => {
		if (blocks.length < DESCRIPTION_BLOCKS_LIMIT) blocks.push(block)
	}
	const target = () => {
		if (!list) return lines
		item ??= [[]]
		return item
	}
	const lineBreak = () => {
		target().push([])
	}
	const pushInline = (text: string, link: string | null) => {
		const current = target()
		const line = current[current.length - 1] as Line
		let value = text
		const previous = line[line.length - 1]
		if (markup && at(value, 0) === 32 && (!previous || previous.text.endsWith(' '))) value = value.slice(1)
		if (!value) return
		const marks = { bold: bold > 0 || heading > 0, italic: italic > 0, underline: underline > 0 }
		const linkHref = link !== null && !isBlank(value) ? link : null
		if (
			previous &&
			sameRun(previous, linkHref, marks.bold, marks.italic, marks.underline) &&
			previous.text.length + value.length <= DESCRIPTION_TEXT_LIMIT
		) {
			previous.text += value
			return
		}
		if (line.length >= DESCRIPTION_RUNS_LIMIT) return
		line.push(
			linkHref ? { kind: 'link', text: value, href: linkHref, ...marks } : { kind: 'text', text: value, ...marks }
		)
	}
	const inline = (text: string) => {
		if (!text) return
		if (anchors > 0) pushInline(text, href)
		else for (const piece of linkify(text)) pushInline(piece.text, piece.href)
	}
	const flushParagraph = () => {
		let group: Line[] = []
		const close = () => {
			if (group.length) pushBlock({ kind: 'paragraph', runs: joinLines(group) })
			group = []
		}
		for (const line of lines) {
			const trimmed = trimLine(line)
			if (!trimmed.length) close()
			else if (isDivider(trimmed)) {
				close()
				pushBlock({ kind: 'divider' })
			} else group.push(trimmed)
		}
		close()
		lines = [[]]
	}
	const finishItem = () => {
		if (item && list) {
			const kept = item.map(trimLine).filter((line) => line.length > 0)
			if (kept.length && list.items.length < DESCRIPTION_ITEMS_LIMIT) list.items.push(joinLines(kept))
		}
		item = null
	}
	const flushList = () => {
		finishItem()
		if (list?.items.length) pushBlock({ kind: 'list', ordered: list.ordered, items: list.items })
		list = null
		depth = 0
	}
	const boundary = () => {
		if (!list) flushParagraph()
		else if (item) lineBreak()
	}

	for (const token of tokens) {
		if (token.kind === 'text') {
			const decoded = decodeEntities(input.slice(token.start, token.end), seen)
			if (markup) inline(collapse(decoded))
			else
				for (const [index, part] of decoded.split('\n').entries()) {
					if (index > 0) lineBreak()
					inline(part.replaceAll('\r', ''))
				}
			continue
		}
		const name = token.name
		const opening = token.kind === 'open'
		if (name === 'b' || name === 'strong') bold = opening ? bold + 1 : Math.max(0, bold - 1)
		else if (name === 'i' || name === 'em') italic = opening ? italic + 1 : Math.max(0, italic - 1)
		else if (name === 'u') underline = opening ? underline + 1 : Math.max(0, underline - 1)
		else if (HEADINGS.has(name)) {
			boundary()
			heading = opening ? heading + 1 : Math.max(0, heading - 1)
		} else if (PARAGRAPHS.has(name)) boundary()
		else if (name === 'br') lineBreak()
		else if (name === 'ul' || name === 'ol') {
			if (opening) {
				if (depth === 0) {
					flushParagraph()
					list = { ordered: name === 'ol', items: [] }
				} else finishItem()
				depth += 1
			} else if (depth > 0) {
				depth -= 1
				if (depth === 0) flushList()
				else finishItem()
			}
		} else if (name === 'li') {
			if (list) finishItem()
			else flushParagraph()
		} else if (name === 'a') {
			if (opening) {
				if (anchors === 0) href = safeHref(token.href, seen)
				anchors += 1
			} else if (anchors > 0) {
				anchors -= 1
				if (anchors === 0) href = null
			}
		}
	}
	flushList()
	flushParagraph()
	return blocks
}

export function readDescription(raw: string | null): DescriptionReading {
	if (!raw) return { blocks: [], formatted: false }
	const input = raw.slice(0, DESCRIPTION_LIMIT)
	const { tokens, markup } = tokenize(input)
	const seen: Seen = { entity: false }
	const blocks = build(input, tokens, markup, seen)
	return { blocks, formatted: markup || seen.entity }
}
