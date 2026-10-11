import { and, desc, eq } from 'drizzle-orm'

import { googleCommands, googleCommandStages, googleStageRequest, type GoogleCutPlan } from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import { cutWrite } from '../schedule/series-command.ts'
import { cancellationAcknowledgement } from './command-result.ts'
import type { CommandAccess } from './dispatch.ts'
import type { GoogleGateway } from './gateway.ts'
import { CommandFault, digest } from './journal.ts'
import type { CommandRow, StageRow } from './journal.ts'
import { acknowledgeTransition, beginTransitionStage, transitionStage } from './transition-journal.ts'
import { observedResource } from './transition-proof.ts'
import { transitionSteps, type TransitionStep } from './transition-stages.ts'
import { verifyPrefixDefault } from './transition-verify.ts'
import { sendTransitionWrite } from './transition-write.ts'

export async function replayCancelledPrefix(
	access: CommandAccess,
	command: CommandRow,
	prepared: PreparedCalendarCommand,
	step: Extract<TransitionStep, { purpose: 'cancelled_prefix' }>,
	existing: StageRow | undefined,
	gateway: GoogleGateway
) {
	if (existing?.request.method === 'patch') {
		await sendTransitionWrite(access, command, prepared, step.stage, existing.request, existing, gateway)
		return
	}
	const source = step.prefixCancellation
	const previous = await transitionStage(access, command, step.stage - 3)
	if (!previous) throw new CommandFault('precondition_failed')
	const row = await beginTransitionStage(
		access,
		command,
		step.stage - 1,
		{ method: 'get', eventId: source.current.id },
		previous
	)
	const actual = await gateway
		.cancelledInstance(access.accessToken, command.calendarId, source.current.id, access.signal)
		.catch(async (error: unknown) => {
			const resource = await observedResource(access, prepared, source.current.id, gateway)
			if (resource.event.status !== 'confirmed') throw error
			return resource
		})
	if ('id' in actual) {
		if (
			actual.id !== source.current.id ||
			actual.recurringEventId !== source.current.recurringEventId ||
			Date.parse(actual.originalStartTime.dateTime) !== Date.parse(source.current.originalStartTime.dateTime)
		)
			throw new CommandFault('external_change')
		await acknowledgeTransition(
			access,
			command,
			row,
			{
				kind: 'cut_cancelled_prefix',
				checkedAt: new Date().toISOString(),
				historyStageId: source.stageId,
				current: actual,
			},
			null
		)
		const main = await beginTransitionStage(access, command, step.stage, { method: 'get', eventId: source.current.id })
		const current = await gateway.cancelledInstance(
			access.accessToken,
			command.calendarId,
			source.current.id,
			access.signal
		)
		if (
			current.id !== actual.id ||
			current.recurringEventId !== actual.recurringEventId ||
			Date.parse(current.originalStartTime.dateTime) !== Date.parse(actual.originalStartTime.dateTime)
		)
			throw new CommandFault('external_change')
		await acknowledgeTransition(
			access,
			command,
			main,
			{ kind: 'cut_cancelled_prefix', checkedAt: new Date().toISOString(), historyStageId: source.stageId, current },
			null
		)
		return
	}
	await acknowledgeTransition(
		access,
		command,
		row,
		{ kind: 'cut_observation', checkedAt: new Date().toISOString(), resource: actual },
		null
	)
	const trim = transitionSteps(prepared).find((item) => item.purpose === 'trim')
	const trimRow = trim ? await transitionStage(access, command, trim.stage) : undefined
	if (!trimRow || trimRow.state !== 'acknowledged' || trimRow.request.method !== 'patch')
		throw new CommandFault('external_change')
	verifyPrefixDefault(
		prepared,
		actual,
		source.current.originalStartTime.dateTime,
		trimRow.stage,
		trimRow.request.digest
	)
	const request = cutWrite(command.id, step.stage, actual, {
		entityKind: 'occurrence',
		localEntityId: prepared.plan.cut!.master.privateProperties.dvLocalId,
		representationGeneration: Number(prepared.plan.cut!.master.privateProperties.dvGeneration),
	})
	const preserved = source.unownedWritable
	if (!preserved) throw new CommandFault('external_change')
	const hash = digest(JSON.stringify({ eventId: request.eventId, status: 'cancelled', preserved }))
	const replay = googleStageRequest.parse({
		...request,
		digest: hash,
		cancellationBaseline: {
			...request.cancellationBaseline,
			unownedWritableFingerprint: source.unownedWritableFingerprint,
			unownedWritable: preserved,
		},
		payload: { ...request.payload, preserved, markers: { ...request.payload.markers, digest: hash } },
	})
	if (replay.method !== 'patch') throw new CommandFault('precondition_failed')
	await sendTransitionWrite(access, command, prepared, step.stage, replay, existing, gateway, actual)
}

export async function cancelledTailHistory(
	access: CommandAccess,
	seriesId: string,
	originalOn: string,
	eventId: string,
	gateway: GoogleGateway
): Promise<GoogleCutPlan['cancelledTail'][number]> {
	const commands = await access.db
		.select()
		.from(googleCommands)
		.where(
			and(
				eq(googleCommands.accountId, access.connection.accountId),
				eq(googleCommands.connectionId, access.connection.id),
				eq(googleCommands.calendarId, access.connection.calendarId!),
				eq(googleCommands.state, 'applied')
			)
		)
		.orderBy(desc(googleCommands.appliedAt))
	const command = commands.find(
		(row) =>
			'ref' in row.plan.input &&
			row.plan.input.ref.kind === 'series' &&
			row.plan.input.ref.seriesId === seriesId &&
			row.plan.input.ref.originalOn === originalOn
	)
	if (!command || command.operation !== 'cancel') throw new CommandFault('external_change')
	const stages = await access.db
		.select()
		.from(googleCommandStages)
		.where(and(eq(googleCommandStages.commandId, command.id), eq(googleCommandStages.state, 'acknowledged')))
		.orderBy(desc(googleCommandStages.stage))
	for (const stage of stages) {
		const ack = cancellationAcknowledgement(stage.acknowledgement, eventId)
		if (!ack) continue
		const current = await gateway.cancelledInstance(access.accessToken, command.calendarId, eventId, access.signal)
		const baselineEvent = ack.kind === 'cancellation' ? ack.baselineEvent : ack.event
		if (!baselineEvent) throw new CommandFault('external_change')
		const original = baselineEvent.originalStartTime
		if (
			current.id !== eventId ||
			current.recurringEventId !== baselineEvent.recurringEventId ||
			!original ||
			!('dateTime' in original) ||
			Date.parse(current.originalStartTime.dateTime) !== Date.parse(original.dateTime)
		)
			throw new CommandFault('external_change')
		return {
			originalOn,
			stageId: stage.id,
			current,
			baselineEvent,
			unownedWritableFingerprint: ack.unownedWritableFingerprint,
			unownedWritable: ack.unownedWritable ?? null,
		}
	}
	throw new CommandFault('external_change')
}
