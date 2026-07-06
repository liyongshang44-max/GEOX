<!-- docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md -->
# PFE-2 Design System v1 Completion

## 0. Phase

PFE-2 Design System v1 Completion / PFE-2 产品设计系统 v1 完成.

PFE-2 follows PFE-1 Page Contract Closure. PFE-1 closed page contracts. PFE-2 creates reusable product primitives and product tokens for later PFE page productization phases.

## 1. Goal

PFE-2 moves the frontend from per-page assembled UI toward shared formal product primitives.

Allowed completion statement:

```text
Product Design System v1 primitives are available for later PFE productization phases.
```

PFE-2 does not claim existing pages have already migrated to these primitives.

## 2. Source baseline

PFE-2 uses these prior artifacts as its source baseline:

```text
docs/frontend-productization/PFE-1-PAGE-CONTRACT-CLOSURE.md
docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md
docs/frontend-productization/PFE-1-PAGE-CONTRACT-TEMPLATE.md
docs/frontend-productization/PFE-1-PAGE-CONTRACT-TRACEABILITY.md
```

## 3. Non-goals

PFE-2 does not redesign Customer Dashboard, Operator Console pages, or Admin Console pages.

PFE-2 does not change routes, backend code, migrations, packages, contracts, fixtures, runtime semantics, app workflows, or external dependencies.

PFE-2 does not add Playwright.

PFE-2 does not complete accessibility repair, responsive repair, or visual regression.

PFE-2 does not open operational mutation surfaces.

## 4. Deliverables

PFE-2 adds documentation, Product Design System primitives, CSS tokens/classes, and static acceptance.

Product primitives:

```text
ProductPageShell
ProductPageHeader
ProductSectionCard
ProductBoundaryBanner
ProductStatusBadge
ProductMetricTile
ProductDataTable
ProductEmptyState
ProductLoadingState
ProductErrorState
ProductStateBlock
ProductTraceLink
ProductScopeBar
```

## 5. Allowed files

PFE-2 may modify only:

```text
apps/web/src/design-system/product/*
apps/web/src/styles/productDesignSystem.css
docs/frontend-productization/PFE-2-*.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_2_DESIGN_SYSTEM_V1_COMPLETION.cjs
```

This PR intentionally does not wire productDesignSystem.css into apps/web/src/styles.css. Later PFE-3/PFE-4/PFE-5 page productization can import or globalize the stylesheet when pages begin consuming the primitives.

## 6. Forbidden files

PFE-2 must not modify:

```text
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
.github/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

PFE-2 also avoids route files, feature pages, layouts, and global app wiring in this PR.

## 7. CSS and token rules

The product stylesheet defines stable product tokens for surface background, panels, borders, text, focus ring, radius, spacing, font sizes, line height, panel shadow, and status boundary surfaces.

The product stylesheet defines product classes for each primitive.

Forbidden semantic token names include red, green, yellow, danger, success, risk-red, priority-high, dispatch-active, ao-act-ready, live-online, and production-online. These terms may appear only in documentation or acceptance forbidden lists, not as CSS or component semantics.

## 8. Boundary rules

Product primitives display state and structure only.

Product primitives must not own routing, persistence, execution, approvals, model updates, device behavior, gateway state, or pilot state.

Product primitives must preserve the PFE-1 distinction between formal page contracts, URL-only compatibility, future product-contract pages, and do-not-build pages.

## 9. Acceptance

PFE-2 acceptance verifies docs, component exports, primitive files, CSS tokens/classes, allowed status semantics, allowed boundary tones, required state semantics, table caption/aria behavior, loading aria-live, safe error state, forbidden token avoidance, and forbidden file changes.

## 10. Completion statement

Product Design System v1 primitives and product tokens are available for later PFE productization phases.

中文：

产品设计系统 v1 的基础组件和产品 token 已就绪，可供后续 PFE 产品化阶段使用。
