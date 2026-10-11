import ts from 'typescript'

export const METRIC_METHOD = {
	cyclomatic:
		'1 + if/loops/case/catch/ternary/logical operators/default parameters/optional accesses; nested functions measured separately',
	cognitive:
		'if/loops/switch/catch/ternary add 1 + control nesting; else, logical-operator runs and labelled jumps add 1; else-if adds 1; nested functions measured separately',
	halstead:
		'TS AST leaf tokens: operator = SyntaxKind of keyword/punctuation; operand = identifier/private identifier/string/number/template/regexp text. Comments/trivia excluded. Nested functions excluded. D=(unique operators/2)*(total operands/unique operands). Type and JSX tokens included.',
	types:
		'TypeScript checker on changed lines and complete changed functions in value declarations/expressions; root any and any in unions/intersections/type arguments fail. Explicit any fails. External any captured immediately as explicit unknown or unknown[] is an input boundary requiring review. Unknown declarations/annotations require review. Type syntax, import specifiers and JSX tag names are not value expressions; library declarations excluded.',
}

type FunctionNode =
	| ts.FunctionDeclaration
	| ts.FunctionExpression
	| ts.ArrowFunction
	| ts.MethodDeclaration
	| ts.ConstructorDeclaration
	| ts.GetAccessorDeclaration
	| ts.SetAccessorDeclaration

interface FunctionMetric {
	name: string
	line: number
	endLine: number
	start: number
	end: number
	cyclomatic: number
	cognitive: number
	difficulty: number
	operators: { unique: number; total: number }
	operands: { unique: number; total: number }
}

function isFunction(node: ts.Node): node is FunctionNode {
	return (
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isArrowFunction(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isConstructorDeclaration(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isSetAccessorDeclaration(node)
	)
}

function localName(node: FunctionNode, source: ts.SourceFile): string {
	if (node.name) return node.name.getText(source)
	const parent = node.parent
	if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) return parent.name.getText(source)
	if (ts.isCallExpression(parent)) {
		const callee = parent.expression
		const name = ts.isIdentifier(callee)
			? callee.text
			: ts.isPropertyAccessExpression(callee)
				? callee.name.text
				: ts.SyntaxKind[callee.kind]
		return `${name} callback ${parent.arguments.indexOf(node as ts.Expression) + 1}`
	}
	return ts.isConstructorDeclaration(node) ? 'constructor' : 'callback'
}

function functionName(node: FunctionNode, source: ts.SourceFile): string {
	const name = localName(node, source)
	let parent = node.parent
	while (parent) {
		if (isFunction(parent)) return `${functionName(parent, source)}.${name}`
		parent = parent.parent
	}
	return name
}

function logical(node: ts.Node): ts.SyntaxKind | null {
	if (!ts.isBinaryExpression(node)) return null
	const kind = node.operatorToken.kind
	return kind === ts.SyntaxKind.AmpersandAmpersandToken ||
		kind === ts.SyntaxKind.BarBarToken ||
		kind === ts.SyntaxKind.QuestionQuestionToken ||
		kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
		kind === ts.SyntaxKind.BarBarEqualsToken ||
		kind === ts.SyntaxKind.QuestionQuestionEqualsToken
		? kind
		: null
}

function isLoop(node: ts.Node): boolean {
	return (
		ts.isForStatement(node) ||
		ts.isForInStatement(node) ||
		ts.isForOfStatement(node) ||
		ts.isWhileStatement(node) ||
		ts.isDoStatement(node)
	)
}

function cyclomatic(node: FunctionNode): number {
	let count = 1
	function visit(child: ts.Node) {
		if (child !== node && isFunction(child)) return
		if (
			ts.isIfStatement(child) ||
			isLoop(child) ||
			ts.isCaseClause(child) ||
			ts.isCatchClause(child) ||
			ts.isConditionalExpression(child) ||
			logical(child) !== null
		)
			count++
		if ((ts.isParameter(child) || ts.isBindingElement(child)) && child.initializer) count++
		if (
			(ts.isPropertyAccessExpression(child) || ts.isElementAccessExpression(child) || ts.isCallExpression(child)) &&
			child.questionDotToken
		)
			count++
		ts.forEachChild(child, visit)
	}
	visit(node)
	return count
}

function cognitive(node: FunctionNode): number {
	let count = 0
	function visit(child: ts.Node, nesting: number) {
		if (child !== node && isFunction(child)) return
		if (ts.isIfStatement(child)) {
			const chained = ts.isIfStatement(child.parent) && child.parent.elseStatement === child
			count += chained ? 1 : 1 + nesting
			visit(child.expression, nesting)
			visit(child.thenStatement, nesting + 1)
			if (child.elseStatement) {
				if (!ts.isIfStatement(child.elseStatement)) count++
				visit(child.elseStatement, ts.isIfStatement(child.elseStatement) ? nesting : nesting + 1)
			}
			return
		}
		const nested =
			isLoop(child) || ts.isSwitchStatement(child) || ts.isCatchClause(child) || ts.isConditionalExpression(child)
		if (nested) count += 1 + nesting
		const operator = logical(child)
		if (operator !== null && logical(child.parent) !== operator) count++
		if ((ts.isBreakStatement(child) || ts.isContinueStatement(child)) && child.label) count++
		ts.forEachChild(child, (descendant) => visit(descendant, nesting + Number(nested)))
	}
	visit(node, 0)
	return count
}

function halstead(node: FunctionNode, source: ts.SourceFile) {
	const operators = new Set<ts.SyntaxKind>()
	const operands = new Set<string>()
	let totalOperators = 0
	let totalOperands = 0
	function visit(child: ts.Node) {
		if (child !== node && isFunction(child)) return
		const children = child.getChildren(source)
		if (children.length > 0) {
			children.forEach(visit)
			return
		}
		if (child.kind === ts.SyntaxKind.EndOfFileToken || child.kind === ts.SyntaxKind.SyntaxList) return
		if (ts.isJsxText(child) && child.getText(source).trim() === '') return
		if (
			ts.isIdentifier(child) ||
			ts.isPrivateIdentifier(child) ||
			ts.isLiteralExpression(child) ||
			ts.isTemplateHead(child) ||
			ts.isTemplateMiddle(child) ||
			ts.isTemplateTail(child) ||
			ts.isJsxText(child) ||
			child.kind === ts.SyntaxKind.TrueKeyword ||
			child.kind === ts.SyntaxKind.FalseKeyword ||
			child.kind === ts.SyntaxKind.NullKeyword
		) {
			operands.add(child.getText(source))
			totalOperands++
		} else {
			operators.add(child.kind)
			totalOperators++
		}
	}
	visit(node)
	return {
		difficulty: operands.size === 0 ? 0 : (operators.size / 2) * (totalOperands / operands.size),
		operators: { unique: operators.size, total: totalOperators },
		operands: { unique: operands.size, total: totalOperands },
	}
}

export function measureSource(path: string, text: string) {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
	const functions: FunctionMetric[] = []
	function visit(node: ts.Node) {
		if (isFunction(node) && node.body)
			functions.push({
				name: functionName(node, source),
				line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
				endLine: source.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
				start: node.getStart(source),
				end: node.getEnd(),
				cyclomatic: cyclomatic(node),
				cognitive: cognitive(node),
				...halstead(node, source),
			})
		ts.forEachChild(node, visit)
	}
	visit(source)
	return { lines: text.length === 0 ? 0 : text.split('\n').length - Number(text.endsWith('\n')), functions }
}

export function changedLines(before: string, after: string): Set<number> {
	const oldLines = before.split('\n')
	const newLines = after.split('\n')
	const lengths = Array.from({ length: oldLines.length + 1 }, () => new Uint32Array(newLines.length + 1))
	for (let i = oldLines.length - 1; i >= 0; i--) {
		for (let j = newLines.length - 1; j >= 0; j--) {
			lengths[i][j] =
				oldLines[i] === newLines[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1])
		}
	}
	const changed = new Set<number>()
	let i = 0
	let j = 0
	while (j < newLines.length) {
		if (i < oldLines.length && oldLines[i] === newLines[j]) {
			i++
			j++
		} else if (i < oldLines.length && lengths[i + 1][j] >= lengths[i][j + 1]) i++
		else changed.add(++j)
	}
	return changed
}

