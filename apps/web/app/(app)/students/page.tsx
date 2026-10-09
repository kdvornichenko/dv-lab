import type { Metadata } from 'next'

import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'

export const metadata: Metadata = { title: 'Students' }

export default function StudentsPage() {
	return (
		<PageScroll>
			<PageHeader title="Students" />
			<EmptyLine />
		</PageScroll>
	)
}
