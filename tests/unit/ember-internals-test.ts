import EmberRouter from '@ember/routing/router';
import Route from '@ember/routing/route';
import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

import {
  RecordingLocation,
  register,
  risonRouter,
  routerMain,
} from '../helpers/index.ts';

// The private parts of Ember's router that useRisonQueryParams relies on
// (src/router.ts). There is no public API for any of it, so a new Ember can
// rename or rework them: these tests say which one, by name, before the
// behavior tests fail in less obvious ways. Run on every Ember version in
// .try.mjs, beta and alpha included.

type Fn = (...args: unknown[]) => unknown;

interface Internals {
  setupRouter(): boolean;
  _serializeQueryParam?: Fn;
  _deserializeQueryParam?: Fn;
  _routerMicrolib?: {
    recognizer?: { parseQueryString?: Fn; generateQueryString?: Fn };
    getRoute?: Fn;
    toInfos?: Fn;
    fromInfos?: Fn;
    recognize?: Fn;
    recognizeAndLoad?: Fn;
  };
}

class PlainRouter extends EmberRouter {
  location = 'recording';
  rootURL = '/';
}

PlainRouter.map(function () {
  this.route('page');
});

const own = (object: object, name: string) =>
  Object.prototype.hasOwnProperty.call(object, name);

module('Unit | Ember internals the addon relies on', function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(function () {
    register(this.owner, 'location:recording', RecordingLocation);
  });

  module("a plain router's", function (hooks) {
    let router: Internals;

    hooks.beforeEach(function () {
      register(this.owner, 'router:main', PlainRouter);
      router = routerMain<Internals>(this.owner);
      router.setupRouter();
    });

    test('query param (de)serializers', function (assert) {
      assert.strictEqual(
        typeof router._serializeQueryParam,
        'function',
        'router._serializeQueryParam',
      );
      assert.strictEqual(
        typeof router._deserializeQueryParam,
        'function',
        'router._deserializeQueryParam',
      );
    });

    test('router_js, and its query string parser and writer', function (assert) {
      const microlib = router._routerMicrolib;

      assert.ok(microlib, 'router._routerMicrolib');
      assert.strictEqual(
        typeof microlib?.recognizer?.parseQueryString,
        'function',
        'recognizer.parseQueryString',
      );
      assert.strictEqual(
        typeof microlib?.recognizer?.generateQueryString,
        'function',
        'recognizer.generateQueryString',
      );
    });

    test('what hands out routes, RouteInfos and recognize', function (assert) {
      const microlib = router._routerMicrolib!;

      for (const name of [
        'getRoute',
        'toInfos',
        'fromInfos',
        'recognize',
        'recognizeAndLoad',
      ] as const) {
        assert.strictEqual(
          typeof microlib[name],
          'function',
          `router._routerMicrolib.${name}`,
        );
      }
    });

    test("a route's query param hooks and its queryParamsDidChange action", function (assert) {
      register(this.owner, 'route:page', class extends Route {});

      const looked: unknown = this.owner.lookup('route:page');
      const route = looked as {
        serializeQueryParam?: Fn;
        deserializeQueryParam?: Fn;
        actions?: { queryParamsDidChange?: Fn };
      };

      assert.strictEqual(
        typeof route.serializeQueryParam,
        'function',
        'route.serializeQueryParam',
      );
      assert.strictEqual(
        typeof route.deserializeQueryParam,
        'function',
        'route.deserializeQueryParam',
      );
      assert.strictEqual(
        typeof route.actions?.queryParamsDidChange,
        'function',
        "Route's own queryParamsDidChange action (it gets the router's own values)",
      );
    });
  });

  // and that each of them is the one replaced: one that is skipped would
  // leave StoredValues where apps read values
  module('a router set up with it replaces', function (hooks) {
    let router: Internals;

    hooks.beforeEach(function () {
      register(
        this.owner,
        'router:main',
        risonRouter(function () {
          this.route('page');
        }),
      );
      router = routerMain<Internals>(this.owner);
      router.setupRouter();
    });

    test('its query param (de)serializers', function (assert) {
      assert.true(
        own(router, '_serializeQueryParam'),
        'router._serializeQueryParam',
      );
      assert.true(
        own(router, '_deserializeQueryParam'),
        'router._deserializeQueryParam',
      );
    });

    test("router_js's query string parser and writer", function (assert) {
      const recognizer = router._routerMicrolib!.recognizer!;

      assert.true(
        own(recognizer, 'parseQueryString'),
        'recognizer.parseQueryString',
      );
      assert.true(
        own(recognizer, 'generateQueryString'),
        'recognizer.generateQueryString',
      );
      assert.strictEqual(
        recognizer.generateQueryString!({ a: 1 }),
        '?qs=(a:1)',
      );
    });

    test('what hands out routes, RouteInfos and recognize', function (assert) {
      const microlib = router._routerMicrolib!;

      for (const name of [
        'getRoute',
        'toInfos',
        'fromInfos',
        'recognize',
        'recognizeAndLoad',
      ]) {
        assert.true(own(microlib, name), `router._routerMicrolib.${name}`);
      }
    });

    // Up to Ember 7.4 getRoute gives the route; from 7.5, which has route
    // managers, its manager and bucket, the route in bucket.route
    test("each route's query param hooks", function (assert) {
      register(this.owner, 'route:page', class extends Route {});

      const found = router._routerMicrolib!.getRoute!('page') as {
        manager?: object;
        bucket?: { route?: object };
      };
      const route = 'manager' in found ? found.bucket?.route : found;

      assert.ok(
        route instanceof Route,
        'getRoute gives the route, or { manager, bucket } with it in bucket.route',
      );
      assert.true(
        own(route!, 'serializeQueryParam'),
        'route.serializeQueryParam',
      );
      assert.true(
        own(route!, 'deserializeQueryParam'),
        'route.deserializeQueryParam',
      );
    });
  });
});
