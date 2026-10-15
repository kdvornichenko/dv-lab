'use client'

import { Autocomplete } from '@base-ui/react/autocomplete'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'

import {
	CircleAlert,
	LoaderCircle,
	LogOut,
	MessageSquarePlus,
	Monitor,
	Moon,
	Search,
	Sun,
	Wallet,
	type LucideIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'

import { Avatar } from '@/components/app/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api-client'

import { studentLessonOptionsResponse, type StudentLessonOption } from '@dv-lab/contracts'

import { sections } from './sections'
import { useSignOut } from './use-sign-out'

type Action =
	| { type: 'route'; href: string }
	| { type: 'student'; href: string; name: string }
	| { type: 'theme'; theme: 'light' | 'dark' | 'system' }
	| { type: 'sign-out' }

type RowStatus = 'loading' | 'error' | 'empty'

interface Item {
	value: string
	label: string
	icon: LucideIcon | null
	action?: Action
	status?: RowStatus
}

interface Group {
	value: 'Actions' | 'Students' | 'Screens'
	items: Item[]
}

type Roster = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; rows: StudentLessonOption[] }

const NEW_CHAT_HREF = '/chat?new=1'
const NEW_CHAT_VALUE = 'action-new-chat'
const ADD_PAYMENT_HREF = '/?dialog=payment'
const HEADING_WAIT_MS = 5000

const actionItems: Item[] = [
	{
		value: NEW_CHAT_VALUE,
		label: 'New chat',
		icon: MessageSquarePlus,
		action: { type: 'route', href: NEW_CHAT_HREF },
	},
	{
		value: 'action-add-payment',
		label: 'Add payment',
		icon: Wallet,
		action: { type: 'route', href: ADD_PAYMENT_HREF },
	},
	{ value: 'theme-light', label: 'Light theme', icon: Sun, action: { type: 'theme', theme: 'light' } },
	{ value: 'theme-dark', label: 'Dark theme', icon: Moon, action: { type: 'theme', theme: 'dark' } },
	{ value: 'theme-system', label: 'System theme', icon: Monitor, action: { type: 'theme', theme: 'system' } },
	{ value: 'account-sign-out', label: 'Sign out', icon: LogOut, action: { type: 'sign-out' } },
]

const screenItems: Item[] = sections.map((section) => ({
	value: `section-${section.id}`,
	label: section.label,
	icon: section.icon,
	action: { type: 'route', href: section.href },
}))

function searchKey(value: string): string {
	return value.normalize('NFC').toLocaleLowerCase()
}

function matching(items: readonly Item[], term: string): Item[] {
	const key = searchKey(term)
	return items.filter((item) => searchKey(item.label).includes(key))
}

function studentItem(row: StudentLessonOption): Item {
	return {
		value: `student-${row.id}`,
		label: row.displayName,
		icon: null,
		action: { type: 'student', href: `/students/${row.id}`, name: row.displayName },
	}
}

async function readRoster(): Promise<Roster> {
	const response = await apiRequest<unknown>('GET', '/students/options')
	if (!response.ok) return { kind: 'error' }
	const parsed = studentLessonOptionsResponse.safeParse(response.data)
	return parsed.success ? { kind: 'ready', rows: parsed.data.students } : { kind: 'error' }
}

function statusItem(status: RowStatus): Item {
	return { value: `status-${status}`, label: '', icon: null, status }
}

function buildGroups(query: string, roster: Roster): Group[] {
	const trimmed = query.trim()
	const studentsOnly = trimmed.startsWith('@')
	const term = studentsOnly ? trimmed.slice(1).trim() : trimmed
	const groups: Group[] = []
	const actions = studentsOnly ? [] : matching(actionItems, term)
	if (actions.length > 0) groups.push({ value: 'Actions', items: actions })
	if (roster.kind === 'ready') {
		const key = searchKey(term)
		const rows = roster.rows.filter((row) => searchKey(row.displayName).includes(key)).map(studentItem)
		groups.push({ value: 'Students', items: rows.length === 0 ? [statusItem('empty')] : rows })
	} else groups.push({ value: 'Students', items: [statusItem(roster.kind)] })
	const screens = studentsOnly ? [] : matching(screenItems, term)
	if (screens.length > 0) groups.push({ value: 'Screens', items: screens })
	return groups
}

function focusHeading(name: string) {
	const deadline = Date.now() + HEADING_WAIT_MS
	const attempt = () => {
		const heading = Array.from(document.querySelectorAll<HTMLElement>('#content h1')).find((node) =>
			node.textContent?.includes(name)
		)
		if (heading) {
			heading.tabIndex = -1
			heading.focus({ preventScroll: true })
			return
		}
		if (Date.now() < deadline) window.setTimeout(attempt, 50)
	}
	window.setTimeout(attempt, 50)
}

