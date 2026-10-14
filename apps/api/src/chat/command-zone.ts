import { isTimeZone, timeZoneIdentity } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

export type CommandZone =
	{ kind: 'ok'; zone: string; named: boolean } | { kind: 'refused'; code: 'zone_unknown' | 'zone_not_in_message' }

const MOSCOW = 'Europe/Moscow'

const SHORT_NAMES: ReadonlyMap<string, string> = new Map([
	...[
		'msk',
		'мск',
		'moscow',
		'moscow time',
		'москва',
		'москвы',
		'москве',
		'москву',
		'по москве',
		'московское время',
		'московскому времени',
		'по московскому времени',
		'по мск',
	].map((name) => [name, MOSCOW] as const),
	...[
		'vn',
		'vietnam',
		'viet nam',
		'vietnam time',
		'вьетнам',
		'вьетнама',
		'вьетнаму',
		'вьетнаме',
		'по вьетнаму',
		'вьетнамское время',
		'вьетнамскому времени',
		'по вьетнамскому времени',
	].map((name) => [name, SCHEDULE_TIME_ZONE] as const),
])

function fold(value: string): string {
	return value.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase()
}

function wordIn(text: string, piece: string): boolean {
	const pattern = piece.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
	return new RegExp(`(?<![\\p{L}\\p{Nd}])${pattern}(?![\\p{L}\\p{Nd}])`, 'u').test(text)
}

function exactZone(value: string): string | null {
	if (isTimeZone(value)) return value
	const identity = timeZoneIdentity(value)
	return identity !== null && isTimeZone(identity) ? identity : null
}

export function resolveCommandZone(zoneText: string | null, teacherText: string): CommandZone {
	if (zoneText === null) return { kind: 'ok', zone: SCHEDULE_TIME_ZONE, named: false }
	const piece = fold(zoneText)
	if (piece === '') return { kind: 'refused', code: 'zone_unknown' }
	if (!wordIn(fold(teacherText), piece)) return { kind: 'refused', code: 'zone_not_in_message' }
	const short = SHORT_NAMES.get(piece)
	if (short !== undefined) return { kind: 'ok', zone: short, named: true }
	const zone = exactZone(zoneText.normalize('NFC').trim())
	return zone === null ? { kind: 'refused', code: 'zone_unknown' } : { kind: 'ok', zone, named: true }
}
