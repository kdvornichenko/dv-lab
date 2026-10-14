import type { ChatExcerptBlock } from '@dv-lab/contracts'
import { zonedParts } from '@dv-lab/core'

export type GateContext = {
	knownIds: Set<string>
	dates: Set<string>
	times: Set<string>
	names: Set<string>
}

export function gateContext(): GateContext {
	return { knownIds: new Set(), dates: new Set(), times: new Set(), names: new Set() }
}

export type Issued = Map<string, ChatExcerptBlock>

export type GateVerdict = 'publish' | 'withhold'

const WINDOW = 5

const MONEY_SIGN = /[₽$₫€]/u
const DIGIT = /\p{Nd}/u
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu
const LINK = /\bhttps?:\/\/|\bwww\./iu
const HALF_PREFIX = /(^|[^\p{L}])пол-?(час|урок|минут)/iu
const WORD = /[\p{L}\p{Nd}]+/gu
const CITE = /\[\[(note|comment|section):([^\]\s]{1,80})\]\][ \t]*[,;]?/giu
const BEFORE_MARK = /[ \t]+([.,;:!?])/gu
const REPEATED_SPACE = /[ \t]{2,}/gu
const DANGLING_MARK = /[:;,][ \t]*([.!?])/gu

const MONTHS = [
	'январ[ьяе]|january|jan',
	'феврал[ьяе]|february|feb',
	'март[ае]?|march|mar',
	'апрел[ьяе]|april|apr',
	'ма[йяе]|may',
	'июн[ьяе]|june|jun',
	'июл[ьяе]|july|jul',
	'август[ае]?|august|aug',
	'сентябр[ьяе]|september|sept|sep',
	'октябр[ьяе]|october|oct',
	'ноябр[ьяе]|november|nov',
	'декабр[ьяе]|december|dec',
]
const MONTH_FORMS = MONTHS.map((forms) => new RegExp(`^(?:${forms})$`, 'iu'))
const MONTH = MONTHS.map((forms) => `(?:${forms})`).join('|')
const START = '(?<![\\p{L}\\p{Nd}])'
const END = '(?![\\p{L}\\p{Nd}])'
const YEAR = '(?:,?\\s+(\\d{4})(?:\\s*(?:г\\.?|года?)(?!\\p{L}))?)?'
const DAY_MONTH = new RegExp(
	`${START}(\\d{1,2})(?:-?(?:го|е|st|nd|rd|th))?\\s+(?:of\\s+)?(${MONTH})\\.?${END}${YEAR}`,
	'giu'
)
const MONTH_DAY = new RegExp(`${START}(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?${END}${YEAR}`, 'giu')
const ISO_DATE = /(?<![\p{L}\p{Nd}])(\d{4})-(\d{2})-(\d{2})(?![\p{L}\p{Nd}])/gu
const CLOCK = /(?<![\p{Nd}:])(\d{1,2}):(\d{2})(?![\p{Nd}:])/gu
const INSTANT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})/gu
const NAME_KEYS = new Set(['name', 'student', 'studentName', 'displayName'])

const pad = (value: number) => String(value).padStart(2, '0')

function monthOf(word: string): number {
	return MONTH_FORMS.findIndex((forms) => forms.test(word)) + 1
}

function spokenDates(text: string, visit: (month: number, day: number, year: string | undefined) => void): string {
	return text
		.replace(DAY_MONTH, (_match, day: string, month: string, year?: string) => {
			visit(monthOf(month), Number(day), year)
			return ' '
		})
		.replace(MONTH_DAY, (_match, month: string, day: string, year?: string) => {
			visit(monthOf(month), Number(day), year)
			return ' '
		})
		.replace(ISO_DATE, (_match, year: string, month: string, day: string) => {
			visit(Number(month), Number(day), year)
			return ' '
		})
}

function withoutKnownWhen(text: string, context: GateContext): string | null {
	let unknown = false
	const dated = spokenDates(text, (month, day, year) => {
		const key = `${pad(month)}-${pad(day)}`
		const known = [...context.dates].some((date) => (year ? date === `${year}-${key}` : date.endsWith(`-${key}`)))
		if (!known) unknown = true
	})
	const timed = dated.replace(CLOCK, (_match, hour: string, minute: string) => {
		if (!context.times.has(`${hour.padStart(2, '0')}:${minute}`)) unknown = true
		return ' '
	})
	return unknown ? null : timed
}

