'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type MouseEvent } from 'react'

import { ChevronDown, Globe, Search, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Combobox, ComboboxContent, ComboboxItem, ComboboxList, type ComboboxItemData } from '@/components/ui/combobox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { listTimeZones, sameTimeZone, zoneLabel, zoneMatches } from '@/lib/time-zones'
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

function writeItem(key: string, value: string, deferred = false) {
	try {
		localStorage.setItem(key, value)
	} catch {}
	const publish = () => window.dispatchEvent(new Event(CHANGE_EVENT))
	if (deferred) queueMicrotask(publish)
	else publish()
}

function normalizeSecond(raw: string | null, mainTimeZone: string, previousMain: string | null = null): string {
	if (raw === NONE) return NONE
	const zone = raw ?? DEFAULT_SECOND_ZONE
	if (isTimeZone(zone) && !sameTimeZone(zone, mainTimeZone)) return zone
	return previousMain !== null && !sameTimeZone(previousMain, mainTimeZone) ? previousMain : NONE
}

export function commitDefaultZoneChange(oldMain: string, newMain: string): void {
	const second = normalizeSecond(readItem(SECOND_ZONE_KEY), oldMain)
	if (second !== NONE && sameTimeZone(second, newMain)) writeItem(SECOND_ZONE_KEY, oldMain, true)
}

export function useSecondZone(mainTimeZone: string | null): [string | null, (zone: string | null) => void] {
	const [knownMain, setKnownMain] = useState<{ current: string | null; previous: string | null }>({
		current: mainTimeZone,
		previous: null,
	})
	const previousMain =
		knownMain.current !== null && mainTimeZone !== null && !sameTimeZone(knownMain.current, mainTimeZone)
			? knownMain.current
			: knownMain.previous
	if (mainTimeZone !== null && mainTimeZone !== knownMain.current) {
		setKnownMain({ current: mainTimeZone, previous: previousMain })
	}
	const raw = useSyncExternalStore<string | null | undefined>(
		subscribe,
		() => readItem(SECOND_ZONE_KEY),
		() => undefined
	)
	const stored = mainTimeZone === null || raw === undefined ? NONE : normalizeSecond(raw, mainTimeZone, previousMain)
	useEffect(() => {
		if (mainTimeZone === null || raw === undefined || raw === stored || (raw === null && stored !== NONE)) return
		if (readItem(SECOND_ZONE_KEY) === raw) writeItem(SECOND_ZONE_KEY, stored)
	}, [mainTimeZone, raw, stored])
	const set = useCallback(
		(zone: string | null) => {
			if (mainTimeZone !== null) writeItem(SECOND_ZONE_KEY, normalizeSecond(zone ?? NONE, mainTimeZone))
		},
		[mainTimeZone]
	)
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
	excludeMain?: string | null
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
	pinned,
	onToggle,
}: {
	zone: string
	favorite: boolean
	pinned: boolean
	onToggle: (zone: string) => void
}) {
	return (
		<button
			type="button"
			aria-pressed={favorite}
			aria-label={favorite ? `Remove ${zone} from favorites` : `Add ${zone} to favorites`}
			data-slot="time-zone-star"
			onFocus={(event) => event.stopPropagation()}
			onPointerDown={stopRow}
			onMouseDown={stopRow}
			onMouseUp={stopRow}
			onKeyDown={(event) => {
				if (event.key === ' ' || event.key === 'Enter') event.stopPropagation()
			}}
			onKeyUp={(event) => {
				if (event.key === ' ' || event.key === 'Enter') event.stopPropagation()
			}}
			onClick={(event) => {
				event.stopPropagation()
				onToggle(zone)
			}}
			className={cn(
				'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]',
				favorite
					? 'text-foreground'
					: pinned
						? 'text-muted-foreground'
						: 'text-muted-foreground opacity-0 group-hover/zone:opacity-100 group-data-[fluid-hover-active]/zone:opacity-100 [@media(hover:none)]:opacity-100'
			)}
		>
			<Star size={14} strokeWidth={2} fill={favorite ? 'currentColor' : 'none'} aria-hidden />
		</button>
	)
}

