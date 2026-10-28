import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import { LinkTo } from '@ember/routing';
import { array, hash } from '@ember/helper';
import { precompileTemplate } from '@ember/template-compilation';
import { currentURL, settled, visit } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

import { generateRisonQs } from '#src/index.ts';

import { register, setupRisonApp, type RisonApp } from '../helpers/index.ts';

import type RouterService from '@ember/routing/router-service';
import type Transition from '@ember/routing/transition';

// A controller with a query param of every kind, at /page
class PageController extends Controller {
  // (Ember's types leave out `as`)
  queryParams = [
    'search',
    'page',
    'limit',
    'archived',
    'pinned',
    'ids',
    'filters',
    'next',
    { sort: { as: 's' } },
  ] as unknown as Controller['queryParams'];

  search = '';
  page = 1;
  limit: number | null = null;
  archived = false;
  pinned = true;
  ids: unknown[] = [];
  filters: Record<string, unknown> = { status: 'open' };
  next: unknown = null;
  sort = 'name';
}

class PageRoute extends Route {
  // what each transition into it read
  seen: { params: Record<string, unknown>; to: Record<string, unknown> }[] = [];
  models = 0;

  queryParams = {
    page: { refreshModel: true },
    filters: { refreshModel: true },
    sort: { replace: true },
  };

  model(params: Record<string, unknown>, transition: Transition) {
    this.models++;
    this.seen.push({
      params: { ...params },
      to: { ...(transition.to?.queryParams ?? {}) },
    });

    return params;
  }
}

class ChildController extends Controller {
  queryParams = ['tab'];
  tab = 'summary';
}

class ParentController extends Controller {
  queryParams = ['view'];
  view = 'list';
}

class ItemController extends Controller {
  queryParams = ['tab'];
  tab = 'details';
}

const json = (value: unknown) => JSON.stringify(value);

