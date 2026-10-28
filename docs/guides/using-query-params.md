---
order: 2
---

# Using query params

## Examples

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

## Things to know

- **Set a new value to change the URL.** As with any Ember query param, mutating an object in place (`this.filters.status.push('x')`) doesn't update the URL. Set a new one: `this.filters = { ...this.filters, status: [...] }`.
- **Everywhere you read them, values are typed.** Controllers, `model(params)`, `transition.to.queryParams`, `transition.from.queryParams`, `router.currentRoute.queryParams`, `router.recognize(url).queryParams` and a route's own query param hooks all have `page: 2`, `ids: [1, 2]`. (Ember's own query params give strings in all of these.) The ones you read off a transition or a RouteInfo are copies: changing them changes nothing in the router. The one exception is a route's `queryParamsDidChange` action: see below.
- **One param in the URL.** Every query param of the active routes is written into the `qs` param. Params the app doesn't declare (`?fbclid=...`) are readable in `transition.to.queryParams` for that transition and are left out of the next URL Ember writes, as Ember does.
- **A `Date` is written as its ISO string** (rison, like JSON, has no dates), and comes back as that string. Convert it where you read it, or in a route's `deserializeQueryParam`.
- **Ember quirks** (with or without this addon) are listed in [Ember quirks to know](/guides/ember-quirks).
