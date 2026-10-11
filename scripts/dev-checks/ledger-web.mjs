import { check, failures } from './browser-context.ts'
import { marks } from './ledger-web/marks-dialog.mjs'
import { settingsSection } from './ledger-web/settings.mjs'
import { students } from './ledger-web/students.mjs'
import { todayMarks } from './ledger-web/today-marks.mjs'
import { todayPayment } from './ledger-web/today-payment.mjs'
import { todaySection } from './ledger-web/today.mjs'

const section = process.argv[2]
const sections = {
	marks,
	students,
	settings: settingsSection,
	today: todaySection,
	'today-marks': todayMarks,
	'today-payment': todayPayment,
}

const run = Object.entries(sections).find(([name]) => name === section)?.[1]
if (!run) {
	console.log(`usage: ledger-web.mjs ${Object.keys(sections).join('|')} [dark]`)
	process.exit(2)
}

try {
	await run()
} catch (error) {
	check('section completed', false, String(error).slice(0, 1500))
}
process.exit(failures())
