import type { ClientRequest, IncomingMessage, OutgoingHttpHeaders } from 'node:http'
import type { RequestOptions } from 'node:https'
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'
import { z } from 'zod'

import { hash } from './calendar-fault-protocol.ts'

type WriteCallback = (error?: Error | null) => void
const tokens = z.object({ access_token: z.string().min(1).max(32768), refresh_token: z.string().min(1).optional() })

function headerRecord(value: NonNullable<RequestOptions['headers']>): value is OutgoingHttpHeaders {
	return !Array.isArray(value)
}

function decode(body: Buffer, response: IncomingMessage): Buffer {
	const options = { maxOutputLength: 65536 }
	switch (response.headers['content-encoding']) {
		case 'gzip':
			return gunzipSync(body, options)
		case 'deflate':
			return inflateSync(body, options)
		case 'br':
			return brotliDecompressSync(body, options)
		case undefined:
		case 'identity':
			return body
		default:
			throw new Error('Unsupported Calendar response encoding')
	}
}

export function calendarFaultAuth(initialRefreshSha256: string) {
	let refreshSha256 = initialRefreshSha256
	const access = new Set<string>()

	function observeResponse(response: IncomingMessage, body: string): void {
		const form = new URLSearchParams(body)
		if (form.get('grant_type') !== 'refresh_token' || hash(form.get('refresh_token') ?? '') !== refreshSha256) return
		if (response.statusCode !== 200) return
		const chunks: Buffer[] = []
		let size = 0
		response.on('data', (chunk: unknown) => {
			if (!Buffer.isBuffer(chunk)) return
			size += chunk.length
			if (size <= 65536) chunks.push(chunk)
		})
		response.on('end', () => {
			if (size > 65536) return
			try {
				const decoded = decode(Buffer.concat(chunks), response)
				if (decoded.length > 65536) return
				const input: unknown = JSON.parse(decoded.toString('utf8'))
				const parsed = tokens.safeParse(input)
				if (!parsed.success) return
				access.clear()
				access.add(hash(parsed.data.access_token))
				if (parsed.data.refresh_token) refreshSha256 = hash(parsed.data.refresh_token)
			} catch {
				return
			}
		})
	}

	function observe(options: RequestOptions, request: ClientRequest): void {
		if (options.hostname !== 'oauth2.googleapis.com' || options.path !== '/token') return
		let body = ''
		function capture(chunk: string | Uint8Array): void {
			if (body.length <= 65536) body += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
		}
		const write = request.write.bind(request)
		const end = request.end.bind(request)
		Object.defineProperty(request, 'write', {
			value(chunk: string | Uint8Array, encoding?: BufferEncoding | WriteCallback, callback?: WriteCallback) {
				capture(chunk)
				return typeof encoding === 'string' ? write(chunk, encoding, callback) : write(chunk, encoding)
			},
		})
		Object.defineProperty(request, 'end', {
			value(
				chunk?: string | Uint8Array | (() => void),
				encoding?: BufferEncoding | (() => void),
				callback?: () => void
			) {
				if (chunk === undefined || typeof chunk === 'function') return end(chunk)
				capture(chunk)
				return typeof encoding === 'string' ? end(chunk, encoding, callback) : end(chunk, encoding)
			},
		})
		request.on('response', (response: IncomingMessage) => {
			if (body.length <= 65536) observeResponse(response, body)
			body = ''
		})
	}

	function matches(options: RequestOptions): boolean {
		const headers = options.headers
		if (!headers || !headerRecord(headers)) return false
		const value = headers.authorization ?? headers.Authorization
		const bearer = Array.isArray(value) && value.length === 1 ? value[0] : value
		return typeof bearer === 'string' && bearer.startsWith('Bearer ') && access.has(hash(bearer.slice(7)))
	}

	return { observe, matches }
}
