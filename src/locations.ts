/**
 * Routes as data. A route takes three forms in an Ember app: a URL, a
 * RouteInfo (`transition.to`, `router.currentRoute`), and the arguments
 * `transitionTo` takes. A route location, `{ name, params, queryParams }`,
 * goes between them, and fits in a query param or in storage as it is.
 *
 * For links from outside the app (a mobile app link, one pasted from the
 * clipboard, one a server wrote with plain params), the route a signed-out
 * visit was going to, a saved view, a notification's link...
 */
import {
  DEFAULT_KEY,
  generateRisonQs,
  parseRisonQueryString,
  type QueryParams,
  type RisonQueryStringOptions,
} from './query-string.ts';

import { readValue } from './router.ts';

import type RouterService from '@ember/routing/router-service';

/**
 * A route as data: its name, the dynamic segments of it and its parents
 * (root first), and its query params. What `transitionTo` takes, see
 * transitionArgs.
 */
export interface RouteLocation {
  name: string;
  params: unknown[];
  queryParams: QueryParams;
}

/** What locationFromRouteInfo reads off a RouteInfo (`transition.to`, `router.currentRoute`). */
export interface RouteInfoLike {
  name: string;
  params?: Record<string, unknown> | null;
  paramNames?: readonly string[] | null;
  queryParams?: QueryParams | null;
  parent: RouteInfoLike | null;
}

/**
 * A link with its plain query params moved into one rison param, so the
 * router reads them typed as its own: `?name=Jos%C3%A9+P%C3%A9rez&embed`
 * becomes `?qs=(embed:'true',name:'José Pérez')`. Plain params are read as
 * Ember reads them (`+` a space, no value `'true'`, `key[]` a list). A link
 * that already has the rison param is left as it is. Any scheme works:
 * `myapp://app/reports?...` as well as `https://...`.
 *
 * @example
 * toRisonUrl('myapp://app/reports?projectId=5&q=O%27Brien');
 * // => "myapp://app/reports?qs=(projectId:'5',q:'O!'Brien')"
 */
export function toRisonUrl(
  link: string,
  options: RisonQueryStringOptions = {},
): string {
  const url = new URL(link);
  const key = options.key ?? DEFAULT_KEY;

  if (!url.search || url.searchParams.has(key)) {
    return url.toString();
  }

  const params = parseRisonQueryString(url.search, options);

  // already percent-encoded: searchParams.set would encode it a second time
  url.search = `?${key}=${generateRisonQs(params)}`;

  return url.toString();
}

/**
 * The location of a RouteInfo (`transition.to`, `router.currentRoute`, what
 * `router.recognize(url)` gives): its name, the dynamic segments of it and
 * of every parent (root first), and a copy of its query params, as plain
 * values.
 *
 * @example
 * // at /s/acme/reports/5?qs=(print:!t)
 * locationFromRouteInfo(router.currentRoute);
 * // => { name: 'auth.reports.show', params: ['acme', '5'], queryParams: { print: true } }
 *
 * router.transitionTo(...transitionArgs(locationFromRouteInfo(transition.to)));
 */
export function locationFromRouteInfo(routeInfo: RouteInfoLike): RouteLocation {
  const levels: unknown[][] = [];

  for (
    let node: RouteInfoLike | null = routeInfo;
    node && node.parent !== null;
    node = node.parent
  ) {
    const params = node.params ?? {};
    const names = node.paramNames ?? [];

    if (names.length) {
      levels.unshift(names.map((name) => params[name]));
    }
  }

  return {
    name: routeInfo.name,
    params: levels.flat(),
    // plain values, and a copy, whatever RouteInfo it is given
    queryParams: Object.fromEntries(
      Object.entries(routeInfo.queryParams ?? {}).map(([key, value]) => [
        key,
        readValue(value),
      ]),
    ),
  };
}

/**
 * The location a link goes to in this app; null when the app has no route
 * for it. Takes any scheme (`myapp://app/...`, `https://other.host/...`):
 * only the path and query string count. The query string is read as the
 * router reads it, rison included.
 *
 * Note that a catch-all route (`path: '/*wildcard'`) recognizes every link:
 * check the name it gives back.
 *
 * @example
 * const location = locationFromUrl(router, 'myapp://app/reports/5?qs=(print:!t)');
 *
 * if (location && location.name !== 'not-found') {
 *   router.replaceWith(...transitionArgs(location));
 * }
 */
export function locationFromUrl(
  router: Pick<RouterService, 'recognize'>,
  link: string,
): RouteLocation | null {
  let path = link;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(link)) {
    // the host of `myapp://app/...` is not part of the path
    const url = new URL(
      link.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, 'https://'),
    );

    path = `${url.pathname}${url.search}`;
  }

  let routeInfo: RouteInfoLike | null;

  try {
    routeInfo = router.recognize(path);
  } catch {
    return null;
  }

  return routeInfo ? locationFromRouteInfo(routeInfo) : null;
}

/**
 * A location as the arguments `transitionTo` / `replaceWith` take.
 *
 * @example
 * router.replaceWith(...transitionArgs(location));
 */
export function transitionArgs(
  location: RouteLocation,
): [string, ...unknown[], { queryParams: QueryParams }] {
  return [
    location.name,
    ...location.params,
    { queryParams: location.queryParams },
  ];
}
