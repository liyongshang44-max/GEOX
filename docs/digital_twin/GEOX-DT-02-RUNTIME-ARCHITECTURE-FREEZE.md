<!-- docs/digital_twin/GEOX-DT-02-RUNTIME-ARCHITECTURE-FREEZE.md -->
# GEOX DT-02 Runtime Architecture Freeze

## 0. Authority

```text
phase: DT-02
name: Runtime Architecture Freeze
type: architecture governance and contract freeze
predecessor: DT-01 Existing Capability Reconciliation
successor: MCFT-00 Reality Binding Contract
original merge: 4c1d854a5190a5d37d7cea0a4ded3f6f3ce8b614
amendment: DT02-AMENDMENT-01
status: FROZEN_WITH_AMENDMENT
```

DT-02 freezes one Minimum Complete Field Twin runtime architecture. It creates no runtime source, migration, route, scheduler, projection, domain implementation, frontend adapter, or production capability.

Allowed claim:

```text
RUNTIME_ARCHITECTURE_FROZEN_NO_RUNTIME_IMPLEMENTATION
```

## 1. Review corrections

The original task review contained five corrections, not four. A post-merge review then found four additional blockers. `GEOX-DT-02-ARCHITECTURE-AMENDMENT-01.md` supersedes the affected clauses.

The complete corrections are:

1. `fact_id` is persistence-envelope identity, not semantic identity.
2. `record_class` and `lineage_member` are independent dimensions.
3. Attempt, Health, Decision, Action Feedback, revision declaration, and promotion may exist outside the posterior lineage.
4. Active-lineage changes require append-only `twin_lineage_promotion_v1` authority.
5. Revision declaration, progress, and promotion all have explicit transaction variants.
6. COMPLETED, BLOCKED, and FAILED Forecast outcomes have different persistence and checkpoint behavior.
7. Scenario accepts only a COMPLETED 72-point Forecast.
8. Executed Evidence and formal Validation are orthogonal; Acceptance is not required for every state-input-eligible Action Feedback record.
9. Eight transaction families remain, but every object-to-family relationship is machine-readable and closed.

## 2. Frozen architecture

```text
Reality / Evidence
        ↓
Evidence Window Port
        ↓
Pure Domain Model
        ↓
Runtime Orchestrator
        ↓
Canonical append-only facts
        ↓
Mutable rebuildable projections
        ↓
Read-only Operator APIs
        ↓
Operator Field Runtime
```

Replay, Shadow-online, Controlled Field, and future Production share domain semantics, object contracts, transition semantics, forecast/scenario semantics, persistence, idempotency, revision rules, and trace. Only clock, evidence ingress, scheduler, execution feedback, availability, and deployment adapters vary.

## 3. Object envelopes and lineage membership

Every append-only object declares:

```text
record_class
history_class                compatibility alias equal to record_class
lineage_member               true | false
envelope_profile             LINEAGE | NON_LINEAGE_CONTEXT
transaction_families         array
```

Envelope rules:

```text
base_object_envelope
  common semantic identity, scope, logical time, evidence/config refs,
  idempotency, determinism, limitations, audit time

lineage_member = true
  envelope_profile = LINEAGE
  lineage_id required
  revision_id required

lineage_member = false
  envelope_profile = NON_LINEAGE_CONTEXT
  lineage_id and revision_id not required
  context_lineage_ref/context_revision_ref optional
```

`twin_runtime_attempt_v1` and `twin_runtime_health_v1` may be written before bootstrap, active lineage, config resolution, or checkpoint creation.

## 4. Canonical persistence

The Postgres `facts` append-only store is the only canonical persistence envelope.

```text
facts.fact_id          persistence-assigned storage identity
facts.occurred_at      object-contract logical event time
facts.source           authorized writer class
record_json.type       object_type
record_json.payload    semantic object envelope
```

