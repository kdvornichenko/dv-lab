# CalendarList: insert

Source: https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/insert

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2025-05-30.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/calendarList/insert.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](insert.md#auth).

Inserts an existing calendar into the user's calendar list. [Try it now](insert.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
POST https://www.googleapis.com/calendar/v3/users/me/calendarList
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="optional-parameters"></a>**Optional query parameters** |  |  |
| <a id="colorRgbFormat"></a>`colorRgbFormat` | `boolean` | Whether to use the `foregroundColor` and `backgroundColor` fields to write the calendar colors (RGB). If this feature is used, the index-based `colorId` field will be set to the best matching option automatically. Optional. The default is False. |

<a id="auth"></a>

### Authorization

This request requires authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.calendarlist` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

In the request body, supply a [CalendarList resource](../calendarList.md#resource) with the following properties:

<a id="request_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="required-properties"></a>**Required Properties** |  |  |  |
| <a id="id"></a>`id` | `string` | Identifier of the calendar. |  |
| <a id="optional-properties"></a>**Optional Properties** |  |  |  |
| <a id="backgroundColor"></a>`backgroundColor` | `string` | The main color of the calendar in the hexadecimal format "`#0088aa`". This property supersedes the index-based `colorId` property. To set or change this property, you need to specify `colorRgbFormat=true` in the parameters of the [insert](insert.md), [update](update.md) and [patch](patch.md) methods. Optional. | writable |
| <a id="colorId"></a>`colorId` | `string` | The color of the calendar. This is an ID referring to an entry in the `calendar` section of the colors definition (see the [colors endpoint](../colors.md)). This property is superseded by the `backgroundColor` and `foregroundColor` properties and can be ignored when using these properties. Optional. | writable |
| <a id="defaultReminders"></a>`defaultReminders[]` | `list` | The default reminders that the authenticated user has for this calendar. | writable |
| <a id="defaultReminders.method"></a>`defaultReminders[].method` | `string` | The method used by this reminder. Possible values are: <br><br><br><br>- "`email`" - Reminders are sent via email.<br> <br>- "`popup`" - Reminders are sent via a UI popup.<br><br> <br><br><br><br>Required when adding a reminder. | writable |
| <a id="defaultReminders.minutes"></a>`defaultReminders[].minutes` | `integer` | Number of minutes before the start of the event when the reminder should trigger. Valid values are between 0 and 40320 (4 weeks in minutes). <br><br><br><br>Required when adding a reminder. | writable |
| <a id="foregroundColor"></a>`foregroundColor` | `string` | The foreground color of the calendar in the hexadecimal format "`#ffffff`". This property supersedes the index-based `colorId` property. To set or change this property, you need to specify `colorRgbFormat=true` in the parameters of the [insert](insert.md), [update](update.md) and [patch](patch.md) methods. Optional. | writable |
| <a id="hidden"></a>`hidden` | `boolean` | Whether the calendar has been hidden from the list. Optional. The attribute is only returned when the calendar is hidden, in which case the value is `true`. | writable |
| <a id="notificationSettings"></a>`notificationSettings` | `object` | The notifications that the authenticated user is receiving for this calendar. | writable |
| <a id="notificationSettings.notifications.method"></a>`notificationSettings.notifications[].method` | `string` | The method used to deliver the notification. The possible value is: <br><br><br><br>- "`email`" - Notifications are sent via email.<br><br> <br><br><br><br>Required when adding a notification. | writable |
| <a id="notificationSettings.notifications.type"></a>`notificationSettings.notifications[].type` | `string` | The type of notification. Possible values are: <br><br><br><br>- "`eventCreation`" - Notification sent when a new event is put on the calendar.<br> <br>- "`eventChange`" - Notification sent when an event is changed.<br> <br>- "`eventCancellation`" - Notification sent when an event is cancelled.<br> <br>- "`eventResponse`" - Notification sent when an attendee responds to the event invitation.<br> <br>- "`agenda`" - An agenda with the events of the day (sent out in the morning).<br><br> <br><br><br><br>Required when adding a notification. | writable |
| <a id="selected"></a>`selected` | `boolean` | Whether the calendar content shows up in the calendar UI. Optional. The default is False. | writable |
| <a id="summaryOverride"></a>`summaryOverride` | `string` | The summary that the authenticated user has set for this calendar. Optional. | writable |

<a id="response"></a>

## Response

If successful, this method returns a [CalendarList resource](../calendarList.md#resource) in the response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
