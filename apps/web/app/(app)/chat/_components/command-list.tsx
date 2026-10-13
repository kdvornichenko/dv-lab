'use client'

import { COMMAND_ROWS } from './composer'

export function CommandList({ onPick }: { onPick: (text: string) => void }) {
	return (
		<ul aria-label="Commands" data-slot="chat-commands" className="flex w-full max-w-90 flex-col">
			{COMMAND_ROWS.map((row) => (
				<li key={row.name}>
					<button
						type="button"
						className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left outline-none hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-focus-ring md:h-10"
						onClick={() => onPick(row.text)}
					>
						<span className="w-24 shrink-0 text-body font-medium text-foreground">{row.name}</span>
						<span className="min-w-0 flex-1 text-caption text-muted-foreground">{row.detail}</span>
					</button>
				</li>
			))}
		</ul>
	)
}
