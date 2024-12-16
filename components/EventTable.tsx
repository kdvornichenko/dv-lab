import React, { FC } from 'react'
import {
	Table,
	TableHeader,
	TableColumn,
	TableBody,
	TableRow,
	TableCell,
	Link,
	Button,
	LinkIcon,
	Skeleton,
} from '@nextui-org/react'
import { Event } from '@/types/google.types'
import useFetchStore from '@/store/schedule.store'

interface EventTableProps {
	events: Event[]
	onEventNameClick: (summary: string) => void
}

const EventTable: FC<EventTableProps> = ({ events, onEventNameClick }) => {
	const { isLoading } = useFetchStore()

	// Функция для форматирования времени
	const formatTime = (time?: string): string =>
		time
			? new Date(time).toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false, // Для 24-часового формата
			  })
			: 'Unknown time'

	// Функция для отображения строки таблицы
	const renderEventRow = (event: Event, index: number) => {
		const { start, end, summary, id, htmlLink } = event
		const formattedDate = start.dateTime
			? new Date(start.dateTime).toLocaleDateString()
			: 'Unknown date'

		return (
			<TableRow key={id}>
				<TableCell>{index + 1}</TableCell>
				<TableCell>{formattedDate}</TableCell>
				<TableCell>
					{formatTime(start.dateTime)}-{formatTime(end.dateTime)}
				</TableCell>
				<TableCell
					onClick={() => onEventNameClick(summary || '')}
					className='hover:bg-foreground-200 rounded-lg cursor-pointer transition-background'
				>
					{summary || 'No title'}
				</TableCell>
				<TableCell>
					<Link href={htmlLink} target='_blank'>
						<Button isIconOnly aria-label='External Link to Calendar Event'>
							<LinkIcon />
						</Button>
					</Link>
				</TableCell>
			</TableRow>
		)
	}

	// Функция для отображения строки-заполнителя
	const renderSkeletonRow = (_: unknown, index: number) => (
		<TableRow key={index}>
			{Array.from({ length: 5 }).map((_, cellIndex) => (
				<TableCell key={cellIndex}>
					<Skeleton className='rounded-lg'>
						<div
							className={`h-5 ${
								cellIndex === 0 ? 'w-5' : cellIndex === 3 ? 'w-10' : 'w-20'
							} rounded-lg bg-default-300`}
						/>
					</Skeleton>
				</TableCell>
			))}
		</TableRow>
	)

	return (
		<Table
			className='h-full overflow-y-auto'
			aria-label='Example table with events'
		>
			<TableHeader>
				<TableColumn>Index</TableColumn>
				<TableColumn>Date</TableColumn>
				<TableColumn>Time</TableColumn>
				<TableColumn>Event Name</TableColumn>
				<TableColumn>Link</TableColumn>
			</TableHeader>
			<TableBody>
				{isLoading
					? Array.from({ length: 5 }).map(renderSkeletonRow)
					: events.map(renderEventRow)}
			</TableBody>
		</Table>
	)
}

export default EventTable
