import { sectionChanges } from './changes.ts'
import { PORT, check, failures, recordFailure, removeOwn, removeTails } from './context.ts'
import { startApi, teacherCookie } from './io.ts'
import { sectionNext } from './next.ts'
import { sectionRead } from './read.ts'
import type { Api } from './types.ts'

const SECTIONS: Record<string, { run: (api: Api, cookie: string, ids: string[]) => Promise<string>; port: number }> = {
	read: { run: sectionRead, port: PORT },
	next: { run: sectionNext, port: PORT },
	changes: { run: sectionChanges, port: 4202 },
}

const section = process.argv[2]

const chosen = SECTIONS[section as string]

if (!chosen) {
	console.log(`usage: node scripts/dev-checks/schedule-api.mjs ${Object.keys(SECTIONS).join('|')}`)
	process.exit(2)
}

const run = chosen.run

removeTails()

const ids: string[] = []

let api: Api | null = null

let done: string | null = null

try {
	api = await startApi({ port: chosen.port })
	const cookie = await teacherCookie(api)
	done = await run(api, cookie, ids)
	check('api log has no fixture name', !api.logs().includes('Alex Example'))
} catch (err) {
	recordFailure()
	console.log(`FAIL ${section} crashed ${err instanceof Error ? err.message : String(err)}`)
} finally {
	if (api) await api.stop()
	removeOwn(ids)
}

if (failures === 0 && done) console.log(done)
else console.log(`${section} failures ${failures}`)

process.exit(failures === 0 && done ? 0 : 1)
