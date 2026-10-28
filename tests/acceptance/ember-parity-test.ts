import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import EmberRouter from '@ember/routing/router';
import { hash } from '@ember/helper';
import { LinkTo } from '@ember/routing';
import { precompileTemplate } from '@ember/template-compilation';
import { VERSION } from '@ember/version';
import { settled, visit } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

import {
  RecordingLocation,
  register,
  risonRouter,
  routerMain,
} from '../helpers/index.ts';

import type Owner from '@ember/owner';

// When a model hook runs again, whether an address is pushed or replaced,
// what a controller ends up with: the same with rison as with Ember's own
// query params. Each scenario runs on both routers and must give the same
// trace. Where Ember itself does something surprising, so does this addon:
// it changes how params are written, not what the router does with them.

// Before Ember 7, a router service transition fills in the params it wasn't
// given at their defaults and counts them as changed: a refreshModel param
// runs its model hook again, whatever the transition was for
const REFRESHES_FOR_DEFAULTS = Number(VERSION.split('.')[0]) < 7;
const afterRouterServiceTransition = REFRESHES_FOR_DEFAULTS ? 2 : 1;

const map = function (
  this: Parameters<typeof EmberRouter.map>[0] extends (this: infer T) => void
    ? T
    : never,
) {
  this.route('page');
  this.route('other');
};

class PlainRouter extends EmberRouter {
  location = 'recording';
  rootURL = '/';
}

PlainRouter.map(map);

class PageRoute extends Route {
  models = 0;
  queryParams = { page: { refreshModel: true }, sort: { replace: true } };

  model() {
    this.models++;
  }
}

class PageController extends Controller {
  // (Ember's types leave out `as`)
  queryParams = [
    'search',
    'page',
    'archived',
    { sort: { as: 's' } },
  ] as unknown as Controller['queryParams'];
  search = '';
  page = 1;
  archived = false;
  sort = 'name';
}

interface Trace {
  models: number;
  writes: string[];
  values: Record<string, unknown>;
}

function setup(owner: Owner, router: typeof EmberRouter) {
  register(owner, 'router:main', router);
  register(owner, 'location:recording', RecordingLocation);
  register(
    owner,
    'template:application',
    precompileTemplate('{{outlet}}', { strictMode: true }),
  );
  register(owner, 'route:page', PageRoute);
  register(owner, 'controller:page', PageController);
  register(owner, 'route:other', class extends Route {});

  const writesBefore = () => routerMain(owner).location.history.length;
  let start = 0;

  return {
    router: owner.lookup('service:router'),
    controller: () => owner.lookup('controller:page') as PageController,
    // writes and models from here on
    mark() {
      start = writesBefore();
    },
    trace(): Trace {
      const page = owner.lookup('controller:page') as PageController;
      const location = routerMain(owner).location;

      return {
        models: (owner.lookup('route:page') as PageRoute).models,
        writes: location.history.slice(start).map(([method]) => method),
        values: {
          search: page.search,
          page: page.page,
          archived: page.archived,
          sort: page.sort,
        },
      };
    },
  };
}

type Scenario = (app: ReturnType<typeof setup>) => Promise<void>;

