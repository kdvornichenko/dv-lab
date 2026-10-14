import { readFileSync } from 'node:fs'
import { isDeepStrictEqual, parseEnv } from 'node:util'

import { COOKIE_NAME, ENV_TEST, call, quote, sql, startApi, studentCookie, teacherCookie } from './api.mjs'
import { ROOT } from './paths.mjs'

const PORT = 4231
const SECRET_KEY = 'synthetic-key-value-for-check-only'

let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const contracts = await import(`${ROOT}/packages/contracts/src/index.ts`)
const { loadConfig } = await import(`${ROOT}/apps/api/src/config.ts`)
const { createDb } = await import(`${ROOT}/packages/db/src/index.ts`)
const settingsModule = await import(`${ROOT}/apps/api/src/settings/settings.ts`)
const modelConfig = await import(`${ROOT}/apps/api/src/chat/model-config.ts`)

const { CHAT_SETTINGS_DEFAULT } = contracts
const { readAssistantSettings, saveAssistantSettings } = settingsModule
const { resolveModelChoice, modelCapabilities, selectionAllowed } = modelConfig

const baseEnv = {
	NODE_ENV: 'test',
	PORT: '4000',
	APP_ORIGIN: 'http://localhost:3000',
	DATABASE_URL: 'postgres://synthetic:synthetic@localhost:5432/dvlab_test',
}

function configOutcome(extra) {
	try {
		const config = loadConfig({ ...baseEnv, ...extra })
		return { config }
	} catch (error) {
		return { message: error instanceof Error ? error.message : String(error) }
	}
}

function sectionConfig() {
	const missing = configOutcome({})
	check('without a key the model is disabled', missing.config?.chat.enabled === false)
	const empty = configOutcome({ ANTHROPIC_API_KEY: '' })
	check('an empty key is a startup error', empty.message === 'Invalid ANTHROPIC_API_KEY')
	const blank = configOutcome({ ANTHROPIC_API_KEY: '   ' })
	check('a blank key is a startup error', blank.message === 'Invalid ANTHROPIC_API_KEY')
	check('the error text carries no key value', !JSON.stringify([empty, blank]).includes(SECRET_KEY))
	const set = configOutcome({ ANTHROPIC_API_KEY: ` ${SECRET_KEY} ` })
	check(
		'a key enables the model and is trimmed',
		set.config?.chat.enabled === true && set.config.chat.apiKey === SECRET_KEY
	)
	check(
		'config keeps models, tariffs, limits and the cap out of the environment',
		Object.keys(set.config?.chat ?? {})
			.sort()
			.join(',') === 'apiKey,enabled'
	)
}

const accountRow = () => sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]

const settingsRow = (accountId) =>
	sql(`select to_jsonb(t) as row from teacher_settings t where account_id = ${quote(accountId)}`).rows[0]?.row ?? null

function restoreRow(accountId, saved) {
	sql(`delete from teacher_settings where account_id = ${quote(accountId)}`)
	if (saved)
		sql(
			`insert into teacher_settings select * from jsonb_populate_record(null::teacher_settings, ${quote(JSON.stringify(saved))}::jsonb)`
		)
}

const withoutStamp = (row) => {
	if (!row) return row
	const { updated_at: _updated, ...rest } = row
	return rest
}

const clone = (value) => JSON.parse(JSON.stringify(value))

function modelWith(id, patch = {}) {
	return { ...clone(CHAT_SETTINGS_DEFAULT.models[0]), id, name: id, ...patch }
}

