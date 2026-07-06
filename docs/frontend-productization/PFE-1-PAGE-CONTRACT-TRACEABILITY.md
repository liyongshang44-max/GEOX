<!-- docs/frontend-productization/PFE-1-PAGE-CONTRACT-TRACEABILITY.md -->
# PFE-1 Page Contract Traceability

## 0. Purpose

This file maps PFE-1 contract closure back to the PFE-0 page audit matrix.

PFE-1 references PFE-0 as source baseline and must not introduce route inventory from memory.

## 1. Formal and secondary surfaces

| route / surface | PFE-0 classification | PFE-1 handling | owner | implementation phase | trace |
|---|---|---|---|---|---|
| /customer/dashboard | formal v1 page | Contract closed | Customer Portal | PFE-3 | PFE-0 matrix -> PFE-1 contract register |
| /customer/fields | formal v1 page | Contract closed | Customer Portal | PFE-3 | PFE-0 matrix -> PFE-1 contract register |
| /customer/fields/:fieldId | formal sub-surface | Contract closed | Customer Portal | PFE-3 | PFE-0 matrix -> PFE-1 contract register |
| /customer/fields/:fieldId/export | export / print secondary surface | Contract closed | Customer Portal | PFE-3 | PFE-0 matrix -> PFE-1 contract register |
| /customer/operations | formal v1 page | Contract closed | Customer Portal | PFE-3 | PFE-0 matrix -> PFE-1 contract register |
| /customer/operations/:operationId | formal sub-surface | Contract closed | Customer Portal | PFE-3 | PFE-0 matrix -> PFE-1 contract register |
| /customer/operations/:operationId/export | export / print secondary surface | Contract closed | Customer Portal | PFE-3 | PFE-0 matrix -> PFE-1 contract register |
| /customer/reports | formal v1 page | Contract closed | Customer Portal | PFE-3 | PFE-0 matrix -> PFE-1 contract register |
| /customer/export | export / print secondary surface | Contract closed | Customer Portal | PFE-3 | PFE-0 matrix -> PFE-1 contract register |
| /operator/twin | formal v1 page | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/fields | formal v1 page | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/fields/:fieldId | formal sub-surface | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/fields/:fieldId/state | formal sub-surface | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/fields/:fieldId/evidence | formal sub-surface | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/fields/:fieldId/forecast | formal sub-surface | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/fields/:fieldId/scenario | formal sub-surface | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/fields/:fieldId/residual | formal sub-surface | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/fields/:fieldId/calibration | formal sub-surface | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/fields/:fieldId/health | formal sub-surface | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/fields/:fieldId/audit | formal sub-surface | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /operator/twin/gateway-demo | formal v1 page | Contract closed | Operator Runtime Console | PFE-10 | PFE-0 matrix -> PFE-1 contract register |
| /operator/pilot | formal v1 page | Contract closed | Operator Runtime Console | PFE-4 | PFE-0 matrix -> PFE-1 contract register |
| /admin/dashboard | formal v1 page | Contract closed | Admin Console | PFE-5 | PFE-0 matrix -> PFE-1 contract register |
| /admin/fields | formal v1 page | Contract closed | Admin Console | PFE-5 | PFE-0 matrix -> PFE-1 contract register |
| /admin/operations | formal v1 page | Contract closed | Admin Console | PFE-5 | PFE-0 matrix -> PFE-1 contract register |
| /admin/devices | formal v1 page | Contract closed | Admin Console | PFE-5 | PFE-0 matrix -> PFE-1 contract register |
| /admin/evidence | formal v1 page | Contract closed | Admin Console | PFE-5 | PFE-0 matrix -> PFE-1 contract register |
| /admin/skills | formal v1 page | Contract closed with route naming debt | Admin Console | PFE-5 | PFE-0 matrix -> PFE-1 contract register |
| /admin/healthz | formal v1 page | Contract closed with route naming debt | Admin Console | PFE-5 | PFE-0 matrix -> PFE-1 contract register |

## 2. URL-only compatibility surfaces

These surfaces have no formal contract, no formal nav, no page polish obligation, and no accessibility completion obligation under PFE-1.

- /admin/alerts: classification preserved; non-contract surface.
- /admin/acceptance: classification preserved; non-contract surface.
- /admin/import: classification preserved; non-contract surface.
- /admin/operations/:operationId/debug: classification preserved; non-contract surface.
- /legacy/*: classification preserved; non-contract surface.
- /judge/*: classification preserved; non-contract surface.
- /sim/*: classification preserved; non-contract surface.
- /settings: classification preserved; non-contract surface.
- /dev: classification preserved; non-contract surface.

## 3. Future product-contract pages

These pages are contract deferred. They must not be implemented or designed under PFE-1.

- /operator/evidence: contract deferred.
- /operator/health: contract deferred.
- /operator/settings: contract deferred.
- /customer/evidence-summary: contract deferred.
- /admin/tenants: contract deferred.
- /admin/imports: contract deferred.
- /admin/audit: contract deferred.
- /admin/config: contract deferred.
- /admin/health: contract deferred.

## 4. Do-not-build pages

These surfaces remain explicitly prohibited, not backlog, and not PFE owner phase.

- Customer Dispatch: prohibited, not backlog.
- Customer AO-ACT: prohibited, not backlog.
- Customer ROI Ledger: prohibited, not backlog.
- Customer Field Memory: prohibited, not backlog.
- Operator Dispatch Console: prohibited, not backlog.
- Operator AO-ACT Control: prohibited, not backlog.
- Operator Live Device Monitor: prohibited, not backlog.
- Operator Production Gateway Online: prohibited, not backlog.
- Operator Field Pilot Execution: prohibited, not backlog.
- Admin Debug Formal Page: prohibited, not backlog.
- Admin Acceptance Formal Nav Page: prohibited, not backlog.
- Legacy Dev Tools Formal Page: prohibited, not backlog.
