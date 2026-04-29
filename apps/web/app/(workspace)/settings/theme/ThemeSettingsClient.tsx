'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { BookOpenCheck, CalendarClock, GraduationCap, RotateCcw, Save, Shuffle } from 'lucide-react'
import { toast } from 'sonner'

import { useThemeSettings } from '@/components/ThemeSettingsProvider'
import { CalendarPanel } from '@/components/dashboard/CalendarPanel'
import { LessonsPanel } from '@/components/dashboard/LessonsPanel'
import { PaymentsPanel } from '@/components/dashboard/PaymentsPanel'
import { SummaryStrip } from '@/components/dashboard/SummaryStrip'
import { StudentsPanel } from '@/components/students/StudentsPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { StudentWithBalance, TeacherCrmSummary } from '@/lib/crm/types'
import {
	cloneTheme,
	colorLabels,
	fontOptions,
	fontStackFor,
	radiusOptions,
	themeColorGroups,
	themeCssVariables,
} from '@/lib/theme/theme-settings'

import {
	DEFAULT_CRM_THEME_SETTINGS,
	type CalendarConnection,
	type CalendarListEntry,
	type CalendarSyncRecord,
	type CreateLessonInput,
	type CreateStudentInput,
	type CrmThemeSettings,
	type Lesson,
	type Payment,
	type Student,
	type StudentBalance,
	type UpdateLessonInput,
} from '@teacher-crm/api-types'

const presetThemes: Array<{ id: string; label: string; theme: CrmThemeSettings }> = [
	{ id: 'devl', label: 'Devl', theme: DEFAULT_CRM_THEME_SETTINGS },
	{
		id: 'studio',
		label: 'Studio',
		theme: {
			radius: 'default',
			headingFont: 'geist',
			bodyFont: 'geist',
			numberFont: 'mono',
			colors: {
				background: '#f6f7fb',
				foreground: '#111827',
				primary: '#155eef',
				accent: '#7c3aed',
				success: '#168a4a',
				warning: '#b45309',
				danger: '#be123c',
				chart: '#64748b',
			},
		},
	},
	{
		id: 'contrast',
		label: 'Contrast',
		theme: {
			radius: 'sm',
			headingFont: 'inter',
			bodyFont: 'inter',
			numberFont: 'mono',
			colors: {
				background: '#0f1115',
				foreground: '#f7f7f2',
				primary: '#f7f7f2',
				accent: '#a855f7',
				success: '#10b981',
				warning: '#eab308',
				danger: '#ef4444',
				chart: '#8a8f98',
			},
		},
	},
]

const shufflePalettes: CrmThemeSettings['colors'][] = [
	presetThemes[0].theme.colors,
	presetThemes[1].theme.colors,
	presetThemes[2].theme.colors,
	{
		background: '#f8fafc',
		foreground: '#0f172a',
		primary: '#0f766e',
		accent: '#7c3aed',
		success: '#15803d',
		warning: '#ca8a04',
		danger: '#dc2626',
		chart: '#475569',
	},
]

