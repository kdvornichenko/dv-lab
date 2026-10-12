# Calendars: transferOwnership

Source: https://developers.google.com/workspace/calendar/api/v3/reference/calendars/transferOwnership

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-06-17.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/calendars/transferOwnership.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](transferOwnership.md#auth).

Transfers a secondary calendar between users within a Google Workspace organization. Requires user authentication with [Manage Calendars](https://knowledge.workspace.google.com/admin/users/administrator-privilege-definitions#calendar) administrator privilege, and one of the following authorization scopes:

- `https://www.googleapis.com/auth/calendar`

- `https://www.googleapis.com/auth/calendar.calendars`

 In the request, set `useAdminAccess` to `true`. The secondary calendar must be active to be transferred. Transferring disabled or deleted calendars isn't supported. [Try it now](transferOwnership.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
POST https://www.googleapis.com/calendar/v3/calendars/calendarId/transferOwnership
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="required-parameters"></a>**Path parameters** |  |  |
| <a id="calendarId"></a>`calendarId` | `string` | Calendar identifier. To retrieve calendar IDs, call the [calendarList.list](../calendarList/list.md) method. |
| **Required query parameters** |  |  |
| <a id="newDataOwner"></a>`newDataOwner` | `string` | The email address of a user who will become the data owner of the calendar. |
| <a id="useAdminAccess"></a>`useAdminAccess` | `boolean` | When true, the method runs using the user's Google Workspace administrator privileges. The calling user must be a Google Workspace administrator with the Manage Calendars privilege. This method currently only supports admin access, thus only `true` is accepted for this field. |

<a id="auth"></a>

### Authorization

This request requires authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar.calendars` |
| `https://www.googleapis.com/auth/calendar` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

Do not supply a request body with this method.

<a id="response"></a>

## Response

If successful, this method returns an empty response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
