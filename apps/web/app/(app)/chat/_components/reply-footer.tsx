'use client'

import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { copyTooltip, useCopy } from '@/lib/use-copy'

export function ReplyFooter({ time, title, copyText }: { time: string; title: string; copyText: string | null }) {
	const { state, copy } = useCopy()
	return (
		<div data-slot="chat-reply-footer" className="flex h-7 items-center gap-1">
			<span title={title} className="text-caption text-muted-foreground tabular-nums">
				{time}
			</span>
			{copyText === null ? null : (
				<>
					<Tooltip
						side="right"
						forceOpen={state === 'idle' ? undefined : true}
						content={copyTooltip(state, 'Copy reply')}
					>
						<Button
							variant="ghost"
							size="icon-compact"
							aria-label="Copy reply"
							className="text-muted-foreground opacity-0 transition-opacity duration-120 group-focus-within/message:opacity-100 group-hover/message:opacity-100 focus-visible:opacity-100 pointer-coarse:size-9 pointer-coarse:opacity-100 [&_svg]:size-3.5"
							onClick={() => void copy(copyText)}
						>
							{state === 'copied' ? <Check /> : <Copy />}
						</Button>
					</Tooltip>
					<span className="sr-only" aria-live="polite">
						{state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : ''}
					</span>
				</>
			)}
		</div>
	)
}
