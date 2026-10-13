'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown'
import { MenuItem } from '@/components/ui/menu-item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { spring } from '@/lib/springs'
import { cn } from '@/lib/utils'

import type { ChatConversation } from '@dv-lab/contracts'

import type { ConversationListState } from './use-chat'

const MAX_STAGGERED_ROWS = 8
const STAGGER_SECONDS = 0.03

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

export function conversationTime(iso: string, now: Date): string {
	const date = new Date(iso)
	const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000)
	if (days <= 0) return clock.format(date)
	if (days < 7) return weekday.format(date)
	return dayMonth.format(date)
}

interface ConversationListProps {
	state: ConversationListState
	selectedId: string | null
	onSelect: (id: string) => void
	onRename: (conversation: ChatConversation) => void
	onDelete: (conversation: ChatConversation) => void
	onRefresh: () => void
}

function ListSkeleton() {
	return (
		<div className="flex flex-col gap-1" aria-hidden="true">
			{Array.from({ length: 3 }, (_, index) => (
				<div key={index} className="flex h-14 flex-col justify-center gap-2 px-3">
					<Skeleton className="h-4 w-2/5" />
					<Skeleton className="h-3 w-1/4" />
				</div>
			))}
		</div>
	)
}

function RowMenu({
	conversation,
	onRename,
	onDelete,
}: {
	conversation: ChatConversation
	onRename: (conversation: ChatConversation) => void
	onDelete: (conversation: ChatConversation) => void
}) {
	return (
		<DropdownMenu size="compact">
			<DropdownTrigger
				render={<Button variant="ghost" size="icon-compact" aria-label={`More: ${conversation.title}`} />}
			>
				<MoreHorizontal />
			</DropdownTrigger>
			<DropdownContent align="end" className="w-52 min-w-52 bg-surface-4 shadow-surface-4">
				<MenuItem index={0} label="Rename conversation" icon={Pencil} onSelect={() => onRename(conversation)} />
				<MenuItem
					index={1}
					label="Delete conversation"
					icon={Trash2}
					className="[&_span]:text-destructive"
					onSelect={() => onDelete(conversation)}
				/>
			</DropdownContent>
		</DropdownMenu>
	)
}

function Row({
	conversation,
	index,
	selected,
	now,
	reduceMotion,
	onSelect,
	onRename,
	onDelete,
}: {
	conversation: ChatConversation
	index: number
	selected: boolean
	now: Date
	reduceMotion: boolean
	onSelect: (id: string) => void
	onRename: (conversation: ChatConversation) => void
	onDelete: (conversation: ChatConversation) => void
}) {
	return (
		<motion.li
			className="group/row relative"
			initial={reduceMotion ? false : { opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				type: 'spring',
				duration: spring.moderate.duration,
				bounce: 0,
				delay: reduceMotion ? 0 : Math.min(index, MAX_STAGGERED_ROWS) * STAGGER_SECONDS,
			}}
		>
			<button
				type="button"
				data-row-id={conversation.id}
				aria-current={selected ? 'true' : undefined}
				onClick={() => onSelect(conversation.id)}
				className={cn(
					'flex h-14 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left outline-none',
					'hover:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]',
					selected && 'bg-active'
				)}
			>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-body font-medium text-foreground" title={conversation.title}>
						{conversation.title}
					</span>
					<span className="block truncate text-caption text-muted-foreground">Empty chat</span>
				</span>
				<span
					className={cn(
						'shrink-0 text-caption text-muted-foreground tabular-nums',
						'group-focus-within/row:invisible group-hover/row:invisible group-has-[[data-popup-open]]/row:invisible',
						'pointer-coarse:hidden'
					)}
				>
					{conversationTime(conversation.updatedAt, now)}
				</span>
			</button>
			<div
				className={cn(
					'invisible absolute top-1/2 right-2 -translate-y-1/2',
					'group-focus-within/row:visible group-hover/row:visible group-has-[[data-popup-open]]/row:visible',
					'pointer-coarse:visible'
				)}
			>
				<RowMenu conversation={conversation} onRename={onRename} onDelete={onDelete} />
			</div>
		</motion.li>
	)
}

export function ConversationList({
	state,
	selectedId,
	onSelect,
	onRename,
	onDelete,
	onRefresh,
}: ConversationListProps) {
	const reduceMotion = useReducedMotion() ?? false
	const now = new Date()
	return (
		<motion.div
			className="absolute inset-x-0 top-0 z-10"
			initial={reduceMotion ? false : { opacity: 0, y: -12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, transition: { duration: spring.moderate.exit.duration } }}
			transition={{ type: 'spring', duration: spring.moderate.duration, bounce: 0 }}
		>
			<Panel className="p-2">
				{state.kind === 'loading' ? (
					<ListSkeleton />
				) : state.kind === 'error' ? (
					<Banner status="error">
						<BannerTitle>Could not load conversations.</BannerTitle>
						<BannerActions>
							<BannerAction onClick={onRefresh}>Refresh</BannerAction>
						</BannerActions>
					</Banner>
				) : state.conversations.length === 0 ? (
					<p className="px-3 py-6 text-center text-caption text-muted-foreground">No chats yet.</p>
				) : (
					<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit]">
						<ul aria-label="All chats" className="flex flex-col gap-0.5">
							{state.conversations.map((conversation, index) => (
								<Row
									key={conversation.id}
									conversation={conversation}
									index={index}
									selected={conversation.id === selectedId}
									now={now}
									reduceMotion={reduceMotion}
									onSelect={onSelect}
									onRename={onRename}
									onDelete={onDelete}
								/>
							))}
						</ul>
					</ScrollArea>
				)}
			</Panel>
		</motion.div>
	)
}
