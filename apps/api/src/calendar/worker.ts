import { eq, notInArray } from 'drizzle-orm'
import { PgBoss } from 'pg-boss'
import type { Logger } from 'pino'
import { z } from 'zod'

import { googleCommands, type Database } from '@dv-lab/db'

import type { Credentials } from './credentials.ts'
import { dispatchCommand, projectCommand } from './dispatch.ts'
import { CalendarFault, type GoogleGateway } from './gateway.ts'
import { failUnsentCommand, readCommand, type CommandRow } from './journal.ts'
import type { ConnectionLease } from './lease.ts'
import { calendarCommandQueue, calendarQueueOptions } from './queue-schema.ts'

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
	let timer: ReturnType<typeof setInterval> | undefined
	let sweep: Promise<void> | undefined
	let started = false
	boss.on('error', () => deps.logger.warn('Calendar queue unavailable'))
	const accepting = () => started && !stopped.signal.aborted && !deps.isStopping()

	async function processCommand(command: CommandRow) {
		if (!accepting()) return
		if (command.state === 'pending' && command.dispatchDeadline <= new Date()) {
			await failUnsentCommand(deps.db, command.id)
			admissions.delete(command.id)
			return
		}
		if (command.state === 'pending' && !admissions.has(command.id)) return
		try {
			if (command.state === 'projection_pending') {
				await deps.lease.run(command.accountId, async (access) => {
					const current = await readCommand(access.db, command.accountId, command.id)
					if (current.state !== 'projection_pending') return
					await projectCommand({ ...access, signal: AbortSignal.any([access.signal, stopped.signal]) }, current)
				})
				return
			}
			await deps.credentials.withAccessToken(command.accountId, async (access) => {
				const current = await readCommand(access.db, command.accountId, command.id)
				const context = {
					...access,
					signal: AbortSignal.any([access.signal, stopped.signal, AbortSignal.timeout(30000)]),
				}
				if (current.state === 'pending') await dispatchCommand(context, current, deps.gateway)
				if (current.state === 'projection_pending') await projectCommand(context, current)
			})
		} catch (error) {
			if (!(error instanceof CalendarFault && error.code === 'command_pending')) {
				await failUnsentCommand(deps.db, command.id)
				admissions.delete(command.id)
			}
			deps.logger.warn('Calendar command requires another journal check')
		}
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
			.where(notInArray(googleCommands.state, ['applied', 'failed', 'recovery_required', 'partial_recovery']))
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
				{ singletonKey: command.connectionId, retryLimit: 0, expireInSeconds: 60 }
			)
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
