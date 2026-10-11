# CalendarList: patch

Source: https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/patch

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-05-12.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/calendarList/patch.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](patch.md#auth).

Updates an existing calendar on the user's calendar list. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements. [Try it now](patch.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
PATCH https://www.googleapis.com/calendar/v3/users/me/calendarList/calendarId
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="required-parameters"></a>**Path parameters** |  |  |
| <a id="calendarId"></a>`calendarId` | `string` | Calendar identifier. To retrieve calendar IDs call the [calendarList.list](list.md) method. If you want to access the primary calendar of the currently logged in user, use the "`primary`" keyword. |
| <a id="optional-parameters"></a>**Optional query parameters** |  |  |
| <a id="colorRgbFormat"></a>`colorRgbFormat` | `boolean` | Whether to use the `foregroundColor` and `backgroundColor` fields to write the calendar colors (RGB). If this feature is used, the index-based `colorId` field will be set to the best matching option automatically. Optional. The default is False. |

<a id="auth"></a>

### Authorization

This request requires authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.app.created` |
| `https://www.googleapis.com/auth/calendar.calendarlist` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

In the request body, supply the relevant portions of a [CalendarList resource](../calendarList.md#resource), according to the rules of patch semantics.

<a id="response"></a>

## Response

If successful, this method returns a [CalendarList resource](../calendarList.md#resource) in the response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
