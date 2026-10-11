import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { googleCredentialEnvelope, type GoogleCredentialEnvelope } from '@dv-lab/db'

import type { CalendarConfig } from '../config.ts'

export type TokenBinding = {
	accountId: string
	connectionId: string
	generation: number
	purpose: 'refresh' | 'verifier'
}

export function createTokenEnvelope(config: Extract<CalendarConfig, { enabled: true }>) {
	function aad(binding: TokenBinding, keyId: string, purpose: 'key' | 'value'): Buffer {
		return Buffer.from(
			JSON.stringify([1, binding.accountId, binding.connectionId, binding.generation, binding.purpose, keyId, purpose])
		)
	}
	function key(id: string): Buffer {
		const value = config.keyring[id]
		if (!value || value.length !== 32) throw new Error('Credential key unavailable')
		return value
	}
	return {
		activeKeyId: config.activeKeyId,
		seal(value: string, binding: TokenBinding): GoogleCredentialEnvelope {
			const dek = randomBytes(32)
			try {
				const wrapped = encrypt(dek, key(config.activeKeyId), aad(binding, config.activeKeyId, 'key'))
				const encrypted = encrypt(Buffer.from(value), dek, aad(binding, config.activeKeyId, 'value'))
				return googleCredentialEnvelope.parse({
					keyId: config.activeKeyId,
					...encrypted,
					wrappedDek: wrapped.ciphertext,
					wrapNonce: wrapped.nonce,
					wrapTag: wrapped.tag,
				})
			} finally {
				dek.fill(0)
			}
		},
		open(input: GoogleCredentialEnvelope, binding: TokenBinding): string {
			try {
				const envelope = googleCredentialEnvelope.parse(input)
				const dek = decrypt(
					{
						ciphertext: envelope.wrappedDek,
						nonce: envelope.wrapNonce,
						tag: envelope.wrapTag,
					},
					key(envelope.keyId),
					aad(binding, envelope.keyId, 'key')
				)
				try {
					return decrypt(envelope, dek, aad(binding, envelope.keyId, 'value')).toString('utf8')
				} finally {
					dek.fill(0)
				}
			} catch {
				throw new Error('Credential authentication failed')
			}
		},
	}
}

function encrypt(value: Buffer, key: Buffer, aad: Buffer) {
	const nonce = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', key, nonce)
	cipher.setAAD(aad)
	const ciphertext = Buffer.concat([cipher.update(value), cipher.final()])
	return {
		nonce: nonce.toString('base64url'),
		tag: cipher.getAuthTag().toString('base64url'),
		ciphertext: ciphertext.toString('base64url'),
	}
}

function decrypt(value: { nonce: string; tag: string; ciphertext: string }, key: Buffer, aad: Buffer): Buffer {
	const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.nonce, 'base64url'))
	decipher.setAAD(aad)
	decipher.setAuthTag(Buffer.from(value.tag, 'base64url'))
	return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64url')), decipher.final()])
}

export type TokenEnvelope = ReturnType<typeof createTokenEnvelope>
