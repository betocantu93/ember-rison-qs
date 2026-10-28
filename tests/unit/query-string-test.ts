import { isPresent } from '@ember/utils';
import { module, test } from 'qunit';

import {
  decodeRisonQs,
  encodeUriQuery,
  escapeNestedStrings,
  generateRisonQs,
  generateRisonQueryString,
  isBlank,
  parseRisonQueryString,
} from '#src/index.ts';

// Values that once came back wrong, or made decoding the address throw --
// which breaks routing to it
const ROUND_TRIPS: Record<string, Record<string, unknown>> = {
  'a ( inside a string, with another string after it': { q: 'a(b', x: 'c' },
  'a ( inside a string in a nested object': { a: { b: 'f(x' }, c: 'z' },
  'an apostrophe, then a nested string': { a: "O'Brien", b: { c: 'd e' } },
  'an apostrophe, then an array of strings': { a: "it's", b: ['x y'] },
  '"qs=" inside a value, in any case': { q: 'faqs=1', r: 'QS=x' },
  'strings that look like rison': {
    q: '!t',
    r: '(abc',
    s: '!important',
    t: 'wow!',
  },
  'strings that look like numbers or booleans': {
    a: '5',
    b: '-1.5',
    c: 'true',
    d: 'null',
  },
  'a percent sign and a plus sign': { q: '50%', r: 'a+b', s: '%20', t: '%' },
  'an & and an =': { q: 'a&b=c', r: '&', s: '=' },
  'a # and a ?': { q: 'a#b', r: 'what?' },
  'an address': { next: '/reports/5?qs=(print:!t)&tab=a=b#top' },
  unicode: { name: 'José Pérez', emoji: '🎉', cjk: '東京' },
  whitespace: { a: ' leading', b: 'trailing ', c: 'tab\there', d: 'new\nline' },
  'every kind of value': {
    n: 5,
    neg: -1.5,
    b: true,
    f: false,
    z: null,
    arr: [1, 'two words', [3]],
    obj: { from: '2026-01-01', to: '2026-02-01' },
  },
  'empty containers': { a: [], o: {} },
  'odd keys': { 'a b': 1, "it's": 2, '': 3, 'a:b': 4, '(x)': 5 },
  'deep nesting': { a: { b: { c: { d: { e: [[[{ f: 'g' }]]] } } } } },
};

