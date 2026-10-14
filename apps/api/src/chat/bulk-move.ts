import { and, asc, eq, gt } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import { type ChatBulkMoveChange, CLOCK_TIME_PATTERN, calendarDate } from '@dv-lab/contracts'
import {
	type SeriesRule,
	type Weekday,
	firstOnOrAfter,
	hasOccurrences,
	localTimeCandidates,
	scheduleToday,
	seriesCutBoundary,
	seriesStart,
	zonedParts,
} from '@dv-lab/core'
import { type DbExecutor, lessonSeries, lessons, students } from '@dv-lab/db'

import { findConnection } from '../calendar/google-access.ts'
import { insideSyncWindow, syncFacts } from '../calendar/projection.ts'
import { seriesColumns, toSeriesRule } from '../schedule/rows.ts'
import { seriesAnchor } from '../schedule/series.ts'
import type { ChatContext } from './actions.ts'
import { type CommandZone, resolveCommandZone } from './command-zone.ts'

export type BulkMoveRequest = {
	operation: 'bulk_move'
	studentId: string
	fromWeekday: Weekday
	fromTime: string
	toWeekday: Weekday
	toTime: string
	zoneText: string | null
	from: string | null
}

export type BulkRefusal =
	| Extract<CommandZone, { kind: 'refused' }>['code']
	| 'student_not_found'
	| 'connection_required'
	| 'outside_sync_window'
	| 'no_matching_lessons'
	| 'series_marked'
	| 'nonexistent_local_time'

const weekday = z.literal([1, 2, 3, 4, 5, 6, 7])
const clockTime = z.string().regex(CLOCK_TIME_PATTERN)

const ruleSnapshot = z.strictObject({
	weekday,
	startTime: clockTime,
	timeZone: z.string(),
	startsOn: calendarDate,
	endsOn: calendarDate.nullable(),
})

const bulkChild = z.strictObject({
	seriesId: z.uuid(),
	from: calendarDate,
	weekday,
	startTime: clockTime,
	durationMinutes: z.number().int(),
	rule: ruleSnapshot,
	requestId: z.uuid(),
})

export const bulkMoveTarget = z.strictObject({
	operation: z.literal('bulk_move'),
	studentId: z.uuid(),
	inputTimeZone: z.string(),
	zoneNamed: z.boolean(),
	accountTimeZone: z.string(),
	fromWeekday: weekday,
	fromTime: clockTime,
	toWeekday: weekday,
	toTime: clockTime,
	children: z.array(bulkChild).min(1),
})

type BulkTarget = z.infer<typeof bulkMoveTarget>
type BulkChild = z.infer<typeof bulkChild>

export type BulkPreview =
	{ kind: 'ok'; target: BulkTarget; change: ChatBulkMoveChange } | { kind: 'refused'; code: BulkRefusal }

const refused = (code: BulkRefusal): BulkPreview => ({ kind: 'refused', code })

export function isBulkMove(target: unknown): boolean {
	return z.object({ operation: z.literal('bulk_move') }).safeParse(target).success
}

function snapshotOf(rule: SeriesRule): BulkChild['rule'] {
	return {
		weekday: rule.weekday,
		startTime: rule.startTime,
		timeZone: rule.timeZone,
		startsOn: rule.startsOn,
		endsOn: rule.endsOn,
	}
}

export function sameRule(rule: SeriesRule, snapshot: BulkChild['rule']): boolean {
	return (
		rule.weekday === snapshot.weekday &&
		rule.startTime === snapshot.startTime &&
		rule.timeZone === snapshot.timeZone &&
		rule.startsOn === snapshot.startsOn &&
		rule.endsOn === snapshot.endsOn
	)
}

export function cutStart(rule: SeriesRule, from: string, zone: string): Date | null {
	if (!hasOccurrences(rule)) return null
	const { naturalCutoff } = seriesCutBoundary(rule, from, zone, 'from')
	if (rule.endsOn !== null && naturalCutoff > rule.endsOn) return null
	return seriesStart(rule, naturalCutoff)
}

