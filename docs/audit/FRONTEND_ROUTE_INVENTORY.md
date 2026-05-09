# Frontend Route Inventory

Status: P2-H1 route audit baseline  
Scope: frontend routes under `/customer/*`, `/operator/*`, `/admin/*`, and `/legacy/*`  
Source of truth: `apps/web/src/app/App.tsx` plus route modules under `apps/web/src/app/routes/*`

## Purpose

This inventory prevents route, adapter, fallback, documentation, and page ownership drift after P2.

Every route listed below must have:

- owner
- data source / adapter boundary
- customer visibility
- deletion status

Any new frontend route under `/customer/*`, `/operator/*`, `/admin/*`, or `/legacy/*` must update this file in the same PR.

## Governance rules

1. `/customer/*` routes are customer-visible and must use customer-safe data contracts. They must not render raw debug JSON, internal paths, token values, stack traces, or engineering-only enum dumps.
2. `/operator/*` routes are internal operator workbench routes. They may expose action state, permission reason, and audit-facing status, but must not mutate state locally without backend confirmation.
3. `/admin/*` routes are internal administration routes. They are not part of the customer sales/demo surface unless explicitly marked.
4. `/legacy/*` routes exist only for compatibility, debugging, or controlled redirects. They are not customer-visible and should remain deletion candidates unless actively required by engineering support.
5. A route marked `Delete? = No` is a protected route. Removing it requires a release audit decision.
6. A route marked `Delete? = Candidate` may be removed only after backlinks, redirects, docs, and smoke tests are updated.
7. A route marked `Delete? = Redirect only` should not gain new UI or data dependencies.

## Customer routes

| Route | Owner | Data source / adapter | Customer visible | Delete? | Notes |
| --- | --- | --- | --- | --- | --- |
| `/customer` | Customer Product | `CustomerRoutes` redirect to `/customer/dashboard` | Yes | Redirect only | Customer shell root. |
| `/customer/dashboard` | Customer Product | `fetchCustomerDashboard` / customer report adapters | Yes | No | Primary customer landing page. |
| `/customer/export` | Customer Product | Same-source customer dashboard export data | Yes | No | Export must stay page-aligned. |
| `/customer/fields` | Customer Product | `CustomerFieldsIndexPage` customer-safe field summary | Yes | No | Customer field index. |
| `/customer/fields/index` | Customer Product | Redirect to `/customer/fields` | Yes | Redirect only | Compatibility alias. |
| `/customer/fields/new` | Customer Product | Redirect to `/customer/dashboard` | Yes | Redirect only | Customer must not create fields from customer surface. |
| `/customer/fields/portfolio` | Customer Product | Redirect to `/customer/dashboard` | Yes | Redirect only | Portfolio creation/admin concept is not customer-facing here. |
| `/customer/fields/:fieldId` | Customer Product | Field report VM / customer field report API | Yes | No | Field report page. |
| `/customer/fields/:fieldId/export` | Customer Product | Field report export VM / same-source field report data | Yes | No | Export must match field report. |
| `/customer/operations` | Customer Product | `CustomerOperationsIndexPage` customer-safe operation summary | Yes | No | Customer operation index. |
| `/customer/operations/index` | Customer Product | Redirect to `/customer/operations` | Yes | Redirect only | Compatibility alias. |
| `/customer/operations/:operationId` | Customer Product | Operation report VM / `/api/v1/reports/operation/:operationId` | Yes | No | Operation report source of truth. |
| `/customer/operations/:operationId/export` | Customer Product | Operation report export / same-source operation report data | Yes | No | Export must match operation report. |

## Operator routes

