import EmberApp from 'ember-strict-application-resolver';
import EmberRouter from '@ember/routing/router';
import PageTitleService from 'ember-page-title/services/page-title';

import { useRisonQueryParams } from '#src/index.ts';

// Set up as the README says
class Router extends EmberRouter {
  location = 'history';
  rootURL = '/';

  setupRouter() {
    const didSetUp = super.setupRouter();

    if (didSetUp) {
      useRisonQueryParams(this);
    }

    return didSetUp;
  }
}

export class App extends EmberApp {
  modules = {
    './router': Router,
    './services/page-title': PageTitleService,
    ...import.meta.glob('./controllers/**/*', { eager: true }),
    ...import.meta.glob('./templates/**/*', { eager: true }),
  };
}

Router.map(function () {});
