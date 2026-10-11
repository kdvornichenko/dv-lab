# Freebusy: query

Source: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-05-12.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/freebusy/query.html>); no article content intentionally omitted.

---

**Note:** [Authorization](query.md#auth) optional.

Returns free/busy information for a set of calendars. [Try it now](query.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
POST https://www.googleapis.com/calendar/v3/freeBusy
```


<a id="auth"></a>

### Authorization

This request allows authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar.readonly` |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.events.freebusy` |
| `https://www.googleapis.com/auth/calendar.freebusy` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

In the request body, supply data with the following structure:

```Text only
{
  "timeMin": datetime,
  "timeMax": datetime,
  "timeZone": string,
  "groupExpansionMax": integer,
  "calendarExpansionMax": integer,
  "items": [
    {
      "id": string
    }
  ]
}
```


<a id="request_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="timeMin"></a>`timeMin` | `datetime` | The start of the interval for the query formatted as per [RFC3339](https://tools.ietf.org/html/rfc3339). |  |
| <a id="timeMax"></a>`timeMax` | `datetime` | The end of the interval for the query formatted as per [RFC3339](https://tools.ietf.org/html/rfc3339). |  |
| <a id="timeZone"></a>`timeZone` | `string` | Time zone used in the response. Optional. The default is UTC. |  |
| <a id="groupExpansionMax"></a>`groupExpansionMax` | `integer` | Maximal number of calendar identifiers to be provided for a single group. Optional. An error is returned for a group with more members than this value. Maximum value is 100. |  |
| <a id="calendarExpansionMax"></a>`calendarExpansionMax` | `integer` | Maximal number of calendars for which FreeBusy information is to be provided. Optional. Maximum value is 50. |  |
| <a id="items"></a>`items[]` | `list` | List of calendars and/or groups to query. |  |
| <a id="items.id"></a>`items[].id` | `string` | The identifier of a calendar or a group. |  |

<a id="response"></a>

## Response

If successful, this method returns a response body with the following structure:

```Text only
{
  "kind": "calendar#freeBusy",
  "timeMin": datetime,
  "timeMax": datetime,
  "groups": {
    (key): {
      "errors": [
        {
          "domain": string,
          "reason": string
        }
      ],
      "calendars": [
        string
      ]
    }
  },
  "calendars": {
    (key): {
      "errors": [
        {
          "domain": string,
          "reason": string
        }
      ],
      "busy": [
        {
          "start": datetime,
          "end": datetime
        }
      ]
    }
  }
}
```


<a id="response_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="kind"></a>`kind` | `string` | Type of the resource ("calendar#freeBusy"). |  |
| `timeMin` | `datetime` | The start of the interval. |  |
| `timeMax` | `datetime` | The end of the interval. |  |
| <a id="groups"></a>`groups` | `object` | Expansion of groups. |  |
| <a id="groups.(key)"></a>`groups.(key)` | `nested object` | List of calendars that are members of this group. |  |
| <a id="groups.(key).errors"></a>`groups.(key).errors[]` | `list` | Optional error(s) (if computation for the group failed). |  |
| <a id="groups.(key).errors.domain"></a>`groups.(key).errors[].domain` | `string` | Domain, or broad category, of the error. |  |
| <a id="groups.(key).errors.reason"></a>`groups.(key).errors[].reason` | `string` | Specific reason for the error. Some of the possible values are: <br><br><br><br>- "`groupTooBig`" - The group of users requested is too large for a single query.<br> <br>- "`tooManyCalendarsRequested`" - The number of calendars requested is too large for a single query.<br> <br>- "`notFound`" - The requested resource was not found.<br> <br>- "`internalError`" - The API service has encountered an internal error.<br><br> Additional error types may be added in the future, so clients should gracefully handle additional error statuses not included in this list. |  |
| <a id="groups.(key).calendars"></a>`groups.(key).calendars[]` | `list` | List of calendars' identifiers within a group. |  |
| <a id="calendars"></a>`calendars` | `object` | List of free/busy information for calendars. |  |
| <a id="calendars.(key)"></a>`calendars.(key)` | `nested object` | Free/busy expansions for a single calendar. |  |
| <a id="calendars.(key).errors"></a>`calendars.(key).errors[]` | `list` | Optional error(s) (if computation for the calendar failed). |  |
| <a id="calendars.(key).errors.domain"></a>`calendars.(key).errors[].domain` | `string` | Domain, or broad category, of the error. |  |
| <a id="calendars.(key).errors.reason"></a>`calendars.(key).errors[].reason` | `string` | Specific reason for the error. Some of the possible values are: <br><br><br><br>- "`groupTooBig`" - The group of users requested is too large for a single query.<br> <br>- "`tooManyCalendarsRequested`" - The number of calendars requested is too large for a single query.<br> <br>- "`notFound`" - The requested resource was not found.<br> <br>- "`internalError`" - The API service has encountered an internal error.<br><br> Additional error types may be added in the future, so clients should gracefully handle additional error statuses not included in this list. |  |
| <a id="calendars.(key).busy"></a>`calendars.(key).busy[]` | `list` | List of time ranges during which this calendar should be regarded as busy. |  |
| <a id="calendars.(key).busy.start"></a>`calendars.(key).busy[].start` | `datetime` | The (inclusive) start of the time period. |  |
| <a id="calendars.(key).busy.end"></a>`calendars.(key).busy[].end` | `datetime` | The (exclusive) end of the time period. |  |

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
