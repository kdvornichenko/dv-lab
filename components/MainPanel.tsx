'use client'

import { useState } from 'react'

import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { sitePages } from '@/config/pages'

const MainPanel = () => {
	const [loadingHref, setLoadingHref] = useState<string | null>(null)
	const router = useRouter()

	const handleCardPress = (href: string) => {
		setLoadingHref(href)
		router.push(href)

		setTimeout(() => setLoadingHref(null), 1000)
	}

	return sitePages.map((page) => (
		<Card
			key={page.href}
			className="relative cursor-pointer overflow-hidden"
			onClick={() => !loadingHref && handleCardPress(page.href)}
		>
			{loadingHref === page.href && (
				<Loader2 className="absolute top-1/2 left-1/2 z-50 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin" />
			)}
			<CardContent className="p-0">
				<Image alt={page.label} className="object-cover" height={200} src={`/img/${page.img}`} width={200} />
			</CardContent>
			<CardFooter className="absolute bottom-1 z-10 ml-1 w-[calc(100%_-_8px)] overflow-hidden rounded-lg border border-slate-950/60 py-3 shadow-sm before:rounded-xl before:bg-slate-950">
				<p className="text-tiny text-slate-950/80">{page.label}</p>
			</CardFooter>
		</Card>
	))
}

export default MainPanel
