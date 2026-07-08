<!-- docs/digital_twin/GEOX-DT-02-RUNTIME-ARCHITECTURE-FREEZE.md -->
# GEOX DT-02 Runtime Architecture Freeze

## 0. Authority

```text
phase: DT-02
name: Runtime Architecture Freeze
type: architecture governance and contract freeze
predecessor: DT-01 Existing Capability Reconciliation
successor: MCFT-00 Reality Binding Contract
baseline branch: main
baseline commit: 9a31f046d717def94db30e156384b35267b503d4
baseline meaning: DT-01 and DT-01 artifact-integrity hotfix merged
status: FROZEN
```

DT-02 freezes one Minimum Complete Field Twin runtime architecture. It creates no runtime source, database migration, route, scheduler, projection, domain implementation, frontend adapter, or production capability.

Allowed claim:

```text
GEOX has a frozen runtime architecture for Replay, Shadow-online,
Controlled Field, and future Production modes.
```

Forbidden claims:

```text
hourly runtime implemented
state estimator implemented
observation assimilation implemented
72-hour forecast runtime implemented
checkpoint/restart implemented
live production Field Twin implemented
```

## 1. Review corrections applied before freeze

The proposed task line contained four contradictions that are resolved by this freeze.

1. `fact_id` is persistence-envelope identity. It is not a semantic object field and is excluded from `object_id` and `determinism_hash`.
2. `twin_runtime_attempt_v1` is append-only operational audit, not canonical posterior/State history. Mutable lease, attempt-latest, heartbeat, and temporary compute state remain operational coordination.
3. Active-lineage changes require append-only `twin_lineage_promotion_v1`; a mutable active-lineage index may not move without that authority record.
4. The transaction model contains eight complete families, not five. It includes blocked/failed attempt and health audit, human decision linkage, and normalized action feedback.
5. A successful forecast has exactly 72 points. A BLOCKED or FAILED forecast has exactly zero points plus non-empty reason codes and is not counted as a successful forecast.

These corrections tighten auditability and do not add runtime capability.

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

Replay, Shadow-online, Controlled Field, and Production share domain semantics, object contracts, transition semantics, forecast/scenario semantics, persistence, idempotency, revision lineage, and trace. They may differ only in clock, evidence ingress, scheduler, execution feedback, availability controls, and deployment operations.

## 3. Layer rule

- `domain/`: pure propagation, observation operator, assimilation, uncertainty, forecast, scenario, residual matching, deterministic hash, physical bounds, validation.
- `runtime/`: claim, config resolution, evidence freeze, domain invocation, canonical object construction, checkpoint/revision orchestration, health.
- `persistence/`: SQL, transactions, fact append, projection upsert, checkpoint CAS, lease/fencing, history readers, lineage promotion.
- `adapters/`: clock, ingress, scheduler, execution feedback, availability, deployment.
- `routes/`: auth, scope, validation, read-service/human-write-service invocation, response mapping.
- `projections/`: rebuildable indexes and compatibility read shapes.
- `web/`: read-only runtime presentation and navigation to separately governed human action surfaces.

Domain and runtime core may not read Fastify requests, Postgres, environment variables, wall clock, random UUID, filesystem, network, or UI state except through frozen ports.

## 4. Canonical persistence

The existing Postgres `facts` append-only store is the only canonical persistence envelope for runtime history and append-only operational audit.

```text
facts.fact_id          persistence-assigned storage identity
facts.occurred_at      object-contract logical event time
facts.source           authorized writer class
record_json.type       object_type
record_json.payload    semantic object envelope
```

A semantic object has deterministic `object_id`; persistence returns the mapping from `object_id` to `fact_id`. No second canonical business table is permitted.

Mutable projections include latest/history/point indexes for State, Forecast, Scenario, Residual, Checkpoint, Health, active config, and active lineage. They may upsert and must be rebuildable from canonical facts.

Lease, claim, heartbeat, attempt-latest, and temporary compute state are mutable operational coordination, not Twin history.

