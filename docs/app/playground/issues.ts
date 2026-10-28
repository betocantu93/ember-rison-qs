// The playground's data: a small issue tracker, filtered by the query params

export const STATUSES = ['open', 'in review', 'closed'] as const;
export const LABELS = ['bug', 'router', 'docs', 'perf'] as const;
export const SORTS = { updated: 'Recently updated', title: 'Title' } as const;

export type Status = (typeof STATUSES)[number];
export type Label = (typeof LABELS)[number];
export type Sort = keyof typeof SORTS;

export interface Issue {
  id: number;
  title: string;
  status: Status;
  labels: Label[];
  archived: boolean;
  updated: string;
}

export const ISSUES: Issue[] = [
  { id: 101, title: "Search for O'Brien (jr) breaks the page", status: 'closed', labels: ['bug', 'router'], archived: false, updated: '2026-10-27' },
  { id: 102, title: 'Page number comes back as a string', status: 'closed', labels: ['bug', 'router'], archived: false, updated: '2026-10-26' },
  { id: 103, title: 'Filters reset when going back', status: 'open', labels: ['bug'], archived: false, updated: '2026-10-25' },
  { id: 104, title: 'Document the `key` option', status: 'in review', labels: ['docs'], archived: false, updated: '2026-10-24' },
  { id: 105, title: 'Default filters stay in the address', status: 'closed', labels: ['router'], archived: false, updated: '2026-10-23' },
  { id: 106, title: 'Deep link from the mobile app opens the wrong tab', status: 'open', labels: ['router'], archived: false, updated: '2026-10-22' },
  { id: 107, title: 'Model reloads for an equal filter', status: 'in review', labels: ['perf', 'router'], archived: false, updated: '2026-10-21' },
  { id: 108, title: 'Explain routes as data', status: 'open', labels: ['docs'], archived: false, updated: '2026-10-20' },
  { id: 109, title: 'Shared links lose the selected labels', status: 'open', labels: ['bug'], archived: false, updated: '2026-10-19' },
  { id: 110, title: 'Long addresses on old proxies', status: 'closed', labels: ['perf'], archived: true, updated: '2026-10-18' },
  { id: 111, title: 'Back after sign-in loses the page', status: 'in review', labels: ['router'], archived: false, updated: '2026-10-17' },
  { id: 112, title: 'Upgrade guide from 0.x', status: 'closed', labels: ['docs'], archived: true, updated: '2026-10-16' },
  { id: 113, title: 'Ember 7: refreshModel runs twice', status: 'closed', labels: ['router', 'perf'], archived: false, updated: '2026-10-15' },
  { id: 114, title: 'A stray % drops every filter', status: 'closed', labels: ['bug'], archived: false, updated: '2026-10-14' },
  { id: 115, title: 'Example with ember-parachute', status: 'open', labels: ['docs'], archived: false, updated: '2026-10-13' },
  { id: 116, title: 'isActive is false for an equal object', status: 'closed', labels: ['router'], archived: false, updated: '2026-10-12' },
  { id: 117, title: 'Plain ?page=2 links from emails', status: 'open', labels: ['router'], archived: false, updated: '2026-10-11' },
  { id: 118, title: 'Lists of numbers become strings', status: 'closed', labels: ['bug', 'router'], archived: false, updated: '2026-10-10' },
  { id: 119, title: 'Measure encode time on big filters', status: 'open', labels: ['perf'], archived: false, updated: '2026-10-09' },
  { id: 120, title: "Old bookmarks with page:'4'", status: 'in review', labels: ['bug'], archived: true, updated: '2026-10-08' },
];

export const PER_PAGE = 5;
