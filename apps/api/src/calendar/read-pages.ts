import { startOfZonedDay } from '@dv-lab/core'

import { bindEvent, type BoundEvent, type MappingSnapshot } from './event-mapping.ts'
import { CalendarFault, type GoogleGateway } from './gateway.ts'
import type { EventQuery, ProviderEvent } from './provider-events.ts'

export type ReadTransport = {
	gateway: GoogleGateway
	accessToken: string
	calendarId: string
	signal: AbortSignal
}
type PageConsumer = (events: readonly ProviderEvent[]) => boolean
type PageOrder = { ids: Set<string>; previousStart: number }

export function eventStart(event: ProviderEvent): number | null {
	if (!event.start) return null
	return 'dateTime' in event.start
		? Date.parse(event.start.dateTime)
		: startOfZonedDay(event.start.date, event.start.timeZone).getTime()
}

function validateOrder(events: readonly ProviderEvent[], order: PageOrder) {
	for (const event of events) {
		if (order.ids.has(event.eventId)) throw new CalendarFault('invalid_provider_data')
		order.ids.add(event.eventId)
		const start = eventStart(event)
		if (start === null) continue
		if (start < order.previousStart) throw new CalendarFault('invalid_provider_data')
		order.previousStart = start
	}
}

export async function traverseEvents(
	transport: ReadTransport,
	range: Omit<EventQuery, 'calendarId' | 'pageToken'>,
	consume: PageConsumer
) {
	const order: PageOrder = { ids: new Set(), previousStart: -Infinity }
	const tokens = new Set<string>()
	let pageToken: string | undefined
	let timeZone: string | undefined
	do {
		transport.signal.throwIfAborted()
		const page = await transport.gateway.events(
			transport.accessToken,
			{
				calendarId: transport.calendarId,
				...range,
				pageToken,
			},
			transport.signal
		)
		if (timeZone && page.timeZone !== timeZone) throw new CalendarFault('invalid_provider_data')
		timeZone = page.timeZone
		validateOrder(page.events, order)
		pageToken = page.nextPageToken
		if (pageToken && tokens.has(pageToken)) throw new CalendarFault('invalid_provider_data')
		if (pageToken) tokens.add(pageToken)
		const enough = consume(page.events)
		if (!pageToken || enough) return { endOfList: !pageToken, timeZone }
	} while (pageToken)
	throw new CalendarFault('invalid_provider_data')
}

export async function completeWindow(transport: ReadTransport, start: Date, end: Date, snapshot: MappingSnapshot) {
	const events: BoundEvent[] = []
	const result = await traverseEvents(
		transport,
		{ timeMin: start.toISOString(), timeMax: end.toISOString() },
		(page) => {
			events.push(...page.map((event) => bindEvent(event, snapshot)))
			return false
		}
	)
	return { events, timeZone: result.timeZone }
}

export async function seriesPrefix(
	transport: ReadTransport,
	now: Date,
	snapshot: MappingSnapshot,
	seriesIds: readonly string[]
) {
	const wanted = new Set(seriesIds)
	const found = new Map<string, BoundEvent>()
	if (!wanted.size) return found
	await traverseEvents(transport, { timeMin: now.toISOString() }, (page) => {
		for (const raw of page) {
			const event = bindEvent(raw, snapshot)
			const ref = event.localRef
			if (event.bindingKind !== 'lesson' || ref?.kind !== 'series' || event.status === 'cancelled') continue
			if ((eventStart(event) ?? -Infinity) < now.getTime()) continue
			if (wanted.has(ref.seriesId) && !found.has(ref.seriesId)) found.set(ref.seriesId, event)
		}
		return found.size === wanted.size
	})
	return found
}