## 5. State semantics and atomicity

A successful State advance commits separately addressable but atomic facts:

```text
twin_state_transition_v1
twin_assimilation_update_v1
twin_state_estimate_v1
```

The propagated prior is embedded in the transition. It is not current canonical State. The posterior estimate is canonical State.

`twin_assimilation_update_v1` is present even with no usable observation:

```text
status = NO_USABLE_OBSERVATION
uncertainty increases
```

A sensor reading remains Evidence and never directly becomes root-zone State. Assimilation is not calibration.

## 6. Tick lifecycle

### Claim

Short operational transaction:

```text
resolve scope
acquire/refresh lease
obtain fencing token
read expected checkpoint
derive logical tick identity
record attempt state
```

### Compute

Outside the database transaction:

```text
resolve immutable config snapshot
freeze evidence window
propagate prior
run observation operator
run assimilation
construct posterior
generate forecast result
construct hashes and canonical payloads
verify physical invariants
```

No later-arriving Evidence may enter the frozen window.

### Atomic commit

One Postgres transaction:

```text
revalidate lease and fencing token
CAS expected checkpoint
append evidence window
append transition
append assimilation update
append posterior
append forecast result
append terminal tick
append checkpoint
append health snapshot
update projections/indexes
commit
```

Any failure rolls back the complete record set. No checkpoint may advance on a failed or blocked attempt.

## 7. Attempt, tick, and health

Operational attempt states:

```text
SCHEDULED
RUNNING
BLOCKED
FAILED
RECOVERING
```

`twin_runtime_attempt_v1` records append-only operational audit. It never enters the posterior chain.

Canonical terminal tick states:

```text
COMPLETED
COMPLETED_WITH_LIMITATIONS
```

No usable observation may still produce `COMPLETED_WITH_LIMITATIONS` if propagation is valid. Missing critical configuration, physical invariant failure, or stale fencing authority creates no canonical tick or posterior.

`twin_runtime_health_v1` is runtime-operation status only:

```text
healthy
degraded
blocked
failed
stale
recovering
revision_in_progress
```

It is not crop health, soil health, device health, or model correctness.

## 8. Recovery

Each scope is:

```text
tenant/project/group/field/season/zone
```

One active writer lease carries owner, monotonically increasing fencing token, acquired/expiry/heartbeat times. A stale worker cannot commit with an old token.

Every successful tick appends `twin_runtime_checkpoint_v1` and CAS-updates the latest checkpoint index.

Restart sequence:

```text
read active lineage
read latest checkpoint
compare scheduler target
backfill checkpoint+1h ... target in ascending order
```

Level A forbids parallel advancement of the same scope.

## 9. Identity and idempotency

Semantic identity inputs:

```text
object type
scope
logical time
lineage
revision
source object identity
runtime config hash
```

`determinism_hash` covers normalized semantic payload only.

Excluded:

```text
fact_id
created_at/persisted_at
worker id
lease owner
wall-clock insertion time
random UUID
```

Rules:

```text
same idempotency key + same determinism hash -> idempotent success
same idempotency key + different hash -> IDEMPOTENCY_CONFLICT
```

No overwrite is permitted.

## 10. Late Evidence and lineage

Late Evidence creates a candidate lineage and immutable revised objects. It never updates historical facts.

```text
detect earliest affected tick
create revision run and candidate lineage
retain unchanged parent prefix
recompute through current checkpoint
validate complete chain
append twin_lineage_promotion_v1
atomically switch active lineage and all latest pointers
```

Superseded lineages remain queryable. Default reads use active lineage. The promotion fact is the append-only authority for the mutable active-lineage index.

## 11. Forecast

`twin_forecast_run_v1` is one canonical aggregate.

```text
COMPLETED -> exactly 72 ordered points, horizons 1..72
BLOCKED/FAILED -> exactly 0 points and non-empty reason_codes
t0 posterior -> not a forecast point
```

