'use client'

import { sitePages } from '@/config/pages'
import { Card, CardFooter, Image, Spinner } from '@nextui-org/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const MainPanel = () => {
	const [loadingHref, setLoadingHref] = useState<string | null>(null)
	const router = useRouter()

	const handleCardPress = (href: string) => {
		setLoadingHref(href)
		router.push(href)

		setTimeout(() => setLoadingHref(null), 1000)
	}

	return sitePages.map(page => (
		<Card
			isFooterBlurred
			radius='lg'
			isPressable
			onPress={() => handleCardPress(page.href)}
			key={page.href}
			className='relative'
			isDisabled={!!loadingHref}
		>
			{loadingHref === page.href && (
				<Spinner className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50' />
			)}
			<Image
				alt={page.label}
				className='object-cover'
				height={200}
				src={`/img/${page.img}`}
				width={200}
			/>
			<CardFooter className='before:bg-slate-950 border-slate-950/60 border-1 overflow-hidden py-3 absolute before:rounded-xl rounded-large bottom-1 w-[calc(100%_-_8px)] shadow-small ml-1 z-10'>
				<p className='text-tiny text-slate-950/80'>{page.label}</p>
			</CardFooter>
		</Card>
	))
}

export default MainPanel
