# P07-00 Scenario Productization Baseline Audit V1

## 0. Audit purpose

This document is a baseline audit only. It intentionally does not change UI, VM, API, or projection code.

The purpose is to prevent repeated development before P07 scenario productization work starts. The audit answers:

1. Which formal scenario productization fields already exist.
2. Which fields are missing from backend projections.
3. Which fields are missing from frontend VM/view consumption.
4. Which local enum/status mappings bypass the customer trust gate.
5. Whether export links are backed by the same report data source.

## 1. Scope audited

Audited files:

- `apps/server/src/projections/report_v1.ts`
- `apps/server/src/projections/report_dashboard_v1.ts`
- `apps/web/src/api/reports.ts`
- `apps/web/src/views/CustomerDashboardPage.tsx`
- `apps/web/src/views/FieldReportPage.tsx`
- `apps/web/src/views/OperationReportPage.tsx`
- `apps/web/src/viewmodels/customerDashboardVm.ts`
- `apps/web/src/lib/customerTrustGate.ts`

Adjacent files read only for route/source context:

- `apps/web/src/api/customerReports.ts`
- `apps/web/src/viewmodels/operationReportVm.ts`

## 2. Current source-of-truth map

### 2.1 Customer API entry

`apps/web/src/api/customerReports.ts` only re-exports from `apps/web/src/api/reports.ts`.

Current customer report fetch path:

- Dashboard: `fetchCustomerDashboardAggregate()` -> `/api/v1/reports/customer-dashboard/aggregate`
- Field report: `fetchFieldReport(fieldId)` -> `/api/v1/reports/field/:fieldId`
- Operation report: `fetchOperationReport(operationId)` -> `/api/v1/reports/operation/:operationId`

Assessment: the read-side API entry is already mostly centralized. Do not create another customer report API wrapper for P07 unless the existing one is intentionally retired.

### 2.2 Projection source

Current customer-facing operation report type is `OperationReportV1` in `report_v1.ts`.

Current dashboard aggregate type is `CustomerDashboardAggregateV1` in `report_dashboard_v1.ts`.

Assessment: backend projection is the correct place to add scenario productization fields. Frontend should not infer formal scenario state from raw statuses or operation titles.

## 3. OperationReport formal scenario field coverage

### 3.1 Scenario identity fields

| Field | Current status | Evidence | Required action |
|---|---:|---|---|
| `scenario_type` | Missing | `OperationReportV1` has no top-level scenario identity field. | Add backend projection field. |
| `scenario_run_id` / `formal_scenario_run_id` | Missing | `OperationReportV1` has no scenario run ledger field. | Add backend projection field if product pages need traceability. |
| `scenario_lane` | Missing | No positive/negative/anomaly/partial lane appears in `OperationReportV1`. | Add backend projection field. |
| `formal_chain_status` | Missing | Existing trust state appears indirectly through guarded projection fields consumed by VM, not typed in `OperationReportV1`. | Add explicit typed field. |
| `evidence_status` | Partial | Existing `evidence` has counts and receipt/acceptance presence only. | Add formal evidence status, not just counts. |

Conclusion: `OperationReportV1` currently cannot explicitly distinguish `FORMAL_IRRIGATION`, `DEVICE_ANOMALY`, and `FORMAL_VARIABLE_OPERATION` for product rendering.

### 3.2 FORMAL_IRRIGATION readiness

Existing useful fields:

- `why.explain_human`
- `why.objective_text`
- `identifiers.recommendation_id`
- `identifiers.prescription_id`
- `identifiers.approval_id`
- `identifiers.act_task_id`
- `identifiers.receipt_id`
- `as_executed.actual_params`
- `execution.final_status`
- `acceptance.status`
- `acceptance.verdict`
- `acceptance.missing_evidence`
- `evidence.artifacts_count/logs_count/media_count/metrics_count`
- `roi_ledger.summary`
- `roi_ledger.items`
- `field_memory.field_response_memory`
- `field_memory.device_reliability_memory`
- `field_memory.skill_performance_memory`

Missing or insufficient fields:

- `scenario_type = FORMAL_IRRIGATION`
- `formal_chain_status`
- `formal_evidence_status`
- `irrigation_result_summary`
- `pre_soil_moisture`
- `post_soil_moisture`
- `soil_moisture_delta`
- `water_delivery_evidence_status`
- `pump_valve_execution_status`
- `rain_interference_status`
- `evidence_gaps[]` as formal product field
- `roi_trust_lane` as explicit lane object
- `field_memory_lane` as explicit lane object