module('Acceptance | query params', function (hooks) {
  setupApplicationTest(hooks);

  let app: RisonApp;
  let router: RouterService;
  let page: () => PageController;
  let pageRoute: () => PageRoute;

  hooks.beforeEach(function () {
    app = setupRisonApp(this.owner, function () {
      this.route('page');
      this.route('other');
      this.route('parent', function () {
        this.route('child');
      });
      this.route('item', { path: '/items/:id' });
    });

    register(this.owner, 'route:page', PageRoute);
    register(this.owner, 'controller:page', PageController);
    register(
      this.owner,
      'template:page',
      precompileTemplate(
        `<LinkTo id="to-other" @route="other">other</LinkTo>
         <LinkTo id="with-query" @route="page" @query={{hash search="it's (a) !test" filters=(hash status="closed" tags=(array "a b" "c"))}}>query</LinkTo>
         <LinkTo id="to-item" @route="item" @model="5" @query={{hash tab="notes"}}>item</LinkTo>
         <LinkTo id="page-3" @route="page" @query={{hash page=3}}>page 3</LinkTo>
         <LinkTo id="closed" @route="page" @query={{hash filters=(hash status="closed")}}>closed</LinkTo>`,
        {
          strictMode: true,
          scope: () => ({ LinkTo, hash, array }),
        },
      ),
    );
    register(this.owner, 'route:other', class extends Route {});
    register(this.owner, 'route:parent', class extends Route {});
    register(this.owner, 'controller:parent', ParentController);
    register(this.owner, 'route:parent.child', class extends Route {});
    register(this.owner, 'controller:parent.child', ChildController);
    register(
      this.owner,
      'route:item',
      class extends Route {
        model({ id }: { id: string }) {
          return { id };
        }
      },
    );
    register(this.owner, 'controller:item', ItemController);

    page = () => this.owner.lookup('controller:page') as PageController;
    pageRoute = () => this.owner.lookup('route:page') as PageRoute;
    router = this.owner.lookup('service:router');
  });

  module('read from the address', function () {
    test('every kind of value reaches the controller as it was', async function (assert) {
      await visit(
        "/page?qs=(archived:!t,filters:(status:closed,tags:!('a b',c)),ids:!(1,2),limit:20,next:(name:other),page:3,pinned:!f,s:date,search:'O!'Brien (jr')",
      );

      const controller = page();

      assert.strictEqual(controller.search, "O'Brien (jr");
      assert.strictEqual(controller.page, 3);
      assert.strictEqual(
        controller.limit,
        20,
        'a number with no default to go by',
      );
      assert.true(controller.archived);
      assert.false(controller.pinned);
      assert.strictEqual(
        json(controller.ids),
        '[1,2]',
        'a list of numbers stays numbers',
      );
      assert.deepEqual(controller.filters, {
        status: 'closed',
        tags: ['a b', 'c'],
      });
      assert.deepEqual(controller.next, { name: 'other' });
      assert.strictEqual(controller.sort, 'date', 'read under its `as` name');
    });

    test('the address stays as it was visited', async function (assert) {
      const url = "/page?qs=(ids:!(1,2),page:3,search:'O!'Brien (jr')";

      await visit(url);

      assert.strictEqual(currentURL(), url);
    });

    test('without params, the defaults', async function (assert) {
      await visit('/page');

      const controller = page();

      assert.strictEqual(controller.search, '');
      assert.strictEqual(controller.page, 1);
      assert.strictEqual(controller.limit, null);
      assert.false(controller.archived);
      assert.deepEqual(controller.ids, []);
      assert.deepEqual(controller.filters, { status: 'open' });
      assert.strictEqual(currentURL(), '/page');
    });

    test('the model hook gets the params typed', async function (assert) {
      await visit('/page?qs=(filters:(status:closed),ids:!(1,2),page:3)');

      const { params } = pageRoute().seen[0]!;

      assert.strictEqual(params.page, 3);
      assert.strictEqual(json(params.ids), '[1,2]');
      assert.deepEqual(params.filters, { status: 'closed' });
    });

    test('transition.to.queryParams has them decoded', async function (assert) {
      await visit(
        "/page?qs=(archived:!t,filters:(status:closed),next:(name:other),search:'a b')",
      );

      const { to } = pageRoute().seen[0]!;

      assert.true(to.archived);
      assert.strictEqual(to.search, 'a b');
      assert.deepEqual(to.filters, { status: 'closed' });
      assert.deepEqual(to.next, { name: 'other' });
      assert.deepEqual(app.seen[0], to, 'as the application route saw them');
    });

    // Ember's router keeps numbers (and the items of lists) as strings or
    // boxes of its own: what apps read gets plain values
    test('transition.to.queryParams has numbers and lists as they are', async function (assert) {
      await visit('/page?qs=(filters:(n:1),ids:!(1,2),limit:20,page:3)');

      const { to } = pageRoute().seen[0]!;

      assert.strictEqual(to.page, 3);
      assert.strictEqual(to.limit, 20);
      assert.strictEqual(json(to.ids), '[1,2]');
      assert.deepEqual(to.filters, { n: 1 });
    });

    test('so do transition.from and the routeWillChange/routeDidChange transitions', async function (assert) {
      const seen: Record<string, unknown>[] = [];

      // (a router service transition carries every param, defaults too)
      const pick = (queryParams: Record<string, unknown> | undefined) => ({
        ids: queryParams?.ids,
        page: queryParams?.page,
      });

      router.on('routeWillChange', (transition) => {
        seen.push({ will: pick(transition.to?.queryParams) });
      });
      router.on('routeDidChange', (transition) => {
        seen.push({
          did: pick(transition.to?.queryParams),
          from: pick(transition.from?.queryParams),
        });
      });

      await visit('/page?qs=(ids:!(1,2),page:3)');
      await router.transitionTo({ queryParams: { page: 4 } });

      assert.strictEqual(
        json(seen.at(-1)),
        json({
          did: { ids: [1, 2], page: 4 },
          from: { ids: [1, 2], page: 3 },
        }),
      );
      assert.strictEqual(
        json(seen.at(-2)),
        json({ will: { ids: [1, 2], page: 4 } }),
      );
    });

    test('a redirect while transitioning gets them plain too', async function (assert) {
      let redirected: Record<string, unknown> = {};

      register(
        this.owner,
        'route:other',
        class extends Route {
          beforeModel(transition: Transition) {
            redirected = { ...transition.to?.queryParams };
          }
        },
      );
      register(
        this.owner,
        'route:item',
        class extends Route {
          beforeModel() {
            return router.transitionTo('other', {
              queryParams: { page: 2, ids: [1] },
            });
          }
        },
      );

      await visit('/items/1').catch(() => settled());
      await settled();

      assert.strictEqual(redirected.page, 2);
      assert.strictEqual(json(redirected.ids), '[1]');
    });

    test('changing what was read changes nothing in the router', async function (assert) {
      await visit('/page?qs=(filters:(status:closed),ids:!(1,2),page:3)');

      const { to } = pageRoute().seen[0]!;

      (to.ids as number[]).push(99);
      (to.filters as Record<string, unknown>).status = 'changed';
      to.page = 1000;

      await router.transitionTo({ queryParams: { search: 'x' } });

      assert.strictEqual(
        currentURL(),
        '/page?qs=(filters:(status:closed),ids:!(1,2),page:3,search:x)',
      );
      assert.strictEqual(json(page().ids), '[1,2]');
    });

    test('strings that look like other values stay strings', async function (assert) {
      for (const search of [
        '!t',
        '(abc',
        "it's",
        '5',
        'true',
        '!important',
        'wow!',
        '50%',
        'a+b',
        'faqs=1',
        '',
      ]) {
        await visit(`/page?qs=${generateRisonQs({ search })}`);

        assert.strictEqual(page().search, search, json(search));
      }
    });

    test('plain params are read as Ember reads them, typed by their default', async function (assert) {
      await visit(
        '/page?page=2&archived=true&pinned=false&search=hello+world&s=date',
      );

      const controller = page();

      assert.strictEqual(controller.page, 2);
      assert.true(controller.archived);
      assert.false(controller.pinned);
      assert.strictEqual(controller.search, 'hello world');
      assert.strictEqual(controller.sort, 'date');
    });

    test('plain params beside qs: qs wins', async function (assert) {
      await visit('/page?qs=(page:2)&page=9&search=x');

      assert.strictEqual(page().page, 2);
      assert.strictEqual(page().search, 'x');
    });

    test('a qs that is not rison is no params, not a failed page', async function (assert) {
      await visit('/page?qs=(page:2');

      assert.strictEqual(page().page, 1);
      assert.dom('#to-other').exists();
    });

    test('a dynamic segment and its query params', async function (assert) {
      await visit('/items/5?qs=(tab:notes)');

      const item = this.owner.lookup('controller:item') as ItemController;

      assert.strictEqual(item.tab, 'notes');
      assert.deepEqual(item.model, { id: '5' });
    });

    test('a parent and a child: both in one qs', async function (assert) {
      await visit('/parent/child?qs=(tab:history,view:grid)');

      assert.strictEqual(
        (this.owner.lookup('controller:parent') as ParentController).view,
        'grid',
      );
      assert.strictEqual(
        (this.owner.lookup('controller:parent.child') as ChildController).tab,
        'history',
      );
    });

    test('the router service reads them too', async function (assert) {
      await visit(
        '/page?qs=(archived:!t,filters:(status:closed),ids:!(1,2),page:3)',
      );

      const current = router.currentRoute?.queryParams ?? {};

      assert.true(current.archived);
      assert.deepEqual(current.filters, { status: 'closed' });
      assert.strictEqual(current.page, 3);
      assert.strictEqual(json(current.ids), '[1,2]');

      const recognized = router.recognize(
        '/items/7?qs=(n:5,tab:notes,xs:!(1))',
      );

      assert.strictEqual(recognized?.name, 'item');
      assert.strictEqual(
        json(recognized?.queryParams),
        json({ n: 5, tab: 'notes', xs: [1] }),
      );
    });

    test('recognizeAndLoad too', async function (assert) {
      await visit('/page');

      const loaded = await router.recognizeAndLoad('/items/7?qs=(n:5,xs:!(1))');

      assert.strictEqual(json(loaded.queryParams), json({ n: 5, xs: [1] }));
    });
  });

  module('written to the address', function () {
    test('transitionTo writes typed values', async function (assert) {
      await visit('/page');
      await router.transitionTo({
        queryParams: { page: 2, ids: [1, 2], archived: true },
      });

      assert.strictEqual(
        currentURL(),
        '/page?qs=(archived:!t,ids:!(1,2),page:2)',
      );
      assert.strictEqual(page().page, 2);
      assert.strictEqual(json(page().ids), '[1,2]');
    });

    test('the values handed to transitionTo are left as they were', async function (assert) {
      const ids = [1, 2];
      const filters = { status: 'closed', ids: [3] };

      await visit('/page');
      await router.transitionTo({ queryParams: { ids, filters } });

      assert.strictEqual(json(ids), '[1,2]');
      assert.strictEqual(json(filters), '{"status":"closed","ids":[3]}');
    });

    test('setting a controller property updates the address', async function (assert) {
      await visit('/page');

      page().set('page', 4);
      await settled();
      assert.strictEqual(currentURL(), '/page?qs=(page:4)');

      page().set('filters', { status: 'closed', tags: ['x y'] });
      await settled();
      assert.strictEqual(
        currentURL(),
        "/page?qs=(filters:(status:closed,tags:!('x%20y')),page:4)",
      );

      page().set('ids', [7]);
      await settled();
      assert.strictEqual(
        currentURL(),
        "/page?qs=(filters:(status:closed,tags:!('x%20y')),ids:!(7),page:4)",
      );
      assert.strictEqual(json(page().ids), '[7]');
    });

    test('a value back at its default leaves the address', async function (assert) {
      await visit('/page?qs=(archived:!t,page:3)');

      page().set('page', 1);
      await settled();
      assert.strictEqual(currentURL(), '/page?qs=(archived:!t)');

      page().set('archived', false);
      await settled();
      assert.strictEqual(currentURL(), '/page');
    });

    test('an object equal to its default leaves the address', async function (assert) {
      await visit('/page?qs=(filters:(status:closed))');

      page().set('filters', { status: 'open' });
      await settled();

      assert.strictEqual(currentURL(), '/page');
    });

    test('false and 0 are written when they are not the default', async function (assert) {
      await visit('/page');
      await router.transitionTo({ queryParams: { page: 0, pinned: false } });

      assert.strictEqual(currentURL(), '/page?qs=(page:0,pinned:!f)');
      assert.strictEqual(page().page, 0);
      assert.false(page().pinned);
    });

    test('blank values are left out', async function (assert) {
      await visit('/page?qs=(limit:20,search:abc)');
      await router.transitionTo({ queryParams: { search: '  ', limit: null } });

      assert.strictEqual(currentURL(), '/page');
    });

    test('a number with no default to go by stays a number', async function (assert) {
      await visit('/page');
      await router.transitionTo({ queryParams: { limit: 50 } });

      assert.strictEqual(currentURL(), '/page?qs=(limit:50)');
      assert.strictEqual(page().limit, 50);
    });

    test('the `as` name is what the address has', async function (assert) {
      await visit('/page');

      page().set('sort', 'date');
      await settled();

      assert.strictEqual(currentURL(), '/page?qs=(s:date)');
    });

    test('a parent and a child write one qs', async function (assert) {
      await visit('/parent/child');
      await router.transitionTo('parent.child', {
        queryParams: { tab: 'history', view: 'grid' },
      });

      assert.strictEqual(
        currentURL(),
        '/parent/child?qs=(tab:history,view:grid)',
      );
    });

    test('urlFor writes rison', async function (assert) {
      await visit('/page');

      assert.strictEqual(
        router.urlFor('page', { queryParams: { search: "O'Brien", ids: [1] } }),
        "/page?qs=(ids:!(1),search:'O!'Brien')",
      );
      assert.strictEqual(
        router.urlFor('item', '9', { queryParams: { tab: 'notes' } }),
        '/items/9?qs=(tab:notes)',
      );
      assert.strictEqual(router.urlFor('page'), '/page');
    });

    test('<LinkTo> writes rison', async function (assert) {
      await visit('/page');

      assert
        .dom('#with-query')
        .hasAttribute(
          'href',
          "/page?qs=(filters:(status:closed,tags:!('a%20b',c)),search:'it!'s%20(a)%20!!test')",
        );
      assert.dom('#to-item').hasAttribute('href', '/items/5?qs=(tab:notes)');
    });

    test('following a <LinkTo> lands on its params', async function (assert) {
      await visit('/page');
      await (await import('@ember/test-helpers')).click('#with-query');

      assert.strictEqual(page().search, "it's (a) !test");
      assert.deepEqual(page().filters, {
        status: 'closed',
        tags: ['a b', 'c'],
      });
    });

    test('an address the app wrote reads back the same', async function (assert) {
      const queryParams = {
        search: "it's (a) !test & more=1 + 50%",
        page: 0,
        limit: 1.5,
        archived: true,
        pinned: false,
        ids: [1, 'two', null, true, { deep: ['x'] }],
        filters: { '01': 'zero one', 'a b': { c: [] }, '': 'empty key' },
        next: {
          name: 'item',
          params: ['5'],
          queryParams: { qs: { tab: 'notes' } },
        },
      };

      await visit('/page');

      const url = router.urlFor('page', { queryParams });

      await visit('/other');
      await visit(url);

      const controller = page();

      for (const [key, value] of Object.entries(queryParams)) {
        assert.deepEqual(controller[key as keyof PageController], value, key);
      }
    });
  });

  // Ember serializes again the values it has kept to compare them: the
  // values must come back the same, compared by value
  module('active', function () {
    test('router.isActive with query params', async function (assert) {
      await visit('/page?qs=(filters:(status:closed),page:3)');

      assert.true(router.isActive('page', { queryParams: { page: 3 } }));
      assert.false(router.isActive('page', { queryParams: { page: 4 } }));
      assert.true(
        router.isActive('page', {
          queryParams: { filters: { status: 'closed' } },
        }),
        'an equal object',
      );
      assert.false(
        router.isActive('page', {
          queryParams: { filters: { status: 'open' } },
        }),
      );
      assert.true(
        router.isActive('page', {
          queryParams: { page: 3, filters: { status: 'closed' } },
        }),
      );
    });

    test('<LinkTo> is active for the query params it has', async function (assert) {
      await visit('/page?qs=(filters:(status:closed),page:3)');

      assert.dom('#page-3').hasClass('active');
      assert.dom('#closed').hasClass('active', 'an equal object');

      // (rendered again: Ember's <LinkTo> keeps its active class through a
      // query params only transition, see ember-parity-test)
      await visit('/other');
      await visit('/page?qs=(filters:(status:open),page:4)');

      assert.dom('#page-3').doesNotHaveClass('active');
      assert.dom('#closed').doesNotHaveClass('active');
    });
  });

  // and see ember-parity-test, for what Ember itself decides
  module('pushed or replaced', function () {
    test('a query param change is pushed', async function (assert) {
      await visit('/page');

      page().set('page', 2);
      await settled();

      assert.deepEqual(app.history.at(-1), ['push', '/page?qs=(page:2)']);
    });

    test('a change to a replace: true param is replaced', async function (assert) {
      await visit('/page');

      page().set('sort', 'date');
      await settled();

      assert.deepEqual(app.history.at(-1), ['replace', '/page?qs=(s:date)']);
    });

    test('replaceWith replaces', async function (assert) {
      await visit('/page');
      await router.replaceWith({ queryParams: { page: 5 } });

      assert.deepEqual(app.history.at(-1), ['replace', '/page?qs=(page:5)']);
    });

    test('transitionTo pushes', async function (assert) {
      await visit('/page');
      await router.transitionTo('item', '3', { queryParams: { tab: 'notes' } });

      assert.deepEqual(app.history.at(-1), ['push', '/items/3?qs=(tab:notes)']);
    });

    test('setting a value equal to the current one writes nothing', async function (assert) {
      await visit('/page?qs=(filters:(status:closed))');

      const before = app.history.length;

      page().set('filters', { status: 'closed' });
      await settled();

      assert.strictEqual(app.history.length, before);
      assert.strictEqual(currentURL(), '/page?qs=(filters:(status:closed))');
    });
  });

  module('refreshModel', function () {
    test('a change runs the model hook again, with the new params', async function (assert) {
      await visit('/page');
      await router.transitionTo({ queryParams: { page: 2 } });

      assert.strictEqual(pageRoute().models, 2);
      assert.strictEqual(pageRoute().seen.at(-1)?.params.page, 2);
    });

    test('an equal object does not', async function (assert) {
      await visit('/page?qs=(filters:(status:closed))');

      page().set('filters', { status: 'closed' });
      await settled();

      assert.strictEqual(pageRoute().models, 1);
    });

    test('a different object does', async function (assert) {
      await visit('/page?qs=(filters:(status:closed))');

      page().set('filters', { status: 'closed', mine: true });
      await settled();

      assert.strictEqual(pageRoute().models, 2);
      assert.deepEqual(pageRoute().seen.at(-1)?.params.filters, {
        mine: true,
        status: 'closed',
      });
    });
  });

  module('sticky', function () {
    test('leaving and coming back keeps the values, typed', async function (assert) {
      await visit('/page?qs=(ids:!(1,2),page:3)');
      await visit('/other');

      assert.dom('#to-other').doesNotExist();

      // Ember aborts the first transition back to bring the sticky params
      // along (see ember-parity-test)
      await router.transitionTo('page').catch(() => settled());
      await settled();

      assert.strictEqual(currentURL(), '/page?qs=(ids:!(1,2),page:3)');
      assert.strictEqual(json(page().ids), '[1,2]');
    });
  });
});

