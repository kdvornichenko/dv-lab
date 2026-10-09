export const LOGIN_MAX_LENGTH = 254
export const STUDENT_LOGIN_PATTERN = /^[a-z0-9._-]{3,32}$/
export const DISPLAY_NAME_MAX_LENGTH = 80
export const MANUAL_PASSWORD_MIN_LENGTH = 10
export const MANUAL_PASSWORD_MAX_LENGTH = 128
export const GENERATED_PASSWORD_LENGTH = 12
export const SIGN_IN_PASSWORD_MAX_LENGTH = 1024

export function normalizeLogin(login: string): string {
	return login.trim().toLowerCase()
}

export function normalizeDisplayName(name: string): string {
	return name.trim().replace(/\s+/g, ' ')
}

export function isStudentLogin(login: string): boolean {
	return STUDENT_LOGIN_PATTERN.test(login)
}

export function isTeacherLogin(login: string): boolean {
	if (login.length < 3 || login.length > LOGIN_MAX_LENGTH || /\s/.test(login)) return false
	const at = login.indexOf('@')
	return at > 0 && at === login.lastIndexOf('@') && at < login.length - 1
}

export function passwordLength(password: string): number {
	return Array.from(password).length
}
