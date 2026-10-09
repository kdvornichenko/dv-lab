'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Check, Copy } from 'lucide-react'

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

import type { CreateStudentResponse, StudentRow } from '@dv-lab/contracts'

interface CreateStudentDialogProps {
	onClose: () => void
	onFinished: (student: StudentRow, revealed: boolean) => void
}

interface Revealed {
	student: StudentRow
	password: string
}

function RevealBody({ revealed, onSaved }: { revealed: Revealed; onSaved: () => void }) {
	const [copied, setCopied] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current)
		},
		[]
	)

	async function copy() {
		try {
			await navigator.clipboard.writeText(revealed.password)
		} catch {
			return
		}
		setCopied(true)
		if (timer.current) clearTimeout(timer.current)
		timer.current = setTimeout(() => setCopied(false), 2000)
	}

	return (
		<>
			<DialogHeader>
				<DialogTitle>Account created</DialogTitle>
				<DialogDescription>Give these details to {revealed.student.displayName}.</DialogDescription>
			</DialogHeader>
			<div className="flex flex-col gap-4">
				<Banner status="warning">
					<BannerTitle>Save this password now. It will not be shown again.</BannerTitle>
				</Banner>
				<div className="flex flex-col gap-2">
					<div className="flex h-9 items-center gap-2 rounded-lg bg-hover px-2">
						<span className="w-16 shrink-0 text-body text-muted-foreground">Login</span>
						<span className="min-w-0 flex-1 truncate text-body text-foreground">{revealed.student.login}</span>
					</div>
					<div className="flex h-9 items-center gap-2 rounded-lg bg-hover px-2">
						<span className="w-16 shrink-0 text-body text-muted-foreground">Password</span>
						<span className="min-w-0 flex-1 truncate font-mono text-body text-foreground select-all">
							{revealed.password}
						</span>
						<Button
							type="button"
							variant="secondary"
							size="compact"
							leadingIcon={copied ? Check : Copy}
							onClick={() => void copy()}
						>
							{copied ? 'Copied' : 'Copy password'}
						</Button>
					</div>
				</div>
				<span role="status" className="sr-only">
					{copied ? 'Password copied' : ''}
				</span>
			</div>
			<DialogFooter>
				<Button type="button" autoFocus onClick={onSaved}>
					I saved the password
				</Button>
			</DialogFooter>
		</>
	)
}

export function CreateStudentDialog({ onClose, onFinished }: CreateStudentDialogProps) {
	const [displayName, setDisplayName] = useState('')
	const [login, setLogin] = useState('')
	const [password, setPassword] = useState('')
	const [loginError, setLoginError] = useState<string>()
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)
	const [revealed, setRevealed] = useState<Revealed | null>(null)

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending) return
		setFailed(false)
		setLoginError(undefined)
		setPending(true)
		const result = await apiRequest<CreateStudentResponse>('POST', '/students', {
			login,
			displayName,
			password: password === '' ? undefined : password,
		})
		setPending(false)
		if (!result.ok) {
			setPassword('')
			if (result.error?.code === 'login_taken') setLoginError('This login is already taken.')
			else setFailed(true)
			return
		}
		const { student, generatedPassword } = result.data
		if (generatedPassword) {
			setPassword('')
			setRevealed({ student, password: generatedPassword })
			return
		}
		onFinished(student, false)
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
					<RevealBody revealed={revealed} onSaved={() => onFinished(revealed.student, true)} />
				) : (
					<form noValidate onSubmit={onSubmit}>
						<DialogHeader>
							<DialogTitle>Create student account</DialogTitle>
							<DialogDescription>The student signs in with this login and password.</DialogDescription>
						</DialogHeader>
						<div className="flex flex-col gap-4">
							{failed ? (
								<Banner status="error">
									<BannerTitle>Could not create the account. Try again.</BannerTitle>
								</Banner>
							) : null}
							<TextField
								id="student-name"
								name="displayName"
								label="Name"
								autoComplete="off"
								autoFocus
								value={displayName}
								onChange={(event) => setDisplayName(event.target.value)}
								disabled={pending}
							/>
							<TextField
								id="student-login"
								name="login"
								label="Login"
								autoComplete="off"
								autoCapitalize="none"
								spellCheck={false}
								helper="3–32 characters: lowercase letters, digits, dot, underscore, hyphen."
								value={login}
								onChange={(event) => setLogin(event.target.value)}
								disabled={pending}
								error={loginError}
							/>
							<PasswordField
								id="student-password"
								name="password"
								label="Password"
								autoComplete="new-password"
								helper="Leave empty to generate a 12-character password, or enter your own (10–128 characters)."
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								disabled={pending}
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