const previewNow = new Date('2026-04-26T12:00:00.000Z')
const previewStudents: Student[] = [
	{
		id: 'preview-anna',
		firstName: 'Anna',
		lastName: 'Petrova',
		fullName: 'Anna Petrova',
		email: 'anna@example.com',
		phone: '+7 900 000-10-01',
		level: 'B2',
		special: 'Speaking practice',
		status: 'active',
		notes: 'Speaking and exam prep',
		defaultLessonPrice: 2300,
		defaultLessonDurationMinutes: 60,
		packageMonths: 3,
		packageLessonsPerWeek: 2,
		packageLessonCount: 24,
		packageTotalPrice: 50400,
		currency: 'RUB',
		billingMode: 'package',
		createdAt: '2026-04-01T09:00:00.000Z',
		updatedAt: '2026-04-20T09:00:00.000Z',
	},
	{
		id: 'preview-max',
		firstName: 'Max',
		lastName: 'Ivanov',
		fullName: 'Max Ivanov',
		email: 'max@example.com',
		phone: '+7 900 000-10-02',
		level: 'A2',
		special: 'Grammar support',
		status: 'active',
		notes: 'Monthly plan',
		defaultLessonPrice: 2300,
		defaultLessonDurationMinutes: 60,
		packageMonths: 0,
		packageLessonsPerWeek: 0,
		packageLessonCount: 0,
		packageTotalPrice: 0,
		currency: 'RUB',
		billingMode: 'monthly',
		createdAt: '2026-03-10T09:00:00.000Z',
		updatedAt: '2026-04-18T09:00:00.000Z',
	},
	{
		id: 'preview-lena',
		firstName: 'Lena',
		lastName: 'Smirnova',
		fullName: 'Lena Smirnova',
		email: 'lena@example.com',
		phone: '+7 900 000-10-03',
		level: 'C1',
		special: 'Exam prep',
		status: 'paused',
		notes: 'Package renewal pending',
		defaultLessonPrice: 2300,
		defaultLessonDurationMinutes: 60,
		packageMonths: 5,
		packageLessonsPerWeek: 2,
		packageLessonCount: 40,
		packageTotalPrice: 76000,
		currency: 'KZT',
		billingMode: 'package',
		createdAt: '2026-02-02T09:00:00.000Z',
		updatedAt: '2026-04-16T09:00:00.000Z',
	},
]
const previewBalances: StudentBalance[] = [
	{ studentId: 'preview-anna', balance: 0, unpaidLessonCount: 0, overdue: false },
	{ studentId: 'preview-max', balance: 2300, unpaidLessonCount: 1, overdue: true },
	{ studentId: 'preview-lena', balance: -1900, unpaidLessonCount: 0, overdue: false },
]
const previewStudentsWithBalance: StudentWithBalance[] = previewStudents.map((student) => ({
	...student,
	balance: previewBalances.find((balance) => balance.studentId === student.id) ?? {
		studentId: student.id,
		balance: 0,
		unpaidLessonCount: 0,
		overdue: false,
	},
}))
const previewLessons: Lesson[] = [
	{
		id: 'preview-lesson-speaking',
		title: 'Anna P.',
		startsAt: '2026-04-26T12:00:00.000Z',
		durationMinutes: 60,
		repeatWeekly: false,
		topic: 'Travel and work',
		notes: '',
		status: 'planned',
		studentIds: ['preview-anna'],
		createdAt: '2026-04-20T09:00:00.000Z',
		updatedAt: '2026-04-20T09:00:00.000Z',
	},
	{
		id: 'preview-lesson-grammar',
		title: 'Max I.',
		startsAt: '2026-04-26T15:30:00.000Z',
		durationMinutes: 90,
		repeatWeekly: false,
		topic: 'Conditionals',
		notes: '',
		status: 'planned',
		studentIds: ['preview-max'],
		createdAt: '2026-04-20T09:00:00.000Z',
		updatedAt: '2026-04-20T09:00:00.000Z',
	},
]
const previewPayments: Payment[] = [
	{
		id: 'preview-payment-anna',
		studentId: 'preview-anna',
		amount: 50400,
		paidAt: '2026-04-24',
		method: 'bank_transfer',
		comment: '3 month package',
		createdAt: '2026-04-24T10:00:00.000Z',
	},
	{
		id: 'preview-payment-max',
		studentId: 'preview-max',
		amount: 2300,
		paidAt: '2026-04-20',
		method: 'card',
		comment: 'Single lesson',
		createdAt: '2026-04-20T10:00:00.000Z',
	},
]
const previewCalendarConnection: CalendarConnection = {
	id: 'preview-calendar',
	provider: 'google',
	email: 'teacher@gmail.com',
	status: 'connected',
	requiredScopes: [],
	grantedScopes: [],
	tokenAvailable: true,
	selectedCalendarId: 'english-lessons',
	selectedCalendarName: 'English lessons',
	connectedAt: '2026-04-01T09:00:00.000Z',
	updatedAt: '2026-04-26T09:00:00.000Z',
}
const previewCalendarOptions: CalendarListEntry[] = [
	{
		id: 'english-lessons',
		name: 'English lessons',
		primary: true,
		accessRole: 'owner',
	},
]
const previewCalendarSyncRecords: CalendarSyncRecord[] = [
	{
		id: 'preview-sync-speaking',
		lessonId: 'preview-lesson-speaking',
		provider: 'google',
		externalEventId: 'evt_1',
		status: 'synced',
		lastSyncedAt: '2026-04-26T09:00:00.000Z',
		lastError: null,
		updatedAt: '2026-04-26T09:00:00.000Z',
	},
]
const previewSummary: TeacherCrmSummary = {
	activeStudents: 2,
	todayLessons: 2,
	missingAttendance: 0,
	overdueStudents: 1,
	monthIncome: 52700,
}
const routeLinks = [
	{ label: 'Dashboard', href: '/' },
	{ label: 'Lessons', href: '/lessons' },
	{ label: 'Students', href: '/students' },
	{ label: 'Payments', href: '/payments' },
	{ label: 'Calendar', href: '/calendar' },
	{ label: 'Settings', href: '/settings' },
] as const

