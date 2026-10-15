import { registerHooks } from 'node:module'

import * as core from '../../../packages/core/src/index.ts'
import type { Expect } from './run.ts'

const WEB = new URL('../../../apps/web/', import.meta.url).href

registerHooks({
	resolve(specifier, context, nextResolve) {
		const fromWeb = context.parentURL?.startsWith(WEB) ?? false
		let target = specifier
		if (fromWeb && specifier.startsWith('@/')) target = new URL(`${specifier.slice(2)}.ts`, WEB).href
		else if (fromWeb && specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) target = `${specifier}.ts`
		const result = nextResolve(target, context)
		return result.url.startsWith(WEB) && result.url.endsWith('.ts')
			? { ...result, format: 'module-typescript' }
			: result
	},
})

const web: { nameMatches: (name: string, query: string) => boolean; eventName: (title: string | null) => string } =
	await import(new URL('lib/lesson-count-text.ts', WEB).href)

const char = (code: number) => String.fromCharCode(code)
const ZWSP = char(0x200b)
const ZWJ = char(0x200d)
const WJ = char(0x2060)
const SHY = char(0x00ad)
const LIGATURE_FI = char(0xfb01)
const FULLWIDTH_ALEX = [0xff21, 0xff4c, 0xff45, 0xff58].map(char).join('')

const CASES: [string, string, string, boolean][] = [
	['nfkcFullwidth', 'Alex Example 2101', FULLWIDTH_ALEX, true],
	['nfkcLigature', `Alex Example 2101 pro${LIGATURE_FI}le`, 'profile', true],
	['zeroWidthName', `Alex${ZWSP} Example 2101`, 'alex example', true],
	['zeroWidthQuery', 'Alex Example 2101', `Ex${ZWJ}am${WJ}ple`, true],
	['softHyphen', `Ex${SHY}ample 2101`, 'example', true],
	['latinInCyrillicName', 'Aлeкc Экзампл 2101', 'алекс', true],
	['latinQuery', 'Алекс Экзампл 2101 урок', 'ypok', true],
	['latinQueryMixed', 'Алекс Экзампл 2101', 'Экзaмпл', true],
	['yoInName', 'Алёкс Экзампл 2101', 'алекс', true],
	['yoInQuery', 'Алекс Экзампл 2101', 'алёкс', true],
	['spaces', '  Alex   Example\t2101  ', 'alex example 2101', true],
	['emptyQuery', 'Alex Example 2101', '', true],
	['blankQuery', 'Alex Example 2101', `  ${ZWSP} `, true],
	['otherNumber', 'Alex Example 2101', 'Alex Example 2102', false],
	['latinNameCyrillicQuery', 'Alex Example 2101', 'алекс', false],
]

const SIMILAR: [string, string, string, string | null][] = [
	['cyrillicToYekaterina', 'Yekaterina IELTS', 'Екатерина', 'Yekaterina'],
	['cyrillicToEkaterina', 'Ekaterina', 'Екатерина', 'Ekaterina'],
	['cyrillicToJekaterina', 'Jekaterina', 'Екатерина', 'Jekaterina'],
	['latinToCyrillic', 'Екатерина speaking', 'Yekaterina', 'Екатерина'],
	['fullToKatya', 'Катя', 'Екатерина', 'Катя'],
	['fullToLatinKatya', 'Katya', 'Екатерина', 'Katya'],
	['katyaToFull', 'Екатерина', 'Катя', 'Екатерина'],
	['vanyaToIvan', 'Иван', 'Ваня', 'Иван'],
	['fullToLatinShort', 'Misha', 'Михаил', 'Misha'],
	['sashaToAleksandra', 'Александра', 'Саша', 'Александра'],
	['vovaToVladimir', 'Владимир', 'Вова', 'Владимир'],
	['mariya', 'Maria', 'Мария', 'Maria'],
	['dmitry', 'Dmitry', 'Дмитрий', 'Dmitry'],
	['sergei', 'Sergei', 'Сергей', 'Sergei'],
	['yulia', 'Iulia', 'Юлия', 'Iulia'],
	['typo', 'Ekatarina', 'Екатерина', 'Ekatarina'],
	['alexander', 'Alexander', 'Александр', 'Alexander'],
	['prefix', 'Екатерина Иванова', 'Екат', 'Екатерина'],
	['latinPrefix', 'Yekaterina', 'Екат', 'Yekaterina'],
	['lookalike', 'Eкатерина', 'екатерина', 'Eкатерина'],
	['twoWords', 'Alex Example 0002', 'alex example 0002', 'Alex Example 0002'],
	['annaNotYana', 'Яна', 'Анна', null],
	['yanaNotTatyana', 'Татьяна', 'Яна', null],
	['annaNotAnastasia', 'Анастасия', 'Анна', null],
	['mashaNotMisha', 'Миша', 'Маша', null],
	['sashaNotDasha', 'Даша', 'Саша', null],
	['olyaNotYulya', 'Юля', 'Оля', null],
	['lenaNotLera', 'Лера', 'Лена', null],
	['iraNotInna', 'Инна', 'Ира', null],
	['mariaNotMarina', 'Марина', 'Мария', null],
	['alinaNotAlena', 'Алёна', 'Алина', null],
	['marinaNotArina', 'Арина', 'Марина', null],
	['angelinaNotAngelika', 'Ангелика', 'Ангелина', null],
	['polinaNotGalina', 'Галина', 'Полина', null],
	['alekseiNotAleksandr', 'Александр', 'Алексей', null],
	['otherNumber', 'Alex Example 0001', 'alex example 0002', null],
	['unrelated', 'Other', 'Екатерина', null],
]

