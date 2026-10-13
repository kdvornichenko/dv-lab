import type {
	CalendarCommandSnapshot,
	ErrorCode,
	GoogleConnectionSnapshot,
	GoogleScheduleWindow,
} from '@dv-lab/contracts'

import {
	postCalendarCommand,
	readCalendarConnection,
	readCommand,
	readUnresolved,
	resumeCalendarCommand,
	sameCalendarAccount,
} from './calendar-command-transport'

export type CommandEntry = {
	requestId: string
	commandId: string | null
	command: CalendarCommandSnapshot | null
	status: 'checking' | 'ready' | 'missing' | 'unavailable'
	settling?: boolean
}
export type CommandView = {
	entries: readonly CommandEntry[]
	status: 'loading' | 'ready' | 'unavailable'
	connection: GoogleConnectionSnapshot | null
}
export type CommandResult =
	| { kind: 'applied'; command: CalendarCommandSnapshot; window: GoogleScheduleWindow }
	| { kind: 'failed'; code: ErrorCode | null; retryAfterSeconds?: number | null }
	| { kind: 'detached' }
export type CommandIntent = {
	path: string
	body: object
	operation: CalendarCommandSnapshot['operation']
	expectedVersion: string
	generation: number
	date: string
}
type LiveCommand = {
	intent: CommandIntent
	body: object
	resolve: (result: CommandResult) => void
}
type RecoveryId = { requestId: string; commandId: string | null }
type ConfirmedWindow = (date: string | undefined, current: () => boolean) => Promise<GoogleScheduleWindow | null>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DISPATCH_WINDOW_MS = 32_000

function between(command: CalendarCommandSnapshot | null) {
	return command?.state === 'partial_recovery' && command.nextAction === 'resume_recovery'
}

function storedIds(key: string): RecoveryId[] {
	try {
		const input: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]')
		if (!Array.isArray(input)) return []
		const items: unknown[] = input
		return items.flatMap((item: unknown) => {
			if (typeof item !== 'object' || item === null || !('requestId' in item) || !('commandId' in item)) return []
			if (typeof item.requestId !== 'string' || !UUID.test(item.requestId)) return []
			if (item.commandId !== null && (typeof item.commandId !== 'string' || !UUID.test(item.commandId))) return []
			return [{ requestId: item.requestId, commandId: item.commandId }]
		})
	} catch {
		return []
	}
}

function terminal(command: CalendarCommandSnapshot | null) {
	return command?.state === 'failed'
}

function sameConnection(observed: GoogleConnectionSnapshot, current: GoogleConnectionSnapshot | null) {
	return (
		observed.state === 'connected' &&
		current?.state === 'connected' &&
		observed.calendar !== null &&
		current.calendar !== null &&
		observed.calendar.id === current.calendar.id &&
		observed.generation === current.generation
	)
}

function correlated(entry: CommandEntry, command: CalendarCommandSnapshot, live?: LiveCommand) {
	if (entry.requestId !== command.requestId || (entry.commandId !== null && entry.commandId !== command.commandId))
		return false
	const original = live?.intent ?? entry.command
	return (
		original === null ||
		(original.generation === command.generation &&
			original.expectedVersion === command.expectedVersion &&
			original.operation === command.operation)
	)
}

export class CalendarCommandStore {
	private view: CommandView
	private listeners: Set<() => void>
	private live: Map<string, LiveCommand>
	private checking: Set<string>
	private posting: Set<string>
	private epoch: number
	private resuming: Set<string>
	private completed: Set<string>
	private active: boolean
	private listSequence: number
	private sentAt: Map<string, number>
	private timer: ReturnType<typeof setTimeout> | undefined
	subscribe: (listener: () => void) => () => void
	getSnapshot: () => CommandView

	private accountId: string
	private confirmedWindow: ConfirmedWindow
	constructor(accountId: string, confirmedWindow: ConfirmedWindow) {
		this.view = { entries: [], status: 'loading', connection: null }
		this.listeners = new Set()
		this.live = new Map<string, LiveCommand>()
		this.checking = new Set()
		this.posting = new Set()
		this.resuming = new Set()
		this.completed = new Set()
		this.epoch = 0
		this.active = false
		this.listSequence = 0
		this.sentAt = new Map()
		this.subscribe = (listener) => {
			this.listeners.add(listener)
			return () => {
				this.listeners.delete(listener)
			}
		}
		this.getSnapshot = () => this.view
		this.accountId = accountId
		this.confirmedWindow = confirmedWindow
	}

	private key() {
		return `dv-lab:calendar:${this.accountId}`
	}

