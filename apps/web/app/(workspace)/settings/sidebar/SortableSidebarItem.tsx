'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { FC } from 'react'

import { Eye, EyeOff, GripVertical, Pencil, Trash2 } from 'lucide-react'

import { iconRegistry } from '@/components/SidebarSettingsProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import type { SidebarToolButtonProps, SortableSidebarItemProps } from './SidebarSettingsClient.types'

export const SortableSidebarItem: FC<SortableSidebarItemProps> = ({ item, onDelete, onEdit, onToggle }) => {
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
			className="border-line bg-surface-muted grid gap-3 rounded-lg border p-3 md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:items-center"
		>
			<button
				type="button"
				className="text-ink-muted hover:bg-sage-soft flex h-9 w-9 cursor-grab items-center justify-center rounded-lg active:cursor-grabbing"
				aria-label={`Drag ${item.title}`}
				{...attributes}
				{...listeners}
			>
				<GripVertical className="h-4 w-4" />
			</button>
			<span className="bg-sage-soft text-sage flex h-9 w-9 items-center justify-center rounded-lg">
				<Icon className="h-4 w-4" />
			</span>
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-heading text-ink font-medium">{item.title}</p>
					{item.locked && <Badge tone="neutral">locked</Badge>}
					{!item.visible && <Badge tone="amber">hidden</Badge>}
				</div>
				<p className="text-ink-muted truncate font-mono text-xs">{item.href}</p>
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

const SidebarToolButton: FC<SidebarToolButtonProps> = ({ children, label, ...props }) => {
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
