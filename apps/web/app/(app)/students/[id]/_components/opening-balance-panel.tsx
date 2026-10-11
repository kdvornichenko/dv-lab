'use client'

import { useState, type FormEvent, type RefObject } from 'react'

import { DateField } from '@/components/app/date-field'
import { Panel } from '@/components/app/layout-parts'
import { StudentBalance } from '@/components/app/student-balance'
import { TextField } from '@/components/app/text-field'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api-client'

import type { StudentDetail, StudentResponse } from '@dv-lab/contracts'
import { balancePhrase, formatLessons, parseLessons, scheduleToday } from '@dv-lab/core'

import { useToast } from '../../../_components/toasts'

interface OpeningBalancePanelProps {
	student: StudentDetail
	lessonsInputRef: RefObject<HTMLInputElement | null>
	onSaved: () => void
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

function savedDay(student: StudentDetail) {
	return student.openingBalance?.on ?? scheduleToday(new Date())
}

function sourceKey(student: StudentDetail) {
	const { openingBalance } = student
	return `${openingBalance?.minutes ?? ''}|${openingBalance?.on ?? ''}|${student.defaultLessonMinutes}`
}

export function OpeningBalancePanel({ student, lessonsInputRef, onSaved }: OpeningBalancePanelProps) {
	const toast = useToast()
	const [seen, setSeen] = useState(() => sourceKey(student))
	const [lessons, setLessons] = useState(() => savedLessons(student))
	const [on, setOn] = useState(() => savedDay(student))
	const [touched, setTouched] = useState(false)
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)

	const key = sourceKey(student)
	if (seen !== key) {
		setSeen(key)
		setLessons(savedLessons(student))
		setOn(savedDay(student))
		setTouched(false)
		setSubmitted(false)
	}

	const { openingBalance } = student
	const hundredths = parseLessons(lessons)
	const lessonsError =
		(submitted || touched) && hundredths === null ? 'Enter 0 or more lessons, up to two decimals.' : undefined

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending) return
		setSubmitted(true)
		setFailed(false)
		if (hundredths === null) {
			lessonsInputRef.current?.focus()
			return
		}
		setPending(true)
		const result = await apiRequest<StudentResponse>('PUT', `/students/${student.id}/opening-balance`, {
			lessonsHundredths: hundredths,
			on,
		})
		setPending(false)
		if (!result.ok) {
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
						max={scheduleToday(new Date())}
						disabled={pending}
					/>
					<p className="text-caption text-muted-foreground">
						Payments dated on or before this date are already counted in the number.
					</p>
				</div>
				<div>
					<Button type="submit" loading={pending}>
						{pending ? 'Saving…' : openingBalance === null ? 'Save opening balance' : 'Update opening balance'}
					</Button>
				</div>
			</form>
		</Panel>
	)
}
