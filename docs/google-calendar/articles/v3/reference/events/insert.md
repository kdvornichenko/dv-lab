# Events: insert

Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-07.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/events/insert.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](insert.md#auth).

Creates an event. [Try it now](insert.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
POST https://www.googleapis.com/calendar/v3/calendars/calendarId/events
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="required-parameters"></a>**Path parameters** |  |  |
| <a id="calendarId"></a>`calendarId` | `string` | Calendar identifier. To retrieve calendar IDs call the [calendarList.list](../calendarList/list.md) method. If you want to access the primary calendar of the currently logged in user, use the "`primary`" keyword. |
| <a id="optional-parameters"></a>**Optional query parameters** |  |  |
| <a id="conferenceDataVersion"></a>`conferenceDataVersion` | `integer` | Version number of conference data supported by the API client. Version 0 assumes no conference data support and ignores conference data in the event's body. Version 1 enables support for copying of ConferenceData as well as for creating new conferences using the createRequest field of conferenceData. The default is 0. Acceptable values are `0` to `1`, inclusive. |
| <a id="eventLabelVersion"></a>`eventLabelVersion` | `integer` | Version number of the event label feature supported by the API client. Version `0` assumes no event label support and processes the [`colorId`](insert.md#colorId) field for color management. Version `1` enables support for event labels, and processes the [`eventLabelId`](insert.md#eventLabelId) in the event's body. In this case, the [`colorId`](insert.md#colorId) field is ignored. The default is `0`. Acceptable values are `0` to `1`, inclusive. |
| <a id="maxAttendees"></a>`maxAttendees` | `integer` | The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional. |
| <a id="sendNotifications"></a>`sendNotifications` | `boolean` | Deprecated. Please use [sendUpdates](insert.md#sendUpdates) instead.<br><br><br><br>Whether to send notifications about the creation of the new event. Note that some emails might still be sent even if you set the value to `false`. The default is `false`. |
| <a id="sendUpdates"></a>`sendUpdates` | `string` | Whether to send notifications about the creation of the new event. Note that some emails might still be sent. The default is `false`. <br><br><br><br>Acceptable values are: <br><br><br><br>- "`all`": Notifications are sent to all guests.<br> <br>- "`externalOnly`": Notifications are sent to non-Google Calendar guests only.<br> <br>- "`none`": No notifications are sent. <br>  <br>  <br>  <br>  **Warning:** Using the value `none` can have significant adverse effects, including events not syncing to external calendars or events being lost altogether for some users. For calendar migration tasks, consider using the [events.import](import.md) method instead. |
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

In the request body, supply an [Events resource](../events.md#resource) with the following properties:

<a id="request_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="required-properties"></a>**Required Properties** |  |  |  |
| <a id="end"></a>`end` | `nested object` | The (exclusive) end time of the event. For a recurring event, this is the end time of the first instance. |  |
| <a id="start"></a>`start` | `nested object` | The (inclusive) start time of the event. For a recurring event, this is the start time of the first instance. |  |
| <a id="optional-properties"></a>**Optional Properties** |  |  |  |
| <a id="anyoneCanAddSelf"></a>`anyoneCanAddSelf` | `boolean` | Whether anyone can invite themselves to the event (deprecated). Optional. The default is False. | writable |
| <a id="attachments.fileUrl"></a>`attachments[].fileUrl` | `string` | URL link to the attachment. <br><br><br><br>For adding Google Drive file attachments use the same format as in `alternateLink` property of the `Files` resource in the Drive API.<br><br><br><br><br><br>Required when adding an attachment. | writable |
| <a id="attendees"></a>`attendees[]` | `list` | The attendees of the event. See the [Events with attendees](../../../concepts/sharing.md) guide for more information on scheduling events with other calendar users. Service accounts need to use [domain-wide delegation of authority](https://developers.google.com/calendar/auth#perform-g-suite-domain-wide-delegation-of-authority) to populate the attendee list. | writable |
| <a id="attendees.additionalGuests"></a>`attendees[].additionalGuests` | `integer` | Number of additional guests. Optional. The default is 0. | writable |
| <a id="attendees.comment"></a>`attendees[].comment` | `string` | The attendee's response comment. Optional. | writable |
| <a id="attendees.displayName"></a>`attendees[].displayName` | `string` | The attendee's name, if available. Optional. | writable |
| <a id="attendees.email"></a>`attendees[].email` | `string` | The attendee's email address, if available. This field must be present when adding an attendee. It must be a valid email address as per [RFC5322](https://tools.ietf.org/html/rfc5322#section-3.4). <br><br><br><br>Required when adding an attendee. | writable |
| <a id="attendees.optional"></a>`attendees[].optional` | `boolean` | Whether this is an optional attendee. Optional. The default is False. | writable |
| <a id="attendees.resource"></a>`attendees[].resource` | `boolean` | Whether the attendee is a resource. Can only be set when the attendee is added to the event for the first time. Subsequent modifications are ignored. Optional. The default is False. | writable |
| <a id="attendees.responseStatus"></a>`attendees[].responseStatus` | `string` | The attendee's response status. Possible values are: <br><br><br><br>- "`needsAction`" - The attendee has not responded to the invitation (recommended for new events).<br> <br>- "`declined`" - The attendee has declined the invitation.<br> <br>- "`tentative`" - The attendee has tentatively accepted the invitation.<br> <br>- "`accepted`" - The attendee has accepted the invitation.<br><br> <br><br><br><br>**Warning:** If you add an event using the values `declined`, `tentative`, or `accepted`, attendees with the "Add invitations to my calendar" setting set to "When I respond to invitation in email" or "Only if the sender is known" might have their response reset to `needsAction` and won't see an event in their calendar unless they change their response in the event invitation email. Furthermore, if more than 200 guests are invited to the event, response status is not propagated to the guests. | writable |
| <a id="birthdayProperties"></a>`birthdayProperties` | `nested object` | Birthday or special event data. Used if `eventType` is `"birthday"`. Immutable. | writable |
| <a id="birthdayProperties.type"></a>`birthdayProperties.type` | `string` | Type of birthday or special event. Possible values are: <br><br><br><br>- `"anniversary"` - An anniversary other than birthday. Always has a `contact`.<br> <br>- `"birthday"` - A birthday event. This is the default value.<br> <br>- `"custom"` - A special date whose label is further specified in the `customTypeName` field. Always has a `contact`.<br> <br>- `"other"` - A special date which does not fall into the other categories, and does not have a custom label. Always has a `contact`.<br> <br>- `"self"` - Calendar owner's own birthday. Cannot have a `contact`.<br><br> The Calendar API only supports creating events with the type `"birthday"`. The type cannot be changed after the event is created. | writable |
| <a id="colorId"></a>`colorId` | `string` | The color of the event. This is an ID referring to an entry in the `event` section of the colors definition (see the [ colors endpoint](../colors.md)). Optional. | writable |
| <a id="conferenceData"></a>`conferenceData` | `nested object` | The conference-related information, such as details of a Google Meet conference. To create new conference details use the `createRequest` field. To persist your changes, remember to set the `conferenceDataVersion` request parameter to `1` for all event modification requests. <br><br><br><br>**Warning:** Reusing Google Meet conference data across different events can cause access issues and expose meeting details to unintended users. To help ensure meeting privacy, always generate a unique conference for each event by using the `createRequest` field. | writable |
| <a id="description"></a>`description` | `string` | Description of the event. Can contain HTML. Optional. | writable |
| <a id="end.date"></a>`end.date` | `date` | The date, in the format "yyyy-mm-dd", if this is an all-day event. | writable |
| <a id="end.dateTime"></a>`end.dateTime` | `datetime` | The time, as a combined date-time value (formatted according to [RFC3339](https://tools.ietf.org/html/rfc3339)). A time zone offset is required unless a time zone is explicitly specified in `timeZone`. | writable |
| <a id="end.timeZone"></a>`end.timeZone` | `string` | The time zone in which the time is specified. (Formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich".) For recurring events this field is required and specifies the time zone in which the recurrence is expanded. For single events this field is optional and indicates a custom time zone for the event start/end. | writable |
| <a id="eventLabelId"></a>`eventLabelId` | `string` | The ID of the event label assigned to the event. Optional. This refers to the ID of an entry in the [`labelProperties.eventLabels`](../calendars.md#labelProperties.eventLabels) property of the calendar (see the [Calendars.get](../calendars/get.md) endpoint.) <br><br><br><br>This property supersedes the index-based [`colorId`](../events.md#colorId) property. To set or change this property, you need to specify `eventLabelVersion=1` in the parameters of the [insert](insert.md#eventLabelVersion), [import](import.md#eventLabelVersion), [update](update.md#eventLabelVersion), and [patch](patch.md#eventLabelVersion) methods.<br><br><br><br><br><br>Setting an empty string, or not setting this field at all, will remove the existing label from the event. | writable |
| <a id="eventType"></a>`eventType` | `string` | Specific type of the event. This cannot be modified after the event is created. Possible values are: <br><br><br><br>- "`birthday`" - A special all-day event with an annual recurrence.<br> <br>- "`default`" - A regular event or not further specified.<br> <br>- "`focusTime`" - A focus-time event.<br> <br>- "`fromGmail`" - An event from Gmail. This type of event cannot be created.<br> <br>- "`outOfOffice`" - An out-of-office event.<br> <br>- "`workingLocation`" - A working location event. | writable |
| <a id="extendedProperties.private"></a>`extendedProperties.private` | `object` | Properties that are private to the copy of the event that appears on this calendar. | writable |
| <a id="extendedProperties.shared"></a>`extendedProperties.shared` | `object` | Properties that are shared between copies of the event on other attendees' calendars. | writable |
| <a id="focusTimeProperties"></a>`focusTimeProperties` | `nested object` | Focus Time event data. Used if `eventType` is `focusTime`. | writable |
| <a id="gadget.display"></a>`gadget.display` | `string` | The gadget's display mode. Deprecated. Possible values are: <br><br><br><br>- "`icon`" - The gadget displays next to the event's title in the calendar view.<br> <br>- "`chip`" - The gadget displays when the event is clicked. | writable |
| <a id="gadget.height"></a>`gadget.height` | `integer` | The gadget's height in pixels. The height must be an integer greater than 0. Optional. Deprecated. | writable |
| <a id="gadget.iconLink"></a>`gadget.iconLink` | `string` | The gadget's icon URL. The URL scheme must be HTTPS. Deprecated. | writable |
| <a id="gadget.link"></a>`gadget.link` | `string` | The gadget's URL. The URL scheme must be HTTPS. Deprecated. | writable |
| <a id="gadget.preferences"></a>`gadget.preferences` | `object` | Preferences. | writable |
| <a id="gadget.title"></a>`gadget.title` | `string` | The gadget's title. Deprecated. | writable |
| <a id="gadget.type"></a>`gadget.type` | `string` | The gadget's type. Deprecated. | writable |
| <a id="gadget.width"></a>`gadget.width` | `integer` | The gadget's width in pixels. The width must be an integer greater than 0. Optional. Deprecated. | writable |
| <a id="guestsCanInviteOthers"></a>`guestsCanInviteOthers` | `boolean` | Whether attendees other than the organizer can invite others to the event. Optional. The default is True. | writable |
| <a id="guestsCanModify"></a>`guestsCanModify` | `boolean` | Whether attendees other than the organizer can modify the event. Optional. The default is False. | writable |
| <a id="guestsCanSeeOtherGuests"></a>`guestsCanSeeOtherGuests` | `boolean` | Whether attendees other than the organizer can see who the event's attendees are. Optional. The default is True. | writable |
| <a id="id"></a>`id` | `string` | Opaque identifier of the event. When creating new single or recurring events, you can specify their IDs. Provided IDs must follow these rules: <br><br><br><br>- characters allowed in the ID are those used in base32hex encoding, i.e. lowercase letters a-v and digits 0-9, see section 3.1.2 in [RFC2938](http://tools.ietf.org/html/rfc2938#section-3.1.2)<br> <br>- the length of the ID must be between 5 and 1024 characters<br> <br>- the ID must be unique per calendar<br><br> Due to the globally distributed nature of the system, we cannot guarantee that ID collisions will be detected at event creation time. To minimize the risk of collisions we recommend using an established UUID algorithm such as one described in [RFC4122](https://tools.ietf.org/html/rfc4122). <br><br><br><br>If you do not specify an ID, it will be automatically generated by the server.<br><br><br><br><br><br>Note that the `icalUID` and the `id` are not identical and only one of them should be supplied at event creation time. One difference in their semantics is that in recurring events, all occurrences of one event have different `id`s while they all share the same `icalUID`s. | writable |
| <a id="location"></a>`location` | `string` | Geographic location of the event as free-form text. Optional. | writable |
| <a id="originalStartTime.date"></a>`originalStartTime.date` | `date` | The date, in the format "yyyy-mm-dd", if this is an all-day event. | writable |
| <a id="originalStartTime.dateTime"></a>`originalStartTime.dateTime` | `datetime` | The time, as a combined date-time value (formatted according to [RFC3339](https://tools.ietf.org/html/rfc3339)). A time zone offset is required unless a time zone is explicitly specified in `timeZone`. | writable |
| <a id="originalStartTime.timeZone"></a>`originalStartTime.timeZone` | `string` | The time zone in which the time is specified. (Formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich".) For recurring events this field is required and specifies the time zone in which the recurrence is expanded. For single events this field is optional and indicates a custom time zone for the event start/end. | writable |
| <a id="outOfOfficeProperties"></a>`outOfOfficeProperties` | `nested object` | Out of office event data. Used if `eventType` is `outOfOffice`. | writable |
| <a id="recurrence"></a>`recurrence[]` | `list` | List of RRULE, EXRULE, RDATE and EXDATE lines for a recurring event, as specified in [RFC5545](http://tools.ietf.org/html/rfc5545#section-3.8.5). Note that DTSTART and DTEND lines are not allowed in this field; event start and end times are specified in the `start` and `end` fields. This field is omitted for single events or instances of recurring events. | writable |
| <a id="reminders.overrides"></a>`reminders.overrides[]` | `list` | If the event doesn't use the default reminders, this lists the reminders specific to the event, or, if not set, indicates that no reminders are set for this event. The maximum number of override reminders is 5. | writable |
| <a id="reminders.overrides.method"></a>`reminders.overrides[].method` | `string` | The method used by this reminder. Possible values are: <br><br><br><br>- "`email`" - Reminders are sent via email.<br> <br>- "`popup`" - Reminders are sent via a UI popup.<br><br> <br><br><br><br>Required when adding a reminder. | writable |
| <a id="reminders.overrides.minutes"></a>`reminders.overrides[].minutes` | `integer` | Number of minutes before the start of the event when the reminder should trigger. Valid values are between 0 and 40320 (4 weeks in minutes). <br><br><br><br>Required when adding a reminder. | writable |
| <a id="reminders.useDefault"></a>`reminders.useDefault` | `boolean` | Whether the default reminders of the calendar apply to the event. | writable |
| <a id="sequence"></a>`sequence` | `integer` | Sequence number as per iCalendar. | writable |
| <a id="source.title"></a>`source.title` | `string` | Title of the source; for example a title of a web page or an email subject. | writable |
| <a id="source.url"></a>`source.url` | `string` | URL of the source pointing to a resource. The URL scheme must be HTTP or HTTPS. | writable |
| <a id="start.date"></a>`start.date` | `date` | The date, in the format "yyyy-mm-dd", if this is an all-day event. | writable |
| <a id="start.dateTime"></a>`start.dateTime` | `datetime` | The time, as a combined date-time value (formatted according to [RFC3339](https://tools.ietf.org/html/rfc3339)). A time zone offset is required unless a time zone is explicitly specified in `timeZone`. | writable |
| <a id="start.timeZone"></a>`start.timeZone` | `string` | The time zone in which the time is specified. (Formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich".) For recurring events this field is required and specifies the time zone in which the recurrence is expanded. For single events this field is optional and indicates a custom time zone for the event start/end. | writable |
| <a id="status"></a>`status` | `string` | Status of the event. Optional. Possible values are: <br><br><br><br>- "`confirmed`" - The event is confirmed. This is the default status.<br> <br>- "`tentative`" - The event is tentatively confirmed.<br> <br>- "`cancelled`" - The event is cancelled (deleted). The [list](list.md) method returns cancelled events only on incremental sync (when `syncToken` or `updatedMin` are specified) or if the `showDeleted` flag is set to `true`. The [get](get.md) method always returns them. <br>  <br>  <br>  <br>  A cancelled status represents two different states depending on the event type:<br>  <br>  <br>  <br>  <br>  <br>  - Cancelled exceptions of an uncancelled recurring event indicate that this instance should no longer be presented to the user. Clients should store these events for the lifetime of the parent recurring event. <br>    <br>    <br>    <br>    Cancelled exceptions are only guaranteed to have values for the `id`, `recurringEventId` and `originalStartTime` fields populated. The other fields might be empty.<br>   <br>  - All other cancelled events represent deleted events. Clients should remove their locally synced copies. Such cancelled events will eventually disappear, so do not rely on them being available indefinitely. <br>    <br>    <br>    <br>    Deleted events are only guaranteed to have the `id` field populated.<br>  <br>   On the organizer's calendar, cancelled events continue to expose event details (summary, location, etc.) so that they can be restored (undeleted). Similarly, the events to which the user was invited and that they manually removed continue to provide details. However, incremental sync requests with `showDeleted` set to false will not return these details. <br>  <br>  <br>  <br>  If an event changes its organizer (for example via the [move](move.md) operation) and the original organizer is not on the attendee list, it will leave behind a cancelled event where only the `id` field is guaranteed to be populated. | writable |
| <a id="summary"></a>`summary` | `string` | Title of the event. | writable |
| <a id="transparency"></a>`transparency` | `string` | Whether the event blocks time on the calendar. Optional. Possible values are: <br><br><br><br>- "`opaque`" - Default value. The event does block time on the calendar. This is equivalent to setting **Show me as** to **Busy** in the Calendar UI.<br> <br>- "`transparent`" - The event does not block time on the calendar. This is equivalent to setting **Show me as** to **Available** in the Calendar UI. | writable |
| <a id="visibility"></a>`visibility` | `string` | Visibility of the event. Optional. Possible values are: <br><br><br><br>- "`default`" - Uses the default visibility for events on the calendar. This is the default value.<br> <br>- "`public`" - The event is public and event details are visible to all readers of the calendar.<br> <br>- "`private`" - The event is private and only event attendees may view event details.<br> <br>- "`confidential`" - The event is private. This value is provided for compatibility reasons.<br><br> <br><br><br><br>**Note on recurring events:** Changing the visibility of a single instance of a recurring event can affect all instances of the series. If the new setting is more restrictive (e.g. from public to private), it is applied to all instances. If the new setting is less restrictive (e.g. from private to public), the change is ignored. To make a recurring event less restrictive, you must update the parent recurring event. | writable |
| <a id="workingLocationProperties"></a>`workingLocationProperties` | `nested object` | Working location event data. | writable |
| <a id="workingLocationProperties.customLocation"></a>`workingLocationProperties.customLocation` | `object` | If present, specifies that the user is working from a custom location. | writable |
| <a id="workingLocationProperties.customLocation.label"></a>`workingLocationProperties.customLocation.label` | `string` | An optional extra label for additional information. | writable |
| <a id="workingLocationProperties.homeOffice"></a>`workingLocationProperties.homeOffice` | `any value` | If present, specifies that the user is working at home. | writable |
| <a id="workingLocationProperties.officeLocation"></a>`workingLocationProperties.officeLocation` | `object` | If present, specifies that the user is working from an office. | writable |
| <a id="workingLocationProperties.officeLocation.buildingId"></a>`workingLocationProperties.officeLocation.buildingId` | `string` | An optional building identifier. This should reference a building ID in the organization's Resources database. | writable |
| <a id="workingLocationProperties.officeLocation.deskId"></a>`workingLocationProperties.officeLocation.deskId` | `string` | An optional desk identifier. | writable |
| <a id="workingLocationProperties.officeLocation.floorId"></a>`workingLocationProperties.officeLocation.floorId` | `string` | An optional floor identifier. | writable |
| <a id="workingLocationProperties.officeLocation.floorSectionId"></a>`workingLocationProperties.officeLocation.floorSectionId` | `string` | An optional floor section identifier. | writable |
| <a id="workingLocationProperties.officeLocation.label"></a>`workingLocationProperties.officeLocation.label` | `string` | The office name that's displayed in Calendar Web and Mobile clients. We recommend you reference a building name in the organization's Resources database. | writable |
| <a id="workingLocationProperties.type"></a>`workingLocationProperties.type` | `string` | Type of the working location. Possible values are: <br><br><br><br>- "`homeOffice`" - The user is working at home.<br> <br>- "`officeLocation`" - The user is working from an office.<br> <br>- "`customLocation`" - The user is working from a custom location.<br><br> Any details are specified in a sub-field of the specified name, but this field may be missing if empty. Any other fields are ignored. <br><br><br><br>Required when adding working location properties. | writable |

<a id="response"></a>

## Response

If successful, this method returns an [Events resource](../events.md#resource) in the response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
