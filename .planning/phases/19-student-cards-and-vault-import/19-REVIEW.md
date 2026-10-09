---
phase: 19-student-cards-and-vault-import
reviewed: 2026-10-09T22:39:09Z
depth: standard
files_reviewed: 66
files_reviewed_list:
  - .dockerignore
  - .github/workflows/ci.yml
  - .gitignore
  - apps/api/package.json
  - apps/api/src/app.ts
  - apps/api/src/auth/account-rows.ts
  - apps/api/src/auth/accounts.ts
  - apps/api/src/auth/middleware.ts
  - apps/api/src/auth/sessions.ts
  - apps/api/src/auth/throttle.ts
  - apps/api/src/bootstrap-teacher.ts
  - apps/api/src/cards/card-account.ts
  - apps/api/src/cards/card-rows.ts
  - apps/api/src/cards/cards.ts
  - apps/api/src/cards/payments.ts
  - apps/api/src/cards/sections.ts
  - apps/api/src/cards/terms.ts
  - apps/api/src/import-vault.ts
  - apps/api/src/import/apply-packet.ts
  - apps/api/src/import/packet.ts
  - apps/api/src/import/parse-vault.ts
  - apps/api/src/request-context.ts
  - apps/api/src/routes/payments.ts
  - apps/api/src/routes/students.ts
  - apps/api/tsdown.config.ts
  - apps/web/app/(app)/students/[id]/_components/account-panel.tsx
  - apps/web/app/(app)/students/[id]/_components/create-account-dialog.tsx
  - apps/web/app/(app)/students/[id]/_components/link-account-dialog.tsx
  - apps/web/app/(app)/students/[id]/_components/notes-tab.tsx
  - apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx
  - apps/web/app/(app)/students/[id]/_components/overview-tab.tsx
  - apps/web/app/(app)/students/[id]/_components/payments-tab.tsx
  - apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx
  - apps/web/app/(app)/students/[id]/_components/reveal-body.tsx
  - apps/web/app/(app)/students/[id]/_components/set-currency-dialog.tsx
  - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
  - apps/web/app/(app)/students/[id]/_components/term-dialogs.tsx
  - apps/web/app/(app)/students/[id]/_components/vocabulary-tab.tsx
  - apps/web/app/(app)/students/[id]/page.tsx
  - apps/web/app/(app)/students/_components/assign-payment-dialog.tsx
  - apps/web/app/(app)/students/_components/deactivate-student-dialog.tsx
  - apps/web/app/(app)/students/_components/student-form-dialog.tsx
  - apps/web/app/(app)/students/_components/students-screen.tsx
  - apps/web/app/(app)/students/_components/unassigned-payments.tsx
  - apps/web/components/app/confirm-dialog.tsx
  - apps/web/components/app/date-field.tsx
  - apps/web/components/app/ledger-text.tsx
  - apps/web/components/app/markdown-view.tsx
  - apps/web/components/ui/input.tsx
  - apps/web/components/ui/textarea.tsx
  - apps/web/components/ui/select.tsx
  - apps/web/components/ui/combobox.tsx
  - apps/web/hooks/use-keyboard-nav-gate.ts
  - apps/web/lib/api-client.ts
  - deploy/compose.yaml
  - deploy/RUNBOOK.md
  - packages/contracts/src/auth.ts
  - packages/contracts/src/identity.ts
  - packages/contracts/src/students.ts
  - packages/core/src/money.ts
  - packages/core/src/lessons.ts
  - packages/core/src/balance.ts
  - packages/db/src/schema.ts
  - packages/db/src/postgres-errors.ts
  - packages/db/src/connection.ts
  - packages/db/drizzle/20261009194959_student_cards/migration.sql
findings:
  critical: 0
  warning: 1
  info: 6
  total: 7
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-10-09T22:39:09Z
**Depth:** standard
**Files Reviewed:** 66
**Status:** issues_found

## Summary

Reviewed every source file changed on `gsd/phase-19-student-cards-and-vault-import` against `origin/master`, excluding `.planning/`, `yarn.lock` and the generated drizzle snapshot. The copied variant A components (`select`, `combobox`, `calendar`, `popover`) were checked only for the hand edits made in plans 19-06 and 19-20.

