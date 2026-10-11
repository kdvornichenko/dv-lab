import { marks } from './ledger-web/marks-dialog.mjs'
import { settingsSection } from './ledger-web/settings.mjs'
import { students } from './ledger-web/students.mjs'
import { todayMarks } from './ledger-web/today-marks.mjs'
import { todaySection } from './ledger-web/today.mjs'
import { check, failures } from './web.mjs'

const section = process.argv[2]
const sections = { marks, students, settings: settingsSection, today: todaySection, 'today-marks': todayMarks }

if (!sections[section]) {
	console.log(`usage: ledger-web.mjs ${Object.keys(sections).join('|')} [dark]`)
	process.exit(2)
}

try {
	await sections[section]()
} catch (error) {
	check('section completed', false, String(error).slice(0, 300))
}
process.exit(failures())
