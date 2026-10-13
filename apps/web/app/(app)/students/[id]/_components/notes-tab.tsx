'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Pencil } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { MarkdownView } from '@/components/app/markdown-view'
import { ReadError } from '@/components/app/read-error'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api-client'

import {
	SECTION_BODY_MAX_LENGTH,
	SECTION_KINDS,
	type SectionKind,
	type StudentDetail,
	type StudentNote,
	type StudentNotesResponse,
	type StudentSection,
	type StudentSectionResponse,
	type StudentSectionsResponse,
} from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'
import { NoteEntries, type NotesState } from './note-entries'

export type SectionDrafts = Partial<Record<SectionKind, string>>

const TITLES: Record<SectionKind, string> = {
	general_info: 'General info',
	interests: 'Interests',
	level: 'Level',
	goals: 'Goals',
	typical_mistakes: 'Typical mistakes',
	lesson_ideas: 'Lesson ideas',
}

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; sections: StudentSection[] }

async function readSections(studentId: string): Promise<ReadState> {
	const result = await apiRequest<StudentSectionsResponse>('GET', `/students/${studentId}/sections`)
	return result.ok ? { kind: 'ready', sections: result.data.sections } : { kind: 'error' }
}

async function readNotes(studentId: string): Promise<NotesState> {
	const result = await apiRequest<StudentNotesResponse>('GET', `/students/${studentId}/notes`)
	return result.ok ? { kind: 'ready', notes: result.data.notes } : { kind: 'error' }
}

function LoadingPanels() {
	return (
		<div className="flex flex-col gap-4 md:gap-6">
			{SECTION_KINDS.map((kind) => (
				<Panel
					key={kind}
					title={TITLES[kind]}
					action={
						<Button variant="ghost" size="compact" leadingIcon={Pencil} disabled>
							Edit
						</Button>
					}
				>
					<div className="flex flex-col gap-2 px-4 pb-4">
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-3/5" />
					</div>
				</Panel>
			))}
		</div>
	)
}

interface SectionPanelProps {
	student: StudentDetail
	section: StudentSection
	draft: string | undefined
	onDraft: (kind: SectionKind, value: string | undefined) => void
	onSaved: (section: StudentSection) => void
	notes: NotesState
	timeZone: string
	now: Date
	onReloadNotes: () => Promise<void>
	onNoteRemoved: (note: StudentNote) => void
}

