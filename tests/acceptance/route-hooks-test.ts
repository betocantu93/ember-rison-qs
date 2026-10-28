import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import { hash } from '@ember/helper';
import { LinkTo } from '@ember/routing';
import { precompileTemplate } from '@ember/template-compilation';
import { currentURL, settled, visit } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

import { readValue, StoredValue } from '#src/index.ts';

import { register, setupRisonApp, type RisonApp } from '../helpers/index.ts';

import type RouterService from '@ember/routing/router-service';

// Routes that override `serializeQueryParam` / `deserializeQueryParam`, as
// ember-parachute does with each query param's own serialize / deserialize,
// and handle `queryParamsDidChange`: whatever they do, they get values, and
// what they give back is written as rison.

const adapters: Record<
  string,
  { serialize(value: unknown): unknown; deserialize(value: unknown): unknown }
> = {
  // the default of the app this addon comes from: values as they are
  search: { serialize: (value) => value, deserialize: (value) => value },
  filters: { serialize: (value) => value, deserialize: (value) => value },
  // an integer adapter: parseInt both ways
  page: {
    serialize: (value) =>
      value === null || value === undefined ? null : parseInt(value as string),
    deserialize: (value) => parseInt(value as string),
  },
  // one that changes the value on its way to the address
  loud: {
    serialize: (value) => String(value).toUpperCase(),
    deserialize: (value) => String(value).toLowerCase(),
  },
};

// every value a hook was handed
let handed: unknown[] = [];
// what queryParamsDidChange got
let changes: Record<string, unknown>[] = [];

class AdaptedRoute extends Route {
  models = 0;

  queryParams = { page: { refreshModel: true } };

  model() {
    this.models++;
  }

  // (Ember's types say this one gives a string: not with adapters)
  // @ts-expect-error see above
  serializeQueryParam(value: unknown, urlKey: string, type: string) {
    handed.push(value);

    const adapter = adapters[urlKey];

    return adapter
      ? adapter.serialize(value)
      : super.serializeQueryParam(value, urlKey, type);
  }

  deserializeQueryParam(value: unknown, urlKey: string, type: string) {
    handed.push(value);

    const adapter = adapters[urlKey];

    return adapter
      ? adapter.deserialize(value)
      : super.deserializeQueryParam(value, urlKey, type);
  }
}

// queryParamsDidChange as ember-parachute adds to it: its own, then Ember's
// (which runs refreshModel)
const ObservedRoute = AdaptedRoute.extend({
  actions: {
    queryParamsDidChange(
      changed: Record<string, unknown>,
      _all: unknown,
      removed: Record<string, unknown>,
    ) {
      changes.push({ ...changed, ...removed });

      const route = this as unknown as {
        _super: (...args: unknown[]) => unknown;
      };

      return route._super(changed, _all, removed);
    },
  },
});

class AdaptedController extends Controller {
  // (Ember's types leave out `as`)
  queryParams = [
    'search',
    'filters',
    'page',
    'other',
    { shout: { as: 'loud' } },
  ] as unknown as Controller['queryParams'];

  search = '';
  filters: Record<string, unknown> = { status: 'open' };
  page = 1;
  other: unknown = null;
  shout = '';
}

const json = (value: unknown) => JSON.stringify(value);

