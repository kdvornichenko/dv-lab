'use client'

import { useEffect, useState, type CSSProperties } from 'react'

import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import type { IconComponentProps } from '@/lib/icon-context'

import type { CalendarEventColor, GoogleEventPalette } from '@dv-lab/contracts'

import { PALETTE_KEY, keepCache, peekCache, readPalette } from './schedule-prefetch'

export const COLOR_DEFAULT = 'default'
export const COLOR_CUSTOM = 'custom'

const COLOR_NAMES: Record<string, string> = {
	'1': 'Lavender',
	'2': 'Sage',
	'3': 'Grape',
	'4': 'Flamingo',
	'5': 'Banana',
	'6': 'Tangerine',
	'7': 'Peacock',
	'8': 'Graphite',
	'9': 'Blueberry',
	'10': 'Basil',
	'11': 'Tomato',
}

export type PaletteState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; palette: GoogleEventPalette }

export function useEventPalette(): PaletteState {
	const [state, setState] = useState<PaletteState>(() => {
		const known = peekCache<GoogleEventPalette>(PALETTE_KEY)
		return known === undefined ? { kind: 'loading' } : { kind: 'ready', palette: known }
	})
	useEffect(() => {
		const abort = new AbortController()
		void readPalette(abort.signal).then((palette) => {
			if (abort.signal.aborted) return
			if (palette !== null) keepCache(PALETTE_KEY, palette)
			setState((previous) =>
				palette !== null ? { kind: 'ready', palette } : previous.kind === 'ready' ? previous : { kind: 'error' }
			)
		})
		return () => abort.abort()
	}, [])
	return state
}

export function colorValueOf(color: CalendarEventColor): string {
	if (color.id === null) return COLOR_DEFAULT
	return color.custom ? COLOR_CUSTOM : color.id
}

export function colorIdOf(value: string): string | null {
	return value === COLOR_DEFAULT || value === COLOR_CUSTOM ? null : value
}

export function colorName(id: string): string {
	return COLOR_NAMES[id] ?? `Color ${id}`
}

function Swatch({ className }: IconComponentProps) {
	return (
		<span
			aria-hidden
			className={`size-3 shrink-0 rounded-full bg-(--swatch) ring-1 ring-foreground/10 ring-inset ${className ?? ''}`}
		/>
	)
}

function swatchStyle(hex: string | null): CSSProperties {
	return { '--swatch': hex ?? 'var(--selected)' } as CSSProperties
}

interface ColorSelectProps {
	id: string
	value: string
	onValueChange: (value: string) => void
	palette: PaletteState
	custom: { background: string | null } | null
	disabled?: boolean
}

export function ColorSelect({ id, value, onValueChange, palette, custom, disabled }: ColorSelectProps) {
	const colors = palette.kind === 'ready' ? palette.palette.colors : []
	const calendar = palette.kind === 'ready' ? palette.palette.calendarColor : null
	const showCustom = custom !== null && value === COLOR_CUSTOM
	const chosen = colors.find((color) => color.id === value)
	const triggerColor =
		value === COLOR_DEFAULT
			? calendar
			: value === COLOR_CUSTOM
				? (custom?.background ?? calendar)
				: (chosen?.background ?? null)
	const rows = [
		...(showCustom ? [{ value: COLOR_CUSTOM, name: 'Custom', hex: custom?.background ?? calendar }] : []),
		{ value: COLOR_DEFAULT, name: 'Default', hex: calendar },
		...colors.map((color) => ({ value: color.id, name: colorName(color.id), hex: color.background })),
	]
	return (
		<Select value={value} onValueChange={onValueChange} disabled={disabled || palette.kind === 'loading'}>
			<SelectTrigger
				id={id}
				icon={Swatch}
				style={swatchStyle(triggerColor)}
				className="w-full min-w-0 pointer-coarse:text-[16px]"
				placeholder={palette.kind === 'loading' ? 'Loading colors…' : 'Default'}
			/>
			<SelectContent>
				{rows.map((row, index) => (
					<SelectItem key={row.value} index={index} value={row.value} icon={Swatch} style={swatchStyle(row.hex)}>
						{row.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
