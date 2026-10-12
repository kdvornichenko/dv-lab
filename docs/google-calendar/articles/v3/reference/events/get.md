# Events: get

Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/get

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-05-12.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/events/get.html>); no article content intentionally omitted.

---

**Note:** [Authorization](get.md#auth) optional.

Returns an event based on its Google Calendar ID. To retrieve an event using its iCalendar ID, call the [events.list method using the `iCalUID` parameter](list.md#iCalUID). [Try it now](get.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
GET https://www.googleapis.com/calendar/v3/calendars/calendarId/events/eventId
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="required-parameters"></a>**Path parameters** |  |  |
| <a id="calendarId"></a>`calendarId` | `string` | Calendar identifier. To retrieve calendar IDs call the [calendarList.list](../calendarList/list.md) method. If you want to access the primary calendar of the currently logged in user, use the "`primary`" keyword. |
| <a id="eventId"></a>`eventId` | `string` | Event identifier. |
| <a id="optional-parameters"></a>**Optional query parameters** |  |  |
| <a id="alwaysIncludeEmail"></a>`alwaysIncludeEmail` | `boolean` | Deprecated and ignored. A value will always be returned in the `email` field for the organizer, creator and attendees, even if no real email address is available (i.e. a generated, non-working value will be provided). |
| <a id="maxAttendees"></a>`maxAttendees` | `integer` | The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional. |
| <a id="timeZone"></a>`timeZone` | `string` | Time zone used in the response. Optional. The default is the time zone of the calendar. |

<a id="auth"></a>

### Authorization

This request allows authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar.readonly` |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.events.readonly` |
| `https://www.googleapis.com/auth/calendar.events` |
| `https://www.googleapis.com/auth/calendar.app.created` |
| `https://www.googleapis.com/auth/calendar.events.freebusy` |
| `https://www.googleapis.com/auth/calendar.events.owned` |
| `https://www.googleapis.com/auth/calendar.events.owned.readonly` |
| `https://www.googleapis.com/auth/calendar.events.public.readonly` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

Do not supply a request body with this method.

<a id="response"></a>

## Response

If successful, this method returns an [Events resource](../events.md#resource) in the response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
