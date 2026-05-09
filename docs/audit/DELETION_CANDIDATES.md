# Deletion Candidates

Status: P2-H4 deletion audit baseline  
Scope: frontend routes, API routes, fallback adapters, legacy compatibility surfaces, scripts, and support pages that may be removed or consolidated after P2  
Related inventories:

- `docs/audit/FRONTEND_ROUTE_INVENTORY.md`
- `docs/audit/API_ROUTE_INVENTORY.md`
- `docs/audit/SCRIPT_INVENTORY.md`

## Purpose

This document prevents unsafe cleanup after P2.

A candidate listed here is not automatically approved for deletion. It means the object is no longer part of the canonical P2 product surface or has overlap with a newer route/API/script.

Every deletion must have:

- deletion object
- deletion reason
- reference check
- rollback method
- owner

## Deletion governance rules

1. Do not delete customer official routes, customer official APIs, operator write APIs, or release-gate scripts without a dedicated release audit decision.
2. Do not delete legacy/fallback objects until all frontend adapters, documentation, smoke scripts, OpenAPI entries, and external scripts have been checked.
3. Do not replace a delete candidate with silent fallback behavior. The replacement must be explicit and documented.
4. Do not delete a candidate in the same PR that introduces a replacement unless the PR also includes migration notes and rollback instructions.
5. If a candidate is kept, move its status from `Candidate` to `Retained` and write the reason.

## Candidate status vocabulary

| Status | Meaning |
| --- | --- |
| Candidate | Eligible for later deletion if reference checks pass. |
| Needs review | Do not delete yet; behavior, route order, or consumers are ambiguous. |
| Consolidate | Replace with canonical route/API/script before deletion. |
| Retain | Explicitly kept; not a deletion candidate anymore. |

---

## Frontend route deletion candidates

