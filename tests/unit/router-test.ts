import EmberRouter from '@ember/routing/router';
import Route from '@ember/routing/route';
import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

import { useRisonQueryParams } from '#src/index.ts';
import { readValue, storeValue, StoredValue } from '#src/router.ts';

import {
  RecordingLocation,
  register,
  risonRouter,
  routerMain,
} from '../helpers/index.ts';

interface PrivateRouter {
  setupRouter(): boolean;
  _routerMicrolib: {
    recognizer: {
      recognize(
        url: string,
      ): { queryParams: Record<string, unknown> } | undefined;
      parseQueryString(qs: string): Record<string, unknown>;
      generateQueryString(params: Record<string, unknown>): string;
    };
  };
  _serializeQueryParam(value: unknown, type: string): unknown;
  _deserializeQueryParam(value: unknown, type: string): unknown;
}

const readAll = (queryParams: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(queryParams).map(([key, value]) => [key, readValue(value)]),
  );

class PlainRouter extends EmberRouter {
  location = 'none';
  rootURL = '/';
}

PlainRouter.map(function () {
  this.route('login');
});

module('Unit | router', function (hooks) {
  setupTest(hooks);

  // The router reads the address of a page loaded fresh before any route
  // exists: set up from setupRouter, routes get the params decoded from the
  // start
  module('a router set up with it', function (hooks) {
    let router: PrivateRouter;
    let recognizer: PrivateRouter['_routerMicrolib']['recognizer'];
    let recognize: (url: string) => Record<string, unknown> | undefined;

    hooks.beforeEach(function () {
      register(this.owner, 'location:recording', RecordingLocation);
      register(
        this.owner,
        'router:main',
        risonRouter(function () {
          this.route('login');
        }),
      );

      router = routerMain<PrivateRouter>(this.owner);
      router.setupRouter();
      recognizer = router._routerMicrolib.recognizer;
      // (the private recognizer: the router's own values, read back)
      recognize = (url: string) => {
        const queryParams = recognizer.recognize(url)?.queryParams;

        return queryParams && readAll(queryParams);
      };
    });

    test('hands over qs decoded, whole', function (assert) {
      assert.deepEqual(
        recognize(
          "/login?qs=(query:(search:faqs=1),identifier:'a+b@x.com')&x=a+b",
        ),
        {
          query: { search: 'faqs=1' },
          identifier: 'a+b@x.com',
          x: 'a b',
        },
      );
    });

    test('drops a qs that is not rison', function (assert) {
      assert.deepEqual(recognize('/login?qs=(confirmation_token:abc&x=1'), {
        x: '1',
      });
      assert.deepEqual(recognize('/login?qs=(a:1'), {});
    });

    test('reads plain params as Ember did', function (assert) {
      const read = recognize(
        '/login?code=abc&state=eyJ9%3D&embed&id[]=1&id[]=2',
      )!;

      assert.deepEqual(read, {
        code: 'abc',
        state: 'eyJ9=',
        embed: 'true',
        id: ['1', '2'],
      });
    });

    test('the query string it generates reads back the same', function (assert) {
      const params = {
        search: "O'Brien (jr",
        filters: { status: ['open now'] },
      };
      const queryString = recognizer.generateQueryString(params);

      assert.true(queryString.startsWith('?qs='));
      assert.deepEqual(
        readAll(recognizer.parseQueryString(queryString.slice(1))),
        params,
      );
    });

    test('a value is not decoded a second time', function (assert) {
      for (const value of ['(abc', '!t', '!important', "'quoted'", '5']) {
        assert.strictEqual(
          router._deserializeQueryParam(value, 'string'),
          value,
        );
      }
    });

    test('a string for a number or boolean param is read as Ember would', function (assert) {
      const read = (value: unknown, type: string) =>
        router._deserializeQueryParam(value, type);

      assert.strictEqual(read('2', 'number'), 2);
      assert.strictEqual(read('-1.5', 'number'), -1.5);
      assert.strictEqual(
        read('abc', 'number'),
        'abc',
        'not a number: left as it is',
      );
      assert.strictEqual(read('', 'number'), '');
      assert.true(read('true', 'boolean'));
      assert.false(read('false', 'boolean'));
      assert.strictEqual(read('yes', 'boolean'), 'yes');
      assert.strictEqual(read(null, 'number'), null);
      assert.strictEqual(read(undefined, 'boolean'), undefined);
    });

    test('a value written and read back is the same, but a copy', function (assert) {
      const filters = { status: 'open', ids: [1, 2] };
      const kept = router._serializeQueryParam(filters, 'object');
      const read = router._deserializeQueryParam(kept, 'object');

      assert.notStrictEqual(kept, filters, 'the router keeps its own');
      assert.deepEqual(read, filters);
      assert.notStrictEqual(read, kept, 'a controller gets its own');
    });
  });

  module('useRisonQueryParams', function () {
    test('needs a router that is set up', function (assert) {
      const router = new PlainRouter(this.owner);

      assert.throws(() => useRisonQueryParams(router), /setupRouter/);
    });

    // A new Ember can rename what this replaces: it says what, instead of
    // skipping it and handing apps StoredValues where they read values
    module('on an Ember that lacks what it replaces', function (hooks) {
      let router: PrivateRouter;
      let microlib: Record<string, unknown>;

      hooks.beforeEach(function () {
        register(this.owner, 'router:main', PlainRouter);
        router = routerMain<PrivateRouter>(this.owner);
        router.setupRouter();
        microlib = router._routerMicrolib;
      });

      const MISSING: [
        string,
        (r: PrivateRouter, m: Record<string, unknown>) => void,
      ][] = [
        [
          'router._serializeQueryParam',
          (r) => Object.assign(r, { _serializeQueryParam: undefined }),
        ],
        [
          'router._deserializeQueryParam',
          (r) => Object.assign(r, { _deserializeQueryParam: undefined }),
        ],
        [
          'router._routerMicrolib.recognizer.parseQueryString',
          (r) =>
            Object.assign(r._routerMicrolib.recognizer, {
              parseQueryString: undefined,
            }),
        ],
        [
          'router._routerMicrolib.recognizer.generateQueryString',
          (r) =>
            Object.assign(r._routerMicrolib.recognizer, {
              generateQueryString: undefined,
            }),
        ],
        [
          'router._routerMicrolib.getRoute',
          (_r, m) => Object.assign(m, { getRoute: undefined }),
        ],
        [
          'router._routerMicrolib.toInfos',
          (_r, m) => Object.assign(m, { toInfos: undefined }),
        ],
        [
          'router._routerMicrolib.fromInfos',
          (_r, m) => Object.assign(m, { fromInfos: undefined }),
        ],
        [
          'router._routerMicrolib.recognize',
          (_r, m) => Object.assign(m, { recognize: undefined }),
        ],
        [
          'router._routerMicrolib.recognizeAndLoad',
          (_r, m) => Object.assign(m, { recognizeAndLoad: undefined }),
        ],
      ];

      for (const [name, remove] of MISSING) {
        test(`without ${name}, it fails naming it`, function (assert) {
          remove(router, microlib);

          assert.throws(
            () => useRisonQueryParams(router as unknown as EmberRouter),
            (error: Error) =>
              error.message.includes(`no ${name}.`) &&
              error.message.includes(
                'https://github.com/betocantu93/ember-rison-qs/issues',
              ),
          );
        });
      }

      test('it names all that is missing, at once', function (assert) {
        Object.assign(microlib, { toInfos: undefined, recognize: undefined });

        assert.throws(
          () => useRisonQueryParams(router as unknown as EmberRouter),
          /no router\._routerMicrolib\.toInfos, router\._routerMicrolib\.recognize\./,
        );
      });

      test('it replaces nothing when it fails', function (assert) {
        const { recognizer } = router._routerMicrolib;
        const before = {
          parse: recognizer.parseQueryString,
          generate: recognizer.generateQueryString,
          serialize: router._serializeQueryParam,
          toInfos: microlib.toInfos,
        };

        Object.assign(microlib, { recognizeAndLoad: undefined });

        assert.throws(() =>
          useRisonQueryParams(router as unknown as EmberRouter),
        );
        assert.strictEqual(recognizer.parseQueryString, before.parse);
        assert.strictEqual(recognizer.generateQueryString, before.generate);
        assert.strictEqual(router._serializeQueryParam, before.serialize);
        assert.strictEqual(microlib.toInfos, before.toInfos);
        assert.strictEqual(recognizer.generateQueryString({ a: 1 }), '?a=1');
      });

      test('a route without its query param hooks fails naming them', function (assert) {
        register(
          this.owner,
          'route:login',
          class extends Route {
            // as on an Ember that renamed them
            serializeQueryParam = undefined as never;
            deserializeQueryParam = undefined as never;
          },
        );
        useRisonQueryParams(router as unknown as EmberRouter);

        const getRoute = microlib.getRoute as (name: string) => unknown;

        assert.throws(
          () => getRoute.call(microlib, 'login'),
          /no route\.serializeQueryParam, route\.deserializeQueryParam\./,
        );
      });
    });

    test('set up twice, it reads and writes the same', function (assert) {
      register(this.owner, 'router:main', PlainRouter);

      const router = routerMain<PrivateRouter>(this.owner);

      router.setupRouter();
      useRisonQueryParams(router as unknown as EmberRouter);
      useRisonQueryParams(router as unknown as EmberRouter);

      const { recognizer } = router._routerMicrolib;

      assert.strictEqual(recognizer.generateQueryString({ a: 1 }), '?qs=(a:1)');
      assert.deepEqual(recognizer.parseQueryString('qs=(a:1)'), {
        a: storeValue(1),
      });
      assert.deepEqual(
        router._deserializeQueryParam(
          router._serializeQueryParam([1, 'x'], 'array'),
          'array',
        ),
        [1, 'x'],
      );
    });

    test('with another key', function (assert) {
      register(this.owner, 'router:main', PlainRouter);

      const router = routerMain<PrivateRouter>(this.owner);

      router.setupRouter();
      useRisonQueryParams(router as unknown as EmberRouter, { key: '_g' });

      const { recognizer } = router._routerMicrolib;

      assert.strictEqual(recognizer.generateQueryString({ a: 1 }), '?_g=(a:1)');
      assert.deepEqual(recognizer.parseQueryString('_g=(a:1)&qs=(b:2)'), {
        a: storeValue(1),
        qs: storeValue('(b:2)'),
      });
    });
  });

  // Ember compares the values it keeps with ===, router_js turns numbers
  // and the items of lists into strings in place, and Ember serializes again
  // values it has kept already: see src/router.ts
  module('the values the router keeps', function () {
    test('equal values are the same value', function (assert) {
      assert.strictEqual(
        storeValue({ a: 1, b: [2] }),
        storeValue({ b: [2], a: 1 }),
      );
      assert.strictEqual(storeValue([1, 'x']), storeValue([1, 'x']));
      assert.strictEqual(storeValue(5), storeValue(5));
      assert.strictEqual(storeValue('x y'), storeValue('x y'));
      assert.strictEqual(storeValue(true), storeValue(true));
      assert.notStrictEqual(storeValue({ a: 1 }), storeValue({ a: 2 }));
      assert.notStrictEqual(
        storeValue(5),
        storeValue('5'),
        'a number is not its string',
      );
    });

    test('each is kept as its rison', function (assert) {
      assert.true(storeValue(5) instanceof StoredValue);
      assert.strictEqual(
        (storeValue({ b: [1, 'x y'], a: true }) as StoredValue).rison,
        "(a:!t,b:!(1,'x y'))",
      );
      assert.strictEqual((storeValue("it's") as StoredValue).rison, "'it!'s'");
    });

    test('storing a value it keeps gives it back as it is', function (assert) {
      // as Ember does again with the values it has (router.isActive)
      const kept = storeValue({ a: 1 });

      assert.strictEqual(storeValue(kept), kept);
      assert.strictEqual(
        storeValue(storeValue(storeValue('x'))),
        storeValue('x'),
      );
    });

    test('null and undefined are as they are', function (assert) {
      assert.strictEqual(storeValue(null), null);
      assert.strictEqual(storeValue(undefined), undefined);
      assert.strictEqual(readValue(null), null);
      assert.strictEqual(readValue(undefined), undefined);
    });

    test('what rison cannot encode is left to the router', function (assert) {
      const fn = () => {};
      const symbol = Symbol('x');

      assert.strictEqual(storeValue(fn), fn);
      assert.strictEqual(storeValue(symbol), symbol);
    });

    test('router_js leaves what it keeps alone', function (assert) {
      const state: Record<string, unknown> = {
        page: storeValue(5),
        ids: storeValue([1, true, { a: 1 }]),
      };
      const before = { ...state };

      // as router_js does (coerceQueryParamsToString)
      for (const key in state) {
        const value = state[key];

        if (typeof value === 'number') state[key] = `${value}`;
        else if (Array.isArray(value))
          for (let i = 0; i < value.length; i++)
            value[i] = `${value[i] as string}`;
      }

      assert.strictEqual(state.page, before.page);
      assert.strictEqual(readValue(state.page), 5);
      assert.deepEqual(readValue(state.ids), [1, true, { a: 1 }]);
    });

    test('the value handed in is not the one kept', function (assert) {
      const ids = [1, 2];

      storeValue(ids);
      ids.push(3);

      assert.deepEqual(readValue(storeValue([1, 2])), [1, 2]);
    });

    test('each read is a copy of its own', function (assert) {
      const kept = storeValue({ a: { b: 1 } });
      const one = readValue(kept) as { a: { b: number } };
      const two = readValue(kept) as { a: { b: number } };

      one.a.b = 2;

      assert.strictEqual(two.a.b, 1);
      assert.notStrictEqual(one, two);
    });

    test('a value it does not keep reads as it is', function (assert) {
      const mine = { a: 1, b: [2], c: new Date(0) };

      assert.strictEqual(readValue(mine), mine);
      assert.strictEqual(
        readValue('(a:1)'),
        '(a:1)',
        'a string is not decoded',
      );
    });

    test('a value is kept while anything holds it', function (assert) {
      const held = storeValue({ held: true });

      // other values come and go
      for (let i = 0; i < 2000; i++) storeValue({ i });

      assert.strictEqual(storeValue({ held: true }), held);
    });
  });
});
