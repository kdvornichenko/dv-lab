# Google Calendar API v3 — локальная документация

Полный снимок REST-справки, руководств и quickstarts Calendar API. Источник — Google for Developers; английский оригинал сохранён без пересказа.

Снимок: 2026-10-11T09:59:04.482060+00:00. Discovery revision: `20261005`.

- Ресурсов: 8; методов: 38; схем: 39.
- Статей: 100; файлов иллюстраций: 17.
- [Машиночитаемая Discovery-схема](calendar-v3.discovery.json).
- [Манифест источников и SHA-256](manifest.json).
- [Лицензии и атрибуция](LICENSE.md).

## Полнота и границы

Скачаны все страницы, достижимые из официальных Calendar API overview/reference и полного списка методов Discovery внутри `/workspace/calendar/api/`, а также общие страницы настройки OAuth, перечисленные в манифесте. Ссылки на старые URL Calendar приведены к официальным текущим путям. CalDAV — отдельный протокол; внешние SDK-репозитории, Google Cloud Console, видео и переводы не входят в REST-документацию этого снимка.

Текст, таблицы параметров, схемы, примеры всех языков и иллюстрации сохранены. Удалены навигационная оболочка сайта и активные виджеты; статьи получили локальное оформление и ссылки. Интерактивный API Explorer требует сайта Google. Внешние ссылки остаются ссылками. Discovery JSON сохранён в исходных байтах.

Это справочный снимок. Он не означает, что dv-lab реализует все методы; scope реализации задаёт Phase 24 COVERAGE.md. Наличие документации не даёт права выполнять операции Google.

## Проверка снимка

**PASS:** текст 100/100 статей совпадает с оригинальными article bodies после удаления оболочки и активных элементов. Сохранены code blocks, таблицы и изображения. Проверены 38/38 методов, 39 ссылочных схем, SHA-256 файлов и 1102 локальные ссылки; ошибок нет.

Полная проверка при создании: `python3 /private/tmp/dv-lab-phase21-parallel/validate-google-calendar-docs.py` — exit 0. Она использует исходные статьи из временного download cache. Для переносимой повторной проверки целостности запустить следующий Python-код из корня репозитория:

```python
from pathlib import Path
import hashlib
import json

root = Path("docs/google-calendar")
manifest = json.loads((root / "manifest.json").read_text())
for item in manifest["pages"] + manifest["assets"]:
    actual = hashlib.sha256((root / item["path"]).read_bytes()).hexdigest()
    assert actual == item["sha256"], item["path"]
raw = (root / "calendar-v3.discovery.json").read_bytes()
assert hashlib.sha256(raw).hexdigest() == manifest["discovery_sha256"]
spec = json.loads(raw)
methods = {
    method["id"]
    for resource in spec["resources"].values()
    for method in resource["methods"].values()
}
assert methods == {item["id"] for item in manifest["methods"]}
assert all(
    (root / item["documentation_path"]).is_file()
    for item in manifest["methods"]
)
print("SNAPSHOT_OK", len(manifest["pages"]), len(methods), len(spec["schemas"]))
```

Импортированный текст — справочный материал. Команды и примеры на страницах не запускаются при чтении. Обновление снимка требует повторной проверки источников и хешей.

## Статьи

