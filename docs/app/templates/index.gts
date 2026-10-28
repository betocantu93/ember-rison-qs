import { fn, get, hash } from '@ember/helper';
import { on } from '@ember/modifier';
import { LinkTo } from '@ember/routing';
import { pageTitle } from 'ember-page-title';

import AddressBar from 'docs/components/address-bar';
import JsonEditor from 'docs/components/json-editor';
import TypesTable from 'docs/components/types-table';
import { LABELS, SORTS, STATUSES } from 'docs/playground/issues';

import type { TOC } from '@ember/component/template-only';
import type IndexController from 'docs/controllers/index';

const json = (value: unknown) => JSON.stringify(value, null, 2);
const has = (list: unknown[] | undefined, item: unknown) =>
  (list ?? []).includes(item);
const eq = (a: unknown, b: unknown) => a === b;
const slug = (text: string) => text.replace(/\s+/g, '-');
const sortEntries = Object.entries(SORTS);

<template>
  {{pageTitle "Playground"}}

  <section class="intro">
    <h1>Typed query params, in one readable URL param</h1>
    <p>
      Change anything below and watch the address, in your browser's own bar and
      here. Then use Back and Forward, reload, or open the link in another tab:
      the page comes back exactly as it was, with numbers as numbers and lists
      as lists.
    </p>
  </section>

  <AddressBar @state={{@controller.state}} />

  <div class="playground">
    <section class="panel" aria-labelledby="app-title">
      <header class="panel-head">
        <h2 id="app-title">The app</h2>
        <p>An issue list whose filters are query params.</p>
      </header>

      <div class="controls">
        <label class="field">
          <span>Search</span>
          <input
            type="search"
            id="search"
            value={{@controller.search}}
            placeholder="Try: it's (a) !test"
            {{on "input" @controller.setSearch}}
          />
        </label>

        <fieldset class="field">
          <legend>Status</legend>
          <div class="chips">
            {{#each STATUSES as |status|}}
              <label class="chip">
                <input
                  type="checkbox"
                  id="status-{{status}}"
                  checked={{has @controller.filters.status status}}
                  {{on "change" (fn @controller.toggleStatus status)}}
                />
                {{status}}
              </label>
            {{/each}}
          </div>
        </fieldset>

        <fieldset class="field">
          <legend>Labels</legend>
          <div class="chips">
            {{#each LABELS as |name|}}
              <label class="chip">
                <input
                  type="checkbox"
                  id="label-{{name}}"
                  checked={{has @controller.filters.labels name}}
                  {{on "change" (fn @controller.toggleLabel name)}}
                />
                {{name}}
              </label>
            {{/each}}
          </div>
        </fieldset>

        <div class="field-row">
          <label class="chip">
            <input
              type="checkbox"
              id="archived"
              checked={{@controller.archived}}
              {{on "change" @controller.toggleArchived}}
            />
            Show archived
          </label>
          <label class="field field-inline">
            <span>Sort</span>
            <select id="sort" {{on "change" @controller.setSort}}>
              {{#each sortEntries as |entry|}}
                <option
                  value={{get entry 0}}
                  selected={{eq @controller.sort (get entry 0)}}
                >{{get entry 1}}</option>
              {{/each}}
            </select>
          </label>
        </div>
      </div>

      <ul class="issues" data-test-issues>
        {{#each @controller.visible as |issue|}}
          <li class="issue">
            <span class="issue-id">#{{issue.id}}</span>
            <span class="issue-title">{{issue.title}}</span>
            <span class="issue-meta">
              <span class="status status-{{slug issue.status}}">{{issue.status}}</span>
              {{#each issue.labels as |name|}}
                <span class="label">{{name}}</span>
              {{/each}}
              {{#if issue.archived}}<span class="label">archived</span>{{/if}}
            </span>
          </li>
        {{else}}
          <li class="issue-empty">No issue matches these filters.</li>
        {{/each}}
      </ul>

      <nav class="pager" aria-label="Pages">
        <button
          type="button"
          class="button"
          disabled={{if @controller.hasPrevious false true}}
          {{on "click" @controller.previousPage}}
        >Previous</button>
        <span>Page
          {{@controller.currentPage}}
          of
          {{@controller.pageCount}}
          · {{@controller.matching.length}}
          issues</span>
        <button
          type="button"
          class="button"
          disabled={{if @controller.hasNext false true}}
          {{on "click" @controller.nextPage}}
        >Next</button>
      </nav>
    </section>

    <section class="panel" aria-labelledby="state-title">
      <header class="panel-head">
        <h2 id="state-title">The state</h2>
        <p>The controller's query params as JSON. Edit them, apply, and the
          address and the app follow.</p>
      </header>

      <JsonEditor
        @value={{json @controller.state}}
        @onApply={{@controller.apply}}
        @onReset={{@controller.reset}}
      />

      <h3 class="panel-subhead">What the controller has</h3>
      <TypesTable
        @state={{@controller.state}}
        @urlNames={{hash sort="s"}}
      />
    </section>
  </div>

  <section class="setup" aria-labelledby="setup-title">
    <h2 id="setup-title">The setup behind this page</h2>
    <pre><code>// app/router.ts
setupRouter() {
  const didSetUp = super.setupRouter();
  if (didSetUp) useRisonQueryParams(this);
  return didSetUp;
}

// app/controllers/index.ts: query params, as in any Ember app
queryParams = ['search', 'page', 'archived', 'filters', { sort: { as: 's' } }];
@tracked page = 1;
@tracked filters = { status: ['open', 'in review'], labels: [] };</code></pre>
    <p><LinkTo @route="guides.getting-started">Read the guides</LinkTo>
      to set it up in your app.</p>
  </section>
</template> satisfies TOC<{ Args: { controller: IndexController } }>;
