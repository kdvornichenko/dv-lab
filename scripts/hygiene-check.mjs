import { execFileSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname

const excluded = [':!yarn.lock', ':!.yarn', ':!docs/google-calendar', ':!scripts/hygiene-check.mjs']

const cleanupAllowed = {
	'scripts/dev-checks/fixture-cleanup.mjs': 'the cleanup owner itself',
	'scripts/dev-checks/schedule-db.ts':
		'a negative probe that expects the database to refuse deleting a card with a series',
}
const allowedText = Object.entries(cleanupAllowed)
	.map(([path, reason]) => `${path} (${reason})`)
	.join(', ')

const checks = [
	{
		name: 'legacy runtime paths and models',
		pattern: String.raw`\.codex|gpt-[0-9]`,
		hint: 'only Claude runs this project; remove the path or model name',
		paths: ['.', ...excluded],
	},
	{
		name: 'personal mailbox addresses',
		pattern: String.raw`@(gmail|googlemail|yandex|mail|outlook|icloud)\.`,
		hint: 'the repository is public; use an example.test address',
		paths: ['.', ...excluded],
	},
	{
		name: 'hand-written student card cleanup in dev-checks',
		pattern: String.raw`delete[[:space:]]+from[[:space:]]+students([^_[:alnum:]]|$)`,
		hint: `remove fixture cards with removeStudentCards or studentCleanupSql from scripts/dev-checks/fixture-cleanup.mjs, it deletes every row that points at students; allowed: ${allowedText}`,
		paths: [
			':(glob)scripts/dev-checks/**/*.mjs',
			':(glob)scripts/dev-checks/**/*.ts',
			...Object.keys(cleanupAllowed).map((path) => `:!${path}`),
		],
		ignoreCase: true,
	},
]

let failed = false
for (const { name, pattern, hint, paths, ignoreCase } of checks) {
	let files = ''
	try {
		files = execFileSync('git', ['grep', ignoreCase ? '-IliE' : '-IlE', pattern, '--', ...paths], {
			cwd: ROOT,
			encoding: 'utf8',
		})
	} catch (error) {
		if (error.status !== 1) throw error
	}
	if (files.trim()) {
		failed = true
		console.error(`hygiene-check: ${name} (${hint}):\n${files}`)
	}
}

if (failed) process.exit(1)
console.log('hygiene-check: clean')