Important constraint: do not duplicate existing `roi_ledger` and `field_memory` blocks. Add trust lane wrappers around them if needed.

### 3.3 DEVICE_ANOMALY readiness

Existing useful fields:

- `execution.final_status`
- `execution.invalid_execution`
- `execution.invalid_reason`
- `risk.level`
- `risk.reasons`
- `evidence.*_count`
- `field_memory.device_reliability_memory`

Missing or insufficient fields:

- `scenario_type = DEVICE_ANOMALY`
- `fail_safe_status`
- `fail_safe_events[]`
- `manual_takeover_status`
- `manual_takeover_events[]`
- `device_anomaly_type`
- `device_health_snapshot`
- `offline_or_fault_window`
- `fallback_action_taken`
- `human_operator_required`
- `device_recovery_status`
- `evidence_gaps[]`

Current `OperationReportV1` can show invalid execution but cannot productize anomaly handling as a customer-readable fail-safe story.

### 3.4 FORMAL_VARIABLE_OPERATION readiness

Existing useful fields:

- `as_applied.coverage_status`
- `as_applied.coverage_geojson`
- `as_applied.planned_geojson`
- `as_applied.applied_amount_summary`
- `as_applied.planned_vs_actual_deviation`
- `zone_applications`
- `zone_evidence_customer_v1.zone_matrix`
- `zone_evidence_customer_v1.operation_rollup_policy`
- `zone_evidence_operator_debug_v1`
- `planned.planned_area`
- `planned.planned_path`
- `planned.planned_rate`
- `planned.planned_amount`

Missing or insufficient fields:

- `scenario_type = FORMAL_VARIABLE_OPERATION`
- `zone_rollup_status`
- `zone_evidence_matrix` with complete customer fields
- `zone_evidence_matrix[].planned_rate`
- `zone_evidence_matrix[].actual_rate`
- `zone_evidence_matrix[].coverage_status`
- `zone_evidence_matrix[].evidence_status`
- `zone_evidence_matrix[].gap_reason`
- `operation_rollup_policy` as top-level scenario object
- `partial_success_status`
- `zone_count_total`
- `zone_count_passed`
- `zone_count_failed`
- `zone_count_insufficient_evidence`

Current projection has the seed of variable operation support, but the customer matrix is too thin for product UI.

## 4. Dashboard recent_operations coverage

`CustomerDashboardAggregateV1.recent_operations` currently includes:

- `operation_id`
- `operation_plan_id`
- `field_id`
- `field_name`
- `title`
- `customer_title`
- `executed_at`
- `final_status`
- `acceptance_status`
- `risk_level`
- `risk_reasons`
- `estimated_total_cost`
- `execution_duration_ms`

Required by P07 but missing:

| Required field | Current status | Required owner |
|---|---:|---|
| `scenario_type` | Missing | Backend projection |
| `formal_chain_status` | Missing | Backend projection |
| `evidence_status` | Missing | Backend projection |
| `fail_safe_status` | Missing | Backend projection |
| `manual_takeover_status` | Missing | Backend projection |
| `zone_rollup_status` | Missing | Backend projection |

Frontend `customerDashboardVm.ts` currently derives `stateText`, `acceptanceText`, and `evidenceText` through `customerTrustGate` helpers. This is good, but it lacks the upstream fields needed to tell scenario-specific stories.

Do not add these fields only in frontend VM. They must be projected by `report_dashboard_v1.ts` from `OperationReportV1` or from an official scenario projection.

## 5. OperationReport P07 product field coverage

| Required item | Current status | Notes | Required owner |
|---|---:|---|---|
| fail-safe event | Missing | No explicit `fail_safe_events` or `fail_safe_status`. | Backend projection first. |
| manual takeover | Missing | No explicit `manual_takeover_status/events`. | Backend projection first. |
| zone evidence matrix | Partial | `zone_evidence_customer_v1.zone_matrix` exists but only has `zone_id`, `zone_acceptance_result`, `operation_rollup_policy`. | Backend projection enrich, then frontend VM. |
| operation rollup policy | Partial | Exists inside `zone_evidence_customer_v1.operation_rollup_policy`, but not exposed as scenario-level status. | Backend projection enrich. |
| evidence gaps | Partial | `acceptance.missing_items` exists; not formal scenario `evidence_gaps[]`. | Backend projection. |
| ROI trust lane | Partial | `roi_ledger.summary.has_customer_visible_value`, value kinds, confidence and low-confidence groups exist. No explicit `roi_trust_lane`. | Backend projection wrapper; frontend reuse. |
| Field Memory lane | Partial | `field_memory` groups exist. No explicit `field_memory_lane`. | Backend projection wrapper; frontend reuse. |

