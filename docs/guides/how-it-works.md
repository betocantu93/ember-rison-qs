---
order: 7
---

# How it works

Ember's router keeps each query param's value as a string (`'2'`, `'true'`) and relies on it: it compares values with `===` (to the default, to the value before), router_js rewrites numbers and the items of lists into strings in place, and Ember serializes again values it already keeps (`router.isActive`). Hand it typed values as they are, and you get `page: '2'` back, lists of strings, defaults that never leave the URL, and model hooks that re-run for nothing.

So `useRisonQueryParams` gives the router a `StoredValue` for each value instead: an object holding the value's rison, one per rison. Equal values are the same object, so `===` compares them by value; router_js leaves objects alone; and storing a `StoredValue` again gives it back as it is. Everywhere a value leaves the router (controllers, `model(params)`, `transition.to.queryParams`, `router.currentRoute`, `router.recognize`, a route's own hooks, the URL), it is decoded into a plain copy. Ember's own route action, `queryParamsDidChange`, keeps getting the stored values, which Ember 7 compares; `readValue` decodes them.

It replaces a few of the router's private functions to do this: there is no public API for it. The test suite pins each of them by name, on Ember 5.8, 5.12, 6.4, 6.12, 7.4, the next beta and alpha, so a change in them shows up before a release. And if your Ember lacks one of them, `useRisonQueryParams` fails as the app boots, with an error naming what is missing, instead of half working.

Ember 7.5 adds route managers (`setRouteManager`). Ember's own routes work as before. A route with a route manager of its own has no `serializeQueryParam` / `deserializeQueryParam` for the addon to work through: if it has query params, they fail with an error naming its route manager, rather than reaching it untyped.
