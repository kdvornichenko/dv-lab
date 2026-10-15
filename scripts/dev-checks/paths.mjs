import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

export const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
export const STATE_DIR = process.env.DVLAB_CHECKS_DIR ?? `${tmpdir()}/dvlab-dev-checks`
mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
export const STAND_ID = createHash('sha1').update(ROOT).digest('hex').slice(0, 8)
export const STAND_STATE = `${STATE_DIR}/stand-${STAND_ID}.json`
export const STAND_LAST = `${STATE_DIR}/stand-${STAND_ID}.last.json`
