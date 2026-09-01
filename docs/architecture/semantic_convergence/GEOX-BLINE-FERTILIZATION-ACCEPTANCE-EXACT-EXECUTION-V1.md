# GEOX B-Line Fertilization Acceptance Exact Execution V1

## Status

Status: **IMPLEMENTATION IN PROGRESS / EXACT QUALIFICATION PENDING**

Stacked base:

```text
#3446
0c28819ae58336d8881761febc995055b5e475a2
```

Scope:

```text
P0-RES-009 only
```

MCFT boundary:

```text
DO NOT MODIFY MCFT IMPLEMENTATION
```

Sampling P0-RES-010 is explicitly out of scope and remains a separate later debt.

## Defect being closed

The active endpoint:

```text
POST /api/v1/fertilization/acceptance/evaluate
```

previously accepted caller-supplied `zone_applications` and calculated a formal-looking `fertilization_acceptance_v1` PASS directly from those assertions.

The caller could also provide `receipt_id`, `act_task_id`, `operation_plan_id`, `as_applied_id` and arbitrary evidence refs without the service loading or verifying those sources.

That allowed:

```text
caller assertion
-> zone result calculation
-> fertilization_acceptance_v1 PASS
```

without canonical execution provenance.

## Canonical source chain

The repaired authority path is:

```text
fertilization_prescription_v1
-> fert_bridge_<fertilization_prescription_id>
-> prescription_contract_v1
-> AO-ACT task / exact receipt
-> as_executed_record_v1
-> as_applied_map_v1 VARIABLE_BY_ZONE
-> fertilization_acceptance_v1
```

The acceptance request must provide exact identities:

- `fertilization_prescription_id`
- `operation_plan_id`
- `act_task_id`
- `receipt_id`
- `as_executed_id`
- `as_applied_id`

No latest execution selection is allowed.

## Exact continuity requirements

Before an acceptance fact may be written:

1. The domain fertilization prescription must exist in the exact tenant/project/group scope.
2. The bridge variable prescription must resolve by the stable `fert_bridge_<fertilization_prescription_id>` relationship.
3. The bridge prescription field and planned zone rates must agree with the domain fertilization prescription.
4. The exact AsExecuted record must match tenant/project/group, task, receipt, field and bridge prescription.
5. AsExecuted execution status must be `CONFIRMED`.
6. The exact AsApplied record must match the exact AsExecuted id, task, receipt, field and bridge prescription.
7. AsExecuted `receipt_refs.fact_id` must resolve one exact AO-ACT receipt fact.
8. That receipt must match the exact task, operation plan and field.
9. AsApplied must contain `application.mode=VARIABLE_BY_ZONE`.
10. Required-zone outcomes are derived only from AsApplied zone applications.

Any missing or contradictory identity fails closed before `fertilization_acceptance_v1` is written.

## Policy / unit boundary

Acceptance thresholds are not implementation constants.

The exact bridge `prescription_contract_v1.acceptance_conditions` supplies:

```text
required_coverage_percent
amount_tolerance_percent
```

The canonical percentage scale is 0-100.

Current bridge policy establishes:

```text
required_coverage_percent = 95
amount_tolerance_percent = 15
```

The previous acceptance comparisons against `0.9` and `0.15` are forbidden.

## Caller authority removal

The endpoint rejects caller-supplied:

- `zone_applications`
- `evidence_refs`

with:

```text
CALLER_EXECUTION_ASSERTIONS_FORBIDDEN
```

Those fields cannot influence a verdict or formal evidence list.

The persisted evidence refs are generated from the exact canonical chain:

- domain fertilization prescription
- bridge variable prescription
- exact AO-ACT receipt fact
- exact AsExecuted record
- exact AsApplied record

## Authorization boundary

Assessment / recommendation / prescription routes keep their existing write scopes.

Only fertilization acceptance is narrowed to:

```text
acceptance.evaluate
```

with operator/admin role compatibility matching the canonical Acceptance route.

Field allowlist authorization is performed before calling the acceptance writer. A forbidden field must not be able to create a hidden acceptance fact before the route returns 404.

## Runtime proof

The formal fertilization E2E is migrated so that:

- positive acceptance consumes exact AsExecuted + AsApplied ids;
- caller zone assertions are rejected;
- a nonexistent AsApplied identity is rejected;
- missing-zone behavior is proven using a real receipt -> AsExecuted -> AsApplied chain missing that zone;
- zone over-application behavior is proven using a separate real execution chain;
- 97/96 coverage values use the canonical 0-100 percentage scale.

## Non-effects

This package does not redefine or remove:

- nitrogen assessment semantics;
- fertilization recommendation semantics;
- fertilization prescription generation;
- Approval authority;
- AO-ACT execution authority;
- generic Acceptance;
- Sampling;
- Decision Eligibility;
- MCFT implementation.

## Qualification required before COMPLETE

The package is not COMPLETE until the exact head passes:

- B-Line residual authority audit;
- B-Line active runtime surface closure;
- B-Line Fertilization acceptance exact-execution gate;
- Fertilization contract/static/live/variable bridge/formal E2E/release gate;
- TypeScript typecheck;
- build;
- server selfcheck;
- full acceptance;
- Controlled Pilot strict;
- Commercial MVP0;
- runtime hygiene;
- MCFT boundary checks classified without modifying MCFT.
