---
phase: '24'
status: passed
reviewed_at: '2026-10-11'
scope: google-authoritative-preparation
blockers: 0
majors: 0
---

# Phase 24 — независимая проверка контрактов

## Граница

Проверены изменённые контракты D-13/D-14, общая Google projection для Schedule/Today/nextLessonAt, command confirmation/recovery, сохранение истории и зависимость от 21.1. Это проверка подготовки. Реализация, runtime, Google E2E, Production и day-8 не проверены.

Risk critic проверил provider ambiguity, atomic reads, tombstone restore и revoke recovery. Design critic проверил владельцев, read/write contracts и Whole series. Devils advocate проверил единственное оставшееся замечание D2 и его исправление. Структуру всех планов, DAG и общее покрытие отдельно фиксирует `24-PLAN-CHECK.md`.

## Замечания и решения

| ID  | Вердикт            | Доказательство и принятый контракт                                                                                                                                                                        |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | SUPERSEDED         | Автоматический экспорт старого локального расписания исключён D-13. Новый риск partial Google read закрывает PLAN 05 task 1: все страницы, одна публикация revision, CAS, last-known при неудаче.         |
| R2  | CLOSED             | PLAN 08 task 2: missing tombstone требует проверки доступа и полного отсутствия active representation; новая representation generation резервируется один раз. Реальная provider-ветка остаётся E2E gate. |
| R3  | CLOSED             | PLAN 04 task 3 и PLAN 12 task 1: lost revoke response не превращает произвольный 400 в success; старые attempts остановлены до operator confirmation и нового consent.                                    |
| R4  | REFUTED            | Google timeMin фильтрует конец события. PLAN 05 task 2 дополнительно требует active timed future occurrence; уже начавшийся урок не становится next.                                                      |
| D1  | SUPERSEDED         | PLAN 10 task 1 запрещает cut legacy series без Google binding. Offline cut до первого экспорта не входит в принятый контракт.                                                                             |
| D2  | CONFIRMED + CLOSED | RESEARCH §2: CalendarSeriesContext и GoogleScheduleWindow.series. PLAN 02 task 1 задаёт wire; 05 task 1 — producer; 11 task 3 и 12 task 3 — consumers и reload/moved-reference E2E.                       |
| P1  | CLOSED             | PLAN 01 task 3 использует direct Playwright для HTTPS target и проверяет origin/build/persistence до fixture writes. Localhost wait-dev не используется для внешнего target.                              |

## Проверка исполнимости

PC-01 CLOSED: Calendar DTO сначала аддитивны; обязательные StudentRow/TodayResponse меняются атомарно с producers в06. PC-02 CLOSED: next E2E записан до поведения05 и выполняется после public wiring06. PC-04 CLOSED: foundation UI scenarios записаны12 task1 до screen behavior12 task2. P2 CLOSED: UI foundation12 предшествует conflict UI11. Native closure: 10/10 PASS; общий набор14 планов/40 задач/13 волн/86 путей. PC-05 — неблокирующее предупреждение о ширине некоторых планов; автоматическое дробление не требуется.

## D2: Whole series после reload

`CalendarSeriesContext={series:ScheduleSeries,version:string}` передаёт stored rule/timeZone и `referenceOccurrence` из принятого контракта 21.1. Общий read owner проверяет master и полный future prefix. Natural originalOn/ruleStartsAt отделены от moved actualStartsAt. Version относится ко всей серии. При missing/stale context редактирование закрыто.

Существующий durable E2E расширяется сценарием reload → Whole series с перенесённым reference occurrence. Он проверяет правило, stored zone, whole-series precondition и отказ stale context. Дополнительных source owners или тестовых suites не требуется.

Devils advocate подтвердил исправление. Оставшегося контрпримера в пределах D2 не установлено. Это не результат runtime/E2E.

## UI

Независимый UI checker: APPROVED, 0 BLOCKER, 0 MAJOR. Freshness и write capability разделены; unknown, projection_pending и partial не означают Saved. Operator confirmation не выдаётся за provider success. Privacy раскрывает cache, journal, browser identifiers и retention.

Copy C39/C41 различает активную проверку и ожидание resume. C42 не обещает сохранённую форму после reload. Визуальные dimensions 2–6 используют прежние неизменённые доказательства. Installed inventory остаётся UNKNOWN и не блокирует подготовку.

## Evidence boundary

Проверяющие читали локальные полные Google API статьи и соответствующие задачи. Исходный код не менялся. Все будущие функциональные проверки идут через public interface и настоящую persistence; mock или injected provider response не заменяет Google evidence.

Точные статические команды, актуальные fingerprints и результаты подготовки находятся в `24-PLAN-CHECK.md` и `24-PLAN-REVIEW.md`. Stop: открытых BLOCKER/MAJOR в указанной области нет; новые раунды без изменившегося входа не нужны.