function containsAny(type: ts.Type, checker: ts.TypeChecker, seen = new Set<ts.Type>()): boolean {
	if (seen.has(type)) return false
	seen.add(type)
	if (type.flags & ts.TypeFlags.Any) return true
	if (type.isUnionOrIntersection()) return type.types.some((part) => containsAny(part, checker, seen))
	if (type.flags & ts.TypeFlags.Object) {
		const object = type as ts.ObjectType
		if (object.objectFlags & ts.ObjectFlags.Reference)
			return checker.getTypeArguments(object as ts.TypeReference).some((part) => containsAny(part, checker, seen))
	}
	return false
}

function valueNode(node: ts.Node): boolean {
	if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node))
		return ts.isIdentifier(node.name)
	if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) return true
	if (!ts.isExpression(node)) return false
	const parent = node.parent
	if (ts.isStringLiteral(node) && ts.isJsxAttribute(parent)) return false
	if (
		ts.isTypeNode(parent) ||
		ts.isQualifiedName(parent) ||
		ts.isImportDeclaration(parent) ||
		ts.isExportDeclaration(parent)
	)
		return false
	if ('name' in parent && parent.name === node) return false
	if (ts.isJsxOpeningElement(parent) || ts.isJsxClosingElement(parent) || ts.isJsxSelfClosingElement(parent))
		return false
	return true
}

function unknownBoundary(node: ts.Node): boolean {
	let parent = node.parent
	while (ts.isAwaitExpression(parent)) parent = parent.parent
	if (!ts.isVariableDeclaration(parent) && !ts.isAsExpression(parent)) return false
	const type = parent.type
	return (
		type?.kind === ts.SyntaxKind.UnknownKeyword ||
		(type !== undefined && ts.isArrayTypeNode(type) && type.elementType.kind === ts.SyntaxKind.UnknownKeyword)
	)
}

export function inspectTypes(program: ts.Program, path: string, lines: Set<number>) {
	const source = program.getSourceFile(path)
	if (!source) throw new Error(`TypeScript source unavailable: ${path}`)
	const checker = program.getTypeChecker()
	const findings: { line: number; kind: 'any' | 'unknown'; node: string }[] = []
	const seen = new Set<string>()
	function record(node: ts.Node, line: number, kind: 'any' | 'unknown') {
		const key = `${line}:${kind}`
		if (seen.has(key)) return
		seen.add(key)
		findings.push({ line, kind, node: ts.SyntaxKind[node.kind] })
	}
	function visit(node: ts.Node) {
		const line = source!.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
		if (lines.has(line)) {
			if (node.kind === ts.SyntaxKind.AnyKeyword) record(node, line, 'any')
			else if (node.kind === ts.SyntaxKind.UnknownKeyword) record(node, line, 'unknown')
			else if (valueNode(node)) {
				const type = checker.getTypeAtLocation(node)
				if (containsAny(type, checker)) record(node, line, unknownBoundary(node) ? 'unknown' : 'any')
				else if (type.flags & ts.TypeFlags.Unknown && !ts.isExpression(node)) record(node, line, 'unknown')
			}
		}
		ts.forEachChild(node, visit)
	}
	visit(source)
	return findings
}
