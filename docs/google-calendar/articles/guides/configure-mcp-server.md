# Configure the Calendar MCP server

Source: https://developers.google.com/workspace/calendar/api/guides/configure-mcp-server

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-10-09.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/guides/configure-mcp-server.html>); no article content intentionally omitted.

---

**Developer Preview:** Available as part of the [Google Workspace Developer Preview Program](https://developers.google.com/workspace/preview), which grants early access to certain features.

Google Calendar offers a remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that allows AI agents to securely interact with Google Calendar data. By configuring the Google Calendar MCP server, you enable AI applications like Google Antigravity and Claude to perform actions in Google Calendar.

The Google Calendar MCP server provides a standardized way for AI agents to:

- **Read data**: List calendars, retrieve events, and check availability.

- **Take action**: Create, update, and delete events.

- **Respect security**: Inherit the same permissions and data governance controls as the user.

<a id="prerequisites"></a>

## Prerequisites

- Membership in the [Google Workspace Developer Preview Program](https://developers.google.com/workspace/preview).

- A Google Cloud project. To create a project, see [Create a project](../related/workspace/guides/create-project.md).

- An MCP host, like [Google Antigravity](https://antigravity.google/).

- To run the commands on this page, set up the gcloud CLI in a local development environment by following these steps:

  - [Install the Google Cloud CLI](https://cloud.google.com/sdk/docs/install). If you installed the gcloud CLI previously, make sure you have the latest version by running `gcloud components update`.

  - If you're using an external identity provider (IdP), sign in to the gcloud CLI with your federated identity. For more information, see [Sign in to the gcloud CLI with your federated identity](https://docs.cloud.google.com/iam/docs/workforce-log-in-gcloud).

  - [Initialize the gcloud CLI](https://docs.cloud.google.com/sdk/docs/initializing).

<a id="configure"></a>

## Configure the Google Calendar MCP server

To use the Google Calendar MCP server, you must enable it in your Google Cloud project and then configure your MCP client to connect to it.

<a id="enable-apis"></a>

### Enable the APIs

To use the Google Calendar MCP server, you must enable the following API in your Google Cloud project:

- Google Calendar API

<a id="cli"></a>

### CLI

```Bash
gcloud services enable calendar-json.googleapis.com --project=PROJECT_ID
```


Replace `PROJECT_ID` with your Google Cloud project ID.

<a id="console"></a>

### Console

Enable the APIs in the Google Cloud console:

[Enable the APIs](https://console.cloud.google.com/flows/enableapi?apiid=calendar-json.googleapis.com)

<a id="enable-mcp-services"></a>

### Enable the MCP services

To enable the MCP components for Google Calendar, you must enable the following service in your Google Cloud project:

- Google Calendar MCP API

<a id="cli_1"></a>

### CLI

```Bash
gcloud services enable calendarmcp.googleapis.com --project=PROJECT_ID
```


Replace `PROJECT_ID` with your Google Cloud project ID.

<a id="console_1"></a>

### Console

Enable the MCP services in the Google Cloud console:

[Enable the MCP services](https://console.cloud.google.com/flows/enableapi?apiid=calendarmcp.googleapis.com)

<a id="configure-consent-screen"></a>

### Set up the OAuth consent screen

The Google Calendar MCP server uses OAuth 2.0 for authentication and authorization. You must configure the OAuth consent screen before you can create an OAuth client ID.

- In the Google Cloud console, go to **Google Auth Platform** **>** **Branding**.

  [Go to Branding](https://console.cloud.google.com/auth/branding)

- If you have already configured the **Google Auth Platform**, you can configure the following OAuth Consent Screen settings in [Branding](https://console.cloud.google.com/auth/branding), [Audience](https://console.cloud.google.com/auth/audience), and [Data Access](https://console.cloud.google.com/auth/scopes). If you see a message that says **Google Auth Platform not configured yet**, click **Get Started**:

  - Under **App Information**, in **App name**, type `Calendar MCP Server`.

  - In **User support email**, select your email address or an appropriate Google group.

  - Click **Next**.

  - Under **Audience**, select **Internal**. If you can't select **Internal**, select **External**.

  - Click **Next**.

  - Under **Contact Information**, enter an **Email address** where you can be notified about any changes to your project.

  - Click **Next**.

  - Under **Finish**, review the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) and if you agree, select **I agree to the Google API Services: User Data Policy**.

  - Click **Continue**.

  - Click **Create**.

  - If you selected **External** for user type, add test users:

    - Click **Audience**.

    - Under **Test users**, click **Add users**.

    - Enter your email address and any other authorized test users, then click **Save**.

- Click **Data Access** **>** **Add or Remove Scopes**. A panel appears with a list of scopes for each API that you've enabled in your Google Cloud project.

  - Under **Manually add scopes**, paste the scopes for the Google Calendar MCP server:

    - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

    - `https://www.googleapis.com/auth/calendar.events.freebusy`

    - `https://www.googleapis.com/auth/calendar.events.readonly`

  - Click **Add to Table**.

  - Click **Update**.

  - After selecting the scopes required by your app, on the **Data Access** page, click **Save**.

<a id="configure-mcp-client"></a>

### Configure your MCP client

To add the Google Calendar remote MCP server to your MCP client, follow the instructions for your client.

<a id="antigravity"></a>

### Antigravity

To add the Google Calendar remote MCP server to Antigravity, add the server configuration to your `mcp_config.json` file. These instructions support Antigravity 2.0, Antigravity IDE, and Antigravity CLI.

- Create an OAuth 2.0 client ID and secret:

  - In the Google Cloud console, go to **Google Auth Platform** **>** **Clients** **>** **Create Client**

    [Go to Create Client](https://console.cloud.google.com/auth/clients/create)

  - Select **Web application** as the application type.

  - Enter a **Name**.

  - In the **Authorized redirect URIs** section, click **+ Add URI**, and then add `https://antigravity.google/oauth-callback` in the **URIs** field.

  - Click **Create** and copy your **Client ID** and **Client Secret**.

- Open or create the configuration file `~/.gemini/config/mcp_config.json`.

- Add the `mcpServers` configuration to `mcp_config.json`:

  ```JSON
  {
    "mcpServers": {
      "calendar": {
        "serverUrl": "https://calendarmcp.googleapis.com/mcp/v1",
        "oauth": {
          "clientId": "OAUTH_CLIENT_ID",
          "clientSecret": "OAUTH_CLIENT_SECRET"
        }
      }
    }
  }
  ```


  Replace the following:

  - `OAUTH_CLIENT_ID`: The client ID you created.

  - `OAUTH_CLIENT_SECRET`: The client secret you created.

- Save `mcp_config.json`.

- Authenticate the MCP server. You can authenticate using either the GUI settings or the CLI:

  - **For Antigravity IDE or GUI (Antigravity 2.0):**

    - Open your settings screen (e.g., click **Settings** at the bottom-left or open **Antigravity User Settings**).

    - Navigate to **Customizations**.

    - Under **Installed MCP Servers**, click **Refresh**.

    - Find `calendar` in the list, click **Authenticate**, sign in to your Google Account, copy the authorization code, paste it into the input dialog, and click **Submit**.

  - **For Antigravity CLI:**

    - Start Antigravity CLI:

      ```Bash
      agy
      ```

    - Open the interactive MCP management panel by running:

      ```Bash
      /mcp
      ```

    - Use the arrow keys to select `calendar`, move to the **Authenticate** action, and press **Enter**. Complete the sign-in flow in your browser, copy the authorization code, paste it into the terminal prompt, and press **Enter**.

- Verify that the server is correctly configured and running:

  - **For Antigravity IDE or GUI:** A **Sign out** button is displayed next to the server under **Customizations** > **Installed MCP Servers**.

  - **For Antigravity CLI:** Open the `/mcp` panel to view your configured MCP servers. Verified and authenticated servers display **Authed** next to their names inside the interactive TUI panel. You can select the server under the dashboard view to inspect its status and list all of its available tools.

The remote MCP server is ready to use in Antigravity.

<a id="claude"></a>

### Claude

To use the Google Calendar remote MCP server with Claude.ai or Claude Desktop, you must have the Claude Enterprise, Pro, Max, or Team plan.

To add the Google Calendar remote MCP server to Claude, configure a custom connector with an OAuth client ID and secret.

- Create an OAuth 2.0 client ID and secret:

  - In the Google Cloud console, go to **Google Auth Platform** **>** **Clients** **>** **Create Client**

    [Go to Create Client](https://console.cloud.google.com/apis/credentials/oauthclient)

  - Select **Web application** as the application type.

  - Enter a **Name**.

  - In the **Authorized redirect URIs** section, click **+ Add URI**, and then add `https://claude.ai/api/mcp/auth_callback` in the **URIs** field.

  - Click **Create** and copy your **Client ID** and **Client Secret**.

- Configure the MCP server in Claude:

  - In Claude.ai or Claude Desktop, go to **Settings** (or **Admin settings**) > **Connectors**.

  - Click **Add custom connector**.

  - Enter the connection details for the Google Calendar product:

    - **Server name**: `Google Calendar`.

    - **Remote MCP server URL**: `https://calendarmcp.googleapis.com/mcp/v1`

  - In **Advanced settings**, enter your **OAuth client ID** and **OAuth client secret**.

  - Click **Add**.

<a id="others"></a>

### Others

Many AI applications have ways to connect to a remote MCP server. You typically need to enter details about the server, like its name, endpoints, transport protocol, and authentication method. For the Google Calendar remote MCP server, enter the following:

- **Server name**: `calendar`

- **Server URL**: `https://calendarmcp.googleapis.com/mcp/v1`

- **Transport**: [Streamable HTTP](https://modelcontextprotocol.io/specification/latest/basic/transports/streamable-http)

- **Authentication**: The Google Calendar remote MCP server uses OAuth 2.0. For details, see [Learn about authentication and authorization](../related/workspace/guides/auth-overview.md).

For more details on connecting different types of clients, see [Configure MCP in an AI application](https://docs.cloud.google.com/mcp/configure-mcp-ai-application).

<a id="test-mcp-server"></a>

## Test the Google Calendar MCP server

After you configure the MCP client, you can verify the connection by running some test prompts.

Try asking your MCP client the following questions:

- **"When is my next meeting with Ariel?"**

  The client checks your schedule using `calendar.list_events` and details your next meeting with Ariel.

If the tools execute successfully and you receive relevant responses, your Google Calendar MCP server is correctly configured.

<a id="troubleshooting"></a>

## Troubleshooting

If you encounter issues connecting to the MCP server, you can check for errors in the OAuth logs. Ask your administrator to check the **OAuth log events** in the [security investigation tool](https://support.google.com/a/answer/7575955).

<a id="tool-reference"></a>

## Tool reference

The following tools are available for the Google Calendar MCP server:

- `create_event`

- `delete_event`

- `get_event`

- `list_calendars`

- `list_events`

- `respond_to_event`

- `suggest_time`

- `update_event`

<a id="prompt-injection"></a>

## Important security consideration: Indirect prompt injection

When you expose a language model to untrusted data, there is a risk of an [indirect prompt injection attack](https://en.wikipedia.org/wiki/Prompt_injection). Because MCP hosts like Google Antigravity have access to powerful tools and APIs through the Google Calendar MCP server, they can read, modify, and delete data in your Google Account.

To mitigate these risks, you must screen prompts and responses for malicious content or prompt injection attacks. You can use the Google-provided Model Armor or you can use your own solution if you document it in order for users to accept that risk. For more information, see [Configure security for Google Workspace MCP servers](https://developers.google.com/workspace/guides/configure-mcp-security).

Follow these best practices:

- **Only use trusted tools.** Never connect Google Calendar MCP server to untrusted or unverified applications.

- **Be cautious with untrusted inputs.** Avoid asking your MCP client to process events or other resources from unverified sources. These inputs may contain hidden instructions that can hijack your session, allowing an attacker to modify, steal, or delete your data.

- **Review all actions.** Always carefully review the actions taken by your AI client on your behalf to ensure they are correct and align with your intentions.

<a id="related"></a>

## Related topics

- [Configure security for Google Workspace MCP servers](https://developers.google.com/workspace/guides/configure-mcp-security)

- [Google Workspace MCP servers in Antigravity (codelab)](https://codelabs.developers.google.com/google-workspace-mcp-antigravity#0)

- [List of Google Workspace MCP servers](https://developers.google.com/workspace/guides/configure-mcp-servers#support-products)