## 6. Frontend raw enum / local mapping audit

### 6.1 Good existing pattern

`customerDashboardVm.ts` uses:

- `customerGuardedStatusText(item)`
- `customerGuardedAcceptanceText(item)`
- `customerGuardedEvidenceText(item)`
- `isTrustedDashboardValueSummary(...)`
- `customerValueSummaryText(...)`

This is the correct direction. Dashboard customer text should continue going through `customerTrustGate.ts`.

### 6.2 Bypass / local mapping risks

`apps/web/src/api/reports.ts` defines local `REPORT_CODE_MAP`, `mapReportCode`, and `mapGuardedReportCode`.

Risk: this file-level map overlaps with `customerTrustGate.ts`. It is acceptable as a low-level API utility only if all customer views consistently use guarded mapping. Do not add new page-level raw enum maps.

`OperationReportPage.tsx` contains several local mapping functions:

- `toCustomerStatus(...)`
- `approvalResultText(...)`
- `acceptanceResultText(...)`
- `roiStatusText(...)`
- `mapOperationStatusToCustomerLabel(...)` is in `operationReportVm.ts`

Risk: operation report rendering has multiple local mappings that can diverge from `customerTrustGate.ts` and `mapGuardedReportCode(...)`.

P07 recommendation: do not patch labels piecemeal in the page. First add projection fields, then move scenario/customer guarded status mapping into VM-level helper(s), preferably reusing `customerTrustGate.ts` or replacing local mapping with a single scenario trust mapping helper.

### 6.3 Acceptable local mapping

Some page-local mapping is acceptable for non-status formatting:

- safe date formatting
- customer-safe ID hiding
- operation action label translation
- technical foldout sanitization
- evidence private text filtering

Do not confuse these with formal chain status mapping.

## 7. Export same-source audit

Observed current frontend export links:

- Dashboard header links to `/customer/export`.
- Field report VM/page links to field export route via `vm.exportHref`.
- Operation report VM/page links to `/customer/operations/:operationId/export`.

Current audited files do not prove that those export routes render from the same `OperationReportV1`, `FieldReportDetailV1`, or `CustomerDashboardAggregateV1` payload used by the pages.

Assessment: same-source export is not verified in this audit scope.

Required follow-up:

1. Locate export route/page implementation.
2. Confirm export route calls the same `fetchOperationReport`, `fetchFieldReport`, or `fetchCustomerDashboardAggregate` data path, or consumes the same backend projection endpoint.
3. If export route builds a second independent HTML model, retire it or make it consume the same VM as the page.

Blocked status: do not claim export same-source compliance until this is verified.

## 8. Backend projection fields to add later

Add to `OperationReportV1` or a nested scenario object:

```ts
type ScenarioProductizationV1 = {
  scenario_type: "FORMAL_IRRIGATION" | "DEVICE_ANOMALY" | "FORMAL_VARIABLE_OPERATION" | "UNKNOWN";
  scenario_run_id: string | null;
  scenario_lane: string | null;
  formal_chain_status: "PASSED" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | "SIMULATED" | "LIMITED";
  evidence_status: "PASSED" | "MISSING" | "INSUFFICIENT" | "PARTIAL" | "NOT_APPLICABLE";
  evidence_gaps: Array<{ code: string; label: string; severity: "info" | "warning" | "blocking" }>;
  roi_trust_lane: {
    status: "TRUSTED" | "ESTIMATED" | "ASSUMPTION_BASED" | "INSUFFICIENT_EVIDENCE";
    customer_visible_value: boolean;
    reasons: string[];
  };
  field_memory_lane: {
    status: "RECORDED" | "NOT_RECORDED" | "INSUFFICIENT_EVIDENCE";
    memory_refs: string[];
    reasons: string[];
  };
};
```

Add irrigation-specific object:

```ts
type FormalIrrigationScenarioV1 = {
  pre_soil_moisture: number | null;
  post_soil_moisture: number | null;
  soil_moisture_delta: number | null;
  water_delivery_evidence_status: string | null;
  pump_valve_execution_status: string | null;
  rain_interference_status: string | null;
};
```

Add device anomaly object:

