# Acl: watch

Source: https://developers.google.com/workspace/calendar/api/v3/reference/acl/watch

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-05-12.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/acl/watch.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](watch.md#auth).

Watch for changes to ACL resources.

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
POST https://www.googleapis.com/calendar/v3/calendars/calendarId/acl/watch
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="required-parameters"></a>**Path parameters** |  |  |
| <a id="calendarId"></a>`calendarId` | `string` | Calendar identifier. To retrieve calendar IDs call the [calendarList.list](../calendarList/list.md) method. If you want to access the primary calendar of the currently logged in user, use the "`primary`" keyword. |

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

In the request body, supply data with the following structure:

```Carbon
{
  "id": string,
  "token": string,
  "type": string,
  "address": string,
  "params": {
    "ttl": string
  }
}
```


<a id="request_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="id"></a>`id` | `string` | A UUID or similar unique string that identifies this channel. |  |
| <a id="token"></a>`token` | `string` | An arbitrary string delivered to the target address with each notification delivered over this channel. Optional. |  |
| <a id="type"></a>`type` | `string` | The type of delivery mechanism used for this channel. Valid values are "`web_hook`" (or "`webhook`"). Both values refer to a channel where Http requests are used to deliver messages. |  |
| <a id="address"></a>`address` | `string` | The address where notifications are delivered for this channel. |  |
| <a id="params"></a>`params` | `object` | Additional parameters controlling delivery channel behavior. Optional. |  |
| <a id="params.(key)"></a>`params.ttl` | `string` | The time-to-live in seconds for the notification channel. Default is 604800 seconds. |  |

<a id="response"></a>

## Response

If successful, this method returns a response body with the following structure:

```Text only
{
  "kind": "api#channel",
  "id": string,
  "resourceId": string,
  "resourceUri": string,
  "token": string,
  "expiration": long
}
```


<a id="response_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="kind"></a>`kind` | `string` | Identifies this as a notification channel used to watch for changes to a resource, which is "`api#channel`". |  |
| `id` | `string` | A UUID or similar unique string that identifies this channel. |  |
| <a id="resourceId"></a>`resourceId` | `string` | An opaque ID that identifies the resource being watched on this channel. Stable across different API versions. |  |
| <a id="resourceUri"></a>`resourceUri` | `string` | A version-specific identifier for the watched resource. |  |
| `token` | `string` | An arbitrary string delivered to the target address with each notification delivered over this channel. Optional. |  |
| <a id="expiration"></a>`expiration` | `long` | Date and time of notification channel expiration, expressed as a Unix timestamp, in milliseconds. Optional. |  |
