'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Chip, Skeleton, Snippet } from '@nextui-org/react'
import { I18nProvider } from '@react-aria/i18n'
import { DateValue, parseDate } from '@internationalized/date'
import { Event } from '@/types/google.types'
import GoogleApiService from '../../services/GoogleApiService'
import DateRangeSelector from '../../components/DateRangeSelector'
import EventTable from '../../components/EventTable'
import { LogOutIcon } from '@/components/icons'
import { useRouter } from 'next/navigation'
import useFetchStore from '@/store/schedule.store'
import { useSession, signOut } from 'next-auth/react'

export default function SchedulePage() {
	const { data: session, status } = useSession()
	const [events, setEvents] = useState<Event[]>([])
	const { isLoading, setIsLoading } = useFetchStore()
	const [selectedEventSummary, setSelectedEventSummary] = useState<
		string | undefined
	>(undefined)
	const [isInitialized, setIsInitialized] = useState(false)

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

	// Инициализация Google API клиента
	useEffect(() => {
		const initializeClient = async () => {
			if (status === 'authenticated' && session?.accessToken) {
				googleApiService.current = new GoogleApiService(
					process.env.GOOGLE_CLIENT_ID!,
					process.env.NEXT_PUBLIC_API_KEY!,
					process.env.NEXT_PUBLIC_DISCOVERY_DOC!,
					process.env.NEXT_PUBLIC_SCOPES!
				)

				try {
					await googleApiService.current.initializeClientWithSession(
						session.accessToken
					)
					setIsInitialized(true) // Устанавливаем состояние после успешной инициализации
				} catch (error) {
					console.error('Error initializing Google API client:', error)
					signOut()
				}
			} else if (status === 'unauthenticated') {
				router.push('/login')
			}
		}

		initializeClient()
	}, [status, session, router])

	// Функция для фетчинга событий
	const fetchEvents = useCallback(async () => {
		if (!isInitialized || status !== 'authenticated') return

		setIsLoading(true)
		try {
			const fetchedEvents = await googleApiService.current?.fetchEvents(
				dateRange,
				router,
				selectedEventSummary
			)

			setEvents(fetchedEvents || [])
		} catch (error) {
			console.error('Error fetching events:', error)
		} finally {
			setIsLoading(false)
		}
	}, [
		dateRange,
		selectedEventSummary,
		router,
		isInitialized,
		status,
		setIsLoading,
	])

	useEffect(() => {
		if (isInitialized) {
			fetchEvents()
		}
	}, [fetchEvents, isInitialized])

	const handleEventNameClick = (summary: string) => {
		setSelectedEventSummary(prev => (prev === summary ? undefined : summary))
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
						<Button isIconOnly onPressEnd={() => signOut()}>
							<LogOutIcon className='size-4' />
						</Button>
					</div>
					{selectedEventSummary &&
						(isLoading ? (
							<Skeleton className='rounded-lg'>
								<div className={`h-10 w-full rounded-lg bg-default-300`} />
							</Skeleton>
						) : formatDatesByMonth() ? (
							<Snippet
								symbol=''
								classNames={{ pre: 'whitespace-pre-line text-left' }}
							>
								{formatDatesByMonth()}
							</Snippet>
						) : (
							<div className='text-left'>
								<Alert
									classNames={{ base: 'items-center' }}
									title='Events not found'
									variant='faded'
									color='primary'
								/>
							</div>
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