function withoutNames(text: string, context: GateContext): string {
	let out = text
	for (const name of context.names) {
		const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
		out = out.replace(new RegExp(`(?<![\\p{L}\\p{Nd}])${escaped}(?![\\p{L}\\p{Nd}])`, 'giu'), ' ')
	}
	return out
}

export function learnWhen(context: GateContext, text: string, zone: string, year?: string) {
	const rest = text.replace(INSTANT, (instant) => {
		const at = new Date(instant)
		if (Number.isNaN(at.getTime())) return ' '
		const parts = zonedParts(at, zone)
		context.dates.add(parts.date)
		context.times.add(parts.time)
		return ' '
	})
	const spoken = spokenDates(rest, (month, day, named) => {
		const value = named ?? year
		if (month > 0 && value !== undefined) context.dates.add(`${value}-${pad(month)}-${pad(day)}`)
	})
	for (const match of spoken.matchAll(CLOCK)) context.times.add(`${match[1]!.padStart(2, '0')}:${match[2]}`)
}

export function learnName(context: GateContext, name: string) {
	const key = name.trim().toLowerCase()
	if (key.length >= 2) context.names.add(key)
}

function walkNames(context: GateContext, value: unknown) {
	if (Array.isArray(value)) for (const item of value) walkNames(context, item)
	else if (value !== null && typeof value === 'object')
		for (const [key, item] of Object.entries(value)) {
			if (typeof item === 'string' && NAME_KEYS.has(key)) learnName(context, item)
			else walkNames(context, item)
		}
}

export function learnNames(context: GateContext, content: string) {
	try {
		walkNames(context, JSON.parse(content))
	} catch {
		return
	}
}

const NUMBER_WORDS = new Set([
	'zero',
	'one',
	'two',
	'three',
	'four',
	'five',
	'six',
	'seven',
	'eight',
	'nine',
	'ten',
	'eleven',
	'twelve',
	'thirteen',
	'fourteen',
	'fifteen',
	'sixteen',
	'seventeen',
	'eighteen',
	'nineteen',
	'twenty',
	'thirty',
	'forty',
	'fifty',
	'sixty',
	'seventy',
	'eighty',
	'ninety',
	'hundred',
	'hundreds',
	'thousand',
	'thousands',
	'dozen',
	'dozens',
	'half',
	'once',
	'twice',
	'ноль',
	'нуля',
	'нулю',
	'один',
	'одна',
	'одно',
	'одного',
	'одной',
	'одному',
	'одну',
	'одним',
	'два',
	'две',
	'двух',
	'двум',
	'двумя',
	'три',
	'трех',
	'трёх',
	'трем',
	'трём',
	'тремя',
	'четыре',
	'четырех',
	'четырёх',
	'четырем',
	'четырём',
	'четырьмя',
	'сорок',
	'сорока',
	'девяносто',
	'девяноста',
	'сто',
	'ста',
	'сотня',
	'сотни',
	'сотен',
	'двести',
	'двухсот',
	'триста',
	'трехсот',
	'трёхсот',
	'четыреста',
	'тысяча',
	'тысячи',
	'тысячу',
	'тысяч',
	'тысячей',
	'тысячам',
	'десяток',
	'десятка',
	'десятков',
	'десятки',
	'полтора',
	'полторы',
	'полутора',
	'половина',
	'половину',
	'половины',
	'пол',
	'дважды',
	'трижды',
])

const NUMBER_STEMS = [
	/^(пят|шест|сем|восем|девят|десят)(ь|и|ью)$/u,
	/^(одиннадцат|двенадцат|тринадцат|четырнадцат|пятнадцат|шестнадцат|семнадцат|восемнадцат|девятнадцат|двадцат|тридцат)(ь|и|ью)$/u,
	/^(пять|шесть|семь|восемь)десят$/u,
	/^(пяти|шести|семи|восьми)десяти$/u,
	/^(пять|шесть|семь|восемь|девять)сот$/u,
	/^(пяти|шести|семи|восьми|девяти)сот$/u,
]