function atWallTime(instant: Date, zone: string, day: Weekday, time: string): boolean {
	const parts = zonedParts(instant, zone)
	return parts.weekday === day && parts.time === time
}

async function liveSeries(executor: DbExecutor, studentId: string, now: Date): Promise<SeriesRule[]> {
	const rows = await executor
		.select(seriesColumns)
		.from(lessonSeries)
		.where(eq(lessonSeries.studentId, studentId))
		.orderBy(asc(lessonSeries.startsOn), asc(lessonSeries.id))
	return rows
		.map(toSeriesRule)
		.filter(
			(rule) => hasOccurrences(rule) && (rule.endsOn === null || rule.endsOn >= scheduleToday(now, rule.timeZone))
		)
}

async function singlesAt(executor: DbExecutor, request: BulkMoveRequest, zone: string, now: Date): Promise<number> {
	const rows = await executor
		.select({ startsAt: lessons.startsAt })
		.from(lessons)
		.where(and(eq(lessons.studentId, request.studentId), eq(lessons.status, 'scheduled'), gt(lessons.startsAt, now)))
	return rows.filter((row) => atWallTime(row.startsAt, zone, request.fromWeekday, request.fromTime)).length
}

export async function proposeBulkMove(
	executor: DbExecutor,
	context: ChatContext,
	teacherText: string,
	request: BulkMoveRequest
): Promise<BulkPreview> {
	const zone = resolveCommandZone(request.zoneText, teacherText)
	if (zone.kind === 'refused') return refused(zone.code)
	const [card] = await executor
		.select({ id: students.id, displayName: students.displayName, status: students.status })
		.from(students)
		.where(eq(students.id, request.studentId))
	if (!card || card.status !== 'active') return refused('student_not_found')
	if (!context.calendarEnabled) return refused('connection_required')
	const connection = await findConnection(executor, context.accountId)
	if (!connection) return refused('connection_required')
	const sync = await syncFacts(executor, connection.id)
	const targets: ChatBulkMoveChange['targets'] = []
	const children: BulkChild[] = []
	for (const rule of await liveSeries(executor, card.id, context.now)) {
		const allFrom = await seriesAnchor(executor, rule, connection.id)
		if (allFrom === null) continue
		const from = request.from !== null && request.from > allFrom ? request.from : allFrom
		const was = cutStart(rule, from, zone.zone)
		if (was === null || !atWallTime(was, zone.zone, request.fromWeekday, request.fromTime)) continue
		if (request.from !== null && request.from < allFrom) return refused('series_marked')
		const now = localTimeCandidates(firstOnOrAfter(from, request.toWeekday), request.toTime, zone.zone)[0]
		if (now === undefined) return refused('nonexistent_local_time')
		const length = rule.durationMinutes * 60000
		if (
			!insideSyncWindow(sync, was, new Date(was.getTime() + length)) ||
			!insideSyncWindow(sync, now, new Date(now.getTime() + length))
		)
			return refused('outside_sync_window')
		targets.push({
			seriesId: rule.id,
			seriesTimeZone: rule.timeZone,
			from,
			wasStartsAt: was.toISOString(),
			nowStartsAt: now.toISOString(),
			durationMinutes: rule.durationMinutes,
			state: 'planned',
		})
		children.push({
			seriesId: rule.id,
			from,
			weekday: request.toWeekday,
			startTime: request.toTime,
			durationMinutes: rule.durationMinutes,
			rule: snapshotOf(rule),
			requestId: randomUUID(),
		})
	}
	if (children.length === 0) return refused('no_matching_lessons')
	const shared = {
		studentId: card.id,
		inputTimeZone: zone.zone,
		zoneNamed: zone.named,
		accountTimeZone: context.defaultTimeZone,
		fromWeekday: request.fromWeekday,
		fromTime: request.fromTime,
		toWeekday: request.toWeekday,
		toTime: request.toTime,
	}
	return {
		kind: 'ok',
		target: { operation: 'bulk_move', ...shared, children },
		change: {
			operation: 'bulk_move',
			...shared,
			studentName: card.displayName,
			targets,
			singlesLeft: await singlesAt(executor, request, zone.zone, context.now),
		},
	}
}
