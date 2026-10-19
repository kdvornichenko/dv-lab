'use client'

import { useRef, useState } from 'react'

import { Panel } from '@/components/app/layout-parts'
import { TimeZonePicker } from '@/components/app/time-zone-picker'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { apiRequest } from '@/lib/api-client'
import { sameTimeZone, zoneName } from '@/lib/time-zones'

import type { SettingsResponse } from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'

export function StudentZoneCard({
	value,
	now,
	onSaved,
}: {
	value: string | null
	now: Date | null
	onSaved: (value: string) => void
}) {
	const toast = useToast()
	const [saving, setSaving] = useState(false)
	const [failed, setFailed] = useState(false)
	const inflight = useRef(false)

	async function choose(zone: string | null) {
		if (zone === null || value === null || inflight.current || sameTimeZone(zone, value)) return
		inflight.current = true
		setSaving(true)
		setFailed(false)
		try {
			const result = await apiRequest<SettingsResponse>('PATCH', '/settings', { studentTimeZone: zone })
			if (!result.ok) {
				setFailed(true)
				return
			}
			onSaved(result.data.settings.studentTimeZone)
			toast.show({ title: 'Saved', description: `New students: ${zoneName(result.data.settings.studentTimeZone)}.` })
		} finally {
			inflight.current = false
			setSaving(false)
		}
	}

	return (
		<Panel
			id="settings-student-time-zone"
			title="Students' time zone"
			description="The zone a new student card starts with. You can change it on each card."
		>
			{failed ? (
				<div className="px-4 pt-2">
					<Banner status="error">
						<BannerTitle>Could not save the time zone. Try again.</BannerTitle>
					</Banner>
				</div>
			) : null}
			<div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between md:gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<label htmlFor="settings-student-zone" className="text-body text-foreground">
						Time zone
					</label>
					<p id="settings-student-zone-hint" className="text-caption text-muted-foreground">
						Cards you already have keep their zone.
					</p>
				</div>
				<div className="w-full md:w-65 md:shrink-0">
					<TimeZonePicker
						trigger="field"
						id="settings-student-zone"
						aria-describedby="settings-student-zone-hint"
						value={value}
						onChange={(zone) => void choose(zone)}
						labelAt={now ?? undefined}
						disabled={saving || value === null}
					/>
				</div>
			</div>
		</Panel>
	)
}
