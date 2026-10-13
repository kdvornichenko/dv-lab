import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import {
	type CalendarCommandSnapshot,
	type CalendarEventView,
	type CalendarIssue,
	type ChatBlock,
	type ChatCalendarIssue,
	type ChatCalendarProposalBlock,
	type ChatCalendarState,
	type GoogleScheduleWindow,
	type LessonTargetResult,
	type UndoRequest,
	type ValidatedCalendarCommand,
	MARK_KINDS,
	calendarDate,
	calendarInstant,
	calendarOccurrenceRef,
	chatCalendarIssue,
} from '@dv-lab/contracts'
import {
	canChange,
	firstOnOrAfter,
	lessonDay,
	localTimeCandidates,
	mondayOf,
	occurrenceKey,
	scheduleDate,
	scheduleWeekRange,
	seriesStart,
	weekdayOf,
	zonedParts,
} from '@dv-lab/core'
import { type Database, type DbExecutor, chatActions, lessonSeries, violatesUnique } from '@dv-lab/db'

import type { CalendarCommands } from '../calendar/commands.ts'
import { CalendarFault } from '../calendar/gateway.ts'
import { findConnection } from '../calendar/google-access.ts'
import { CommandFault, findRequest } from '../calendar/journal.ts'
import { insideSyncWindow, syncFacts } from '../calendar/projection.ts'
import { readCalendarWindow } from '../calendar/read-model.ts'
import { markStateOf, seriesColumns, toSeriesRule } from '../schedule/rows.ts'
import { readTeacherSettings } from '../settings/settings.ts'
import type { ActionSource, ChatContext } from './actions.ts'
import { blocksOf, calendarProgress, calendarView, insertAction, replyOf } from './messages.ts'

export type CalendarOutcome =
	| { kind: 'ok'; block: ChatCalendarProposalBlock }
	| { kind: 'not_found' }
	| { kind: 'not_calendar' }
	| { kind: 'not_undoable' }
	| { kind: 'conflict' }

type Proposable = Extract<LessonTargetResult, { kind: 'lesson' | 'series' }>
type ActionRow = typeof chatActions.$inferSelect
type Progress = z.infer<typeof calendarProgress>

const SUBMIT_GRACE_MS = 60_000
const UNDO_UNIQUE = 'chat_actions_undo_request_uq'
const TRANSIENT: readonly ChatCalendarIssue[] = ['command_pending', 'connection_required', 'provider_unavailable']
const CONNECTION: readonly string[] = [
	'connection_required',
	'reconnect_required',
	'permission_required',
	'disconnect_failed',
]
const KNOWN: readonly string[] = [
	'command_pending',
	'precondition_failed',
	'outside_sync_window',
	'lesson_done',
	'external_change',
	'provider_unavailable',
]

const place = z.object({ startsAt: calendarInstant, durationMinutes: z.number().int() })

const storedTarget = z.object({
	operation: z.enum(['move', 'cancel', 'move_series']),
	key: z.string().min(1),
	ref: calendarOccurrenceRef,
	seriesId: z.uuid().nullable(),
	startsAt: calendarInstant,
	durationMinutes: z.number().int(),
	timeZone: z.string(),
	move: place.nullable(),
	series: z.object({ from: calendarDate, weekday: z.literal([1, 2, 3, 4, 5, 6, 7]), startTime: z.string() }).nullable(),
})

type StoredTarget = z.infer<typeof storedTarget>

const storedBefore = z.object({
	startsAt: calendarInstant,
	durationMinutes: z.number().int(),
	mark: z.enum(MARK_KINDS).nullable(),
	markRevision: z.number().int().nullable(),
})

type StoredBefore = z.infer<typeof storedBefore>

const storedAfter = z.object({ version: z.string().nullable() })

const undoProgress = z.object({
	undo: z.enum(['available', 'pending', 'done', 'stale']),
	commandId: z.uuid().nullable().optional(),
	restoreMark: z.boolean().optional(),
	issue: chatCalendarIssue.optional(),
})

type UndoProgress = z.infer<typeof undoProgress>

