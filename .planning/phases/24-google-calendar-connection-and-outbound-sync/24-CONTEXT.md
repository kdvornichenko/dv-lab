# Phase 24: Google Calendar Connection and Outbound Sync — Context

**Gathered:** 2026-10-11
**Status:** Implementation active; Phase 21.1 implemented and merged

<domain>
## Phase Boundary

Google Calendar — источник событий. dv-lab читает и показывает календарь Google и помогает изменять события через серверные команды. Без рабочего подключения функции расписания заблокированы. Фаза включает первичное чтение всех страниц выбранного окна, подтверждение команд Google, состояния подключения, проверку пересечений и публичные homepage/privacy/terms.

Требования: GCAL-01, GCAL-02, GCAL-03, GCAL-09, GCAL-10. Шесть критериев находятся в `.planning/ROADMAP.md`, раздел Phase 24. Публичные страницы и Production относятся к GCAL-01 и критерию 6.

Реализация Phase 24 использует выполненную Phase 21.1 и её действующие сигнатуры зон. Исследование, UI-контракт и проверенные планы приняты.

В Phase 24 входит обычное чтение Google events для окна календаря и обновление проекции после подтверждённой команды. Вне фазы: постоянная доставка внешних изменений через watch channels/syncToken, обработка 410, matching/assign/ignore внешних событий и nightly reconciliation — Phase 25. Чат — 22–23. Выкатка и изменение OAuth Console — отдельные внешние действия.
</domain>

<decisions>
## Implementation Decisions

### Принятые границы

- **D-15 — Prelaunch target:** Владелец разрешил тестировать текущий `https://dv-lab.dev` и его базу: проект ещё не запущен и не используется. Отдельный тестовый контур отложен до полной проверки календаря и чата. Допуск к основной базе ограничен E2E с явной приватной аттестацией origin, точного SHA и persistence fingerprint до записи синтетических фикстур. Общий разовый SQL сохраняет ограничение `_dev`/`_test`. Существующие данные не сбрасываются; cleanup ограничен доказанно принадлежащими проверке фикстурами. Server guy готовит текущий runtime и OAuth и выкатывает согласованный проверенный SHA через существующий release process. Callback D-03 сохраняется. Реальный consent отдельного Google-аккаунта выполняет владелец; разрешён полный цикл синтетических событий PRIMARY и disconnect/reconnect этого grant.
- **D-01:** Google Calendar — источник истины уже в Phase 24; фазы идут 21 → 21.1 → 24 → 25 → 22 → 23 → 26. Полная ручная приёмка календаря проводится после двухсторонней синхронизации.
- **D-02:** OAuth обрабатывает API. Refresh token хранится зашифрованным; браузер, URL логов и публичные артефакты его не получают. Calendar OAuth не заменяет существующий вход в приложение.
- **D-03:** Callback уже задан как `https://dv-lab.dev/api/google/callback`. Его нельзя молча заменить. Calendar API включён; заявленные scopes — `calendar.events` и `calendar.calendarlist.readonly`. Client credentials сохранены вне репозитория. При подготовке секреты не требуются и не читаются.
- **D-04:** Приложение OAuth пока в Testing. Runtime подключения не реализован. Публикация Production и проверка через 8 дней остаются настоящими внешними критериями, а не результатами локальной имитации.
- **D-05:** У команды и Google representation есть устойчивая детерминированная identity. Один владелец очереди выполняет команды; клиент не запускает параллельные Google writes. Очередь `pg-boss` обеспечивает сериализацию и recovery. Постановка в очередь не означает сохранение урока. Подтверждённая локальная проекция меняется только после фактического результата Google.
- **D-06:** Серия представлена одним recurring event, исключения — его instances. Перенос вхождения не создаёт одновременно независимое событие и изменённый instance. Cut/end сохраняют историю; прошлые уроки не размножаются.
- **D-07:** Зона берётся из урока/серии, а не из сервера. Фаза 21.1 владеет схемой зоны, core recurrence и семантикой cut. Фаза 24 потребляет их контракт и не дублирует расчёты.
- **D-08:** Локальные уроки, серии, исключения и отметки физически не удаляются. Предложение disconnect/revocation должно явно описать судьбу токенов, очереди и Google events. Подготовка не выполняет такие действия.
- **D-09:** Homepage публично описывает продукт и ведёт на privacy/terms. Privacy отражает фактические доступ, использование, хранение и передачу Calendar data. Нельзя обещать несуществующие механизмы удаления или retention. Тексты и маршруты подготавливаются локально, без публикации и смены Branding.
- **D-10:** Существующий SettingsCalendar v40 относится сразу к 24–25. В Phase 24 нельзя показывать работающие Live updates, Last full check или Events to review до реализации соответствующего поведения Phase 25.
- **D-11:** Пользователь выбрал только основной Google Calendar: «Только основной календарь». Selector и автоматическая смена target не входят в Phase 24. После подключения UI показывает фактический основной календарь. Reconnect сохраняет прежнюю identity; другой аккаунт или календарь не подменяет её молча.
- **D-12:** Disconnect останавливает dispatch, отзывает grant и очищает действующие credentials. Локальные данные, Google events, mappings и незавершённые intents сохраняются. Ошибка revoke остаётся видимым состоянием; reconnect к прежнему календарю восстанавливает чтение и разрешает исход ранее отправленных команд. Локальные неподтверждённые изменения не считаются сохранённым расписанием.

