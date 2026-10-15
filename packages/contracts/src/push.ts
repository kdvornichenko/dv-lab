import { z } from 'zod'

import { TIME_ZONE_MAX_LENGTH, isTimeZone } from './students.ts'

export const PUSH_SCREENS = ['schedule', 'payments', 'other'] as const

export const pushScreen = z.enum(PUSH_SCREENS)

export type PushScreen = z.infer<typeof pushScreen>

const pushEndpoint = z
	.url({ protocol: /^https$/ })
	.min(12)
	.max(2048)
	.refine((value) => value.startsWith('https://'))

const base64url = (max: number) =>
	z
		.string()
		.min(1)
		.max(max)
		.regex(/^[A-Za-z0-9_-]+={0,2}$/)

const secondTimeZone = z.string().min(1).max(TIME_ZONE_MAX_LENGTH).refine(isTimeZone)

export const pushDevice = z.strictObject({
	id: z.uuid(),
	deviceLabel: z.string().nullable(),
	revoked: z.boolean(),
	lastSuccessAt: z.iso.datetime({ offset: true }).nullable(),
})

export type PushDevice = z.infer<typeof pushDevice>

export const pushConfigResponse = z.strictObject({
	enabled: z.boolean(),
	publicKey: z.string().nullable(),
	devices: z.array(pushDevice),
})

export type PushConfigResponse = z.infer<typeof pushConfigResponse>

export const pushSubscribeRequest = z.strictObject({
	endpoint: pushEndpoint,
	keys: z.strictObject({ p256dh: base64url(200), auth: base64url(100) }),
	deviceLabel: z.string().trim().min(1).max(120).optional(),
	secondTimeZone: secondTimeZone.optional(),
})

export type PushSubscribeRequest = z.infer<typeof pushSubscribeRequest>

export const pushSubscribeResponse = z.strictObject({ id: z.uuid() })

export type PushSubscribeResponse = z.infer<typeof pushSubscribeResponse>

export const pushUnsubscribeRequest = z.strictObject({ endpoint: pushEndpoint })

export type PushUnsubscribeRequest = z.infer<typeof pushUnsubscribeRequest>

export const pushPresenceRequest = z.strictObject({
	endpoint: pushEndpoint,
	screen: pushScreen,
	studentId: z.uuid().optional(),
	secondTimeZone: secondTimeZone.optional(),
})

export type PushPresenceRequest = z.infer<typeof pushPresenceRequest>
