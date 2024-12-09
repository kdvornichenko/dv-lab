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

interface EventTableProps {
	events: Event[]
	loading: boolean
	onEventNameClick: (summary: string) => void
}

const EventTable: FC<EventTableProps> = ({
	events,
	loading,
	onEventNameClick,
}) => {
	return (
		<>
			<Table
				className='h-full overflow-y-auto'
				aria-label='Example table with events'
			>
				<TableHeader>
					<TableColumn>Index</TableColumn>
					<TableColumn>Date</TableColumn>
					<TableColumn>Event Name</TableColumn>
					<TableColumn>Link</TableColumn>
				</TableHeader>
				<TableBody>
					{loading
						? Array.from({ length: 5 }).map((_, index) => (
								<TableRow key={index}>
									{Array.from({ length: 4 }).map((_, cellIndex) => (
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
								const startDate = event.start.dateTime || event.start.date
								const formattedDate = startDate
									? new Date(startDate).toLocaleDateString()
									: 'Unknown date'

								return (
									<TableRow key={event.id}>
										<TableCell>{index + 1}</TableCell>
										<TableCell>{formattedDate}</TableCell>
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
