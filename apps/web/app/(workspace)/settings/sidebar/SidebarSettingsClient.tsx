'use client'

import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	type DragEndEvent,
	useSensor,
	useSensors,
} from '@dnd-kit/core'
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useMemo, useState } from 'react'

import { Eye, EyeOff, GripVertical, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'

import { iconRegistry, type SidebarItem, useSidebarSettings } from '@/components/SidebarSettingsProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type SidebarFormState = {
	title: string
	href: string
	icon: string
	visible: boolean
}

const emptyForm: SidebarFormState = {
	title: '',
	href: '/',
	icon: 'Circle',
	visible: true,
}

export function SidebarSettingsClient() {
	const { addItem, deleteItem, items, loading, reorderItems, resetItems, toggleItem, updateItem } = useSidebarSettings()
	const [dialogOpen, setDialogOpen] = useState(false)
	const [editingItem, setEditingItem] = useState<SidebarItem | null>(null)
	const [form, setForm] = useState<SidebarFormState>(emptyForm)
	const iconNames = useMemo(() => Object.keys(iconRegistry).sort(), [])
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	)

	function openCreateDialog() {
		setEditingItem(null)
		setForm(emptyForm)
		setDialogOpen(true)
	}

	function openEditDialog(item: SidebarItem) {
		if (item.locked) return
		setEditingItem(item)
		setForm({
			title: item.title,
			href: item.href,
			icon: iconRegistry[item.icon] ? item.icon : 'Circle',
			visible: item.visible,
		})
		setDialogOpen(true)
	}

	function saveItem() {
		const input = {
			title: form.title.trim(),
			href: form.href.trim() || '/',
			icon: form.icon,
			visible: form.visible,
		}
		if (!input.title) return
		if (editingItem) updateItem(editingItem.id, input)
		else addItem(input)
		setDialogOpen(false)
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event
		if (!over || active.id === over.id) return
		reorderItems(String(active.id), String(over.id))
	}

	return (
		<main className="flex min-h-dvh flex-col gap-unit p-unit">
			<div className="mx-auto grid w-full max-w-240 gap-5">
				<header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-medium text-sage">AppSidebar</p>
						<h1 className="mt-2 text-2xl font-semibold text-ink">Sidebar settings</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
							Reorder items, hide secondary links, or add a custom navigation item.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="secondary" onClick={resetItems}>
							<RotateCcw className="h-4 w-4" />
							Reset
						</Button>
						<Button onClick={openCreateDialog}>
							<Plus className="h-4 w-4" />
							Add item
						</Button>
					</div>
				</header>

				<Card className="rounded-lg border-line bg-surface shadow-none">
					<CardHeader className="border-b border-line-soft">
						<CardTitle className="text-base text-ink">Navigation items</CardTitle>
						<p className="text-sm text-ink-muted">
							Drag rows to change order. Locked items cannot be hidden or deleted.
						</p>
					</CardHeader>
					<CardContent className="space-y-3 pt-4">
						{loading ? (
							Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)
						) : (
							<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
								<SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
									<div className="space-y-2">
										{items.map((item) => (
											<SortableSidebarItem
												key={item.id}
												item={item}
												onDelete={deleteItem}
												onEdit={openEditDialog}
												onToggle={toggleItem}
											/>
										))}
									</div>
								</SortableContext>
							</DndContext>
						)}
					</CardContent>
				</Card>
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editingItem ? 'Edit sidebar item' : 'Add sidebar item'}</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="sidebar-title">Title</Label>
							<Input
								id="sidebar-title"
								value={form.title}
								onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="sidebar-href">Path</Label>
							<Input
								id="sidebar-href"
								value={form.href}
								onChange={(event) => setForm((current) => ({ ...current, href: event.target.value }))}
							/>
						</div>
						<div className="grid gap-2">
							<Label>Icon</Label>
							<Select value={form.icon} onValueChange={(icon) => setForm((current) => ({ ...current, icon }))}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{iconNames.map((icon) => (
										<SelectItem key={icon} value={icon}>
											{icon}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={saveItem} disabled={!form.title.trim()}>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	)
}

function SortableSidebarItem({
	item,
	onDelete,
	onEdit,
	onToggle,
}: {
	item: SidebarItem
	onDelete: (id: string) => void
	onEdit: (item: SidebarItem) => void
	onToggle: (id: string) => void
}) {
	const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
	const Icon = iconRegistry[item.icon] ?? iconRegistry.Circle

	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				opacity: isDragging ? 0.58 : 1,
			}}
			className="grid gap-3 rounded-lg border border-line bg-surface-muted p-3 md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:items-center"
		>
			<button
				type="button"
				className="flex h-9 w-9 cursor-grab items-center justify-center rounded-lg text-ink-muted hover:bg-sage-soft active:cursor-grabbing"
				aria-label={`Drag ${item.title}`}
				{...attributes}
				{...listeners}
			>
				<GripVertical className="h-4 w-4" />
			</button>
			<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sage-soft text-sage">
				<Icon className="h-4 w-4" />
			</span>
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium text-ink">{item.title}</p>
					{item.locked && <Badge tone="neutral">locked</Badge>}
					{!item.visible && <Badge tone="amber">hidden</Badge>}
				</div>
				<p className="truncate font-mono text-xs text-ink-muted">{item.href}</p>
			</div>
			<div className="flex gap-1.5 md:justify-end">
				<SidebarToolButton
					label={item.visible ? `Hide ${item.title}` : `Show ${item.title}`}
					disabled={item.locked}
					onClick={() => onToggle(item.id)}
				>
					{item.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
				</SidebarToolButton>
				<SidebarToolButton label={`Edit ${item.title}`} disabled={item.locked} onClick={() => onEdit(item)}>
					<Pencil className="h-4 w-4" />
				</SidebarToolButton>
				<SidebarToolButton
					label={`Delete ${item.title}`}
					disabled={item.locked}
					onClick={() => {
						if (window.confirm(`Delete ${item.title}?`)) onDelete(item.id)
					}}
				>
					<Trash2 className="h-4 w-4" />
				</SidebarToolButton>
			</div>
		</div>
	)
}

function SidebarToolButton({
	children,
	label,
	...props
}: Omit<React.ComponentProps<typeof Button>, 'size' | 'aria-label'> & {
	children: React.ReactNode
	label: string
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button type="button" size="icon" variant="ghost" aria-label={label} {...props}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent sideOffset={6}>{label}</TooltipContent>
		</Tooltip>
	)
}
