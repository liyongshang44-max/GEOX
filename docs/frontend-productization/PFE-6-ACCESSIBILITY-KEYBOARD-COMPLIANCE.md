<!-- docs/frontend-productization/PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md -->
# PFE-6 Accessibility & Keyboard Compliance

## 0. Phase

PFE-6 establishes the accessibility and keyboard operation baseline for formal Product Frontend v1 surfaces.

This phase is an accessibility baseline. It is not a full WCAG certification report.

## 1. Goal

The formal Product Frontend v1 surfaces have an accessibility and keyboard compliance baseline across Customer, Operator, and Admin.

Chinese completion statement:

```text
Customer、Operator、Admin 正式产品面已经建立可访问性与键盘操作合规基线。
```

## 2. Standard baseline

PFE-6 uses this baseline wording:

```text
WCAG 2.2 AA-oriented baseline
ARIA APG keyboard-pattern alignment
repository-level static gate
route-level manual keyboard checklist
```

PFE-6 does not claim full WCAG 2.2 AA certification, all screen-reader matrix coverage, full responsive completion, or visual regression completion.

## 3. Covered surfaces

Customer Portal:

```text
/customer/dashboard
/customer/fields
/customer/fields/:fieldId
/customer/fields/:fieldId/export
/customer/operations
/customer/operations/:operationId
/customer/operations/:operationId/export
/customer/reports
/customer/export
```

Operator Runtime Console:

```text
/operator/twin
/operator/fields
/operator/fields/:fieldId
/operator/fields/:fieldId/state
/operator/fields/:fieldId/evidence
/operator/fields/:fieldId/forecast
/operator/fields/:fieldId/scenario
/operator/fields/:fieldId/residual
/operator/fields/:fieldId/calibration
/operator/fields/:fieldId/health
/operator/fields/:fieldId/audit
/operator/twin/gateway-demo
/operator/pilot
```

Admin Console:

```text
/admin/dashboard
/admin/fields
/admin/operations
/admin/devices
/admin/evidence
/admin/skills
/admin/healthz
```

Supporting surfaces and components:

```text
/login
LocaleToggle
top navigation
side navigation
breadcrumbs
Product Design System primitives
```

## 4. Non-goals

PFE-6 does not add routes, remove routes, change route topology, add product capability, change backend, change migrations, change contracts, change fixtures, change package files, introduce a UI library, declare WCAG certification, complete visual regression, complete responsive viewport coverage, or redo PFE-3/PFE-4/PFE-5 productization.

## 5. Allowed files

```text
apps/web/src/design-system/product/*
apps/web/src/components/common/LocaleToggle.tsx
apps/web/src/components/layout/AppBreadcrumb.tsx
apps/web/src/components/a11y/*
apps/web/src/styles/productDesignSystem.css
apps/web/src/styles/accessibility.css
apps/web/src/styles.css
docs/frontend-productization/PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md
docs/frontend-productization/PFE-6-ACCESSIBILITY-MATRIX.md
docs/frontend-productization/PFE-6-KEYBOARD-WALKTHROUGH.md
docs/frontend-productization/PFE-6-ACCESSIBILITY-ISSUE-REGISTER.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_6_ACCESSIBILITY_KEYBOARD_COMPLIANCE.cjs
```

## 6. Forbidden files

```text
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
.github/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/web/src/app/routes/*
```

Route topology changes are forbidden.

## 7. Keyboard policy

All interactive elements on formal product surfaces must be reachable with Tab and Shift+Tab. Enter activates links and buttons. Space activates buttons. Route-link tab patterns must use semantic links with readable labels and current-page semantics instead of half-implemented roving tabindex.

PFE-6 allows `tabIndex={0}` for scrollable table regions and `tabIndex={-1}` for skip targets. Positive tabindex values are prohibited.

## 8. Focus policy

Focus indicators must be visible and predictable. PFE-6 adds a shared focus style for links, buttons, form controls, and tabindex-enabled regions.

Skip-to-content is provided by ProductPageShell through ProductSkipLink and the default target `#product-main-content`. The target id is overrideable to avoid duplicate ids if a future page needs multiple shells.

## 9. Landmark policy

ProductPageShell owns the page-level main landmark. It exposes an aria-label or aria-labelledby strategy, a stable skip target id, and no route ownership.

AdminLayout must not reintroduce a nested page-level main around ProductPageShell.

## 10. Heading policy

ProductPageHeader renders the page h1. Eyebrow, metadata, and nonclaim copy do not replace the page heading. ProductPageHeader supports a title id for pages that use aria-labelledby from ProductPageShell.

## 11. Table policy

ProductDataTable requires a caption, renders table headers with `scope="col"`, provides a keyboard-focusable horizontal overflow region, and exposes an accessible empty state when there are no rows.

## 12. Status announcement policy

ProductLoadingState uses polite live announcement and busy semantics.

ProductErrorState uses alert semantics and safe error copy.

ProductStateBlock uses status or alert semantics depending on state kind.

ProductStatusBadge always exposes visible text; color classes are not the status source of truth.

## 13. Locale and navigation policy

LocaleToggle is a labelled button group with button semantics and pressed state.

AppBreadcrumb is a labelled breadcrumb navigation with ordered list semantics and current-page semantics.

## 14. Completion statement

PFE-6 is complete when Customer, Operator, and Admin formal product surfaces have an accessibility and keyboard compliance baseline: landmarks, headings, focus visibility, keyboard reachability, semantic tables, labelled navigation, status semantics, and route-level keyboard walkthroughs are documented and statically gated.
