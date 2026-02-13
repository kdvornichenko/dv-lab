'use client'

import { DateValue, parseDate } from '@internationalized/date'
import { createClient } from '@supabase/supabase-js'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Copy, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { LogOutIcon } from '@/components/icons'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import useFetchStore from '@/store/schedule.store'
import { Event } from '@/types/google.types'

import DateRangeSelector from '../../components/DateRangeSelector'
import EventTable from '../../components/EventTable'
import GoogleApiService from '../../services/GoogleApiService'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function SchedulePage() {
	const [events, setEvents] = useState<Event[]>([])
	const { isLoading, setIsLoading } = useFetchStore()
	const [selectedEventSummary, setSelectedEventSummary] = useState<string | undefined>(undefined)
	const [isInitialized, setIsInitialized] = useState(false)
	const [copied, setCopied] = useState(false)

	const getTodayRange = (): { start: DateValue; end: DateValue } => {
		const today = parseDate(new Date().toISOString().split('T')[0])
		return { start: today, end: today }
	}

	const [dateRange, setDateRange] = useState<{
		start: DateValue | null
		end: DateValue | null
	}>(getTodayRange())

	const googleApiService = useRef<GoogleApiService | null>(null)
	const router = useRouter()

	useEffect(() => {
		const initializeClient = async () => {
			const { data: session, error } = await supabase.auth.getSession()

			if (error || !session?.session?.provider_token) {
				console.error('User not authenticated or missing provider token.')
			}

			googleApiService.current = new GoogleApiService()

			setIsInitialized(true)
		}

		initializeClient()
	}, [router])

	const fetchEvents = useCallback(async () => {
		if (!isInitialized) return

		setIsLoading(true)
		try {
			const fetchedEvents = await googleApiService.current?.fetchEvents(dateRange, router, selectedEventSummary)
			setEvents(fetchedEvents || [])
		} catch (error) {
			console.error('Error fetching events:', error)
		} finally {
			setIsLoading(false)
		}
	}, [dateRange, selectedEventSummary, router, isInitialized, setIsLoading])

	useEffect(() => {
		if (isInitialized) {
			fetchEvents()
		}
	}, [fetchEvents, isInitialized])

	const handleEventNameClick = (summary: string) => {
		setSelectedEventSummary((prev) => (prev === summary ? undefined : summary))
	}

	const handleDateRangeChange = (range: { start: DateValue | null; end: DateValue | null }) => {
		if (
			dateRange.start?.toString() === range.start?.toString() &&
			dateRange.end?.toString() === range.end?.toString()
		) {
			return
		}

		setDateRange(range)
	}

	const formatDatesByMonth = () => {
		const dateMap: { [key: string]: number[] } = {}

		events.forEach((event) => {
			const rawDate = event.start.dateTime || event.start.date
			if (!rawDate) return

			const date = new Date(rawDate)
			const month = date.toLocaleString('en-US', { month: 'long' })
			const day = date.getDate()

			if (!dateMap[month]) {
				dateMap[month] = []
			}
			dateMap[month].push(day)
		})

		for (const month in dateMap) {
			dateMap[month].sort((a, b) => a - b)
		}

		return Object.entries(dateMap)
			.map(([month, days]) => `${days.join(', ')} - ${month}`)
			.join('\n')
	}

	const handleCopy = (text: string) => {
		navigator.clipboard.writeText(text)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	return (
		<div className="container mx-auto max-h-dvh">
			<Card className="h-full max-h-dvh">
				<CardContent className="flex flex-col gap-y-4 p-6">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<DateRangeSelector dateRange={dateRange} onChange={handleDateRangeChange} />
						{selectedEventSummary && (
							<Badge className="cursor-pointer" onClick={() => handleEventNameClick(selectedEventSummary)}>
								{selectedEventSummary}
								<X className="ml-1 h-3 w-3" />
							</Badge>
						)}
						<Button
							variant="ghost"
							size="icon"
							onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
						>
							<LogOutIcon className="size-4" />
						</Button>
					</div>
					{selectedEventSummary &&
						(isLoading ? (
							<Skeleton className="h-10 w-full rounded-lg" />
						) : formatDatesByMonth() ? (
							<div className="relative rounded-lg border bg-muted p-4">
								<pre className="text-left text-sm whitespace-pre-line">{formatDatesByMonth()}</pre>
								<Button
									variant="ghost"
									size="icon"
									className="absolute top-2 right-2"
									onClick={() => handleCopy(formatDatesByMonth())}
								>
									<Copy className="h-4 w-4" />
								</Button>
								{copied && <span className="absolute top-2 right-12 text-xs text-muted-foreground">Скопировано!</span>}
							</div>
						) : (
							<Alert>
								<AlertTitle>Events not found</AlertTitle>
							</Alert>
						))}
					<EventTable events={isLoading ? [] : events} onEventNameClick={handleEventNameClick} />
				</CardContent>
			</Card>
		</div>
	)
}