const LEDGER_EXACT = new Set([
	'min',
	'mins',
	'hr',
	'hrs',
	'left',
	'owe',
	'owes',
	'owed',
	'owing',
	'мин',
	'руб',
	'rub',
	'usd',
	'vnd',
	'kzt',
	'eur',
	'евро',
	'euro',
	'euros',
	'тенге',
	'tenge',
])

const LEDGER_PREFIXES = [
	'lesson',
	'minute',
	'hour',
	'balance',
	'remain',
	'pay',
	'paid',
	'debt',
	'dollar',
	'dong',
	'ruble',
	'rouble',
	'урок',
	'минут',
	'остат',
	'остал',
	'занят',
	'баланс',
	'оплат',
	'оплач',
	'сумм',
	'стоим',
	'плат',
	'долг',
	'долж',
	'рубл',
	'доллар',
	'донг',
]

const HOUR_RU = /^час(а|ов|у|ом|ам|ами|ах)?$/u

function isNumber(word: string): boolean {
	return DIGIT.test(word) || NUMBER_WORDS.has(word) || NUMBER_STEMS.some((stem) => stem.test(word))
}

function isLedger(word: string): boolean {
	return LEDGER_EXACT.has(word) || HOUR_RU.test(word) || LEDGER_PREFIXES.some((prefix) => word.startsWith(prefix))
}

function unknownRecord(sentence: string, context: GateContext): boolean {
	for (const match of sentence.matchAll(UUID)) if (!context.knownIds.has(match[0].toLowerCase())) return true
	return false
}

export function checkSentence(sentence: string, context: GateContext): GateVerdict {
	if (MONEY_SIGN.test(sentence) || LINK.test(sentence) || unknownRecord(sentence, context)) return 'withhold'
	if (HALF_PREFIX.test(sentence)) return 'withhold'
	const rest = withoutKnownWhen(withoutNames(sentence.replace(UUID, ' ').toLowerCase(), context), context)
	if (rest === null) return 'withhold'
	const words = rest.match(WORD) ?? []
	const ledger = words.map(isLedger)
	for (const [index, word] of words.entries()) {
		if (!isNumber(word)) continue
		const from = Math.max(0, index - WINDOW)
		const to = Math.min(words.length, index + WINDOW + 1)
		if (ledger.slice(from, to).some(Boolean)) return 'withhold'
	}
	return 'publish'
}

export function citeKey(source: ChatExcerptBlock['source'], id: string): string {
	return `${source}:${id}`.toLowerCase()
}

export type Cited = { text: string; excerpts: ChatExcerptBlock[] }

export function resolveCites(sentence: string, issued: Issued): Cited | null {
	const excerpts: ChatExcerptBlock[] = []
	let unknown = false
	let marked = false
	const stripped = sentence.replace(CITE, (_match, source: string, id: string) => {
		marked = true
		const excerpt = issued.get(citeKey(source as ChatExcerptBlock['source'], id))
		if (excerpt) excerpts.push(excerpt)
		else unknown = true
		return ''
	})
	if (unknown || stripped.includes('[[')) return null
	if (!marked) return { text: sentence, excerpts }
	return {
		text: stripped.replace(REPEATED_SPACE, ' ').replace(BEFORE_MARK, '$1').replace(DANGLING_MARK, '$1'),
		excerpts,
	}
}

function boundary(text: string): number {
	for (let index = 0; index < text.length; index++) {
		const char = text[index]
		if (char === '\n') return index + 1
		if ((char === '.' || char === '!' || char === '?') && index + 1 < text.length && /\s/u.test(text[index + 1]!)) {
			let end = index + 1
			while (end < text.length && /[ \t]/u.test(text[end]!)) end++
			if (end < text.length && text[end] === '\n') end++
			return end
		}
	}
	return -1
}

export type SentenceSplitter = { push: (delta: string) => string[]; flush: () => string | null }

export function sentenceSplitter(): SentenceSplitter {
	let buffer = ''
	return {
		push(delta) {
			buffer += delta
			const out: string[] = []
			for (let end = boundary(buffer); end > 0; end = boundary(buffer)) {
				out.push(buffer.slice(0, end))
				buffer = buffer.slice(end)
			}
			return out
		},
		flush() {
			const rest = buffer
			buffer = ''
			return rest === '' ? null : rest
		},
	}
}