| Delete object | Status | Deletion reason | Reference check before deletion | Rollback method | Owner |
| --- | --- | --- | --- | --- | --- |
| `/legacy/control/approvals` | Candidate | Superseded by `/operator/approvals` after P2-C approval actions. | Search for `/legacy/control/approvals`, `/control/approvals`, old approval page imports, docs, smoke scripts. Confirm no customer/operator nav links point to it. | Revert route deletion commit or re-add legacy route redirect/page from prior commit. | Operator Workbench / Engineering Support |
| `/control/approvals` redirect alias | Candidate | Old approval alias; canonical route is `/operator/approvals`. | Search links, docs, tests, screenshots, and support scripts. Confirm no browser bookmarks are required for active pilots. | Restore redirect to `/legacy/control/approvals` or `/operator/approvals`. | Operator Workbench / Engineering Support |
| `/legacy/dev` | Candidate | Debug-only page; not part of customer/operator release surface. | Search `/legacy/dev`, `/dev`, `DevPage`, support docs. Confirm no release smoke depends on it. | Revert deletion or restore route behind admin-only/support flag. | Engineering Support |
| `/dev` redirect alias | Candidate | Legacy alias to debug page. | Search docs and support guides for `/dev`. | Restore redirect alias. | Engineering Support |
| `/legacy/settings` | Candidate | Legacy support/settings page; not canonical customer/operator/admin surface. | Search `/legacy/settings`, `/settings`, `SettingsPage`, docs. Confirm no onboarding docs still use it. | Restore route and redirect alias. | Engineering Support |
| `/settings` redirect alias | Candidate | Legacy alias to settings page. | Search public/internal docs and scripts. | Restore redirect alias. | Engineering Support |
| `/legacy/judge/run` | Candidate | Legacy Judge debug route. Not canonical operator/agronomy diagnosis page. | Search judge route references, screenshots, docs, smoke scripts. Confirm no current Judge workflow depends on page. | Restore legacy Judge route. | Judge / Engineering Support |
| `/legacy/judge/records` | Candidate | Legacy Judge records/debug route. | Search route references, docs, smoke scripts. | Restore legacy Judge route. | Judge / Engineering Support |
| `/legacy/judge/config` | Candidate | Legacy Judge config/debug route. | Search route references and config docs. | Restore legacy Judge route. | Judge / Engineering Support |
| `/judge/run` redirect alias | Candidate | Alias to legacy Judge debug route. | Search route references and support docs. | Restore redirect alias. | Judge / Engineering Support |
| `/judge/records` redirect alias | Candidate | Alias to legacy Judge records route. | Search route references and support docs. | Restore redirect alias. | Judge / Engineering Support |
| `/judge/config` redirect alias | Candidate | Alias to legacy Judge config route. | Search route references and support docs. | Restore redirect alias. | Judge / Engineering Support |
| `/legacy/sim/config` | Candidate | Simulation/debug-only page. | Search `/legacy/sim/config`, `/sim/config`, simulator docs and scripts. | Restore route or move to admin-only support surface. | Sensing / Simulator |
| `/sim/config` redirect alias | Candidate | Alias to simulation debug page. | Search docs and support scripts. | Restore redirect alias. | Sensing / Simulator |
| `/legacy/admin/import` | Candidate | Legacy admin import support page; should be replaced by formal admin import if still needed. | Search admin import docs, deployment guides, support runbooks. Confirm formal import route coverage. | Restore legacy import route. | Admin / Engineering Support |
| `/legacy/admin/acceptance` | Candidate | Legacy admin acceptance page; operator acceptance now exists. | Search references, support docs, acceptance workflows. Confirm `/operator/acceptance` covers active use. | Restore legacy admin acceptance route. | Acceptance / Engineering Support |
| `/legacy/admin/healthz` | Candidate | Legacy health page; formal API health endpoints remain. | Search docs and support screenshots. Confirm `/api/admin/healthz` and deployment checks cover need. | Restore legacy health route. | Runtime / Admin |
| `/dispatch-workbench` | Consolidate | Overlaps conceptually with `/operator/dispatch`. | Search for links/imports/tests. Compare functionality with `/operator/dispatch`. Confirm operator dispatch has equivalent or stronger task state/actions. | Restore route or keep as redirect to `/operator/dispatch`. | Operator Workbench / Operations |
| `/human-execution-analysis` | Candidate | Internal analytics page, not canonical P2 operator/customer surface. | Search nav links, docs, analytics dependencies. Confirm no release demos depend on it. | Restore route. | Operations Analytics |
| `/human-ops-analytics` | Candidate | Internal analytics page, not canonical P2 operator/customer surface. | Search nav links, docs, analytics dependencies. | Restore route. | Operations Analytics |
| `/admin/operations/:operationId/debug` | Needs review | Debug route appears to have duplicate behavior with app-shell redirect and admin route. | Search route definitions and route order. Test actual navigation result before deletion. | Restore exact route definition from prior commit. | Admin Operations / Engineering Support |
| `/fields` legacy/admin alias | Needs review | Duplicate route source risk with app-level redirect and field route module. | Search route definitions and test route resolution order. Confirm canonical `/admin/fields` and `/customer/fields` cover all users. | Restore redirect or route module entry. | Admin Field Ops / Customer Product |
| `/devices` legacy/admin alias | Needs review | Duplicate route source risk with admin/device route module. | Search route definitions, nav links, support docs. | Restore redirect or module route. | Admin Device Ops |
| `/operations` legacy/admin alias | Needs review | Duplicate route source risk with operation route module and admin route. | Search route definitions and test route resolution order. | Restore redirect or module route. | Admin Operations |
| `/alerts` legacy/admin alias | Needs review | Duplicate route source risk with admin alerts route. | Search route definitions and nav links. | Restore redirect or module route. | Admin Operations |
| `/audit-export` alias | Needs review | Duplicate route source risk with evidence/admin export route. | Search route definitions, export docs, smoke tests. | Restore redirect or module route. | Evidence / Admin |
| `/skills/registry` alias | Needs review | Duplicate route source risk with `/admin/skills` and skill route module. | Search route definitions and skill docs. | Restore redirect or module route. | Skill Governance |

---

## API deletion / consolidation candidates

