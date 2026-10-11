# Events

Source: https://developers.google.com/workspace/calendar/api/v3/reference/events

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-07.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../pages/v3/reference/events.html>); no article content intentionally omitted.

---

<a id="overview"></a>

The Calendar API provides different flavors of event resources, more information can be found in [About events](../../concepts.md#events_resource).

For a list of [methods](events.md#methods) for this resource, see the end of this page.

<a id="resource"></a>

<a id="resource-representations"></a>

## Resource representations

<a id="alt-json"></a>

```Carbon
{
  "kind": "calendar#event",
  "etag": etag,
  "id": string,
  "status": string,
  "htmlLink": string,
  "created": datetime,
  "updated": datetime,
  "summary": string,
  "description": string,
  "location": string,
  "colorId": string,
  "eventLabelId": string,
  "creator": {
    "id": string,
    "email": string,
    "displayName": string,
    "self": boolean
  },
  "organizer": {
    "id": string,
    "email": string,
    "displayName": string,
    "self": boolean
  },
  "start": {
    "date": date,
    "dateTime": datetime,
    "timeZone": string
  },
  "end": {
    "date": date,
    "dateTime": datetime,
    "timeZone": string
  },
  "endTimeUnspecified": boolean,
  "recurrence": [
    string
  ],
  "recurringEventId": string,
  "originalStartTime": {
    "date": date,
    "dateTime": datetime,
    "timeZone": string
  },
  "transparency": string,
  "visibility": string,
  "iCalUID": string,
  "sequence": integer,
  "attendees": [
    {
      "id": string,
      "email": string,
      "displayName": string,
      "organizer": boolean,
      "self": boolean,
      "resource": boolean,
      "optional": boolean,
      "responseStatus": string,
      "comment": string,
      "additionalGuests": integer,
      "asyncOperation": string
    }
  ],
  "attendeesOmitted": boolean,
  "extendedProperties": {
    "private": {
      (key): string
    },
    "shared": {
      (key): string
    }
  },
  "hangoutLink": string,
  "conferenceData": {
    "createRequest": {
      "requestId": string,
      "conferenceSolutionKey": {
        "type": string
      },
      "status": {
        "statusCode": string
      }
    },
    "entryPoints": [
      {
        "entryPointType": string,
        "uri": string,
        "label": string,
        "pin": string,
        "accessCode": string,
        "meetingCode": string,
        "passcode": string,
        "password": string
      }
    ],
    "conferenceSolution": {
      "key": {
        "type": string
      },
      "name": string,
      "iconUri": string
    },
    "conferenceId": string,
    "signature": string,
    "notes": string,
  },
  "gadget": {
    "type": string,
    "title": string,
    "link": string,
    "iconLink": string,
    "width": integer,
    "height": integer,
    "display": string,
    "preferences": {
      (key): string
    }
  },
  "anyoneCanAddSelf": boolean,
  "guestsCanInviteOthers": boolean,
  "guestsCanModify": boolean,
  "guestsCanSeeOtherGuests": boolean,
  "privateCopy": boolean,
  "locked": boolean,
  "reminders": {
    "useDefault": boolean,
    "overrides": [
      {
        "method": string,
        "minutes": integer
      }
    ]
  },
  "source": {
    "url": string,
    "title": string
  },
  "workingLocationProperties": {
    "type": string,
    "homeOffice": (value),
    "customLocation": {
      "label": string
    },
    "officeLocation": {
      "buildingId": string,
      "floorId": string,
      "floorSectionId": string,
      "deskId": string,
      "label": string
    }
  },
  "outOfOfficeProperties": {
    "autoDeclineMode": string,
    "declineMessage": string
  },
  "focusTimeProperties": {
    "autoDeclineMode": string,
    "declineMessage": string,
    "chatStatus": string
  },
  "attachments": [
    {
      "fileUrl": string,
      "title": string,
      "mimeType": string,
      "iconLink": string,
      "fileId": string
    }
  ],
  "birthdayProperties": {
    "contact": string,
    "type": string,
    "customTypeName": string
  },
  "eventType": string
}
```


<a id="properties"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="anyoneCanAddSelf"></a>`anyoneCanAddSelf` | `boolean` | Whether anyone can invite themselves to the event (deprecated). Optional. The default is False. | writable |
| <a id="attachments"></a>`attachments[]` | `list` | File attachments for the event. <br><br><br><br>In order to modify attachments the `supportsAttachments` request parameter should be set to `true`.<br><br><br><br><br><br>There can be at most 25 attachments per event, |  |
| <a id="attachments.fileId"></a>`attachments[].fileId` | `string` | ID of the attached file. Read-only. <br><br><br><br>For Google Drive files, this is the ID of the corresponding [`Files`](https://developers.google.com/drive/v3/reference/files) resource entry in the Drive API. |  |
| <a id="attachments.fileUrl"></a>`attachments[].fileUrl` | `string` | URL link to the attachment. <br><br><br><br>For adding Google Drive file attachments use the same format as in `alternateLink` property of the `Files` resource in the Drive API.<br><br><br><br><br><br>Required when adding an attachment. | writable |
| <a id="attachments.iconLink"></a>`attachments[].iconLink` | `string` | URL link to the attachment's icon. This field can only be modified for custom third-party attachments. |  |
| <a id="attachments.mimeType"></a>`attachments[].mimeType` | `string` | Internet media type (MIME type) of the attachment. |  |
| <a id="attachments.title"></a>`attachments[].title` | `string` | Attachment title. |  |
| <a id="attendeesOmitted"></a>`attendeesOmitted` | `boolean` | Whether attendees may have been omitted from the event's representation. When retrieving an event, this may be due to a restriction specified by the `maxAttendee` query parameter. When updating an event, this can be used to only update the participant's response. Optional. The default is False. | writable |
| <a id="attendees"></a>`attendees[]` | `list` | The attendees of the event. See the [Events with attendees](../../concepts/sharing.md) guide for more information on scheduling events with other calendar users. Service accounts need to use [domain-wide delegation of authority](https://developers.google.com/calendar/auth#perform-g-suite-domain-wide-delegation-of-authority) to populate the attendee list. | writable |
| <a id="attendees.additionalGuests"></a>`attendees[].additionalGuests` | `integer` | Number of additional guests. Optional. The default is 0. | writable |
| <a id="attendees.asyncOperation"></a>`attendees[].asyncOperation` | `string` | If present, indicates the status of an asynchronous operation ongoing for this attendee (e.g. listing of members of large attendee groups). Read-only. The default is to not be present. <br><br><br><br>Possible values are:<br><br><br><br><br><br>- "`inProgress`" - The asynchronous operation is in progress.<br> <br>- (not present) - Otherwise. |  |
| <a id="attendees.comment"></a>`attendees[].comment` | `string` | The attendee's response comment. Optional. | writable |
| <a id="attendees.displayName"></a>`attendees[].displayName` | `string` | The attendee's name, if available. Optional. | writable |
| <a id="attendees.email"></a>`attendees[].email` | `string` | The attendee's email address, if available. This field must be present when adding an attendee. It must be a valid email address as per [RFC5322](https://tools.ietf.org/html/rfc5322#section-3.4). <br><br><br><br>Required when adding an attendee. | writable |
| <a id="attendees.id"></a>`attendees[].id` | `string` | The attendee's Profile ID, if available. |  |
| <a id="attendees.optional"></a>`attendees[].optional` | `boolean` | Whether this is an optional attendee. Optional. The default is False. | writable |
| <a id="attendees.organizer"></a>`attendees[].organizer` | `boolean` | Whether the attendee is the organizer of the event. Read-only. The default is False. |  |
| <a id="attendees.resource"></a>`attendees[].resource` | `boolean` | Whether the attendee is a resource. Can only be set when the attendee is added to the event for the first time. Subsequent modifications are ignored. Optional. The default is False. | writable |
| <a id="attendees.responseStatus"></a>`attendees[].responseStatus` | `string` | The attendee's response status. Possible values are: <br><br><br><br>- "`needsAction`" - The attendee has not responded to the invitation (recommended for new events).<br> <br>- "`declined`" - The attendee has declined the invitation.<br> <br>- "`tentative`" - The attendee has tentatively accepted the invitation.<br> <br>- "`accepted`" - The attendee has accepted the invitation.<br><br> <br><br><br><br>**Warning:** If you add an event using the values `declined`, `tentative`, or `accepted`, attendees with the "Add invitations to my calendar" setting set to "When I respond to invitation in email" or "Only if the sender is known" might have their response reset to `needsAction` and won't see an event in their calendar unless they change their response in the event invitation email. Furthermore, if more than 200 guests are invited to the event, response status is not propagated to the guests. | writable |
| <a id="attendees.self"></a>`attendees[].self` | `boolean` | Whether this entry represents the calendar on which this copy of the event appears. Read-only. The default is False. |  |
| <a id="birthdayProperties"></a>`birthdayProperties` | `nested object` | Birthday or special event data. Used if `eventType` is `"birthday"`. Immutable. | writable |
| <a id="birthdayProperties.contact"></a>`birthdayProperties.contact` | `string` | Resource name of the contact this birthday event is linked to. This can be used to fetch contact details from [People API](https://developers.google.com/people). Format: `"people/c12345"`. Read-only. |  |
| <a id="birthdayProperties.customTypeName"></a>`birthdayProperties.customTypeName` | `string` | Custom type label specified for this event. This is populated if `birthdayProperties.type` is set to `"custom"`. Read-only. |  |
| <a id="birthdayProperties.type"></a>`birthdayProperties.type` | `string` | Type of birthday or special event. Possible values are: <br><br><br><br>- `"anniversary"` - An anniversary other than birthday. Always has a `contact`.<br> <br>- `"birthday"` - A birthday event. This is the default value.<br> <br>- `"custom"` - A special date whose label is further specified in the `customTypeName` field. Always has a `contact`.<br> <br>- `"other"` - A special date which does not fall into the other categories, and does not have a custom label. Always has a `contact`.<br> <br>- `"self"` - Calendar owner's own birthday. Cannot have a `contact`.<br><br> The Calendar API only supports creating events with the type `"birthday"`. The type cannot be changed after the event is created. | writable |
| <a id="colorId"></a>`colorId` | `string` | The color of the event. This is an ID referring to an entry in the `event` section of the colors definition (see the [ colors endpoint](colors.md)). Optional. | writable |
| <a id="conferenceData"></a>`conferenceData` | `nested object` | The conference-related information, such as details of a Google Meet conference. To create new conference details use the `createRequest` field. To persist your changes, remember to set the `conferenceDataVersion` request parameter to `1` for all event modification requests. <br><br><br><br>**Warning:** Reusing Google Meet conference data across different events can cause access issues and expose meeting details to unintended users. To help ensure meeting privacy, always generate a unique conference for each event by using the `createRequest` field. | writable |
| <a id="conferenceData.conferenceId"></a>`conferenceData.conferenceId` | `string` | The ID of the conference. <br><br><br><br>Can be used by developers to keep track of conferences, should not be displayed to users.<br><br><br><br><br><br>The ID value is formed differently for each conference solution type:<br><br><br><br><br><br>- `eventHangout`: ID is not set. (This conference type is deprecated.)<br><br>- `eventNamedHangout`: ID is the name of the Hangout. (This conference type is deprecated.)<br><br>- `hangoutsMeet`: ID is the 10-letter meeting code, for example `aaa-bbbb-ccc`.<br><br>- `addOn`: ID is defined by the third-party provider.<br><br> Optional. |  |
| <a id="conferenceData.conferenceSolution"></a>`conferenceData.conferenceSolution` | `nested object` | The conference solution, such as Google Meet. <br><br><br><br>Unset for a conference with a failed create request.<br><br><br><br><br><br>Either `conferenceSolution` and at least one `entryPoint`, or `createRequest` is required. |  |
| <a id="conferenceData.conferenceSolution.iconUri"></a>`conferenceData.conferenceSolution.iconUri` | `string` | The user-visible icon for this solution. |  |
| <a id="conferenceData.conferenceSolution.key"></a>`conferenceData.conferenceSolution.key` | `nested object` | The key which can uniquely identify the conference solution for this event. |  |
| <a id="conferenceData.conferenceSolution.key.type"></a>`conferenceData.conferenceSolution.key.type` | `string` | The conference solution type. <br><br><br><br>If a client encounters an unfamiliar or empty type, it should still be able to display the entry points. However, it should disallow modifications.<br><br><br><br><br><br>The possible values are:<br><br><br><br><br><br>- `"eventHangout"` for Hangouts for consumers (deprecated; existing events may show this conference solution type but new conferences cannot be created)<br><br>- `"eventNamedHangout"` for classic Hangouts for Google Workspace users (deprecated; existing events may show this conference solution type but new conferences cannot be created)<br><br>- `"hangoutsMeet"` for Google Meet (http://meet.google.com)<br><br>- `"addOn"` for 3P conference providers |  |
| <a id="conferenceData.conferenceSolution.name"></a>`conferenceData.conferenceSolution.name` | `string` | The user-visible name of this solution. Not localized. |  |
| <a id="conferenceData.createRequest"></a>`conferenceData.createRequest` | `nested object` | A request to generate a new conference and attach it to the event. The data is generated asynchronously. To see whether the data is present check the `status` field. <br><br><br><br>Either `conferenceSolution` and at least one `entryPoint`, or `createRequest` is required. |  |
| <a id="conferenceData.createRequest.conferenceSolutionKey"></a>`conferenceData.createRequest.conferenceSolutionKey` | `nested object` | The conference solution, such as Hangouts or Google Meet. |  |
| <a id="conferenceData.createRequest.conferenceSolutionKey.type"></a>`conferenceData.createRequest.conferenceSolutionKey.type` | `string` | The conference solution type. <br><br><br><br>If a client encounters an unfamiliar or empty type, it should still be able to display the entry points. However, it should disallow modifications.<br><br><br><br><br><br>The possible values are:<br><br><br><br><br><br>- `"eventHangout"` for Hangouts for consumers (deprecated; existing events may show this conference solution type but new conferences cannot be created)<br><br>- `"eventNamedHangout"` for classic Hangouts for Google Workspace users (deprecated; existing events may show this conference solution type but new conferences cannot be created)<br><br>- `"hangoutsMeet"` for Google Meet (http://meet.google.com)<br><br>- `"addOn"` for 3P conference providers |  |
| <a id="conferenceData.createRequest.requestId"></a>`conferenceData.createRequest.requestId` | `string` | The client-generated unique ID for this request. <br><br><br><br>Clients should regenerate this ID for every new request. If an ID provided is the same as for the previous request, the request is ignored. |  |
| <a id="conferenceData.createRequest.status"></a>`conferenceData.createRequest.status` | `nested object` | The status of the conference create request. |  |
| <a id="conferenceData.createRequest.status.statusCode"></a>`conferenceData.createRequest.status.statusCode` | `string` | The current status of the conference create request. Read-only. <br><br><br><br>The possible values are:<br><br><br><br><br><br>- `"pending"`: the conference create request is still being processed.<br><br>- `"success"`: the conference create request succeeded, the entry points are populated.<br><br>- `"failure"`: the conference create request failed, there are no entry points. |  |
| <a id="conferenceData.entryPoints"></a>`conferenceData.entryPoints[]` | `list` | Information about individual conference entry points, such as URLs or phone numbers. <br><br><br><br>All of them must belong to the same conference.<br><br><br><br><br><br>Either `conferenceSolution` and at least one `entryPoint`, or `createRequest` is required. |  |
| <a id="conferenceData.entryPoints.accessCode"></a>`conferenceData.entryPoints[].accessCode` | `string` | The access code to access the conference. The maximum length is 128 characters. <br><br><br><br>When creating new conference data, populate only the subset of {`meetingCode`, `accessCode`, `passcode`, `password`, `pin`} fields that match the terminology that the conference provider uses. Only the populated fields should be displayed.<br><br><br><br><br><br>Optional. |  |
| <a id="conferenceData.entryPoints.entryPointType"></a>`conferenceData.entryPoints[].entryPointType` | `string` | The type of the conference entry point. <br><br><br><br>Possible values are:<br><br><br><br><br><br>- `"video"` - joining a conference over HTTP. A conference can have zero or one `video` entry point.<br><br>- `"phone"` - joining a conference by dialing a phone number. A conference can have zero or more `phone` entry points.<br><br>- `"sip"` - joining a conference over SIP. A conference can have zero or one `sip` entry point.<br><br>- `"more"` - further conference joining instructions, for example additional phone numbers. A conference can have zero or one `more` entry point. A conference with only a `more` entry point is not a valid conference. |  |
| <a id="conferenceData.entryPoints.label"></a>`conferenceData.entryPoints[].label` | `string` | The label for the URI. Visible to end users. Not localized. The maximum length is 512 characters. <br><br><br><br>Examples:<br><br><br><br><br><br>- for `video`: meet.google.com/aaa-bbbb-ccc<br><br>- for `phone`: +1 123 268 2601<br><br>- for `sip`: 12345678@altostrat.com<br><br>- for `more`: should not be filled<br><br> <br><br><br><br>Optional. |  |
| <a id="conferenceData.entryPoints.meetingCode"></a>`conferenceData.entryPoints[].meetingCode` | `string` | The meeting code to access the conference. The maximum length is 128 characters. <br><br><br><br>When creating new conference data, populate only the subset of {`meetingCode`, `accessCode`, `passcode`, `password`, `pin`} fields that match the terminology that the conference provider uses. Only the populated fields should be displayed.<br><br><br><br><br><br>Optional. |  |
| <a id="conferenceData.entryPoints.passcode"></a>`conferenceData.entryPoints[].passcode` | `string` | The passcode to access the conference. The maximum length is 128 characters. <br><br><br><br>When creating new conference data, populate only the subset of {`meetingCode`, `accessCode`, `passcode`, `password`, `pin`} fields that match the terminology that the conference provider uses. Only the populated fields should be displayed. |  |
| <a id="conferenceData.entryPoints.password"></a>`conferenceData.entryPoints[].password` | `string` | The password to access the conference. The maximum length is 128 characters. <br><br><br><br>When creating new conference data, populate only the subset of {`meetingCode`, `accessCode`, `passcode`, `password`, `pin`} fields that match the terminology that the conference provider uses. Only the populated fields should be displayed.<br><br><br><br><br><br>Optional. |  |
| <a id="conferenceData.entryPoints.pin"></a>`conferenceData.entryPoints[].pin` | `string` | The PIN to access the conference. The maximum length is 128 characters. <br><br><br><br>When creating new conference data, populate only the subset of {`meetingCode`, `accessCode`, `passcode`, `password`, `pin`} fields that match the terminology that the conference provider uses. Only the populated fields should be displayed.<br><br><br><br><br><br>Optional. |  |
| <a id="conferenceData.entryPoints.uri"></a>`conferenceData.entryPoints[].uri` | `string` | The URI of the entry point. The maximum length is 1300 characters. <br><br><br><br>Format:<br><br><br><br><br><br>- for `video`, `http:` or `https:` schema is required.<br><br>- for `phone`, `tel:` schema is required. The URI should include the entire dial sequence (e.g., tel:+12345678900,,,123456789;1234).<br><br>- for `sip`, `sip:` schema is required, e.g., sip:12345678@myprovider.com.<br><br>- for `more`, `http:` or `https:` schema is required. |  |
| <a id="conferenceData.notes"></a>`conferenceData.notes` | `string` | Additional notes (such as instructions from the domain administrator, legal notices) to display to the user. Can contain HTML. The maximum length is 2048 characters. Optional. |  |
| <a id="conferenceData.signature"></a>`conferenceData.signature` | `string` | The signature of the conference data. <br><br><br><br>Generated on server side.<br><br><br><br><br><br>Unset for a conference with a failed create request.<br><br><br><br><br><br>Optional for a conference with a pending create request. |  |
| <a id="created"></a>`created` | `datetime` | Creation time of the event (as a [RFC3339](https://tools.ietf.org/html/rfc3339) timestamp). Read-only. |  |
| <a id="creator"></a>`creator` | `object` | The creator of the event. Read-only. |  |
| <a id="creator.displayName"></a>`creator.displayName` | `string` | The creator's name, if available. |  |
| <a id="creator.email"></a>`creator.email` | `string` | The creator's email address, if available. |  |
| <a id="creator.id"></a>`creator.id` | `string` | The creator's Profile ID, if available. |  |
| <a id="creator.self"></a>`creator.self` | `boolean` | Whether the creator corresponds to the calendar on which this copy of the event appears. Read-only. The default is False. |  |
| <a id="description"></a>`description` | `string` | Description of the event. Can contain HTML. Optional. | writable |
| <a id="end"></a>`end` | `nested object` | The (exclusive) end time of the event. For a recurring event, this is the end time of the first instance. |  |
| <a id="end.date"></a>`end.date` | `date` | The date, in the format "yyyy-mm-dd", if this is an all-day event. | writable |
| <a id="end.dateTime"></a>`end.dateTime` | `datetime` | The time, as a combined date-time value (formatted according to [RFC3339](https://tools.ietf.org/html/rfc3339)). A time zone offset is required unless a time zone is explicitly specified in `timeZone`. | writable |
| <a id="end.timeZone"></a>`end.timeZone` | `string` | The time zone in which the time is specified. (Formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich".) For recurring events this field is required and specifies the time zone in which the recurrence is expanded. For single events this field is optional and indicates a custom time zone for the event start/end. | writable |
| <a id="endTimeUnspecified"></a>`endTimeUnspecified` | `boolean` | Whether the end time is actually unspecified. An end time is still provided for compatibility reasons, even if this attribute is set to True. The default is False. |  |
| <a id="etag"></a>`etag` | `etag` | ETag of the resource. |  |
| <a id="eventLabelId"></a>`eventLabelId` | `string` | The ID of the event label assigned to the event. Optional. This refers to the ID of an entry in the [`labelProperties.eventLabels`](calendars.md#labelProperties.eventLabels) property of the calendar (see the [Calendars.get](calendars/get.md) endpoint.) <br><br><br><br>This property supersedes the index-based [`colorId`](events.md#colorId) property. To set or change this property, you need to specify `eventLabelVersion=1` in the parameters of the [insert](events/insert.md#eventLabelVersion), [import](events/import.md#eventLabelVersion), [update](events/update.md#eventLabelVersion), and [patch](events/patch.md#eventLabelVersion) methods.<br><br><br><br><br><br>Setting an empty string, or not setting this field at all, will remove the existing label from the event. | writable |
| <a id="eventType"></a>`eventType` | `string` | Specific type of the event. This cannot be modified after the event is created. Possible values are: <br><br><br><br>- "`birthday`" - A special all-day event with an annual recurrence.<br> <br>- "`default`" - A regular event or not further specified.<br> <br>- "`focusTime`" - A focus-time event.<br> <br>- "`fromGmail`" - An event from Gmail. This type of event cannot be created.<br> <br>- "`outOfOffice`" - An out-of-office event.<br> <br>- "`workingLocation`" - A working location event. | writable |
| <a id="extendedProperties"></a>`extendedProperties` | `object` | Extended properties of the event. |  |
| <a id="extendedProperties.private"></a>`extendedProperties.private` | `object` | Properties that are private to the copy of the event that appears on this calendar. | writable |
| <a id="extendedProperties.private.(key)"></a>`extendedProperties.private.(key)` | `string` | The name of the private property and the corresponding value. |  |
| <a id="extendedProperties.shared"></a>`extendedProperties.shared` | `object` | Properties that are shared between copies of the event on other attendees' calendars. | writable |
| <a id="extendedProperties.shared.(key)"></a>`extendedProperties.shared.(key)` | `string` | The name of the shared property and the corresponding value. |  |
| <a id="focusTimeProperties"></a>`focusTimeProperties` | `nested object` | Focus Time event data. Used if `eventType` is `focusTime`. | writable |
| <a id="focusTimeProperties.autoDeclineMode"></a>`focusTimeProperties.autoDeclineMode` | `string` | Whether to decline meeting invitations which overlap Focus Time events. Valid values are `declineNone`, meaning that no meeting invitations are declined; `declineAllConflictingInvitations`, meaning that all conflicting meeting invitations that conflict with the event are declined; and `declineOnlyNewConflictingInvitations`, meaning that only new conflicting meeting invitations which arrive while the Focus Time event is present are to be declined. |  |
| <a id="focusTimeProperties.chatStatus"></a>`focusTimeProperties.chatStatus` | `string` | The status to mark the user in Chat and related products. This can be `available` or `doNotDisturb`. |  |
| <a id="focusTimeProperties.declineMessage"></a>`focusTimeProperties.declineMessage` | `string` | Response message to set if an existing event or new invitation is automatically declined by Calendar. |  |
| <a id="gadget"></a>`gadget` | `object` | A gadget that extends this event. Gadgets are deprecated; this structure is instead only used for returning birthday calendar metadata. |  |
| <a id="gadget.display"></a>`gadget.display` | `string` | The gadget's display mode. Deprecated. Possible values are: <br><br><br><br>- "`icon`" - The gadget displays next to the event's title in the calendar view.<br> <br>- "`chip`" - The gadget displays when the event is clicked. | writable |
| <a id="gadget.height"></a>`gadget.height` | `integer` | The gadget's height in pixels. The height must be an integer greater than 0. Optional. Deprecated. | writable |
| <a id="gadget.iconLink"></a>`gadget.iconLink` | `string` | The gadget's icon URL. The URL scheme must be HTTPS. Deprecated. | writable |
| <a id="gadget.link"></a>`gadget.link` | `string` | The gadget's URL. The URL scheme must be HTTPS. Deprecated. | writable |
| <a id="gadget.preferences"></a>`gadget.preferences` | `object` | Preferences. | writable |
| <a id="gadget.preferences.(key)"></a>`gadget.preferences.(key)` | `string` | The preference name and corresponding value. |  |
| <a id="gadget.title"></a>`gadget.title` | `string` | The gadget's title. Deprecated. | writable |
| <a id="gadget.type"></a>`gadget.type` | `string` | The gadget's type. Deprecated. | writable |
| <a id="gadget.width"></a>`gadget.width` | `integer` | The gadget's width in pixels. The width must be an integer greater than 0. Optional. Deprecated. | writable |
| <a id="guestsCanInviteOthers"></a>`guestsCanInviteOthers` | `boolean` | Whether attendees other than the organizer can invite others to the event. Optional. The default is True. | writable |
| <a id="guestsCanModify"></a>`guestsCanModify` | `boolean` | Whether attendees other than the organizer can modify the event. Optional. The default is False. | writable |
| <a id="guestsCanSeeOtherGuests"></a>`guestsCanSeeOtherGuests` | `boolean` | Whether attendees other than the organizer can see who the event's attendees are. Optional. The default is True. | writable |
| <a id="hangoutLink"></a>`hangoutLink` | `string` | An absolute link to the Google Hangout associated with this event. Read-only. |  |
| <a id="htmlLink"></a>`htmlLink` | `string` | An absolute link to this event in the Google Calendar Web UI. Read-only. |  |
| <a id="iCalUID"></a>`iCalUID` | `string` | Event unique identifier as defined in [RFC5545](https://tools.ietf.org/html/rfc5545#section-3.8.4.7). It is used to uniquely identify events accross calendaring systems and must be supplied when importing events via the [import](events/import.md) method. <br><br><br><br>Note that the `iCalUID` and the `id` are not identical and only one of them should be supplied at event creation time. One difference in their semantics is that in recurring events, all occurrences of one event have different `id`s while they all share the same `iCalUID`s. To retrieve an event using its `iCalUID`, call the [events.list method using the `iCalUID` parameter](events/list.md#iCalUID). To retrieve an event using its `id`, call the [events.get](events/get.md) method. |  |
| <a id="id"></a>`id` | `string` | Opaque identifier of the event. When creating new single or recurring events, you can specify their IDs. Provided IDs must follow these rules: <br><br><br><br>- characters allowed in the ID are those used in base32hex encoding, i.e. lowercase letters a-v and digits 0-9, see section 3.1.2 in [RFC2938](http://tools.ietf.org/html/rfc2938#section-3.1.2)<br> <br>- the length of the ID must be between 5 and 1024 characters<br> <br>- the ID must be unique per calendar<br><br> Due to the globally distributed nature of the system, we cannot guarantee that ID collisions will be detected at event creation time. To minimize the risk of collisions we recommend using an established UUID algorithm such as one described in [RFC4122](https://tools.ietf.org/html/rfc4122). <br><br><br><br>If you do not specify an ID, it will be automatically generated by the server.<br><br><br><br><br><br>Note that the `icalUID` and the `id` are not identical and only one of them should be supplied at event creation time. One difference in their semantics is that in recurring events, all occurrences of one event have different `id`s while they all share the same `icalUID`s. | writable |
| <a id="kind"></a>`kind` | `string` | Type of the resource ("`calendar#event`"). |  |
| <a id="location"></a>`location` | `string` | Geographic location of the event as free-form text. Optional. | writable |
| <a id="locked"></a>`locked` | `boolean` | Whether this is a locked event copy where no changes can be made to the main event fields "summary", "description", "location", "start", "end" or "recurrence". The default is False. Read-Only. |  |
| <a id="organizer"></a>`organizer` | `object` | The organizer of the event. If the organizer is also an attendee, this is indicated with a separate entry in `attendees` with the `organizer` field set to True. To change the organizer, use the [move](events/move.md) operation. Read-only, except when importing an event. | writable |
| <a id="organizer.displayName"></a>`organizer.displayName` | `string` | The organizer's name, if available. | writable |
| <a id="organizer.email"></a>`organizer.email` | `string` | The organizer's email address, if available. It must be a valid email address as per [RFC5322](https://tools.ietf.org/html/rfc5322#section-3.4). | writable |
| <a id="organizer.id"></a>`organizer.id` | `string` | The organizer's Profile ID, if available. |  |
| <a id="organizer.self"></a>`organizer.self` | `boolean` | Whether the organizer corresponds to the calendar on which this copy of the event appears. Read-only. The default is False. |  |
| <a id="originalStartTime"></a>`originalStartTime` | `nested object` | For an instance of a recurring event, this is the time at which this event would start according to the recurrence data in the recurring event identified by recurringEventId. It uniquely identifies the instance within the recurring event series even if the instance was moved to a different time. Immutable. |  |
| <a id="originalStartTime.date"></a>`originalStartTime.date` | `date` | The date, in the format "yyyy-mm-dd", if this is an all-day event. | writable |
| <a id="originalStartTime.dateTime"></a>`originalStartTime.dateTime` | `datetime` | The time, as a combined date-time value (formatted according to [RFC3339](https://tools.ietf.org/html/rfc3339)). A time zone offset is required unless a time zone is explicitly specified in `timeZone`. | writable |
| <a id="originalStartTime.timeZone"></a>`originalStartTime.timeZone` | `string` | The time zone in which the time is specified. (Formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich".) For recurring events this field is required and specifies the time zone in which the recurrence is expanded. For single events this field is optional and indicates a custom time zone for the event start/end. | writable |
| <a id="outOfOfficeProperties"></a>`outOfOfficeProperties` | `nested object` | Out of office event data. Used if `eventType` is `outOfOffice`. | writable |
| <a id="outOfOfficeProperties.autoDeclineMode"></a>`outOfOfficeProperties.autoDeclineMode` | `string` | Whether to decline meeting invitations which overlap Out of office events. Valid values are `declineNone`, meaning that no meeting invitations are declined; `declineAllConflictingInvitations`, meaning that all conflicting meeting invitations that conflict with the event are declined; and `declineOnlyNewConflictingInvitations`, meaning that only new conflicting meeting invitations which arrive while the Out of office event is present are to be declined. |  |
| <a id="outOfOfficeProperties.declineMessage"></a>`outOfOfficeProperties.declineMessage` | `string` | Response message to set if an existing event or new invitation is automatically declined by Calendar. |  |
| <a id="privateCopy"></a>`privateCopy` | `boolean` | If set to True, [Event propagation](../../concepts/sharing.md#event_propagation) is disabled. Note that it is not the same thing as [Private event properties](../../concepts/sharing.md#private_event_properties). Optional. Immutable. The default is False. |  |
| <a id="recurrence"></a>`recurrence[]` | `list` | List of RRULE, EXRULE, RDATE and EXDATE lines for a recurring event, as specified in [RFC5545](http://tools.ietf.org/html/rfc5545#section-3.8.5). Note that DTSTART and DTEND lines are not allowed in this field; event start and end times are specified in the `start` and `end` fields. This field is omitted for single events or instances of recurring events. | writable |
| <a id="recurringEventId"></a>`recurringEventId` | `string` | For an instance of a recurring event, this is the `id` of the recurring event to which this instance belongs. Immutable. |  |
| <a id="reminders"></a>`reminders` | `object` | Information about the event's reminders for the authenticated user. Note that changing reminders does not also change the `updated` property of the enclosing event. |  |
| <a id="reminders.overrides"></a>`reminders.overrides[]` | `list` | If the event doesn't use the default reminders, this lists the reminders specific to the event, or, if not set, indicates that no reminders are set for this event. The maximum number of override reminders is 5. | writable |
| <a id="reminders.overrides.method"></a>`reminders.overrides[].method` | `string` | The method used by this reminder. Possible values are: <br><br><br><br>- "`email`" - Reminders are sent via email.<br> <br>- "`popup`" - Reminders are sent via a UI popup.<br><br> <br><br><br><br>Required when adding a reminder. | writable |
| <a id="reminders.overrides.minutes"></a>`reminders.overrides[].minutes` | `integer` | Number of minutes before the start of the event when the reminder should trigger. Valid values are between 0 and 40320 (4 weeks in minutes). <br><br><br><br>Required when adding a reminder. | writable |
| <a id="reminders.useDefault"></a>`reminders.useDefault` | `boolean` | Whether the default reminders of the calendar apply to the event. | writable |
| <a id="sequence"></a>`sequence` | `integer` | Sequence number as per iCalendar. | writable |
| <a id="source"></a>`source` | `object` | Source from which the event was created. For example, a web page, an email message or any document identifiable by an URL with HTTP or HTTPS scheme. Can only be seen or modified by the creator of the event. |  |
| <a id="source.title"></a>`source.title` | `string` | Title of the source; for example a title of a web page or an email subject. | writable |
| <a id="source.url"></a>`source.url` | `string` | URL of the source pointing to a resource. The URL scheme must be HTTP or HTTPS. | writable |
| <a id="start"></a>`start` | `nested object` | The (inclusive) start time of the event. For a recurring event, this is the start time of the first instance. |  |
| <a id="start.date"></a>`start.date` | `date` | The date, in the format "yyyy-mm-dd", if this is an all-day event. | writable |
| <a id="start.dateTime"></a>`start.dateTime` | `datetime` | The time, as a combined date-time value (formatted according to [RFC3339](https://tools.ietf.org/html/rfc3339)). A time zone offset is required unless a time zone is explicitly specified in `timeZone`. | writable |
| <a id="start.timeZone"></a>`start.timeZone` | `string` | The time zone in which the time is specified. (Formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich".) For recurring events this field is required and specifies the time zone in which the recurrence is expanded. For single events this field is optional and indicates a custom time zone for the event start/end. | writable |
| <a id="status"></a>`status` | `string` | Status of the event. Optional. Possible values are: <br><br><br><br>- "`confirmed`" - The event is confirmed. This is the default status.<br> <br>- "`tentative`" - The event is tentatively confirmed.<br> <br>- "`cancelled`" - The event is cancelled (deleted). The [list](events/list.md) method returns cancelled events only on incremental sync (when `syncToken` or `updatedMin` are specified) or if the `showDeleted` flag is set to `true`. The [get](events/get.md) method always returns them. <br>  <br>  <br>  <br>  A cancelled status represents two different states depending on the event type:<br>  <br>  <br>  <br>  <br>  <br>  - Cancelled exceptions of an uncancelled recurring event indicate that this instance should no longer be presented to the user. Clients should store these events for the lifetime of the parent recurring event. <br>    <br>    <br>    <br>    Cancelled exceptions are only guaranteed to have values for the `id`, `recurringEventId` and `originalStartTime` fields populated. The other fields might be empty.<br>   <br>  - All other cancelled events represent deleted events. Clients should remove their locally synced copies. Such cancelled events will eventually disappear, so do not rely on them being available indefinitely. <br>    <br>    <br>    <br>    Deleted events are only guaranteed to have the `id` field populated.<br>  <br>   On the organizer's calendar, cancelled events continue to expose event details (summary, location, etc.) so that they can be restored (undeleted). Similarly, the events to which the user was invited and that they manually removed continue to provide details. However, incremental sync requests with `showDeleted` set to false will not return these details. <br>  <br>  <br>  <br>  If an event changes its organizer (for example via the [move](events/move.md) operation) and the original organizer is not on the attendee list, it will leave behind a cancelled event where only the `id` field is guaranteed to be populated. | writable |
| <a id="summary"></a>`summary` | `string` | Title of the event. | writable |
| <a id="transparency"></a>`transparency` | `string` | Whether the event blocks time on the calendar. Optional. Possible values are: <br><br><br><br>- "`opaque`" - Default value. The event does block time on the calendar. This is equivalent to setting **Show me as** to **Busy** in the Calendar UI.<br> <br>- "`transparent`" - The event does not block time on the calendar. This is equivalent to setting **Show me as** to **Available** in the Calendar UI. | writable |
| <a id="updated"></a>`updated` | `datetime` | Last modification time of the main event data (as a [RFC3339](https://tools.ietf.org/html/rfc3339) timestamp). Updating event reminders will not cause this to change. Read-only. |  |
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

<a id="methods"></a>

## Methods

[delete](events/delete.md)

Deletes an event.

[get](events/get.md)

Returns an event based on its Google Calendar ID. To retrieve an event using its iCalendar ID, call the [events.list method using the `iCalUID` parameter](events/list.md#iCalUID).

[import](events/import.md)

Imports an event. This operation is used to add a private copy of an existing event to a calendar. Only events with an `eventType` of `default` may be imported.

**Deprecated behavior:** If a non-`default` event is imported, its type will be changed to `default` and any event-type-specific properties it may have will be dropped.

[insert](events/insert.md)

Creates an event.

[instances](events/instances.md)

Returns instances of the specified recurring event.

[list](events/list.md)

Returns events on the specified calendar.

[move](events/move.md)

Moves an event to another calendar, i.e. changes an event's organizer. Note that only `default` events can be moved; `birthday`, `focusTime`, `fromGmail`, `outOfOffice` and `workingLocation` events cannot be moved.

[patch](events/patch.md)

Updates an event. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements.

[quickAdd](events/quickAdd.md)

Creates an event based on a simple text string.

[update](events/update.md)

Updates an event. This method does not support patch semantics and always updates the entire event resource. To do a partial update, perform a `get` followed by an `update` using etags to ensure atomicity.

[watch](events/watch.md)

Watch for changes to Events resources.
