import ts from 'typescript'

import { measureSource, METRIC_METHOD } from './time-zone-metrics.ts'

export const METHOD = {
	cyclomatic: `ESLint classic AST convention; ${METRIC_METHOD.cyclomatic}. Threshold <22 comes from Task1. ESLint rule/config source fingerprints accompany this method.`,
	cognitive: `DVLab AST nesting/control/logical-sequence v1 (not Sonar): ${METRIC_METHOD.cognitive}`,
	halstead:
		'DVLab executable AST leaves v1: identifier/private identifier/literal/template/JSX text operands by exact spelling; executable keyword/punctuation operators by SyntaxKind. Trivia/imports/type syntax and erased modifiers excluded. Each nested function owns its tokens once. D=(n1/2)*(N2/n2), n2=0 => 0. Module tokens reported separately without a function threshold.',
	types: METRIC_METHOD.types,
	limits: { cyclomaticExclusive: 22, cognitiveExclusive: 22, difficultyExclusive: 80, physicalLinesExclusive: 500 },
}

const erasedKinds = new Set([
	ts.SyntaxKind.InterfaceDeclaration,
	ts.SyntaxKind.TypeAliasDeclaration,
	ts.SyntaxKind.ImportDeclaration,
	ts.SyntaxKind.ImportEqualsDeclaration,
	ts.SyntaxKind.TypeParameter,
	ts.SyntaxKind.DeclareKeyword,
	ts.SyntaxKind.AbstractKeyword,
	ts.SyntaxKind.PublicKeyword,
	ts.SyntaxKind.PrivateKeyword,
	ts.SyntaxKind.ProtectedKeyword,
	ts.SyntaxKind.ReadonlyKeyword,
	ts.SyntaxKind.OverrideKeyword,
	ts.SyntaxKind.ImplementsKeyword,
	ts.SyntaxKind.EndOfFileToken,
])

function hasBody(node: ts.Node): node is ts.FunctionLikeDeclaration {
	return ts.isFunctionLike(node) && 'body' in node && node.body !== undefined
}

function typeOnly(node: ts.Node): boolean {
	return (ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node)) || ts.isTypeParameterDeclaration(node)
}

function erased(node: ts.Node): boolean {
	if (ts.isJSDoc(node) || typeOnly(node) || erasedKinds.has(node.kind)) return true
	if (ts.isExportDeclaration(node) || ts.isExportSpecifier(node)) return node.isTypeOnly
	if (ts.isFunctionLike(node) && !hasBody(node)) return true
	if (ts.isParameter(node) && node.name.getText() === 'this') return true
	if (ts.isHeritageClause(node) && node.token === ts.SyntaxKind.ImplementsKeyword) return true
	return (
		ts.canHaveModifiers(node) &&
		Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword))
	)
}

function typePunctuation(node: ts.Node): boolean {
	const parent = node.parent
	if (node.kind === ts.SyntaxKind.ColonToken) return 'type' in parent && parent.type !== undefined
	if (node.kind === ts.SyntaxKind.QuestionToken || node.kind === ts.SyntaxKind.ExclamationToken)
		return ts.isParameter(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent)
	return false
}

function runtimeChildren(node: ts.Node, source: ts.SourceFile): ts.Node[] {
	if (
		ts.isAsExpression(node) ||
		ts.isSatisfiesExpression(node) ||
		ts.isTypeAssertionExpression(node) ||
		ts.isNonNullExpression(node)
	)
		return [node.expression]
	const children = node.getChildren(source)
	function typeList(child: ts.Node): boolean {
		return child.kind === ts.SyntaxKind.SyntaxList && child.getChildren(source).some(typeOnly)
	}
	return children.filter((child, index) => {
		if (typeList(child)) return false
		if (child.kind !== ts.SyntaxKind.LessThanToken && child.kind !== ts.SyntaxKind.GreaterThanToken) return true
		const list = children[index + (child.kind === ts.SyntaxKind.LessThanToken ? 1 : -1)]
		return !list || !typeList(list)
	})
}

