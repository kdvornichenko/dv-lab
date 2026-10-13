import { isIsoDate, type ChatLessonIntent, type MentionBinding } from '@dv-lab/contracts'
import { addDays, lessonDay, weekdayOf, type Weekday } from '@dv-lab/core'

type Direction = 'past' | 'ahead' | 'after'

const WEEKDAYS: Record<string, Weekday> = {
	monday: 1,
	mon: 1,
	tuesday: 2,
	tue: 2,
	tues: 2,
	wednesday: 3,
	wed: 3,
	thursday: 4,
	thu: 4,
	thur: 4,
	thurs: 4,
	friday: 5,
	fri: 5,
	saturday: 6,
	sat: 6,
	sunday: 7,
	sun: 7,
}

const MONTHS: Record<string, number> = {
	jan: 1,
	january: 1,
	feb: 2,
	february: 2,
	mar: 3,
	march: 3,
	apr: 4,
	april: 4,
	may: 5,
	jun: 6,
	june: 6,
	jul: 7,
	july: 7,
	aug: 8,
	august: 8,
	sep: 9,
	sept: 9,
	september: 9,
	oct: 10,
	october: 10,
	nov: 11,
	november: 11,
	dec: 12,
	december: 12,
}

const DATE = `(?:today|yesterday|tomorrow|\\d{4}-\\d{2}-\\d{2}|\\d{1,2} [a-z]{3,9}|\\d{1,2}\\.\\d{1,2}|${Object.keys(WEEKDAYS).join('|')})`
const TIME = '\\d{1,2}:\\d{2}'
const WHEN = `(?: (?:on )?(${DATE}))?(?: (?:at )?(${TIME}))?`
const SERIES = new RegExp(
	`(?:^| )(?:the )?(?:whole series|all lessons|every week|всю серию|все уроки)(?: from (${DATE}))?(?= |$)`,
	'u'
)

const FORMS: { kind: ChatLessonIntent['kind']; pattern: RegExp }[] = [
	{ kind: 'done', pattern: new RegExp(`^was(?: at the lesson)?${WHEN}$`) },
	{ kind: 'no_show', pattern: new RegExp(`^(?:no-show|no show|didn'?t come|did not come)${WHEN}$`) },
	{ kind: 'cancel', pattern: new RegExp(`^(?:didn'?t happen|did not happen)${WHEN}$`) },
]

const MOVE = new RegExp(`^moved(?: from (${DATE})(?: (${TIME}))?)? to(?: (${DATE}))?(?: (?:at )?(${TIME}))?$`)

function normalize(text: string): string {
	return text
		.normalize('NFC')
		.replace(/[‘’ʼ]/g, "'")
		.toLocaleLowerCase('en')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[.!]+$/, '')
		.trim()
}

function clock(value: string | undefined): string | null | undefined {
	if (value === undefined) return undefined
	const [hours, minutes] = value.split(':').map(Number)
	if (hours === undefined || minutes === undefined || hours > 23 || minutes > 59) return null
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function iso(year: number, month: number, day: number): string | null {
	const value = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
	return isIsoDate(value) ? value : null
}

function dayOfYear(month: number, day: number, today: string, direction: Direction): string | null {
	const year = Number(today.slice(0, 4))
	const here = iso(year, month, day)
	if (direction === 'past') {
		if (here !== null && here <= today) return here
		return iso(year - 1, month, day)
	}
	if (here !== null && here >= today) return here
	return iso(year + 1, month, day)
}

function weekdayDate(weekday: Weekday, today: string, direction: Direction): string {
	const shift = (weekday - weekdayOf(today) + 7) % 7
	if (direction === 'past') return addDays(today, shift === 0 ? 0 : shift - 7)
	if (direction === 'ahead') return addDays(today, shift)
	return addDays(today, shift === 0 ? 7 : shift)
}

function parseDate(value: string | undefined, today: string, direction: Direction): string | null | undefined {
	if (value === undefined) return undefined
	if (value === 'today') return today
	if (value === 'yesterday') return addDays(today, -1)
	if (value === 'tomorrow') return addDays(today, 1)
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return isIsoDate(value) ? value : null
	const weekday = WEEKDAYS[value]
	if (weekday !== undefined) return weekdayDate(weekday, today, direction)
	const named = /^(\d{1,2}) ([a-z]{3,9})$/.exec(value)
	if (named) {
		const month = MONTHS[named[2]!]
		return month === undefined ? null : dayOfYear(month, Number(named[1]), today, direction)
	}
	const dotted = /^(\d{1,2})\.(\d{1,2})$/.exec(value)
	if (dotted) return dayOfYear(Number(dotted[2]), Number(dotted[1]), today, direction)
	return null
}

function withoutMention(text: string, binding: MentionBinding): string {
	const start = binding.start > 0 && text[binding.start - 1] === '@' ? binding.start - 1 : binding.start
	return `${text.slice(0, start)} ${text.slice(binding.end)}`
}

function moveIntent(rest: string, studentId: string, today: string): ChatLessonIntent | null {
	const series = SERIES.exec(rest)
	const body = series ? `${rest.slice(0, series.index)}${rest.slice(series.index + series[0].length)}`.trim() : rest
	const from = series ? parseDate(series[1], today, 'ahead') : undefined
	if (from === null) return null
	const match = MOVE.exec(body.replace(/\s+/g, ' '))
	if (!match) return null
	const date = parseDate(match[1], today, 'ahead')
	const time = clock(match[2])
	const targetDate = parseDate(match[3], today, 'after')
	const targetTime = clock(match[4])
	if (date === null || time === null || targetDate === null || targetTime === null) return null
	if (time !== undefined && date === undefined) return null
	const intent: ChatLessonIntent = { kind: 'move', studentId, scope: series ? 'series' : 'one' }
	if (date !== undefined) intent.date = date
	if (time !== undefined) intent.time = time
	if (from !== undefined) intent.from = from
	if (targetDate !== undefined || targetTime !== undefined) {
		intent.target = { date: targetDate ?? date ?? from ?? today }
		if (targetTime !== undefined) intent.target.time = targetTime
	}
	return intent
}

export function parseQuickCommand(
	text: string,
	bindings: readonly MentionBinding[],
	now: Date,
	timeZone: string
): ChatLessonIntent | null {
	if (bindings.length !== 1) return null
	const binding = bindings[0]!
	const rest = normalize(withoutMention(text, binding))
	if (!rest || rest.includes('@')) return null
	const today = lessonDay(now, timeZone)
	if (rest.startsWith('moved')) return moveIntent(rest, binding.studentId, today)
	if (SERIES.test(rest)) return null
	for (const form of FORMS) {
		const match = form.pattern.exec(rest)
		if (!match) continue
		const date = parseDate(match[1], today, 'past')
		const time = clock(match[2])
		if (date === null || time === null) return null
		const intent: ChatLessonIntent = { kind: form.kind, studentId: binding.studentId, scope: 'one' }
		if (date !== undefined) intent.date = date
		if (time !== undefined) intent.time = time
		return intent
	}
	return null
}