function issueOf(code: string | null): ChatCalendarIssue {
	if (code === null) return 'provider_unavailable'
	if (CONNECTION.includes(code)) return 'connection_required'
	if (KNOWN.includes(code)) return code as ChatCalendarIssue
	return 'precondition_failed'
}

function faultIssue(error: unknown): ChatCalendarIssue {
	if (error instanceof CommandFault || error instanceof CalendarFault) return issueOf(error.code)
	return 'provider_unavailable'
}

function writeIssue(reason: CalendarIssue): ChatCalendarIssue {
	if (reason === 'outside_sync_window' || reason === 'command_pending') return reason
	if (CONNECTION.includes(reason)) return 'connection_required'
	return 'provider_unavailable'
}

async function weekWindow(
	executor: DbExecutor,
	accountId: string,
	now: Date,
	instant: string,
	zone: string
): Promise<GoogleScheduleWindow> {
	const monday = mondayOf(scheduleDate(new Date(instant), zone))
	return readCalendarWindow(
		executor,
		{ accountId, now },
		{ kind: 'window', ...scheduleWeekRange(monday, zone), displayTimeZone: zone }
	)
}

function lessonEvent(window: GoogleScheduleWindow, key: string): CalendarEventView | null {
	return (
		window.events.find((event) => event.binding.kind === 'lesson' && occurrenceKey(event.binding.ref) === key) ?? null
	)
}

function eventVersion(event: CalendarEventView | null): string | null {
	return event?.binding.kind === 'lesson' ? event.binding.version : null
}

function startsAtOf(event: CalendarEventView): number | null {
	return event.when.kind === 'timed' ? Date.parse(event.when.startsAt) : null
}

function localPlace(instant: string, zone: string): { date: string; time: string } | null {
	const parts = zonedParts(new Date(instant), zone)
	const exact = localTimeCandidates(parts.date, parts.time, zone).some(
		(candidate) => candidate.getTime() === Date.parse(instant)
	)
	return exact ? { date: parts.date, time: parts.time } : null
}

async function refuseProposal(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	code: 'connection_required' | 'outside_sync_window' | 'not_found'
): Promise<ChatBlock> {
	await insertAction(executor, {
		accountId: context.accountId,
		...source,
		kind: 'calendar',
		state: 'refused',
		result: { kind: 'refused', code },
	})
	return { type: 'refused', code, kind: 'calendar' }
}

async function seriesPlace(executor: DbExecutor, seriesId: string, from: string) {
	const [row] = await executor.select(seriesColumns).from(lessonSeries).where(eq(lessonSeries.id, seriesId))
	if (!row) return null
	const rule = toSeriesRule(row)
	const was = seriesStart(rule, from) ?? seriesStart(rule, firstOnOrAfter(from, rule.weekday))
	return was === null ? null : { was, durationMinutes: rule.durationMinutes }
}

