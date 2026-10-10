import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

export const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
export const STATE_DIR = process.env.DVLAB_CHECKS_DIR ?? `${tmpdir()}/dvlab-dev-checks`
mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
