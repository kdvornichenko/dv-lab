'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { apiRequest } from '@/lib/api-client'

import type { ChatStudentFacts } from '@dv-lab/contracts'

import { StudentFacts, StudentFactsSkeleton } from './student-facts'

type ReadState =
	{ kind: 'loading' } | { kind: 'error' } | { kind: 'missing' } | { kind: 'ready'; facts: ChatStudentFacts }

async function readRecords(studentId: string): Promise<ReadState> {
	const result = await apiRequest<ChatStudentFacts>('GET', `/chat/records?studentId=${encodeURIComponent(studentId)}`)
	if (result.ok) return { kind: 'ready', facts: result.data }
	return result.status === 404 ? { kind: 'missing' } : { kind: 'error' }
}

function StudentRecords({ studentId }: { studentId: string }) {
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [refreshing, setRefreshing] = useState(false)
	const requests = useRef(0)

	const load = useCallback(async () => {
		const id = ++requests.current
		const next = await readRecords(studentId)
		if (id === requests.current) setState(next)
	}, [studentId])

	useEffect(() => {
		const counter = requests
		void load()
		return () => {
			counter.current++
		}
	}, [load])

	async function refresh() {
		setRefreshing(true)
		try {
			await load()
		} finally {
			setRefreshing(false)
		}
	}

	if (state.kind === 'loading') return <StudentFactsSkeleton />
	if (state.kind === 'missing') return <EmptyLine text="This student is no longer available." />
	if (state.kind === 'error') {
		return (
			<Banner status="error" aria-busy={refreshing}>
				<BannerTitle>Could not read the student&apos;s records.</BannerTitle>
				<BannerActions>
					<BannerAction disabled={refreshing} onClick={() => void refresh()}>
						{refreshing ? 'Refreshing…' : 'Refresh records'}
					</BannerAction>
				</BannerActions>
			</Banner>
		)
	}
	return <StudentFacts facts={state.facts} />
}

export function ChatScreen({ studentId }: { studentId: string | null }) {
	return (
		<PageScroll>
			<div className="mx-auto flex w-full max-w-180 flex-col gap-4">
				<PageHeader title="Chat" />
				{studentId === null ? (
					<EmptyLine text="What do you want to ask?" />
				) : (
					<StudentRecords key={studentId} studentId={studentId} />
				)}
			</div>
		</PageScroll>
	)
}