The api side holds up. Every `/students` and `/payments` route goes through `noStore → requireSession → requireRole('teacher')`. Term and account operations check the `(card, child)` pair, so a child id from another card returns 404. `deactivateStudent` checks `accounts.student_id = :id`. `cardBalances` is the only place that decides which payments count toward the balance, and it matches D-09/D-10 (`paid_on > opening_balance_on`, `credited_minutes > 0`). `assignPayment` cannot move a payment between cards: its `WHERE` only allows a payment with no card, or the same card with no currency. The nested `executor.transaction` calls in `createStudent` and `linkStudentAccount` act as savepoints, so after a 23505 the outer transaction stays usable. The import runs in one transaction under an advisory lock as the app role. Its messages only use `folder #N` and counts, and `serializeError` no longer leaks pg `detail`.

The `packages/core` integer maths is correct within the contract bounds: hundredths ≤ 9 999 999, amounts ≤ 2e9, lesson minutes 15–240. Sums stay below 2^31, and the `\.?0+$` trimming behaves for 0, 10, 10.5 and 1000. The migration only adds objects.

No CRITICAL or HIGH findings. There is one MEDIUM: a create-account dialog can be closed mid-request and lose the generated password. The rest are LOW validation and consistency gaps that each come from a concrete input.

Severity mapping: CRITICAL/HIGH → `critical`, MEDIUM → `warning`, LOW → `info`.

## Warnings

### WR-01: [MEDIUM] Create-account dialog can be closed while the request is pending, so the generated password is lost

**File:** `apps/web/app/(app)/students/[id]/_components/create-account-dialog.tsx:109-115`
**Issue:** `onOpenChange` only checks `!revealed`, and `showCloseButton={!revealed}` keeps the X visible while `pending` is true. Every other dialog in this phase checks `!pending` (record-payment:128, set-currency:90, assign-payment:110, link-account:106, term-dialogs:135/230, confirm-dialog:55, student-form:296).

Failing sequence:
1. The teacher leaves Password empty (generate mode), presses Create account, then presses Esc, clicks the backdrop or clicks X before the response arrives.
2. The dialog unmounts and `onClose` → `closeDialog` runs without `onChanged`.
3. The server still creates and links the account. `generatedPassword` arrives at an unmounted component and is never shown.
4. The panel keeps showing "No account is linked" until a reload. A second Create returns `card_has_account`.

This phase has no reset for student passwords. The only recovery is to deactivate the account and create it again.

**Fix:**
```tsx
<Dialog
	open
	onOpenChange={(open) => {
		if (!open && !pending && !revealed) onClose()
	}}
>
	<DialogContent size="lg" showCloseButton={!revealed && !pending}>
```

## Info

### IN-01: [LOW] Year 0000 passes `isIsoDate` but Postgres rejects it, so the api returns 500 instead of 400

**File:** `packages/contracts/src/students.ts:50-58` (used by `recordPaymentRequest.paidOn` and `openingBalanceRequest.on`; also `apps/api/src/import/packet.ts:27`)
**Issue:** `isIsoDate('0000-01-01')` returns true: `setUTCFullYear(0, 0, 1)` round-trips. PostgreSQL has no year 0 and raises `22008 date/time field value out of range`. The future-date guard in `routes/payments.ts:55` compares strings, so `'0000-…'` passes it. `POST /payments` or `PUT /students/:id/opening-balance` with that date then ends in `internal_error` 500 instead of `invalid_request`.
**Fix:** add `if (year < 1) return false` in `isIsoDate`. A stricter option is to require `year >= 1900` there, or in the zod `isoDate` refinement.

### IN-02: [LOW] The api accepts an opening-balance date in the future

**File:** `apps/api/src/routes/students.ts:113-121`, `packages/contracts/src/students.ts:94-97`
**Issue:** The payments route rejects `paidOn` later than UTC tomorrow (`routes/payments.ts:55`). `PUT /:id/opening-balance` has no matching check, and only the UI `max` stops it. With `on = '9999-12-31'`, `cardBalances` excludes every payment (`paid_on > opening_balance_on` is never true), so the balance stays at the opening value.
**Fix:** move `latestPaymentDate` into a shared helper in the route layer, and return `invalidRequest` when `input.on > latestPaymentDate(new Date())` in the opening-balance route.

### IN-03: [LOW] `suggestLessons` can prefill a value that `parseLessons` then rejects

