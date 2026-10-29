import { type RisonQueryStringOptions } from './query-string.ts';
import type EmberRouter from '@ember/routing/router';
export type UseRisonQueryParamsOptions = RisonQueryStringOptions;
/** A query param's value as the router keeps it: its rison. */
export declare class StoredValue {
    readonly rison: string;
    constructor(rison: string);
}
/**
 * A value as the router keeps it. null and undefined stay as they are (the
 * router has its own rules for them), and so does what rison can't encode.
 */
export declare function storeValue(value: unknown): unknown;
/**
 * A value as the router keeps it, decoded: a copy of its own. Anything else
 * is given back as it is. For the values a route's `queryParamsDidChange`
 * action gets (`changed`, `removed`), which are the router's own.
 */
export declare function readValue(value: unknown): unknown;
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
export declare function useRisonQueryParams(router: EmberRouter, options?: UseRisonQueryParamsOptions): void;
//# sourceMappingURL=router.d.ts.map