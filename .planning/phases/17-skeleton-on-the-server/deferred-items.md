## Deferred Items

- `packages/db/drizzle/*/snapshot.json` не проходит `prettier --check`
  status: resolved
  **What:** drizzle-kit пишет snapshot.json с отступом в два пробела, `.prettierrc.json` требует табы, `.prettierignore` каталог `packages/db/drizzle` не исключает. `yarn format:check` в CI (17-10) упадёт на этом файле. Сгенерированные файлы руками не правятся; решение: добавить `packages/db/drizzle` в `.prettierignore`.
  **Found:** 17-03, задача 1.
  **Resolved:** 17-10, `packages/db/drizzle` добавлен в `.prettierignore`.
- `knip.json` описывает удалённые пакеты
  status: resolved
  **What:** записи `packages/db` (`src/ledger.test.ts`, `src/connection-url.test.ts`), `packages/api-types`, `packages/rbac` и старые entry `apps/api` относятся к удалённому коду. Файл переписывает 17-10.
  **Found:** 17-03.
  **Resolved:** 17-10, `knip.json` переписан под `apps/web`, `apps/api`, `packages/db`, `yarn knip` завершается кодом 0.
- turbo 2.11.7 дописывает блок `turborepo-agent-rules` в `AGENTS.md` при запуске агентом
  status: resolved
  **What:** любой `turbo run` из сессии агента добавляет управляемый блок в `AGENTS.md`. В 17-03 изменение откачено. Отключается ключом `"agentGuidance": false` в `turbo.json`; решение за 17-10, который переписывает `AGENTS.md`.
  **Found:** 17-03, задача 2.
  **Resolved:** 17-10, `"agentGuidance": false` в `turbo.json`; после `yarn typecheck`, `lint`, `test`, `build` из сессии агента `AGENTS.md` не меняется.
