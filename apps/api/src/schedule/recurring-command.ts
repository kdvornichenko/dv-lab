import { and, eq, isNull } from 'drizzle-orm'

import { timeZoneIdentity, type ValidatedCalendarCommand } from '@dv-lab/contracts'
import { weekdayOf } from '@dv-lab/core'
import { googleEventMappings, googleSeriesRule, lessonSeries, type DbExecutor } from '@dv-lab/db'

import { CommandFault } from '../calendar/journal.ts'
import { masterRepresentation } from '../calendar/recurring.ts'

export async function recurringCreation(
	executor: DbExecutor,
	input: Extract<ValidatedCalendarCommand, { operation: 'create' }>,
	timeZone: string,
	connection: { accountId: string; id: string; calendarId: string }
) {
	const value = input.input
	const rule = googleSeriesRule.parse({
		weekday: weekdayOf(value.date),
		startTime: value.startTime,
		timeZone: timeZoneIdentity(timeZone),
		durationMinutes: value.durationMinutes,
		startsOn: value.date,
		endsOn: null,
	})
	const master = masterRepresentation(rule)
	if (!master) throw new CommandFault('history_only')
	const existing = await executor
		.select({ timeZone: lessonSeries.timeZone })
		.from(lessonSeries)
		.innerJoin(
			googleEventMappings,
			and(
				eq(googleEventMappings.localEntityId, lessonSeries.id),
				eq(googleEventMappings.accountId, connection.accountId),
				eq(googleEventMappings.connectionId, connection.id),
				eq(googleEventMappings.calendarId, connection.calendarId),
				eq(googleEventMappings.entityKind, 'series'),
				eq(googleEventMappings.state, 'active')
			)
		)
		.where(
			and(
				eq(lessonSeries.studentId, value.studentId),
				eq(lessonSeries.weekday, rule.weekday),
				eq(lessonSeries.startTime, value.startTime),
				eq(lessonSeries.durationMinutes, value.durationMinutes),
				eq(lessonSeries.startsOn, rule.startsOn),
				isNull(lessonSeries.endsOn)
			)
		)
	if (existing.some((row) => timeZoneIdentity(row.timeZone) === rule.timeZone))
		throw new CommandFault('precondition_failed')
	return { rule, master }
}
