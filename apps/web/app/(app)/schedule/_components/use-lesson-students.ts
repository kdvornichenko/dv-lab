'use client'

import { useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api-client'

import { studentLessonOptionsResponse, type StudentLessonOption } from '@dv-lab/contracts'

export type StudentsState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; rows: StudentLessonOption[] }

async function readStudents(signal: AbortSignal): Promise<StudentsState> {
	for (let attempt = 0; attempt < 2; attempt++) {
		const response = await apiRequest<unknown>('GET', '/students/options', undefined, { signal })
		if (signal.aborted) return { kind: 'error' }
		if (response.ok) {
			const parsed = studentLessonOptionsResponse.safeParse(response.data)
			return parsed.success ? { kind: 'ready', rows: parsed.data.students } : { kind: 'error' }
		}
		if (response.status !== 0 && response.status < 500) break
	}
	return { kind: 'error' }
}

export function useLessonStudents(enabled: boolean): StudentsState {
	const [state, setState] = useState<StudentsState>({ kind: 'loading' })
	useEffect(() => {
		if (!enabled) return
		let request = new AbortController()
		function load() {
			if (document.visibilityState !== 'visible') return
			request.abort()
			request = new AbortController()
			const current = request
			setState((previous) => (previous.kind === 'ready' ? previous : { kind: 'loading' }))
			void readStudents(current.signal).then((result) => {
				if (current.signal.aborted) return
				setState((previous) => (result.kind === 'error' && previous.kind === 'ready' ? previous : result))
			})
		}
		load()
		window.addEventListener('online', load)
		window.addEventListener('focus', load)
		document.addEventListener('visibilitychange', load)
		return () => {
			request.abort()
			window.removeEventListener('online', load)
			window.removeEventListener('focus', load)
			document.removeEventListener('visibilitychange', load)
		}
	}, [enabled])
	return state
}
