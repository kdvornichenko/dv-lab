# MCP Tools Reference: calendarmcp.googleapis.com

Source: https://developers.google.com/workspace/calendar/api/v3/reference/mcp/tools_list/list_calendars

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-17.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../../pages/v3/reference/mcp/tools_list/list_calendars.html>); no article content intentionally omitted.

---

<a id="/workspace/calendar/api/v3/reference/mcp/tools_list/list_calendars"></a>

<a id="GENERIC"></a>

<a id="tool:-list_calendars"></a>

## Tool: `list_calendars`

<a id="GENERIC_1"></a>

**Developer Preview:** Available as part of the [Google Workspace Developer Preview Program](https://developers.google.com/workspace/preview), which grants early access to certain features.

Returns the calendars this user has access to (their calendar list). Use this tool to resolve calendar identifying data (for example, 'my family calendar') into its corresponding `calendar_id` (email identifier)

<a id="GENERIC_2"></a>

The following sample demonstrate how to use `curl` to invoke the `list_calendars` MCP tool.

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
    "name": "list_calendars",
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

<a id="Input.Schema.ListCalendarsRequest"></a>

<a id="listcalendarsrequest"></a>

### ListCalendarsRequest

<a id="Input.Schema.SCHEMA_REPRESENTATION"></a>

| JSON representation |
| --- |
| [Code block](#code-block-2) |

<a id="code-block-2"></a>

```
{

  "pageSize": integer

  "pageToken": string
}
```


<a id="Input.Schema.FIELDS"></a>

<a id="Input.Schema.FIELDS-table"></a>

| Fields |  |
| --- | --- |
| <a id="Input.Schema.FIELDS.ONEOF"></a>Union field `_page_size`.<br><br><br><br><br><br>`_page_size` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS.field_section"></a>`pageSize` | `integer`<br><br> <br><br><br><br>Optional. Max results per page. Default `100`, max `250`. |
| <a id="Input.Schema.FIELDS.ONEOF_1"></a>Union field `_page_token`.<br><br><br><br><br><br>`_page_token` can be only one of the following: |  |
| <a id="Input.Schema.FIELDS.field_section_1"></a>`pageToken` | `string`<br><br> <br><br><br><br>Optional. Token specifying which result page to return. |

<a id="Output.Schema"></a>

<a id="output-schema"></a>

## Output Schema

<a id="Output.Schema.description"></a>

<a id="Output.Schema.ListCalendarsResponse"></a>

<a id="listcalendarsresponse"></a>

### ListCalendarsResponse

<a id="Output.Schema.SCHEMA_REPRESENTATION"></a>

| JSON representation |
| --- |
| [Code block](#code-block-3) |

<a id="code-block-3"></a>

```
{
  "calendars": [
    {
      object (CalendarListItem)
    }
  ],

  "nextPageToken": string
}
```


<a id="Output.Schema.FIELDS"></a>

<a id="Output.Schema.FIELDS-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS.field_section"></a>`calendars[]` | `object (CalendarListItem)`<br><br> <br><br><br><br>List of calendars. |
| <a id="Output.Schema.FIELDS.ONEOF"></a>Union field `_next_page_token`.<br><br><br><br><br><br>`_next_page_token` can be only one of the following: |  |
| <a id="Output.Schema.FIELDS.field_section_1"></a>`nextPageToken` | `string`<br><br> <br><br><br><br>Next page token. Omitted if no next page exists. |

<a id="Output.Schema.CalendarListItem"></a>

<a id="calendarlistitem"></a>

### CalendarListItem

<a id="Output.Schema.SCHEMA_REPRESENTATION_1"></a>

| JSON representation |
| --- |
| [Code block](#code-block-4) |

<a id="code-block-4"></a>

```
{
  "id": string,
  "summary": string,
  "description": string,
  "timeZone": string
}
```


<a id="Output.Schema.FIELDS_1"></a>

<a id="Output.Schema.FIELDS_1-table"></a>

| Fields |  |
| --- | --- |
| <a id="Output.Schema.FIELDS_1.field_section"></a>`id` | `string`<br><br> <br><br><br><br>Identifier. Email address of the calendar. |
| <a id="Output.Schema.FIELDS_1.field_section_1"></a>`summary` | `string`<br><br> <br><br><br><br>Output only. Title. |
| <a id="Output.Schema.FIELDS_1.field_section_2"></a>`description` | `string`<br><br> <br><br><br><br>Output only. Description. |
| <a id="Output.Schema.FIELDS_1.field_section_3"></a>`timeZone` | `string`<br><br> <br><br><br><br>Output only. Time zone. |

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

- `https://www.googleapis.com/auth/calendar.calendarlist`

- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
