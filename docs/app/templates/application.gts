import { pageTitle } from 'ember-page-title';
import { LinkTo } from '@ember/routing';

<template>
  {{pageTitle "ember-rison-qs"}}
  <header class="site-header">
    <LinkTo @route="index" class="brand"><span
        class="brand-mark"
      >(qs)</span>
      ember-rison-qs</LinkTo>
    <nav aria-label="Site">
      <LinkTo @route="index">Playground</LinkTo>
      <LinkTo @route="guides.getting-started">Guides</LinkTo>
      <a
        href="https://github.com/betocantu93/ember-rison-qs"
        target="_blank"
        rel="noopener noreferrer"
      >GitHub</a>
      <a
        href="https://www.npmjs.com/package/ember-rison-qs"
        target="_blank"
        rel="noopener noreferrer"
      >npm</a>
    </nav>
  </header>
  <main class="site-main">
    {{outlet}}
  </main>
</template>
