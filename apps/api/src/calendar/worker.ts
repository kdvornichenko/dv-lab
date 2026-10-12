import { and, eq, isNull, notInArray, or } from 'drizzle-orm'
import { PgBoss } from 'pg-boss'
import type { Logger } from 'pino'
import { z } from 'zod'

import { googleCommands, googleConnections, type Database } from '@dv-lab/db'

import { dispatchCommand, projectCommand } from './dispatch.ts'
import { CalendarFault, type GoogleGateway } from './gateway.ts'
import type { Credentials } from './google-access.ts'
import { resumeUnsentInstance } from './instance-recovery.ts'
import { failUnsentCommand, preparedCommand, readCommand, type CommandRow } from './journal.ts'
import type { ConnectionLease } from './lease.ts'
import { calendarCommandQueue, calendarQueueOptions } from './queue-schema.ts'
import { reconcileCommand, recoveryExpired, requireRecovery } from './recovery.ts'
import { resumeUnsentRestore } from './single-observation.ts'
import { cutCompletionIsCurrent, transitionStage } from './transition-journal.ts'
import { transitionSteps } from './transition-stages.ts'
import { executeTransition } from './transitions.ts'

const jobData = z.strictObject({ commandId: z.uuid() })

export function createCalendarWorker(deps: {
	db: Database
	databaseUrl: string
	credentials: Credentials
	lease: ConnectionLease
	gateway: GoogleGateway
	logger: Logger
	isStopping: () => boolean
}) {
	const boss = new PgBoss({ ...calendarQueueOptions, connectionString: deps.databaseUrl })
	const admissions = new Set<string>()
	const active = new Map<string, Promise<void>>()
	const stopped = new AbortController()
	const bootedAt = new Date()
	let timer: ReturnType<typeof setInterval> | undefined
	let sweep: Promise<void> | undefined
	let started = false
	boss.on('error', () => deps.logger.warn('Calendar queue unavailable'))
	const accepting = () => started && !stopped.signal.aborted && !deps.isStopping()

	async function processCommand(command: CommandRow) {
		if (!accepting()) return
		if (command.effect === 'none' && command.dispatchDeadline <= new Date()) {
			await failUnsentCommand(deps.db, command.id)
			admissions.delete(command.id)
			return
		}
		if (command.state === 'pending' && !admissions.has(command.id)) {
			if (command.createdAt <= bootedAt) await failUnsentCommand(deps.db, command.id)
			return
		}
		if (command.state === 'recovery_required') return
		if (command.state !== 'pending' && recoveryExpired(command)) {
			await requireRecovery(deps.db, command, 'provider_unavailable')
			return
		}
		try {
			if (command.state === 'projection_pending' && (await projectIfCurrent(command))) return
			await deps.credentials.withAccessToken(command.accountId, async (access) => {
				const current = await readCommand(access.db, command.accountId, command.id)
				const context = {
					...access,
					signal: AbortSignal.any([access.signal, stopped.signal, AbortSignal.timeout(30000)]),
				}
				if (current.plan.cut) {
					await executeTransition(context, current, deps.gateway)
					return
				}
				if (current.state === 'pending')
					await dispatchCommand(context, current, deps.gateway, deps.credentials.refreshRejectedAccess)
				if (current.state === 'projection_pending') await projectCommand(context, current)
				if (current.state === 'dispatching' || current.state === 'outcome_unknown')
					await reconcileCommand(context, current, deps.gateway)
			})
		} catch (error) {
			if (!(error instanceof CalendarFault && error.code === 'command_pending')) {
				await failUnsentCommand(deps.db, command.id)
				admissions.delete(command.id)
			}
			deps.logger.warn('Calendar command requires another journal check')
		}
	}

	async function projectIfCurrent(command: CommandRow) {
		return deps.lease.run(command.accountId, async (access) => {
			const current = await readCommand(access.db, command.accountId, command.id)
			if (current.state !== 'projection_pending') return true
			if (current.plan.cut) {
				const { prepared } = await preparedCommand(access.db, current)
				const complete = transitionSteps(prepared).find((step) => step.purpose === 'complete')
				const stage = complete ? await transitionStage(access, current, complete.stage) : undefined
				const [connection] = await access.db
					.select()
					.from(googleConnections)
					.where(eq(googleConnections.id, current.connectionId))
				if (!stage || !connection || stage.state !== 'acknowledged' || !cutCompletionIsCurrent(stage, connection)) {
					await requireRecovery(access.db, current, 'provider_unavailable')
					return false
				}
			}
			await projectCommand({ ...access, signal: AbortSignal.any([access.signal, stopped.signal]) }, current)
			return true
		})
	}

	async function run(commandId: string) {
		const running = active.get(commandId)
		if (running) return running
		const task = (async () => {
			const [command] = await deps.db.select().from(googleCommands).where(eq(googleCommands.id, commandId))
			if (!command || command.state === 'applied' || command.state === 'failed') {
				admissions.delete(commandId)
				return
			}
			await processCommand(command)
		})()
		active.set(commandId, task)
		try {
			await task
		} finally {
			active.delete(commandId)
		}
	}

	async function recover() {
		const commands = await deps.db
			.select({ id: googleCommands.id })
			.from(googleCommands)
			.where(
				or(
					notInArray(googleCommands.state, ['applied', 'failed', 'recovery_required', 'partial_recovery']),
					and(
						eq(googleCommands.state, 'recovery_required'),
						eq(googleCommands.effect, 'none'),
						isNull(googleCommands.dispatchedAt)
					)
				)
			)
			.orderBy(googleCommands.createdAt)
		for (const command of commands) {
			if (!accepting()) return
			await run(command.id)
		}
	}

	function tick() {
		if (!accepting() || sweep) return
		sweep = recover()
			.catch(() => deps.logger.warn('Calendar journal recovery unavailable'))
			.finally(() => {
				sweep = undefined
			})
	}

	return {
		name: 'calendar-worker',
		async start() {
			try {
				await boss.start()
				const queue = await boss.getQueue(calendarCommandQueue)
				if (queue?.policy !== 'singleton') throw new Error('Calendar command queue is not ready')
				started = true
				await boss.work<{ commandId: string }, void>(
					calendarCommandQueue,
					{ batchSize: 1, pollingIntervalSeconds: 1 },
					async (jobs) => {
						for (const job of jobs) await run(jobData.parse(job.data).commandId)
					}
				)
			} catch (error) {
				started = false
				await boss.stop({ graceful: false })
				throw error
			}
			timer = setInterval(tick, 5000)
			timer.unref()
			tick()
		},
		async admit(commandId: string) {
			if (!accepting()) throw new CalendarFault('provider_unavailable')
			admissions.add(commandId)
			const [command] = await deps.db
				.select({ connectionId: googleCommands.connectionId })
				.from(googleCommands)
				.where(eq(googleCommands.id, commandId))
			if (!command) return
			await boss.send(
				calendarCommandQueue,
				{ commandId },
				{ singletonKey: command.connectionId, retryLimit: 0, expireInSeconds: 30 }
			)
		},
		async resume(accountId: string, commandId: string) {
			if (!accepting()) throw new CalendarFault('provider_unavailable')
			await deps.credentials.withAccessToken(accountId, async (access) => {
				const command = await readCommand(access.db, accountId, commandId)
				if (!['partial_recovery', 'recovery_required'].includes(command.state))
					throw new CalendarFault('command_pending')
				if (command.plan.cut) {
					await executeTransition(
						{ ...access, signal: AbortSignal.any([access.signal, stopped.signal, AbortSignal.timeout(30000)]) },
						command,
						deps.gateway
					)
					return
				}
				if (
					!command.dispatchedAt &&
					command.effect === 'none' &&
					'ref' in command.plan.input &&
					command.plan.input.ref.kind === 'series'
				) {
					const context = {
						...access,
						signal: AbortSignal.any([
							access.signal,
							stopped.signal,
							AbortSignal.timeout(Math.max(0, command.dispatchDeadline.getTime() - Date.now())),
						]),
					}
					const resumed = await resumeUnsentInstance(context, command, deps.gateway)
					if (resumed.state === 'pending')
						await dispatchCommand(context, resumed, deps.gateway, deps.credentials.refreshRejectedAccess)
					return
				}
				if (command.operation === 'restore' && !command.dispatchedAt && command.effect === 'none') {
					const context = {
						...access,
						signal: AbortSignal.any([access.signal, stopped.signal, AbortSignal.timeout(30000)]),
					}
					const resumed = await resumeUnsentRestore(context, command, deps.gateway)
					if (resumed.state === 'pending')
						await dispatchCommand(context, resumed, deps.gateway, deps.credentials.refreshRejectedAccess)
					return
				}
				await reconcileCommand(
					{ ...access, signal: AbortSignal.any([access.signal, stopped.signal, AbortSignal.timeout(30000)]) },
					command,
					deps.gateway,
					true
				)
			})
		},
		async close() {
			stopped.abort()
			if (timer) clearInterval(timer)
			await boss.stop({ graceful: true, timeout: 10000 })
			await sweep
			await Promise.allSettled([...active.values()])
			admissions.clear()
		},
	}
}
