import { startOfZonedDay } from '@dv-lab/core'

import { bindEvent, pendingStudents, type BoundEvent, type MappingSnapshot } from './event-mapping.ts'
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
	for (;;) {
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
		for (const eventId of page.cancelledIds) {
			if (order.ids.has(eventId)) throw new CalendarFault('invalid_provider_data')
			order.ids.add(eventId)
		}
		validateOrder(page.events, order)
		pageToken = page.nextPageToken
		if (pageToken && tokens.has(pageToken)) throw new CalendarFault('invalid_provider_data')
		if (pageToken) tokens.add(pageToken)
		const enough = consume(page.events)
		if (!pageToken || enough) return { endOfList: !pageToken, timeZone }
	}
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

export type NextProof = {
	studentId: string
	result: 'known' | 'none' | 'unknown'
	startsAt: Date | null
	completePrefix: boolean
	endOfList: boolean
}

export async function nextPrefix(
	transport: ReadTransport,
	now: Date,
	snapshot: MappingSnapshot,
	studentIds: readonly string[]
) {
	const bound = new Set(snapshot.mappings.filter((row) => row.state !== 'retired').map((row) => row.studentId))
	const pending = pendingStudents(snapshot)
	const emptyStudentIds = studentIds.filter((id) => !bound.has(id) && !pending.has(id))
	const wanted = new Set(studentIds.filter((id) => bound.has(id) || pending.has(id)))
	const searchable = new Set([...wanted].filter((id) => !pending.has(id)))
	const found = new Map<string, Date>()
	let endOfList = false
	if (searchable.size) {
		try {
			const result = await traverseEvents(transport, { timeMin: now.toISOString() }, (page) => {
				for (const raw of page) {
					const event = bindEvent(raw, snapshot)
					const start = eventStart(event)
					if (event.bindingKind !== 'lesson' || event.status === 'cancelled' || !event.studentId) continue
					if (start === null || start < now.getTime() || !searchable.has(event.studentId)) continue
					if (!found.has(event.studentId)) found.set(event.studentId, new Date(start))
				}
				return found.size === searchable.size
			})
			endOfList = result.endOfList
		} catch (error) {
			if (error instanceof CalendarFault && error.code !== 'provider_unavailable') throw error
			if (!transport.signal.aborted && !(error instanceof CalendarFault)) throw error
		}
	}
	const proofs: NextProof[] = [...wanted].map((studentId) => {
		if (pending.has(studentId))
			return {
				studentId,
				startsAt: null,
				result: 'unknown',
				completePrefix: false,
				endOfList: false,
			}
		const startsAt = found.get(studentId) ?? null
		return {
			studentId,
			startsAt,
			result: startsAt ? 'known' : endOfList ? 'none' : 'unknown',
			completePrefix: Boolean(startsAt) || endOfList,
			endOfList,
		}
	})
	return { proofs, emptyStudentIds }
}
