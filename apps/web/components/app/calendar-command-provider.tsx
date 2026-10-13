'use client'

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

import { DATA_CHANGED_CHANNEL } from '@/lib/api-client'

import type { GoogleScheduleWindow } from '@dv-lab/contracts'

import { CalendarCommandStore } from './calendar-command-store'
import { readCalendarWeek, sameCalendarAccount } from './calendar-command-transport'

type RefreshKind = 'projection' | 'window'
type Reader = { refresh: () => Promise<void>; kind: RefreshKind }

function createController(accountId: string) {
	const readers = new Set<Reader>()
	const windows = new Set<(window: GoogleScheduleWindow) => void>()
	async function readWindow(date?: string, current: () => boolean = () => true) {
		if (!current() || !(await sameCalendarAccount(accountId)) || !current()) return null
		const result = await readCalendarWeek(date)
		if (!(await sameCalendarAccount(accountId)) || !current()) return null
		if (result !== null) for (const accept of windows) accept(result)
		return result
	}
	const store = new CalendarCommandStore(accountId, async (date, current) => {
		try {
			for (const kind of ['projection', 'window'] as const)
				for (const reader of [...readers].filter((reader) => reader.kind === kind)) {
					if (!current()) return null
					await reader.refresh()
				}
			return await readWindow(date, current)
		} catch {
			return null
		}
	})
	async function refreshReaders() {
		for (const kind of ['projection', 'window'] as const)
			for (const reader of [...readers].filter((reader) => reader.kind === kind)) {
				try {
					await reader.refresh()
				} catch {}
			}
	}
	return {
		accountId,
		store,
		readWindow,
		refreshReaders,
		register(refresh: Reader['refresh'], kind: RefreshKind) {
			const reader = { refresh, kind }
			readers.add(reader)
			return () => {
				readers.delete(reader)
			}
		},
		subscribeWindow(accept: (window: GoogleScheduleWindow) => void) {
			windows.add(accept)
			return () => {
				windows.delete(accept)
			}
		},
	}
}

const CalendarCommandsContext = createContext<ReturnType<typeof createController> | null>(null)

export function CalendarCommandProvider({ accountId, children }: { accountId: string; children: ReactNode }) {
	const [controller] = useState(() => createController(accountId))
	useEffect(() => {
		controller.store.start()
		let missed = false
		const changed = () => {
			if (document.visibilityState === 'visible') void controller.refreshReaders()
			else missed = true
		}
		const refresh = () => {
			if (document.visibilityState !== 'visible') return
			if (missed) {
				missed = false
				void controller.refreshReaders()
			}
			void controller.store.refresh()
		}
		DATA_CHANGED_CHANNEL?.addEventListener('message', changed)
		window.addEventListener('focus', refresh)
		document.addEventListener('visibilitychange', refresh)
		return () => {
			controller.store.stop()
			DATA_CHANGED_CHANNEL?.removeEventListener('message', changed)
			window.removeEventListener('focus', refresh)
			document.removeEventListener('visibilitychange', refresh)
		}
	}, [controller])
	return <CalendarCommandsContext.Provider value={controller}>{children}</CalendarCommandsContext.Provider>
}

export function useCalendarController() {
	const controller = useContext(CalendarCommandsContext)
	if (controller === null) throw new Error('Calendar controller requires the teacher account')
	return controller
}

export function useCalendarCommands() {
	const controller = useCalendarController()
	const view = useSyncExternalStore(
		controller.store.subscribe,
		controller.store.getSnapshot,
		controller.store.getSnapshot
	)
	const blocked =
		view.status !== 'ready' ||
		view.connection?.state !== 'connected' ||
		view.connection.pendingCommandCount !== 0 ||
		view.entries.some((entry) => entry.command?.state !== 'failed')
	return { ...controller, view, blocked }
}

export function useCalendarRefresh(refresh: () => Promise<void>, kind: RefreshKind = 'projection') {
	const controller = useCalendarController()
	useEffect(() => controller.register(refresh, kind), [controller, refresh, kind])
}
