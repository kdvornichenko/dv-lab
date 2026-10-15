'use client'

import { useRef, useState, type KeyboardEvent, type RefObject } from 'react'

import {
	Archive,
	ArchiveRestore,
	ChevronLeft,
	ChevronRight,
	Link2,
	LoaderCircle,
	MessageSquare,
	MoreHorizontal,
	UserPlus,
	UserRound,
	UserX,
	Wallet,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DropdownContent, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { MenuItem } from '@/components/ui/menu-item'

import type { StudentDetail } from '@dv-lab/contracts'

import { DeactivateStudentDialog } from '../../_components/deactivate-student-dialog'
import { CreateAccountDialog } from './create-account-dialog'
import { LinkAccountDialog } from './link-account-dialog'

type View = 'main' | 'account'
type AccountDialog = 'create' | 'link' | 'deactivate'

const ITEM = 'h-10 [&_svg]:text-muted-foreground'
const SEMIBOLD = "[&_span]:[font-variation-settings:'wght'_550,'opsz'_18]!"

function accountLine(student: StudentDetail): string {
	const { account } = student
	if (account === null) return 'No sign-in for this student yet.'
	return `Signs in as ${account.login} · ${account.status === 'active' ? 'active' : 'deactivated'}`
}

export function StudentActions({
	student,
	buttonRef,
	openingChat,
	disabled = false,
	onRecordPayment,
	onAskInChat,
	onArchive,
	onRestore,
	onAccountChanged,
}: {
	student: StudentDetail
	buttonRef: RefObject<HTMLButtonElement | null>
	openingChat: boolean
	disabled?: boolean
	onRecordPayment: () => void
	onAskInChat: () => void
	onArchive: () => void
	onRestore: () => void
	onAccountChanged: () => void
}) {
	const [open, setOpen] = useState(false)
	const [view, setView] = useState<View>('main')
	const [dialog, setDialog] = useState<AccountDialog | null>(null)
	const list = useRef<HTMLDivElement>(null)
	const { account } = student
	const active = student.status === 'active'
	const signedIn = account?.status === 'active'

	function changeOpen(next: boolean) {
		setOpen(next)
		if (!next) setView('main')
	}

	function show(next: View) {
		setView(next)
		requestAnimationFrame(() => {
			const first = list.current?.querySelector<HTMLElement>('[role="menuitem"]')
			first?.focus()
		})
	}

	function later(action: () => void) {
		return () => {
			changeOpen(false)
			window.setTimeout(action, 0)
		}
	}

	function keys(event: KeyboardEvent<HTMLDivElement>) {
		if (view !== 'account' || (event.key !== 'Escape' && event.key !== 'ArrowLeft')) return
		event.preventDefault()
		event.stopPropagation()
		show('main')
	}

	function closeDialog() {
		setDialog(null)
		requestAnimationFrame(() => buttonRef.current?.focus())
	}

	function finish() {
		closeDialog()
		onAccountChanged()
	}

	let index = 0
	return (
		<>
			<DropdownMenu open={open} onOpenChange={changeOpen} disabled={disabled || openingChat}>
				<DropdownTrigger
					render={
						<Button
							ref={buttonRef}
							type="button"
							variant="tertiary"
							size="icon"
							data-slot="student-actions"
							aria-label={openingChat ? 'Opening chat…' : 'Student actions'}
							aria-busy={openingChat || undefined}
							disabled={disabled || openingChat}
						/>
					}
				>
					{openingChat ? (
						<LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
					) : (
						<MoreHorizontal />
					)}
				</DropdownTrigger>
				<DropdownContent align="end" className="w-60 min-w-60 bg-surface-4 shadow-surface-4">
					<div ref={list} key={view} className="contents" onKeyDownCapture={keys}>
						{view === 'main' ? (
							<>
								<MenuItem
									index={index++}
									label="Record payment"
									icon={Wallet}
									className={ITEM}
									onSelect={later(onRecordPayment)}
								/>
								{active ? (
									<MenuItem
										index={index++}
										label="Ask in chat"
										icon={MessageSquare}
										className={ITEM}
										onSelect={later(onAskInChat)}
									/>
								) : null}
								<div className="relative">
									<MenuItem
										index={index++}
										label="Account"
										icon={UserRound}
										className={`${ITEM} pr-9`}
										closeOnClick={false}
										data-slot="student-actions-account"
										onSelect={() => show('account')}
									/>
									<ChevronRight
										aria-hidden
										className="pointer-events-none absolute top-1/2 right-3 z-20 size-4 -translate-y-1/2 text-muted-foreground"
									/>
								</div>
								<DropdownSeparator />
								{active ? (
									<MenuItem
										index={index++}
										label="Archive"
										icon={Archive}
										className={ITEM}
										onSelect={later(onArchive)}
									/>
								) : (
									<MenuItem
										index={index++}
										label="Restore"
										icon={ArchiveRestore}
										className={ITEM}
										onSelect={later(onRestore)}
									/>
								)}
							</>
						) : (
							<>
								<MenuItem
									index={index++}
									label="Account"
									icon={ChevronLeft}
									className={`${ITEM} ${SEMIBOLD}`}
									closeOnClick={false}
									data-slot="student-actions-back"
									onSelect={() => show('main')}
								/>
								<DropdownSeparator />
								<p data-slot="student-account-line" className="px-3 py-2 text-caption text-muted-foreground">
									{accountLine(student)}
								</p>
								{signedIn ? (
									<MenuItem
										index={index++}
										label="Deactivate account"
										icon={UserX}
										className={`${ITEM} [&_span]:text-destructive`}
										onSelect={later(() => setDialog('deactivate'))}
									/>
								) : (
									<>
										<MenuItem
											index={index++}
											label="Create account"
											icon={UserPlus}
											className={ITEM}
											onSelect={later(() => setDialog('create'))}
										/>
										<MenuItem
											index={index++}
											label="Link existing account"
											icon={Link2}
											className={ITEM}
											onSelect={later(() => setDialog('link'))}
										/>
									</>
								)}
							</>
						)}
					</div>
				</DropdownContent>
			</DropdownMenu>
			{dialog === 'create' ? (
				<CreateAccountDialog
					studentId={student.id}
					name={student.displayName}
					onClose={closeDialog}
					onCreated={finish}
					onConflict={onAccountChanged}
				/>
			) : null}
			{dialog === 'link' ? (
				<LinkAccountDialog
					studentId={student.id}
					name={student.displayName}
					onClose={closeDialog}
					onLinked={finish}
					onConflict={onAccountChanged}
				/>
			) : null}
			{dialog === 'deactivate' && account !== null ? (
				<DeactivateStudentDialog
					studentId={student.id}
					account={account}
					onClose={closeDialog}
					onDeactivated={finish}
				/>
			) : null}
		</>
	)
}
