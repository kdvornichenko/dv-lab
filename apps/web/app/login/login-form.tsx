'use client'

import { PasswordField, TextField } from '@/components/app/text-field'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'

export function LoginForm({ expired }: { expired: boolean }) {
	return (
		<form className="flex flex-col gap-4" noValidate>
			{expired ? <Banner status="info">Your session has ended. Sign in again.</Banner> : null}
			<TextField
				id="login"
				name="login"
				label="Login or email"
				autoComplete="username"
				autoCapitalize="none"
				spellCheck={false}
				autoFocus
			/>
			<PasswordField id="password" name="password" label="Password" autoComplete="current-password" />
			<Button type="submit" className="w-full">
				Sign in to dv-lab
			</Button>
		</form>
	)
}
