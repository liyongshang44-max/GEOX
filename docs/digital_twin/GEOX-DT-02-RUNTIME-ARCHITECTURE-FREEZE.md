<!-- docs/digital_twin/GEOX-DT-02-RUNTIME-ARCHITECTURE-FREEZE.md -->
# GEOX DT-02 Runtime Architecture Freeze

## 0. Authority

```text
phase: DT-02
name: Runtime Architecture Freeze
type: architecture governance and contract freeze
predecessor: DT-01 Existing Capability Reconciliation
original successor: MCFT-00 Reality Binding Contract
original merge: 4c1d854a5190a5d37d7cea0a4ded3f6f3ce8b614
accepted amendments: DT02-AMENDMENT-01, DT02-AMENDMENT-02
status: FROZEN_WITH_ACCEPTED_AMENDMENTS
```

DT-02 freezes one Minimum Complete Field Twin runtime architecture. It creates no Runtime source, migration, route, scheduler, projection implementation, domain implementation, frontend adapter, canonical fact, or production capability.

Allowed claim:

```text
RUNTIME_ARCHITECTURE_FROZEN_NO_RUNTIME_IMPLEMENTATION
```

## 1. Amendment history

DT02-AMENDMENT-01 closed:

```text
record class versus lineage membership
revision E1/E2/E3 transaction closure
Forecast COMPLETED/BLOCKED/FAILED separation
Scenario source eligibility
Action Feedback execution/validation orthogonality
machine-readable transaction coverage
```

DT02-AMENDMENT-02 closes:

```text
first active lineage creation
INITIAL revision identity without revision-run object
BOOTSTRAP transition without previous posterior
INITIAL checkpoint without previous checkpoint
A0 aggregate idempotency before null-CAS
canonical INITIAL lineage uniqueness
failure audit versus zero A0 partial write
```

