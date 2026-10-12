# Acl: update

Source: https://developers.google.com/workspace/calendar/api/v3/reference/acl/update

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-29.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/v3/reference/acl/update.html>); no article content intentionally omitted.

---

**Note:** Requires [authorization](update.md#auth).

Updates an access control rule. [Try it now](update.md#try-it).

<a id="request"></a>

## Request

<a id="http-request"></a>

### HTTP request

```
PUT https://www.googleapis.com/calendar/v3/calendars/calendarId/acl/ruleId
```


<a id="parameters"></a>

### Parameters

<a id="request_parameters"></a>

| Parameter name | Value | Description |
| --- | --- | --- |
| <a id="required-parameters"></a>**Path parameters** |  |  |
| <a id="calendarId"></a>`calendarId` | `string` | Calendar identifier. To retrieve calendar IDs call the [calendarList.list](../calendarList/list.md) method. If you want to access the primary calendar of the currently logged in user, use the "`primary`" keyword. |
| <a id="ruleId"></a>`ruleId` | `string` | ACL rule identifier. |
| <a id="optional-parameters"></a>**Optional query parameters** |  |  |
| <a id="sendNotifications"></a>`sendNotifications` | `boolean` | Whether to send notifications about the calendar sharing change. Note that there are no notifications on access removal. Optional. The default is True. |

<a id="auth"></a>

### Authorization

This request requires authorization with at least one of the following scopes:

| Scope |
| --- |
| `https://www.googleapis.com/auth/calendar` |
| `https://www.googleapis.com/auth/calendar.acls` |

For more information, see the [authentication and authorization](../../../related/workspace/guides/configure-oauth-consent.md) page.

<a id="request-body"></a>

### Request body

In the request body, supply an [Acl resource](../acl.md#resource) with the following properties:

<a id="request_properties_JSON"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="required-properties"></a>**Required Properties** |  |  |  |
| <a id="scope"></a>`scope` | `object` | The extent to which [calendar access](../../../concepts/sharing.md#sharing_calendars) is granted by this ACL rule. |  |
| <a id="scope.type"></a>`scope.type` | `string` | The type of the scope. Possible values are: <br><br><br><br>- "`default`" - The public scope. This is the default value.<br> <br>- "`user`" - Limits the scope to a single user.<br> <br>- "`group`" - Limits the scope to a group.<br> <br>- "`domain`" - Limits the scope to a domain.<br><br> Note: The permissions granted to the "`default`", or public, scope apply to any user, authenticated or not. |  |
| <a id="optional-properties"></a>**Optional Properties** |  |  |  |
| <a id="role"></a>`role` | `string` | The role assigned to the scope. Possible values are: <br><br><br><br>- "`none`" - Provides no access.<br> <br>- "`freeBusyReader`" - Provides read access to free/busy information.<br> <br>- "`reader`" - Provides read access to the calendar. Private events will appear to users with reader access, but event details will be hidden.<br> <br>- "`writerWithoutPrivateAccess`" - Provides read and write access to the calendar. Private events will appear to users with `writerWithoutPrivateAccess` access, but event details will be hidden.<br> <br>- "`writer`" - Provides read and write access to the calendar. Private events will appear to users with writer access, and event details will be visible. Provides read access to the calendar's ACLs.<br> <br>- "`owner`" - Provides manager access to the calendar. This role has all of the permissions of the writer role with the additional ability to modify access levels of other users. <br>  <br>  <br>  <br>  Important: the `owner` role is different from the calendar's data owner. A calendar has a single data owner, but can have multiple users with `owner` role. | writable |
| <a id="scope.value"></a>`scope.value` | `string` | The email address of a user or group, or the name of a domain, depending on the scope type. Omitted for type "`default`". | writable |

<a id="response"></a>

## Response

If successful, this method returns an [Acl resource](../acl.md#resource) in the response body.

<a id="try-it"></a>

## Try it!

Use the APIs Explorer below to call this method on live data and see the response.

<a id="embedded-explorer"></a>
