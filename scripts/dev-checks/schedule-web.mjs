import { check, failures } from './browser-context.ts'
import { changes } from './schedule-web/changes.ts'
import { drag } from './schedule-web/drag.ts'
import { fade } from './schedule-web/fade.ts'
import { cleanupFixtures } from './schedule-web/fixtures.ts'
import { forms } from './schedule-web/forms.ts'
import { frame } from './schedule-web/frame.ts'
import { grid } from './schedule-web/grid.ts'
import { read } from './schedule-web/read.ts'
import { settings } from './schedule-web/settings.ts'
import { students } from './schedule-web/students.ts'
import { zones } from './schedule-web/zones.ts'

export { cleanupFixtures }
const section = process.argv[2]
const sections = { fade, frame, read, changes, students, grid, forms, zones, settings, drag }

const run = Object.entries(sections).find(([name]) => name === section)?.[1]
if (!run) {
	console.log(`usage: schedule-web.mjs ${Object.keys(sections).join('|')} [dark]`)
	process.exit(2)
}

try {
	await run()
} catch (error) {
	check('section completed', false, String(error).slice(0, 200))
}
process.exit(failures())
