'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

import { ChevronDown, Globe } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Combobox, ComboboxContent, ComboboxItem, ComboboxList, type ComboboxItemData } from '@/components/ui/combobox'
import type { IconComponent } from '@/lib/icon-context'
import { isVietnamZone, listTimeZones, matchesTimeZone, utcOffset, zoneCaption } from '@/lib/time-zones'

import { isTimeZone } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, zonedInstant } from '@dv-lab/core'

export const SECOND_ZONE_STORAGE_KEY = 'dv-lab.schedule.second-zone'
export const DEFAULT_SECOND_ZONE_ID = 'Europe/Moscow'
const NONE = 'none'
const CHANGE_EVENT = 'dv-lab:second-zone'

function normalize(raw: string | null): string {
	if (raw === NONE) return NONE
	if (raw === null || isVietnamZone(raw) || !isTimeZone(raw)) return DEFAULT_SECOND_ZONE_ID
	return raw
}

function readStored(): string {
	try {
		return normalize(localStorage.getItem(SECOND_ZONE_STORAGE_KEY))
	} catch {
		return DEFAULT_SECOND_ZONE_ID
	}
}

function subscribe(callback: () => void) {
	window.addEventListener('storage', callback)
	window.addEventListener(CHANGE_EVENT, callback)
	return () => {
		window.removeEventListener('storage', callback)
		window.removeEventListener(CHANGE_EVENT, callback)
	}
}

export function useSecondZone(): [string | null, (zone: string | null) => void] {
	const stored = useSyncExternalStore(subscribe, readStored, () => DEFAULT_SECOND_ZONE_ID)
	const set = useCallback((zone: string | null) => {
		try {
			localStorage.setItem(SECOND_ZONE_STORAGE_KEY, zone ?? NONE)
		} catch {}
		window.dispatchEvent(new Event(CHANGE_EVENT))
	}, [])
	return [stored === NONE ? null : stored, set]
}

const Chevron12: IconComponent = (props) => <ChevronDown {...props} size={12} />

interface SecondZoneSelectProps {
	zone: string | null
	monday: string
	onChange: (zone: string | null) => void
}

export function SecondZoneSelect({ zone, monday, onChange }: SecondZoneSelectProps) {
	const at = useMemo(() => zonedInstant(monday, '12:00', SCHEDULE_TIME_ZONE), [monday])
	const items = useMemo<ComboboxItemData[]>(
		() => [
			{ value: NONE, label: 'None', detail: 'Hide the second zone' },
			...listTimeZones(zone ? [zone] : [])
				.filter((id) => !isVietnamZone(id))
				.map((id) => ({ value: id, label: id, detail: utcOffset(id, at) })),
		],
		[zone, at]
	)
	const caption = zone ? zoneCaption(zone, at, 'toolbar') : 'No second zone'

	return (
		<Combobox
			items={items}
			value={zone ?? NONE}
			onValueChange={(next) => onChange(next === NONE || next === '' ? null : next)}
			filter={matchesTimeZone}
		>
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
				{caption}
			</ComboboxPrimitive.Trigger>
			<ComboboxContent
				align="end"
				sideOffset={4}
				className="w-[280px] p-0 [--scroll-fade-size:var(--scroll-fade-size-compact)]"
			>
				<div className="shrink-0 border-b border-border">
					<ComboboxPrimitive.Input
						placeholder="Search time zones"
						aria-label="Search time zones"
						className="h-9 w-full bg-transparent px-4 text-body text-foreground outline-none placeholder:text-muted-foreground"
					/>
				</div>
				<div className="flex min-h-0 flex-1 flex-col p-1">
					<ComboboxList emptyTitle="No time zones found" emptyHint="Try a city, a country or an offset like UTC+7.">
						{(item) => {
							const data = typeof item === 'string' ? { value: item, label: item, detail: undefined } : item
							return (
								<ComboboxItem key={data.value} value={data.value} detail={data.detail}>
									{data.label}
								</ComboboxItem>
							)
						}}
					</ComboboxList>
				</div>
			</ComboboxContent>
		</Combobox>
	)
}
