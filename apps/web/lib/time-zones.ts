import type { ComboboxItemData } from '@/components/ui/combobox'

import { isTimeZone } from '@dv-lab/contracts'

export const MODERN_TIME_ZONES = [
	'Asia/Ho_Chi_Minh',
	'Asia/Kolkata',
	'Asia/Kathmandu',
	'Asia/Yangon',
	'Europe/Kyiv',
	'America/Argentina/Buenos_Aires',
	'Atlantic/Faroe',
]

const VIETNAM_ZONES = ['Asia/Ho_Chi_Minh', 'Asia/Saigon']

export function isVietnamZone(zone: string): boolean {
	return VIETNAM_ZONES.includes(zone)
}

export function utcOffset(zone: string, at: Date): string | undefined {
	try {
		const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
			.formatToParts(at)
			.find((part) => part.type === 'timeZoneName')?.value
		return name?.replace(/^GMT/, 'UTC').replace(/^UTC[+-]0$/, 'UTC')
	} catch {
		return undefined
	}
}

export function listTimeZones(extra: readonly string[] = []): string[] {
	const listed = Intl.supportedValuesOf('timeZone')
	const added = [...MODERN_TIME_ZONES, ...extra].filter((zone) => !listed.includes(zone) && isTimeZone(zone))
	return Array.from(new Set([...listed, ...added])).sort()
}

function offsetQuery(query: string): string {
	const compact = query.replace(/\s/g, '').replace(/^gmt/, 'utc')
	return (/^[+-]/.test(compact) ? `utc${compact}` : compact).replace(/^utc[+-]0$/, 'utc')
}

export function matchesTimeZone(item: ComboboxItemData, query: string): boolean {
	const text = query.trim().toLowerCase()
	if (text === '') return true
	if (typeof item === 'string') return item.toLowerCase().includes(text)
	const name = item.label.toLowerCase()
	if (name.includes(text) || name.replace(/_/g, ' ').includes(text)) return true
	const detail = item.detail?.toLowerCase()
	if (!detail) return false
	const offset = offsetQuery(text)
	return detail === offset || detail.startsWith(`${offset}:`)
}

export function zoneCaption(zone: string, at: Date, form: 'toolbar' | 'gutter'): string {
	if (isVietnamZone(zone)) return 'VN'
	if (zone === 'Europe/Moscow') return 'MSK'
	const offset = utcOffset(zone, at) ?? zone
	return form === 'toolbar' ? offset : offset.replace(/^UTC(?=[+-])/, '')
}
