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

import type { StudentAccount, StudentAccountResponse } from '@dv-lab/contracts'

interface DeactivateStudentDialogProps {
	studentId: string
	account: StudentAccount
	onClose: () => void
	onDeactivated: (account: StudentAccount) => void
}

export function DeactivateStudentDialog({ studentId, account, onClose, onDeactivated }: DeactivateStudentDialogProps) {
	const [pending, setPending] = useState(false)
	const [failed, setFailed] = useState(false)

	async function deactivate() {
		if (pending) return
		setFailed(false)
		setPending(true)
		const result = await apiRequest<StudentAccountResponse>('POST', `/students/${studentId}/account/deactivate`, {
			accountId: account.id,
		})
		setPending(false)
		if (!result.ok) {
			setFailed(true)
			return
		}
		onDeactivated(result.data.account)
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
					<DialogTitle>Deactivate {account.displayName}?</DialogTitle>
					<DialogDescription>
						{account.displayName} will be signed out on every device and cannot sign in again. This cannot be undone in
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
