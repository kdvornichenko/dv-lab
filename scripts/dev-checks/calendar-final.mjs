import { spawnSync } from 'node:child_process'

import { ROOT } from './paths.mjs'

const NODE = process.execPath

const CHECKS = [
	{ script: 'calendar-catalog.mjs', args: [], token: 'CALENDAR_CATALOG_OK' },
	{ script: 'calendar-config.mjs', args: [], token: 'CALENDAR_CONFIG_OK' },
	{ script: 'calendar-lease.mjs', args: [], token: 'CALENDAR_LEASE_OK' },
	{ script: 'calendar-reads.mjs', args: [], token: 'CALENDAR_READS_OK' },
	{ script: 'calendar-commands.mjs', args: ['check'], token: 'CALENDAR_COMMANDS_OK' },
	{ script: 'calendar-sync.mjs', args: ['pass'], token: 'PASS_OK' },
	{ script: 'calendar-sync.mjs', args: ['claim'], token: 'CLAIM_OK' },
	{ script: 'calendar-sync.mjs', args: ['loop'], token: 'LOOP_OK' },
	{ script: 'calendar-push.mjs', args: [], token: 'CALENDAR_PUSH_OK' },
	{ script: 'calendar-event-commands.mjs', args: [], token: 'CALENDAR_EVENT_COMMANDS_OK' },
	{ script: 'calendar-inbound.mjs', args: ['resolver'], token: 'RESOLVER_OK' },
	{ script: 'calendar-inbound.mjs', args: ['assign'], token: 'ASSIGN_OK' },
	{ script: 'calendar-inbound.mjs', args: ['inbound'], token: 'CALENDAR_INBOUND_OK' },
	{ script: 'calendar-switch.mjs', args: [], token: 'CALENDAR_SWITCH_OK' },
	{ script: 'calendar-env.mjs', args: ['probe'], token: 'OFFLINE_OK' },
]

const TIMEOUT_MS = 15 * 60 * 1000

const results = []
for (const check of CHECKS) {
	const name = [check.script.replace(/\.mjs$/, ''), ...check.args].join(' ')
	const started = Date.now()
	const run = spawnSync(NODE, [`${ROOT}/scripts/dev-checks/${check.script}`, ...check.args], {
		cwd: ROOT,
		encoding: 'utf8',
		timeout: TIMEOUT_MS,
		maxBuffer: 64 * 1024 * 1024,
	})
	const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
	const passed = run.status === 0 && output.includes(check.token)
	const seconds = Math.round((Date.now() - started) / 1000)
	results.push({ name, passed })
	console.log(`${passed ? 'PASS' : 'FAIL'} ${name} exit=${run.status ?? run.signal} ${seconds}s`)
	if (!passed) console.log(output.split('\n').slice(-12).join('\n'))
}

const failed = results.filter((result) => !result.passed)
console.log(`${results.length - failed.length}/${results.length} checks passed`)
if (failed.length === 0) {
	console.log('CALENDAR_FINAL_OK')
	process.exit(0)
}
console.log(`FAILED: ${failed.map((result) => result.name).join(', ')}`)
process.exit(1)