Point tables are projections only. A successful forecast cannot partially commit.

## 12. Scenario

`twin_scenario_set_v1` is a separate atomic aggregate downstream of a committed forecast.

Gate A options:

```text
NO_ACTION
IRRIGATE_NOW_10MM
IRRIGATE_NOW_20MM
IRRIGATE_NOW_30MM
DELAY_24H_20MM
```

Every successful comparable option has 72 points. `CUSTOM_OPERATOR_OPTION` is deferred.

Scenario commit is separate from State Tick commit. Scenario is not Recommendation, Approval, Dispatch, Task, or execution instruction.

## 13. Residual and model governance

Assimilation residual belongs to the current-tick assimilation update. Forecast residual compares a historical forecast point with later Evidence and never changes the forecast.

Residual may create review or candidate records. It may not:

```text
change active parameter
activate model
rewrite historical State
prove causal effect
```

Each tick resolves one immutable `twin_runtime_config_v1` before compute. Candidate, shadow evaluation, governance approval, and activation are separate append-only transitions. Activation is effective only at a tick boundary. Rollback appends a new activation record.

## 14. APIs and legacy

Canonical frontend family remains:

```text
/operator/fields/:fieldId/*
```

Frozen MCFT read family:

```text
GET /api/v1/operator/fields/:fieldId/runtime
GET /api/v1/operator/fields/:fieldId/runtime/states
GET /api/v1/operator/fields/:fieldId/runtime/forecasts
GET /api/v1/operator/fields/:fieldId/runtime/scenario-sets
GET /api/v1/operator/fields/:fieldId/runtime/residuals
GET /api/v1/operator/fields/:fieldId/runtime/action-lifecycle
GET /api/v1/operator/fields/:fieldId/runtime/health
GET /api/v1/operator/fields/:fieldId/runtime/trace
```

No `/operator/twin-runtime/fields/*` family is allowed. Generated objects have no public write endpoint. Manual tick starts as application service plus CLI/manual runner and scheduler adapter.

Human decision, approval, operation plan, AO-ACT, receipt, and acceptance remain separately governed.

Legacy read paths remain available but receive no new capability and no new canonical write. `water_state_estimate_v1` is compatibility read only, not canonical posterior.

## 15. Transaction families

Eight frozen families:

```text
A State Tick Commit
B Scenario Commit
C Forecast Residual Commit
D Model Governance Step Commit
E Revision Promotion Commit
F Operational Attempt and Health Commit
G Human Decision Link Commit
H Action Feedback Commit
```

The transaction matrix is authoritative for appends, projections, preconditions, failure, and idempotency.

## 16. Frozen object set

The object-set register is authoritative. It includes the required lineage promotion authority object and classifies attempt/health as operational audit rather than physical State.

MCFT-02 freezes complete field schemas. DT-02 freezes responsibility, references, persistence class, aggregate boundary, writer, reader, transaction family, and revision behavior.

## 17. DT-01 input closure

Every DT-01 Input Packet topic is mapped to one or more FROZEN ADRs:

```text
canonical atomicity -> ADR-004
layers -> ADR-001/002
canonical/index persistence -> ADR-003
tick transaction -> ADR-005/016
checkpoint/recovery -> ADR-006/016
idempotency -> ADR-007
late evidence -> ADR-008
forecast storage -> ADR-009
scenario storage -> ADR-010
model governance -> ADR-011/012
API naming -> ADR-013
legacy compatibility -> ADR-014
write authority -> ADR-015
```

DT-01 target=DT-02 reuse decisions are resolved in the decision register, matrices, and implementation map.

## 18. Downstream authority

MCFT-00 through MCFT-18 must implement this architecture. A downstream phase may not silently overturn it. Any change requires a separate architecture amendment ADR naming the superseded rule.

## 19. Completion statement

DT-02 Runtime Architecture Freeze is complete when its Acceptance Gate, DT-01 regression, DT-00 regression, and CI pass.

No runtime capability is claimed by this document.
