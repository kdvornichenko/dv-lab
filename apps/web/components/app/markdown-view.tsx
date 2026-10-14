'use client'

import { useMemo, type ComponentProps, type ReactNode } from 'react'
import Markdown, { type Components, type ExtraProps, type Options } from 'react-markdown'

import { Check } from 'lucide-react'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

import type { MentionBinding } from '@dv-lab/contracts'

import { MENTION_TAG, remarkMarks } from './markdown-marks'

const listClass = 'flex flex-col gap-1 pl-5 marker:text-muted-foreground [li_&]:mt-1'

function Link({ node: _node, className, ...props }: ComponentProps<'a'> & ExtraProps) {
	return (
		<a
			className={cn(
				'text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground',
				className
			)}
			target="_blank"
			rel="noreferrer noopener"
			{...props}
		/>
	)
}

const components: Components = {
	h1: ({ node: _node, className, ...props }) => (
		<h1 className={cn('mt-4 text-title font-semibold first:mt-0', className)} {...props} />
	),
	h2: ({ node: _node, className, ...props }) => (
		<h2 className={cn('mt-3 text-title font-semibold first:mt-0', className)} {...props} />
	),
	h3: ({ node: _node, className, ...props }) => (
		<h3 className={cn('mt-2 text-body font-semibold first:mt-0', className)} {...props} />
	),
	h4: ({ node: _node, className, ...props }) => (
		<h4 className={cn('mt-2 text-body font-semibold first:mt-0', className)} {...props} />
	),
	h5: ({ node: _node, className, ...props }) => (
		<h5 className={cn('mt-2 text-body font-semibold first:mt-0', className)} {...props} />
	),
	h6: ({ node: _node, className, ...props }) => (
		<h6 className={cn('mt-2 text-body font-semibold first:mt-0', className)} {...props} />
	),
	ul: ({ node: _node, className, ...props }) => <ul className={cn('list-disc', listClass, className)} {...props} />,
	ol: ({ node: _node, className, ...props }) => <ol className={cn('list-decimal', listClass, className)} {...props} />,
	li: ({ node: _node, className, ...props }) => (
		<li
			className={cn(
				className?.includes('task-list-item') &&
					'-ml-5 flex list-none items-start gap-2 has-[[role=checkbox][aria-checked=true]]:text-muted-foreground',
				className
			)}
			{...props}
		/>
	),
	input: ({ node: _node, type, checked }) =>
		type === 'checkbox' ? (
			<span
				role="checkbox"
				aria-checked={checked === true}
				aria-readonly="true"
				className={cn(
					'mt-1 flex size-4 shrink-0 items-center justify-center rounded-sm ring-1 ring-input ring-inset',
					checked ? 'bg-primary text-primary-foreground' : 'bg-surface-3'
				)}
			>
				{checked ? <Check size={12} aria-hidden /> : null}
			</span>
		) : null,
	a: Link,
	code: ({ node: _node, className, ...props }) => (
		<code className={cn('rounded-md bg-hover px-1 font-mono text-body', className)} {...props} />
	),
	pre: ({ node: _node, className, ...props }) => (
		<div className="rounded-lg bg-hover">
			<pre
				className={cn(
					'scroll-fade-x overflow-x-auto p-3 [--scroll-fade-size:var(--scroll-fade-size-compact)] [&_code]:bg-transparent [&_code]:p-0',
					className
				)}
				{...props}
			/>
		</div>
	),
	blockquote: ({ node: _node, className, ...props }) => (
		<blockquote className={cn('rounded-lg bg-hover px-3 py-2 text-muted-foreground', className)} {...props} />
	),
	table: ({ node: _node, className, ...props }) => (
		<div className="rounded-lg ring-1 ring-border ring-inset">
			<div className="scroll-fade-x overflow-x-auto [--scroll-fade-size:var(--scroll-fade-size-compact)]">
				<table className={cn('w-full min-w-max border-collapse', className)} {...props} />
			</div>
		</div>
	),
	th: ({ node: _node, className, ...props }) => (
		<th
			className={cn('px-3 py-2 text-left font-semibold whitespace-nowrap text-muted-foreground', className)}
			{...props}
		/>
	),
	td: ({ node: _node, className, ...props }) => (
		<td className={cn('border-t border-border px-3 py-2 whitespace-nowrap', className)} {...props} />
	),
	hr: ({ node: _node, className, ...props }) => (
		<hr className={cn('my-1 border-t border-border', className)} {...props} />
	),
	img: ({ node: _node, className, alt, ...props }) => (
		// eslint-disable-next-line @next/next/no-img-element
		<img className={cn('max-w-full rounded-lg', className)} alt={alt ?? ''} {...props} />
	),
}

