export function titleText(value: string): string {
	return value
		.normalize('NFKC')
		.replace(/[\u200B-\u200D\u2060\u00AD]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
}

const LOOKALIKES: Record<string, string> = {
	a: 'а',
	b: 'в',
	c: 'с',
	e: 'е',
	h: 'н',
	k: 'к',
	m: 'м',
	o: 'о',
	p: 'р',
	t: 'т',
	x: 'х',
	y: 'у',
	ё: 'е',
}

export function titleKey(value: string): string {
	return titleText(value)
		.toLocaleLowerCase()
		.replace(/[abcehkmoptxyё]/g, (letter) => LOOKALIKES[letter] ?? letter)
}

export function nameMatches(name: string, query: string): boolean {
	return titleKey(name).includes(titleKey(query))
}

const CYRILLIC_LATIN: Record<string, string> = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'g',
	д: 'd',
	е: 'e',
	ё: 'e',
	ж: 'zh',
	з: 'z',
	и: 'i',
	й: 'y',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'h',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'sh',
	ъ: '',
	ы: 'y',
	ь: '',
	э: 'e',
	ю: 'yu',
	я: 'ya',
	і: 'i',
	ї: 'yi',
	є: 'ye',
}

const LATIN_FOLDS: [RegExp, string][] = [
	[/shch|sch/g, 'sh'],
	[/kh/g, 'h'],
	[/ph/g, 'f'],
	[/tz/g, 'ts'],
	[/ck/g, 'k'],
	[/x/g, 'ks'],
	[/w/g, 'v'],
	[/q/g, 'k'],
	[/ch/g, '\u0000'],
	[/c/g, 'k'],
	[/\u0000/g, 'ch'],
	[/j/g, 'y'],
	[/iy(?=[aeou])/g, 'y'],
	[/i(?=[aeou])/g, 'y'],
	[/yy/g, 'y'],
	[/^ye/, 'e'],
	[/([aeiouy])ye/g, '$1e'],
	[/(?:iy|ii|yi)$/, 'i'],
	[/y$/, 'i'],
	[/(.)\1+/g, '$1'],
]

export function latinKey(word: string): string {
	let key = ''
	for (const letter of word.normalize('NFKC').toLocaleLowerCase()) key += CYRILLIC_LATIN[letter] ?? letter
	key = key.normalize('NFD').replace(/\p{M}/gu, '')
	for (const [pattern, replacement] of LATIN_FOLDS) key = key.replace(pattern, replacement)
	return key
}

const NAME_FORMS: readonly (readonly string[])[] = [
	['Иван', 'Ваня'],
	['Екатерина', 'Катерина', 'Катя'],
	['Александр', 'Александра', 'Саша'],
	['Евгений', 'Евгения', 'Женя'],
	['Мария', 'Маша'],
	['Михаил', 'Миша'],
	['Дмитрий', 'Дима'],
	['Алексей', 'Лёша', 'Алёша'],
	['Анастасия', 'Настя'],
	['Елена', 'Лена'],
	['Татьяна', 'Таня'],
	['Ольга', 'Оля'],
	['Юлия', 'Юля'],
	['Наталья', 'Наталия', 'Наташа'],
	['Светлана', 'Света'],
	['Сергей', 'Серёжа'],
	['Николай', 'Коля'],
	['Андрей', 'Андрюша'],
	['Владимир', 'Вова', 'Володя'],
	['Дарья', 'Даша'],
	['Анна', 'Аня'],
	['Ирина', 'Ира'],
	['Виктория', 'Вика'],
	['Ксения', 'Ксюша'],
]

const NAME_GROUPS = new Map<string, Set<number>>()
for (const [index, forms] of NAME_FORMS.entries())
	for (const form of forms) {
		const key = latinKey(form)
		NAME_GROUPS.set(key, (NAME_GROUPS.get(key) ?? new Set()).add(index))
	}

export const NAME_SIMILARITY_MIN = 0.9
export const NAME_SIMILARITY_LENGTH = 6
const LATIN_PREFIX_LENGTH = 4

export function jaroWinkler(left: string, right: string): number {
	if (left === right) return 1
	if (left.length === 0 || right.length === 0) return 0
	const window = Math.max(0, Math.floor(Math.max(left.length, right.length) / 2) - 1)
	const leftHits = new Array<boolean>(left.length).fill(false)
	const rightHits = new Array<boolean>(right.length).fill(false)
	let matches = 0
	for (let index = 0; index < left.length; index++) {
		const from = Math.max(0, index - window)
		const to = Math.min(right.length - 1, index + window)
		for (let other = from; other <= to; other++) {
			if (rightHits[other] || left[index] !== right[other]) continue
			leftHits[index] = true
			rightHits[other] = true
			matches++
			break
		}
	}
	if (matches === 0) return 0
	let transpositions = 0
	let other = 0
	for (let index = 0; index < left.length; index++) {
		if (!leftHits[index]) continue
		while (!rightHits[other]) other++
		if (left[index] !== right[other]) transpositions++
		other++
	}
	const jaro = (matches / left.length + matches / right.length + (matches - transpositions / 2) / matches) / 3
	let prefix = 0
	while (prefix < 4 && prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix++
	return jaro + prefix * 0.1 * (1 - jaro)
}

type TitleWord = { text: string; key: string; latin: string }

function titleWords(value: string): TitleWord[] {
	return (titleText(value).match(/[\p{L}\p{N}]+/gu) ?? []).map((text) => ({
		text,
		key: titleKey(text),
		latin: latinKey(text),
	}))
}

function sameName(left: string, right: string): boolean {
	const groups = NAME_GROUPS.get(left)
	if (groups === undefined) return false
	for (const group of NAME_GROUPS.get(right) ?? []) if (groups.has(group)) return true
	return false
}

function consonants(key: string): string {
	return key.replace(/[aeiouy]/g, '')
}

function wordMatches(title: TitleWord, query: TitleWord): boolean {
	if (title.key.startsWith(query.key) || title.latin === query.latin) return true
	if (query.latin.length >= LATIN_PREFIX_LENGTH && title.latin.startsWith(query.latin)) return true
	if (/^\p{N}+$/u.test(query.text) || /^\p{N}+$/u.test(title.text)) return false
	if (sameName(title.latin, query.latin)) return true
	return (
		title.latin.length >= NAME_SIMILARITY_LENGTH &&
		query.latin.length >= NAME_SIMILARITY_LENGTH &&
		consonants(title.latin) === consonants(query.latin) &&
		jaroWinkler(title.latin, query.latin) >= NAME_SIMILARITY_MIN
	)
}

export function similarTitle(title: string, query: string): string | null {
	const words = titleWords(title)
	const asked = titleWords(query)
	if (asked.length === 0) return titleText(title)
	const matched = new Set<number>()
	for (const word of asked) {
		const hits = words.flatMap((candidate, index) => (wordMatches(candidate, word) ? [index] : []))
		if (hits.length === 0) return null
		for (const index of hits) matched.add(index)
	}
	return [...matched]
		.sort((left, right) => left - right)
		.map((index) => words[index]!.text)
		.join(' ')
}