function themesEqual(a: CrmThemeSettings, b: CrmThemeSettings) {
	return JSON.stringify(a) === JSON.stringify(b)
}

function previewOnly() {
	return undefined
}

export function ThemeSettingsClient() {
	const { loading, resetTheme, saveTheme, theme } = useThemeSettings()
	const [draft, setDraft] = useState(() => cloneTheme(theme))
	const [activePreset, setActivePreset] = useState('neutral')
	const [isSaving, setIsSaving] = useState(false)
	const hasChanges = useMemo(() => !themesEqual(draft, theme), [draft, theme])

	useEffect(() => {
		setDraft(cloneTheme(theme))
	}, [theme])

	function updateColor(key: keyof CrmThemeSettings['colors'], value: string) {
		setDraft((current) => ({
			...current,
			colors: {
				...current.colors,
				[key]: value,
			},
		}))
	}

	function applyPreset(presetId: string) {
		const preset = presetThemes.find((item) => item.id === presetId)
		if (!preset) return
		setActivePreset(presetId)
		setDraft(cloneTheme(preset.theme))
	}

	function shuffleTheme() {
		const palette = shufflePalettes[Math.floor(Math.random() * shufflePalettes.length)]
		const radius = radiusOptions[Math.floor(Math.random() * radiusOptions.length)].value
		setDraft((current) => ({
			...current,
			radius,
			colors: { ...palette },
		}))
	}

	async function handleSave() {
		setIsSaving(true)
		try {
			await saveTheme(draft)
			toast.success('Theme saved')
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Saved locally, but database sync failed'
			toast.error('Theme saved locally', { description: message })
		} finally {
			setIsSaving(false)
		}
	}

	async function handleReset() {
		setIsSaving(true)
		try {
			setDraft(cloneTheme(DEFAULT_CRM_THEME_SETTINGS))
			setActivePreset('neutral')
			await resetTheme()
			toast.success('Theme reset')
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Reset locally, but database sync failed'
			toast.error('Theme reset locally', { description: message })
		} finally {
			setIsSaving(false)
		}
	}

	if (loading) {
		return (
			<main className="min-h-full bg-canvas p-unit text-ink">
				<div className="grid w-full gap-5 lg:grid-cols-12">
					<Skeleton className="h-168 rounded-2xl bg-surface-muted lg:col-span-2" />
					<Skeleton className="h-168 rounded-2xl bg-surface-muted lg:col-span-10" />
				</div>
			</main>
		)
	}

	return (
		<main className="min-h-full bg-canvas p-unit text-ink">
			<div className="grid w-full gap-5 lg:grid-cols-12">
				<aside className="sticky top-2 h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border border-line bg-surface lg:col-span-2">
					<ScrollArea className="h-[calc(100dvh-2rem)]">
						<div className="space-y-3 p-3">
							<ControlSelect
								label="Style"
								value={activePreset}
								onValueChange={applyPreset}
								options={presetThemes.map((preset) => ({ value: preset.id, label: preset.label }))}
							/>
							<div className="rounded-xl border border-line bg-surface-muted px-2.5 py-2">
								<div className="text-xs font-medium text-ink-muted">Status</div>
								<div className="mt-1 flex items-center justify-between gap-2">
									<span className="text-sm font-semibold text-ink">{hasChanges ? 'Draft' : 'Applied'}</span>
									<Badge tone={hasChanges ? 'amber' : 'green'}>{hasChanges ? 'draft' : 'saved'}</Badge>
								</div>
							</div>
						</div>

						<div className="border-y border-line-soft p-3">
							<div className="space-y-2">
								<FontSelect
									label="Heading"
									value={draft.headingFont}
									onValueChange={(headingFont) => setDraft((current) => ({ ...current, headingFont }))}
								/>
								<FontSelect
									label="Font"
									value={draft.bodyFont}
									onValueChange={(bodyFont) => setDraft((current) => ({ ...current, bodyFont }))}
								/>
								<FontSelect
									label="Numbers"
									value={draft.numberFont}
									onValueChange={(numberFont) => setDraft((current) => ({ ...current, numberFont }))}
								/>
							</div>
						</div>

						<div className="space-y-3 p-3">
							<RadiusSelect
								value={draft.radius}
								onValueChange={(radius) => setDraft((current) => ({ ...current, radius }))}
							/>
							{themeColorGroups.map((group) => (
								<section key={group.title} className="rounded-xl border border-line bg-surface-muted p-2.5">
									<div className="mb-2">
										<p className="text-xs font-medium text-ink-muted">{group.title}</p>
										<p className="mt-0.5 text-xs leading-4 text-ink-muted">{group.description}</p>
									</div>
									<div className="space-y-1.5">
										{group.keys.map((key) => (
											<ColorRow
												key={key}
												label={colorLabels[key]}
												value={draft.colors[key]}
												onChange={(value) => updateColor(key, value)}
											/>
										))}
									</div>
								</section>
							))}
						</div>

						<div className="sticky bottom-0 space-y-2 border-t border-line-soft bg-surface p-3">
							<Button
								type="button"
								variant="outline"
								className="h-8 w-full text-xs"
								onClick={shuffleTheme}
								disabled={isSaving}
							>
								<Shuffle className="h-3.5 w-3.5" />
								Shuffle
							</Button>
							<div className="grid grid-cols-2 gap-2">
								<Button
									type="button"
									variant="outline"
									className="h-8 text-xs"
									onClick={() => setDraft(cloneTheme(theme))}
									disabled={isSaving}
								>
									<RotateCcw className="h-3.5 w-3.5" />
									Undo
								</Button>
								<Button
									type="button"
									variant="outline"
									className="h-8 text-xs"
									onClick={() => void handleReset()}
									disabled={isSaving}
								>
									Reset
								</Button>
							</div>
							<Button
								type="button"
								className="h-9 w-full"
								onClick={() => void handleSave()}
								disabled={!hasChanges || isSaving}
							>
								<Save className="h-4 w-4" />
								Save theme
							</Button>
						</div>
					</ScrollArea>
				</aside>

				<section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface lg:col-span-10">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
						<div>
							<h1 className="text-base font-semibold text-ink">Theme preview</h1>
							<p className="text-xs text-ink-muted">Real CRM components update from draft tokens.</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button type="button" variant="outline" size="sm" onClick={() => void handleReset()} disabled={isSaving}>
								Reset
							</Button>
							<Button type="button" size="sm" onClick={() => void handleSave()} disabled={!hasChanges || isSaving}>
								<Save className="h-4 w-4" />
								Save
							</Button>
						</div>
					</div>
					<ThemeBlocksPreview theme={draft} />
				</section>
			</div>
		</main>
	)
}

