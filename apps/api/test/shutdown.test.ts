import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { connect, createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'

const entry = fileURLToPath(new URL('../dist/server.mjs', import.meta.url))

let child: { proc: ChildProcessWithoutNullStreams; closed: Promise<void> } | undefined

afterEach(async () => {
	const running = child
	child = undefined
	if (!running) return
	if (running.proc.exitCode === null && running.proc.signalCode === null) running.proc.kill('SIGKILL')
	await running.closed
})

async function availablePort(): Promise<number> {
	const probe = createServer()
	await new Promise<void>((resolve, reject) => {
		probe.once('error', reject)
		probe.listen(0, () => resolve())
	})
	const address = probe.address()
	await new Promise<void>((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())))
	if (!address || typeof address === 'string') throw new Error('Port probe did not return a TCP address')
	return address.port
}

function spawnServer(port: number) {
	const proc = spawn(process.execPath, [entry], {
		env: {
			...process.env,
			NODE_ENV: 'test',
			GOOGLE_CALENDAR_ENABLED: 'false',
			PORT: String(port),
			APP_ORIGIN: `http://127.0.0.1:${port}`,
			SHUTDOWN_DEADLINE_MS: '3000',
			GIT_SHA: 'test-sha',
		},
	})
	const closed = new Promise<void>((resolve) => proc.once('close', () => resolve()))
	child = { proc, closed }
	let stdout = ''
	let stderr = ''
	proc.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
	proc.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
	const exited = new Promise<number | null>((resolve) => proc.on('exit', (code) => resolve(code)))
	const listening = new Promise<void>((resolve, reject) => {
		proc.stdout.on('data', () => {
			if (stdout.includes('"msg":"listening"')) resolve()
		})
		proc.once('error', reject)
		proc.once('close', (code) => reject(new Error(`server exited with ${code} before listening\n${stdout}${stderr}`)))
	})
	return { port, proc, closed, exited, listening, stdout: () => stdout, stderr: () => stderr }
}

async function start() {
	const deadline = performance.now() + 20000
	while (true) {
		const server = spawnServer(await availablePort())
		try {
			await server.listening
			return server
		} catch (error) {
			await server.closed
			if (!server.stderr().includes('EADDRINUSE') || performance.now() >= deadline) throw error
		}
	}
}

describe('server.mjs shutdown', () => {
	it('SIGTERM on an idle server exits 0 within the deadline', async () => {
		const server = await start()
		const { port } = server

		const res = await fetch(`http://127.0.0.1:${port}/healthz`)
		expect(res.status).toBe(200)
		const health: unknown = await res.json()
		expect(health).toEqual({ status: 'ok', db: 'ok', sha: 'test-sha' })

		const started = performance.now()
		server.proc.kill('SIGTERM')
		const code = await server.exited
		const elapsed = performance.now() - started

		expect(code).toBe(0)
		expect(elapsed).toBeLessThan(4000)
		expect(server.stdout()).toContain('shutdown complete')
	})

	it('SIGTERM with an unfinished request forces the connection closed at half the deadline and exits 0', async () => {
		const server = await start()
		const { port } = server

		const socket = connect(port, '127.0.0.1')
		await new Promise<void>((resolve) => socket.on('connect', () => resolve()))
		const socketClosed = new Promise<void>((resolve) => socket.on('close', () => resolve()))
		socket.on('error', () => {})
		socket.write('GET /healthz HTTP/1.1\r\nHost: 127.0.0.1\r\n')

		const started = performance.now()
		server.proc.kill('SIGTERM')
		const code = await server.exited
		const elapsed = performance.now() - started
		await socketClosed

		expect(code).toBe(0)
		expect(elapsed).toBeGreaterThanOrEqual(1400)
		expect(elapsed).toBeLessThan(4000)
		expect(server.stdout()).toContain('shutdown complete')
	})

	it('SIGTERM with an open WebSocket exits 0 within the deadline and closes it with 1001', async () => {
		const server = await start()
		const { port } = server

		const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { origin: `http://127.0.0.1:${port}` } })
		const closeCode = new Promise<number>((resolve) => socket.on('close', (code) => resolve(code)))
		await new Promise<void>((resolve) => socket.once('open', () => resolve()))
		const echoed = new Promise<string>((resolve) => socket.once('message', (data) => resolve(data.toString())))
		socket.send('ping')
		expect(await echoed).toBe('ping')

		const started = performance.now()
		server.proc.kill('SIGTERM')
		const code = await server.exited
		const elapsed = performance.now() - started

		expect(code).toBe(0)
		expect(elapsed).toBeLessThan(4000)
		expect(await closeCode).toBe(1001)
		expect(server.stdout()).toContain('shutdown complete')
	})

	it('SIGTERM with a WebSocket client that ignores the close frame terminates it at half the deadline and exits 0', async () => {
		const server = await start()
		const { port } = server

		const socket = connect(port, '127.0.0.1')
		await new Promise<void>((resolve) => socket.on('connect', () => resolve()))
		const socketClosed = new Promise<void>((resolve) => socket.on('close', () => resolve()))
		socket.on('error', () => {})
		let received = ''
		const upgraded = new Promise<void>((resolve) =>
			socket.on('data', (chunk: Buffer) => {
				received += chunk.toString('latin1')
				if (received.startsWith('HTTP/1.1 101')) resolve()
			})
		)
		socket.write(
			[
				'GET /ws HTTP/1.1',
				`Host: 127.0.0.1:${port}`,
				`Origin: http://127.0.0.1:${port}`,
				'Upgrade: websocket',
				'Connection: Upgrade',
				'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
				'Sec-WebSocket-Version: 13',
				'',
				'',
			].join('\r\n')
		)
		await upgraded

		const started = performance.now()
		server.proc.kill('SIGTERM')
		const code = await server.exited
		const elapsed = performance.now() - started
		await socketClosed

		expect(code).toBe(0)
		expect(elapsed).toBeGreaterThanOrEqual(1400)
		expect(elapsed).toBeLessThan(4000)
		expect(server.stdout()).toContain('shutdown complete')
	})
})
