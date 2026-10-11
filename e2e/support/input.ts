export function record(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		throw new Error('Invalid object at input boundary')
	return value as Record<string, unknown>
}

export function list(value: unknown): unknown[] {
	if (!Array.isArray(value)) throw new Error('Invalid array at input boundary')
	return value as unknown[]
}

export function text(value: unknown): string {
	if (typeof value !== 'string') throw new Error('Invalid text at input boundary')
	return value
}

export function integer(value: unknown): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error('Invalid integer at input boundary')
	return value
}

export function flag(value: unknown): boolean {
	if (typeof value !== 'boolean') throw new Error('Invalid flag at input boundary')
	return value
}

export function uuid(value: unknown): string {
	const id = text(value)
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
		throw new Error('Invalid UUID at input boundary')
	return id
}
