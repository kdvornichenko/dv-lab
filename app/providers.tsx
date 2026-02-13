'use client'

import { User } from '@supabase/supabase-js'

import { createContext, useEffect, useState } from 'react'

import type { ThemeProviderProps } from 'next-themes'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

import LoadingScreen from '@/components/LoadingScreen'
import supabase from '@/libs/supabase/supabaseClient'

export interface ProvidersProps {
	children: React.ReactNode
	themeProps?: ThemeProviderProps
}

export const UserContext = createContext<{
	user: User | null
	loading: boolean
	setUser: React.Dispatch<React.SetStateAction<User | null>>
} | null>(null)

export function Providers({ children, themeProps }: ProvidersProps) {
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

		const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
			setUser(session?.user ?? null)
		})

		return () => {
			authListener?.subscription.unsubscribe()
		}
	}, [])

	return (
		<UserContext.Provider value={{ user, loading, setUser }}>
			<NextThemesProvider {...themeProps}>
				{loading ? <LoadingScreen message="Загрузка..." /> : children}
			</NextThemesProvider>
		</UserContext.Provider>
	)
}
