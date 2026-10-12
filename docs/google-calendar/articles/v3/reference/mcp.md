# MCP Reference: calendarmcp.googleapis.com

Source: https://developers.google.com/workspace/calendar/api/v3/reference/mcp

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-17.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../pages/v3/reference/mcp.html>); no article content intentionally omitted.

---

<a id="/workspace/calendar/api/v3/reference/mcp/index"></a>

**Developer Preview:** Available as part of the [Google Workspace Developer Preview Program](https://developers.google.com/workspace/preview), which grants early access to certain features.

This is an MCP server provided by Google Calendar API. The server provides tools for developers to build LLM applications on top of Calendar.

A [Model Context Protocol (MCP) server](https://modelcontextprotocol.io/docs/learn/server-concepts) acts as a proxy between an external service that provides context, data, or capabilities to a Large Language Model (LLM) or AI application. MCP servers connect AI applications to external systems such as databases and web services, translating their responses into a format that the AI application can understand.

<a id="server-setup"></a>

### Server Setup

You must [configure the Calendar MCP server](../../guides/configure-mcp-server.md) before use. For more information about using Google and Google Cloud remote MCP servers, see [Google Cloud MCP servers overview](https://docs.cloud.google.com/mcp/overview).

<a id="rest_endpoints"></a>

<a id="server-endpoints"></a>

### Server Endpoints

An MCP service endpoint is the network address and communication interface (usually a URL) of the MCP server that an AI application (the Host for the MCP client) uses to establish a secure, standardized connection. It is the point of contact for the LLM to request context, call a tool, or access a resource. Google MCP endpoints can be global or regional.

The Calendar MCP API MCP server has the following global MCP endpoints:

- https://calendarmcp.googleapis.com/mcp/v1

The Calendar MCP API MCP server offers the following MCP toolset endpoints:

- https://calendarmcp.googleapis.com/mcp/v1

<a id="mcp-tools"></a>

## MCP Tools

An [MCP tool](https://modelcontextprotocol.io/legacy/concepts/tools) is a function or executable capability that an MCP server exposes to a LLM or AI application to perform an action in the real world. Toolsets are a group of tools that are useful for a specific task. Using toolsets can help your agent perform better because it decreases the number of tools available to your agent.

<a id="toolsets"></a>

### Toolsets

The calendarmcp.googleapis.com MCP server has the following toolsets:

<a id="toolsetsSection"></a>

<a id="toolsetsSection-table"></a>

| MCP Toolsets |  |  |
| --- | --- | --- |
| Endpoint | Description | Tools |
| <a id="toolsetsSection.mcp.v1"></a>/mcp/v1 | Public toolset for Google Calendar MCP. | `    list_events  get_event  list_calendars  suggest_time  create_event  update_event  delete_event  respond_to_event  search_events              ` |

<a id="tools_overview"></a>

<a id="tools_overview.GENERIC"></a>

<a id="get-mcp-tool-specifications"></a>

### Get MCP tool specifications

To get the MCP tool specifications for all tools in an MCP server, use the `tools/list` method. The following example demonstrates how to use `curl` to list all tools and their specifications currently available within the MCP server.

<a id="tools_overview.GENERIC.MCP_CURL_REQUEST"></a>

| Curl Request |
| --- |
| [Code block](#code-block-1) |

<a id="code-block-1"></a>

```Bash
curl --location 'https://calendarmcp.googleapis.com/mcp/v1' \
--header 'content-type: application/json' \
--header 'accept: application/json, text/event-stream' \
--data '{
    "method": "tools/list",
    "jsonrpc": "2.0",
    "id": 1
}'
                    
```
