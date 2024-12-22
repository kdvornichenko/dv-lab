'use client'

import type { ThemeProviderProps } from 'next-themes'

import { createContext, useEffect, useState } from 'react'
import { NextUIProvider } from '@nextui-org/system'
import { useRouter } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { User } from '@supabase/supabase-js'
import supabase from '@/libs/supabase/supabaseClient'

export interface ProvidersProps {
	children: React.ReactNode
	themeProps?: ThemeProviderProps
}

export const UserContext = createContext<{
	user: User | null
	setUser: React.Dispatch<React.SetStateAction<User | null>>
} | null>(null)

declare module '@react-types/shared' {
	interface RouterConfig {
		routerOptions: NonNullable<
			Parameters<ReturnType<typeof useRouter>['push']>[1]
		>
	}
}

export function Providers({ children, themeProps }: ProvidersProps) {
	const router = useRouter()
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const getUserProfile = async () => {
			try {
				const { data, error } = await supabase.auth.getSession()
				if (error) throw error
				setUser(data?.session?.user ?? null)
			} catch (error) {
				console.error('Ошибка при получении сессии:', error)
				setUser(null)
			} finally {
				setLoading(false)
			}
		}

		getUserProfile()

		const { data: authListener } = supabase.auth.onAuthStateChange(
			(_event, session) => {
				setUser(session?.user ?? null)
			}
		)

		return () => {
			authListener?.subscription.unsubscribe()
		}
	}, [])

	if (loading) {
		return <div>Загрузка...</div>
	}

	return (
		<UserContext.Provider value={{ user, setUser }}>
			<NextUIProvider navigate={router.push}>
				<NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
			</NextUIProvider>
		</UserContext.Provider>
	)
}
