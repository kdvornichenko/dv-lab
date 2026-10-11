'use client'

import { useEffect, useRef, useState } from 'react'

import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { apiRequest } from '@/lib/api-client'

import type { StudentDetail, StudentResponse, StudentRow, StudentsResponse } from '@dv-lab/contracts'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; rows: StudentRow[] }

interface PaymentStudentPickerProps {
	disabled: boolean
	onChoose: (student: StudentDetail | null) => void
}

export function PaymentStudentPicker({ disabled, onChoose }: PaymentStudentPickerProps) {
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [studentId, setStudentId] = useState('')
	const [failed, setFailed] = useState(false)
	const requests = useRef(0)

	useEffect(() => {
		let current = true
		void apiRequest<StudentsResponse>('GET', '/students').then((result) => {
			if (current)
				setState(
					result.ok
						? { kind: 'ready', rows: result.data.students.filter((row) => row.status === 'active') }
						: { kind: 'error' }
				)
		})
		return () => {
			current = false
			requests.current += 1
		}
	}, [])

	async function choose(value: string) {
		setStudentId(value)
		setFailed(false)
		onChoose(null)
		const id = ++requests.current
		const result = await apiRequest<StudentResponse>('GET', `/students/${encodeURIComponent(value)}`)
		if (id !== requests.current) return
		if (!result.ok || result.data.student.status !== 'active') {
			setFailed(true)
			return
		}
		onChoose(result.data.student)
	}

	const rows = state.kind === 'ready' ? state.rows : []
	const blocked = state.kind !== 'ready' || rows.length === 0
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<label htmlFor="record-payment-student" className="text-body text-muted-foreground">
				Student
			</label>
			<Select value={studentId} onValueChange={(value) => void choose(value)} disabled={disabled || blocked}>
				<SelectTrigger
					id="record-payment-student"
					className="w-full min-w-0"
					placeholder={state.kind === 'loading' ? 'Loading students…' : 'Choose a student'}
					autoFocus
				/>
				<SelectContent>
					{rows.map((row, index) => (
						<SelectItem key={row.id} index={index} value={row.id}>
							{row.displayName}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{state.kind === 'error' ? (
				<Banner status="error">
					<BannerTitle>Could not load students. Close this dialog and try again.</BannerTitle>
				</Banner>
			) : null}
			{state.kind === 'ready' && rows.length === 0 ? (
				<p className="text-caption text-muted-foreground">No active students. Add a card on the Students page.</p>
			) : null}
			{failed ? (
				<Banner status="error">
					<BannerTitle>Could not load the student. Try again.</BannerTitle>
					<Button
						type="button"
						variant="secondary"
						size="compact"
						disabled={disabled}
						onClick={() => void choose(studentId)}
					>
						Refresh
					</Button>
				</Banner>
			) : null}
		</div>
	)
}