| Route | Owner | Data source / adapter | Customer visible | Delete? | Notes |
| --- | --- | --- | --- | --- | --- |
| `/operator` | Operator Workbench | Redirect to `/operator/workbench` | No | Redirect only | Operator shell root. |
| `/operator/workbench` | Operator Workbench | `/api/v1/operator/workbench` via operator adapter | No | No | Main operator landing page. |
| `/operator/approvals` | Operator Workbench | `/api/v1/operator/approvals` plus approval action endpoints | No | No | Approval write actions require backend `permission.allowed`. |
| `/operator/dispatch` | Operator Workbench | `/api/v1/operator/dispatch/worklist` plus dispatch/retry action endpoints | No | No | Dispatch acts only on AO-ACT task state. |
| `/operator/acceptance` | Operator Workbench | `/api/v1/operator/acceptance/worklist` plus acceptance action endpoints | No | No | Acceptance status must come from backend acceptance / operation_state. |
| `/operator/evidence` | Operator Workbench | `/api/v1/operator/evidence` or operator evidence adapter | No | No | Evidence workbench; must not expose internal storage paths. |
| `/operator/devices-alerts` | Operator Workbench | `/api/v1/operator/devices-alerts` or device/alert operator adapter | No | No | Device and alert operations surface. |
| `/operator/roi-ledger` | Operator Workbench | `/api/v1/operator/roi-ledger` or ROI ledger adapter | No | No | Internal ROI ledger review. |
| `/operator/field-memory` | Operator Workbench | `/api/v1/operator/field-memory` or field memory adapter | No | No | Internal field memory review. |

## Admin routes

| Route | Owner | Data source / adapter | Customer visible | Delete? | Notes |
| --- | --- | --- | --- | --- | --- |
| `/admin` | Admin | Admin shell redirect to `/admin/dashboard` | No | Redirect only | Admin shell root. |
| `/admin/dashboard` | Admin | Commercial dashboard/admin dashboard data | No | No | Internal admin dashboard. |
| `/admin/fields` | Admin Field Ops | Field admin APIs / field feature adapter | No | No | Admin field list. |
| `/admin/fields/new` | Admin Field Ops | Field create adapter | No | No | Admin field creation. |
| `/admin/fields/portfolio` | Admin Field Ops | Field portfolio adapter | No | No | Internal portfolio/field management. |
| `/admin/fields/:fieldId` | Admin Field Ops | Field detail adapter | No | No | Admin field detail. |
| `/admin/operations` | Admin Operations | Operations admin APIs / operations feature adapter | No | No | Admin operation list. |
| `/admin/operations/workboard` | Admin Operations | Redirect target currently expected from `/operations/workboard`; confirm route coverage before relying on it | No | Needs review | App-level redirect exists, but AdminShell route coverage should be verified. |
| `/admin/operations/:operationId/debug` | Admin Operations | Admin operation debug adapter | No | Candidate | Debug-only route. Must not be customer-visible. |
| `/admin/devices` | Admin Device Ops | Device admin APIs / devices feature adapter | No | No | Admin device list. |
| `/admin/alerts` | Admin Operations | Alerts adapter | No | No | Internal alerts center. |
| `/admin/evidence` | Admin Evidence | Evidence center adapter | No | No | Internal evidence center. |
| `/admin/skills` | Admin Skill Governance | Skill registry adapter | No | No | Admin skill registry. |
| `/admin/healthz` | Admin / Support | Redirect to `/legacy/admin/healthz` in app shell; direct AdminShell route also exists | No | Needs review | Duplicate/redirect behavior should be tested before deletion. |
| `/admin/import` | Admin / Support | Redirect to `/legacy/admin/import` in app shell; direct AdminShell route also exists | No | Needs review | Duplicate/redirect behavior should be tested before deletion. |
| `/admin/acceptance` | Admin / Support | Redirect to `/legacy/admin/acceptance` in app shell; direct AdminShell route also exists | No | Needs review | Duplicate/redirect behavior should be tested before deletion. |

## Legacy routes

