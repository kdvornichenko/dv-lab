export function toCents(text: string, roundUp: boolean): bigint {
	const [whole = '0', fraction = ''] = text.split('.')
	const rest = fraction.slice(2).replace(/0/g, '')
	return BigInt(whole) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, '0')) + (roundUp && rest !== '' ? 1n : 0n)
}

export function dollars(cents: bigint, short = false): string {
	const whole = cents / 100n
	const part = cents % 100n
	if (short && part === 0n) return `$${whole}`
	return `$${whole}.${part.toString().padStart(2, '0')}`
}
