import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import { changedLines, inspectTypes, measureSource, METRIC_METHOD } from './time-zone-metrics.ts'

interface BaselineFile {
	path: string
	exists: boolean
	sha256: string | null
	source: string | null
}

interface Baseline {
	version: number
	root: string
	head: string
	files: BaselineFile[]
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const SOURCE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const args = process.argv.slice(2)

function option(name: string): string | undefined {
	const index = args.indexOf(name)
	return index < 0 ? undefined : args[index + 1]
}

function object(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function baselineFile(value: unknown): value is BaselineFile {
	if (!object(value) || typeof value.path !== 'string' || typeof value.exists !== 'boolean') return false
	return value.exists
		? typeof value.sha256 === 'string' && typeof value.source === 'string' && hash(value.source) === value.sha256
		: value.sha256 === null && value.source === null
}

function readBaseline(path: string): Baseline {
	const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
	if (
		!object(value) ||
		value.version !== 1 ||
		typeof value.root !== 'string' ||
		typeof value.head !== 'string' ||
		!Array.isArray(value.files)
	)
		throw new Error('Invalid source baseline')
	const files: unknown[] = value.files
	if (!files.every(baselineFile)) throw new Error('Invalid baseline source or fingerprint')
	if (resolve(value.root) !== ROOT) throw new Error('Baseline belongs to another worktree')
	if (!/^[a-f0-9]{40}$/.test(value.head) || git(['rev-parse', '--verify', `${value.head}^{commit}`]) !== value.head)
		throw new Error('Baseline commit unavailable')
	return { version: value.version, root: value.root, head: value.head, files }
}

function git(parameters: string[]): string {
	const result = spawnSync('git', parameters, { cwd: ROOT, encoding: 'utf8' })
	if (result.status !== 0) throw new Error(`Git read failed: ${parameters[0]}`)
	return result.stdout.trim()
}

function ownedPaths(phase: string) {
	const phases = join(ROOT, '.planning/phases')
	const directory = readdirSync(phases).find((path) => path.startsWith(`${phase}-`))
	if (!directory) throw new Error('Phase directory unavailable')
	const paths = new Set<string>()
	for (const plan of readdirSync(join(phases, directory)).filter((path) => path.endsWith('-PLAN.md'))) {
		const text = readFileSync(join(phases, directory, plan), 'utf8')
		const inventory = text.match(/^files_modified:\n((?:[ \t]+.*\n)*)/m)?.[1]
		if (!inventory) throw new Error(`Missing files_modified: ${plan}`)
		for (const line of inventory.split('\n')) {
			const path = line.match(/^\s+-\s+['"]?([^'"\r\n]+?)['"]?\s*$/)?.[1]
			if (path) paths.add(path)
		}
	}
	return paths
}

function sourcePath(path: string): boolean {
	return (
		SOURCE.test(path) &&
		!path.endsWith('.d.ts') &&
		!path.includes('/drizzle/') &&
		!path.includes('/node_modules/') &&
		!path.startsWith('.planning/')
	)
}

function safePath(path: string): string {
	if (isAbsolute(path) || relative(ROOT, resolve(ROOT, path)).startsWith('..'))
		throw new Error('Source path outside worktree')
	return resolve(ROOT, path)
}

function original(path: string, baseline: Baseline): string {
	const entry = baseline.files.find((file) => file.path === path)
	if (entry) return entry.source ?? ''
	const present = spawnSync('git', ['cat-file', '-e', `${baseline.head}:${path}`], { cwd: ROOT, encoding: 'utf8' })
	if (present.status !== 0) return ''
	const result = spawnSync('git', ['show', `${baseline.head}:${path}`], { cwd: ROOT, encoding: 'utf8' })
	if (result.status !== 0) throw new Error(`Baseline source unavailable: ${path}`)
	return result.stdout
}

function readConfig(path: string): ts.ParsedCommandLine {
	const parsed = ts.getParsedCommandLineOfConfigFile(
		path,
		{},
		{
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic: () => {
				throw new Error(`TypeScript config unavailable: ${relative(ROOT, path)}`)
			},
		}
	)
	if (!parsed || parsed.errors.length) throw new Error(`Invalid TypeScript config: ${relative(ROOT, path)}`)
	return parsed
}

function programs(paths: string[]): Map<string, ts.Program> {
	const groups = new Map<string, string[]>()
	for (const path of paths) {
		const workspace = path.match(/^(apps|packages)\/[^/]+/)?.[0]
		const key = workspace && existsSync(join(ROOT, workspace, 'tsconfig.json')) ? workspace : 'tooling'
		const group = groups.get(key) ?? []
		group.push(safePath(path))
		groups.set(key, group)
	}
	const result = new Map<string, ts.Program>()
	for (const [key, roots] of groups) {
		const config = readConfig(join(ROOT, key === 'tooling' ? 'tsconfig.base.json' : `${key}/tsconfig.json`))
		const options = {
			...config.options,
			allowJs: true,
			checkJs: false,
			types: ['node'],
			jsx: ts.JsxEmit.Preserve,
			lib: key === 'tooling' ? ['lib.es2024.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'] : config.options.lib,
		}
		const inputs = key === 'tooling' ? roots : [...new Set([...config.fileNames, ...roots])]
		const program = ts.createProgram(inputs, options)
		for (const path of roots) result.set(path, program)
	}
	return result
}

function typeDiagnostics(program: ts.Program, path: string) {
	const source = program.getSourceFile(path)
	if (!source) throw new Error(`Source absent from TypeScript program: ${relative(ROOT, path)}`)
	return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]
		.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
		.map((diagnostic) => ({
			line: diagnostic.start === undefined ? 1 : source.getLineAndCharacterOfPosition(diagnostic.start).line + 1,
			code: diagnostic.code,
			message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
		}))
}

function functionChanges(before: string, after: string, path: string) {
	const previous = measureSource(path, before)
	const current = measureSource(path, after)
	const seen = new Map<string, number>()
	return {
		lines: { before: previous.lines, after: current.lines },
		functions: current.functions.map((metric) => {
			const ordinal = seen.get(metric.name) ?? 0
			seen.set(metric.name, ordinal + 1)
			const prior = previous.functions.filter((item) => item.name === metric.name)[ordinal] ?? null
			return {
				name: metric.name,
				line: metric.line,
				endLine: metric.endLine,
				changed: prior === null || before.slice(prior.start, prior.end) !== after.slice(metric.start, metric.end),
				before:
					prior === null
						? null
						: { cyclomatic: prior.cyclomatic, cognitive: prior.cognitive, difficulty: prior.difficulty },
				after: { cyclomatic: metric.cyclomatic, cognitive: metric.cognitive, difficulty: metric.difficulty },
				tokens: { operators: metric.operators, operands: metric.operands },
			}
		}),
	}
}

function boundaryReviews() {
	const path = option('--boundary-reviews')
	if (!path) return new Map<string, string>()
	const data: unknown = JSON.parse(readFileSync(resolve(path), 'utf8'))
	if (!Array.isArray(data)) throw new Error('Boundary reviews must be an array')
	const entries: unknown[] = data
	return new Map<string, string>(
		entries.map((entry) => {
			if (
				!object(entry) ||
				typeof entry.path !== 'string' ||
				typeof entry.line !== 'number' ||
				typeof entry.sha256 !== 'string' ||
				typeof entry.reason !== 'string' ||
				entry.reason.trim() === ''
			)
				throw new Error('Invalid boundary review')
			return [`${entry.path}:${entry.line}:${entry.sha256}`, entry.reason]
		})
	)
}

function analyze(path: string, baseline: Baseline, program: ts.Program, reviews: Map<string, string>) {
	const source = readFileSync(safePath(path), 'utf8')
	const before = original(path, baseline)
	const sha256 = hash(source)
	const metrics = functionChanges(before, source, path)
	const lines = changedLines(before, source)
	for (const metric of metrics.functions.filter((fn) => fn.changed)) {
		for (let line = metric.line; line <= metric.endLine; line++) lines.add(line)
	}
	const types = inspectTypes(program, safePath(path), lines)
	const failures: string[] = []
	if (metrics.lines.after >= 500) failures.push('physical lines >=500')
	for (const metric of metrics.functions) {
		if (metric.after.cyclomatic >= 22) failures.push(`${metric.line}: cyclomatic >=22`)
		if (metric.after.cognitive >= 22) failures.push(`${metric.line}: cognitive >=22`)
		if (metric.after.difficulty >= 80) failures.push(`${metric.line}: Halstead Difficulty >=80`)
	}
	for (const finding of types) {
		if (finding.kind === 'any') failures.push(`${finding.line}: explicit/inferred any`)
	}
	const diagnostics = typeDiagnostics(program, safePath(path))
	const boundaries = types
		.filter((finding) => finding.kind === 'unknown')
		.map((finding) => ({
			...finding,
			reviewed: reviews.has(`${path}:${finding.line}:${sha256}`),
			reason: reviews.get(`${path}:${finding.line}:${sha256}`) ?? null,
		}))
	return { path, sha256, baselineSha256: hash(before), ...metrics, types, diagnostics, boundaries, failures }
}

function run() {
	const phase = option('--phase')
	if (!phase || !/^\d+(?:\.\d+)?$/.test(phase)) throw new Error('Use --phase <number>')
	if (args.includes('--check') === args.includes('--format-check')) throw new Error('Choose --check or --format-check')
	const state = process.env.DVLAB_CHECKS_DIR ?? join(tmpdir(), 'dvlab-dev-checks')
	const baselinePath = option('--baseline') ?? join(state, `${phase}-source-baseline.json`)
	const baseline = readBaseline(baselinePath)
	const planned = ownedPaths(phase)
	const changed = git(['diff', '--name-only', baseline.head]).split('\n')
	const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n')
	const inventory = [...new Set([...planned, ...changed, ...untracked])].sort()
	const paths = inventory.filter(
		(path) =>
			sourcePath(path) &&
			existsSync(safePath(path)) &&
			readFileSync(safePath(path), 'utf8') !== original(path, baseline)
	)
	if (paths.length === 0) throw new Error('No changed owned source')
	if (args.includes('--format-check')) {
		const result = spawnSync('yarn', ['exec', 'prettier', '--check', ...paths], { cwd: ROOT, stdio: 'inherit' })
		process.exitCode = result.status ?? 1
		return
	}
	const checkers = programs(paths)
	const reviews = boundaryReviews()
	const files = paths.map((path) => {
		const program = checkers.get(safePath(path))
		if (!program) throw new Error('Type checker missing')
		return analyze(path, baseline, program, reviews)
	})
	const failed = files.some((file) => file.failures.length > 0 || file.diagnostics.length > 0)
	const pending = files.some((file) => file.boundaries.some((boundary) => !boundary.reviewed))
	const report = {
		phase,
		status: failed ? 'FAIL' : pending ? 'UNVERIFIED' : 'PASS',
		createdAt: new Date().toISOString(),
		head: git(['rev-parse', 'HEAD']),
		versions: { node: process.version, typescript: ts.version },
		method: METRIC_METHOD,
		baseline: { head: baseline.head, sha256: hash(readFileSync(baselinePath, 'utf8')) },
		fingerprint: hash(files.map((file) => `${file.path}\0${file.sha256}`).join('\n')),
		scope: { changedHandwritten: files.length, addedToPlanInventory: paths.filter((path) => !planned.has(path)) },
		exclusions: inventory.filter((path) => !sourcePath(path)),
		exclusionReasons:
			'SQL/migration snapshots require schema/catalog evidence; planning is non-code; .d.ts and dependencies are not owned implementation. No executable owned source is excluded by size or complexity.',
		files,
	}
	const reportPath = join(state, `${phase}-quality-report.json`)
	writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
	console.log(
		JSON.stringify(
			{
				status: report.status,
				report: reportPath,
				fingerprint: report.fingerprint,
				scope: report.scope,
				versions: report.versions,
				method: report.method,
				files: files.map((file) => ({
					path: file.path,
					lines: file.lines,
					maximum: {
						cyclomatic: Math.max(0, ...file.functions.map((fn) => fn.after.cyclomatic)),
						cognitive: Math.max(0, ...file.functions.map((fn) => fn.after.cognitive)),
						difficulty: Math.max(0, ...file.functions.map((fn) => fn.after.difficulty)),
					},
					failures: file.failures,
					diagnostics: file.diagnostics,
					boundaries: file.boundaries,
				})),
			},
			null,
			2
		)
	)
	process.exitCode = failed ? 1 : pending ? 2 : 0
}

try {
	run()
} catch (error: unknown) {
	console.error(error instanceof Error ? error.message : 'Quality measurement unavailable')
	process.exitCode = 2
}