| Route | Owner | Data source / adapter | Customer visible | Delete? | Notes |
| --- | --- | --- | --- | --- | --- |
| `/legacy/settings` | Engineering Support | Settings/session/debug support page | No | Candidate | Legacy support surface. |
| `/legacy/dev` | Engineering Support | Dev tools page | No | Candidate | Debug-only. Must not appear in customer navigation. |
| `/legacy/judge/run` | Engineering Support | Judge run page | No | Candidate | Legacy Judge debug/ops page. |
| `/legacy/judge/records` | Engineering Support | Judge records page | No | Candidate | Legacy Judge records/debug page. |
| `/legacy/judge/config` | Engineering Support | Judge config page | No | Candidate | Legacy Judge config page. |
| `/legacy/sim/config` | Engineering Support | Simulation config page | No | Candidate | Simulation/debug only. |
| `/legacy/admin/healthz` | Engineering Support | Admin health page | No | Candidate | Legacy health page. Keep until health audit route is formalized. |
| `/legacy/admin/import` | Engineering Support | Admin import page | No | Candidate | Legacy import support page. |
| `/legacy/admin/acceptance` | Engineering Support | Admin acceptance page | No | Candidate | Legacy acceptance support page. |
| `/legacy/control/approvals` | Engineering Support | Old approval requests page | No | Candidate | Must not be used by Operator approvals after P2-C. |

## Legacy redirects and compatibility aliases

These routes are not in `/legacy/*`, but they currently redirect to canonical customer, admin, or legacy routes. They should not gain new UI.

| Route | Redirect target | Owner | Customer visible | Delete? | Notes |
| --- | --- | --- | --- | --- | --- |
| `/` | `/customer/dashboard` | Customer Product | Yes | Redirect only | Public app root. |
| `/dashboard` | `/customer/dashboard` | Customer Product | Yes | Redirect only | Historical dashboard root. |
| `/dashboard/customer` | `/customer/dashboard` | Customer Product | Yes | Redirect only | Customer dashboard alias. |
| `/dashboard/export` | `/customer/export` | Customer Product | Yes | Redirect only | Customer export alias. |
| `/fields` | `/admin/fields` or `/customer/dashboard` depending route order | Admin / Customer Product | Mixed | Needs review | Duplicate definition exists in app routes and field route module; must not be expanded. |
| `/fields/:fieldId/report` | `/customer/fields/:fieldId` | Customer Product | Yes | Redirect only | Legacy field report alias. |
| `/fields/:fieldId/report/export` | `/customer/fields/:fieldId/export` | Customer Product | Yes | Redirect only | Legacy field export alias. |
| `/operations/:operationId/report` | `/customer/operations/:operationId` | Customer Product | Yes | Redirect only | Legacy operation report alias. |
| `/operations/:operationId/report/export` | `/customer/operations/:operationId/export` | Customer Product | Yes | Redirect only | Legacy operation export alias. |
| `/devices` | `/admin/devices` or device route module depending route order | Admin Device Ops | No | Needs review | Duplicate route source exists; should be consolidated. |
| `/operations` | `/admin/operations` or operations route module depending route order | Admin Operations | No | Needs review | Duplicate route source exists; should be consolidated. |
| `/operations/workboard` | `/admin/operations/workboard` or operations workboard page depending route order | Admin Operations | No | Needs review | Potential duplicate route behavior. |
| `/alerts` | `/admin/alerts` or alerts route module depending route order | Admin Operations | No | Needs review | Potential duplicate route behavior. |
| `/audit-export` | `/admin/evidence` or evidence route module depending route order | Admin Evidence | No | Needs review | Potential duplicate route behavior. |
| `/skills/registry` | `/admin/skills` or skills route module depending route order | Admin Skill Governance | No | Needs review | Potential duplicate route behavior. |
| `/judge/run` | `/legacy/judge/run` | Engineering Support | No | Redirect only | Legacy alias. |
| `/judge/records` | `/legacy/judge/records` | Engineering Support | No | Redirect only | Legacy alias. |
| `/judge/config` | `/legacy/judge/config` | Engineering Support | No | Redirect only | Legacy alias. |
| `/sim/config` | `/legacy/sim/config` | Engineering Support | No | Redirect only | Legacy alias. |
| `/admin/operations/:operationId/debug` | `/legacy/dev` in app shell; direct AdminShell debug route also exists | Admin / Engineering Support | No | Needs review | Debug route has duplicate behavior. |
| `/control/approvals` | `/legacy/control/approvals` | Engineering Support | No | Redirect only | Must not replace Operator approvals. |
| `/settings` | `/legacy/settings` | Engineering Support | No | Redirect only | Legacy alias. |
| `/dev` | `/legacy/dev` | Engineering Support | No | Redirect only | Legacy alias. |