Only clauses explicitly named by an amendment are superseded. All other decisions remain frozen.

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
history_class
lineage_member
envelope_profile
transaction_families[]
```

Rules:

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

For an INITIAL lineage revision:

```text
revision_id required
revision_run_ref = null
no twin_revision_run_v1 object implied
```

Only late-Evidence `REVISION_REPLAY` requires a revision-run object.

`twin_runtime_attempt_v1`, `twin_runtime_health_v1`, and `twin_forecast_failure_v1` may exist before bootstrap, active lineage, config resolution, or checkpoint creation.

## 4. Canonical persistence

The Postgres `facts` append-only store is the only canonical persistence envelope.

```text
facts.fact_id          persistence-assigned storage identity
facts.occurred_at      object-contract logical event time
facts.source           authorized writer class
record_json.type       object_type
record_json.payload    semantic object envelope
```

`object_id` is deterministic semantic identity. `fact_id` is excluded from `object_id` and `determinism_hash`. Projections may upsert and must be rebuildable. Lease, heartbeat, attempt-latest, temporary compute state, and idempotency indexes are mutable operational coordination.

## 5. State semantics and atomicity

A valid State advance atomically commits:

```text
twin_state_transition_v1
twin_assimilation_update_v1
twin_state_estimate_v1
```

All three are `lineage_member=true`. The prior is not current State. The posterior is canonical State. A sensor reading remains Evidence. Assimilation is not calibration.

### 5.1 BOOTSTRAP

```text
transition_kind = BOOTSTRAP
previous_posterior_ref = null
bootstrap_prior embedded and explicit
bootstrap_prior_ref forbidden
process_model_status = NOT_APPLIED_BOOTSTRAP
```

The embedded prior is computation input, not an independent canonical object.

### 5.2 CONTINUATION and REVISION_REPLAY

```text
previous_posterior_ref required
bootstrap_prior forbidden
bootstrap_prior_ref forbidden
```

## 6. Tick lifecycle

### Claim

```text
resolve scope
acquire/refresh lease
obtain fencing token
read expected pointers
derive logical tick or A0 aggregate identity
append/update attempt audit state where applicable
```

Claim and failure audit do not require an existing lineage.

### Compute

```text
resolve immutable config snapshot
freeze evidence window
construct bootstrap prior or propagate prior
run observation operator
run assimilation
construct posterior
compute Forecast outcome
construct hashes
verify numerical and physical invariants
```

### Commit outcomes

#### A0 BOOTSTRAP

```text
lineage_kind = INITIAL
transition_kind = BOOTSTRAP
checkpoint_kind = INITIAL
Forecast.status = BLOCKED
Forecast.points = 0
Forecast.reason_codes required
terminal tick = COMPLETED_WITH_LIMITATIONS
checkpoint advances
latest Forecast result advances
latest successful Forecast unchanged
Scenario ineligible
```

A0 appends exactly nine canonical facts:

```text
twin_runtime_lineage_v1
twin_evidence_window_v1
twin_state_transition_v1
twin_assimilation_update_v1
twin_state_estimate_v1
twin_forecast_run_v1
twin_runtime_tick_v1
twin_runtime_checkpoint_v1
twin_runtime_health_v1
```

A0 appends no promotion or revision-run object.

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

#### F FAILED Forecast or attempt

```text
append twin_runtime_attempt_v1 where applicable
append twin_runtime_health_v1 where applicable
append twin_forecast_failure_v1 when diagnostics exist
no canonical terminal tick
no checkpoint
no twin_forecast_run_v1
no active-lineage Forecast
```

Any A transaction failure rolls back its complete A record set. A separate F audit is permitted and is not partial A success.

## 7. Initial lineage activation

`twin_runtime_lineage_v1` supports:

```text
INITIAL
REVISION_CANDIDATE
```

### NULL_TO_INITIAL

Authority is:

```text
successful A0_BOOTSTRAP_STATE_COMMIT
+ INITIAL twin_runtime_lineage_v1
```

The active-lineage index records:

```text
activation_authority_kind = INITIAL_LINEAGE_DECLARATION
activation_authority_ref = INITIAL lineage object_id
expected_previous_active_lineage = null
```

No `twin_lineage_promotion_v1` is created.

### ACTIVE_TO_REVISION_CANDIDATE

Authority remains:

```text
successful E3_PROMOTE_LINEAGE
+ twin_lineage_promotion_v1
```

Initial creation is not revision promotion.

## 8. Initial identity

All A0 lineage members use one deterministic `lineage_id` and one deterministic `revision_id`.

Identity includes:

```text
scope
Reality binding ref/hash
Runtime config ref/hash
bootstrap logical time
lineage/revision kind
```

Identity excludes:

```text
fact_id
created_at/persisted_at
wall clock
worker/process identity
lease owner
random UUID
branch or checkout path
```

For one scope, binding, config and bootstrap logical time:

```text
identical existing INITIAL lineage -> idempotent readback
different existing INITIAL lineage -> INITIAL_LINEAGE_CONFLICT
projection loss -> does not authorize a second INITIAL lineage
```

## 9. A0 aggregate idempotency

A0 idempotency applies to its complete nine-object record set.

The order is mandatory:

```text
1. independently compute aggregate key, object hashes and aggregate hash
2. query twin_object_idempotency_index_v1
3. same key + same computed aggregate hash
   -> verify complete existing record set and projections
   -> return EXISTING_IDEMPOTENT_SUCCESS
   -> skip null-CAS preconditions
4. same key + different computed aggregate hash
   -> IDEMPOTENCY_CONFLICT
5. declared hash mismatch
   -> SEMANTIC_HASH_MISMATCH
