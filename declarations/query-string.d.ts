export type QueryParams = Record<string, unknown>;
export interface RisonQueryStringOptions {
    /**
     * The query param that holds the rison. Default `qs`.
     */
    key?: string;
}
export declare const DEFAULT_KEY = "qs";
/**
 * What a query string leaves out: what Ember's `isBlank` says is blank
 * (`!isPresent`), without needing Ember. Undefined, null, a blank string
 * (`''`, `'  '`), and anything with a `size` or `length` of 0: an empty
 * list, Map or Set, `{ length: 0 }`. `false`, `0` and `{}` are values.
 *
 * (Line for line @ember/utils' isEmpty + isBlank, reading `size` and
 * `length` as plain properties: only an EmberObject answering them from
 * `unknownProperty` could differ.)
 */
export declare function isBlank(value: unknown): boolean;
/**
 * Escapes the apostrophes of a rison string written, unescaped, inside
 * another rison string, as a server that builds links by hand may have it.
 * Only a repair: it misreads valid rison (a `(` or an escaped `!'` inside a
 * string), so decodeRisonQs tries it only after a plain decode failed.
 *
 * @example
 * escapeNestedStrings("(next:'/reports?qs=(a:'b')')");
 * // => "(next:'/reports?qs=(a:!'b!')')"
 */
export declare function escapeNestedStrings(value: string): string;
/**
 * Percent-encodes rison for an address, leaving it readable: `@ : $ , ;`
 * stay as they are. `=` `&` `+` `#` stay encoded, so any query string parser
 * (Ember's own cuts a param at its second `=`) gets the whole param.
 *
 * @example
 * encodeUriQuery("(email:'a+b@x.com',search:faqs=1)");
 * // => "(email:'a%2Bb@x.com',search:faqs%3D1)"
 */
export declare function encodeUriQuery(value: string): string;
/**
 * The value of the rison param, decoded. Takes it as `qs=(...)`, `qs:(...)`
 * or just `(...)`, percent-encoded or not. Throws when it isn't rison;
 * nothing (undefined, null, '') is `{}`.
 *
 * @example
 * decodeRisonQs("qs=(print:!t,projectId:'5')");
 * // => { print: true, projectId: '5' }
 *
 * decodeRisonQs("(search:'O!'Brien%20(jr')");
 * // => { search: "O'Brien (jr" }
 *
 * decodeRisonQs(undefined);
 * // => {}
 *
 * decodeRisonQs('(a:1');
 * // throws: the closing parenthesis is missing
 */
export declare function decodeRisonQs(qs: string | null | undefined, { key }?: RisonQueryStringOptions): unknown;
/**
 * Params as rison, percent-encoded for an address (or not, with
 * `encode = false`). Keys are sorted, so the same params are always the same
 * address.
 *
 * @example
 * generateRisonQs({ projectId: '5', print: true });
 * // => "(print:!t,projectId:'5')"
 *
 * generateRisonQs({ search: "O'Brien (jr", filters: { status: ['open now'] } });
 * // => "(filters:(status:!('open%20now')),search:'O!'Brien%20(jr')"
 *
 * generateRisonQs({ search: "O'Brien" }, false);
 * // => "(search:'O!'Brien')"
 */
export declare function generateRisonQs(params: unknown, encodeForUri?: boolean): string;
/**
 * The query params of an address (what follows the `?`). Never throws: an
 * address it can't read would break routing to it.
 *
 * - The rison param is decoded and spread out. A query string that is all
 *   rison, `qs:(...)` or just `(...)`, is read as the rison param too.
 * - Any other param (`fbclid`, `utm_source` from whoever shared the link, a
 *   plain `?projectId=5`, what a sign-in provider sends back) is read as
 *   Ember reads it: a string, `'true'` without a value, a list for `key[]`.
 *   When both have a param, the rison one wins.
 * - A rison param that isn't rison, or isn't an object, is dropped.
 * - A raw `&` or `+` inside a rison string stays in it, as servers that build
 *   links by hand write them.
 *
 * @example
 * parseRisonQueryString("qs=(print:!t,projectId:'5')");
 * // => { print: true, projectId: '5' }
 *
 * parseRisonQueryString('qs=(projectId:5)&utm_source=mail&fbclid=Ab_1');
 * // => { projectId: 5, utm_source: 'mail', fbclid: 'Ab_1' }
 *
 * parseRisonQueryString('code=abc&state=eyJ9%3D&embed&id[]=1&id[]=2');
 * // => { code: 'abc', state: 'eyJ9=', embed: 'true', id: ['1', '2'] }
 *
 * parseRisonQueryString("qs=(identifier:'a&b+c@x.com')");
 * // => { identifier: 'a&b+c@x.com' }
 *
 * parseRisonQueryString('qs=(a:1&x=1');
 * // => { x: '1' }  (the broken qs is dropped)
 */
export declare function parseRisonQueryString(queryString: string | null | undefined, options?: RisonQueryStringOptions): QueryParams;
/**
 * The query string for params: all of them in one rison param. A blank
 * value (see isBlank) is left out; `false` and `0` stay. Nothing to write is
 * no query string.
 *
 * @example
 * generateRisonQueryString({ projectId: '5', print: true, search: '' });
 * // => "?qs=(print:!t,projectId:'5')"
 *
 * generateRisonQueryString({ archived: false, page: 0 });
 * // => '?qs=(archived:!f,page:0)'
 *
 * generateRisonQueryString({ search: null });
 * // => ''
 */
export declare function generateRisonQueryString(params: QueryParams | null | undefined, { key }?: RisonQueryStringOptions): string;
//# sourceMappingURL=query-string.d.ts.map