	private publish(update: Partial<CommandView>) {
		if (!this.active) return
		const now = Date.now()
		const entries = (update.entries ?? this.view.entries).map((entry) => {
			const sent = this.sentAt.get(entry.requestId)
			const settling = between(entry.command) && sent !== undefined && now - sent < DISPATCH_WINDOW_MS
			return entry.settling === settling ? entry : { ...entry, settling }
		})
		this.view = { ...this.view, ...update, entries }
		try {
			const ids = this.view.entries
				.filter((entry) => entry.command?.state !== 'failed')
				.map(({ requestId, commandId }) => ({ requestId, commandId }))
			sessionStorage.setItem(this.key(), JSON.stringify(ids))
		} catch {}
		for (const listener of this.listeners) listener()
		this.schedule()
	}

	private set(entry: CommandEntry) {
		const entries = this.view.entries.filter((item) => item.requestId !== entry.requestId)
		this.publish({ entries: [...entries, entry] })
	}
	private find(requestId: string) {
		return this.view.entries.find((entry) => entry.requestId === requestId)
	}

	start() {
		this.epoch++
		this.active = true
		this.publish({
			entries: storedIds(this.key()).map((id) => ({ ...id, command: null, status: 'checking' })),
			status: 'loading',
			connection: null,
		})
		void this.refresh()
	}
	stop() {
		this.epoch++
		this.active = false
		this.listSequence++
		clearTimeout(this.timer)
		for (const live of this.live.values()) live.resolve({ kind: 'detached' })
		this.live.clear()
		this.checking.clear()
		this.posting.clear()
		this.resuming.clear()
	}
	private isCurrent(epoch: number) {
		return this.active && epoch === this.epoch
	}
	private async authorized(epoch: number) {
		if (!this.isCurrent(epoch)) return false
		const same = await sameCalendarAccount(this.accountId)
		if (!this.isCurrent(epoch)) return false
		if (!same)
			this.publish({
				status: 'unavailable',
				connection: null,
				entries: this.view.entries.map((entry) => ({ ...entry, status: 'unavailable' })),
			})
		return same
	}

	async refresh() {
		const epoch = this.epoch
		const sequence = ++this.listSequence
		if (!(await this.authorized(epoch)) || !this.isCurrent(epoch)) return
		const result = await readUnresolved()
		if (!this.isCurrent(epoch) || sequence !== this.listSequence) return
		if (result === null) {
			this.publish({ status: 'unavailable' })
			return
		}
		if (!(await this.authorized(epoch)) || !this.isCurrent(epoch) || sequence !== this.listSequence) return
		const retained = [...this.view.entries]
		for (const command of result.commands) {
			if (this.completed.has(command.commandId)) continue
			const existing = retained.find((entry) => entry.requestId === command.requestId)
			if (existing && !correlated(existing, command, this.live.get(command.requestId))) continue
			if (existing?.command) continue
			const entry: CommandEntry = {
				requestId: command.requestId,
				commandId: command.commandId,
				command,
				status: 'ready',
			}
			const index = retained.findIndex((item) => item.requestId === command.requestId)
			if (index === -1) retained.push(entry)
			else retained[index] = entry
		}
		this.publish({ entries: retained, status: 'ready', connection: result.connection })
		await Promise.all(
			retained.filter((entry) => entry.command?.state !== 'failed').map((entry) => this.check(entry.requestId))
		)
	}

	submit(requestId: string, intent: CommandIntent): Promise<CommandResult> {
		if (
			!this.active ||
			this.view.status !== 'ready' ||
			this.view.connection?.state !== 'connected' ||
			this.view.connection.pendingCommandCount !== 0 ||
			this.view.entries.some((entry) => !terminal(entry.command)) ||
			this.live.has(requestId) ||
			this.find(requestId)
		)
			return Promise.resolve({ kind: 'failed', code: 'command_pending' })
		return new Promise((resolve) => {
			const body = { ...intent.body, requestId, expectedVersion: intent.expectedVersion }
			this.publish({ entries: this.view.entries.filter((entry) => entry.command?.state !== 'failed') })
			this.live.set(requestId, { intent, body, resolve })
			this.sentAt.set(requestId, Date.now())
			this.set({ requestId, commandId: null, command: null, status: 'checking' })
			void this.post(requestId, true)
		})
	}

	private async post(requestId: string, retryMissing: boolean) {
		if (!this.active || this.posting.has(requestId)) return
		this.posting.add(requestId)
		const epoch = this.epoch
		try {
			const live = this.live.get(requestId)
			if (!live || !(await this.authorized(epoch)) || !this.isCurrent(epoch)) return
			const result = await postCalendarCommand(live.intent.path, live.body)
			if (!(await this.authorized(epoch)) || !this.isCurrent(epoch)) return
			const entry = this.find(requestId)
			if (!entry) return
			if (result.kind === 'rejected' && entry.commandId === null) {
				this.live.delete(requestId)
				this.publish({ entries: this.view.entries.filter((item) => item.requestId !== requestId) })
				live.resolve({ kind: 'failed', code: result.code })
				return
			}
			if (result.kind === 'accepted' && entry.commandId === null)
				this.set({ ...entry, commandId: result.commandId, status: 'checking' })
			await this.check(requestId)
		} finally {
			if (this.isCurrent(epoch)) this.posting.delete(requestId)
		}
		if (retryMissing && this.isCurrent(epoch) && this.find(requestId)?.status === 'missing')
			await this.post(requestId, false)
	}

