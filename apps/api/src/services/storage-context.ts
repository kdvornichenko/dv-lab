import { AsyncLocalStorage } from 'node:async_hooks'

import { memoryStore } from './memory-store'

export type ApiMemoryStore = typeof memoryStore

const scopedStorage = new AsyncLocalStorage<{ memoryStore?: ApiMemoryStore }>()

export async function runWithStorageContext<T>(options: { memoryStore?: ApiMemoryStore }, run: () => Promise<T>) {
	return scopedStorage.run(options, run)
}

export function getMemoryStore() {
	return scopedStorage.getStore()?.memoryStore ?? memoryStore
}
