'use client'

import { signIn } from 'next-auth/react'
import { Button, Card } from '@nextui-org/react'

export default function LoginPage() {
	return (
		<div className='container mx-auto max-h-dvh flex items-center justify-center'>
			<Card className='flex flex-col gap-y-4 p-6 shadow-md'>
				<h1 className='text-center'>Login to Your Account</h1>
				<Button onPressEnd={() => signIn('google')}>Sign in with Google</Button>
			</Card>
		</div>
	)
}
