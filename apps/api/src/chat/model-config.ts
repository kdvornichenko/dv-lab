import {
	type AssistantSettings,
	CHAT_EFFORTS,
	type ChatEffort,
	type ChatModelEntry,
	type ModelCapability,
} from '@dv-lab/contracts'

export type ModelOverride = { model: string | null; effort: ChatEffort | null }

export type ModelChoice =
	| { kind: 'resolved'; model: ChatModelEntry; effort: ChatEffort; maxInputTokens: number; maxOutputTokens: number }
	| { kind: 'unavailable'; modelId: string }

const effortRank = (effort: ChatEffort) => CHAT_EFFORTS.indexOf(effort)

function supportedEffort(model: ChatModelEntry, wanted: ChatEffort): ChatEffort {
	const supported = [...model.efforts].sort((a, b) => effortRank(a) - effortRank(b))
	const lowest = supported[0] ?? model.defaultEffort
	let chosen: ChatEffort | undefined
	for (const level of supported) if (effortRank(level) <= effortRank(wanted)) chosen = level
	return chosen ?? lowest
}

export function resolveModelChoice(settings: AssistantSettings, override: ModelOverride | null): ModelChoice {
	const first = settings.models[0]
	const modelId = override?.model ?? settings.model ?? first?.id
	if (modelId === undefined) throw new Error('Assistant settings have no models')
	const model = settings.models.find((entry) => entry.id === modelId)
	if (!model) return { kind: 'unavailable', modelId }
	const teacherModelId = settings.model ?? first?.id
	const teacherEffort = modelId === teacherModelId ? settings.effort : null
	return {
		kind: 'resolved',
		model,
		effort: supportedEffort(model, override?.effort ?? teacherEffort ?? model.defaultEffort),
		maxInputTokens: settings.maxInputTokens,
		maxOutputTokens: settings.maxOutputTokens,
	}
}

export async function modelCapabilities(
	settings: AssistantSettings,
	available: (modelId: string) => Promise<boolean>
): Promise<ModelCapability[]> {
	return Promise.all(
		settings.models.map(async (entry) => ({
			id: entry.id,
			name: entry.name,
			description: entry.description,
			efforts: entry.efforts,
			recommendedEffort: entry.recommendedEffort,
			defaultEffort: entry.defaultEffort,
			available: await available(entry.id),
		}))
	)
}

export function selectionAllowed(capabilities: ModelCapability[], modelId: string, effort: ChatEffort | null): boolean {
	const capability = capabilities.find((entry) => entry.id === modelId)
	if (!capability?.available) return false
	return effort === null || capability.efforts.includes(effort)
}
