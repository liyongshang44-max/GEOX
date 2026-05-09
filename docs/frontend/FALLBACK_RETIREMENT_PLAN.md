# Fallback Retirement Plan

Status: P2-H5 fallback retirement baseline  
Scope: customer dashboard fallbacks, customer field/operation/report fallbacks, and operator fallback paths introduced or retained through P2  
Related audit files:

- `docs/frontend/CUSTOMER_DATA_SOURCE_MAP_V1.md`
- `docs/audit/FRONTEND_ROUTE_INVENTORY.md`
- `docs/audit/API_ROUTE_INVENTORY.md`
- `docs/audit/DELETION_CANDIDATES.md`

## Purpose

P2 introduced stronger official customer APIs and operator workbench facades. This plan prevents fallback paths from becoming permanent second sources of truth.

The retirement goal is not to delete all fallback code immediately. The goal is to move fallbacks through controlled stages:

1. **Allowed fallback**: fallback may be used in normal product flow while official API is incomplete.
2. **Emergency only**: fallback may run only when official API is unavailable, blocked by deployment failure, or explicitly enabled for support.
3. **Deleted**: fallback code path is removed after official API and smoke coverage are stable.

## Global fallback rules

1. Fallback data must never be presented as stronger than official data.
2. Fallback must be labeled in the VM or page state when visible to operators or support.
3. Customer-facing fallback must use formal empty/error states, not raw debug payloads.
4. Fallback must not fabricate geometry, weather, evidence manifest, sha256, download URL, ROI, field memory, final_status, acceptance pass, or dispatch completion.
5. Fallback retirement must be done by PR with audit notes and rollback path.
6. Once a fallback is marked emergency-only, new product work must not add features to that fallback path.

## Stage definitions

| Stage | Meaning | Allowed usage | Release requirement |
| --- | --- | --- | --- |
| Allowed fallback | Normal fallback while official API is not yet complete. | Product page may call fallback when official API does not exist or lacks required fields. | Page must label data scope or keep customer-safe empty state. |
| Emergency only | Official API is the default and fallback is only for support/deployment failure. | Fallback can be used only behind explicit support path, feature flag, or failure handling. | Release notes must state fallback is not normal path. |
| Deleted | Fallback code is removed. | No runtime usage. | All references, docs, tests, OpenAPI, and adapters updated. |

## Retirement matrix

| Fallback area | Current fallback source | Official replacement | Target stage | Retirement owner |
| --- | --- | --- | --- | --- |
| customerFields dashboard fallback | Dashboard aggregate / customer dashboard-derived field summaries | `/api/v1/customer/fields` plus `/api/v1/reports/field/:field_id` for details | Emergency only after field index is official and smoke-covered | Customer Product / Reporting |
| customerOperations dashboard fallback | Dashboard aggregate / customer dashboard-derived operation summaries | `/api/v1/customer/operations` plus `/api/v1/reports/operation/:operation_id` for details | Emergency only after operation index is official and smoke-covered | Customer Product / Reporting |
| customerReports dashboard fallback | `/api/v1/reports/customer-dashboard/aggregate` used as report/dashboard source | Official customer dashboard/report API plus `/api/v1/customer/reports` | Emergency only after dashboard/report center official API is complete | Customer Product / Reporting |
| operator approvals fallback | `/api/v1/approvals/requests` fallback | `/api/v1/operator/approvals` | Delete after operator approval read/action smoke is stable | Operator Workbench / Approval |
| operator acceptance fallback | older `/api/v1/operator/acceptance` or report aggregate fallback | `/api/v1/operator/acceptance/worklist` | Delete after acceptance worklist/action smoke is stable | Operator Workbench / Acceptance |
| operator dispatch fallback | `/api/v1/actions/index` or report aggregate fallback | `/api/v1/operator/dispatch/worklist` | Delete after dispatch worklist/action smoke is stable | Operator Workbench / Dispatch |

