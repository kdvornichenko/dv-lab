# Calendars

Source: https://developers.google.com/workspace/calendar/api/v3/reference/calendars

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-01.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../pages/v3/reference/calendars.html>); no article content intentionally omitted.

---

<a id="overview"></a>

A collection of all existing calendars. See also [Calendars vs CalendarList](../../concepts/events-calendars.md#calendar_and_calendar_list).

For a list of [methods](calendars.md#methods) for this resource, see the end of this page.

<a id="resource"></a>

<a id="resource-representations"></a>

## Resource representations

<a id="alt-json"></a>

```Text only
{
  "kind": "calendar#calendar",
  "etag": etag,
  "id": string,
  "summary": string,
  "description": string,
  "location": string,
  "timeZone": string,
  "dataOwner": string,
  "conferenceProperties": {
    "allowedConferenceSolutionTypes": [
      string
    ]
  },
  "labelProperties": {
    "eventLabels": [
      {
        "id": string,
        "backgroundColor": string,
        "name": string
      }
    ]
  },
  "autoAcceptInvitations": boolean
}
```


<a id="properties"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="autoAcceptInvitations"></a>`autoAcceptInvitations` | `boolean` | Whether this calendar automatically accepts invitations. Only valid for resource calendars. |  |
| <a id="conferenceProperties"></a>`conferenceProperties` | `nested object` | Conferencing properties for this calendar, for example what types of conferences are allowed. |  |
| <a id="conferenceProperties.allowedConferenceSolutionTypes"></a>`conferenceProperties.allowedConferenceSolutionTypes[]` | `list` | The types of conference solutions that are supported for this calendar. <br><br><br><br>The possible values are:<br><br><br><br><br><br>- `"eventHangout"`<br><br>- `"eventNamedHangout"`<br><br>- `"hangoutsMeet"`<br><br> Optional. |  |
| <a id="dataOwner"></a>`dataOwner` | `string` | The email of the owner of the calendar. Set only for secondary calendars. Read-only. |  |
| <a id="description"></a>`description` | `string` | Description of the calendar. Optional. | writable |
| <a id="etag"></a>`etag` | `etag` | ETag of the resource. |  |
| <a id="id"></a>`id` | `string` | Identifier of the calendar. To retrieve IDs call the [calendarList.list()](calendarList/list.md) method. |  |
| <a id="kind"></a>`kind` | `string` | Type of the resource ("`calendar#calendar`"). |  |
| <a id="labelProperties"></a>`labelProperties` | `nested object` | Label properties defined on this calendar. If specified, overwrites the existing label properties. If not specified, the label properties remain unchanged. | writable |
| <a id="labelProperties.eventLabels"></a>`labelProperties.eventLabels[]` | `list` | Event labels defined on this calendar. If this is present when updating the calendar, it will replace the existing event labels. <br><br><br><br>Extend the list to add a new event label, and remove entities from the list to delete a label from calendar.<br><br><br><br><br><br>Each calendar can have a maximum of 200 labels. | writable |
| <a id="labelProperties.eventLabels.backgroundColor"></a>`labelProperties.eventLabels[].backgroundColor` | `string` | Background color of the label in hexadecimal format, such as `"#039be5"`. Events with this label are displayed in this color. Required. | writable |
| <a id="labelProperties.eventLabels.id"></a>`labelProperties.eventLabels[].id` | `string` | The ID of the label. Optional when inserting a new label. If not provided, a unique ID will be generated. Required when updating a label. <br><br><br><br>If provided, the ID must be unique within the calendar and follow UUID format. | writable |
| <a id="labelProperties.eventLabels.name"></a>`labelProperties.eventLabels[].name` | `string` | Name of the label. Optional. <br><br><br><br>If provided this must have at most 50 characters. | writable |
| <a id="location"></a>`location` | `string` | Geographic location of the calendar as free-form text. Optional. | writable |
| <a id="summary"></a>`summary` | `string` | Title of the calendar. | writable |
| <a id="timeZone"></a>`timeZone` | `string` | The time zone of the calendar. (Formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich".) Optional. | writable |

<a id="methods"></a>

## Methods

[clear](calendars/clear.md)

Clears a primary calendar. This operation deletes all events associated with the primary calendar of an account.

[delete](calendars/delete.md)

Deletes a secondary calendar. Use calendars.clear for clearing all events on primary calendars.

[get](calendars/get.md)

Returns metadata for a calendar.

[insert](calendars/insert.md)

Creates a secondary calendar.

The authenticated user for the request is made the data owner of the new calendar.

**Note:** We recommend to authenticate as the intended data owner of the calendar. You can use [domain-wide delegation of authority](https://developers.google.com/workspace/cloud-search/docs/guides/delegation) to allow applications to act on behalf of a specific user. Don't use a service account for authentication. If you use a service account for authentication, the service account is the data owner, which can lead to unexpected behavior. For example, if a service account is the data owner, data ownership cannot be transferred.

[patch](calendars/patch.md)

Updates metadata for a calendar. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements.

[transferOwnership](calendars/transferOwnership.md)

Transfers a secondary calendar between users within a Google Workspace organization. Requires user authentication with [Manage Calendars](https://knowledge.workspace.google.com/admin/users/administrator-privilege-definitions#calendar) administrator privilege, and one of the following authorization scopes:

- `https://www.googleapis.com/auth/calendar`

- `https://www.googleapis.com/auth/calendar.calendars`

 In the request, set `useAdminAccess` to `true`. The secondary calendar must be active to be transferred. Transferring disabled or deleted calendars isn't supported.

[update](calendars/update.md)

Updates metadata for a calendar.
