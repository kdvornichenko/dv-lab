---
phase: 21-lesson-accounting-and-today
source_snapshot: 8c3cb5d8c01ed22f8512b66a155756d01c153430
review: 21-REVIEW.md
findings:
  - {
      'id': 'BE-CR-01',
      'severity': 'critical',
      'disposition': 'fixed',
      'title': 'Сохранение отметки хвоста при cut/end',
    }
  - { 'id': 'BE-CR-02', 'severity': 'critical', 'disposition': 'fixed', 'title': 'Повторный cut пустой серии' }
  - { 'id': 'BE-CR-03', 'severity': 'critical', 'disposition': 'skipped', 'title': 'Расширение диапазона week-read' }
  - { 'id': 'BE-WR-01', 'severity': 'warning', 'disposition': 'fixed', 'title': 'Cognitive complexity scheduleWindow' }
  - {
      'id': 'BE-WR-02',
      'severity': 'warning',
      'disposition': 'skipped',
      'title': 'Файловый Halstead как обязательный gate',
    }
  - { 'id': 'FE-CR-01', 'severity': 'critical', 'disposition': 'fixed', 'title': 'Ввод порога во время PATCH' }
  - {
      'id': 'FE-CR-02',
      'severity': 'critical',
      'disposition': 'fixed',
      'title': 'Обновление actions на границе времени',
    }
  - {
      'id': 'FE-CR-03',
      'severity': 'critical',
      'disposition': 'skipped',
      'title': 'Target date/key при переходе из Today',
    }
  - { 'id': 'FE-WR-01', 'severity': 'warning', 'disposition': 'fixed', 'title': 'Сложность четырёх app functions' }
  - { 'id': 'FE-WR-02', 'severity': 'warning', 'disposition': 'fixed', 'title': 'Размер week-grid' }
  - { 'id': 'FE-WR-03', 'severity': 'warning', 'disposition': 'fixed', 'title': 'Gates локальных копий Base UI' }
  - { 'id': 'FE-WR-04', 'severity': 'warning', 'disposition': 'skipped', 'title': 'Caption The mark stays' }
  - { 'id': 'FE-WR-05', 'severity': 'warning', 'disposition': 'fixed', 'title': 'Token заголовка EmptyState' }
  - { 'id': 'FE-WR-06', 'severity': 'warning', 'disposition': 'fixed', 'title': 'Exit fade строк и панели Earlier' }
  - { 'id': 'FE-WR-07', 'severity': 'warning', 'disposition': 'fixed', 'title': 'Balance в новом PaymentDialog' }
  - { 'id': 'FE-WR-08', 'severity': 'info', 'disposition': 'deferred', 'title': 'Вид moved-from ссылки' }
open: 0
total: 16
fixed: 11
skipped: 4
deferred: 1
---

# Фаза 21: disposition code review

Все 16 исходных claims сохранены. **11 fixed, 4 skipped, 1 deferred, 0 open.** Fixed: 4 critical и 7 warning. Skipped: 2 critical и 2 warning. Deferred: 1 info. Итоговые severity counts — critical 6, warning 9, info 1; исходно было 6 BLOCKER и 10 WARNING. FE-WR-08 понижен до INFO. Skipped не означает, что наблюдаемое ограничение исчезло.

