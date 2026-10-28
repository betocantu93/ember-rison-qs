/**
 * Query params as one rison param, `qs` unless you name it otherwise.
 * `{ projectId: '5', print: true }` is
 *
 *   /reports?qs=(print:!t,projectId:'5')
 *
 * Nothing here needs Ember: these read and write a query string. The router
 * uses them through useRisonQueryParams.
 */
import { decode, encode } from 'prysmex-rison-node';

export type QueryParams = Record<string, unknown>;

export interface RisonQueryStringOptions {
  /**
   * The query param that holds the rison. Default `qs`.
   */
  key?: string;
}

export const DEFAULT_KEY = 'qs';

function isPlainObject(value: unknown): value is QueryParams {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
export function isBlank(value: unknown): boolean {
  return isEmpty(value) || (typeof value === 'string' && !/\S/.test(value));
}

// @ember/utils' isEmpty
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  const object = value as { size?: unknown; length?: unknown };

  if (typeof object.size === 'number') {
    return !object.size;
  }

  if (typeof value === 'object' && typeof object.length === 'number') {
    return !object.length;
  }

  if (typeof object.length === 'number' && typeof value !== 'function') {
    return !object.length;
  }

  return false;
}

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
export function escapeNestedStrings(value: string): string {
  let escaped = '';
  let quoteSeen = false;
  let quoteLevel = 0;
  let previous = '';

  for (const ch of value) {
    if (ch === "'") {
      if (quoteLevel === 0) {
        quoteSeen = !quoteSeen;
      }

      escaped += quoteLevel > 0 && previous !== '!' ? "!'" : "'";
    } else {
      if (ch === '(') {
        quoteLevel += quoteSeen ? 1 : 0;
      } else if (ch === ')') {
        quoteLevel -= quoteSeen ? 1 : 0;
      }

      escaped += ch;
    }

    previous = ch;
  }

  return escaped;
}

/**
 * Percent-encodes rison for an address, leaving it readable: `@ : $ , ;`
 * stay as they are. `=` `&` `+` `#` stay encoded, so any query string parser
 * (Ember's own cuts a param at its second `=`) gets the whole param.
 *
 * @example
 * encodeUriQuery("(email:'a+b@x.com',search:faqs=1)");
 * // => "(email:'a%2Bb@x.com',search:faqs%3D1)"
 */
export function encodeUriQuery(value: string): string {
  return encodeURIComponent(value)
    .replace(/%40/g, '@')
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%3B/gi, ';');
}

/**
 * decodeURIComponent that never throws: each valid `%XX` run is decoded,
 * a stray `%` (`100%`, as typed by hand) is left as it is.
 */
function decodePercents(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        // bytes that are not UTF-8
        return run;
      }
    });
  }
}

/** A query string part, `+` as a space, as browsers and Ember read it. */
function decodeQueryComponent(value: string): string {
  return decodePercents(value.replace(/\+/g, ' '));
}

function stripKey(qs: string, key: string): string {
  const lower = qs.slice(0, key.length + 1).toLowerCase();
  const prefix = key.toLowerCase();

  return lower === `${prefix}=` || lower === `${prefix}:`
    ? qs.slice(key.length + 1)
    : qs;
}

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
export function decodeRisonQs(
  qs: string | null | undefined,
  { key = DEFAULT_KEY }: RisonQueryStringOptions = {},
): unknown {
  if (!qs) {
    return {};
  }

  const value = decodePercents(stripKey(qs, key));

  try {
    return decode(value);
  } catch (error) {
    // a rison string nested, unescaped, in another one
    try {
      return decode(escapeNestedStrings(value));
    } catch {
      throw error;
    }
  }
}

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
export function generateRisonQs(params: unknown, encodeForUri = true): string {
  const encoded = encode(params);

  return encodeForUri ? encodeUriQuery(encoded) : encoded;
}

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
export function parseRisonQueryString(
  queryString: string | null | undefined,
  options: RisonQueryStringOptions = {},
): QueryParams {
  const key = (options.key ?? DEFAULT_KEY).toLowerCase();
  const search = queryString?.replace(/^\?/, '');

  if (!search) {
    return {};
  }

  // The whole string as the rison param first (`qs=(...)`, `qs:(...)`, or
  // just `(...)`), so a raw `&` or `+` inside a rison string stays part of it
  try {
    const decoded = decodeRisonQs(search, options);

    if (isPlainObject(decoded)) {
      return decoded;
    }
  } catch {
    // more than the rison param, or not rison: read param by param
  }

  const plain: QueryParams = {};
  let fromRison: QueryParams = {};

  for (const part of search.split('&')) {
    if (!part) {
      continue;
    }

    const separator = part.indexOf('=');
    const name = decodeQueryComponent(
      separator === -1 ? part : part.slice(0, separator),
    );
    const value = separator === -1 ? null : part.slice(separator + 1);

    if (name.toLowerCase() === key) {
      try {
        const decoded = decodeRisonQs(value, options);

        if (isPlainObject(decoded)) {
          fromRison = { ...fromRison, ...decoded };
        }
      } catch {
        // not rison: dropped
      }
    } else {
      // as Ember's own parser: no value is 'true', `key[]` a list
      const decodedValue =
        value === null ? 'true' : decodeQueryComponent(value);

      if (name.length > 2 && name.endsWith('[]')) {
        const listName = name.slice(0, -2);
        const list = plain[listName];

        plain[listName] = Array.isArray(list)
          ? [...(list as unknown[]), decodedValue]
          : [decodedValue];
      } else {
        plain[name] = decodedValue;
      }
    }
  }

  return { ...plain, ...fromRison };
}

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
export function generateRisonQueryString(
  params: QueryParams | null | undefined,
  { key = DEFAULT_KEY }: RisonQueryStringOptions = {},
): string {
  const present = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, value]) => !isBlank(value)),
  );

  return Object.keys(present).length
    ? `?${key}=${generateRisonQs(present)}`
    : '';
}