**File:** `packages/core/src/lessons.ts:34-41`
**Issue:** The suggestion has no upper bound. Example: rate 1.00 and amount 200 000.00 give 20 000 000 hundredths, above `maxHundredths = 9 999 999`. The record-payment, set-currency and assign dialogs prefill "200000". `parseLessons` returns null for it, so the form shows "Enter 0 or more lessons, up to two decimals." on a value the app filled in itself.
**Fix:**
```ts
const hundredths = Math.round((amountMinor * 100) / rate.rateMinor)
return hundredths > maxHundredths ? null : hundredths
```

### IN-04: [LOW] The rate line accepts `₽` but not `₸`, while payment cells accept both

**File:** `apps/api/src/import/parse-vault.ts:51` vs `:153-159`
**Issue:** `RATE_PATTERN` matches only `₽|KZT|RUB` as the currency symbol. `parseCurrency` also maps `₸` to KZT. A line such as `- Listed rate: 12 000 ₸ / 60 min` does not match. The card is imported without a rate, a warning is printed, and `default_lesson_minutes` falls back to 60.
**Fix:** use `(₽|₸|KZT|RUB)?` in `RATE_PATTERN`, and map the symbol with `parseCurrency(symbol)` instead of `symbol === '₽' ? 'RUB' : symbol as Currency`.

### IN-05: [LOW] Deleting a row that is already gone shows a failure banner

**File:** `apps/web/app/(app)/students/[id]/_components/payments-tab.tsx:89-93`, `apps/web/app/(app)/students/_components/unassigned-payments.tsx:59-63`, `apps/web/app/(app)/students/[id]/_components/vocabulary-tab.tsx:63-67`
**Issue:** On 404 the handlers reload the list but return `false`. `ConfirmDialog` then shows "Could not delete … Try again." above a table where the row has already disappeared. Pressing the button again repeats the 404.
**Fix:** treat 404 as done: `if (result.status === 404) { await load(); onChanged?.(); return true }`.

### IN-06: [LOW] Deactivate dialog can be closed mid-request and the panel stays stale (existed before this phase)

**File:** `apps/web/app/(app)/students/_components/deactivate-student-dialog.tsx:48-50`
**Issue:** `onOpenChange` calls `onClose()` without checking `pending`. Esc during the request unmounts the dialog. The server still deactivates the account, but `onDeactivated` → `onChanged` never runs, so the account panel shows "Active" until the page reloads. This phase reused the dialog for the account panel, so the gap now affects card screens.
**Fix:** `if (!open && !pending) onClose()`.

---

## Fixes applied

Принятые владельцем находки исправлены отдельными коммитами `fix(19)`. Остальные находки отчёта остаются открытыми.

| Находка | Статус | Коммит | Что сделано |
|---------|--------|--------|-------------|
| WR-01 | fixed | 949eb17 | `create-account-dialog.tsx`: `onOpenChange` не закрывает диалог при `pending`, `showCloseButton` выключен при `pending` и при показе пароля |
| IN-06 | fixed | 949eb17 | `deactivate-student-dialog.tsx`: та же защита (`!pending` в `onOpenChange`, `showCloseButton={!pending}`) |
| IN-01 | fixed | 23fdfda | `isIsoDate` отклоняет год меньше 1 (payments, opening balance и import получают 400 вместо 500) |
| IN-02 | fixed | 1580533 | `PUT /students/:id/opening-balance` отклоняет дату позже `latestPaymentDate` (UTC сегодня плюс день), ответ 400 `invalid_request`; хелпер экспортирован из `routes/payments.ts` |
| IN-03 | fixed | f23df61 | `suggestLessons` возвращает `null`, если результат больше `maxHundredths` (граница уже есть в `packages/core/src/lessons.ts`, core остаётся без зависимостей) |
| IN-04 | fixed | 5fb4a9f | `RATE_PATTERN` принимает `₸`, валюта строки ставки определяется через `parseCurrency` |
| IN-05 | fixed (только вкладка платежей) | 03f040f | `payments-tab.tsx`: ответ 404 при удалении трактуется как «уже удалён» (перечитывание, без ошибки). `unassigned-payments.tsx` и `vocabulary-tab.tsx` из этой находки не менялись: open |

---

_Reviewed: 2026-10-09T22:39:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
