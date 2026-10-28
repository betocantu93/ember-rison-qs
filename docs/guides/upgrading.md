---
order: 8
---

# Upgrading from 0.x

0.x was a mixin for the application route. Now:

1. Remove `RisonQsMixin` from your application route.
2. Add `useRisonQueryParams(this)` to your router's `setupRouter` (see Setup).

URLs stay the same `?qs=(...)`, so links already shared keep working. What's new: plain params (`?page=2`) beside or without `qs`, typed values that survive Ember's router, defaults compared by value, and the route location helpers.
