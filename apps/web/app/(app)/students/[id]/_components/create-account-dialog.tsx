'use client'

import { useRef, useState, type FormEvent } from 'react'

import { PasswordField, TextField } from '@/components/app/text-field'
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

import {
	MANUAL_PASSWORD_MAX_LENGTH,
	MANUAL_PASSWORD_MIN_LENGTH,
	isStudentLogin,
	normalizeLogin,
	passwordLength,
	type CreateStudentAccountResponse,
} from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'
import { RevealBody, type Revealed } from './reveal-body'

interface CreateAccountDialogProps {
	studentId: string
	name: string
	onClose: () => void
	onCreated: () => void
	onConflict: () => void
}

type Field = 'login' | 'password'

function validate(login: string, password: string): Partial<Record<Field, string>> {
	const errors: Partial<Record<Field, string>> = {}
	if (!isStudentLogin(normalizeLogin(login))) {
		errors.login = 'Use 3–32 lowercase letters, digits, dots, underscores or hyphens.'
	}
	if (password !== '') {
		const length = passwordLength(password)
		if (length < MANUAL_PASSWORD_MIN_LENGTH || length > MANUAL_PASSWORD_MAX_LENGTH) {
			errors.password = 'Use 10 to 128 characters.'
		}
	}
	return errors
}

export function CreateAccountDialog({ studentId, name, onClose, onCreated, onConflict }: CreateAccountDialogProps) {
	const toast = useToast()
	const [login, setLogin] = useState('')
	const [password, setPassword] = useState('')
	const [touched, setTouched] = useState<Record<Field, boolean>>({ login: false, password: false })
	const [submitted, setSubmitted] = useState(false)
	const [loginTaken, setLoginTaken] = useState(false)
	const [failure, setFailure] = useState<'conflict' | 'other' | null>(null)
	const [pending, setPending] = useState(false)
	const [revealed, setRevealed] = useState<Revealed | null>(null)
	const loginRef = useRef<HTMLInputElement>(null)
	const passwordRef = useRef<HTMLInputElement>(null)

	const errors = validate(login, password)
	const shown = (field: Field) => (submitted || touched[field] ? errors[field] : undefined)
	const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }))

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending) return
		setSubmitted(true)
		setFailure(null)
		if (errors.login) return loginRef.current?.focus()
		if (errors.password) return passwordRef.current?.focus()
		setLoginTaken(false)
		setPending(true)
		const result = await apiRequest<CreateStudentAccountResponse>('POST', `/students/${studentId}/account`, {
			login,
			password: password === '' ? undefined : password,
		})
		setPending(false)
		if (!result.ok) {
			setPassword('')
			const code = result.error?.code
			if (code === 'login_taken') setLoginTaken(true)
			else if (code === 'card_has_account') {
				setFailure('conflict')
				onConflict()
			} else setFailure('other')
			return
		}
		const { account, generatedPassword } = result.data
		if (generatedPassword) {
			setPassword('')
			setRevealed({ name, login: account.login, password: generatedPassword })
			return
		}
		toast.show({
			title: 'Account created',
			description: `${name} can sign in with the login ${account.login}.`,
		})
		onCreated()
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !revealed) onClose()
			}}
		>
			<DialogContent size="lg" showCloseButton={!revealed}>
				{revealed ? (
					<RevealBody revealed={revealed} onSaved={onCreated} />
				) : (
					<form noValidate onSubmit={onSubmit}>
						<DialogHeader>
							<DialogTitle>Create account for {name}</DialogTitle>
							<DialogDescription>The account uses this card&apos;s name and is linked to it.</DialogDescription>
						</DialogHeader>
						<div className="flex flex-col gap-4">
							{failure === null ? null : (
								<Banner status="error">
									<BannerTitle>
										{failure === 'conflict'
											? 'This card already has an account.'
											: 'Could not create the account. Try again.'}
									</BannerTitle>
								</Banner>
							)}
							<TextField
								ref={loginRef}
								id="card-account-login"
								name="login"
								label="Login"
								autoComplete="off"
								autoCapitalize="none"
								spellCheck={false}
								autoFocus
								helper="3–32 characters: lowercase letters, digits, dot, underscore, hyphen."
								value={login}
								onChange={(event) => {
									setLogin(event.target.value)
									setLoginTaken(false)
								}}
								onBlur={() => touch('login')}
								disabled={pending}
								error={loginTaken ? 'This login is already taken.' : shown('login')}
							/>
							<PasswordField
								ref={passwordRef}
								id="card-account-password"
								name="password"
								label="Password"
								autoComplete="new-password"
								helper="Leave empty to generate a 12-character password, or enter your own (10–128 characters)."
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								onBlur={() => touch('password')}
								disabled={pending}
								error={shown('password')}
							/>
						</div>
						<DialogFooter>
							<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
								Discard changes
							</Button>
							<Button type="submit" loading={pending}>
								{pending ? 'Creating…' : 'Create account'}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	)
}
