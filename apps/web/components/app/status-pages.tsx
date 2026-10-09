'use client'

import type { ReactNode } from 'react'

import Link from 'next/link'

import { CenteredPanel, PageHeader, PageScroll, Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'

const NOT_FOUND_TITLE = 'Page not found'
const NOT_FOUND_TEXT = 'This page does not exist or was moved.'

function HomeButton({ variant }: { variant: 'primary' | 'ghost' }) {
	return (
		<Button variant={variant} nativeButton={false} render={<Link href="/" />}>
			Go to Today
		</Button>
	)
}

function StatusPage({ title, text, children }: { title: string; text: string; children: ReactNode }) {
	return (
		<CenteredPanel>
			<div className="flex flex-col gap-1">
				<h1 className="text-display font-semibold tracking-tight text-foreground">{title}</h1>
				<p className="text-body text-muted-foreground">{text}</p>
			</div>
			<div className="flex flex-wrap gap-2">{children}</div>
		</CenteredPanel>
	)
}

export function NotFoundPage({ inShell = false }: { inShell?: boolean }) {
	if (inShell) {
		return (
			<PageScroll>
				<PageHeader title={NOT_FOUND_TITLE} />
				<Panel>
					<div className="flex flex-col gap-4 p-6">
						<p className="text-body text-muted-foreground">{NOT_FOUND_TEXT}</p>
						<div className="flex flex-wrap gap-2">
							<HomeButton variant="primary" />
						</div>
					</div>
				</Panel>
			</PageScroll>
		)
	}
	return (
		<StatusPage title={NOT_FOUND_TITLE} text={NOT_FOUND_TEXT}>
			<HomeButton variant="primary" />
		</StatusPage>
	)
}
