---
order: 5
---

# Without the router

The query string functions don't need Ember at all, so you can use them in a service worker, on a server, or in a non-Ember app that shares URLs with yours:

```ts
import {
  parseRisonQueryString,
  generateRisonQueryString,
  generateRisonQs,
  decodeRisonQs,
} from 'ember-rison-qs';

generateRisonQueryString({ page: 2, search: '', archived: false });
// => '?qs=(archived:!f,page:2)'   (blank values left out; false and 0 kept)

parseRisonQueryString('qs=(page:2)&utm_source=mail&tags[]=a');
// => { page: 2, utm_source: 'mail', tags: ['a'] }

generateRisonQs({ search: "O'Brien (jr" });
// => "(search:'O!'Brien%20(jr')"   (percent-encoded for a URL; pass false for plain rison)

decodeRisonQs("qs=(search:'O!'Brien%20(jr')");
// => { search: "O'Brien (jr" }   (throws when it isn't rison)
```

| Export | What it does |
| --- | --- |
| `useRisonQueryParams(router, options?)` | Sets up an Ember router, from its `setupRouter`. |
| `readValue(value)` | Decodes a value as the router keeps it (a `StoredValue`, as a route's `queryParamsDidChange` action gets it) into a plain copy. Anything else is given back as it is. |
| `StoredValue` | The class of those values: `value instanceof StoredValue`, and its `rison`. |
| `parseRisonQueryString(queryString, options?)` | Query string to params. Never throws: a broken `qs` is dropped, other params are read as Ember reads them. A query string that is all rison (`(a:1)`, `qs:(a:1)`) is read as the `qs` param. |
| `generateRisonQueryString(params, options?)` | Params to `?qs=(...)`, blank values left out, `''` when there's nothing to write. |
| `decodeRisonQs(qs, options?)` | The `qs` value (as `qs=...`, `qs:...` or bare) decoded. Throws when it isn't rison. |
| `generateRisonQs(value, encode = true)` | A value as rison, percent-encoded for a URL unless `encode` is `false`. Keys sorted. |
| `toRisonUrl(url, options?)` | A link's plain params moved into `qs`. A link that already has `qs` is left as it is. |
| `locationFromUrl(router, url)` | The route location a link goes to, `{ name, params, queryParams }`, or `null`. |
| `locationFromRouteInfo(routeInfo)` | The route location of a `RouteInfo`. |
| `transitionArgs(location)` | A route location as `transitionTo`'s arguments. |
| `isBlank(value)` | What gets left out of the URL: exactly what Ember's `isPresent` says isn't present (`undefined`, `null`, a blank string, an empty list, Map or Set, anything with a `length` or `size` of 0), without needing Ember. |
| `encodeUriQuery(rison)` | Percent-encoding that keeps rison readable (`@ : $ , ;` stay as they are). |
| `escapeNestedStrings(rison)` | Repairs rison that has a rison string nested, unescaped, in another one, as some servers write their links. Tried automatically when decoding fails. |

## Testing your app

Nothing special is needed. Visit the URLs your users see:

```ts
await visit('/reports?qs=(filters:(status:!(closed)),page:2)');
// or build them
await visit(`/reports?qs=${generateRisonQs({ filters: { status: ['closed'] }, page: 2 })}`);
```
