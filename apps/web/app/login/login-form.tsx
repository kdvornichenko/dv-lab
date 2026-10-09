'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

import { useRouter } from 'next/navigation'

import { PasswordField, TextField } from '@/components/app/text-field'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api-client'

import type { SignInResponse } from '@dv-lab/contracts'

type FormBanner = { id: number; text: string }

function bannerText(code: string | undefined) {
	if (code === 'invalid_credentials') return 'Wrong login or password'
	if (code === 'locked') return 'Too many attempts, try again in 15 minutes'
	return 'Could not sign in. Try again in a moment.'
}

export function LoginForm({ expired }: { expired: boolean }) {
	const router = useRouter()
	const [login, setLogin] = useState('')
	const [password, setPassword] = useState('')
	const [loginError, setLoginError] = useState<string>()
	const [passwordError, setPasswordError] = useState<string>()
	const [banner, setBanner] = useState<FormBanner | null>(null)
	const [pending, setPending] = useState(false)
	const [focusPassword, setFocusPassword] = useState(0)
	const loginRef = useRef<HTMLInputElement>(null)
	const passwordRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (focusPassword > 0 && !pending) passwordRef.current?.focus()
	}, [focusPassword, pending])

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending) return
		const missingLogin = login.trim() === ''
		const missingPassword = password === ''
		setLoginError(missingLogin ? 'Enter your login or email.' : undefined)
		setPasswordError(missingPassword ? 'Enter your password.' : undefined)
		if (missingLogin) {
			loginRef.current?.focus()
			return
		}
		if (missingPassword) {
			passwordRef.current?.focus()
			return
		}
		setBanner(null)
		setPending(true)
		const result = await apiRequest<SignInResponse>('POST', '/auth/sign-in', { login, password })
		if (result.ok) {
			router.replace('/')
			router.refresh()
			return
		}
		setBanner({ id: Date.now(), text: bannerText(result.error?.code) })
		setPassword('')
		setPending(false)
		setFocusPassword((count) => count + 1)
	}

	return (
		<form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
			{banner ? (
				<Banner key={banner.id} status="error">
					<BannerTitle>{banner.text}</BannerTitle>
				</Banner>
			) : expired ? (
				<Banner status="info">
					<BannerTitle>Your session has ended. Sign in again.</BannerTitle>
				</Banner>
			) : null}
			<TextField
				ref={loginRef}
				id="login"
				name="login"
				label="Login or email"
				autoComplete="username"
				autoCapitalize="none"
				spellCheck={false}
				autoFocus
				value={login}
				onChange={(event) => setLogin(event.target.value)}
				disabled={pending}
				error={loginError}
			/>
			<PasswordField
				ref={passwordRef}
				id="password"
				name="password"
				label="Password"
				autoComplete="current-password"
				value={password}
				onChange={(event) => setPassword(event.target.value)}
				disabled={pending}
				error={passwordError}
			/>
			<Button type="submit" className="w-full" loading={pending}>
				{pending ? 'Signing in…' : 'Sign in to dv-lab'}
			</Button>
		</form>
	)
}
