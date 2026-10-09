'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import { apiRequest } from '@/lib/api-client'

export function useSignOut() {
	const router = useRouter()
	const [pending, setPending] = useState(false)

	async function signOut() {
		if (pending) return
		setPending(true)
		try {
			await apiRequest('POST', '/auth/sign-out')
		} finally {
			router.replace('/login')
			router.refresh()
		}
	}

	return { signOut, pending }
}