async function sectionDefaults(db, accountId) {
	sql(`delete from teacher_settings where account_id = ${quote(accountId)}`)
	const none = await readAssistantSettings(db, accountId)
	check('without a settings row the defaults are returned', isDeepStrictEqual(none, CHAT_SETTINGS_DEFAULT))
	check(
		'default model ids are in the menu order',
		CHAT_SETTINGS_DEFAULT.models.map((entry) => entry.id).join(',') ===
			'claude-haiku-5-5,claude-sonnet-5-5,claude-opus-5-5,claude-fable-5-1'
	)
	check(
		'default cap and limits',
		none.monthlyCapUsd === '10.00' && none.maxInputTokens === 100000 && none.maxOutputTokens === 16000
	)
	const columns = sql(
		`select column_name, column_default, is_nullable from information_schema.columns where table_name = 'teacher_settings' and column_name like 'chat_%' order by column_name`
	).rows
	const byName = Object.fromEntries(columns.map((column) => [column.column_name, column]))
	check(
		'migration columns exist with database defaults',
		columns.length === 6 &&
			byName.chat_monthly_cap_usd?.column_default?.startsWith('10.00') &&
			byName.chat_max_input_tokens?.column_default === '100000' &&
			byName.chat_max_output_tokens?.column_default === '16000' &&
			byName.chat_models?.is_nullable === 'YES' &&
			byName.chat_model?.is_nullable === 'YES' &&
			byName.chat_effort?.is_nullable === 'YES'
	)
	sql(`insert into teacher_settings (account_id, pays_soon_lessons) values (${quote(accountId)}, 2)`)
	const stored = await readAssistantSettings(db, accountId)
	check(
		'an existing teacher row carries 10.00, 100000 and 16000 and the default list',
		isDeepStrictEqual(stored, CHAT_SETTINGS_DEFAULT)
	)
	const raw = settingsRow(accountId)
	check('the stored list stays null until the teacher edits it', raw.chat_models === null)
}

