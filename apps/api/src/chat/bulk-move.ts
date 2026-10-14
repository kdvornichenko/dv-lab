import { and, asc, eq, gt, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import {
	type ChatBulkMoveChange,
	type ChatCalendarIssue,
	type ChatChangeIssue,
	type ValidatedCalendarCommand,
	CLOCK_TIME_PATTERN,
	calendarDate,
} from '@dv-lab/contracts'
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
import { type Database, type DbExecutor, chatActions, lessonSeries, lessons, students } from '@dv-lab/db'

import type { CalendarCommands } from '../calendar/commands.ts'
import { findConnection } from '../calendar/google-access.ts'
import { findRequest } from '../calendar/journal.ts'
import { insideSyncWindow, syncFacts } from '../calendar/projection.ts'
import { seriesColumns, toSeriesRule } from '../schedule/rows.ts'
import { seriesAnchor } from '../schedule/series.ts'
import { readTeacherSettings } from '../settings/settings.ts'
import type { ChatContext } from './actions.ts'
import { faultIssue, forwardState, weekWindow, writeIssue } from './calendar.ts'
import { type CommandZone, resolveCommandZone } from './command-zone.ts'
import { type BulkProgress, bulkProgress } from './messages.ts'

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

const bulkMoveTarget = z.strictObject({
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

type BulkPreview =
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

function sameRule(rule: SeriesRule, snapshot: BulkChild['rule']): boolean {
	return (
		rule.weekday === snapshot.weekday &&
		rule.startTime === snapshot.startTime &&
		rule.timeZone === snapshot.timeZone &&
		rule.startsOn === snapshot.startsOn &&
		rule.endsOn === snapshot.endsOn
	)
}

function cutStart(rule: SeriesRule, from: string, zone: string): Date | null {
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

type ChildProgress = NonNullable<BulkProgress['children']>[number]
type ActionRow = typeof chatActions.$inferSelect

type Built =
	| { kind: 'command'; command: ValidatedCalendarCommand; version: string }
	| { kind: 'refused'; stale: boolean; issue: ChatChangeIssue }

type Step = { kind: 'done' } | { kind: 'submit'; index: number; command: ValidatedCalendarCommand }

const SUBMIT_GRACE_MS = 60_000
const done: Step = { kind: 'done' }
const changed: Built = { kind: 'refused', stale: true, issue: 'calendar_changed' }

function changeIssue(issue: ChatCalendarIssue | undefined): ChatChangeIssue {
	switch (issue) {
		case 'command_pending':
		case 'connection_required':
		case 'outside_sync_window':
		case 'provider_unavailable':
			return issue
		case undefined:
			return 'provider_unavailable'
		default:
			return 'calendar_changed'
	}
}

async function actionOf(executor: DbExecutor, accountId: string, actionId: string, lock = false) {
	const query = executor
		.select()
		.from(chatActions)
		.where(and(eq(chatActions.id, actionId), eq(chatActions.accountId, accountId)))
	const [row] = lock ? await query.for('update') : await query
	return row ?? null
}

async function setProgress(
	executor: DbExecutor,
	actionId: string,
	state: 'submitted' | 'applied' | 'refused',
	progress: BulkProgress
) {
	await executor
		.update(chatActions)
		.set({ state, result: progress, updatedAt: sql`now()` })
		.where(eq(chatActions.id, actionId))
}

function running(action: ActionRow | null) {
	if (action === null || action.state !== 'submitted') return null
	const target = bulkMoveTarget.safeParse(action.target)
	const progress = bulkProgress.safeParse(action.result)
	if (!target.success || !progress.success || progress.data.kind !== 'bulk') return null
	const children = progress.data.children ?? []
	if (children.length !== target.data.children.length) return null
	return { action, target: target.data, children: [...children] }
}

async function buildChild(
	executor: DbExecutor,
	context: ChatContext,
	target: BulkTarget,
	child: BulkChild,
	sealed: string | null
): Promise<Built> {
	const zone = (await readTeacherSettings(executor, context.accountId)).defaultTimeZone
	const [row] = await executor.select(seriesColumns).from(lessonSeries).where(eq(lessonSeries.id, child.seriesId))
	if (!row) return changed
	const rule = toSeriesRule(row)
	if (!sameRule(rule, child.rule)) return changed
	const connection = await findConnection(executor, context.accountId)
	if (!connection) return { kind: 'refused', stale: false, issue: 'connection_required' }
	const anchor = await seriesAnchor(executor, rule, connection.id)
	if (anchor === null || child.from < anchor) return changed
	const was = cutStart(rule, child.from, target.inputTimeZone)
	if (was === null) return changed
	const window = await weekWindow(executor, context.accountId, context.now, was.toISOString(), zone)
	if (window.write.state !== 'ready')
		return { kind: 'refused', stale: false, issue: changeIssue(writeIssue(window.write.reason)) }
	const series = window.series.find((item) => item.series.id === child.seriesId)
	if (!series || (sealed !== null && series.version !== sealed)) return changed
	return {
		kind: 'command',
		version: series.version,
		command: {
			operation: 'move_series',
			seriesId: child.seriesId,
			input: {
				from: child.from,
				weekday: child.weekday,
				startTime: child.startTime,
				durationMinutes: child.durationMinutes,
				inputTimeZone: target.inputTimeZone,
				expectedDefaultTimeZone: zone,
				requestId: child.requestId,
				expectedVersion: series.version,
			},
		},
	}
}

async function stop(
	executor: DbExecutor,
	actionId: string,
	children: ChildProgress[],
	index: number,
	issue: ChatChangeIssue
) {
	const stopped = children.map((child, at) =>
		at === index
			? { ...child, state: 'failed' as const, issue }
			: at > index
				? { ...child, state: 'not_started' as const }
				: child
	)
	const kind = stopped.some((child) => child.state === 'applied') ? 'partial' : 'failed'
	await setProgress(executor, actionId, 'refused', { kind, issue, children: stopped })
}

async function prepareBulk(
	tx: DbExecutor,
	commands: CalendarCommands | undefined,
	context: ChatContext,
	actionId: string
): Promise<Step> {
	const action = await actionOf(tx, context.accountId, actionId, true)
	if (!action || action.kind !== 'change' || action.state !== 'proposed') return done
	const target = bulkMoveTarget.safeParse(action.target)
	if (!target.success) {
		await setProgress(tx, actionId, 'refused', { kind: 'failed' })
		return done
	}
	if (!commands) {
		await setProgress(tx, actionId, 'refused', { kind: 'failed', issue: 'connection_required' })
		return done
	}
	const children: ChildProgress[] = []
	let first: ValidatedCalendarCommand | null = null
	for (const [index, child] of target.data.children.entries()) {
		const built = await buildChild(tx, context, target.data, child, null)
		if (built.kind === 'refused') {
			await setProgress(tx, actionId, 'refused', { kind: built.stale ? 'stale' : 'failed', issue: built.issue })
			return done
		}
		if (index === 0) first = built.command
		children.push({ state: index === 0 ? 'pending' : 'not_started', commandId: null, version: built.version })
	}
	if (first === null) return done
	await setProgress(tx, actionId, 'submitted', { kind: 'bulk', children })
	return { kind: 'submit', index: 0, command: first }
}

async function recordChild(
	tx: DbExecutor,
	context: ChatContext,
	actionId: string,
	index: number,
	commandId: string | null,
	issue: ChatChangeIssue
) {
	const live = running(await actionOf(tx, context.accountId, actionId, true))
	const child = live?.children[index]
	if (!live || !child || child.state !== 'pending' || child.commandId !== null) return
	const requestId = live.target.children[index]!.requestId
	const found = commandId ?? (await findRequest(tx, context.accountId, requestId))?.id ?? null
	if (found === null) return stop(tx, actionId, live.children, index, issue)
	live.children[index] = { ...child, commandId: found }
	await setProgress(tx, actionId, 'submitted', { kind: 'bulk', children: live.children })
}

async function submitChild(
	db: Database,
	commands: CalendarCommands,
	context: ChatContext,
	actionId: string,
	step: Extract<Step, { kind: 'submit' }>
) {
	let commandId: string | null = null
	let issue: ChatChangeIssue = 'provider_unavailable'
	try {
		commandId = (await commands.submitCalendarCommand({ accountId: context.accountId, now: context.now }, step.command))
			.commandId
	} catch (error) {
		issue = changeIssue(faultIssue(error))
	}
	await db.transaction((tx) => recordChild(tx, context, actionId, step.index, commandId, issue))
}

async function advance(
	tx: DbExecutor,
	context: ChatContext,
	actionId: string,
	index: number,
	commandId: string
): Promise<Step> {
	const live = running(await actionOf(tx, context.accountId, actionId, true))
	const child = live?.children[index]
	if (!live || !child || child.state !== 'pending') return done
	live.children[index] = { ...child, state: 'applied', commandId }
	const nextIndex = index + 1
	const next = live.target.children[nextIndex]
	const sealed = live.children[nextIndex]
	if (next === undefined || sealed === undefined) {
		await setProgress(tx, actionId, 'applied', { kind: 'applied', children: live.children })
		return done
	}
	const built = await buildChild(tx, context, live.target, next, sealed.version)
	if (built.kind === 'refused') {
		await stop(tx, actionId, live.children, nextIndex, built.issue)
		return done
	}
	live.children[nextIndex] = { ...sealed, state: 'pending', commandId: null }
	await setProgress(tx, actionId, 'submitted', { kind: 'bulk', children: live.children })
	return { kind: 'submit', index: nextIndex, command: built.command }
}

async function failChild(
	tx: DbExecutor,
	context: ChatContext,
	actionId: string,
	index: number,
	issue: ChatChangeIssue
) {
	const live = running(await actionOf(tx, context.accountId, actionId, true))
	if (!live || live.children[index]?.state !== 'pending') return
	await stop(tx, actionId, live.children, index, issue)
}

async function rememberCommand(
	tx: DbExecutor,
	context: ChatContext,
	actionId: string,
	index: number,
	commandId: string
) {
	const live = running(await actionOf(tx, context.accountId, actionId, true))
	const child = live?.children[index]
	if (!live || !child || child.state !== 'pending' || child.commandId !== null) return
	live.children[index] = { ...child, commandId }
	await setProgress(tx, actionId, 'submitted', { kind: 'bulk', children: live.children })
}

export async function checkBulk(
	db: Database,
	commands: CalendarCommands | undefined,
	context: ChatContext,
	actionId: string
): Promise<void> {
	if (!commands) return
	for (;;) {
		const live = running(await actionOf(db, context.accountId, actionId))
		if (!live) return
		const index = live.children.findIndex((child) => child.state === 'pending')
		const child = live.children[index]
		if (index < 0 || !child) return
		const requestId = live.target.children[index]!.requestId
		const commandId = child.commandId ?? (await findRequest(db, context.accountId, requestId))?.id ?? null
		if (commandId === null) {
			if (context.now.getTime() - live.action.updatedAt.getTime() < SUBMIT_GRACE_MS) return
			await db.transaction((tx) => failChild(tx, context, actionId, index, 'provider_unavailable'))
			return
		}
		const next = forwardState(await commands.readCalendarCommand(context, commandId))
		if (next.state === 'failed') {
			await db.transaction((tx) => failChild(tx, context, actionId, index, changeIssue(next.issue)))
			return
		}
		if (next.state !== 'applied') {
			if (child.commandId === null)
				await db.transaction((tx) => rememberCommand(tx, context, actionId, index, commandId))
			return
		}
		const step = await db.transaction((tx) => advance(tx, context, actionId, index, commandId))
		if (step.kind === 'done') return
		await submitChild(db, commands, context, actionId, step)
	}
}

export async function confirmBulk(
	db: Database,
	commands: CalendarCommands | undefined,
	context: ChatContext,
	actionId: string
): Promise<void> {
	const step = await db.transaction((tx) => prepareBulk(tx, commands, context, actionId))
	if (step.kind === 'submit' && commands) await submitChild(db, commands, context, actionId, step)
	await checkBulk(db, commands, context, actionId)
}
