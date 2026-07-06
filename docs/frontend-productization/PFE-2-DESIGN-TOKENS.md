<!-- docs/frontend-productization/PFE-2-DESIGN-TOKENS.md -->
# PFE-2 Design Tokens

## 0. Purpose

PFE-2 introduces Product Design System v1 tokens in `apps/web/src/styles/productDesignSystem.css`.

The tokens are additive. They do not replace all existing CSS and do not claim page migration is complete.

## 1. Token names

Required token names:

```text
--product-surface-bg
--product-surface-panel
--product-surface-border
--product-text-primary
--product-text-secondary
--product-text-muted
--product-focus-ring
--product-radius-sm
--product-radius-md
--product-radius-lg
--product-space-1
--product-space-2
--product-space-3
--product-space-4
--product-space-6
--product-font-size-xs
--product-font-size-sm
--product-font-size-md
--product-font-size-lg
--product-font-size-xl
--product-line-height
--product-shadow-panel
--product-status-neutral
--product-status-readonly
--product-status-replay
--product-status-disabled
--product-status-degraded
--product-status-blocked
```

## 2. Token purpose

Surface tokens define page and panel backgrounds.

Text tokens define primary, secondary, and muted product copy.

Focus tokens define keyboard focus visibility.

Radius, space, font-size, line-height, and shadow tokens define reusable product layout rhythm.

Status tokens define boundary surfaces for neutral, read-only, replay-backed, disabled, degraded, and blocked presentation.

## 3. Product classes

Required product classes:

```text
.productPageShell
.productPageHeader
.productSectionCard
.productBoundaryBanner
.productStatusBadge
.productMetricTile
.productDataTable
.productEmptyState
.productLoadingState
.productErrorState
.productStateBlock
.productTraceLink
.productScopeBar
```

## 4. Forbidden semantic token names

PFE-2 forbids color-coded or action-coded semantic names such as red, green, yellow, danger, success, risk-red, priority-high, dispatch-active, ao-act-ready, live-online, and production-online.

Colors may exist as CSS values. The restriction is on semantic names that would create false product meaning.

## 5. Relationship to existing CSS

PFE-2 does not delete or replace existing CSS. Product Design System v1 is additive.

Existing surface CSS can coexist until PFE-3/PFE-4/PFE-5 migrate formal pages onto product primitives.
