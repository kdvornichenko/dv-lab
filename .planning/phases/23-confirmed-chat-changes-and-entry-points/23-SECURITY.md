---
phase: '23'
slug: confirmed-chat-changes-and-entry-points
status: verified
threats_open: 0
threats_open_nonblocking: 2
threats_closed: 46
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
audited_head: 45c7f2a4c975121c2919800d399f5a85ef3f9b5c
created: '2026-10-14'
---

# Фаза 23 — Security

Вердикт: **SECURED**. Блокирующих угроз нет (`block_on: high`), две угрозы уровня medium открыты без блокировки: T-23-38 и T-23-46.

`asvs_level` и `block_on` в `.planning/config.json` не заданы; значения 1 и `high` взяты из `22-SECURITY.md` и `25.1-SECURITY.md`. Проверка шла глубже L1: для подтверждения, ревизий, массового переноса и инъекций прослежен путь данных до записи.

Диапазон: `80fe650..45c7f2a`, 93 коммита. Ссылки `файл:строка` даны по `45c7f2a`. В рабочем дереве есть одна незакоммиченная правка web (`apps/web/next.config.ts`), к коду фазы она не относится, см. F-12.

## Trust Boundaries

| Граница | Данные и защита |
| --- | --- |
| Браузер учителя → `/chat/actions/:id/{confirm,decline,check}` | `noStore`, `requireSession`, `requireRole('teacher')` на роутер (`routes/chat.ts:73`); `sameOrigin` на всё приложение (`app.ts:63`); тело только `{}` (`routes/chat.ts:57`, `:185`, `:196`, `:206`); действие ищется по `account_id` сессии (`chat/changes.ts:318-325`, `chat/bulk-move.ts:261-268`) |
| Браузер учителя → `PATCH /students/:id`, `/archive`, `/restore`, `PATCH`/`DELETE /payments/:id` | та же защита ролей и Origin (`routes/students.ts:120`, `routes/payments.ts:41`); ревизия в теле, CAS в владельце |
| Ответ модели → `propose_*` | zod-разбор (`tools.ts:865`), суммы и уроки только строкой, сверка с текстом сообщения учителя (`changes.ts:139-152`, `:178-180`), запись только после Confirm |
| Записи и эссе → контекст модели | текст записей идёт в `tool_result`; ход `/essay` отправляет только `essay_feedback` и отказывает остальным вызовам (`runs.ts:589-594`, `:745-748`) |
| Чат → Google | только `CalendarCommands.submitCalendarCommand` (`bulk-move.ts:414`, `calendar.ts:536`, `:820`) с `expectedVersion` и окном синхронизации |
| api → Anthropic | ход модели (как в фазе 22) и новый запрос названия разговора (`title.ts:118-188`, W-01) |
| Публичный репозиторий | документы и проверки фазы; см. T-23-46 |

## Threat Register