- **D-13:** Прямое решение владельца: «без подключенного гугла календарь вообще не работает, он только отображает и помогает гуглу». Без подключённого primary Calendar запрещены новые изменения расписания. Подключение читает события Google; календарь dv-lab не является независимым источником событий. Существующая локальная история сохраняется; её наличие не запускает автоматическую публикацию старых уроков в Google.
- **D-14:** Ответ владельца: При временной недоступности Google не подтверждать сохранение до ответа Google; оставить просмотр последнего состояния. Save success требует подтверждённого Google результата. Timeout с неизвестным исходом остаётся явным pending/unknown, пока reconciliation не установит результат; его нельзя превращать в local success. Новые offline edits не принимаются.

### Инженерные решения подготовки

Исследование должно определить command journal → Google confirmation → local projection boundary, окно чтения из Google, очередь и порядок версий, restart/retry reconciliation, ID mapping серии/instance/cut, OAuth state/PKCE/session binding, envelope encryption и rotation, reconnect/refresh coordination, paginated conflict windows и E2E через реальные границы приложения. Данные до Google ack не становятся confirmed lesson/series state. Existing local IDs/marks/accounting history сохраняются; внешние события без lesson binding отображаются как события Google/busy time, автоматический matching остаётся Phase 25. Новые внешние записи, пакеты или окружение сейчас не создаются.
</decisions>

## Scope Card и карта подготовки

| Работа                                                                   | Критерий            | Артефакт / владелец                                            |
| ------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------- |
| Проверить OAuth, секреты, Testing/Production и recovery                  | GCAL-01,09; SC1,4,6 | 24-RESEARCH.md; будущие api/calendar и config                  |
| Определить Google reads, command confirmation, queue и recurring mapping | GCAL-02,03; SC2,3   | 24-RESEARCH.md, 24-ARCH-REVIEW.md; api/calendar, db            |
| Согласовать конфликтные окна и пагинацию                                 | GCAL-10; SC5        | 24-RESEARCH.md; публичный Calendar API gateway                 |
| Перенести принятый дизайн подключения и описать публичные страницы       | GCAL-01,09; SC4,6   | 24-UI-SPEC.md; web/settings, schedule, public routes           |
| Связать зависимость зоны из 21.1 и разбить исполнение                    | Все критерии        | 24-PATTERNS.md и 24-PLAN.md files после стабилизации контракта |

**Outcome:** checked executable plans для D-13/D-14. **Acceptance:** disconnected gate, Google-backed paginated view, no false save success, one representation on retry, preserved history, explicit unknown outcome. **Out of scope:** runtime/source/DB/deploy/provider writes. **A3:** marks и accounting остаются локальными; основание — запрос про Calendar и текущие владельцы cards/schedule. Опровержение — прямое расширение запроса на эти данные.

Write set подготовки: `.planning/phases/24-google-calendar-connection-and-outbound-sync/`, локальные `.planning/STATE.md`, `HANDOFF.json` и строка статуса 24 в ROADMAP этого worktree. Source, credentials, Google, база и сервер не меняются. План реализации должен назвать точные файлы, публичные сигнатуры и зависимости до исполнения.

### Допущения и зависимости