function SectionPanel({
	student,
	section,
	draft,
	onDraft,
	onSaved,
	notes,
	timeZone,
	now,
	onReloadNotes,
	onNoteRemoved,
}: SectionPanelProps) {
	const toast = useToast()
	const title = TITLES[section.kind]
	const [pending, setPending] = useState(false)
	const [failed, setFailed] = useState(false)
	const [showError, setShowError] = useState(false)
	const editButton = useRef<HTMLButtonElement>(null)
	const textarea = useRef<HTMLTextAreaElement>(null)
	const editing = draft !== undefined
	const tooLong = editing && Array.from(draft).length > SECTION_BODY_MAX_LENGTH
	const error = showError && tooLong ? 'Use 20,000 characters or fewer.' : undefined
	const errorId = `section-${section.kind}-error`

	function startEdit() {
		onDraft(section.kind, section.body)
		requestAnimationFrame(() => textarea.current?.focus())
	}

	function discard() {
		if (pending) return
		onDraft(section.kind, undefined)
		setFailed(false)
		setShowError(false)
		requestAnimationFrame(() => editButton.current?.focus())
	}

	async function save() {
		if (pending || draft === undefined) return
		setShowError(true)
		setFailed(false)
		if (tooLong) {
			textarea.current?.focus()
			return
		}
		setPending(true)
		const result = await apiRequest<StudentSectionResponse>('PUT', `/students/${student.id}/sections/${section.kind}`, {
			body: draft,
		})
		setPending(false)
		if (!result.ok) {
			setFailed(true)
			return
		}
		toast.show({ title: 'Section saved', description: `${title} on ${student.displayName}'s card.` })
		setShowError(false)
		onSaved(result.data.section)
		requestAnimationFrame(() => editButton.current?.focus())
	}

	const entries = (
		<NoteEntries
			studentId={student.id}
			studentName={student.displayName}
			sectionKind={section.kind}
			sectionTitle={title}
			state={notes}
			timeZone={timeZone}
			now={now}
			onReload={onReloadNotes}
			onRemoved={onNoteRemoved}
			onFocusSection={() => (editButton.current ?? textarea.current)?.focus()}
		/>
	)

	return (
		<Panel
			id={`section-${section.kind}`}
			title={title}
			action={
				editing ? undefined : (
					<Button ref={editButton} variant="ghost" size="compact" leadingIcon={Pencil} onClick={startEdit}>
						Edit
					</Button>
				)
			}
		>
			{editing ? (
				<div className="flex flex-col gap-2 px-4 pb-4">
					{failed ? (
						<Banner status="error">
							<BannerTitle>Could not save the section. Try again.</BannerTitle>
						</Banner>
					) : null}
					<Textarea
						ref={textarea}
						className="min-h-32"
						aria-label={title}
						aria-invalid={error ? true : undefined}
						aria-describedby={error ? errorId : undefined}
						value={draft}
						onChange={(event) => onDraft(section.kind, event.target.value)}
						onBlur={() => setShowError(true)}
						disabled={pending}
					/>
					{error ? (
						<p id={errorId} className="text-caption text-destructive">
							{error}
						</p>
					) : null}
					<p className="text-caption text-muted-foreground">
						Notes added later are listed under the section. They are not part of this text.
					</p>
					<div className="flex justify-end gap-2">
						<Button type="button" variant="secondary" size="compact" onClick={discard} disabled={pending}>
							Discard changes
						</Button>
						<Button type="button" size="compact" loading={pending} onClick={() => void save()}>
							{pending ? 'Saving…' : 'Save section'}
						</Button>
					</div>
					{entries}
				</div>
			) : (
				<div className="flex flex-col gap-2 px-4 pb-4">
					<div className="w-0 min-w-full">
						<MarkdownView body={section.body} />
					</div>
					{entries}
				</div>
			)}
		</Panel>
	)
}

interface NotesTabProps {
	student: StudentDetail
	drafts: SectionDrafts
	timeZone: string
	asOf: string
	onDraftChange: (kind: SectionKind, value: string | undefined) => void
}

export function NotesTab({ student, drafts, timeZone, asOf, onDraftChange }: NotesTabProps) {
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [notes, setNotes] = useState<NotesState>({ kind: 'loading' })
	const studentId = student.id
	const now = new Date(asOf)

	const reloadNotes = useCallback(async () => {
		setNotes(await readNotes(studentId))
	}, [studentId])

	function noteRemoved(note: StudentNote) {
		setNotes((previous) =>
			previous.kind === 'ready'
				? { kind: 'ready', notes: previous.notes.filter((item) => item.id !== note.id) }
				: previous
		)
	}

	const load = useCallback(async () => {
		setState(await readSections(studentId))
	}, [studentId])

	useEffect(() => {
		let current = true
		void readSections(studentId).then((next) => {
			if (current) setState(next)
		})
		return () => {
			current = false
		}
	}, [studentId])

	useEffect(() => {
		let current = true
		void readNotes(studentId).then((next) => {
			if (current) setNotes(next)
		})
		return () => {
			current = false
		}
	}, [studentId])

	function saved(section: StudentSection) {
		onDraftChange(section.kind, undefined)
		setState((previous) =>
			previous.kind === 'ready'
				? { kind: 'ready', sections: previous.sections.map((item) => (item.kind === section.kind ? section : item)) }
				: previous
		)
	}

	if (state.kind === 'loading') return <LoadingPanels />
	if (state.kind === 'error') return <ReadError screen="notes" onRefresh={load} />

	return (
		<div className="flex flex-col gap-4 md:gap-6">
			{state.sections.map((section) => (
				<SectionPanel
					key={section.kind}
					student={student}
					section={section}
					draft={drafts[section.kind]}
					onDraft={onDraftChange}
					onSaved={saved}
					notes={notes}
					timeZone={timeZone}
					now={now}
					onReloadNotes={reloadNotes}
					onNoteRemoved={noteRemoved}
				/>
			))}
		</div>
	)
}
