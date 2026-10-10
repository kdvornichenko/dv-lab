# Squad review — phase 20

Дата: 2026-10-10. Планы: 20-01..20-10. Критики: plan-critic, risk-critic, design-critic (code-critic не запускался: код с нуля). Devils-advocate пропущен: BLOCKER нет, MAJOR передан планировщику, который сам отклоняет неверное. Итог: REVISED.

## Surviving findings

| id | severity | verdict | суть | статус |
|----|----------|---------|------|--------|
| P1, R1 | MAJOR | принято | DR-6/7/8 открыты, задачи 3 планов 05/07/08 стоят на прекондициях | fixed: Design dude закрыл DR-6/7/8 (артефакт v23), планы переписаны |
| D1 | MAJOR | принято | нет одного владельца предиката «в прошлом / можно менять» | передано в ревизию |
| D2, D3 | MAJOR | принято | разрез серии и кодировка пустой серии собираются в api и web | передано в ревизию (core: cutSeries, endSeriesAt, emptySeriesEnd) |
| D4 | MAJOR | принято | список зон и фильтр копируются из student-form-dialog | передано в ревизию (apps/web/lib/time-zones.ts) |
| D5 | MAJOR | принято | ошибка разреза серии идёт текстом, не кодом | передано в ревизию (series_ends_before_new_day) |
| D6 | MAJOR | принято | мапперы строк БД размножатся в 20-06 | передано в ревизию (lockSeries, lockLesson в rows.ts) |
| D7, D8 | MINOR | принято | windowDates, один хелпер mutate | передано в ревизию |
| R2–R10, P2, P3 | MINOR | принято | идемпотентность, expectedStartsAt, откат, хвосты фикстур, фокус по data-slot | передано в ревизию |

## Refuted

Нет.

## Revision

Планировщик (opus), второй проход: правки по D1–D8, R2–R10, P2–P3 и ответам Design dude. Результат в отчёте планировщика.
