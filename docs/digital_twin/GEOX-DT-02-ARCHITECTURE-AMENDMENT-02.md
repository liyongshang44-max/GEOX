<!-- docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02.md -->
# GEOX DT-02 Architecture Amendment 02

## 0. Authority

```text
phase: DT-02
amendment: DT02-AMENDMENT-02
name: Initial Lineage and Bootstrap State Semantics
reason: close the first-lineage and first-checkpoint architecture gap
supersedes: selected rules in DT02-ADR-003, 004, 005, 006, 007, 008, 015, 016
baseline: MCFT-GOV-01 PR head 09f03488713cde4dbd8c48914fdcb30637d19a3d
predecessor: MCFT-VERTICAL-AMENDMENT-01
successor: MCFT-CAP-01 Canonical Replay Dataset slice
status: PENDING_ACCEPTANCE
```

This amendment is governance-only. It creates no Runtime source, migration, repository implementation, canonical fact, State, Forecast, checkpoint, public write route, or production capability.

## 1. Problem closed by this amendment

DT-02 currently freezes successful State Tick transactions but does not define:

```text
how the first active lineage is created
how the first revision_id exists without a revision run
how BOOTSTRAP transition represents no previous posterior
how INITIAL checkpoint represents no previous checkpoint
how same-input A0 replay remains idempotent after pointers exist
```

`null`, fabricated references, hidden fixtures, random UUIDs, and revision-promotion records are forbidden substitutes.

## 2. A0 operation variant

The existing transaction family remains:

```text
A_STATE_TICK_COMMIT
```

A new operation variant is frozen:

```text
A0_BOOTSTRAP_STATE_COMMIT
```

A0 is not a new transaction family and does not change the count of eight DT-02 transaction families.

A0 applies only to a scope that has no canonical INITIAL lineage, no active lineage, no current State, no checkpoint, and no Forecast result pointer.

## 3. Initial lineage activation authority

Initial activation is not revision promotion.

The active-lineage authority rules are:

```text
NULL_TO_INITIAL
  authority:
    successful A0_BOOTSTRAP_STATE_COMMIT
    + INITIAL twin_runtime_lineage_v1

ACTIVE_TO_REVISION_CANDIDATE
  authority:
    successful E3_PROMOTE_LINEAGE
    + twin_lineage_promotion_v1
```

The previous broad expression that every active-lineage change requires `twin_lineage_promotion_v1` is superseded. `twin_lineage_promotion_v1` remains mandatory for replacing an existing active lineage and is forbidden as a fabricated initial-promotion record.

The active-lineage projection records unified audit fields:

```yaml
activation_authority_kind:
  - INITIAL_LINEAGE_DECLARATION
  - LINEAGE_PROMOTION
activation_authority_ref: required
expected_previous_active_lineage: object_id | null
```

For initial activation:

```yaml
activation_authority_kind: INITIAL_LINEAGE_DECLARATION
activation_authority_ref: <INITIAL twin_runtime_lineage_v1 object_id>
expected_previous_active_lineage: null
```

## 4. Conditional lineage contract

`twin_runtime_lineage_v1` supports:

```text
lineage_kind:
  INITIAL
  REVISION_CANDIDATE
```

### 4.1 INITIAL

```yaml
writer: Runtime Orchestrator
transaction_family: A_STATE_TICK_COMMIT
operation_variant: A0_BOOTSTRAP_STATE_COMMIT
parent_lineage_ref: null
revision_run_ref: null
bootstrap_runtime_config_ref: required
bootstrap_reality_binding_ref: required
initial_revision_id: required
activation_authority_kind: INITIAL_LINEAGE_DECLARATION
```

### 4.2 REVISION_CANDIDATE

```yaml
writer: Revision Service
transaction_family: E_REVISION_LINEAGE_STEP_COMMIT
revision_run_ref: required
parent_lineage_ref: required
bootstrap_runtime_config_ref: forbidden
bootstrap_reality_binding_ref: forbidden
```

The object's `transaction_families` becomes:

```json
["A_STATE_TICK_COMMIT", "E_REVISION_LINEAGE_STEP_COMMIT"]
```

## 5. Initial lineage and revision identity

All A0 lineage members use the same deterministic `lineage_id` and `revision_id`.

