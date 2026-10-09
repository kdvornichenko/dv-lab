import type { Metadata } from 'next'

import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'

export const metadata: Metadata = { title: 'Today' }

export default function TodayPage() {
	return (
		<PageScroll>
			<PageHeader title="Today" />
			<EmptyLine />
		</PageScroll>
	)
}
