# Server State Conventions (TanStack Query)

- Query Key format: `[domain, scope, ...params]`
  - Domain examples: `dashboard`, `fields`, `devices`, `operations`, `programs`, `evidence`.
  - Scope examples: `list`, `detail`, `summary`, `scheduling`.
- Always define keys in `shared/query/keys.ts` and reuse them in hooks/pages.
- User-facing error text must use `toUserErrorMessage` from `shared/query/errors.ts`.
  - Do not expose raw exception stack, SQL error, or transport details to end users.
  - Keep fallback messages action-oriented (e.g. “请稍后重试”, “请刷新后重试”).

This module is the unified entry for server state. Existing pages can be migrated incrementally from `useEffect + loading/error` to Query-based hooks.
