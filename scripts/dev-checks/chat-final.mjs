import { spawnSync } from 'node:child_process'

import { ROOT } from './paths.mjs'

const NODE = process.execPath

const CHECKS = [
	{ script: 'schedule-started.mjs', args: [], token: 'SCHEDULE_STARTED_OK' },
	{ script: 'schedule-started-series.mjs', args: [], token: 'SCHEDULE_STARTED_SERIES_OK' },
	{ script: 'schedule-comments-series.mjs', args: [], token: 'SCHEDULE_COMMENTS_SERIES_OK' },
	{ script: 'mark-revision.mjs', args: [], token: 'MARK_REVISION_OK' },
	{ script: 'chat-config.mjs', args: [], token: 'CHAT_CONFIG_OK' },
	{ script: 'chat-api.mjs', args: ['records'], token: 'CHAT_RECORDS_OK' },
	{ script: 'chat-api.mjs', args: ['conversations'], token: 'CHAT_CONVERSATIONS_OK' },
	{ script: 'chat-api.mjs', args: ['notes'], token: 'CHAT_NOTES_OK' },
	{ script: 'chat-api.mjs', args: ['comments'], token: 'CHAT_COMMENTS_OK' },
	{ script: 'chat-api.mjs', args: ['target'], token: 'CHAT_TARGET_OK' },
	{ script: 'chat-api.mjs', args: ['actions'], token: 'CHAT_ACTIONS_OK' },
	{ script: 'chat-api.mjs', args: ['calendar'], token: 'CHAT_CALENDAR_OK' },
	{ script: 'chat-api.mjs', args: ['budget'], token: 'CHAT_BUDGET_OK' },
	{ script: 'chat-api.mjs', args: ['runs'], token: 'CHAT_RUNS_OK' },
	{ script: 'chat-api.mjs', args: ['answers'], token: 'CHAT_ANSWERS_OK' },
	{ script: 'chat-api.mjs', args: ['models'], token: 'CHAT_MODELS_OK' },
	{ script: 'chat-api.mjs', args: ['delete'], token: 'CHAT_DELETE_OK' },
	{ script: 'chat-api.mjs', args: ['title'], token: 'CHAT_TITLE_OK' },
	{ script: 'calendar-reads.mjs', args: [], token: 'CALENDAR_READS_OK' },
	{ script: 'calendar-final.mjs', args: [], token: 'CALENDAR_FINAL_OK' },
]

const TIMEOUT_MS = 15 * 60 * 1000

const env = { ...process.env }
for (const name of Object.keys(env)) {
	if (name.startsWith('ANTHROPIC_') || name === 'DATABASE_URL' || name === 'MIGRATOR_DATABASE_URL') delete env[name]
}

let passed = 0
for (const check of CHECKS) {
	const name = [check.script.replace(/\.mjs$/, ''), ...check.args].join(' ')
	const started = Date.now()
	const run = spawnSync(NODE, [`${ROOT}/scripts/dev-checks/${check.script}`, ...check.args], {
		cwd: ROOT,
		env,
		encoding: 'utf8',
		timeout: TIMEOUT_MS,
		maxBuffer: 64 * 1024 * 1024,
	})
	const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
	const ok = run.status === 0 && output.includes(check.token)
	const seconds = Math.round((Date.now() - started) / 1000)
	console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${ok ? check.token : ''} exit=${run.status ?? run.signal} ${seconds}s`)
	if (!ok) {
		console.log(output.split('\n').slice(-20).join('\n'))
		console.log(`${passed}/${CHECKS.length} checks passed, stopped at ${name}`)
		process.exit(typeof run.status === 'number' && run.status !== 0 ? run.status : 1)
	}
	passed++
}

console.log(`${passed}/${CHECKS.length} checks passed`)
console.log('CHAT_FINAL_OK')
