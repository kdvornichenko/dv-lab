---
phase: 19-student-cards-and-vault-import
verified: 2026-10-10T12:00:00Z
status: human_needed
score: 6/6 критериев ROADMAP подтверждены кодом и записанными проверками
covered_files:
  - apps/api/src/cards/cards.ts
  - apps/api/src/cards/payments.ts
  - apps/api/src/import/apply-packet.ts
  - packages/core/src/lessons.ts
  - packages/db/src/schema.ts
covered_digest: "v2:sha256:afb231464f759c71d56839eb599312d0f9c92579715d0da069df333b7c6e36d1"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Выкатка релиза фазы 19 на VPS (RUNBOOK 11.1)"
    expected: "Миграция student_cards применена, web и api запущены, /students открывается у учителя"
    why_human: "Серверные команды выполняет Server guy; в фазе их никто не запускал"
  - test: "Импорт vault на сервере (RUNBOOK 11.2) после приёмки владельцем на dvlab_dev"
    expected: "25 карточек, 66 секций, 762 термина, 29 оплат (1 несопоставленная); повторный запуск вставляет 0; пакет удалён shred -u"
    why_human: "Нужны данные учеников и доступ к серверу; сервис import в Docker локально не проверялся"
  - test: "Приёмка импорта владельцем на dvlab_dev"
    expected: "Владелец просмотрел 25 карточек, ставки, остатки и оплаты и подтвердил импорт"
    why_human: "Решение владельца"
---

# Фаза 19: проверка достижения цели

**Цель:** у каждого ученика vault одна карточка в Postgres со сведениями, словарём и историей оплат; учитель ведёт карточки и записывает оплаты.
**Статус:** human_needed. Расхождений кода с целью нет (gaps: 0); остались отложенные шаги человека.

## Наблюдаемые истины (критерии ROADMAP)

| # | Критерий | Статус | Свидетельство |
|---|----------|--------|---------------|
| 1 | Карточка: создать, править, архивировать, восстановить; секции и словарь | VERIFIED | `students`, `student_sections` (6 видов, CHECK), `student_terms` (уникальность по `lower(term)`) в `packages/db/src/schema.ts` и миграции `20261009194959_student_cards`; `cards.ts` (create, update, archive, restore), `sections.ts`, `terms.ts`; web: `student-form-dialog`, `notes-tab`, `vocabulary-tab`, `markdown-view`. Браузер в обеих темах: 19-19 |
| 2 | Импорт 25 учеников, повтор без дублей, Vika | VERIFIED (на dvlab_dev) | `import_key` unique у карточек и оплат, `onConflictDoNothing`, транзакция с advisory lock (`apply-packet.ts`). Привязка только по папке (D-16). 19-19: parse 25/66/762/28+1, повторный apply вставил 0, 25 разных id; sha256 пакета совпал с 19-13 |
| 3 | Несопоставленные оплаты и назначение | VERIFIED | `payments.student_id` nullable, CHECK `payments_unassigned_ck`; `listUnassignedPayments`, `assignPayment` (транзакция, защита от повторного назначения); вкладка Unassigned в `unassigned-payments.tsx`. 19-19: назначение проверено, реальная оплата осталась несопоставленной |
| 4 | Оплата: уроки по ставке, остаток в минутах | VERIFIED | `suggestLessons` в core, предзаполнение в `record-payment-dialog`; `recordPayment` считает `credited_minutes` по длине урока карточки; остаток в минутах (`balanceMinutes`), показ `formatLessons`. Браузер: 3750 RUB даёт 2.5 урока, правка до 1.5 сохранена |
| 5 | Один аккаунт — одна карточка | VERIFIED | `accounts.student_id` (один столбец), частичный unique-индекс по активным аккаунтам, CHECK роли; коды 409 `card_has_account`, `account_already_linked`; `card-account.ts` пишет через `auth/accounts.ts`. 19-19: оба отказа получены в UI |
| 6 | Открывающий остаток | VERIFIED | `cardBalances`: учитываются оплаты с `paid_on` строго позже `opening_balance_on`; без остатка значение null и «Set opening balance»; CHECK `>= 0` (D-36). 19-19: после импорта у всех 25 карточек остаток не задан |

## Охват требований

Объединение `requirements` из планов 19-01..19-20 даёт ровно девять ID. Все они есть в REQUIREMENTS.md и закрыты: CARD-01, CARD-02, CARD-03, CARD-06, CARD-07, ACCT-04, LEDG-01, LEDG-02, LEDG-09. Осиротевших ID, привязанных к фазе 19 в REQUIREMENTS и не заявленных планами, нет. Остальные LEDG и CARD-04/05 привязаны к фазам 20, 21 и 23 и не входят в фазу.

## Сверка с решениями (D-01..D-42)

Противоречий не найдено: ключи идемпотентности (D-14, D-15), `credited_minutes` без пересчёта (D-08), деньги в минимальных единицах и список валют (D-07, D-34), 403 для ученика на всех маршрутах (D-27: `requireRole('teacher')` на `/students` и `/payments`), владельцы модулей (D-42). Принятые отклонения: у ученика нет редиректа с /students (поведение удовлетворено: страница-приземление и 403 в api); отрицательный остаток отклоняется по D-36; ответы дизайна DR-1, DR-2 внесены в UI-SPEC.

## Приватность

Имён учеников и сумм в отслеживаемых файлах нет: `*.vault-import.json` в `.gitignore` и `.dockerignore`, пакет не в git; в планах упомянут только путь к vault учителя и разрешённое имя из ROADMAP. 19-19: `PRIVACY_OK` по 326 файлам.

## Ревью и безопасность

19-REVIEW: 0 critical, 1 warning, исправления применены (коммиты fix(19) и a471942). 19-SECURITY: SECURED, 109 из 109 угроз закрыты.

## Замечания (не блокируют)

- ROADMAP: чекбокс плана 19-19 не отмечен, а в REQUIREMENTS.md статусы девяти ID остаются Pending. Это учёт, обновить при закрытии фазы.
- Контраст ошибки поля в диалоге в тёмной теме 3.94 (ниже 4.5), зафиксировано в 19-19 для дизайна.
- Тесты не добавлялись по решению владельца; проверка скриптами, SQL и браузером, записанная в 19-13 и 19-19. Я их не перезапускал (по условию задачи).
- После 409 «already linked» диалог показывает лишнюю ошибку «Choose an account.» (наблюдение 19-19).

## Что остаётся человеку

Выкатка релиза, приёмка импорта владельцем на dvlab_dev и импорт на сервере (RUNBOOK 11): см. human_verification в начале файла.

_Проверил: Claude (gsd-verifier)_
