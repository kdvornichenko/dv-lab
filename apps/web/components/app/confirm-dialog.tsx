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

interface ConfirmDialogProps {
	title: string
	body: string
	cancelLabel: string
	confirmLabel: string
	pendingLabel: string
	tone: 'primary' | 'destructive'
	failureText: string
	failureLine?: boolean
	onConfirm: () => Promise<boolean>
	onClose: () => void
}

export function ConfirmDialog({
	title,
	body,
	cancelLabel,
	confirmLabel,
	pendingLabel,
	tone,
	failureText,
	failureLine = false,
	onConfirm,
	onClose,
}: ConfirmDialogProps) {
	const [pending, setPending] = useState(false)
	const [failed, setFailed] = useState(false)

	async function confirm() {
		if (pending) return
		setFailed(false)
		setPending(true)
		const done = await onConfirm()
		setPending(false)
		if (done) onClose()
		else setFailed(true)
	}

	return (
		<Dialog
			open
			disablePointerDismissal
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="sm" phone="sheet" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{body}</DialogDescription>
				</DialogHeader>
				{failed && failureLine ? (
					<p role="alert" className="mt-4 text-body text-destructive">
						{failureText}
					</p>
				) : failed ? (
					<Banner status="error">
						<BannerTitle>{failureText}</BannerTitle>
					</Banner>
				) : null}
				<DialogFooter className={failed && failureLine ? 'mt-2' : undefined}>
					<Button type="button" variant="secondary" autoFocus onClick={onClose} disabled={pending}>
						{cancelLabel}
					</Button>
					<Button
						type="button"
						variant={tone === 'primary' ? 'primary' : 'tertiary'}
						className={tone === 'destructive' ? 'text-destructive' : undefined}
						loading={pending}
						onClick={() => void confirm()}
					>
						{pending ? pendingLabel : confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
