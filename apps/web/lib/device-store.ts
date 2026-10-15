const DATABASE = 'dvlab-device'
const STORE = 'entries'

let opening: Promise<IDBDatabase | null> | null = null

function database(): Promise<IDBDatabase | null> {
	if (typeof indexedDB === 'undefined') return Promise.resolve(null)
	opening ??= new Promise((resolve) => {
		try {
			const request = indexedDB.open(DATABASE, 1)
			request.onupgradeneeded = () => request.result.createObjectStore(STORE)
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => resolve(null)
			request.onblocked = () => resolve(null)
		} catch {
			resolve(null)
		}
	})
	return opening
}

async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
	const db = await database()
	if (db === null) return undefined
	return new Promise((resolve) => {
		try {
			const request = act(db.transaction(STORE, mode).objectStore(STORE))
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => resolve(undefined)
		} catch {
			resolve(undefined)
		}
	})
}

export function deviceGet(key: string): Promise<unknown> {
	return run('readonly', (store) => store.get(key))
}

export async function deviceSet(key: string, value: unknown): Promise<void> {
	await run('readwrite', (store) => store.put(value, key))
}

export async function deviceClear(): Promise<void> {
	await run('readwrite', (store) => store.clear())
}
