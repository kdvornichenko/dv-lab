'use client'

import { Activity, useEffect, useRef, useState } from 'react'

import { LoaderCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { PageHeader, PageScroll, Panel } from '@/components/app/layout-parts'
import { commitDefaultZoneChange, TimeZonePicker, useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'
import { apiRequest } from '@/lib/api-client'
import { formatTime } from '@/lib/schedule-format'
import { sameTimeZone, zoneLabel, zoneName } from '@/lib/time-zones'

import type { SettingsResponse, StudentsResponse, TeacherSettings } from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'
import { useMinuteNow } from '../../_components/use-minute-now'
import { AssistantCard } from './assistant-card'
import { CalendarCard } from './calendar-card'
import { PaymentsCard } from './payments-card'
import { activeTabOf, resolveTab } from './settings-tabs'
import { ZoneChangeDialog, type ZoneChangeExample } from './zone-change-dialog'

type LoadState = 'loading' | 'ready' | 'failed'

const SAVE_ERROR = 'Could not save the time zone. Try again.'
const STALE_ERROR = 'Default time zone changed elsewhere. Refresh the page and try again.'
const DEFAULT_FIELD = 'settings-default-zone'

function focusDefaultField() {
	requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(DEFAULT_FIELD)?.focus()))
}

function useSettings() {
	const router = useRouter()
	const toast = useToast()
	const [settings, setSettings] = useState<TeacherSettings | null>(null)
	const [loadState, setLoadState] = useState<LoadState>('loading')
	const [readAttempt, setReadAttempt] = useState(0)
	const [candidate, setCandidate] = useState<string | null>(null)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const inflight = useRef(false)
	const uncertain = useRef(false)
	const thresholdRevision = useRef(0)
	const mounted = useRef(false)

	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])

	useEffect(() => {
		let current = true
		const revision = thresholdRevision.current
		void apiRequest<SettingsResponse>('GET', '/settings').then((result) => {
			if (!current) return
			if (!result.ok) {
				if (result.status === 401 || result.status === 403) {
					setSettings(null)
					router.replace(result.status === 401 ? '/login?reason=expired' : '/')
				}
				setLoadState('failed')
				return
			}
			setSettings((previous) => ({
				...result.data.settings,
				paysSoonLessons:
					previous !== null && revision !== thresholdRevision.current
						? previous.paysSoonLessons
						: result.data.settings.paysSoonLessons,
			}))
			uncertain.current = false
			setLoadState('ready')
		})
		return () => {
			current = false
		}
	}, [readAttempt, router])

	function saveThreshold(value: number) {
		thresholdRevision.current += 1
		setSettings((current) => (current === null ? null : { ...current, paysSoonLessons: value }))
	}

	function refresh() {
		if (inflight.current) return
		setCandidate(null)
		setError(null)
		setLoadState('loading')
		setReadAttempt((attempt) => attempt + 1)
	}

	function choose(value: string | null) {
		if (value === null || settings === null || inflight.current) return
		if (sameTimeZone(value, settings.defaultTimeZone)) return
		if (error !== STALE_ERROR) setError(null)
		setCandidate(value)
	}

	function close() {
		if (inflight.current) return
		setCandidate(null)
		focusDefaultField()
	}

	function complete(oldMain: string, newMain: string) {
		commitDefaultZoneChange(oldMain, newMain)
		setSettings((current) => (current === null ? null : { ...current, defaultTimeZone: newMain }))
		uncertain.current = false
		setCandidate(null)
		setError(null)
		toast.show({
			title: 'Saved',
			description: `Default time zone changed to ${zoneName(newMain)} (${zoneLabel(newMain, new Date())}).`,
		})
		focusDefaultField()
		router.refresh()
	}

	function denied(status: number): boolean {
		if (status !== 401 && status !== 403) return false
		setCandidate(null)
		setSettings(null)
		router.replace(status === 401 ? '/login?reason=expired' : '/')
		return true
	}

	async function recover(oldMain: string, next: string): Promise<boolean> {
		const result = await apiRequest<SettingsResponse>('GET', '/settings')
		if (!mounted.current) return false
		if (!result.ok) {
			if (!denied(result.status)) setError(SAVE_ERROR)
			return false
		}
		const main = result.data.settings.defaultTimeZone
		if (sameTimeZone(main, next)) {
			complete(oldMain, main)
			return false
		}
		if (!sameTimeZone(main, oldMain)) {
			setError(STALE_ERROR)
			return false
		}
		uncertain.current = false
		return true
	}

	async function confirm() {
		if (inflight.current || settings === null || candidate === null || error === STALE_ERROR) return
		inflight.current = true
		setPending(true)
		setError(null)
		const oldMain = settings.defaultTimeZone
		try {
			if (uncertain.current && !(await recover(oldMain, candidate))) return
			const result = await apiRequest<SettingsResponse>('PATCH', '/settings', {
				defaultTimeZone: candidate,
				expectedDefaultTimeZone: oldMain,
			})
			if (!mounted.current) return
			if (!result.ok) {
				if (denied(result.status)) return
				uncertain.current = result.status === 0 || result.status >= 500 || (result.status >= 200 && result.status < 300)
				setError(result.error?.code === 'default_time_zone_changed' ? STALE_ERROR : SAVE_ERROR)
				return
			}
			complete(oldMain, result.data.settings.defaultTimeZone)
		} finally {
			inflight.current = false
			if (mounted.current) setPending(false)
		}
	}

	return { settings, loadState, candidate, pending, error, saveThreshold, refresh, choose, close, confirm }
}

