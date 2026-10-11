import type { GoogleObservedResource, GoogleStageAcknowledgement } from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import { projectCommand, type CommandAccess } from './dispatch.ts'
import type { GoogleGateway } from './gateway.ts'
import { CommandFault, preparedCommand, readCommand, type CommandRow, type StageRow } from './journal.ts'
import { replayCancelledPrefix } from './transition-cancellations.ts'
import {
	acknowledgeTransition,
	beginTransitionStage,
	cutCompletionIsCurrent,
	isTransitionAuthFault,
	pauseTransition,
	transitionStage,
} from './transition-journal.ts'
import { readCutCapture, readOldInactive, sameResource } from './transition-proof.ts'
import {
	cancelDetached,
	transitionInsert,
	transitionPatch,
	transitionSteps,
	type TransitionStep,
} from './transition-stages.ts'
import { prefixSource, readCutComplete } from './transition-verify.ts'
import { sendTransitionWrite, transitionObservation } from './transition-write.ts'

async function sourceForStep(
	access: CommandAccess,
	command: CommandRow,
	prepared: PreparedCalendarCommand,
	step: Extract<TransitionStep, { source: GoogleObservedResource }>,
	gateway: GoogleGateway
) {
	if (step.stage === 1) return { actual: step.source, repair: true }
	const previous = await transitionStage(access, command, step.stage - 3)
	if (!previous) throw new CommandFault('precondition_failed')
	const actual = await transitionObservation(
		access,
		command,
		prepared,
		step.stage - 1,
		step.source.event.eventId,
		previous,
		gateway
	)
	if (step.purpose === 'prefix') return prefixSource(access, prepared, step, gateway)
	if (!sameResource(actual, step.source)) throw new CommandFault('external_change')
	return { actual, repair: true }
}

async function runStep(
	access: CommandAccess,
	command: CommandRow,
	prepared: PreparedCalendarCommand,
	step: TransitionStep,
	existing: StageRow | undefined,
	gateway: GoogleGateway
) {
	if (step.purpose === 'cancelled_prefix')
		return replayCancelledPrefix(access, command, prepared, step, existing, gateway)
	if ('source' in step) {
		if (existing && (existing.request.method === 'patch' || existing.request.method === 'insert')) {
			await sendTransitionWrite(access, command, prepared, step.stage, existing.request, existing, gateway, step.source)
			return
		}
		const source = await sourceForStep(access, command, prepared, step, gateway)
		if (!source.repair) {
			const stage = await beginTransitionStage(access, command, step.stage, {
				method: 'get',
				eventId: source.actual.event.eventId,
			})
			await acknowledgeTransition(
				access,
				command,
				stage,
				{ kind: 'cut_observation', checkedAt: new Date().toISOString(), resource: source.actual },
				200
			)
			return
		}
		const request = step.stage === 1 ? prepared.request : transitionPatch(prepared, step, source.actual)
		await sendTransitionWrite(access, command, prepared, step.stage, request, existing, gateway, source.actual)
		return
	}
	if ('reservation' in step) return runReservation(access, command, prepared, step, existing, gateway)

	const stage = await beginTransitionStage(access, command, step.stage, {
		method: 'family',
		eventId: prepared.plan.cut!.master.event.eventId,
	})
	const ack: GoogleStageAcknowledgement =
		step.purpose === 'capture'
			? await readCutCapture(access, prepared, gateway)
			: step.purpose === 'inactive'
				? await readOldInactive(access, prepared, gateway)
				: await readCutComplete(access, prepared, gateway)
	await acknowledgeTransition(access, command, stage, ack, 200)
}

export async function executeTransition(access: CommandAccess, command: CommandRow, gateway: GoogleGateway) {
	const { prepared: latest } = await preparedCommand(access.db, command)
	const initial = await transitionStage(access, command, 1)
	if (!initial || initial.request.method !== 'patch') throw new CommandFault('precondition_failed')
	const prepared = { ...latest, request: initial.request }
	if (!prepared.plan.cut) throw new CommandFault('precondition_failed')
	let currentStage: StageRow | undefined
	try {
		for (const step of transitionSteps(prepared)) {
			const current = await readCommand(access.db, command.accountId, command.id)
			if (current.state === 'applied' || current.state === 'failed') return
			currentStage = await transitionStage(access, command, step.stage)
			if (
				currentStage?.state === 'acknowledged' &&
				(step.purpose !== 'complete' || cutCompletionIsCurrent(currentStage, access.connection))
			)
				continue
			await runStep(access, current, prepared, step, currentStage, gateway)
		}
		const current = await readCommand(access.db, command.accountId, command.id)
		if (current.state === 'projection_pending') await projectCommand(access, current)
	} catch (error) {
		const pending = await lastPendingStage(access, command, transitionSteps(prepared))
		await pauseTransition(access, command, pending ?? currentStage, error)
		if (isTransitionAuthFault(error)) throw error
	}
}

async function lastPendingStage(access: CommandAccess, command: CommandRow, steps: TransitionStep[]) {
	let pending: StageRow | undefined
	for (const step of steps) {
		const row = await transitionStage(access, command, step.stage)
		if (row && row.state !== 'acknowledged') pending = row
	}
	return pending
}

async function runReservation(
	access: CommandAccess,
	command: CommandRow,
	prepared: PreparedCalendarCommand,
	step: Extract<TransitionStep, { reservation: object }>,
	existing: StageRow | undefined,
	gateway: GoogleGateway
) {
	let source: GoogleObservedResource | undefined
	if (step.purpose === 'cancel_insert' && !existing) {
		const previous = await transitionStage(access, command, step.stage - 3)
		if (!previous) throw new CommandFault('precondition_failed')
		source = await transitionObservation(
			access,
			command,
			prepared,
			step.stage - 1,
			step.reservation.eventId,
			previous,
			gateway
		)
	}
	const request =
		existing?.request ?? (source ? cancelDetached(prepared, step, source) : transitionInsert(prepared, step))
	if (request.method !== 'insert' && request.method !== 'patch') throw new CommandFault('precondition_failed')
	await sendTransitionWrite(access, command, prepared, step.stage, request, existing, gateway, source)
	return
}
