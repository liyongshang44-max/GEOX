<!-- docs/frontend-acceptance/PFA-3-RESPONSIVE-CONTRACT.md -->
# PFA-3 Responsive Shell and Overflow Containment Contract

## Status

```text
phase: PFA-3 Responsive Shell and Overflow Containment
contract: frozen
source route SSOT: docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json
base: merged PFA-2
owned findings: PFA0-RWD-001, PFA0-NAV-001, PFA0-OPR-002, PFA0-OPR-005
```

## Product outcome

PFA-3 establishes a responsive product contract. It does not merely hide overflow.

1. Normal product pages must not create document-level horizontal scrolling.
2. Wide semantic data may scroll only inside labelled, keyboard-focusable internal regions.
3. Customer, Operator, and Admin compact shells must not render the complete desktop sidebar before page content.
4. Page title, product boundary, required route actions, and required route content must remain visible and un-clipped.
5. `zh-CN` and `en-US` must satisfy the same responsive result.

## Route classes and status lifecycle

The matrix is derived from the PFE-13 route inventory.

```text
normal/supporting development: ready-for-runtime
normal/supporting final: runtime-pass
export final: export-deferred
issue register final: closed
```

Route records never use `closed`. Issue records never use `runtime-pass`.

Final matrix requirements:

```text
27 normal/supporting records = runtime-pass
3 export records = export-deferred
planned = 0
pending = 0
capture-gap = 0
```

## Browser case accounting

```text
hard route renders: 27 routes × 2 locales × 3 viewports = 162
export smoke renders: 3 routes × 2 locales × 1 desktop viewport = 6
shell breakpoint probes: 3 surfaces × 2 locales × 2 probes = 12
total browser cases: 180
```

Formal route viewports:

```text
mobileNarrow: 390 × 900
laptopReview: 1366 × 900
desktopReview: 1440 × 1100
```

Shell probes:

```text
compactTablet: 768 × 1024 → compact navigation, desktop sidebar hidden
laptopBoundary: 1024 × 900 → persistent desktop sidebar, mobile trigger hidden
```

The compact-shell breakpoint is frozen at `max-width: 960px`.

## Stable layout hooks

CSS selectors must not depend on localized text, `aria-label`, `title`, translated status strings, or visible copy.

Allowed hooks:

```text
data-page-key
data-layout-key
data-surface
data-width
data-horizontal-scroll-region
data-overflow-owner
explicit structural classes
```

`ProductPageShell` owns `data-page-key`. Shell roots own `data-layout-key`.

## Mobile navigation contract

The shared `ProductMobileNavigation` primitive owns interaction only:

```text
initial aria-expanded=false
aria-controls points to the controlled panel
panel hidden by default
Enter/Space activates the native button
Escape closes
route pathname change closes
close returns focus to trigger
active route retains aria-current=page
disabled items retain aria-disabled=true
```

Route models, permissions, role capability, API access, and desktop sidebar content remain owned by each role layout.

Desktop behavior:

```text
persistent sidebar visible
mobile trigger hidden
mobile panel hidden
desktop navigation keyboard order preserved
```

Compact behavior:

```text
desktop sidebar hidden
compact trigger visible
panel closed by default
page title and page content precede the expanded navigation panel in normal reading flow
```

PFA-3 uses a non-modal disclosure. It does not add a focus trap or body-scroll lock.

## Horizontal overflow contract

`ProductHorizontalScrollRegion` owns the semantic internal-scroll contract:

```text
role="region"
aria-label required
tabIndex=0
data-horizontal-scroll-region="true"
data-overflow-owner required
max-width: 100%
overflow-x: auto
visible focus outline
```

The region itself must remain inside the viewport. Its wide child may have an explicit minimum width.

`ProductDataTable` must reuse this primitive. Operator custom table-like grids must use the primitive or an equivalent wrapper with the exact same contract.

## Text wrapping contract

```text
normal product copy:
  overflow-wrap: break-word
  word-break: normal

status badges and short labels:
  preserve phrase boundaries
  wrap as a unit to the next line
  never use break-all

technical identifiers:
  mark data-long-token="true"
  overflow-wrap: anywhere
```

## Document containment

Each hard route render must satisfy:

```text
document.documentElement.scrollWidth <= window.innerWidth + 1
document.body.scrollWidth <= window.innerWidth + 1
```

Forbidden masking:

```text
html/body/#root overflow-x:hidden
html/body/#root overflow-x:clip
product shell overflow-x:hidden
product shell overflow-x:clip
```

Internal scroll regions are allowed only when they satisfy the semantic contract.

## Per-route assertions

The matrix defines route-specific requirements. The audit must not require every route to expose an action or boundary component it does not own.

Each record declares:

```text
h1Required
boundaryRequired
primaryActionRequired
mobileNavigationRequired
internalOverflowSelectors
requiredSelectors
```

`no unexpected clipped content` is implemented as measurable checks against required selectors and overflow ancestors; it is not a free-form visual assertion.

## Historical gate policy

PFE-6, PFE-7, and PFE-13 are historical closure gates with phase-specific changed-file allowlists. PFA-3 does not execute those scripts as branch allowlist gates.

PFA-3 statically revalidates their applicable invariants:

```text
PFE-6: landmarks, keyboard controls, focus-visible, semantic regions, no positive tabindex
PFE-7: viewport tokens, containment, internal overflow, shell behavior, no overflow masking
PFE-13: unchanged route inventory, route topology, backend, packages, contracts, fixtures, workflows
```

PFA-2 locale acceptance remains an executable regression gate.

## Owned and deferred issues

PFA-3 may close only:

```text
PFA0-RWD-001
PFA0-NAV-001
PFA0-OPR-002
PFA0-OPR-005
```

PFA-3 preserves:

```text
PFA0-EXP-001 → PFA-4
PFA0-CUS-003 → PFA-5
PFA0-CUS-005 → PFA-5
PFA0-CUS-006 → PFA-5
PFA0-OPR-001 → PFA-5
PFA0-OPR-003 → PFA-5
PFA0-ADM-003 → PFA-5
PFA0-OPR-004 → PFA-6
PFA0-ADM-001 → PFA-6
```

Containment work must not be represented as information-architecture, density, export-strategy, device-status-model, or demo-data completion.

## Changed-file boundary

Allowed implementation areas are limited to PFA-3 docs/scripts, shared responsive primitives, three role layouts, responsive shell/runtime styles, necessary Operator containment JSX, and Customer Dashboard containment hooks.

Forbidden:

```text
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
.github/*
package/workspace manifests
apps/web/src/api/*
apps/web/src/app/routes/*
apps/web/src/viewmodels/*
route additions/removals
export responsive strategy
Admin Device status model
demo-data naming
page-density or IA redesign
```

## Completion definition

PFA-3 is complete only when:

```text
162/162 hard route renders pass
6/6 export desktop smoke renders pass
12/12 shell probes pass
document overflow offenders = 0
root overflow masking = 0
internal overflow contract failures = 0
Customer compact navigation pass
Operator compact navigation pass
Admin compact navigation pass
PFA-2 locale regression pass
typecheck, build, bundle, and CI pass
```
