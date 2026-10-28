import Controller from '@ember/controller';
import { action } from '@ember/object';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import type RouterService from '@ember/routing/router-service';

const STATUSES = ['open', 'in review', 'closed'] as const;

export default class ApplicationController extends Controller {
  @service declare router: RouterService;

  // (Ember's types leave out `as`)
  queryParams = [
    'search',
    'page',
    'archived',
    'filters',
    { sort: { as: 's' } },
  ] as unknown as Controller['queryParams'];

  statuses = STATUSES;

  @tracked search = '';
  @tracked page = 1;
  @tracked archived = false;
  @tracked filters: { status: string[]; owner: string | null } = {
    status: ['open'],
    owner: null,
  };
  @tracked sort = 'date';

  get url() {
    return decodeURIComponent(this.router.currentURL ?? '');
  }

  get rawUrl() {
    return this.router.currentURL ?? '';
  }

  get values() {
    return JSON.stringify(
      {
        search: this.search,
        page: this.page,
        archived: this.archived,
        filters: this.filters,
        sort: this.sort,
      },
      null,
      2,
    );
  }

  isChecked = (status: string) => this.filters.status.includes(status);

  @action setSearch(event: Event) {
    this.search = (event.target as HTMLInputElement).value;
  }

  @action setOwner(event: Event) {
    const owner = (event.target as HTMLInputElement).value;

    this.filters = { ...this.filters, owner: owner || null };
  }

  @action toggleStatus(status: string) {
    const current = this.filters.status;

    this.filters = {
      ...this.filters,
      status: current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status],
    };
  }

  @action nextPage() {
    this.page = this.page + 1;
  }

  @action previousPage() {
    this.page = Math.max(1, this.page - 1);
  }

  @action toggleArchived() {
    this.archived = !this.archived;
  }

  @action setSort(event: Event) {
    this.sort = (event.target as HTMLSelectElement).value;
  }

  @action reset() {
    void this.router.transitionTo({
      queryParams: {
        search: '',
        page: 1,
        archived: false,
        filters: { status: ['open'], owner: null },
        s: 'date',
      },
    });
  }
}
