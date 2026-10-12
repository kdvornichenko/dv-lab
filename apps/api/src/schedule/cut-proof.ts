import { and, eq, inArray } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'

import { googleCommandStages, googleStageAcknowledgement, type DbExecutor, type GoogleCutCompletion } from '@dv-lab/db'

import { storedGoogleResult } from '../calendar/command-result.ts'
import { CommandFault, digest, type StageRow } from '../calendar/journal.ts'
import { transitionSteps } from '../calendar/transition-stages.ts'
import type { PreparedCalendarCommand } from './command-plan.ts'

export async function requireCutProof(
	tx: DbExecutor,
	command: PreparedCalendarCommand,
	generation: number,
	credentialGeneration: number
) {
	const complete = transitionSteps(command).find((step) => step.purpose === 'complete')
	if (!complete) throw new CommandFault('precondition_failed')
	const [stage] = await tx
		.select()
		.from(googleCommandStages)
		.where(and(eq(googleCommandStages.commandId, command.id), eq(googleCommandStages.stage, complete.stage)))
		.for('update')
	if (!stage || stage.state !== 'acknowledged' || stage.generation !== generation)
		throw new CommandFault('reconnect_required')
	const ack = googleStageAcknowledgement.parse(stage.acknowledgement)
	if (
		ack.kind !== 'cut_complete' ||
		ack.credentialGeneration !== credentialGeneration ||
		ack.planDigest !== digest(JSON.stringify(command.plan))
	)
		throw new CommandFault('precondition_failed')
	const rows = await tx
		.select()
		.from(googleCommandStages)
		.where(and(eq(googleCommandStages.commandId, command.id), inArray(googleCommandStages.id, ack.stageIds)))
		.for('update')
	const expected = transitionSteps(command)
		.filter((step) => step.purpose !== 'complete')
		.map((step) => step.stage)
		.sort((a, b) => a - b)
	if (
		!isDeepStrictEqual(
			rows.map((row) => row.stage).sort((a, b) => a - b),
			expected
		)
	)
		throw new CommandFault('precondition_failed')
	for (const row of rows) verifyStage(row, generation)
	verifyReservations(command, ack)
	return ack
}

function verifyStage(row: StageRow, generation: number) {
	if (row.state !== 'acknowledged' || !row.acknowledgement) throw new CommandFault('precondition_failed')
	if (row.kind !== 'write') return
	if (row.request.method !== 'insert' && row.request.method !== 'patch') throw new CommandFault('precondition_failed')
	storedGoogleResult(row.acknowledgement, row.request, generation)
}

function verifyReservations(command: PreparedCalendarCommand, ack: GoogleCutCompletion) {
	const ids = [
		...ack.representations.map((item) => item.event.eventId),
		...ack.cancelledRepresentations.map((item) => item.eventId),
	]
	if (!isDeepStrictEqual(ids.sort(), command.plan.reservations.map((item) => item.eventId).sort()))
		throw new CommandFault('precondition_failed')
	if (
		!isDeepStrictEqual(
			ack.identityProofs.map((item) => item.localEntityId).sort(),
			command.plan.reservations.map((item) => item.localEntityId).sort()
		)
	)
		throw new CommandFault('precondition_failed')
	for (const cancelled of ack.cancelledRepresentations) {
		if (!ack.stageIds.includes(cancelled.stageId) || cancelled.current.id !== cancelled.eventId)
			throw new CommandFault('precondition_failed')
	}
}