- **A1:** OAuth client и scopes уже созданы, Publishing status остаётся Testing. Основание: выполненная настройка в этой сессии и ROADMAP. Опровержение: подтверждённое изменение в Console; повторная проверка UI не нужна для текущего read-only исследования.
- **A2:** Дизайн SettingsCalendar доступен в локальной копии v40. Основание: прочитанные VERSION и README компонента. Опровержение: новая принятая версия дизайна.
- **Dependency Z:** Контракт зон и cut опубликован в 21.1-RESEARCH.md; source 21.1 ещё не реализован. Исследование OAuth/очереди/Google API можно завершить независимо; зависимые executable tasks уточняются по опубликованным сигнатурам 21.1. Нельзя объявлять эту зависимость выполненной.

### Failure modes до реализации

- Callback без сессии, неверный/replayed state, отказ consent, недостающий scope: отказ без сохранения чужого подключения или утечки секрета.
- Истёкший access token, revoked refresh token, concurrent refresh: детерминированное состояние reconnect и возобновление очереди после нового consent.
- Google принял insert, ответ потерялся; retry/restart между dispatch, provider ack и projection commit: одно событие, видимый pending/unknown, восстановление подтверждённой проекции без ложного success.
- Без подключения/при недоступном Google: новые schedule mutations отклоняются, local confirmed state не меняется, последнее известное состояние имеет явный статус.
- Две конкурирующие команды: precondition/сериализация не дают устаревшей команде перезаписать Google; success публикуется только для подтверждённого результата.
- Move/cancel/restore occurrence, cut/end marked или moved tail: история и связь с Google instances сохранены без дублей.
- Первое подключение: видны Google events, локальная история не публикуется как новый календарь; несвязанные внешние события не становятся автоматически оплачиваемыми уроками.
- Более одной страницы событий и series window: пересечения не теряются после первой страницы; собственное событие не конфликтует само с собой.
- Public pages доступны без login; приватные routes остаются закрыты; Branding links ведут на реальные опубликованные страницы.
- Реальный refresh после 8 дней в Production: отдельное от локальных проверок доказательство с датами и фактическим результатом.

Проверки подготовки: ссылки на текущие первичные документы Google/pg-boss, существующие module owners и source fingerprints, requirement-to-plan coverage и независимая проверка плана. Runtime и записи в Google сейчас не запускаются. Будущие функциональные проверки — только разрешённые durable E2E через публичный интерфейс и реальную persistence; выбор способа проверки внешнего provider фиксируется явно, без нового неразрешённого окружения.

**Stop condition подготовки:** независимые технические решения и UI-контракт готовы; все шесть критериев имеют план и способ проверки; зависимость от 21.1 обозначена точными сигнатурами либо явно оставлена незавершённой. Реализация, Production и 8-дневная приёмка не объявляются выполненными.

<canonical_refs>

## Canonical References

- `docs/google-calendar/READING.md` — обязательная точка входа для планирования Calendar API; далее читать указанные статьи в `articles/` и Discovery JSON. В PLAN сохранять ссылки на прочитанные локальные разделы рядом с решениями.
- `.planning/ROADMAP.md` — Phase 24 и текущий OAuth setup.
- `.planning/REQUIREMENTS.md` — GCAL-01/02/03/09/10 и граница с Phase 25.
- `.planning/research/CODE-AUDIT.md` — AUD-CAL-1…10; это причины переписывания старого календаря, а не описание текущего source.
- `.planning/phases/21.1-default-time-zone/21.1-CONTEXT.md` — принятые правила зон; RESEARCH и проверенные PLAN находятся в этом репозитории; план 21.1 подтверждён владельцем, source ещё не реализован.
- `AGENTS.md`, `.planning/EXECUTOR-RULES.md` — module ownership, аддитивные миграции, публичный репозиторий и E2E.
- `/Users/kdvornichenko/dv-lab-design/VERSION` и `/Users/kdvornichenko/dv-lab-design/project/components/SettingsCalendar/README.md` — дизайн v40; части Phase 25 исключены.
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) — в Testing refresh token для Calendar scopes ограничен семью днями; проверено 2026-10-11.
- [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies) — публичная homepage с описанием продукта и links на privacy/terms; проверено 2026-10-11.
- [Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) — требования к branding и раскрытию использования данных; проверено 2026-10-11.
  </canonical_refs>
