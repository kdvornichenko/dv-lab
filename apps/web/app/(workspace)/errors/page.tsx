'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
	AlertCircle,
	AlertTriangle,
	CalendarClock,
	Copy,
	Database,
	Filter,
	Pause,
	Play,
	RefreshCw,
	Search,
	Settings,
	Terminal,
	Trash2,
	Users,
	WalletCards,
	XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
	clearCrmErrors,
	deleteCrmError,
	listCrmErrors,
	subscribeCrmErrors,
	type CrmErrorLogEntry,
} from '@/lib/crm/error-log'
import { cn } from '@/lib/utils'

type LogType = 'all' | 'calendar' | 'students' | 'lessons' | 'payments' | 'settings' | 'system'

type LogEntryView = CrmErrorLogEntry & {
	endpoint: string | null
	eventId: string
	type: Exclude<LogType, 'all'>
	typeLabel: string
	createdDate: Date
	timeLabel: string
	dateLabel: string
	traceId: string
}

const LOG_TYPES: Array<{ value: LogType; label: string }> = [
	{ value: 'all', label: 'All types' },
	{ value: 'calendar', label: 'Calendar' },
	{ value: 'students', label: 'Students' },
	{ value: 'lessons', label: 'Lessons' },
	{ value: 'payments', label: 'Payments' },
	{ value: 'settings', label: 'Settings' },
	{ value: 'system', label: 'System' },
]

const LOG_TYPE_META: Record<
	Exclude<LogType, 'all'>,
	{ label: string; icon: typeof Terminal; badge: 'blue' | 'green' | 'amber' | 'neutral' | 'red' }
> = {
	calendar: { label: 'Calendar', icon: CalendarClock, badge: 'blue' },
	students: { label: 'Students', icon: Users, badge: 'green' },
	lessons: { label: 'Lessons', icon: Database, badge: 'amber' },
	payments: { label: 'Payments', icon: WalletCards, badge: 'green' },
	settings: { label: 'Settings', icon: Settings, badge: 'neutral' },
	system: { label: 'System', icon: Terminal, badge: 'red' },
}

function formatLogTime(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	}).format(new Date(value))
}

function formatLogDate(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: '2-digit',
		year: 'numeric',
	}).format(new Date(value))
}

function inferLogType(error: CrmErrorLogEntry): Exclude<LogType, 'all'> {
	const text = `${error.source} ${error.message}`.toLowerCase()
	if (text.includes('calendar') || text.includes('google')) return 'calendar'
	if (text.includes('student')) return 'students'
	if (text.includes('lesson') || text.includes('attendance')) return 'lessons'
	if (text.includes('payment') || text.includes('billing')) return 'payments'
	if (text.includes('settings') || text.includes('sidebar') || text.includes('theme')) return 'settings'
	return 'system'
}

function extractEndpoint(message: string) {
	const match = message.match(/\b(GET|POST|PATCH|PUT|DELETE)\s+(\/?api\/[^\s:]+)/i)
	if (!match) return null

	const method = match[1].toUpperCase()
	const endpoint = match[2].startsWith('/') ? match[2] : `/${match[2]}`
	return `${method} ${endpoint}`
}

function normalizeLogEntry(error: CrmErrorLogEntry): LogEntryView {
	const type = inferLogType(error)
	return {
		...error,
		endpoint: extractEndpoint(error.message),
		eventId: `log_${error.id.slice(-6)}`,
		type,
		typeLabel: LOG_TYPE_META[type].label,
		createdDate: new Date(error.createdAt),
		timeLabel: formatLogTime(error.createdAt),
		dateLabel: formatLogDate(error.createdAt),
		traceId: `tr_${error.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`,
	}
}

function matchLogQuery(entry: LogEntryView, query: string) {
	if (!query) return true
	return [entry.eventId, entry.traceId, entry.typeLabel, entry.endpoint, entry.source, entry.message]
		.join(' ')
		.toLowerCase()
		.includes(query)
}

