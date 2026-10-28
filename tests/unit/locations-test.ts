import { module, test } from 'qunit';

import {
  locationFromRouteInfo,
  locationFromUrl,
  parseRisonQueryString,
  toRisonUrl,
  transitionArgs,
} from '#src/index.ts';

import type { RouteInfoLike } from '#src/index.ts';

// The query params of a link, as the router reads them
const paramsOf = (url: string) => parseRisonQueryString(new URL(url).search);

// A RouteInfo chain, root first: [name, params]...
function routeInfo(
  levels: [string, Record<string, string>][],
  queryParams: Record<string, unknown> = {},
): RouteInfoLike {
  let parent: RouteInfoLike | null = {
    name: 'application',
    params: {},
    paramNames: [],
    queryParams,
    parent: null,
  };

  for (const [name, params] of levels) {
    parent = {
      name,
      params,
      paramNames: Object.keys(params),
      queryParams,
      parent,
    };
  }

  return parent;
}

module('Unit | locations', function () {
  // A link opened in the app (or pasted from the clipboard) with plain
  // params gets them as one rison `qs`
  module('toRisonUrl', function () {
    test('plain params come through as they were', function (assert) {
      const url = toRisonUrl(
        'myapp://app/auth/reports?name=Jos%C3%A9+P%C3%A9rez&email=a%2Bb%40x.com&search=50%25&q=O%27Brien',
      );

      assert.deepEqual(paramsOf(url), {
        name: 'José Pérez',
        email: 'a+b@x.com',
        search: '50%',
        q: "O'Brien",
      });
    });

    test('keeps the scheme, host, path and hash', function (assert) {
      const url = toRisonUrl('myapp://app/auth/reports?projectId=5#section');

      assert.true(url.startsWith('myapp://app/auth/reports?qs='), url);
      assert.true(url.endsWith('#section'), url);
    });

    test('on an https link too', function (assert) {
      const url = toRisonUrl(
        'https://app.example.com/auth/reports?name=Jos%C3%A9+P%C3%A9rez&projectId=5',
      );

      assert.true(
        url.startsWith('https://app.example.com/auth/reports?qs='),
        url,
      );
      assert.deepEqual(paramsOf(url), { name: 'José Pérez', projectId: '5' });
    });

    test('plain params are read as Ember reads them', function (assert) {
      const url = toRisonUrl('https://x.com/a?embed&id[]=1&id[]=2&empty=');

      assert.deepEqual(paramsOf(url), {
        embed: 'true',
        id: ['1', '2'],
        empty: '',
      });
    });

    test('values are strings, as they were in the link', function (assert) {
      assert.deepEqual(paramsOf(toRisonUrl('https://x.com/a?n=5&b=true')), {
        n: '5',
        b: 'true',
      });
    });

    test('a link that already has a qs is left as it is', function (assert) {
      const link =
        "https://app.example.com/auth/reports?qs=(projectId:'5')&utm=x";

      // as URL writes it: `'` is %27 in an https query
      assert.strictEqual(toRisonUrl(link), new URL(link).toString());
    });

    test('a link without params is left as it is', function (assert) {
      assert.strictEqual(toRisonUrl('https://x.com/a'), 'https://x.com/a');
      assert.strictEqual(toRisonUrl('https://x.com/a?'), 'https://x.com/a?');
    });

    test('with another key', function (assert) {
      const url = toRisonUrl('https://x.com/a?b=1', {
        key: '_a',
      });

      assert.true(url.startsWith('https://x.com/a?_a='), url);
      assert.deepEqual(
        parseRisonQueryString(new URL(url).search, { key: '_a' }),
        { b: '1' },
      );
      assert.strictEqual(
        toRisonUrl('https://x.com/a?_a=(b:1)', { key: '_a' }),
        'https://x.com/a?_a=(b:1)',
      );
    });

    test('throws on what is not a URL', function (assert) {
      assert.throws(() => toRisonUrl('/relative?x=1'));
    });
  });

  module('locationFromRouteInfo', function () {
    test('the params of every level, root first', function (assert) {
      const info = routeInfo(
        [
          ['auth', { subdomain: 'acme' }],
          ['auth.reports', {}],
          ['auth.reports.show', { id: '5' }],
        ],
        { print: true },
      );

      assert.deepEqual(locationFromRouteInfo(info), {
        name: 'auth.reports.show',
        params: ['acme', '5'],
        queryParams: { print: true },
      });
    });

    test('a level with more than one param keeps their order', function (assert) {
      const info = routeInfo([
        [
          'permissions.edit',
          { role_id: '1', model_name: 'report', action_name: 'edit' },
        ],
      ]);

      assert.deepEqual(locationFromRouteInfo(info).params, [
        '1',
        'report',
        'edit',
      ]);
    });

    test('a route without params', function (assert) {
      assert.deepEqual(locationFromRouteInfo(routeInfo([['login', {}]])), {
        name: 'login',
        params: [],
        queryParams: {},
      });
    });

    test('its query params are a copy', function (assert) {
      const queryParams = { a: 1 };
      const location = locationFromRouteInfo(
        routeInfo([['login', {}]], queryParams),
      );

      location.queryParams.b = 2;

      assert.deepEqual(queryParams, { a: 1 });
    });

    test('takes missing params, paramNames and queryParams', function (assert) {
      const info = {
        name: 'x',
        parent: { name: 'application', parent: null },
      } as RouteInfoLike;

      assert.deepEqual(locationFromRouteInfo(info), {
        name: 'x',
        params: [],
        queryParams: {},
      });
    });
  });

  module('transitionArgs', function () {
    test('as transitionTo takes them', function (assert) {
      assert.deepEqual(
        transitionArgs({
          name: 'a.b',
          params: ['1', '2'],
          queryParams: { x: 1 },
        }),
        ['a.b', '1', '2', { queryParams: { x: 1 } }],
      );
    });
  });

  module('locationFromUrl', function () {
    const router = {
      urls: [] as string[],
      recognize(url: string) {
        this.urls.push(url);

        if (url.startsWith('/boom')) throw new Error('boom');
        if (url.startsWith('/nothing')) return null;

        return routeInfo([['reports.show', { id: '5' }]], { from: url });
      },
    };

    test('only the path and query string count, whatever the scheme', function (assert) {
      router.urls = [];
      locationFromUrl(router as never, 'myapp://app/reports/5?qs=(print:!t)#x');
      locationFromUrl(router as never, 'https://other.host/reports/5?a=1');
      locationFromUrl(router as never, '/reports/5');

      assert.deepEqual(router.urls, [
        '/reports/5?qs=(print:!t)',
        '/reports/5?a=1',
        '/reports/5',
      ]);
    });

    test('gives the route as transitionTo takes it', function (assert) {
      assert.deepEqual(locationFromUrl(router as never, '/reports/5'), {
        name: 'reports.show',
        params: ['5'],
        queryParams: { from: '/reports/5' },
      });
    });

    test('null when no route has it, or the router throws', function (assert) {
      assert.strictEqual(locationFromUrl(router as never, '/nothing'), null);
      assert.strictEqual(locationFromUrl(router as never, '/boom'), null);
    });
  });
});
