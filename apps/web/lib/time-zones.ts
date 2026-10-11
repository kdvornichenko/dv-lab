import { isTimeZone, timeZoneIdentity } from '@dv-lab/contracts'

export const MODERN_TIME_ZONES = [
	'Asia/Ho_Chi_Minh',
	'Asia/Kolkata',
	'Asia/Kathmandu',
	'Asia/Yangon',
	'Europe/Kyiv',
	'America/Argentina/Buenos_Aires',
	'Atlantic/Faroe',
]

type Abbreviations = readonly [string] | readonly [string, string]

const CENTRAL_EUROPE: Abbreviations = ['CET', 'CEST']
const EASTERN_EUROPE: Abbreviations = ['EET', 'EEST']

const ABBREVIATIONS: Record<string, Abbreviations> = {
	'Europe/London': ['GMT', 'BST'],
	'Europe/Berlin': CENTRAL_EUROPE,
	'Europe/Paris': CENTRAL_EUROPE,
	'Europe/Rome': CENTRAL_EUROPE,
	'Europe/Madrid': CENTRAL_EUROPE,
	'Europe/Amsterdam': CENTRAL_EUROPE,
	'Europe/Warsaw': CENTRAL_EUROPE,
	'Europe/Kyiv': EASTERN_EUROPE,
	'Europe/Kiev': EASTERN_EUROPE,
	'Europe/Athens': EASTERN_EUROPE,
	'Europe/Helsinki': EASTERN_EUROPE,
	'Europe/Bucharest': EASTERN_EUROPE,
	'Europe/Kaliningrad': EASTERN_EUROPE,
	'Europe/Istanbul': ['TRT'],
	'Europe/Moscow': ['MSK'],
	'Europe/Minsk': ['MSK'],
	'Europe/Samara': ['SAMT'],
	'Asia/Yekaterinburg': ['YEKT'],
	'Asia/Omsk': ['OMST'],
	'Asia/Novosibirsk': ['NOVT'],
	'Asia/Krasnoyarsk': ['KRAT'],
	'Asia/Irkutsk': ['IRKT'],
	'Asia/Yakutsk': ['YAKT'],
	'Asia/Vladivostok': ['VLAT'],
	'Asia/Magadan': ['MAGT'],
	'Asia/Kamchatka': ['PETT'],
	'Asia/Almaty': ['ALMT'],
	'Asia/Tashkent': ['UZT'],
	'Asia/Tbilisi': ['GET'],
	'Asia/Yerevan': ['AMT'],
	'Asia/Baku': ['AZT'],
	'Asia/Dubai': ['GST'],
	'Asia/Kolkata': ['IST'],
	'Asia/Calcutta': ['IST'],
	'Asia/Bangkok': ['ICT'],
	'Asia/Jakarta': ['WIB'],
	'Asia/Singapore': ['SGT'],
	'Asia/Hong_Kong': ['HKT'],
	'Asia/Shanghai': ['CST'],
	'Asia/Tokyo': ['JST'],
	'Asia/Seoul': ['KST'],
	'America/New_York': ['EST', 'EDT'],
	'America/Chicago': ['CST', 'CDT'],
	'America/Denver': ['MST', 'MDT'],
	'America/Los_Angeles': ['PST', 'PDT'],
	'America/Moncton': ['AST', 'ADT'],
	'Australia/Sydney': ['AEST', 'AEDT'],
	'Pacific/Auckland': ['NZST', 'NZDT'],
}

const LABEL_LENGTH = 4

function isVietnamZone(zone: string): boolean {
	return sameTimeZone(zone, 'Asia/Ho_Chi_Minh')
}

export function sameTimeZone(left: string, right: string): boolean {
	const identity = timeZoneIdentity(left)
	return identity !== null && identity === timeZoneIdentity(right)
}

export function zoneName(zone: string): string {
	if (isVietnamZone(zone)) return 'Vietnam'
	const identity = timeZoneIdentity(zone) ?? zone
	return (identity.split('/').pop() ?? identity).replace(/_/g, ' ')
}

