---
phase: 19-student-cards-and-vault-import
plan: 10
subsystem: api
status: complete
tags: [payments, cards, ledger, hono, drizzle]
requires:
  - phase: 19-04
    provides: creditedMinutes, hundredthsToDecimal, decimalToHundredths в @dv-lab/core
  - phase: 19-05
    provides: таблица payments и её CHECK (payments_currency_ck, payments_unassigned_ck, payments_credited_ck)
  - phase: 19-07
    provides: модуль карточек, остаток карточки (cardBalances), SCRATCH/19-api.mjs
provides:
  - apps/api/src/cards/payments.ts (listCardPayments, recordPayment, deletePayment, listUnassignedPayments, assignPayment, addMissingPayments)
  - маршруты /payments (paymentRoutes)
affects: [19-13, 19-16, 19-19]
tech-stack:
  added: []
  patterns:
    - "запись оплаты: карточка FOR SHARE и insert в одной транзакции, минуты считает core"
    - "назначение оплаты условным UPDATE (student_id is null или своя карточка без валюты), ноль строк — 409"
    - "вставка оплат импорта: insert on conflict do nothing по import_key, результат — число вставленных"
key-files:
  created:
    - apps/api/src/cards/payments.ts
    - apps/api/src/routes/payments.ts
  modified:
    - apps/api/src/app.ts
decisions:
  - "Валюта при назначении пишется как coalesce(payments.currency, тело): уже стоящая валюта оплаты не перезаписывается и не берётся из устаревшего чтения"
  - "Неверный uuid оплаты в DELETE и assign — 404 (как у /students/:id); неверный или пустой параметр student в GET /payments — 400"
  - "Предел даты оплаты: не позже текущей даты UTC сервера плюс один день, сравнение строк YYYY-MM-DD"
metrics:
  duration: 20min
  completed: 2026-10-10
estimate:
  tokens: 45000
actuals:
  tokens: 2200
  tasks: 2
  commits: 2
plan_head_before: b3981ceff5cef27176f7696bd40c2dce1191600b
plan_head_after: cf5d0d3337e8c211fbd3d60078b2104128bf488b
---

# Phase 19 Plan 10: Оплаты в модуле карточек и маршруты /payments Summary

Учитель через api записывает оплату карточки с зачтёнными минутами, зафиксированными на момент записи по длине урока карточки, удаляет оплаты, видит несопоставленные оплаты и назначает их карточке условным UPDATE с установкой пустой валюты; для импорта готова идемпотентная вставка оплат по import_key.

## Что сделано

- `apps/api/src/cards/payments.ts`:
  - приватное отображение `toPaymentRow` (numeric `lessons_count` → сотые через `decimalToHundredths`, валюта и источник — только из `CURRENCIES` и `PAYMENT_SOURCES`, иначе исключение; `created_at` → ISO);
  - `listCardPayments(executor, studentId)` — оплаты карточки по `paid_on desc, created_at desc, id desc`, `null`, если карточки нет;
  - `recordPayment(db, input)` — транзакция: карточка `FOR SHARE`, `creditedMinutes(сотые, default_lesson_minutes)` из core, insert с `source: 'manual'`; `{ kind: 'recorded' | 'not_found' }`;
  - `deletePayment(executor, id)` → `'deleted' | 'not_found'`;
  - `listUnassignedPayments(executor)` — `student_id is null`, тот же порядок;
  - `assignPayment(db, id, { studentId, currency, lessonsHundredths })` — транзакция: карточка `FOR SHARE` (нет → `not_found`), оплата (нет → `not_found`), уроки без итоговой валюты → `currency_required` до записи, условный UPDATE `where id = :id and (student_id is null or (student_id = карточка and currency is null))`, ноль строк → `already_assigned`;
  - `addMissingPayments(executor, rows)` — `source 'vault'`, `lessons_count null`, `credited_minutes 0`, `on conflict (import_key) do nothing`, возвращает число вставленных; пустой список — 0 без запроса.
- `apps/api/src/routes/payments.ts` (`paymentRoutes`): цепочка `noStore, requireSession, requireRole('teacher')`; `GET /payments?student=:id` (200 / 400 / 404), `POST /payments` (201 / 400 / 404), `GET /payments/unassigned` (200), `DELETE /payments/:id` (204 / 404), `POST /payments/:id/assign` (200 / 400 / 404 / 409 `payment_already_assigned` с текстом `This payment is already assigned`). Маршрутов правки оплаты (`patch`, `put`) нет.
- `apps/api/src/app.ts`: `app.route('/payments', paymentRoutes({ db: deps.db }))` рядом с `/students`.

## Проверка

