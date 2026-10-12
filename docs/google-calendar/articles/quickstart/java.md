# Java quickstart

Source: https://developers.google.com/workspace/calendar/api/quickstart/java

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/quickstart/java.html>); no article content intentionally omitted.

---

Create a Java command-line application that makes requests to the Google Calendar API.

Quickstarts explain how to set up and run an app that calls a Google Workspace API. This quickstart uses a simplified authentication approach that is appropriate for a testing environment. For a production environment, we recommend learning about [authentication and authorization](../related/workspace/guides/auth-overview.md) before [choosing the access credentials](../related/workspace/guides/create-credentials.md#choose_the_access_credential_that_is_right_for_you) that are appropriate for your app.

This quickstart uses Google Workspace's recommended API client libraries to handle some details of the authentication and authorization flow.

<a id="objectives"></a>

## Objectives

- Set up your environment.

- Set up the sample.

- Run the sample.

<a id="prerequisites"></a>

## Prerequisites

- Java 11 or greater.

- [Gradle 7.0 or greater](https://gradle.org/install/).

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

<a id="prepare_the_workspace"></a>

## Prepare the workspace

- In your working directory, create a new project structure:

  ```
  gradle init --type basic
  mkdir -p src/main/java src/main/resources 
  ```

- In the `src/main/resources/` directory, copy the `credentials.json` file that you previously downloaded.

- Open the default `build.gradle` file and replace its contents with the following code:

  calendar/quickstart/build.gradle

  [View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/calendar/quickstart/build.gradle)

  ```Groovy
  apply plugin: 'java'
  apply plugin: 'application'
  
  mainClassName = 'CalendarQuickstart'
  sourceCompatibility = 11
  targetCompatibility = 11
  version = '1.0'
  
  repositories {
      mavenCentral()
  }
  
  dependencies {
      implementation 'com.google.api-client:google-api-client:2.0.0'
      implementation 'com.google.oauth-client:google-oauth-client-jetty:1.34.1'
      implementation 'com.google.apis:google-api-services-calendar:v3-rev20220715-2.0.0'
  }
  ```


<a id="set_up_the_sample"></a>

## Set up the sample

- In the `src/main/java/` directory, create a new Java file with a name that matches the `mainClassName` value in your `build.gradle` file.

- Include the following code in your new Java file:

  calendar/quickstart/src/main/java/CalendarQuickstart.java

  [View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/calendar/quickstart/src/main/java/CalendarQuickstart.java)

  ```Java
  import com.google.api.client.auth.oauth2.Credential;
  import com.google.api.client.extensions.java6.auth.oauth2.AuthorizationCodeInstalledApp;
  import com.google.api.client.extensions.jetty.auth.oauth2.LocalServerReceiver;
  import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
  import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
  import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
  import com.google.api.client.http.javanet.NetHttpTransport;
  import com.google.api.client.json.JsonFactory;
  import com.google.api.client.json.gson.GsonFactory;
  import com.google.api.client.util.DateTime;
  import com.google.api.client.util.store.FileDataStoreFactory;
  import com.google.api.services.calendar.Calendar;
  import com.google.api.services.calendar.CalendarScopes;
  import com.google.api.services.calendar.model.Event;
  import com.google.api.services.calendar.model.Events;
  
  import java.io.FileNotFoundException;
  import java.io.IOException;
  import java.io.InputStream;
  import java.io.InputStreamReader;
  import java.security.GeneralSecurityException;
  import java.util.Collections;
  import java.util.List;
  
  /* class to demonstrate use of Calendar events list API */
  public class CalendarQuickstart {
    /**
     * Application name.
     */
    private static final String APPLICATION_NAME = "Google Calendar API Java Quickstart";
    /**
     * Global instance of the JSON factory.
     */
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    /**
     * Directory to store authorization tokens for this application.
     */
    private static final String TOKENS_DIRECTORY_PATH = "tokens";
  
    /**
     * Global instance of the scopes required by this quickstart.
     * If modifying these scopes, delete your previously saved tokens/ folder.
     */
    private static final List<String> SCOPES =
        Collections.singletonList(CalendarScopes.CALENDAR_READONLY);
    private static final String CREDENTIALS_FILE_PATH = "/credentials.json";
  
    /**
     * Creates an authorized Credential object.
     *
     * @param HTTP_TRANSPORT The network HTTP Transport.
     * @return An authorized Credential object.
     * @throws IOException If the credentials.json file cannot be found.
     */
    private static Credential getCredentials(final NetHttpTransport HTTP_TRANSPORT)
        throws IOException {
      // Load client secrets.
      InputStream in = CalendarQuickstart.class.getResourceAsStream(CREDENTIALS_FILE_PATH);
      if (in == null) {
        throw new FileNotFoundException("Resource not found: " + CREDENTIALS_FILE_PATH);
      }
      GoogleClientSecrets clientSecrets =
          GoogleClientSecrets.load(JSON_FACTORY, new InputStreamReader(in));
  
      // Build flow and trigger user authorization request.
      GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
          HTTP_TRANSPORT, JSON_FACTORY, clientSecrets, SCOPES)
          .setDataStoreFactory(new FileDataStoreFactory(new java.io.File(TOKENS_DIRECTORY_PATH)))
          .setAccessType("offline")
          .build();
      LocalServerReceiver receiver = new LocalServerReceiver.Builder().setPort(8888).build();
      Credential credential = new AuthorizationCodeInstalledApp(flow, receiver).authorize("user");
      //returns an authorized Credential object.
      return credential;
    }
  
    public static void main(String... args) throws IOException, GeneralSecurityException {
      // Build a new authorized API client service.
      final NetHttpTransport HTTP_TRANSPORT = GoogleNetHttpTransport.newTrustedTransport();
      Calendar service =
          new Calendar.Builder(HTTP_TRANSPORT, JSON_FACTORY, getCredentials(HTTP_TRANSPORT))
              .setApplicationName(APPLICATION_NAME)
              .build();
  
      // List the next 10 events from the primary calendar.
      DateTime now = new DateTime(System.currentTimeMillis());
      Events events = service.events().list("primary")
          .setMaxResults(10)
          .setTimeMin(now)
          .setOrderBy("startTime")
          .setSingleEvents(true)
          .execute();
      List<Event> items = events.getItems();
      if (items.isEmpty()) {
        System.out.println("No upcoming events found.");
      } else {
        System.out.println("Upcoming events");
        for (Event event : items) {
          DateTime start = event.getStart().getDateTime();
          if (start == null) {
            start = event.getStart().getDate();
          }
          System.out.printf("%s (%s)\n", event.getSummary(), start);
        }
      }
    }
  }
  ```


<a id="run_the_sample"></a>

## Run the sample

- Run the sample:

  ```
  
  gradle run
  ```


- The first time you run the sample, it prompts you to authorize access:

  - If you're not already signed in to your Google Account, sign in when prompted. If you're signed in to multiple accounts, select one account to use for authorization.

  - Click **Accept**.

  Your Java application runs and calls the Google Calendar API.

  Authorization information is stored in the file system, so the next time you run the sample code, you aren't prompted for authorization.

<a id="next_steps"></a>

## Next steps

- [Try the Google Workspace APIs in the APIs explorer](https://developers.google.com/workspace/explore)

- [Create events](../guides/create-events.md)

- [Troubleshoot authentication and authorization issues](../troubleshoot-authentication-authorization.md)

- [Calendar API reference documentation](../v3/reference.md)

- [Google APIs Client for Java documentation](https://developers.google.com/api-client-library/java)

- [Google Calendar API Javadoc documentation](https://googleapis.dev/java/google-api-services-calendar/latest/index.html)
