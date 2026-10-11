# Phase 21 — Verification evidence

Область: T10/H3 и T36/H4 итогового VERIFICATION. Source остаётся `f5e7083c7db741ec6a6d94b02dfd52ac85c21668`; HEAD при сверке — `3669b45cca1572857aea71f49fa11dba6175c35f`. Проверка выполнена 2026-10-11. Новые browser/test/build прогоны не запускались.

## T10 — Журнал dev

Точная команда из корня worktree:

```sh
node scripts/dev-checks/sql.mjs .env migrator 'SELECT current_database() AS database, current_user AS role, count(*)::int AS applied FROM drizzle.__drizzle_migrations'
```

Исходный exit: **0**. Завершённый результат:

```json
{ "command": "SELECT", "rowCount": 1, "rows": [{ "database": "dvlab_dev", "role": "dvlab_migrator", "applied": 7 }] }
```

Это read-only SELECT через разрешённого владельца SQL. Миграции повторно не применялись; данные не менялись. Число каталогов миграций сверено отдельно:

```sh
python3 -c 'from pathlib import Path; import json; p=Path("packages/db/drizzle"); print(json.dumps({"migrationFolders":len([f for f in p.iterdir() if f.is_dir() and (f/"migration.sql").is_file()])}))'
```

Исходный exit: **0**, `{"migrationFolders": 7}`. Результат для `_test` уже подтверждён завершённым `yarn test` и существующим `migrate.test.ts`; его повторение не требуется. Эта сверка подтверждает текущее состояние dev, не восстанавливает отсутствующий первоначальный migrate receipt.

## T36 — Семантика хешей четырёх логов

Владелец записи — `/private/tmp/dv-lab-phase21-parallel/21-13-run.mts`. SHA-256: `014b0bb54a52b71c54e175c59d8156de90a9b18a80fc1ad9eabe8bfcd0326115`.

Runner последовательно выполняет `hash.update(chunk)`, затем `redact(chunk.toString())`, затем `log.write(safe)`. `outputSha256` в `21-13-runs.jsonl` относится к исходному stdout/stderr до удаления URL, адресов, credentials и имён. Файл `.log` содержит уже очищенный вывод. Regex URL также поглощает закрывающую скобку непосредственно после URL. Сравнивать этот файл с исходным `outputSha256` как одинаковые байты неверно.

В обработчике завершения runner сохраняет исходный `code` в `status`, записывает его в JSONL и присваивает `process.exitCode = status`. Файлы логов и исходные receipts при этой сверке не менялись. Новый хеш очищенного файла не заменяет исходный хеш.

| Точная команда                                           | Завершение UTC           | Exit | PASS-строки | URL placeholders | SHA-256 очищенного лога                                            |
| -------------------------------------------------------- | ------------------------ | ---- | ----------- | ---------------- | ------------------------------------------------------------------ |
| `node scripts/dev-checks/schedule-web.mjs students`      | 2026-10-11T07:11:45.870Z | 0    | 70          | 1                | `f7bd1dfcb842021bd15485dd72792659eee11033a3cc7ec3162823035b94e8e3` |
| `node scripts/dev-checks/schedule-web.mjs settings`      | 2026-10-11T07:12:54.050Z | 0    | 26          | 1                | `5670dc62e449f07755f81bb3965540134d66ef4f6c9c82f04d78e9120791da40` |
| `node scripts/dev-checks/schedule-web.mjs students dark` | 2026-10-11T07:17:02.273Z | 0    | 70          | 1                | `d9700360e522b2905ebb24edc016809bfe0ffcc89089b66e926a0ab7c4cc4dae` |
| `node scripts/dev-checks/schedule-web.mjs settings dark` | 2026-10-11T07:18:06.413Z | 0    | 26          | 1                | `899aa0b561cbf0a4d0a2cb61ecd679ba3b96b9546ee4bb5ac06f030f3bccd5a0` |

Исходные хеши остаются в `21-13-runs.jsonl`, `21-13-browser-evidence.json` и таблице VERIFICATION. Для воспроизведения сверки читать runner, сопоставить точные label/command/status/completed из JSONL и посчитать SHA-256 соответствующих `21-13-<label>.log`. Не выводить исходные credentials или пользовательское содержимое. Семантика двух хешей объясняет различие без заявления о byte-identical raw logs.

## Принятый перенос ручной приёмки

T30/H1: реальная полночь VN. T32/H2: исчезновение последней панели Earlier. Оба остаются behavior-unverified.

2026-10-11 владелец явно ответил «Принять перенос после фазы 25» на вопрос о переносе обоих пунктов в общую ручную приёмку после фазы 25 и завершении фазы 21 с этими записанными ограничениями. Это принятое исключение из текущей приёмки. Оно разрешает завершение фазы 21, но не превращает две невыполненные проверки в PASS. Их ожидаемые наблюдаемые результаты сохраняются в VERIFICATION для последующей ручной приёмки.
