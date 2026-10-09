## Deferred Items

- `packages/db/drizzle/*/snapshot.json` не проходит `prettier --check`
  status: open
  **What:** drizzle-kit пишет snapshot.json с отступом в два пробела, `.prettierrc.json` требует табы, `.prettierignore` каталог `packages/db/drizzle` не исключает. `yarn format:check` в CI (17-10) упадёт на этом файле. Сгенерированные файлы руками не правятся; решение: добавить `packages/db/drizzle` в `.prettierignore`.
  **Found:** 17-03, задача 1.
- `knip.json` описывает удалённые пакеты
  status: open
  **What:** записи `packages/db` (`src/ledger.test.ts`, `src/connection-url.test.ts`), `packages/api-types`, `packages/rbac` и старые entry `apps/api` относятся к удалённому коду. Файл переписывает 17-10.
  **Found:** 17-03.
- turbo 2.11.7 дописывает блок `turborepo-agent-rules` в `AGENTS.md` при запуске агентом
  status: open
  **What:** любой `turbo run` из сессии агента добавляет управляемый блок в `AGENTS.md`. В 17-03 изменение откачено. Отключается ключом `"agentGuidance": false` в `turbo.json`; решение за 17-10, который переписывает `AGENTS.md`.
  **Found:** 17-03, задача 2.
