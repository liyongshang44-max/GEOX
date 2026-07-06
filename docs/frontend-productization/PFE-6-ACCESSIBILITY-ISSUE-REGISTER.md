<!-- docs/frontend-productization/PFE-6-ACCESSIBILITY-ISSUE-REGISTER.md -->
# PFE-6 Accessibility Issue Register

## 0. Register policy

This register records known non-blocking accessibility gaps that remain after the PFE-6 baseline. A severe keyboard blocker, missing page-level main landmark, missing page h1, unreachable formal navigation, or status conveyed only by color is not allowed to remain non-blocking.

## 1. Issues

| issue id | surface | severity | reason not fixed in PFE-6 | later phase owner |
|---|---|---|---|---|
| PFE6-A11Y-001 | Customer export / print surfaces | low | Browser print dialog behavior is outside app focus control. Route content and return/print controls remain keyboard reachable. | PFE-9 |
| PFE6-A11Y-002 | Operator Field Runtime tabs | low | Tabs remain semantic route links rather than full ARIA tab widgets. This avoids half-implemented roving tabindex and keeps keyboard behavior predictable. | PFE-9 |
| PFE6-A11Y-003 | All formal surfaces | medium | Full screen-reader/browser/device matrix is not completed in PFE-6. PFE-6 establishes source-level and walkthrough baseline only. | PFE-9 |
| PFE6-A11Y-004 | Responsive/mobile route review | medium | Full responsive viewport completion is outside PFE-6. Keyboard reachability and semantic structure remain covered. | PFE-7 |
| PFE6-A11Y-005 | Visual regression of focus states | medium | PFE-6 adds shared focus styling but does not establish screenshot or visual-regression baselines. | PFE-8/PFE-9 |

## 2. Non-blocking rationale

The issues above do not block PFE-6 because the core baseline requirements are present: ProductSkipLink, ProductPageShell main landmark, ProductPageHeader h1 strategy, semantic breadcrumbs, labelled locale buttons, ProductDataTable caption/scope semantics, loading/error/status semantics, visible focus styling, no positive tabindex, no route topology changes, and no new dependencies.
