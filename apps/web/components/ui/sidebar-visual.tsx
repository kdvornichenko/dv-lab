'use client'

import { Slot } from '@radix-ui/react-slot'

import * as React from 'react'

import { cva } from 'class-variance-authority'

import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
	return (
		<main
			data-slot="sidebar-inset"
			className={cn(
				'bg-background relative flex w-full flex-1 flex-col',
				'tab-sm:w-[calc(100vw-var(--sidebar-width-current))] tab-sm:peer-data-[variant=inset]:m-2 tab-sm:peer-data-[variant=inset]:ml-0 tab-sm:peer-data-[variant=inset]:rounded-xl tab-sm:peer-data-[variant=inset]:shadow-sm tab-sm:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
				className
			)}
			{...props}
		/>
	)
}

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
	return (
		<Input
			data-slot="sidebar-input"
			data-sidebar="input"
			className={cn('bg-background h-8 w-full shadow-none', className)}
			{...props}
		/>
	)
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="sidebar-header"
			data-sidebar="header"
			className={cn('flex flex-col gap-2 p-2', className)}
			{...props}
		/>
	)
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="sidebar-footer"
			data-sidebar="footer"
			className={cn('flex flex-col gap-2 p-2', className)}
			{...props}
		/>
	)
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
	return (
		<Separator
			data-slot="sidebar-separator"
			data-sidebar="separator"
			className={cn('bg-sidebar-border mx-2 w-auto', className)}
			{...props}
		/>
	)
}

function SidebarContent({ className, children, dir, ...props }: React.ComponentProps<'div'>) {
	return (
		<ScrollArea
			dir={dir as 'ltr' | 'rtl'}
			data-slot="sidebar-content"
			data-sidebar="content"
			className={cn('flex min-h-0 flex-1 flex-col gap-2 group-data-[collapsible=icon]:overflow-hidden', className)}
			{...props}
		>
			{children}
		</ScrollArea>
	)
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="sidebar-group"
			data-sidebar="group"
			className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
			{...props}
		/>
	)
}

function SidebarGroupLabel({
	className,
	asChild = false,
	...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : 'div'

	return (
		<Comp
			data-slot="sidebar-group-label"
			data-sidebar="group-label"
			className={cn(
				'text-sidebar-foreground/70 ring-sidebar-ring outline-hidden flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
				'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
				className
			)}
			{...props}
		/>
	)
}

function SidebarGroupAction({
	className,
	asChild = false,
	...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : 'button'

	return (
		<Comp
			data-slot="sidebar-group-action"
			data-sidebar="group-action"
			className={cn(
				'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-hidden absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
				'tab-sm:after:hidden after:absolute after:-inset-2',
				'group-data-[collapsible=icon]:hidden',
				className
			)}
			{...props}
		/>
	)
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="sidebar-group-content"
			data-sidebar="group-content"
			className={cn('w-full text-sm', className)}
			{...props}
		/>
	)
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
	return (
		<ul
			data-slot="sidebar-menu"
			data-sidebar="menu"
			className={cn('flex w-full min-w-0 flex-col gap-1', className)}
			{...props}
		/>
	)
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
	return (
		<li
			data-slot="sidebar-menu-item"
			data-sidebar="menu-item"
			className={cn('group/menu-item relative', className)}
			{...props}
		/>
	)
}

const sidebarMenuButtonVariants = cva(
	'peer/menu-button ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground outline-hidden group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm transition-[width,height,padding] focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:font-medium [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
	{
		variants: {
			variant: {
				default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
				outline:
					'bg-background hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
			},
			size: {
				default: 'h-8 text-sm',
				sm: 'h-7 text-xs',
				lg: 'group-data-[collapsible=icon]:p-0! h-12 text-sm',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
)

function SidebarMenuAction({
	className,
	asChild = false,
	showOnHover = false,
	...props
}: React.ComponentProps<'button'> & {
	asChild?: boolean
	showOnHover?: boolean
}) {
	const Comp = asChild ? Slot : 'button'

	return (
		<Comp
			data-slot="sidebar-menu-action"
			data-sidebar="menu-action"
			className={cn(
				'text-sidebar-foreground ring-sidebar-ring peer-hover/menu-button:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-hidden absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
				'tab-sm:after:hidden after:absolute after:-inset-2',
				'peer-data-[size=sm]/menu-button:top-1',
				'peer-data-[size=default]/menu-button:top-1.5',
				'peer-data-[size=lg]/menu-button:top-2.5',
				'group-data-[collapsible=icon]:hidden',
				showOnHover &&
					'peer-data-[active=true]/menu-button:text-sidebar-accent-foreground tab-sm:opacity-0 group-focus-within/menu-item:opacity-100 data-[state=open]:opacity-100',
				className
			)}
			{...props}
		/>
	)
}

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="sidebar-menu-badge"
			data-sidebar="menu-badge"
			className={cn(
				'text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums',
				'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
				'peer-data-[size=sm]/menu-button:top-1',
				'peer-data-[size=default]/menu-button:top-1.5',
				'peer-data-[size=lg]/menu-button:top-2.5',
				'group-data-[collapsible=icon]:hidden',
				className
			)}
			{...props}
		/>
	)
}

function SidebarMenuSkeleton({
	className,
	showIcon = false,
	...props
}: React.ComponentProps<'div'> & {
	showIcon?: boolean
}) {
	return (
		<div
			data-slot="sidebar-menu-skeleton"
			data-sidebar="menu-skeleton"
			className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
			{...props}
		>
			{showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
			<Skeleton className="h-4 max-w-full flex-1" data-sidebar="menu-skeleton-text" />
		</div>
	)
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
	return (
		<ul
			data-slot="sidebar-menu-sub"
			data-sidebar="menu-sub"
			className={cn(
				'border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5',
				'group-data-[collapsible=icon]:hidden',
				className
			)}
			{...props}
		/>
	)
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<'li'>) {
	return (
		<li
			data-slot="sidebar-menu-sub-item"
			data-sidebar="menu-sub-item"
			className={cn('group/menu-sub-item relative', className)}
			{...props}
		/>
	)
}

function SidebarMenuSubButton({
	asChild = false,
	size = 'md',
	isActive = false,
	className,
	...props
}: React.ComponentProps<'a'> & {
	asChild?: boolean
	size?: 'sm' | 'md'
	isActive?: boolean
}) {
	const Comp = asChild ? Slot : 'a'

	return (
		<Comp
			data-slot="sidebar-menu-sub-button"
			data-sidebar="menu-sub-button"
			data-size={size}
			data-active={isActive}
			className={cn(
				'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground outline-hidden flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
				'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
				size === 'sm' && 'text-xs',
				size === 'md' && 'text-sm',
				'group-data-[collapsible=icon]:hidden',
				className
			)}
			{...props}
		/>
	)
}

export {
	sidebarMenuButtonVariants,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarSeparator,
}
