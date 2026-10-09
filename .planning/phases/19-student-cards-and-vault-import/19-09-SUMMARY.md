---
phase: 19-student-cards-and-vault-import
plan: 09
subsystem: api
status: complete
tags: [cards, sections, terms, markdown, hono, drizzle]
requires:
  - phase: 19-07
    provides: модуль карточек, маршруты /students, помощник SCRATCH/19-api.mjs
provides:
  - cards/sections.ts (listSections, saveSection, addMissingSections)
  - cards/terms.ts (listTerms, addTerm, updateTermNote, deleteTerm, addMissingTerms)
  - маршруты секций и словаря в routes/students.ts
affects: [19-11, 19-13, 19-14, 19-17]
tech-stack:
  added: []
  patterns:
    - "upsert секции по (student_id, kind); очистка пишет пустую строку, строка не удаляется"
    - "addMissing*: insert on conflict do nothing returning, число вставленных = длина returning"
    - "правка и удаление термина — условие id = termId and student_id = id в одном запросе (IDOR)"
key-files:
  created:
    - apps/api/src/cards/sections.ts
    - apps/api/src/cards/terms.ts
  modified:
    - apps/api/src/routes/students.ts
decisions:
  - "AddTermResult — размеченное объединение added | term_exists | not_found; нарушение student_terms_term_uq распознаётся через violatesUnique из @dv-lab/db"
  - "Существование карточки проверяется одним select до записи в listSections, saveSection, listTerms и addTerm: карточки не удаляются, гонки нет"
  - "addMissingTerms вызывает onConflictDoNothing без цели: выражение lower(term) целью не указывается"
requirements-completed: [CARD-02, CARD-03]
metrics:
  duration: 20min
  completed: 2026-10-10
estimate:
  tokens: 40000
actuals:
  tokens: 4500
  tasks: 2
  commits: 2
plan_head_before: ed76b01186f8a07174a8ef3804107e024df298a1
plan_head_after: d59a66b828add340d1e8d9a9649dc87930f87254
---

# Phase 19 Plan 09: Секции markdown и словарь карточки Summary

Учитель правит шесть markdown-секций и словарь карточки через api; повтор термина без учёта регистра даёт 409, а `addMissingSections` и `addMissingTerms` дописывают только недостающее и не трогают правки учителя.

## Что сделано

- `apps/api/src/cards/sections.ts`: `listSections` (шесть элементов в порядке `SECTION_KINDS`, нет строки — `body ''` и `updatedAt null`, нет карточки — `null`), `saveSection` (upsert по `student_id` и `kind`, пустая строка сохраняется, строка не удаляется), `addMissingSections` (on conflict do nothing, возвращает число вставленных).
- `apps/api/src/cards/terms.ts`: `listTerms` (по `lower(term)`, затем `id`), `addTerm` (`added | term_exists | not_found`), `updateTermNote` и `deleteTerm` (условие `id` и `student_id`), `addMissingTerms` (on conflict do nothing без цели). Тип `AddTermResult` экспортирован.
- Маршруты в `apps/api/src/routes/students.ts` под общей цепочкой `noStore, requireSession, requireRole('teacher')`: `GET /:id/sections`, `PUT /:id/sections/:kind`, `GET /:id/terms`, `POST /:id/terms` (201; 409 `term_exists`, текст `This term is already on the card`), `PATCH /:id/terms/:termId`, `DELETE /:id/terms/:termId` (204). Неверные и чужие id, неизвестный kind — 404 `not_found`; неверное тело — 400 `invalid_request`.

## Проверка

- `yarn workspace @dv-lab/api typecheck` — код 0 после каждой задачи; `prettier --check` по файлам плана — чисто.
- Приёмка: `\.delete\(studentSections\)` в `sections.ts` нет (grep, код 1); `grep -c studentId apps/api/src/cards/terms.ts` — 14 (требовалось не меньше 4).
- `node SCRATCH/19-09-notes.mjs` (api из исходников, порт 4191, `dvlab_test`, обе части, итоговый прогон):

