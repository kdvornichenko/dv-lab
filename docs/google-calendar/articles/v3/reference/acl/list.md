# Acl: list

Source: https://developers.google.com/workspace/calendar/api/v3/reference/acl/list

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-05-12.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/acl/list.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](list.md#auth).

Returns the rules in the access control list for the calendar. [Try it now](list.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
GET https://www.googleapis.com/calendar/v3/calendars/calendarId/acl
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="required-parameters"></a>**Path parameters** |  |  |
| <a id="calendarId"></a>`calendarId` | `string` | Calendar identifier. To retrieve calendar IDs call the [calendarList.list](../calendarList/list.md) method. If you want to access the primary calendar of the currently logged in user, use the "`primary`" keyword. |
| <a id="optional-parameters"></a>**Optional query parameters** |  |  |
| <a id="maxResults"></a>`maxResults` | `integer` | Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional. |
| <a id="pageToken"></a>`pageToken` | `string` | Token specifying which result page to return. Optional. |
| <a id="showDeleted"></a>`showDeleted` | `boolean` | Whether to include deleted ACLs in the result. Deleted ACLs are represented by `role` equal to "`none`". Deleted ACLs will always be included if `syncToken` is provided. Optional. The default is False. |
| <a id="syncToken"></a>`syncToken` | `string` | Token obtained from the `nextSyncToken` field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. All entries deleted since the previous list request will always be in the result set and it is not allowed to set `showDeleted` to False. <br><br>If the `syncToken` expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any `syncToken`. <br><br>[Learn more](../../../guides/sync.md) about incremental synchronization. <br><br> Optional. The default is to return all entries. |

<a id="auth"></a>

### Authorization

This request requires authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.acls` |
| `https://www.googleapis.com/auth/calendar.acls.readonly` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

Do not supply a request body with this method.

<a id="response"></a>

## Response

If successful, this method returns a response body with the following structure:

```Objective-C
{
  "kind": "calendar#acl",
  "etag": etag,
  "nextPageToken": string,
  "nextSyncToken": string,
  "items": [
    acl Resource
  ]
}
```


<a id="response_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="kind"></a>`kind` | `string` | Type of the collection ("`calendar#acl`"). |  |
| <a id="etag"></a>`etag` | `etag` | ETag of the collection. |  |
| <a id="nextPageToken"></a>`nextPageToken` | `string` | Token used to access the next page of this result. Omitted if no further results are available, in which case `nextSyncToken` is provided. |  |
| <a id="items"></a>`items[]` | `list` | List of rules on the access control list. |  |
| <a id="nextSyncToken"></a>`nextSyncToken` | `string` | Token used at a later point in time to retrieve only the entries that have changed since this result was returned. Omitted if further results are available, in which case `nextPageToken` is provided. |  |

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
