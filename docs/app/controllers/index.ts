import Controller from '@ember/controller';
import { action } from '@ember/object';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import {
  ISSUES,
  PER_PAGE,
  type Label,
  type Sort,
  type Status,
} from 'docs/playground/issues';

import type RouterService from '@ember/routing/router-service';

export interface Filters {
  status: Status[];
  labels: Label[];
}

export interface PlaygroundState {
  search: string;
  page: number;
  archived: boolean;
  filters: Filters;
  sort: Sort;
}

export const DEFAULTS: PlaygroundState = {
  search: '',
  page: 1,
  archived: false,
  filters: { status: ['open', 'in review'], labels: [] },
  sort: 'updated',
};

const toggle = <T>(list: T[], item: T) =>
  list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

// The playground: every kind of query param, declared as in any Ember app
export default class IndexController extends Controller {
  @service declare router: RouterService;

  // (Ember's types leave out `as`)
  queryParams = [
    'search',
    'page',
    'archived',
    'filters',
    { sort: { as: 's' } },
  ] as unknown as Controller['queryParams'];

  @tracked search = DEFAULTS.search;
  @tracked page = DEFAULTS.page;
  @tracked archived = DEFAULTS.archived;
  @tracked filters: Filters = DEFAULTS.filters;
  @tracked sort: Sort = DEFAULTS.sort;

  get state(): PlaygroundState {
    return {
      search: this.search,
      page: this.page,
      archived: this.archived,
      filters: this.filters,
      sort: this.sort,
    };
  }

  get matching() {
    const search = String(this.search ?? '').toLowerCase();
    const status = this.filters?.status ?? [];
    const labels = this.filters?.labels ?? [];

    return ISSUES.filter(
      (issue) =>
        (this.archived || !issue.archived) &&
        (!status.length || status.includes(issue.status)) &&
        (!labels.length || labels.some((label) => issue.labels.includes(label))) &&
        (!search || issue.title.toLowerCase().includes(search)),
    ).sort((a, b) =>
      this.sort === 'title'
        ? a.title.localeCompare(b.title)
        : b.updated.localeCompare(a.updated),
    );
  }

  get pageCount() {
    return Math.max(1, Math.ceil(this.matching.length / PER_PAGE));
  }

  get currentPage() {
    const page = Number(this.page);

    return Number.isInteger(page) && page >= 1
      ? Math.min(page, this.pageCount)
      : 1;
  }

  get visible() {
    const start = (this.currentPage - 1) * PER_PAGE;

    return this.matching.slice(start, start + PER_PAGE);
  }

  get hasPrevious() {
    return this.currentPage > 1;
  }

  get hasNext() {
    return this.currentPage < this.pageCount;
  }

  @action setSearch(event: Event) {
    this.search = (event.target as HTMLInputElement).value;
    this.page = 1;
  }

  @action toggleStatus(status: Status) {
    this.filters = {
      ...this.filters,
      status: toggle(this.filters.status ?? [], status),
    };
    this.page = 1;
  }

  @action toggleLabel(label: Label) {
    this.filters = {
      ...this.filters,
      labels: toggle(this.filters.labels ?? [], label),
    };
    this.page = 1;
  }

  @action toggleArchived() {
    this.archived = !this.archived;
    this.page = 1;
  }

  @action setSort(event: Event) {
    this.sort = (event.target as HTMLSelectElement).value as Sort;
  }

  @action previousPage() {
    this.page = this.currentPage - 1;
  }

  @action nextPage() {
    this.page = this.currentPage + 1;
  }

  /** The editor's object, as the query params (`sort` is written as `s`). */
  @action apply(state: object) {
    const { sort, ...rest } = { ...DEFAULTS, ...state };

    void this.router.transitionTo({ queryParams: { ...rest, s: sort } });
  }

  @action reset() {
    this.apply(DEFAULTS);
  }
}
