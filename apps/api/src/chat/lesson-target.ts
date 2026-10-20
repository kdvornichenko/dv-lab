import { eq } from 'drizzle-orm'

import type {
	CalendarIssue,
	ChatLessonIntent,
	GoogleScheduleWindow,
	LessonPlace,
	LessonTargetLesson,
	LessonTargetOption,
	LessonTargetRefusal,
	LessonTargetResult,
	ScheduleBlock,
} from '@dv-lab/contracts'
import {
	addDays,
	awaitsMark,
	canChange,
	lessonActions,
	lessonDay,
	localTimeCandidates,
	namedDateRange,
	zonedParts,
} from '@dv-lab/core'
import { lessonSeries, type DbExecutor } from '@dv-lab/db'

import { findConnection } from '../calendar/google-access.ts'
import { insideSyncWindow, syncFacts } from '../calendar/projection.ts'
import type { CardReadContext } from '../cards/card-facts.ts'
import { seriesColumns, toSeriesRule } from '../schedule/rows.ts'
import { seriesAnchor } from '../schedule/series.ts'
import { readLessonDay } from '../today/today.ts'

const OPTIONS_MAX = 6
const CONNECTION_ISSUES: readonly CalendarIssue[] = [
	'connection_required',
	'reconnect_required',
	'permission_required',
	'disconnect_failed',
]

const refused = (code: LessonTargetRefusal): LessonTargetResult => ({ kind: 'refused', code })

function writeRefusal(write: GoogleScheduleWindow['write']): LessonTargetResult | null {
	if (write.state === 'ready') return null
	if (CONNECTION_ISSUES.includes(write.reason)) return refused('connection_required')
	if (write.reason === 'outside_sync_window') return refused('outside_sync_window')
	if (write.reason === 'command_pending') return refused('command_pending')
	return refused('calendar_unavailable')
}

function option(block: ScheduleBlock, zone: string): LessonTargetOption {
	const parts = zonedParts(new Date(block.startsAt), zone)
	return { startsAt: block.startsAt, date: parts.date, time: parts.time, timeZone: zone }
}

function clarify(question: 'which_lesson' | 'date_time', blocks: readonly ScheduleBlock[], zone: string) {
	const options = [...blocks]
		.sort((left, right) => left.startsAt.localeCompare(right.startsAt))
		.slice(0, OPTIONS_MAX)
		.map((block) => option(block, zone))
	return { kind: 'clarify', question, options } satisfies LessonTargetResult
}

function targetLesson(block: ScheduleBlock, now: Date): LessonTargetLesson {
	return {
		key: block.key,
		ref: block.ref,
		studentId: block.studentId,
		startsAt: block.startsAt,
		timeZone: block.timeZone,
		durationMinutes: block.durationMinutes,
		outcome: block.outcome,
		mark: block.mark,
		markRevision: block.markRevision,
		started: !canChange(new Date(block.startsAt), now),
	}
}

function unique(blocks: readonly ScheduleBlock[]): ScheduleBlock[] {
	const byKey = new Map<string, ScheduleBlock>()
	for (const block of blocks) if (!byKey.has(block.key)) byKey.set(block.key, block)
	return [...byKey.values()]
}

function countable(block: ScheduleBlock): boolean {
	return block.outcome === 'planned' || block.outcome === 'done' || block.outcome === 'no_show'
}

function candidates(
	intent: ChatLessonIntent,
	lessons: readonly ScheduleBlock[],
	earlier: readonly ScheduleBlock[],
	dated: boolean,
	now: Date
): ScheduleBlock[] {
	const own = (block: ScheduleBlock) => block.studentId === intent.studentId
	const started = (block: ScheduleBlock) => !canChange(new Date(block.startsAt), now)
	if (intent.kind === 'done' || intent.kind === 'no_show') {
		if (dated) return lessons.filter((block) => own(block) && countable(block))
		return unique([
			...earlier.filter(own),
			...lessons.filter((block) => own(block) && awaitsMark(block.outcome, new Date(block.startsAt), now)),
		])
	}
	if (intent.kind === 'comment') {
		const shown = lessons.filter((block) => own(block) && block.outcome !== 'moved')
		return dated ? shown : shown.filter(started)
	}
	return lessons.filter((block) => own(block) && countable(block))
}

function sameTime(block: ScheduleBlock, time: string, zone: string): boolean {
	return zonedParts(new Date(block.startsAt), zone).time === time
}

async function readNamedDate(executor: DbExecutor, context: CardReadContext, date: string) {
	const { start, end } = namedDateRange(date, context.now, context.defaultTimeZone)
	const before = await readLessonDay(executor, context, addDays(date, -1))
	const day = await readLessonDay(executor, context, date)
	const inside = (block: ScheduleBlock) => {
		const at = Date.parse(block.startsAt)
		return at >= start.getTime() && at < end.getTime()
	}
	const lessons = unique([...before.lessons, ...day.lessons])
		.filter(inside)
		.sort((left, right) => left.startsAt.localeCompare(right.startsAt))
	return { ...day, lessons }
}

async function connectionSync(executor: DbExecutor, accountId: string) {
	const connection = await findConnection(executor, accountId)
	return { connectionId: connection?.id ?? null, sync: connection ? await syncFacts(executor, connection.id) : null }
}

