# Best Practices

Source: https://developers.google.com/identity/protocols/oauth2/resources/best-practices

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-05-20.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../../../pages/related/identity/protocols/oauth2/resources/best-practices.html>); no article content intentionally omitted.

---

![Spark icon](../../../../../../assets/5577ad69e1ca0549dbb0.svg)

<a id="key-takeaways-panel-title"></a>

## Page Summary

outlined\_flag

- Client credentials should be stored securely, like in a secret manager, and never hardcoded or committed to code repositories.

- User tokens, including refresh and access tokens, must be stored securely and never transmitted in plain text; revoke and delete them when no longer needed.

- Handle refresh token invalidation or expiration by considering appropriate application responses and potentially integrating with services like Cross-Account Protection.

- Utilize incremental authorization to request OAuth scopes only when needed for specific functionality, not all at once during initial authentication.

- When requesting multiple scopes, be prepared for users to deny some and disable corresponding features, only prompting again in context and with justification.

This page covers some general best practices for integrating with OAuth 2.0. Consider these best practices in addition to any specific guidance for your type of application and development platform. Also refer to the [advice for getting your app ready for production](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance) and [Google's OAuth 2.0 policies](../policies.md).

<a id="handle-client-credentials-securely"></a>

## Handle client credentials securely

The OAuth client credentials identify your app's identity and should be handled carefully. Only store these credentials in secure storage, for example using a secret manager such as [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs/overview). Do not hardcode the credentials, commit them to a code repository or publish them publicly.

<a id="handle-user-tokens-securely"></a>

## Handle user tokens securely

User tokens include both refresh tokens and access tokens used by your application. Store tokens securely [at rest](https://wikipedia.org/wiki/Data_at_rest) and never transmit them in plain text. Use a secure storage system appropriate for your platform, such as [Keystore](https://developer.android.com/training/articles/keystore) on Android, Keychain Services on iOS and macOS, or Credential Locker on Windows.

[Revoke tokens](../web-server.md#tokenrevoke) as soon as they are no longer needed and delete them permanently from your systems.

In addition, also consider these best practices for your platform:

- For [server-side](../web-server.md) applications that store tokens for many users, encrypt them at rest and ensure that your datastore is not publicly accessible to the Internet.

- For desktop apps, using the [Proof Key for Code Exchange (PKCE) protocol](https://developers.google.com/identity/protocols/oauth2/native-app#obtainingaccesstokens) is strongly recommended to obtain authorization codes that can be exchanged for access tokens.

<a id="sender-constrain-tokens"></a>

## Sender-constrain tokens with DPoP

To protect your application against token theft and replay attacks, consider sender-constraining your tokens using [DPoP (Demonstrating Proof-of-Possession)](https://datatracker.ietf.org/doc/html/rfc9449). While standard Bearer tokens can be used by any party that intercepts them, DPoP tokens are cryptographically bound to a unique key pair generated and held by the client.

When using DPoP, the client presents a proof (a signed JSON Web Token) to the token endpoint when requesting or refreshing tokens. This proof demonstrates that the client is in possession of the private key that corresponds to the public key bound to the token. If a DPoP-bound refresh token is leaked, it cannot be replayed by an attacker without that private key.

**Note:** Google's OAuth 2.0 implementation supports DPoP binding for **refresh tokens**. Issued access tokens remain standard Bearer tokens when accessing Google APIs.

DPoP works alongside [PKCE](https://developers.google.com/identity/protocols/oauth2/native-app#obtainingaccesstokens) to provide comprehensive protection:

- **PKCE** protects the authorization code during the initial redirection flow.

- **DPoP** protects the long-lived refresh token, preventing replay attacks if it is compromised.

Adopting DPoP is strongly recommended if your application:

- Operates as a public client (such as a single-page application or installed app) where refresh tokens may be more susceptible to exfiltration.

- Accesses highly sensitive data or high-value APIs, where the impact of token leakage is significant.

- Needs to meet strict compliance or security standards that mandate sender-constrained tokens.

For detailed instructions on constructing DPoP proofs and requesting DPoP-bound tokens, refer to the [DPoP documentation](../web-server.md#dpop).

<a id="use-state-parameter"></a>

## Use the state parameter

Before handling an OAuth 2.0 response, confirm that the `state` received from Google matches the `state` sent in your authorization request. The `state` parameter should be a unique, non-guessable value generated by your application.

Using the `state` parameter helps to ensure that the user, not a malicious script, is making the request and reduces the risk of [Cross-Site Request Forgery (CSRF) attacks](https://datatracker.ietf.org/doc/html/rfc6749#section-10.12).

<a id="handle-refresh-token-revocation"></a>

## Handle refresh token revocation and expiration

If your app has requested a [refresh token for offline access](../web-server.md#offline), you must also handle their invalidation or expiration. Tokens could be [invalidated for different reasons](../../oauth2.md#expiration), for example it could have expired or your apps' access could have been revoked by the user or an automated process. In this case, consider carefully how your application should respond, including prompting the user at their next sign-in or cleaning up their data. To be notified of token revocation, integrate with the [Cross-Account Protection](https://developers.google.com/identity/protocols/risc) service.

<a id="use-incremental-authorization"></a>

## Use incremental authorization

Use [incremental authorization](../web-server.md#incrementalAuth) to request appropriate OAuth scopes when the functionality is needed by your application.

You should not request access to data when the user first authenticates, unless it is essential for the core functionality of your app. Instead, request only the specific scopes that are needed for a task, following the principle to [select the smallest, most limited scopes possible](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#only-request-needed-scopes).

Always request scopes in context to help your users understand why your app is requesting access and how the data will be used.

For example, your application may follow this model:

- The user authenticates with your app

  - No additional scopes are requested. The app provides basic functionality to let the user explore and use features that do not require any additional data or access.

- The user selects a feature that requires access to additional data

  - Your application makes an authorization request for this specific OAuth scope required for this feature. If this feature requires multiple scopes, follow [the best practices for multiple scopes](best-practices.md#multiple-scopes).

  - If the user denies the request, the app disables the feature and gives the user additional context to request access again.

<a id="multiple-scopes"></a>

## Handle consent for multiple scopes

When requesting multiple scopes at once, users may not grant all OAuth scopes you have requested. Your app should handle the denial of scopes by disabling relevant functionality.

If your app's basic functionality requires multiple scopes, explain this to the user before prompting for consent.

You may only prompt the user again once they have clearly indicated an intent to use the specific feature that requires the scope. Your app should provide the user with relevant context and justification before requesting OAuth scopes.

You should minimize the number of scopes your app requests at once. Instead, [utilize incremental authorization](best-practices.md#use-incremental-authorization) to request scopes in context of features and functionality.

<a id="use-secure-browsers"></a>

## Use secure browsers

On the web, OAuth 2.0 authorization requests must only be made from full-featured web browsers. On other platforms, make sure to select the [correct OAuth client type](../../oauth2.md#basicsteps) and integrate OAuth as appropriate for your platform. Do not redirect the request through embedded browsing environments, including webviews on mobile platforms, such as WebView on Android or WKWebView on iOS. Instead, utilize recommended [OAuth libraries](https://developers.google.com/identity/protocols/oauth2/native-app) or [Google Sign-in](https://developers.google.com/identity/authorization) for your platform.

<a id="manual-oauth-clients"></a>

## Manual creation and configuration of OAuth clients

In order to prevent abuse, OAuth clients cannot be created or modified programmatically. You must use the Google Cloud console to explicitly acknowledge the terms of service, configure your OAuth client and prepare for OAuth verification.

For automated workflows, consider using [service accounts](https://developers.google.com/identity/protocols/oauth2/service-account) instead.

<a id="remove-unused-oauth-clients"></a>

## Remove unused OAuth clients

Regularly audit your OAuth 2.0 clients and proactively delete any that are no longer required by your application or have become obsolete. Leaving unused clients configured represents a potential security risk as the client can be misused if your client credentials are ever compromised.

To further mitigate risks from unused clients, OAuth 2.0 clients that have been inactive for six months are [ automatically deleted](https://support.google.com/cloud/answer/15549257#unused-client-deletion).

The recommended best practice is to not wait for automatic deletion but rather proactively remove unused clients. This practice minimizes your application's attack surface and ensures good security hygiene.
