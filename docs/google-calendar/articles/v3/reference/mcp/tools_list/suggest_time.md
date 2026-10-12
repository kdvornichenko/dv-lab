# MCP Tools Reference: calendarmcp.googleapis.com

Source: https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/suggest_time

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-17.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../../pages/v3/reference/mcp/tools_list/suggest_time.html>); no article content intentionally omitted.

---

<a id="/workspace/calendar/api/v3/reference/mcp/tools_list/suggest_time"></a>

<a id="GENERIC"></a>

<a id="tool:-suggest_time"></a>

## Tool: `suggest_time`

<a id="GENERIC_1"></a>

**Developer Preview:** Available as part of the [Google Workspace Developer Preview Program](https://developers.google.com/workspace/preview), which grants early access to certain features.

Suggests time periods across one or more calendars.

<a id="GENERIC_2"></a>

The following sample demonstrate how to use `curl` to invoke the `suggest_time` MCP tool.

<a id="MCP_CURL_REQUEST"></a>

| Curl Request |
| --- |
| [Code block](#code-block-1) |

<a id="code-block-1"></a>

```Bash
curl --location 'https://calendarmcp.googleapis.com/mcp/v1' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
--header 'content-type: application/json' \
--header 'accept: application/json, text/event-stream' \
--data '{
  "method": "tools/call",
  "params": {
    "name": "suggest_time",
    "arguments": {
      // provide these details according to the tool MCP specification
    }
  },
  "jsonrpc": "2.0",
  "id": 1
}'
                
```


<a id="Input.Schema"></a>

<a id="input-schema"></a>

## Input Schema

<a id="Input.Schema.description"></a>

Request message for SuggestTime.

<a id="Input.Schema.SuggestTimeRequest"></a>

<a id="suggesttimerequest"></a>

### SuggestTimeRequest

<a id="Input.Schema.SCHEMA_REPRESENTATION"></a>

| JSON representation |
| --- |
| [Code block](#code-block-2) |

<a id="code-block-2"></a>

```
{
  "attendeeEmails": [
    string
  ],
  "startTime": string,
  "endTime": string,

  "timeZone": string

  "durationMinutes": integer

  "preferences": {
    object (Preferences)
  }
}
```


<a id="Input.Schema.FIELDS"></a>

<a id="Input.Schema.FIELDS-table"></a>

| Fields |  |
| --- | --- |
| <a id="Input.Schema.FIELDS.field_section"></a>`attendeeEmails[]` | `string`<br><br> <br><br><br><br>Required. Attendee emails to find free time for. |
| <a id="Input.Schema.FIELDS.field_section_1"></a>`startTime` | `string`<br><br> <br><br><br><br>Required. Query interval start (ISO 8601). |
| <a id="Input.Schema.FIELDS.field_section_2"></a>`endTime` | `string`<br><br> <br><br><br><br>Required. Query interval end (ISO 8601). |
| <a id="Input.Schema.FIELDS.ONEOF"></a>Union field `_time_zone`.<br><br><br><br><br><br>`_time_zone` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS.field_section_3"></a>`timeZone` | `string`<br><br> <br><br><br><br>Optional. Time zone for search times (IANA ID, for example `Europe/Zurich`). Default: the offset of `start_time`, if none then the user's primary time zone. |
| <a id="Input.Schema.FIELDS.ONEOF_1"></a>Union field `_duration_minutes`.<br><br><br><br><br><br>`_duration_minutes` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS.field_section_4"></a>`durationMinutes` | `integer`<br><br> <br><br><br><br>Optional. Min duration of free slot in minutes. Default: `30`. |
| <a id="Input.Schema.FIELDS.ONEOF_2"></a>Union field `_preferences`.<br><br><br><br><br><br>`_preferences` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS.field_section_5"></a>`preferences` | `object (Preferences)`<br><br> <br><br><br><br>Preferences to find suggested time. |

<a id="Input.Schema.Preferences"></a>

<a id="preferences"></a>

### Preferences

<a id="Input.Schema.SCHEMA_REPRESENTATION_1"></a>

| JSON representation |
| --- |
| [Code block](#code-block-3) |

<a id="code-block-3"></a>

```
{

  "startHour": string

  "endHour": string

  "excludeWeekends": boolean

  "pageSize": integer
}
```


<a id="Input.Schema.FIELDS_1"></a>

<a id="Input.Schema.FIELDS_1-table"></a>

| Fields |  |
| --- | --- |
| <a id="Input.Schema.FIELDS_1.ONEOF"></a>Union field `_start_hour`.<br><br><br><br><br><br>`_start_hour` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS_1.field_section"></a>`startHour` | `string`<br><br> <br><br><br><br>Preferred start hour as "HH:mm" (24-hour format). |
| <a id="Input.Schema.FIELDS_1.ONEOF_1"></a>Union field `_end_hour`.<br><br><br><br><br><br>`_end_hour` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS_1.field_section_1"></a>`endHour` | `string`<br><br> <br><br><br><br>Preferred end hour as "HH:mm" (24-hour format). |
| <a id="Input.Schema.FIELDS_1.ONEOF_2"></a>Union field `_exclude_weekends`.<br><br><br><br><br><br>`_exclude_weekends` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS_1.field_section_2"></a>`excludeWeekends` | `boolean`<br><br> <br><br><br><br>Exclude weekends. |
| <a id="Input.Schema.FIELDS_1.ONEOF_3"></a>Union field `_page_size`.<br><br><br><br><br><br>`_page_size` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS_1.field_section_3"></a>`pageSize` | `integer`<br><br> <br><br><br><br>Max number of slots to return. Default: `5`. |

<a id="Output.Schema"></a>

<a id="output-schema"></a>

## Output Schema

<a id="Output.Schema.description"></a>

Response message for SuggestTime.

<a id="Output.Schema.SuggestTimeResponse"></a>

<a id="suggesttimeresponse"></a>

### SuggestTimeResponse

<a id="Output.Schema.SCHEMA_REPRESENTATION"></a>

| JSON representation |
| --- |
| [Code block](#code-block-4) |

<a id="code-block-4"></a>

```
{
  "timeSlots": [
    {
      object (TimeSlot)
    }
  ]
}
```


<a id="Output.Schema.FIELDS"></a>

<a id="Output.Schema.FIELDS-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS.field_section"></a>`timeSlots[]` | `object (TimeSlot)`<br><br> <br><br><br><br>Suggested time slots. |

<a id="Output.Schema.TimeSlot"></a>

<a id="timeslot"></a>

### TimeSlot

<a id="Output.Schema.SCHEMA_REPRESENTATION_1"></a>

| JSON representation |
| --- |
| [Code block](#code-block-5) |

<a id="code-block-5"></a>

```
{
  "startTime": string,
  "endTime": string,
  "durationMinutes": integer,
  "start": {
    object (DateOrDateTime)
  },
  "end": {
    object (DateOrDateTime)
  }
}
```


<a id="Output.Schema.FIELDS_1"></a>

<a id="Output.Schema.FIELDS_1-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS_1.field_section"></a>`startTime(deprecated)` | `string`<br><br> <br><br><br><br>This item is deprecated!<br><br> <br><br><br><br>Deprecated: use `start` instead. |
| <a id="Output.Schema.FIELDS_1.field_section_1"></a>`endTime(deprecated)` | `string`<br><br> <br><br><br><br>This item is deprecated!<br><br> <br><br><br><br>Deprecated: use `end` instead. |
| <a id="Output.Schema.FIELDS_1.field_section_2"></a>`durationMinutes(deprecated)` | `integer`<br><br> <br><br><br><br>This item is deprecated!<br><br> <br><br><br><br>Deprecated: use `start` and `end` to compute duration instead. |
| <a id="Output.Schema.FIELDS_1.field_section_3"></a>`start` | `object (DateOrDateTime)`<br><br> <br><br><br><br>The start time of the time slot. |
| <a id="Output.Schema.FIELDS_1.field_section_4"></a>`end` | `object (DateOrDateTime)`<br><br> <br><br><br><br>The end time of the time slot. |

<a id="Output.Schema.DateOrDateTime"></a>

<a id="dateordatetime"></a>

### DateOrDateTime

<a id="Output.Schema.SCHEMA_REPRESENTATION_2"></a>

| JSON representation |
| --- |
| [Code block](#code-block-6) |

<a id="code-block-6"></a>

```
{
  "date": string,
  "dateTime": string,
  "timeZone": string
}
```


<a id="Output.Schema.FIELDS_2"></a>

<a id="Output.Schema.FIELDS_2-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS_2.field_section"></a>`date` | `string`<br><br> <br><br><br><br>ISO 8601 date at midnight UTC (for example, `'2019-11-20T00:00:00Z'`). |
| <a id="Output.Schema.FIELDS_2.field_section_1"></a>`dateTime` | `string`<br><br> <br><br><br><br>ISO 8601 timestamp (for example, `'2019-11-20T08:19:06-07:00'`). |
| <a id="Output.Schema.FIELDS_2.field_section_2"></a>`timeZone` | `string`<br><br> <br><br><br><br>TZDB timezone name. |

<a id="GENERIC_3"></a>

<a id="tool-annotations"></a>

### Tool Annotations

Destructive Hint: ❌ | Idempotent Hint: ✅ | Read Only Hint: ✅ | Open World Hint: ❌

<a id="Authorization.Scopes"></a>

<a id="authorization-scopes"></a>

## Authorization Scopes

Requires one of the following OAuth scopes:

- `https://www.googleapis.com/auth/calendar`

- `https://www.googleapis.com/auth/calendar.readonly`

- `https://www.googleapis.com/auth/calendar.events`

- `https://www.googleapis.com/auth/calendar.events.freebusy`

- `https://www.googleapis.com/auth/calendar.freebusy`
