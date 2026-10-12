import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
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
	pending,
	blocked,
	repeats,
}: {
	onClose: () => void
	pending: boolean
	blocked: boolean
	repeats: LessonRepeats
}) {
	return (
		<DialogFooter>
			<Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
				Discard changes
			</Button>
			<Button type="submit" loading={pending} disabled={blocked}>
				{pending ? 'Adding…' : repeats === 'weekly' ? 'Add series' : 'Add lesson'}
			</Button>
		</DialogFooter>
	)
}
