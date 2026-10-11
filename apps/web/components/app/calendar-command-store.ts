import type {
	CalendarCommandSnapshot,
	ErrorCode,
	GoogleConnectionSnapshot,
	GoogleScheduleWindow,
} from '@dv-lab/contracts'

import {
	postCalendarCommand,
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
}
export type CommandView = {
	entries: readonly CommandEntry[]
	status: 'loading' | 'ready' | 'unavailable'
	connection: GoogleConnectionSnapshot | null
}
export type CommandResult =
	| { kind: 'applied'; command: CalendarCommandSnapshot; window: GoogleScheduleWindow }
	| { kind: 'failed'; code: ErrorCode | null }
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

function correlated(entry: CommandEntry, command: CalendarCommandSnapshot, live?: LiveCommand) {
	if (entry.requestId !== command.requestId || (entry.commandId !== null && entry.commandId !== command.commandId))
		return false
	return (
		live === undefined ||
		(live.intent.generation === command.generation &&
			live.intent.expectedVersion === command.expectedVersion &&
			live.intent.operation === command.operation)
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
	private timer: ReturnType<typeof setTimeout> | undefined
	subscribe: (listener: () => void) => () => void
	getSnapshot: () => CommandView

	private accountId: string
	private confirmedWindow: (date?: string) => Promise<GoogleScheduleWindow | null>
	constructor(accountId: string, confirmedWindow: (date?: string) => Promise<GoogleScheduleWindow | null>) {
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
		this.view = { ...this.view, ...update }
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
		this.publish({ entries: storedIds(this.key()).map((id) => ({ ...id, command: null, status: 'checking' })) })
		void this.refresh()
	}
	stop() {
		this.epoch++
		this.active = false
		this.listSequence++
		clearTimeout(this.timer)
		for (const live of this.live.values()) live.resolve({ kind: 'detached' })
		this.live.clear()
	}
	private async authorized() {
		const same = await sameCalendarAccount(this.accountId)
		if (!same)
			this.publish({
				status: 'unavailable',
				connection: null,
				entries: this.view.entries.map((entry) => ({ ...entry, status: 'unavailable' })),
			})
		return same && this.active
	}

	async refresh() {
		const sequence = ++this.listSequence
		if (!(await this.authorized())) return
		const result = await readUnresolved()
		if (!this.active || sequence !== this.listSequence) return
		if (result === null || !(await this.authorized())) {
			this.publish({ status: 'unavailable' })
			return
		}
		if (sequence !== this.listSequence) return
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
			this.set({ requestId, commandId: null, command: null, status: 'checking' })
			void this.post(requestId, true)
		})
	}

	private async post(requestId: string, retryMissing: boolean) {
		if (this.posting.has(requestId)) return
		this.posting.add(requestId)
		const epoch = this.epoch
		try {
			const live = this.live.get(requestId)
			if (!live || !(await this.authorized()) || epoch !== this.epoch) return
			const result = await postCalendarCommand(live.intent.path, live.body)
			if (epoch !== this.epoch || !(await this.authorized())) return
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
			this.posting.delete(requestId)
		}
		if (retryMissing && epoch === this.epoch && this.find(requestId)?.status === 'missing')
			await this.post(requestId, false)
	}

	async check(requestId: string) {
		const entry = this.find(requestId)
		if (!entry || this.checking.has(requestId)) return
		this.checking.add(requestId)
		const epoch = this.epoch
		try {
			if (!(await this.authorized())) return
			const path =
				entry.commandId === null
					? `/google/commands/by-request/${encodeURIComponent(requestId)}`
					: `/google/commands/${encodeURIComponent(entry.commandId)}`
			const result = await readCommand(path)
			if (epoch !== this.epoch || !(await this.authorized())) return
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
			await this.finish(next, live)
		} finally {
			this.checking.delete(requestId)
		}
	}

	private async finish(entry: CommandEntry, live?: LiveCommand) {
		const command = entry.command
		if (!command) return
		if (command.state === 'failed' && command.effect === 'none') {
			if (live) {
				this.live.delete(entry.requestId)
				live.resolve({ kind: 'failed', code: command.issue })
				void this.refresh()
			}
			return
		}
		if (command.state !== 'applied' || command.confirmedRevision === null) return
		const epoch = this.epoch
		const window = await this.confirmedWindow(live?.intent.date)
		if (epoch !== this.epoch || !this.active || !(await this.authorized())) return
		if (
			window === null ||
			window.read.state !== 'fresh' ||
			window.connection.generation !== command.generation ||
			BigInt(window.read.revision) < BigInt(command.confirmedRevision)
		) {
			this.set({ ...entry, status: 'unavailable' })
			return
		}
		this.live.delete(entry.requestId)
		this.completed.add(command.commandId)
		this.publish({ entries: this.view.entries.filter((item) => item.requestId !== entry.requestId) })
		live?.resolve({ kind: 'applied', command, window })
		void this.refresh()
	}

	async resume(requestId: string) {
		if (this.resuming.has(requestId) || this.checking.has(requestId)) return
		this.resuming.add(requestId)
		try {
			await this.check(requestId)
			const entry = this.find(requestId)
			const command = entry?.command
			if (
				!entry ||
				entry.status !== 'ready' ||
				!command ||
				command.nextAction !== 'resume_recovery' ||
				!['partial_recovery', 'recovery_required'].includes(command.state) ||
				!(await this.authorized())
			)
				return
			this.set({ ...entry, status: 'checking' })
			await resumeCalendarCommand(command.commandId)
			await this.check(requestId)
			await this.refresh()
		} finally {
			this.resuming.delete(requestId)
		}
	}

	async retryStatus(requestId: string) {
		await this.check(requestId)
		if (this.find(requestId)?.status === 'missing' && this.live.has(requestId)) await this.post(requestId, false)
	}

	private schedule() {
		clearTimeout(this.timer)
		const waiting = this.view.entries.filter(
			(entry) =>
				!terminal(entry.command) &&
				(entry.command === null ||
					entry.command.state === 'applied' ||
					['wait', 'refresh'].includes(entry.command.nextAction))
		)
		if (waiting.length === 0) return
		this.timer = setTimeout(() => {
			if (this.active && document.visibilityState === 'visible')
				void Promise.all(waiting.map((entry) => this.check(entry.requestId)))
		}, 2000)
	}
}
