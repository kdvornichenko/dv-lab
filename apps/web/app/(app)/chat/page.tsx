import type { Metadata } from 'next'

import { SkeletonContent } from '@/components/app/skeleton-swap'
import { requireTeacherPage } from '@/lib/session'

import { ChatScreen } from './_components/chat-screen'

export const metadata: Metadata = { title: 'Chat' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function ChatPage({
	searchParams,
}: {
	searchParams: Promise<{ student?: string | string[]; c?: string | string[] }>
}) {
	await requireTeacherPage()
	const { student, c } = await searchParams
	return (
		<SkeletonContent>
			<ChatScreen
				studentId={typeof student === 'string' && UUID.test(student) ? student : null}
				conversationId={typeof c === 'string' && UUID.test(c) ? c : null}
			/>
		</SkeletonContent>
	)
}
