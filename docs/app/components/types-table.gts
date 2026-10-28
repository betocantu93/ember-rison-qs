import type { TOC } from '@ember/component/template-only';

interface Signature {
  Args: {
    /** What the controller has */
    state: object;
    /** Query params written under another name: { sort: 's' } */
    urlNames?: Record<string, string>;
  };
}

interface Row {
  key: string;
  value: string;
  type: string;
  nested: boolean;
}

const typeOf = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    const kinds = [...new Set(value.map(typeOf))];

    return value.length ? `list of ${kinds.join(' / ')}s` : 'empty list';
  }

  return typeof value;
};

const rowsOf = (
  state: object,
  urlNames: Record<string, string> = {},
): Row[] =>
  Object.entries(state).flatMap(([key, value]) => {
    const name = urlNames[key] ? `${key} (as ${urlNames[key]})` : key;
    const row = {
      key: name,
      value: JSON.stringify(value),
      type: typeOf(value),
      nested: false,
    };

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return [
        row,
        ...Object.entries(value).map(([inner, innerValue]) => ({
          key: `${key}.${inner}`,
          value: JSON.stringify(innerValue),
          type: typeOf(innerValue),
          nested: true,
        })),
      ];
    }

    return [row];
  });

// What the controller has, with each value's type: the point of the addon
<template>
  <table class="types" data-test-types>
    <thead>
      <tr><th scope="col">Query param</th><th scope="col">Value</th><th
          scope="col"
        >Type</th></tr>
    </thead>
    <tbody>
      {{#each (rowsOf @state @urlNames) as |row|}}
        <tr class={{if row.nested "types-nested"}}>
          <th scope="row"><code>{{row.key}}</code></th>
          <td><code>{{row.value}}</code></td>
          <td><span class="type-pill">{{row.type}}</span></td>
        </tr>
      {{/each}}
    </tbody>
  </table>
</template> satisfies TOC<Signature>;
