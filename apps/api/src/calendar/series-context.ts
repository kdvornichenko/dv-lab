import type { CalendarSeriesContext } from '@dv-lab/contracts'
import { occurrenceAt, scheduleDate, seriesStart, type SeriesRule } from '@dv-lab/core'

import type { MappingSnapshot, BoundEvent } from './event-mapping.ts'
import type { ProviderMaster } from './provider-events.ts'
import { seriesPrefix, type ReadTransport } from './read-pages.ts'
import { opaqueVersion } from './read-state.ts'

const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

function untilMatches(value: string | undefined, rule: SeriesRule) {
	if (rule.endsOn === null) return value === undefined
	if (!value || !/^\d{8}T\d{6}Z$/.test(value)) return false
	const until = new Date(value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'))
	if (!Number.isFinite(until.getTime()) || scheduleDate(until, rule.timeZone) !== rule.endsOn) return false
	const last = occurrenceAt(rule, rule.endsOn)
	return !last || last.startsAt <= until
}

function weeklyRule(recurrence: readonly string[], rule: SeriesRule) {
	if (recurrence.length !== 1 || !recurrence[0]?.startsWith('RRULE:')) return false
	const fields = recurrence[0]
		.slice(6)
		.split(';')
		.map((field) => field.split('='))
	if (fields.some((field) => field.length !== 2)) return false
	const entries = new Map(fields.map(([key, value]) => [key ?? '', value ?? '']))
	if (
		entries.size !== fields.length ||
		[...entries.keys()].some((key) => !['FREQ', 'INTERVAL', 'BYDAY', 'UNTIL', 'WKST'].includes(key))
	)
		return false
	if (entries.get('FREQ') !== 'WEEKLY' || (entries.get('INTERVAL') ?? '1') !== '1') return false
	if ((entries.get('BYDAY') ?? weekdays[rule.weekday - 1]) !== weekdays[rule.weekday - 1]) return false
	if (entries.has('WKST') && entries.get('WKST') !== 'MO') return false
	return untilMatches(entries.get('UNTIL'), rule)
}

function supportedRule(master: ProviderMaster, rule: SeriesRule) {
	const { event, recurrence } = master
	if (event.status !== 'confirmed' || event.eventType !== 'default' || event.recurringEventId) return false
	if (!event.start || !event.end || !('dateTime' in event.start) || !('dateTime' in event.end)) return false
	if (event.start.timeZone !== rule.timeZone || !weeklyRule(recurrence, rule)) return false
	const first = occurrenceAt(rule, rule.startsOn)
	return Boolean(
		first &&
		first.startsAt.getTime() === Date.parse(event.start.dateTime) &&
		Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime) === rule.durationMinutes * 60000
	)
}

function reference(event: BoundEvent, rule: SeriesRule) {
	if (event.localRef?.kind !== 'series' || !event.start || !('dateTime' in event.start)) return null
	return {
		originalOn: event.localRef.originalOn,
		actualStartsAt: event.start.dateTime,
		ruleStartsAt: seriesStart(rule, event.localRef.originalOn)?.toISOString() ?? null,
	}
}

export async function readSeriesContexts(
	transport: ReadTransport,
	snapshot: MappingSnapshot,
	now: Date
): Promise<CalendarSeriesContext[]> {
	if (snapshot.commands.length) return []
	const mappings = snapshot.mappings.filter((row) => row.entityKind === 'series' && row.state === 'active')
	const found = await seriesPrefix(
		transport,
		now,
		snapshot,
		mappings.map((row) => row.localEntityId)
	)
	const contexts: CalendarSeriesContext[] = []
	for (const mapping of mappings) {
		const rule = snapshot.series.get(mapping.localEntityId)
		const next = found.get(mapping.localEntityId)
		if (!rule || !next) continue
		const master = await transport.gateway.master(
			transport.accessToken,
			transport.calendarId,
			mapping.eventId,
			rule.timeZone,
			transport.signal
		)
		if (!supportedRule(master, rule)) continue
		const referenceOccurrence = reference(next, rule)
		if (!referenceOccurrence) continue
		contexts.push({
			series: { ...rule, referenceOccurrence },
			version: opaqueVersion([mapping.id, mapping.representationGeneration, master.event.etag]),
		})
	}
	return contexts
}