| Threat ID | Категория | Severity | Disposition | Статус | Evidence |
| --- | --- | --- | --- | --- | --- |
| T-23-01 | Tampering | high | mitigate | CLOSED | `tools.ts:103-110` — `amount_text`/`lessons_text` строкой, минорных единиц от модели нет; `changes.ts:139-152` — текст сообщения учителя этого хода по аккаунту; `:179-180` — сверка с текстом; `:185` `parseMoney`, `:191` `parseLessons`, `:199-208` `recordPaymentRequest`; запись только в `confirmChange` (`:421-428`). Точность сверки — F-01 |
| T-23-02 | Elevation of privilege | high | mitigate | CLOSED | `routes/chat.ts:73` — роль teacher; `app.ts:63` — Origin; `changes.ts:318-325`, `bulk-move.ts:261-268` — действие по `accountId`; `changes.ts:423`, `:434` → `routes/chat.ts:86-88` — 404 |
| T-23-03 | Repudiation / Tampering | high | mitigate | CLOSED | `changes.ts:422` — `FOR UPDATE`; `:426` — только из `proposed`; `:357-376` — оплата и смена состояния в той же транзакции; `:427` — повтор отдаёт тот же блок; массовый перенос: `bulk-move.ts:359-360`, `:382` |
| T-23-04 | Tampering | medium | mitigate | CLOSED | `changes.ts:221` — guard `cardRevision` и пояс; `:358-367` — `lockTeacherTimeContext` и сверка ревизии, иначе `stale` без записи; все писатели `students` поднимают ревизию (`cards.ts:123`, `:137-139`, `:219-224` — единственные `update(students)` в api) |
| T-23-05 | Information disclosure | medium | mitigate | CLOSED | логи чата — id, модель, состояние, счётчики (`runs.ts:388-399`, `:674-685`, `:696-706`, `:746`, `:776`; `title.ts:157-176`, `:193-198`); `request-context.ts:13-18` — ошибки запросов к базе без `query` и `params`; сверка добавленных строк диффа со списком имён учеников — 0 совпадений |
| T-23-06 | Tampering | high | mitigate | CLOSED | `cards.ts:125-126`, `:139` — CAS по `students.revision`, когда ревизия передана; `:163-170` — `setCardRate` с обязательной ревизией; `change-cards.ts:260-263` |
| T-23-07 | Tampering | high | mitigate | CLOSED | `packages/contracts/src/students.ts:172-180` — `expectedRevision` обязательна; `payments.ts:149-156` — `FOR UPDATE` и сверка; `:164-173` — `studentId` и `source` не меняются, кредит считает `creditedMinutes` из core |
| T-23-08 | Repudiation | medium | mitigate | CLOSED | `payments.ts:164-175` — правка той же строки по id, `createdAt` не трогается; блок чата остаётся историей (`messages.ts:151-169`) |
| T-23-09 | Denial of service | medium | mitigate | CLOSED | `packages/contracts/src/students.ts:122`, `:124`, `:182` — ревизия необязательна в старых запросах; `cards.ts:125-126` — без ревизии CAS не ставится |
| T-23-10 | Tampering | medium | mitigate | CLOSED | `packages/contracts/src/schedule.ts:80` — `refine(isTimeZone)`; `packages/db/src/calendar-values.ts:109`; `schedule/series.ts:50` — настройка учителя сверяется `lockTeacherTimeContext` |
| T-23-11 | Tampering | medium | mitigate | CLOSED | `calendar/journal.ts:125-127` — хеш по всему разобранному входу; `packages/contracts/src/calendar.ts:314` — строгая схема с `inputTimeZone`; `journal.ts:191` — другой хеш при том же `requestId` отклоняется |
| T-23-12 | Denial of service | low | mitigate | CLOSED | `schedule/series.ts:66-70` — `nonexistent_local_time`, команда не создаётся |
| T-23-13 | Information disclosure | medium | mitigate | CLOSED | `student-profile.tsx:250` — в адресе только UUID и `new=1`; черновик строится на клиенте (`chat-screen.tsx:221-235`) |
| T-23-14 | Tampering | low | mitigate | CLOSED | `chat/page.tsx:10`, `:22-24` — UUID и `new === '1'`; `profile-arrival.ts:36-45` — перечисления и UUID, остальное `null` |
| T-23-15 | Spoofing | low | mitigate | CLOSED | `actions.ts:421` — `validateMentions` при отправке; черновик только по `/students/options` (`routes/students.ts:122` → `listLessonStudents`, только `active`, `cards.ts:96-102`); иначе `unavailable` (`chat-screen.tsx:226`) |
| T-23-16 | Tampering | high | mitigate | CLOSED | `change-cards.ts:121-123` — имя из сообщения; `:93-98` — ставка строкой и `parseMoney`; `:130-131` — длина урока числом из текста; `:132-144` — `saveStudentRequest`; запись только после Confirm. Точность сверки — F-01 |
| T-23-17 | Tampering | high | mitigate | CLOSED | `cards.ts:163-170` — пишется только пара ставки при совпадении ревизии; `change-cards.ts:192` — без изменения `no_change` |
| T-23-18 | Elevation of privilege | medium | mitigate | CLOSED | `cards.ts:173-180` — архив меняет только `status` и `archivedAt`; `change-cards.ts:207` — аккаунт только читается для превью; инструмента деактивации нет (`tools.ts:73-145`) |
| T-23-19 | Repudiation | medium | mitigate | CLOSED | в `apps/api/src` нет `delete(students)`; `tools.ts:283`, `:660-662`, `runs.ts:118` — удаление заменяется предложением архива |
| T-23-20 | Tampering | high | mitigate | CLOSED | `student-form-dialog.tsx:275`, `:280`, `:477-482`; `record-payment-dialog.tsx:222`, `:229`, `:376-382` — ревизия при открытии, 409 сохраняет черновик и требует Reload |
| T-23-21 | Tampering | low | mitigate | CLOSED | `profile-arrival.ts:44` — только UUID; `payments-tab.tsx:127` — оплата ищется в ответе сервера по этому ученику |
| T-23-22 | Repudiation | medium | mitigate | CLOSED | как T-23-08 |
| T-23-23 | Tampering | high | mitigate | CLOSED | `change-deletions.ts:91-92` — оплата из списка названного ученика; `:101` — ревизия из превью; `:208` → `payments.ts:181-193` — удаление только при той же ревизии; запись только после Confirm |
| T-23-24 | Tampering | medium | mitigate | CLOSED | `change-deletions.ts:121-137` — комментарий живой и этого ученика; `:145` — заметка из списка ученика; `:211-215` — отзыв с ревизией, строка не удаляется |
| T-23-25 | Tampering | high | mitigate | CLOSED | `calendar.ts:251-264` — окно синхронизации при предложении; `:390-403` — `end_series` с `expectedVersion`; `:536` — только журнал команд; `packages/core/src/schedule-series.ts:194` — `lastOn` в прошлом отклоняется; `calendar.ts:547` — `applied` только при `confirmedRevision` |
| T-23-26 | Repudiation | low | mitigate | CLOSED | `calendar.ts:353-362` — Keep пишет `declined` в `chat_actions`; `:495` — confirm только из `proposed`; `changes.ts:441` — то же для `change` |
| T-23-27 | Information disclosure | low | accept | CLOSED | R-23-01; `lessons-tab.tsx:48-49` — строки только этого ученика; `routes/schedule.ts:111` — роль teacher |
| T-23-28 | Tampering | low | mitigate | CLOSED | `lessons-tab.tsx:82` — `lessonHref` из `binding.ref`; `schedule-links.ts:16-24` — Schedule разбирает ссылку сам |
| T-23-29 | Tampering | high | mitigate | CLOSED | `command-zone.ts:51-59` — без названия Вьетнам, названный пояс должен стоять в тексте учителя, неизвестный — отказ. Точность сверки — F-01 |
| T-23-30 | Tampering | high | mitigate | CLOSED | `bulk-move.ts:200-208` — цели, снимок правила и `requestId` до подтверждения; `:303` — сверка правила; `:307` — якорь отметок; `:314`, `:440` — версия, запечатанная при подтверждении. Версия при предложении не фиксируется — F-08 |
| T-23-31 | Repudiation | medium | mitigate | CLOSED | `bulk-move.ts:335-351` — состояние каждой дочерней команды, `partial`; `:437` — `applied` только после последней; `messages.ts:85-105` |
| T-23-32 | Denial of service | medium | mitigate | CLOSED | `bulk-move.ts:207` — `requestId` в действии до отправки; `:386-402`, `:489-495` — потерянный ответ находится в журнале |
| T-23-33 | Elevation of privilege | high | mitigate | CLOSED | `bulk-move.ts:414`, `calendar.ts:536`, `:820` — только `submitCalendarCommand`; из шлюза чат импортирует только тип ошибки (`calendar.ts:41`) |
| T-23-34 | Tampering | medium | mitigate | CLOSED | `schedule-links.ts:52-75` — адрес из UUID и дат блока; `packages/contracts/src/chat.ts:561` — `receipt` строго uuid; квитанцию строит сервер (`messages.ts:151-169`) |
| T-23-35 | Spoofing | medium | mitigate | CLOSED | `autoFocus` в блоках нет; фокус уходит на статус после решения (`change-proposal.tsx:463`, `bulk-move-proposal.tsx:302`); решение — явный POST (`routes/chat.ts:182-201`) |
| T-23-36 | Information disclosure | low | mitigate | CLOSED | `change-deletions.ts:51-54` — превью записи до 300 знаков; в диффе web нет `console.*` |
| T-23-37 | Tampering | high | mitigate | CLOSED | `runs.ts:589-594` — в ходе `/essay` только `essay_feedback`, флаг и `scores` с начала хода; `:745-748` — прочие вызовы отказывают; `tools.ts:855`, `:864` — после `essay_feedback` записи, предложения и `open_page` отказывают |
| T-23-38 | Repudiation | medium | mitigate | OPEN (non-blocking) | блок `essay` появляется, только если модель вызвала инструмент (`tools.ts:851-860`); `tool_choice: auto` (`provider.ts:73`), серверного запасного блока нет. См. F-03 |
| T-23-39 | Information disclosure | medium | mitigate | CLOSED | текст эссе — тело сообщения, в логи не пишется (как T-23-05); удаление разговора стирает его (`messages.ts:405-440`) |
| T-23-40 | Denial of service | medium | mitigate | CLOSED | `packages/contracts/src/chat.ts:238`, `:260` — `CHAT_MESSAGE_MAX` 20 000; `runs.ts:632-640` — оценка входа и резерв бюджета до каждой попытки |
| T-23-41 | Spoofing | low | mitigate | CLOSED | кнопки отметки на Today — соседи кнопки открытия, не потомки, и лежат над её слоем (`today-lessons.tsx:127-128`, `:143`); `LessonMarkRow` только в диалогах (`lesson-dialog.tsx:238`, `calendar-lesson-dialog.tsx:361`); проверка перекрытий `elementFromPoint` (`phone-web.mjs:389`, `:1251`) |
| T-23-42 | Information disclosure | low | mitigate | CLOSED | `scripts/dev-checks/paths.mjs:5` — скриншоты во временном каталоге; изображений в диффе нет |
| T-23-43 | Spoofing | medium | mitigate | CLOSED | `bulk-move-proposal.tsx:359-364` — «Lessons moved.» только при `applied`; состояние строит сервер из `chat_actions` (`messages.ts:85-105`) |
| T-23-44 | Repudiation | medium | mitigate | CLOSED | `essay-feedback.tsx:14` — подпись фиксированным текстом; `messages.tsx:361-376` — по блоку `essay` |
| T-23-45 | Denial of service | low | mitigate | CLOSED | `composer.tsx:164-165` — Send выключен выше лимита |
| T-23-46 | Information disclosure | medium | mitigate | OPEN (non-blocking) | AGENTS.md, README проверок, RUNBOOK и SUMMARY чистые (шаблоны `hygiene-check.mjs` — 0 файлов, имён — 0). В `.planning/phases/23-confirmed-chat-changes-and-entry-points/.continue-here.md:59` (коммит `a9a4965`) — частный адрес и порт dev-базы. См. F-05 |
| T-23-47 | Repudiation | low | mitigate | CLOSED | `23-14-SUMMARY.md:124-142` — SC закрыты выводом команд, раздел NOT RUN |
| T-23-SC | Tampering | high | mitigate | CLOSED | в диапазоне нет изменений `package.json`, `yarn.lock`, `.yarnrc.yml` |