const offsetFormats = new Map<string, Intl.DateTimeFormat>()

function offsetMinutes(zone: string, at: Date): number | undefined {
	try {
		let format = offsetFormats.get(zone)
		if (format === undefined) {
			format = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
			offsetFormats.set(zone, format)
		}
		const name = format.formatToParts(at).find((part) => part.type === 'timeZoneName')?.value
		if (name === undefined) return undefined
		if (name === 'GMT') return 0
		const match = /^GMT([+−-])(\d{1,2})(?::(\d{2}))?$/.exec(name)
		if (match === null) return undefined
		const total = Number(match[2]) * 60 + Number(match[3] ?? 0)
		return match[1] === '+' ? total : -total
	} catch {
		return undefined
	}
}

function cityLabel(zone: string): string {
	const city = (zone.split('/').pop() ?? zone).replace(/[^A-Za-z]/g, '')
	return (city === '' ? zone : city).slice(0, LABEL_LENGTH).toUpperCase()
}

export function offsetLabel(zone: string, at: Date): string {
	const minutes = offsetMinutes(zone, at)
	if (minutes === undefined) return zoneLabel(zone, at)
	const absolute = Math.abs(minutes)
	const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
	const remainder = String(absolute % 60).padStart(2, '0')
	return `UTC${minutes < 0 ? '-' : '+'}${hours}:${remainder}`
}

function summerTime(zone: string, at: Date): boolean {
	const current = offsetMinutes(zone, at)
	const year = at.getUTCFullYear()
	const january = offsetMinutes(zone, new Date(Date.UTC(year, 0, 1)))
	const july = offsetMinutes(zone, new Date(Date.UTC(year, 6, 1)))
	if (current === undefined || january === undefined || july === undefined) return false
	return current > Math.min(january, july)
}

export function zoneLabel(zone: string, at: Date): string {
	if (isVietnamZone(zone)) return 'VN'
	const known = ABBREVIATIONS[zone] ?? ABBREVIATIONS[timeZoneIdentity(zone) ?? zone]
	if (known === undefined) return cityLabel(zone)
	if (known.length === 1) return known[0]
	return summerTime(zone, at) ? known[1] : known[0]
}

function labelVariants(zone: string): readonly string[] {
	if (isVietnamZone(zone)) return ['VN']
	return ABBREVIATIONS[zone] ?? ABBREVIATIONS[timeZoneIdentity(zone) ?? zone] ?? [cityLabel(zone)]
}

export function listTimeZones(extra: readonly string[] = []): string[] {
	const listed = Intl.supportedValuesOf('timeZone')
	const added = [...MODERN_TIME_ZONES, ...extra].filter((zone) => !listed.includes(zone) && isTimeZone(zone))
	return Array.from(new Set([...listed, ...added])).sort()
}

function offsetQuery(text: string): { minutes: number; exact: boolean } | null {
	const compact = text.replace(/\s/g, '')
	const match = /^(?:utc|gmt)?([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(compact)
	if (match === null) return null
	const sign = match[1] === '-' ? -1 : 1
	const hours = Number(match[2])
	if (match[3] === undefined) return { minutes: sign * hours, exact: false }
	return { minutes: sign * (hours * 60 + Number(match[3])), exact: true }
}

export function zoneMatches(zone: string, query: string, at: Date): boolean {
	const text = query.trim().toLowerCase()
	if (text === '') return true
	const id = zone.toLowerCase()
	if (id.includes(text) || id.replace(/_/g, ' ').includes(text)) return true
	if (labelVariants(zone).some((label) => label.toLowerCase().includes(text))) return true
	const wanted = offsetQuery(text)
	if (wanted === null) return false
	const actual = offsetMinutes(zone, at)
	if (actual === undefined) return false
	return wanted.exact ? actual === wanted.minutes : Math.trunc(actual / 60) === wanted.minutes
}
