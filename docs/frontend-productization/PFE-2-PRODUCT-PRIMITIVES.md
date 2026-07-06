<!-- docs/frontend-productization/PFE-2-PRODUCT-PRIMITIVES.md -->
# PFE-2 Product Primitives Guidance

## 0. Purpose

This guide defines how later PFE phases should use Product Design System v1 primitives.

PFE-2 creates primitives only. It does not migrate formal pages.

## 1. Customer Portal usage

PFE-3 should use ProductPageShell, ProductPageHeader, ProductSectionCard, ProductMetricTile, ProductDataTable, ProductEmptyState, ProductLoadingState, ProductErrorState, ProductBoundaryBanner, ProductTraceLink, and ProductScopeBar to productize Customer Portal pages.

Customer pages should use customer-safe reporting language. They should not become command, internal governance, or debug surfaces.

Export and print surfaces should use ProductPageShell, ProductPageHeader, ProductSectionCard, ProductDataTable, ProductEmptyState, ProductErrorState, and ProductTraceLink with print-safe copy.

## 2. Operator Runtime Console usage

PFE-4 should use the primitives to standardize read-only runtime review surfaces.

Operator pages should use ProductBoundaryBanner and ProductStatusBadge to show read-only, replay-backed, not-connected, not-online, disabled, degraded, future, URL-only, and do-not-build boundaries without claiming live runtime authority.

Field Runtime tabs should keep separate page-level composition. State, evidence, forecast, scenario, residual, calibration, health, and audit surfaces must not collapse into one generic contract.

## 3. Admin Console usage

PFE-5 should use the primitives to standardize internal governance and readback pages.

Admin pages should keep formal navigation separate from URL-only compatibility surfaces. Admin Skills and Admin Healthz should continue to carry route naming debt until a separate route cleanup contract is approved.

## 4. Boundary and nonclaim usage

ProductBoundaryBanner should carry visible nonclaims where required by the PFE-1 contract register.

ProductStateBlock should represent unavailable, degraded, permission-limited, replay-backed, not-connected, not-online, disabled, future, URL-only, and do-not-build states.

ProductStatusBadge should use only the approved status vocabulary exported from ProductStatusBadge.tsx.

## 5. Data and trace usage

ProductTraceLink displays trace/source identity. It does not fetch trace data.

ProductDataTable receives rows and columns from a caller. It does not own data loading.

ProductMetricTile displays values and source context. It does not interpret priority or recommend action.

## 6. Implementation rule

Later PFE phases can compose pages from these primitives, but route ownership, data ownership, and page contract ownership must remain with their specific PFE phase.
