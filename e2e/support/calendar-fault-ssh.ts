import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { z } from 'zod'

import { ROOT } from '../../scripts/dev-checks/paths.mjs'
import {
	faultClient,
	faultObservation,
	hash,
	privatePath,
	readFaultJson,
	type CalendarFaultOperation,
} from './calendar-fault-protocol.ts'
import { FIXTURE_DATABASE, PRELAUNCH_SCOPE, targetBinding } from './target.ts'

const operatorSchema = z.strictObject({
	schema: z.literal('dv-lab-prelaunch-sql-ssh-v1'),
	sshAlias: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/),
	environmentScript: z.string().refine((value) => !value.includes('\0')),
	apiContainer: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/),
})
const responseSchema = z.strictObject({
	schema: z.literal('dv-lab-calendar-fault-result-v1'),
	runId: z.uuid(),
	identitySha256: z.string().regex(/^[a-f0-9]{64}$/),
	ruleId: z.uuid().nullable(),
	observations: z.array(faultObservation).max(1000),
})
const OPERATOR_SHA256 = '270be066a9ae9e1f4a16a8a68d8cfc1460d64a3f7973a28aa0726de943060e2c'

function quote(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`
}

export function executeCalendarFault(operation: CalendarFaultOperation) {
	const binding = targetBinding()
	if (FIXTURE_DATABASE !== 'prelaunch' || binding.authorizationScope !== PRELAUNCH_SCOPE)
		throw new Error('SSH calendar faults require the authorized prelaunch target')
	const clientFile = process.env.E2E_CALENDAR_FAULTS
	const operatorFile = process.env.E2E_PRELAUNCH_SQL_OPERATOR_FILE
	if (!clientFile || !operatorFile) throw new Error('Missing private calendar fault SSH inputs')
	const client = faultClient.parse(readFaultJson(clientFile, ROOT))
	const operatorPath = privatePath(operatorFile, ROOT)
	const operator = operatorSchema.parse(readFaultJson(operatorPath, ROOT))
	if (client.operatorSha256 !== OPERATOR_SHA256 || hash(readFileSync(operatorPath)) !== OPERATOR_SHA256)
		throw new Error('SSH operator differs from the validated input')
	const command = `sudo -n docker exec -i -e ${quote(`E2E_CALENDAR_FAULTS=${client.controlFile}`)} ${quote(operator.apiContainer)} node /app/apps/api/dist/calendar-fault-operator.mjs`
	const result = spawnSync(
		'ssh',
		[
			'-T',
			'-o',
			'BatchMode=yes',
			'-o',
			'StrictHostKeyChecking=yes',
			'-o',
			'UseKeychain=yes',
			'-o',
			'AddKeysToAgent=no',
			'-o',
			'ConnectTimeout=8',
			'-o',
			'ClearAllForwardings=yes',
			operator.sshAlias,
			command,
		],
		{
			input: JSON.stringify({ runId: client.runId, identitySha256: client.identitySha256, binding, operation }),
			encoding: 'utf8',
			timeout: 30000,
			maxBuffer: 1048576,
		}
	)
	if (result.status !== 0 || result.error)
		throw new Error('SSH calendar fault outcome uncertain; inspect owned state before retrying')
	const input: unknown = JSON.parse(result.stdout)
	const response = responseSchema.parse(input)
	if (response.runId !== client.runId || response.identitySha256 !== client.identitySha256)
		throw new Error('SSH calendar fault result ownership mismatch')
	return response
}
