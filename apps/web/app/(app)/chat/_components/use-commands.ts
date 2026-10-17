'use client'

import { useEffect, useState } from 'react'

import { apiRequest, peekApi } from '@/lib/api-client'

import type { CommandsResponse } from '@dv-lab/contracts'

export type StoredCommandRow = { name: string; detail: string; student: boolean }

const PATH = '/settings/assistant/commands?status=active'

function rows(data: CommandsResponse): StoredCommandRow[] {
	return data.commands.map((command) => ({
		name: command.name,
		detail: command.description,
		student: command.student,
	}))
}

export function useStoredCommands(): StoredCommandRow[] {
	const [commands, setCommands] = useState<StoredCommandRow[]>(() => {
		const cached = peekApi<CommandsResponse>(PATH)
		return cached !== null && cached.ok ? rows(cached.data) : []
	})
	useEffect(() => {
		let live = true
		void apiRequest<CommandsResponse>('GET', PATH).then((result) => {
			if (live && result.ok) setCommands(rows(result.data))
		})
		return () => {
			live = false
		}
	}, [])
	return commands
}
