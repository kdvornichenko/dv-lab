'use client'

import { useContext } from 'react'

import { UserContext } from '@/app/providers'
import { Button } from '@/components/ui/button'
import supabase from '@/libs/supabase/supabaseClient'

export default function LoginPage() {
	const userContext = useContext(UserContext)

	if (!userContext) {
		return <div>Загрузка...</div>
	}

	const { user, setUser } = userContext

	const handleGoogleLogin = async () => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}`,
				scopes: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
				queryParams: {
					access_type: 'offline',
					prompt: 'consent',
				},
			},
		})
		if (error) console.log('Error logging in with Google:', error.message)
	}

	const handleLogout = async () => {
		const { error } = await supabase.auth.signOut()
		if (error) console.log('Error logging out:', error.message)
		else setUser(null)
	}

	return (
		<div className="absolute top-1/2 left-1/2 grid w-full max-w-xl -translate-x-1/2 -translate-y-1/2 grid-rows-3 gap-y-4">
			{user ? (
				<>
					<p>Привет, {user.email}</p>
					<Button variant="destructive" onClick={handleLogout}>
						Выйти
					</Button>
				</>
			) : (
				<Button className="bg-green-600 text-white hover:bg-green-700" onClick={handleGoogleLogin}>
					Войти через Google
				</Button>
			)}
		</div>
	)
}