```yaml
initial_lineage_identity_payload:
  lineage_kind: INITIAL
  scope:
    tenant_id:
    project_id:
    group_id:
    field_id:
    season_id:
    zone_id:
  reality_binding_ref:
  reality_binding_hash:
  runtime_config_ref:
  runtime_config_hash:
  bootstrap_logical_time:

lineage_id:
  derivation: deterministic semantic ID from initial_lineage_identity_payload
```

```yaml
initial_revision_identity_payload:
  revision_kind: INITIAL
  lineage_id:
  bootstrap_logical_time:
  runtime_config_hash:
  reality_binding_hash:

revision_id:
  derivation: deterministic semantic ID from initial_revision_identity_payload
```

For an INITIAL revision:

```text
revision_id is required
revision_run_ref is null and forbidden as a required reference
no twin_revision_run_v1 object is implied or created
```

Only `REVISION_REPLAY` revisions require a resolvable `twin_revision_run_v1`.

Forbidden identity inputs include:

```text
random UUID
fact_id
created_at
persisted_at
wall clock
process ID
worker ID
branch name
checkout path
```

## 6. A0 canonical append set

A0 appends exactly nine canonical facts in one database transaction:

```text
1. twin_runtime_lineage_v1
2. twin_evidence_window_v1
3. twin_state_transition_v1
4. twin_assimilation_update_v1
5. twin_state_estimate_v1
6. twin_forecast_run_v1
7. twin_runtime_tick_v1
8. twin_runtime_checkpoint_v1
9. twin_runtime_health_v1
```

A0 does not append `twin_lineage_promotion_v1` or `twin_revision_run_v1`.

The A0 Forecast must be:

```yaml
status: BLOCKED
points: []
reason_codes: non-empty
scenario_eligible: false
```

The terminal tick must be `COMPLETED_WITH_LIMITATIONS` and the checkpoint advances.

## 7. Bootstrap transition and embedded prior

`twin_state_transition_v1` supports:

```text
transition_kind:
  BOOTSTRAP
  CONTINUATION
  REVISION_REPLAY
```

For `BOOTSTRAP`:

```yaml
previous_posterior_ref: null
bootstrap_prior:
  prior_kind: CONFIGURED_WEAK_BOOTSTRAP_PRIOR
  mean: required
  variance: required
  stddev: required
  derivation_rule_id: required
  source_runtime_config_ref: required
  source_soil_hydraulic_config_ref: required
bootstrap_prior_ref: forbidden
process_model_status: NOT_APPLIED_BOOTSTRAP
```

The bootstrap prior is embedded computation input, not an independent canonical object. No dangling `bootstrap_prior_ref` is permitted.

For `CONTINUATION` and `REVISION_REPLAY`:

```yaml
previous_posterior_ref: required
bootstrap_prior: forbidden
bootstrap_prior_ref: forbidden
```

## 8. Initial checkpoint

`twin_runtime_checkpoint_v1` supports:

```text
checkpoint_kind:
  INITIAL
  CONTINUATION
  REVISION
```

For `INITIAL`:

```yaml
previous_checkpoint_ref: null
```

For `CONTINUATION` and `REVISION`:

```yaml
previous_checkpoint_ref: required
```

## 9. A0 aggregate idempotency

A0 idempotency applies to the complete nine-object record set.

The Runtime must derive before mutation:

```yaml
a0_record_set_id:
a0_idempotency_key:
a0_record_set_determinism_hash:
member_object_ids: exactly 9
member_determinism_hashes: exactly 9
```

The execution order is frozen:

```text
1. independently compute aggregate key and all semantic hashes
2. query twin_object_idempotency_index_v1
3. existing key + same independently computed aggregate hash
   -> verify complete nine-object record set and equivalent projections
   -> return EXISTING_IDEMPOTENT_SUCCESS
   -> do not require null pointer preconditions
4. existing key + different aggregate hash
   -> IDEMPOTENCY_CONFLICT
5. declared hash differs from independently computed hash
   -> SEMANTIC_HASH_MISMATCH
6. only a new key proceeds to lease, fencing, canonical uniqueness and null-CAS checks
7. facts, projections, pointers and idempotency index commit atomically
```

A prior successful A0 therefore remains idempotent even though active lineage, State and checkpoint pointers are no longer null.

