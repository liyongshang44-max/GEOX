<!-- docs/frontend-productization/PFE-2-DESIGN-SYSTEM-INVENTORY.md -->
# PFE-2 Design System Inventory

## 0. Purpose

This inventory records the Product Design System v1 primitives created by PFE-2.

Each primitive is a reusable product UI building block for later PFE-3, PFE-4, PFE-5, PFE-6, PFE-7, PFE-8, PFE-9, and PFE-12 work.

## 1. Inventory

| component name | file path | purpose | allowed props | forbidden behavior | accessibility requirement | responsive requirement | state support | later PFE users |
|---|---|---|---|---|---|---|---|---|
| ProductPageShell | apps/web/src/design-system/product/ProductPageShell.tsx | Shared product page structure and main landmark. | surface, width, top, aside, children, ariaLabel | route selection or page-specific data loading | main landmark and aria label | standard, wide, full, stacked narrow layout | page shell around all states | PFE-3, PFE-4, PFE-5 |
| ProductPageHeader | apps/web/src/design-system/product/ProductPageHeader.tsx | Shared title, eyebrow, lead, metadata, actions, and nonclaim slot. | title, eyebrow, lead, metadata, primaryAction, secondaryActions, nonclaim | default CTA creation | h1 hierarchy and action grouping | action stack on narrow layout | nonclaim display | PFE-3, PFE-4, PFE-5 |
| ProductSectionCard | apps/web/src/design-system/product/ProductSectionCard.tsx | Shared product panel/card container. | title, subtitle, meta, status, footer, children | hard-coded business status | section landmark and heading | responsive header stack | card-level status slot | PFE-3, PFE-4, PFE-5 |
| ProductBoundaryBanner | apps/web/src/design-system/product/ProductBoundaryBanner.tsx | Shared read-only, replay-backed, disabled, degraded, or blocked boundary message. | tone, title, description, items, ariaLabel | using tone as business conclusion | aria label and readable list | wraps content on narrow layout | neutral, readOnly, replayBacked, disabled, degraded, blocked | PFE-3, PFE-4, PFE-5, PFE-10 |
| ProductStatusBadge | apps/web/src/design-system/product/ProductStatusBadge.tsx | Shared status tag with approved semantics only. | status, label, ariaLabel | unapproved status words or route behavior | aria label | inline wrap | available, unavailable, partial, readOnly, replayBacked, notConnected, notOnline, disabled, degraded, blocked, future, urlOnly, doNotBuild | PFE-3, PFE-4, PFE-5 |
| ProductMetricTile | apps/web/src/design-system/product/ProductMetricTile.tsx | Shared metric display with source and status slots. | label, value, unit, description, status, source | default interpretation, ranking, priority, or action | readable label/value order | card grid compatible | optional status slot | PFE-3, PFE-4, PFE-5 |
| ProductDataTable | apps/web/src/design-system/product/ProductDataTable.tsx | Shared semantic table without external library. | caption, columns, rows, getRowKey, emptyState, mobileFallbackNote | virtual table, hidden mutation controls | caption, th scope, overflow region | overflow wrapper and fallback note | empty table state | PFE-3, PFE-4, PFE-5 |
| ProductEmptyState | apps/web/src/design-system/product/ProductEmptyState.tsx | Shared empty-state copy block. | title, description, reason, nextSafeAction | unsafe operational CTA by default | section label and heading | narrow card layout | empty | PFE-3, PFE-4, PFE-5 |
| ProductLoadingState | apps/web/src/design-system/product/ProductLoadingState.tsx | Shared loading copy block. | label, description | silent loading state | aria-live polite and aria-busy | inline or card layout | loading | PFE-3, PFE-4, PFE-5 |
| ProductErrorState | apps/web/src/design-system/product/ProductErrorState.tsx | Shared safe error copy block. | title, message, retry, traceId | raw stack trace, SQL detail, internal payload | role alert | card layout | error | PFE-3, PFE-4, PFE-5, PFE-6 |
| ProductStateBlock | apps/web/src/design-system/product/ProductStateBlock.tsx | Shared unavailable/degraded/permission/replay/non-contract state block. | kind, title, description, details | data fetching or mutation | aria label | card layout | empty, loading, error, unavailable, degraded, permissionLimited, replayBacked, notConnected, notOnline, disabled, future, urlOnly, doNotBuild | PFE-3, PFE-4, PFE-5, PFE-6 |
| ProductTraceLink | apps/web/src/design-system/product/ProductTraceLink.tsx | Shared trace/source identity display. | label, traceId, href, sourceType | automatic trace fetch | aria label and code text | inline wrap | trace present or missing by caller state | PFE-3, PFE-4, PFE-5 |
| ProductScopeBar | apps/web/src/design-system/product/ProductScopeBar.tsx | Shared read-only tenant/project/field/operation/role scope. | surface, items, ariaLabel | editing scope | dl semantics and aria label | wraps on narrow layout | scoped or permission-limited pages | PFE-3, PFE-4, PFE-5 |

## 2. Cross-cutting rule

All primitives are presentation primitives. They do not own route topology, page data loading, persistence, execution workflow, or runtime authority.
