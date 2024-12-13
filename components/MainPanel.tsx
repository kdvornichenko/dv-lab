'use client'

import { sitePages } from '@/config/pages'
import { Card, CardFooter, Image, Spinner } from '@nextui-org/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const MainPanel = () => {
	const [isLoading, setIsLoading] = useState(false)
	const router = useRouter()

	const handleCardPress = (href: string) => {
		setIsLoading(true)
		router.push(href)
	}

	return sitePages.map(page => (
		<Card
			isFooterBlurred
			radius='lg'
			isPressable
			onPress={() => handleCardPress(page.href)}
			key={page.href}
			className='relative'
		>
			{isLoading && (
				<Spinner className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50' />
			)}
			<Image
				alt='Schedule'
				className='object-cover'
				height={200}
				src='/img/schedule.jpg'
				width={200}
			/>
			<CardFooter className='before:bg-slate-950 border-slate-950/60 border-1 overflow-hidden py-3 absolute before:rounded-xl rounded-large bottom-1 w-[calc(100%_-_8px)] shadow-small ml-1 z-10'>
				<p className='text-tiny text-slate-950/80'>{page.label}</p>
			</CardFooter>
		</Card>
	))
}

export default MainPanel