---

## customerFields dashboard fallback

### Fallback object

Customer field list or field summary data derived from dashboard aggregate rather than the official customer field list API.

Examples of fallback sources:

- `/api/v1/reports/customer-dashboard/aggregate`
- dashboard `key_fields` or similar aggregate-derived field summaries
- temporary `/customer/fields/index` compatibility behavior

### Official replacement

- `/api/v1/customer/fields` for the customer-visible field index
- `/api/v1/customer/fields/:fieldId/geometry` for customer-safe geometry
- `/api/v1/reports/field/:field_id` for field detail/report pages

### Emergency-only criteria

Move this fallback to **emergency only** when all conditions are true:

1. `/api/v1/customer/fields` returns the complete customer-safe field index needed by `/customer/fields`.
2. Field index page no longer depends on dashboard aggregate to list fields.
3. Field detail page uses `/api/v1/reports/field/:field_id` as the report source of truth.
4. Field export uses the same source as the field page.
5. Empty state is customer-safe when no fields exist.
6. `pnpm --filter @geox/web check:customer-routes` passes.
7. `pnpm --filter @geox/web check:customer-export-same-source` passes.
8. Release audit confirms no customer page treats dashboard aggregate field summary as the official field list.

### Emergency-only behavior

When emergency-only, the fallback may be used only when:

- official field API returns 5xx or is unavailable during deployment;
- support explicitly enables fallback for a pilot environment;
- the UI clearly keeps customer-safe empty/error messaging.

It must not be used to add new field attributes or features.

### Deletion criteria

Delete this fallback when two consecutive release candidates pass customer field smoke without fallback usage.

### Rollback

Re-enable dashboard-derived field fallback in the customer field adapter and restore the audit note in this document from `Deleted` to `Emergency only`.

### Owner

Customer Product / Reporting.

---

## customerOperations dashboard fallback

### Fallback object

Customer operation list or operation summary data derived from dashboard aggregate rather than the official customer operation list API.

Examples of fallback sources:

- `/api/v1/reports/customer-dashboard/aggregate`
- dashboard `recent_operations` or similar aggregate-derived operation summaries
- temporary `/customer/operations/index` compatibility behavior

### Official replacement

- `/api/v1/customer/operations` for the customer-visible operation index
- `/api/v1/reports/operation/:operation_id` for operation report/detail pages

### Emergency-only criteria

Move this fallback to **emergency only** when all conditions are true:

1. `/api/v1/customer/operations` returns the complete customer-safe operation index needed by `/customer/operations`.
2. Operation index page no longer depends on dashboard aggregate to list operations.
3. Operation detail page uses `/api/v1/reports/operation/:operation_id` as source of truth.
4. Operation export uses the same source as operation detail page.
5. Operation status and final_status are not derived by frontend fallback logic.
6. Evidence summary and evidence pack summary states remain backend-owned.
7. `pnpm --filter @geox/web check:customer-export-same-source` passes.
8. Release audit confirms dashboard aggregate operation summary is no longer treated as the official operation list.

### Emergency-only behavior

When emergency-only, the fallback may be used only for support or deployment failure. It must not:

- infer final_status;
- infer acceptance pass;
- infer evidence pack readiness from evidence count;
- add new customer operation display fields.

### Deletion criteria

Delete this fallback when two consecutive release candidates pass customer operation list/report/export smoke without fallback usage.

### Rollback

Restore aggregate-derived operation fallback in the customer operation adapter and mark this fallback back to `Emergency only`.

### Owner

Customer Product / Reporting.

---

## customerReports dashboard fallback

### Fallback object

Customer dashboard/report center data sourced primarily from `/api/v1/reports/customer-dashboard/aggregate` rather than a formal customer dashboard/report API.

Examples of fallback sources:

- `/api/v1/reports/customer-dashboard/aggregate`
- `/api/v1/reports/customer-dashboard/field-portfolio-summary`
- dashboard summary stitched from multiple report/fallback APIs