## Открытые угрозы

### Блокирующие (severity ≥ high)

Нет.

### Неблокирующие (severity ниже high)

| Threat ID | Severity | Ожидалось | Что в коде | Где искали |
| --- | --- | --- | --- | --- |
| T-23-38 | medium | Подпись «Approximate estimate» нельзя убрать моделью | В ходе `/essay` модель может ответить, не вызвав `essay_feedback` (`tool_choice: auto`). Блока `essay` нет, web рисует обычный ответ без подписи (`messages.tsx:373`). Числа рядом со словами оценок всё равно удерживаются: `gate.scores` стоит с начала хода (`runs.ts:590-593`) | `apps/api/src/chat/runs.ts`, `tools.ts`, `provider.ts`, `apps/web/app/(app)/chat/_components/messages.tsx` |
| T-23-46 | medium | Без адресов серверов в репозитории, включая `.planning/` (AGENTS.md, «Публичный репозиторий») | `.continue-here.md:59` — частный адрес и порт dev-базы | `git grep` по `45c7f2a` |

## Accepted Risks Log

| Риск | Угроза | Severity | Обоснование |
| --- | --- | --- | --- |
| R-23-01 | T-23-27 | low | Решение плана 23-08: вкладка Lessons читает то же окно недели, что учитель видит на Schedule, и показывает только строки этого ученика (`lessons-tab.tsx:48-49`); маршрут только для роли teacher (`routes/schedule.ts:111`). |
| R-22-02 | (фаза 22) | medium | Остаётся в силе: `mark_lesson`, `add_note`, `add_comment` пишут без подтверждения. Фаза 23 прямых записей не добавила: все новые инструменты записи — `propose_*` с Confirm. |

