# Go quickstart

Source: https://developers.google.com/workspace/calendar/api/quickstart/go

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/quickstart/go.html>); no article content intentionally omitted.

---

Create a Go command-line application that makes requests to the Google Calendar API.

Quickstarts explain how to set up and run an app that calls a Google Workspace API. This quickstart uses a simplified authentication approach that is appropriate for a testing environment. For a production environment, we recommend learning about [authentication and authorization](../related/workspace/guides/auth-overview.md) before [choosing the access credentials](../related/workspace/guides/create-credentials.md#choose_the_access_credential_that_is_right_for_you) that are appropriate for your app.

This quickstart uses Google Workspace's recommended API client libraries to handle some details of the authentication and authorization flow.

<a id="objectives"></a>

## Objectives

- Set up your environment.

- Set up the sample.

- Run the sample.

<a id="prerequisites"></a>

## Prerequisites

- Latest version of [Go](https://golang.org/).

- Latest version of [Git](https://git-scm.com/).

- [A Google Cloud project](../related/workspace/guides/create-project.md).

- A Google account with Google Calendar enabled.

<a id="set_up_your_environment"></a>

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

- Create a working directory:

  ```
  
  mkdir quickstart
  ```

- Change to the working directory:

  ```
  
  cd quickstart
  ```

- Initialize the new module:

  ```
  
  go mod init quickstart
  ```

- Get the Google Calendar API Go client library and OAuth2.0 package:

  ```
  go get google.golang.org/api/calendar/v3
  go get golang.org/x/oauth2/google
  ```


<a id="set_up_the_sample"></a>

## Set up the sample

- In your working directory, create a file named `quickstart.go`.

- In the file, paste the following code:

  calendar/quickstart/quickstart.go

  [View on GitHub](https://github.com/googleworkspace/go-samples/blob/main/calendar/quickstart/quickstart.go)

  ```Go
  package main
  
  import (
  	"context"
  	"encoding/json"
  	"fmt"
  	"log"
  	"net/http"
  	"os"
  	"time"
  
  	"golang.org/x/oauth2"
  	"golang.org/x/oauth2/google"
  	"google.golang.org/api/calendar/v3"
  	"google.golang.org/api/option"
  )
  
  // Retrieve a token, saves the token, then returns the generated client.
  func getClient(config *oauth2.Config) *http.Client {
  	// The file token.json stores the user's access and refresh tokens, and is
  	// created automatically when the authorization flow completes for the first
  	// time.
  	tokFile := "token.json"
  	tok, err := tokenFromFile(tokFile)
  	if err != nil {
  		tok = getTokenFromWeb(config)
  		saveToken(tokFile, tok)
  	}
  	return config.Client(context.Background(), tok)
  }
  
  // Request a token from the web, then returns the retrieved token.
  func getTokenFromWeb(config *oauth2.Config) *oauth2.Token {
  	authURL := config.AuthCodeURL("state-token", oauth2.AccessTypeOffline)
  	fmt.Printf("Go to the following link in your browser then type the "+
  		"authorization code: \n%v\n", authURL)
  
  	var authCode string
  	if _, err := fmt.Scan(&authCode); err != nil {
  		log.Fatalf("Unable to read authorization code: %v", err)
  	}
  
  	tok, err := config.Exchange(context.TODO(), authCode)
  	if err != nil {
  		log.Fatalf("Unable to retrieve token from web: %v", err)
  	}
  	return tok
  }
  
  // Retrieves a token from a local file.
  func tokenFromFile(file string) (*oauth2.Token, error) {
  	f, err := os.Open(file)
  	if err != nil {
  		return nil, err
  	}
  	defer f.Close()
  	tok := &oauth2.Token{}
  	err = json.NewDecoder(f).Decode(tok)
  	return tok, err
  }
  
  // Saves a token to a file path.
  func saveToken(path string, token *oauth2.Token) {
  	fmt.Printf("Saving credential file to: %s\n", path)
  	f, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
  	if err != nil {
  		log.Fatalf("Unable to cache oauth token: %v", err)
  	}
  	defer f.Close()
  	json.NewEncoder(f).Encode(token)
  }
  
  func main() {
  	ctx := context.Background()
  	b, err := os.ReadFile("credentials.json")
  	if err != nil {
  		log.Fatalf("Unable to read client secret file: %v", err)
  	}
  
  	// If modifying these scopes, delete your previously saved token.json.
  	config, err := google.ConfigFromJSON(b, calendar.CalendarReadonlyScope)
  	if err != nil {
  		log.Fatalf("Unable to parse client secret file to config: %v", err)
  	}
  	client := getClient(config)
  
  	srv, err := calendar.NewService(ctx, option.WithHTTPClient(client))
  	if err != nil {
  		log.Fatalf("Unable to retrieve Calendar client: %v", err)
  	}
  
  	t := time.Now().Format(time.RFC3339)
  	events, err := srv.Events.List("primary").ShowDeleted(false).
  		SingleEvents(true).TimeMin(t).MaxResults(10).OrderBy("startTime").Do()
  	if err != nil {
  		log.Fatalf("Unable to retrieve next ten of the user's events: %v", err)
  	}
  	fmt.Println("Upcoming events:")
  	if len(events.Items) == 0 {
  		fmt.Println("No upcoming events found.")
  	} else {
  		for _, item := range events.Items {
  			date := item.Start.DateTime
  			if date == "" {
  				date = item.Start.Date
  			}
  			fmt.Printf("%v (%v)\n", item.Summary, date)
  		}
  	}
  }
  ```


<a id="run_the_sample"></a>

## Run the sample

- In your working directory, build and run the sample:

  ```
  
  go run quickstart.go
  ```


- The first time you run the sample, it prompts you to authorize access:

  - If you're not already signed in to your Google Account, sign in when prompted. If you're signed in to multiple accounts, select one account to use for authorization.

  - Click **Accept**.

  Your Go application runs and calls the Google Calendar API.

  Authorization information is stored in the file system, so the next time you run the sample code, you aren't prompted for authorization.

<a id="next_steps"></a>

## Next steps

- [Try the Google Workspace APIs in the APIs explorer](https://developers.google.com/workspace/explore)

  - [Create events](../guides/create-events.md)

  - [Troubleshoot authentication and authorization issues](../troubleshoot-authentication-authorization.md)

  - [Calendar API reference documentation](../v3/reference.md)

  - [`google-api-go-client` section of GitHub](https://github.com/google/google-api-go-client)
