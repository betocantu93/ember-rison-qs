import Route from '@ember/routing/route';

export default class IndexRoute extends Route {
  // typing a search replaces the history entry; the other changes push one
  queryParams = {
    search: { replace: true },
  };
}
