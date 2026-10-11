import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'

import { changedLines, inspectTypes } from './time-zone-metrics.ts'

export function programs(root: string, paths: string[]) {
	const groups = new Map<string, string[]>()
	for (const path of paths) {
		const workspace = path.match(/^(apps|packages)\/[^/]+/)?.[0]
		const configPath =
			workspace && existsSync(join(root, workspace, 'tsconfig.json'))
				? join(root, workspace, 'tsconfig.json')
				: join(root, 'tsconfig.base.json')
		const group = groups.get(configPath) ?? []
		group.push(resolve(root, path))
		groups.set(configPath, group)
	}
	const result = new Map<string, ts.Program>()
	for (const [configPath, inputs] of groups) {
		const config = ts.getParsedCommandLineOfConfigFile(
			configPath,
			{},
			{
				...ts.sys,
				onUnRecoverableConfigFileDiagnostic: () => {
					throw new Error(`Invalid TS config: ${relative(root, configPath)}`)
				},
			}
		)
		if (!config || config.errors.length) throw new Error(`Invalid TS config: ${relative(root, configPath)}`)
		const tooling = configPath === join(root, 'tsconfig.base.json')
		const options: ts.CompilerOptions = {
			...config.options,
			noEmit: true,
			incremental: false,
			allowJs: true,
			checkJs: true,
			...(tooling
				? {
						types: ['node'],
						jsx: ts.JsxEmit.Preserve,
						lib: ['lib.es2024.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
					}
				: {}),
		}
		const program = ts.createProgram([...new Set([...config.fileNames, ...inputs])], options)
		for (const path of inputs) result.set(path, program)
	}
	return result
}

export function inspect(
	program: ts.Program,
	path: string,
	before: string,
	after: string,
	spans: { line: number; endLine: number; changed: boolean }[]
) {
	const source = program.getSourceFile(path)
	if (!source || source.text !== after) throw new Error(`Current TypeScript source unavailable: ${path}`)
	const lines = changedLines(before, after)
	for (const span of spans.filter((item) => item.changed)) {
		for (let line = span.line; line <= span.endLine; line++) lines.add(line)
	}
	const catches = catchLines(source)
	const findings = inspectTypes(program, path, lines).map((finding) => ({
		...finding,
		boundary:
			finding.kind === 'unknown' && catches.has(finding.line) ? 'AST catch variable: unvalidated thrown value' : null,
	}))
	const diagnostics = [
		...program.getOptionsDiagnostics(),
		...program.getGlobalDiagnostics(),
		...program.getSyntacticDiagnostics(source),
		...program.getSemanticDiagnostics(source),
	]
		.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
		.map((diagnostic) => ({
			line: diagnostic.start === undefined ? null : source.getLineAndCharacterOfPosition(diagnostic.start).line + 1,
			code: diagnostic.code,
			message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
		}))
	return { inspectedLines: lines.size, findings, diagnostics }
}

function catchLines(source: ts.SourceFile): Set<number> {
	const lines = new Set<number>()
	function visit(node: ts.Node) {
		if (ts.isCatchClause(node) && node.variableDeclaration) {
			const declaration = node.variableDeclaration
			const start = declaration.getStart(source)
			const line = source.getLineAndCharacterOfPosition(start).line
			const prefix = source.text.slice(source.getLineStarts()[line], start)
			const suffix = source.text.slice(declaration.getEnd()).split('\n', 1)[0]
			if (/^\s*}?\s*catch\s*\(\s*$/.test(prefix) && /^\s*\)\s*\{\s*$/.test(suffix)) lines.add(line + 1)
		}
		ts.forEachChild(node, visit)
	}
	visit(source)
	return lines
}

export function programInputs(root: string, checkers: Map<string, ts.Program>, hash: (source: string) => string) {
	const inputs = new Map<string, string>()
	for (const program of new Set(checkers.values())) {
		for (const source of program.getSourceFiles()) inputs.set(relative(root, source.fileName), hash(source.text))
		const config = program.getCompilerOptions().configFilePath
		if (typeof config === 'string') inputs.set(relative(root, config), hash(readFileSync(config, 'utf8')))
	}
	return [...inputs].sort(([a], [b]) => a.localeCompare(b)).map(([path, sha256]) => ({ path, sha256 }))
}
