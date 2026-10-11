# Acl: patch

Source: https://developers.google.com/workspace/calendar/api/v3/reference/acl/patch

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-05-12.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/acl/patch.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](patch.md#auth).

Updates an access control rule. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements. [Try it now](patch.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
PATCH https://www.googleapis.com/calendar/v3/calendars/calendarId/acl/ruleId
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="required-parameters"></a>**Path parameters** |  |  |
| <a id="calendarId"></a>`calendarId` | `string` | Calendar identifier. To retrieve calendar IDs call the [calendarList.list](../calendarList/list.md) method. If you want to access the primary calendar of the currently logged in user, use the "`primary`" keyword. |
| <a id="ruleId"></a>`ruleId` | `string` | ACL rule identifier. |
| <a id="optional-parameters"></a>**Optional query parameters** |  |  |
| <a id="sendNotifications"></a>`sendNotifications` | `boolean` | Whether to send notifications about the calendar sharing change. Note that there are no notifications on access removal. Optional. The default is True. |

<a id="auth"></a>

### Authorization

This request requires authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.acls` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

In the request body, supply the relevant portions of an [Acl resource](../acl.md#resource), according to the rules of patch semantics.

<a id="response"></a>

## Response

If successful, this method returns an [Acl resource](../acl.md#resource) in the response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
