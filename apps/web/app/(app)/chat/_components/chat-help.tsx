'use client'

import { Check, Info } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'

import { allCommands, commandText } from './composer'
import { useStoredCommands } from './use-commands'

const SECTIONS = [
	{
		name: 'Students',
		detail:
			'Find a student, show the balance, lessons left and the next lesson; create a card, change the rate, lesson length, level, goals or time zone; archive.',
	},
	{
		name: 'Lessons',
		detail:
			'Show the lessons of a day or the lesson dates of a period; mark a lesson done or missed; add a comment; propose moving or cancelling a lesson, or moving all weekly lessons to another day or time.',
	},
	{ name: 'Payments', detail: 'Propose recording or deleting a payment; show the payments.' },
	{
		name: 'Notes and vocabulary',
		detail:
			'Read and add to notes, create or delete a block, add and remove vocabulary words, delete a note or a comment.',
	},
	{
		name: 'Google Calendar',
		detail: 'Find events in a period, by title or all of them, and merge them into one list.',
	},
	{
		name: 'Study materials',
		detail: 'Exercises, IELTS speaking questions with sample answers, a short recap of a student, essay feedback.',
	},
	{ name: 'App pages', detail: 'A link to the page you need, such as Settings, Payments or Schedule.' },
] as const

export function ChatHelp({ off, onCommand }: { off: boolean; onCommand: (text: string) => void }) {
	const commands = allCommands(useStoredCommands())
	return (
		<Panel>
			<div role="group" aria-label="Help" data-slot="chat-help" className="flex flex-col gap-3 px-4 py-3">
				<div className="flex items-start gap-2">
					<Info size={16} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
					<div className="flex min-w-0 flex-col">
						<p className="text-body font-semibold text-foreground">Help</p>
						<p className="text-caption text-muted-foreground">
							Type a command, or ask in your own words. @ mentions a student.
						</p>
					</div>
				</div>
				<div role="group" aria-label="Commands" className="flex flex-col">
					<p className="mb-1 text-caption font-semibold text-muted-foreground">Commands</p>
					{commands.map((command) => (
						<button
							key={command.name}
							type="button"
							aria-label={`${command.name}, ${command.detail}`}
							aria-disabled={off || undefined}
							data-command={command.name}
							className="-mx-2 flex h-11 items-center gap-3 rounded-lg px-2 text-left transition-colors duration-80 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-active aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:active:bg-transparent md:h-10"
							onClick={() => {
								if (!off) onCommand(commandText(command))
							}}
						>
							<span className="w-24 shrink-0 text-body font-medium text-foreground">{command.name}</span>
							<span className="min-w-0 text-caption text-muted-foreground">{command.detail}</span>
						</button>
					))}
				</div>
				<div className="flex flex-col">
					<p className="mb-2 text-caption font-semibold text-muted-foreground">What I can do</p>
					<div className="flex flex-col gap-3 sm:gap-2">
						{SECTIONS.map((section) => (
							<div
								key={section.name}
								data-slot="chat-help-section"
								className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3"
							>
								<p className="text-body font-semibold text-foreground sm:w-42 sm:shrink-0">{section.name}</p>
								<p className="min-w-0 flex-1 text-body text-muted-foreground">{section.detail}</p>
							</div>
						))}
					</div>
				</div>
				<div className="h-px bg-border" />
				<p className="flex items-center gap-1.5 text-caption text-muted-foreground">
					<Check size={14} aria-hidden className="shrink-0" />
					You confirm every change in the chat.
				</p>
			</div>
		</Panel>
	)
}