module('Acceptance | query params | another key', function (hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(function () {
    setupRisonApp(
      this.owner,
      function () {
        this.route('page');
      },
      { key: '_a' },
    );
    register(this.owner, 'route:page', class extends Route {});
    register(
      this.owner,
      'controller:page',
      class extends Controller {
        queryParams = ['query'];
        query: unknown = null;
      },
    );
  });

  test('reads and writes its own key', async function (assert) {
    await visit("/page?_a=(query:(term:'a b'))");

    const page = this.owner.lookup('controller:page') as unknown as {
      query: unknown;
    };

    assert.deepEqual(page.query, { term: 'a b' });

    const router = this.owner.lookup('service:router');

    await router.transitionTo({ queryParams: { query: { term: 'c' } } });

    assert.strictEqual(currentURL(), '/page?_a=(query:(term:c))');
  });

  test('a qs param is a plain param then', async function (assert) {
    const router = this.owner.lookup('service:router');
    let seen: Record<string, unknown> = {};

    router.on('routeWillChange', (transition: Transition) => {
      seen = { ...transition.to?.queryParams };
    });

    await visit('/page?qs=(query:x)');

    assert.strictEqual(
      (this.owner.lookup('controller:page') as unknown as { query: unknown })
        .query,
      null,
    );
    assert.deepEqual(seen, { qs: '(query:x)' });
  });
});
