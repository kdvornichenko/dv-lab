const CAUSE_DEPTH = 5
const POSTGRES_CODE = /^[0-9A-Z]{5}$/

type ErrorLink = Error & { code?: unknown; constraint?: unknown }

function causeChain(error: unknown): ErrorLink[] {
	const links: ErrorLink[] = []
	let current: unknown = error
	for (let depth = 0; depth < CAUSE_DEPTH && current instanceof Error; depth += 1) {
		links.push(current)
		current = current.cause
	}
	return links
}

export function violatesUnique(error: unknown, constraint: string): boolean {
	return causeChain(error).some((link) => link.code === '23505' && link.constraint === constraint)
}

export function postgresCode(error: unknown): string | null {
	for (const link of causeChain(error)) {
		if (typeof link.code === 'string' && POSTGRES_CODE.test(link.code)) return link.code
	}
	return null
}

export function postgresErrorFields(error: unknown): { code?: string; constraint?: string } {
	for (const link of causeChain(error)) {
		if (typeof link.code !== 'string') continue
		return typeof link.constraint === 'string' ? { code: link.code, constraint: link.constraint } : { code: link.code }
	}
	return {}
}
