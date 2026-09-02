# GEOX B-Line Fertilization Execution Provenance V1

## Status

Status: **AUTHORIZED IMPLEMENTATION / P0-RES-009 CLOSURE**

Exact stacked base:

```text
#3450 Sampling exact-source closure head
28f5379ac34842c13cace17cb17fde1a87797296
```

MCFT boundary:

```text
DO NOT MODIFY MCFT IMPLEMENTATION
```

This package closes the Fertilization acceptance provenance defect recorded as `P0-RES-009`.

## Frozen semantic boundary

Fertilization Acceptance is a domain-specific zone-level acceptance over an already canonical execution chain.

It must not mint formal execution truth from caller assertions.

The required authority chain is:

```text
fertilization_prescription_v1 exact fact
  -> deterministic bridge recommendation id
  -> exact prescription_contract_v1 row
  -> exact AO-ACT receipt fact
  -> exact as_executed_record_v1
  -> exact as_applied_map_v1
  -> exact canonical acceptance_result_v1 PASS
  -> fertilization_acceptance_v1 zone rollup
```

The Fertilization acceptance writer does not replace AO-ACT Receipt authority, AsExecuted authority, AsApplied authority, or canonical Acceptance authority.

## Required exact identities

The request to `POST /api/v1/fertilization/acceptance/evaluate` must provide:

```text
fertilization_prescription_id
fertilization_prescription_fact_id
receipt_fact_id
act_task_id
operation_plan_id
as_executed_id
as_applied_id
acceptance_result_fact_id
```

`zone_applications`, `receipt_status`, caller-supplied `receipt_id`, and caller-supplied execution evidence must not determine the verdict. The Fertilization prescription is selected by exact `fertilization_prescription_fact_id`; `fertilization_prescription_id` alone is a business continuity assertion.

If caller `zone_applications` are supplied, the request fails closed rather than treating them as evidence.

## Prescription continuity

The variable prescription consumed by execution must be the bridge successor of the exact Fertilization prescription:

```text
bridge recommendation id = fert_bridge_<fertilization_prescription_id>
```

The bridge row must exist in `prescription_contract_v1`, match tenant/project/group/field, and have operation_type `FERTILIZATION`.

AsExecuted and AsApplied must bind that exact variable `prescription_id`.

## Receipt continuity

`receipt_fact_id` is the immutable Receipt identity.

The exact fact must be `ao_act_receipt_v0` or `ao_act_receipt_v1`, and its scope, field, operation_plan_id, and act_task_id must match the Fertilization request and bridged prescription.

The business receipt id may be read from the exact fact payload for consistency checks, but it is not source-selection authority.

## AsExecuted / AsApplied continuity

`as_executed_record_v1` must match:

```text
tenant/project/group
field_id
task_id
receipt_id from the exact Receipt
prescription_id from the exact bridge row
```

`as_applied_map_v1` must additionally match the exact `as_executed_id`.

Zone application values used in Fertilization Acceptance come only from:

```text
as_applied_map_v1.application.zone_applications
```

They are not read from request JSON.

## Canonical Acceptance continuity

`acceptance_result_fact_id` must resolve an exact `acceptance_result_v1` fact matching the same tenant/project/group/field/task/operation/Receipt chain.

Fertilization PASS requires canonical Acceptance to prove:

```text
verdict = PASS
formal_acceptance = true
formal_evidence_passed = true
formal_execution_passed = true
source_lane = FORMAL_OPERATION
customer_visible_eligible = true
```

The canonical Acceptance evidence refs must include the exact Receipt fact.

A canonical `NEEDS_REVIEW`, `INSUFFICIENT_EVIDENCE`, `PARTIAL`, or `FAIL` result cannot be upgraded to Fertilization PASS.

Canonical Acceptance is a predecessor gate, not a peer verdict. If the exact canonical Acceptance is non-PASS, Fertilization Acceptance evaluation stops and no domain Acceptance fact is minted for that chain. In particular, current variable-zone canonical Acceptance already enforces zone completion, coverage, and amount-deviation constraints; Fertilization must not re-evaluate a canonically failed execution to create an independent FAIL/PASS truth.

## Authorization

The Fertilization Acceptance route requires dedicated `acceptance.evaluate` scope and an acceptance-capable role.

`fields.write` or `prescription.write` alone must not authorize this write.

## Zone rollup

Required zone plan values remain authority from the exact Fertilization prescription.

Actual application and coverage values come from exact AsApplied.

A required zone is:

- `NEEDS_REVIEW` when exact AsApplied has no matching zone or actual amount;
- `FAIL` when coverage is below policy threshold or rate deviation exceeds tolerance;
- `PASS` only when exact canonical evidence is complete and the zone is within tolerance.

Operation-level averages never override a failing required zone.

## Persisted provenance

Every `fertilization_acceptance_v1` must freeze:

```text
fertilization_prescription_fact_id
variable_prescription_id
receipt_fact_id
receipt_id
act_task_id
operation_plan_id
as_executed_id
as_applied_id
acceptance_result_fact_id
```

## Non-effects

This package does not:

- modify AO-ACT execution runtime;
- create Receipt, AsExecuted, AsApplied, or canonical Acceptance rows;
- alter MCFT implementation;
- alter Recommendation/Approval semantics;
- define outcome success, ROI, Field Memory, or learning authority;
- permit caller execution assertions to become formal evidence.

## Completion

P0-RES-009 may be closed only when one exact head proves:

```text
Fertilization execution-provenance static gate PASS
dedicated acceptance auth negative PASS
caller zone_applications rejected PASS
wrong receipt/as-executed/as-applied chain negatives PASS
canonical Acceptance non-PASS cannot become Fertilization PASS
exact canonical positive chain PASS
Formal Fertilization E2E PASS
Fertilization report projection PASS
Typecheck / Build / Server selfcheck PASS
full acceptance PASS
Controlled Pilot / Commercial MVP0 PASS
MCFT implementation delta 0
```