async function sectionSave(db, accountId) {
	const reorder = [1, 0, 2, 3].map((index) => clone(CHAT_SETTINGS_DEFAULT.models[index]))
	const first = await saveAssistantSettings(db, accountId, { models: reorder })
	check(
		'a reordered list is saved and read back in that order',
		first.ok &&
			first.settings.models.map((entry) => entry.id).join(',') ===
				'claude-sonnet-5-5,claude-haiku-5-5,claude-opus-5-5,claude-fable-5-1'
	)
	const stored = await readAssistantSettings(db, accountId)
	check('reading again gives the saved order', stored.models[0].id === 'claude-sonnet-5-5')

	const repriced = clone(stored.models)
	repriced[1].pricing.inputPerMTok = '0.20'
	const second = await saveAssistantSettings(db, accountId, { models: repriced })
	check('a changed tariff is saved', second.ok && second.settings.models[1].pricing.inputPerMTok === '0.20')

	const limits = await saveAssistantSettings(db, accountId, {
		maxInputTokens: 50000,
		maxOutputTokens: 8000,
		monthlyCapUsd: '25.5',
	})
	check(
		'limits and the cap are saved, the cap as a decimal string',
		limits.ok &&
			limits.settings.maxInputTokens === 50000 &&
			limits.settings.maxOutputTokens === 8000 &&
			limits.settings.monthlyCapUsd === '25.50'
	)
	const limitsRow = settingsRow(accountId)
	check(
		'the stored cap is numeric with cents',
		limitsRow.chat_monthly_cap_usd === 25.5 || limitsRow.chat_monthly_cap_usd === '25.50'
	)

	const before = withoutStamp(settingsRow(accountId))
	const refusals = [
		['an unknown model id', { model: 'claude-not-in-list' }],
		[
			'a level the model does not support',
			{
				models: [modelWith('claude-x-1', { efforts: ['low'], defaultEffort: 'low', recommendedEffort: 'low' })],
				effort: 'max',
			},
		],
	]
	for (const [name, input] of refusals) {
		const result = await saveAssistantSettings(db, accountId, input)
		check(
			`${name} gives invalid without a write`,
			!result.ok && result.error === 'invalid' && isDeepStrictEqual(withoutStamp(settingsRow(accountId)), before)
		)
	}
	check('the stored row is untouched after refusals', isDeepStrictEqual(withoutStamp(settingsRow(accountId)), before))

	const parses = [
		['a repeated model id', { models: [CHAT_SETTINGS_DEFAULT.models[0], CHAT_SETTINGS_DEFAULT.models[0]] }],
		[
			'a default level outside the levels',
			{ models: [modelWith('claude-y-1', { efforts: ['low'], defaultEffort: 'high' })] },
		],
		['an empty list', { models: [] }],
		['more than twelve models', { models: Array.from({ length: 13 }, (_, i) => modelWith(`claude-m-${i}`)) }],
		[
			'a zero tariff',
			{
				models: [
					{
						...clone(CHAT_SETTINGS_DEFAULT.models[0]),
						pricing: { ...CHAT_SETTINGS_DEFAULT.models[0].pricing, inputPerMTok: '0.00' },
					},
				],
			},
		],
		['an id outside the claude- form', { models: [modelWith('other-vendor-5')] }],
		['maxInputTokens 150000', { maxInputTokens: 150000 }],
		['maxInputTokens 999', { maxInputTokens: 999 }],
		['maxOutputTokens above the limit', { maxOutputTokens: contracts.CHAT_MAX_OUTPUT_TOKENS_LIMIT + 1 }],
		['a zero cap', { monthlyCapUsd: '0' }],
		['a zero cap with cents', { monthlyCapUsd: '0.00' }],
		['a cap above 10000', { monthlyCapUsd: '10000.01' }],
		['a cap with three decimals', { monthlyCapUsd: '1.001' }],
		['an exponent cap', { monthlyCapUsd: '1e3' }],
		['an unknown level', { effort: 'ultra' }],
		['an unknown key', { monthlyCapUsd: '5.00', apiKey: 'x' }],
		['an empty body', {}],
	]
	for (const [name, input] of parses)
		check(`the request schema rejects ${name}`, !contracts.saveAssistantSettingsRequest.safeParse(input).success)
	const accepted = [
		{ monthlyCapUsd: '0.01' },
		{ monthlyCapUsd: '10000' },
		{ maxInputTokens: 100000 },
		{ maxInputTokens: 1000 },
		{ model: null },
		{ effort: null },
	]
	check(
		'boundary values are accepted',
		accepted.every((input) => contracts.saveAssistantSettingsRequest.safeParse(input).success)
	)
	check(
		'the output limit bound is the shortest documented output maximum of the default models',
		contracts.CHAT_MAX_OUTPUT_TOKENS_LIMIT === 128000
	)

	const picked = await saveAssistantSettings(db, accountId, {
		models: clone(CHAT_SETTINGS_DEFAULT.models),
		model: 'claude-sonnet-5-5',
		effort: 'high',
	})
	check(
		'model and level are saved',
		picked.ok && picked.settings.model === 'claude-sonnet-5-5' && picked.settings.effort === 'high'
	)
	const narrowed = clone(CHAT_SETTINGS_DEFAULT.models)
	narrowed[1].efforts = ['low', 'medium']
	narrowed[1].defaultEffort = 'medium'
	narrowed[1].recommendedEffort = 'medium'
	const keptModel = await saveAssistantSettings(db, accountId, { models: narrowed })
	check(
		'a level the kept model lost is reset, the model stays',
		keptModel.ok && keptModel.settings.model === 'claude-sonnet-5-5' && keptModel.settings.effort === null
	)
	await saveAssistantSettings(db, accountId, { effort: 'low' })
	const withoutModel = CHAT_SETTINGS_DEFAULT.models.filter((entry) => entry.id !== 'claude-sonnet-5-5')
	const removed = await saveAssistantSettings(db, accountId, { models: withoutModel })
	check(
		'removing the teacher model from the list resets model and level',
		removed.ok && removed.settings.model === null && removed.settings.effort === null
	)
	const afterRemoval = settingsRow(accountId)
	check('the reset is stored as null', afterRemoval.chat_model === null && afterRemoval.chat_effort === null)
	const restored = await saveAssistantSettings(db, accountId, { models: null })
	check(
		'null restores the default list and stores null',
		restored.ok &&
			isDeepStrictEqual(restored.settings.models, CHAT_SETTINGS_DEFAULT.models) &&
			settingsRow(accountId).chat_models === null
	)
	const dbRefusals = [
		['a zero cap', 'chat_monthly_cap_usd = 0'],
		['an input limit above 100000', 'chat_max_input_tokens = 100001'],
		['an input limit below 1000', 'chat_max_input_tokens = 999'],
		['an output limit below 1000', 'chat_max_output_tokens = 999'],
		['an unknown level', "chat_effort = 'ultra'"],
	]
	for (const [name, assignment] of dbRefusals) {
		let refused = false
		try {
			sql(`update teacher_settings set ${assignment} where account_id = ${quote(accountId)}`)
		} catch {
			refused = true
		}
		check(`the database refuses ${name}`, refused)
	}
}

