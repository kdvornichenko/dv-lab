'use client'

import { useEffect, useRef } from 'react'

import { apiRequest } from '@/lib/api-client'

export function SessionRenewal({ renewDue }: { renewDue: boolean }) {
	const started = useRef(false)

	useEffect(() => {
		if (!renewDue || started.current) return
		started.current = true
		void apiRequest('POST', '/auth/renew')
	}, [renewDue])

	return null
}
