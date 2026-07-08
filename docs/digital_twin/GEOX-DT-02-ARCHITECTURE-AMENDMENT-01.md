<!-- docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-01.md -->
# GEOX DT-02 Architecture Amendment 01

## 0. Authority

```text
phase: DT-02
amendment: DT02-AMENDMENT-01
reason: post-merge blocker correction
supersedes: selected rules in DT02-ADR-003, 005, 008, 009, 010, 015, 016
baseline main commit: 4c1d854a5190a5d37d7cea0a4ded3f6f3ce8b614
status: PENDING_ACCEPTANCE
```

PR #2302 was merged before four architecture contradictions were detected. This amendment does not erase that history. It explicitly replaces the affected rules and preserves all unaffected DT-02 decisions.

## 1. Record class is not lineage membership

Every append-only object must declare both:

```text
record_class
lineage_member: true | false
```

`record_class` answers what kind of append-only record it is. `lineage_member` answers whether the object participates in a State revision lineage.

The semantic envelope is split into:

```text
base_object_envelope
lineage_envelope
non_lineage_context_envelope
```

Rules:

```text
lineage_member = true
-> lineage_id and revision_id are required

lineage_member = false
-> lineage_id and revision_id are forbidden as required fields
-> optional context_lineage_ref and context_revision_ref may be used
```

An operational attempt or Health event may exist before bootstrap, before active lineage creation, before config resolution, or before checkpoint creation.

## 2. Revision lifecycle transaction closure

Transaction family E is renamed:

```text
E_REVISION_LINEAGE_STEP_COMMIT
```

It has three machine-readable variants:

```text
E1_DECLARE_REVISION
append:
  twin_revision_run_v1
  twin_runtime_lineage_v1
pointer switch: none

E2_APPEND_REVISION_STATUS
append:
  twin_revision_run_v1
pointer switch: none

E3_PROMOTE_LINEAGE
append:
  twin_lineage_promotion_v1
pointer switch:
  active lineage
  checkpoint
  State
  Forecast
  Scenario
  Health
```

The revision chain is therefore complete:

```text
late Evidence detected
-> revision run declared
-> candidate lineage declared
-> status/progress events appended
-> candidate ticks recomputed
-> candidate validated
-> lineage promoted
```

## 3. Forecast terminal-state semantics

### COMPLETED

```text
object: twin_forecast_run_v1
lineage_member: true
points: exactly 72
horizons: 1..72
State Tick: COMPLETED
checkpoint: advances
latest successful forecast index: advances
Scenario eligibility: true
```

### BLOCKED

```text
object: twin_forecast_run_v1
lineage_member: true
points: exactly 0
reason_codes: required
source posterior: valid
State Tick: COMPLETED_WITH_LIMITATIONS
checkpoint: advances
latest forecast-result index: advances
latest successful forecast index: unchanged
Scenario eligibility: false
```

### FAILED

```text
object: twin_forecast_failure_v1
record_class: OPERATIONAL_AUDIT
lineage_member: false
points: absent
reason_codes: required
attempt_ref: required
State Tick: not created
checkpoint: unchanged
active lineage Forecast: not created
transaction: F_OPERATIONAL_ATTEMPT_HEALTH
```

`twin_forecast_run_v1` does not permit status `FAILED`.

## 4. Scenario source eligibility

Scenario Commit requires:

```text
source Forecast.status = COMPLETED
source Forecast.points.length = 72
source Forecast.horizons = 1..72
```

BLOCKED or FAILED Forecast results are never valid Scenario sources.

## 5. Action Feedback separates execution and validation

`twin_action_feedback_v1` freezes independent fields:

```text
execution_status:
  EXECUTED
  PARTIALLY_EXECUTED
  EXECUTION_UNCERTAIN
  NOT_EXECUTED

validation_status:
  NOT_YET_VALIDATED
  VALIDATED
  REJECTED
  VALIDATED_WITH_LIMITATIONS

eligible_for_state_input: boolean
```

Reference rules:

```text
receipt_ref or as_executed_ref: at least one trusted execution source required
acceptance_ref: optional
task_ref: required only when origin_kind = AO_ACT
```

Historical imports and authenticated manual execution Evidence may have no AO-ACT task.

A trustworthy executed amount may become eligible for a later Evidence Window before formal Acceptance. Acceptance later appends a superseding feedback record; it does not rewrite the earlier record.

`eligible_for_state_input` is determined from actual amount, event time, spatial coverage, source identity, source quality, and limitations. It is not determined solely by `acceptance_ref`.

## 6. Machine-readable transaction coverage

Every object must use:

```text
transaction_families: ["..."]
```

Natural-language values such as:

```text
"A_STATE_TICK_COMMIT or F_OPERATIONAL_ATTEMPT_HEALTH"
```

are forbidden.

For every object, every listed family must exist, and the object must appear in that transaction's `canonical_appends` or an explicit `operation_variants[].canonical_appends` list.

## 7. Acceptance requirements

The amended Gate must prove:

1. every object has `record_class`, `history_class`, and `lineage_member`;
2. `record_class` and compatibility `history_class` agree;
3. lineage envelope applicability is machine-readable;
4. non-lineage records do not require lineage identity;
5. every transaction family exists and covers every object append;
6. no natural-language transaction-family expression exists;
7. revision declaration, status, and promotion variants all exist;
8. COMPLETED, BLOCKED, and FAILED Forecast paths have distinct checkpoint and lineage behavior;
9. Scenario requires a COMPLETED 72-point Forecast;
10. Action Feedback does not require Acceptance;
11. execution and validation statuses are orthogonal;
12. the final closure evidence identifies architecture-validation head, closure head, and final CI separately.

## 8. Unaffected decisions

All DT-02 decisions not explicitly superseded by this amendment remain frozen, including pure-domain dependency direction, one canonical fact store, State transition/update/posterior atomicity, fencing and CAS, deterministic identity, read-only Runtime APIs, legacy compatibility, shared runtime core, and production nonclaims.
