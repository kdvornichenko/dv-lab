# Google Apps Script quickstart

Source: https://developers.google.com/workspace/calendar/api/quickstart/apps-script

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/quickstart/apps-script.html>); no article content intentionally omitted.

---

Create a [Google Apps Script](https://developers.google.com/apps-script/overview) that makes requests to the Google Calendar API.

Quickstarts explain how to set up and run an app that calls a Google Workspace API. This quickstart uses a simplified authentication approach that is appropriate for a testing environment. For a production environment, we recommend learning about [authentication and authorization](../related/workspace/guides/auth-overview.md) before [choosing the access credentials](../related/workspace/guides/create-credentials.md#choose_the_access_credential_that_is_right_for_you) that are appropriate for your app.

In Apps Script, Google Workspace quickstarts use [Advanced Google services](https://developers.google.com/apps-script/guides/services/advanced) to call Google Workspace APIs and handle some details of the authentication and authorization flow.

<a id="objectives"></a>

## Objectives

- Configure the environment.

- Create and configure the script.

- Run the script.

<a id="prerequisites"></a>

## Prerequisites

- A Google account with Google Calendar enabled.

- Access to Google Drive

<a id="create_the_script"></a>

## Create the script

- Create a new script in the Apps Script editor by going to [script.google.com/create](https://script.google.com/create).

- Replace the contents of the script editor with the following code:

calendar/quickstart/quickstart.gs

[View on GitHub](https://github.com/googleworkspace/apps-script-samples/blob/main/calendar/quickstart/quickstart.gs)

```JavaScript
/**
 * Lists 10 upcoming events in the user's calendar.
 * @see https://developers.google.com/calendar/api/v3/reference/events/list
 */
function listUpcomingEvents() {
  const calendarId = "primary";
  // Add query parameters in optionalArgs
  const optionalArgs = {
    timeMin: new Date().toISOString(),
    showDeleted: false,
    singleEvents: true,
    maxResults: 10,
    orderBy: "startTime",
    // use other optional query parameter here as needed.
  };
  try {
    // call Events.list method to list the calendar events using calendarId optional query parameter
    const response = Calendar.Events.list(calendarId, optionalArgs);
    const events = response.items;
    if (events.length === 0) {
      console.log("No upcoming events found");
      return;
    }
    // Print the calendar events
    for (const event of events) {
      let when = event.start.dateTime;
      if (!when) {
        when = event.start.date;
      }
      console.log("%s (%s)", event.summary, when);
    }
  } catch (err) {
    // TODO (developer) - Handle exception from Calendar API
    console.log("Failed with error %s", err.message);
  }
}
```


- Click Save ![](../../assets/53be9da3c3610fca8612.svg).

- Click **Untitled project**, type **Quickstart**, and click **Rename**.

<a id="configure_the_script"></a>

## Configure the script

<a id="enable-api"></a>

### Enable the Google Calendar API

Open the Apps Script project.

- Click **Editor** code.

- Next to **Services**, click Add a service add .

- Select Calendar API and click **Add**.

<a id="run_the_sample"></a>

## Run the sample

In the Apps Script editor, click **Run**.

The first time you run the sample, it prompts you to authorize access:

- Click **Review permissions**.

- Choose an account.

- Click **Allow**.

The script's execution log appears at the bottom of the window.

<a id="feedback-question"></a>

done It worked!

<a id="feedback-success"></a>

**Great!** Check out the further reading section below to learn more.

warning There was a problem

<a id="quickstart-feedback-failure"></a>

**Bummer**, [ let us know what went wrong](apps-script.md). Check out our [ troubleshooting](apps-script.md#troubleshooting) section below for some common errors and solutions. If you have found a bug in the code, [ report the issue on GitHub](https://github.com/googleworkspace/apps-script-samples/issues) or submit a pull request.

<a id="next_steps"></a>

## Next steps

- [Google Apps Script Advanced Services documentation](https://developers.google.com/apps-script/guides/services/advanced)

- [Try the Google Workspace APIs in the APIs explorer](https://developers.google.com/workspace/explore)

- [Create events](../guides/create-events.md)

- [Troubleshoot authentication and authorization issues](../troubleshoot-authentication-authorization.md)

- [Calendar API reference documentation](../v3/reference.md)
