---
phase: 19-student-cards-and-vault-import
plan: 18
subsystem: ui
status: complete
tags: [students, account, reveal-once, link-account, deactivate, base-ui]
requires:
  - phase: 19-12
    provides: маршруты POST /students/:id/account, GET candidates, POST link, POST deactivate и коды 409
  - phase: 19-14
    provides: страница профиля, overview-tab, Panel, ConfirmDialog
  - phase: 19-17
    provides: вкладки профиля
provides:
  - панель Account на вкладке Overview (четыре состояния)
  - создание аккаунта из карточки с одноразовым показом пароля (CreateAccountDialog, RevealBody)
  - привязка существующего непривязанного аккаунта (LinkAccountDialog)
  - деактивация аккаунта карточки по пути /students/:id/account/deactivate
affects: [19-19, 19-20]
requirements-completed: [ACCT-04]
key-files:
  created:
    - apps/web/app/(app)/students/[id]/_components/account-panel.tsx
    - apps/web/app/(app)/students/[id]/_components/create-account-dialog.tsx
    - apps/web/app/(app)/students/[id]/_components/link-account-dialog.tsx
    - apps/web/app/(app)/students/[id]/_components/reveal-body.tsx
  modified:
    - apps/web/app/(app)/students/[id]/_components/overview-tab.tsx
    - apps/web/app/(app)/students/_components/deactivate-student-dialog.tsx
    - packages/contracts/src/auth.ts
  deleted:
    - apps/web/app/(app)/students/_components/create-student-dialog.tsx
key-decisions:
  - "CreateAccountDialog и LinkAccountDialog принимают studentId и name вместо объекта карточки: приёмочный grep плана требует, чтобы в create-account-dialog.tsx не было слова displayName"
  - "Ошибка чтения списка кандидатов показывается Banner «Could not link the account. Try again.», Select остаётся неактивным: для этого сбоя в 19-UI-SPEC отдельного текста нет"
  - "Баннер конфликта остаётся в открытом диалоге, а экран за ним перечитывается через onConflict; список кандидатов в диалоге привязки перечитывается сам"
metrics:
  duration: 95min
  completed: 2026-10-10
estimate:
  tokens: 55000
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: e7c270b764b14db8f72ba38b08ea0ebdfce3b786
plan_head_after: 707217c0960f82b04dc1d19c1bd9ce4d101b5dfb
---

# Phase 19 Plan 18: Аккаунт ученика из карточки Summary

Панель Account на вкладке Overview: учитель создаёт аккаунт из карточки (пароль показывается один раз), привязывает существующий непривязанный аккаунт и деактивирует аккаунт карточки; диалоги и типы аккаунтного списка фазы 18 заменены или удалены.

## Что сделано

- `reveal-body.tsx`: `RevealBody` вынесен из диалога фазы 18 без изменения вида и текстов; данные — `{ name, login, password }`.
- `create-account-dialog.tsx`: создание аккаунта из карточки. Поля Name нет, имя карточки в заголовке «Create account for {name}». Login и Password с подсказками и проверками фазы 18. `POST /students/:id/account`; 409 `login_taken` — ошибка поля, 409 `card_has_account` — Banner и перечитывание профиля, иное — Banner «Could not create the account. Try again.». Сгенерированный пароль — состояние reveal-once (без Esc, без клика снаружи, без крестика, единственный выход I saved the password, пароль не остаётся в DOM). Свой пароль — уведомление «Account created» / «{name} can sign in with the login {login}.».
- `account-panel.tsx`: Panel Account. Без аккаунта: строка и кнопки Create account (UserPlus) и Link existing account (Link2). С аккаунтом: строки Login, Status (StatusDot и Active или Deactivated), Created (en-US medium); Deactivate account (tertiary, text-destructive) только у активного; у деактивированного снова обе кнопки (D-33); у архивной карточки с активным аккаунтом подпись «This card is archived. The account can still sign in.». Возврат фокуса на кнопку-открыватель.
- `link-account-dialog.tsx`: Select «{name} · {login}» из `GET /students/:id/account/candidates`; пока список грузится — Select неактивен с «Loading accounts…»; пустой список — «No unlinked student accounts.» и неактивная Link account; «Choose an account.» без выбора; 409 `account_already_linked` и `card_has_account` — Banner, список и профиль перечитываются; успех — «Account linked» / «{account name} is linked to {name}.».
- `deactivate-student-dialog.tsx`: тексты и вид без изменений, пропсы `studentId` и `account`, запрос `POST /students/:id/account/deactivate` с `accountId`.
- `overview-tab.tsx`: AccountPanel в правой колонке под Opening balance.
- Удалены `create-student-dialog.tsx` и типы `CreateStudentResponse` и `DeactivateStudentResponse` из `packages/contracts/src/auth.ts` (потребителей нет).

## Проверка

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/contracts typecheck`, `@dv-lab/api typecheck`, `@dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `yarn workspace @dv-lab/web build` | код 0, маршрут `/students/[id]` на месте |
| Prettier по файлам плана | чисто |
| `git grep CreateStudentResponse DeactivateStudentResponse` по apps и packages | пусто |
| Приёмка задачи 1: нет create-student-dialog.tsx; в create-account-dialog.tsx нет `displayName` | пройдена |
| Приёмка задачи 2: в deactivate-student-dialog.tsx есть `/account/deactivate`, нет `}/deactivate` | пройдена |
| `yarn workspace @dv-lab/contracts test` (существующие тесты) | 48 из 48 |

