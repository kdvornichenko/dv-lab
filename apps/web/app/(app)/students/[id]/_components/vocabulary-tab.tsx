'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Pencil, Plus, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyLine } from '@/components/app/empty-line'
import { ReadError } from '@/components/app/read-error'
import { Button } from '@/components/ui/button'
import { SkeletonTable } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'

import type { StudentDetail, StudentTerm, StudentTermsResponse } from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'
import { AddTermDialog, EditNoteDialog } from './term-dialogs'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; terms: StudentTerm[] }

async function readTerms(studentId: string): Promise<ReadState> {
	const result = await apiRequest<StudentTermsResponse>('GET', `/students/${studentId}/terms`)
	return result.ok ? { kind: 'ready', terms: result.data.terms } : { kind: 'error' }
}

const headClass = 'px-4 text-body font-normal text-muted-foreground'
const cellClass = 'px-4 py-2 align-top text-body wrap-anywhere'

export function VocabularyTab({ student }: { student: StudentDetail }) {
	const toast = useToast()
	const studentId = student.id
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [adding, setAdding] = useState(false)
	const [editing, setEditing] = useState<StudentTerm | null>(null)
	const [removing, setRemoving] = useState<StudentTerm | null>(null)
	const addButton = useRef<HTMLButtonElement>(null)

	const load = useCallback(async () => {
		setState(await readTerms(studentId))
	}, [studentId])

	useEffect(() => {
		let current = true
		void readTerms(studentId).then((next) => {
			if (current) setState(next)
		})
		return () => {
			current = false
		}
	}, [studentId])

	function focusAfter(id?: string) {
		requestAnimationFrame(() => {
			const target = (id ? document.getElementById(id) : null) ?? addButton.current
			target?.focus()
		})
	}

	async function remove(term: StudentTerm) {
		const result = await apiRequest<undefined>('DELETE', `/students/${studentId}/terms/${term.id}`)
		if (!result.ok) {
			if (result.status === 404) void load()
			return false
		}
		toast.show({ title: 'Term deleted', description: `${term.term} was removed.` })
		await load()
		return true
	}

	if (state.kind === 'loading') return <SkeletonTable />
	if (state.kind === 'error') return <ReadError screen="vocabulary" onRefresh={load} />

	const { terms } = state
	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-2">
				<p className="text-body text-foreground tabular-nums">
					{terms.length === 1 ? '1 term' : `${terms.length} terms`}
				</p>
				<Button ref={addButton} variant="secondary" leadingIcon={Plus} onClick={() => setAdding(true)}>
					Add term
				</Button>
			</div>
			{terms.length === 0 ? (
				<EmptyLine />
			) : (
				<Elevated offset={1} shadowLevel={2} className="w-0 min-w-full overflow-hidden rounded-2xl">
					<Table className="text-body">
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className={headClass}>Term</TableHead>
								<TableHead className={headClass}>Note</TableHead>
								<TableHead className={headClass}>
									<span className="sr-only">Actions</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{terms.map((term) => (
								<TableRow key={term.id}>
									<TableCell className={`${cellClass} min-w-40 whitespace-normal`}>{term.term}</TableCell>
									<TableCell className={`${cellClass} min-w-64 whitespace-normal text-muted-foreground`}>
										{term.note}
									</TableCell>
									<TableCell className={cellClass}>
										<div className="flex justify-end gap-1">
											<Tooltip content="Edit note">
												<Button
													id={`edit-term-${term.id}`}
													variant="ghost"
													size="icon-compact"
													aria-label={`Edit note for ${term.term}`}
													onClick={() => setEditing(term)}
												>
													<Pencil />
												</Button>
											</Tooltip>
											<Tooltip content="Delete term">
												<Button
													id={`delete-term-${term.id}`}
													variant="ghost"
													size="icon-compact"
													aria-label={`Delete ${term.term}`}
													onClick={() => setRemoving(term)}
												>
													<Trash2 />
												</Button>
											</Tooltip>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Elevated>
			)}
			{adding ? (
				<AddTermDialog
					student={student}
					onClose={() => {
						setAdding(false)
						focusAfter()
					}}
					onAdded={() => {
						setAdding(false)
						void load()
						focusAfter()
					}}
				/>
			) : null}
			{editing ? (
				<EditNoteDialog
					student={student}
					term={editing}
					onClose={() => {
						setEditing(null)
						focusAfter(`edit-term-${editing.id}`)
					}}
					onSaved={() => {
						setEditing(null)
						void load()
						focusAfter(`edit-term-${editing.id}`)
					}}
				/>
			) : null}
			{removing ? (
				<ConfirmDialog
					title={`Delete "${removing.term}"?`}
					body="The term and its note are removed from this card."
					cancelLabel="Keep term"
					confirmLabel="Delete term"
					pendingLabel="Deleting…"
					tone="destructive"
					failureText="Could not delete the term. Try again."
					onConfirm={() => remove(removing)}
					onClose={() => {
						setRemoving(null)
						focusAfter(`delete-term-${removing.id}`)
					}}
				/>
			) : null}
		</div>
	)
}
