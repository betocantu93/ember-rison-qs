---
order: 3
---

# Routes with their own hooks

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
