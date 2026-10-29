# Changelog

## 2.0.4

- Works on Ember 7.5 (beta and alpha), which failed at boot with "this version of Ember has no route.serializeQueryParam, route.deserializeQueryParam". Ember 7.5 adds route managers, and the router's `getRoute` gives a route's manager and bucket instead of the route; the addon now finds Ember's own routes in the bucket, so their query param hooks (and those apps override, as ember-parachute does) work as before.
- A route with a route manager of its own (`setRouteManager`) that has query params fails with an error naming its route manager, instead of getting `StoredValue`s.

## 2.0.3

- Development only: a docs site with a playground, and `tmp` forced to `^0.2.6` among the dev dependencies (pnpm audit). No change to the published code.

## 2.0.2

- `useRisonQueryParams` fails with an error naming what is missing when a version of Ember lacks one of the router internals it replaces (`router._routerMicrolib.toInfos`, a route's `serializeQueryParam`, ...), instead of skipping it, which left `StoredValue`s where apps read values. Nothing is replaced when it fails. The same ember-source runs in development, tests and production, so this shows at the first boot or test run.

## 2.0.1

- Tests that pin each Ember router internal the addon relies on, by name, on every Ember version it is tested on (beta and alpha included). No change to the code.

## 2.0.0

A rewrite, as a v2 addon. URLs stay the same `?qs=(...)`, so links already shared keep working.

### Breaking

- The `RisonQsMixin` is gone. Call `useRisonQueryParams(this)` from your router's `setupRouter` instead (see the README). It also works on a page loaded fresh, which the mixin, set up from the application route, could not.
- Ember 5.8 or above, Node 20 or above.

### New

- Query params keep their types through Ember's router: numbers, booleans, lists and objects reach controllers, `model(params)`, `transition.to.queryParams`, `transition.from.queryParams`, `router.currentRoute.queryParams` and `router.recognize(url).queryParams` as they are in the URL, and are written back the same. (Ember's router turns numbers, and the items of lists, into strings for its own comparisons. This is now undone.)
- A query string that is all rison (`?(a:1)`, `?qs:(a:1)`) is read too.
- Defaults leave the URL compared by value, so an object equal to its default does too. `refreshModel` and `replace` only fire for a real change.
- Plain params (`?page=2`, `?embed`, `?id[]=1`) are read as Ember reads them, with or without `qs`. A plain `'2'` or `'false'` reaching a param whose default is a number or a boolean is read as one. A `qs` that isn't rison is dropped instead of breaking the page.
- Raw `&`, `+` and `=` inside a rison string, as servers that build links by hand write them, stay part of it.
- Works with routes that override `serializeQueryParam` / `deserializeQueryParam` (as ember-parachute does): they get values, and what they return is written as rison. A route's `queryParamsDidChange` action gets the router's own values (as Ember gives it its stored strings); `readValue` decodes them.
- `router.isActive` and `<LinkTo>`'s active class compare query params by value, objects included.
- `{ key }` option for another param name than `qs`.
- Framework-free query string functions: `parseRisonQueryString`, `generateRisonQueryString`, `decodeRisonQs`, `generateRisonQs`, `isBlank`, `encodeUriQuery`, `escapeNestedStrings`.
- Routes as data: `locationFromUrl`, `locationFromRouteInfo` and `transitionArgs` turn a URL or a `RouteInfo` into a plain route location (`{ name, params, queryParams }`) and back into a transition; `toRisonUrl` moves a link's plain params into `qs`. For links from outside the app, and for going back where a signed-out visit was going.
- TypeScript types.
- Rison itself comes from [prysmex-rison-node](https://www.npmjs.com/package/prysmex-rison-node) ([source](https://github.com/prysmex/rison-node)), a fork of rison-node with types, an ES module build and fixes (keys like `'01'` kept as they are, errors that say where, no console output). Its output is the same as rison-node's but for number-like keys: `{ 1: 'a' }` is now written `(1:a)`, as rison-node 2 writes it, where 0.x wrote `('1':a)`. Both read back the same.
- Tests: the query string functions, the router set up with it, route locations, and the same routing scenarios run on a plain Ember router, which must give the same outcome.