6. only a new key proceeds to canonical uniqueness, lease, fence and null-CAS checks
7. facts, projections, pointers and idempotency index commit atomically
```

A successful prior A0 does not make same-input replay fail merely because pointers are no longer null.

## 10. A0 new-key preconditions

```text
valid unexpired lease
current fencing token
no conflicting canonical INITIAL lineage
expected active lineage = null
expected checkpoint = null
expected current State = null
expected latest Forecast result = null
expected latest successful Forecast = null
immutable Runtime config resolved
one frozen Evidence Window
valid bootstrap posterior
BLOCKED zero-point Forecast with non-empty reason codes
```

Failure produces:

```text
zero A0 fact append
zero A0 projection write
zero pointer change
```

A separate F audit append is permitted.

## 11. Checkpoint, lease, fencing, restart, and backfill

Each scope is:

```text
tenant/project/group/field/season/zone
```

One active writer lease carries a monotonically increasing fencing token.

Checkpoint kinds:

```text
INITIAL       previous_checkpoint_ref = null
CONTINUATION  previous_checkpoint_ref required
REVISION      previous_checkpoint_ref required
```

Successful A0/A1/A2 transactions append checkpoint and CAS latest. Restart and backfill remain later MCFT-04 capability and are not established by this architecture or by one bootstrap checkpoint.

## 12. A0 projections

A0 atomically writes:

```text
active lineage index insert/CAS
State history insert
State latest CAS
Forecast result latest insert
Checkpoint latest insert/CAS
Runtime Health latest update
twin_object_idempotency_index_v1 insert
```

A0 must not update:

```text
latest successful Forecast
Scenario latest
Decision projection
Action projection
```

## 13. Late Evidence and revision lifecycle

Late Evidence never mutates historical facts.

```text
E1_DECLARE_REVISION
  append twin_revision_run_v1 DECLARED
  append REVISION_CANDIDATE twin_runtime_lineage_v1
  switch no active pointers

E2_APPEND_REVISION_STATUS
  append RUNNING|FAILED|COMPLETED revision status
  switch no active pointers

E3_PROMOTE_LINEAGE
  require revision COMPLETED and valid candidate chain
  append twin_lineage_promotion_v1
  atomically switch eligible active pointers
```

E3 is required for active-to-active replacement and is not used for initial activation.

## 14. Forecast

`twin_forecast_run_v1` permits only:

```text
COMPLETED -> 72 points, lineage_member=true
BLOCKED   -> 0 points + reason_codes, lineage_member=true
```

`FAILED` is forbidden on `twin_forecast_run_v1`. Failure diagnostics use `twin_forecast_failure_v1` in transaction F.

Forecast prerequisite evaluation and BLOCKED reason codes belong to Forecast, not State.

State may declare:

```text
confidence.status = NOT_ESTABLISHED
confidence.numeric_score forbidden
forecast_source_eligible = true
```

This does not mean Forecast prerequisites are satisfied.

## 15. Scenario

`twin_scenario_set_v1` is a separate transaction and requires:

```text
source Forecast.status = COMPLETED
source Forecast.points.length = 72
source Forecast.horizons = 1..72
```

BLOCKED Forecast and Forecast failure are invalid sources. Scenario is not Recommendation, Approval, Dispatch, Task, or execution instruction.

## 16. Action Feedback

`twin_action_feedback_v1` remains non-lineage execution Evidence history with independent:

```text
execution_status
validation_status
eligible_for_state_input
```

At least one trusted execution source is required. Acceptance remains optional. Executed is not Validated.

## 17. Runtime health and failure audit

Health means Runtime operation only, never crop, soil, device, State accuracy, or model correctness.

Acceptance distinguishes:

```text
failed A0 without F audit -> zero new facts and zero pointer changes
failed A0 with F audit    -> zero A0 facts, optional F audit facts, zero pointer changes
```

No audit record may claim committed State success.

## 18. APIs and legacy

Canonical frontend family remains `/operator/fields/:fieldId/*`. Canonical server Runtime APIs remain read-only under `/api/v1/operator/fields/:fieldId/runtime/*`.

Generated objects have no public write endpoint. Human decision, approval, operation plan, AO-ACT, receipt, and acceptance remain separately governed. Legacy read paths remain compatibility-only and gain no new canonical write.

## 19. Transaction families

Eight frozen machine-readable families remain:

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

A now has A0, A1 and A2 operation variants. Every object uses `transaction_families: []`, and each family must cover every listed object in its canonical appends or explicit variants.

## 20. Downstream authority

The authoritative machine relationships are:

```text
docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json
docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json
docs/digital_twin/GEOX-DT-02-BOOTSTRAP-STATE-SEMANTICS.json
```

MCFT implementation may not silently overturn them.

## 21. Completion boundary

DT02-AMENDMENT-02 is complete only after its Gate, amended DT-02 Gate, DT-01 audit, DT-01 acceptance, DT-00 regression, MCFT vertical-amendment regression, changed-file boundary, clean working tree, and final CI pass on final bytes.

No Runtime capability is established by this document.
