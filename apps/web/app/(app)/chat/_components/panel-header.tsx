'use client'

import { List, Maximize2, PanelRight, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'

export function PanelHeader({
	title,
	loadingTitle,
	listOpen,
	disabled,
	onToggleList,
	onCreate,
	onOpenInChat,
	onOpenAsPanel,
	onClose,
}: {
	title: string
	loadingTitle: boolean
	listOpen: boolean
	disabled: boolean
	onToggleList: () => void
	onCreate: () => void
	onOpenInChat: () => void
	onOpenAsPanel?: () => void
	onClose: () => void
}) {
	return (
		<header className="-mx-3 flex h-12 shrink-0 items-center gap-2 pr-2 pl-4">
			{loadingTitle ? (
				<h2 className="min-w-0 flex-1" aria-label="Chat">
					<Skeleton className="h-5 w-32" />
				</h2>
			) : (
				<h2 className="min-w-0 flex-1 truncate text-subtitle font-semibold text-foreground" title={title}>
					{title}
				</h2>
			)}
			<Tooltip content="All chats" delayDuration={200}>
				<Button
					data-all-chats=""
					variant="outline"
					size="icon-compact"
					aria-label="All chats"
					aria-expanded={listOpen}
					active={listOpen}
					disabled={disabled}
					onClick={onToggleList}
				>
					<List />
				</Button>
			</Tooltip>
			<Tooltip content="New chat" delayDuration={200}>
				<Button variant="outline" size="icon-compact" aria-label="New chat" disabled={disabled} onClick={onCreate}>
					<Plus />
				</Button>
			</Tooltip>
			{onOpenAsPanel === undefined ? null : (
				<Tooltip content="Open as panel" delayDuration={200}>
					<Button variant="outline" size="icon-compact" aria-label="Open as panel" onClick={onOpenAsPanel}>
						<PanelRight />
					</Button>
				</Tooltip>
			)}
			<Tooltip content="Open in chat" delayDuration={200}>
				<Button variant="outline" size="icon-compact" aria-label="Open in chat" onClick={onOpenInChat}>
					<Maximize2 />
				</Button>
			</Tooltip>
			<Tooltip content="Close chat" delayDuration={200}>
				<Button variant="outline" size="icon-compact" aria-label="Close chat" onClick={onClose}>
					<X />
				</Button>
			</Tooltip>
		</header>
	)
}
