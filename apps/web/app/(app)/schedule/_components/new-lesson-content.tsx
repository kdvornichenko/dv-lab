import type { ReactNode, RefObject } from 'react'

import { FormFooter } from '@/components/app/google-conflicts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'

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
	studentRef: RefObject<HTMLButtonElement | null>
	students: StudentsState
	active: StudentLessonOption[]
	noStudents: boolean
}) {
	const failed = students.kind === 'error'
	const text =
		students.kind === 'loading'
			? 'Loading students…'
			: failed
				? 'Could not load students. Close this window and try again.'
				: noStudents
					? 'No active students. Add a card on the Students page.'
					: 'Choose a student'
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<label htmlFor="new-lesson-student" className="text-body text-muted-foreground">
				Student
			</label>
			<Select
				value={studentId}
				onValueChange={chooseStudent}
				disabled={pending || students.kind !== 'ready' || noStudents}
			>
				<SelectTrigger
					ref={studentRef}
					id="new-lesson-student"
					data-slot="new-lesson-student"
					className={cn(
						'w-full min-w-0 pointer-coarse:text-[16px]',
						failed && 'ring-destructive **:data-[placeholder]:text-destructive'
					)}
					placeholder={text}
					autoFocus
					aria-invalid={failed || undefined}
				/>
				<SelectContent>
					{active.map((student, index) => (
						<SelectItem key={student.id} index={index} value={student.id}>
							{student.displayName}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
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
