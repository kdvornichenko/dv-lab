# Events: move

Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/move

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-05-12.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/events/move.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](move.md#auth).

Moves an event to another calendar, i.e. changes an event's organizer. Note that only `default` events can be moved; `birthday`, `focusTime`, `fromGmail`, `outOfOffice` and `workingLocation` events cannot be moved. [Try it now](move.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
POST https://www.googleapis.com/calendar/v3/calendars/calendarId/events/eventId/move
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="required-parameters"></a>**Path parameters** |  |  |
| <a id="calendarId"></a>`calendarId` | `string` | Calendar identifier of the source calendar where the event currently is on. |
| <a id="eventId"></a>`eventId` | `string` | Event identifier. |
| **Required query parameters** |  |  |
| <a id="destination"></a>`destination` | `string` | Calendar identifier of the target calendar where the event is to be moved to. |
| <a id="optional-parameters"></a>**Optional query parameters** |  |  |
| <a id="sendNotifications"></a>`sendNotifications` | `boolean` | Deprecated. Please use [sendUpdates](move.md#sendUpdates) instead.<br><br><br><br>Whether to send notifications about the change of the event's organizer. Note that some emails might still be sent even if you set the value to `false`. The default is `false`. |
| <a id="sendUpdates"></a>`sendUpdates` | `string` | Guests who should receive notifications about the change of the event's organizer. <br><br><br><br>Acceptable values are: <br><br><br><br>- "`all`": Notifications are sent to all guests.<br> <br>- "`externalOnly`": Notifications are sent to non-Google Calendar guests only.<br> <br>- "`none`": No notifications are sent. For calendar migration tasks, consider using the [Events.import](import.md) method instead. |

<a id="auth"></a>

### Authorization

This request requires authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.events` |
| `https://www.googleapis.com/auth/calendar.events.owned` |

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
