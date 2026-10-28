import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import { precompileTemplate } from '@ember/template-compilation';
import { currentURL, visit } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

import { generateRisonQs } from '#src/index.ts';

import { register, setupRisonApp, type RisonApp } from '../helpers/index.ts';

import type Transition from '@ember/routing/transition';

// The router reads the address of a page loaded fresh before it makes any
// route. Set up from setupRouter, routes and controllers get the params
// decoded on a fresh load as later on. A page opened while signed out keeps
// where it was going as `next`, a whole route inside `qs`: it must come
// through intact. (From the app this addon comes from, where each of these
// once failed.)

class PageController extends Controller {
  queryParams = ['identifier', 'print', 'search', 'next', 'query'];
  identifier: string | null = null;
  print = false;
  search = '';
  next: unknown = null;
  query: unknown = null;
}

module('Acceptance | a page loaded fresh', function (hooks) {
  setupApplicationTest(hooks);

  let app: RisonApp;
  let seen: Record<string, Record<string, unknown>>;
  let page: () => PageController;

  hooks.beforeEach(function () {
    seen = {};
    app = setupRisonApp(this.owner, function () {
      this.route('page');
      this.route('other');
    });
    register(
      this.owner,
      'route:page',
      class extends Route {
        beforeModel(transition: Transition) {
          seen.page = { ...transition.to?.queryParams };
        }
      },
    );
    register(this.owner, 'controller:page', PageController);
    register(
      this.owner,
      'template:page',
      precompileTemplate('page', { strictMode: true }),
    );
    register(this.owner, 'route:other', class extends Route {});
    register(
      this.owner,
      'template:other',
      precompileTemplate('other', { strictMode: true }),
    );

    page = () => this.owner.lookup('controller:page') as PageController;
  });

  test('the params in qs reach the controller', async function (assert) {
    await visit('/page?qs=(identifier:abc,print:!t)');

    assert.strictEqual(page().identifier, 'abc');
    assert.true(page().print);
    assert.strictEqual(currentURL(), '/page?qs=(identifier:abc,print:!t)');
  });

  test('the routes see the params decoded', async function (assert) {
    await visit('/page?qs=(identifier:abc,print:!t)');

    assert.deepEqual(
      app.seen[0],
      { identifier: 'abc', print: true },
      'the application route',
    );
    assert.deepEqual(seen.page, { identifier: 'abc', print: true });
  });

  test('where a signed-out visit was going comes through whole', async function (assert) {
    const next = {
      name: 'auth.reports.show',
      params: ['acme', '5'],
      queryParams: {
        qs: { print: true, search: "O'Brien (jr", no_auth_route: '' },
      },
    };

    await visit(`/page?qs=${generateRisonQs({ next })}`);

    assert.deepEqual(page().next, next);
  });

  // A search for "(O'Brien" on /reports, which failed in production
  test('the address that failed in production loads', async function (assert) {
    await visit('/page?qs=(query:(search:%27(O!%27Brien%27))');

    assert.deepEqual(app.seen[0], { query: { search: "(O'Brien" } });
    assert.deepEqual(page().query, { search: "(O'Brien" });
    assert.dom().hasText('page');
  });

  // Ember's own parser cut it at its second `=`: `(query:(search:faqs`
  test('a raw = in qs, as typed into the address', async function (assert) {
    await visit('/page?qs=(query:(search:faqs=1))');

    assert.deepEqual(page().query, { search: 'faqs=1' });
  });

  // as servers write an email into their links, without percent-encoding
  test('a raw + in qs stays a +', async function (assert) {
    await visit("/page?qs=(identifier:'a+b@x.com')");

    assert.strictEqual(page().identifier, 'a+b@x.com');
  });

  test('an address inside qs, as the app writes it, comes through whole', async function (assert) {
    const search = 'reports/5?qs=(print:!t)&tab=a=b';

    await visit(`/page?qs=${generateRisonQs({ search })}`);

    assert.strictEqual(page().search, search);
  });

  test('strings rison would trip on come through as they are', async function (assert) {
    const search = "it's (a) !test";

    await visit(`/page?qs=${generateRisonQs({ search, identifier: 'x y' })}`);

    assert.strictEqual(page().search, search);
    assert.strictEqual(page().identifier, 'x y');
  });

  // read for this transition only: no controller has `fbclid`, so Ember
  // leaves it out of the address it writes next
  test('params beside qs do not get in the way', async function (assert) {
    await visit('/page?qs=(identifier:abc)&fbclid=Ab_1');

    assert.strictEqual(page().identifier, 'abc');
    assert.strictEqual(seen.page?.fbclid, 'Ab_1');
  });

  // after boot too, where the v1 mixin read `identifier=abc` as one rison
  // string and lost it
  test('a plain param reaches the controller that has it', async function (assert) {
    await visit('/page?identifier=abc');

    assert.strictEqual(page().identifier, 'abc');

    await visit('/other');
    await visit('/page?identifier=def');

    assert.strictEqual(page().identifier, 'def');
  });

  test('plain params, as a sign-in provider sends back, are left alone', async function (assert) {
    await visit('/page?code=abc123&state=eyJuZXh0Ijp7fX0%3D');

    assert.deepEqual(seen.page, { code: 'abc123', state: 'eyJuZXh0Ijp7fX0=' });
  });

  test('a qs that is not rison is no params, not a failed page', async function (assert) {
    await visit('/page?qs=(identifier:abc');

    assert.dom().hasText('page');
    assert.deepEqual(app.seen[0], {});
    assert.strictEqual(page().identifier, null);
  });

  test('a later transition reads its qs too', async function (assert) {
    await visit('/other');
    await visit('/page?qs=(identifier:abc,print:!t)');

    assert.strictEqual(page().identifier, 'abc');
    assert.true(page().print);
  });
});
