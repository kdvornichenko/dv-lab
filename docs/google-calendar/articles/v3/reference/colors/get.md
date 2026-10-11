# Colors: get

Source: https://developers.google.com/workspace/calendar/api/v3/reference/colors/get

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2025-05-30.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/colors/get.html>); no article content intentionally omitted.

---

**Note:** [Authorization](get.md#auth) optional.

Returns the color definitions for calendars and events. [Try it now](get.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
GET https://www.googleapis.com/calendar/v3/colors
```


<a id="auth"></a>

### Authorization

This request allows authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.readonly` |
| `https://www.googleapis.com/auth/calendar.app.created` |
| `https://www.googleapis.com/auth/calendar.calendarlist` |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` |
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

If successful, this method returns a [Colors resource](../colors.md#resource) in the response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
