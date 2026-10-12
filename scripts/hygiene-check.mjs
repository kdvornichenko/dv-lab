import { execFileSync } from 'node:child_process'

const checks = [
	{
		name: 'legacy runtime paths and models',
		pattern: String.raw`\.codex|gpt-[0-9]`,
		hint: 'only Claude runs this project; remove the path or model name',
	},
	{
		name: 'personal mailbox addresses',
		pattern: String.raw`@(gmail|googlemail|yandex|mail|outlook|icloud)\.`,
		hint: 'the repository is public; use an example.test address',
	},
]

const excluded = [':!yarn.lock', ':!.yarn', ':!docs/google-calendar', ':!scripts/hygiene-check.mjs']

let failed = false
for (const { name, pattern, hint } of checks) {
	let files = ''
	try {
		files = execFileSync('git', ['grep', '-IlE', pattern, '--', '.', ...excluded], { encoding: 'utf8' })
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
