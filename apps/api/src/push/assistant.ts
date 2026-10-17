import type { Logger } from 'pino'

import { chatLink } from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { readTeacherSettings } from '../settings/settings.ts'
import { isPresentAnywhere } from './presence.ts'
import type { PushDeliver, PushPayload } from './scheduler.ts'
import { activeSubscriptions } from './subscriptions.ts'

export type AssistantEvent = { accountId: string; conversationId: string; title: string; waiting: boolean }

export type AssistantNotifier = (event: AssistantEvent) => Promise<void>

export function createAssistantNotifier({
	db,
	logger,
	deliver,
}: {
	db: Database
	logger: Logger
	deliver: PushDeliver
}): AssistantNotifier {
	return async (event) => {
		try {
			const { settings, subscriptions } = await readSnapshot(db, async (executor) => ({
				settings: await readTeacherSettings(executor, event.accountId),
				subscriptions: await activeSubscriptions(executor, event.accountId),
			}))
			if (!settings.notifyAssistant) return
			const payload: PushPayload = {
				title: event.waiting ? 'Waiting for your decision' : 'Reply is ready',
				body: event.title === '' ? 'New chat' : event.title,
				tag: `chat:${event.conversationId}`,
				url: chatLink(event.conversationId),
			}
			const now = new Date()
			for (const subscription of subscriptions) {
				if (isPresentAnywhere(subscription.endpoint, now)) continue
				try {
					await deliver(subscription, payload)
				} catch {
					logger.warn({ subscriptionId: subscription.id }, 'push delivery threw')
				}
			}
		} catch (err) {
			logger.warn({ err }, 'assistant push failed')
		}
	}
}