`fixed` закрывает конкретный claim на основании source и достаточного scoped evidence. Он не означает полный audit, проверенную реальную полночь, последний пустой Earlier panel, 300-character rendering, manual UAT или отсутствие deep-any во внешних типах. Эти границы сохранены в [REVIEW](21-REVIEW.md#сохранённые-ограничения).

| Finding                                            | Severity | Disposition | Source                                                                                                        |
| -------------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| BE-CR-01 — Сохранение отметки хвоста при cut/end   | critical | fixed       | fbe2af0; SUMMARY18 move journey, restored Done/No-show × cut/end; journeys.log light/dark PASS                |
| BE-CR-02 — Повторный cut пустой серии              | critical | fixed       | abae816; SUMMARY18 move journey, повторный stale cut 409 без второй серии                                     |
| BE-CR-03 — Расширение диапазона week-read          | critical | skipped     | BE-refutation:17,31–37; 20-04 PLAN задаёт диапазон week-read, D-17 его не заменяет                            |
| BE-WR-01 — Cognitive complexity scheduleWindow     | warning  | fixed       | 0337da2; schedule-window-simplify.md + current core SHA; cognitive 29→18; SUMMARY13 read/changes              |
| BE-WR-02 — Файловый Halstead как обязательный gate | warning  | skipped     | BE-refutation:19,52–58; file aggregate diagnostic, accepted function unit; patch не нужен                     |
| FE-CR-01 — Ввод порога во время PATCH              | critical | fixed       | 126a529; SUMMARY18 Pays soon, delayed real PATCH / disabled / second save; final Today PASS                   |
| FE-CR-02 — Обновление actions на границе времени   | critical | fixed       | 126a529; SUMMARY18 real-clock mark/series light/dark; unchanged action comparison                             |
| FE-CR-03 — Target date/key при переходе из Today   | critical | skipped     | FE-refutation:18; 21-11 PLAN:126–128 явно принимает fallback /schedule                                        |
| FE-WR-01 — Сложность четырёх app functions         | warning  | fixed       | 91dc7ab/4e26822; current metrics; SUMMARY13 forms + SUMMARY18 corrections/keyboard                            |
| FE-WR-02 — Размер week-grid                        | warning  | fixed       | 91dc7ab; 352/180 строк, unchanged fingerprints; SUMMARY13 frame/drag/grid                                     |
| FE-WR-03 — Gates локальных копий Base UI           | warning  | fixed       | e93cf9d; 30 current files, gates below limits; SUMMARY13/18; 26 deep dependency any исключены из global claim |
| FE-WR-04 — Caption The mark stays                  | warning  | skipped     | FE-refutation:22; принятый Backlog, caption исключён из фазы; владелец фазы/дизайна                           |
| FE-WR-05 — Token заголовка EmptyState              | warning  | fixed       | 126a529; unchanged text-subtitle source; SUMMARY13 empty states; отдельный visual verdict UI owner            |
| FE-WR-06 — Exit fade строк и панели Earlier        | warning  | fixed       | 126a529/4dc57f3; final Today 80ms × light/dark × normal/reduced; last-panel boundary сохранена                |
| FE-WR-07 — Balance в новом PaymentDialog           | warning  | fixed       | 126a529; unchanged balancePhrase/rate source; SUMMARY13 today-payment, SUMMARY18 balance                      |
| FE-WR-08 — Вид moved-from ссылки                   | info     | deferred    | FE-refutation:26; 21-08 SUMMARY:76,120, принятый optional Human Action; владелец UI/дизайна                   |

## Проверка ledger

Точная команда для воспроизведения проверки metadata. Она не запускает приложение, тесты или анализаторы и ничего не записывает:

```bash
node --input-type=module <<'CHECK'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
const root = '.planning/phases/21-lesson-accounting-and-today/'
const disposition = readFileSync(root + '21-REVIEW-DISPOSITION.md', 'utf8')
const review = readFileSync(root + '21-REVIEW.md', 'utf8')
const ledger = YAML.parse(disposition.split('---')[1])
const report = YAML.parse(review.split('---')[1])
const ids = ledger.findings.map((row) => row.id)
const expected = ['BE-CR-01','BE-CR-02','BE-CR-03','BE-WR-01','BE-WR-02','FE-CR-01','FE-CR-02','FE-CR-03',...Array.from({length: 8}, (_, index) => 'FE-WR-0' + (index + 1))]
assert.deepEqual([...ids].sort(), expected.sort())
assert.equal(new Set(ids).size, 16)
for (const [key, value] of Object.entries({ fixed: 11, skipped: 4, deferred: 1, open: 0 })) {
  assert.equal(ledger.findings.filter((row) => row.disposition === key).length, value)
}
for (const [key, value] of Object.entries({ critical: 6, warning: 9, info: 1 })) {
  assert.equal(ledger.findings.filter((row) => row.severity === key).length, value)
  assert.equal(report.findings[key], value)
}
assert.equal(ledger.total, 16)
assert.equal(ledger.open, 0)
assert.deepEqual([...review.matchAll(/^### ((?:BE|FE)-(?:CR|WR)-\d+) —/gm)].map((match) => match[1]).sort(), expected)
assert.deepEqual([...disposition.matchAll(/^\| ((?:BE|FE)-(?:CR|WR)-\d+) —/gm)].map((match) => match[1]).sort(), expected)
console.log('REVIEW_DISPOSITION_OK total=16 fixed=11 skipped=4 deferred=1 open=0 critical=6 warning=9 info=1')
CHECK
```

Результат проверки: **exit 0**, `REVIEW_DISPOSITION_OK total=16 fixed=11 skipped=4 deferred=1 open=0 critical=6 warning=9 info=1`. Полные evidence, fingerprints и ограничения — в REVIEW и SUMMARY13/18. Metadata разобраны установленным YAML parser после форматирования; новых source findings и обязательных gate нет.
