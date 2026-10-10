'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'

import { ChevronDown, Globe, Search, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Combobox, ComboboxContent, ComboboxItem, ComboboxList, type ComboboxItemData } from '@/components/ui/combobox'
import type { IconComponent } from '@/lib/icon-context'
import { isVietnamZone, listTimeZones, zoneLabel, zoneMatches } from '@/lib/time-zones'
import { cn } from '@/lib/utils'

import { isTimeZone } from '@dv-lab/contracts'

const SECOND_ZONE_KEY = 'dv-lab.schedule.second-zone'
const FAVORITES_KEY = 'dv-lab.time-zones.favorites'
const DEFAULT_SECOND_ZONE = 'Europe/Moscow'
const DEFAULT_FAVORITES: readonly string[] = ['Europe/Moscow', 'Asia/Almaty']
const NONE = 'none'
const CHANGE_EVENT = 'dv-lab:time-zones'

function subscribe(callback: () => void) {
	window.addEventListener('storage', callback)
	window.addEventListener(CHANGE_EVENT, callback)
	return () => {
		window.removeEventListener('storage', callback)
		window.removeEventListener(CHANGE_EVENT, callback)
	}
}

function readItem(key: string): string | null {
	try {
		return localStorage.getItem(key)
	} catch {
		return null
	}
}

function writeItem(key: string, value: string) {
	try {
		localStorage.setItem(key, value)
	} catch {}
	window.dispatchEvent(new Event(CHANGE_EVENT))
}

function normalizeSecond(raw: string | null): string {
	if (raw === NONE) return NONE
	if (raw === null || isVietnamZone(raw) || !isTimeZone(raw)) return DEFAULT_SECOND_ZONE
	return raw
}

export function useSecondZone(): [string | null, (zone: string | null) => void] {
	const stored = useSyncExternalStore(
		subscribe,
		() => normalizeSecond(readItem(SECOND_ZONE_KEY)),
		() => DEFAULT_SECOND_ZONE
	)
	const set = useCallback((zone: string | null) => writeItem(SECOND_ZONE_KEY, zone ?? NONE), [])
	return [stored === NONE ? null : stored, set]
}

function parseFavorites(raw: string | null): readonly string[] {
	if (raw === null) return DEFAULT_FAVORITES
	try {
		const parsed: unknown = JSON.parse(raw)
		if (!Array.isArray(parsed)) return DEFAULT_FAVORITES
		const zones = parsed.filter((item): item is string => typeof item === 'string')
		if (zones.length !== parsed.length || !zones.every(isTimeZone)) return DEFAULT_FAVORITES
		return Array.from(new Set(zones))
	} catch {
		return DEFAULT_FAVORITES
	}
}

let favoritesCache: { raw: string | null; value: readonly string[] } | null = null

function readFavorites(): readonly string[] {
	const raw = readItem(FAVORITES_KEY)
	if (favoritesCache !== null && favoritesCache.raw === raw) return favoritesCache.value
	const value = parseFavorites(raw)
	favoritesCache = { raw, value }
	return value
}

function useFavoriteZones(): [readonly string[], (zone: string) => void] {
	const favorites = useSyncExternalStore(subscribe, readFavorites, () => DEFAULT_FAVORITES)
	const toggle = useCallback((zone: string) => {
		const current = readFavorites()
		const next = current.includes(zone) ? current.filter((item) => item !== zone) : [...current, zone]
		writeItem(FAVORITES_KEY, JSON.stringify(next))
	}, [])
	return [favorites, toggle]
}

const Chevron12: IconComponent = (props) => <ChevronDown {...props} size={12} />

interface FirstOption {
	value: string
	label: string
}

interface TimeZonePickerProps {
	trigger: 'toolbar' | 'field'
	value: string | null
	onChange: (value: string | null) => void
	allowNone?: boolean
	firstOption?: FirstOption
	excludeMain?: boolean
	labelAt?: Date
	id?: string
	disabled?: boolean
	'aria-describedby'?: string
}

