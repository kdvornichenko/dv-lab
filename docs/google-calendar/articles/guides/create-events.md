# Create events

Source: https://developers.google.com/workspace/calendar/api/guides/create-events

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-11.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/guides/create-events.html>); no article content intentionally omitted.

---

Imagine an app that helps users find the best hiking routes. By adding the hiking plan as a calendar event, the users get a lot of help in staying organized automatically. Google Calendar helps them to share the plan and reminds them about it so they can get prepared with no stress. Also, thanks to seamless integration of Google products, Google Now pings them about the time to leave and Google Maps direct them to the meeting spot on time.

This article explains how to create calendar events and add them to your users' calendars.

<a id="add_an_event"></a>

## Add an event

To create an event, call the [`events.insert()`](../v3/reference/events/insert.md) method providing at least these parameters:

- `calendarId` is the calendar identifier and can either be the email address of the calendar on which to create the event or a special keyword `'primary'` which will use the primary calendar of the logged in user. If you don't know the email address of the calendar you would like to use, you can check it either in the calendar's settings of the Google Calendar web UI (in the section "Calendar Address") or you can look for it in the result of the [`calendarList.list()`](../v3/reference/calendarList/list.md) call.

- `event` is the event to create with all the necessary details such as start and end. The only two required fields are the `start` and `end` times. See the [`event` reference](../v3/reference/events.md) for the full set of event fields.

  Specify timed events using the `start.dateTime` and `end.dateTime` fields. For all-day events, use `start.date` and `end.date` instead.

In order to successfully create events, you need to:

- Set your OAuth scope to `https://www.googleapis.com/auth/calendar` so that you have edit access to the user's calendar.

- Ensure the authenticated user has write access to the calendar with the `calendarId` you provided (for example by calling [`calendarList.get()`](../v3/reference/calendarList/get.md) for the `calendarId` and checking the `accessRole`).

<a id="metadata"></a>

### Add event metadata

You can optionally add event metadata when you create a calendar event. If you choose not to add metadata during creation, you can update many fields using the [`events.update()`](../v3/reference/events/update.md); however, some fields, such as the event ID, can only be set during an [`events.insert()`](../v3/reference/events/insert.md) operation.

Location

Adding an address into the location field enables features such as "time to leave" or displaying a map with the directions.

Event ID

