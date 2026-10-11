import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import { compare, METHOD } from './calendar-metrics.ts'
import { inspect, programInputs, programs } from './calendar-types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const TOOL_FILES = ['calendar-quality.ts', 'calendar-metrics.ts', 'calendar-types.ts'].map(
	(name) => `scripts/dev-checks/${name}`
)
const METHOD_FILES = [
	...TOOL_FILES,
	'scripts/dev-checks/time-zone-metrics.ts',
	'apps/web/eslint.config.mjs',
	'node_modules/eslint/lib/rules/complexity.js',
]
const PHASE = '.planning/phases/24-google-calendar-connection-and-outbound-sync'
const hash = (source: string) => createHash('sha256').update(source).digest('hex')

function git(args: string[]): string {
	const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
	if (result.status !== 0) throw new Error(`Git read unavailable: ${args[0]}`)
	return result.stdout
}

function options() {
	const values = new Map<string, string[]>()
	const args = process.argv.slice(2)
	const flags = new Set(['--base', '--owned', '--new', '--boundary-review'])
	for (let index = 0; index < args.length; index++) {
		const key = args[index]
		if (key === '--json') {
			values.set(key, [])
			continue
		}
		if (!flags.has(key) || !args[index + 1] || args[index + 1].startsWith('--'))
			throw new Error(`Invalid option: ${key}`)
		values.set(key, [...(values.get(key) ?? []), args[++index]])
	}
	const bases = values.get('--base') ?? []
	if (bases.length !== 1)
		throw new Error(
			'Use --base <existing Git ref>; optional --owned <path> (repeat), --new <path> (repeat), --json, --boundary-review <path:line:sha256:reason>'
		)
	const base = git(['rev-parse', '--verify', '--end-of-options', `${bases[0]}^{commit}`]).trim()
	return { base, values }
}

function safePath(path: string): string {
	if (
		isAbsolute(path) ||
		path !== relative(ROOT, resolve(ROOT, path)) ||
		path.startsWith('..') ||
		/[\0\r\n]/.test(path)
	)
		throw new Error('Owned path must be a normalized repository-relative path')
	const absolute = resolve(ROOT, path)
	if (existsSync(absolute) && relative(ROOT, realpathSync(absolute)).startsWith('..'))
		throw new Error(`Symlink outside worktree: ${path}`)
	return absolute
}

function plannedPaths() {
	const paths = new Set<string>()
	for (const name of readdirSync(resolve(ROOT, PHASE)).filter((path) => path.endsWith('-PLAN.md'))) {
		const plan = readFileSync(resolve(ROOT, PHASE, name), 'utf8')
		if (/^files_modified: *\[\] *$/m.test(plan)) continue
		const inventory = plan.match(/^files_modified:\s*\n((?:[ \t]+[^\n]*\n)+)/m)?.[1]
		if (!inventory) throw new Error(`Missing plan inventory: ${name}`)
		const matches = [...inventory.matchAll(/['"]([^'"\r\n]+)['"]/g)].map((match) => match[1])
		if (!matches.length) throw new Error(`Unsupported plan inventory: ${name}; use explicit --owned paths`)
		for (const path of matches) paths.add(path)
	}
	return [...paths]
}

function exclusion(path: string): string | null {
	if (path.includes('/node_modules/') || path.startsWith('node_modules/') || path === 'yarn.lock')
		return 'Dependency content: not owned handwritten code'
	if (path.includes('/drizzle/'))
		return 'Generated migration/snapshot: requires schema/catalog evidence; no function metrics'
	if (path.endsWith('.sql')) return 'SQL: requires SQL/schema review; TS metrics inapplicable'
	if (/\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/.test(path)) return null
	if (/\.(?:json|ya?ml|md)$/.test(path))
		return 'Non-TS source/configuration/document: no TS function metrics; not a readiness claim'
	return 'UNSUPPORTED handwritten language: no implemented measurement'
}

