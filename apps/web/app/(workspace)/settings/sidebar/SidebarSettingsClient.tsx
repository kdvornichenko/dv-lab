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
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { type FC, useMemo, useState } from 'react'

import { Plus, RotateCcw } from 'lucide-react'

import { iconRegistry, type SidebarItem, useSidebarSettings } from '@/components/SidebarSettingsProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

import type { SidebarFormState } from './SidebarSettingsClient.types'
import { SortableSidebarItem } from './SortableSidebarItem'

const emptyForm: SidebarFormState = {
	title: '',
	href: '/',
	icon: 'Circle',
	visible: true,
}

export const SidebarSettingsClient: FC = () => {
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
		<main className="p-unit min-h-full">
			<div className="grid w-full gap-5">
				<header className="border-line flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sage text-sm font-medium">AppSidebar</p>
						<h1 className="text-ink mt-2 text-2xl font-semibold">Sidebar settings</h1>
						<p className="text-ink-muted mt-2 text-sm leading-6">
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

				<Card className="border-line bg-surface rounded-lg shadow-none">
					<CardHeader className="border-line-soft border-b">
						<CardTitle className="text-ink text-base">Navigation items</CardTitle>
						<p className="text-ink-muted text-sm">
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
				<DialogContent className="p-unit">
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
					<DialogFooter className="mt-unit">
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
