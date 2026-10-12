# Google Calendar API release notes

Source: https://developers.google.com/workspace/calendar/release-notes

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/related/workspace/calendar/release-notes.html>); no article content intentionally omitted.

---

To get the latest product updates delivered to you, add the URL of this page to your [feed reader](https://wikipedia.org/wiki/Comparison_of_feed_aggregators), or add the feed URL directly: `https://developers.google.com/feeds/calendar-release-notes.xml`.

This page contains release notes for features and updates to the Calendar API. We recommend that Calendar API developers periodically check this list for any new announcements.

<a id="July_14_2026"></a>

## July 14, 2026

Feature

**Generally Available:** You can now filter calendar list entries to show only calendars belonging to your organization using the new `showOwnOrganizationOnly` parameter in the `calendarList.list` endpoint.

To learn more, see the [`calendarList.list` documentation](../../../v3/reference/calendarList/list.md).

<a id="July_07_2026"></a>

## July 07, 2026

Feature

**Generally available:** We are introducing a new calendar access level: `writerWithoutPrivateAccess`. This new level permits read and write access to events that aren't private on a calendar, and shows private events as busy blocks. Users with this role cannot modify or see details for private events.

For more details, see the [ACL resource documentation](../../../v3/reference/acl.md).

Change

To ensure consistent visibility across recurring events, changing the visibility of a single instance in the Google Calendar API can affect all instances of the series:

- **More restrictive changes propagate:** If you change the visibility of one instance of a recurring event to a more restrictive setting (for example, from `public` to `private`), the change is propagated to all instances of the recurring event.

- **Less restrictive changes are ignored:** If you attempt to change the visibility of one instance of a recurring event to a less restrictive setting (for example, from `private` to `public`), the change is ignored and the visibility remains unchanged. To make a recurring event less restrictive, you must update the parent recurring event.

For more information, see [Share calendars and events](../../../concepts/sharing.md) and the [`events` resource reference](../../../v3/reference/events.md).

Feature

**Generally Available:** The Google Calendar API now provides full support for custom labels and colors, allowing users to categorize events with a flexible palette beyond the previously fixed set of colors.

You can now list and modify labels on a calendar using the [`labelProperties`](../../../v3/reference/calendars.md#labelProperties) on the `Calendars` resource.

Then, you can assign a label to an event by setting the ID of the label to [`eventLabelId`](../../../v3/reference/events.md#eventLabelId) on the `Events` resource.

Note that, in order to enable the labels feature, you must set the `eventLabelVersion` request parameter to `1` on [`import`](../../../v3/reference/events/import.md#eventLabelVersion), [`insert`](../../../v3/reference/events/insert.md#eventLabelVersion), [`patch`](../../../v3/reference/events/patch.md#eventLabelVersion) and [`update`](../../../v3/reference/events/update.md#eventLabelVersion) operations on Events resources.

To learn more, see the [Manage custom labels and colors guide](../../../guides/labels.md).

<a id="June_18_2026"></a>

## June 18, 2026

Feature

**Generally Available:** Workspace administrators can now use the Google Calendar API to programmatically transfer the ownership of secondary calendars between users within the same organization.

To learn more, see the [`Calendars.transferOwnership`](../../../v3/reference/calendars/transferOwnership.md) method documentation.

<a id="June_01_2026"></a>

## June 01, 2026

Announcement

**Generally available starting June 29, 2026:** We are introducing a new calendar access level: `writerWithoutPrivateAccess`. This new level permits read and write access to events that aren't private on a calendar, and shows private events as busy blocks. Users with this role cannot modify or see details for private events.

<a id="May_01_2026"></a>

## May 01, 2026

Announcement

**Generally Available**: Updates to Calendar API usage quotas

A new tiering model with updates to API usage quotas will start to roll out. For more information, see [Google Workspace standardized model for agent tools and APIs](https://developers.google.com/workspace/tools-safety).

<a id="April_22_2026"></a>

## April 22, 2026

Feature

**[Developer Preview](https://developers.google.com/workspace/preview)**: The [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for Google Calendar is now available in developer preview. MCP is an open protocol that enables seamless integration between AI applications and your calendars. By configuring the Calendar MCP server, you enable AI agents to securely read your schedule and take actions, such as creating, updating, or deleting events.

For example, you can ask your AI agent: *"When is my next meeting with Ariel?"*

To get started with the Calendar MCP server, see the following documentation:

- [Set up the Calendar MCP server](../../../guides/configure-mcp-server.md)

- [Calendar MCP tool reference](../../../v3/reference/mcp.md)

To find more available MCP servers, see [Model Context Protocol (MCP) servers in Google Workspace](https://developers.google.com/workspace/guides/configure-mcp-servers).

<a id="February_17_2026"></a>

## February 17, 2026

Announcement

We have updated the guidance for using Google Meet conferences on Google Calendar events.

Reusing Google Meet codes across different events can cause access issues, and can expose meeting details to unintended users. We recommend that you generate a new conference using the `createRequest` field for every new event.

For more information about using events with the Calendar API, [see the documentation for the `events` resource](../../../v3/reference/events.md#conferenceData).

<a id="October_27_2025"></a>

## October 27, 2025

Feature

**Generally available starting November 10, 2025**:

Secondary calendars will now have a single data owner. This applies to both existing and newly created calendars. In the Calendar API, the data owner's email address will be in the read-only `dataOwner` field in the `Calendars` and `CalendarList` resources.

To prevent unintended actions and undesired states, the following new restrictions apply:

- Only the data owner can delete secondary calendars.

- The data owner's access level cannot be changed from the default `owner` access.

- The data owner cannot remove an owned calendar from their calendar list. They can hide it from their UI.

When a new secondary calendar is created, the authenticated user that makes the request is the data owner. We recommend that you use user authentication to create secondary calendars. Data ownership can be transferred in the Google Calendar UI.

For more details, see the documentation for [`Calendars`](../../../v3/reference/calendars.md) and [`CalendarList`](../../../v3/reference/calendarList.md) closer to November 10.

<a id="November_19_2024"></a>

## November 19, 2024

Feature

You can now access birthday and other special events that are automatically created from Google Contacts using the Calendar API.

Birthday events now have [`birthdayProperties`](../../../v3/reference/events.md#birthdayProperties) that show birthday-specific event data, such as the type of the special event, whether it's a birthday, an anniversary, or another significant date, and the contact that the event is linked to. You can use the [contact](../../../v3/reference/events.md#birthdayProperties.contact) as a resource name in the [People API](https://developers.google.com/people) to fetch contact details.

To learn more, see the [developer guide for the birthday event type](../../../guides/event-types.md#birthday).

<a id="August_05_2024"></a>

## August 05, 2024

Feature

**Generally available starting September 17, 2024:** Create and manage birthdays directly within Google Calendar. Birthdays are exposed in the Calendar API as a new [`eventType`](../../../v3/reference/events.md#eventType) called `"birthday"` which distinguishes special all-day events with an annual recurrence. Birthday events support a limited set of event properties.

You can filter by the birthday event type using the [`events.list()`](../../../v3/reference/events/list.md) and [`events.watch()`](../../../v3/reference/events/watch.md) methods. If no type filters are specified, all event types including birthdays are returned.

To learn more, see our [developer guide about working with the birthday event type](../../../guides/event-types.md#birthday).

<a id="May_22_2024"></a>

## May 22, 2024

Change

The following changes to [events from Gmail](https://support.google.com/calendar/answer/6084018) take effect on **May 30, 2024**:

- Events from Gmail use `fromGmail` instead `default` as the value for the [`eventType`](../../../v3/reference/events/watch.md#eventTypes) field. You can filter by this new event type using the [`events.list()`](../../../v3/reference/events/list.md) and [`events.watch()`](../../../v3/reference/events/watch.md) methods.

- Events from Gmail use the email address of the email recipient as the event organizer instead of `unknownorganizer@calendar.google.com`.

- You can only update the event [properties](../../../v3/reference/events/update.md#request-body), such as reminders, color ID, visibility, status, and extended properties of `Event` resources with the event type `fromGmail`.

For details, see the Calendar API [`Events` reference documentation](../../../v3/reference/events.md).

<a id="May_17_2024"></a>

## May 17, 2024

Change

The following change takes effect on **June 3, 2024**:

For [batch operations](../../../guides/batch.md) on [`Event`](../../../v3/reference/events.md) resources, a batched item returns an HTTP `409 Conflict` status code if the batch operation can't successfully execute this item due to conflicts with other requested batched items.

**Suggested action:** Exclude all successfully finished and failed batched items and retry remaining items in a different batch operation or by using single event operations.

For more information, see [Handle API errors](../../../guides/errors.md#409_conflict).

<a id="February_07_2024"></a>

## February 07, 2024

Change

The following changes will take effect on **March 11, 2024**:

- The use of [event type](../../../v3/reference/events/watch.md#eventTypes) filters will be considered when reviewing quota increase requests. Before you request a quota increase, make sure you specify the event types you need as a parameter for your application.

- Both [`events.list`](../../../v3/reference/events/list.md) and [`events.watch`](../../../v3/reference/events/watch.md) will use the same default event type filter.

- To help with error handling, improved error messages will be returned when unsupported operations are attempted on special event types, such as working location, out-of-office, and focus time events.

For more information, refer to the following:

- [Manage focus time, out of office, and working location events](../../../guides/calendar-status.md#watch-calendar-status)

- [Manage quotas](../../../guides/quota.md#use_push_notifications)

<a id="February_06_2024"></a>

## February 06, 2024

Announcement

**Generally available**: The `events.watch()` method now supports the `eventTypes` field as a query parameter so that you can subscribe to changes about specific Calendar events, such as working location, out-of-office, or focus time events. For details, see the [reference documentation](../../../v3/reference/events/watch.md).

<a id="December_07_2023"></a>

## December 07, 2023

Fixed

To fix a bug that prevented events of `eventType != 'default'` from importing, we updated the code sample in [Populate a team vacation calendar](https://developers.google.com/apps-script/samples/automations/vacation-calendar), the popular Apps Script + Calendar API solution. Review the code change in [GitHub](https://github.com/googleworkspace/apps-script-samples/pull/434/files).

<a id="August_17_2023"></a>

## August 17, 2023

Feature

**Generally available**: Reading and updating working locations using the Google Calendar API is now generally available. For details, see [Manage working locations for Google Calendar users](../../../guides/calendar-status.md).

<a id="August_22_2022"></a>

## August 22, 2022

Feature

**[Developer Preview](https://developers.google.com/workspace/preview)**: The Google Calendar API now supports reading and updating working locations. For details, see [Manage working locations for Google Calendar users](../../../guides/calendar-status.md).

<a id="March_23_2022"></a>

## March 23, 2022

Feature

The Calendar API now supports custom attachments. See [Calendar add-ons](https://developers.google.com/apps-script/add-ons/calendar) for more information.

<a id="October_20_2021"></a>

## October 20, 2021

Feature

The Calendar API now exposes a new `eventType`. The new type is called `focusTime` and allows users of the API to distinguish the special focus time events. For more information, see the [API reference](../../../v3/reference/events.md).

<a id="May_18_2021"></a>

## May 18, 2021

Feature

Two new quotas now exist for the Calendar API in addition to the general [Calendar usage limits](https://support.google.com/a/answer/2905486):

- Per minute per project.

- Per minute per project per user.

See [Manage quotas](../../../guides/quota.md) for more information.

<a id="February_08_2021"></a>

## February 08, 2021

Change

Starting today, all existing and new out of office events will be updated to set the organizer to `unknownorganizer@calendar.google.com` instead of the Calendar owner. It may take 2-3 weeks for this change to fully roll out.

Feature

You can use the calendarId from the API endpoint `https://www.googleapis.com/calendar/v3/calendars/calendarId` to identify the owner of the out of office event.

<a id="February_01_2021"></a>

## February 01, 2021

Feature

The Calendar API now exposes a new field for events. The new field is called `eventType` and allows users of the API to distinguish special event types, such as `outOfOffice`. For more information, see the [API reference](../../../v3/reference/events.md).

<a id="January_11_2021"></a>

## January 11, 2021

Change

From now, we require `conferenceData` to be consistent with `conferenceData.conferenceSolution.key.type`; meaning only Google Meet calls can have `conferenceData.conferenceSolution.key.type` set to `hangoutsMeet`. All 3P video conference providers are expected to set `conferenceData.conferenceSolution.key.type` to `addOn`.

<a id="September_07_2020"></a>

## September 07, 2020

Change

We stopped auto-populating Meet for API calls (such as `Events.insert`) to prevent Meet conferences being added unintentionally via 3rd parties.

Fixed

Meet video conferences should be added explicitly using the following existing parameters:

- Set `conferenceDataVersion` query parameter to `1`.

- Set `conferenceData.createRequest` event property as follows:

  - `conferenceData.createRequest.conferenceSolutionKey.type` to `hangoutsMeet`.

  - `conferenceData.createRequest.requestId` to unique request id.

<a id="March_16_2020"></a>

## March 16, 2020

Change

Service accounts created on or after March 2, 2020 are only able to invite guests using [domain-wide delegation of authority](https://developers.google.com/calendar/auth#perform-g-suite-domain-wide-delegation-of-authority).

<a id="September_27_2019"></a>

## September 27, 2019

Feature

The Calendar API allows attaching a conference data of type `addOn` to a new or existing event using `Events.insert` or `Events.update` methods.

<a id="November_19_2018"></a>

## November 19, 2018

Change

Starting on January 7, 2019, notifications and reminders using the `sms` method type will be ignored. The API calls setting such notifications and reminders will still succeed and modify all the other fields.

Since Calendar offers in-app notifications, you can still get notified, regardless of your device or connection. For more information see [Google Calendar SMS notifications to be removed](https://gsuiteupdates.googleblog.com/2018/11/google-calendar-sms-notifications-to-be-removed.html).

<a id="October_31_2018"></a>

## October 31, 2018

Feature

The Calendar API now supports four new OAuth scopes. The scopes allow your application to limit access to only the data you really need. See [Authorizing Google Calendar API Requests](https://developers.google.com/calendar/auth) for more details.

<a id="October_02_2018"></a>

## October 02, 2018

Feature

A more flexible approach to sending event change notifications is now available through the [`sendUpdates` parameter](../../../v3/reference/events/insert.md#sendUpdates). The new parameter lets you set event change notifications to do one of the following:

- Notify all the event guests.

- Notify only the guests who are not using Google Calendar.

- Completely suppress the notifications, for example, during a migration.

Now it is possible to always keep in sync guests who use other calendaring systems, without sending too many non-mandatory emails to Google Calendar users.

<a id="March_22_2018"></a>

## March 22, 2018

Deprecated

Support for the [JSON-RPC protocol](http://www.jsonrpc.org/specification) and [Global HTTP batch](https://developers.google.com/api-client-library/javascript/features/batch) endpoints has been deprecated, and will be fully discontinued on March 25, 2019. This change is being made to the Google API infrastructure and as such affects multiple Google APIs, including Calendar v3.

For more information and migration instructions, see the [Discontinuing support for JSON-RPC and Global HTTP Batch Endpoints blog post](https://developers.googleblog.com/2018/03/discontinuing-support-for-json-rpc-and.html).

<a id="July_12_2017"></a>

## July 12, 2017

Feature

Hangouts and Google Meet conferences are now supported in Calendar events via the [`conferenceData` field](../../../v3/reference/events.md#conferenceData). You can:

- Read conference data associated with events.

- Copy conference data from one event to another.

- Request new conference generation for an event.

- Clear conference data associated with events.

To learn more, see [Create Events](https://developers.google.com/calendar/create-events#conferencing).
