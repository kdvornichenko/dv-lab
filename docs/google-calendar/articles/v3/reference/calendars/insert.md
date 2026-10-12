# Calendars: insert

Source: https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2025-10-28.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/calendars/insert.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](insert.md#auth).

Creates a secondary calendar.

The authenticated user for the request is made the data owner of the new calendar.

**Note:** We recommend to authenticate as the intended data owner of the calendar. You can use [domain-wide delegation of authority](https://developers.google.com/workspace/cloud-search/docs/guides/delegation) to allow applications to act on behalf of a specific user. Don't use a service account for authentication. If you use a service account for authentication, the service account is the data owner, which can lead to unexpected behavior. For example, if a service account is the data owner, data ownership cannot be transferred.

 [Try it now](insert.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
POST https://www.googleapis.com/calendar/v3/calendars
```


<a id="auth"></a>

### Authorization

This request requires authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.app.created` |
| `https://www.googleapis.com/auth/calendar.calendars` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

In the request body, supply a [Calendars resource](../calendars.md#resource) with the following properties:

<a id="request_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="required-properties"></a>**Required Properties** |  |  |  |
| <a id="summary"></a>`summary` | `string` | Title of the calendar. | writable |

<a id="response"></a>

## Response

If successful, this method returns a [Calendars resource](../calendars.md#resource) in the response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