function sectionResolve() {
	const base = clone(CHAT_SETTINGS_DEFAULT)
	const defaulted = resolveModelChoice(base, null)
	check(
		'no choice anywhere gives the first model and its default level',
		defaulted.kind === 'resolved' &&
			defaulted.model.id === 'claude-haiku-5-5' &&
			defaulted.effort === 'medium' &&
			defaulted.maxInputTokens === 100000 &&
			defaulted.maxOutputTokens === 16000 &&
			defaulted.model.pricing.outputPerMTok === '0.50'
	)
	const teacher = resolveModelChoice({ ...base, model: 'claude-sonnet-5-5', effort: null }, null)
	check(
		'the teacher model wins over the first one, its default level applies',
		teacher.kind === 'resolved' && teacher.model.id === 'claude-sonnet-5-5' && teacher.effort === 'high'
	)
	const teacherEffort = resolveModelChoice({ ...base, model: 'claude-sonnet-5-5', effort: 'max' }, null)
	check('the teacher level applies', teacherEffort.kind === 'resolved' && teacherEffort.effort === 'max')
	const override = resolveModelChoice(
		{ ...base, model: 'claude-sonnet-5-5', effort: 'max' },
		{ model: 'claude-opus-5-5', effort: 'low' }
	)
	check(
		'the conversation override wins',
		override.kind === 'resolved' && override.model.id === 'claude-opus-5-5' && override.effort === 'low'
	)
	const foreignLevel = resolveModelChoice({ ...base, effort: 'max' }, { model: 'claude-opus-5-5', effort: null })
	check(
		'the teacher level does not leak onto another model',
		foreignLevel.kind === 'resolved' && foreignLevel.effort === 'medium'
	)
	const overrideLevelOnly = resolveModelChoice(
		{ ...base, model: 'claude-sonnet-5-5' },
		{ model: null, effort: 'xhigh' }
	)
	check(
		'a level-only override keeps the teacher model',
		overrideLevelOnly.kind === 'resolved' &&
			overrideLevelOnly.model.id === 'claude-sonnet-5-5' &&
			overrideLevelOnly.effort === 'xhigh'
	)
	const gone = resolveModelChoice(base, { model: 'claude-gone-1', effort: null })
	check(
		'a model outside the list is unavailable, not replaced',
		gone.kind === 'unavailable' && gone.modelId === 'claude-gone-1'
	)
	const goneTeacher = resolveModelChoice({ ...base, model: 'claude-gone-2' }, null)
	check(
		'a teacher model outside the list is unavailable',
		goneTeacher.kind === 'unavailable' && goneTeacher.modelId === 'claude-gone-2'
	)
	const narrow = {
		...base,
		models: [modelWith('claude-n-1', { efforts: ['low', 'high'], defaultEffort: 'low', recommendedEffort: 'high' })],
	}
	const down = resolveModelChoice(narrow, { model: null, effort: 'xhigh' })
	check(
		'an unsupported level goes down to the nearest supported one',
		down.kind === 'resolved' && down.effort === 'high'
	)
	const downTwo = resolveModelChoice(narrow, { model: null, effort: 'medium' })
	check('an unsupported level goes to the lower neighbour', downTwo.kind === 'resolved' && downTwo.effort === 'low')
	const high = {
		...base,
		models: [modelWith('claude-n-2', { efforts: ['high', 'max'], defaultEffort: 'high', recommendedEffort: 'high' })],
	}
	const floor = resolveModelChoice(high, { model: null, effort: 'low' })
	check('with no lower level the lowest supported is used', floor.kind === 'resolved' && floor.effort === 'high')
}

async function sectionCapabilities() {
	const off = await modelCapabilities(CHAT_SETTINGS_DEFAULT, async () => false)
	check(
		'capabilities follow the list order and carry no tariffs',
		off.map((entry) => entry.id).join(',') === CHAT_SETTINGS_DEFAULT.models.map((entry) => entry.id).join(',') &&
			off.every((entry) => !('pricing' in entry) && entry.available === false)
	)
	const on = await modelCapabilities(CHAT_SETTINGS_DEFAULT, async (id) => id !== 'claude-fable-5-1')
	check(
		'availability is asked per model',
		on.filter((entry) => entry.available).length === 3 &&
			on.find((entry) => entry.id === 'claude-fable-5-1')?.available === false
	)
	check(
		'a selection is allowed only for an available model and a supported level',
		selectionAllowed(on, 'claude-haiku-5-5', 'max') &&
			selectionAllowed(on, 'claude-haiku-5-5', null) &&
			!selectionAllowed(on, 'claude-fable-5-1', 'low') &&
			!selectionAllowed(on, 'claude-unknown', null) &&
			!selectionAllowed(off, 'claude-haiku-5-5', 'low')
	)
}