const NONE_HINT = 'Hide the second zone'

function stopRow(event: MouseEvent) {
	event.stopPropagation()
}

function FavoriteStar({
	zone,
	favorite,
	onToggle,
}: {
	zone: string
	favorite: boolean
	onToggle: (zone: string) => void
}) {
	return (
		<button
			type="button"
			aria-pressed={favorite}
			aria-label={favorite ? `Remove ${zone} from favorites` : `Add ${zone} to favorites`}
			data-slot="time-zone-star"
			onPointerDown={stopRow}
			onMouseDown={stopRow}
			onMouseUp={stopRow}
			onClick={(event) => {
				event.stopPropagation()
				onToggle(zone)
			}}
			className={cn(
				'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]',
				favorite
					? 'text-foreground'
					: 'text-muted-foreground opacity-0 group-hover/zone:opacity-100 group-data-[highlighted]/zone:opacity-100 [@media(hover:none)]:opacity-100'
			)}
		>
			<Star size={14} strokeWidth={2} fill={favorite ? 'currentColor' : 'none'} aria-hidden />
		</button>
	)
}

function scrollToChosen(popup: HTMLElement | null, chosen: string) {
	if (popup === null) return
	const row = Array.from(popup.querySelectorAll<HTMLElement>('[data-value]')).find(
		(element) => element.getAttribute('data-value') === chosen
	)
	row?.scrollIntoView({ block: 'center' })
}

