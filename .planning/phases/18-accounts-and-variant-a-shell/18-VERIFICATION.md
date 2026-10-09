---
phase: 18-accounts-and-variant-a-shell
verified: 2026-10-10T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
covered_files:
  - apps/api/src/auth/accounts.ts
  - apps/api/src/auth/sessions.ts
  - apps/api/src/auth/sign-in.ts
  - apps/api/src/auth/throttle.ts
  - apps/web/proxy.ts
  - packages/db/src/schema.ts
covered_digest: "v2:sha256:331bd592b76b123c222fd90cbf75ddf08bc460af47ac6c11b4e7fb7e27033776"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Порядок Tab в оболочке: skip link, триггер, поиск, разделы, строка аккаунта, страница (UI-SPEC)"
    reason: "Владелец не углубляет доступность; расхождение принято оркестратором (18-15, пробел 1)"
    accepted_by: "orchestrator (owner decision)"
    accepted_at: "2026-10-10T00:00:00Z"
human_verification:
  - test: "Выкатка по RUNBOOK 10.1-10.3 и вход владельца на https://dv-lab.dev (сессия оператора 'Server guy')"
    expected: "Бутстрап создаёт учителя, вход по email и паролю на dv-lab.dev работает, смена пароля работает, CLIENT_IP_OK по IPv4 и IPv6 (D-26)"
    why_human: "Критерий 1 'на dv-lab.dev' закрывается только после релиза на VPS"
  - test: "Посмотреть глазами обе темы: контраст Banner и точек статуса, скелетон, круг ReadError, кольцо фокуса, анимации диалогов и тоста, таблица Students на 320 px"
    expected: "Читаемо и без визуальных дефектов в light и dark"
    why_human: "В 18-15 проверено DOM и вычисленными стилями в headless Chromium; оценка вида за владельцем"
---

# Phase 18: Accounts and Variant A Shell — отчёт проверки

**Цель:** учитель входит в ielts-style аккаунт и работает в оболочке варианта A; аккаунты учеников создаются и деактивируются.
**Статус:** human_needed (пробелов в коде нет, остались действия оператора и владельца)
**Повторная проверка:** нет

## Критерии ROADMAP

| # | Критерий | Статус | Доказательство в коде |
|---|----------|--------|-----------------------|
| 1 | Бутстрап, вход, смена пароля, второй активный учитель отвергается БД | КОД VERIFIED; "на dv-lab.dev" - операторский пункт | Миграция `20261009150610_accounts`: частичный уникальный индекс `accounts_one_active_teacher_uq`; `bootstrap-teacher.ts` (код 3 при существующем учителе, advisory lock, перехват 23505); `POST /auth/change-password` (старый пароль, отзыв остальных сессий, новая cookie); 18-15: 23505 на втором учителе. Релиз и вход владельца - 10.1-10.3 |
| 2 | Учитель создаёт ученика, ученик входит, деактивация закрывает все сессии | VERIFIED | `createStudent` (12 символов `generatedPassword` один раз), `deactivateStudent`: `FOR UPDATE`, статус, `revokeAccountSessions` (`auth_epoch+1` и delete сессий) в одной транзакции; `readSession` сверяет эпоху и статус; 18-15: 200 -> 401 у второго клиента |
| 3 | Сессии в Postgres, только хэши, переживают рестарт; 5 неудач / 15 мин блокируют на 15 мин | VERIFIED | `sessions.token_hash` = sha256 hex (CHECK `^[0-9a-f]{64}$`), токен 32 байта не хранится; `throttle.ts`: `MAX_PAIR_FAILURES=5`, окно и блокировка 900 с, ключ логин+IP (IPv6 /64), `FOR UPDATE`; 18-15: SIGTERM + перезапуск сохраняют сессию, шестой вход 429 `Retry-After: 900`, 50 параллельных попыток не задерживают `/healthz` (D-20, max 98 мс) |
| 4 | После входа оболочка A: Today, Chat, Students, Schedule, поиск открывает палитру | VERIFIED | `sections.ts` (единый список), `app-sidebar.tsx` (поле поиска -> `openSearch`), `command-palette.tsx` на Base UI Autocomplete (разделы, тема, выход), Ctrl/Cmd+K; `layout.tsx` проверяет сессию через `getMe` |
| 5 | Base UI, токены A, light/dark, только английский | VERIFIED (с пометкой) | grep кириллицы в `apps/web` - пусто; `cmdk`, `radix-ui` в зависимостях и импортах нет (единственное вхождение - CSS-переменная `--radix-dropdown-menu-trigger-width` с запасным `--anchor-width`, не зависимость); `@base-ui/react` 1.8.0; `next-themes` class `dark`, `lang="en"`; комментариев в коде нет; таблица 18-15 (экраны x темы x 1280/320, 252 PASS) |

## Решения D-01..D-28

Противоречий не найдено: cookie `__Host-dvlab_session` (httpOnly, secure, Lax, path `/`), TTL 30 дней + `renewDue`/`POST /auth/renew` (D-23); `proxy.ts` проверяет только форму cookie (D-02); scrypt N=2^15, r=8, p=3, NFKC, параметры в строке хэша (D-04); одно сообщение `Wrong login or password` и фиктивный хэш (D-10); смена пароля с отзывом остальных сессий (D-07); `X-Frame-Options "DENY"` в Caddyfile (D-27); `onError` различает HTTPException, `sameOrigin` сверяет `APP_ORIGIN` (D-28); `packages/contracts` без pg (D-18); `/api` rewrites только в development (D-21); сервис `bootstrap` и `API_INTERNAL_URL` в `deploy/compose.yaml` (D-15). D-19 отменён: новых тестов фазы нет, в тестах только 18-01 contracts (до директивы) и существующие.

## Покрытие требований

| ID | План | Статус |
|----|------|--------|
| ACCT-01 | 18-01, 02, 04, 06, 07, 09, 11, 13, 15, 16 | SATISFIED (на dv-lab.dev - операторский пункт) |
| ACCT-02 | 18-01, 02, 04, 06, 10, 12, 14, 15 | SATISFIED |
| ACCT-03 | 18-01, 02, 06, 09, 15, 16 | SATISFIED |
| ACCT-05 | 18-01, 04, 07, 10, 12, 14, 15, 16 | SATISFIED |
| SHELL-01 | 18-08, 11, 13, 15, 17 | SATISFIED |
| SHELL-02 | 18-01, 05, 08, 11, 14, 15, 17 | SATISFIED |

Все шесть ID заявлены в планах и есть в REQUIREMENTS.md (в таблице трассировки все ещё Pending - обновить после релиза). ACCT-04 относится к фазе 19, SHELL-03..05 - к 23, 23, 21; осиротевших ID нет.

## Пробелы из 18-15

- Порядок Tab: PASSED (override), принят оркестратором по решению владельца.
- `truncate` имени в таблице Students: исправлено в 0bee127 (`max-w-64 min-w-0` у обёртки ячейки), повторно проверено в браузере на 320 px.

## Предупреждения

- Автотесты логики входа, блокировки и деактивации отсутствуют по директиве владельца; поведение подтверждено только прогонами 18-15 (скрипты и журнал в scratchpad, в репозиторий не попали), перепроверить их можно лишь вручную.
- PR #4: master влит в ветку (b417e23, конфликты только в ROADMAP.md и STATE.md); зелёный CI по фазе подтверждается на PR после пуша.
- Блокировки учителя по D-09 (20 неудач на логин) принятый риск R3; снятие - RUNBOOK 10.4.

_Verified: 2026-10-10_
_Verifier: Claude (gsd-verifier)_
