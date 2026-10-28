---
order: 4
---

# Routes as data

A route takes three forms in an Ember app: a URL, a `RouteInfo` (`transition.to`, `router.currentRoute`), and the arguments `transitionTo` takes. A **route location**, `{ name, params, queryParams }`, goes between them. It's plain data, so it fits in a query param or in storage as it is.

| From | To | |
| --- | --- | --- |
| a URL | a location | `locationFromUrl(router, url)` |
| a `RouteInfo` | a location | `locationFromRouteInfo(routeInfo)` |
| a location | `transitionTo`'s arguments | `transitionArgs(location)` |
| a URL with plain params | a URL with them in `qs` | `toRisonUrl(url)` |

## Links from outside the app

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

## Back to where a signed-out visit was going

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