function useLessonExample(): ZoneChangeExample | null {
	const [example, setExample] = useState<ZoneChangeExample | null>(null)
	useEffect(() => {
		let current = true
		void apiRequest<StudentsResponse>('GET', '/students').then((result) => {
			if (!current || !result.ok) return
			const next = result.data.students
				.filter((student) => student.nextLessonAt !== null && new Date(student.nextLessonAt).getTime() > Date.now())
				.sort((left, right) => (left.nextLessonAt ?? '').localeCompare(right.nextLessonAt ?? ''))[0]
			setExample(next?.nextLessonAt ? { title: next.displayName, startsAt: next.nextLessonAt } : null)
		})
		return () => {
			current = false
		}
	}, [])
	return example
}

function ZoneConfirmation({
	state,
	now,
	secondZone,
}: {
	state: ReturnType<typeof useSettings>
	now: Date
	secondZone: string | null
}) {
	const example = useLessonExample()
	if (state.settings === null || state.candidate === null) return null
	return (
		<ZoneChangeDialog
			oldMain={state.settings.defaultTimeZone}
			newMain={state.candidate}
			secondZone={secondZone}
			at={now}
			example={example}
			pending={state.pending}
			error={state.error}
			stale={state.error === STALE_ERROR}
			onClose={state.close}
			onConfirm={() => void state.confirm()}
			onRefresh={state.refresh}
		/>
	)
}

function DefaultZoneCard({ state, now }: { state: ReturnType<typeof useSettings>; now: Date | null }) {
	const zone = state.settings?.defaultTimeZone ?? null
	const failed = state.loadState === 'failed'
	const stale = state.error === STALE_ERROR
	const hint = zone !== null && now !== null ? `It is ${formatTime(now, zone)} there now.` : ''
	const caption = failed ? 'Could not load the time zone. Refresh the page.' : state.error
	return (
		<Panel
			id="settings-default-time-zone"
			title="Default time zone"
			description="The zone your schedule is built in. Lesson times, Today and balances use it."
		>
			<div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between md:gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<label htmlFor={DEFAULT_FIELD} className="text-body text-foreground">
						Time zone
					</label>
					<p id="settings-default-zone-hint" className="text-caption text-muted-foreground">
						{hint}
					</p>
				</div>
				<div className="w-full md:w-65 md:shrink-0">
					<TimeZonePicker
						trigger="field"
						id={DEFAULT_FIELD}
						value={zone}
						onChange={state.choose}
						labelAt={now ?? undefined}
						disabled={state.pending || state.loadState !== 'ready' || zone === null}
						aria-describedby={
							caption ? 'settings-default-zone-hint settings-default-zone-status' : 'settings-default-zone-hint'
						}
					/>
				</div>
			</div>
			<p className="px-4 pt-1 pb-3 text-caption text-muted-foreground">
				New lessons and series are created in this zone. Lessons and series you already have keep the zone they were
				created in.
			</p>
			<div className="px-4 pb-4">
				{state.pending ? (
					<p className="flex items-center gap-2 text-caption text-muted-foreground">
						<LoaderCircle size={14} className="animate-spin" aria-hidden />
						Saving…
					</p>
				) : caption ? (
					<p
						id="settings-default-zone-status"
						role={state.candidate === null ? 'alert' : undefined}
						className="text-caption text-destructive"
					>
						{caption}
					</p>
				) : (
					<p className="text-caption text-muted-foreground">Saved to your account.</p>
				)}
				{(failed || stale) && state.candidate === null ? (
					<Button type="button" variant="ghost" className="mt-2" onClick={state.refresh}>
						Refresh
					</Button>
				) : null}
			</div>
		</Panel>
	)
}

