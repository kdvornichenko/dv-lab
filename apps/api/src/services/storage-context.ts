import { AsyncLocalStorage } from 'node:async_hooks'

import { serverEnv } from '../config/env'
import { memoryStore } from './memory-store'

export type ApiMemoryStore = typeof memoryStore

const scopedStorage = new AsyncLocalStorage<{ memoryStore?: ApiMemoryStore }>()

export async function runWithStorageContext<T>(options: { memoryStore?: ApiMemoryStore }, run: () => Promise<T>) {
	return scopedStorage.run(options, run)
}

export function getMemoryStore() {
	const scopedStore = scopedStorage.getStore()?.memoryStore
	if (scopedStore) return scopedStore
	if (serverEnv.NODE_ENV === 'production') {
		throw new Error('In-memory storage is disabled in production')
	}
	return memoryStore
}
