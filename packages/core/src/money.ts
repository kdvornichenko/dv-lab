const spaces = /[\s   ]/g

export function currencyDigits(currency: string | null): number {
	if (currency === null) return 2
	return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
}

export function parseMoney(text: string, currency: string | null): number | null {
	const digits = currencyDigits(currency)
	const match = /^(\d+)(?:[.,](\d+))?$/.exec(text.replace(spaces, ''))
	if (!match) return null
	const whole = match[1]
	const fraction = match[2] ?? ''
	if (fraction.length > digits) return null
	const minor = Number(whole + fraction.padEnd(digits, '0'))
	if (!Number.isSafeInteger(minor) || minor <= 0) return null
	return minor
}

export function formatMoney(amountMinor: number, currency: string | null): string {
	const digits = currencyDigits(currency)
	const value = amountMinor / 10 ** digits
	if (currency === null) {
		return new Intl.NumberFormat('en-US', {
			minimumFractionDigits: digits,
			maximumFractionDigits: digits,
			trailingZeroDisplay: 'stripIfInteger',
		}).format(value)
	}
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
		currencyDisplay: 'narrowSymbol',
		minimumFractionDigits: digits,
		trailingZeroDisplay: 'stripIfInteger',
	}).format(value)
}

export function minorToInput(amountMinor: number, currency: string | null): string {
	const digits = currencyDigits(currency)
	const sign = amountMinor < 0 ? '-' : ''
	const text = String(Math.abs(amountMinor)).padStart(digits + 1, '0')
	const whole = text.slice(0, text.length - digits)
	const fraction = text.slice(text.length - digits).replace(/0+$/, '')
	return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`
}

export function currencySymbol(currency: string): string {
	const parts = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
		currencyDisplay: 'narrowSymbol',
	}).formatToParts(0)
	return parts.find((part) => part.type === 'currency')?.value ?? currency
}
