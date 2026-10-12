# Labels

Source: https://developers.google.com/workspace/calendar/api/guides/labels

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-11.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/guides/labels.html>); no article content intentionally omitted.

---

This page explains what labels are, how they're managed on calendars, and how you can assign them to events using the Google Calendar API.

Google Calendar lets you customize the appearance of your events by assigning them custom colors and names. Previously, events were limited to a fixed set of index-based colors (`colorId`). With labels, you can define a flexible, custom palette per calendar and apply these labels directly to events.

This feature supersedes the legacy index-based `colorId` field. To use labels, you must specify the `eventLabelVersion=1` parameter in your API requests. When this parameter is set, the legacy `colorId` field is ignored.

<a id="manage_labels_on_a_calendar"></a>

## Manage labels on a calendar

You can define up to 200 custom labels per calendar using the [`labelProperties`](../v3/reference/calendars.md#labelProperties) property on the [Calendars](../v3/reference/calendars.md) resource.

To manage labels, use the [`Calendars.insert`](../v3/reference/calendars/insert.md) or [`Calendars.update`](../v3/reference/calendars/update.md) methods. Each label requires an `id`, a `backgroundColor` in hexadecimal format, and an optional `name`.

**Note:** You must have `owner` access to a calendar to define or modify its labels.

<a id="calendar_resource_representation"></a>

### Calendar resource representation

```JSON
{
  "kind": "calendar#calendar",
  "id": "primary",
  "summary": "My Team Calendar",
  "labelProperties": {
    "eventLabels": [
      {
        "id": "42617328-8756-4291-8273-192837465647",
        "backgroundColor": "#039be5",
        "name": "Important Project"
      },
      {
        "id": "19283746-9182-4736-8271-918273645261",
        "backgroundColor": "#33b679",
        "name": "Team Meeting"
      }
    ]
  }
}
```


<a id="example_add_and_remove_labels_on_a_calendar"></a>

### Example: Add and remove labels on a calendar

To add or remove labels, you should first read the calendar to get the current list of labels, modify the list in your code, and then update the calendar with the updated list to avoid overwriting other labels.

The following samples show how to retrieve a calendar, remove a label with ID `11111111-2222-3333-4444-555555555555`, add two new labels (`22222222-3333-4444-5555-666666666666` and `33333333-4444-5555-6666-777777777777`), and update the calendar:

<a id="go"></a>

### Go

```Go
// Refer to the Go quickstart on how to setup the service:
// https://developers.google.com/workspace/calendar/quickstart/go

// 1. Read the calendar to get existing labels
calendar, err := srv.Calendars.Get("primary").Do()
if err != nil {
    log.Fatalf("Unable to retrieve calendar: %v", err)
}

if calendar.LabelProperties == nil {
    calendar.LabelProperties = &calendar.LabelProperties{}
}
labels := calendar.LabelProperties.EventLabels

// 2. Remove a label with a specific ID (UUID format)
targetIdToRemove := "11111111-2222-3333-4444-555555555555"
var updatedLabels []*calendar.EventLabel
for _, label := range labels {
    if label.Id != targetIdToRemove {
        updatedLabels = append(updatedLabels, label)
    }
}
labels = updatedLabels

// 3. Add 2 new labels with UUID IDs
labels = append(labels, &calendar.EventLabel{
    Id:              "22222222-3333-4444-5555-666666666666",
    BackgroundColor: "#8e24aa",
    Name:            "Design Work",
})
labels = append(labels, &calendar.EventLabel{
    Id:              "33333333-4444-5555-6666-777777777777",
    BackgroundColor: "#f4511e",
    Name:            "Urgent Review",
})

// 4. Update the calendar with the new list
calendar.LabelProperties.EventLabels = labels
updatedCalendar, err := srv.Calendars.Update("primary", calendar).Do()
if err != nil {
    log.Fatalf("Unable to update calendar: %v", err)
}
fmt.Printf("Calendar updated: %s\n", updatedCalendar.Summary)

```


<a id="java"></a>

### Java

```Java
// Refer to the Java quickstart on how to setup the service:
// https://developers.google.com/workspace/calendar/quickstart/java

// 1. Read the calendar to get existing labels
Calendar calendar = service.calendars().get("primary").execute();

LabelProperties labelProperties = calendar.getLabelProperties();
if (labelProperties == null) {
  labelProperties = new LabelProperties();
}
List<EventLabel> labels = labelProperties.getEventLabels();
if (labels == null) {
  labels = new ArrayList<>();
} else {
  // Create a mutable copy since the returned list might be immutable
  labels = new ArrayList<>(labels);
}

// 2. Remove a label with a specific ID (UUID format)
String targetIdToRemove = "11111111-2222-3333-4444-555555555555";
labels.removeIf(label -> targetIdToRemove.equals(label.getId()));

// 3. Add 2 new labels with UUID IDs
labels.add(new EventLabel()
    .setId("22222222-3333-4444-5555-666666666666")
    .setBackgroundColor("#8e24aa")
    .setName("Design Work"));

labels.add(new EventLabel()
    .setId("33333333-4444-5555-6666-777777777777")
    .setBackgroundColor("#f4511e")
    .setName("Urgent Review"));

// 4. Update the calendar with the new list
labelProperties.setEventLabels(labels);
calendar.setLabelProperties(labelProperties);

Calendar updatedCalendar = service.calendars().update("primary", calendar)
    .execute();

System.out.printf("Calendar updated: %s\n", updatedCalendar.getSummary());

```


<a id="javascript"></a>

### JavaScript

```JavaScript
// Refer to the Node.js quickstart on how to setup the service:
// https://developers.google.com/workspace/calendar/quickstart/nodejs

// 1. Retrieve the calendar resource
calendar.calendars.get({
  calendarId: 'primary'
}, (err, res) => {
  if (err) return console.log('The API returned an error: ' + err);

  // Extract existing labels from the calendar resource
  const cal = res.data;
  if (!cal.labelProperties) {
    cal.labelProperties = {};
  }
  if (!cal.labelProperties.eventLabels) {
    cal.labelProperties.eventLabels = [];
  }

  // 2. Remove a label with a specific ID (UUID format)
  const targetIdToRemove = '11111111-2222-3333-4444-555555555555';
  cal.labelProperties.eventLabels = cal.labelProperties.eventLabels.filter(
    label => label.id !== targetIdToRemove
  );

  // 3. Add 2 new labels with UUID IDs
  cal.labelProperties.eventLabels.push({
    id: '22222222-3333-4444-5555-666666666666',
    backgroundColor: '#8e24aa',
    name: 'Design Work'
  });
  cal.labelProperties.eventLabels.push({
    id: '33333333-4444-5555-6666-777777777777',
    backgroundColor: '#f4511e',
    name: 'Urgent Review'
  });

  // 4. Update the calendar with the new list
  calendar.calendars.update({
    calendarId: 'primary',
    resource: cal
  }, (updateErr, updateRes) => {
    if (updateErr) return console.log('Update failed: ' + updateErr);
    console.log(`Calendar updated: ${updateRes.data.summary}`);
  });
});

```


<a id="python"></a>

### Python

```Python
# Refer to the Python quickstart on how to setup the service:
# https://developers.google.com/workspace/calendar/quickstart/python

# 1. Read the calendar to get existing labels
calendar = service.calendars().get(calendarId='primary').execute()

label_properties = calendar.setdefault('labelProperties', {})
labels = label_properties.setdefault('eventLabels', [])

# 2. Remove a label with a specific ID (UUID format)
target_id_to_remove = "11111111-2222-3333-4444-555555555555"
labels = [l for l in labels if l.get('id') != target_id_to_remove]

# 3. Add 2 new labels with UUID IDs
labels.append({
    'id': '22222222-3333-4444-5555-666666666666',
    'backgroundColor': '#8e24aa',
    'name': 'Design Work'
})
labels.append({
    'id': '33333333-4444-5555-6666-777777777777',
    'backgroundColor': '#f4511e',
    'name': 'Urgent Review'
})

# 4. Update the calendar with the new list
label_properties['eventLabels'] = labels
calendar['labelProperties'] = label_properties

updated_calendar = service.calendars().update(
    calendarId='primary',
    body=calendar
).execute()

print(f"Calendar updated: {updated_calendar.get('summary')}")

```


<a id="http"></a>

### HTTP

The following raw HTTP example shows the final `PUT` request to update the calendar with the new list of labels. Ensure you have merged these with any existing labels first.

```Bash Session
PUT https://www.googleapis.com/calendar/v3/calendars/primary
Authorization: Bearer [YOUR_ACCESS_TOKEN]
Content-Type: application/json

{
  "summary": "Updated Team Calendar",
  "labelProperties": {
    "eventLabels": [
      {
        "id": "22222222-3333-4444-5555-666666666666",
        "backgroundColor": "#8e24aa",
        "name": "Design Work"
      },
      {
        "id": "33333333-4444-5555-6666-777777777777",
        "backgroundColor": "#f4511e",
        "name": "Urgent Review"
      }
    ]
  }
}
```


<a id="assign_labels_to_events"></a>

## Assign labels to events

Once labels are defined on the calendar, you can assign them to individual events by setting the [`eventLabelId`](../v3/reference/events.md#eventLabelId) property on the [Events](../v3/reference/events.md) resource.

You can set or change this property when calling the [`insert`](../v3/reference/events/insert.md), [`update`](../v3/reference/events/update.md), or [`patch`](../v3/reference/events/patch.md) methods.

**Note:** You must have at least `writerWithoutPrivateAccess` access (or higher: `writer` or `owner`) to a calendar to assign labels to its events.

**Remember:** You must append `?eventLabelVersion=1` to your request URL to process this field.

<a id="event_resource_representation"></a>

### Event resource representation

```JSON
{
  "kind": "calendar#event",
  "id": "sample-event-id",
  "summary": "Review Design Specs",
  "start": {
    "dateTime": "2026-07-01T10:00:00Z"
  },
  "end": {
    "dateTime": "2026-07-01T11:00:00Z"
  },
  "eventLabelId": "22222222-3333-4444-5555-666666666666"
}
```


<a id="example_create_an_event_with_a_label"></a>

### Example: Create an event with a label

The following samples show how to create an event with a custom label:

<a id="go_1"></a>

### Go

```Go
// Refer to the Go quickstart on how to setup the service:
// https://developers.google.com/workspace/calendar/quickstart/go

event := &calendar.Event{
    Summary: "Design Sync",
    Start: &calendar.EventDateTime{
        DateTime: "2026-07-02T14:00:00Z",
    },
    End: &calendar.EventDateTime{
        DateTime: "2026-07-02T15:00:00Z",
    },
    EventLabelId: "22222222-3333-4444-5555-666666666666",
}

createdEvent, err := srv.Events.Insert("primary", event).EventLabelVersion(1).Do()
if err != nil {
    log.Fatalf("Unable to create event: %v", err)
}
fmt.Printf("Event created: %s\n", createdEvent.HtmlLink)

```


<a id="java_1"></a>

### Java

```Java
// Refer to the Java quickstart on how to setup the service:
// https://developers.google.com/workspace/calendar/quickstart/java

Event event = new Event()
    .setSummary("Design Sync")
    .setStart(new EventDateTime().setDateTime(new DateTime("2026-07-02T14:00:00Z")))
    .setEnd(new EventDateTime().setDateTime(new DateTime("2026-07-02T15:00:00Z")))
    .setEventLabelId("22222222-3333-4444-5555-666666666666");

Event createdEvent = service.events().insert("primary", event)
    .setEventLabelVersion(1L)
    .execute();

System.out.printf("Event created: %s\n", createdEvent.getHtmlLink());

```


<a id="javascript_1"></a>

### JavaScript

```JavaScript
// Refer to the Node.js quickstart on how to setup the service:
// https://developers.google.com/workspace/calendar/quickstart/nodejs

const event = {
  summary: 'Design Sync',
  start: {
    dateTime: '2026-07-02T14:00:00Z',
  },
  end: {
    dateTime: '2026-07-02T15:00:00Z',
  },
  eventLabelId: '22222222-3333-4444-5555-666666666666',
};

calendar.events.insert({
  calendarId: 'primary',
  resource: event,
  eventLabelVersion: 1,
}, (err, res) => {
  if (err) return console.log('The API returned an error: ' + err);
  console.log(`Event created: ${res.data.htmlLink}`);
});

```


<a id="python_1"></a>

### Python

```Python
# Refer to the Python quickstart on how to setup the service:
# https://developers.google.com/workspace/calendar/quickstart/python

event = {
    'summary': 'Design Sync',
    'start': {
        'dateTime': '2026-07-02T14:00:00Z',
    },
    'end': {
        'dateTime': '2026-07-02T15:00:00Z',
    },
    'eventLabelId': '22222222-3333-4444-5555-666666666666'
}

event = service.events().insert(
    calendarId='primary',
    body=event,
    eventLabelVersion=1
).execute()

print(f"Event created: {event.get('htmlLink')}")

```


<a id="http_1"></a>

### HTTP

```Bash Session
POST https://www.googleapis.com/calendar/v3/calendars/primary/events?eventLabelVersion=1
Authorization: Bearer [YOUR_ACCESS_TOKEN]
Content-Type: application/json

{
  "summary": "Design Sync",
  "start": {
    "dateTime": "2026-07-02T14:00:00Z"
  },
  "end": {
    "dateTime": "2026-07-02T15:00:00Z"
  },
  "eventLabelId": "22222222-3333-4444-5555-666666666666"
}
```


To remove an existing label from an event, set `eventLabelId` to an empty string (`""`) or omit the field entirely in an `update` request.
