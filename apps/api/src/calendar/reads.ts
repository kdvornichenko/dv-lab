import { readSnapshot, type Database } from '@dv-lab/db'

import { loadMappings } from './event-mapping.ts'
import { CalendarFault, type GoogleGateway } from './gateway.ts'
import type { Credentials } from './google-access.ts'
import type { CalendarObservation } from './observation.ts'
import { completeWindow, nextPrefix, type ReadTransport } from './read-pages.ts'
import { currentRead, recordRead, type CalendarReadContext, type CalendarReadSelection } from './read-state.ts'
import { publishWindow, publishNext } from './read-store.ts'
import { readSeriesContexts } from './series-context.ts'

export type { CalendarReadContext, CalendarReadSelection } from './read-state.ts'

export function createCalendarReads(deps: {
	db: Database
	gateway: GoogleGateway
	credentials: Credentials
	observation: CalendarObservation
}) {
	return {
		observePublicWeek: deps.observation.publicWeek,
		async refreshCalendarRead(context: CalendarReadContext, selection: CalendarReadSelection): Promise<void> {
			recordRead(context, 'provider_unavailable')
			try {
				await deps.credentials.withAccessToken(context.accountId, async (access) => {
					if (!access.connection.calendarId) throw new CalendarFault('connection_required')
					const transport: ReadTransport = {
						gateway: deps.gateway,
						accessToken: access.accessToken,
						calendarId: access.connection.calendarId,
						signal: AbortSignal.any([access.signal, AbortSignal.timeout(30000)]),
					}
					const mappings = await readSnapshot(access.db, (executor) =>
						loadMappings(executor, context.accountId, access.connection.id)
					)
					if (selection.kind === 'next') {
						const result = await nextPrefix(transport, context.now, mappings, [...new Set(selection.studentIds)])
						access.signal.throwIfAborted()
						await publishNext({ db: access.db, context, connection: access.connection, mappings, ...result })
						return
					}
					const result = await completeWindow(transport, selection.start, selection.end, mappings)
					const providerReadAt = Date.now()
					const series = await readSeriesContexts(transport, mappings, context.now).catch(() => [])
					access.signal.throwIfAborted()
					await publishWindow({
						db: access.db,
						context,
						selection,
						connection: access.connection,
						mappings,
						...result,
						series,
					})
					deps.observation.windowRead(context, access.connection, currentRead(context), providerReadAt)
				})
			} catch (error) {
				const reason = error instanceof CalendarFault ? error.code : 'provider_unavailable'
				if (reason === 'reconnect_required' || reason === 'permission_required' || reason === 'invalid_provider_data')
					recordRead(context, reason)
			}
		},
	}
}

export type CalendarReads = ReturnType<typeof createCalendarReads>
