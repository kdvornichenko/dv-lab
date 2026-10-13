import { startCalendarApi } from './calendar-env.mjs'

const api = await startCalendarApi({ port: 4000, envFile: '.env', appOrigin: 'http://localhost:3000' })
console.log('API_READY')

let stopping = false
async function stop() {
	if (stopping) return
	stopping = true
	const exit = await api.stop()
	console.log(`API_STOPPED ${exit?.code ?? exit?.signal ?? 'unknown'}`)
	process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