export async function proposeCalendarChange(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	target: Proposable,
	studentName: string
): Promise<ChatBlock> {
	if (!context.calendarEnabled) return refuseProposal(executor, context, source, 'connection_required')
	const zone = context.defaultTimeZone
	const lesson = target.lesson
	const connection = await findConnection(executor, context.accountId)
	if (!connection) return refuseProposal(executor, context, source, 'connection_required')
	const sync = await syncFacts(executor, connection.id)
	const lessonStart = new Date(lesson.startsAt)
	const lessonEnd = new Date(lessonStart.getTime() + lesson.durationMinutes * 60000)
	if (!insideSyncWindow(sync, lessonStart, lessonEnd))
		return refuseProposal(executor, context, source, 'outside_sync_window')
	const move = target.move
	let operation: StoredTarget['operation'] = target.intent === 'move' ? 'move' : 'cancel'
	const lessonDate = lessonDay(lessonStart, zone)
	let shownLesson: ChatCalendarProposalBlock['lesson'] = {
		key: lesson.key,
		ref: lesson.ref,
		date: lessonDate,
		startsAt: lesson.startsAt,
		durationMinutes: lesson.durationMinutes,
	}
	let shownTarget: ChatCalendarProposalBlock['target'] = { kind: 'cancelled', date: lessonDate }
	let series: StoredTarget['series'] = null
	if (move !== null)
		shownTarget = {
			kind: 'lesson',
			startsAt: move.startsAt,
			durationMinutes: move.durationMinutes,
			date: lessonDay(new Date(move.startsAt), zone),
		}
	if (target.kind === 'series') {
		if (move === null) return refuseProposal(executor, context, source, 'not_found')
		const parts = zonedParts(new Date(move.startsAt), zone)
		const weekday = weekdayOf(parts.date)
		const first = localTimeCandidates(firstOnOrAfter(target.from, weekday), parts.time, zone)[0]
		const was = await seriesPlace(executor, target.seriesId, target.from)
		if (!first || was === null) return refuseProposal(executor, context, source, 'not_found')
		const firstEnd = new Date(first.getTime() + move.durationMinutes * 60000)
		if (!insideSyncWindow(sync, first, firstEnd))
			return refuseProposal(executor, context, source, 'outside_sync_window')
		operation = 'move_series'
		series = { from: target.from, weekday, startTime: parts.time }
		shownLesson = { key: lesson.key, startsAt: was.was.toISOString(), durationMinutes: was.durationMinutes }
		shownTarget = {
			kind: 'series',
			startsAt: first.toISOString(),
			durationMinutes: move.durationMinutes,
			from: target.from,
			area: target.area,
		}
	}
	const stored: StoredTarget = {
		operation,
		key: lesson.key,
		ref: lesson.ref,
		seriesId: target.kind === 'series' ? target.seriesId : null,
		startsAt: lesson.startsAt,
		durationMinutes: lesson.durationMinutes,
		timeZone: zone,
		move: move === null ? null : { startsAt: move.startsAt, durationMinutes: move.durationMinutes },
		series,
	}
	const before: StoredBefore = {
		startsAt: lesson.startsAt,
		durationMinutes: lesson.durationMinutes,
		mark: lesson.mark,
		markRevision: lesson.markRevision,
	}
	const actionId = await insertAction(executor, {
		accountId: context.accountId,
		...source,
		kind: 'calendar',
		state: 'proposed',
		target: stored,
		before,
		result: { state: 'proposed' } satisfies Progress,
		calendarRequestId: randomUUID(),
	})
	return {
		type: 'calendar_proposal',
		actionId,
		operation,
		studentId: lesson.studentId,
		studentName,
		timeZone: zone,
		lesson: shownLesson,
		target: shownTarget,
		clearsNoShow:
			operation === 'move' &&
			move !== null &&
			lesson.mark === 'no_show' &&
			canChange(new Date(move.startsAt), context.now),
		state: 'proposed',
		undo: null,
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

async function present(executor: DbExecutor, accountId: string, actionId: string): Promise<CalendarOutcome> {
	const action = await actionOf(executor, accountId, actionId)
	if (!action) return { kind: 'not_found' }
	if (action.kind !== 'calendar') return { kind: 'not_calendar' }
	const reply = await replyOf(executor, accountId, action.messageId)
	const block = reply
		? blocksOf(reply).find((item) => item.type === 'calendar_proposal' && item.actionId === action.id)
		: undefined
	if (block?.type !== 'calendar_proposal') return { kind: 'not_found' }
	return { kind: 'ok', block: calendarView(block, action) }
}

type Built =
	| { kind: 'command'; command: ValidatedCalendarCommand; before: StoredBefore }
	| { kind: 'refused'; state: Extract<ChatCalendarState, 'failed' | 'stale'>; issue?: ChatCalendarIssue }

const stale: Built = { kind: 'refused', state: 'stale' }

async function buildCommand(
	executor: DbExecutor,
	context: ChatContext,
	action: ActionRow,
	target: StoredTarget
): Promise<Built> {
	const settings = await readTeacherSettings(executor, context.accountId)
	const zone = settings.defaultTimeZone
	const requestId = action.calendarRequestId
	if (zone !== target.timeZone || requestId === null) return stale
	const window = await weekWindow(executor, context.accountId, context.now, target.startsAt, zone)
	if (window.write.state !== 'ready')
		return { kind: 'refused', state: 'failed', issue: writeIssue(window.write.reason) }
	const mark = await markStateOf(executor, target.ref)
	const before: StoredBefore = {
		startsAt: target.startsAt,
		durationMinutes: target.durationMinutes,
		mark: mark?.kind ?? null,
		markRevision: mark?.revision ?? null,
	}
	if (target.operation === 'move_series') {
		const series = window.series.find((item) => item.series.id === target.seriesId)
		if (!series || target.seriesId === null || target.series === null || target.move === null) return stale
		const command: ValidatedCalendarCommand = {
			operation: 'move_series',
			seriesId: target.seriesId,
			input: {
				from: target.series.from,
				weekday: target.series.weekday,
				startTime: target.series.startTime,
				durationMinutes: target.move.durationMinutes,
				expectedDefaultTimeZone: zone,
				requestId,
				expectedVersion: series.version,
			},
		}
		return { kind: 'command', command, before }
	}
	const event = lessonEvent(window, target.key)
	const expectedVersion = eventVersion(event)
	if (
		event === null ||
		expectedVersion === null ||
		event.editBlock !== null ||
		event.status === 'cancelled' ||
		startsAtOf(event) !== Date.parse(target.startsAt)
	)
		return stale
	if (target.operation === 'cancel')
		return {
			kind: 'command',
			command: {
				operation: 'cancel',
				ref: target.ref,
				input: { expectedStartsAt: target.startsAt, requestId, expectedVersion },
			},
			before,
		}
	const to = target.move === null ? null : localPlace(target.move.startsAt, zone)
	if (to === null || target.move === null) return stale
	return {
		kind: 'command',
		command: {
			operation: 'move',
			ref: target.ref,
			input: {
				date: to.date,
				startTime: to.time,
				durationMinutes: target.move.durationMinutes,
				expectedStartsAt: target.startsAt,
				expectedDefaultTimeZone: zone,
				requestId,
				expectedVersion,
			},
		},
		before,
	}
}

async function setProgress(
	executor: DbExecutor,
	actionId: string,
	state: ActionRow['state'],
	progress: Progress,
	extra: { before?: unknown; after?: unknown } = {}
) {
	await executor
		.update(chatActions)
		.set({ state, result: progress, ...extra, updatedAt: sql`now()` })
		.where(eq(chatActions.id, actionId))
}

type Prepared = { kind: 'done'; outcome: CalendarOutcome } | { kind: 'submit'; command: ValidatedCalendarCommand }

async function prepareConfirm(
	tx: DbExecutor,
	commands: CalendarCommands | undefined,
	context: ChatContext,
	actionId: string
): Promise<Prepared> {
	const action = await actionOf(tx, context.accountId, actionId, true)
	if (!action) return { kind: 'done', outcome: { kind: 'not_found' } }
	if (action.kind !== 'calendar') return { kind: 'done', outcome: { kind: 'not_calendar' } }
	if (action.state !== 'proposed') return { kind: 'done', outcome: await present(tx, context.accountId, actionId) }
	if (!commands) {
		await setProgress(tx, actionId, 'refused', { state: 'failed', issue: 'connection_required' })
		return { kind: 'done', outcome: await present(tx, context.accountId, actionId) }
	}
	const built = await buildCommand(tx, context, action, storedTarget.parse(action.target))
	if (built.kind === 'refused') {
		await setProgress(tx, actionId, 'refused', { state: built.state, ...(built.issue ? { issue: built.issue } : {}) })
		return { kind: 'done', outcome: await present(tx, context.accountId, actionId) }
	}
	await setProgress(tx, actionId, 'submitted', { state: 'submitting', commandId: null }, { before: built.before })
	return { kind: 'submit', command: built.command }
}

async function recordSubmission(
	tx: DbExecutor,
	accountId: string,
	actionId: string,
	commandId: string | null,
	issue: ChatCalendarIssue
) {
	const action = await actionOf(tx, accountId, actionId, true)
	const progress = calendarProgress.safeParse(action?.result)
	if (!action || !progress.success || progress.data.state !== 'submitting' || action.calendarRequestId === null) return
	const found = commandId ?? (await findRequest(tx, accountId, action.calendarRequestId))?.id ?? null
	if (found !== null) await setProgress(tx, actionId, 'submitted', { state: 'pending', commandId: found })
	else await setProgress(tx, actionId, 'refused', { state: 'failed', issue })
}

export async function confirmCalendarChange(
	db: Database,
	commands: CalendarCommands | undefined,
	context: ChatContext,
	actionId: string
): Promise<CalendarOutcome> {
	const prepared = await db.transaction((tx) => prepareConfirm(tx, commands, context, actionId))
	if (prepared.kind === 'done' || !commands) return prepared.kind === 'done' ? prepared.outcome : { kind: 'not_found' }
	let commandId: string | null = null
	let issue: ChatCalendarIssue = 'provider_unavailable'
	try {
		commandId = (
			await commands.submitCalendarCommand({ accountId: context.accountId, now: context.now }, prepared.command)
		).commandId
	} catch (error) {
		issue = faultIssue(error)
	}
	await db.transaction((tx) => recordSubmission(tx, context.accountId, actionId, commandId, issue))
	return checkCalendarAction(db, commands, context, actionId)
}

function forwardState(snapshot: CalendarCommandSnapshot): Progress {
	const base = { commandId: snapshot.commandId }
	if (snapshot.state === 'applied' && snapshot.confirmedRevision !== null) return { ...base, state: 'applied' }
	if (snapshot.state === 'failed') return { ...base, state: 'failed', issue: issueOf(snapshot.issue) }
	if (snapshot.state === 'projection_pending') return { ...base, state: 'pending', accepted: true }
	if (snapshot.state === 'pending' || snapshot.state === 'dispatching') return { ...base, state: 'pending' }
	return { ...base, state: 'unknown' }
}

function positionOf(target: StoredTarget): string {
	return target.operation === 'move' && target.move !== null ? target.move.startsAt : target.startsAt
}

async function settleForward(
	db: Database,
	commands: CalendarCommands,
	context: ChatContext,
	action: ActionRow,
	progress: Progress
) {
	const pendingOnly = and(eq(chatActions.id, action.id), eq(chatActions.state, 'submitted'))
	let commandId = progress.commandId ?? null
	if (commandId === null && action.calendarRequestId !== null)
		commandId = (await findRequest(db, context.accountId, action.calendarRequestId))?.id ?? null
	if (commandId === null) {
		if (context.now.getTime() - action.updatedAt.getTime() < SUBMIT_GRACE_MS) return
		await db
			.update(chatActions)
			.set({ state: 'proposed', result: { state: 'proposed' } satisfies Progress, updatedAt: sql`now()` })
			.where(pendingOnly)
		return
	}
	const next = forwardState(await commands.readCalendarCommand(context, commandId))
	if (next.state === 'applied') {
		const target = storedTarget.parse(action.target)
		let version: string | null = null
		if (target.operation !== 'move_series') {
			const window = await weekWindow(db, context.accountId, context.now, positionOf(target), target.timeZone)
			version = eventVersion(lessonEvent(window, target.key))
		}
		await db
			.update(chatActions)
			.set({ state: 'applied', result: next, after: { version }, updatedAt: sql`now()` })
			.where(pendingOnly)
		return
	}
	await db
		.update(chatActions)
		.set({ state: next.state === 'failed' ? 'refused' : 'submitted', result: next, updatedAt: sql`now()` })
		.where(pendingOnly)
}

async function settleUndo(
	db: Database,
	commands: CalendarCommands,
	context: ChatContext,
	action: ActionRow,
	undo: UndoProgress
) {
	const pendingOnly = and(eq(chatActions.id, action.id), sql`${chatActions.undoResult}->>'undo' = 'pending'`)
	let commandId = undo.commandId ?? null
	if (commandId === null && action.undoCalendarRequestId !== null)
		commandId = (await findRequest(db, context.accountId, action.undoCalendarRequestId))?.id ?? null
	if (commandId === null) {
		if (context.now.getTime() - action.updatedAt.getTime() < SUBMIT_GRACE_MS) return
		await db
			.update(chatActions)
			.set({
				undoRequestId: null,
				undoCalendarRequestId: null,
				undoResult: { undo: 'available' } satisfies UndoProgress,
				updatedAt: sql`now()`,
			})
			.where(pendingOnly)
		return
	}
	const snapshot = await commands.readCalendarCommand(context, commandId)
	let next: UndoProgress = { ...undo, commandId }
	let state: ActionRow['state'] = action.state
	if (snapshot.state === 'applied' && snapshot.confirmedRevision !== null) {
		let done = true
		if (undo.restoreMark) {
			const before = storedBefore.parse(action.before)
			const mark = await markStateOf(db, storedTarget.parse(action.target).ref)
			done = before.markRevision !== null && mark?.kind === 'no_show' && mark.revision === before.markRevision + 2
		}
		next = { ...next, undo: done ? 'done' : 'stale' }
		if (done) state = 'undone'
	} else if (snapshot.state === 'failed') {
		next = { ...next, undo: 'stale', issue: issueOf(snapshot.issue) }
	} else if (undo.commandId) {
		return
	}
	await db
		.update(chatActions)
		.set({ state, undoResult: next, updatedAt: sql`now()` })
		.where(pendingOnly)
}

export async function checkCalendarAction(
	db: Database,
	commands: CalendarCommands | undefined,
	context: ChatContext,
	actionId: string
): Promise<CalendarOutcome> {
	const action = await actionOf(db, context.accountId, actionId)
	if (!action) return { kind: 'not_found' }
	if (action.kind !== 'calendar') return { kind: 'not_calendar' }
	if (commands) {
		const progress = calendarProgress.safeParse(action.result)
		if (progress.success && ['submitting', 'pending', 'unknown'].includes(progress.data.state))
			await settleForward(db, commands, context, action, progress.data)
		const undo = undoProgress.safeParse(action.undoResult)
		if (undo.success && undo.data.undo === 'pending') await settleUndo(db, commands, context, action, undo.data)
	}
	return present(db, context.accountId, actionId)
}

type UndoPrepared =
	{ kind: 'done'; outcome: CalendarOutcome } | { kind: 'submit'; command: ValidatedCalendarCommand; requestId: string }

function sameMark(mark: { kind: string; revision: number } | null, before: StoredBefore): boolean {
	return (mark?.kind ?? null) === before.mark && (mark?.revision ?? null) === before.markRevision
}

async function staleUndo(tx: DbExecutor, context: ChatContext, actionId: string, input: UndoRequest) {
	await tx
		.update(chatActions)
		.set({
			undoRequestId: input.requestId,
			undoResult: { undo: 'stale' } satisfies UndoProgress,
			updatedAt: sql`now()`,
		})
		.where(eq(chatActions.id, actionId))
	return { kind: 'done' as const, outcome: await present(tx, context.accountId, actionId) }
}

async function withUndoIssue(tx: DbExecutor, context: ChatContext, actionId: string, issue: ChatCalendarIssue) {
	const outcome = await present(tx, context.accountId, actionId)
	return {
		kind: 'done' as const,
		outcome: outcome.kind === 'ok' ? { ...outcome, block: { ...outcome.block, undoIssue: issue } } : outcome,
	}
}

async function prepareUndo(
	tx: DbExecutor,
	context: ChatContext,
	actionId: string,
	input: UndoRequest
): Promise<UndoPrepared> {
	const action = await actionOf(tx, context.accountId, actionId, true)
	if (!action) return { kind: 'done', outcome: { kind: 'not_found' } }
	if (action.kind !== 'calendar') return { kind: 'done', outcome: { kind: 'not_calendar' } }
	if (action.undoRequestId !== null) return { kind: 'done', outcome: await present(tx, context.accountId, actionId) }
	const target = storedTarget.parse(action.target)
	if (action.state !== 'applied' || target.operation === 'move_series')
		return { kind: 'done', outcome: { kind: 'not_undoable' } }
	const before = storedBefore.parse(action.before)
	const after = storedAfter.parse(action.after)
	const zone = (await readTeacherSettings(tx, context.accountId)).defaultTimeZone
	const position = positionOf(target)
	const window = await weekWindow(tx, context.accountId, context.now, position, zone)
	if (window.write.state !== 'ready') {
		const issue = writeIssue(window.write.reason)
		if (TRANSIENT.includes(issue)) return withUndoIssue(tx, context, actionId, issue)
		return staleUndo(tx, context, actionId, input)
	}
	const event = lessonEvent(window, target.key)
	const expectedVersion = eventVersion(event)
	if (event === null || expectedVersion === null || expectedVersion !== after.version)
		return staleUndo(tx, context, actionId, input)
	if (startsAtOf(event) !== Date.parse(position)) return staleUndo(tx, context, actionId, input)
	const mark = await markStateOf(tx, target.ref)
	let restoreMark: { kind: 'no_show'; revision: number } | null = null
	if (target.operation === 'move' && before.mark === 'no_show' && before.markRevision !== null) {
		if (mark?.kind === 'none' && mark.revision === before.markRevision + 1)
			restoreMark = { kind: 'no_show', revision: mark.revision }
		else if (!sameMark(mark, before)) return staleUndo(tx, context, actionId, input)
	} else if (!sameMark(mark, before)) return staleUndo(tx, context, actionId, input)
	const requestId = randomUUID()
	let command: ValidatedCalendarCommand
	if (target.operation === 'cancel') {
		if (event.status !== 'cancelled') return staleUndo(tx, context, actionId, input)
		command = {
			operation: 'restore',
			ref: target.ref,
			input: { expectedStartsAt: before.startsAt, requestId, expectedVersion },
		}
	} else {
		const back = localPlace(before.startsAt, zone)
		if (back === null) return staleUndo(tx, context, actionId, input)
		command = {
			operation: 'move',
			ref: target.ref,
			input: {
				date: back.date,
				startTime: back.time,
				durationMinutes: before.durationMinutes,
				expectedStartsAt: position,
				expectedDefaultTimeZone: zone,
				requestId,
				expectedVersion,
			},
			...(restoreMark ? { restoreMark } : {}),
		}
	}
	await tx
		.update(chatActions)
		.set({
			undoRequestId: input.requestId,
			undoCalendarRequestId: requestId,
			undoResult: { undo: 'pending', commandId: null, restoreMark: restoreMark !== null } satisfies UndoProgress,
			updatedAt: sql`now()`,
		})
		.where(eq(chatActions.id, actionId))
	return { kind: 'submit', command, requestId }
}

async function recordUndo(
	tx: DbExecutor,
	accountId: string,
	actionId: string,
	requestId: string,
	commandId: string | null,
	issue: ChatCalendarIssue
) {
	const action = await actionOf(tx, accountId, actionId, true)
	const undo = undoProgress.safeParse(action?.undoResult)
	if (!action || !undo.success || undo.data.undo !== 'pending' || undo.data.commandId) return
	const found = commandId ?? (await findRequest(tx, accountId, requestId))?.id ?? null
	const changes =
		found !== null
			? { undoResult: { ...undo.data, commandId: found } }
			: TRANSIENT.includes(issue)
				? { undoRequestId: null, undoCalendarRequestId: null, undoResult: { undo: 'available', issue } }
				: { undoResult: { ...undo.data, undo: 'stale', issue } }
	await tx
		.update(chatActions)
		.set({ ...changes, updatedAt: sql`now()` })
		.where(eq(chatActions.id, actionId))
}

export async function undoCalendarAction(
	db: Database,
	commands: CalendarCommands | undefined,
	context: ChatContext,
	actionId: string,
	input: UndoRequest
): Promise<CalendarOutcome> {
	if (!commands) return { kind: 'not_undoable' }
	await checkCalendarAction(db, commands, context, actionId)
	let prepared: UndoPrepared
	try {
		prepared = await db.transaction((tx) => prepareUndo(tx, context, actionId, input))
	} catch (error) {
		if (violatesUnique(error, UNDO_UNIQUE)) return { kind: 'conflict' }
		throw error
	}
	if (prepared.kind === 'done') return prepared.outcome
	let commandId: string | null = null
	let issue: ChatCalendarIssue = 'provider_unavailable'
	try {
		commandId = (
			await commands.submitCalendarCommand({ accountId: context.accountId, now: context.now }, prepared.command)
		).commandId
	} catch (error) {
		issue = faultIssue(error)
	}
	await db.transaction((tx) => recordUndo(tx, context.accountId, actionId, prepared.requestId, commandId, issue))
	return checkCalendarAction(db, commands, context, actionId)
}
