# Python quickstart

Source: https://developers.google.com/workspace/calendar/api/quickstart/python

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/quickstart/python.html>); no article content intentionally omitted.

---

Create a Python command-line application that makes requests to the Google Calendar API.

Quickstarts explain how to set up and run an app that calls a Google Workspace API. This quickstart uses a simplified authentication approach that is appropriate for a testing environment. For a production environment, we recommend learning about [authentication and authorization](../related/workspace/guides/auth-overview.md) before [choosing the access credentials](../related/workspace/guides/create-credentials.md#choose_the_access_credential_that_is_right_for_you) that are appropriate for your app.

This quickstart uses Google Workspace's recommended API client libraries to handle some details of the authentication and authorization flow.

<a id="objectives"></a>

## Objectives

- Set up your environment.

- Install the client library.

- Set up the sample.

- Run the sample.

<a id="prerequisites"></a>

## Prerequisites

To run this quickstart, you need the following prerequisites:

- Python 3.10.7 or greater

- The [pip](https://pypi.python.org/pypi/pip) package management tool

- [A Google Cloud project](../related/workspace/guides/create-project.md).

- A Google account with Google Calendar enabled.

<a id="set-up-environment"></a>

## Set up your environment

To complete this quickstart, set up your environment.

<a id="enable_the_api"></a>

### Enable the API

 Before using Google APIs, you need to turn them on in a Google Cloud project. You can turn on one or more APIs in a single Google Cloud project.

- In the Google Cloud console, enable the Google Calendar API.

  [Enable the API](https://console.cloud.google.com/flows/enableapi?apiid=calendar-json.googleapis.com)

<a id="configure_the_oauth_consent_screen"></a>

### Configure the OAuth consent screen

If you're using a new Google Cloud project to complete this quickstart, configure the OAuth consent screen. If you've already completed this step for your Cloud project, skip to the next section.

- In the Google API Console, go to Menu menu > **Google Auth platform** > **Branding**.

  [Go to Branding](https://console.developers.google.com/auth/branding)

- If you have already configured the Google Auth platform, you can configure the following OAuth Consent Screen settings in [Branding](https://console.developers.google.com/auth/branding), [Audience](https://console.developers.google.com/auth/audience), and [Data Access](https://console.developers.google.com/auth/scopes). If you see a message that says **Google Auth platform not configured yet**, click **Get Started**:

- Under **App Information**, in **App name**, enter a name for the app.

- In **User support email**, choose a support email address where users can contact you if they have questions about their consent.

- Click **Next**.

- Under **Audience**, select **Internal**.

- Click **Next**.

- Under **Contact Information**, enter an **Email address** where you can be notified about any changes to your project.

- Click **Next**.

- Under **Finish**, review the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) and if you agree, select **I agree to the Google API Services: User Data Policy**.

- Click **Continue**.

- Click **Create**.

- For now, you can skip adding scopes. In the future, when you create an app for use outside of your Google Workspace organization, you must change the **User type** to **External**. Then add the authorization scopes that your app requires. To learn more, see the full [Configure OAuth consent](../related/workspace/guides/configure-oauth-consent.md) guide.

<a id="authorize_credentials_for_a_desktop_application"></a>

### Authorize credentials for a desktop application

 To authenticate end users and access user data in your app, you need to create one or more OAuth 2.0 Client IDs. A client ID is used to identify a single app to Google's OAuth servers. If your app runs on multiple platforms, you must create a separate client ID for each platform.

- In the Google Cloud Console, go to Menu menu > **Google Auth platform** > **Clients**.

  [Go to Clients](https://console.developers.google.com/auth/clients)

- Click **Create Client**.

- Click **Application type** > **Desktop app**.

- In the **Name** field, type a name for the credential. This name is only shown in the Google Cloud Console.

- Click **Create**.

  The newly created credential appears under "OAuth 2.0 Client IDs."

- Save the downloaded JSON file as `credentials.json`, and move the file to your working directory.

<a id="install_the_google_client_library"></a>

## Install the Google client library

- Install the Google client library for Python:

  ```Python
  python3 -m pip install --upgrade google-api-python-client google-auth-httplib2 google-auth-oauthlib
  ```


<a id="configure_the_sample"></a>

## Configure the sample

- In your working directory, create a file named `quickstart.py`.

- Include the following code in `quickstart.py`:

  calendar/quickstart/quickstart.py

  [View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/calendar/quickstart/quickstart.py)

  ```Python
  import datetime
  import os.path
  
  from google.auth.transport.requests import Request
  from google.oauth2.credentials import Credentials
  from google_auth_oauthlib.flow import InstalledAppFlow
  from googleapiclient.discovery import build
  from googleapiclient.errors import HttpError
  
  # If modifying these scopes, delete the file token.json.
  SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
  
  
  def main():
    """Shows basic usage of the Google Calendar API.
    Prints the start and name of the next 10 events on the user's calendar.
    """
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists("token.json"):
      creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
      if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
      else:
        flow = InstalledAppFlow.from_client_secrets_file(
            "credentials.json", SCOPES
        )
        creds = flow.run_local_server(port=0)
      # Save the credentials for the next run
      with open("token.json", "w") as token:
        token.write(creds.to_json())
  
    try:
      service = build("calendar", "v3", credentials=creds)
  
      # Call the Calendar API
      now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
      print("Getting the upcoming 10 events")
      events_result = (
          service.events()
          .list(
              calendarId="primary",
              timeMin=now,
              maxResults=10,
              singleEvents=True,
              orderBy="startTime",
          )
          .execute()
      )
      events = events_result.get("items", [])
  
      if not events:
        print("No upcoming events found.")
        return
  
      # Prints the start and name of the next 10 events
      for event in events:
        start = event["start"].get("dateTime", event["start"].get("date"))
        print(start, event["summary"])
  
    except HttpError as error:
      print(f"An error occurred: {error}")
  
  
  if __name__ == "__main__":
    main()
  ```


<a id="run_the_sample"></a>

## Run the sample

- In your working directory, build and run the sample:

  ```Python
  python3 quickstart.py
  ```


- The first time you run the sample, it prompts you to authorize access:

  - If you're not already signed in to your Google Account, sign in when prompted. If you're signed in to multiple accounts, select one account to use for authorization.

  - Click **Accept**.

  Your Python application runs and calls the Google Calendar API.

  Authorization information is stored in the file system, so the next time you run the sample code, you aren't prompted for authorization.

<a id="next_steps"></a>

## Next steps

- [Try the Google Workspace APIs in the APIs explorer](https://developers.google.com/workspace/explore)

- [Create events](../guides/create-events.md)

- [Troubleshoot authentication and authorization issues](../troubleshoot-authentication-authorization.md)

- [Calendar API reference documentation](../v3/reference.md)

- [Google APIs Client for Python documentation](https://developers.google.com/api-client-library/python)

- [Google Calendar API PyDoc documentation](https://developers.google.com/resources/api-libraries/documentation/calendar/v3/python/latest/index%2Ehtml)
