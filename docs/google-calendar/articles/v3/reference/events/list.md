# Events: list

Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/list

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-29.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/events/list.html>); no article content intentionally omitted.

---

**Note:** [Authorization](list.md#auth) optional.

Returns events on the specified calendar. [Try it now](list.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
GET https://www.googleapis.com/calendar/v3/calendars/calendarId/events
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="required-parameters"></a>**Path parameters** |  |  |
| <a id="calendarId"></a>`calendarId` | `string` | Calendar identifier. To retrieve calendar IDs call the [calendarList.list](../calendarList/list.md) method. If you want to access the primary calendar of the currently logged in user, use the "`primary`" keyword. |
| <a id="optional-parameters"></a>**Optional query parameters** |  |  |
| <a id="alwaysIncludeEmail"></a>`alwaysIncludeEmail` | `boolean` | Deprecated and ignored. |
| <a id="eventTypes"></a>`eventTypes` | `string` | Event types to return. Optional. This parameter can be repeated multiple times to return events of different types. If unset, returns all event types. <br><br><br><br>Acceptable values are: <br><br><br><br>- "`birthday`": Special all-day events with an annual recurrence.<br> <br>- "`default`": Regular events.<br> <br>- "`focusTime`": Focus time events.<br> <br>- "`fromGmail`": Events from Gmail.<br> <br>- "`outOfOffice`": Out of office events.<br> <br>- "`workingLocation`": Working location events. |
| <a id="iCalUID"></a>`iCalUID` | `string` | Specifies an event ID in the iCalendar format to be provided in the response. Optional. Use this if you want to search for an event by its iCalendar ID. |
| <a id="maxAttendees"></a>`maxAttendees` | `integer` | The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional. |
| <a id="maxResults"></a>`maxResults` | `integer` | Maximum number of events returned on one result page. The number of events in the resulting page may be less than this value, or none at all, even if there are more events matching the query. Incomplete pages can be detected by a non-empty `nextPageToken` field in the response. By default the value is 250 events. The page size can never be larger than 2500 events. Optional. |
| <a id="orderBy"></a>`orderBy` | `string` | The order of the events returned in the result. Optional. The default is an unspecified, stable order. <br><br><br><br>Acceptable values are: <br><br><br><br>- "`startTime`": Order by the start date/time (ascending). This is only available when querying single events (i.e. the parameter `singleEvents` is True)<br> <br>- "`updated`": Order by last modification time (ascending). |
| <a id="pageToken"></a>`pageToken` | `string` | Token specifying which result page to return. Optional. |
| <a id="privateExtendedProperty"></a>`privateExtendedProperty` | `string` | Extended properties constraint specified as propertyName=value. Matches only private properties. This parameter might be repeated multiple times to return events that match all given constraints. |
| <a id="q"></a>`q` | `string` | Free text search terms to find events that match these terms in the following fields: <br><br><br><br><br><br>- `summary`<br> <br>- `description`<br> <br>- `location`<br> <br>- attendee's `displayName`<br> <br>- attendee's `email`<br> <br>- organizer's `displayName`<br> <br>- organizer's `email`<br> <br>- `workingLocationProperties.officeLocation.buildingId`<br> <br>- `workingLocationProperties.officeLocation.deskId`<br> <br>- `workingLocationProperties.officeLocation.label`<br> <br>- `workingLocationProperties.customLocation.label`<br><br> <br><br><br><br>These search terms also match predefined keywords against all display title translations of working location, out-of-office, and focus-time events. For example, searching for "Office" or "Bureau" returns working location events of type `officeLocation`, whereas searching for "Out of office" or "Abwesend" returns out-of-office events. Optional. |
| <a id="sharedExtendedProperty"></a>`sharedExtendedProperty` | `string` | Extended properties constraint specified as propertyName=value. Matches only shared properties. This parameter might be repeated multiple times to return events that match all given constraints. |
| <a id="showDeleted"></a>`showDeleted` | `boolean` | Whether to include deleted events (with `status` equals "`cancelled`") in the result. Cancelled instances of recurring events (but not the underlying recurring event) will still be included if `showDeleted` and `singleEvents` are both False. If `showDeleted` and `singleEvents` are both True, only single instances of deleted events (but not the underlying recurring events) are returned. Optional. The default is False. |
| <a id="showHiddenInvitations"></a>`showHiddenInvitations` | `boolean` | Whether to include hidden invitations in the result. Optional. The default is False. |
| <a id="singleEvents"></a>`singleEvents` | `boolean` | Whether to expand recurring events into instances and only return single one-off events and instances of recurring events, but not the underlying recurring events themselves. Optional. The default is False. |
| <a id="syncToken"></a>`syncToken` | `string` | Token obtained from the `nextSyncToken` field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. All events deleted since the previous list request will always be in the result set and it is not allowed to set `showDeleted` to False. <br><br>There are several query parameters that cannot be specified together with `nextSyncToken` to ensure consistency of the client state. <br><br><br><br>These are: <br><br><br><br>- `iCalUID`<br> <br>- `orderBy`<br> <br>- `privateExtendedProperty`<br> <br>- `q`<br> <br>- `sharedExtendedProperty`<br> <br>- `timeMin`<br> <br>- `timeMax`<br> <br>- `updatedMin`<br><br> All other query parameters should be the same as for the initial synchronization to avoid undefined behavior. If the `syncToken` expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any `syncToken`. <br><br>[Learn more](../../../guides/sync.md) about incremental synchronization.<br><br> Optional. The default is to return all entries. |
| <a id="timeMax"></a>`timeMax` | `datetime` | Upper bound (exclusive) for an event's start time to filter by. Optional. The default is not to filter by start time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If `timeMin` is set, `timeMax` must be greater than `timeMin`. |
| <a id="timeMin"></a>`timeMin` | `datetime` | Lower bound (exclusive) for an event's end time to filter by. Optional. The default is not to filter by end time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If `timeMax` is set, `timeMin` must be smaller than `timeMax`. |
| <a id="timeZone"></a>`timeZone` | `string` | Time zone used in the response. Optional. The default is the time zone of the calendar. |
| <a id="updatedMin"></a>`updatedMin` | `datetime` | Lower bound for an event's last modification time (as a [RFC3339](https://tools.ietf.org/html/rfc3339) timestamp) to filter by. When specified, entries deleted since this time will always be included regardless of `showDeleted`. Optional. The default is not to filter by last modification time. |

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

If successful, this method returns a response body with the following structure:

```Objective-C
{
  "kind": "calendar#events",
  "etag": etag,
  "summary": string,
  "description": string,
  "updated": datetime,
  "timeZone": string,
  "accessRole": string,
  "defaultReminders": [
    {
      "method": string,
      "minutes": integer
    }
  ],
  "nextPageToken": string,
  "nextSyncToken": string,
  "items": [
    events Resource
  ]
}
```


<a id="response_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="kind"></a>`kind` | `string` | Type of the collection ("`calendar#events`"). |  |
| <a id="etag"></a>`etag` | `etag` | ETag of the collection. |  |
| <a id="summary"></a>`summary` | `string` | Title of the calendar. Read-only. |  |
| <a id="description"></a>`description` | `string` | Description of the calendar. Read-only. |  |
| <a id="updated"></a>`updated` | `datetime` | Last modification time of the calendar (as a [RFC3339](https://tools.ietf.org/html/rfc3339) timestamp). Read-only. |  |
| `timeZone` | `string` | The time zone of the calendar. Read-only. |  |
| <a id="accessRole"></a>`accessRole` | `string` | The user's access role for this calendar. Read-only. Possible values are: <br><br><br><br>- "`none`" - The user has no access.<br> <br>- "`freeBusyReader`" - The user has read access to free/busy information.<br> <br>- "`reader`" - The user has read access to the calendar. Private events will appear to users with reader access, but event details will be hidden.<br> <br>- "`writerWithoutPrivateAccess`" - The user has read and write access to the calendar. Private events will appear to users with writerWithoutPrivateAccess access, but event details will be hidden.<br> <br>- "`writer`" - The user has read and write access to the calendar. Private events will appear to users with writer access, and event details will be visible.<br> <br>- "`owner`" - The user has manager access to the calendar. This role has all of the permissions of the writer role with the additional ability to see and modify access levels of other users. <br>  <br>  <br>  <br>  Important: the `owner` role is different from the calendar's data owner. A calendar has a single data owner, but can have multiple users with `owner` role. |  |
| <a id="defaultReminders"></a>`defaultReminders[]` | `list` | The default reminders on the calendar for the authenticated user. These reminders apply to all events on this calendar that do not explicitly override them (i.e. do not have `reminders.useDefault` set to True). |  |
| <a id="defaultReminders.method"></a>`defaultReminders[].method` | `string` | The method used by this reminder. Possible values are: <br><br><br><br>- "`email`" - Reminders are sent via email.<br> <br>- "`popup`" - Reminders are sent via a UI popup.<br><br> <br><br><br><br>Required when adding a reminder. | writable |
| <a id="defaultReminders.minutes"></a>`defaultReminders[].minutes` | `integer` | Number of minutes before the start of the event when the reminder should trigger. Valid values are between 0 and 40320 (4 weeks in minutes). <br><br><br><br>Required when adding a reminder. | writable |
| <a id="nextPageToken"></a>`nextPageToken` | `string` | Token used to access the next page of this result. Omitted if no further results are available, in which case `nextSyncToken` is provided. |  |
| <a id="items"></a>`items[]` | `list` | List of events on the calendar. |  |
| <a id="nextSyncToken"></a>`nextSyncToken` | `string` | Token used at a later point in time to retrieve only the entries that have changed since this result was returned. Omitted if further results are available, in which case `nextPageToken` is provided. |  |

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