const SCENARIOS: Record<string, { run: Scenario; expected: Trace }> = {
  'a router service transition to a param without refreshModel': {
    async run(app) {
      await visit('/page');
      app.mark();
      await app.router.transitionTo({ queryParams: { search: 'x' } });
    },
    expected: {
      models: afterRouterServiceTransition,
      writes: ['push'],
      values: { search: 'x', page: 1, archived: false, sort: 'name' },
    },
  },
  'a router service transition to a refreshModel param': {
    async run(app) {
      await visit('/page');
      app.mark();
      await app.router.transitionTo({ queryParams: { page: 2 } });
    },
    expected: {
      models: 2,
      writes: ['push'],
      values: { search: '', page: 2, archived: false, sort: 'name' },
    },
  },
  'a controller setting a refreshModel param': {
    async run(app) {
      await visit('/page');
      app.mark();
      app.controller().set('page', 3);
      await settled();
    },
    expected: {
      models: 2,
      writes: ['push'],
      values: { search: '', page: 3, archived: false, sort: 'name' },
    },
  },
  'a controller setting a param without refreshModel': {
    async run(app) {
      await visit('/page');
      app.mark();
      app.controller().set('archived', true);
      await settled();
    },
    expected: {
      models: 1,
      writes: ['push'],
      values: { search: '', page: 1, archived: true, sort: 'name' },
    },
  },
  'a controller setting a replace: true param': {
    async run(app) {
      await visit('/page');
      app.mark();
      app.controller().set('sort', 'date');
      await settled();
    },
    expected: {
      models: 1,
      writes: ['replace'],
      values: { search: '', page: 1, archived: false, sort: 'date' },
    },
  },
  'a router service transition to a replace: true param': {
    async run(app) {
      await visit('/page');
      app.mark();
      await app.router.transitionTo({ queryParams: { s: 'date' } });
    },
    expected: {
      models: afterRouterServiceTransition,
      writes: ['replace'],
      values: { search: '', page: 1, archived: false, sort: 'date' },
    },
  },
  replaceWith: {
    async run(app) {
      await visit('/page');
      app.mark();
      await app.router.replaceWith({ queryParams: { archived: true } });
    },
    expected: {
      models: afterRouterServiceTransition,
      writes: ['replace'],
      values: { search: '', page: 1, archived: true, sort: 'name' },
    },
  },
  'a transition to the values it has already': {
    async run(app) {
      await visit('/page');
      await app.router.transitionTo({
        queryParams: { page: 4, archived: true },
      });
      app.mark();
      await app.router.transitionTo({
        queryParams: { page: 4, archived: true },
      });
    },
    // the same address is written again, and no model hook runs
    expected: {
      models: 2,
      writes: ['push'],
      values: { search: '', page: 4, archived: true, sort: 'name' },
    },
  },
  'a param back at its default': {
    async run(app) {
      await visit('/page');
      await app.router.transitionTo({ queryParams: { page: 4 } });
      app.mark();
      app.controller().set('page', 1);
      await settled();
    },
    expected: {
      models: 3,
      writes: ['push'],
      values: { search: '', page: 1, archived: false, sort: 'name' },
    },
  },
  'leaving and coming back (sticky params)': {
    async run(app) {
      await visit('/page');
      await app.router.transitionTo({ queryParams: { page: 4, search: 'x' } });
      await visit('/other');
      app.mark();
      // Ember aborts the first transition back to bring the sticky params
      // along, and makes another
      await app.router.transitionTo('page').catch(() => settled());
      await settled();
    },
    expected: {
      models: 3,
      writes: ['push'],
      values: { search: 'x', page: 4, archived: false, sort: 'name' },
    },
  },
};

for (const [flavor, router] of [
  ['Ember', PlainRouter],
  ['rison', risonRouter(map)],
] as const) {
  module(`Acceptance | same as Ember | ${flavor}`, function (hooks) {
    setupApplicationTest(hooks);

    for (const [name, { run, expected }] of Object.entries(SCENARIOS)) {
      test(name, async function (assert) {
        const app = setup(this.owner, router);

        await run(app);

        // as JSON, so a failure shows both traces
        assert.strictEqual(
          JSON.stringify(app.trace()),
          JSON.stringify(expected),
        );
      });
    }
  });
}

// <LinkTo>'s active class for the query params it has, on both routers
for (const [flavor, router, url] of [
  ['Ember', PlainRouter, '/page?page=3'],
  ['rison', risonRouter(map), '/page?qs=(page:3)'],
] as const) {
  module(
    `Acceptance | same as Ember | ${flavor} | <LinkTo> active`,
    function (hooks) {
      setupApplicationTest(hooks);

      test('follows the query params', async function (assert) {
        const app = setup(this.owner, router);

        register(
          this.owner,
          'template:page',
          precompileTemplate(
            `<LinkTo id="page-3" @route="page" @query={{hash page=3}}>3</LinkTo>
           <LinkTo id="page-4" @route="page" @query={{hash page=4}}>4</LinkTo>`,
            { strictMode: true, scope: () => ({ LinkTo, hash }) },
          ),
        );

        const active = () =>
          ['#page-3', '#page-4'].filter((id) =>
            document.querySelector(id)?.classList.contains('active'),
          );
        const seen: string[][] = [];

        await visit(url);
        seen.push(active());
        await app.router.transitionTo({ queryParams: { page: 4 } });
        seen.push(active());
        app.controller().set('page', 3);
        await settled();
        seen.push(active());

        // Ember's own <LinkTo> keeps the active class it had after a
        // transition that changes query params only: so does it with rison
        assert.strictEqual(
          JSON.stringify(seen),
          JSON.stringify([['#page-3'], ['#page-3'], ['#page-3']]),
        );
      });
    },
  );
}
