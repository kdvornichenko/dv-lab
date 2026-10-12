# Extended properties

Source: https://developers.google.com/workspace/calendar/api/guides/extended-properties

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-11.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/guides/extended-properties.html>); no article content intentionally omitted.

---

The fields of the [Events resources](../v3/reference/events.md) cover the most common data associated with an event, such as location, start time, etc, but applications may want to store additional metadata specific to their use case. The Calendar API provides the ability to set hidden key-value pairs with an event, called [extended properties](../v3/reference/events.md#extendedProperties). Extended properties make it easy to store application-specific data for an event without having to utilize an external database.

<a id="visibility"></a>

## Visibility

There are two types of extended properties available: private and shared. Shared properties are visible and editable by all attendees of an event, while private properties are set on one attendee's local "copy" of the event. More concretely, private properties are specific to the `calendarId` and `eventId` used in the request, while shared properties will be shown regardless of the `calendarId` used in the request.

<a id="add_update_properties"></a>

## Add & update properties

Extended properties are set on the Events resource, and like other fields can be set in [insert](../v3/reference/events/insert.md), [update](../v3/reference/events/update.md), and [patch](../v3/reference/events/patch.md) requests. Using patch requests is the preferred method, as it allows you to manipulate some properties while leaving others untouched. Adding a new property with the same key will overwrite any existing properties with the same key. The following example shows setting a private property:

```Text only
PATCH https://www.googleapis.com/calendar/v3/calendars/calendarId/events/eventId
```


```Text only
{
  "extendedProperties": {
    "private": {
      "petsAllowed": "yes"
    }
  }
}
```


<a id="delete_properties"></a>

## Delete properties

Any properties not included in an update request will be deleted, but a better approach is to make a patch request to set the value to null. The following example shows deleting a private property:

```Text only
PATCH https://www.googleapis.com/calendar/v3/calendars/calendarId/events/eventId
```


```Text only
{
  "extendedProperties": {
    "private": {
      "petsAllowed": null
    }
  }
}
```


<a id="search_properties"></a>

## Search properties

You can search events based on the values on their extended properties using an [Events.list](../v3/reference/events/list.md) request. Set the field [privateExtendedProperty](../v3/reference/events/list.md#privateExtendedProperty) or [sharedExtendedProperty](../v3/reference/events/list.md#sharedExtendedProperty) to a constraint in the format `propertyName=value`, which searches against private and shared properties respectively. The following example returns events with the private property `petsAllowed=yes`:

```
GET https://www.googleapis.com/calendar/v3/calendars/calendarId/events
    ?privateExtendedProperty=petsAllowed%3Dyes
```


You can repeat these fields multiple times and the constraints are OR'ed together, so events only need to match one of the constraints to be returned. The following example finds events with either the private property `petsAllowed=yes` or `isOutside=yes`:

```
GET https://www.googleapis.com/calendar/v3/calendars/calendarId/events
    ?privateExtendedProperty=petsAllowed%3Dyes
    &privateExtendedProperty=isOutside%3Dyes
```


Be aware that constraints on private and shared properties are AND'ed together however, so events must match both sets of constraints in order to be returned. The following example finds events with the private property `petsAllowed=yes` and the public property `createdBy=myApp`:

```
GET https://www.googleapis.com/calendar/v3/calendars/calendarId/events
    ?privateExtendedProperty=petsAllowed%3Dyes
    &sharedExtendedProperty=createdBy%3DmyApp
```


<a id="limits"></a>

## Limits

- The maximum size of a property's key is 44 characters, and properties with longer keys will be silently dropped.

- The maximum size of a property's value is 1024 characters, and properties with longer values will be silently truncated.

- An event can have up to 300 properties totaling up to 32kB in size (keys size + value size). These 300 properties include shared and private properties, across all "copies" of the event.
