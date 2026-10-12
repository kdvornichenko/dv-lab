'use client'

import { useState } from 'react'

import { apiRequest } from '@/lib/api-client'

export function useSignOut() {
	const [pending, setPending] = useState(false)

	async function signOut() {
		if (pending) return
		setPending(true)
		try {
			await apiRequest('POST', '/auth/sign-out')
		} finally {
			window.location.replace('/login')
		}
	}

	return { signOut, pending }
}
