/**
 * Makes an Ember router read and write query params as rison, all in one
 * param (`qs` unless you name it otherwise).
 *
 * Ember's router keeps each query param's value as a string (`'5'`,
 * `'true'`), and counts on it: it compares them with `===` (to the default,
 * to the value before), router_js rewrites numbers and the items of lists
 * into strings in place, and Ember serializes again values it has kept
 * already (`router.isActive`).
 *
 * So the router keeps each value as a StoredValue: its rison, in an object
 * of its own, one per rison. Equal values are the same StoredValue, router_js
 * leaves objects alone, and storing a StoredValue gives it back as it is.
 * Controllers, the address, and what apps read off the router
 * (`transition.to`, `router.currentRoute`, `router.recognize`) get it decoded,
 * a copy each. So do a route's own `serializeQueryParam` /
 * `deserializeQueryParam` (as ember-parachute overrides them): whatever they
 * do, they see values, not StoredValues.
 *
 * A route's `queryParamsDidChange` action gets the router's own values, as
 * Ember gives it its strings: Ember's own handler compares them with what it
 * keeps (Ember 7). readValue decodes them.
 */
import { decode, encode } from 'prysmex-rison-node';

import {
  generateRisonQueryString,
  parseRisonQueryString,
  type QueryParams,
  type RisonQueryStringOptions,
} from './query-string.ts';

import type EmberRouter from '@ember/routing/router';

export type UseRisonQueryParamsOptions = RisonQueryStringOptions;

/** A query param's value as the router keeps it: its rison. */
export class StoredValue {
  constructor(readonly rison: string) {}
}

// One StoredValue per rison, for as long as anything holds it. A weak
// reference, so the values the router no longer has are let go.
const stored = new Map<string, WeakRef<StoredValue>>();
const forget = new FinalizationRegistry<string>((rison) => {
  // unless an equal value has taken its place since
  if (!stored.get(rison)?.deref()) {
    stored.delete(rison);
  }
});

/**
 * A value as the router keeps it. null and undefined stay as they are (the
 * router has its own rules for them), and so does what rison can't encode.
 */
export function storeValue(value: unknown): unknown {
  if (value === null || value === undefined || value instanceof StoredValue) {
    return value;
  }

  let rison: string;

  try {
    rison = encode(value);
  } catch {
    // a function, a symbol...: left to the router, as Ember would
    return value;
  }

  const known = stored.get(rison)?.deref();

  if (known) {
    return known;
  }

  const kept = new StoredValue(rison);

  stored.set(rison, new WeakRef(kept));
  forget.register(kept, rison);

  return kept;
}

/**
 * A value as the router keeps it, decoded: a copy of its own. Anything else
 * is given back as it is. For the values a route's `queryParamsDidChange`
 * action gets (`changed`, `removed`), which are the router's own.
 */
export function readValue(value: unknown): unknown {
  return value instanceof StoredValue ? decode(value.rison) : value;
}

// The private parts of the router this replaces: there is no public API to
// change how query params are read and written.
interface RecognizerLike {
  parseQueryString: (queryString: string) => QueryParams;
  generateQueryString: (params: QueryParams) => string;
}

// A RouteInfo: its `queryParams` is an object router_js makes for it
interface RouteInfoLike {
  queryParams?: QueryParams;
}

interface TransitionLike {
  to?: RouteInfoLike | null;
  from?: RouteInfoLike | null;
}

// A route's own query param hooks, which apps (ember-parachute) override
interface RouteLike {
  serializeQueryParam: (
    value: unknown,
    urlKey: string,
    type: string,
  ) => unknown;
  deserializeQueryParam: (
    value: unknown,
    urlKey: string,
    type: string,
  ) => unknown;
}

interface RouterMicrolib {
  recognizer: RecognizerLike;
  // a route by its name; with @embroider/router, maybe a promise of it
  getRoute?: (
    name: string,
  ) => RouteLike | PromiseLike<RouteLike | undefined> | undefined;
  // they make `transition.to` and `transition.from`
  toInfos?: (transition: TransitionLike, ...rest: unknown[]) => void;
  fromInfos?: (transition: TransitionLike, ...rest: unknown[]) => void;
  // `router.recognize(url)` and `router.recognizeAndLoad(url)`
  recognize?: (url: string) => RouteInfoLike | null | undefined;
  recognizeAndLoad?: (url: string) => Promise<RouteInfoLike>;
}

interface PrivateRouter {
  // eslint-disable-next-line ember/no-private-routing-service -- see above
  _routerMicrolib?: RouterMicrolib;
  _serializeQueryParam: (value: unknown, type: string) => unknown;
  _deserializeQueryParam: (value: unknown, defaultType: string) => unknown;
}

/**
 * A string reaching a param whose default is a number or a boolean, as a
 * plain `?page=2` gives: read as Ember would.
 */
function coerce(value: unknown, defaultType: string): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (defaultType === 'number') {
    const number = Number(value);

    return value.trim() === '' || Number.isNaN(number) ? value : number;
  }

  if (defaultType === 'boolean') {
    return value === 'true' ? true : value === 'false' ? false : value;
  }

  return value;
}

function mapValues(
  params: QueryParams | null | undefined,
  fn: (value: unknown) => unknown,
): QueryParams {
  const mapped: QueryParams = {};

  for (const [key, value] of Object.entries(params ?? {})) {
    mapped[key] = fn(value);
  }

  return mapped;
}

/**
 * The query params of a RouteInfo, decoded in place. They are an object
 * router_js makes for that RouteInfo (or, from `recognize`, for a state it
 * throws away), and Ember itself never reads them: the router's own values
 * are left as they are.
 */