export default function ErrorLogPage() {
	const [errors, setErrors] = useState<CrmErrorLogEntry[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isPaused, setIsPaused] = useState(false)
	const [query, setQuery] = useState('')
	const [typeFilter, setTypeFilter] = useState<LogType>('all')
	const [selectedId, setSelectedId] = useState<string | null>(null)

	const syncErrors = useCallback(async () => {
		try {
			setErrors(await listCrmErrors())
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to load CRM errors'
			toast.error('Log stream unavailable', { description: message })
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void syncErrors()
		if (isPaused) return
		return subscribeCrmErrors(() => void syncErrors())
	}, [isPaused, syncErrors])

	const entries = useMemo(
		() => errors.map(normalizeLogEntry).sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime()),
		[errors]
	)
	const normalizedQuery = query.trim().toLowerCase()
	const filteredEntries = useMemo(
		() =>
			entries.filter((entry) => {
				if (typeFilter !== 'all' && entry.type !== typeFilter) return false
				return matchLogQuery(entry, normalizedQuery)
			}),
		[entries, normalizedQuery, typeFilter]
	)
	const selected = entries.find((entry) => entry.id === selectedId) ?? null
	const typeCounts = useMemo(() => {
		return entries.reduce(
			(acc, entry) => {
				acc[entry.type] = (acc[entry.type] ?? 0) + 1
				return acc
			},
			{} as Partial<Record<Exclude<LogType, 'all'>, number>>
		)
	}, [entries])

	async function removeError(errorId: string) {
		try {
			await deleteCrmError(errorId)
			if (selectedId === errorId) setSelectedId(null)
			await syncErrors()
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete log entry'
			toast.error('Delete failed', { description: message })
		}
	}

	async function removeAllErrors() {
		try {
			await clearCrmErrors()
			setSelectedId(null)
			setErrors([])
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to clear log entries'
			toast.error('Clear failed', { description: message })
		}
	}

	return (
		<main className="min-h-full px-4 py-6 sm:px-6">
			<div className="mx-auto w-full max-w-7xl space-y-4">
				<header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex min-w-0 items-center gap-2">
						<Terminal className="size-4 shrink-0 text-ink-muted" />
						<h1 className="font-heading text-xl font-semibold text-ink">Logs</h1>
						<Badge variant="outline" className="ml-1 gap-1.5 font-mono text-[10px] uppercase">
							<span
								className={cn('size-1.5 rounded-full', isPaused ? 'bg-ink-muted/60' : 'animate-pulse bg-success')}
							/>
							{isPaused ? 'paused' : 'live'}
						</Badge>
						<Badge tone={entries.length > 0 ? 'red' : 'green'} className="font-mono tabular-nums">
							{entries.length} saved
						</Badge>
					</div>

					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<InputGroup className="w-full bg-surface sm:w-80">
							<InputGroupAddon>
								<Search className="size-3.5" />
							</InputGroupAddon>
							<InputGroupInput
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="type:calendar token"
								className="font-mono text-xs"
								aria-label="Search logs"
							/>
							<InputGroupAddon align="inline-end">
								<Kbd>/</Kbd>
							</InputGroupAddon>
						</InputGroup>
						<Button size="sm" variant="outline" onClick={() => setIsPaused((current) => !current)}>
							{isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
							{isPaused ? 'Resume' : 'Pause'}
						</Button>
						<Button size="sm" variant="outline" onClick={() => void syncErrors()} disabled={isLoading}>
							<RefreshCw className={cn('size-4', isLoading && 'animate-spin')} />
							Refresh
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={isLoading || entries.length === 0}
							onClick={() => void removeAllErrors()}
						>
							<XCircle className="size-4" />
							Clear all
						</Button>
					</div>
				</header>

				<section className="rounded-xl border border-line bg-surface shadow-xs">
					<div className="flex flex-col gap-3 border-b border-line-soft p-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as LogType)}>
								<SelectTrigger className="h-8 w-44 bg-background font-mono text-xs" aria-label="Filter logs by type">
									<Filter className="size-3.5" />
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{LOG_TYPES.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{LOG_TYPES.filter((item) => item.value !== 'all').map((item) => {
								const value = item.value as Exclude<LogType, 'all'>
								const meta = LOG_TYPE_META[value]
								const Icon = meta.icon
								return (
									<Button
										key={value}
										type="button"
										size="sm"
										variant={typeFilter === value ? 'secondary' : 'ghost'}
										className="h-8 gap-1.5 px-2.5 font-mono text-[11px]"
										onClick={() => setTypeFilter(typeFilter === value ? 'all' : value)}
									>
										<Icon className="size-3.5" />
										{meta.label}
										<span className="text-ink-muted tabular-nums">{typeCounts[value] ?? 0}</span>
									</Button>
								)
							})}
						</div>
						<p className="font-mono text-[11px] text-ink-muted">
							Showing {filteredEntries.length} of {entries.length} entries · click a row for details
						</p>
					</div>

					<div className="overflow-x-auto">
						<Table className="min-w-[1040px] font-mono text-xs">
							<TableHeader>
								<TableRow className="bg-background hover:bg-background">
									<TableHead className="ps-4 text-[10px] tracking-wider">Time</TableHead>
									<TableHead className="text-[10px] tracking-wider">Lvl</TableHead>
									<TableHead className="text-[10px] tracking-wider">Type</TableHead>
									<TableHead className="text-[10px] tracking-wider">Source</TableHead>
									<TableHead className="text-[10px] tracking-wider">Endpoint</TableHead>
									<TableHead className="text-[10px] tracking-wider">Event</TableHead>
									<TableHead className="text-[10px] tracking-wider">Message</TableHead>
									<TableHead className="pe-4 text-right text-[10px] tracking-wider">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading &&
									Array.from({ length: 6 }).map((_, index) => (
										<TableRow key={index}>
											<TableCell colSpan={8} className="px-4 py-2">
												<Skeleton className="h-8 w-full" />
											</TableCell>
										</TableRow>
									))}

								{!isLoading &&
									filteredEntries.map((entry) => (
										<LogTableRow
											key={entry.id}
											entry={entry}
											active={selectedId === entry.id}
											onSelect={() => setSelectedId(entry.id)}
											onDelete={() => void removeError(entry.id)}
										/>
									))}

								{!isLoading && filteredEntries.length === 0 && (
									<TableRow>
										<TableCell colSpan={8} className="px-4 py-12 text-center">
											<div className="mx-auto max-w-sm">
												<AlertCircle className="mx-auto size-5 text-ink-muted" />
												<p className="mt-2 font-heading text-sm font-semibold text-ink">No logs match this view</p>
												<p className="mt-1 text-xs text-ink-muted">
													Clear the query or switch the type filter to inspect another log stream.
												</p>
											</div>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</section>
			</div>

			<LogDetailSheet entry={selected} onClose={() => setSelectedId(null)} onDelete={removeError} />
		</main>
	)
}

function LogTableRow({
	entry,
	active,
	onSelect,
	onDelete,
}: {
	entry: LogEntryView
	active: boolean
	onSelect: () => void
	onDelete: () => void
}) {
	const meta = LOG_TYPE_META[entry.type]
	const Icon = meta.icon

	return (
		<TableRow
			data-active={active}
			tabIndex={0}
			aria-selected={active}
			className={cn(
				'cursor-pointer transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/35 focus-visible:outline-none',
				active ? 'bg-danger-soft/80 hover:bg-danger-soft/80' : 'bg-danger-soft/30 hover:bg-danger-soft/60'
			)}
			onClick={onSelect}
			onKeyDown={(event) => {
				if (event.key !== 'Enter' && event.key !== ' ') return
				event.preventDefault()
				onSelect()
			}}
		>
			<TableCell className="ps-4 text-ink-muted tabular-nums">{entry.timeLabel}</TableCell>
			<TableCell>
				<span className="inline-flex items-center gap-1.5">
					<span className="size-1.5 rounded-full bg-danger" />
					<span className="text-[10px] tracking-wider text-danger uppercase">error</span>
				</span>
			</TableCell>
			<TableCell>
				<Badge tone={meta.badge} className="gap-1.5 font-mono text-[10px]">
					<Icon className="size-3" />
					{meta.label}
				</Badge>
			</TableCell>
			<TableCell className="max-w-40 truncate text-ink-muted">{entry.source}</TableCell>
			<TableCell className="max-w-40 truncate text-ink-muted">{entry.endpoint ?? '-'}</TableCell>
			<TableCell className="text-ink-muted tabular-nums">{entry.eventId}</TableCell>
			<TableCell className="max-w-xl">
				<span className="flex items-center gap-2">
					<AlertTriangle className="size-3.5 shrink-0 text-danger" />
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
							className="size-8 text-ink-muted hover:bg-danger-soft hover:text-danger"
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

function LogDetailSheet({
	entry,
	onClose,
	onDelete,
}: {
	entry: LogEntryView | null
	onClose: () => void
	onDelete: (errorId: string) => Promise<void>
}) {
	const meta = entry ? LOG_TYPE_META[entry.type] : null
	const Icon = meta?.icon ?? Terminal

	return (
		<Sheet open={Boolean(entry)} onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="!max-w-xl gap-0 bg-surface p-0 sm:w-[34rem]" side="right">
				{entry && meta ? (
					<>
						<SheetHeader className="border-b border-line-soft p-5 pr-12">
							<SheetTitle className="flex items-center gap-2 font-mono text-base">
								<span className="size-1.5 rounded-full bg-danger" />
								<span className="text-[10px] tracking-wider text-danger uppercase">error</span>
								<span className="truncate text-ink">{entry.eventId}</span>
								<Badge tone={meta.badge} className="gap-1.5 font-mono text-[10px]">
									<Icon className="size-3" />
									{meta.label}
								</Badge>
							</SheetTitle>
							<p className="mt-1 font-mono text-[11px] text-ink-muted">
								{entry.dateLabel} · {entry.timeLabel} · {entry.source}
							</p>
							<SheetDescription className="sr-only">
								Log details for {entry.eventId}, including message, identifiers, and payload.
							</SheetDescription>
						</SheetHeader>

						<ScrollArea className="min-h-0 flex-1">
							<div className="space-y-6 py-5">
								<LogSection title="Message" copyValue={entry.message}>
									<pre className="overflow-x-auto rounded-md border border-line-soft bg-surface-muted p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink/90">
										{entry.message}
									</pre>
								</LogSection>

								<LogSection title="Identifiers">
									<KeyVal label="Event" value={entry.eventId} copy />
									<KeyVal label="Trace" value={entry.traceId} copy />
									<KeyVal label="Type" value={entry.typeLabel} />
									<KeyVal label="Source" value={entry.source} />
									{entry.endpoint ? <KeyVal label="Endpoint" value={entry.endpoint} copy /> : null}
								</LogSection>

								<LogSection title="Payload" copyValue={JSON.stringify(entry, null, 2)}>
									<pre className="max-h-72 overflow-auto rounded-md border border-line-soft bg-surface-muted p-3 font-mono text-[11px] leading-relaxed text-ink/85">
										{JSON.stringify(
											{
												id: entry.id,
												type: entry.type,
												endpoint: entry.endpoint,
												source: entry.source,
												message: entry.message,
												createdAt: entry.createdAt,
											},
											null,
											2
										)}
									</pre>
								</LogSection>

								<div className="px-5 pb-5">
									<Separator className="mb-4" />
									<div className="flex flex-wrap items-center gap-2">
										<Button size="sm" variant="outline" type="button" onClick={() => void onDelete(entry.id)}>
											<Trash2 className="size-4" />
											Delete log
										</Button>
										<Button size="sm" variant="outline" type="button" onClick={onClose}>
											Close
										</Button>
									</div>
								</div>
							</div>
						</ScrollArea>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	)
}

function LogSection({ title, copyValue, children }: { title: string; copyValue?: string; children: React.ReactNode }) {
	const [copied, setCopied] = useState(false)

	return (
		<section className="px-5">
			<header className="mb-2 flex items-center justify-between gap-3">
				<h3 className="font-mono text-[10px] tracking-[0.25em] text-ink-muted uppercase">{title}</h3>
				{copyValue ? (
					<button
						type="button"
						className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] tracking-[0.2em] text-ink-muted uppercase transition-colors hover:bg-sage-soft hover:text-sage"
						onClick={() => {
							void navigator.clipboard.writeText(copyValue)
							setCopied(true)
							window.setTimeout(() => setCopied(false), 1200)
						}}
					>
						<Copy className="size-3" />
						{copied ? 'Copied' : 'Copy'}
					</button>
				) : null}
			</header>
			<div className="flex flex-col gap-1.5">{children}</div>
		</section>
	)
}

function KeyVal({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
	const [copied, setCopied] = useState(false)

	return (
		<div className="group flex items-baseline justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-sage-soft/45">
			<span className="font-mono text-[10px] tracking-[0.2em] text-ink-muted uppercase">{label}</span>
			<span className="flex min-w-0 items-center gap-1.5">
				<span className="max-w-[280px] truncate font-mono text-[12px] text-ink/90">{value}</span>
				{copy ? (
					<button
						type="button"
						aria-label={`Copy ${label}`}
						className="inline-flex size-5 items-center justify-center rounded text-ink-muted/50 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sage-soft hover:text-sage"
						onClick={() => {
							void navigator.clipboard.writeText(value)
							setCopied(true)
							window.setTimeout(() => setCopied(false), 1200)
						}}
					>
						{copied ? <span className="text-[9px]">ok</span> : <Copy className="size-3" />}
					</button>
				) : null}
			</span>
		</div>
	)
}
