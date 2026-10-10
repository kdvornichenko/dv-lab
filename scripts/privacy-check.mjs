import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

const NAMES_FILE = process.env.DVLAB_PRIVATE_NAMES ?? `${homedir()}/.claude/private/student-names.txt`
const VAULT_DIR = process.env.DVLAB_VAULT_STUDENTS ?? '/Volumes/T7/personal/vault/md/personal/vika/students'
const ALLOWED = new Set(['vika'])

if (process.argv.includes('--refresh')) {
	const names = readdirSync(VAULT_DIR, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
		.map((entry) => entry.name)
		.filter((name) => !ALLOWED.has(name.toLowerCase()))
		.sort()
	mkdirSync(NAMES_FILE.slice(0, NAMES_FILE.lastIndexOf('/')), { recursive: true, mode: 0o700 })
	writeFileSync(NAMES_FILE, `${names.join('\n')}\n`, { mode: 0o600 })
	console.log(`privacy-check: ${names.length} names written to the private list`)
	process.exit(0)
}

if (process.argv.includes('--install')) {
	const stable = `${homedir()}/.claude/mods/privacy-check`
	mkdirSync(stable, { recursive: true })
	copyFileSync(new URL(import.meta.url).pathname, `${stable}/privacy-check.mjs`)
	const hooks = `${execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim()}/hooks`
	const hook = `${hooks}/pre-commit`
	writeFileSync(
		hook,
		'#!/bin/sh\n[ -f "$HOME/.claude/mods/privacy-check/privacy-check.mjs" ] || exit 0\nexec node "$HOME/.claude/mods/privacy-check/privacy-check.mjs"\n',
		{ mode: 0o755 }
	)
	chmodSync(hook, 0o755)
	console.log(`privacy-check: installed ${hook}`)
	process.exit(0)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 26 })

const stagedFiles = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean)
const problems = []

for (const file of stagedFiles) {
	if (file.endsWith('.vault-import.json')) problems.push(`${file}: import packet must never be committed`)
}

if (!existsSync(NAMES_FILE)) {
	if (problems.length === 0) process.exit(0)
} else {
	const names = readFileSync(NAMES_FILE, 'utf8')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !ALLOWED.has(line.toLowerCase()))
	const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const pattern = names.length > 0 ? new RegExp(`(^|[^\\p{L}\\p{N}])(${names.map(escape).join('|')})($|[^\\p{L}\\p{N}])`, 'iu') : null
	if (pattern) {
		let file = ''
		let line = 0
		for (const row of git('diff', '--cached', '-U0', '--no-color').split('\n')) {
			if (row.startsWith('+++ b/')) {
				file = row.slice(6)
				continue
			}
			const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(row)
			if (hunk) {
				line = Number(hunk[1]) - 1
				continue
			}
			if (!row.startsWith('+') || row.startsWith('+++')) continue
			line += 1
			if (pattern.test(row.slice(1))) problems.push(`${file}:${line}: contains a name from the private student list`)
		}
	}
}

if (problems.length > 0) {
	console.error('privacy-check: commit refused')
	for (const problem of problems) console.error(`  ${problem}`)
	process.exit(1)
}
