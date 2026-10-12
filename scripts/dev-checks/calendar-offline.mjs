import dns from 'node:dns'
import { syncBuiltinESMExports } from 'node:module'

const BLOCKED = ['google.com', 'googleapis.com']

function blocked(hostname) {
	const host = String(hostname ?? '')
		.toLowerCase()
		.replace(/\.$/, '')
	return BLOCKED.some((suffix) => host.endsWith(suffix))
}

function notFound(hostname) {
	const error = new Error(`getaddrinfo ENOTFOUND ${hostname} (blocked by calendar-offline)`)
	error.code = 'ENOTFOUND'
	error.errno = -3008
	error.syscall = 'getaddrinfo'
	error.hostname = hostname
	return error
}

const lookup = dns.lookup
const promisesLookup = dns.promises.lookup

dns.lookup = function offlineLookup(hostname, options, callback) {
	const done = typeof options === 'function' ? options : callback
	if (blocked(hostname) && typeof done === 'function') {
		process.nextTick(() => done(notFound(hostname)))
		return {}
	}
	return lookup.call(this, hostname, options, callback)
}

dns.promises.lookup = function offlinePromisesLookup(hostname, options) {
	if (blocked(hostname)) return Promise.reject(notFound(hostname))
	return promisesLookup.call(this, hostname, options)
}

syncBuiltinESMExports()
