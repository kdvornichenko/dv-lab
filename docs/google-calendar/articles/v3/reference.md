# API Reference

Source: https://developers.google.com/workspace/calendar/api/v3/reference

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-06-17.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/v3/reference.html>); no article content intentionally omitted.

---

This API reference is organized by resource type. Each resource type has one or more data representations and one or more methods.

<a id="resource-types"></a>

## Resource types

- [ Acl ](reference.md#Acl)

- [ CalendarList ](reference.md#CalendarList)

- [ Calendars ](reference.md#Calendars)

- [ Channels ](reference.md#Channels)

- [ Colors ](reference.md#Colors)

- [ Events ](reference.md#Events)

- [ Freebusy ](reference.md#Freebusy)

- [ Settings ](reference.md#Settings)

<a id="Acl"></a>

## Acl

For Acl Resource details, see the [resource representation](reference/acl.md#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/calendar/v3, unless otherwise noted |  |  |
| [delete](reference/acl/delete.md) | `DELETE  /calendars/calendarId/acl/ruleId` | Deletes an access control rule. |
| [get](reference/acl/get.md) | `GET  /calendars/calendarId/acl/ruleId` | Returns an access control rule. |
| [insert](reference/acl/insert.md) | `POST  /calendars/calendarId/acl` | Creates an access control rule. |
| [list](reference/acl/list.md) | `GET  /calendars/calendarId/acl` | Returns the rules in the access control list for the calendar. |
| [patch](reference/acl/patch.md) | `PATCH  /calendars/calendarId/acl/ruleId` | Updates an access control rule. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements. |
| [update](reference/acl/update.md) | `PUT  /calendars/calendarId/acl/ruleId` | Updates an access control rule. |
| [watch](reference/acl/watch.md) | `POST  /calendars/calendarId/acl/watch` | Watch for changes to ACL resources. |

<a id="CalendarList"></a>

## CalendarList

For CalendarList Resource details, see the [resource representation](reference/calendarList.md#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/calendar/v3, unless otherwise noted |  |  |
| [delete](reference/calendarList/delete.md) | `DELETE  /users/me/calendarList/calendarId` | Removes a calendar from the user's calendar list. |
| [get](reference/calendarList/get.md) | `GET  /users/me/calendarList/calendarId` | Returns a calendar from the user's calendar list. |
| [insert](reference/calendarList/insert.md) | `POST  /users/me/calendarList` | Inserts an existing calendar into the user's calendar list. |
| [list](reference/calendarList/list.md) | `GET  /users/me/calendarList` | Returns the calendars on the user's calendar list. |
| [patch](reference/calendarList/patch.md) | `PATCH  /users/me/calendarList/calendarId` | Updates an existing calendar on the user's calendar list. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements. |
| [update](reference/calendarList/update.md) | `PUT  /users/me/calendarList/calendarId` | Updates an existing calendar on the user's calendar list. |
| [watch](reference/calendarList/watch.md) | `POST  /users/me/calendarList/watch` | Watch for changes to CalendarList resources. |

<a id="Calendars"></a>

## Calendars

For Calendars Resource details, see the [resource representation](reference/calendars.md#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/calendar/v3, unless otherwise noted |  |  |
| [clear](reference/calendars/clear.md) | `POST  /calendars/calendarId/clear` | Clears a primary calendar. This operation deletes all events associated with the primary calendar of an account. |
| [delete](reference/calendars/delete.md) | `DELETE  /calendars/calendarId` | Deletes a secondary calendar. Use calendars.clear for clearing all events on primary calendars. |
| [get](reference/calendars/get.md) | `GET  /calendars/calendarId` | Returns metadata for a calendar. |
| [insert](reference/calendars/insert.md) | `POST  /calendars` | Creates a secondary calendar. <br><br><br><br>The authenticated user for the request is made the data owner of the new calendar.<br><br> <br><br><br><br>**Note:** We recommend to authenticate as the intended data owner of the calendar. You can use [domain-wide delegation of authority](https://developers.google.com/workspace/cloud-search/docs/guides/delegation) to allow applications to act on behalf of a specific user. Don't use a service account for authentication. If you use a service account for authentication, the service account is the data owner, which can lead to unexpected behavior. For example, if a service account is the data owner, data ownership cannot be transferred. |
| [patch](reference/calendars/patch.md) | `PATCH  /calendars/calendarId` | Updates metadata for a calendar. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements. |
| [transferOwnership](reference/calendars/transferOwnership.md) | `POST  /calendars/calendarId/transferOwnership` | Transfers a secondary calendar between users within a Google Workspace organization. Requires user authentication with [Manage Calendars](https://knowledge.workspace.google.com/admin/users/administrator-privilege-definitions#calendar) administrator privilege, and one of the following authorization scopes: <br><br><br><br>- `https://www.googleapis.com/auth/calendar`<br> <br>- `https://www.googleapis.com/auth/calendar.calendars`<br><br> In the request, set `useAdminAccess` to `true`. The secondary calendar must be active to be transferred. Transferring disabled or deleted calendars isn't supported. <br><br><br><br><br><br> **Required query parameters:** `newDataOwner`, `useAdminAccess` |
| [update](reference/calendars/update.md) | `PUT  /calendars/calendarId` | Updates metadata for a calendar. |

<a id="Channels"></a>

## Channels

For Channels Resource details, see the [resource representation](reference/channels.md#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/calendar/v3, unless otherwise noted |  |  |
| [stop](reference/channels/stop.md) | `POST  /channels/stop` | Stop watching resources through this channel. |

<a id="Colors"></a>

## Colors

For Colors Resource details, see the [resource representation](reference/colors.md#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/calendar/v3, unless otherwise noted |  |  |
| [get](reference/colors/get.md) | `GET  /colors` | Returns the color definitions for calendars and events. |

<a id="Events"></a>

## Events

For Events Resource details, see the [resource representation](reference/events.md#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/calendar/v3, unless otherwise noted |  |  |
| [delete](reference/events/delete.md) | `DELETE  /calendars/calendarId/events/eventId` | Deletes an event. |
| [get](reference/events/get.md) | `GET  /calendars/calendarId/events/eventId` | Returns an event based on its Google Calendar ID. To retrieve an event using its iCalendar ID, call the [events.list method using the `iCalUID` parameter](reference/events/list.md#iCalUID). |
| [import](reference/events/import.md) | `POST  /calendars/calendarId/events/import` | Imports an event. This operation is used to add a private copy of an existing event to a calendar. Only events with an `eventType` of `default` may be imported.<br><br><br><br>**Deprecated behavior:** If a non-`default` event is imported, its type will be changed to `default` and any event-type-specific properties it may have will be dropped. |
| [insert](reference/events/insert.md) | `POST  /calendars/calendarId/events` | Creates an event. |
| [instances](reference/events/instances.md) | `GET  /calendars/calendarId/events/eventId/instances` | Returns instances of the specified recurring event. |
| [list](reference/events/list.md) | `GET  /calendars/calendarId/events` | Returns events on the specified calendar. |
| [move](reference/events/move.md) | `POST  /calendars/calendarId/events/eventId/move` | Moves an event to another calendar, i.e. changes an event's organizer. Note that only `default` events can be moved; `birthday`, `focusTime`, `fromGmail`, `outOfOffice` and `workingLocation` events cannot be moved. <br><br><br><br><br><br> **Required query parameters:** `destination` |
| [patch](reference/events/patch.md) | `PATCH  /calendars/calendarId/events/eventId` | Updates an event. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements. |
| [quickAdd](reference/events/quickAdd.md) | `POST  /calendars/calendarId/events/quickAdd` | Creates an event based on a simple text string. <br><br><br><br><br><br> **Required query parameters:** `text` |
| [update](reference/events/update.md) | `PUT  /calendars/calendarId/events/eventId` | Updates an event. This method does not support patch semantics and always updates the entire event resource. To do a partial update, perform a `get` followed by an `update` using etags to ensure atomicity. |
| [watch](reference/events/watch.md) | `POST  /calendars/calendarId/events/watch` | Watch for changes to Events resources. |

<a id="Freebusy"></a>

## Freebusy

For Freebusy Resource details, see the [resource representation](reference/freebusy.md#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/calendar/v3, unless otherwise noted |  |  |
| [query](reference/freebusy/query.md) | `POST  /freeBusy` | Returns free/busy information for a set of calendars. |

<a id="Settings"></a>

## Settings

For Settings Resource details, see the [resource representation](reference/settings.md#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/calendar/v3, unless otherwise noted |  |  |
| [get](reference/settings/get.md) | `GET  /users/me/settings/setting` | Returns a single user setting. |
| [list](reference/settings/list.md) | `GET  /users/me/settings` | Returns all user settings for the authenticated user. |
| [watch](reference/settings/watch.md) | `POST  /users/me/settings/watch` | Watch for changes to Settings resources. |
