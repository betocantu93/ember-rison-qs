import EmberRouter from '@embroider/router';
import { addDocfyRoutes } from '@docfy/ember';
import { useRisonQueryParams } from 'ember-rison-qs';
import config from 'docs/config/environment';

// Set up as the README says: the playground's query params are rison
export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;

  setupRouter() {
    const didSetUp = super.setupRouter();

    if (didSetUp) {
      useRisonQueryParams(this);
    }

    return didSetUp;
  }
}

Router.map(function () {
  addDocfyRoutes(this);
});
