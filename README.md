# ember-rison-qs

[![CI](https://github.com/betocantu93/ember-rison-qs/actions/workflows/ci.yml/badge.svg)](https://github.com/betocantu93/ember-rison-qs/actions/workflows/ci.yml)

All of an Ember app's query params in one readable [Rison](https://github.com/Nanonid/rison) param, typed on the way in and on the way out:

```
/reports?qs=(filters:(status:!(open,'in review')),page:2,print:!t,search:'O!'Brien')
```

```js
// the controller gets
{ filters: { status: ['open', 'in review'] }, page: 2, print: true, search: "O'Brien" }
```

Rison is JSON for URLs: `(key:value)` is an object, `!(a,b)` a list, `!t` `!f` `!n` are true, false, null, and a word needs no quotes. Kibana keeps its dashboards' state in the URL the same way, which is where this idea came from.

- **Typed values.** A number stays a number, a boolean a boolean, and objects and lists are allowed, as deep as you like. Ember's own query params are strings (`'2'`, `'true'`), and objects aren't supported at all.
- **Readable and compact.** Far fewer characters than JSON in a URL, and none of the `%22%3A%7B` noise.
- **Behaves like Ember.** Defaults leave the URL (compared by value, so an object equal to its default does too), and `refreshModel`, `replace`, `as`, sticky params, `<LinkTo>`, `router.isActive`, `urlFor` and `transitionTo` work as Ember documents them. The test suite runs the same scenarios on a plain Ember router and asserts the same outcome, on Ember 5.8 to 7.4.
- **Works with routes that have their own query param hooks**, as [ember-parachute](https://github.com/offirgolan/ember-parachute) adds: they get values, and what they give back is written as rison.
- **Forgiving.** Plain `?page=2` links still work. A broken `qs` param is dropped instead of breaking the page, and so are params added by others (`?fbclid=`, `?utm_source=`).
- **Routes as data.** Helpers to turn a URL or a `RouteInfo` into a plain `{ name, params, queryParams }` and back into a transition: for links opened from outside the app (mobile app links, a link pasted from the clipboard), and for sending a signed-out visit back where it was going.

## Compatibility

- Ember 5.8 or above (Embroider/Vite and classic builds: it's a v2 addon)
- Node 20 or above

## Installation

```sh
pnpm add ember-rison-qs   # or npm install / yarn add
```

## Setup

One call, in your router's `setupRouter`. The router reads the address of a page loaded fresh before any route exists, so it must be set up from there:

```ts
// app/router.ts
import EmberRouter from '@ember/routing/router';
import { useRisonQueryParams } from 'ember-rison-qs';
import config from 'my-app/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;

  setupRouter() {
    const didSetUp = super.setupRouter();

    if (didSetUp) {
      useRisonQueryParams(this);
    }

    return didSetUp;
  }
}
```

That's it. Declare query params the way you always have:

```ts
// app/controllers/reports.ts
import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

export default class ReportsController extends Controller {
  queryParams = ['page', 'filters', 'search', { sort: { as: 's' } }];

  @tracked page = 1;
  @tracked filters: { status: string[] } = { status: ['open'] };
  @tracked search = '';
  @tracked sort = 'date';
}
```

```ts
// app/routes/reports.ts
export default class ReportsRoute extends Route {
  queryParams = {
    page: { refreshModel: true },
    filters: { refreshModel: true },
    sort: { replace: true },
  };

  model(params: { page: number; filters: { status: string[] } }) {
    // params.page is a number, params.filters an object
  }
}
```

```hbs
<LinkTo @route='reports' @query={{hash page=2 filters=(hash status=(array 'closed'))}}>
  Closed, page 2
</LinkTo>
{{! href="/reports?qs=(filters:(status:!(closed)),page:2)" }}
```

### Things to know

- **Set a new value to change the URL.** As with any Ember query param, mutating an object in place (`this.filters.status.push('x')`) doesn't update the URL. Set a new one: `this.filters = { ...this.filters, status: [...] }`.
- **Everywhere you read them, values are typed.** Controllers, `model(params)`, `transition.to.queryParams`, `transition.from.queryParams`, `router.currentRoute.queryParams`, `router.recognize(url).queryParams` and a route's own query param hooks all have `page: 2`, `ids: [1, 2]`. (Ember's own query params give strings in all of these.) The ones you read off a transition or a RouteInfo are copies: changing them changes nothing in the router. The one exception is a route's `queryParamsDidChange` action: see below.
- **One param in the URL.** Every query param of the active routes is written into the `qs` param. Params the app doesn't declare (`?fbclid=...`) are readable in `transition.to.queryParams` for that transition and are left out of the next URL Ember writes, as Ember does.
- **A `Date` is written as its ISO string** (rison, like JSON, has no dates), and comes back as that string. Convert it where you read it, or in a route's `deserializeQueryParam`.
- **Ember quirks** (with or without this addon) are listed in [Ember quirks to know](#ember-quirks-to-know).

### Examples

**Read them where you need them.** Every place Ember gives you query params has them typed:

```ts
// app/routes/reports.ts
beforeModel(transition: Transition) {
  transition.to.queryParams.page;            // 2, not '2'
}

model(params: { page: number; filters: { status: string[] } }) {
  return this.store.query('report', { page: params.page, filter: params.filters });
}

// anywhere with the router service
this.router.currentRoute.queryParams.filters; // { status: ['open'] }
this.router.recognize('/reports?qs=(page:3)').queryParams.page; // 3
```

**Change them from code.** Pass values, not strings:

```ts
this.router.transitionTo({ queryParams: { page: 3, filters: { status: ['closed'] } } });
this.router.replaceWith({ queryParams: { page: 1 } }); // replaces the history entry

// or set the controller's property: the URL follows
this.page = 3;
```

**Is a view active?** Objects are compared by value:

```ts
this.router.isActive('reports', { queryParams: { filters: { status: ['closed'] } } });
```

```hbs
{{! "active" when the current filters equal these }}
<LinkTo @route='reports' @query={{hash filters=(hash status=(array 'closed'))}}>Closed</LinkTo>
```

**Old and hand-written links still work.** A plain `?page=2` (or an old link that wrote `page:'2'` as a string) reaches a param whose default is a number as `2`, and `'true'`/`'false'` reach a boolean param as `true`/`false`, as Ember reads plain params.

### Routes with their own query param hooks

A route can override `serializeQueryParam` / `deserializeQueryParam`, and ember-parachute does it for every param with its own `serialize` / `deserialize`. They work as they would without this addon, just with values instead of strings: `deserializeQueryParam` gets what the URL had (`4`, `{ status: 'open' }`, or a plain `'4'`), and what `serializeQueryParam` returns is written as rison. They are never handed the addon's own stored values.

```ts
// app/routes/reports.ts
serializeQueryParam(value: unknown, urlKey: string, type: string) {
  if (urlKey === 'page') return parseInt(value as string); // written as page:4
  return super.serializeQueryParam(value, urlKey, type);
}

deserializeQueryParam(value: unknown, urlKey: string, type: string) {
  if (urlKey === 'page') return parseInt(value as string); // 4 from page:4, page:'4' or ?page=4
  return super.deserializeQueryParam(value, urlKey, type);
}
```

**A route's `queryParamsDidChange` action gets the router's own values**, `StoredValue`s, just as plain Ember gives it its own stored strings. Ember's handler needs them that way: Ember 6 reads only the keys, and Ember 7 also compares the values with the ones it keeps, to skip re-running `refreshModel` hooks for a value that didn't change. If your own handler reads the values, decode them: `readValue(changed.page)` is `2`.

ember-parachute builds its `queryParamsDidChange` event's `changed` from these, so its `event.ts` needs that one change: `qp.deserialize(changed[qp.as], ...)` becomes `qp.deserialize(readValue(changed[qp.as]), ...)`. Its `setup` and `reset` events, `event.queryParams` and the controllers have values already.

### Another param name

```ts
useRisonQueryParams(this, { key: '_a' }); // /reports?_a=(page:2)
```

Every helper below takes the same `{ key }` option.

## Ember quirks to know

These are Ember's own, with or without this addon. The test suite checks each one on a plain Ember router and a rison one.

- **`replace: true` is a route option.** Put it in the route's `queryParams` (`queryParams = { sort: { replace: true } }`), not in the controller's: Ember ignores it there, and every change is pushed.
- **`transitionTo` takes an `as` param by its URL name.** With `{ sort: { as: 's' } }`, it is `transitionTo({ queryParams: { s: 'date' } })`; `sort` fails an assertion.
- **Before Ember 7, a router service transition re-runs `refreshModel` model hooks for the defaults it fills in.** `router.transitionTo({ queryParams: { search: 'x' } })` refreshes the model of a route whose `page` has `refreshModel`, even though `page` didn't change. Ember 7 fixed it.
- **A router service transition's `transition.to.queryParams` can have every param**, defaults included, not just the ones you passed. Read the ones you need by name.
- **Going back to a route with sticky query params can reject the first transition.** Ember may abort it to bring the sticky values along and make another: `router.transitionTo('reports')` then rejects with `TransitionAborted` while the app still lands on `/reports?qs=(...)`. Catch it if you await it.
- **`router.urlFor` doesn't call a route's `serializeQueryParam`.** `<LinkTo>` and `transitionTo` do.
- **`<LinkTo>` keeps the active class it had after a transition that changes query params only.** A `<LinkTo @query={{hash page=3}}>` stays active after `transitionTo({ queryParams: { page: 4 } })`, until it renders again (seen on every Ember version tested, 5.8 to 7.4).
- **Mutating a query param in place doesn't update the URL.** Set a new value.
- **`actions = { ... }` as a class field replaces a route's actions**, Ember's own `queryParamsDidChange` included, and with it `refreshModel`. Extend them instead (`Route.extend({ actions: { ... } })` calling `this._super(...arguments)`), as ember-parachute does.
- **Ember's types leave out `as`** in a controller's `queryParams`, and say `serializeQueryParam` / `deserializeQueryParam` take and give strings. Cast where TypeScript complains.

## How it works

Ember's router keeps each query param's value as a string (`'2'`, `'true'`) and relies on it: it compares values with `===` (to the default, to the value before), router_js rewrites numbers and the items of lists into strings in place, and Ember serializes again values it already keeps (`router.isActive`). Hand it typed values as they are, and you get `page: '2'` back, lists of strings, defaults that never leave the URL, and model hooks that re-run for nothing.

So `useRisonQueryParams` gives the router a `StoredValue` for each value instead: an object holding the value's rison, one per rison. Equal values are the same object, so `===` compares them by value; router_js leaves objects alone; and storing a `StoredValue` again gives it back as it is. Everywhere a value leaves the router (controllers, `model(params)`, `transition.to.queryParams`, `router.currentRoute`, `router.recognize`, a route's own hooks, the URL), it is decoded into a plain copy. Ember's own route action, `queryParamsDidChange`, keeps getting the stored values, which Ember 7 compares; `readValue` decodes them.

It replaces a few of the router's private functions to do this: there is no public API for it. The test suite runs on Ember 5.8, 5.12, 6.4, 7.4 and the next beta, so a change in them shows up before a release.

## Routes as data

A route takes three forms in an Ember app: a URL, a `RouteInfo` (`transition.to`, `router.currentRoute`), and the arguments `transitionTo` takes. A **route location**, `{ name, params, queryParams }`, goes between them. It's plain data, so it fits in a query param or in storage as it is.

| From | To | |
| --- | --- | --- |
| a URL | a location | `locationFromUrl(router, url)` |
| a `RouteInfo` | a location | `locationFromRouteInfo(routeInfo)` |
| a location | `transitionTo`'s arguments | `transitionArgs(location)` |
| a URL with plain params | a URL with them in `qs` | `toRisonUrl(url)` |

### Links from outside the app

Links opened in a mobile app, pasted from the clipboard, or written by a server usually have plain params. `toRisonUrl` moves them into `qs`, and `locationFromUrl` gives you where to go:

```ts
// e.g. a Capacitor app: App.addListener('appUrlOpen', ({ url }) => ...)
import { locationFromUrl, toRisonUrl, transitionArgs } from 'ember-rison-qs';

function openAppLink(router: RouterService, url: string) {
  // myapp://app/reports/5?print=true  ->  myapp://app/reports/5?qs=(print:'true')
  const location = locationFromUrl(router, toRisonUrl(url)); // any scheme: only path and query count

  if (location && location.name !== 'not-found') {
    router.replaceWith(...transitionArgs(location));
  }
}
```

A plain `'true'` or `'2'` reaching a param whose default is a boolean or a number is read as one, as Ember reads plain params.

### Back to where a signed-out visit was going

The location of `transition.to`, kept in a query param, survives a reload of the login page:

```ts
// a route that needs a session
beforeModel(transition: Transition) {
  if (!this.session.isAuthenticated) {
    const next = locationFromRouteInfo(transition.to!);
    // /login?qs=(next:(name:reports.show,params:!('5'),queryParams:(print:!t)))
    this.router.transitionTo('login', { queryParams: { next } });
  }
}

// after signing in
this.router.transitionTo(...transitionArgs(this.next));
```

The same goes for a saved view, a notification's link, or "share this view": keep the location, go to it later.

## Without the router

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

## Upgrading from 0.x

0.x was a mixin for the application route. Now:

1. Remove `RisonQsMixin` from your application route.
2. Add `useRisonQueryParams(this)` to your router's `setupRouter` (see Setup).

URLs stay the same `?qs=(...)`, so links already shared keep working. What's new: plain params (`?page=2`) beside or without `qs`, typed values that survive Ember's router, defaults compared by value, and the route location helpers.

## Credits

- [Rison](https://github.com/Nanonid/rison) is the format and its original implementation. [rison-node](https://github.com/w33ble/rison-node) is its npm packaging, by Joe Fleming and contributors. This addon depends on [prysmex-rison-node](https://www.npmjs.com/package/prysmex-rison-node) ([source](https://github.com/prysmex/rison-node)), a fork of rison-node that adds types, an ES module build, bug fixes and tests: the format and the implementation it builds on are theirs.
- The idea of keeping app state in rison in the URL comes from [Kibana](https://github.com/elastic/kibana).
- ember-rison-qs was started by [Mario Trujillo](https://github.com/mtrunt) and [Alberto Cantú](https://github.com/betocantu93). 1.0 comes from how [Prysmex](https://github.com/prysmex) uses it in production, with each edge case it ran into turned into a test.

## Contributing

See the [Contributing](CONTRIBUTING.md) guide.

## License

This project is licensed under the [MIT License](LICENSE.md).
