'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Chip, Snippet } from '@nextui-org/react'
import { I18nProvider } from '@react-aria/i18n'
import { DateValue, parseDate } from '@internationalized/date'
import { Event } from '@/types/google.types'
import GoogleApiService from '../services/GoogleApiService'
import LoadingScreen from '../components/LoadingScreen'
import AuthButton from '../components/AuthButton'
import DateRangeSelector from '../components/DateRangeSelector'
import EventTable from '../components/EventTable'
import { LogOutIcon } from '@/components/icons'

export default function SchedulePage() {
	const [events, setEvents] = useState<Event[]>([])
	const [authLoading, setAuthLoading] = useState<boolean>(true)
	const [isAuthorized, setIsAuthorized] = useState<boolean | null>(() => {
		const storedToken = window.localStorage.getItem('gapi_token')
		return storedToken ? null : false // null, если токен есть, чтобы триггерить инициализацию
	})

	const [loadingEvents, setLoadingEvents] = useState<boolean>(true)
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

	const initializeAuthorization = useCallback(async () => {
		try {
			setAuthLoading(true)
			googleApiService.current = new GoogleApiService(
				process.env.NEXT_PUBLIC_CLIENT_ID!,
				process.env.NEXT_PUBLIC_API_KEY!,
				process.env.NEXT_PUBLIC_DISCOVERY_DOC!,
				process.env.NEXT_PUBLIC_SCOPES!
			)

			const storedToken = window.localStorage.getItem('gapi_token')
			if (storedToken) {
				await googleApiService.current.initializeClientWithToken(
					storedToken,
					isAuthorized => {
						setIsAuthorized(isAuthorized)
					}
				)
			} else {
				await googleApiService.current.initializeClient(isAuthorized => {
					setIsAuthorized(isAuthorized)
				})
			}
		} catch (error) {
			console.error('Error during authorization:', error)
			setIsAuthorized(false)
		} finally {
			setAuthLoading(false)
		}
	}, [])

	const fetchEvents = useCallback(async () => {
		setLoadingEvents(true)
		setEvents([]) // Очищаем список событий перед загрузкой
		try {
			let fetchedEvents
			if (selectedEventSummary) {
				fetchedEvents =
					await googleApiService.current?.fetchEventsBySummaryAndDateRange(
						selectedEventSummary,
						dateRange
					)
			} else {
				fetchedEvents = await googleApiService.current?.fetchEvents(dateRange)
			}
			setEvents(fetchedEvents || [])
		} catch (error) {
			console.error('Error fetching events:', error)
		} finally {
			setLoadingEvents(false)
		}
	}, [dateRange, selectedEventSummary])

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
		setDateRange(range)
		fetchEvents()
	}

	useEffect(() => {
		initializeAuthorization()
	}, [initializeAuthorization])

	useEffect(() => {
		if (isAuthorized) {
			fetchEvents()
		}
	}, [isAuthorized, fetchEvents])

	const handleAuthClick = () => {
		googleApiService.current?.requestAccessToken()
	}

	const handleLogout = () => {
		window.localStorage.removeItem('gapi_token')
		setIsAuthorized(false)
		setEvents([])
	}

	// Функция для форматирования дат
	const formatDatesByMonth = () => {
		const dateMap: { [key: string]: number[] } = {}

		events.forEach(event => {
			// Проверяем, что дата определена
			const rawDate = event.start.dateTime || event.start.date
			if (!rawDate) return // Пропускаем события без даты

			const date = new Date(rawDate) // Преобразуем в объект Date
			const month = date.toLocaleString('en-US', { month: 'long' })
			const day = date.getDate()

			if (!dateMap[month]) {
				dateMap[month] = []
			}
			dateMap[month].push(day)
		})

		// Сортируем дни в каждом месяце
		for (const month in dateMap) {
			dateMap[month].sort((a, b) => a - b)
		}

		// Форматируем вывод
		return Object.entries(dateMap)
			.map(([month, days]) => `${days.join(', ')} - ${month}`)
			.join('\n')
	}

	if (authLoading) {
		return <LoadingScreen message='Loading Google API...' />
	}

	return (
		<I18nProvider locale='ru-RU'>
			<div className='container mx-auto max-h-dvh relative'>
				{isAuthorized === false ? (
					<AuthButton onClick={handleAuthClick} isAuthorized={isAuthorized} />
				) : (
					<>
						<Button
							isIconOnly
							className='absolute top-0 end-0 translate-x-[calc(100%_+_16px)]'
							onClick={handleLogout}
						>
							<LogOutIcon className='size-4' />
						</Button>
						<Card className='flex flex-col gap-y-4 p-6 shadow-md h-full max-h-dvh'>
							<div className='flex gap-x-4 items-center'>
								{selectedEventSummary && (
									<Chip
										className='cursor-pointer'
										onClose={() => handleEventNameClick(selectedEventSummary)}
									>
										{selectedEventSummary}
									</Chip>
								)}
								<DateRangeSelector
									dateRange={dateRange}
									onChange={handleDateRangeChange}
								/>
							</div>
							{selectedEventSummary && (
								<Snippet
									symbol=''
									classNames={{ pre: 'whitespace-pre-line text-left' }}
								>
									{formatDatesByMonth()}
								</Snippet>
							)}
							<EventTable
								events={events}
								loading={loadingEvents}
								onEventNameClick={handleEventNameClick}
							/>
						</Card>
					</>
				)}
			</div>
		</I18nProvider>
	)
}
