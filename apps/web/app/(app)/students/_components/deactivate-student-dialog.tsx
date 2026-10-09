'use client'

import { useState } from 'react'

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
import { apiRequest } from '@/lib/api-client'

import type { DeactivateStudentResponse, StudentRow } from '@dv-lab/contracts'

interface DeactivateStudentDialogProps {
	student: StudentRow
	onClose: () => void
	onDeactivated: (student: StudentRow) => void
}

export function DeactivateStudentDialog({ student, onClose, onDeactivated }: DeactivateStudentDialogProps) {
	const [pending, setPending] = useState(false)
	const [failed, setFailed] = useState(false)

	async function deactivate() {
		if (pending) return
		setFailed(false)
		setPending(true)
		const result = await apiRequest<DeactivateStudentResponse>('POST', `/students/${student.id}/deactivate`)
		setPending(false)
		if (!result.ok) {
			setFailed(true)
			return
		}
		onDeactivated(result.data.student)
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DialogContent size="sm">
				<DialogHeader>
					<DialogTitle>Deactivate {student.displayName}?</DialogTitle>
					<DialogDescription>
						{student.displayName} will be signed out on every device and cannot sign in again. This cannot be undone in
						the app.
					</DialogDescription>
				</DialogHeader>
				{failed ? (
					<Banner status="error">
						<BannerTitle>Could not deactivate the account. Try again.</BannerTitle>
					</Banner>
				) : null}
				<DialogFooter>
					<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
						Keep account
					</Button>
					<Button
						type="button"
						variant="tertiary"
						className="text-destructive"
						loading={pending}
						onClick={() => void deactivate()}
					>
						{pending ? 'Deactivating…' : 'Deactivate account'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
