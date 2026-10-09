'use client'

import { useState } from 'react'

import { CircleAlert, RefreshCw } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'

export function ReadError({ screen, onRefresh }: { screen: string; onRefresh: () => void | Promise<void> }) {
	const [pending, setPending] = useState(false)
	async function refresh() {
		setPending(true)
		try {
			await onRefresh()
		} finally {
			setPending(false)
		}
	}
	return (
		<Panel>
			<div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
				<span className="flex size-10 items-center justify-center rounded-full bg-hover text-muted-foreground">
					<CircleAlert size={20} strokeWidth={1.5} />
				</span>
				<div className="flex flex-col gap-1">
					<p className="text-title font-semibold text-foreground">Could not load {screen}</p>
					<p className="text-body text-muted-foreground">Nothing was changed. Try again.</p>
				</div>
				<Button variant="secondary" leadingIcon={RefreshCw} loading={pending} onClick={() => void refresh()}>
					Refresh
				</Button>
			</div>
		</Panel>
	)
}
