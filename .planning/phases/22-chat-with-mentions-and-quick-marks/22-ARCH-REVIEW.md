# Архитектурный осмотр — Phase 22

**Дата:** 2026-10-12. **Источник:** GSD arch-scan, отдельный read-only explorer. Source pin: `913fc5a`.

## Scope Card

Результат — закрыть реальные seams, на которых implementation22 строит SC1/SC3/SC4 и F02/F05/F06/F09. Write set — только этот отчёт. Проверены transport, section/entry и mark owners с ближайшими callers. Provider choice, UI defaults, pricing, Google inverse и общий Finance audit исключены. Source/runtime/tests/Git/DB/env/deps эта работа не меняет. Три Strong finding приняты технически в эту фазу; planner проектирует точные интерфейсы. Stop — каждый finding назначен одному owner и public proof path.

## Находки

### A1 — Общий API transport должен поддержать durable stream

`apps/web/lib/api-client.ts:8,24` владеет prefix/cookies/no-store/network/error envelope, но `apiRequest` читает успешный response через JSON. SSE нельзя передать этому interface без расширения. `calendar-command-transport.ts:35` валидирует DTO у caller; `session.ts` — отдельный server reader, не browser transport.

Нужен streaming seam в существующем API transport owner: abort/cursor/event parsing и validation. Новый Chat store не копирует prefix, cookie или error policy. `calendar-command-provider.tsx:96` уже регистрирует reload для Today/Schedule; подтверждённый chat change использует этот путь с server reread/stale guards, а не только router.refresh.

Deletion test: без общего owner политика повторяется у Chat/Calendar callers. Dependencies: web→API ports/adapters; reload — in-process. Relation: extends transport, reads reload owners. Strength: **Strong**. Proof: E09/E03 — interrupted/reloaded stream, expired session, lost notification, no repeated effect. Existing Calendar/Today journeys остаются владельцами shared effects.

### A2 — Полная Markdown-секция не является append entry

`apps/api/src/cards/sections.ts:32` заменяет полный body через `saveSection`; `packages/db/src/schema.ts:137` идентифицирует секцию как student/kind. `notes-tab.tsx:104` копирует section body в draft и PUT body. Identity отдельной записи отсутствует.

Контрпример: chat добавляет A, обычный editor сохраняет S′, затем добавляется B. Snapshot rollback уничтожает S′/B; поиск одинакового текста не определяет запись A. Принятый P5 требует entry identity/version у существующего business owner. Обычный section editor сохраняет базовую секцию; отображённые append entries не должны повторно сохраняться как её Markdown. Undo адресует собственный entry, сохраняет отдельный B и отказывает после изменения A. Section revision сама не создаёт entry identity.

Deletion test: без business owner callers копируют текстовый поиск/rollback/conflict rules. Dependencies: real local persistence/DbExecutor; mock adapter не обоснован. Relation: extends cards/schedule writes and ordinary reads. Strength: **Strong**. Proof: E07 — A/B/Undo A, ordinary section edit, одинаковый текст двух entries, same-entry edit refusal.

### A3 — Mark history требует версии для Undo

`schedule/marks.ts:45,78` открывает собственные transactions и пишет kind/updatedAt; `rows.ts:286` читает только kind. В `schema.ts:293` нет revision. Done→no-show→done возвращает прежнее kind, но не прежнюю историю. Timestamp не доказывает уникальную последовательность; same-time HTTP reproduction не заявлен.

Нужен row revision у того же mark owner и executor-based write для общей effect+receipt transaction. Участвуют обычные writers и перенос отметок при cut/end в `series.ts:50`; revision связывается с target identity. Старый receipt не переносится по совпадению kind. Сохраняются eligibility/temporal/history guards. Calendar snapshot revision не заменяет mark revision. Вторые revision tables или epoch cache не обоснованы.

Deletion test: без общего writer Chat/ordinary callers повторяют eligibility, locking/CAS/Undo. Dependencies: local persistence; proof через public API и настоящий Postgres. Relation: extends marks writer, reads history eligibility. Strength: **Strong**. Proof: existing marks journey + E06 — ABA, повтор того же kind, stale Undo после смены target identity.

## Решения

| ID  | Решение     | Причина                                                            | Модуль-владелец                                          |
| --- | ----------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| A1  | В этой фазе | SC1 stream и SC3 invalidation не дублируют transport/reload policy | Web API transport + existing data refresh registration   |
| A2  | В этой фазе | SC3 требует конкретный entry и сохранение чужих edits              | Cards/schedule business entries + ordinary section owner |
| A3  | В этой фазе | SC3 Undo не может принять ABA как unchanged                        | Schedule marks + участвующий cut/end writer              |

Нет deferred/rejected findings и новой записи в broken-windows ledger. `cardFacts:50` и `readToday:39` уже владеют фактами и I/O; P6 читает их результаты и чистый core. Новый Chat не копирует payment/mark selection, history filtering или арифметику. Валидация числового текста до публикации уже закреплена AI-SPEC; отсутствующий Chat source не является finding.

## Для планировщика

Дать каждому A1–A3 producer task и точный owned interface до dependent chat caller. Учесть необходимые regular editor/mark/cut callers в planned write set. Не добавлять новую domain/UI engine или isolated test layer. При final24/25 rebind проверить фактический cut writer, сохранив mark identity/revision semantics.

## Проверки и границы

Explorer: `git rev-parse --short HEAD` → `913fc5a`; `git ls-files` подтвердил source anchors; scoped diff transport/sections/marks/schema пуст. Файлы explorer не менял. Source/runtime/E2E/quality не запускались. Текущий отчёт — source-backed design input, не readiness/runtime PASS.
