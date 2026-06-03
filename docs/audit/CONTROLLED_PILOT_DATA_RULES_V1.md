# Controlled Pilot Data Rules V1

This note records the data and ingestion rules verified by the controlled-pilot release gates. It is intentionally operational: it describes what data must exist, how it should be recorded, and which values are not allowed to become customer-facing formal conclusions.

## 1. Tenant, scope and authorization

All runtime records must be scoped by `tenant_id`, `project_id`, and `group_id`. The controlled-pilot runtime uses `tenantA / projectA / groupA` unless overridden by the acceptance environment.

Acceptance API calls must provide an admin-capable token for setup, reads, and formal gates. The release gate resolves tokens in this order: `ADMIN_TOKEN`, `TOKEN_ADMIN`, `AO_ACT_TOKEN`, `GEOX_AO_ACT_TOKEN`, `TOKEN`, then falls back to the acceptance fixture token `admin_token`. Approval paths use `TOKEN_APPROVER` or `APPROVER_TOKEN`, falling back to `approver_token`.

Customer routes must also pass through customer scope resolution. Data outside the authorized field scope must not leak through customer reports, operations, fields, memory, or geometry endpoints.

## 2. Field and geometry records

A controlled field requires a `field_index_v1` row with `tenant_id`, `field_id`, display/name fields, and area metadata when available. Geometry is stored separately in `field_polygon_v1` and must be normalized to GeoJSON. Invalid or missing geometry must be represented as `geometry_status = MISSING` or `INVALID`; customer routes must not expose raw geometry internals such as `geometry_id` as business language.

## 3. Device records

A device requires index, binding, capability, credential, and status data when it participates in a formal scenario. The minimum runtime set is:

- `device_index_v1`: identity and display metadata.
- `device_binding_index_v1`: `tenant_id`, `device_id`, `field_id` binding.
- `device_capability`: device capability array.
- `device_credential_index_v1`: active credential metadata.
- `device_status_index_v1`: online/offline state, telemetry/heartbeat time, signal/battery metadata when available.

Device offline or missing-location cases are diagnostic/customer-warning inputs only. They must not create formal success, formal ROI, or formal field memory by themselves.

## 4. Raw samples and telemetry

Raw sensing samples are recorded through `/api/v1/sensing/raw-samples`. A valid formal sample must include scope, sample identity, sensor/device identity, field identity, timestamp, metric, value, unit, quality marker, and payload metadata. The payload should preserve `tenant_id`, `project_id`, `group_id`, `field_id`, `device_id`, `credential_id`, `sample_kind`, and flags such as `interpolated` and `synthetic`.

Formal runtime samples must be real or formally accepted evidence. Simulated, interpolated, development-only, or flight-table data may support diagnostics but must not be promoted into customer-visible formal conclusions.

## 5. Operation chain records

The controlled-pilot operation chain is recorded as append-only facts and projections. The minimum formal operation chain is:

1. `decision_recommendation_v1`
2. `approval_request_v1`
3. `approval_decision_v1`
4. `operation_plan_v1`
5. `operation_plan_transition_v1`
6. `ao_act_task_v0`
7. `ao_act_receipt_v1`
8. `evidence_artifact_v1` or equivalent formal evidence facts
9. `acceptance_result_v1`
10. optional read models such as operation state, customer reports, ROI ledger, and field memory

Transitions must include `status`, `from_status`, `trigger`, and `created_ts`. Approval facts must include `request_id`. Skill run facts must include `trigger_stage`.

## 6. Formal acceptance rules

A customer-visible formal operation requires formal evidence and formal acceptance. Raw execution success is not sufficient. `operation_state` may be used as a fallback, but fallback data must be marked as `STATE_FALLBACK_LIMITED`, `fallback_limited = true`, `customer_visible_eligible = false`, and must include `state_fallback_limited_not_customer_official` as a blocking reason.

When using state fallback, raw `SUCCESS` and raw acceptance `PASS` must not be exposed as official customer status. The safe fallback values are `LIMITED_STATE` and `NEEDS_REVIEW`.

## 7. ROI rules

Customer-visible ROI must pass the formal-value predicate. It requires:

- `trust_level = FORMAL_ACCEPTED`
- `source_lane = FORMAL_ACCEPTANCE`
- a non-empty `formal_acceptance_id`
- `formal_evidence_passed = true`
- `chain_validation_passed = true`
- `customer_visible_value = true`

`AS_EXECUTED_SIGNAL` is interim, not formal. `FLIGHT_TABLE_DEV` is simulated/dev-only. Default assumptions and manual imports without formal acceptance are hypothesis-only. None of those may become customer-visible formal value.

## 8. Field Memory rules

Formal field memory requires an explicit formal acceptance gate. Skill runs, judge results, technical execution signals, and simulated data may create diagnostic or technical memory, but not `FORMAL_FIELD_MEMORY`.

Only records with `customer_visible_memory = true`, `learning_eligible = true`, formal source lane, and formal acceptance reference may be shown as customer-visible field memory.

## 9. Pest disease inspection rules

The pest disease scenario does not mean treatment is completed. A valid inspection chain is:

1. inspection request
2. observation with media, timestamp, geo point, device profile, plant part, target type, scout note, and evidence quality
3. signal or assessment
4. human review when required
5. inspection acceptance evaluation
6. operation report projection

Observation evidence must preserve `media_refs`, `captured_at_ts`, `geo_point`, `device_profile`, `scout_note`, `incidence_percent`, `severity_percent`, `affected_area_percent`, and `evidence_quality` when available. A PASS inspection acceptance must not automatically create a spray prescription, AO-ACT task, ROI ledger entry, or formal field memory.

## 10. Customer report wording rules

Customer-facing report capabilities may be available even when the underlying data is limited. In that case the wording must be explicit: `能力可用，结论需复核`. Limited records must also state that they do not represent formal business conclusions.

The customer layer must prefer guarded/formal reports. If it falls back to state-derived data, it must expose only limited trust metadata and safe customer language.

## 11. Seed rules

The controlled-pilot seed supports dry-run, export-json, apply, verify, verify-api, export-db-json, cleanup, and verify-clean. Apply requires an explicit allowed tenant and must use transactions and advisory locks. Cleanup must only remove seed-owned IDs and must not broadly delete tenant data.

The seed must never use broad tenant cleanup, `TRUNCATE`, production bypasses, or development-only evidence markers as formal proof.
