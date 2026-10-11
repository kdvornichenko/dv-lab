import { timeZoneIdentity } from '@dv-lab/contracts'
import { addDays, lastSeriesDateOnOrBefore, nextSeriesDate, seriesStart, startOfZonedDay } from '@dv-lab/core'
import type { GoogleCommandPlan } from '@dv-lab/db'

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

function recurrenceFields(lines: readonly string[]) {
	if (lines.length !== 1 || !lines[0].startsWith('RRULE:')) return null
	const fields = lines[0]
		.slice(6)
		.split(';')
		.map((field) => field.split('='))
	if (fields.some((field) => field.length !== 2)) return null
	const values = new Map(fields.map(([key, value]) => [key, value]))
	if (values.size !== fields.length) return null
	if ((values.get('INTERVAL') ?? '1') !== '1' || (values.get('WKST') ?? 'MO') !== 'MO') return null
	values.delete('INTERVAL')
	values.delete('WKST')
	return values
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