type ControlSelectOption<T extends string> = {
	value: T
	label: string
	meta?: ReactNode
}

function ControlSelect<T extends string>({
	label,
	onValueChange,
	options,
	trailing,
	value,
}: {
	label: string
	onValueChange: (value: T) => void
	options: Array<ControlSelectOption<T>>
	trailing?: ReactNode
	value: T
}) {
	return (
		<div className="rounded-xl border border-line bg-surface-muted px-2.5 py-2">
			<div className={trailing ? 'flex items-center justify-between gap-3' : undefined}>
				<Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as T)}>
					<SelectTrigger className="mt-0.5 border-0 bg-transparent p-0 text-ink shadow-none focus:ring-0">
						<div className="flex flex-col">
							<div className="text-left text-xs font-medium text-ink-muted">{label}</div>
							<SelectValue />
						</div>
					</SelectTrigger>
					<SelectContent>
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.meta ? (
									<span className="flex items-center justify-between gap-4">
										<span>{option.label}</span>
										{option.meta}
									</span>
								) : (
									option.label
								)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{trailing}
			</div>
		</div>
	)
}

function FontSelect({
	label,
	onValueChange,
	value,
}: {
	label: string
	onValueChange: (value: CrmThemeSettings['headingFont']) => void
	value: CrmThemeSettings['headingFont']
}) {
	const selectedFont = fontStackFor(value)

	return (
		<ControlSelect
			label={label}
			value={value}
			onValueChange={onValueChange}
			options={fontOptions.map((option) => ({
				value: option.value,
				label: option.label,
				meta: (
					<span className="text-ink-muted" style={{ fontFamily: fontStackFor(option.value) }}>
						Aa
					</span>
				),
			}))}
			trailing={
				<span className="shrink-0 text-sm text-ink-muted" style={{ fontFamily: selectedFont }}>
					Aa
				</span>
			}
		/>
	)
}

function RadiusSelect({
	onValueChange,
	value,
}: {
	onValueChange: (value: CrmThemeSettings['radius']) => void
	value: CrmThemeSettings['radius']
}) {
	const selectedRadius = radiusOptions.find((option) => option.value === value)?.preview

	return (
		<ControlSelect
			label="Radius"
			value={value}
			onValueChange={onValueChange}
			options={radiusOptions.map((option) => ({
				value: option.value,
				label: option.label,
				meta: <span className="h-5 w-5 border border-line-strong" style={{ borderRadius: option.preview }} />,
			}))}
			trailing={
				<span className="h-7 w-7 shrink-0 border border-line-strong" style={{ borderRadius: selectedRadius }} />
			}
		/>
	)
}

