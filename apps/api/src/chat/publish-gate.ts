export type GateContext = { knownIds: ReadonlySet<string> }

export type GateVerdict = 'publish' | 'withhold'

const WINDOW = 5

const MONEY_SIGN = /[₽$₫€]/u
const DIGIT = /\p{Nd}/u
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu
const LINK = /\bhttps?:\/\/|\bwww\./iu
const HALF_PREFIX = /(^|[^\p{L}])пол-?(час|урок|минут)/iu
const WORD = /[\p{L}\p{Nd}]+/gu

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
	'оплат',
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
	const words = sentence.replace(UUID, ' ').toLowerCase().match(WORD) ?? []
	const ledger = words.map(isLedger)
	if (HALF_PREFIX.test(sentence)) return 'withhold'
	for (const [index, word] of words.entries()) {
		if (!isNumber(word)) continue
		const from = Math.max(0, index - WINDOW)
		const to = Math.min(words.length, index + WINDOW + 1)
		if (ledger.slice(from, to).some(Boolean)) return 'withhold'
	}
	return 'publish'
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
