import type { Metadata } from 'next'

import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { requireTeacherPage } from '@/lib/session'

export const metadata: Metadata = { title: 'Students' }

export default async function StudentsPage() {
	await requireTeacherPage()
	return (
		<PageScroll>
			<PageHeader title="Students" />
			<EmptyLine />
		</PageScroll>
	)
}
