'use client'

import { useRef, useState, type FormEvent, type RefObject } from 'react'

import { TextField } from '@/components/app/text-field'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api-client'

import {
	TERM_MAX_LENGTH,
	TERM_NOTE_MAX_LENGTH,
	normalizeDisplayName,
	type StudentDetail,
	type StudentTerm,
	type StudentTermResponse,
} from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'

const lengthOf = (value: string) => Array.from(value).length

function noteErrorOf(note: string) {
	return lengthOf(note.trim()) > TERM_NOTE_MAX_LENGTH ? 'Use 2,000 characters or fewer.' : undefined
}

interface NoteFieldProps {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	onBlur: () => void
	error: string | undefined
	disabled: boolean
	autoFocus?: boolean
	textareaRef: RefObject<HTMLTextAreaElement | null>
}

function NoteField({ id, label, value, onChange, onBlur, error, disabled, autoFocus, textareaRef }: NoteFieldProps) {
	const errorId = `${id}-error`
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<label htmlFor={id} className="text-body text-muted-foreground">
				{label}
			</label>
			<Textarea
				ref={textareaRef}
				id={id}
				name="note"
				className="max-h-[40dvh] min-h-16 overflow-y-auto"
				autoComplete="off"
				autoFocus={autoFocus}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onBlur={onBlur}
				disabled={disabled}
			/>
			{error ? (
				<p id={errorId} className="text-caption text-destructive">
					{error}
				</p>
			) : null}
		</div>
	)
}

interface AddTermDialogProps {
	student: StudentDetail
	onClose: () => void
	onAdded: () => void
}

export function AddTermDialog({ student, onClose, onAdded }: AddTermDialogProps) {
	const toast = useToast()
	const [term, setTerm] = useState('')
	const [note, setNote] = useState('')
	const [exists, setExists] = useState(false)
	const [touched, setTouched] = useState({ term: false, note: false })
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)
	const termRef = useRef<HTMLInputElement>(null)
	const noteRef = useRef<HTMLTextAreaElement>(null)

	const normalized = normalizeDisplayName(term)
	const termError =
		normalized === ''
			? 'Enter a term.'
			: lengthOf(normalized) > TERM_MAX_LENGTH
				? 'Use 200 characters or fewer.'
				: exists
					? 'This term is already on the card.'
					: undefined
	const noteError = noteErrorOf(note)
	const shownTerm = submitted || touched.term || exists ? termError : undefined
	const shownNote = submitted || touched.note ? noteError : undefined

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending) return
		setSubmitted(true)
		setFailed(false)
		if (termError) return termRef.current?.focus()
		if (noteError) return noteRef.current?.focus()
		setPending(true)
		const result = await apiRequest<StudentTermResponse>('POST', `/students/${student.id}/terms`, { term, note })
		setPending(false)
		if (!result.ok) {
			if (result.status === 409 && result.error?.code === 'term_exists') {
				setExists(true)
				requestAnimationFrame(() => termRef.current?.focus())
				return
			}
			setFailed(true)
			return
		}
		toast.show({ title: 'Term added', description: `${result.data.term.term} is on ${student.displayName}'s card.` })
		onAdded()
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="sm">
				<form noValidate onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Add term</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						{failed ? (
							<Banner status="error">
								<BannerTitle>Could not add the term. Try again.</BannerTitle>
							</Banner>
						) : null}
						<TextField
							ref={termRef}
							id="add-term-term"
							name="term"
							label="Term"
							autoComplete="off"
							autoFocus
							value={term}
							onChange={(event) => {
								setTerm(event.target.value)
								setExists(false)
							}}
							onBlur={() => setTouched((current) => ({ ...current, term: true }))}
							disabled={pending}
							error={shownTerm}
						/>
						<NoteField
							id="add-term-note"
							label="Note (optional)"
							value={note}
							onChange={setNote}
							onBlur={() => setTouched((current) => ({ ...current, note: true }))}
							error={shownNote}
							disabled={pending}
							textareaRef={noteRef}
						/>
					</div>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
							Discard changes
						</Button>
						<Button type="submit" loading={pending}>
							{pending ? 'Adding…' : 'Add term'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

interface EditNoteDialogProps {
	student: StudentDetail
	term: StudentTerm
	onClose: () => void
	onSaved: () => void
}

export function EditNoteDialog({ student, term, onClose, onSaved }: EditNoteDialogProps) {
	const toast = useToast()
	const [note, setNote] = useState(term.note ?? '')
	const [touched, setTouched] = useState(false)
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)
	const noteRef = useRef<HTMLTextAreaElement>(null)

	const noteError = noteErrorOf(note)
	const shownNote = submitted || touched ? noteError : undefined

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending) return
		setSubmitted(true)
		setFailed(false)
		if (noteError) return noteRef.current?.focus()
		setPending(true)
		const result = await apiRequest<StudentTermResponse>('PATCH', `/students/${student.id}/terms/${term.id}`, { note })
		setPending(false)
		if (!result.ok) {
			setFailed(true)
			return
		}
		toast.show({ title: 'Note saved', description: `${term.term} was updated.` })
		onSaved()
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="sm">
				<form noValidate onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Edit note</DialogTitle>
						<DialogDescription className="wrap-anywhere">{term.term}</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						{failed ? (
							<Banner status="error">
								<BannerTitle>Could not save the note. Try again.</BannerTitle>
							</Banner>
						) : null}
						<NoteField
							id="edit-note-note"
							label="Note"
							value={note}
							onChange={setNote}
							onBlur={() => setTouched(true)}
							error={shownNote}
							disabled={pending}
							autoFocus
							textareaRef={noteRef}
						/>
					</div>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
							Discard changes
						</Button>
						<Button type="submit" loading={pending}>
							{pending ? 'Saving…' : 'Save note'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
