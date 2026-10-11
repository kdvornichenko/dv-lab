import type { RefObject } from 'react'

import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { mainRange } from '@/lib/schedule-format'

import type { LessonRepeats, StudentRow } from '@dv-lab/contracts'

import type { OverlapBlock, StudentsState } from './new-lesson-dialog'

function clashText(items: readonly OverlapBlock[], mainTimeZone: string): string {
	const label = (item: OverlapBlock) =>
		`${item.studentName} ${mainRange(item.startsAt, item.durationMinutes, mainTimeZone, null)}`
	if (items.length === 1) return `${label(items[0])}. You can still save.`
	if (items.length === 2) return `${label(items[0])} and ${label(items[1])}. You can still save.`
	return `${label(items[0])}, ${label(items[1])} and ${items.length - 2} more. You can still save.`
}

export function NewLessonNotices({
	students,
	failed,
	clashes,
	mainTimeZone,
}: {
	students: StudentsState
	failed: boolean
	clashes: OverlapBlock[]
	mainTimeZone: string
}) {
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
			{clashes.length > 0 ? (
				<Banner status="warning" data-slot="new-lesson-overlap">
					<BannerTitle>This overlaps another lesson</BannerTitle>
					<BannerDescription>{clashText(clashes, mainTimeZone)}</BannerDescription>
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
