'use client'

import { useState, type FormEvent, type RefObject } from 'react'

import { DateField } from '@/components/app/date-field'
import { Panel } from '@/components/app/layout-parts'
import { ReloadNotice } from '@/components/app/reload-notice'
import { StudentBalance } from '@/components/app/student-balance'
import { TextField } from '@/components/app/text-field'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api-client'

import type { StudentDetail, StudentResponse } from '@dv-lab/contracts'
import { balancePhrase, formatLessons, parseLessons } from '@dv-lab/core'

import { useToast } from '../../../_components/toasts'
import { TimeZoneStaleNotice, useScheduleFormContext } from '../../../schedule/_components/schedule-form-context'

interface OpeningBalancePanelProps {
	student: StudentDetail
	mainTimeZone: string
	asOf: string
	lessonsInputRef: RefObject<HTMLInputElement | null>
	onSaved: () => void
	onRefresh: () => void
}

const dayFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

function formatDay(day: string) {
	return dayFormat.format(new Date(`${day}T00:00:00Z`))
}

function savedLessons(student: StudentDetail) {
	const { openingBalance } = student
	return openingBalance === null
		? ''
		: formatLessons(openingBalance.minutes, student.defaultLessonMinutes).replaceAll(',', '')
}

export function OpeningBalancePanel({
	student,
	mainTimeZone,
	asOf,
	lessonsInputRef,
	onSaved,
	onRefresh,
}: OpeningBalancePanelProps) {
	const toast = useToast()
	const context = useScheduleFormContext({ mainTimeZone, asOf }, mainTimeZone)
	const [lessons, setLessons] = useState(() => savedLessons(student))
	const [on, setOn] = useState(() => student.openingBalance?.on ?? context.today)
	const [touched, setTouched] = useState(false)
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [changed, setChanged] = useState(false)
	const [revision] = useState(student.revision)
	const [pending, setPending] = useState(false)

	const { openingBalance } = student
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
			lessonsInputRef.current?.focus()
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
			description: `${balancePhrase(minutes, saved.defaultLessonMinutes)} as of ${formatDay(on)}.`,
		})
		onSaved()
	}

	return (
		<Panel
			id="student-opening-balance"
			title="Opening balance"
			description="Lessons left on the day you start counting here."
		>
			<form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 px-4 pt-2 pb-4">
				<TimeZoneStaleNotice stale={context.stale} pending={pending} onRefresh={onRefresh} />
				{failed ? (
					<Banner status="error">
						<BannerTitle>Could not save the opening balance. Try again.</BannerTitle>
					</Banner>
				) : null}
				<div className="flex items-baseline justify-between gap-4 text-body">
					<span className="text-muted-foreground">Balance now</span>
					<StudentBalance minutes={student.balanceMinutes} lessonMinutes={student.defaultLessonMinutes} />
				</div>
				<TextField
					ref={lessonsInputRef}
					id="opening-balance-lessons"
					name="lessons"
					label="Lessons left"
					inputMode="decimal"
					autoComplete="off"
					helper="Up to two decimals, for example 1.5."
					value={lessons}
					onChange={(event) => setLessons(event.target.value)}
					onBlur={() => setTouched(true)}
					disabled={pending}
					error={lessonsError}
				/>
				<div className="flex flex-col gap-2">
					<DateField
						id="opening-balance-on"
						label="As of"
						value={on}
						onChange={setOn}
						max={context.today}
						error={submitted ? dateError : undefined}
						disabled={pending}
					/>
					<p className="text-caption text-muted-foreground">
						Payments dated on or before this date are already counted in the number.
					</p>
				</div>
				{changed ? (
					<ReloadNotice
						status="warning"
						text="This student changed elsewhere. Reload the current details before saving."
						reloadLabel="Reload student details"
						onReload={onRefresh}
					/>
				) : null}
				<div>
					<Button type="submit" loading={pending} disabled={context.stale || changed}>
						{pending ? 'Saving…' : openingBalance === null ? 'Save opening balance' : 'Update opening balance'}
					</Button>
				</div>
			</form>
		</Panel>
	)
}