| Delete object | Status | Deletion reason | Reference check before deletion | Rollback method | Owner |
| --- | --- | --- | --- | --- | --- |
| `/api/control/*` legacy AO-ACT APIs | Candidate | Superseded by `/api/v1/actions/*` and operator facades. | Search scripts, docs, old device/executor clients, acceptance runners, and frontend adapters for `/api/control`. | Restore legacy route module registration. | AO-ACT / Compatibility |
| Old approval compatibility APIs under `/api/control/approvals*` | Candidate | Superseded by `/api/v1/approvals/*` and `/api/v1/operator/approvals/*`. | Search backend/frontend/scripts/docs for old approval endpoints. Confirm operator approvals use new API. | Restore legacy approval route module. | Approval / Compatibility |
| Old device compatibility APIs under `/api/devices/*` | Candidate | Superseded by `/api/v1/devices/*`. | Search onboarding docs, device credential scripts, compose examples, executor clients. | Restore legacy device route module. | Device Ops / Compatibility |
| Old sensing compatibility APIs under `/api/sense/*` or equivalent legacy sense routes | Candidate | Superseded by `/api/v1/sense/*`. | Search telemetry-ingest, simulator, MQTT docs, scripts, and old clients. | Restore legacy sense route module. | Sensing / Compatibility |
| `/api/v1/reports/customer-dashboard/aggregate` | Consolidate | Transitional customer fallback API; should not remain a second source of truth. | Search customer dashboard adapters and export code. Confirm replacement official dashboard API provides all required fields. | Restore aggregate route and frontend fallback adapter. | Customer Product / Reporting |
| `/api/v1/reports/customer-dashboard/field-portfolio-summary` | Consolidate | Transitional dashboard/portfolio fallback API. | Search frontend field portfolio/dashboard usage. Confirm official API replacement. | Restore route and adapter fallback. | Customer Product / Reporting |
| `/api/v1/actions/index` as operator dispatch data source | Consolidate | Operator dispatch now prefers `/api/v1/operator/dispatch/worklist`. | Search frontend fallback usage. Confirm operator dispatch worklist is stable and smoke-covered. | Restore fallback in `operatorDispatch.ts`. | AO-ACT / Operator Workbench |
| Legacy monitoring/media support APIs | Needs review | Compatibility support surface may overlap formal evidence/report APIs. | Search docs, media rendering paths, static artifact use, customer report references. | Restore legacy monitoring module registration. | Evidence / Runtime Support |
| Judge debug APIs | Candidate | Debug/internal, not formal customer/operator API. | Search Judge pages, support docs, scripts. Confirm no acceptance gate relies on them. | Restore Judge route module. | Judge / Engineering Support |
| Simulation config APIs | Candidate | Debug/internal simulator support. | Search simulator docs, telemetry scripts, dev support flows. | Restore sim config route/module. | Sensing / Simulator |

---

## Script deletion / consolidation candidates

| Delete object | Status | Deletion reason | Reference check before deletion | Rollback method | Owner |
| --- | --- | --- | --- | --- | --- |
| `pnpm dev:judge`, `typecheck:judge`, `build:judge` root scripts | Needs review | Root scripts reference `@geox/judge`; active workspace presence should be verified. | Check `pnpm-workspace.yaml` / workspace packages and CI. Search docs for judge root scripts. | Re-add root scripts from prior commit. | Judge / Workspace Governance |
| `pnpm --filter @geox/executor build` stub build | Consolidate | Currently exits 0; gives false confidence if treated as compile gate. | Search CI/release docs for executor build. Replace with real build or remove from release gate docs. | Restore stub command if external pipeline requires it. | Execution / Release Governance |
| `pnpm --filter @geox/telemetry-ingest build` stub build | Consolidate | Currently exits 0; gives false confidence if treated as compile gate. | Search CI/release docs for telemetry build. Replace with real build or remove from release gate docs. | Restore stub command if external pipeline requires it. | Sensing / Release Governance |
| Older one-off smoke scripts not referenced by package scripts | Candidate | May be stale or superseded by formal release gates. | Search by filename in package scripts, docs, CI, PowerShell runbooks. | Restore script file from prior commit. | QA / Release Governance |
| Legacy PowerShell acceptance wrappers | Needs review | May duplicate Node acceptance runners but still useful for Windows field ops. | Search `.ps1` files, docs, user runbooks, and CI references. Confirm Windows users have replacement commands. | Restore wrapper script from prior commit. | QA / Windows Support |

---

## Frontend adapter / fallback deletion candidates