async function sectionHttp(api, cookie, accountId) {
	const get = await call(api, 'GET', '/settings/assistant', { cookie })
	check(
		'GET /settings/assistant returns 200 with settings and capabilities',
		get.status === 200 && Boolean(get.json?.settings) && Array.isArray(get.json?.capabilities)
	)
	check('GET is not cached', get.headers.get('cache-control')?.includes('no-store') === true)
	check(
		'without a key every model is unavailable',
		get.json?.capabilities?.every((entry) => entry.available === false) === true
	)
	check('the response carries no key field', !JSON.stringify(get.json).toLowerCase().includes('apikey'))

	const before = withoutStamp(settingsRow(accountId))
	const bad = [
		{ monthlyCapUsd: '0' },
		{ maxInputTokens: 150000 },
		{ maxInputTokens: '5000' },
		{ models: [] },
		{ model: 'claude-not-in-list' },
		{ unknown: 1 },
		{},
	]
	for (const body of bad) {
		const res = await call(api, 'PATCH', '/settings/assistant', { cookie, body })
		check(
			`PATCH ${JSON.stringify(body)} gives 400 invalid_request`,
			res.status === 400 && res.json?.error?.code === 'invalid_request'
		)
	}
	check('refused PATCH requests wrote nothing', isDeepStrictEqual(withoutStamp(settingsRow(accountId)), before))
	const raw = await fetch(`${api.base}/settings/assistant`, {
		method: 'PATCH',
		headers: { cookie: `${COOKIE_NAME}=${cookie}`, origin: api.base, 'content-type': 'text/plain' },
		body: '{"maxInputTokens":5000}',
	})
	check('a non-JSON content type gives 400', raw.status === 400)

	const ok = await call(api, 'PATCH', '/settings/assistant', {
		cookie,
		body: { monthlyCapUsd: '12', maxOutputTokens: 9000 },
	})
	check(
		'PATCH with valid values gives 200 with the same shape',
		ok.status === 200 &&
			ok.json?.settings?.monthlyCapUsd === '12.00' &&
			ok.json?.settings?.maxOutputTokens === 9000 &&
			Array.isArray(ok.json?.capabilities)
	)
	const again = await call(api, 'GET', '/settings/assistant', { cookie })
	check(
		'the saved values are read back',
		again.json?.settings?.monthlyCapUsd === '12.00' && again.json?.settings?.maxOutputTokens === 9000
	)
	const teacherSettings = await call(api, 'GET', '/settings', { cookie })
	check(
		'GET /settings keeps its shape',
		teacherSettings.status === 200 &&
			Object.keys(teacherSettings.json?.settings ?? {})
				.sort()
				.join(',') === 'defaultTimeZone,paysSoonLessons'
	)

	const student = await studentCookie(api)
	const anonymous = await call(api, 'GET', '/settings/assistant')
	check('no session gives 401', anonymous.status === 401)
	for (const [method, body] of [['GET'], ['PATCH', { monthlyCapUsd: '5' }]]) {
		const res = await call(api, method, '/settings/assistant', { cookie: student, body })
		check(`a student gets 403 on ${method}`, res.status === 403)
	}
}

const db = (() => {
	const url = parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL
	return createDb(url)
})()

let api = null
let accountId = null
let saved = null
try {
	sectionConfig()
	api = await startApi({ port: PORT })
	const cookie = await teacherCookie(api)
	accountId = accountRow().id
	saved = settingsRow(accountId)
	await sectionDefaults(db.db, accountId)
	await sectionSave(db.db, accountId)
	sectionResolve()
	await sectionCapabilities()
	await sectionHttp(api, cookie, accountId)
	const log = api.logs()
	check('the api log carries no key value', !log.includes(SECRET_KEY))
} finally {
	if (accountId) restoreRow(accountId, saved)
	await db.pool.end()
	if (api) await api.stop()
}

console.log(failures === 0 ? 'CHAT_CONFIG_OK' : `CHAT_CONFIG_FAILED ${failures}`)
process.exit(failures === 0 ? 0 : 1)
