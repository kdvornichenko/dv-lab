'use client'

import type { FC } from 'react'

import { BookOpenCheck, CalendarClock, GraduationCap } from 'lucide-react'

import { CalendarPanel } from '@/components/dashboard/CalendarPanel'
import { LessonsPanel } from '@/components/dashboard/LessonsPanel'
import { PaymentsPanel } from '@/components/dashboard/PaymentsPanel'
import { SummaryStrip } from '@/components/dashboard/SummaryStrip'
import { StudentsPanel } from '@/components/students/StudentsPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { themeCssVariables } from '@/lib/theme/theme-settings'

import type { CreateLessonInput, CreateStudentInput, UpdateLessonInput } from '@teacher-crm/api-types'

import {
	previewBalances,
	previewCalendarConnection,
	previewCalendarOptions,
	previewCalendarSyncRecords,
	previewLessons,
	previewNow,
	previewPayments,
	previewStudents,
	previewStudentsWithBalance,
	previewSummary,
	routeLinks,
} from './theme-preview-data'
import type { PreviewMetricProps, ThemeBlocksPreviewProps } from './ThemeBlocksPreview.types'

function previewOnly() {
	return undefined
}

export const ThemeBlocksPreview: FC<ThemeBlocksPreviewProps> = ({ theme }) => {
	return (
		<ScrollArea className="h-[calc(100%-5rem)] font-sans" style={themeCssVariables(theme)}>
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
							attendanceRecords={[]}
							calendarSyncRecords={previewCalendarSyncRecords}
							title="Schedule workspace"
							description="The real lesson panel with individual lesson status and calendar state."
							onAddLesson={async (_input: CreateLessonInput) => previewOnly()}
							onUpdateLesson={async (_lessonId: string, _input: UpdateLessonInput) => previewOnly()}
							onCancelLesson={async () => previewOnly()}
							onDeleteLesson={async () => previewOnly()}
							onMarkAttendance={async () => previewOnly()}
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
		</ScrollArea>
	)
}

const SettingsPreviewCard: FC = () => {
	const offerText =
		'До конца года также доступны варианты с пониженной стоимостью при оплате наперед:\n\n* при оплате за 3 месяца стоимость занятия составляет 2100 рублей\nза 3 месяца - 24 занятия - 50 400 рублей\nэкономия - 4 800 рублей\n\n* при оплате за 5 месяцев стоимость занятия составляет 1900 рублей\nза 5 месяцев - 40 занятий - 76 000 рублей\nэкономия - 16 000 рублей'

	return (
		<Card className="overflow-hidden">
			<CardHeader className="border-line-soft bg-surface-muted border-b">
				<p className="text-sage font-mono text-xs font-semibold uppercase">Student settings</p>
				<CardTitle className="text-lg">Package price and offer text</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4 pt-5 lg:grid-cols-2">
				<div className="grid gap-3">
					<PreviewMetric icon={<GraduationCap className="h-4 w-4" />} label="Default lesson" value="2 300 RUB" />
					<PreviewMetric icon={<BookOpenCheck className="h-4 w-4" />} label="Package lessons" value="40" />
					<PreviewMetric icon={<CalendarClock className="h-4 w-4" />} label="Package total" value="76 000 RUB" />
				</div>
				<Textarea value={offerText} readOnly className="bg-surface min-h-64 resize-none" />
			</CardContent>
		</Card>
	)
}

const PreviewMetric: FC<PreviewMetricProps> = ({ icon, label, value }) => {
	return (
		<div className="border-line-soft bg-surface-muted flex items-center gap-3 rounded-lg border p-3">
			<span className="border-sage-line bg-sage-soft text-sage flex size-9 items-center justify-center rounded-lg border">
				{icon}
			</span>
			<div>
				<p className="text-ink-muted text-xs font-medium">{label}</p>
				<p className="text-ink mt-1 font-mono text-sm font-semibold">{value}</p>
			</div>
		</div>
	)
}
