# Troubleshoot authentication & authorization issues

Source: https://developers.google.com/workspace/calendar/api/troubleshoot-authentication-authorization

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../pages/troubleshoot-authentication-authorization.html>); no article content intentionally omitted.

---

This page describes some common issues that you might encounter involving authentication and authorization.

<a id="this_app_isnt_verified"></a>

## `This app isn't verified`

If the OAuth consent screen displays the warning "This app isn't verified," your app is requesting scopes that provide access to sensitive user data. If your application uses sensitive scopes, your app must go through the [verification process](https://support.google.com/cloud/answer/7454865) to remove that warning and other limitations. During the development phase, you can continue past this warning by selecting **Advanced > Go to {Project Name} (unsafe)**.

<a id="file_not_found_error_for_credentialsjson"></a>

## `File not found error for credentials.json`

When running the code sample, you might receive a "file not found" or "no such file" error message regarding credentials.json.

This error occurs when you have not authorized the desktop application credentials. To learn how to create credentials for a desktop application, go to [Create credentials](related/workspace/guides/create-credentials.md#desktop-app).

After you create the credentials, make sure the downloaded JSON file is saved as `credentials.json`. Then move the file to your working directory.

<a id="`token-expired"></a>

## `Token has been expired or revoked`

When running the code sample, you might receive a "Token has been expired" or "Token has been revoked" error message.

This error occurs when an access token from the Google Authorization Server has either expired or has been revoked. For information about potential causes and fixes, see [Refresh token expiration](related/identity/protocols/oauth2.md#expiration).

<a id="javascript-errors"></a>

## JavaScript errors

The following are some common JavaScript errors.

<a id="error_origin_mismatch"></a>

### `Error: origin_mismatch`

This error occurs during the authorization flow if the host and port used to serve the web page doesn't match an allowed JavaScript origin on your Google Cloud console project. Make sure you set an authorized JavaScript origin and that the URL in your browser matches the origin URL.

<a id="idpiframe_initialization_failed_failed_to_read_the_localstorage_property_from_window"></a>

### `idpiframe_initialization_failed: Failed to read the 'localStorage' property from 'Window'`

This error occurs when third-party cookies and data storage aren't enabled in your browser. These options are required by the Google Sign-in library. For more information, see [3rd-party cookies and data storage](https://developers.google.com/identity/sign-in/web/troubleshooting#third-party_cookies_and_data_blocked).

**Note:** In your own app, you should prompt users to enable third-party cookies and data storage or add an exception for `accounts.google.com`.

<a id="idpiframe_initialization_failed_not_a_valid_origin_for_the_client"></a>

### `idpiframe_initialization_failed: Not a valid origin for the client`

This error occurs when the domain registered doesn't match the domain being used to host the web page. Ensure that the origin you registered matches the URL in the browser.
