# CalendarList: list

Source: https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-29.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/calendarList/list.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](list.md#auth).

Returns the calendars on the user's calendar list. [Try it now](list.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
GET https://www.googleapis.com/calendar/v3/users/me/calendarList
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="optional-parameters"></a>**Optional query parameters** |  |  |
| <a id="maxResults"></a>`maxResults` | `integer` | Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional. |
| <a id="minAccessRole"></a>`minAccessRole` | `string` | The minimum access role for the user in the returned entries. Optional. The default is no restriction. <br><br><br><br>Acceptable values are: <br><br><br><br>- "`freeBusyReader`": The user can read free/busy information.<br> <br>- "`owner`": The user can read and modify events and access control lists.<br> <br>- "`reader`": The user can read events that are not private.<br> <br>- "`writer`": The user can read and modify events.<br> <br>- "`writerWithoutPrivateAccess`": The user can read and modify events that aren't private. The user can read free/busy information about private events. The user can't modify private events. |
| <a id="pageToken"></a>`pageToken` | `string` | Token specifying which result page to return. Optional. |
| <a id="showDeleted"></a>`showDeleted` | `boolean` | Whether to include deleted calendar list entries in the result. Optional. The default is False. |
| <a id="showHidden"></a>`showHidden` | `boolean` | Whether to show hidden entries. Optional. The default is False. |
| <a id="showOwnOrganizationOnly"></a>`showOwnOrganizationOnly` | `boolean` | Whether to show only entries for calendars from the organization. This parameter is only applicable to Google Workspace users. Optional. The default is False. |
| <a id="syncToken"></a>`syncToken` | `string` | Token obtained from the `nextSyncToken` field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. If only read-only fields such as calendar properties or ACLs have changed, the entry won't be returned. All entries deleted and hidden since the previous list request will always be in the result set and it is not allowed to set `showDeleted` neither `showHidden` to False. <br><br>To ensure client state consistency `minAccessRole` and `showOwnOrganizationOnly` query parameters cannot be specified together with `nextSyncToken`. <br><br>If the `syncToken` expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any `syncToken`. <br><br>[Learn more](../../../guides/sync.md) about incremental synchronization. <br><br>Optional. The default is to return all entries. |

<a id="auth"></a>

### Authorization

This request requires authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar.readonly` |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.calendarlist` |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

Do not supply a request body with this method.

<a id="response"></a>

## Response

If successful, this method returns a response body with the following structure:

```Objective-C
{
  "kind": "calendar#calendarList",
  "etag": etag,
  "nextPageToken": string,
  "nextSyncToken": string,
  "items": [
    calendarList Resource
  ]
}
```


<a id="response_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="kind"></a>`kind` | `string` | Type of the collection ("`calendar#calendarList`"). |  |
| <a id="etag"></a>`etag` | `etag` | ETag of the collection. |  |
| <a id="nextPageToken"></a>`nextPageToken` | `string` | Token used to access the next page of this result. Omitted if no further results are available, in which case `nextSyncToken` is provided. |  |
| <a id="items"></a>`items[]` | `list` | Calendars that are present on the user's calendar list. |  |
| <a id="nextSyncToken"></a>`nextSyncToken` | `string` | Token used at a later point in time to retrieve only the entries that have changed since this result was returned. Omitted if further results are available, in which case `nextPageToken` is provided. |  |

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