function readQueryParams(routeInfo: RouteInfoLike | null | undefined) {
  const queryParams = routeInfo?.queryParams;

  if (queryParams && typeof queryParams === 'object') {
    for (const [key, value] of Object.entries(queryParams)) {
      queryParams[key] = readValue(value);
    }
  }
}

// Routes whose query param hooks are wrapped already
const wrappedRoutes = new WeakSet<object>();

/**
 * Fails, naming them, when Ember's router lacks what this replaces: it can't
 * keep query params typed without them, and skipping one would hand apps
 * StoredValues where they read values. (The same ember-source runs in
 * development, tests and production: this fails at the first boot or test.)
 */
function requireInternals(where: string, object: object, names: string[]) {
  const missing = names.filter(
    (name) => typeof (object as Record<string, unknown>)[name] !== 'function',
  );

  if (missing.length) {
    throw new Error(
      `ember-rison-qs: this version of Ember has no ${missing
        .map((name) => `${where}.${name}`)
        .join(
          ', ',
        )}. useRisonQueryParams replaces it to keep query params typed (Ember has no public API for this), so it can't run on this version. Please open an issue: https://github.com/betocantu93/ember-rison-qs/issues`,
    );
  }
}

/**
 * A route's query param hooks, around whatever they are (Ember's own, or an
 * app's): they get values, and what they give back is stored.
 */
function wrapRoute(route: RouteLike | undefined) {
  if (!route || wrappedRoutes.has(route)) {
    return route;
  }

  requireInternals('route', route, [
    'serializeQueryParam',
    'deserializeQueryParam',
  ]);
  wrappedRoutes.add(route);

  const { serializeQueryParam, deserializeQueryParam } = route;

  route.serializeQueryParam = function (value, urlKey, type) {
    return storeValue(
      serializeQueryParam.call(this, readValue(value), urlKey, type),
    );
  };
  route.deserializeQueryParam = function (value, urlKey, type) {
    return deserializeQueryParam.call(this, readValue(value), urlKey, type);
  };

  return route;
}

/**
 * Makes the router read and write query params as rison, all in one `qs`.
 * Call it from your router's `setupRouter`: the router reads the address of
 * a page loaded fresh before it makes any route, so this must come first.
 *
 * Controllers, `model(params)` and the address get every value typed, as it
 * was: `page: 2`, `ids: [1, 2]`, `filters: { status: 'open' }`. A value
 * equal to its default leaves the address, compared by value. A plain
 * `?page=2` still works, read as Ember reads it.
 *
 * `transition.to.queryParams`, `transition.from.queryParams`,
 * `router.currentRoute.queryParams` and `router.recognize(url).queryParams`
 * have them typed too, each a copy of its own.
 *
 * @example
 * // app/router.ts
 * import EmberRouter from '@ember/routing/router';
 * import { useRisonQueryParams } from 'ember-rison-qs';
 *
 * export default class Router extends EmberRouter {
 *   setupRouter() {
 *     const didSetUp = super.setupRouter();
 *
 *     if (didSetUp) {
 *       useRisonQueryParams(this);
 *     }
 *
 *     return didSetUp;
 *   }
 * }
 */
export function useRisonQueryParams(
  router: EmberRouter,
  options: UseRisonQueryParamsOptions = {},
): void {
  const privateRouter = router as unknown as PrivateRouter;
  // eslint-disable-next-line ember/no-private-routing-service -- see PrivateRouter
  const microlib = privateRouter._routerMicrolib;

  if (!microlib?.recognizer) {
    throw new Error(
      'ember-rison-qs: useRisonQueryParams needs a router that is set up. Call it from setupRouter(), after super.setupRouter().',
    );
  }

  requireInternals('router', privateRouter, [
    '_serializeQueryParam',
    '_deserializeQueryParam',
  ]);
  // eslint-disable-next-line ember/no-private-routing-service -- its name, for the error
  requireInternals('router._routerMicrolib.recognizer', microlib.recognizer, [
    'parseQueryString',
    'generateQueryString',
  ]);
  // eslint-disable-next-line ember/no-private-routing-service -- its name, for the error
  requireInternals('router._routerMicrolib', microlib, [
    'getRoute',
    'toInfos',
    'fromInfos',
    'recognize',
    'recognizeAndLoad',
  ]);

  const { recognizer } = microlib;
  const { getRoute, toInfos, fromInfos, recognize, recognizeAndLoad } =
    microlib as Required<RouterMicrolib>;

  recognizer.parseQueryString = (queryString) =>
    mapValues(parseRisonQueryString(queryString, options), storeValue);
  recognizer.generateQueryString = (params) =>
    generateRisonQueryString(mapValues(params, readValue), options);
  privateRouter._serializeQueryParam = storeValue;
  privateRouter._deserializeQueryParam = (value, defaultType) =>
    coerce(readValue(value), defaultType);

  // A route's own hooks, overridden or not, work with values
  microlib.getRoute = function (name) {
    const route = getRoute.call(this, name);

    // (any promise: @embroider/router's, or another router's)
    return route && 'then' in route ? route.then(wrapRoute) : wrapRoute(route);
  };

  // What apps read off the router gets the values decoded
  microlib.toInfos = function (transition, ...rest) {
    toInfos.call(this, transition, ...rest);
    readQueryParams(transition?.to);
  };
  microlib.fromInfos = function (transition, ...rest) {
    fromInfos.call(this, transition, ...rest);
    readQueryParams(transition?.from);
  };
  microlib.recognize = function (url) {
    const routeInfo = recognize.call(this, url);

    readQueryParams(routeInfo);

    return routeInfo;
  };
  microlib.recognizeAndLoad = function (url) {
    return recognizeAndLoad.call(this, url).then((routeInfo) => {
      readQueryParams(routeInfo);

      return routeInfo;
    });
  };
}
