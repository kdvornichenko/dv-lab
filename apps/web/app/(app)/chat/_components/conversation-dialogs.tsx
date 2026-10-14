'use client'

import { useId, useRef, useState, type FormEvent } from 'react'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { TextField } from '@/components/app/text-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { CHAT_TITLE_MAX, type ChatConversation } from '@dv-lab/contracts'

import type { DeleteOutcome, RenameOutcome } from './use-chat'

const RENAME_FAILED = 'Could not rename this conversation. Try again.'
const DELETE_FAILED = 'Could not delete this conversation. Try again.'
const DELETE_BLOCKED = 'This chat has an unconfirmed request or usage record. Check its status before deleting.'

interface RenameConversationDialogProps {
	conversation: ChatConversation
	onSave: (title: string) => Promise<RenameOutcome>
	onClose: () => void
}

export function RenameConversationDialog({ conversation, onSave, onClose }: RenameConversationDialogProps) {
	const fieldId = useId()
	const [title, setTitle] = useState(conversation.title)
	const [opened] = useState(conversation.title)
	const [pending, setPending] = useState(false)
	const [failed, setFailed] = useState(false)
	const [empty, setEmpty] = useState(false)
	const trimmed = title.trim()
	const tooLong = Array.from(trimmed).length > CHAT_TITLE_MAX
	const error = tooLong
		? `Use ${CHAT_TITLE_MAX} characters or fewer.`
		: empty && trimmed === ''
			? 'Enter a title.'
			: failed
				? RENAME_FAILED
				: undefined

	async function submit(event: FormEvent) {
		event.preventDefault()
		if (pending || tooLong) return
		if (trimmed === '') {
			setEmpty(true)
			return
		}
		if (trimmed === conversation.title || trimmed === opened) {
			onClose()
			return
		}
		setFailed(false)
		setPending(true)
		const outcome = await onSave(trimmed)
		setPending(false)
		if (outcome === 'failed') setFailed(true)
		else onClose()
	}

	return (
		<Dialog
			open
			disablePointerDismissal
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="sm" showCloseButton={false}>
				<form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>Rename conversation</DialogTitle>
					</DialogHeader>
					<TextField
						id={fieldId}
						label="Conversation title"
						value={title}
						autoFocus
						autoComplete="off"
						readOnly={pending}
						error={error}
						onFocus={(event) => event.currentTarget.select()}
						onChange={(event) => {
							setTitle(event.target.value)
							setFailed(false)
							setEmpty(false)
						}}
					/>
					<DialogFooter>
						<Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
							Keep title
						</Button>
						<Button type="submit" variant="primary" loading={pending} disabled={tooLong}>
							Save title
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

interface DeleteConversationDialogProps {
	conversation: ChatConversation
	onDelete: () => Promise<DeleteOutcome>
	onClose: (deleted: boolean) => void
}

export function DeleteConversationDialog({ conversation, onDelete, onClose }: DeleteConversationDialogProps) {
	const deleted = useRef(false)
	const [blocked, setBlocked] = useState(false)
	return (
		<ConfirmDialog
			key={conversation.id}
			title="Delete this conversation?"
			body="This conversation will be removed from your chat list. Lesson records, student notes and calendar changes stay."
			cancelLabel="Keep conversation"
			confirmLabel="Delete conversation"
			pendingLabel="Deleting…"
			tone="destructive"
			failureText={blocked ? DELETE_BLOCKED : DELETE_FAILED}
			failureLine
			onConfirm={async () => {
				const outcome = await onDelete()
				setBlocked(outcome === 'busy')
				deleted.current = outcome === 'deleted'
				return deleted.current
			}}
			onClose={() => onClose(deleted.current)}
		/>
	)
}
