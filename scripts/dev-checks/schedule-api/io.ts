import type { Helpers } from './types.ts'

const helpers = (await import('../api.mjs')) as unknown as Helpers

export const { call, quote, sql, startApi, teacherCookie, studentCookie, TEACHER_LOGIN } = helpers
