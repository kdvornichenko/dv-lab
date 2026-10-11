# Domain resources, rooms, and calendars

Source: https://developers.google.com/workspace/calendar/api/concepts/domain

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/concepts/domain.html>); no article content intentionally omitted.

---

The Google Calendar API offers several concepts that are primarily useful for [Google Workspace](https://workspace.google.com/) customers. These customers often have resources, such as rooms and projectors, that they need to book for specific events. In addition, you might need to build internal apps that access all user calendars in a domain (for example, to add company-wide events).

<a id="domain-resources-and-rooms"></a>

## Domain resources and rooms

To book a room or other resource, add its email address as an event attendee. The resource then automatically accepts or declines the invitation based on its availability and the inviting user's access rights.

**Note:** The Calendar API does not offer a way to create resource calendars. To do this, you need to use the Directory API's [Calendar Resource](https://developers.google.com/workspace/admin/directory/reference/rest/v1/resources.calendars) object. The `calendarId` corresponds to the `resourceEmail` field of the Calendar Resource representation.

<a id="access-domain-calendars-as-an-app"></a>

## Access domain calendars as an app

An app can access domain-owned calendars without requiring user credentials if it authenticates using a [service account](https://developers.google.com/identity/protocols/OAuth2ServiceAccount). The service account must have the necessary access using [domain-wide authority delegation](https://developers.google.com/identity/protocols/OAuth2ServiceAccount#delegatingauthority). To impersonate a user account, specify the email address of the user account with the `setServiceAccountUser` method of the `GoogleCredential` factory.
