# MCP Tools Reference: calendarmcp.googleapis.com

Source: https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/delete_event

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-17.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../../pages/v3/reference/mcp/tools_list/delete_event.html>); no article content intentionally omitted.

---

<a id="/workspace/calendar/api/v3/reference/mcp/tools_list/delete_event"></a>

<a id="GENERIC"></a>

<a id="tool:-delete_event"></a>

## Tool: `delete_event`

<a id="GENERIC_1"></a>

**Developer Preview:** Available as part of the [Google Workspace Developer Preview Program](https://developers.google.com/workspace/preview), which grants early access to certain features.

Deletes an event on the given calendar.

<a id="GENERIC_2"></a>

The following sample demonstrate how to use `curl` to invoke the `delete_event` MCP tool.

<a id="MCP_CURL_REQUEST"></a>

| Curl Request |
| --- |
| [Code block](#code-block-1) |

<a id="code-block-1"></a>

```Bash
curl --location 'https://calendarmcp.googleapis.com/mcp/v1' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
--header 'content-type: application/json' \
--header 'accept: application/json, text/event-stream' \
--data '{
  "method": "tools/call",
  "params": {
    "name": "delete_event",
    "arguments": {
      // provide these details according to the tool MCP specification
    }
  },
  "jsonrpc": "2.0",
  "id": 1
}'
                
```


<a id="Input.Schema"></a>

<a id="input-schema"></a>

## Input Schema

<a id="Input.Schema.description"></a>

Request message for DeleteEvent.

<a id="Input.Schema.DeleteEventRequest"></a>

<a id="deleteeventrequest"></a>

### DeleteEventRequest

<a id="Input.Schema.SCHEMA_REPRESENTATION"></a>

| JSON representation |
| --- |
| [Code block](#code-block-2) |

<a id="code-block-2"></a>

```
{
  "eventId": string,

  "calendarId": string

  "notificationLevel": enum (NotificationLevel)
}
```


<a id="Input.Schema.FIELDS"></a>

<a id="Input.Schema.FIELDS-table"></a>

| Fields |  |
| --- | --- |
| <a id="Input.Schema.FIELDS.field_section"></a>`eventId` | `string`<br><br> <br><br><br><br>Required. The ID of the event to delete. |
| <a id="Input.Schema.FIELDS.ONEOF"></a>Union field `_calendar_id`.<br><br><br><br><br><br>`_calendar_id` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS.field_section_1"></a>`calendarId` | `string`<br><br> <br><br><br><br>Optional. ID of the calendar containing the event. Email address - can be resolved using `list_calendars`. Default: primary calendar. |
| <a id="Input.Schema.FIELDS.ONEOF_1"></a>Union field `_notification_level`.<br><br><br><br><br><br>`_notification_level` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS.field_section_2"></a>`notificationLevel` | `enum (NotificationLevel)`<br><br> <br><br><br><br>Optional. Which email notification should be sent for this event update. |

<a id="Input.Schema.NotificationLevel"></a>

<a id="notificationlevel"></a>

### NotificationLevel

<a id="Input.Schema.description_1"></a>

Email notification level for updates.

<a id="Input.Schema.ENUM_VALUES"></a>

<a id="Input.Schema.ENUM_VALUES-table"></a>

| Enums |  |
| --- | --- |
| <a id="Input.Schema.ENUM_VALUES.NOTIFICATION_LEVEL_UNSPECIFIED"></a>`NOTIFICATION_LEVEL_UNSPECIFIED` | Default. Treated as `ALL`. |
| <a id="Input.Schema.ENUM_VALUES.NONE"></a>`NONE` | No notifications. |
| <a id="Input.Schema.ENUM_VALUES.EXTERNAL_ONLY"></a>`EXTERNAL_ONLY` | External attendees only. |
| <a id="Input.Schema.ENUM_VALUES.ALL"></a>`ALL` | All attendees. |

<a id="Output.Schema"></a>

<a id="output-schema"></a>

## Output Schema

<a id="Output.Schema.description"></a>

<a id="Output.Schema.Event"></a>

<a id="event"></a>

### Event

<a id="Output.Schema.SCHEMA_REPRESENTATION"></a>

| JSON representation |
| --- |
| [Code block](#code-block-3) |

<a id="code-block-3"></a>

```
{
  "id": string,
  "status": string,
  "htmlLink": string,
  "created": string,
  "updated": string,
  "summary": string,
  "description": string,
  "location": string,
  "creator": {
    object (Principal)
  },
  "organizer": {
    object (Principal)
  },
  "start": {
    object (DateOrDateTime)
  },
  "end": {
    object (DateOrDateTime)
  },
  "recurrence": [
    string
  ],
  "recurringEventId": string,
  "originalStartTime": {
    object (DateOrDateTime)
  },
  "transparency": string,
  "visibility": string,
  "attendees": [
    {
      object (Attendee)
    }
  ],
  "conferenceUrl": string,
  "colorId": string,
  "overrideReminders": [
    {
      object (Reminder)
    }
  ],
  "attachments": [
    {
      object (Attachment)
    }
  ],
  "guestPermissions": {
    object (GuestPermissions)
  },
  "eventType": enum (EventType),
  "workingLocationProperties": {
    object (WorkingLocationProperties)
  },
  "availability": enum (Availability)
}
```


<a id="Output.Schema.FIELDS"></a>

<a id="Output.Schema.FIELDS-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS.field_section"></a>`id` | `string`<br><br> <br><br><br><br>Unique identifier. |
| <a id="Output.Schema.FIELDS.field_section_1"></a>`status` | `string`<br><br> <br><br><br><br>Optional. Status. Possible values are:<br><br><br><br><br><br>- `confirmed` - Event is confirmed (default).<br> <br>- `tentative` - Event is tentatively confirmed.<br> <br>- `cancelled` - Event is cancelled or deleted. |
| <a id="Output.Schema.FIELDS.field_section_2"></a>`htmlLink` | `string`<br><br> <br><br><br><br>Output only. An absolute link to this event in the Google Calendar Web UI. |
| <a id="Output.Schema.FIELDS.field_section_3"></a>`created` | `string`<br><br> <br><br><br><br>Output only. Creation time (ISO 8601). |
| <a id="Output.Schema.FIELDS.field_section_4"></a>`updated` | `string`<br><br> <br><br><br><br>Output only. Last modification time (ISO 8601). |
| <a id="Output.Schema.FIELDS.field_section_5"></a>`summary` | `string`<br><br> <br><br><br><br>Title. |
| <a id="Output.Schema.FIELDS.field_section_6"></a>`description` | `string`<br><br> <br><br><br><br>Optional. Description. Can contain HTML. |
| <a id="Output.Schema.FIELDS.field_section_7"></a>`location` | `string`<br><br> <br><br><br><br>Optional. Location. |
| <a id="Output.Schema.FIELDS.field_section_8"></a>`creator` | `object (Principal)`<br><br> <br><br><br><br>Output only. Creator. |
| <a id="Output.Schema.FIELDS.field_section_9"></a>`organizer` | `object (Principal)`<br><br> <br><br><br><br>Output only. Organizer. Also listed in attendees if attending. |
| <a id="Output.Schema.FIELDS.field_section_10"></a>`start` | `object (DateOrDateTime)`<br><br> <br><br><br><br>Start time (inclusive). For recurring events the first instance is used.. |
| <a id="Output.Schema.FIELDS.field_section_11"></a>`end` | `object (DateOrDateTime)`<br><br> <br><br><br><br>End time (exclusive). For recurring events the first instance is used. |
| <a id="Output.Schema.FIELDS.field_section_12"></a>`recurrence[]` | `string`<br><br> <br><br><br><br>Recurrence rules as `RRULE`, `EXRULE`, `RDATE`, or `EXDATE` strings (per RFC 5545). Omitted for single events. Start/end times must be set in the `start`/`end` fields. |
| <a id="Output.Schema.FIELDS.field_section_13"></a>`recurringEventId` | `string`<br><br> <br><br><br><br>Parent recurring event ID for instances of recurring events. |
| <a id="Output.Schema.FIELDS.field_section_14"></a>`originalStartTime` | `object (DateOrDateTime)`<br><br> <br><br><br><br>Original start time of recurring instances. This is the time at which this instance would start according to the recurrence data. |
| <a id="Output.Schema.FIELDS.field_section_15"></a>`transparency(deprecated)` | `string`<br><br> <br><br><br><br>This item is deprecated!<br><br> <br><br><br><br>Optional. Deprecated: use `availability` instead. |
| <a id="Output.Schema.FIELDS.field_section_16"></a>`visibility` | `string`<br><br> <br><br><br><br>Optional. Visibility of the event. Possible values are:<br><br><br><br><br><br>- `default` - Uses the default visibility for events on the calendar. This is the default value.<br><br>- `public` - Event details are visible to all readers of the calendar.<br><br>- `private` - Only event attendees may view event details. |
| <a id="Output.Schema.FIELDS.field_section_17"></a>`attendees[]` | `object (Attendee)`<br><br> <br><br><br><br>Attendees. |
| <a id="Output.Schema.FIELDS.field_section_18"></a>`conferenceUrl` | `string`<br><br> <br><br><br><br>Video conference link. |
| <a id="Output.Schema.FIELDS.field_section_19"></a>`colorId` | `string`<br><br> <br><br><br><br>The color of the event. Only affects your own calendar view. This is an ID referring to an entry in the calendar's color palette (string `'1'`-`'11'`):<br><br><br><br><br><br>- `1`: Lavender<br><br>- `2`: Sage<br><br>- `3`: Grape<br><br>- `4`: Flamingo<br><br>- `5`: Banana<br><br>- `6`: Tangerine<br><br>- `7`: Peacock<br><br>- `8`: Graphite<br><br>- `9`: Blueberry<br><br>- `10`: Basil<br><br>- `11`: Tomato. |
| <a id="Output.Schema.FIELDS.field_section_20"></a>`overrideReminders[]` | `object (Reminder)`<br><br> <br><br><br><br>Reminders. Falls back to calendar defaults if unset. |
| <a id="Output.Schema.FIELDS.field_section_21"></a>`attachments[]` | `object (Attachment)`<br><br> <br><br><br><br>File attachments. |
| <a id="Output.Schema.FIELDS.field_section_22"></a>`guestPermissions` | `object (GuestPermissions)`<br><br> <br><br><br><br>Guest permissions. |
| <a id="Output.Schema.FIELDS.field_section_23"></a>`eventType` | `enum (EventType)`<br><br> <br><br><br><br>Event type. |
| <a id="Output.Schema.FIELDS.field_section_24"></a>`workingLocationProperties` | `object (WorkingLocationProperties)`<br><br> <br><br><br><br>Working location properties. Populated only when `event_type` is `WORKING_LOCATION`. |
| <a id="Output.Schema.FIELDS.field_section_25"></a>`availability` | `enum (Availability)`<br><br> <br><br><br><br>Optional. Availability setting. |

<a id="Output.Schema.Principal"></a>

<a id="principal"></a>

### Principal

<a id="Output.Schema.SCHEMA_REPRESENTATION_1"></a>

| JSON representation |
| --- |
| [Code block](#code-block-4) |

<a id="code-block-4"></a>

```
{
  "email": string,
  "displayName": string,
  "self": boolean
}
```


<a id="Output.Schema.FIELDS_1"></a>

<a id="Output.Schema.FIELDS_1-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS_1.field_section"></a>`email` | `string`<br><br> <br><br><br><br>Email. |
| <a id="Output.Schema.FIELDS_1.field_section_1"></a>`displayName` | `string`<br><br> <br><br><br><br>Name. |
| <a id="Output.Schema.FIELDS_1.field_section_2"></a>`self` | `boolean`<br><br> <br><br><br><br>Output only. Whether this principal corresponds to the calendar on which this copy of the event appears. Default: `false`. |

<a id="Output.Schema.DateOrDateTime"></a>

<a id="dateordatetime"></a>

### DateOrDateTime

<a id="Output.Schema.SCHEMA_REPRESENTATION_2"></a>

| JSON representation |
| --- |
| [Code block](#code-block-5) |

<a id="code-block-5"></a>

```
{
  "date": string,
  "dateTime": string,
  "timeZone": string
}
```


<a id="Output.Schema.FIELDS_2"></a>

<a id="Output.Schema.FIELDS_2-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS_2.field_section"></a>`date` | `string`<br><br> <br><br><br><br>ISO 8601 date at midnight UTC (for example, `'2019-11-20T00:00:00Z'`). |
| <a id="Output.Schema.FIELDS_2.field_section_1"></a>`dateTime` | `string`<br><br> <br><br><br><br>ISO 8601 timestamp (for example, `'2019-11-20T08:19:06-07:00'`). |
| <a id="Output.Schema.FIELDS_2.field_section_2"></a>`timeZone` | `string`<br><br> <br><br><br><br>TZDB timezone name. |

<a id="Output.Schema.Attendee"></a>

<a id="attendee"></a>

### Attendee

<a id="Output.Schema.SCHEMA_REPRESENTATION_3"></a>

| JSON representation |
| --- |
| [Code block](#code-block-6) |

<a id="code-block-6"></a>

```
{

  "id": string

  "email": string

  "displayName": string

  "organizer": boolean

  "self": boolean

  "resource": boolean

  "optionalAttendee": boolean

  "responseStatus": string

  "comment": string

  "additionalGuests": integer
}
```


<a id="Output.Schema.FIELDS_3"></a>

<a id="Output.Schema.FIELDS_3-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS_3.ONEOF"></a>Union field `_id`.<br><br><br><br><br><br>`_id` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_3.field_section"></a>`id` | `string`<br><br> <br><br><br><br>Output only. Profile ID. |
| <a id="Output.Schema.FIELDS_3.ONEOF_1"></a>Union field `_email`.<br><br><br><br><br><br>`_email` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_3.field_section_1"></a>`email` | `string`<br><br> <br><br><br><br>Required. Attendee's email address. |
| <a id="Output.Schema.FIELDS_3.ONEOF_2"></a>Union field `_display_name`.<br><br><br><br><br><br>`_display_name` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_3.field_section_2"></a>`displayName` | `string`<br><br> <br><br><br><br>Optional. Name. |
| <a id="Output.Schema.FIELDS_3.ONEOF_3"></a>Union field `_organizer`.<br><br><br><br><br><br>`_organizer` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_3.field_section_3"></a>`organizer` | `boolean`<br><br> <br><br><br><br>Output only. Whether attendee is the organizer. Default: `false`. |
| <a id="Output.Schema.FIELDS_3.ONEOF_4"></a>Union field `_self`.<br><br><br><br><br><br>`_self` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_3.field_section_4"></a>`self` | `boolean`<br><br> <br><br><br><br>Output only. Whether this entry represents the calendar on which this copy of the event appears. Default: `false`. |
| <a id="Output.Schema.FIELDS_3.ONEOF_5"></a>Union field `_resource`.<br><br><br><br><br><br>`_resource` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_3.field_section_5"></a>`resource` | `boolean`<br><br> <br><br><br><br>Optional. Whether attendee is a resource (for example, room). Immutable, can only be set when the attendee is initially added. Default: `false`. |
| <a id="Output.Schema.FIELDS_3.ONEOF_6"></a>Union field `_optional_attendee`.<br><br><br><br><br><br>`_optional_attendee` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_3.field_section_6"></a>`optionalAttendee` | `boolean`<br><br> <br><br><br><br>Optional. Whether attendee is optional. Default: `false`. |
| <a id="Output.Schema.FIELDS_3.ONEOF_7"></a>Union field `_response_status`.<br><br><br><br><br><br>`_response_status` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_3.field_section_7"></a>`responseStatus` | `string`<br><br> <br><br><br><br>Optional. Response status. Possible values are:<br><br><br><br><br><br>- `needsAction` - Attendee has not responded to the invitation (recommended for new events).<br><br>- `declined` - Attendee has declined the invitation.<br><br>- `tentative` - Attendee has tentatively accepted the invitation.<br><br>- `accepted` - Attendee has accepted the invitation. |
| <a id="Output.Schema.FIELDS_3.ONEOF_8"></a>Union field `_comment`.<br><br><br><br><br><br>`_comment` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_3.field_section_8"></a>`comment` | `string`<br><br> <br><br><br><br>Output only. Response comment. |
| <a id="Output.Schema.FIELDS_3.ONEOF_9"></a>Union field `_additional_guests`.<br><br><br><br><br><br>`_additional_guests` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_3.field_section_9"></a>`additionalGuests` | `integer`<br><br> <br><br><br><br>Optional. Number of additional guests. Default: `0`. |

<a id="Output.Schema.Reminder"></a>

<a id="reminder"></a>

### Reminder

<a id="Output.Schema.SCHEMA_REPRESENTATION_4"></a>

| JSON representation |
| --- |
| [Code block](#code-block-7) |

<a id="code-block-7"></a>

```
{

  "method": string

  "minutes": integer
}
```


<a id="Output.Schema.FIELDS_4"></a>

<a id="Output.Schema.FIELDS_4-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS_4.ONEOF"></a>Union field `_method`.<br><br><br><br><br><br>`_method` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_4.field_section"></a>`method` | `string`<br><br> <br><br><br><br>Required. Delivery method. Possible values are:<br><br><br><br><br><br>- `email` - Reminders are sent via email.<br><br>- `popup` - Reminders are sent via a UI popup. |
| <a id="Output.Schema.FIELDS_4.ONEOF_1"></a>Union field `_minutes`.<br><br><br><br><br><br>`_minutes` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_4.field_section_1"></a>`minutes` | `integer`<br><br> <br><br><br><br>Required. Minutes in advance that the reminder is triggered. |

<a id="Output.Schema.Attachment"></a>

<a id="attachment"></a>

### Attachment

<a id="Output.Schema.SCHEMA_REPRESENTATION_5"></a>

| JSON representation |
| --- |
| [Code block](#code-block-8) |

<a id="code-block-8"></a>

```
{

  "fileUrl": string

  "title": string
}
```


<a id="Output.Schema.FIELDS_5"></a>

<a id="Output.Schema.FIELDS_5-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS_5.ONEOF"></a>Union field `_file_url`.<br><br><br><br><br><br>`_file_url` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_5.field_section"></a>`fileUrl` | `string`<br><br> <br><br><br><br>Required. URL link to the attachment. |
| <a id="Output.Schema.FIELDS_5.ONEOF_1"></a>Union field `_title`.<br><br><br><br><br><br>`_title` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_5.field_section_1"></a>`title` | `string`<br><br> <br><br><br><br>Optional. Attachment title. |

<a id="Output.Schema.GuestPermissions"></a>

<a id="guestpermissions"></a>

### GuestPermissions

<a id="Output.Schema.SCHEMA_REPRESENTATION_6"></a>

| JSON representation |
| --- |
| [Code block](#code-block-9) |

<a id="code-block-9"></a>

```
{

  "guestsCanInviteOthers": boolean

  "guestsCanModify": boolean

  "guestsCanSeeGuests": boolean
}
```


<a id="Output.Schema.FIELDS_6"></a>

<a id="Output.Schema.FIELDS_6-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS_6.ONEOF"></a>Union field `_guests_can_invite_others`.<br><br><br><br><br><br>`_guests_can_invite_others` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_6.field_section"></a>`guestsCanInviteOthers` | `boolean`<br><br> <br><br><br><br>Optional. Whether guests can invite others. |
| <a id="Output.Schema.FIELDS_6.ONEOF_1"></a>Union field `_guests_can_modify`.<br><br><br><br><br><br>`_guests_can_modify` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_6.field_section_1"></a>`guestsCanModify` | `boolean`<br><br> <br><br><br><br>Optional. Whether guests can modify the event. |
| <a id="Output.Schema.FIELDS_6.ONEOF_2"></a>Union field `_guests_can_see_guests`.<br><br><br><br><br><br>`_guests_can_see_guests` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_6.field_section_2"></a>`guestsCanSeeGuests` | `boolean`<br><br> <br><br><br><br>Optional. Whether guests can see other guests. |

<a id="Output.Schema.WorkingLocationProperties"></a>

<a id="workinglocationproperties"></a>

### WorkingLocationProperties

<a id="Output.Schema.SCHEMA_REPRESENTATION_7"></a>

| JSON representation |
| --- |
| [Code block](#code-block-10) |

<a id="code-block-10"></a>

```
{

  "type": enum (WorkingLocationType)

  "customLocationLabel": string
}
```


<a id="Output.Schema.FIELDS_7"></a>

<a id="Output.Schema.FIELDS_7-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS_7.ONEOF"></a>Union field `_type`.<br><br><br><br><br><br>`_type` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_7.field_section"></a>`type` | `enum (WorkingLocationType)`<br><br> <br><br><br><br>Optional. Working location type. |
| <a id="Output.Schema.FIELDS_7.ONEOF_1"></a>Union field `_custom_location_label`.<br><br><br><br><br><br>`_custom_location_label` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS_7.field_section_1"></a>`customLocationLabel` | `string`<br><br> <br><br><br><br>Optional. The label for a custom location. Required if type is `CUSTOM_LOCATION`. |

<a id="Output.Schema.EventType"></a>

<a id="eventtype"></a>

### EventType

<a id="Output.Schema.description_1"></a>

Event type. Immutable after creation.

<a id="Output.Schema.ENUM_VALUES"></a>

<a id="Output.Schema.ENUM_VALUES-table"></a>

| Enums |  |
| --- | --- |
| <a id="Output.Schema.ENUM_VALUES.EVENT_TYPE_UNSPECIFIED"></a>`EVENT_TYPE_UNSPECIFIED` | Treated as `DEFAULT`. |
| <a id="Output.Schema.ENUM_VALUES.DEFAULT"></a>`DEFAULT` | Regular event. Default value. |
| <a id="Output.Schema.ENUM_VALUES.OUT_OF_OFFICE"></a>`OUT_OF_OFFICE` | Out-of-office event. |
| <a id="Output.Schema.ENUM_VALUES.FOCUS_TIME"></a>`FOCUS_TIME` | Focus-time event. |
| <a id="Output.Schema.ENUM_VALUES.WORKING_LOCATION"></a>`WORKING_LOCATION` | Working location event. |
| <a id="Output.Schema.ENUM_VALUES.BIRTHDAY"></a>`BIRTHDAY` | Special all-day event with an annual recurrence. |
| <a id="Output.Schema.ENUM_VALUES.FROM_GMAIL"></a>`FROM_GMAIL` | Event from Gmail. This type of event cannot be created. |

<a id="Output.Schema.WorkingLocationType"></a>

<a id="workinglocationtype"></a>

### WorkingLocationType

<a id="Output.Schema.description_2"></a>

Type of working location.

<a id="Output.Schema.ENUM_VALUES_1"></a>

<a id="Output.Schema.ENUM_VALUES_1-table"></a>

| Enums |  |
| --- | --- |
| <a id="Output.Schema.ENUM_VALUES_1.WORKING_LOCATION_TYPE_UNSPECIFIED"></a>`WORKING_LOCATION_TYPE_UNSPECIFIED` | Unspecified working location type. Will be treated as `HOME_OFFICE`. |
| <a id="Output.Schema.ENUM_VALUES_1.HOME_OFFICE"></a>`HOME_OFFICE` | Home office. |
| <a id="Output.Schema.ENUM_VALUES_1.CUSTOM_LOCATION"></a>`CUSTOM_LOCATION` | Custom location. |

<a id="Output.Schema.Availability"></a>

<a id="availability"></a>

### Availability

<a id="Output.Schema.description_3"></a>

Availability setting for an event.

<a id="Output.Schema.ENUM_VALUES_2"></a>

<a id="Output.Schema.ENUM_VALUES_2-table"></a>

| Enums |  |
| --- | --- |
| <a id="Output.Schema.ENUM_VALUES_2.AVAILABILITY_UNSPECIFIED"></a>`AVAILABILITY_UNSPECIFIED` | Default. Treated as `BUSY`. |
| <a id="Output.Schema.ENUM_VALUES_2.AVAILABILITY_BUSY"></a>`AVAILABILITY_BUSY` | Blocks time on calendar. |
| <a id="Output.Schema.ENUM_VALUES_2.AVAILABILITY_FREE"></a>`AVAILABILITY_FREE` | Does not block time. |

<a id="GENERIC_3"></a>

<a id="tool-annotations"></a>

### Tool Annotations

Destructive Hint: ✅ | Idempotent Hint: ✅ | Read Only Hint: ❌ | Open World Hint: ❌

<a id="Authorization.Scopes"></a>

<a id="authorization-scopes"></a>

## Authorization Scopes

Requires one of the following OAuth scopes:

- `https://www.googleapis.com/auth/calendar`

- `https://www.googleapis.com/auth/calendar.events`
