# Usage limits

Source: https://developers.google.com/workspace/calendar/api/guides/quota

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-11.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/guides/quota.html>); no article content intentionally omitted.

---

As of **May 1, 2026**, the usage limits for this API were updated. Google Cloud projects that made any use of this API between November 2025 and April 2026 will continue with their previously set usage quotas. Cloud projects created on or after May 1, 2026 are subject to the new API quotas.

For more information, including timelines, see [Google Workspace standardized model for agent tools and APIs](https://developers.google.com/workspace/tools-safety).

For the full announcement, see [Agent tools and security updates for Google Workspace developers](http://workspaceupdates.googleblog.com/2026/05/agent-tools-and-security-updates-for-workspace-developers.html).

The Google Calendar API has quotas to make sure that it's used fairly by all users. There are three important limitations to consider when using the Calendar API:

- **API usage quotas**: Enforced per project and per user. For more information, see [Calendar API usage quota types](quota.md#quotas).

- **General Google Calendar usage limits**: The Google Calendar API is a shared service that has limitations to protect the overall performance of the Google Workspace system. For more information, see [Avoid Calendar use limits](https://knowledge.workspace.google.com/admin/calendar/avoid-calendar-use-limits)

- **Operational limits**: These limits might be limited at any time. For example, if you attempt to write to a single calendar in quick succession.

<a id="quotas"></a>

## Calendar API quotas

Two types of quotas are enforced:

- **Per minute per project:** This is the number of requests your Google Cloud project can make in one minute.

- **Per minute per user per project:** This is the number of requests any one particular user can make in your Cloud project. This limit aims at helping you ensure a fair distribution of usage among your users.

Quotas are calculated per minute using a sliding window. A rapid burst of traffic that exceeds your per-minute quota during one minute will result in rate limiting during the next window to ensure that, on average, your usage remains within the quotas.

The following table details these limits:

| Usage limit type | Limit |
| --- | --- |
| Per minute per project | 10,000 requests |
| Per minute per user per project | 600 requests |

<a id="daily_billing_threshold"></a>

## Daily billing threshold

This **per day per project** limit defines the maximum number of requests your Google Cloud project can use within a 24-hour period before charges apply.

Usage under this threshold doesn't incur extra charges and your Google Cloud account isn't billed. Full billing details will be shared later in 2026 with at least 90 days' notice before any changes take effect.

You cannot request an increase on this daily threshold limit.

The following table details the limit:

| Threshold limit type | Limit |
| --- | --- |
| Per day per project | 1,000,000 requests |

For more information, see [Google Workspace standardized model for agent tools and APIs](https://developers.google.com/workspace/tools-safety).

<a id="exponential"></a>

## Resolve time-based quota errors

For all time-based errors (maximum of N requests per X minutes), we recommend your code catches the exception and uses a *truncated exponential backoff* to make sure your devices don't generate excessive load.

Exponential backoff is a standard error handling strategy for network applications. An exponential backoff algorithm retries requests using exponentially increasing wait times between requests, up to a maximum backoff time. If requests are still unsuccessful, it's important that the delays between requests increase over time until the request is successful.

<a id="example-algorithm"></a>

### Example algorithm

An exponential backoff algorithm retries requests exponentially, increasing the wait time between retries up to a maximum backoff time. For example:

- Make a request to Google Calendar API.

- If the request fails, wait 1 + `random_number_milliseconds` and retry the request.

- If the request fails, wait 2 + `random_number_milliseconds` and retry the request.

- If the request fails, wait 4 + `random_number_milliseconds` and retry the request.

- And so on, up to a `maximum_backoff` time.

- Continue waiting and retrying up to some maximum number of retries, but don't increase the wait period between retries.

where:

- The wait time is `min(((2^n)+random_number_milliseconds), maximum_backoff)`, with `n` incremented by 1 for each iteration (request).

- `random_number_milliseconds` is a random number of milliseconds less than or equal to 1,000. This helps to avoid cases in which many clients are synchronized by some situation and all retry at once, sending requests in synchronized waves. The value of `random_number_milliseconds` is recalculated after each retry request.

- `maximum_backoff` is typically 32 or 64 seconds. The appropriate value depends on the use case.

The client can continue retrying after it has reached the `maximum_backoff` time. Retries after this point don't need to continue increasing backoff time. For example, if a client uses a `maximum_backoff` time of 64 seconds, then after reaching this value, the client can retry every 64 seconds. At some point, clients should be prevented from retrying indefinitely.

The wait time between retries and the number of retries depend on your use case and network conditions.

<a id="pricing"></a>

## Pricing

All standard use of the Google Calendar API is available at no additional cost. Exceeding the quota request limits is planned to incur charges to your Google Cloud billing account later in 2026. For more information, see [Google Workspace standardized model for agent tools and APIs](https://developers.google.com/workspace/tools-safety).

<a id="increase"></a>

## Request a quota increase

Depending on your project's resource usage, you might want to request a quota adjustment. API calls by a service account are considered to be using a single account. Applying for an adjusted quota doesn't guarantee approval. Quota adjustment requests that would significantly increase the quota value can take longer to be approved.

Not all projects have the same quotas. As you increasingly use Google Cloud over time, your quota values might need to increase. If you expect a notable upcoming increase in usage, you can proactively [request quota adjustments](https://docs.cloud.google.com/docs/quotas/view-manage#requesting_higher_quota) from the [Quotas & System Limits](https://console.cloud.google.com/iam-admin/quotas) page in the Google Cloud console.

To learn more, see the following resources:

- [About quota adjustments](https://docs.cloud.google.com/docs/quotas/overview#about_increase_requests)

- [View your quota usage and limits](https://docs.cloud.google.com/docs/quotas/view-manage#viewing_your_quota_console)

- [Request a higher quota limit](https://docs.cloud.google.com/docs/quotas/view-manage#requesting_higher_quota)

<a id="troubleshoot"></a>

## Troubleshoot

If either quota is exceeded, you're rate limited and receive a [`403
usageLimits`](errors.md#403_rate_limit_exceeded) status code or a [`429
usageLimits`](errors.md#429_too_many_requests) status code in response to your queries.

If this happens, you can try the following:

- Make sure to follow all the best practices: use [exponential backoff](quota.md#exponential), [randomize traffic patterns](quota.md#randomize-traffic), and use [push notifications](quota.md#push-notifications).

- If your project is growing and you have more users, you can request a [quota increase](quota.md#increase).

- If you hit per-user quota limits, you can do the following:

  - If you use a service account, [allocate the load to users](quota.md#service-accounts) or split it between multiple service accounts.

  - While you can request an increase in the per-user quota, in general, it's not recommended to increase it above the default value as your application may start to hit other types of limits, for example, general calendar usage limits or operational limits.

- Test your quota limits by registering a separate test-only project that has a similar configuration to your production project. For more information, see [Test quota limit handling](quota.md#test-quota-limit).

<a id="randomize-traffic"></a>

### Randomize traffic patterns

Calendar clients are prone to spiky traffic patterns caused by multiple clients performing operations at the same time. For example, a common bad practice for a Calendar client is to perform a full sync at midnight. This would almost certainly lead to exceeding your per-minute quota and result in rate limiting and backoffs.

To avoid this, make sure that your traffic is spread throughout the day wherever possible. If your client needs to do a daily sync, have the client determine a random time (different for each client). If you need to perform an operation on a regular basis, vary the interval +/- 25%. This will distribute the traffic more evenly and provide a much better user experience.

<a id="push-notifications"></a>

### Use push notifications

A common use case is to perform an action whenever something changes in the user's calendar. An anti-pattern here is to repeatedly poll every calendar of interest. This will very quickly use up all your quota. For example, if your application has 5,000 users and polls each user's calendar once a minute, then this requires a per-minute quota of at least 5,000, even before any work is done.

Server-side applications can register for push notifications, which allows us to notify you when something of interest happens. These require more work to set up, but allow for dramatically more efficient use of your quota, and provide a better user experience. Make sure you specify the `eventType` for which you want to be notified. For more information, see [Push notifications](push.md).

<a id="service-accounts"></a>

### Proper allocation with service accounts

If your application is performing requests using [domain-wide delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority), by default the *service account* is charged with regard to "per minute per user per project" quotas, and not the user you're impersonating. This means that the service account will likely run out of quota and be rate-limited, even though it might be operating on multiple users' calendars.

You can avoid this by using the `quotaUser` URL parameter (or `x-goog-quota-user` HTTP header) to indicate which user is charged. This is used only for quota calculations. For more information, see [Limiting requests per user](https://docs.cloud.google.com/apis/docs/capping-api-usage#limiting_requests_per_user).

<a id="test-quota-limit"></a>

### Test quota limit handling

To make sure that your application can gracefully handle reaching quota limits in practice (for example, through [retries with exponential backoff](quota.md#exponential)) and to minimize any potential disturbances to your users, we strongly recommend testing your scenario out in a real environment.

To test without interference to your real application usage, we recommend registering a separate test-only project in the [Google Cloud console](https://console.cloud.google.com/) and then [configuring the OAuth consent screen](../related/workspace/guides/configure-oauth-consent.md) in a way similar to your production project. You can then set artificially low [quota limits](https://console.cloud.google.com/iam-admin/quotas) for this project and observe the behavior of your application.

<a id="calendar-mcp-server-quotas"></a>

## Calendar MCP server quotas

The Calendar MCP server uses a query cost allocation metric. The following tables detail the query cost for each Calendar MCP server method by section:

<a id="calendar-mcp-quotas"></a>

### Calendar MCP quotas

Two types of quotas are enforced:

- **Per minute per project:** This is the query cost to your Google Cloud project for one minute.

- **Per minute per user per project:** This is the query cost to your Google Cloud project for one minute that any one particular user can use.

The following table details these quotas:

| Usage limit type | Query cost |
| --- | --- |
| Per minute per project | 10,000 |
| Per minute per user per project | 600 |

<a id="calendar-mcp-toolsets"></a>

### Calendar MCP toolset quotas

The following table details the query cost for each `calendarmcp.googleapis.com` toolset:

| Endpoint | Tool | Query cost |
| --- | --- | --- |
| **/mcp/v1** | `create_event` | 1 |
| `delete_event` | 10 |  |
| `get_event` | 1 |  |
| `list_events` | 1 |  |
| `respond_to_event` | 1 |  |
| `search_events` | 1 |  |
| `update_event` | 1 |  |
| `suggest_time` | 1 |  |
| `list_calendars` | 1 |  |

For more information, see the [Calendar MCP API Reference](../v3/reference/mcp.md).

<a id="related-topics"></a>

## Related topics

- [Send batch requests](batch.md)

- [Performance tips](performance.md)

- [Avoid Calendar use limits](https://knowledge.workspace.google.com/admin/calendar/avoid-calendar-use-limits)
