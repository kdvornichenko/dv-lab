import type { FC } from 'react'

import { AlertTriangle, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { LOG_TYPE_META } from './error-log-model'
import type { LogTableRowProps } from './error-log.types'

export const ErrorLogTableRow: FC<LogTableRowProps> = ({ entry, active, onSelect, onDelete }) => {
	const meta = LOG_TYPE_META[entry.type]
	const Icon = meta.icon

	return (
		<TableRow
			data-active={active}
			tabIndex={0}
			aria-selected={active}
			className={cn(
				'focus-visible:ring-ring/35 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-[3px]',
				active ? 'bg-danger-soft/80 hover:bg-danger-soft/80' : 'bg-danger-soft/30 hover:bg-danger-soft/60'
			)}
			onClick={onSelect}
			onKeyDown={(event) => {
				if (event.key !== 'Enter' && event.key !== ' ') return
				event.preventDefault()
				onSelect()
			}}
		>
			<TableCell className="text-ink-muted ps-4 tabular-nums">{entry.timeLabel}</TableCell>
			<TableCell>
				<span className="inline-flex items-center gap-1.5">
					<span className="bg-danger size-1.5 rounded-full" />
					<span className="text-danger text-[10px] uppercase tracking-wider">error</span>
				</span>
			</TableCell>
			<TableCell>
				<Badge tone={meta.badge} className="gap-1.5 font-mono text-[10px]">
					<Icon className="size-3" />
					{meta.label}
				</Badge>
			</TableCell>
			<TableCell className="text-ink-muted max-w-40 truncate">{entry.source}</TableCell>
			<TableCell className="text-ink-muted max-w-40 truncate">{entry.endpoint ?? '-'}</TableCell>
			<TableCell className="text-ink-muted tabular-nums">{entry.eventId}</TableCell>
			<TableCell className="max-w-xl">
				<span className="flex items-center gap-2">
					<AlertTriangle className="text-danger size-3.5 shrink-0" />
					<span className="truncate">{entry.message}</span>
				</span>
			</TableCell>
			<TableCell className="pe-4 text-right" onClick={(event) => event.stopPropagation()}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="text-ink-muted hover:bg-danger-soft hover:text-danger size-8"
							aria-label={`Delete ${entry.source} log`}
							onClick={onDelete}
						>
							<Trash2 className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent sideOffset={6}>Delete log</TooltipContent>
				</Tooltip>
			</TableCell>
		</TableRow>
	)
}