## Other internal routes outside requested prefixes

These are not `/customer/*`, `/operator/*`, `/admin/*`, or `/legacy/*`, but are included because they may confuse release audit.

| Route | Owner | Data source / adapter | Customer visible | Delete? | Notes |
| --- | --- | --- | --- | --- | --- |
| `/programs` | Program / Agronomy | Program list adapter | No | No | Internal program management. |
| `/programs/create` | Program / Agronomy | Program create adapter | No | No | Internal program initialization. |
| `/programs/new` | Program / Agronomy | Program new adapter | No | No | Internal program creation. |
| `/programs/:programId` | Program / Agronomy | Program detail adapter | No | No | Internal program detail. |
| `/agronomy/recommendations` | Program / Agronomy | Agronomy recommendation adapter | No | No | Internal agronomy recommendation review. |
| `/audit-export` | Evidence / Admin | Evidence export adapter or redirect depending route order | No | Needs review | See legacy alias table. |
| `/delivery/export-jobs` | Evidence / Admin | Export jobs adapter | No | No | Evidence export jobs. |
| `/skills/bindings` | Skill Governance | Skill binding adapter | No | No | Internal skill binding route. |
| `/skills/runs` | Skill Governance | Skill run detail page | No | Needs review | Route points to detail component without `runId`; verify behavior. |
| `/skills/runs/:runId` | Skill Governance | Skill run detail adapter | No | No | Internal skill run detail. |
| `/human-assignments` | Operations | Human assignment adapter | No | No | Internal human execution queue. |
| `/human-assignments/:assignmentId` | Operations | Human assignment detail adapter | No | No | Internal human execution detail. |
| `/dispatch-workbench` | Operations | Dispatch workbench adapter | No | Candidate | May overlap with `/operator/dispatch`; keep until P2-H consolidation decision. |
| `/human-execution-analysis` | Operations | Manual execution analysis adapter | No | Candidate | Internal analytics page. |
| `/human-ops-analytics` | Operations | Human ops analytics adapter | No | Candidate | Internal analytics page. |

## Release audit findings

1. Customer canonical routes are clear: `/customer/dashboard`, `/customer/fields/:fieldId`, `/customer/operations/:operationId`, and their export routes.
2. Operator canonical routes are clear after P2-C: `/operator/workbench`, `/operator/approvals`, `/operator/dispatch`, `/operator/acceptance`, `/operator/evidence`, `/operator/devices-alerts`, `/operator/roi-ledger`, `/operator/field-memory`.
3. Admin and legacy route behavior has duplication risk because app-level redirects and route modules can define overlapping paths. These rows are marked `Needs review` instead of delete-safe.
4. `/legacy/control/approvals` must not be treated as the current approval workbench. The current canonical route is `/operator/approvals`.
5. `/dispatch-workbench` may overlap conceptually with `/operator/dispatch`; it remains internal and should be reviewed in a future consolidation task.

## Update requirement

Any PR that adds, removes, or redirects a frontend route in these namespaces must update this inventory before merge:

- `/customer/*`
- `/operator/*`
- `/admin/*`
- `/legacy/*`

If a route is moved from `Candidate` to `No`, the PR must state the owner and acceptance reason.
