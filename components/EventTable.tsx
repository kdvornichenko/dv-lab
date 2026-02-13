import React, { FC } from 'react'

import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import useFetchStore from '@/store/schedule.store'
import { Event } from '@/types/google.types'

interface EventTableProps {
	events: Event[]
	onEventNameClick: (summary: string) => void
}

const EventTable: FC<EventTableProps> = ({ events, onEventNameClick }) => {
	const { isLoading } = useFetchStore()

	const formatTime = (time?: string): string =>
		time
			? new Date(time).toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false,
				})
			: 'Unknown time'

	const renderEventRow = (event: Event, index: number) => {
		const { start, end, summary, id, htmlLink } = event
		const formattedDate = start.dateTime ? new Date(start.dateTime).toLocaleDateString() : 'Unknown date'

		return (
			<TableRow key={id}>
				<TableCell>{index + 1}</TableCell>
				<TableCell>{formattedDate}</TableCell>
				<TableCell>
					{formatTime(start.dateTime)}-{formatTime(end.dateTime)}
				</TableCell>
				<TableCell
					onClick={() => onEventNameClick(summary || '')}
					className="cursor-pointer rounded-lg transition-colors hover:bg-muted"
				>
					{summary || 'No title'}
				</TableCell>
				<TableCell>
					<a href={htmlLink} target="_blank" rel="noopener noreferrer">
						<Button variant="ghost" size="icon" aria-label="External Link to Calendar Event">
							<ExternalLink className="h-4 w-4" />
						</Button>
					</a>
				</TableCell>
			</TableRow>
		)
	}

	const renderSkeletonRow = (_: unknown, index: number) => (
		<TableRow key={index}>
			{Array.from({ length: 5 }).map((_, cellIndex) => (
				<TableCell key={cellIndex}>
					<Skeleton className={`h-5 ${cellIndex === 0 ? 'w-5' : cellIndex === 3 ? 'w-10' : 'w-20'} rounded-lg`} />
				</TableCell>
			))}
		</TableRow>
	)

	return (
		<Table className="h-full overflow-y-auto">
			<TableHeader>
				<TableRow>
					<TableHead>Index</TableHead>
					<TableHead>Date</TableHead>
					<TableHead>Time</TableHead>
					<TableHead>Event Name</TableHead>
					<TableHead>Link</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>{isLoading ? Array.from({ length: 5 }).map(renderSkeletonRow) : events.map(renderEventRow)}</TableBody>
		</Table>
	)
}

export default EventTable
