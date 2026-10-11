'use client'

import { useRef, useState, type ReactNode, type RefObject } from 'react'

import { Pencil } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { MoneyText } from '@/components/app/ledger-text'
import { Button } from '@/components/ui/button'

import type { StudentDetail } from '@dv-lab/contracts'

import { StudentFormDialog } from '../../_components/student-form-dialog'
import { AccountPanel } from './account-panel'
import { OpeningBalancePanel } from './opening-balance-panel'

interface OverviewTabProps {
	student: StudentDetail
	lessonsInputRef: RefObject<HTMLInputElement | null>
	onSaved: () => void
}

function NotSet() {
	return <span className="text-muted-foreground">Not set</span>
}

function textValue(value: string | null) {
	return value === null ? <NotSet /> : value
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-4 px-4 pb-2">
			<dt className="w-32 shrink-0 text-body text-muted-foreground">{label}</dt>
			<dd className="min-w-0 text-right text-body wrap-anywhere text-foreground">{children}</dd>
		</div>
	)
}

export function OverviewTab({ student, lessonsInputRef, onSaved }: OverviewTabProps) {
	const [editOpen, setEditOpen] = useState(false)
	const editButton = useRef<HTMLButtonElement>(null)

	return (
		<div className="grid gap-4 md:gap-6 lg:grid-cols-2">
			<Panel
				id="student-details"
				title="Details"
				action={
					<Button
						ref={editButton}
						variant="ghost"
						size="compact"
						leadingIcon={Pencil}
						onClick={() => setEditOpen(true)}
					>
						Edit details
					</Button>
				}
			>
				<dl className="flex flex-col pt-2">
					<DetailRow label="Rate">
						{student.rateMinor === null ? (
							<NotSet />
						) : (
							<>
								<MoneyText amountMinor={student.rateMinor} currency={student.currency} /> per lesson
							</>
						)}
					</DetailRow>
					<DetailRow label="Lesson length">
						<span className="tabular-nums">{student.defaultLessonMinutes} min</span>
					</DetailRow>
					<DetailRow label="No-show">
						{student.noShowDeducts ? (
							'Deducts a lesson'
						) : (
							<span className="text-muted-foreground">Deducts nothing</span>
						)}
					</DetailRow>
					<DetailRow label="Parent">{textValue(student.parent)}</DetailRow>
					<DetailRow label="Level">{textValue(student.level)}</DetailRow>
					<DetailRow label="Goals">{textValue(student.goals)}</DetailRow>
					<DetailRow label="Time zone">{student.timeZone ?? 'Same as teacher'}</DetailRow>
				</dl>
			</Panel>
			<div className="flex min-w-0 flex-col gap-4 md:gap-6">
				<OpeningBalancePanel student={student} lessonsInputRef={lessonsInputRef} onSaved={onSaved} />
				<AccountPanel student={student} onChanged={onSaved} />
			</div>
			{editOpen ? (
				<StudentFormDialog
					mode="edit"
					student={student}
					onClose={() => {
						setEditOpen(false)
						requestAnimationFrame(() => editButton.current?.focus())
					}}
					onSaved={() => {
						setEditOpen(false)
						requestAnimationFrame(() => editButton.current?.focus())
						onSaved()
					}}
				/>
			) : null}
		</div>
	)
}
