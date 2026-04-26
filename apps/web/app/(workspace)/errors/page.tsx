'use client'

import { useCallback, useEffect, useState } from 'react'

import { AlertTriangle, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
	clearCrmErrors,
	deleteCrmError,
	listCrmErrors,
	subscribeCrmErrors,
	type CrmErrorLogEntry,
} from '@/lib/crm/error-log'

function formatErrorTime(value: string) {
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(value))
}

export default function ErrorLogPage() {
	const [errors, setErrors] = useState<CrmErrorLogEntry[]>([])
	const [isLoading, setIsLoading] = useState(true)

	const syncErrors = useCallback(async () => {
		try {
			setErrors(await listCrmErrors())
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to load CRM errors'
			toast.error('CRM errors unavailable', { description: message })
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void syncErrors()
		return subscribeCrmErrors(() => void syncErrors())
	}, [syncErrors])

	async function removeError(errorId: string) {
		try {
			await deleteCrmError(errorId)
			await syncErrors()
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete CRM error'
			toast.error('Delete failed', { description: message })
		}
	}

	async function removeAllErrors() {
		try {
			await clearCrmErrors()
			setErrors([])
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to clear CRM errors'
			toast.error('Clear failed', { description: message })
		}
	}

	return (
		<main className="p-unit min-h-full">
			<div className="mx-auto w-full space-y-5">
				<header className="border-line bg-surface rounded-lg border p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="text-danger font-mono text-xs font-semibold uppercase">System log</p>
							<h1 className="text-ink mt-1 text-xl font-semibold">CRM errors</h1>
							<p className="text-ink-muted mt-1 max-w-2xl text-sm">Request failures from CRM operations.</p>
						</div>
						<div className="flex items-center gap-2">
							<Badge tone={errors.length > 0 ? 'red' : 'green'} className="font-mono tabular-nums">
								{errors.length} saved
							</Badge>
							<Button
								type="button"
								variant="outline"
								disabled={isLoading || errors.length === 0}
								onClick={() => void removeAllErrors()}
							>
								<XCircle className="h-4 w-4" />
								Clear all
							</Button>
						</div>
					</div>
				</header>

				<section className="border-line bg-surface rounded-lg border p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
					<ScrollArea className="max-h-[calc(100dvh-15rem)] min-h-72 pr-3">
						<div className="space-y-2">
							{isLoading &&
								Array.from({ length: 5 }).map((_, index) => (
									<div key={index} className="border-line-soft bg-surface-muted rounded-lg border p-3">
										<div className="flex items-center gap-2">
											<Skeleton className="h-4 w-4 rounded-full" />
											<Skeleton className="h-4 w-36" />
											<Skeleton className="h-3 w-20" />
										</div>
										<Skeleton className="mt-3 h-4 w-full" />
										<Skeleton className="mt-2 h-4 w-2/3" />
									</div>
								))}

							{!isLoading &&
								errors.map((error) => (
									<div
										key={error.id}
										className="border-line-soft bg-surface-muted flex items-start justify-between gap-3 rounded-lg border p-3"
									>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<AlertTriangle className="text-danger h-4 w-4 shrink-0" />
												<p className="font-heading text-ink truncate text-sm font-semibold">{error.source}</p>
												<p className="text-ink-muted font-mono text-xs tabular-nums">
													{formatErrorTime(error.createdAt)}
												</p>
											</div>
											<p className="text-danger mt-2 text-sm leading-6">{error.message}</p>
										</div>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="text-ink-muted hover:bg-danger-soft hover:text-danger"
													aria-label={`Delete ${error.source} error`}
													onClick={() => void removeError(error.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent sideOffset={6}>Delete error</TooltipContent>
										</Tooltip>
									</div>
								))}

							{!isLoading && errors.length === 0 && (
								<div className="border-line-strong bg-surface-muted rounded-lg border border-dashed p-5">
									<p className="font-heading text-ink text-sm font-semibold">No saved errors</p>
									<p className="text-ink-muted mt-1 text-xs">There are no saved failures in this workspace.</p>
								</div>
							)}
						</div>
					</ScrollArea>
				</section>
			</div>
		</main>
	)
}
