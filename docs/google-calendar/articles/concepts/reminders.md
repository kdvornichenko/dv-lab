# Reminders and notifications

Source: https://developers.google.com/workspace/calendar/api/concepts/reminders

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/concepts/reminders.html>); no article content intentionally omitted.

---

The Google Calendar API provides support for reminders and notifications.

- *Reminders* are alarms triggered at a specified time before an event starts.

- *Notifications* allow users to find out about changes to events in their calendar.

Don't confuse notifications with [push notifications](../guides/push.md), which notify another server of changes to a calendar rather than being delivered to a user.

For more details about notifications in Google Calendar, see [Modify Google Calendar notifications](https://support.google.com/calendar/answer/37242).

<a id="reminders"></a>

## Reminders

A reminder consists of:

- When to show the reminder, expressed as minutes before the event start time.

- The delivery method to use (see [Delivery mechanisms](reminders.md#delivery-mechanisms)).

Reminders can be specified for whole calendars and for individual events. Users can set *default reminders* for each of their calendars; these defaults apply to all events within that calendar. However, users can also override these defaults for individual events, replacing them with a different set of reminders.

<a id="default-reminders"></a>

### Default reminders

Reminders are private information, specific to an authenticated user; they're *not* shared across multiple users. As a result:

- Default reminders are manipulated through the `CalendarList` collection, which contains user-specific calendar metadata.

- They're *not* accessible through the `Calendars` collection, which contains global metadata shared across all users.

Default reminders are also returned when doing an Events list query.

<a id="overriding-default-reminders"></a>

### Overriding default reminders

To override default reminders when you create or update an event, set [reminders.useDefault](../v3/reference/events.md#reminders.useDefault) to `false` and populate [reminders.overrides](../v3/reference/events.md#reminders.overrides) with the new reminder set. Overrides can be set only when `useDefault` is `false`, as shown in the following example:

```JSON
"reminders": {
  "useDefault": false,
  "overrides": [
    {
      "method": "reminderMethod",
      "minutes": "reminderMinutes"
    }
  ]
}
```


To revert to the default set of reminders, perform an update setting [`reminders.useDefault`](../v3/reference/events.md#reminders.useDefault) back to `true`.

<a id="notifications"></a>

## Notifications

Calendar supports the following notification types:

- *Event creation*: A new event is added to one of the user's calendars.

- *Event change*: The organizer modified an event that the user was invited to.

- *Event cancellation*: An event that the user was invited to is canceled.

- *Attendee response*: An attendee changed their response status for an event created by the user.

- *Agenda*: A list of all the events on the user's calendar, sent at the start of the day.

The user can decide which notifications to enable per calendar and the delivery method for each notification type. These settings are not shared with other users. Similar to default reminders, they're accessible through the `CalendarList` collection.

To send email notifications to attendees for events that were inserted or updated with the API, call the [`insert`](../v3/reference/events/insert.md) or [`update`](../v3/reference/events/update.md) method and set the `sendUpdates` parameter to `"all"` or `"externalOnly"`.

**Note:** For attendees with non-Google email addresses, these notification emails are the only way they can find out about the event; the event is not added to their calendars automatically.

<a id="delivery-mechanisms"></a>

## Delivery mechanisms

The delivery methods offered by Google Calendar are:

- *Pop-up*. These are supported on mobile platforms and on web clients.

- *Email* sent by the server.

The following table shows the supported methods for each reminder or notification type:

|  |  | Pop-up | Email |
| --- | --- | --- | --- |
| **Reminders** | Default reminders | ✓ | ✓ |
| Override reminders | ✓ | ✓ |  |
| **Notifications** | Event creation | ❌ | ✓ |
| Event change | ❌ | ✓ |  |
| Event cancellation | ❌ | ✓ |  |
| Attendee response | ❌ | ✓ |  |
| Agenda | ❌ | ✓ |  |