- `yarn workspace @dv-lab/api typecheck` — код 0 после каждой задачи.
- Prettier `--check` по трём файлам плана — чисто.
- Приёмочные grep: `creditedMinutes(` есть, умножений `lessonsHundredths *` и `* defaultLessonMinutes` нет; `isNull(payments.studentId)` найден (строки 115, 143); `routes.patch(`/`routes.put(` в `routes/payments.ts` нет.
- Задача 1 (tracer): `node SCRATCH/19-10-payments.mjs 1` — `PAYMENTS_OK parts=1`, после коммита повторный прогон — снова `PAYMENTS_OK parts=1`.
- `node SCRATCH/19-10-payments.mjs` (api из исходников, порт 4192, `dvlab_test`), итоговый прогон обеих частей:

```
setup removed leftovers: 0 payments, 0 cards
setup teacher and student fixtures signed in
1.0 PASS probe card created (status=201)
1.1 PASS opening balance 3 lessons yesterday: 180 minutes (status=200)
1.2 PASS POST /payments today 1.5 lessons: 201, credited 90, manual, RUB, no-store (status=201 credited=90)
1.3 PASS GET /students/:id balance 270
1.4 PASS payment on the opening date: 201, credited 60, balance stays 270 (status=201 balance=270)
1.5 PASS payment without lessons: credited 0, lessons null, note null, balance 270 (status=201 balance=270)
1.6 PASS stored lessons_count '1.50' and credited_minutes 90 (lessons=1.50 credited=90)
1.7 PASS GET /payments?student= three rows, newest date first, then newest record (status=200 rows=3)
1.8 PASS date in 3 days, currency null, 2026-02-30, amount 0: 400 invalid_request (future=400 noCurrency=400 badDate=400 zero=400)
1.9 PASS unknown card on POST and GET: 404; GET without or with a bad student: 400 (post=404 random=404 missing=400 bad=400)
1.10 PASS extra fields creditedMinutes, source, importKey are ignored (status=201)
1.11 PASS mass-assignment probe removed (before=3 after=3)
1.12 PASS student on GET and POST: 403 forbidden; no cookie: 401 (get=403 post=403 anon=401)
1.13 PASS POST without Origin: 403 forbidden_origin (status=403)
2.1 PASS GET /payments/unassigned lists the vault payment without card and currency (status=200)
2.2 PASS assign with KZT and 1 lesson: 200, credited 60, gone from unassigned, on the card, balance 330 (status=200 balance=330)
2.3 PASS repeated assign: 409 payment_already_assigned (status=409)
2.4 PASS two parallel assigns of one payment to two cards: one 200, one 409 (statuses=200,409)
2.5 PASS assign with lessons and no currency: 400, payment stays unassigned (status=400)
2.6 PASS payment on the card without currency: other card 409, same card sets RUB (200) (other=409 same=200)
2.7 PASS direct insert of an unassigned payment with 60 credited minutes: 23514 (code=23514)
2.8 PASS DELETE: 204, balance back to 270; repeat and not-a-uuid: 404 (delete=204 balance=270 again=404 bad=404)
2.9 PASS addMissingPayments: 1, then 0, empty list 0; vault, no lessons, 0 credited; no duplicate key (first=1 second=0 empty=0)
2.10 PASS student on /unassigned, assign and DELETE: 403 (list=403 assign=403 delete=403)
2.11 PASS DELETE without Origin: 403 forbidden_origin; assign to an unknown card or of an unknown payment: 404 (origin=403 card=404 payment=404)
log PASS api log has no amounts or note text
api stopped {"code":0,"signal":null}
cleanup removed: 7 payments, 2 cards
PAYMENTS_OK parts=2
```

- После прогона на порту 4192 слушателя нет; пробные карточки и оплаты (`probe-1910%`) удалены.

## Не запускалось

- `yarn test` для `apps/api` и `packages/db`: TRUNCATE в `dvlab_test` стёр бы фикстуры 19-api.mjs и данные параллельных планов; новых тестов план не пишет.
- Сборка api (в волне 4 её не делает ни один план), `yarn knip` (красный до 19-19 по правилу фазы), браузер (экран оплат — 19-16).

## Deviations from Plan

None - plan executed as written. Сверх плана скрипт проверяет: сумму 0 и несуществующую дату (400), игнорирование лишних полей `creditedMinutes`, `source`, `importKey` (T-19-41), назначение оплаты чужой карточки без валюты (409), DELETE без Origin (403), неизвестные карточку и оплату в assign (404), пустой список в `addMissingPayments`.

## Known Stubs

Нет.

## Commits

- c5b07a3 feat(19-10): запись оплаты карточки, POST /payments и GET /payments
- cf5d0d3 feat(19-10): удаление, несопоставленные оплаты, назначение с валютой, addMissingPayments

## Self-Check: PASSED

Файлы `apps/api/src/cards/payments.ts`, `apps/api/src/routes/payments.ts` на месте; коммиты c5b07a3 и cf5d0d3 есть в ветке (`git rev-list --count b3981ce..cf5d0d3` — 2).

## Threat Flags

Нет новых поверхностей вне `<threat_model>` плана: все маршруты `/payments` под `requireSession` и `requireRole('teacher')`, изменяющие методы под `sameOrigin`, суммы и заметки в журнал api не попадают (проверка `log`).