	async check(requestId: string) {
		const entry = this.find(requestId)
		if (!this.active || !entry || this.checking.has(requestId)) return
		this.checking.add(requestId)
		const epoch = this.epoch
		try {
			if (!(await this.authorized(epoch)) || !this.isCurrent(epoch)) return
			const path =
				entry.commandId === null
					? `/google/commands/by-request/${encodeURIComponent(requestId)}`
					: `/google/commands/${encodeURIComponent(entry.commandId)}`
			const result = await readCommand(path)
			if (!(await this.authorized(epoch)) || !this.isCurrent(epoch)) return
			if (result.kind !== 'ready') {
				this.set({ ...entry, status: result.kind })
				return
			}
			const live = this.live.get(requestId)
			if (!correlated(entry, result.command, live)) {
				this.set({ ...entry, status: 'unavailable' })
				return
			}
			const next = { ...entry, commandId: result.command.commandId, command: result.command, status: 'ready' as const }
			this.set(next)
			await this.finish(next, epoch, live)
		} finally {
			if (this.isCurrent(epoch)) this.checking.delete(requestId)
		}
	}

	private async finish(entry: CommandEntry, epoch: number, live?: LiveCommand) {
		if (!this.isCurrent(epoch)) return
		const command = entry.command
		if (!command) return
		if (command.state === 'failed' && command.effect === 'none') {
			if (live) {
				this.live.delete(entry.requestId)
				live.resolve({ kind: 'failed', code: command.issue, retryAfterSeconds: command.retryAfterSeconds })
				void this.refresh()
			}
			return
		}
		if (command.state !== 'applied' || command.confirmedRevision === null) return
		const window = await this.confirmedWindow(live?.intent.date, () => this.isCurrent(epoch))
		if (!this.isCurrent(epoch)) return
		const connection = await readCalendarConnection()
		if (!(await this.authorized(epoch)) || !this.isCurrent(epoch)) return
		if (
			window === null ||
			window.read.state !== 'fresh' ||
			!sameConnection(window.connection, connection) ||
			!sameConnection(window.connection, this.view.connection) ||
			window.connection.generation < command.generation ||
			BigInt(window.read.revision) < BigInt(command.confirmedRevision)
		) {
			this.set({ ...entry, status: 'unavailable' })
			this.refreshChangedConnection(connection)
			return
		}
		this.live.delete(entry.requestId)
		this.completed.add(command.commandId)
		this.publish({ entries: this.view.entries.filter((item) => item.requestId !== entry.requestId) })
		live?.resolve({ kind: 'applied', command, window })
		void this.refresh()
	}

	private refreshChangedConnection(connection: GoogleConnectionSnapshot | null) {
		if (connection !== null && connection.generation !== this.view.connection?.generation) void this.refresh()
	}

	async resume(requestId: string) {
		if (!this.active || this.resuming.has(requestId) || this.checking.has(requestId)) return
		const epoch = this.epoch
		this.resuming.add(requestId)
		try {
			await this.check(requestId)
			if (!this.isCurrent(epoch)) return
			const entry = this.find(requestId)
			const command = entry?.command
			if (
				!entry ||
				entry.status !== 'ready' ||
				!command ||
				command.nextAction !== 'resume_recovery' ||
				!['partial_recovery', 'recovery_required'].includes(command.state) ||
				!(await this.authorized(epoch)) ||
				!this.isCurrent(epoch) ||
				this.find(requestId) !== entry
			)
				return
			this.set({ ...entry, status: 'checking' })
			await resumeCalendarCommand(command.commandId)
			if (!this.isCurrent(epoch)) return
			await this.check(requestId)
			if (!this.isCurrent(epoch)) return
			await this.refresh()
		} finally {
			if (this.isCurrent(epoch)) this.resuming.delete(requestId)
		}
	}

	async retryStatus(requestId: string) {
		const epoch = this.epoch
		await this.check(requestId)
		if (!this.isCurrent(epoch)) return
		if (this.find(requestId)?.status === 'missing' && this.live.has(requestId)) await this.post(requestId, false)
	}

	private schedule() {
		clearTimeout(this.timer)
		const epoch = this.epoch
		const waiting = this.view.entries.filter(
			(entry) =>
				!terminal(entry.command) &&
				(entry.command === null ||
					entry.settling === true ||
					entry.command.state === 'applied' ||
					['wait', 'refresh'].includes(entry.command.nextAction))
		)
		if (waiting.length === 0) return
		this.timer = setTimeout(() => {
			if (this.isCurrent(epoch) && document.visibilityState === 'visible')
				void Promise.all(waiting.map((entry) => this.check(entry.requestId)))
		}, 2000)
	}
}