function scope(base: string, values: Map<string, string[]>) {
	const explicit = values.get('--owned')
	const owned = new Set([...(explicit ?? plannedPaths()), ...TOOL_FILES, ...(values.get('--new') ?? [])])
	for (const path of owned) safePath(path)
	const changed = git(['diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', base, '--'])
		.split('\0')
		.filter(Boolean)
	const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)
	const allowedNew = new Set([...TOOL_FILES, ...(values.get('--new') ?? [])])
	const selected = [...new Set([...changed.filter((path) => owned.has(path)), ...allowedNew])].sort()
	const pending = untracked.filter((path) => owned.has(path) && !allowedNew.has(path))
	const ignored = [...changed, ...untracked].filter((path) => !owned.has(path)).sort()
	const baselinePaths = new Set(git(['ls-tree', '-r', '--name-only', '-z', base]).split('\0'))
	for (const path of explicit ?? []) {
		if (!existsSync(safePath(path)) && !baselinePaths.has(path)) throw new Error(`Owned path unavailable: ${path}`)
	}
	return {
		selected,
		pending,
		ignored,
		ownedCount: owned.size,
		baselinePaths,
		selection: explicit ? 'explicit --owned paths' : 'current Phase24 plan files_modified inventory',
	}
}

function analyze(path: string, base: string, baselinePaths: Set<string>, program: ts.Program, reviews: string[]) {
	const after = readFileSync(safePath(path), 'utf8')
	const before = baselinePaths.has(path) ? git(['show', `${base}:${path}`]) : ''
	const sha256 = hash(after)
	const metrics = compare(path, before, after)
	const types = inspect(program, safePath(path), before, after, metrics.functions)
	const boundaries = types.findings
		.filter((finding) => finding.kind === 'unknown')
		.map((finding) => {
			const prefix = `${path}:${finding.line}:${sha256}:`
			const review = reviews.find((value) => value.startsWith(prefix) && value.slice(prefix.length).trim().length > 0)
			return { ...finding, reason: finding.boundary ?? review?.slice(prefix.length) ?? null }
		})
	const failures = metricFailures(metrics)
	for (const finding of types.findings.filter((item) => item.kind === 'any'))
		failures.push(`${finding.line}: explicit/inferred any`)
	return {
		path,
		sha256,
		baselineSha256: baselinePaths.has(path) ? hash(before) : null,
		...metrics,
		types,
		boundaries,
		failures,
	}
}

function metricFailures(metrics: ReturnType<typeof compare>): string[] {
	const failures: string[] = []
	if (metrics.lines >= 500) failures.push('physical lines >=500')
	for (const metric of metrics.functions) {
		if (metric.cyclomatic >= 22) failures.push(`${metric.line}: CC ${metric.cyclomatic} >=22`)
		if (metric.cognitive >= 22) failures.push(`${metric.line}: cognitive ${metric.cognitive} >=22`)
		if (metric.difficulty >= 80) failures.push(`${metric.line}: Halstead D ${metric.difficulty} >=80`)
	}
	return failures
}

function sourceHash(path: string) {
	return { path, sha256: hash(readFileSync(safePath(path), 'utf8')) }
}

function measureFiles(base: string, selected: string[], baselinePaths: Set<string>, reviews: string[]) {
	const excluded = selected
		.filter((path) => exclusion(path) !== null)
		.map((path) => ({ path, reason: exclusion(path) }))
	const missing = selected.filter((path) => !existsSync(safePath(path)))
	const paths = selected.filter((path) => exclusion(path) === null && !missing.includes(path))
	const checkers = programs(ROOT, paths)
	const files = paths.map((path) => {
		const program = checkers.get(safePath(path))
		if (!program) throw new Error(`TypeScript program unavailable: ${path}`)
		return analyze(path, base, baselinePaths, program, reviews)
	})
	const inputs = programInputs(ROOT, checkers, hash)
	const stale = files.filter((file) => sourceHash(file.path).sha256 !== file.sha256).map((file) => file.path)
	return { files, excluded, missing, stale, typeInputs: inputs }
}

function statusFor(data: ReturnType<typeof measureFiles>, pending: string[]) {
	const unverified =
		pending.length > 0 ||
		data.missing.length > 0 ||
		data.stale.length > 0 ||
		data.excluded.some((item) => item.reason?.startsWith('UNSUPPORTED')) ||
		data.files.some(
			(file) =>
				file.unavailable.length > 0 ||
				file.beforeUnavailable.length > 0 ||
				file.types.diagnostics.length > 0 ||
				file.boundaries.some((boundary) => !boundary.reason)
		)
	if (unverified) return 'UNVERIFIED'
	return data.files.some((file) => file.failures.length) ? 'FAIL' : 'PASS'
}

