'use client'

import { useRef, useState, type ReactNode } from 'react'

import { UserPlus } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { StatusDot } from '@/components/app/status-dot'
import { Button } from '@/components/ui/button'

import type { StudentDetail } from '@dv-lab/contracts'

import { CreateAccountDialog } from './create-account-dialog'

interface AccountPanelProps {
	student: StudentDetail
	onChanged: () => void
}

const createdFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

function AccountRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex h-9 items-center gap-2 rounded-lg bg-hover px-2">
			<span className="w-16 shrink-0 text-body text-muted-foreground">{label}</span>
			<span className="flex min-w-0 flex-1 items-center gap-2 truncate text-body text-foreground">{children}</span>
		</div>
	)
}

export function AccountPanel({ student, onChanged }: AccountPanelProps) {
	const [dialog, setDialog] = useState<'create' | null>(null)
	const createButton = useRef<HTMLButtonElement>(null)
	const { account } = student
	const active = account?.status === 'active'

	function closeDialog() {
		setDialog(null)
		requestAnimationFrame(() => createButton.current?.focus())
	}

	return (
		<Panel id="student-account" title="Account" description="Sign-in for this student.">
			<div className="flex flex-col gap-4 px-4 pb-4">
				{account === null ? (
					<p className="text-body text-muted-foreground">No account is linked to this card.</p>
				) : (
					<div className="flex flex-col gap-2">
						<AccountRow label="Login">
							<span className="truncate">{account.login}</span>
						</AccountRow>
						<AccountRow label="Status">
							<StatusDot status={account.status} />
							{active ? 'Active' : 'Deactivated'}
						</AccountRow>
						<AccountRow label="Created">{createdFormat.format(new Date(account.createdAt))}</AccountRow>
					</div>
				)}
				{active && student.status === 'archived' ? (
					<p className="text-caption text-muted-foreground">This card is archived. The account can still sign in.</p>
				) : null}
				{active ? null : (
					<div className="flex flex-wrap gap-2">
						<Button ref={createButton} variant="secondary" leadingIcon={UserPlus} onClick={() => setDialog('create')}>
							Create account
						</Button>
					</div>
				)}
			</div>
			{dialog === 'create' ? (
				<CreateAccountDialog
					studentId={student.id}
					name={student.displayName}
					onClose={closeDialog}
					onCreated={() => {
						closeDialog()
						onChanged()
					}}
					onConflict={onChanged}
				/>
			) : null}
		</Panel>
	)
}