module(
  'Acceptance | routes with their own query param hooks',
  function (hooks) {
    setupApplicationTest(hooks);

    let app: RisonApp;
    let router: RouterService;
    let controller: () => AdaptedController;
    let route: () => AdaptedRoute;

    hooks.beforeEach(function () {
      handed = [];
      changes = [];
      app = setupRisonApp(this.owner, function () {
        this.route('page');
        this.route('other');
      });
      register(this.owner, 'route:page', ObservedRoute);
      register(this.owner, 'controller:page', AdaptedController);
      register(this.owner, 'route:other', class extends Route {});
      register(
        this.owner,
        'template:page',
        precompileTemplate(
          '<LinkTo id="link" @route="page" @query={{hash page="9" shout="hi"}}>link</LinkTo>',
          { strictMode: true, scope: () => ({ LinkTo, hash }) },
        ),
      );

      router = this.owner.lookup('service:router');
      controller = () =>
        this.owner.lookup('controller:page') as AdaptedController;
      route = () => this.owner.lookup('route:page') as AdaptedRoute;
    });

    hooks.afterEach(function (assert) {
      assert.false(
        handed.some((value) => value instanceof StoredValue),
        'no hook was handed a StoredValue',
      );
    });

    test('values from the address reach the controller typed', async function (assert) {
      await visit(
        "/page?qs=(filters:(status:closed,tags:!(1,2)),loud:HELLO,other:!(1,2),page:4,search:'it!'s')",
      );

      assert.strictEqual(controller().search, "it's");
      assert.deepEqual(controller().filters, {
        status: 'closed',
        tags: [1, 2],
      });
      assert.strictEqual(controller().page, 4);
      assert.strictEqual(
        controller().shout,
        'hello',
        'through its deserialize',
      );
      assert.strictEqual(json(controller().other), '[1,2]', 'no hook: ours');
    });

    test('an integer adapter reads a plain param and an old quoted number', async function (assert) {
      await visit('/page?page=4');
      assert.strictEqual(controller().page, 4);

      await visit('/other');
      await visit("/page?qs=(page:'7')");
      assert.strictEqual(controller().page, 7);
    });

    test('what the hooks give back is written as rison', async function (assert) {
      await visit('/page');

      controller().set('page', 5);
      controller().set('shout', 'hey');
      controller().set('filters', { status: 'closed' });
      await settled();

      assert.strictEqual(
        currentURL(),
        '/page?qs=(filters:(status:closed),loud:HEY,page:5)',
      );
    });

    test('values equal to their defaults leave the address', async function (assert) {
      await visit('/page?qs=(filters:(status:closed),page:3)');

      controller().set('page', 1);
      controller().set('filters', { status: 'open' });
      await settled();

      assert.strictEqual(currentURL(), '/page');
    });

    test('an equal value is no change: nothing written, no model hook', async function (assert) {
      await visit('/page?qs=(filters:(status:closed),page:3)');

      const writes = app.history.length;

      controller().set('filters', { status: 'closed' });
      controller().set('page', 3);
      await settled();

      assert.strictEqual(app.history.length, writes);
      assert.strictEqual(route().models, 1);
    });

    test('refreshModel still runs the model hook for a real change', async function (assert) {
      await visit('/page');
      await router.transitionTo({ queryParams: { page: 2 } });

      assert.strictEqual(route().models, 2);
      assert.strictEqual(controller().page, 2);
    });

    // as Ember gives it its own strings: Ember 7's handler compares them
    // with what it keeps, to skip refreshing for a value that didn't change
    test("queryParamsDidChange gets the router's own values, readValue decodes them", async function (assert) {
      await visit('/page');
      await router.transitionTo({
        queryParams: { page: 2, filters: { status: 'closed' }, other: [1] },
      });

      const last = changes.at(-1)!;

      assert.true(last.page instanceof StoredValue);
      assert.strictEqual(readValue(last.page), 2);
      assert.deepEqual(readValue(last.filters), { status: 'closed' });
      assert.strictEqual(json(readValue(last.other)), '[1]');
    });

    test('router.isActive with query params', async function (assert) {
      await visit('/page?qs=(filters:(status:closed),loud:HELLO,page:3)');

      assert.true(router.isActive('page', { queryParams: { page: 3 } }));
      assert.false(router.isActive('page', { queryParams: { page: 4 } }));
      assert.true(
        router.isActive('page', {
          queryParams: { filters: { status: 'closed' }, loud: 'hello' },
        }),
      );
    });

    // (router.urlFor doesn't call them: neither does Ember's own)
    test('<LinkTo> goes through the hooks', async function (assert) {
      await visit('/page');

      assert.dom('#link').hasAttribute('href', '/page?qs=(loud:HI,page:9)');
    });
  },
);
