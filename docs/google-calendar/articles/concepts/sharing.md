# Calendar sharing

Source: https://developers.google.com/workspace/calendar/api/concepts/sharing

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/concepts/sharing.html>); no article content intentionally omitted.

---

There are two different ways to share calendar and event data with others.

First, you can *share* an entire calendar with a specified level of access. For example, you can create a team calendar and perform actions such as:

- Grant all members of your team the right to add and modify events in the calendar.

- Grant your manager the right to see the events on your calendar.

- Grant customers the right to see only when you are free or busy, without revealing event details.

You can also adjust the access to individual events on the shared calendar.

Alternatively, you can invite others to individual events on your calendar. Inviting someone to an event puts a copy of that event on their calendar. The copy on the attendee's calendar is visible to others according to the attendee's sharing configuration. The invitee can then accept or reject the invitation, and to some extent also modify their copy of the event—for example, by adding a reminder on their calendar or assigning a label. For details, see [Invite users to an event](inviting-attendees-to-events.md).

<a id="share-calendars"></a>

## Share calendars

The owners of a calendar can share the calendar by giving access to other users. The sharing settings of a given calendar are represented by the [ACL collection](../v3/reference/acl.md) (access control list) of that calendar. Each resource in the ACL collection grants a specified *grantee* a certain access *role*, which is one of those listed in the following table:

| Role | Access privilege granted by the role |
| --- | --- |
| `none` | Provides no access. |
| `freeBusyReader` | Lets the grantee see whether the calendar is free or busy at a given time, but does not allow access to event details. Free/busy information can be retrieved using the [freeBusy.query](../v3/reference/freebusy/query.md) operation. |
| `reader` | Lets the grantee read events on the calendar. |
| `writerWithoutPrivateAccess` | Lets the grantee read and write events on the calendar that aren't private, and see private events as busy blocks. This role can also see labels. |
| `writer` | Lets the grantee read and write events on the calendar. This role can also see ACLs and labels. |
| `owner` | Provides manager access to the calendar. This role has all of the permissions of the writer role with the additional ability to modify access levels of other users and to modify labels. <br><br><br><br>**Important:** The `owner` role is different from the calendar's data owner. A calendar has a single data owner, but can have multiple users with `owner` role. |

The possible grantees are:

- Another individual user.

- A user group.

- A domain.

- The public (grants access to everyone).

By default, each user has owner access to their primary calendar, and this access cannot be relinquished. Up to 6,000 ACLs can be added per calendar.

For Google Workspace users, there are also domain settings that might restrict the maximum allowed access. For example, suppose your domain has a setting that only allows free-busy calendar sharing. In this case, even if you grant writer access to the public, users outside the domain will only see the free-busy details.

**Note:** Sharing a calendar with a user no longer automatically inserts the calendar into their `CalendarList`. If you want the user to see and interact with the shared calendar, call the [`CalendarList: insert()`](../v3/reference/calendarList/insert.md) method.

<a id="event-visibility"></a>

## Event visibility

Once the calendar is shared, you can adjust the access to individual events on a calendar by changing the [visibility property](../v3/reference/events.md#visibility) of the event. This property has no meaning for non-shared calendars. The following table lists the possible values of the visibility property:

| Visibility | Meaning |
| --- | --- |
| `default` | The visibility of the event is determined by the ACLs of the calendar. Different attendees of the same event can have different ACLs and sharing. If a user with a `private` calendar sends an invite to an event using `default` visibility to another user with a publicly visible calendar, the event is fully visible on that attendee's calendar. |
| `public` | The details of this event are visible to everyone with at least `freeBusyReader` access to the calendar. |
| `private` | The details of this event are only visible to users with at least `writer` access to the calendar. |

<a id="visibility-and-recurring-events"></a>

### Visibility and recurring events

Changing the visibility of a single instance may affect all instances of the series:

- **More restrictive changes propagate:** If you change the visibility of one instance of a recurring event to a more restrictive setting (for example, from `public` to `private`), the change is propagated to **all instances** of the recurring event.

- **Less restrictive changes are ignored:** If you attempt to change the visibility of one instance of a recurring event to a less restrictive setting (for example, from `private` to `public`), the change is **ignored** and the visibility remains unchanged. To make a recurring event less restrictive, you must update the parent recurring event.
