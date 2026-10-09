import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { connect } from 'node:net'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'

const entry = fileURLToPath(new URL('../dist/server.mjs', import.meta.url))

let child: ChildProcessWithoutNullStreams | undefined

afterEach(() => {
	if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
	child = undefined
})

function start(port: number) {
	const proc = spawn(process.execPath, [entry], {
		env: {
			...process.env,
			PORT: String(port),
			APP_ORIGIN: `http://127.0.0.1:${port}`,
			SHUTDOWN_DEADLINE_MS: '3000',
			GIT_SHA: 'test-sha',
		},
	})
	child = proc
	let stdout = ''
	let stderr = ''
	proc.stdout.on('data', (chunk) => (stdout += chunk))
	proc.stderr.on('data', (chunk) => (stderr += chunk))
	const exited = new Promise<number | null>((resolve) => proc.on('exit', (code) => resolve(code)))
	const listening = new Promise<void>((resolve, reject) => {
		proc.stdout.on('data', () => {
			if (stdout.includes('"msg":"listening"')) resolve()
		})
		proc.on('exit', (code) => reject(new Error(`server exited with ${code} before listening\n${stdout}${stderr}`)))
	})
	return { proc, exited, listening, stdout: () => stdout }
}

describe('server.mjs shutdown', () => {
	it('SIGTERM on an idle server exits 0 within the deadline', async () => {
		const port = 20000 + Math.floor(Math.random() * 20000)
		const server = start(port)
		await server.listening

		const res = await fetch(`http://127.0.0.1:${port}/healthz`)
		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({ status: 'ok', db: 'ok', sha: 'test-sha' })

		const started = performance.now()
		server.proc.kill('SIGTERM')
		const code = await server.exited
		const elapsed = performance.now() - started

		expect(code).toBe(0)
		expect(elapsed).toBeLessThan(4000)
		expect(server.stdout()).toContain('shutdown complete')
	})

	it('SIGTERM with an unfinished request forces the connection closed at half the deadline and exits 0', async () => {
		const port = 20000 + Math.floor(Math.random() * 20000)
		const server = start(port)
		await server.listening

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
		const port = 20000 + Math.floor(Math.random() * 20000)
		const server = start(port)
		await server.listening

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
})
