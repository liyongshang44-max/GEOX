# F2 Performance Budget

## Phase

F2-F Performance Budget.

## Purpose

Prevent accidental frontend bloat and route-loading regression before frontend freeze.

F2 establishes a qualitative budget. It does not introduce a bundle analyzer, package dependency, or performance tooling PR.

## Required register

The F2 baseline requires:

- build:web passes
- bundle/chunk awareness is documented
- no new dependency
- no heavyweight dependency
- no eager import of all formal surfaces into the shell
- route lazy-loading preserved
- large static copy registry does not import runtime data
- copy registry does not import API clients
- LocaleToggle does not import API clients
- performance budget is not weakened to pass

## Budget categories

| Category | Budget |
| --- | --- |
| Application shell budget | Do not eagerly import all formal pages into a shell. |
| Operator formal surface budget | Keep route-level loading behavior and avoid dispatch/live-runtime imports. |
| Customer formal surface budget | Keep Customer pages scoped to Customer read surfaces and export scaffolds. |
| Admin formal surface budget | Keep Admin pages scoped to governance/readback surfaces. |
| Static copy registry budget | May contain bilingual copy but must not import API clients or runtime data. |
| CSS budget | Use shared primitives and existing shell styles; do not add package-level CSS framework dependency. |

## Dependency boundary

No package dependency changes are allowed in F2. `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` are blocked.

## Route loading boundary

Route lazy-loading must be preserved. F2 must not move all formal surfaces into eager imports from shell/layout code.

## Copy registry boundary

The copy registries must remain static text registries. They must not import API clients, backend callers, route modules, or runtime state.

## LocaleToggle boundary

LocaleToggle remains local UI state only. It must not import API clients. It must not call backend APIs. It must not change route topology.

## Acceptance hooks

The F2 acceptance gate checks for build:web documentation, no new dependency, no heavyweight dependency, no eager import, route lazy-loading preserved, copy registry does not import API clients, and LocaleToggle does not import API clients.

## Non-goals

No bundle analyzer. No automated performance lab result. No package-approved dependency introduction. No runtime production readiness claim.
