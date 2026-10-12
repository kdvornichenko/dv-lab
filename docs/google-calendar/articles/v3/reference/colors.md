# Colors

Source: https://developers.google.com/workspace/calendar/api/v3/reference/colors

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-05-12.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../pages/v3/reference/colors.html>); no article content intentionally omitted.

---

<a id="overview"></a>

For a list of [methods](colors.md#methods) for this resource, see the end of this page.

<a id="resource"></a>

<a id="resource-representations"></a>

## Resource representations

<a id="alt-json"></a>

```verilog
{
  "kind": "calendar#colors",
  "updated": datetime,
  "calendar": {
    (key): {
      "background": string,
      "foreground": string
    }
  },
  "event": {
    (key): {
      "background": string,
      "foreground": string
    }
  }
}
```


<a id="properties"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="calendar"></a>`calendar` | `object` | A global palette of calendar colors, mapping from the color ID to its definition. A `calendarListEntry` resource refers to one of these color IDs in its `colorId` field. Read-only. |  |
| <a id="calendar.(key)"></a>`calendar.(key)` | `nested object` | A calendar color definition. |  |
| <a id="calendar.(key).background"></a>`calendar.(key).background` | `string` | The background color associated with this color definition. |  |
| <a id="calendar.(key).foreground"></a>`calendar.(key).foreground` | `string` | The foreground color that can be used to write on top of a background with 'background' color. |  |
| <a id="event"></a>`event` | `object` | A global palette of event colors, mapping from the color ID to its definition. An `event` resource may refer to one of these color IDs in its `colorId` field. Read-only. |  |
| <a id="event.(key)"></a>`event.(key)` | `nested object` | An event color definition. |  |
| <a id="event.(key).background"></a>`event.(key).background` | `string` | The background color associated with this color definition. |  |
| <a id="event.(key).foreground"></a>`event.(key).foreground` | `string` | The foreground color that can be used to write on top of a background with 'background' color. |  |
| <a id="kind"></a>`kind` | `string` | Type of the resource ("`calendar#colors`"). |  |
| <a id="updated"></a>`updated` | `datetime` | Last modification time of the color palette (as a [RFC3339](https://tools.ietf.org/html/rfc3339) timestamp). Read-only. |  |

<a id="methods"></a>

## Methods

[get](colors/get.md)

Returns the color definitions for calendars and events.
