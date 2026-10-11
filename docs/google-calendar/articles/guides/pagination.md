# Page through lists of resources

Source: https://developers.google.com/workspace/calendar/api/guides/pagination

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-11.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../pages/guides/pagination.html>); no article content intentionally omitted.

---

You can control the maximum number of resources the server returns in the response to a list request by setting the `maxResults` field. Furthermore, for some collections (such as Events) there is a hard limit on the number of retrieved entries that the server will never exceed. If the total number of events exceeds this maximum, the server returns one page of results.

Remember that `maxResults` does not guarantee the number of results on one page. Incomplete results can be detected by a non-empty `nextPageToken` field in the result. In order to retrieve the next page, perform the exact same request as previously and append a `pageToken` field with the value of `nextPageToken` from the previous page. A new `nextPageToken` is provided on the following pages until all the results are retrieved.

For example, here is a query followed by the query for retrieving the next page of results in a paginated list:

```Text only
GET /calendars/primary/events?maxResults=10&singleEvents=true

//Result contains

"nextPageToken":"CiAKGjBpNDd2Nmp2Zml2cXRwYjBpOXA",
```


The subsequent query takes the value from `nextPageToken` and submits it as the value for `pageToken`:

```Text only
GET /calendars/primary/events?maxResults=10&singleEvents=true&pageToken=CiAKGjBpNDd2Nmp2Zml2cXRwYjBpOXA
```
