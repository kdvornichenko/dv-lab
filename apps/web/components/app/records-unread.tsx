'use client'

import { useState } from 'react'

import { CircleAlert, RefreshCw } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'

export function RecordsUnread({ onRefresh, slot }: { onRefresh: () => void | Promise<void>; slot: string }) {
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
			<div data-slot={slot} className="flex flex-col items-center gap-4 px-6 py-12 text-center">
				<span className="flex size-10 items-center justify-center rounded-full bg-hover text-muted-foreground">
					<CircleAlert size={20} strokeWidth={1.5} />
				</span>
				<div className="flex flex-col gap-1">
					<p className="text-title font-semibold text-foreground">Could not read these records.</p>
					<p className="text-body text-muted-foreground">Refresh before continuing.</p>
				</div>
				<Button variant="secondary" leadingIcon={RefreshCw} loading={pending} onClick={() => void refresh()}>
					Refresh records
				</Button>
			</div>
		</Panel>
	)
}
