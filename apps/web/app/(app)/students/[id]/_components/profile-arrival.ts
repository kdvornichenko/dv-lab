import { SECTION_KINDS, type SectionKind } from '@dv-lab/contracts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const PROFILE_TABS = ['overview', 'notes', 'vocabulary', 'payments'] as const
export const PROFILE_DIALOGS = ['payment', 'details'] as const

export type ProfileTab = (typeof PROFILE_TABS)[number]
export type ProfileDialog = (typeof PROFILE_DIALOGS)[number]
export type ProfileMark = { entry: string | null; section: SectionKind | null }
export type ProfileArrival = { tab: ProfileTab | null; dialog: ProfileDialog | null; mark: ProfileMark | null }

type Param = string | string[] | undefined

function single(value: Param): string | null {
	return typeof value === 'string' ? value : null
}

export function parseProfileArrival(params: {
	tab?: Param
	dialog?: Param
	entry?: Param
	section?: Param
}): ProfileArrival {
	const tab = single(params.tab)
	const dialog = single(params.dialog)
	const entry = single(params.entry)
	const section = single(params.section)
	const mark = {
		entry: entry !== null && UUID.test(entry) ? entry : null,
		section: SECTION_KINDS.find((kind) => kind === section) ?? null,
	}
	return {
		tab: PROFILE_TABS.find((value) => value === tab) ?? null,
		dialog: PROFILE_DIALOGS.find((value) => value === dialog) ?? null,
		mark: mark.entry === null && mark.section === null ? null : mark,
	}
}

export function initialProfileTab(arrival: ProfileArrival): ProfileTab {
	if (arrival.dialog === 'details') return 'overview'
	if (arrival.mark !== null) return 'notes'
	return arrival.tab ?? 'overview'
}