## Unregistered Flags

| ID | Поверхность | Оценка |
| --- | --- | --- |
| W-01 | Автоназвание разговора (`title.ts:118-188`, `provider.ts:95-110`; `23-CHAT-FIXES.md`, раздел 3). Нет в моделях угроз планов | Новый запрос к провайдеру: первые 1500 знаков сообщения учителя, самая дешёвая модель, резерв бюджета до сети (`title.ts:132-140`), таймаут 30 с, `maxRetries: 0`. Ответ модели пишется в `title` мимо `publish-gate` (F-06). Попытки без `turn_id` не освобождаются при старте (F-07) |
| W-02 | Упоминания, набранные текстом (`mentions.ts:105-139`, `actions.ts:472`, `:512-513`) | Серверные привязки идут мимо `validateMentions`, но строятся только из активных карточек, неоднозначное имя не привязывается, не больше `CHAT_MENTIONS_MAX`. Могут запустить быструю отметку, как упоминание из списка. Безопасно |
| W-03 | Инструмент `student_payments` (`tools.ts:286-290`, `:505-510`; `change-deletions.ts:72-83`) | Даты, суммы, уроки и заметки оплат уходят провайдеру; не больше 30 записей и 8000 знаков. Политика конфиденциальности оплаты не называет (F-04) |
| W-04 | Нестрогие схемы 11 инструментов (`tools.ts:154-181`) | Вход по-прежнему разбирает zod (`tools.ts:865`), ошибка — `invalid_arguments`. Информационно |
| W-05 | Превью и `waiting` в списке разговоров (`conversations.ts:79-124`) | Только по `account_id`, удалённые разговоры не попадают, текст рисуется как текст. Информационно |
| W-06 | `readLessonRange` в инструменте `lessons` (`today.ts:95-113`, `tools.ts:512-554`) | Уроки всех учеников за период до 31 дня с именами; политика это называет; `fit` — 30 записей, 8000 знаков |

