'use client'

import { Check, Copy } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { copyTooltip, useCopy } from '@/lib/use-copy'

import type { ChatCommandBlock } from '@dv-lab/contracts'

export function CommandBlock({ block }: { block: ChatCommandBlock }) {
	const { state, copy } = useCopy()
	const lines = block.text.split('\n')
	return (
		<Panel>
			<section aria-label={block.name} data-slot="chat-command-block" className="flex flex-col gap-2 px-4 py-3">
				<div className="flex items-start gap-2">
					<div className="min-w-0 flex-1">
						<p className="text-body font-semibold text-foreground sm:truncate" title={block.name}>
							{block.name}
						</p>
						<p className="font-mono text-caption text-muted-foreground">{block.command}</p>
					</div>
					<Tooltip side="top" forceOpen={state === 'idle' ? undefined : true} content={copyTooltip(state, 'Copy')}>
						<Button
							variant="secondary"
							size="icon-compact"
							aria-label={`Copy: ${block.name}`}
							data-slot="chat-command-copy"
							className="shrink-0 pointer-coarse:size-9"
							onClick={() => void copy(block.text)}
						>
							{state === 'copied' ? <Check /> : <Copy />}
						</Button>
					</Tooltip>
					<span className="sr-only" aria-live="polite">
						{state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : ''}
					</span>
				</div>
				{block.format === 'list' ? (
					<ul className="list-disc space-y-0.5 pl-5 text-body break-words">
						{lines
							.filter((line) => line.trim() !== '')
							.map((line, index) => (
								<li key={`${index}-${line}`}>{line}</li>
							))}
					</ul>
				) : (
					<p className="text-body break-words whitespace-pre-wrap">{block.text}</p>
				)}
			</section>
		</Panel>
	)
}
