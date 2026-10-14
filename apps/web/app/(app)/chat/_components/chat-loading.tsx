'use client'

import { ChatHeader } from './chat-header'
import { ComposerSkeleton } from './composer'

function ignore() {}

export function ChatLoading() {
	return (
		<div
			role="status"
			aria-label="Loading chat"
			className="flex min-h-0 flex-1 flex-col px-3 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-6"
		>
			<div className="mx-auto w-full max-w-180 pb-4">
				<ChatHeader title="Chat" loadingTitle listOpen={false} disabled onToggleList={ignore} onCreate={ignore} />
			</div>
			<div className="relative flex min-h-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1 flex-col gap-3">
					<div className="min-h-0 flex-1" />
					<div className="mx-auto flex w-full max-w-180 flex-col gap-3">
						<ComposerSkeleton />
					</div>
				</div>
			</div>
		</div>
	)
}
