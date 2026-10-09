import { Writable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	type Closable,
	createLifecycle,
	type ManagedServer,
	type ManagedSocket,
	type ManagedSocketServer,
} from '../src/lifecycle.ts'
import { createLogger } from '../src/request-context.ts'

function memoryLogger() {
	const lines: string[] = []
	const stream = new Writable({
		write(chunk, _encoding, done) {
			for (const line of chunk.toString().split('\n')) if (line) lines.push(line)
			done()
		},
	})
	return { logger: createLogger('info', stream), records: () => lines.map((line) => JSON.parse(line)) }
}

function fakeServer(closes: boolean) {
	const server = {
		close: vi.fn((callback: () => void) => {
			if (closes) callback()
		}),
		closeIdleConnections: vi.fn(),
		closeAllConnections: vi.fn(),
	}
	return server satisfies ManagedServer
}

function resource(name: string, order: string[], fails = false): Closable {
	return {
		name,
		close: async () => {
			order.push(name)
			if (fails) throw new Error(`${name} refused to close`)
		},
	}
}

function fakeSocket() {
	const socket = {
		close: vi.fn<(code: number, reason: string) => void>(),
		terminate: vi.fn(),
	}
	return socket satisfies ManagedSocket
}

function fakeSocketServer(clients: ManagedSocket[], order: string[] = []) {
	const wss = {
		clients: new Set(clients),
		close: vi.fn((callback: () => void) => {
			order.push('wss')
			callback()
		}),
	}
	return wss satisfies ManagedSocketServer
}

function setup(server: ManagedServer, resources: Closable[], deadlineMs = 2000, wss?: ManagedSocketServer) {
	const { logger, records } = memoryLogger()
	const exit = vi.fn<(code: number) => void>()
	const lifecycle = createLifecycle({ deadlineMs, logger, exit })
	lifecycle.manage({ server, wss, resources })
	return { lifecycle, exit, records }
}

describe('createLifecycle', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('closes the server, then the resources in order, and exits 0 once', async () => {
		const order: string[] = []
		const server = fakeServer(true)
		const { lifecycle, exit, records } = setup(server, [resource('first', order), resource('second', order)])

		expect(lifecycle.isStopping()).toBe(false)
		const done = lifecycle.shutdown('SIGTERM')
		expect(lifecycle.isStopping()).toBe(true)
		await done

		expect(server.close).toHaveBeenCalledTimes(1)
		expect(server.closeIdleConnections).toHaveBeenCalledTimes(1)
		expect(order).toEqual(['first', 'second'])
		expect(exit.mock.calls).toEqual([[0]])
		const messages = records().map((line) => line.msg)
		expect(messages).toEqual(['shutdown start', 'shutdown complete'])
		expect(records()[0].signal).toBe('SIGTERM')
	})

	it('forces all connections closed at half the deadline and exits 1 at the deadline when the server hangs', async () => {
		const order: string[] = []
		const server = fakeServer(false)
		const { lifecycle, exit, records } = setup(server, [resource('pg-pool', order)], 2000)

		void lifecycle.shutdown('SIGTERM')
		await vi.advanceTimersByTimeAsync(999)
		expect(server.closeAllConnections).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(1)
		expect(server.closeAllConnections).toHaveBeenCalledTimes(1)
		expect(exit).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(999)
		expect(exit).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(1)
		expect(exit.mock.calls).toEqual([[1]])
		expect(order).toEqual([])
		expect(records().map((line) => line.msg)).toContain('shutdown deadline exceeded')
	})

	it('logs a failing resource with its name and still closes the next one', async () => {
		const order: string[] = []
		const { lifecycle, exit, records } = setup(fakeServer(true), [
			resource('first', order, true),
			resource('second', order),
		])

		await lifecycle.shutdown('SIGINT')

		expect(order).toEqual(['first', 'second'])
		const failure = records().find((line) => line.msg === 'resource close failed')
		expect(failure).toMatchObject({ level: 'error', resource: 'first' })
		expect(exit.mock.calls).toEqual([[0]])
	})

	it('runs one shutdown for repeated signals and never exits 1 after a clean stop', async () => {
		const order: string[] = []
		const server = fakeServer(true)
		const { lifecycle, exit } = setup(server, [resource('pg-pool', order)], 2000)

		const first = lifecycle.shutdown('SIGTERM')
		const second = lifecycle.shutdown('SIGINT')
		expect(second).toBe(first)
		await Promise.all([first, second])
		await vi.advanceTimersByTimeAsync(5000)

		expect(server.close).toHaveBeenCalledTimes(1)
		expect(order).toEqual(['pg-pool'])
		expect(exit.mock.calls).toEqual([[0]])
	})

	it('sends 1001 to WebSocket clients at once and terminates the ones still open at half the deadline', async () => {
		const server = fakeServer(false)
		const clients = [fakeSocket(), fakeSocket()]
		const wss = fakeSocketServer(clients)
		const { lifecycle, exit } = setup(server, [], 2000, wss)

		void lifecycle.shutdown('SIGTERM')
		for (const client of clients) expect(client.close.mock.calls).toEqual([[1001, 'server shutting down']])

		await vi.advanceTimersByTimeAsync(999)
		for (const client of clients) expect(client.terminate).not.toHaveBeenCalled()
		expect(server.closeAllConnections).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(1)
		for (const client of clients) expect(client.terminate).toHaveBeenCalledTimes(1)
		expect(server.closeAllConnections).toHaveBeenCalledTimes(1)
		expect(exit).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(1000)
		expect(exit.mock.calls).toEqual([[1]])
	})

	it('closes the WebSocket server after the HTTP server and before the resources', async () => {
		const order: string[] = []
		const server = fakeServer(true)
		server.close.mockImplementation((callback: () => void) => {
			order.push('server')
			callback()
		})
		const wss = fakeSocketServer([fakeSocket()], order)
		const { lifecycle, exit } = setup(server, [resource('pg-pool', order)], 2000, wss)

		await lifecycle.shutdown('SIGTERM')

		expect(order).toEqual(['server', 'wss', 'pg-pool'])
		expect(wss.close).toHaveBeenCalledTimes(1)
		expect(exit.mock.calls).toEqual([[0]])
	})
})
