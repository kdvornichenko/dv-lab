# Phase 24: Google Calendar Connection and Outbound Sync — Context

**Gathered:** 2026-10-11
**Status:** Parallel preparation; implementation depends on Phase 21.1

<domain>
## Phase Boundary

Подключение Google Calendar на сервере и надёжная исходящая запись одиночных уроков, серий и исключений. Фаза включает состояния подключения, проверку пересечений по всем страницам Google и публичные homepage/privacy/terms.

Требования: GCAL-01, GCAL-02, GCAL-03, GCAL-09, GCAL-10. Шесть критериев находятся в `.planning/ROADMAP.md`, раздел Phase 24. Публичные страницы и Production относятся к GCAL-01 и критерию 6.

Пользователь разрешил начать подготовку 24 параллельно 21.1. Сейчас выполняются только исследование, UI-контракт и планирование. Код 21.1 ещё не реализован; рабочие сигнатуры зон нельзя выдавать за существующий код.

Вне фазы: inbound sync, watch channels, syncToken, обработка 410, matching/assign/ignore внешних событий, nightly reconciliation, автоматическое разрешение конфликтов Google wins — Phase 25. Чат — 22–23. Выкатка и изменение OAuth Console — отдельные внешние действия.
</domain>

<decisions>
## Implementation Decisions

### Принятые границы

- **D-01:** Google Calendar — источник истины в завершённой интеграции; фазы идут 21 → 21.1 → 24 → 25 → 22 → 23 → 26. Полная ручная приёмка календаря проводится после двухсторонней синхронизации.
- **D-02:** OAuth обрабатывает API. Refresh token хранится зашифрованным; браузер, URL логов и публичные артефакты его не получают. Calendar OAuth не заменяет существующий вход в приложение.
- **D-03:** Callback уже задан как `https://dv-lab.dev/api/google/callback`. Его нельзя молча заменить. Calendar API включён; заявленные scopes — `calendar.events` и `calendar.calendarlist.readonly`. Client credentials сохранены вне репозитория. При подготовке секреты не требуются и не читаются.
- **D-04:** Приложение OAuth пока в Testing. Runtime подключения не реализован. Публикация Production и проверка через 8 дней остаются настоящими внешними критериями, а не результатами локальной имитации.
- **D-05:** Каждый локальный объект получает детерминированный Google event ID. Один владелец очереди пишет актуальное состояние; клиент не запускает параллельную синхронизацию. Принята очередь `pg-boss` в PostgreSQL; исследование проверяет актуальный API, точную версию и семантику сериализации до предложения установки.
- **D-06:** Серия представлена одним recurring event, исключения — его instances. Перенос вхождения не создаёт одновременно независимое событие и изменённый instance. Cut/end сохраняют историю; прошлые уроки не размножаются.
- **D-07:** Зона берётся из урока/серии, а не из сервера. Фаза 21.1 владеет схемой зоны, core recurrence и семантикой cut. Фаза 24 потребляет их контракт и не дублирует расчёты.
- **D-08:** Локальные уроки, серии, исключения и отметки физически не удаляются. Предложение disconnect/revocation должно явно описать судьбу токенов, очереди и Google events. Подготовка не выполняет такие действия.
- **D-09:** Homepage публично описывает продукт и ведёт на privacy/terms. Privacy отражает фактические доступ, использование, хранение и передачу Calendar data. Нельзя обещать несуществующие механизмы удаления или retention. Тексты и маршруты подготавливаются локально, без публикации и смены Branding.
- **D-10:** Существующий SettingsCalendar v40 относится сразу к 24–25. В Phase 24 нельзя показывать работающие Live updates, Last full check или Events to review до реализации соответствующего поведения Phase 25.

### Инженерные решения подготовки

Исследование должно определить transaction/outbox boundary, очередь и порядок версий, restart/retry reconciliation, ID mapping серии/instance/cut, OAuth state/PKCE/session binding, envelope encryption и rotation, reconnect/refresh coordination, paginated conflict windows и E2E через реальные границы приложения. Новые внешние записи, пакеты или окружение сейчас не создаются.
</decisions>

## Scope Card и карта подготовки