Флаги из SUMMARY сопоставлены с реестром: 23-04 — T-23-13..15; 23-06 — T-23-20..22; 23-08 — T-23-27, T-23-28; 23-12 — T-23-41, T-23-42. В остальных SUMMARY раздела `## Threat Flags` нет; их поверхности покрыты реестром, кроме W-01..W-06.

## Проверка по направлениям

1. **Подтверждение и отказ.** Confirm и Decline принимают только id действия и пустое тело; ревизии, суммы и цели лежат в `chat_actions.target` на сервере, подменить их из браузера нельзя. Повтор Confirm под `FOR UPDATE` возвращает тот же блок, Decline после Confirm ничего не меняет. Чужое действие — 404. После удаления разговора предложения переходят в `stale`, а Confirm даёт 404: блок ответа стёрт (`messages.ts:421-431`, `changes.ts:425`). У предложений `change` нет Undo: `originalBlock` ищет только `action_result` (`actions.ts:533-542`).
2. **Чужой ученик.** Модель приложения — один учитель, карточки не привязаны к аккаунту (как в фазах 19-22). Оплата для удаления и запись для отзыва проверяются на принадлежность названному ученику. `student_id` предложений не сверяется с упомянутыми учениками: защищает превью с именем и Confirm (F-02).
3. **Массовый перенос.** Пояс — только из текста учителя или Вьетнам по умолчанию. Цели, снимки правил и `requestId` фиксируются при предложении. Каждая дочерняя команда перед отправкой сверяет правило, якорь отметок и версию; отправка только через журнал команд. «Lessons moved.» — только когда все дочерние команды `applied`. Удаление разговора ждёт `submitted`.
4. **Prompt injection.** Ход `/essay` только читает. В обычном ходе текст записей может склонить модель к `propose_*`, но каждое предложение требует нажатия учителя, а суммы, ставки и пояс должны стоять в сообщении учителя (F-01 — точность сверки). Прямые записи без подтверждения — те же три, что в фазе 22 (R-22-02).
5. **publish-gate и cite.** Словарь учёта дополнен (фаза 22 F-01 закрыта, `publish-gate.ts:298-305`). Для эссе к нему добавляются слова оценок (`:319-325`), но «IELTS 7» или «overall 6.5» проходят (F-09). Маркер без выданного в этом ходе id удерживает предложение (`publish-gate.ts:355-372`). Блок раздела обрезается до 1200 знаков (`tools.ts:407-414`). Название разговора идёт мимо проверки (F-06).
6. **Ссылки в markdown.** В тексте ответа ссылкой рисуется только внутренний путь: `/`, но не `//` и не `/\` (`markdown-view.tsx:123-134`, фаза 22 F-02 закрыта). Ссылки блоков строит web из uuid и дат. Цитаты записей рисуются без `chat` и показывают картинки (фаза 22 F-03 остаётся, F-10).
7. **Объём данных к провайдеру.** Новое: оплаты (`student_payments`), уроки периода всех учеников, вставленный текст эссе, первые 1500 знаков сообщения для названия. Пределы: 30 записей, 8000 знаков на результат, 20 000 знаков на сообщение, оценка входа до резерва.
8. **Логи.** В новых строках логов только id, модель, состояние, коды и usage. Текста сообщений, эссе, названий и имён нет. Web ничего не пишет в консоль.
9. **Учётная запись ученика.** Все маршруты api требуют роль teacher, включая новые `PATCH /payments/:id` и `POST /chat/actions/:id/decline`. Страницы web вызывают `requireTeacherPage` или `getMe` с проверкой роли. Архив из чата не трогает аккаунт ученика; превью показывает, активен ли он. Инструмента деактивации нет.
10. **Политика конфиденциальности.** `apps/web/app/privacy/page.tsx:60` теперь называет пол, поиск по имени, уроки периода всех учеников, вставленный текст и подтверждаемые изменения (фаза 22 T-22-40 почти закрыта). Оплаты не названы (F-04).

## Находки

Блокирующих находок нет.

| ID | Severity | Место | Сценарий | Что сделать |
| --- | --- | --- | --- | --- |
| F-01 | medium | `apps/api/src/chat/changes.ts:122-125`, `:131-134`; `change-cards.ts:94`; `command-zone.ts:55` | Сверка «значение из текста учителя» — проверка подстроки. Прогон с `parseMoney` и `parseLessons` из core: в сообщении с суммой 1500 и 10 уроками проходят суммы 150, 15, 500, 50 и уроки 1 и 0; в сообщении «1,500 USD» проходит «1,5» и даёт 1.50, а сама «1,500» даёт `null`. Имя проходит префиксом, `msk` — внутри другого слова. Последний рубеж — превью и Confirm | Сравнивать по границам токена, как `hasNumber` (`changes.ts:135`): для чисел `(?<![\p{Nd}.,])…(?![\p{Nd}.,])`, для имени и пояса — границы слова |
| F-02 | low | `changes.ts:181-197`; `change-cards.ts:142`, `:187`; `bulk-move.ts:157-232` | Валюта, дата оплаты, заметка, пол, `student_id` и дни и время массового переноса берутся из аргументов модели без сверки с текстом; держит только превью и Confirm | Решение владельца: валюта только названная или валюта карточки; `student_id` — из упомянутых или найденных в этом ходе |
| F-03 | medium | `runs.ts:594`, `provider.ts:73`, `tools.ts:851-860` | T-23-38: в ходе `/essay` ответ без вызова `essay_feedback` идёт без подписи | В `complete()` хода `/essay` добавлять `{ type: 'essay', task: null }`, если блока нет; или `tool_choice: { type: 'tool', name: 'essay_feedback' }` в первом запросе хода `/essay` |
| F-04 | low | `apps/web/app/privacy/page.tsx:60`; `tools.ts:286-290`, `:505-510` | Политика перечисляет имя, пол, разделы, заметки, комментарии, уроки и остаток; оплаты (даты, суммы, заметки к оплатам) не названы | Добавить оплаты в перечень |
| F-05 | medium | `.planning/phases/23-confirmed-chat-changes-and-entry-points/.continue-here.md:59` | T-23-46: частный адрес и порт dev-базы в публичном репозитории | Убрать строку (файл — передача сессии, можно удалить целиком) |
| F-06 | low | `title.ts:178-187` | Название разговора — текст модели без `checkSentence`; проверяется только схемой `chatConversationTitle`. Источник — сообщение учителя, сумма из него может попасть в название | Пропускать название через `checkSentence` или убирать из него цифры |
| F-07 | informational | `runs.ts:885-900`; `title.ts:132-140` | Попытка названия (`turn_id` null), оборванная падением процесса, остаётся `dispatched` с резервом; `sweepInterrupted` освобождает только попытки ходов | Освобождать при старте и попытки без хода |
| F-08 | informational | `bulk-move.ts:373`, `:314`; `calendar.ts:390-401` | Версия серии запечатывается при подтверждении, а не при предложении; между ними сравнивается только правило | Хранить версию серии в цели предложения и сверять при Confirm |
| F-09 | informational | `publish-gate.ts:319-325`; `essay.ts:45-81` | В ходе эссе «IELTS 7», «overall 6.5» публикуются: рядом нет слов из `ESSAY_SCORE_WORDS` | Добавить `ielts`, `overall`, `общий` и подобные или удерживать любые числа в ходе эссе вне цитат |
| F-10 | low | `apps/web/app/(app)/chat/_components/fact-blocks.tsx:202`; `markdown-view.tsx:112-115` | Перенос фазы 22 F-03: цитата записи рисуется без `chat`, картинка с внешним адресом загружается | Цитаты рисовать без `img` |
| F-11 | informational | `runs.ts:428-431` | Перенос фазы 22 F-04: подпись шага `find_students` — запрос модели мимо `publish-gate` | Как в фазе 22 |
| F-12 | informational | `apps/web/next.config.ts` (не закоммичено) | В рабочем дереве `allowedDevOrigins` с адресом dev-туннеля | Не коммитить |

## Security Audit

| Показатель | Результат |
| --- | --- |
| Дата | 2026-10-14 |
| Проверенный HEAD | 45c7f2a4c975121c2919800d399f5a85ef3f9b5c |
| Диф | `80fe650..45c7f2a`, 93 коммита |
| Threats found | 48 (T-23-01..47, T-23-SC) |
| Closed | 46 (45 mitigate, 1 accept) |
| Open | 0 blocking, 2 non-blocking (T-23-38, T-23-46, medium) |
| Метод | gsd-security-auditor; ASVS 1 с трассировкой путей записи; чтение кода по file:line на `45c7f2a`; прогон `parseMoney`/`parseLessons` из core на синтетических строках; `hygiene-check.mjs` |
| Unregistered flags | 6 (W-01..W-06), предупреждения |

Шаблоны `scripts/hygiene-check.mjs` — 0 файлов. Сверка добавленных строк диффа со списком имён учеников (полные имена и части от 4 букв) — 0 совпадений. Ключей и паролей в диффе нет, кроме фиктивных значений проверок. `yarn test` и `yarn build` не запускались по условию. Реализация во время аудита не изменялась.

## Sign-Off

- [x] Все 48 угроз имеют disposition и evidence.
- [x] Принятые риски записаны: R-23-01; R-22-02 остаётся в силе.
- [x] threats_open: 0 (блокирующих нет); T-23-38 и T-23-46 открыты ниже порога `high`.
- [x] status: verified.

Проверено 2026-10-14.
