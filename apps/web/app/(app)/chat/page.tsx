import type { Metadata } from 'next'

import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { requireTeacherPage } from '@/lib/session'

export const metadata: Metadata = { title: 'Chat' }

export default async function ChatPage() {
	await requireTeacherPage()
	return (
		<PageScroll>
			<PageHeader title="Chat" />
			<EmptyLine />
		</PageScroll>
	)
}
