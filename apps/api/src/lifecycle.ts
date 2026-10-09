import type { Logger } from 'pino'

export type Closable = { name: string; close: () => Promise<void> }

export type ManagedServer = {
	close: (callback: () => void) => unknown
	closeIdleConnections: () => void
	closeAllConnections: () => void
}

export type Lifecycle = {
	isStopping: () => boolean
	manage: (handles: { server: ManagedServer; resources: Closable[] }) => void
	shutdown: (signal: string) => Promise<void>
}

type Options = {
	deadlineMs: number
	logger: Logger
	exit: (code: number) => void
}

export function createLifecycle({ deadlineMs, logger, exit }: Options): Lifecycle {
	let stopping = false
	let running: Promise<void> | undefined
	let server: ManagedServer | undefined
	let resources: Closable[] = []

	async function stop(signal: string) {
		logger.info({ signal }, 'shutdown start')
		const hard = setTimeout(() => {
			logger.error('shutdown deadline exceeded')
			exit(1)
		}, deadlineMs)
		hard.unref()
		if (server) {
			const current = server
			const closed = new Promise<void>((resolve) => current.close(() => resolve()))
			current.closeIdleConnections()
			const grace = setTimeout(() => current.closeAllConnections(), Math.floor(deadlineMs / 2))
			grace.unref()
			await closed
			clearTimeout(grace)
		}
		for (const resource of resources) {
			try {
				await resource.close()
			} catch (err) {
				logger.error({ err, resource: resource.name }, 'resource close failed')
			}
		}
		clearTimeout(hard)
		logger.info('shutdown complete')
		exit(0)
	}

	function shutdown(signal: string) {
		if (!running) {
			stopping = true
			running = stop(signal)
		}
		return running
	}

	function manage(handles: { server: ManagedServer; resources: Closable[] }) {
		server = handles.server
		resources = handles.resources
		process.on('SIGTERM', () => void shutdown('SIGTERM'))
		process.on('SIGINT', () => void shutdown('SIGINT'))
	}

	return { isStopping: () => stopping, manage, shutdown }
}
