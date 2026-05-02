'use client'

import { type FC, useCallback, useEffect, useMemo, useState } from 'react'

import { AlertCircle, Pause, Play, RefreshCw, Search, Terminal, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
	clearCrmErrors,
	deleteCrmError,
	listCrmErrors,
	subscribeCrmErrors,
	type CrmErrorLogEntry,
} from '@/lib/crm/error-log'
import { cn } from '@/lib/utils'

import { ErrorLogDetailSheet } from './ErrorLogDetailSheet'
import { ErrorLogTableRow } from './ErrorLogTableRow'
import { LOG_TYPES, LOG_TYPE_META, matchLogQuery, normalizeLogEntry } from './error-log-model'
import type { LogEntryType, LogType } from './error-log.types'

const ErrorLogPage: FC = () => {
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
			{} as Partial<Record<LogEntryType, number>>
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
						<Terminal className="text-ink-muted size-4 shrink-0" />
						<h1 className="font-heading text-ink text-xl font-semibold">Logs</h1>
						<Badge variant="outline" className="ml-1 gap-1.5 font-mono text-[10px] uppercase">
							<span
								className={cn('size-1.5 rounded-full', isPaused ? 'bg-ink-muted/60' : 'bg-success animate-pulse')}
							/>
							{isPaused ? 'paused' : 'live'}
						</Badge>
						<Badge tone={entries.length > 0 ? 'red' : 'green'} className="font-mono tabular-nums">
							{entries.length} saved
						</Badge>
					</div>

					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<InputGroup className="bg-surface w-full sm:w-80">
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

				<section className="border-line bg-surface shadow-xs rounded-xl border">
					<div className="border-line-soft flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							{LOG_TYPES.filter((item) => item.value !== 'all').map((item) => {
								const value = item.value as LogEntryType
								const meta = LOG_TYPE_META[value]
								const Icon = meta.icon
								const isActive = typeFilter === value
								return (
									<Button
										key={value}
										type="button"
										size="sm"
										variant={isActive ? 'secondary' : 'ghost'}
										className={cn(
											'relative h-8 gap-1.5 overflow-hidden font-mono text-[11px] transition-all',
											isActive && 'pr-6!'
										)}
										onClick={() => setTypeFilter(isActive ? 'all' : value)}
									>
										<Icon className="size-3.5" />
										{meta.label}
										<span className="text-ink-muted tabular-nums">{typeCounts[value] ?? 0}</span>
										<X
											className={cn(
												'absolute right-1 top-1/2 size-3.5 -translate-y-1/2 transition-all',
												isActive ? 'opacity-100 blur-none' : 'opacity-0 blur-sm'
											)}
										/>
									</Button>
								)
							})}
						</div>
						<p className="text-ink-muted font-mono text-[11px]">
							Showing {filteredEntries.length} of {entries.length} entries · click a row for details
						</p>
					</div>

					<div className="overflow-x-auto">
						<Table className="min-w-260 font-mono text-xs">
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
										<ErrorLogTableRow
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
												<AlertCircle className="text-ink-muted mx-auto size-5" />
												<p className="font-heading text-ink mt-2 text-sm font-semibold">No logs match this view</p>
												<p className="text-ink-muted mt-1 text-xs">
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

			<ErrorLogDetailSheet entry={selected} onClose={() => setSelectedId(null)} onDelete={removeError} />
		</main>
	)
}

export default ErrorLogPage
