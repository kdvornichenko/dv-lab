'use client'

import { useState } from 'react'

import { List, ListChecks } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/tooltip'

import { LessonCountWindow } from './lazy-dialogs'

export function LessonCountDialog({ iconOnly = false }: { iconOnly?: boolean }) {
	const [open, setOpen] = useState(false)
	const [opened, setOpened] = useState(false)

	function change(next: boolean) {
		setOpen(next)
		if (next) setOpened(true)
	}

	return (
		<Dialog open={open} onOpenChange={change}>
			{iconOnly ? (
				<Tooltip side="bottom" content="Count lessons">
					<DialogTrigger
						render={
							<Button variant="tertiary" size="icon-compact" aria-label="Count lessons">
								<List />
							</Button>
						}
					/>
				</Tooltip>
			) : (
				<DialogTrigger
					render={
						<Button variant="tertiary" leadingIcon={ListChecks}>
							Count lessons
						</Button>
					}
				/>
			)}
			{opened ? <LessonCountWindow /> : null}
		</Dialog>
	)
}
