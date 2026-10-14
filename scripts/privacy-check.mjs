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

const octet = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const privateAddress = new RegExp(
	`(?<![\\d.])(?:10\\.${octet}|172\\.(?:1[6-9]|2\\d|3[01])|192\\.168)\\.${octet}\\.${octet}(?![\\d]|\\.\\d)`
)
const tunnelHost = /[a-z0-9-]+(?:\.[a-z0-9-]+)*\.ngrok[a-z0-9-]*\.[a-z]{2,}/i
const checks = [
	[privateAddress, 'contains a private network address'],
	[tunnelHost, 'contains an ngrok tunnel host'],
]

if (existsSync(NAMES_FILE)) {
	const names = readFileSync(NAMES_FILE, 'utf8')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !ALLOWED.has(line.toLowerCase()))
	const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	if (names.length > 0)
		checks.push([
			new RegExp(`(^|[^\\p{L}\\p{N}])(${names.map(escape).join('|')})($|[^\\p{L}\\p{N}])`, 'iu'),
			'contains a name from the private student list',
		])
}

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
	for (const [pattern, message] of checks) if (pattern.test(row.slice(1))) problems.push(`${file}:${line}: ${message}`)
}

if (problems.length > 0) {
	console.error('privacy-check: commit refused')
	for (const problem of problems) console.error(`  ${problem}`)
	process.exit(1)
}
