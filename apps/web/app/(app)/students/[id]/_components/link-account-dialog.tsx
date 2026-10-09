'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { apiRequest } from '@/lib/api-client'

import type { AccountCandidatesResponse, StudentAccount, StudentAccountResponse } from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'

interface LinkAccountDialogProps {
	studentId: string
	name: string
	onClose: () => void
	onLinked: () => void
	onConflict: () => void
}

type Failure = 'linked' | 'has_account' | 'other'

const failureText: Record<Failure, string> = {
	linked: 'This account is already linked to a card.',
	has_account: 'This card already has an account.',
	other: 'Could not link the account. Try again.',
}

async function readCandidates(studentId: string) {
	const result = await apiRequest<AccountCandidatesResponse>('GET', `/students/${studentId}/account/candidates`)
	return result.ok ? result.data.accounts : null
}

export function LinkAccountDialog({ studentId, name, onClose, onLinked, onConflict }: LinkAccountDialogProps) {
	const toast = useToast()
	const [candidates, setCandidates] = useState<StudentAccount[] | null>(null)
	const [loadFailed, setLoadFailed] = useState(false)
	const [accountId, setAccountId] = useState('')
	const [submitted, setSubmitted] = useState(false)
	const [failure, setFailure] = useState<Failure | null>(null)
	const [pending, setPending] = useState(false)
	const triggerRef = useRef<HTMLButtonElement>(null)

	async function refreshCandidates() {
		const list = await readCandidates(studentId)
		setLoadFailed(list === null)
		setCandidates(list ?? [])
		setAccountId((current) => (list?.some((account) => account.id === current) ? current : ''))
	}

	useEffect(() => {
		let current = true
		void readCandidates(studentId).then((list) => {
			if (!current) return
			setLoadFailed(list === null)
			setCandidates(list ?? [])
		})
		return () => {
			current = false
		}
	}, [studentId])

	const loading = candidates === null
	const empty = candidates !== null && candidates.length === 0
	const error = submitted && accountId === '' && !empty ? 'Choose an account.' : undefined

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending || loading || empty) return
		setSubmitted(true)
		setFailure(null)
		if (accountId === '') return triggerRef.current?.focus()
		setPending(true)
		const result = await apiRequest<StudentAccountResponse>('POST', `/students/${studentId}/account/link`, {
			accountId,
		})
		setPending(false)
		if (!result.ok) {
			const code = result.error?.code
			if (code === 'account_already_linked' || code === 'card_has_account') {
				setFailure(code === 'account_already_linked' ? 'linked' : 'has_account')
				onConflict()
				void refreshCandidates()
			} else setFailure('other')
			return
		}
		toast.show({
			title: 'Account linked',
			description: `${result.data.account.displayName} is linked to ${name}.`,
		})
		onLinked()
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
						<DialogTitle>Link existing account</DialogTitle>
						<DialogDescription>
							Choose a student account that is not linked to any card. Linking cannot be undone in the app.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						{failure === null && !loadFailed ? null : (
							<Banner status="error">
								<BannerTitle>{failureText[failure ?? 'other']}</BannerTitle>
							</Banner>
						)}
						<div className="flex min-w-0 flex-col gap-2">
							<label htmlFor="link-account-select" className="text-body text-muted-foreground">
								Account
							</label>
							<Select
								value={accountId}
								onValueChange={(value) => setAccountId(value)}
								disabled={pending || loading || empty}
							>
								<SelectTrigger
									ref={triggerRef}
									id="link-account-select"
									className="w-full min-w-0"
									placeholder={loading ? 'Loading accounts…' : 'Choose an account'}
									autoFocus
									error={error}
								/>
								<SelectContent>
									{(candidates ?? []).map((account, index) => (
										<SelectItem key={account.id} index={index} value={account.id}>
											{account.displayName} · {account.login}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{empty && !loadFailed ? (
								<p className="text-caption text-muted-foreground">No unlinked student accounts.</p>
							) : null}
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
							Discard changes
						</Button>
						<Button type="submit" loading={pending} disabled={loading || empty}>
							{pending ? 'Linking…' : 'Link account'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
