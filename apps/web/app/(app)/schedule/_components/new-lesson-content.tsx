import type { RefObject } from 'react'

import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { LessonRepeats, StudentLessonOption } from '@dv-lab/contracts'

import type { StudentsState } from './use-lesson-students'

export function NewLessonNotices({ failed }: { failed: boolean }) {
	return failed ? (
		<Banner status="error">
			<BannerTitle>Could not add the lesson. Try again.</BannerTitle>
		</Banner>
	) : null
}

export function NewLessonStudent({
	studentId,
	chooseStudent,
	pending,
	blocked,
	studentRef,
	students,
	active,
	error,
	onBlur,
	noStudents,
}: {
	studentId: string
	chooseStudent: (value: string) => void
	pending: boolean
	blocked: boolean
	studentRef: RefObject<HTMLButtonElement | null>
	students: StudentsState
	active: StudentLessonOption[]
	error: string | undefined
	onBlur: () => void
	noStudents: boolean
}) {
	const failed = students.kind === 'error'
	const helper = failed
		? 'Could not load students. Close this window and try again.'
		: noStudents
			? 'No active students. Add a card on the Students page.'
			: error
	const destructive = failed || (!noStudents && error !== undefined)
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<label htmlFor="new-lesson-student" className="text-body text-muted-foreground">
				Student
			</label>
			<Select value={studentId} onValueChange={chooseStudent} disabled={pending || blocked}>
				<SelectTrigger
					ref={studentRef}
					id="new-lesson-student"
					className="w-full min-w-0"
					placeholder={students.kind === 'loading' ? 'Loading students…' : 'Choose a student'}
					autoFocus
					aria-invalid={destructive || undefined}
					aria-describedby="new-lesson-student-helper"
					onBlur={onBlur}
				/>
				<SelectContent>
					{active.map((student, index) => (
						<SelectItem key={student.id} index={index} value={student.id}>
							{student.displayName}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<p
				id="new-lesson-student-helper"
				data-slot="new-lesson-student-helper"
				className={cn('min-h-4 text-caption', destructive ? 'text-destructive' : 'text-muted-foreground')}
			>
				{helper}
			</p>
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
