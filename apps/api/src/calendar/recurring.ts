import { isTimeZone, timeZoneIdentity } from '@dv-lab/contracts'
import {
	addDays,
	lastSeriesDateOnOrBefore,
	localTimeCandidates,
	nextSeriesDate,
	seriesStart,
	startOfZonedDay,
	zonedParts,
} from '@dv-lab/core'
import type { GoogleCommandPlan } from '@dv-lab/db'

import type { EventFact, MasterRecurrence } from './projection.ts'

type Rule = NonNullable<GoogleCommandPlan['capturedRule']>
const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

function lastInstant(rule: Rule): Date | null {
	if (!rule.endsOn) return null
	let date = lastSeriesDateOnOrBefore(rule, rule.endsOn)
	while (date) {
		const instant = seriesStart(rule, date)
		if (instant) return instant
		date = lastSeriesDateOnOrBefore(rule, addDays(date, -1))
	}
	return null
}

export function masterRepresentation(rule: Rule) {
	const firstOn = nextSeriesDate(rule, new Date(startOfZonedDay(rule.startsOn, rule.timeZone).getTime() - 1))
	if (!firstOn) return null
	const first = seriesStart(rule, firstOn)
	const last = lastInstant(rule)
	if (!first || (rule.endsOn !== null && !last)) return null
	const until = last ? `;UNTIL=${last.toISOString().replace(/[-:]/g, '').replace('.000', '')}` : ''
	return {
		firstOn,
		start: { dateTime: first.toISOString(), timeZone: rule.timeZone },
		end: { dateTime: new Date(first.getTime() + rule.durationMinutes * 60000).toISOString(), timeZone: rule.timeZone },
		recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${weekdays[rule.weekday - 1]}${until}`],
	}
}

function ruleFields(line: string) {
	if (!line.startsWith('RRULE:')) return null
	const fields = line
		.slice(6)
		.split(';')
		.map((field) => field.split('='))
	if (fields.some((field) => field.length !== 2)) return null
	const values = new Map(fields.map(([key, value]) => [key, value]))
	return values.size === fields.length ? values : null
}

function recurrenceFields(lines: readonly string[]) {
	if (lines.length !== 1) return null
	const values = ruleFields(lines[0])
	if (!values) return null
	if ((values.get('INTERVAL') ?? '1') !== '1' || (values.get('WKST') ?? 'MO') !== 'MO') return null
	values.delete('INTERVAL')
	values.delete('WKST')
	return values
}

const FREQUENCIES = new Map<string, NonNullable<MasterRecurrence['recurrenceFrequency']>>([
	['DAILY', 'daily'],
	['WEEKLY', 'weekly'],
	['MONTHLY', 'monthly'],
	['YEARLY', 'yearly'],
])
const WEEKLY_KEYS = new Set(['FREQ', 'BYDAY', 'INTERVAL', 'UNTIL', 'WKST'])

function untilDate(value: string | undefined, timeZone: string): string | null {
	if (!value) return null
	const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(value)
	if (!match) return null
	const [, year, month, day, hour, minute, second, utc] = match
	const date = `${year}-${month}-${day}`
	const midnight = new Date(`${date}T00:00:00Z`)
	if (Number.isNaN(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== date) return null
	if (!hour || !utc) return date
	const instant = new Date(`${date}T${hour}:${minute}:${second}Z`)
	return Number.isNaN(instant.getTime()) ? null : zonedParts(instant, timeZone).date
}

const EXCLUSION = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/

function exclusionParams(head: string) {
	const params = new Map<string, string>()
	if (!head) return params
	if (!head.startsWith(';')) return null
	for (const part of head.slice(1).split(';')) {
		const [key, value, ...rest] = part.split('=')
		if (!key || value === undefined || rest.length) return null
		params.set(key.toUpperCase(), value.replace(/^"(.*)"$/, '$1'))
	}
	return params
}

function exclusionStart(value: string, zone: string): Date | null {
	const match = EXCLUSION.exec(value)
	if (!match) return null
	const [, year, month, day, hour, minute, second, utc] = match
	const date = `${year}-${month}-${day}`
	const midnight = new Date(`${date}T00:00:00Z`)
	if (Number.isNaN(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== date) return null
	if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null
	if (utc) return new Date(`${date}T${hour}:${minute}:${second}Z`)
	if (second !== '00') return null
	return localTimeCandidates(date, `${hour}:${minute}`, zone)[0] ?? null
}

function lineExclusions(line: string, timeZone: string): Date[] | null {
	const colon = line.indexOf(':')
	if (!line.startsWith('EXDATE') || colon < 0) return null
	const params = exclusionParams(line.slice(6, colon))
	if (!params || [...params.keys()].some((key) => key !== 'TZID' && key !== 'VALUE')) return null
	if ((params.get('VALUE') ?? 'DATE-TIME') !== 'DATE-TIME') return null
	const zone = params.get('TZID') ?? timeZone
	if (!isTimeZone(zone)) return null
	const starts = line
		.slice(colon + 1)
		.split(',')
		.map((value) => exclusionStart(value, zone))
	return starts.every((start) => start !== null) ? (starts as Date[]) : null
}

function exclusions(lines: readonly string[], timeZone: string): Date[] | null {
	const starts: Date[] = []
	for (const line of lines) {
		const found = lineExclusions(line, timeZone)
		if (!found) return null
		starts.push(...found)
	}
	return starts
}

export function exclusionFacts(master: EventFact, lines: readonly string[], timeZone: string, now: Date): EventFact[] {
	if (master.status === 'cancelled' || master.recurrence?.recurrenceKind !== 'weekly' || !master.etag) return []
	const starts = exclusions(
		lines.filter((line) => !line.startsWith('RRULE:')),
		timeZone
	)
	return (starts ?? [])
		.filter((start) => start.getTime() >= now.getTime())
		.map((start) => ({
			eventId: `${master.eventId}_${start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
			status: 'cancelled' as const,
			etag: `exdate:${master.etag}`,
			recurringEventId: master.eventId,
			originalStartTime: { dateTime: start.toISOString(), timeZone },
			factAt: master.factAt,
		}))
}