module('Unit | query-string', function () {
  // A search for "(O'Brien" on /reports: the address failed to decode in
  // production, on a fresh load and on the way back to it
  module('the address that failed in production', function () {
    const QUERY_STRING = 'qs=(query:(search:%27(O!%27Brien%27))';
    const PARAMS = { query: { search: "(O'Brien" } };

    test('decodeRisonQs reads it', function (assert) {
      const qs = decodeURIComponent(QUERY_STRING.slice('qs='.length));

      assert.deepEqual(decodeRisonQs(qs), PARAMS);
    });

    test('parseRisonQueryString reads it', function (assert) {
      assert.deepEqual(parseRisonQueryString(QUERY_STRING), PARAMS);
    });

    test('it is what generateRisonQs makes of that search', function (assert) {
      assert.strictEqual(
        `qs=${generateRisonQs(PARAMS)}`,
        "qs=(query:(search:'(O!'Brien'))",
      );
    });
  });

  module('generateRisonQs, then parseRisonQueryString', function () {
    for (const [name, params] of Object.entries(ROUND_TRIPS)) {
      test(`gives back ${name}`, function (assert) {
        assert.deepEqual(
          parseRisonQueryString(`qs=${generateRisonQs(params)}`),
          params,
        );
      });
    }
  });

  module('generateRisonQueryString, then parseRisonQueryString', function () {
    for (const [name, params] of Object.entries(ROUND_TRIPS)) {
      test(`gives back ${name}, but its blank values`, function (assert) {
        const present = Object.fromEntries(
          Object.entries(params).filter(([, value]) => !isBlank(value)),
        );

        assert.deepEqual(
          parseRisonQueryString(generateRisonQueryString(params)),
          present,
        );
      });
    }
  });

  module('generateRisonQs', function () {
    test('sorts the keys, so the same params are the same address', function (assert) {
      assert.strictEqual(
        generateRisonQs({ b: 1, a: 2 }),
        generateRisonQs({ a: 2, b: 1 }),
      );
      assert.strictEqual(generateRisonQs({ b: 1, a: 2 }), '(a:2,b:1)');
    });

    test('leaves the address readable', function (assert) {
      assert.strictEqual(
        generateRisonQs({
          email: 'a@x.com',
          time: '10:30',
          cost: '$5',
          list: 'a,b',
          end: 'a;b',
        }),
        "(cost:'$5',email:'a@x.com',end:a;b,list:'a,b',time:'10:30')",
      );
    });

    test('percent-encodes what would break a query string', function (assert) {
      const qs = generateRisonQs({
        search: 'faqs=1',
        link: 'reports/5?qs=(print:!t)',
        more: 'a&b+c#d',
      });

      for (const ch of ['=', '&', '+', '#', '?', ' ']) {
        assert.false(qs.includes(ch), `${ch} in ${qs}`);
      }
    });

    test('without encoding, plain rison', function (assert) {
      assert.strictEqual(
        generateRisonQs({ search: "O'Brien (jr" }, false),
        "(search:'O!'Brien (jr')",
      );
    });

    test('values other than objects', function (assert) {
      assert.strictEqual(generateRisonQs([1, 'a b']), "!(1,'a%20b')");
      assert.strictEqual(generateRisonQs('word'), 'word');
      assert.strictEqual(generateRisonQs(true), '!t');
    });
  });

  module('decodeRisonQs', function () {
    test('nothing is no params', function (assert) {
      assert.deepEqual(decodeRisonQs(undefined), {});
      assert.deepEqual(decodeRisonQs(null), {});
      assert.deepEqual(decodeRisonQs(''), {});
    });

    test('reads every form of the qs param', function (assert) {
      assert.deepEqual(decodeRisonQs('qs=(a:1)'), { a: 1 });
      assert.deepEqual(decodeRisonQs('QS=(a:1)'), { a: 1 });
      assert.deepEqual(decodeRisonQs('qs:(a:1)'), { a: 1 });
      assert.deepEqual(decodeRisonQs('(a:1)'), { a: 1 });
      assert.deepEqual(decodeRisonQs("(a:'b%20c')"), { a: 'b c' });
    });

    test('with another key', function (assert) {
      assert.deepEqual(decodeRisonQs('_a=(a:1)', { key: '_a' }), { a: 1 });
      assert.throws(
        () => decodeRisonQs('qs=(a:1)', { key: '_a' }),
        'qs= is not its key',
      );
    });

    test('a stray %, as typed by hand, is read as it is', function (assert) {
      assert.deepEqual(decodeRisonQs("(q:'100%')"), { q: '100%' });
      assert.deepEqual(decodeRisonQs("(q:'100%',r:'a%20b')"), {
        q: '100%',
        r: 'a b',
      });
      assert.deepEqual(
        decodeRisonQs("(q:'%E0%A4%A')"),
        { q: '%E0%A4%A' },
        'not UTF-8: as it is',
      );
    });

    test('still reads a rison string nested, unescaped, in another', function (assert) {
      assert.deepEqual(decodeRisonQs("qs=(next:'/reports?qs=(a:'b')')"), {
        next: "/reports?qs=(a:'b')",
      });
    });

    test('throws on what is not rison', function (assert) {
      assert.throws(() => decodeRisonQs('(a:1'));
      assert.throws(() => decodeRisonQs('(a:1))'));
      assert.throws(() => decodeRisonQs('!x'));
    });
  });

  module('parseRisonQueryString', function () {
    test('no query string is no params', function (assert) {
      assert.deepEqual(parseRisonQueryString(''), {});
      assert.deepEqual(parseRisonQueryString('?'), {});
      assert.deepEqual(parseRisonQueryString(undefined), {});
      assert.deepEqual(parseRisonQueryString(null), {});
    });

    test('takes it with its ?', function (assert) {
      assert.deepEqual(parseRisonQueryString('?qs=(a:1)&b=2'), {
        a: 1,
        b: '2',
      });
    });

    test('keeps params added beside qs by whoever shared the link', function (assert) {
      assert.deepEqual(
        parseRisonQueryString('qs=(projectId:5)&utm_source=mail&fbclid=Ab_1'),
        {
          projectId: 5,
          utm_source: 'mail',
          fbclid: 'Ab_1',
        },
      );
      assert.deepEqual(
        parseRisonQueryString('utm_source=mail&qs=(projectId:5)'),
        {
          projectId: 5,
          utm_source: 'mail',
        },
      );
    });

    test('a query string that is all rison is the rison param', function (assert) {
      // as the app this addon comes from read them, from links its server writes
      assert.deepEqual(parseRisonQueryString('(a:1)'), { a: 1 });
      assert.deepEqual(parseRisonQueryString("(a:'x y')"), { a: 'x y' });
      assert.deepEqual(parseRisonQueryString('qs:(a:1)'), { a: 1 });
      assert.deepEqual(parseRisonQueryString('?(a:1)'), { a: 1 });
      assert.deepEqual(parseRisonQueryString('%28a%3A1%29'), { a: 1 });
      assert.deepEqual(parseRisonQueryString("(identifier:'a&b+c@x.com')"), {
        identifier: 'a&b+c@x.com',
      });
    });

    test('rison that is not an object is not', function (assert) {
      assert.deepEqual(parseRisonQueryString('word'), { word: 'true' });
      assert.deepEqual(parseRisonQueryString('!(1,2)'), { '!(1,2)': 'true' });
      assert.deepEqual(parseRisonQueryString('(a:1)&x=1'), {
        '(a:1)': 'true',
        x: '1',
      });
    });

    test('reads plain params, without a qs', function (assert) {
      assert.deepEqual(parseRisonQueryString('projectId=5&q=hello+world'), {
        projectId: '5',
        q: 'hello world',
      });
    });

    test('reads plain params as Ember does: no value is true, key[] a list', function (assert) {
      assert.deepEqual(parseRisonQueryString('embed&id[]=1&id[]=2&q=&&'), {
        embed: 'true',
        id: ['1', '2'],
        q: '',
      });
    });

    test('decodes plain params, keys too', function (assert) {
      assert.deepEqual(
        parseRisonQueryString('na%20me=Jos%C3%A9&state=eyJ9%3D&bad=%E0%A4%A'),
        {
          'na me': 'José',
          state: 'eyJ9=',
          bad: '%E0%A4%A',
        },
      );
    });

    test('a raw & or + inside a rison string stays in it', function (assert) {
      // as servers that build links by hand write them
      assert.deepEqual(parseRisonQueryString("qs=(identifier:'a&b+c@x.com')"), {
        identifier: 'a&b+c@x.com',
      });
    });

    test('a raw = inside qs, as typed into the address', function (assert) {
      assert.deepEqual(parseRisonQueryString('qs=(query:(search:faqs=1))'), {
        query: { search: 'faqs=1' },
      });
    });

    test('a stray % beside percent-encoded text', function (assert) {
      assert.deepEqual(parseRisonQueryString('qs=(q:%27100%%27)&x=1'), {
        q: '100%',
        x: '1',
      });
      assert.deepEqual(parseRisonQueryString('q=100%&r=%E2%9C%93%'), {
        q: '100%',
        r: '✓%',
      });
    });

    test('drops a qs it cannot decode, keeping the other params', function (assert) {
      assert.deepEqual(parseRisonQueryString('qs=nope(&x=1'), { x: '1' });
      assert.deepEqual(parseRisonQueryString('qs=(a:1'), {});
    });

    test('drops a qs that is rison but not an object', function (assert) {
      assert.deepEqual(parseRisonQueryString('qs=!(a,b)&x=1'), { x: '1' });
      assert.deepEqual(parseRisonQueryString('qs=word&x=1'), { x: '1' });
      assert.deepEqual(parseRisonQueryString('qs=!n'), {});
    });

    test('qs wins over a plain param of the same name', function (assert) {
      assert.deepEqual(parseRisonQueryString('page=9&qs=(page:2)'), {
        page: 2,
      });
    });

    test('two qs params are read together, the last one winning', function (assert) {
      assert.deepEqual(parseRisonQueryString('qs=(a:1,b:1)&qs=(b:2)'), {
        a: 1,
        b: 2,
      });
    });

    test('with another key, qs is a plain param', function (assert) {
      assert.deepEqual(
        parseRisonQueryString('_a=(a:1)&qs=(b:2)', { key: '_a' }),
        { a: 1, qs: '(b:2)' },
      );
    });
  });

  module('generateRisonQueryString', function () {
    test('one qs, with a ?', function (assert) {
      assert.strictEqual(
        generateRisonQueryString({ projectId: '5', print: true }),
        "?qs=(print:!t,projectId:'5')",
      );
    });

    test('leaves out blank values, keeps false and 0', function (assert) {
      assert.strictEqual(
        generateRisonQueryString({
          a: undefined,
          b: null,
          c: '',
          d: '  ',
          e: [],
          f: false,
          g: 0,
          h: 'x',
          i: {},
        }),
        '?qs=(f:!f,g:0,h:x,i:())',
      );
    });

    test('nothing to write is no query string', function (assert) {
      assert.strictEqual(generateRisonQueryString({}), '');
      assert.strictEqual(generateRisonQueryString({ a: null }), '');
      assert.strictEqual(generateRisonQueryString(undefined), '');
      assert.strictEqual(generateRisonQueryString(null), '');
    });

    test('with another key', function (assert) {
      assert.strictEqual(
        generateRisonQueryString({ a: 1 }, { key: '_g' }),
        '?_g=(a:1)',
      );
    });
  });

  module('isBlank', function () {
    test("answers as Ember's isPresent, for every kind of value", function (assert) {
      const values: [string, unknown][] = [
        ['undefined', undefined],
        ['null', null],
        ["''", ''],
        ["' '", ' '],
        ["'\\n\\t'", '\n\t'],
        ["'\\u00a0'", '\u00a0'],
        ["' a '", ' a '],
        ["'0'", '0'],
        ['0', 0],
        ['-0', -0],
        ['NaN', NaN],
        ['false', false],
        ['true', true],
        ['[]', []],
        ['[0]', [0]],
        ['{}', {}],
        ['{ length: 0 }', { length: 0 }],
        ['{ length: 1 }', { length: 1 }],
        ["{ length: '0' }", { length: '0' }],
        ['{ size: 0 }', { size: 0 }],
        ['{ size: 2 }', { size: 2 }],
        ['{ size: 0, length: 3 }', { size: 0, length: 3 }],
        ['new Map()', new Map()],
        ['new Map([[1, 2]])', new Map([[1, 2]])],
        ['new Set()', new Set()],
        ['new Set([1])', new Set([1])],
        ['new Date()', new Date()],
        ['new Number(0)', new Number(0)],
        ["new String('')", new String('')],
        ['() => {}', () => {}],
        ['function with size 0', Object.assign(() => {}, { size: 0 })],
        ['Symbol()', Symbol('x')],
        ['10n', BigInt(10)],
      ];

      for (const [name, value] of values) {
        assert.strictEqual(isBlank(value), !isPresent(value), name);
      }
    });

    test('as Ember has it', function (assert) {
      for (const value of [undefined, null, '', ' ', '\n\t', []]) {
        assert.true(isBlank(value), JSON.stringify(value) ?? 'undefined');
      }

      for (const value of [false, 0, NaN, {}, [0], 'a', ' a ', new Date()]) {
        assert.false(isBlank(value), JSON.stringify(value));
      }
    });
  });

  module('encodeUriQuery', function () {
    test('keeps @ : $ , ; and encodes the rest as encodeURIComponent', function (assert) {
      assert.strictEqual(encodeUriQuery("@:$,;'()!*"), "@:$,;'()!*");
      assert.strictEqual(
        encodeUriQuery('a b+c=d&e#f?g%h/i'),
        'a%20b%2Bc%3Dd%26e%23f%3Fg%25h%2Fi',
      );
      assert.strictEqual(encodeUriQuery('é'), '%C3%A9');
    });
  });

  module('escapeNestedStrings', function () {
    test('escapes the quotes of a string inside a string', function (assert) {
      assert.strictEqual(
        escapeNestedStrings("(next:'/reports?qs=(a:'b')')"),
        "(next:'/reports?qs=(a:!'b!')')",
      );
    });

    test('leaves rison without nested strings as it is', function (assert) {
      for (const value of [
        "(a:'b c',d:'e')",
        '(a:1,b:!(x,y))',
        "(a:'it!'s')",
      ]) {
        assert.strictEqual(escapeNestedStrings(value), value);
      }
    });
  });
});
