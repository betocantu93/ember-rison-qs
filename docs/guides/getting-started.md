---
order: 1
---

# Getting started

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

## Another param name

```ts
useRisonQueryParams(this, { key: '_a' }); // /reports?_a=(page:2)
```

Every helper below takes the same `{ key }` option.
