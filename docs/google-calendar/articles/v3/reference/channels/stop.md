# Channels: stop

Source: https://developers.google.com/workspace/calendar/api/v3/reference/channels/stop

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2025-04-01.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/channels/stop.html>); no article content intentionally omitted.

---

Stop watching resources through this channel.

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
POST https://www.googleapis.com/calendar/v3/channels/stop
```


<a id="request-body"></a>

### Request body

In the request body, supply data with the following structure:

```Text only
{
  "id": string,
  "resourceId": string
}
```


<a id="request_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="id"></a>`id` | `string` | A UUID or similar unique string that identifies this channel. |  |
| <a id="resourceId"></a>`resourceId` | `string` | An opaque ID that identifies the resource being watched on this channel. Stable across different API versions. |  |
| <a id="token"></a>`token` | `string` | An arbitrary string delivered to the target address with each notification delivered over this channel. Optional. |  |

<a id="response"></a>

## Response

If successful, this method returns an empty response body.