`object_id` is deterministic semantic identity. `fact_id` is excluded from `object_id` and `determinism_hash`. Projections may upsert and must be rebuildable. Lease, heartbeat, attempt-latest, and temporary compute state remain mutable operational coordination.

## 5. State semantics and atomicity

A successful State advance atomically commits:

```text
twin_state_transition_v1
twin_assimilation_update_v1
twin_state_estimate_v1
```

All three are `lineage_member=true`. The propagated prior is embedded in transition and is not current State. The posterior is canonical State. A sensor reading remains Evidence. Assimilation is not calibration.

## 6. Tick lifecycle

### Claim

```text
resolve scope
acquire/refresh lease
obtain fencing token
read expected checkpoint
derive logical tick identity
append/update attempt audit state
```

Claim and failure audit do not require an existing lineage.

### Compute

```text
resolve immutable config snapshot
freeze evidence window
propagate prior
run observation operator
run assimilation
construct posterior
compute Forecast outcome
construct hashes
verify physical invariants
```

### Commit outcomes

#### A1 COMPLETED

```text
Forecast.status = COMPLETED
Forecast.points = exactly 72
horizons = 1..72
terminal tick = COMPLETED
checkpoint advances
latest Forecast result advances
latest successful Forecast advances
Scenario eligible
```

#### A2 BLOCKED Forecast

Applies when posterior State is valid but a non-State Forecast prerequisite is unavailable or insufficient.

```text
Forecast.status = BLOCKED
Forecast.points = 0
reason_codes required
terminal tick = COMPLETED_WITH_LIMITATIONS
checkpoint advances
latest Forecast result advances
latest successful Forecast unchanged
Scenario not eligible
```

#### F FAILED Forecast

Applies to numerical error, model exception, physical invariant failure, or program failure.

```text
append twin_runtime_attempt_v1
append twin_runtime_health_v1
append twin_forecast_failure_v1 when Forecast failure diagnostics exist
no canonical terminal tick
no checkpoint
no twin_forecast_run_v1
no active-lineage Forecast
```

Any A transaction failure rolls back its complete record set. Failed attempts and failed Forecasts never advance checkpoint.

## 7. Attempt, Health, and failure audit

```text
twin_runtime_attempt_v1   record_class=OPERATIONAL_AUDIT, lineage_member=false
twin_runtime_health_v1    record_class=OPERATIONAL_AUDIT, lineage_member=false
twin_forecast_failure_v1  record_class=OPERATIONAL_AUDIT, lineage_member=false
```

They may carry optional lineage/checkpoint/config context refs, but those refs are not prerequisites for recording bootstrap or early-resolution failures.

Health means runtime operation only, never crop, soil, device, or model correctness.

## 8. Recovery

Each scope is:

```text
tenant/project/group/field/season/zone
```

One active writer lease carries a monotonically increasing fencing token. Successful A1/A2 ticks append `twin_runtime_checkpoint_v1` and CAS-update latest checkpoint. Restart reads active lineage and checkpoint and backfills sequentially from checkpoint+1h to target. Same-scope parallel advancement is forbidden.

## 9. Identity and idempotency

Semantic identity uses object type, scope, logical time, source identity, config hash, and lineage/revision only when `lineage_member=true`.

Excluded from deterministic semantic hash:

```text
fact_id
created_at/persisted_at
worker id
lease owner
wall-clock insertion time
random UUID
```

```text
same idempotency key + same determinism hash -> idempotent success
same idempotency key + different hash -> IDEMPOTENCY_CONFLICT
```

## 10. Late Evidence and revision lifecycle

Late Evidence never mutates historical facts.

```text
E1_DECLARE_REVISION
  append twin_revision_run_v1 status=DECLARED
  append candidate twin_runtime_lineage_v1
  switch no active pointers

E2_APPEND_REVISION_STATUS
  append twin_revision_run_v1 status=RUNNING|FAILED|COMPLETED
  switch no active pointers

candidate ticks recompute through current checkpoint
chain validation runs

E3_PROMOTE_LINEAGE
  require revision COMPLETED and valid candidate chain
  append twin_lineage_promotion_v1
  atomically switch active lineage, checkpoint, State,
  Forecast result/success pointers, eligible Scenario, and Health
```

