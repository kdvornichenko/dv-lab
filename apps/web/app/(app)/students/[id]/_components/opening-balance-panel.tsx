'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Pencil } from 'lucide-react'

import { DateField } from '@/components/app/date-field'
import { Panel } from '@/components/app/layout-parts'
import { ReloadNotice } from '@/components/app/reload-notice'
import { TextField } from '@/components/app/text-field'
import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api-client'
import { formatDate } from '@/lib/schedule-format'

import type { StudentDetail, StudentResponse } from '@dv-lab/contracts'
import { balancePhrase, formatLessons, parseLessons } from '@dv-lab/core'

import { useToast } from '../../../_components/toasts'
import { TimeZoneStaleNotice, useScheduleFormContext } from '../../../schedule/_components/schedule-form-context'

interface OpeningBalanceRowProps {
	student: StudentDetail
	mainTimeZone: string
	asOf: string
	openRequested: boolean
	onOpened: () => void
	onChanged: () => void
}

function savedLessons(student: StudentDetail) {
	const { openingBalance } = student
	return openingBalance === null
		? ''
		: formatLessons(openingBalance.minutes, student.defaultLessonMinutes).replaceAll(',', '')
}

function OpeningBalanceForm({
	student,
	mainTimeZone,
	asOf,
	onClose,
	onChanged,
}: {
	student: StudentDetail
	mainTimeZone: string
	asOf: string
	onClose: () => void
	onChanged: () => void
}) {
	const toast = useToast()
	const context = useScheduleFormContext({ mainTimeZone, asOf }, mainTimeZone)
	const lessonsInput = useRef<HTMLInputElement>(null)
	const [lessons, setLessons] = useState(() => savedLessons(student))
	const [on, setOn] = useState(() => student.openingBalance?.on ?? context.today)
	const [touched, setTouched] = useState(false)
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [changed, setChanged] = useState(false)
	const [revision] = useState(student.revision)
	const [pending, setPending] = useState(false)

	useEffect(() => {
		lessonsInput.current?.focus()
	}, [])

	const hundredths = parseLessons(lessons)
	const lessonsError =
		(submitted || touched) && hundredths === null ? 'Enter 0 or more lessons, up to two decimals.' : undefined
	const dateError = on === '' ? 'Choose a date.' : on > context.today ? 'Choose today or an earlier date.' : undefined

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending || context.stale || changed) return
		setSubmitted(true)
		setFailed(false)
		if (hundredths === null) {
			lessonsInput.current?.focus()
			return
		}
		if (dateError) return document.getElementById('opening-balance-on')?.focus()
		setPending(true)
		const result = await apiRequest<StudentResponse>('PUT', `/students/${student.id}/opening-balance`, {
			lessonsHundredths: hundredths,
			on,
			expectedDefaultTimeZone: context.mainTimeZone,
			expectedRevision: revision,
		})
		setPending(false)
		if (!result.ok) {
			if (result.error?.code === 'default_time_zone_changed') return context.markStale()
			if (result.error?.code === 'precondition_failed') return setChanged(true)
			setFailed(true)
			return
		}
		const saved = result.data.student
		const minutes = saved.openingBalance?.minutes ?? 0
		toast.show({
			title: 'Opening balance saved',
			description: `${balancePhrase(minutes, saved.defaultLessonMinutes)} as of ${formatDate(on, 0)}.`,
		})
		onClose()
		onChanged()
	}

	return (
		<form noValidate data-slot="opening-balance-form" onSubmit={onSubmit} className="flex flex-col gap-3 px-4 py-3">
			<p className="text-caption text-muted-foreground">Lessons left on the day you start counting here.</p>
			<TimeZoneStaleNotice stale={context.stale} pending={pending} onRefresh={onChanged} />
			<div className="flex flex-wrap items-start gap-x-4 gap-y-3">
				<div className="w-33 shrink-0 max-sm:w-full">
					<TextField
						ref={lessonsInput}
						id="opening-balance-lessons"
						name="lessons"
						label="Lessons left"
						inputMode="decimal"
						autoComplete="off"
						helper="Up to two decimals, for example 1.5."
						value={lessons}
						className="text-right"
						onChange={(event) => setLessons(event.target.value)}
						onBlur={() => setTouched(true)}
						disabled={pending}
						error={lessonsError}
					/>
				</div>
				<div className="min-w-0 max-sm:w-full sm:w-64">
					<DateField
						id="opening-balance-on"
						label="As of"
						value={on}
						onChange={setOn}
						max={context.today}
						helper="Payments dated on or before this date are already counted in the number."
						error={submitted ? dateError : undefined}
						disabled={pending}
					/>
				</div>
				<div className="ml-auto flex gap-2 max-sm:w-full max-sm:justify-end sm:mt-7">
					<Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
						Close
					</Button>
					<Button type="submit" loading={pending} disabled={context.stale || changed}>
						{pending ? 'Saving…' : 'Save opening balance'}
					</Button>
				</div>
			</div>
			{changed ? (
				<ReloadNotice
					status="warning"
					text="This student changed elsewhere. Reload the current details before saving."
					reloadLabel="Reload student details"
					onReload={onChanged}
				/>
			) : null}
			{failed ? (
				<p role="alert" className="text-caption text-destructive">
					Could not save the opening balance. Try again.
				</p>
			) : null}
		</form>
	)
}

export function OpeningBalanceRow({
	student,
	mainTimeZone,
	asOf,
	openRequested,
	onOpened,
	onChanged,
}: OpeningBalanceRowProps) {
	const [editing, setEditing] = useState(false)
	if (openRequested && !editing) setEditing(true)

	useEffect(() => {
		if (openRequested) onOpened()
	}, [openRequested, onOpened])

	function close() {
		setEditing(false)
		requestAnimationFrame(() => document.getElementById('opening-balance-open')?.focus())
	}

	const { openingBalance } = student
	if (editing) {
		return (
			<Panel>
				<OpeningBalanceForm
					key={student.revision}
					student={student}
					mainTimeZone={mainTimeZone}
					asOf={asOf}
					onClose={close}
					onChanged={onChanged}
				/>
			</Panel>
		)
	}
	if (openingBalance === null) {
		return (
			<Banner status="info" data-slot="opening-balance-unset">
				<BannerTitle>Opening balance not set. Lessons are counted from it and from the payments after it.</BannerTitle>
				<BannerActions className="col-start-2 row-start-2 my-0 mt-2 ml-0">
					<BannerAction id="opening-balance-open" onClick={() => setEditing(true)}>
						Set opening balance
					</BannerAction>
				</BannerActions>
			</Banner>
		)
	}
	return (
		<Panel>
			<div
				data-slot="opening-balance-row"
				className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
			>
				<div className="flex min-w-0 flex-col">
					<span className="text-caption text-muted-foreground">Opening balance</span>
					<span data-slot="opening-balance-text" className="text-body text-foreground tabular-nums">
						{balancePhrase(openingBalance.minutes, student.defaultLessonMinutes)} as of{' '}
						{formatDate(openingBalance.on, 0)}
					</span>
				</div>
				<Button
					id="opening-balance-open"
					variant="secondary"
					size="compact"
					leadingIcon={Pencil}
					onClick={() => setEditing(true)}
				>
					Update opening balance
				</Button>
			</div>
		</Panel>
	)
}