When creating an event, you can choose to generate your own event ID that conforms to our format requirements. This enables you to keep entities in your local database in sync with events in Google Calendar. It also prevents duplicate event creation if the operation fails at some point after it is successfully executed in the Calendar backend. If no event ID is provided, the server generates one for you. See the [event ID reference](../v3/reference/events.md#id) for more information.

Attendees

The event you create appears on all the primary Google Calendars of the attendees you included with the same event ID. If you set `sendUpdates` to `"all"` or `"externalOnly"` in your insert request, the corresponding attendees receive an email notification for your event. To learn more, see [events with multiple attendees](https://developers.google.com/workspace/calendar/concepts#events_with_attendees).

The following examples demonstrate creating an event and setting its metadata:

<a id="go"></a>

### Go

```Go
// Refer to the Go quickstart on how to setup the environment:
// https://developers.google.com/workspace/calendar/quickstart/go
// Change the scope to calendar.CalendarScope and delete any stored credentials.

event := &calendar.Event{
  Summary: "Google I/O 2015",
  Location: "800 Howard St., San Francisco, CA 94103",
  Description: "A chance to hear more about Google's developer products.",
  Start: &calendar.EventDateTime{
    DateTime: "2015-05-28T09:00:00-07:00",
    TimeZone: "America/Los_Angeles",
  },
  End: &calendar.EventDateTime{
    DateTime: "2015-05-28T17:00:00-07:00",
    TimeZone: "America/Los_Angeles",
  },
  Recurrence: []string{"RRULE:FREQ=DAILY;COUNT=2"},
  Attendees: []*calendar.EventAttendee{
    &calendar.EventAttendee{Email:"lpage@example.com"},
    &calendar.EventAttendee{Email:"sbrin@example.com"},
  },
}

calendarId := "primary"
event, err = srv.Events.Insert(calendarId, event).Do()
if err != nil {
  log.Fatalf("Unable to create event. %v\n", err)
}
fmt.Printf("Event created: %s\n", event.HtmlLink)

```


<a id="java"></a>

### Java

```Java
// Refer to the Java quickstart on how to setup the environment:
// https://developers.google.com/workspace/calendar/quickstart/java
// Change the scope to CalendarScopes.CALENDAR and delete any stored
// credentials.

Event event = new Event()
    .setSummary("Google I/O 2015")
    .setLocation("800 Howard St., San Francisco, CA 94103")
    .setDescription("A chance to hear more about Google's developer products.");

DateTime startDateTime = new DateTime("2015-05-28T09:00:00-07:00");
EventDateTime start = new EventDateTime()
    .setDateTime(startDateTime)
    .setTimeZone("America/Los_Angeles");
event.setStart(start);

DateTime endDateTime = new DateTime("2015-05-28T17:00:00-07:00");
EventDateTime end = new EventDateTime()
    .setDateTime(endDateTime)
    .setTimeZone("America/Los_Angeles");
event.setEnd(end);

String[] recurrence = new String[] {"RRULE:FREQ=DAILY;COUNT=2"};
event.setRecurrence(Arrays.asList(recurrence));

EventAttendee[] attendees = new EventAttendee[] {
    new EventAttendee().setEmail("lpage@example.com"),
    new EventAttendee().setEmail("sbrin@example.com"),
};
event.setAttendees(Arrays.asList(attendees));

EventReminder[] reminderOverrides = new EventReminder[] {
    new EventReminder().setMethod("email").setMinutes(24 * 60),
    new EventReminder().setMethod("popup").setMinutes(10),
};
Event.Reminders reminders = new Event.Reminders()
    .setUseDefault(false)
    .setOverrides(Arrays.asList(reminderOverrides));
event.setReminders(reminders);

String calendarId = "primary";
event = service.events().insert(calendarId, event).execute();
System.out.printf("Event created: %s\n", event.getHtmlLink());

```


<a id="javascript"></a>

### JavaScript

```JavaScript
// Refer to the JavaScript quickstart on how to setup the environment:
// https://developers.google.com/workspace/calendar/quickstart/js
// Change the scope to 'https://www.googleapis.com/auth/calendar' and delete any
// stored credentials.

const event = {
  'summary': 'Google I/O 2015',
  'location': '800 Howard St., San Francisco, CA 94103',
  'description': 'A chance to hear more about Google\'s developer products.',
  'start': {
    'dateTime': '2015-05-28T09:00:00-07:00',
    'timeZone': 'America/Los_Angeles'
  },
  'end': {
    'dateTime': '2015-05-28T17:00:00-07:00',
    'timeZone': 'America/Los_Angeles'
  },
  'recurrence': [
    'RRULE:FREQ=DAILY;COUNT=2'
  ],
  'attendees': [
    {'email': 'lpage@example.com'},
    {'email': 'sbrin@example.com'}
  ],
  'reminders': {
    'useDefault': false,
    'overrides': [
      {'method': 'email', 'minutes': 24 * 60},
      {'method': 'popup', 'minutes': 10}
    ]
  }
};

const request = gapi.client.calendar.events.insert({
  'calendarId': 'primary',
  'resource': event
});

request.execute(function(event) {
  appendPre('Event created: ' + event.htmlLink);
});

```


<a id="node.js"></a>

### Node.js

```JavaScript
// Refer to the Node.js quickstart on how to setup the environment:
// https://developers.google.com/workspace/calendar/quickstart/node
// Change the scope to 'https://www.googleapis.com/auth/calendar' and delete any
// stored credentials.

const event = {
  'summary': 'Google I/O 2015',
  'location': '800 Howard St., San Francisco, CA 94103',
  'description': 'A chance to hear more about Google\'s developer products.',
  'start': {
    'dateTime': '2015-05-28T09:00:00-07:00',
    'timeZone': 'America/Los_Angeles',
  },
  'end': {
    'dateTime': '2015-05-28T17:00:00-07:00',
    'timeZone': 'America/Los_Angeles',
  },
  'recurrence': [
    'RRULE:FREQ=DAILY;COUNT=2'
  ],
  'attendees': [
    {'email': 'lpage@example.com'},
    {'email': 'sbrin@example.com'},
  ],
  'reminders': {
    'useDefault': false,
    'overrides': [
      {'method': 'email', 'minutes': 24 * 60},
      {'method': 'popup', 'minutes': 10},
    ],
  },
};

calendar.events.insert({
  auth: auth,
  calendarId: 'primary',
  resource: event,
}, function(err, event) {
  if (err) {
    console.log('There was an error contacting the Calendar service: ' + err);
    return;
  }
  console.log('Event created: %s', event.htmlLink);
});

```


<a id="php"></a>

### PHP

```PHP
$event = new Google_Service_Calendar_Event(array(
  'summary' => 'Google I/O 2015',
  'location' => '800 Howard St., San Francisco, CA 94103',
  'description' => 'A chance to hear more about Google\'s developer products.',
  'start' => array(
    'dateTime' => '2015-05-28T09:00:00-07:00',
    'timeZone' => 'America/Los_Angeles',
  ),
  'end' => array(
    'dateTime' => '2015-05-28T17:00:00-07:00',
    'timeZone' => 'America/Los_Angeles',
  ),
  'recurrence' => array(
    'RRULE:FREQ=DAILY;COUNT=2'
  ),
  'attendees' => array(
    array('email' => 'lpage@example.com'),
    array('email' => 'sbrin@example.com'),
  ),
  'reminders' => array(
    'useDefault' => FALSE,
    'overrides' => array(
      array('method' => 'email', 'minutes' => 24 * 60),
      array('method' => 'popup', 'minutes' => 10),
    ),
  ),
));

$calendarId = 'primary';
$event = $service->events->insert($calendarId, $event);
printf('Event created: %s\n', $event->htmlLink);

```


<a id="python"></a>

### Python

```Python
# Refer to the Python quickstart on how to setup the environment:
# https://developers.google.com/workspace/calendar/quickstart/python
# Change the scope to 'https://www.googleapis.com/auth/calendar' and delete any
# stored credentials.

event = {
  'summary': 'Google I/O 2015',
  'location': '800 Howard St., San Francisco, CA 94103',
  'description': 'A chance to hear more about Google\'s developer products.',
  'start': {
    'dateTime': '2015-05-28T09:00:00-07:00',
    'timeZone': 'America/Los_Angeles',
  },
  'end': {
    'dateTime': '2015-05-28T17:00:00-07:00',
    'timeZone': 'America/Los_Angeles',
  },
  'recurrence': [
    'RRULE:FREQ=DAILY;COUNT=2'
  ],
  'attendees': [
    {'email': 'lpage@example.com'},
    {'email': 'sbrin@example.com'},
  ],
  'reminders': {
    'useDefault': False,
    'overrides': [
      {'method': 'email', 'minutes': 24 * 60},
      {'method': 'popup', 'minutes': 10},
    ],
  },
}

event = service.events().insert(calendarId='primary', body=event).execute()
print 'Event created: %s' % (event.get('htmlLink'))

```


<a id="ruby"></a>

### Ruby

```Ruby
event = Google::Apis::CalendarV3::Event.new(
  summary: 'Google I/O 2015',
  location: '800 Howard St., San Francisco, CA 94103',
  description: 'A chance to hear more about Google\'s developer products.',
  start: Google::Apis::CalendarV3::EventDateTime.new(
    date_time: '2015-05-28T09:00:00-07:00',
    time_zone: 'America/Los_Angeles'
  ),
  end: Google::Apis::CalendarV3::EventDateTime.new(
    date_time: '2015-05-28T17:00:00-07:00',
    time_zone: 'America/Los_Angeles'
  ),
  recurrence: [
    'RRULE:FREQ=DAILY;COUNT=2'
  ],
  attendees: [
    Google::Apis::CalendarV3::EventAttendee.new(
      email: 'lpage@example.com'
    ),
    Google::Apis::CalendarV3::EventAttendee.new(
      email: 'sbrin@example.com'
    )
  ],
  reminders: Google::Apis::CalendarV3::Event::Reminders.new(
    use_default: false,
    overrides: [
      Google::Apis::CalendarV3::EventReminder.new(
        reminder_method: 'email',
        minutes: 24 * 60
      ),
      Google::Apis::CalendarV3::EventReminder.new(
        reminder_method: 'popup',
        minutes: 10
      )
    ]
  )
)

result = client.insert_event('primary', event)
puts "Event created: #{result.html_link}"

```


<a id="attachments"></a>

### Add Drive attachments to events

You can attach [Google Drive](https://drive.google.com) files such as meeting notes in Docs, budgets in Sheets, presentations in Slides, or any other relevant Google Drive files to your calendar events. You can add the attachment when you create an event with [`events.insert()`](../v3/reference/events/insert.md) or later as part of an update such as with [`events.patch()`](../v3/reference/events/patch.md)

The two parts of attaching a Google Drive file to an event are:

- Get the file `alternateLink` URL, `title`, and `mimeType` from the [ Drive API Files resource](https://developers.google.com/workspace/drive/v3/reference/files), typically with the [`files.get()`](https://developers.google.com/workspace/drive/v3/reference/files/get) method.

- Create or update an event with the `attachments` fields set in the request body and the `supportsAttachments` parameter set to `true`.

The following code example demonstrates how to update an existing event to add an attachment:

<a id="java_1"></a>

### Java

```Java
public static void addAttachment(Calendar calendarService, Drive driveService, String calendarId,
    String eventId, String fileId) throws IOException {
  File file = driveService.files().get(fileId).execute();
  Event event = calendarService.events().get(calendarId, eventId).execute();

  List<EventAttachment> attachments = event.getAttachments();
  if (attachments == null) {
    attachments = new ArrayList<EventAttachment>();
  }
  attachments.add(new EventAttachment()
      .setFileUrl(file.getAlternateLink())
      .setMimeType(file.getMimeType())
      .setTitle(file.getTitle()));

  Event changes = new Event()
      .setAttachments(attachments);
  calendarService.events().patch(calendarId, eventId, changes)
      .setSupportsAttachments(true)
      .execute();
}

```


<a id="php_1"></a>

### PHP

```PHP
function addAttachment($calendarService, $driveService, $calendarId, $eventId, $fileId) {
  $file = $driveService->files->get($fileId);
  $event = $calendarService->events->get($calendarId, $eventId);
  $attachments = $event->attachments;

  $attachments[] = array(
    'fileUrl' => $file->alternateLink,
    'mimeType' => $file->mimeType,
    'title' => $file->title
  );
  $changes = new Google_Service_Calendar_Event(array(
    'attachments' => $attachments
  ));

  $calendarService->events->patch($calendarId, $eventId, $changes, array(
    'supportsAttachments' => TRUE
  ));
}

```


<a id="python_1"></a>

### Python

```Python
def add_attachment(calendarService, driveService, calendarId, eventId, fileId):
    file = driveService.files().get(fileId=fileId).execute()
    event = calendarService.events().get(calendarId=calendarId,
                                         eventId=eventId).execute()

    attachments = event.get('attachments', [])
    attachments.append({
        'fileUrl': file['alternateLink'],
        'mimeType': file['mimeType'],
        'title': file['title']
    })

    changes = {
        'attachments': attachments
    }
    calendarService.events().patch(calendarId=calendarId, eventId=eventId,
                                   body=changes,
                                   supportsAttachments=True).execute()

```


**Important:** You must perform a [full sync](sync.md#initial_full_sync) of all events before enabling the `supportsAttachments` parameter for event modifications when adding attachments support into your existing app that stores events locally. If you do not perform a sync first, you may inadvertently remove existing attachments from user's events.

<a id="conferencing"></a>

### Add video and phone conferences to events

You can associate events with [Hangouts](https://hangouts.google.com) and [Google Meet](https://meet.google.com) conferences to allow your users to meet remotely via a phone call or a video call.

The [`conferenceData`](../v3/reference/events.md#conferenceData) field can be used to read, copy, and clear existing conference details; it can also be used to request generation of new conferences. To allow creation and modification of conference details, set the `conferenceDataVersion` request parameter to `1`.

There are three types of `conferenceData` currently supported, as denoted by the `conferenceData.conferenceSolution.key.type`:

- Hangouts for consumers (`eventHangout`)

- Classic Hangouts for Google Workspace users (deprecated; `eventNamedHangout`)

- Google Meet (`hangoutsMeet`)

You can learn which conference type is supported for any given calendar of a user by looking at the `conferenceProperties.allowedConferenceSolutionTypes` in the [`calendars`](../v3/reference/calendars.md) and [`calendarList`](../v3/reference/calendarList.md) collections. You can also learn whether the user prefers to have Hangouts created for all their newly created events by checking the `autoAddHangouts` setting in the [`settings`](../v3/reference/settings.md) collection.

Besides the `type`, the `conferenceSolution` also provides the `name` and the `iconUri` fields that you can use to represent the conference solution as shown below:

<a id="javascript_1"></a>

### JavaScript

```JavaScript
const solution = event.conferenceData.conferenceSolution;

const content = document.getElementById("content");
const text = document.createTextNode("Join " + solution.name);
const icon = document.createElement("img");
icon.src = solution.iconUri;

content.appendChild(icon);
content.appendChild(text);

```


You can create a new conference for an event by providing a `createRequest` with a newly generated `requestId` which can be a random `string`. Conferences are created asynchronously, but you can always check the status of your request to let your users know what’s happening.

For example, to request conference generation for an existing event:

<a id="javascript_2"></a>

### JavaScript

```JavaScript
const eventPatch = {
  conferenceData: {
    createRequest: {requestId: "7qxalsvy0e"}
  }
};

gapi.client.calendar.events.patch({
  calendarId: "primary",
  eventId: "7cbh8rpc10lrc0ckih9tafss99",
  resource: eventPatch,
  sendUpdates: "all",
  conferenceDataVersion: 1
}).execute(function(event) {
  console.log("Conference created for event: %s", event.htmlLink);
});

```


The immediate response to this call might not yet contain the fully-populated `conferenceData`; this is indicated by a status code of `pending` in the [status](../v3/reference/events.md#conferenceData.createRequest.status) field. The status code changes to `success` after the conference information is populated. The `entryPoints` field contains information about which video and phone URIs are available for your users to dial in.

If you wish to schedule multiple Calendar events with the same conference details, you can copy the entire `conferenceData` from one event to another.

Copying is useful in certain situations. For example, suppose you are developing a recruiting application that sets up separate events for the candidate and the interviewer—you want to protect the interviewer’s identity, but you also want to make sure all participants join the same conference call.

**Important:** You must perform a [full sync](sync.md#initial_full_sync) of all events before enabling the conference data support (by setting of the `conferenceDataVersion` request parameter to `1` for event modifications) when adding conference support into your existing app that stores events locally. If you do not perform a sync first, you may inadvertently remove existing conferences from users' events.
