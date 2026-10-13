import { sql } from 'drizzle-orm'

import { lessonActions, localTimeCandidates, occurrenceOutcome } from '@dv-lab/core'
import { lessonExceptions, type GoogleCommandPlan, type DbExecutor } from '@dv-lab/db'

import { CommandFault } from '../calendar/journal.ts'
import { lockTeacherTimeContext } from '../settings/settings.ts'
import { clearsMark, lockOccurrence, stale } from './changes.ts'
import { markOf } from './rows.ts'
import type { SingleCommand } from './single-command.ts'

export async function occurrenceChange(executor: DbExecutor, accountId: string, input: SingleCommand, now: Date) {
	if (input.ref.kind !== 'series') throw new CommandFault('precondition_failed')
	const locked = await lockOccurrence(executor, input.ref.seriesId, input.ref.originalOn)
	if (!locked?.occurrence?.naturalStart) throw new CommandFault('history_only')
	const { rule, occurrence } = locked
	const mark = await markOf(executor, occurrence.ref)
	if (mark === 'done') throw new CommandFault('lesson_done')
	if (
		stale(input.input.expectedStartsAt, occurrence.startsAt) ||
		!lessonActions(occurrenceOutcome(occurrence, mark), occurrence.startsAt, now)[input.operation]
	)
		throw new CommandFault('precondition_failed')
	let startsAt = occurrence.startsAt
	let durationMinutes = input.operation === 'restore' ? rule.durationMinutes : occurrence.durationMinutes
	if (input.operation === 'move') {
		const settings = await lockTeacherTimeContext(executor, accountId, input.input.expectedDefaultTimeZone, now)
		if (!settings.ok) throw new CommandFault(settings.error)
		const target = localTimeCandidates(input.input.date, input.input.startTime, settings.context.defaultTimeZone)[0]
		if (!target) throw new CommandFault('nonexistent_local_time', 400)
		const length = input.input.durationMinutes ?? occurrence.durationMinutes
		if (target.getTime() === startsAt.getTime() && length === occurrence.durationMinutes)
			throw new CommandFault('invalid_request', 400)
		startsAt = target
		durationMinutes = length
	}
	if (input.operation === 'restore') startsAt = locked.occurrence.naturalStart
	return {
		rule,
		occurrence,
		startsAt,
		durationMinutes,
		clearMark: clearsMark(input.operation, mark, startsAt, now),
	}
}

export async function applyOccurrenceChange(
	executor: DbExecutor,
	input: Extract<GoogleCommandPlan['input'], { operation: 'move' | 'cancel' | 'restore' }>,
	plan: GoogleCommandPlan
) {
	if (input.ref.kind !== 'series') throw new CommandFault('precondition_failed')
	const locked = await lockOccurrence(executor, input.ref.seriesId, input.ref.originalOn)
	const lineage = plan.lineage[0]
	if (!locked?.occurrence?.naturalStart || !lineage || !plan.capturedRule) throw new CommandFault('precondition_failed')
	for (const field of ['weekday', 'startTime', 'timeZone', 'durationMinutes', 'startsOn', 'endsOn'] as const) {
		if (locked.rule[field] !== plan.capturedRule[field]) throw new CommandFault('precondition_failed')
	}
	if (
		lineage.beforeStartsAt !== locked.occurrence.startsAt.toISOString() ||
		lineage.beforeDurationMinutes !== locked.occurrence.durationMinutes ||
		lineage.beforeStatus !== locked.occurrence.status
	)
		throw new CommandFault('precondition_failed')
	const startsAt = new Date(lineage.startsAt)
	const durationMinutes = lineage.durationMinutes
	const kind =
		input.operation === 'cancel'
			? 'cancelled'
			: startsAt.getTime() === locked.occurrence.naturalStart.getTime() &&
				  durationMinutes === locked.rule.durationMinutes
				? 'restored'
				: 'moved'
	const time = kind === 'restored' ? { startsAt: null, durationMinutes: null } : { startsAt, durationMinutes }
	const value = { seriesId: input.ref.seriesId, originalOn: input.ref.originalOn, kind, ...time }
	await executor
		.insert(lessonExceptions)
		.values(value)
		.onConflictDoUpdate({
			target: [lessonExceptions.seriesId, lessonExceptions.originalOn],
			set: { kind, ...time, updatedAt: sql`now()` },
		})
}