Браузер: dev-стек на dvlab_dev (`yarn workspace @dv-lab/api dev`, `yarn workspace @dv-lab/web dev`), Chromium через playwright-core, `SCRATCH/19-18-browser.mjs` (части 1 и 2, модуль `19-18-link.mjs`), обе темы. Итог: `ACCOUNT_CREATE_OK` и `ACCOUNT_LINK_OK` в светлой и тёмной теме, `failures=0`; пароли в вывод не попадают. Проверки только на вымышленных карточках Alex Example 1918 A, B, C, P и аккаунтах `v1918.*`.

- Часть 1 (создание): панель Account с описанием, без аккаунта строка и кнопка Create account; диалог с заголовком по имени карточки, описанием, без поля Name, подсказки Login и Password как в фазе 18, фокус на Login; ошибки пустого логина и короткого пароля; Discard changes закрывает и возвращает фокус на Create account, повторное открытие пустое; reveal: пароль из 12 символов, текст описания и предупреждения, нет крестика, Esc и клик снаружи не закрывают, Copy password даёт Copied, буфер обмена совпадает с показанным паролем, фокус на I saved the password, после выхода пароля нет в DOM; панель: Login, Status Active с зелёной точкой, Created сегодня, кнопки Create account нет; ученик входит этим логином и паролем в отдельном контексте и видит «Signed in as», его сессия получает 403 на `GET /students/:id`; свой пароль — без reveal, уведомление с логином; занятый логин — ошибка поля; 409 `card_has_account` — Banner и панель за диалогом обновилась.
- Часть 2 (привязка и деактивация): оба варианта кнопок без аккаунта; загрузка — Select неактивен с «Loading accounts…», Link account неактивна (задержка запроса 1,5 с); «Choose an account.» при пустом выборе; пункты «{name} · {login}», аккаунта карточки A нет, список равен числу непривязанных активных аккаунтов учеников (три тестовых плюс один существующий); привязка free1 к B: уведомление, панель B показывает аккаунт; две вкладки на C: первая привязывает free2, вторая получает Banner «This account is already linked to a card.» и обновлённый список без free2; другой аккаунт в карточку с аккаунтом — Banner «This card already has an account.», панель за диалогом актуальна; деактивация A: тексты фазы 18, Keep account оставляет аккаунт, запрос идёт на `/api/students/{id}/account/deactivate` с `accountId`, панель показывает Deactivated и снова обе кнопки, живая сессия ученика после этого получает 401; архивная карточка B с активным аккаунтом — подпись и кнопка Deactivate account, у активной карточки подписи нет; SQL «у карточки больше одного активного аккаунта» — 0 строк; консоль без неожиданных сообщений.
- Панель отдельно осмотрена на скриншотах в обеих темах (без аккаунта, с аккаунтом, архивная карточка, ширина 360).
- Очистка: сессии, аккаунты `v1918.*` и карточки 1918 удалены (счёт 0), карточек в dvlab_dev 25 как до проверки, dev-ученик не привязывался. Скриншоты — только в SCRATCH (`19-18-{light,dark}-*.png`). Dev-серверы остановлены, порты 3000 и 4000 свободны, `apps/web/AGENTS.md` удалён.

## Не запускалось

- `yarn knip` (красный до 19-19), `yarn workspace @dv-lab/api test` и тесты db (новые тесты не пишутся, api и db плана не менялись).
- Клавиатурный проход по Select привязки и фокус после деактивации не проверялись отдельно (фокус возвращается на Create account по коду).
- Сбой чтения списка кандидатов в браузере не воспроизводился.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Пропсы диалогов — studentId и name вместо карточки**
- **Found during:** задача 1
- **Issue:** приёмочный критерий `! grep -n "displayName" create-account-dialog.tsx` требует отсутствия слова в файле, а сигнатура `CreateAccountDialog({ student, ... })` вынуждает читать `student.displayName`.
- **Fix:** `CreateAccountDialog` и `LinkAccountDialog` получают `studentId` и `name`; панель передаёт `student.id` и `student.displayName`. Поведение и тексты по плану. Добавлен `onConflict` для перечитывания профиля.
- **Files modified:** create-account-dialog.tsx, link-account-dialog.tsx, account-panel.tsx
- **Committed in:** 3f449fc, 707217c

**2. [Rule 2 - Missing functionality] Сбой чтения кандидатов**
- **Found during:** задача 2
- **Issue:** в плане и 19-UI-SPEC нет состояния «список не загрузился».
- **Fix:** Banner «Could not link the account. Try again.» (общий текст ошибки привязки), Select неактивен. Нового вида нет.
- **Committed in:** 707217c

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing functionality)
**Impact on plan:** на контракт и поведение не влияют.

## Known Stubs

Нет.

## Threat Flags

Новой поверхности сверх `<threat_model>` нет. T-19-79: reveal-once проверен (Esc, клик снаружи, нет крестика, пароль не остаётся в DOM). T-19-80: две вкладки дают Banner конфликта и обновлённый список. T-19-81: запрос деактивации несёт `accountId`, повторные сессии отклоняются 401. T-19-82: пароли в вывод и SUMMARY не попадали, `v1918.*` удалены.

## Коммиты

- 3f449fc feat(19-18): панель Account и создание аккаунта из карточки с одноразовым показом пароля
- 707217c feat(19-18): привязка существующего аккаунта, деактивация по пути карточки, удаление мёртвых типов

## Self-Check: PASSED

- account-panel.tsx, create-account-dialog.tsx, link-account-dialog.tsx, reveal-body.tsx на месте; create-student-dialog.tsx удалён; коммиты 3f449fc и 707217c есть в ветке.
- typecheck (contracts, api, web), lint и build web — код 0; браузерные проверки в обеих темах пройдены.
