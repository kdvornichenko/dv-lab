'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
	Card,
	Table,
	Spinner,
	TableHeader,
	TableColumn,
	TableBody,
	TableRow,
	TableCell,
	Link,
	Button,
	LinkIcon,
	CalendarDate,
	DateRangePicker,
} from '@nextui-org/react'
import { I18nProvider } from '@react-aria/i18n'
import { DateValue, parseDate } from '@internationalized/date'
import { SearchIcon } from '@/components/icons'
import { ApiError, Event, TokenClient } from '@/types/google.types'

export default function SchedulePage() {
	const [events, setEvents] = useState<Event[]>([])
	const [authLoading, setAuthLoading] = useState<boolean>(true)
	const [isAuthorized, setIsAuthorized] = useState<boolean>(false)
	const [loadingEvents, setLoadingEvents] = useState<boolean>(false)

	const getCurrentWeekRange = (): { start: DateValue; end: DateValue } => {
		const now = new Date()
		const dayOfWeek = now.getDay() // 0 (Sunday) - 6 (Saturday)
		const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek

		const startDate = new Date(now)
		startDate.setDate(now.getDate() + diffToMonday)

		const endDate = new Date(startDate)
		endDate.setDate(startDate.getDate() + 6)

		// Преобразование в DateValue (используя parseDate из @internationalized/date)
		return {
			start: parseDate(startDate.toISOString().split('T')[0]),
			end: parseDate(endDate.toISOString().split('T')[0]),
		}
	}

	// Храним даты как DateValue | null, чтобы соответствовать типам DatePicker
	const [dateRange, setDateRange] = useState<{
		start: DateValue | null
		end: DateValue | null
	}>(() => getCurrentWeekRange())

	const tokenClientRef = useRef<TokenClient | null>(null)

	// Google API settings
	const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID!
	const API_KEY = process.env.NEXT_PUBLIC_API_KEY!
	const DISCOVERY_DOC = process.env.NEXT_PUBLIC_DISCOVERY_DOC
	const SCOPES = process.env.NEXT_PUBLIC_SCOPES

	const fetchEvents = useCallback(async () => {
		try {
			console.log('Fetching events from Google Calendar...')

			// Формируем начальную дату
			const timeMin = dateRange.start?.toDate('UTC').toISOString()

			// Корректируем конечную дату, добавляя один день
			let timeMax: string | undefined = undefined
			if (dateRange.end) {
				const endDateJs = dateRange.end.toDate('UTC')
				const endDatePlusOne = new Date(
					endDateJs.getTime() + 24 * 60 * 60 * 1000
				)
				timeMax = endDatePlusOne.toISOString()
			}

			// Запрашиваем события
			const response = await window.gapi.client.calendar.events.list({
				calendarId: 'primary',
				timeMin,
				timeMax,
				showDeleted: false,
				singleEvents: true,
				orderBy: 'startTime',
			})

			const events = response.result.items || []
			console.log(response)
			setEvents(events as Event[])
		} catch (error) {
			if (typeof error === 'object' && error !== null && 'status' in error) {
				const apiError = error as ApiError
				if (apiError.status === 401) {
					handleLogout()
				}
			} else {
				console.error('Unknown error:', error)
			}
		} finally {
			setLoadingEvents(false)
		}
	}, [dateRange]) // Добавляем зависимость

	useEffect(() => {
		if (typeof window === 'undefined') return

		const initializeClient = async () => {
			try {
				console.log('Initializing Google API client...')
				window.gapi.load('client', async () => {
					await window.gapi.client.init({
						apiKey: API_KEY,
						discoveryDocs: [DISCOVERY_DOC || ''],
					})

					tokenClientRef.current =
						window.google.accounts.oauth2.initTokenClient({
							client_id: CLIENT_ID,
							scope: SCOPES || '',
							callback: resp => {
								if (resp.error) {
									console.error('Authorization error:', resp.error)
									return
								}
								console.log('Authorized successfully')
								localStorage.setItem('gapi_token', resp.access_token)
								setIsAuthorized(true)
								fetchEvents()
							},
						})

					console.log('Google API client initialized')
					setAuthLoading(false)
				})
			} catch (error) {
				console.error('Error initializing Google API client:', error)
				setAuthLoading(false)
			}
		}

		const initializeClientWithToken = async (token: string) => {
			try {
				console.log('Initializing Google API client with token...')
				await loadGoogleAPIScript()
				window.gapi.load('client', async () => {
					await window.gapi.client.init({
						apiKey: API_KEY,
						discoveryDocs: [DISCOVERY_DOC || ''],
					})
					window.gapi.client.setToken({ access_token: token })
					console.log('Token set successfully')
					setIsAuthorized(true)
					fetchEvents()
					setAuthLoading(false)
				})
			} catch (error) {
				console.error('Error initializing client with token:', error)
				setAuthLoading(false)
			}
		}

		const loadScripts = async () => {
			try {
				console.log('Loading Google API scripts...')
				await loadGoogleAPIScript()
				await loadGoogleIdentityScript()
				initializeClient()
			} catch (error) {
				console.error('Error loading scripts:', error)
				setAuthLoading(false)
			}
		}

		const storedToken = localStorage.getItem('gapi_token')
		if (storedToken) {
			console.log('Found stored token, initializing client with token...')
			initializeClientWithToken(storedToken)
		} else {
			loadScripts()
		}
	}, [CLIENT_ID, API_KEY, DISCOVERY_DOC, SCOPES, fetchEvents])

	const loadGoogleAPIScript = (): Promise<void> =>
		new Promise((resolve, reject) => {
			if (typeof window.gapi !== 'undefined') {
				console.log('Google API script already loaded.')
				return resolve()
			}
			const script = document.createElement('script')
			script.src = 'https://apis.google.com/js/api.js'
			script.onload = () => {
				console.log('Google API script loaded')
				resolve()
			}
			script.onerror = () =>
				reject(new Error('Failed to load Google API script'))
			document.body.appendChild(script)
		})

	const loadGoogleIdentityScript = (): Promise<void> =>
		new Promise((resolve, reject) => {
			if (typeof window.google !== 'undefined' && window.google.accounts) {
				console.log('Google Identity Services script already loaded.')
				return resolve()
			}
			const script = document.createElement('script')
			script.src = 'https://accounts.google.com/gsi/client'
			script.onload = () => {
				console.log('Google Identity Services script loaded')
				resolve()
			}
			script.onerror = () =>
				reject(new Error('Failed to load Google Identity Services script'))
			document.body.appendChild(script)
		})

	const handleAuthClick = () => {
		if (!tokenClientRef.current) {
			console.error('Token client not initialized')
			return
		}
		console.log('Requesting access token...')
		setLoadingEvents(true)
		tokenClientRef.current.requestAccessToken()
	}

	const handleLogout = () => {
		console.log('Invalid credentials, logging out user...')
		localStorage.removeItem('gapi_token')
		setIsAuthorized(false)
		setEvents([])
	}

	if (authLoading) {
		return (
			<div className='flex flex-col items-center justify-center h-screen'>
				<Spinner size='lg' />
				<p className='text-lg mt-4'>Loading Google API...</p>
			</div>
		)
	}

	if (!isAuthorized) {
		return (
			<div className='flex flex-col items-center justify-center h-screen'>
				<button
					onClick={handleAuthClick}
					className='mb-4 px-4 py-2 bg-blue-500 text-white rounded'
				>
					Authorize
				</button>
			</div>
		)
	}

	if (loadingEvents) {
		return (
			<div className='flex flex-col items-center justify-center h-screen'>
				<Spinner size='lg' />
				<p className='text-lg mt-4'>Loading events...</p>
			</div>
		)
	}

	return (
		<I18nProvider locale='ru-RU'>
			<div className='container mx-auto px-4 py-8'>
				<Card className='p-6 shadow-md'>
					<h3 className='text-xl font-semibold mb-4'>Filter Events by Date</h3>
					<div className='flex space-x-4 mb-4'>
						<DateRangePicker
							showMonthAndYearPickers
							variant='bordered'
							className='max-w-md'
							value={{
								start: dateRange.start as unknown as CalendarDate,
								end: dateRange.end as unknown as CalendarDate,
							}}
							onChange={range => setDateRange(range)}
						/>
						<Button onClick={fetchEvents} isIconOnly>
							<SearchIcon />
						</Button>
					</div>
					<Table aria-label='Example table with events'>
						<TableHeader>
							<TableColumn>Index</TableColumn>
							<TableColumn>Date</TableColumn>
							<TableColumn>Event Name</TableColumn>
							<TableColumn>Link</TableColumn>
						</TableHeader>
						<TableBody>
							{events.map((event, index) => {
								const startDate = event.start.dateTime || event.start.date
								const formattedDate = startDate
									? new Date(startDate).toLocaleDateString()
									: 'Unknown date'

								return (
									<TableRow key={event.id}>
										<TableCell>{index + 1}</TableCell>
										<TableCell>{formattedDate}</TableCell>
										<TableCell>{event.summary || 'No title'}</TableCell>
										<TableCell>
											<Link href={event.htmlLink} target='_blank'>
												<Button
													isIconOnly
													aria-label='External Link to Calendar Event'
												>
													<LinkIcon />
												</Button>
											</Link>
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</Card>
			</div>
		</I18nProvider>
	)
}
