# Calendar API Resource Types

Source: https://developers.google.com/workspace/calendar/api/resource_types

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../pages/resource_types.html>); no article content intentionally omitted.

---

<a id="background"></a>

## Calendar API background

<a id="background_concepts"></a>

### Calendar concepts

Google Calendar is built on several basic concepts:

Event

A single event on a calendar containing information such as the title of event, start and end times, and attendees.

Calendar

A single calendar entry containing metadata for the calendar such as a description.

Calendar List

A list of all calendars on a user's calendar list in the Calendar UI.

Setting

A user preference from the Calendar UI, such as the user's time zone.

ACL

A single access control rule containing information such as the type and scope of the rule.

<a id="background_resources"></a>

### Calendar API data model

A resource is an individual data entity with a unique identifier. The Calendar API operates on five types of resources:

Event Resource

Represents a single event on a calendar.

Calendars Resource

Represents metadata for an individual calendar.

CalendarList Resource

Represents metadata for an individual calendar that appears on the user's calendar list in the UI.

Settings Resource

Represents a single user preference from the Calendar UI.

ACL Resource

Represents an ACL.

The Calendar API data model is based on groups of resources, called collections:

Events Collection

Consists of all the Event Resources within a specific Calendar Resource.

CalendarList Collection

Consists of all the CalendarList Resources for a specific user.

Settings Collection

Consists of all the Settings Resources for a specific user.

ACL Collection

Consists of all the ACL Resources applied to a specific calendar.
