import type { CalendarSeriesContext } from '@dv-lab/contracts'
import { seriesStart, type SeriesRule } from '@dv-lab/core'

import type { MappingSnapshot, BoundEvent } from './event-mapping.ts'
import { seriesPrefix, type ReadTransport } from './read-pages.ts'
import { opaqueVersion } from './read-state.ts'
import { matchesMaster } from './recurring.ts'

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
		if (!matchesMaster(master, rule)) continue
		const referenceOccurrence = reference(next, rule)
		if (!referenceOccurrence) continue
		contexts.push({
			series: { ...rule, referenceOccurrence },
			version: opaqueVersion([mapping.id, mapping.representationGeneration, master.event.etag]),
		})
	}
	return contexts
}