const SCORES: [string, string, string][] = [
	['typo', 'Ekatarina', 'Екатерина'],
	['alexander', 'Alexander', 'Александр'],
	['marinaArina', 'Арина', 'Марина'],
	['angelinaAngelika', 'Ангелика', 'Ангелина'],
	['mashaMisha', 'Миша', 'Маша'],
	['annaYana', 'Яна', 'Анна'],
]

function textMatchVectors(expect: Expect): void {
	expect(
		'p2 text-match similarTitle: transliteration, name forms and the similarity threshold',
		Object.fromEntries(SIMILAR.map(([name, title, query]) => [name, core.similarTitle(title, query)])),
		Object.fromEntries(SIMILAR.map(([name, , , wanted]) => [name, wanted]))
	)
	expect(
		'p2 text-match latinKey folds Russian and Latin spellings to one key',
		{
			ekaterina: ['Екатерина', 'Yekaterina', 'Ekaterina', 'Jekaterina'].map(core.latinKey),
			katya: ['Катя', 'Katya', 'Katia', 'Katja'].map(core.latinKey),
			letters: ['Хабиб', 'Khabib', 'Жанна', 'Zhanna', 'Щукин', 'Shchukin', 'Юрий', 'Iurii'].map(core.latinKey),
		},
		{
			ekaterina: ['ekaterina', 'ekaterina', 'ekaterina', 'ekaterina'],
			katya: ['katya', 'katya', 'katya', 'katya'],
			letters: ['habib', 'habib', 'zhana', 'zhana', 'shukin', 'shukin', 'yuri', 'yuri'],
		}
	)
	expect(
		'p2 text-match Jaro-Winkler scores around the threshold',
		Object.fromEntries(
			SCORES.map(([name, left, right]) => [
				name,
				Math.round(core.jaroWinkler(core.latinKey(left), core.latinKey(right)) * 1000) / 1000,
			])
		),
		{ typo: 0.956, alexander: 0.98, marinaArina: 0.944, angelinaAngelika: 0.95, mashaMisha: 0.88, annaYana: 0.917 }
	)
	expect(
		'p2 text-match similarity constants',
		{ min: core.NAME_SIMILARITY_MIN, length: core.NAME_SIMILARITY_LENGTH },
		{ min: 0.9, length: 6 }
	)
	expect(
		'p2 text-match nameMatches normalizes NFKC, invisible characters and latin lookalikes',
		Object.fromEntries(CASES.map(([name, title, query]) => [name, core.nameMatches(title, query)])),
		Object.fromEntries(CASES.map(([name, , , wanted]) => [name, wanted]))
	)
	expect(
		'p2 text-match titleText and titleKey',
		{
			text: core.titleText(`  Alex${ZWSP}  Example${SHY}\n2101 ${LIGATURE_FI} `),
			keyCyrillic: [...core.titleKey(`ABCEHKMOPTXY ${char(0x401)}${char(0x451)}`)].every((letter) => {
				const code = letter.codePointAt(0) ?? 0
				return letter === ' ' || (code >= 0x400 && code <= 0x4ff)
			}),
			yo: core.titleKey(`${char(0x401)}${char(0x451)}`) === `${char(0x435)}${char(0x435)}`,
			keepsOther: core.titleKey('L 2101') === 'l 2101',
			empty: core.titleText(`${WJ} ${ZWJ}`),
		},
		{ text: 'Alex Example 2101 fi', keyCyrillic: true, yo: true, keepsOther: true, empty: '' }
	)
	expect(
		'p2 text-match core equals the web copy of the normalizer',
		{
			matches: CASES.filter(([, title, query]) => core.nameMatches(title, query) !== web.nameMatches(title, query)).map(
				([name]) => name
			),
			titles: CASES.filter(([, title]) => (core.titleText(title) || 'Untitled') !== web.eventName(title)).map(
				([name]) => name
			),
			checked: CASES.length,
		},
		{ matches: [], titles: [], checked: 15 }
	)
}

export { textMatchVectors }
