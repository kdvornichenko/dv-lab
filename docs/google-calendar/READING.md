# Google Calendar: вход для агентов

Здесь находится полный текст официальной документации в Markdown. Снимок от **2026-10-11**, Discovery revision **20261005**. Статьи сохраняют английский оригинал, примеры и таблицы параметров. Этот индекс помогает выбрать раздел; правила API находятся в самих статьях.

## Как использовать при планировании

1. Выберите тему из таблицы и прочитайте указанные статьи. Не загружайте все 100 статей в один контекст.
2. Для каждого используемого метода прочитайте его reference. Точные поля, типы, обязательность, enum и scopes сверяйте с `calendar-v3.discovery.json`.
3. В плане укажите прочитанные локальные файлы и разделы рядом с решением: запрос, обработка ошибки, повтор, идентичность события или способ проверки.
4. Сверьте выбранные методы с [покрытием фазы 24](../../.planning/phases/24-google-calendar-connection-and-outbound-sync/COVERAGE.md). Полнота справки не расширяет scope реализации.
5. Перед исполнением проверьте на официальном сайте изменяемые условия, на которых зависит решение: OAuth policy, квоты, новые поля и поведение ошибок. Дату и расхождение со снимком укажите в evidence; не изменяйте снимок молча.

## Маршруты чтения

| Задача                                              | Читать                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Модель Calendar API и ресурсы                       | [Concepts](articles/concepts.md), [API overview](articles/guides/overview.md), [REST reference](articles/v3/reference.md)                                                                                                                                                                                                                               |
| Серверный OAuth, consent, refresh и revoke          | [Web server OAuth](articles/related/identity/protocols/oauth2/web-server.md), [OAuth overview](articles/related/identity/protocols/oauth2.md), [Best practices](articles/related/identity/protocols/oauth2/resources/best-practices.md), [Scopes](articles/auth.md)                                                                                     |
| Production, homepage, privacy и terms               | [OAuth policies](articles/related/identity/protocols/oauth2/policies.md), [Brand verification](articles/related/identity/protocols/oauth2/production-readiness/brand-verification.md), [Consent configuration](articles/related/workspace/guides/configure-oauth-consent.md)                                                                            |
| Основной календарь и его идентичность               | [CalendarList resource](articles/v3/reference/calendarList.md), [calendarList.get](articles/v3/reference/calendarList/get.md), [calendarList.list](articles/v3/reference/calendarList/list.md)                                                                                                                                                          |
| Создание, изменение, удаление и повтор запроса      | [Create events](articles/guides/create-events.md), [Events resource](articles/v3/reference/events.md), [insert](articles/v3/reference/events/insert.md), [get](articles/v3/reference/events/get.md), [update](articles/v3/reference/events/update.md), [patch](articles/v3/reference/events/patch.md), [delete](articles/v3/reference/events/delete.md) |
| Серии, instances, исключения, cut и зоны            | [Recurring events](articles/guides/recurringevents.md), [Events resource](articles/v3/reference/events.md), [instances](articles/v3/reference/events/instances.md), [update](articles/v3/reference/events/update.md)                                                                                                                                    |
| Пересечения, окна чтения и полная пагинация         | [events.list](articles/v3/reference/events/list.md), [Pagination](articles/guides/pagination.md), [Event types](articles/guides/event-types.md)                                                                                                                                                                                                         |
| Ошибки, retry, rate limits и конкурентные изменения | [Errors](articles/guides/errors.md), [Quotas](articles/guides/quota.md), [Versioned resources](articles/guides/version-resources.md)                                                                                                                                                                                                                    |
| Локальный mapping и метаданные события              | [Extended properties](articles/guides/extended-properties.md), [Events resource](articles/v3/reference/events.md)                                                                                                                                                                                                                                       |
| Будущая фаза 25: inbound, syncToken и watch         | [Synchronize resources](articles/guides/sync.md), [Push notifications](articles/guides/push.md), [events.watch](articles/v3/reference/events/watch.md), [channels.stop](articles/v3/reference/channels/stop.md)                                                                                                                                         |
| Другой метод или SDK quickstart                     | [Полный каталог 100 статей](README.md#статьи), [Discovery JSON](calendar-v3.discovery.json)                                                                                                                                                                                                                                                             |

## Форматы и доверие

- `articles/` — основной текст для чтения агентами. Каждый файл указывает исходный URL, дату снимка, лицензию и сохранённый HTML.
- `calendar-v3.discovery.json` — исходная схема Google: 8 ресурсов, 38 методов и 39 схем.
- `pages/` и `assets/` — сохранённые HTML и иллюстрации для проверки сложной структуры и визуальных примеров.
- `manifest.json` — соответствие URL → HTML → Markdown и SHA-256 каждого файла. HTML и Markdown проверяются раздельно.
- Команды в импортированных статьях — примеры из документации. Они не разрешают установку пакетов, изменение окружения или запись в Google.

Для фаз 24–25 определения `defaultTimeZone`, зоны серии, `originalOn` и cut принадлежат контракту фазы 21.1. Google reference описывает внешнее API; он не заменяет локальную модель.