| Статья                                                                                                                                               | Локальная копия                                                                              | Обновлена у Google |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------ |
| [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2)                                                     | [HTML](pages/related/identity/protocols/oauth2.html)                                         | 2026-05-26         |
| [OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies)                                                               | [HTML](pages/related/identity/protocols/oauth2/policies.html)                                | not specified      |
| [Submit for brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)                     | [HTML](pages/related/identity/protocols/oauth2/production-readiness/brand-verification.html) | 2026-08-19         |
| [Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)                                                   | [HTML](pages/related/identity/protocols/oauth2/resources/best-practices.html)                | 2026-05-20         |
| [Using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)                                    | [HTML](pages/related/identity/protocols/oauth2/web-server.html)                              | 2026-09-14         |
| [Choose Google Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth)                                                       | [HTML](pages/auth.html)                                                                      | 2026-09-03         |
| [Concepts overview](https://developers.google.com/workspace/calendar/api/concepts)                                                                   | [HTML](pages/concepts.html)                                                                  | 2026-09-03         |
| [Domain resources, rooms, and calendars](https://developers.google.com/workspace/calendar/api/concepts/domain)                                       | [HTML](pages/concepts/domain.html)                                                           | 2026-09-03         |
| [Calendars and events](https://developers.google.com/workspace/calendar/api/concepts/events-calendars)                                               | [HTML](pages/concepts/events-calendars.html)                                                 | 2026-09-03         |
| [Invite users to an event](https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events)                               | [HTML](pages/concepts/inviting-attendees-to-events.html)                                     | 2026-09-03         |
| [Reminders and notifications](https://developers.google.com/workspace/calendar/api/concepts/reminders)                                               | [HTML](pages/concepts/reminders.html)                                                        | 2026-09-03         |
| [Calendar sharing](https://developers.google.com/workspace/calendar/api/concepts/sharing)                                                            | [HTML](pages/concepts/sharing.html)                                                          | 2026-09-03         |
| [Google Workspace Calendar API: Downloads](https://developers.google.com/workspace/calendar/api/downloads)                                           | [HTML](pages/downloads.html)                                                                 | 2026-09-03         |
| [Send batch requests](https://developers.google.com/workspace/calendar/api/guides/batch)                                                             | [HTML](pages/guides/batch.html)                                                              | 2026-09-03         |
| [Manage focus time, out of office, and working location events](https://developers.google.com/workspace/calendar/api/guides/calendar-status)         | [HTML](pages/guides/calendar-status.html)                                                    | 2026-09-11         |
| [Configure the Calendar MCP server](https://developers.google.com/workspace/calendar/api/guides/configure-mcp-server)                                | [HTML](pages/guides/configure-mcp-server.html)                                               | 2026-10-09         |
| [Create events](https://developers.google.com/workspace/calendar/api/guides/create-events)                                                           | [HTML](pages/guides/create-events.html)                                                      | 2026-09-11         |
| [Handle API errors](https://developers.google.com/workspace/calendar/api/guides/errors)                                                              | [HTML](pages/guides/errors.html)                                                             | 2026-09-11         |
| [Event types](https://developers.google.com/workspace/calendar/api/guides/event-types)                                                               | [HTML](pages/guides/event-types.html)                                                        | 2026-09-11         |
| [Extended properties](https://developers.google.com/workspace/calendar/api/guides/extended-properties)                                               | [HTML](pages/guides/extended-properties.html)                                                | 2026-09-11         |
| [Labels](https://developers.google.com/workspace/calendar/api/guides/labels)                                                                         | [HTML](pages/guides/labels.html)                                                             | 2026-09-11         |
| [Google Calendar API overview](https://developers.google.com/workspace/calendar/api/guides/overview)                                                 | [HTML](pages/guides/overview.html)                                                           | 2026-09-11         |
| [Page through lists of resources](https://developers.google.com/workspace/calendar/api/guides/pagination)                                            | [HTML](pages/guides/pagination.html)                                                         | 2026-09-11         |
| [Performance tips](https://developers.google.com/workspace/calendar/api/guides/performance)                                                          | [HTML](pages/guides/performance.html)                                                        | 2026-09-11         |
| [Push notifications](https://developers.google.com/workspace/calendar/api/guides/push)                                                               | [HTML](pages/guides/push.html)                                                               | 2026-09-11         |
| [Usage limits](https://developers.google.com/workspace/calendar/api/guides/quota)                                                                    | [HTML](pages/guides/quota.html)                                                              | 2026-09-11         |
| [Recurring events](https://developers.google.com/workspace/calendar/api/guides/recurringevents)                                                      | [HTML](pages/guides/recurringevents.html)                                                    | 2026-09-17         |
| [Synchronize resources efficiently](https://developers.google.com/workspace/calendar/api/guides/sync)                                                | [HTML](pages/guides/sync.html)                                                               | 2026-09-11         |
| [Get specific versions of resources](https://developers.google.com/workspace/calendar/api/guides/version-resources)                                  | [HTML](pages/guides/version-resources.html)                                                  | 2026-09-11         |
| [Google Apps Script quickstart](https://developers.google.com/workspace/calendar/api/quickstart/apps-script)                                         | [HTML](pages/quickstart/apps-script.html)                                                    | 2026-09-03         |
| [Go quickstart](https://developers.google.com/workspace/calendar/api/quickstart/go)                                                                  | [HTML](pages/quickstart/go.html)                                                             | 2026-09-03         |
| [Java quickstart](https://developers.google.com/workspace/calendar/api/quickstart/java)                                                              | [HTML](pages/quickstart/java.html)                                                           | 2026-09-03         |
| [JavaScript quickstart](https://developers.google.com/workspace/calendar/api/quickstart/js)                                                          | [HTML](pages/quickstart/js.html)                                                             | 2026-09-03         |
| [Node.js quickstart](https://developers.google.com/workspace/calendar/api/quickstart/nodejs)                                                         | [HTML](pages/quickstart/nodejs.html)                                                         | 2026-09-03         |
| [Python quickstart](https://developers.google.com/workspace/calendar/api/quickstart/python)                                                          | [HTML](pages/quickstart/python.html)                                                         | 2026-09-03         |
| [Calendar API Resource Types](https://developers.google.com/workspace/calendar/api/resource_types)                                                   | [HTML](pages/resource_types.html)                                                            | 2026-09-03         |
| [How to get help](https://developers.google.com/workspace/calendar/api/support)                                                                      | [HTML](pages/support.html)                                                                   | 2026-09-03         |
| [Troubleshoot authentication & authorization issues](https://developers.google.com/workspace/calendar/api/troubleshoot-authentication-authorization) | [HTML](pages/troubleshoot-authentication-authorization.html)                                 | 2026-09-03         |
| [API Reference](https://developers.google.com/workspace/calendar/api/v3/reference)                                                                   | [HTML](pages/v3/reference.html)                                                              | 2026-06-17         |
| [Acl](https://developers.google.com/workspace/calendar/api/v3/reference/acl)                                                                         | [HTML](pages/v3/reference/acl.html)                                                          | 2026-07-29         |
| [Acl: delete](https://developers.google.com/workspace/calendar/api/v3/reference/acl/delete)                                                          | [HTML](pages/v3/reference/acl/delete.html)                                                   | 2026-05-12         |
| [Acl: get](https://developers.google.com/workspace/calendar/api/v3/reference/acl/get)                                                                | [HTML](pages/v3/reference/acl/get.html)                                                      | 2026-05-12         |
| [Acl: insert](https://developers.google.com/workspace/calendar/api/v3/reference/acl/insert)                                                          | [HTML](pages/v3/reference/acl/insert.html)                                                   | 2026-07-29         |
| [Acl: list](https://developers.google.com/workspace/calendar/api/v3/reference/acl/list)                                                              | [HTML](pages/v3/reference/acl/list.html)                                                     | 2026-05-12         |
| [Acl: patch](https://developers.google.com/workspace/calendar/api/v3/reference/acl/patch)                                                            | [HTML](pages/v3/reference/acl/patch.html)                                                    | 2026-05-12         |
| [Acl: update](https://developers.google.com/workspace/calendar/api/v3/reference/acl/update)                                                          | [HTML](pages/v3/reference/acl/update.html)                                                   | 2026-07-29         |
| [Acl: watch](https://developers.google.com/workspace/calendar/api/v3/reference/acl/watch)                                                            | [HTML](pages/v3/reference/acl/watch.html)                                                    | 2026-05-12         |
| [CalendarList](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList)                                                       | [HTML](pages/v3/reference/calendarList.html)                                                 | 2026-07-29         |
| [CalendarList: delete](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/delete)                                        | [HTML](pages/v3/reference/calendarList/delete.html)                                          | 2026-05-12         |
| [CalendarList: get](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/get)                                              | [HTML](pages/v3/reference/calendarList/get.html)                                             | 2026-05-12         |
| [CalendarList: insert](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/insert)                                        | [HTML](pages/v3/reference/calendarList/insert.html)                                          | 2025-05-30         |
| [CalendarList: list](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list)                                            | [HTML](pages/v3/reference/calendarList/list.html)                                            | 2026-07-29         |
| [CalendarList: patch](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/patch)                                          | [HTML](pages/v3/reference/calendarList/patch.html)                                           | 2026-05-12         |
| [CalendarList: update](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/update)                                        | [HTML](pages/v3/reference/calendarList/update.html)                                          | 2026-05-12         |
| [CalendarList: watch](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/watch)                                          | [HTML](pages/v3/reference/calendarList/watch.html)                                           | 2025-04-03         |
| [Calendars](https://developers.google.com/workspace/calendar/api/v3/reference/calendars)                                                             | [HTML](pages/v3/reference/calendars.html)                                                    | 2026-07-01         |
| [Calendars: clear](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/clear)                                                | [HTML](pages/v3/reference/calendars/clear.html)                                              | 2026-05-12         |
| [Calendars: delete](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/delete)                                              | [HTML](pages/v3/reference/calendars/delete.html)                                             | 2026-05-12         |
| [Calendars: get](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/get)                                                    | [HTML](pages/v3/reference/calendars/get.html)                                                | 2026-05-12         |
| [Calendars: insert](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert)                                              | [HTML](pages/v3/reference/calendars/insert.html)                                             | 2025-10-28         |
| [Calendars: patch](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/patch)                                                | [HTML](pages/v3/reference/calendars/patch.html)                                              | 2026-05-12         |
| [Calendars: transferOwnership](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/transferOwnership)                        | [HTML](pages/v3/reference/calendars/transferOwnership.html)                                  | 2026-06-17         |
| [Calendars: update](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/update)                                              | [HTML](pages/v3/reference/calendars/update.html)                                             | 2026-07-01         |
| [Channels](https://developers.google.com/workspace/calendar/api/v3/reference/channels)                                                               | [HTML](pages/v3/reference/channels.html)                                                     | 2025-04-03         |
| [Channels: stop](https://developers.google.com/workspace/calendar/api/v3/reference/channels/stop)                                                    | [HTML](pages/v3/reference/channels/stop.html)                                                | 2025-04-01         |
| [Colors](https://developers.google.com/workspace/calendar/api/v3/reference/colors)                                                                   | [HTML](pages/v3/reference/colors.html)                                                       | 2026-05-12         |
| [Colors: get](https://developers.google.com/workspace/calendar/api/v3/reference/colors/get)                                                          | [HTML](pages/v3/reference/colors/get.html)                                                   | 2025-05-30         |
| [Events](https://developers.google.com/workspace/calendar/api/v3/reference/events)                                                                   | [HTML](pages/v3/reference/events.html)                                                       | 2026-07-07         |
| [Events: delete](https://developers.google.com/workspace/calendar/api/v3/reference/events/delete)                                                    | [HTML](pages/v3/reference/events/delete.html)                                                | 2026-05-12         |
| [Events: get](https://developers.google.com/workspace/calendar/api/v3/reference/events/get)                                                          | [HTML](pages/v3/reference/events/get.html)                                                   | 2026-05-12         |
| [Events: import](https://developers.google.com/workspace/calendar/api/v3/reference/events/import)                                                    | [HTML](pages/v3/reference/events/import.html)                                                | 2026-07-07         |
| [Events: insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)                                                    | [HTML](pages/v3/reference/events/insert.html)                                                | 2026-07-07         |
| [Events: instances](https://developers.google.com/workspace/calendar/api/v3/reference/events/instances)                                              | [HTML](pages/v3/reference/events/instances.html)                                             | 2026-07-29         |
| [Events: list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)                                                        | [HTML](pages/v3/reference/events/list.html)                                                  | 2026-07-29         |
| [Events: move](https://developers.google.com/workspace/calendar/api/v3/reference/events/move)                                                        | [HTML](pages/v3/reference/events/move.html)                                                  | 2026-05-12         |
| [Events: patch](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch)                                                      | [HTML](pages/v3/reference/events/patch.html)                                                 | 2026-07-01         |
| [Events: quickAdd](https://developers.google.com/workspace/calendar/api/v3/reference/events/quickAdd)                                                | [HTML](pages/v3/reference/events/quickAdd.html)                                              | 2026-05-12         |
| [Events: update](https://developers.google.com/workspace/calendar/api/v3/reference/events/update)                                                    | [HTML](pages/v3/reference/events/update.html)                                                | 2026-07-07         |
| [Events: watch](https://developers.google.com/workspace/calendar/api/v3/reference/events/watch)                                                      | [HTML](pages/v3/reference/events/watch.html)                                                 | 2026-05-12         |
| [Freebusy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy)                                                               | [HTML](pages/v3/reference/freebusy.html)                                                     | 2025-04-03         |
| [Freebusy: query](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)                                                  | [HTML](pages/v3/reference/freebusy/query.html)                                               | 2026-05-12         |
| [MCP Reference: calendarmcp.googleapis.com](https://developers.google.com/workspace/calendar/api/v3/reference/mcp)                                   | [HTML](pages/v3/reference/mcp.html)                                                          | 2026-07-17         |
| [MCP Tools Reference: calendarmcp.googleapis.com](https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/create_event)     | [HTML](pages/v3/reference/mcp/tools_list/create_event.html)                                  | 2026-07-17         |
| [MCP Tools Reference: calendarmcp.googleapis.com](https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/delete_event)     | [HTML](pages/v3/reference/mcp/tools_list/delete_event.html)                                  | 2026-07-17         |
| [MCP Tools Reference: calendarmcp.googleapis.com](https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/get_event)        | [HTML](pages/v3/reference/mcp/tools_list/get_event.html)                                     | 2026-07-17         |
| [MCP Tools Reference: calendarmcp.googleapis.com](https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/list_calendars)   | [HTML](pages/v3/reference/mcp/tools_list/list_calendars.html)                                | 2026-07-17         |
| [MCP Tools Reference: calendarmcp.googleapis.com](https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/list_events)      | [HTML](pages/v3/reference/mcp/tools_list/list_events.html)                                   | 2026-07-17         |
| [MCP Tools Reference: calendarmcp.googleapis.com](https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/respond_to_event) | [HTML](pages/v3/reference/mcp/tools_list/respond_to_event.html)                              | 2026-07-17         |
| [MCP Tools Reference: calendarmcp.googleapis.com](https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/search_events)    | [HTML](pages/v3/reference/mcp/tools_list/search_events.html)                                 | 2026-07-17         |
| [MCP Tools Reference: calendarmcp.googleapis.com](https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/suggest_time)     | [HTML](pages/v3/reference/mcp/tools_list/suggest_time.html)                                  | 2026-07-17         |
| [MCP Tools Reference: calendarmcp.googleapis.com](https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/update_event)     | [HTML](pages/v3/reference/mcp/tools_list/update_event.html)                                  | 2026-07-17         |
| [Settings](https://developers.google.com/workspace/calendar/api/v3/reference/settings)                                                               | [HTML](pages/v3/reference/settings.html)                                                     | 2026-05-12         |
| [Settings: get](https://developers.google.com/workspace/calendar/api/v3/reference/settings/get)                                                      | [HTML](pages/v3/reference/settings/get.html)                                                 | 2026-05-12         |
| [Settings: list](https://developers.google.com/workspace/calendar/api/v3/reference/settings/list)                                                    | [HTML](pages/v3/reference/settings/list.html)                                                | 2026-05-12         |
| [Settings: watch](https://developers.google.com/workspace/calendar/api/v3/reference/settings/watch)                                                  | [HTML](pages/v3/reference/settings/watch.html)                                               | 2025-04-03         |
| [Google Calendar API release notes](https://developers.google.com/workspace/calendar/release-notes)                                                  | [HTML](pages/related/workspace/calendar/release-notes.html)                                  | 2026-09-03         |
| [Learn about authentication and authorization](https://developers.google.com/workspace/guides/auth-overview)                                         | [HTML](pages/related/workspace/guides/auth-overview.html)                                    | 2026-09-03         |
| [Configure the OAuth consent screen and choose scopes](https://developers.google.com/workspace/guides/configure-oauth-consent)                       | [HTML](pages/related/workspace/guides/configure-oauth-consent.html)                          | 2026-09-03         |
| [Create access credentials](https://developers.google.com/workspace/guides/create-credentials)                                                       | [HTML](pages/related/workspace/guides/create-credentials.html)                               | 2026-09-03         |
| [Create a Google Cloud project](https://developers.google.com/workspace/guides/create-project)                                                       | [HTML](pages/related/workspace/guides/create-project.html)                                   | 2026-09-03         |
