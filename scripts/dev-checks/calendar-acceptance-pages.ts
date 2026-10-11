import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

import {
	fingerprint,
	ORIGIN,
	PAGE_PATHS,
	pagesRecord,
	requireEvidence,
	time,
	type PagesInput,
} from './calendar-acceptance-records.ts'

export const REQUEST_TIMEOUT_MS = 10000
const entities = new Map([
	['&amp;', '&'],
	['&quot;', '"'],
	['&apos;', "'"],
	['&lt;', '<'],
	['&gt;', '>'],
	['&nbsp;', ' '],
])

function text(value: string): string {
	return value
		.replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g, (match: string) => entities.get(match) ?? match)
		.replace(/&#(?:x[\da-f]+|\d+);/gi, (match: string) => {
			const digits = match.slice(2, -1)
			const value = digits[0].toLowerCase() === 'x' ? Number.parseInt(digits.slice(1), 16) : Number.parseInt(digits, 10)
			return String.fromCodePoint(value)
		})
		.replace(/\s+/g, ' ')
		.trim()
}

function approvedCopy(sourceText: string, path: string): string[] {
	const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
	const fragments: string[] = []
	function visit(node: ts.Node) {
		validateCopySyntax(node, source)
		if (ts.isJsxText(node)) fragments.push(text(node.text))
		if (
			ts.isPropertyAssignment(node) &&
			['title', 'body'].includes(node.name.getText(source)) &&
			ts.isStringLiteral(node.initializer)
		)
			fragments.push(text(node.initializer.text))
		if (
			ts.isJsxAttribute(node) &&
			['title', 'description'].includes(node.name.getText(source)) &&
			node.initializer &&
			ts.isStringLiteral(node.initializer)
		)
			fragments.push(text(node.initializer.text))
		ts.forEachChild(node, visit)
	}
	visit(source)
	const result = [...new Set(fragments.filter(Boolean))]
	requireEvidence(result.length > 0, 'approved_public_copy_unavailable')
	return result
}

function validateCopySyntax(node: ts.Node, source: ts.SourceFile) {
	if (ts.isPropertyAssignment(node) && ['title', 'body'].includes(node.name.getText(source)))
		requireEvidence(ts.isStringLiteral(node.initializer), 'unsupported_dynamic_public_copy')
	if (ts.isJsxAttribute(node) && ['title', 'description'].includes(node.name.getText(source)))
		requireEvidence(
			node.initializer !== undefined && ts.isStringLiteral(node.initializer),
			'unsupported_dynamic_public_heading'
		)
	if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
		const tag = node.tagName.getText(source)
		requireEvidence(
			!/^[A-Z]/.test(tag) || ['Link', 'PageHeader', 'Button'].includes(tag),
			'unsupported_public_copy_component'
		)
	}
	if (!ts.isJsxExpression(node) || !node.expression) return
	const expression = node.expression
	const supported =
		ts.isStringLiteral(expression) ||
		(ts.isIdentifier(expression) && ['title', 'body'].includes(expression.text)) ||
		(ts.isCallExpression(expression) && expression.expression.getText(source) === 'sections.map')
	requireEvidence(supported, 'unsupported_dynamic_public_content')
}

function visibleMarkup(body: string): string {
	return body.replace(/<!--[^]*?-->/g, '').replace(/<(script|style|template|noscript)\b[^>]*>[^]*?<\/\1\s*>/gi, '')
}

function links(markup: string, tag: 'nav' | 'footer', paths: readonly string[]) {
	const region = markup.match(new RegExp(`<${tag}\\b[^>]*>([^]*?)</${tag}\\s*>`, 'i'))?.[1]
	requireEvidence(region !== undefined, 'public_navigation_missing')
	const hrefs = [...region.matchAll(/<a\b[^>]*\bhref=(?:"([^"]*)"|'([^']*)')[^>]*>/gi)].map(
		(match) => match[1] ?? match[2]
	)
	for (const path of paths)
		requireEvidence(hrefs.includes(path) || hrefs.includes(`${ORIGIN}${path}`), 'public_navigation_mismatch')
}

async function page(path: (typeof PAGE_PATHS)[number], expected: string[]) {
	const url = `${ORIGIN}${path}`
	const response = await fetch(url, {
		method: 'GET',
		credentials: 'omit',
		redirect: 'error',
		headers: { accept: 'text/html' },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	})
	requireEvidence(
		response.status === 200 && response.url === url && !response.redirected,
		'public_page_status_or_url_invalid'
	)
	requireEvidence(/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') ?? ''), 'public_page_not_html')
	const body = await response.text()
	const markup = visibleMarkup(body)
	const rendered = text(markup.replace(/<[^>]*>/g, ' '))
	requireEvidence(
		expected.every((fragment) => rendered.includes(fragment)),
		'public_copy_mismatch'
	)
	links(markup, 'nav', ['/welcome', '/login'])
	links(markup, 'footer', PAGE_PATHS)
	return {
		path,
		finalUrl: url,
		status: 200,
		contentType: 'text/html',
		bodySha256: fingerprint(body),
		copyVerified: true,
		navigationVerified: true,
	}
}

export async function checkPages(input: PagesInput, root: string, verifierSha256: string) {
	requireEvidence(time(input.release.source.capturedAt) <= Date.now(), 'release_source_in_future')
	const copies = PAGE_PATHS.map((path) => {
		const sourcePath = `apps/web/app${path}/page.tsx`
		const source = readFileSync(resolve(root, sourcePath), 'utf8')
		const name = path.slice(1) as keyof PagesInput['copySources']
		requireEvidence(fingerprint(source) === input.copySources[name], 'approved_copy_source_fingerprint_mismatch')
		return { path, expected: approvedCopy(source, sourcePath) }
	})
	const pages: Awaited<ReturnType<typeof page>>[] = []
	for (const copy of copies) pages.push(await page(copy.path, copy.expected))
	const checkedAt = new Date().toISOString()
	return pagesRecord.parse({
		version: 1,
		kind: 'pages',
		origin: ORIGIN,
		release: input.release,
		copySources: input.copySources,
		pages,
		checkedAt,
		verifierSha256,
		source: {
			kind: 'public-http',
			observerSha256: verifierSha256,
			observerCodeSha256: verifierSha256,
			artifactSha256: fingerprint(JSON.stringify(pages.map((item) => [item.path, item.bodySha256]))),
			capturedAt: checkedAt,
			clock: 'system-utc',
		},
	})
}