function operand(node: ts.Node): boolean {
	return (
		ts.isIdentifier(node) ||
		ts.isPrivateIdentifier(node) ||
		ts.isLiteralExpression(node) ||
		ts.isTemplateHead(node) ||
		ts.isTemplateMiddle(node) ||
		ts.isTemplateTail(node) ||
		ts.isJsxText(node) ||
		node.kind === ts.SyntaxKind.TrueKeyword ||
		node.kind === ts.SyntaxKind.FalseKeyword ||
		node.kind === ts.SyntaxKind.NullKeyword
	)
}

function halstead(root: ts.Node, source: ts.SourceFile) {
	const operators = new Set<number>()
	const operands = new Set<string>()
	let operatorCount = 0
	let operandCount = 0
	function visit(node: ts.Node) {
		if (node !== root && hasBody(node)) return
		if (erased(node) || typePunctuation(node)) return
		const children = runtimeChildren(node, source)
		if (children.length) {
			children.forEach(visit)
			return
		}
		if (node.kind === ts.SyntaxKind.SyntaxList || node.getText(source).trim() === '') return
		if (operand(node)) {
			operands.add(node.getText(source))
			operandCount++
		} else {
			operators.add(node.kind)
			operatorCount++
		}
	}
	visit(root)
	return {
		difficulty: operands.size === 0 ? 0 : (operators.size / 2) * (operandCount / operands.size),
		operators: { unique: operators.size, total: operatorCount },
		operands: { unique: operands.size, total: operandCount },
	}
}

function unsupported(node: ts.Node): boolean {
	return (
		ts.isEnumDeclaration(node) ||
		ts.isModuleDeclaration(node) ||
		ts.isDecorator(node) ||
		ts.isClassStaticBlockDeclaration(node) ||
		(ts.isPropertyDeclaration(node) && node.initializer !== undefined) ||
		(ts.isBinaryExpression(node) &&
			node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
			(ts.isObjectLiteralExpression(node.left) || ts.isArrayLiteralExpression(node.left)))
	)
}

function syntaxErrors(source: ts.SourceFile) {
	const options: ts.CompilerOptions = {
		noEmit: true,
		noResolve: true,
		noLib: true,
		allowJs: true,
		jsx: ts.JsxEmit.Preserve,
	}
	const host = ts.createCompilerHost(options)
	host.getSourceFile = (path) => (path === source.fileName ? source : undefined)
	return ts
		.createProgram([source.fileName], options, host)
		.getSyntacticDiagnostics(source)
		.map((diagnostic) => ({
			line: source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
			syntax: `TypeScript syntax error ${diagnostic.code}`,
		}))
}

export function measure(path: string, text: string) {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
	const existing = measureSource(path, text)
	const nodes = new Map<number, ts.Node>()
	const unavailable = syntaxErrors(source)
	function visit(node: ts.Node) {
		if (erased(node)) return
		if (unsupported(node))
			unavailable.push({
				line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
				syntax: ts.SyntaxKind[node.kind],
			})
		if (hasBody(node)) nodes.set(node.getStart(source), node)
		ts.forEachChild(node, visit)
	}
	visit(source)
	const functions = existing.functions
		.filter((metric) => nodes.has(metric.start))
		.map((metric) => {
			const node = nodes.get(metric.start)
			if (!node) throw new Error('Function AST unavailable')
			return { ...metric, ...halstead(node, source) }
		})
	return { lines: existing.lines, functions, moduleTokens: halstead(source, source), unavailable }
}

export function compare(path: string, before: string, after: string) {
	const previous = measure(path, before)
	const current = measure(path, after)
	const functions = current.functions.map((metric) => {
		const candidates = previous.functions.filter((item) => item.name === metric.name)
		const unique = current.functions.filter((item) => item.name === metric.name).length === 1 && candidates.length === 1
		const prior = unique ? candidates[0] : null
		return {
			...metric,
			changed: prior === null || before.slice(prior.start, prior.end) !== after.slice(metric.start, metric.end),
			before: prior,
			match: prior
				? 'unique qualified name'
				: candidates.length
					? 'ambiguous; no claimed correspondence'
					: 'new or renamed',
		}
	})
	return {
		...current,
		functions,
		beforeLines: previous.lines,
		beforeFunctions: previous.functions,
		beforeUnavailable: previous.unavailable,
	}
}
