# CalendarList

Source: https://developers.google.com/workspace/calendar/api/v3/reference/calendarList

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-29.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../pages/v3/reference/calendarList.html>); no article content intentionally omitted.

---

<a id="overview"></a>

The collection of calendars in the user's calendar list. See also [Calendars vs CalendarList](../../concepts/events-calendars.md#calendar_and_calendar_list).

For a list of [methods](calendarList.md#methods) for this resource, see the end of this page.

<a id="resource"></a>

<a id="resource-representations"></a>

## Resource representations

<a id="alt-json"></a>

```Carbon
{
  "kind": "calendar#calendarListEntry",
  "etag": etag,
  "id": string,
  "summary": string,
  "description": string,
  "location": string,
  "timeZone": string,
  "dataOwner": string,
  "summaryOverride": string,
  "colorId": string,
  "backgroundColor": string,
  "foregroundColor": string,
  "hidden": boolean,
  "selected": boolean,
  "accessRole": string,
  "defaultReminders": [
    {
      "method": string,
      "minutes": integer
    }
  ],
  "notificationSettings": {
    "notifications": [
      {
        "type": string,
        "method": string
      }
    ]
  },
  "primary": boolean,
  "deleted": boolean,
  "conferenceProperties": {
    "allowedConferenceSolutionTypes": [
      string
    ]
  },
  "autoAcceptInvitations": boolean
}
```


<a id="properties"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="accessRole"></a>`accessRole` | `string` | The effective access role that the authenticated user has on the calendar. Read-only. Possible values are: <br><br><br><br>- "`freeBusyReader`" - Provides read access to free/busy information.<br> <br>- "`reader`" - Provides read access to the calendar. Private events will appear to users with reader access, but event details will be hidden.<br> <br>- "`writerWithoutPrivateAccess`" - Provides read and write access to the calendar. Private events will appear to users with writerWithoutPrivateAccess access, but event details will be hidden.<br> <br>- "`writer`" - Provides read and write access to the calendar. Private events will appear to users with writer access, and event details will be visible.<br> <br>- "`owner`" - Provides manager access to the calendar. This role has all of the permissions of the writer role with the additional ability to see and modify access levels of other users. <br>  <br>  <br>  <br>  Important: the `owner` role is different from the calendar's data owner. A calendar has a single data owner, but can have multiple users with `owner` role. |  |
| <a id="autoAcceptInvitations"></a>`autoAcceptInvitations` | `boolean` | Whether this calendar automatically accepts invitations. Only valid for resource calendars. Read-only. |  |
| <a id="backgroundColor"></a>`backgroundColor` | `string` | The main color of the calendar in the hexadecimal format "`#0088aa`". This property supersedes the index-based `colorId` property. To set or change this property, you need to specify `colorRgbFormat=true` in the parameters of the [insert](calendarList/insert.md), [update](calendarList/update.md) and [patch](calendarList/patch.md) methods. Optional. | writable |
| <a id="colorId"></a>`colorId` | `string` | The color of the calendar. This is an ID referring to an entry in the `calendar` section of the colors definition (see the [colors endpoint](colors.md)). This property is superseded by the `backgroundColor` and `foregroundColor` properties and can be ignored when using these properties. Optional. | writable |
| <a id="conferenceProperties"></a>`conferenceProperties` | `nested object` | Conferencing properties for this calendar, for example what types of conferences are allowed. |  |
| <a id="conferenceProperties.allowedConferenceSolutionTypes"></a>`conferenceProperties.allowedConferenceSolutionTypes[]` | `list` | The types of conference solutions that are supported for this calendar. <br><br><br><br>The possible values are:<br><br><br><br><br><br>- `"eventHangout"`<br><br>- `"eventNamedHangout"`<br><br>- `"hangoutsMeet"`<br><br> Optional. |  |
| <a id="dataOwner"></a>`dataOwner` | `string` | The email of the owner of the calendar. Set only for secondary calendars. Read-only. |  |
| <a id="defaultReminders"></a>`defaultReminders[]` | `list` | The default reminders that the authenticated user has for this calendar. | writable |
| <a id="defaultReminders.method"></a>`defaultReminders[].method` | `string` | The method used by this reminder. Possible values are: <br><br><br><br>- "`email`" - Reminders are sent via email.<br> <br>- "`popup`" - Reminders are sent via a UI popup.<br><br> <br><br><br><br>Required when adding a reminder. | writable |
| <a id="defaultReminders.minutes"></a>`defaultReminders[].minutes` | `integer` | Number of minutes before the start of the event when the reminder should trigger. Valid values are between 0 and 40320 (4 weeks in minutes). <br><br><br><br>Required when adding a reminder. | writable |
| <a id="deleted"></a>`deleted` | `boolean` | Whether this calendar list entry has been deleted from the calendar list. Read-only. Optional. The default is False. |  |
| <a id="description"></a>`description` | `string` | Description of the calendar. Optional. Read-only. |  |
| <a id="etag"></a>`etag` | `etag` | ETag of the resource. |  |
| <a id="foregroundColor"></a>`foregroundColor` | `string` | The foreground color of the calendar in the hexadecimal format "`#ffffff`". This property supersedes the index-based `colorId` property. To set or change this property, you need to specify `colorRgbFormat=true` in the parameters of the [insert](calendarList/insert.md), [update](calendarList/update.md) and [patch](calendarList/patch.md) methods. Optional. | writable |
| <a id="hidden"></a>`hidden` | `boolean` | Whether the calendar has been hidden from the list. Optional. The attribute is only returned when the calendar is hidden, in which case the value is `true`. | writable |
| <a id="id"></a>`id` | `string` | Identifier of the calendar. |  |
| <a id="kind"></a>`kind` | `string` | Type of the resource ("calendar#calendarListEntry"). |  |
| <a id="location"></a>`location` | `string` | Geographic location of the calendar as free-form text. Optional. Read-only. |  |
| <a id="notificationSettings"></a>`notificationSettings` | `object` | The notifications that the authenticated user is receiving for this calendar. | writable |
| <a id="notificationSettings.notifications"></a>`notificationSettings.notifications[]` | `list` | The list of notifications set for this calendar. |  |
| <a id="notificationSettings.notifications.method"></a>`notificationSettings.notifications[].method` | `string` | The method used to deliver the notification. The possible value is: <br><br><br><br>- "`email`" - Notifications are sent via email.<br><br> <br><br><br><br>Required when adding a notification. | writable |
| <a id="notificationSettings.notifications.type"></a>`notificationSettings.notifications[].type` | `string` | The type of notification. Possible values are: <br><br><br><br>- "`eventCreation`" - Notification sent when a new event is put on the calendar.<br> <br>- "`eventChange`" - Notification sent when an event is changed.<br> <br>- "`eventCancellation`" - Notification sent when an event is cancelled.<br> <br>- "`eventResponse`" - Notification sent when an attendee responds to the event invitation.<br> <br>- "`agenda`" - An agenda with the events of the day (sent out in the morning).<br><br> <br><br><br><br>Required when adding a notification. | writable |
| <a id="primary"></a>`primary` | `boolean` | Whether the calendar is the primary calendar of the authenticated user. Read-only. Optional. The default is False. |  |
| <a id="selected"></a>`selected` | `boolean` | Whether the calendar content shows up in the calendar UI. Optional. The default is False. | writable |
| <a id="summary"></a>`summary` | `string` | Title of the calendar. Read-only. |  |
| <a id="summaryOverride"></a>`summaryOverride` | `string` | The summary that the authenticated user has set for this calendar. Optional. | writable |
| <a id="timeZone"></a>`timeZone` | `string` | The time zone of the calendar. Optional. Read-only. |  |

<a id="methods"></a>

## Methods

[delete](calendarList/delete.md)

Removes a calendar from the user's calendar list.

[get](calendarList/get.md)

Returns a calendar from the user's calendar list.

[insert](calendarList/insert.md)

Inserts an existing calendar into the user's calendar list.

[list](calendarList/list.md)

Returns the calendars on the user's calendar list.

[patch](calendarList/patch.md)

Updates an existing calendar on the user's calendar list. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements.

[update](calendarList/update.md)

Updates an existing calendar on the user's calendar list.

[watch](calendarList/watch.md)

Watch for changes to CalendarList resources.
