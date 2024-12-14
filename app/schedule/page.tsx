'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Chip, Skeleton, Snippet } from '@nextui-org/react'
import { I18nProvider } from '@react-aria/i18n'
import { DateValue, parseDate } from '@internationalized/date'
import { Event } from '@/types/google.types'
import GoogleApiService from '../../services/GoogleApiService'
import DateRangeSelector from '../components/DateRangeSelector'
import EventTable from '../components/EventTable'
import { LogOutIcon } from '@/components/icons'
import { useRouter } from 'next/navigation'
import useFetchStore from '@/store/schedule.store'

export default function SchedulePage() {
	const [events, setEvents] = useState<Event[]>([])
	const { isLoading, setIsLoading } = useFetchStore()
	const [selectedEventSummary, setSelectedEventSummary] = useState<
		string | null
	>(null)

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

	const fetchEvents = useCallback(async () => {
		setIsLoading(true)

		try {
			const fetchedEvents = selectedEventSummary
				? await googleApiService.current?.fetchEventsBySummaryAndDateRange(
						selectedEventSummary,
						dateRange,
						router
				  )
				: await googleApiService.current?.fetchEvents(dateRange, router)

			setEvents(fetchedEvents || [])
		} catch (error) {
			console.error('Error fetching events:', error)
		} finally {
			setTimeout(() => {
				setIsLoading(false)
			}, 500)
		}
	}, [dateRange, selectedEventSummary, router, setIsLoading])

	useEffect(() => {
		const initializeGoogleClient = async () => {
			const storedToken =
				typeof window !== 'undefined'
					? window.localStorage.getItem('gapi_token')
					: null

			if (!storedToken) {
				router.push('/login')
				return
			}

			googleApiService.current = new GoogleApiService(
				process.env.NEXT_PUBLIC_CLIENT_ID!,
				process.env.NEXT_PUBLIC_API_KEY!,
				process.env.NEXT_PUBLIC_DISCOVERY_DOC!,
				process.env.NEXT_PUBLIC_SCOPES!
			)

			try {
				await googleApiService.current.initializeClientWithToken(
					storedToken,
					isAuthorized => {
						if (!isAuthorized) {
							router.push('/login')
						} else {
							fetchEvents()
						}
					},
					router
				)
			} catch {
				router.push('/login')
			}
		}

		initializeGoogleClient()
	}, [router, fetchEvents])

	const handleEventNameClick = (summary: string) => {
		if (selectedEventSummary === summary) {
			setSelectedEventSummary(null)
			fetchEvents()
		} else {
			setSelectedEventSummary(summary)
			fetchEvents()
		}
	}

	const handleDateRangeChange = (range: {
		start: DateValue | null
		end: DateValue | null
	}) => {
		if (
			dateRange.start?.toString() === range.start?.toString() &&
			dateRange.end?.toString() === range.end?.toString()
		) {
			return
		}

		setDateRange(range)

		if (googleApiService.current) {
			fetchEvents()
		} else {
			console.error('Google API service is not initialized')
		}
	}

	const handleLogout = () => {
		if (typeof window !== 'undefined') {
			window.localStorage.removeItem('gapi_token')
		}
		router.push('/login')
	}

	const formatDatesByMonth = () => {
		const dateMap: { [key: string]: number[] } = {}

		events.forEach(event => {
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

	return (
		<I18nProvider locale='ru-RU'>
			<div className='container mx-auto max-h-dvh'>
				<Card className='flex flex-col gap-y-4 p-6 shadow-md h-full max-h-dvh'>
					<div className='flex items-center flex-wrap gap-4 justify-between'>
						<DateRangeSelector
							dateRange={dateRange}
							onChange={handleDateRangeChange}
						/>
						{selectedEventSummary && (
							<Chip
								className='cursor-pointer'
								onClose={() => handleEventNameClick(selectedEventSummary)}
							>
								{selectedEventSummary}
							</Chip>
						)}
						<Button isIconOnly onClick={handleLogout}>
							<LogOutIcon className='size-4' />
						</Button>
					</div>
					{selectedEventSummary &&
						(isLoading ? (
							<Skeleton className='rounded-lg'>
								<div className={`h-10 w-full rounded-lg bg-default-300`} />
							</Skeleton>
						) : (
							<Snippet
								symbol=''
								classNames={{ pre: 'whitespace-pre-line text-left' }}
							>
								{formatDatesByMonth()}
							</Snippet>
						))}
					<EventTable
						events={isLoading ? [] : events}
						onEventNameClick={handleEventNameClick}
					/>
				</Card>
			</div>
		</I18nProvider>
	)
}
