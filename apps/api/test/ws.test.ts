import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import WebSocket from 'ws'

const entry = fileURLToPath(new URL('../dist/server.mjs', import.meta.url))
const port = 20000 + Math.floor(Math.random() * 20000)
const url = `ws://127.0.0.1:${port}/ws`
const appOrigin = `http://127.0.0.1:${port}`

let child: ChildProcessWithoutNullStreams
let exited: Promise<number | null>

beforeAll(async () => {
	child = spawn(process.execPath, [entry], {
		env: {
			...process.env,
			PORT: String(port),
			APP_ORIGIN: appOrigin,
			SHUTDOWN_DEADLINE_MS: '3000',
			GIT_SHA: 'test-sha',
		},
	})
	let stdout = ''
	let stderr = ''
	child.stdout.on('data', (chunk) => (stdout += chunk))
	child.stderr.on('data', (chunk) => (stderr += chunk))
	exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)))
	await new Promise<void>((resolve, reject) => {
		child.stdout.on('data', () => {
			if (stdout.includes('"msg":"listening"')) resolve()
		})
		child.on('exit', (code) => reject(new Error(`server exited with ${code} before listening\n${stdout}${stderr}`)))
	})
})

afterAll(async () => {
	if (child.exitCode !== null || child.signalCode !== null) return
	child.kill('SIGTERM')
	expect(await exited).toBe(0)
})

function rejectedStatus(headers: Record<string, string>) {
	const socket = new WebSocket(url, { headers })
	return new Promise<{ status: number | undefined; opened: boolean }>((resolve, reject) => {
		socket.on('error', reject)
		socket.on('open', () => {
			socket.terminate()
			resolve({ status: 101, opened: true })
		})
		socket.on('unexpected-response', (req, res) => {
			res.resume()
			req.destroy()
			resolve({ status: res.statusCode, opened: false })
		})
	})
}

function openSocket() {
	const socket = new WebSocket(url, { headers: { origin: appOrigin } })
	const closed = new Promise<number>((resolve) => socket.on('close', (code) => resolve(code)))
	const opened = new Promise<void>((resolve, reject) => {
		socket.once('open', () => resolve())
		socket.once('error', reject)
	})
	return { socket, closed, opened }
}

describe('GET /ws on server.mjs', () => {
	it('refuses an upgrade without an Origin header with 403', async () => {
		expect(await rejectedStatus({})).toEqual({ status: 403, opened: false })
	})

	it('refuses an upgrade from a foreign Origin with 403', async () => {
		expect(await rejectedStatus({ origin: 'https://evil.example' })).toEqual({ status: 403, opened: false })
	})

	it('echoes a text frame of exactly 65536 bytes', async () => {
		const { socket, opened } = openSocket()
		await opened
		const payload = 'a'.repeat(65536)
		const echoed = new Promise<string>((resolve) => socket.once('message', (data) => resolve(data.toString())))
		socket.send(payload)
		expect(await echoed).toBe(payload)
		socket.close()
	})

	it('closes the connection with 1009 when a frame exceeds 65536 bytes', async () => {
		const { socket, closed, opened } = openSocket()
		socket.on('error', () => {})
		await opened
		socket.send('a'.repeat(65537))
		expect(await closed).toBe(1009)
	})
})
