import type { ReactNode, RefObject } from 'react'

import { FormFooter } from '@/components/app/google-conflicts'
import { SearchSelect } from '@/components/app/search-select'
import { Button } from '@/components/ui/button'

import type { LessonRepeats, StudentLessonOption } from '@dv-lab/contracts'

import type { StudentsState } from './use-lesson-students'

export function NewLessonStudent({
	studentId,
	chooseStudent,
	pending,
	studentRef,
	students,
	active,
	noStudents,
}: {
	studentId: string
	chooseStudent: (value: string) => void
	pending: boolean
	studentRef: RefObject<HTMLInputElement | null>
	students: StudentsState
	active: StudentLessonOption[]
	noStudents: boolean
}) {
	const failed = students.kind === 'error'
	const options = active.map((student) => ({ value: student.id, label: student.displayName }))
	const text =
		students.kind === 'loading'
			? 'Loading students…'
			: noStudents
				? 'No active students. Add a card on the Students page.'
				: 'Choose a student'
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<label htmlFor="new-lesson-student" className="text-body text-muted-foreground">
				Student
			</label>
			<SearchSelect
				ref={studentRef}
				id="new-lesson-student"
				options={options}
				value={studentId}
				onChange={chooseStudent}
				placeholder={text}
				emptyTitle="No students found"
				emptyHint="Try a part of the name."
				disabled={pending || students.kind !== 'ready' || noStudents}
				error={failed ? 'Could not load students. Close this window and try again.' : undefined}
				autoFocus
			/>
		</div>
	)
}

export function NewLessonFooter({
	onClose,
	blocked,
	repeats,
	status,
}: {
	onClose: () => void
	blocked: boolean
	repeats: LessonRepeats
	status: ReactNode
}) {
	return (
		<FormFooter status={status}>
			<Button type="button" variant="secondary" onClick={onClose}>
				Close
			</Button>
			<Button type="submit" disabled={blocked}>
				{repeats === 'weekly' ? 'Add series' : 'Add lesson'}
			</Button>
		</FormFooter>
	)
}