### Official replacement

- formal customer dashboard API returning one render-ready customer dashboard payload
- `/api/v1/customer/reports` for report center/listing
- `/api/v1/reports/field/:field_id` and `/api/v1/reports/operation/:operation_id` for details

### Emergency-only criteria

Move this fallback to **emergency only** when all conditions are true:

1. Customer dashboard has a single official API that returns render-ready summary, risk, field, operation, device, evidence, and value sections required by the page.
2. Dashboard export uses the same official source as dashboard page.
3. Report center uses `/api/v1/customer/reports` or another official customer report list API.
4. `offline_devices`, `top_risk_reasons`, and customer-facing summaries are computed backend-side or by a single official VM contract, not stitched from partial dashboard fallback slices.
5. Dashboard no longer derives customer risk from arbitrary `recent_operations.slice(...)` or incomplete key-field slices.
6. `pnpm --filter @geox/web check:customer-boundary` passes.
7. `pnpm --filter @geox/web check:customer-export-same-source` passes.
8. Release audit confirms `/api/v1/reports/customer-dashboard/aggregate` is fallback only.

### Emergency-only behavior

When emergency-only, dashboard aggregate may be used only for:

- pilot support when the official dashboard API is down;
- migration comparison during one release window;
- explicit rollback after official dashboard API regression.

It must not be used as a normal data source for new dashboard cards, report center sections, exports, or sales-demo claims.

### Deletion criteria

Delete this fallback when:

1. official dashboard API has passed two release candidates;
2. dashboard page and export use official API only;
3. report center no longer depends on aggregate data;
4. docs and smoke scripts no longer name aggregate as a primary source.

### Rollback

Restore aggregate adapter and page fallback branch from prior commit. Release notes must label the rollback as temporary emergency fallback.

### Owner

Customer Product / Reporting.

---

## Operator fallback retirement

Operator fallback paths are stricter than customer fallback paths because P2-C introduced write actions. Operator pages must not enable write buttons from fallback data.

### Operator fallback objects

| Operator page | Fallback source | Canonical source | Target |
| --- | --- | --- | --- |
| `/operator/approvals` | `/api/v1/approvals/requests` | `/api/v1/operator/approvals` | Delete |
| `/operator/acceptance` | older `/api/v1/operator/acceptance` or customer/report aggregate fallback | `/api/v1/operator/acceptance/worklist` | Delete |
| `/operator/dispatch` | `/api/v1/actions/index` or customer/report aggregate fallback | `/api/v1/operator/dispatch/worklist` | Delete |
| `/operator/evidence` | generic evidence/report fallback | `/api/v1/operator/evidence` | Emergency only until evidence operator contract is formalized |
| `/operator/devices-alerts` | generic device/alert fallback | `/api/v1/operator/devices-alerts` | Emergency only until device-alert operator contract is formalized |
| `/operator/roi-ledger` | generic ROI/report fallback | `/api/v1/operator/roi-ledger` | Emergency only until ROI operator contract is formalized |
| `/operator/field-memory` | generic field-memory/report fallback | `/api/v1/operator/field-memory` | Emergency only until field-memory operator contract is formalized |

### Delete criteria for operator fallback

Delete operator fallback when all conditions are true:

1. Canonical operator API returns `dataScope: OFFICIAL_OPERATOR_API` or equivalent official source marker.
2. The page has no need to read fallback fields for display.
3. Write buttons are enabled only from canonical operator API permissions.
4. Fallback path is no longer needed for empty state.
5. Backend smoke exists for the canonical operator facade.
6. Frontend typecheck and build pass.
7. `pnpm --filter @geox/web check:operator-boundary` passes.

### Specific operator fallback deletion gates

#### Operator approvals

Delete `/api/v1/approvals/requests` fallback from operator approvals when:

