import type { Metadata } from 'next'

import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'

export const metadata: Metadata = { title: 'Chat' }

export default function ChatPage() {
	return (
		<PageScroll>
			<PageHeader title="Chat" />
			<EmptyLine />
		</PageScroll>
	)
}
