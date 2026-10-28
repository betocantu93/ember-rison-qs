import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import EmberRouter from '@ember/routing/router';
import NoneLocation from '@ember/routing/none-location';
import { precompileTemplate } from '@ember/template-compilation';

import { useRisonQueryParams } from '#src/index.ts';

import type { UseRisonQueryParamsOptions } from '#src/index.ts';
import type Owner from '@ember/owner';
import type Transition from '@ember/routing/transition';

type RouterMap = Parameters<typeof EmberRouter.map>[0];

/** Every address the router wrote, and how: pushed or replaced. */
export class RecordingLocation extends NoneLocation {
  history: Array<['push' | 'replace', string]> = [];

  setURL(path: string) {
    this.history.push(['push', path]);
    super.setURL(path);
  }

  replaceURL(path: string) {
    this.history.push(['replace', path]);
    // NoneLocation has no replaceURL of its own
    super.setURL(path);
  }
}

/**
 * A router set up as the README says, on a map of its own, writing to a
 * RecordingLocation.
 */
export function risonRouter(
  map: RouterMap,
  options?: UseRisonQueryParamsOptions,
) {
  class TestRouter extends EmberRouter {
    location = 'recording';
    rootURL = '/';

    setupRouter() {
      const didSetUp = super.setupRouter();

      if (didSetUp) {
        useRisonQueryParams(this, options);
      }

      return didSetUp;
    }
  }

  TestRouter.map(map);

  return TestRouter;
}

/** The router itself (`router:main`), as the test needs to see it. */
export function routerMain<T = { location: RecordingLocation }>(
  owner: Owner,
): T {
  const router: unknown = owner.lookup('router:main');

  return router as T;
}

/** Registers, replacing whatever was there. */
export function register(owner: Owner, name: string, factory: unknown) {
  // a test's owner can unregister, the public Owner type doesn't say so
  (owner as Owner & { unregister(name: string): void }).unregister(name);
  owner.register(name as never, factory as never);
}

/**
 * The app around the routes of a test: its router, the recording location,
 * an application route that keeps what each transition read off its
 * `transition.to.queryParams`.
 */
export function setupRisonApp(
  owner: Owner,
  map: RouterMap,
  options?: UseRisonQueryParamsOptions,
) {
  const seen: Record<string, unknown>[] = [];

  register(owner, 'router:main', risonRouter(map, options));
  register(owner, 'location:recording', RecordingLocation);
  register(
    owner,
    'route:application',
    class extends Route {
      beforeModel(transition: Transition) {
        seen.push({ ...transition.to?.queryParams });
      }
    },
  );
  register(owner, 'controller:application', class extends Controller {});
  register(
    owner,
    'template:application',
    precompileTemplate('{{outlet}}', { strictMode: true }),
  );

  return {
    /** What the application route read off the first transition */
    seen,
    get history() {
      return routerMain(owner).location.history;
    },
  };
}

export type RisonApp = ReturnType<typeof setupRisonApp>;
