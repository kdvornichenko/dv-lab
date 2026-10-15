# Карточки: ученики, оплаты, ревизии, заметки, словарь, леджер, импорт vault

## Модуль карточек

- Модуль карточек `apps/api/src/cards` владеет записью и чтением карточки, секций, словаря и оплат, аккаунтом карточки (`card-account.ts`). Для остатка он загружает сырые оплаты; отбор оплат и вычеты принадлежат `packages/core`. Из `auth/` он импортирует только `accounts.ts`, маршруты карточек и оплат — ещё `middleware.ts`.
- Маршруты карточек: `/students` — карточки, `/students/:id/account*` — аккаунт карточки, `/payments` — оплаты. `StudentRow` — строка карточки, `StudentAccount` — аккаунт ученика.
- `students.no_show_deducts` имеет `DEFAULT true`; PATCH карточки без `noShowDeducts` колонку не трогает.
- Производные факты карточки (остаток и `nextLessonAt`) считает `apps/api/src/cards/card-facts.ts`. Это единственная точка остатка для списка, профиля и Today: в `studentBalance` идут карточка через `toBalanceCard`, сырые оплаты и отметки из `loadMarkRows` (`schedule.md`). `schedule` не импортирует `cards`.

## Ревизии и оплаты

- Ревизии `students.revision` и `payments.revision`: каждый писатель карточки (`writeCard` в `cards.ts` для правки, архива и восстановления, `setOpeningBalance`, `setCardRate`, `setCardDetails`) и оплаты (`updatePayment`, `deletePayment`, `assignPayment` в `payments.ts`) увеличивает ревизию на 1 и сверяет `expectedRevision`, когда она передана; расхождение — `409 precondition_failed`. У `setCardRate` (узкая правка ставки), `setCardDetails` (правка полей карточки из чата) и `PATCH /payments/:id` ревизия обязательна.
- Ревизия есть у `StudentDetail` и `PaymentRow`, у `StudentRow` списка её нет.
- Вставка оплаты для формы и чата — только `insertPayment`; исправление оплаты — `PATCH /payments/:id` той же строки (`updatePayment`: id, `source`, ученик и `createdAt` прежние, кредит пересчитывается от текущей длины урока только при смене числа уроков, иначе остаётся сохранённый).

## Заметки и словарь

- Заметки карточки — блоки `apps/api/src/cards/blocks.ts` (текст, имя, порядок, мягкое удаление `deleted_at`, ревизия блока; маршруты `/students/:id/blocks*`). Блок заметок несёт свою ревизию: каждая запись блока в `cards/blocks.ts` сверяет `expectedRevision`.
- Таблица блоков — `student_sections`: id, ключ (`kind` стандартного блока или `b_…` своего), имя, позиция, ревизия и `deleted_at`.
- Чат пишет блоки через `chat/note-writes.ts` и `chat/change-notes.ts`, ревизию ведёт `chat/review.ts` (`chat.md`), дату ревизии хранит `cards/note-reviews.ts`, строки «было → стало» считает `cards/note-diff.ts`.
- `cards/notes.ts` держит только старые записи `student_notes` (`listStudentNotes`, `retractStudentNote`, `restoreStudentNote`): строки не удаляются, отзыв по ревизии, новых записей чат не создаёт.
- Словарь — `cards/terms.ts` (удалённые слова в Removed 30 дней, затем очистка в housekeeping).
- Последние комментарии карточки — `GET /students/:id/comments`.

## Леджер и уроки ученика

- Леджер ученика — `studentLedger` в `packages/core/src/balance.ts` (хронологический проход, покрывающая оплата, остаток после урока, граница «с последней оплаты»); его единственная загрузка в api — `apps/api/src/cards/ledger.ts`.
- Уроки ученика за период (`GET /students/:id/lessons`) — `cards/lessons-range.ts`.
- Сравнение названий и имён — `packages/core/src/text-match.ts`.

## Импорт vault

- Импорт vault — `apps/api/src/import-vault.ts`. `parse` выполняет владелец над каталогом vault (`apps/api/src/import/parse-vault.ts`), пакет по схеме `apps/api/src/import/packet.ts` уходит в stdout. `apply` читает пакет из stdin и пишет его одной транзакцией только через модуль карточек (`apps/api/src/import/apply-packet.ts`) под ролью приложения. На сервере `apply` запускает одноразовый сервис `import` профиля `tools` в `deploy/compose.yaml` (`deploy/RUNBOOK.md`, раздел 11).
- Пакет импорта содержит данные учеников и лежит вне репозитория: маска `*.vault-import.json` закрыта в `.gitignore` и `.dockerignore`, в образ и логи пакет не попадает. `apply` печатает только счётчики.

## Приёмка

`scripts/dev-checks/`: api — `notes-blocks.mjs`, разделы `ledger-api.mjs ledger|lessons`; браузер — `notes-web.mjs`, раздел `ledger-web.mjs profile`, раздел `entry-web.mjs lessons` поверх `GET /students/:id/lessons`.
