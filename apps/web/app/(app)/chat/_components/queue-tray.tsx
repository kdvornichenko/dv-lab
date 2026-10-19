'use client'

import { CircleAlert, Clock, LoaderCircle, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { QueuedMessage } from './use-chat'

const EXCERPT = 40

function excerpt(text: string): string {
	const words = text.trim().split(/\s+/u).join(' ')
	return Array.from(words).length > EXCERPT ? `${Array.from(words).slice(0, EXCERPT).join('')}…` : words
}

function RemoveButton({ item, onRemove }: { item: QueuedMessage; onRemove: (id: string) => void }) {
	return (
		<Button
			variant="ghost"
			size="icon-compact"
			aria-label={`Remove from queue: ${excerpt(item.text)}`}
			title="Remove from queue"
			onClick={() => onRemove(item.id)}
		>
			<X />
		</Button>
	)
}

export function QueueTray({
	queue,
	onRemove,
	onRetry,
}: {
	queue: readonly QueuedMessage[]
	onRemove: (id: string) => void
	onRetry: (id: string) => void
}) {
	if (queue.length === 0) return null
	return (
		<ul
			role="list"
			aria-label="Queued messages"
			data-slot="chat-queue"
			className="scroll-fade flex max-h-27 flex-col gap-0.5 overflow-y-auto rounded-xl bg-surface-3 p-1 ring-1 ring-border"
		>
			{queue.map((item) => {
				const failed = item.state === 'failed'
				const sending = item.state === 'sending'
				return (
					<li
						key={item.id}
						data-state={item.state}
						aria-busy={sending || undefined}
						className={`flex shrink-0 items-center gap-2 rounded-lg px-2 ${failed ? 'min-h-14 py-1' : 'h-9'}`}
					>
						{failed ? (
							<CircleAlert aria-hidden size={14} className="shrink-0 text-destructive" />
						) : sending ? (
							<LoaderCircle
								aria-hidden
								size={14}
								className="shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
							/>
						) : (
							<Clock aria-hidden size={14} className="shrink-0 text-muted-foreground" />
						)}
						<div className="flex min-w-0 flex-1 flex-col">
							<p
								title={item.text}
								className={`truncate text-body ${sending ? 'text-muted-foreground' : 'text-foreground'}`}
							>
								{item.text}
							</p>
							{failed ? (
								<p className="text-micro text-muted-foreground">
									Could not send the message. The ones behind it are waiting.
								</p>
							) : null}
						</div>
						{sending ? (
							<span className="shrink-0 text-caption text-muted-foreground">Sending…</span>
						) : failed ? (
							<>
								<Button variant="secondary" size="compact" onClick={() => onRetry(item.id)}>
									Try again
								</Button>
								<RemoveButton item={item} onRemove={onRemove} />
							</>
						) : (
							<RemoveButton item={item} onRemove={onRemove} />
						)}
					</li>
				)
			})}
		</ul>
	)
}