function report(base: string, values: Map<string, string[]>) {
	const selected = scope(base, values)
	const data = measureFiles(base, selected.selected, selected.baselinePaths, values.get('--boundary-review') ?? [])
	const sources = METHOD_FILES.map(sourceHash)
	const fingerprint = hash(data.files.map((file) => `${file.path}\0${file.sha256}`).join('\n'))
	const eslint = readFileSync(resolve(ROOT, 'node_modules/eslint/package.json'), 'utf8').match(
		/"version":\s*"([^"]+)"/
	)?.[1]
	if (!eslint) throw new Error('ESLint version unavailable')
	return {
		status: statusFor(data, selected.pending),
		base,
		head: git(['rev-parse', 'HEAD']).trim(),
		fingerprint,
		versions: { node: process.version, typescript: ts.version, eslint },
		method: METHOD,
		methodSources: sources,
		scope: {
			selection: selected.selection,
			ownedInventory: selected.ownedCount,
			selected: selected.selected.length,
			files: data.files.length,
			functions: data.files.reduce((total, file) => total + file.functions.length, 0),
			changedFunctions: data.files.reduce((total, file) => total + file.functions.filter((fn) => fn.changed).length, 0),
			pendingExplicitNew: selected.pending,
			outsideOwned: selected.ignored,
		},
		typeInputFingerprint: hash(JSON.stringify(data.typeInputs)),
		limitations: [
			'Static Task1 measurements only; no runtime, provider, dead-code audit or plan13/14 acceptance.',
			'Before/after correspondence only for unique qualified function names; ambiguous/renamed functions retain no claimed baseline pair.',
			'Type proof covers changed lines and complete changed functions using current programs; external library bodies opaque, supplied type arguments checked.',
			'Catch variables are AST-proven error boundaries. Other unknown requires a source-hash-bound input/error boundary review; supplied reasons are reviewer attestations.',
			'Enums/namespaces/decorators/class initializers/static blocks/destructuring assignments are UNVERIFIED; no executable syntax silently dropped.',
		],
		...data,
	}
}

function compact(data: ReturnType<typeof report>) {
	return {
		...data,
		detail:
			'--json includes all current/baseline function spans and metrics; compact branching lists changed numeric pairs only',
		typeInputs: { count: data.typeInputs.length, sha256: data.typeInputFingerprint },
		files: data.files.map((file) => ({
			path: file.path,
			sha256: file.sha256,
			baselineSha256: file.baselineSha256,
			lines: [file.beforeLines, file.lines],
			functions: file.functions.length,
			maxima: {
				cc: Math.max(0, ...file.functions.map((fn) => fn.cyclomatic)),
				cognitive: Math.max(0, ...file.functions.map((fn) => fn.cognitive)),
				difficulty: Math.max(0, ...file.functions.map((fn) => fn.difficulty)),
			},
			branching: file.functions
				.filter(
					(fn) =>
						fn.changed && fn.before && (fn.before.cyclomatic !== fn.cyclomatic || fn.before.cognitive !== fn.cognitive)
				)
				.map((fn) => ({
					name: fn.name,
					span: [fn.line, fn.endLine],
					match: fn.match,
					before: fn.before ? [fn.before.cyclomatic, fn.before.cognitive] : null,
					after: [fn.cyclomatic, fn.cognitive],
				})),
			failures: file.failures,
			diagnostics: file.types.diagnostics,
			boundaries: file.boundaries,
			unavailable: file.unavailable,
			beforeUnavailable: file.beforeUnavailable,
		})),
	}
}

try {
	const { base, values } = options()
	const data = report(base, values)
	console.log(JSON.stringify(values.has('--json') ? data : compact(data), null, 2))
	process.exitCode = data.status === 'PASS' ? 0 : data.status === 'FAIL' ? 1 : 2
} catch (error) {
	console.error(
		JSON.stringify({ status: 'UNVERIFIED', reason: error instanceof Error ? error.message : 'Measurement unavailable' })
	)
	process.exitCode = 2
}
