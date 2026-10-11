# Events: patch

Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/patch

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-01.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/events/patch.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](patch.md#auth).

Updates an event. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements. [Try it now](patch.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
PATCH https://www.googleapis.com/calendar/v3/calendars/calendarId/events/eventId
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
| <a id="conferenceDataVersion"></a>`conferenceDataVersion` | `integer` | Version number of conference data supported by the API client. Version 0 assumes no conference data support and ignores conference data in the event's body. Version 1 enables support for copying of ConferenceData as well as for creating new conferences using the createRequest field of conferenceData. The default is 0. Acceptable values are `0` to `1`, inclusive. |
| <a id="eventLabelVersion"></a>`eventLabelVersion` | `integer` | Version number of the event label feature supported by the API client. Version `0` assumes no event label support and processes the [`colorId`](update.md#colorId) field for color management. Version `1` enables support for event labels, and processes the [`eventLabelId`](update.md#eventLabelId) in the event's body. In this case, the [`colorId`](update.md#colorId) field is ignored. The default is `0`. Acceptable values are `0` to `1`, inclusive. |
| <a id="maxAttendees"></a>`maxAttendees` | `integer` | The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional. |
| <a id="sendNotifications"></a>`sendNotifications` | `boolean` | Deprecated. Please use [sendUpdates](update.md#sendUpdates) instead.<br><br><br><br>Whether to send notifications about the event update (for example, description changes, etc.). Note that some emails might still be sent even if you set the value to `false`. The default is `false`. |
| <a id="sendUpdates"></a>`sendUpdates` | `string` | Guests who should receive notifications about the event update (for example, title changes, etc.). <br><br><br><br>Acceptable values are: <br><br><br><br>- "`all`": Notifications are sent to all guests.<br> <br>- "`externalOnly`": Notifications are sent to non-Google Calendar guests only.<br> <br>- "`none`": No notifications are sent. For calendar migration tasks, consider using the [Events.import](import.md) method instead. |
| <a id="supportsAttachments"></a>`supportsAttachments` | `boolean` | Whether API client performing operation supports event attachments. Optional. The default is False. |

<a id="auth"></a>

### Authorization

This request requires authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.events` |
| `https://www.googleapis.com/auth/calendar.app.created` |
| `https://www.googleapis.com/auth/calendar.events.owned` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

In the request body, supply the relevant portions of an [Events resource](../events.md#resource), according to the rules of patch semantics.

<a id="response"></a>

## Response

If successful, this method returns an [Events resource](../events.md#resource) in the response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
