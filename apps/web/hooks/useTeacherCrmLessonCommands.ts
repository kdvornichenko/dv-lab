'use client'

import { useCallback } from 'react'

import { teacherCrmLessonApi } from '@/lib/crm/api'

import type { CreateLessonInput, DeleteLessonQuery, MarkAttendanceInput, UpdateLessonInput } from '@teacher-crm/api-types'
import type { TeacherCrmLessonCommandDeps } from './useTeacherCrmCommands.types'

export function useTeacherCrmLessonCommands({
	ensureCalendarTokens,
	lessons,
	refreshInBackground,
	runCrmAction,
	setState,
}: TeacherCrmLessonCommandDeps) {
	const addLesson = useCallback(
		async (input: CreateLessonInput) => {
			await runCrmAction('Add lesson', async () => {
				await ensureCalendarTokens()
				const response = await teacherCrmLessonApi.createLesson(input)
				setState((current) => ({
					...current,
					lessons: [...current.lessons.filter((lesson) => lesson.id !== response.lesson.id), response.lesson],
				}))
				refreshInBackground()
			})
		},
		[ensureCalendarTokens, refreshInBackground, runCrmAction, setState]
	)

	const updateLesson = useCallback(
		async (lessonId: string, input: UpdateLessonInput) => {
			await runCrmAction('Update lesson', async () => {
				await ensureCalendarTokens()
				const response = await teacherCrmLessonApi.updateLesson(lessonId, input)
				setState((current) => ({
					...current,
					lessons:
						response.lesson.id === lessonId
							? current.lessons.map((lesson) => (lesson.id === lessonId ? response.lesson : lesson))
							: [...current.lessons.filter((lesson) => lesson.id !== response.lesson.id), response.lesson],
				}))
				refreshInBackground()
			})
		},
		[ensureCalendarTokens, refreshInBackground, runCrmAction, setState]
	)

	const deleteLesson = useCallback(
		async (lessonId: string, options?: DeleteLessonQuery) => {
			await runCrmAction('Delete lesson', async () => {
				await teacherCrmLessonApi.deleteLesson(lessonId, options)
				setState((current) => ({
					...current,
					lessons:
						options?.scope === 'current'
							? current.lessons
							: current.lessons.filter((lesson) => lesson.id !== lessonId),
					attendance:
						options?.scope === 'current'
							? current.attendance
							: current.attendance.filter((record) => record.lessonId !== lessonId),
					calendarSyncRecords:
						options?.scope === 'current'
							? current.calendarSyncRecords
							: current.calendarSyncRecords.filter((record) => record.lessonId !== lessonId),
				}))
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
	)

	const markAttendance = useCallback(
		async (input: MarkAttendanceInput) => {
			await runCrmAction('Mark attendance', async () => {
				const response = await teacherCrmLessonApi.markAttendance(input)
				setState((current) => {
					const key = (record: { lessonId: string; studentId: string }) => `${record.lessonId}:${record.studentId}`
					const nextAttendance = new Map(current.attendance.map((record) => [key(record), record]))
					for (const record of response.attendance) nextAttendance.set(key(record), record)
					return { ...current, attendance: Array.from(nextAttendance.values()) }
				})
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
	)

	const markGroupAttended = useCallback(
		async (lessonId: string) => {
			const lesson = lessons.find((item) => item.id === lessonId)
			if (!lesson) return

			await markAttendance({
				lessonId,
				records: lesson.studentIds.map((studentId) => ({
					studentId,
					status: 'attended',
					billable: true,
				})),
			})
		},
		[lessons, markAttendance]
	)

	return { addLesson, updateLesson, deleteLesson, markAttendance, markGroupAttended }
}