export function classifyRecurrence(lines: readonly string[], timeZone: string): MasterRecurrence {
	const rules = lines.filter((line) => line.startsWith('RRULE:'))
	const rest = lines.filter((line) => !line.startsWith('RRULE:'))
	const fields = rules.length ? ruleFields(rules[0]) : null
	const interval = Number(fields?.get('INTERVAL') ?? '1')
	const frequency = fields ? (FREQUENCIES.get(fields.get('FREQ') ?? '') ?? 'custom') : 'custom'
	const day = weekdays.indexOf(fields?.get('BYDAY') ?? '') + 1
	const weekly =
		fields !== null &&
		rules.length === 1 &&
		exclusions(rest, timeZone) !== null &&
		frequency === 'weekly' &&
		interval === 1 &&
		day > 0 &&
		!fields.has('COUNT') &&
		[...fields.keys()].every((key) => WEEKLY_KEYS.has(key))
	return {
		recurrenceKind: weekly ? 'weekly' : 'other',
		recurrenceWeekday: weekly ? day : null,
		recurrenceFrequency: frequency,
		recurrenceInterval: Number.isSafeInteger(interval) && interval > 0 ? interval : null,
		recurrenceUntil: untilDate(fields?.get('UNTIL'), timeZone),
	}
}

export function sameRecurrence(actual: readonly string[], expected: readonly string[]) {
	const left = recurrenceFields(actual)
	const right = recurrenceFields(expected)
	const weekday = right?.get('BYDAY')
	if (left && weekday && !left.has('BYDAY')) left.set('BYDAY', weekday)
	return Boolean(
		left && right && left.size === right.size && [...left].every(([key, value]) => right.get(key) === value)
	)
}

export function matchesMaster(
	master: {
		event: {
			start: { dateTime?: string; timeZone: string } | null
			end: { dateTime?: string; timeZone: string } | null
			status: string
			eventType: string
			recurringEventId: string | null
		}
		recurrence: readonly string[]
	},
	rule: Rule
) {
	const expected = masterRepresentation(rule)
	const event = master.event
	if (!expected || event.status !== 'confirmed' || event.eventType !== 'default' || event.recurringEventId) return false
	if (!event.start?.dateTime || !event.end?.dateTime) return false
	return (
		sameRecurrence(master.recurrence, expected.recurrence) &&
		timeZoneIdentity(event.start.timeZone) === timeZoneIdentity(rule.timeZone) &&
		Date.parse(event.start.dateTime) === Date.parse(expected.start.dateTime) &&
		Date.parse(event.end.dateTime) === Date.parse(expected.end.dateTime)
	)
}