| Работа                                                             | Критерий            | Артефакт / владелец                                            |
| ------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------- |
| Проверить OAuth, секреты, Testing/Production и recovery            | GCAL-01,09; SC1,4,6 | 24-RESEARCH.md; будущие api/calendar и config                  |
| Определить idempotency, queue и recurring mapping                  | GCAL-02,03; SC2,3   | 24-RESEARCH.md, 24-ARCH-REVIEW.md; api/calendar, db            |
| Согласовать конфликтные окна и пагинацию                           | GCAL-10; SC5        | 24-RESEARCH.md; публичный Calendar API gateway                 |
| Перенести принятый дизайн подключения и описать публичные страницы | GCAL-01,09; SC4,6   | 24-UI-SPEC.md; web/settings, schedule, public routes           |
| Связать зависимость зоны из 21.1 и разбить исполнение              | Все критерии        | 24-PATTERNS.md и 24-PLAN.md files после стабилизации контракта |

Write set подготовки: `.planning/phases/24-google-calendar-connection-and-outbound-sync/`, локальные `.planning/STATE.md`, `HANDOFF.json` и строка статуса 24 в ROADMAP этого worktree. Source, credentials, Google, база и сервер не меняются. План реализации должен назвать точные файлы, публичные сигнатуры и зависимости до исполнения.

### Допущения и зависимости

- **A1:** OAuth client и scopes уже созданы, Publishing status остаётся Testing. Основание: выполненная настройка в этой сессии и ROADMAP. Опровержение: подтверждённое изменение в Console; повторная проверка UI не нужна для текущего read-only исследования.
- **A2:** Дизайн SettingsCalendar доступен в локальной копии v40. Основание: прочитанные VERSION и README компонента. Опровержение: новая принятая версия дизайна.
- **Dependency Z:** Source/контракт зон и cut из 21.1 ещё готовятся. Исследование OAuth/очереди/Google API можно завершить независимо; зависимые executable tasks уточняются по опубликованным сигнатурам 21.1. Нельзя объявлять эту зависимость выполненной.

### Failure modes до реализации

- Callback без сессии, неверный/replayed state, отказ consent, недостающий scope: отказ без сохранения чужого подключения или утечки секрета.
- Истёкший access token, revoked refresh token, concurrent refresh: детерминированное состояние reconnect и возобновление очереди после нового consent.
- Google принял insert, ответ потерялся; повтор; рестарт между commit и network call: одно событие, восстановимый статус.
- Две быстрые правки и запоздавший job: последнее состояние побеждает; старый job не перезаписывает новое.
- Move/cancel/restore occurrence, cut/end marked или moved tail: история и связь с Google instances сохранены без дублей.
- Более одной страницы событий и series window: пересечения не теряются после первой страницы; собственное событие не конфликтует само с собой.
- Public pages доступны без login; приватные routes остаются закрыты; Branding links ведут на реальные опубликованные страницы.
- Реальный refresh после 8 дней в Production: отдельное от локальных проверок доказательство с датами и фактическим результатом.

Проверки подготовки: ссылки на текущие первичные документы Google/pg-boss, существующие module owners и source fingerprints, requirement-to-plan coverage и независимая проверка плана. Runtime и записи в Google сейчас не запускаются. Будущие функциональные проверки — только разрешённые durable E2E через публичный интерфейс и реальную persistence; выбор способа проверки внешнего provider фиксируется явно, без нового неразрешённого окружения.

**Stop condition подготовки:** независимые технические решения и UI-контракт готовы; все шесть критериев имеют план и способ проверки; зависимость от 21.1 обозначена точными сигнатурами либо явно оставлена незавершённой. Реализация, Production и 8-дневная приёмка не объявляются выполненными.

<canonical_refs>

## Canonical References

- `.planning/ROADMAP.md` — Phase 24 и текущий OAuth setup.
- `.planning/REQUIREMENTS.md` — GCAL-01/02/03/09/10 и граница с Phase 25.
- `.planning/research/CODE-AUDIT.md` — AUD-CAL-1…10; это причины переписывания старого календаря, а не описание текущего source.
- `.planning/phases/21.1-default-time-zone/21.1-CONTEXT.md` — принятые правила зон; RESEARCH и PLAN из worktree 21.1 будут добавлены после завершения.
- `AGENTS.md`, `.planning/EXECUTOR-RULES.md` — module ownership, аддитивные миграции, публичный репозиторий и E2E.
- `/Users/kdvornichenko/dv-lab-design/VERSION` и `/Users/kdvornichenko/dv-lab-design/project/components/SettingsCalendar/README.md` — дизайн v40; части Phase 25 исключены.
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) — в Testing refresh token для Calendar scopes ограничен семью днями; проверено 2026-10-11.
- [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies) — публичная homepage с описанием продукта и links на privacy/terms; проверено 2026-10-11.
- [Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) — требования к branding и раскрытию использования данных; проверено 2026-10-11.
  </canonical_refs>
