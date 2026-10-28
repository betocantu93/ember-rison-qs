---
order: 6
---

# Ember quirks to know

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
