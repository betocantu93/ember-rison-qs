import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { pageTitle } from 'ember-page-title';

import type ApplicationController from '../controllers/application.ts';
import type { TOC } from '@ember/component/template-only';

<template>
  {{pageTitle "ember-rison-qs"}}

  <main>
    <h1>ember-rison-qs</h1>
    <p>Change the values: the address keeps them all in one readable, typed
      <code>qs</code>
      param. Reload, or go back and forward: they come back as they were.</p>

    <section class="url">
      <h2>The address</h2>
      <code data-test-url>{{@controller.url}}</code>
      <details>
        <summary>As the browser sends it</summary>
        <code>{{@controller.rawUrl}}</code>
      </details>
    </section>

    <form>
      <label>
        Search
        <input
          type="search"
          value={{@controller.search}}
          {{on "input" @controller.setSearch}}
          placeholder="try it's (a) !test"
        />
      </label>

      <fieldset>
        <legend>Status (a list inside an object)</legend>
        {{#each @controller.statuses as |status|}}
          <label>
            <input
              type="checkbox"
              checked={{@controller.isChecked status}}
              {{on "change" (fn @controller.toggleStatus status)}}
            />
            {{status}}
          </label>
        {{/each}}
      </fieldset>

      <label>
        Owner (a string or null)
        <input
          value={{@controller.filters.owner}}
          {{on "input" @controller.setOwner}}
        />
      </label>

      <div>
        Page (a number)
        <button type="button" {{on "click" @controller.previousPage}}>−</button>
        <output>{{@controller.page}}</output>
        <button type="button" {{on "click" @controller.nextPage}}>+</button>
      </div>

      <label>
        <input
          type="checkbox"
          checked={{@controller.archived}}
          {{on "change" @controller.toggleArchived}}
        />
        Archived (a boolean)
      </label>

      <label>
        Sort (written as
        <code>s</code>)
        <select {{on "change" @controller.setSort}}>
          <option
            value="date"
            selected={{eq @controller.sort "date"}}
          >date</option>
          <option
            value="name"
            selected={{eq @controller.sort "name"}}
          >name</option>
        </select>
      </label>

      <button type="button" {{on "click" @controller.reset}}>Back to the
        defaults</button>
    </form>

    <section>
      <h2>What the controller has</h2>
      <pre>{{@controller.values}}</pre>
    </section>
  </main>
</template> satisfies TOC<{ Args: { controller: ApplicationController } }>;

function eq(a: unknown, b: unknown) {
  return a === b;
}