function StatusRow({ status, onRefresh }: { status: RowStatus; onRefresh: () => void }) {
	if (status === 'loading') {
		return (
			<div role="status" className="flex h-9 items-center gap-2 px-2 text-body text-muted-foreground">
				<LoaderCircle className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
				<span>Loading students…</span>
			</div>
		)
	}
	if (status === 'error') {
		return (
			<div role="alert" className="flex min-h-9 items-center gap-2 px-2 text-body text-foreground">
				<CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
				<span className="min-w-0 flex-1">Could not load students.</span>
				<Button variant="secondary" size="compact" onClick={onRefresh}>
					Refresh students
				</Button>
			</div>
		)
	}
	return (
		<p role="status" className="flex h-9 items-center px-2 text-body text-muted-foreground">
			No students found
		</p>
	)
}

interface CommandPaletteProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	initialQuery: string
}

export function CommandPalette({ open, onOpenChange, initialQuery }: CommandPaletteProps) {
	const router = useRouter()
	const { setTheme } = useTheme()
	const { signOut } = useSignOut()
	const [query, setQuery] = useState(initialQuery)
	const [roster, setRoster] = useState<Roster>({ kind: 'loading' })
	const requests = useRef(0)
	const [openingChat, startOpeningChat] = useTransition()
	const chatStarted = useRef(false)

	useEffect(() => {
		if (!chatStarted.current || openingChat) return
		chatStarted.current = false
		onOpenChange(false)
	}, [openingChat, onOpenChange])

	const refresh = useCallback(() => {
		const id = ++requests.current
		setRoster({ kind: 'loading' })
		void readRoster().then((next) => {
			if (id === requests.current) setRoster(next)
		})
	}, [])

	useEffect(() => {
		if (!open) return
		const counter = requests
		const id = ++counter.current
		void readRoster().then((next) => {
			if (id === counter.current) setRoster(next)
		})
		return () => {
			counter.current++
		}
	}, [open])

	const groups = useMemo(() => buildGroups(query, roster), [query, roster])

	function run(item: Item) {
		if (openingChat) return
		const action = item.action
		if (item.value === NEW_CHAT_VALUE && action?.type === 'route') {
			chatStarted.current = true
			startOpeningChat(() => {
				router.push(action.href)
			})
			return
		}
		onOpenChange(false)
		if (action === undefined) return
		if (action.type === 'route') router.push(action.href)
		else if (action.type === 'student') {
			router.push(action.href)
			focusHeading(action.name)
		} else if (action.type === 'theme') setTheme(action.theme)
		else void signOut()
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="lg" position="top" showCloseButton={false} className="overflow-hidden p-0" data-palette="">
				<DialogTitle className="sr-only">Search</DialogTitle>
				<DialogDescription className="sr-only">
					Find a student, go to a screen, start a chat, add a payment, change the theme or sign out.
				</DialogDescription>
				<Autocomplete.Root
					open
					inline
					mode="none"
					items={groups}
					value={query}
					onValueChange={setQuery}
					autoHighlight="always"
					keepHighlight
				>
					<Autocomplete.InputGroup className="flex h-12 items-center gap-2 px-4">
						<Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
						<Autocomplete.Input
							aria-label="Student, screen or action · @ for students"
							placeholder="Student, screen or action · @ for students"
							onKeyDown={(event) => {
								if (event.nativeEvent.isComposing) event.preventBaseUIHandler()
							}}
							className="h-full min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none pointer-coarse:text-[16px]"
						/>
					</Autocomplete.InputGroup>
					<div className="border-t border-border">
						<div className="scroll-fade max-h-[min(60dvh,24rem)] overflow-y-auto">
							<Autocomplete.List className="p-2">
								{(group: Group) => (
									<Autocomplete.Group key={group.value} items={group.items}>
										<Autocomplete.GroupLabel className="px-2 pt-2 pb-1 text-caption text-muted-foreground">
											{group.value}
										</Autocomplete.GroupLabel>
										<Autocomplete.Collection>
											{(item: Item) =>
												item.status === undefined ? (
													<Autocomplete.Item
														key={item.value}
														value={item}
														disabled={openingChat && item.value !== NEW_CHAT_VALUE}
														onClick={() => run(item)}
														className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-body text-foreground outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-active pointer-coarse:h-11"
													>
														{openingChat && item.value === NEW_CHAT_VALUE ? (
															<LoaderCircle
																className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
																aria-hidden
															/>
														) : item.icon === null ? (
															<Avatar name={item.label} />
														) : (
															<item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
														)}
														<span className="min-w-0 flex-1 truncate">
															{openingChat && item.value === NEW_CHAT_VALUE ? 'Opening chat…' : item.label}
														</span>
													</Autocomplete.Item>
												) : (
													<StatusRow key={item.value} status={item.status} onRefresh={refresh} />
												)
											}
										</Autocomplete.Collection>
									</Autocomplete.Group>
								)}
							</Autocomplete.List>
						</div>
					</div>
				</Autocomplete.Root>
			</DialogContent>
		</Dialog>
	)
}
