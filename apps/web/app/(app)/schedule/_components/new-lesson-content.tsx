import type { RefObject } from 'react'

import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

import type { LessonRepeats, StudentRow } from '@dv-lab/contracts'

import type { StudentsState } from './new-lesson-dialog'

export function NewLessonNotices({ students, failed }: { students: StudentsState; failed: boolean }) {
	return (
		<>
			{students.kind === 'error' ? (
				<Banner status="error">
					<BannerTitle>Could not load students. Close this window and try again.</BannerTitle>
				</Banner>
			) : null}
			{failed ? (
				<Banner status="error">
					<BannerTitle>Could not add the lesson. Try again.</BannerTitle>
				</Banner>
			) : null}
		</>
	)
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
	active: StudentRow[]
	error: string | undefined
	onBlur: () => void
	noStudents: boolean
}) {
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
					error={error}
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
			{noStudents ? (
				<p className="text-caption text-muted-foreground">No active students. Add a card on the Students page.</p>
			) : null}
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