- `/api/v1/operator/approvals` is stable in staging;
- approve/reject/return actions are smoke-tested;
- self-approval blocking is validated;
- failed action reasons render on `/operator/approvals`;
- no frontend code path enables approval buttons from fallback data.

Owner: Operator Workbench / Approval.

#### Operator acceptance

Delete old acceptance/report aggregate fallback from operator acceptance when:

- `/api/v1/operator/acceptance/worklist` is stable in staging;
- evaluate and request-review actions are smoke-tested;
- `EVIDENCE_INSUFFICIENT` renders correctly;
- frontend never infers `final_status`;
- operation report reflects backend acceptance result after evaluate.

Owner: Operator Workbench / Acceptance.

#### Operator dispatch

Delete `/api/v1/actions/index` and report aggregate fallback from operator dispatch when:

- `/api/v1/operator/dispatch/worklist` is stable in staging;
- dispatch and retry actions are smoke-tested;
- missing task returns `TARGET_NOT_FOUND`;
- completed/receipt-bearing task cannot retry;
- failure reason renders on `/operator/dispatch`;
- customer operation report does not become acceptance-pass because dispatch succeeded.

Owner: Operator Workbench / Dispatch.

### Operator fallback emergency-only rule

Before deletion, operator fallback may remain but must obey:

1. fallback data is read-only;
2. fallback disables all write buttons;
3. fallback shows an explicit limited/fallback data scope message;
4. fallback cannot create, infer, or mutate backend status.

### Rollback

If canonical operator API regresses after fallback deletion:

1. revert the fallback deletion commit;
2. restore fallback as read-only only;
3. keep all write buttons disabled on fallback data;
4. add a release note marking fallback as temporary emergency path.

---

## Required PR checklist for fallback retirement

Every fallback-retirement PR must include:

1. exact fallback object removed or downgraded;
2. official replacement API/adapter;
3. proof that the official API supports the required page state;
4. frontend typecheck result;
5. relevant smoke/release-gate result;
6. audit update to this file;
7. rollback plan.

## Recommended release gates

For customer fallback retirement:

```bash
pnpm --filter @geox/web typecheck
pnpm --filter @geox/web build
pnpm --filter @geox/web check:customer-boundary
pnpm --filter @geox/web check:customer-export-same-source
pnpm --filter @geox/web check:customer-routes
pnpm --filter @geox/web check:no-raw-enum-customer
```

For operator fallback retirement:

```bash
pnpm --filter @geox/web typecheck
pnpm --filter @geox/web build
pnpm --filter @geox/web check:operator-boundary
pnpm --filter @geox/server typecheck
pnpm --filter @geox/server test:p1:openapi-selfcheck
```

Add domain-specific smokes where relevant:

```bash
pnpm --filter @geox/server smoke:operator-facade-readonly
pnpm --filter @geox/server smoke:operator-b-readonly
pnpm --filter @geox/server test:p2:evidence-summary-builder
```

## Current target state after P2-H

| Fallback area | Target after P2-H | Deletion priority |
| --- | --- | --- |
| customerFields dashboard fallback | Prepare for emergency-only after official field index is stable | Medium |
| customerOperations dashboard fallback | Prepare for emergency-only after official operation index is stable | Medium |
| customerReports dashboard fallback | Prepare for emergency-only after official dashboard/report API is stable | High |
| operator approvals fallback | Delete after canonical operator approval smoke | High |
| operator acceptance fallback | Delete after canonical operator acceptance smoke | High |
| operator dispatch fallback | Delete after canonical operator dispatch smoke | High |
| operator evidence/devices-alerts/roi-ledger/field-memory fallback | Emergency-only until each contract is formalized | Medium |

## Update requirement

Any PR that changes a fallback path must update this file.

For each fallback change, state:

- fallback object
- new stage: Allowed fallback / Emergency only / Deleted
- official replacement
- release gate results
- rollback method
- owner
