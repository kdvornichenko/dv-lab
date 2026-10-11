# Calendars: update

Source: https://developers.google.com/workspace/calendar/api/v3/reference/calendars/update

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-01.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/calendars/update.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](update.md#auth).

Updates metadata for a calendar. [Try it now](update.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
PUT https://www.googleapis.com/calendar/v3/calendars/calendarId
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
| `https://www.googleapis.com/auth/calendar.app.created` |
| `https://www.googleapis.com/auth/calendar.calendars` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

In the request body, supply a [Calendars resource](../calendars.md#resource) with the following properties:

<a id="request_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="optional-properties"></a>**Optional Properties** |  |  |  |
| <a id="description"></a>`description` | `string` | Description of the calendar. Optional. | writable |
| <a id="labelProperties"></a>`labelProperties` | `nested object` | Label properties defined on this calendar. If specified, overwrites the existing label properties. If not specified, the label properties remain unchanged. | writable |
| <a id="labelProperties.eventLabels"></a>`labelProperties.eventLabels[]` | `list` | Event labels defined on this calendar. If this is present when updating the calendar, it will replace the existing event labels. <br><br><br><br>Extend the list to add a new event label, and remove entities from the list to delete a label from calendar.<br><br><br><br><br><br>Each calendar can have a maximum of 200 labels. | writable |
| <a id="labelProperties.eventLabels.backgroundColor"></a>`labelProperties.eventLabels[].backgroundColor` | `string` | Background color of the label in hexadecimal format, such as `"#039be5"`. Events with this label are displayed in this color. Required. | writable |
| <a id="labelProperties.eventLabels.id"></a>`labelProperties.eventLabels[].id` | `string` | The ID of the label. Optional when inserting a new label. If not provided, a unique ID will be generated. Required when updating a label. <br><br><br><br>If provided, the ID must be unique within the calendar and follow UUID format. | writable |
| <a id="labelProperties.eventLabels.name"></a>`labelProperties.eventLabels[].name` | `string` | Name of the label. Optional. <br><br><br><br>If provided this must have at most 50 characters. | writable |
| <a id="location"></a>`location` | `string` | Geographic location of the calendar as free-form text. Optional. | writable |
| <a id="summary"></a>`summary` | `string` | Title of the calendar. | writable |
| <a id="timeZone"></a>`timeZone` | `string` | The time zone of the calendar. (Formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich".) Optional. | writable |

<a id="response"></a>

## Response

If successful, this method returns a [Calendars resource](../calendars.md#resource) in the response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