export function TimeZonePicker({
	trigger,
	value,
	onChange,
	allowNone = false,
	firstOption,
	excludeMain = false,
	labelAt,
	id,
	disabled = false,
	'aria-describedby': describedBy,
}: TimeZonePickerProps) {
	const toolbar = trigger === 'toolbar'
	const [favorites, toggleFavorite] = useFavoriteZones()
	const [now] = useState(() => new Date())
	const at = labelAt ?? now
	const [query, setQuery] = useState('')
	const [open, setOpen] = useState(false)
	const popupRef = useRef<HTMLDivElement>(null)

	const model = useMemo(() => {
		const zones = listTimeZones(value && value !== firstOption?.value ? [value] : []).filter(
			(zone) => !(excludeMain && isVietnamZone(zone))
		)
		const available = new Set(zones)
		const starred = favorites.filter((zone) => available.has(zone))
		const starredSet = new Set(starred)
		const others = zones.filter((zone) => !starredSet.has(zone))
		const special: ComboboxItemData[] = []
		if (allowNone) special.push({ value: NONE, label: 'None' })
		if (firstOption) special.push({ value: firstOption.value, label: firstOption.label })
		const items: ComboboxItemData[] = [
			...special,
			...starred.map((zone) => ({ value: zone, label: zone, detail: zoneLabel(zone, at) })),
			...others.map((zone) => ({ value: zone, label: zone, detail: zoneLabel(zone, at) })),
		]
		return {
			items,
			starredSet,
			firstStarred: starred[0] ?? null,
			firstOther: starred.length > 0 ? (others[0] ?? null) : null,
		}
	}, [value, firstOption, excludeMain, favorites, allowNone, at])

	const filter = useCallback(
		(item: ComboboxItemData, text: string) => {
			if (typeof item === 'string') return item.toLowerCase().includes(text.trim().toLowerCase())
			if (item.value === NONE || item.value === firstOption?.value) {
				return item.label.toLowerCase().includes(text.trim().toLowerCase())
			}
			return zoneMatches(item.value, text, at)
		},
		[firstOption, at]
	)

	useEffect(() => {
		if (!open || value === null) return
		let inner = 0
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => scrollToChosen(popupRef.current, value))
		})
		return () => {
			cancelAnimationFrame(outer)
			cancelAnimationFrame(inner)
		}
	}, [open, value])

	const searching = query.trim() !== ''
	const chosen = value ?? NONE
	const isFirstOption = firstOption !== undefined && value === firstOption.value
	const chosenLabel = value !== null && !isFirstOption ? zoneLabel(value, at) : null

	return (
		<Combobox
			items={model.items}
			value={value === null && !allowNone ? '' : chosen}
			onValueChange={(next) => onChange(next === NONE || next === '' ? null : next)}
			filter={filter}
			disabled={disabled}
			size={toolbar ? 'compact' : undefined}
			onOpenChange={(next) => {
				setOpen(next)
				setQuery('')
			}}
			onInputValueChange={setQuery}
		>
			{toolbar ? (
				<ComboboxPrimitive.Trigger
					render={
						<Button
							variant="tertiary"
							size="compact"
							className="rounded-full"
							aria-label="Second time zone"
							leadingIcon={Globe}
							trailingIcon={Chevron12}
						/>
					}
				>
					{chosenLabel ?? 'No second zone'}
				</ComboboxPrimitive.Trigger>
			) : (
				<ComboboxPrimitive.Trigger
					id={id}
					aria-describedby={describedBy}
					className="group inline-flex h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md bg-transparent px-3 text-body text-foreground ring-1 ring-input transition-all duration-80 ring-inset hover:bg-hover disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive data-[popup-open]:outline-1 data-[popup-open]:outline-offset-2 data-[popup-open]:outline-focus-ring"
				>
					<span className="min-w-0 flex-1 truncate text-left leading-5">
						{value === null ? (
							<span className="text-muted-foreground">None</span>
						) : isFirstOption ? (
							firstOption.label
						) : (
							<>
								{value}
								<span className="ml-2 text-muted-foreground">{chosenLabel}</span>
							</>
						)}
					</span>
					<ChevronDown size={16} aria-hidden className="shrink-0 text-muted-foreground" />
				</ComboboxPrimitive.Trigger>
			)}
			<ComboboxContent
				ref={popupRef}
				align={toolbar ? 'end' : 'start'}
				sideOffset={4}
				className={cn('p-0 [--scroll-fade-size:var(--scroll-fade-size-compact)]', toolbar && 'w-[280px]')}
			>
				<div className={cn('flex shrink-0 items-center gap-2 border-b border-border px-3', toolbar ? 'h-7' : 'h-9')}>
					<Search size={14} aria-hidden className="shrink-0 text-muted-foreground" />
					<ComboboxPrimitive.Input
						placeholder="Search time zones"
						aria-label="Search time zones"
						className="h-full min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
						onKeyDown={(event) => {
							if (event.key === 'Escape') event.stopPropagation()
						}}
					/>
				</div>
				<div className="flex max-h-60 min-h-0 flex-1 flex-col">
					<ComboboxList
						className="p-1"
						emptyTitle="No time zones found"
						emptyHint="Try a city, a country or an abbreviation like CET."
					>
						{(item) => {
							const data = typeof item === 'string' ? { value: item, label: item, detail: undefined } : item
							const zone = data.value !== NONE && data.value !== firstOption?.value
							const favorite = model.starredSet.has(data.value)
							const heading =
								searching || !zone
									? null
									: data.value === model.firstStarred
										? 'Favorites'
										: data.value === model.firstOther
											? 'All time zones'
											: null
							return (
								<>
									{heading !== null ? (
										<div role="presentation" className="px-2 pt-2 pb-1 text-micro text-muted-foreground">
											{heading}
										</div>
									) : null}
									<ComboboxItem
										value={data.value}
										className="group/zone"
										detail={
											zone ? (
												<span className="flex items-center gap-2">
													<span className="tabular-nums">{data.detail}</span>
													<FavoriteStar zone={data.value} favorite={favorite} onToggle={toggleFavorite} />
												</span>
											) : undefined
										}
									>
										{data.label}
										{data.value === NONE ? (
											<span className="ml-1 text-caption text-muted-foreground">{NONE_HINT}</span>
										) : null}
									</ComboboxItem>
								</>
							)
						}}
					</ComboboxList>
				</div>
			</ComboboxContent>
		</Combobox>
	)
}