```ts
type DeviceAnomalyScenarioV1 = {
  fail_safe_status: "NOT_REQUIRED" | "TRIGGERED" | "FAILED" | "UNKNOWN";
  fail_safe_events: Array<{ event_type: string; occurred_at: string | null; summary: string }>;
  manual_takeover_status: "NOT_REQUIRED" | "REQUESTED" | "TAKEN_OVER" | "FAILED" | "UNKNOWN";
  manual_takeover_events: Array<{ actor_id?: string | null; occurred_at: string | null; summary: string }>;
  anomaly_type: string | null;
  device_recovery_status: string | null;
};
```

Add variable operation object:

```ts
type FormalVariableOperationScenarioV1 = {
  zone_rollup_status: "PASS" | "PARTIAL" | "FAIL" | "INSUFFICIENT_EVIDENCE" | "NOT_APPLICABLE";
  operation_rollup_policy: string | null;
  zone_count_total: number;
  zone_count_passed: number;
  zone_count_failed: number;
  zone_count_insufficient_evidence: number;
  zone_evidence_matrix: Array<{
    zone_id: string | null;
    planned_rate: number | null;
    actual_rate: number | null;
    coverage_status: string | null;
    evidence_status: string | null;
    zone_acceptance_result: string | null;
    gap_reason: string | null;
  }>;
};
```

Add to `CustomerDashboardAggregateV1.recent_operations`:

```ts
scenario_type: ScenarioProductizationV1["scenario_type"];
formal_chain_status: ScenarioProductizationV1["formal_chain_status"];
evidence_status: ScenarioProductizationV1["evidence_status"];
fail_safe_status: DeviceAnomalyScenarioV1["fail_safe_status"] | null;
manual_takeover_status: DeviceAnomalyScenarioV1["manual_takeover_status"] | null;
zone_rollup_status: FormalVariableOperationScenarioV1["zone_rollup_status"] | null;
```

## 9. Frontend VM fields to add later

Add to `customerDashboardVm.ts` recent operation VM:

- `scenarioTypeText`
- `formalChainText`
- `evidenceStatusText`
- `failSafeText`
- `manualTakeoverText`
- `zoneRollupText`

Add to `operationReportVm.ts` later, not directly in page:

- `scenarioBadge`
- `formalChainPanel`
- `failSafePanel`
- `manualTakeoverPanel`
- `zoneEvidenceMatrix`
- `evidenceGaps`
- `roiTrustLane`
- `fieldMemoryLane`

Important: Operation page should consume VM output. Avoid adding another layer of local `status -> Chinese label` mapping in `OperationReportPage.tsx`.

## 10. Do-not-repeat / forbidden duplicate development list

Do not rebuild these existing pieces:

1. Do not create a new customer reports API module. `customerReports.ts` already re-exports `reports.ts`.
2. Do not create another dashboard aggregate fetcher. Use `fetchCustomerDashboardAggregate()`.
3. Do not create another field report fetcher. Use `fetchFieldReport()`.
4. Do not create another operation report fetcher. Use `fetchOperationReport()`.
5. Do not duplicate ROI data blocks. Extend `roi_ledger` with a trust lane wrapper.
6. Do not duplicate Field Memory blocks. Extend `field_memory` with a lane wrapper.
7. Do not replace `zone_evidence_customer_v1`; enrich or alias it into the P07 matrix shape.
8. Do not derive `scenario_type` from title strings in frontend.
9. Do not derive `formal_chain_status` from `final_status` in frontend.
10. Do not add customer-visible pass/success labels unless the formal trust gate says the chain is customer-visible.
11. Do not claim export same-source compliance until export route implementation is audited.
12. Do not add scenario productization fields only in React pages. Projection first, VM second, page last.

## 11. Acceptance impact

This PR only adds this audit document.

Expected validation commands:

```bash
pnpm --filter @geox/server typecheck
pnpm --filter @geox/web typecheck
```

Because no TypeScript code is changed, these commands are expected to remain at the previous baseline. They were not executed as part of this document-only audit commit.

## 12. Final baseline verdict

P07 productization should not start with UI rewrites.

Correct order:

1. Add backend scenario productization fields to `OperationReportV1` and dashboard `recent_operations`.
2. Add VM-level scenario display models.
3. Remove or consolidate local raw enum mapping that overlaps formal trust mapping.
4. Render scenario-specific panels in the pages.
5. Audit and unify export routes with page data/VM.

Current readiness:

| Area | Status |
|---|---:|
| OperationReport base chain | Partial-ready |
| Formal irrigation product story | Partial-ready |
| Device anomaly fail-safe story | Not ready |
| Variable operation zone story | Partial-ready |
| Dashboard scenario list | Not ready |
| Frontend trust gate | Partial-ready |
| Export same-source proof | Not verified |