async function movePlace(
	executor: DbExecutor,
	context: CardReadContext,
	intent: ChatLessonIntent,
	block: ScheduleBlock
): Promise<LessonPlace | LessonTargetResult> {
	const target = intent.target
	if (!target) return clarify('date_time', [], context.defaultTimeZone)
	const zone = target.timeZone ?? context.defaultTimeZone
	const time = target.time ?? zonedParts(new Date(block.startsAt), zone).time
	const durationMinutes = target.durationMinutes ?? block.durationMinutes
	const instants = localTimeCandidates(target.date, time, zone)
	if (instants.length !== 1) return clarify('date_time', [], context.defaultTimeZone)
	const startsAt = instants[0]!
	const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000)
	const { sync } = await connectionSync(executor, context.accountId)
	if (!insideSyncWindow(sync, startsAt, endsAt)) return refused('outside_sync_window')
	return {
		startsAt: startsAt.toISOString(),
		endsAt: endsAt.toISOString(),
		date: target.date,
		time,
		timeZone: zone,
		durationMinutes,
	}
}

function isPlace(value: LessonPlace | LessonTargetResult): value is LessonPlace {
	return !('kind' in value)
}

async function seriesTarget(
	executor: DbExecutor,
	context: CardReadContext,
	intent: ChatLessonIntent,
	block: ScheduleBlock,
	move: LessonPlace | null
): Promise<LessonTargetResult> {
	if (block.ref.kind !== 'series' || (intent.kind !== 'move' && intent.kind !== 'cancel'))
		return clarify('which_lesson', [], context.defaultTimeZone)
	const [row] = await executor.select(seriesColumns).from(lessonSeries).where(eq(lessonSeries.id, block.ref.seriesId))
	if (!row) return refused('not_found')
	const rule = toSeriesRule(row)
	const { connectionId } = await connectionSync(executor, context.accountId)
	const allFrom = await seriesAnchor(executor, rule, connectionId)
	if (allFrom === null) return refused('series_marked')
	const from = intent.from ?? allFrom
	if (from < allFrom) return refused('series_marked')
	return {
		kind: 'series',
		intent: intent.kind,
		seriesId: rule.id,
		studentId: rule.studentId,
		area: intent.from === undefined ? 'all' : 'following',
		from,
		allFrom,
		lesson: targetLesson(block, context.now),
		move,
	}
}

export async function findLessonOptions(
	executor: DbExecutor,
	context: CardReadContext,
	studentId: string,
	wanted: readonly { date: string; time: string }[]
): Promise<(LessonTargetOption | null)[]> {
	const zone = context.defaultTimeZone
	const days = new Map<string, readonly ScheduleBlock[]>()
	for (const { date } of wanted)
		if (!days.has(date)) days.set(date, (await readNamedDate(executor, context, date)).lessons)
	return wanted.map(({ date, time }) => {
		const found = days
			.get(date)
			?.find((block) => block.studentId === studentId && countable(block) && sameTime(block, time, zone))
		return found === undefined ? null : option(found, zone)
	})
}

export async function resolveLessonTarget(
	executor: DbExecutor,
	context: CardReadContext,
	intent: ChatLessonIntent
): Promise<LessonTargetResult> {
	if (intent.kind === 'note') return { kind: 'student', studentId: intent.studentId }
	const { now, defaultTimeZone: zone } = context
	const calendar = intent.kind === 'move' || intent.kind === 'cancel'
	const source = intent.date ?? (intent.scope === 'series' ? intent.from : undefined)
	const day =
		source === undefined
			? await readLessonDay(executor, context, lessonDay(now, zone))
			: await readNamedDate(executor, context, source)
	if (calendar) {
		const blocked = writeRefusal(day.calendarWrite)
		if (blocked) return blocked
	}
	const found = candidates(intent, day.lessons, day.earlier, source !== undefined, now).filter(
		(block) => intent.time === undefined || sameTime(block, intent.time, zone)
	)
	if (found.length === 0) return clarify('date_time', [], zone)
	if (found.length > 1) return clarify('which_lesson', found, zone)
	const block = found[0]!
	const actions = lessonActions(block.outcome, block.mark, new Date(block.startsAt), now)
	const started = !canChange(new Date(block.startsAt), now)
	if (intent.kind === 'done' || intent.kind === 'no_show') {
		if (!actions.mark) return refused(started ? 'not_found' : 'lesson_not_started')
		return { kind: 'lesson', intent: intent.kind, lesson: targetLesson(block, now), move: null }
	}
	if (intent.kind === 'comment') {
		if (!started) return refused('lesson_not_started')
		return { kind: 'lesson', intent: intent.kind, lesson: targetLesson(block, now), move: null }
	}
	const allowed = intent.kind === 'move' ? actions.move : actions.cancel
	if (!allowed && intent.scope === 'one') return refused(block.outcome === 'done' ? 'lesson_done' : 'not_found')
	let move: LessonPlace | null = null
	if (intent.kind === 'move') {
		const place = await movePlace(executor, context, intent, block)
		if (!isPlace(place)) return place
		move = place
	}
	if (intent.scope === 'series') return seriesTarget(executor, context, intent, block, move)
	return { kind: 'lesson', intent: intent.kind, lesson: targetLesson(block, now), move }
}
