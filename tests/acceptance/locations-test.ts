import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import { currentURL, settled, visit } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

import {
  generateRisonQs,
  locationFromRouteInfo,
  locationFromUrl,
  toRisonUrl,
  transitionArgs,
} from '#src/index.ts';

import { register, setupRisonApp, type RisonApp } from '../helpers/index.ts';

import type { RouteLocation } from '#src/index.ts';
import type RouterService from '@ember/routing/router-service';
import type Transition from '@ember/routing/transition';

// Routes as data, end to end: a link opened in a mobile app with plain
// params, one forwarded by a /fwd/*link route, and the route a signed-out
// visit was going to, kept as a location in `next` and gone back to after
// signing in.

let signedIn = false;

class ReportsShowController extends Controller {
  queryParams = ['print', 'filters', 'ids'];
  print = false;
  ids: unknown[] = [];
  filters: Record<string, unknown> | null = null;
}

class AuthRoute extends Route {
  @service declare router: RouterService;

  beforeModel(transition: Transition) {
    if (!signedIn) {
      // where it was going, in full, for after signing in
      const next = locationFromRouteInfo(transition.to!);

      this.router.transitionTo('login', { queryParams: { next } });
    }
  }
}

class LoginController extends Controller {
  @service declare router: RouterService;

  queryParams = ['next'];
  next: RouteLocation | null = null;

  signIn() {
    signedIn = true;

    return this.next
      ? this.router.transitionTo(...transitionArgs(this.next))
      : this.router.transitionTo('index');
  }
}

class ForwardRoute extends Route {
  @service declare router: RouterService;

  model({ link }: { link: string }, transition: Transition) {
    const query = new URLSearchParams(
      transition.to?.queryParams as Record<string, string>,
    ).toString();
    const location = locationFromUrl(
      this.router,
      `/${link}${query ? `?${query}` : ''}`,
    );

    if (location && location.name !== 'not-found') {
      this.router.replaceWith(...transitionArgs(location));
    }
  }
}

module('Acceptance | routes as data', function (hooks) {
  setupApplicationTest(hooks);

  let app: RisonApp;
  let router: RouterService;
  let report: () => ReportsShowController;

  hooks.beforeEach(function () {
    signedIn = true;
    app = setupRisonApp(this.owner, function () {
      this.route('login');
      this.route('fwd', { path: '/fwd/*link' });
      this.route('auth', { path: '/s/:subdomain' }, function () {
        this.route('reports', function () {
          this.route('show', { path: ':id' });
        });
      });
      this.route('not-found', { path: '/*wildcard' });
    });

    register(this.owner, 'route:auth', AuthRoute);
    register(
      this.owner,
      'route:auth.reports.show',
      class extends Route {
        model({ id }: { id: string }) {
          return { id };
        }
      },
    );
    register(this.owner, 'controller:auth.reports.show', ReportsShowController);
    register(this.owner, 'route:login', class extends Route {});
    register(this.owner, 'controller:login', LoginController);
    register(this.owner, 'route:fwd', ForwardRoute);
    register(this.owner, 'route:not-found', class extends Route {});

    router = this.owner.lookup('service:router');
    report = () =>
      this.owner.lookup(
        'controller:auth.reports.show',
      ) as ReportsShowController;
  });

  test('a mobile app link with plain params lands with them, read as rison', async function (assert) {
    const link = toRisonUrl('myapp://app/s/acme/reports/5?print=true');
    const location = locationFromUrl(router, link);

    assert.deepEqual(
      location && { ...location, queryParams: { ...location.queryParams } },
      {
        name: 'auth.reports.show',
        params: ['acme', '5'],
        queryParams: { print: 'true' },
      },
    );

    await visit('/login');
    await router.replaceWith(...transitionArgs(location!));

    assert.strictEqual(currentURL(), '/s/acme/reports/5?qs=(print:!t)');
    assert.true(report().print, "a plain 'true' for a boolean param");
  });

  test('a link of this app, opened from outside, lands whole', async function (assert) {
    const filters = { status: ['open', 'in review'], owner: "O'Brien" };
    const link = `https://app.example.com/s/acme/reports/5?qs=${generateRisonQs({ filters, print: true })}`;
    const location = locationFromUrl(router, link)!;

    await visit('/login');
    await router.transitionTo(...transitionArgs(location));

    assert.deepEqual(report().filters, filters);
    assert.true(report().print);
    assert.strictEqual(
      currentURL(),
      `/s/acme/reports/5?qs=${generateRisonQs({ filters, print: true })}`,
    );
  });

  test('a link to no route recognizes as the catch-all', async function (assert) {
    await visit('/login');

    assert.strictEqual(
      locationFromUrl(router, 'myapp://app/nope/nothing')?.name,
      'not-found',
    );
  });

  test('a /fwd/ link is replaced by the route it names', async function (assert) {
    await visit('/fwd/s/acme/reports/5?print=true');

    assert.strictEqual(currentURL(), '/s/acme/reports/5?qs=(print:!t)');
    assert.deepEqual(app.history.at(-1), [
      'replace',
      '/s/acme/reports/5?qs=(print:!t)',
    ]);
  });

  test('a signed-out visit goes to login, keeping where it was going', async function (assert) {
    signedIn = false;

    await visit(
      "/s/acme/reports/5?qs=(filters:(owner:'O!'Brien'),print:!t)",
    ).catch(() => settled());
    await settled();

    const login = this.owner.lookup('controller:login') as LoginController;

    assert.true(currentURL().startsWith('/login?qs=(next:'), currentURL());
    assert.deepEqual(login.next, {
      name: 'auth.reports.show',
      params: ['acme', '5'],
      queryParams: { filters: { owner: "O'Brien" }, print: true },
    });
  });

  test('and goes back there after signing in, params and all', async function (assert) {
    signedIn = false;

    await visit(
      "/s/acme/reports/5?qs=(filters:(owner:'O!'Brien'),print:!t)",
    ).catch(() => settled());
    await settled();

    // a reload of the login page, with `next` in its address
    await visit(currentURL());
    await (this.owner.lookup('controller:login') as LoginController).signIn();
    await settled();

    assert.strictEqual(
      currentURL(),
      "/s/acme/reports/5?qs=(filters:(owner:'O!'Brien'),print:!t)",
    );
    assert.deepEqual(report().filters, { owner: "O'Brien" });
    assert.true(report().print);
  });
});
