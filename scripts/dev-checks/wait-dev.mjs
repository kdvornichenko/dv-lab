import { execFileSync } from 'node:child_process'
import { get } from 'node:http'
import { createConnection } from 'node:net'

const mode = process.argv[2]
const targets = [
	{ port: 4000, url: 'http://localhost:4000/healthz' },
	{ port: 3000, url: 'http://localhost:3000/login' },
]

function probe(url) {
	return new Promise((resolve) => {
		const request = get(url, (response) => {
			response.resume()
			resolve(response.statusCode < 500)
		})
		request.setTimeout(5000, () => {
			request.destroy()
			resolve(false)
		})
		request.on('error', () => resolve(false))
	})
}

function listening(port) {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host: '127.0.0.1' })
		socket.setTimeout(2000)
		socket.on('connect', () => {
			socket.destroy()
			resolve(true)
		})
		socket.on('timeout', () => {
			socket.destroy()
			resolve(false)
		})
		socket.on('error', () => resolve(false))
	})
}

async function up() {
	const end = Date.now() + 180000
	let missing = targets
	while (Date.now() < end) {
		const results = await Promise.all(targets.map((target) => probe(target.url)))
		missing = targets.filter((_, index) => !results[index])
		if (missing.length === 0) {
			console.log('DEV_UP_OK')
			return 0
		}
		await new Promise((resolve) => setTimeout(resolve, 3000))
	}
	console.log(`DEV_UP_FAIL no answer from port ${missing.map((target) => target.port).join(', ')}`)
	return 1
}

async function down() {
	const busy = []
	for (const target of targets) {
		if (await listening(target.port)) busy.push(target.port)
	}
	if (busy.length === 0) {
		console.log('DEV_DOWN_OK')
		return 0
	}
	console.log(`DEV_DOWN_FAIL port ${busy.join(', ')} still listening`)
	for (const port of busy) {
		try {
			const pids = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n')
			for (const pid of pids) {
				const cwd = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).split('\n').find((line) => line.startsWith('n'))
				console.log(`port ${port}: pid ${pid} cwd ${cwd?.slice(1) ?? 'unknown'}`)
			}
		} catch {
			console.log(`port ${port}: owner unknown`)
		}
	}
	return 1
}

if (mode === 'up') process.exit(await up())
if (mode === 'down') process.exit(await down())
console.log('usage: wait-dev.mjs up|down')
process.exit(2)