| Delete object | Status | Deletion reason | Reference check before deletion | Rollback method | Owner |
| --- | --- | --- | --- | --- | --- |
| Customer dashboard fallback adapter using `/api/v1/reports/customer-dashboard/aggregate` | Consolidate | Customer dashboard should have a single official dashboard API/data source. | Search `fetchCustomerDashboard`, customer dashboard VM, export code, tests. Confirm official API returns all display/export fields. | Restore fallback adapter branch. | Customer Product / Reporting |
| Operator approvals fallback to `/api/v1/approvals/requests` | Consolidate | `/api/v1/operator/approvals` is now the operator read facade. | Search `operatorApprovals.ts`. Confirm operator approvals worklist is stable and deployed. | Restore fallback code path. | Operator Workbench / Approval |
| Operator acceptance fallback to `/api/v1/operator/acceptance` or customer aggregate | Consolidate | `/api/v1/operator/acceptance/worklist` is now canonical. | Search `operatorAcceptance.ts`. Confirm worklist covers all acceptance statuses. | Restore fallback code path. | Operator Workbench / Acceptance |
| Operator dispatch fallback to `/api/v1/actions/index` and customer aggregate | Consolidate | `/api/v1/operator/dispatch/worklist` is now canonical. | Search `operatorDispatch.ts`. Confirm worklist covers task/dispatch/receipt states. | Restore fallback code path. | Operator Workbench / Dispatch |
| Legacy operation report aliases | Candidate | Canonical route is `/customer/operations/:operationId`. | Search links and docs for `/operations/:operationId/report`. Confirm redirect analytics not required. | Restore redirect alias. | Customer Product |
| Legacy field report aliases | Candidate | Canonical route is `/customer/fields/:fieldId`. | Search links and docs for `/fields/:fieldId/report`. Confirm redirect analytics not required. | Restore redirect alias. | Customer Product |

---

## Documentation deletion / consolidation candidates

| Delete object | Status | Deletion reason | Reference check before deletion | Rollback method | Owner |
| --- | --- | --- | --- | --- | --- |
| Old docs that call themselves SSOT outside `docs/SSOT.md` | Candidate | SSOT should have one formal entry. | Search for `SSOT`, `source of truth`, and old migration docs. Confirm links point to `docs/SSOT.md`. | Restore doc or add redirect note. | Documentation Governance |
| Docs referencing `/api/control/*` as primary API | Candidate | `/api/v1/*` is canonical. | Search docs for `/api/control`. Replace with v1 routes or mark legacy. | Restore doc section from prior commit. | API Governance |
| Docs referencing customer fallback APIs as primary source | Candidate | Customer official API should be primary. | Search docs for `customer-dashboard/aggregate`. Confirm official/fallback language. | Restore doc section from prior commit. | Customer Product / Reporting |
| Old P1-only runbooks that conflict with P2 operator write actions | Needs review | P2-C introduced operator write action contract. | Search docs for old operator facade readonly-only language. Update rather than delete when still useful. | Restore doc section from prior commit. | Operator Workbench / Documentation |

---

## Required deletion checklist

Before deleting any candidate, the PR must include evidence for the following checks:

1. Code search for the exact route/API/script/doc path.
2. Frontend navigation and adapter check.
3. Backend route registration check.
4. OpenAPI check if the object is an API.
5. Script/package.json check if the object is a script.
6. Documentation and runbook check.
7. Smoke/acceptance check for the affected domain.
8. Rollback commit note or explicit restoration plan.

## Rollback standards

A deletion PR must state one of these rollback methods:

- revert the deletion commit
- restore a redirect alias
- restore a legacy route module registration
- restore a fallback adapter branch
- restore a script file and package.json entry
- restore a doc section and mark it legacy

Rollback must not require manual database changes unless the deletion PR explicitly altered database objects.

## Release audit findings

1. Most immediate deletion risk is not code removal; it is accidental re-use of legacy/fallback surfaces as new sources of truth.
2. The safest first cleanup candidates are redirect aliases and debug pages, but only after route reference checks pass.
3. API deletion should lag frontend adapter consolidation. Do not delete fallback APIs before the corresponding fallback adapter is removed.
4. Script cleanup must distinguish true release gates from stub/dev utility commands.
5. The P2 operator write APIs are not deletion candidates.

## Update requirement

Any PR that deletes, consolidates, or retains a candidate must update this file.

For each changed candidate, update:

- status
- deletion reason
- reference check result
- rollback method
- owner