function ColorRow({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
	return (
		<div className="flex items-center gap-2 rounded-lg border border-line-soft bg-surface px-2 py-1.5">
			<div className="min-w-0">
				<p className="truncate text-xs font-medium text-ink">{label}</p>
				<p className="font-mono text-xs text-ink-muted">{value}</p>
			</div>
			<ColorPicker
				value={value}
				onChange={onChange}
				className="ml-auto h-7 w-7 rounded-md border-line-strong p-0 shadow-none hover:border-sage-line"
			/>
		</div>
	)
}

function ThemeBlocksPreview({ theme }: { theme: CrmThemeSettings }) {
	return (
		<div className="overflow-auto font-sans" style={themeCssVariables(theme)}>
			<div className="bg-canvas p-5">
				<div className="mb-5 flex flex-wrap gap-2">
					{routeLinks.map((route) => (
						<Button key={route.href} type="button" variant="outline" size="sm" disabled>
							{route.label}
						</Button>
					))}
				</div>
				<div className="grid gap-5">
					<SummaryStrip summary={previewSummary} />
					<div className="grid gap-5 xl:grid-cols-2">
						<LessonsPanel
							lessons={previewLessons}
							students={previewStudents}
							calendarSyncRecords={previewCalendarSyncRecords}
							title="Schedule workspace"
							description="The real lesson panel with individual lesson status and calendar state."
							onAddLesson={async (_input: CreateLessonInput) => previewOnly()}
							onUpdateLesson={async (_lessonId: string, _input: UpdateLessonInput) => previewOnly()}
							onCancelLesson={async () => previewOnly()}
							onDeleteLesson={async () => previewOnly()}
							previewMode
						/>
						<StudentsPanel
							visibleStudents={previewStudentsWithBalance}
							lessons={previewLessons}
							filter="all"
							now={previewNow}
							onFilterChange={() => previewOnly()}
							onAddStudent={async (_input: CreateStudentInput) => previewOnly()}
							onArchiveStudent={async () => previewOnly()}
							onRecordPayment={async () => previewOnly()}
							previewMode
						/>
					</div>
					<div className="grid gap-5 xl:grid-cols-2">
						<PaymentsPanel
							payments={previewPayments}
							students={previewStudents}
							studentBalances={previewBalances}
							now={previewNow}
							onDeletePayment={async () => previewOnly()}
							previewMode
						/>
						<div className="grid gap-5">
							<CalendarPanel
								connection={previewCalendarConnection}
								calendarOptions={previewCalendarOptions}
								syncRecords={previewCalendarSyncRecords}
								onConnect={previewOnly}
								previewMode
							/>
							<SettingsPreviewCard />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

function SettingsPreviewCard() {
	const offerText =
		'До конца года также доступны варианты с пониженной стоимостью при оплате наперёд:\n\n• при оплате за 3 месяца стоимость занятия составляет 2100 рублей\nза 3 месяца — 24 занятия — 50 400 рублей\nэкономия — 4 800 рублей\n\n• при оплате за 5 месяцев стоимость занятия составляет 1900 рублей\nза 5 месяцев — 40 занятий — 76 000 рублей\nэкономия — 16 000 рублей'

	return (
		<Card className="overflow-hidden">
			<CardHeader className="border-b border-line-soft bg-surface-muted">
				<p className="font-mono text-xs font-semibold text-sage uppercase">Student settings</p>
				<CardTitle className="text-lg">Package price and offer text</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4 pt-5 lg:grid-cols-2">
				<div className="grid gap-3">
					<PreviewMetric icon={<GraduationCap className="h-4 w-4" />} label="Default lesson" value="2 300 ₽" />
					<PreviewMetric icon={<BookOpenCheck className="h-4 w-4" />} label="Package lessons" value="40" />
					<PreviewMetric icon={<CalendarClock className="h-4 w-4" />} label="Package total" value="76 000 ₽" />
				</div>
				<Textarea value={offerText} readOnly className="min-h-64 resize-none bg-surface" />
			</CardContent>
		</Card>
	)
}

function PreviewMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-line-soft bg-surface-muted p-3">
			<span className="flex size-9 items-center justify-center rounded-lg border border-sage-line bg-sage-soft text-sage">
				{icon}
			</span>
			<div>
				<p className="text-xs font-medium text-ink-muted">{label}</p>
				<p className="mt-1 font-mono text-sm font-semibold text-ink">{value}</p>
			</div>
		</div>
	)
}