## 10. Canonical uniqueness of INITIAL lineage

For one scope plus Reality binding, Runtime config and bootstrap logical time:

```text
existing identical INITIAL lineage
  -> idempotent readback

existing different INITIAL lineage
  -> INITIAL_LINEAGE_CONFLICT

no INITIAL lineage
  -> A0 may proceed
```

Projection absence or deletion does not permit creation of a second canonical INITIAL lineage.

## 11. New-key A0 preconditions and CAS

After idempotency lookup proves the key is new, all must hold:

```text
valid unexpired lease
current fencing token
expected active lineage = null
expected checkpoint = null
expected current State = null
expected latest Forecast result = null
expected latest successful Forecast = null
immutable Runtime config exists
one frozen Evidence Window exists
bootstrap posterior passes numerical and physical validation
Forecast.status = BLOCKED
Forecast.points.length = 0
Forecast.reason_codes non-empty
```

Any failed precondition causes:

```text
zero A0 canonical append
zero lineage-member append
zero State/Forecast/tick/checkpoint append
zero A0 projection write
zero pointer change
```

A separately transacted `F_OPERATIONAL_ATTEMPT_HEALTH` audit append is permitted and does not count as A0 partial success.

## 12. A0 projection changes

The same database transaction performs:

```text
active lineage index insert/CAS
State history projection insert
State latest projection CAS
Forecast result latest insert
Checkpoint latest insert/CAS
Runtime Health latest update
twin_object_idempotency_index_v1 insert
```

It must not update:

```text
latest successful Forecast
Scenario latest
Decision projection
Action projection
```

## 13. State and Forecast eligibility boundary

The State may contain:

```yaml
confidence:
  status: NOT_ESTABLISHED
  reason_code: NO_CALIBRATED_CONFIDENCE_MODEL
  numeric_score: forbidden

use_eligibility:
  state_valid: true
  posterior_chain_eligible: true
  forecast_source_eligible: true
  recommendation_input_eligible: false
  action_input_eligible: false
```

Forecast prerequisite results and reason codes belong to `twin_forecast_run_v1`, not to the State payload.

## 14. Failure audit semantics

Acceptance must distinguish:

```yaml
failure_without_operational_audit:
  expected_a0_fact_count: 0
  expected_operational_audit_fact_count: 0
  expected_pointer_change_count: 0

failure_with_operational_audit:
  expected_a0_fact_count: 0
  expected_operational_audit_fact_count: one_or_more
  expected_pointer_change_count: 0
```

No operational audit record may claim committed State success.

## 15. Unaffected architecture

The following remain unchanged:

```text
eight transaction families
A1 COMPLETED semantics
A2 BLOCKED Forecast continuation semantics
F Forecast failure semantics
E1/E2/E3 late-Evidence revision lifecycle
Scenario requires a COMPLETED 72-point Forecast
Action Feedback execution/validation orthogonality
read-only Runtime APIs
no public generated-object write endpoint
append-only canonical facts and rebuildable projections
```

## 16. Changed-file boundary

Allowed:

```text
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02.md
docs/digital_twin/GEOX-DT-02-BOOTSTRAP-STATE-SEMANTICS.json
docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json
docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-DECISION-REGISTER.json
docs/digital_twin/GEOX-DT-02-RUNTIME-ARCHITECTURE-FREEZE.md
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02-CLOSURE-RECORD.md
scripts/governance_acceptance/ACCEPTANCE_DT_02_RUNTIME_ARCHITECTURE_FREEZE.cjs
scripts/governance_acceptance/ACCEPTANCE_DT_02_ARCHITECTURE_AMENDMENT_02.cjs
```

Forbidden:

```text
apps/server/**
apps/web/**
fixtures/**
apps/server/db/migrations/**
package.json
pnpm-lock.yaml
.github/workflows/**
Runtime source
canonical State write
```

## 17. Completion claim

This amendment may claim only:

```text
DT02_INITIAL_LINEAGE_AND_BOOTSTRAP_SEMANTICS_FROZEN
A0_BOOTSTRAP_TRANSACTION_CONTRACT_FROZEN
NO_RUNTIME_IMPLEMENTATION
NO_CANONICAL_WRITE
```
