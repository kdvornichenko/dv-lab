import { Hono } from 'hono'
import { handle } from 'hono/vercel'

import { app as teacherCrmApi } from '../../../../api/src/app'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const app = new Hono()
app.route('/api', teacherCrmApi)

const handler = handle(app)

export const GET = handler
export const HEAD = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
