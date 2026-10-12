# Recurring events

Source: https://developers.google.com/workspace/calendar/api/guides/recurringevents

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-17.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/guides/recurringevents.html>); no article content intentionally omitted.

---

This document describes how to work with [recurring events](../concepts/events-calendars.md#recurring_events) and their instances.

<a id="creating_recurring_events"></a>

## Create recurring events

Creating recurring events is similar to [creating](../v3/reference/events/insert.md) a regular (single) event with the [`event`](../v3/reference/events.md) resource's [`recurrence`](../v3/reference/events.md#recurrence) field set.

<a id="CreateRecEvent"></a>

<a id="code-sample"></a>

<a id="protocol"></a>

### Protocol

```CSS+Lasso
POST /calendar/v3/calendars/primary/events
...

{
  "summary": "Appointment",
  "location": "Somewhere",
  "start": {
    "dateTime": "2011-06-03T10:00:00.000-07:00",
    "timeZone": "America/Los_Angeles"
  },
  "end": {
    "dateTime": "2011-06-03T10:25:00.000-07:00",
    "timeZone": "America/Los_Angeles"
  },
  "recurrence": [
    "RRULE:FREQ=WEEKLY;UNTIL=20110701T170000Z",
  ],
  "attendees": [
    {
      "email": "attendeeEmail",
      # Other attendee's data...
    },
    # ...
  ],
}
```


<a id="java"></a>

### Java

```Java
Event event = new Event();

event.setSummary("Appointment");
event.setLocation("Somewhere");

ArrayList<EventAttendee> attendees = new ArrayList<EventAttendee>();
attendees.add(new EventAttendee().setEmail("attendeeEmail"));
// ...
event.setAttendees(attendees);

DateTime start = DateTime.parseRfc3339("2011-06-03T10:00:00.000-07:00");
DateTime end = DateTime.parseRfc3339("2011-06-03T10:25:00.000-07:00");
event.setStart(new EventDateTime().setDateTime(start).setTimeZone("America/Los_Angeles"));
event.setEnd(new EventDateTime().setDateTime(end).setTimeZone("America/Los_Angeles"));
event.setRecurrence(Arrays.asList("RRULE:FREQ=WEEKLY;UNTIL=20110701T170000Z"));

Event recurringEvent = service.events().insert("primary", event).execute();

System.out.println(createdEvent.getId());
```


<a id=".net"></a>

### .NET

```cplint
Event event = new Event()
    {
      Summary = "Appointment",
      Location = "Somewhere",
      Start = new EventDateTime() {
          DateTime = new DateTime("2011-06-03T10:00:00.000:-07:00")
          TimeZone = "America/Los_Angeles"
      },
      End = new EventDateTime() {
          DateTime = new DateTime("2011-06-03T10:25:00.000:-07:00")
          TimeZone = "America/Los_Angeles"
      },
      Recurrence = new String[] {
          "RRULE:FREQ=WEEKLY;UNTIL=20110701T170000Z"
      },
      Attendees = new List<EventAttendee>()
          {
            new EventAttendee() { Email: "attendeeEmail" },
            // ...
          }
    };

Event recurringEvent = service.Events.Insert(event, "primary").Fetch();

Console.WriteLine(recurringEvent.Id);
```


<a id="python"></a>

### Python

```Python
event = {
  'summary': 'Appointment',
  'location': 'Somewhere',
  'start': {
    'dateTime': '2011-06-03T10:00:00.000-07:00',
    'timeZone': 'America/Los_Angeles'
  },
  'end': {
    'dateTime': '2011-06-03T10:25:00.000-07:00',
    'timeZone': 'America/Los_Angeles'
  },
  'recurrence': [
    'RRULE:FREQ=WEEKLY;UNTIL=20110701T170000Z',
  ],
  'attendees': [
    {
      'email': 'attendeeEmail',
      # Other attendee's data...
    },
    # ...
  ],
}

recurring_event = service.events().insert(calendarId='primary', body=event).execute()

print recurring_event['id']
```


<a id="php"></a>

### PHP

```PHP
$event = new Google_Service_Calendar_Event();
$event->setSummary('Appointment');
$event->setLocation('Somewhere');
$start = new Google_Service_Calendar_EventDateTime();
$start->setDateTime('2011-06-03T10:00:00.000-07:00');
$start->setTimeZone('America/Los_Angeles');
$event->setStart($start);
$end = new Google_Service_Calendar_EventDateTime();
$end->setDateTime('2011-06-03T10:25:00.000-07:00');
$end->setTimeZone('America/Los_Angeles');
$event->setEnd($end);
$event->setRecurrence(array('RRULE:FREQ=WEEKLY;UNTIL=20110701T170000Z'));
$attendee1 = new Google_Service_Calendar_EventAttendee();
$attendee1->setEmail('attendeeEmail');
// ...
$attendees = array($attendee1,
                   // ...
                   );
$event->attendees = $attendees;
$recurringEvent = $service->events->insert('primary', $event);

echo $recurringEvent->getId();
```


<a id="ruby"></a>

### Ruby

```Ruby
event = Google::Apis::CalendarV3::Event.new(
  summary: 'Appointment',
  location: 'Somewhere',
  start: {
    date_time: '2011-06-03T10:00:00.000-07:00',
    time_zone:  'America/Los_Angeles'
  },
  end: {
    date_time: '2011-06-03T10:25:00.000-07:00',
    time_zone: 'America/Los_Angeles'
  },
  recurrence: ['RRULE:FREQ=WEEKLY;UNTIL=20110701T170000Z']
  attendees: [
    {
      email: 'attendeeEmail'
    },
    #...
  ]
)
response = client.insert_event('primary', event)
print response.id
```


<a id="accessing_instances"></a>

## Access instances

To see all the [instances](../concepts/events-calendars.md#instances_and_exceptions) of a given recurring event you can use the [events.instances()](../v3/reference/events/instances.md) request.

The [`events.list()`](../v3/reference/events/list.md) request by default only returns single events, recurring events, and [exceptions](../concepts/events-calendars.md#instances_and_exceptions); instances that are not exceptions are not returned. If the [`singleEvents`](../v3/reference/events/list.md#singleEvents) parameter is set `true` then all individual instances appear in the result, but underlying recurring events don't. When a user who has free/busy permissions queries `events.list()`, it behaves as if `singleEvent` is `true`. For more information about access control list rules, see [Acl](../v3/reference/acl.md).

**Warning:** Do not modify instances individually when you want to modify the entire recurring event, or "this and following" instances. This creates lots of exceptions that clutter the calendar, slowing down access and sending a high number of change notifications to users.

Individual instances are similar to single events. Unlike their parent recurring events, instances do not have the [`recurrence`](../v3/reference/events.md#recurrence) field set.

The following event fields are specific to instances:

- [`recurringEventId`](../v3/reference/events.md#recurringEventId) — the ID of the parent recurring event this instance belongs to

- [`originalStartTime`](../v3/reference/events.md#originalStartTime) — the time this instance starts according to the recurrence data in the parent recurring event. This can be different from the actual [`start`](../v3/reference/events.md#start) time if the instance was rescheduled. It uniquely identifies the instance within the recurring event series even if the instance was moved.

<a id="modifying_or_deleting_instances"></a>

## Modify or delete instances

To modify a single instance (creating an exception), client applications must first retrieve the instance and then update it by sending an authorized PUT request to the instance edit URL with updated data in the body. The URL is of the form:

```
https://www.googleapis.com/calendar/v3/calendars/calendarId/events/instanceId
```


Use appropriate values in place of calendarId and instanceId.

**Note:** The special calendarId value `primary` can be used to refer to the authenticated user's primary calendar.

Upon success, the server responds with an HTTP 200 OK status code with the updated instance. The following example shows how to cancel an instance of a recurring event.

<a id="CreateRecEventExceptions"></a>

<a id="protocol_1"></a>

### Protocol

```scdoc
PUT /calendar/v3/calendars/primary/events/instanceId
...

{
  "kind": "calendar#event",
  "id": "instanceId",
  "etag": "instanceEtag",
  "status": "cancelled",
  "htmlLink": "https://www.google.com/calendar/event?eid=instanceEid",
  "created": "2011-05-23T22:27:01.000Z",
  "updated": "2011-05-23T22:27:01.000Z",
  "summary": "Recurring event",
  "location": "Somewhere",
  "creator": {
    "email": "userEmail"
  },
  "recurringEventId": "recurringEventId",
  "originalStartTime": "2011-06-03T10:00:00.000-07:00",
  "organizer": {
    "email": "userEmail",
    "displayName": "userDisplayName"
  },
  "start": {
    "dateTime": "2011-06-03T10:00:00.000-07:00",
    "timeZone": "America/Los_Angeles"
  },
  "end": {
    "dateTime": "2011-06-03T10:25:00.000-07:00",
    "timeZone": "America/Los_Angeles"
  },
  "iCalUID": "eventUID",
  "sequence": 0,
  "attendees": [
    {
      "email": "attendeeEmail",
      "displayName": "attendeeDisplayName",
      "responseStatus": "needsAction"
    },
    # ...
    {
      "email": "userEmail",
      "displayName": "userDisplayName",
      "responseStatus": "accepted",
      "organizer": true,
      "self": true
    }
  ],
  "guestsCanInviteOthers": false,
  "guestsCanSeeOtherGuests": false,
  "reminders": {
    "useDefault": true
  }
}
```


<a id="java_1"></a>

### Java

```Java
// First retrieve the instances from the API.
Events instances = service.events().instances("primary", "recurringEventId").execute();

// Select the instance to cancel.
Event instance = instances.getItems().get(0);
instance.setStatus("cancelled");

Event updatedInstance = service.events().update("primary", instance.getId(), instance).execute();

// Print the updated date.
System.out.println(updatedInstance.getUpdated());
```


<a id=".net_1"></a>

### .NET

```Scilab
// First retrieve the instances from the API.
Events instances = service.Events.Instances("primary", "recurringEventId").Fetch();

// Select the instance to cancel.
Event instance = instances.Items[0];
instance.Status = "cancelled";

Event updatedInstance = service.Events.Update(instance, "primary", instance.Id).Fetch();

// Print the updated date.
Console.WriteLine(updatedInstance.Updated);
```


<a id="python_1"></a>

### Python

```Python
# First retrieve the instances from the API.
instances = service.events().instances(calendarId='primary', eventId='recurringEventId').execute()

# Select the instance to cancel.
instance = instances['items'][0]
instance['status'] = 'cancelled'

updated_instance = service.events().update(calendarId='primary', eventId=instance['id'], body=instance).execute()

# Print the updated date.
print updated_instance['updated']
```


<a id="php_1"></a>

### PHP

```PHP
$events = $service->events->instances("primary", "eventId");

// Select the instance to cancel.
$instance = $events->getItems()[0];
$instance->setStatus('cancelled');

$updatedInstance = $service->events->update('primary', $instance->getId(), $instance);

// Print the updated date.
echo $updatedInstance->getUpdated();
```


<a id="ruby_1"></a>

### Ruby

```Ruby
# First retrieve the instances from the API.
instances = client.list_event_instances('primary', 'recurringEventId')

# Select the instance to cancel.
instance = instances.items[0]
instance.status = 'cancelled'

response = client.update_event('primary', instance.id, instance)
print response.updated
```
