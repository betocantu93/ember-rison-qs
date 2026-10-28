# How To Contribute

## Installation

- `git clone <repository-url>`
- `cd ember-rison-qs`
- `pnpm install`

## Linting

- `pnpm lint`
- `pnpm lint:fix`

## Building the addon

- `pnpm build`

## Running tests

- `pnpm test` – Builds the tests and runs them in headless Chrome, on the current Ember version
- `pnpm start`, then visit [http://localhost:4200/tests/](http://localhost:4200/tests/) – Runs them in your browser, rebuilding on change

Other Ember versions run in CI (see `.try.mjs`). To run one locally:

```sh
pnpm dlx @embroider/try apply ember-lts-5.12
pnpm install --no-lockfile
pnpm test
git checkout package.json   # and put the lockfile back: pnpm install
```

## What the tests cover

- `tests/unit/query-string-test.ts` – reading and writing query strings, no Ember involved
- `tests/unit/router-test.ts` – `useRisonQueryParams` on a router, and the values it keeps
- `tests/unit/locations-test.ts` – the route location helpers
- `tests/acceptance/query-params-test.ts` – typed query params through real transitions, `<LinkTo>`, `urlFor`
- `tests/acceptance/ember-parity-test.ts` – the same scenarios on a plain Ember router and a rison one, which must give the same outcome
- `tests/acceptance/fresh-load-test.ts` – a page loaded fresh, and the addresses that once failed in production
- `tests/acceptance/locations-test.ts` – routes as data: app links, `/fwd/` links, and going back where a signed-out visit was going

## Running the test application

- `pnpm start`
- Visit the demo application at [http://localhost:4200](http://localhost:4200).
