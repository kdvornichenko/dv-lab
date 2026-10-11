# Settings

Source: https://developers.google.com/workspace/calendar/api/v3/reference/settings

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-05-12.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../pages/v3/reference/settings.html>); no article content intentionally omitted.

---

<a id="overview"></a>

Setting resources represent settings that users can change from the Calendar UI, such as the user's time zone. They can be retrieved via [list](settings/list.md) and [get](settings/get.md) methods. Note that if a setting has its default value, it might not be returned.<br>
<br>
The list of supported settings: <br>

| Setting id | Description | Allowed values | Default value |
| --- | --- | --- | --- |
| autoAddHangouts | Whether to automatically add video conferences (Meet or add-on) to all events. Note this setting is ignored by the server if the conferenceDataVersion is larger than 0 as it is the client’s responsibility to handle the logic according to this setting. Read only. | “true”, “false” | “false” |
| dateFieldOrder | What should the order of day (D), month (M) and year (Y) be when displaying dates. | ”MDY”, “DMY”, “YMD” | ”MDY” |
| defaultEventLength | The default length of events (in minutes) that were created without an explicit duration. | positive number | “60” |
| format24HourTime | Whether to show the time in 24 hour format. | “true”, “false” | “false” |
| hideInvitations | Whether to hide events to which the user is invited but hasn’t acted on (for example by responding). | “true”, “false” | “false” |
| hideWeekends | Whether the weekends should be hidden when displaying a week. | “true”, “false” | “false” |
| locale | User’s locale. | "in", "ca","cs", "da", "de", "en\_GB", "en", "es", "es\_419", "tl", "fr", "hr", "it", "lv", "lt", "hu", "nl", "no", "pl", "pt\_BR", "pt\_PT", "ro", "sk", "sl", "fi", "sv", "tr", "vi", "el", "ru", "sr", "uk", "bg", "iw", "ar", "fa", "hi", "th", "zh\_TW", "zh\_CN", "ja", "ko" | “en” |
| remindOnRespondedEventsOnly | Whether event reminders should be sent only for events with the user’s response status “Yes” and “Maybe”. | “true”, “false” | “false” |
| showDeclinedEvents | Whether events to which the user responded “No” should be shown on the user’s calendar. | “true”, “false” | “true” |
| timezone | The ID of the user’s timezone. | See [http://www.iana.org/time-zones](http://www.iana.org/time-zones) | “Etc/GMT” |
| useKeyboardShortcuts | Whether the keyboard shortcuts are enabled. | “true”, “false” | “true” |
| weekStart | Whether the week should start on Sunday (0), Monday (1) or Saturday (6). | "0", "1", "6" | “0” |

For a list of [methods](settings.md#methods) for this resource, see the end of this page.

<a id="resource"></a>

<a id="resource-representations"></a>

## Resource representations

<a id="alt-json"></a>

```Text only
{
  "kind": "calendar#setting",
  "etag": etag,
  "id": string,
  "value": string
}
```


<a id="properties"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="etag"></a>`etag` | `etag` | ETag of the resource. |  |
| <a id="id"></a>`id` | `string` | The id of the user setting. |  |
| <a id="kind"></a>`kind` | `string` | Type of the resource ("`calendar#setting`"). |  |
| <a id="value"></a>`value` | `string` | Value of the user setting. The format of the value depends on the ID of the setting. It must always be a UTF-8 string of length up to 1024 characters. |  |

<a id="methods"></a>

## Methods

[get](settings/get.md)

Returns a single user setting.

[list](settings/list.md)

Returns all user settings for the authenticated user.

[watch](settings/watch.md)

Watch for changes to Settings resources.
