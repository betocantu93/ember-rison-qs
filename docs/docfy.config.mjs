import path from 'node:path';
import { fileURLToPath } from 'node:url';
import docfyShiki from '@docfy/plugin-shiki';

const here = path.dirname(fileURLToPath(import.meta.url));

// Guides are Markdown pages compiled to Ember route templates by Docfy
export default {
  sources: [
    {
      root: path.join(here, 'guides'),
      pattern: '**/*.md',
      urlPrefix: 'guides',
    },
  ],
  // "Edit this page" links (each page's editUrl)
  repository: {
    url: 'https://github.com/betocantu93/ember-rison-qs',
    editBranch: 'master',
  },
  rehypePlugins: [...docfyShiki()],
};