function SecondZoneCard({
	zone,
	setZone,
	mainTimeZone,
	disabled,
	now,
}: {
	zone: string | null
	setZone: (zone: string | null) => void
	mainTimeZone: string | null
	disabled: boolean
	now: Date | null
}) {
	const toast = useToast()

	function change(next: string | null) {
		if (next === zone || (next !== null && zone !== null && sameTimeZone(next, zone))) return
		setZone(next)
		toast.show({ title: 'Saved', description: `Second zone: ${next ?? 'None'}.` })
	}

	return (
		<Panel
			id="settings-time-zones"
			title="Second time zone"
			description="Shown beside every lesson time, so you can read it in a student's time."
		>
			<div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between md:gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<label htmlFor="settings-second-zone" className="text-body text-foreground">
						Second zone
					</label>
					<p id="settings-second-zone-hint" className="text-caption text-muted-foreground">
						Shown next to the default zone
					</p>
				</div>
				<div className="w-full md:w-65 md:shrink-0">
					<TimeZonePicker
						trigger="field"
						id="settings-second-zone"
						aria-describedby="settings-second-zone-hint"
						value={zone}
						onChange={change}
						labelAt={now ?? undefined}
						allowNone
						excludeMain={mainTimeZone}
						disabled={disabled}
					/>
				</div>
			</div>
			<p className="px-4 pt-1 pb-4 text-caption text-muted-foreground">Saved in this browser.</p>
		</Panel>
	)
}

export function SettingsScreen() {
	const searchParams = useSearchParams()
	const callbackOutcome = searchParams.get('google')
	const activeTab = activeTabOf(searchParams)
	const state = useSettings()
	const now = useMinuteNow()
	const mainTimeZone = state.settings?.defaultTimeZone ?? null
	const [zone, setZone] = useSecondZone(mainTimeZone)
	return (
		<PageScroll>
			<PageHeader title="Settings" />
			<Tabs
				value={activeTab}
				onValueChange={(next) => {
					const params = new URLSearchParams(searchParams.toString())
					params.set('tab', resolveTab(next))
					params.delete('google')
					const destination = `/settings?${params}`
					if (destination !== window.location.pathname + window.location.search)
						window.history.pushState(null, '', destination)
				}}
			>
				<div className="flex w-fit max-w-full min-w-0 rounded-xl bg-muted">
					<TabsList
						aria-label="Settings sections"
						className="scroll-fade-x bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-sm:min-w-0 max-sm:flex-1 max-sm:overflow-x-auto"
					>
						<TabItem value="general" label="General" />
						<TabItem value="calendar" label="Google Calendar" />
						<TabItem value="assistant" label="Assistant" />
					</TabsList>
				</div>
				<TabPanel value="general" keepMounted className="mt-4">
					<div className="flex max-w-180 flex-col gap-4">
						<DefaultZoneCard state={state} now={now} />
						<SecondZoneCard
							zone={zone}
							setZone={setZone}
							mainTimeZone={mainTimeZone}
							now={now}
							disabled={state.pending || state.loadState !== 'ready'}
						/>
						<PaymentsCard value={state.settings?.paysSoonLessons ?? null} onSaved={state.saveThreshold} />
					</div>
				</TabPanel>
				<TabPanel value="calendar" keepMounted className="mt-4">
					<Activity mode={activeTab === 'calendar' ? 'visible' : 'hidden'}>
						<CalendarCard callbackOutcome={callbackOutcome} />
					</Activity>
				</TabPanel>
				<TabPanel value="assistant" keepMounted className="mt-4">
					<Activity mode={activeTab === 'assistant' ? 'visible' : 'hidden'}>
						<AssistantCard />
					</Activity>
				</TabPanel>
			</Tabs>
			{state.candidate !== null && mainTimeZone !== null && now !== null ? (
				<ZoneConfirmation state={state} now={now} secondZone={zone} />
			) : null}
		</PageScroll>
	)
}
