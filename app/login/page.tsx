'use client'

import React, { useEffect, useRef } from 'react'
import { Alert, Button, Card } from '@nextui-org/react'
import { useRouter } from 'next/navigation'
import GoogleApiService from '../../services/GoogleApiService'
import useGoogleApiStore from '@/store/googleApi.store'
import { motion } from 'framer-motion'

export default function LoginPage() {
	const googleApiService = useRef<GoogleApiService | null>(null)
	const router = useRouter()
	const { alertMessage, isAlertActive } = useGoogleApiStore()

	const handleLogin = () => {
		googleApiService.current?.requestAccessToken()
	}

	useEffect(() => {
		// Инициализация Google API клиента
		if (!googleApiService.current) {
			googleApiService.current = new GoogleApiService(
				process.env.NEXT_PUBLIC_CLIENT_ID!,
				process.env.NEXT_PUBLIC_API_KEY!,
				process.env.NEXT_PUBLIC_DISCOVERY_DOC!,
				process.env.NEXT_PUBLIC_SCOPES!
			)

			console.log('Initializing client...')
			googleApiService.current.initializeClient(isAuthorized => {
				console.log('Client initialized. Is authorized:', isAuthorized)
				if (isAuthorized) {
					router.push('/schedule')
				}
			}, router)
		}
	}, [router])

	return (
		<div className='container mx-auto max-h-dvh flex items-center justify-center'>
			<Card className='flex flex-col gap-y-4 p-6 shadow-md'>
				<h1 className='text-center'>Login to Your Google Account</h1>
				<Button onClick={() => handleLogin()}>Sign in with Google</Button>
			</Card>
			<motion.div
				className='fixed bottom-10 end-10 w-fit'
				initial={false}
				animate={
					isAlertActive ? { opacity: 1, x: 0 } : { opacity: 0, x: '150%' }
				}
				transition={{ duration: 0.5 }}
			>
				<Alert color='danger' variant='solid' title={alertMessage} />
			</motion.div>
		</div>
	)
}