export function TimeZonePicker({
	trigger,
	value,
	onChange,
	allowNone = false,
	firstOption,
	excludeMain = null,
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

	const searching = query.trim() !== ''

	const model = useMemo(() => {
		const chosenZone = value && value !== firstOption?.value && isTimeZone(value) ? value : null
		const allowed = (zone: string) => excludeMain === null || !sameTimeZone(zone, excludeMain)
		const special: ComboboxItemData[] = []
		if (allowNone) special.push({ value: NONE, label: 'None' })
		if (firstOption) special.push({ value: firstOption.value, label: firstOption.label })
		const row = (zone: string): ComboboxItemData => ({ value: zone, label: zone })
		if (!searching) {
			const starred = favorites.filter(allowed)
			const starredSet = new Set(starred)
			const current = chosenZone !== null && allowed(chosenZone) && !starredSet.has(chosenZone) ? [chosenZone] : []
			return {
				items: [...special, ...starred.map(row), ...current.map(row)],
				starredSet,
				firstStarred: starred[0] ?? null,
				selected: current[0] ?? null,
			}
		}
		const zones = listTimeZones(chosenZone !== null ? [chosenZone] : []).filter(allowed)
		const available = new Set(zones)
		const starred = favorites.filter((zone) => available.has(zone))
		const starredSet = new Set(starred)
		const others = zones.filter((zone) => !starredSet.has(zone))
		return {
			items: [...special, ...starred.map(row), ...others.map(row)],
			starredSet,
			firstStarred: null,
			selected: null,
		}
	}, [searching, value, firstOption, excludeMain, favorites, allowNone])

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
			onOpenChange={() => setQuery('')}
			onInputValueChange={setQuery}
		>
			{toolbar ? (
				<Tooltip side="bottom" content={`Second time zone: ${chosenLabel ?? 'none'}`}>
					<ComboboxPrimitive.Trigger
						render={<Button variant="tertiary" size="icon-compact" aria-label="Second time zone" />}
					>
						<Globe />
					</ComboboxPrimitive.Trigger>
				</Tooltip>
			) : (
				<ComboboxPrimitive.Trigger
					id={id}
					aria-describedby={describedBy}
					className="group hit-slop relative inline-flex h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md bg-transparent px-3 text-body text-foreground ring-1 ring-input transition-all duration-80 ring-inset hover:bg-hover disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive data-[popup-open]:outline-1 data-[popup-open]:outline-offset-2 data-[popup-open]:outline-focus-ring pointer-coarse:text-[16px]"
				>
					<span className="min-w-0 flex-1 truncate text-left leading-5">
						{value === null ? (
							allowNone ? (
								<span className="text-muted-foreground">None</span>
							) : (
								<Skeleton className="h-4 w-32" />
							)
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
				align={toolbar ? 'end' : 'start'}
				sideOffset={4}
				className={cn(
					'max-h-none max-w-[calc(100vw-2rem)] p-0 [--scroll-fade-size:var(--scroll-fade-size-compact)]',
					toolbar && 'w-[280px]'
				)}
			>
				<div className={cn('flex shrink-0 items-center gap-2 border-b border-border px-3', toolbar ? 'h-7' : 'h-9')}>
					<Search size={14} aria-hidden className="shrink-0 text-muted-foreground" />
					<ComboboxPrimitive.Input
						placeholder="Search time zones"
						aria-label="Search time zones"
						className="h-full min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground pointer-coarse:text-[16px]"
						onKeyDown={(event) => {
							if (event.key === 'Escape') event.stopPropagation()
						}}
					/>
				</div>
				<div className={cn('flex max-h-[260px] min-h-0 flex-1 flex-col', toolbar ? 'min-h-[176px]' : 'min-h-[224px]')}>
					<ComboboxList
						className="p-1"
						emptyTitle={searching ? 'No time zones found' : 'No favorite time zones'}
						emptyHint={searching ? 'Try a city, a country or an abbreviation like CET.' : undefined}
					>
						{(item) => {
							const data = typeof item === 'string' ? { value: item, label: item } : item
							const zone = data.value !== NONE && data.value !== firstOption?.value
							const favorite = model.starredSet.has(data.value)
							const heading = !zone
								? null
								: data.value === model.firstStarred
									? 'Favorites'
									: data.value === model.selected
										? 'Selected'
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
										className={cn(
											'group/zone h-auto [&>span.truncate]:overflow-visible [&>span.truncate]:whitespace-normal',
											toolbar ? 'min-h-7' : 'min-h-9'
										)}
										detail={
											zone ? (
												<span className="flex items-center gap-2">
													<span className="tabular-nums">{zoneLabel(data.value, at)}</span>
													<FavoriteStar
														zone={data.value}
														favorite={favorite}
														pinned={data.value === model.selected}
														onToggle={toggleFavorite}
													/>
												</span>
											) : undefined
										}
									>
										<span className="min-w-0 [overflow-wrap:anywhere] break-words whitespace-normal">{data.label}</span>
										{data.value === NONE ? (
											<span className="ml-1 text-caption text-muted-foreground">{NONE_HINT}</span>
										) : null}
									</ComboboxItem>
								</>
							)
						}}
					</ComboboxList>
				</div>
				<div className="flex h-8 shrink-0 items-center border-t border-border px-3 text-caption text-muted-foreground">
					{searching ? null : 'Search by city or abbreviation.'}
				</div>
			</ComboboxContent>
		</Combobox>
	)
}
