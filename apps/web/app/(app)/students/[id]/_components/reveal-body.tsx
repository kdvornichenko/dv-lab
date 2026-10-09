'use client'

import { useEffect, useRef, useState } from 'react'

import { Check, Copy } from 'lucide-react'

import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface Revealed {
	name: string
	login: string
	password: string
}

export function RevealBody({ revealed, onSaved }: { revealed: Revealed; onSaved: () => void }) {
	const [copied, setCopied] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current)
		},
		[]
	)

	async function copy() {
		try {
			await navigator.clipboard.writeText(revealed.password)
		} catch {
			return
		}
		setCopied(true)
		if (timer.current) clearTimeout(timer.current)
		timer.current = setTimeout(() => setCopied(false), 2000)
	}

	return (
		<>
			<DialogHeader>
				<DialogTitle>Account created</DialogTitle>
				<DialogDescription>Give these details to {revealed.name}.</DialogDescription>
			</DialogHeader>
			<div className="flex flex-col gap-4">
				<Banner status="warning">
					<BannerTitle>Save this password now. It will not be shown again.</BannerTitle>
				</Banner>
				<div className="flex flex-col gap-2">
					<div className="flex h-9 items-center gap-2 rounded-lg bg-hover px-2">
						<span className="w-16 shrink-0 text-body text-muted-foreground">Login</span>
						<span className="min-w-0 flex-1 truncate text-body text-foreground">{revealed.login}</span>
					</div>
					<div className="flex h-9 items-center gap-2 rounded-lg bg-hover px-2">
						<span className="w-16 shrink-0 text-body text-muted-foreground">Password</span>
						<span className="min-w-0 flex-1 truncate font-mono text-body text-foreground select-all">
							{revealed.password}
						</span>
						<Button
							type="button"
							variant="secondary"
							size="compact"
							leadingIcon={copied ? Check : Copy}
							onClick={() => void copy()}
						>
							{copied ? 'Copied' : 'Copy password'}
						</Button>
					</div>
				</div>
				<span role="status" className="sr-only">
					{copied ? 'Password copied' : ''}
				</span>
			</div>
			<DialogFooter>
				<Button type="button" autoFocus onClick={onSaved}>
					I saved the password
				</Button>
			</DialogFooter>
		</>
	)
}
