import type { Metadata } from 'next'

import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'

export const metadata: Metadata = { title: 'Schedule' }

export default function SchedulePage() {
	return (
		<PageScroll>
			<PageHeader title="Schedule" />
			<EmptyLine />
		</PageScroll>
	)
}