Superseded history remains queryable. Candidate creation never makes it active.

## 11. Forecast

`twin_forecast_run_v1` permits only:

```text
COMPLETED -> 72 points, lineage_member=true
BLOCKED   -> 0 points + reason_codes, lineage_member=true
```

`FAILED` is forbidden on `twin_forecast_run_v1`. Failure diagnostics use `twin_forecast_failure_v1`, which is non-lineage operational audit and belongs to transaction F.

Point tables remain projections. `t0` posterior is not a Forecast point.

## 12. Scenario

`twin_scenario_set_v1` is a separate transaction and requires:

```text
source Forecast.status = COMPLETED
source Forecast.points.length = 72
source Forecast.horizons = 1..72
```

BLOCKED Forecast and `twin_forecast_failure_v1` are invalid sources.

Gate A options remain:

```text
NO_ACTION
IRRIGATE_NOW_10MM
IRRIGATE_NOW_20MM
IRRIGATE_NOW_30MM
DELAY_24H_20MM
```

Scenario is not Recommendation, Approval, Dispatch, Task, or execution instruction.

## 13. Action Feedback

`twin_action_feedback_v1` is non-lineage execution Evidence history.

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

At least one trusted execution source is required:

```text
receipt_ref or as_executed_ref
```

`acceptance_ref` is optional. `task_ref` is required only for `origin_kind=AO_ACT`; historical imports or authenticated manual execution records may not have an AO-ACT task.

Eligibility depends on actual amount, executed time, spatial coverage, source identity, source quality, and limitations. A trustworthy `NOT_YET_VALIDATED` record may be eligible for later State input. Later Acceptance appends a superseding feedback record; it never rewrites history.

Executed is not Validated.

## 14. Residual and model governance

Assimilation residual belongs to the current update. Forecast residual compares a historical COMPLETED Forecast point with later Evidence and does not mutate the Forecast. Candidate, shadow evaluation, approval, and activation remain separate append-only transitions. Candidate is not Active Model.

## 15. APIs and legacy

Canonical frontend family remains `/operator/fields/:fieldId/*`. Canonical server Runtime APIs remain read-only under `/api/v1/operator/fields/:fieldId/runtime/*`. Generated objects have no public write endpoint. Human decision, approval, operation plan, AO-ACT, receipt, and acceptance remain separately governed.

Legacy read paths remain compatibility-only and gain no new canonical write.

## 16. Transaction families

Eight frozen machine-readable families:

```text
A_STATE_TICK_COMMIT
B_SCENARIO_COMMIT
C_FORECAST_RESIDUAL_COMMIT
D_MODEL_GOVERNANCE_STEP_COMMIT
E_REVISION_LINEAGE_STEP_COMMIT
F_OPERATIONAL_ATTEMPT_HEALTH
G_HUMAN_DECISION_LINK_COMMIT
H_ACTION_FEEDBACK_COMMIT
```

Every object uses `transaction_families: []`. Every listed family must exist and cover the object in `canonical_appends` or an explicit `operation_variants[].canonical_appends`. Natural-language values such as `A or F` are forbidden.

## 17. Downstream authority

The canonical object-set and transaction-matrix v2 files are authoritative for machine relationships. `GEOX-DT-02-ARCHITECTURE-AMENDMENT-01.md` names every superseded rule. MCFT phases may not silently overturn them.

## 18. Completion statement

The amendment is complete only after the amended DT-02 Gate, DT-01 audit, DT-01 acceptance, DT-00 regression, changed-file boundary, clean working tree, and final CI all pass on final bytes.

No runtime capability is claimed by this document.
