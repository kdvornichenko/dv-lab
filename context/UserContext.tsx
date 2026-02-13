'use client'

import { User } from '@supabase/supabase-js'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

import supabase from '@/libs/supabase/supabaseClient'

interface UserContextProps {
	user: User | null
	setUser: (user: User | null) => void
}

const UserContext = createContext<UserContextProps | undefined>(undefined)

export const UserProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<User | null>(null)

	useEffect(() => {
		const getUserProfile = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession()

			setUser(session?.user ?? null)
		}

		getUserProfile()

		const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null)
		})

		return () => {
			authListener?.subscription.unsubscribe()
		}
	}, [])

	return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>
}

export const useUser = () => {
	const context = useContext(UserContext)
	if (!context) {
		throw new Error('useUser must be used within a UserProvider')
	}
	return context
}
