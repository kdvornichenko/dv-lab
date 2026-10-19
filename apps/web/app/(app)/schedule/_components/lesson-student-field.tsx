'use client'

import { useState } from 'react'

import { SearchSelect } from '@/components/app/search-select'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api-client'

import type { ChangeLessonStudentResponse, ScheduleOccurrenceRef } from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'
import { useLessonStudents } from './use-lesson-students'

export type LessonStudent = { id: string; name: string; onChanged: () => void }

const FAILURES: Record<string, string> = {
	lesson_changed: 'This lesson was changed elsewhere. Refresh the calendar and try again.',
	command_pending: 'A calendar change is still being confirmed. Try again in a moment.',
}
const FAILURE = 'Could not change the student. Try again.'

function pathOf(ref: ScheduleOccurrenceRef): string {
	return ref.kind === 'series'
		? `/schedule/series/${encodeURIComponent(ref.seriesId)}/student`
		: `/schedule/lessons/${encodeURIComponent(ref.lessonId)}/student`
}

export function LessonStudentField({
	lessonRef,
	student,
	disabled,
}: {
	lessonRef: ScheduleOccurrenceRef
	student: LessonStudent
	disabled: boolean
}) {
	const toast = useToast()
	const [editing, setEditing] = useState(false)
	const [choice, setChoice] = useState('')
	const [pending, setPending] = useState(false)
	const [failure, setFailure] = useState<string | null>(null)
	const students = useLessonStudents(editing)
	const rows =
		students.kind === 'ready'
			? students.rows
					.filter((row) => row.id !== student.id)
					.map((row) => ({ value: row.id, label: row.displayName }))
					.toSorted((left, right) => left.label.localeCompare(right.label))
			: []
	const series = lessonRef.kind === 'series'

	async function save() {
		if (choice === '' || pending) return
		setPending(true)
		setFailure(null)
		const result = await apiRequest<ChangeLessonStudentResponse>('POST', pathOf(lessonRef), {
			studentId: choice,
			expectedStudentId: student.id,
		})
		setPending(false)
		if (!result.ok) {
			setFailure(FAILURES[result.error?.code ?? ''] ?? FAILURE)
			return
		}
		toast.show({
			title: 'Student changed',
			description: `${series ? 'The series' : 'The lesson'} now belongs to ${result.data.studentName}.`,
		})
		student.onChanged()
	}

	if (!editing)
		return (
			<span className="flex items-center justify-between gap-2">
				<span className="min-w-0 truncate">{student.name}</span>
				<Button type="button" variant="secondary" size="compact" disabled={disabled} onClick={() => setEditing(true)}>
					Change
				</Button>
			</span>
		)
	return (
		<span className="flex flex-col gap-2">
			<SearchSelect
				id="lesson-student-change"
				options={rows}
				value={choice}
				onChange={setChoice}
				placeholder={students.kind === 'loading' ? 'Loading students…' : 'Choose a student'}
				emptyTitle="No students found"
				emptyHint="Try a part of the name."
				disabled={pending || students.kind !== 'ready'}
				error={students.kind === 'error' ? 'Could not load students.' : undefined}
				autoFocus
			/>
			<span className="text-caption text-muted-foreground">
				{series
					? 'The whole series moves to this card, with its marks and comments. The event title in Google stays the same.'
					: 'This lesson moves to this card, with its mark and comments.'}
			</span>
			{failure === null ? null : (
				<span role="alert" className="text-caption text-destructive">
					{failure}
				</span>
			)}
			<span className="flex justify-end gap-2">
				<Button
					type="button"
					variant="secondary"
					size="compact"
					disabled={pending}
					onClick={() => {
						setEditing(false)
						setChoice('')
						setFailure(null)
					}}
				>
					Close
				</Button>
				<Button type="button" size="compact" loading={pending} disabled={choice === ''} onClick={() => void save()}>
					Save
				</Button>
			</span>
		</span>
	)
}
