'use client'

import { List, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function ChatHeader({
	title,
	loadingTitle,
	listOpen,
	disabled = false,
	compact = false,
	onToggleList,
	onCreate,
}: {
	title: string
	loadingTitle: boolean
	listOpen: boolean
	disabled?: boolean
	compact?: boolean
	onToggleList: () => void
	onCreate: () => void
}) {
	return (
		<header className="flex h-12 items-center gap-2">
			{loadingTitle ? (
				<h1 className="min-w-0 flex-1" aria-label="Chat">
					<Skeleton className="h-5 w-40" />
				</h1>
			) : (
				<h1 className="min-w-0 flex-1 truncate text-subtitle font-semibold text-foreground" title={title}>
					{title}
				</h1>
			)}
			{compact ? null : (
				<>
					<Button
						data-all-chats=""
						variant="secondary"
						size="compact"
						leadingIcon={List}
						active={listOpen}
						aria-expanded={listOpen}
						disabled={disabled}
						className="max-md:hidden"
						onClick={onToggleList}
					>
						All chats
					</Button>
					<Button
						data-all-chats=""
						variant="ghost"
						size="icon-compact"
						active={listOpen}
						aria-expanded={listOpen}
						aria-label="All chats"
						disabled={disabled}
						className="w-9 md:hidden"
						onClick={onToggleList}
					>
						<List />
					</Button>
					<Button
						variant="tertiary"
						size="compact"
						leadingIcon={Plus}
						disabled={disabled}
						className="max-md:hidden"
						onClick={onCreate}
					>
						New chat
					</Button>
					<Button
						variant="tertiary"
						size="icon-compact"
						aria-label="New chat"
						disabled={disabled}
						className="w-9 md:hidden"
						onClick={onCreate}
					>
						<Plus />
					</Button>
				</>
			)}
		</header>
	)
}
