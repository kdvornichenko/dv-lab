import { startApi, teacherCookie } from '../schedule-api/io.ts'
import { sectionBalance, sectionFlag } from './balance.ts'
import { PORT, check, failures, recordFailure, removeOwn, removeTails, todayVn } from './context.ts'
import { sectionCut, sectionRace } from './cut-race.ts'
import { removeLedgerTails, sectionLedger } from './ledger.ts'
import { sectionLessons } from './lessons.ts'
import { sectionMarks } from './marks.ts'
import { sectionMoves } from './moves.ts'
import { sectionPast } from './past.ts'
import { sectionRebind } from './rebind.ts'
import { sectionToday } from './today.ts'
import type { Context, Api } from './types.ts'

const SECTIONS: Record<string, (ctx: Context) => Promise<string>> = {
	marks: sectionMarks,
	past: sectionPast,
	moves: sectionMoves,
	cut: sectionCut,
	race: sectionRace,
	balance: sectionBalance,
	flag: sectionFlag,
	today: sectionToday,
	ledger: sectionLedger,
	lessons: sectionLessons,
	rebind: sectionRebind,
}

const section = process.argv[2]

const run = SECTIONS[section as string]

if (!run) {
	console.log(`usage: node scripts/dev-checks/ledger-api.mjs ${Object.keys(SECTIONS).join('|')}`)
	process.exit(2)
}

removeTails()
removeLedgerTails()

const ids: string[] = []

let api: Api | null = null

let done: string | null = null

try {
	api = await startApi({ port: PORT })
	const cookie = await teacherCookie(api)
	done = await run({ api, cookie, ids, today: todayVn(), before: failures })
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
