'use client'

import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { ChatConversation } from '@dv-lab/contracts'

import { ConversationList } from './conversation-list'
import type { ConversationListState } from './use-chat'

export const RAIL_MIN_WIDTH = 1080

export function ConversationRail({
	state,
	selectedId,
	onSelect,
	onRename,
	onDelete,
	onRefresh,
	onCreate,
}: {
	state: ConversationListState
	selectedId: string | null
	onSelect: (id: string) => void
	onRename: (conversation: ChatConversation) => void
	onDelete: (conversation: ChatConversation) => void
	onRefresh: () => void
	onCreate: () => void
}) {
	return (
		<nav aria-label="Chats" className="flex w-72 shrink-0 flex-col border-l border-border pt-4">
			<div className="flex h-12 shrink-0 items-center gap-2 px-3">
				<h2 className="min-w-0 flex-1 truncate text-subtitle font-semibold text-foreground">Chats</h2>
				<Button variant="tertiary" size="compact" leadingIcon={Plus} onClick={onCreate}>
					New chat
				</Button>
			</div>
			<ConversationList
				rail
				state={state}
				selectedId={selectedId}
				onSelect={onSelect}
				onRename={onRename}
				onDelete={onDelete}
				onRefresh={onRefresh}
			/>
		</nav>
	)
}
