import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

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
})
