# Acl

Source: https://developers.google.com/workspace/calendar/api/v3/reference/acl

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-07-29.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../pages/v3/reference/acl.html>); no article content intentionally omitted.

---

<a id="overview"></a>

For a list of [methods](acl.md#methods) for this resource, see the end of this page.

<a id="resource"></a>

<a id="resource-representations"></a>

## Resource representations

<a id="alt-json"></a>

```Carbon
{
  "kind": "calendar#aclRule",
  "etag": etag,
  "id": string,
  "scope": {
    "type": string,
    "value": string
  },
  "role": string
}
```


<a id="properties"></a>

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| <a id="etag"></a>`etag` | `etag` | ETag of the resource. |  |
| <a id="id"></a>`id` | `string` | Identifier of the Access Control List (ACL) rule. See [Sharing calendars](../../concepts/sharing.md#sharing_calendars). |  |
| <a id="kind"></a>`kind` | `string` | Type of the resource ("`calendar#aclRule`"). |  |
| <a id="role"></a>`role` | `string` | The role assigned to the scope. Possible values are: <br><br><br><br>- "`none`" - Provides no access.<br> <br>- "`freeBusyReader`" - Provides read access to free/busy information.<br> <br>- "`reader`" - Provides read access to the calendar. Private events will appear to users with reader access, but event details will be hidden.<br> <br>- "`writerWithoutPrivateAccess`" - Provides read and write access to the calendar. Private events will appear to users with `writerWithoutPrivateAccess` access, but event details will be hidden.<br> <br>- "`writer`" - Provides read and write access to the calendar. Private events will appear to users with writer access, and event details will be visible. Provides read access to the calendar's ACLs.<br> <br>- "`owner`" - Provides manager access to the calendar. This role has all of the permissions of the writer role with the additional ability to modify access levels of other users. <br>  <br>  <br>  <br>  Important: the `owner` role is different from the calendar's data owner. A calendar has a single data owner, but can have multiple users with `owner` role. | writable |
| <a id="scope"></a>`scope` | `object` | The extent to which [calendar access](../../concepts/sharing.md#sharing_calendars) is granted by this ACL rule. |  |
| <a id="scope.type"></a>`scope.type` | `string` | The type of the scope. Possible values are: <br><br><br><br>- "`default`" - The public scope. This is the default value.<br> <br>- "`user`" - Limits the scope to a single user.<br> <br>- "`group`" - Limits the scope to a group.<br> <br>- "`domain`" - Limits the scope to a domain.<br><br> Note: The permissions granted to the "`default`", or public, scope apply to any user, authenticated or not. |  |
| <a id="scope.value"></a>`scope.value` | `string` | The email address of a user or group, or the name of a domain, depending on the scope type. Omitted for type "`default`". | writable |

<a id="methods"></a>

## Methods

[delete](acl/delete.md)

Deletes an access control rule.

[get](acl/get.md)

Returns an access control rule.

[insert](acl/insert.md)

Creates an access control rule.

[list](acl/list.md)

Returns the rules in the access control list for the calendar.

[patch](acl/patch.md)

Updates an access control rule. This method supports patch semantics. Note that each patch request consumes three quota units; prefer using a `get` followed by an `update`. The field values you specify replace the existing values. Fields that you don't specify in the request remain unchanged. Array fields, if specified, overwrite the existing arrays; this discards any previous array elements.

[update](acl/update.md)

Updates an access control rule.

[watch](acl/watch.md)

Watch for changes to ACL resources.