```
setup removed leftover probe cards: 0
setup teacher and student fixtures signed in
1.1 PASS GET sections of a new card: six sections in SECTION_KINDS order, empty body, updatedAt null, no-store (status=200 count=6)
1.2 PASS PUT general_info with a GFM table, a link and a script tag: 200, GET returns the text byte for byte, other sections stay empty (put=200 getLen=105)
1.3 PASS the text is stored as plain text in the row (rows=1)
1.4 PASS PUT general_info with an empty body: 200, the row stays (count 1) with body empty (put=200 rows=1)
1.5 PASS PUT with kind unknown: 404 (status=404)
1.6 PASS 20001 characters: 400 invalid_request; 20000 characters: 200; body without the body field: 400 (long=400 exact=200 wrong=400)
1.7 PASS random card uuid on GET and PUT, and a non-uuid id: 404, no row written (get=404 put=404 bad=404)
1.8 PASS student fixture on GET and PUT sections: 403 forbidden; no cookie: 401 (get=403 put=403 anon=401)
1.9 PASS the student PUT did not change the stored text
2.1 PASS POST term with a note: 201, id, term and note returned (status=201)
2.2 PASS POST the same term in another case: 409 term_exists with the contract text; extra spaces too; one row in the base (dup=409 spaces=409 rows=1)
2.3 PASS the same term on another card: 201 (status=201)
2.4 PASS GET terms sorted case-insensitively (apple, Banana, Make do, Zebra) (names=4)
2.5 PASS PATCH note: 200 with the new note; null clears it; 2001 characters: 400 (patch=200 clear=200 long=400)
2.6 PASS PATCH and DELETE of a term through another card path: 404, the term is unchanged (patch=404 delete=404)
2.7 PASS bad termId, unknown term, unknown card on POST and GET: 404; blank term and 201 characters: 400 (badId=404 unknown=404 card=404/404 blank=400 long=400)
2.8 PASS DELETE: 204 with no body, repeat 404, the row is gone, the other card keeps its term (delete=204 repeat=404)
2.9 PASS student fixture on GET, POST and DELETE terms: 403 forbidden; no cookie: 401 (get=403 post=403 delete=403 anon=401)
2.10 PASS addMissingTerms with three terms, one a case-insensitive duplicate: 2, repeat 0, empty list 0; the existing term is unchanged (first=2 second=0 rows=3->5)
2.11 PASS addMissingSections with two sections, one already saved by the teacher: 1, repeat 0, empty list 0; the teacher text is unchanged (first=1 second=0 rows=2)
2.12 PASS a section cleared by the teacher is not refilled by a repeated import (rerun=0)
2.13 PASS listSections of an unknown card: null
log PASS api log has no section or term text
api stopped {"code":0,"signal":null}
cleanup removed probe cards: 2
NOTES_OK parts=2
```

- Часть 1 отдельно (`19-09-notes.mjs 1`) после задачи 1: 1.1-1.9 PASS, `NOTES_OK parts=1`.
- После прогонов в `dvlab_test` карточек `Alex Example 1909%` нет, на порту 4191 слушателя нет.

## Не запускалось

- `yarn test` для `apps/api` и `packages/db`: делают TRUNCATE в `dvlab_test` и стёрли бы фикстуры параллельного плана; новых тестов план не пишет.
- Сборка api (в этой волне её не запускает ни один план), `yarn knip` (красный до 19-19 по правилу фазы), браузер (экран карточки делают 19-14 и далее).
- Показ markdown и защита от скриптов в разметке (T-19-35) — зона MarkdownView (19-06) и проверки 19-17: api хранит текст как есть.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

Нет.

## Commits

- e0f6429 feat(19-09): секции markdown карточки: GET и PUT
- d59a66b feat(19-09): словарь карточки и вставка недостающего для импорта

## Threat Flags

Нет новых поверхностей вне `<threat_model>` плана: маршруты под `requireSession` и `requireRole('teacher')`, изменяющие методы под проверкой Origin; тела секций и терминов в журнал api не попадают (проверка `log` в скрипте).

## Self-Check: PASSED

Файлы `apps/api/src/cards/sections.ts` и `apps/api/src/cards/terms.ts` на месте; коммиты e0f6429 и d59a66b есть в ветке.
