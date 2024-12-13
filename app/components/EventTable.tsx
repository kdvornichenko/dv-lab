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

	return (
		<>
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
						? Array.from({ length: 5 }).map((_, index) => (
								<TableRow key={index}>
									{Array.from({ length: 5 }).map((_, cellIndex) => (
										<TableCell key={cellIndex}>
											<Skeleton className='rounded-lg'>
												<div
													className={`h-5 ${
														cellIndex === 0
															? 'w-5'
															: cellIndex === 3
															? 'w-10'
															: 'w-20'
													} rounded-lg bg-default-300`}
												/>
											</Skeleton>
										</TableCell>
									))}
								</TableRow>
						  ))
						: events?.map((event, index) => {
								const start = event.start.dateTime
								const end = event.end.dateTime

								const formattedDate = start
									? new Date(start).toLocaleDateString()
									: 'Unknown date'

								const formattedTime = (time: string) =>
									time
										? new Date(time).toLocaleTimeString('en-US', {
												hour: '2-digit',
												minute: '2-digit',
												hour12: false, // Для 24-часового формата
										  })
										: 'Unknown date'

								return (
									<TableRow key={event.id}>
										<TableCell>{index + 1}</TableCell>
										<TableCell>{formattedDate}</TableCell>
										<TableCell>
											{formattedTime(start)}-{formattedTime(end)}
										</TableCell>
										<TableCell
											onClick={() => onEventNameClick(event.summary || '')}
											className='hover:bg-foreground-200 rounded-lg cursor-pointer transition-background'
										>
											{event.summary || 'No title'}
										</TableCell>
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
		</>
	)
}

export default EventTable
