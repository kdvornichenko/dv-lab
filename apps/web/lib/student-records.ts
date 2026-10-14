import { apiRequest } from '@/lib/api-client'

import type { ChatStudentFacts } from '@dv-lab/contracts'

export type StudentRecords = { kind: 'ready'; facts: ChatStudentFacts } | { kind: 'missing' } | { kind: 'error' }

const REUSE_MS = 60_000

const cache = new Map<string, { facts: ChatStudentFacts; at: number }>()

export function cachedStudentRecords(studentId: string): StudentRecords | null {
	const hit = cache.get(studentId)
	return hit !== undefined && Date.now() - hit.at < REUSE_MS ? { kind: 'ready', facts: hit.facts } : null
}

export async function readStudentRecords(studentId: string): Promise<StudentRecords> {
	const result = await apiRequest<ChatStudentFacts>('GET', `/chat/records?studentId=${encodeURIComponent(studentId)}`)
	if (result.ok) {
		cache.set(studentId, { facts: result.data, at: Date.now() })
		return { kind: 'ready', facts: result.data }
	}
	return result.status === 404 ? { kind: 'missing' } : { kind: 'error' }
}