const headingClass = 'text-subtitle font-semibold'

const LOCAL_ORIGIN = 'https://dv.invalid'

function localHref(href: string | undefined): boolean {
	if (href === undefined || !href.startsWith('/')) return false
	try {
		return new URL(href, LOCAL_ORIGIN).origin === LOCAL_ORIGIN
	} catch {
		return false
	}
}

const chatComponents: Components = {
	...components,
	a: (props) => (localHref(props.href) ? <Link {...props} /> : <span>{props.children}</span>),
	h1: ({ node: _node, className, ...props }) => <h1 className={cn(headingClass, className)} {...props} />,
	h2: ({ node: _node, className, ...props }) => <h2 className={cn(headingClass, className)} {...props} />,
	h3: ({ node: _node, className, ...props }) => <h3 className={cn(headingClass, className)} {...props} />,
	h4: ({ node: _node, className, ...props }) => <h4 className={cn(headingClass, className)} {...props} />,
	h5: ({ node: _node, className, ...props }) => <h5 className={cn(headingClass, className)} {...props} />,
	h6: ({ node: _node, className, ...props }) => <h6 className={cn(headingClass, className)} {...props} />,
	strong: ({ node: _node, className, ...props }) => <strong className={cn('font-semibold', className)} {...props} />,
	code: ({ node: _node, className, ...props }) => (
		<code className={cn('rounded-md bg-hover px-1 font-mono', className)} {...props} />
	),
	img: () => null,
}

export type ChatMarkdown = {
	mentions: readonly MentionBinding[]
	streaming: boolean
	renderMention: (studentId: string, children: ReactNode) => ReactNode
}

function ChatView({ body, chat }: { body: string; chat: ChatMarkdown }) {
	const { mentions, streaming, renderMention } = chat
	const plugins = useMemo(
		() =>
			[remarkGfm, [remarkMarks, { mentions, caret: streaming }]] as unknown as NonNullable<Options['remarkPlugins']>,
		[mentions, streaming]
	)
	const mapped = useMemo(
		() =>
			({
				...chatComponents,
				[MENTION_TAG]: ({ studentId, children }: { studentId?: string; children?: ReactNode }) =>
					studentId === undefined ? children : renderMention(studentId, children),
			}) as Components,
		[renderMention]
	)
	return (
		<div
			data-slot="chat-reply-text"
			className="flex flex-col gap-3 text-subtitle font-normal wrap-anywhere text-foreground"
		>
			<Markdown remarkPlugins={plugins} skipHtml components={mapped}>
				{body}
			</Markdown>
		</div>
	)
}

export function MarkdownView({ body, chat }: { body: string; chat?: ChatMarkdown }) {
	if (chat !== undefined) return <ChatView body={body} chat={chat} />
	if (body.trim() === '') {
		return <p className="px-6 py-12 text-center text-body text-muted-foreground">Nothing here yet</p>
	}
	return (
		<div className="flex flex-col gap-3 text-body wrap-anywhere text-foreground">
			<Markdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
				{body}
			</Markdown>
		</div>
	)
}
