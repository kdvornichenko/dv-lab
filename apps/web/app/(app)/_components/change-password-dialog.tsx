'use client'

import { useRef, useState, type FormEvent } from 'react'

import { useRouter } from 'next/navigation'

import { PasswordField } from '@/components/app/text-field'
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

import { changePasswordRequest } from '@dv-lab/contracts'

import { useToast } from './toasts'

type Field = 'current' | 'next' | 'confirm'
type Errors = Partial<Record<Field, string>>

function validate(current: string, next: string, confirm: string): Errors {
	const errors: Errors = {}
	if (current === '') errors.current = 'Enter your current password.'
	if (!changePasswordRequest.shape.newPassword.safeParse(next).success) errors.next = 'Use 10 to 128 characters.'
	else if (next === current) errors.next = 'Choose a password different from the current one.'
	if (confirm !== next) errors.confirm = 'Passwords do not match.'
	return errors
}

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
	const router = useRouter()
	const toast = useToast()
	const [current, setCurrent] = useState('')
	const [next, setNext] = useState('')
	const [confirm, setConfirm] = useState('')
	const [submitted, setSubmitted] = useState(false)
	const [serverErrors, setServerErrors] = useState<Errors>({})
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)
	const currentRef = useRef<HTMLInputElement>(null)
	const nextRef = useRef<HTMLInputElement>(null)
	const confirmRef = useRef<HTMLInputElement>(null)

	const errors = validate(current, next, confirm)
	const shown = (field: Field) => serverErrors[field] ?? (submitted ? errors[field] : undefined)

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending) return
		setSubmitted(true)
		setFailed(false)
		if (errors.current) return currentRef.current?.focus()
		if (errors.next) return nextRef.current?.focus()
		if (errors.confirm) return confirmRef.current?.focus()
		setServerErrors({})
		setPending(true)
		const result = await apiRequest<void>('POST', '/auth/change-password', {
			currentPassword: current,
			newPassword: next,
		})
		setPending(false)
		if (result.ok) {
			toast.show({ title: 'Password changed', description: 'Your other sessions were signed out.' })
			onClose()
			router.refresh()
			return
		}
		if (result.error?.code === 'wrong_current_password') {
			setServerErrors({ current: 'Wrong current password' })
			setCurrent('')
			currentRef.current?.focus()
		} else if (result.error?.code === 'password_unchanged') {
			setServerErrors({ next: 'Choose a password different from the current one.' })
			nextRef.current?.focus()
		} else {
			setFailed(true)
		}
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DialogContent size="sm">
				<form noValidate onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Change password</DialogTitle>
						<DialogDescription>Your other sessions will be signed out.</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						{failed ? (
							<Banner status="error">
								<BannerTitle>Could not change the password. Try again.</BannerTitle>
							</Banner>
						) : null}
						<PasswordField
							ref={currentRef}
							id="current-password"
							name="currentPassword"
							label="Current password"
							autoComplete="current-password"
							autoFocus
							value={current}
							onChange={(event) => {
								setCurrent(event.target.value)
								setServerErrors((existing) => ({ ...existing, current: undefined }))
							}}
							disabled={pending}
							error={shown('current')}
						/>
						<PasswordField
							ref={nextRef}
							id="new-password"
							name="newPassword"
							label="New password"
							autoComplete="new-password"
							helper="10 to 128 characters."
							value={next}
							onChange={(event) => {
								setNext(event.target.value)
								setServerErrors((existing) => ({ ...existing, next: undefined }))
							}}
							disabled={pending}
							error={shown('next')}
						/>
						<PasswordField
							ref={confirmRef}
							id="confirm-password"
							name="confirmPassword"
							label="Confirm new password"
							autoComplete="new-password"
							value={confirm}
							onChange={(event) => setConfirm(event.target.value)}
							disabled={pending}
							error={shown('confirm')}
						/>
					</div>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
							Discard changes
						</Button>
						<Button type="submit" loading={pending}>
							{pending ? 'Changing…' : 'Change password'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
