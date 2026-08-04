# GEOX MCFT-CAP-09 — Shadow-Online Promotion

## Complete Taskbook v0.1 — Stage 1B Design Freeze / Pre-Candidate Governance Foundation

```text
document_id:
GEOX-MCFT-CAP-09-TASK-V0.1-STAGE-1B-DESIGN-FROZEN

capability_line_id:
MCFT-CAP-09

display_alias:
MCFT-9

canonical_name:
Shadow-Online Promotion

runtime_mode:
SHADOW_ONLINE

target_stage:
STAGE_1B_SHADOW_ONLINE_CLOSURE

predecessor:
MCFT-CAP-08 — 24-Tick End-to-End Closure

predecessor_effective_subject_sha:
67bd71560268046a7fa9a9433ee074ad3999cb71

predecessor_exact_sha_workflow_run:
30908130962

predecessor_exact_sha_artifact:
8891897316

predecessor_semantic_artifact_digest:
sha256:7e9d713631443641f17c06f71c494319c5f442424ba9ec9f426731940d2700f9

document_status:
PRE_CANDIDATE_GOVERNANCE_FOUNDATION

implementation_authorized:
false

runtime_source_authorized:
false

live_ingestion_authorized:
false

background_scheduler_authorized:
false

canonical_write_authorized:
false

candidate_declaration_authorized:
false

model_activation_authorized:
false

controlled_action_authorized:
false

minimum_complete_field_twin_complete:
false
```

## 0. Decisive ruling

MCFT-CAP-09 promotes the already-proven Replay Runtime semantics into a
single-scope Shadow-online operating mode. It does not create a second Twin
kernel. The following remain byte-for-byte semantic authorities unless a
separately adjudicated architecture amendment is merged:

```text
domain model
canonical object contracts
state-transition semantics
forecast and scenario semantics
transaction families
resolve → E → H → A → B → G → C → barrier
append-only facts and rebuildable projections
idempotency, fencing, checkpoint and revision rules
read-only Operator Runtime API family
```

Only these adapter classes may differ from Replay:

```text
ClockPort
EvidenceIngressPort
SchedulerPort
ExecutionFeedbackPort
AvailabilityPort
operational deployment configuration
```

This Taskbook freezes design and governance only. Presence on `main` does not
authorize Runtime source, database migration, canonical write, public writer,
live sensor ingestion, background scheduling, or Candidate Declaration.

## 1. Stage 1B closure target

The minimum formal Stage 1B closure is one governed scope operating through 24
actual hourly UTC scheduler boundaries:

```text
O00 ... O23
```

Final closure may not use an accelerated or replay clock. The formal window
must establish:

```text
24 persisted scheduler slots
24 resolved tick outcomes
actual database Evidence ingress frozen at each tick boundary
no future Evidence leakage
one controlled process restart
one intentionally missed slot recovered by ordered backfill
one stale-Evidence detection and degraded tick outcome
one late or out-of-order Evidence case handled append-forward
online State and Forecast readback
Scenario eligibility only from COMPLETED 72-point Forecast
Residual creation only when verification Evidence becomes eligible
zero automatic Recommendation
zero Approval
zero AO-ACT creation
zero Dispatch
zero Model Activation
```

The 24-hour Stage 1B minimum is not the separate 720-tick
`LONG_HORIZON_REPLAY_STABILITY_QUALIFICATION`.

## 2. Scope

Stage 1B remains bounded to:

```text
one tenant
one project
one group
one field
one season
one governed zone
one active Runtime lineage
one persistent sequential scheduler
one writer lease with monotonically increasing fencing token
one PostgreSQL canonical store
```

Multi-field concurrency, distributed HA scheduling, device gateway production
ingress, advisory recommendation, controlled action, and production deployment
remain outside CAP-09.

## 3. Adapter contracts

### 3.1 SchedulerClock

```text
source = scheduler-provided UTC wall clock
logical tick = exact hourly boundary
wall-clock drift measured
duplicate boundary claim is idempotent
future boundary claim is rejected
accelerated clock forbidden in formal closure
```

### 3.2 DatabaseEvidenceAdapter

```text
reads existing governed database Evidence only
freezes eligible Evidence at tick boundary
uses observed_at and ingested_at
excludes future and post-boundary Evidence
records coverage, freshness, maximum gap and exclusions
does not synthesize sensor truth
does not create production gateway authority
```

### 3.3 PersistentSequentialSchedulerAdapter

```text
one scope at a time
durable schedule cursor
lease and fencing required
at most one RUNNING tick per scope
missed slots become ordered backfill work
no parallel same-scope canonical commit
no implicit retry after terminal success
```

### 3.4 ReadOnlyExecutionEvidenceAdapter

```text
may read existing action Evidence
may bind trustworthy execution Evidence into H
must not create decision, approval, task, dispatch or receipt
planned or approved action is not execution
```

### 3.5 RestartBackfillAvailabilityAdapter

```text
restart from persisted checkpoint
detect missed hourly boundaries
backfill oldest eligible slot first
detect stale Evidence and scheduler lag
emit Runtime Health, never crop-health claims
preserve idempotency across crash and retry
```

## 4. Slice plan

### S0 — Design and pre-candidate governance

Delivers this Taskbook, machine scope contract, exact CAP-08 predecessor lock,
non-candidate authority seed, non-candidate delivery-status seed, changed-file
boundary, focused workflow and validator.

Allowed claim:

```text
MCFT_CAP_09_PRE_CANDIDATE_GOVERNANCE_FOUNDATION
```

S0 does not authorize implementation.

### S1 — Adapter contracts and configuration freeze

Freeze TypeScript interfaces and immutable config for the five adapter classes.
No scheduler loop or database write is authorized by S1 design alone.

### S2 — Database Evidence ingress and boundary freeze

Implement bounded database Evidence selection with observed/ingested-time
eligibility, freshness, exclusion, late and out-of-order classification.

### S3 — Persistent sequential scheduler

Implement SchedulerClock, durable cursor, single-scope lease/fencing,
idempotent slot claim and ordered missed-slot queue.

### S4 — Restart, backfill and stale detection

Prove restart from checkpoint, one missed-slot recovery, stale Evidence
degradation, scheduler-lag health and no duplicate canonical work.

### S5 — Shadow-online canonical integration

Run the unchanged canonical Runtime transactions from the Shadow-online
adapters. Permitted canonical families remain A/B/C/F and read-only H
consumption where existing trustworthy Evidence is present. G and all action
creation remain forbidden.

### S6 — Formal 24-hour Stage 1B closure

Execute O00–O23 on actual UTC hourly boundaries, establish restart/backfill,
missing-data degradation, late/out-of-order handling, online readback, semantic
parity with the same canonical core, exact-SHA evidence and R2 retention.

Allowed claim only after S6 exact-SHA/R2 effectiveness:

```text
STAGE_1B_SHADOW_ONLINE_CLOSURE_COMPLETE
MCFT_CAP_09_COMPLETE
```

Neither claim permits `MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE`.

## 5. Hard Acceptance

```text
HA-01  CAP-08 exact-SHA/R2 predecessor authority consumed
HA-02  one six-key scope only
HA-03  actual UTC scheduler clock; no accelerated formal clock
HA-04  24 hourly slots O00–O23
HA-05  database Evidence frozen at each boundary
HA-06  future Evidence excluded
HA-07  persistent sequential cursor
HA-08  lease and fencing enforced
HA-09  duplicate slot idempotent
HA-10  one process restart recovered from checkpoint
HA-11  one missed slot backfilled oldest-first
HA-12  stale Evidence detected
HA-13  missing-data degradation is explicit
HA-14  late/out-of-order Evidence handled append-forward
HA-15  canonical Tick semantics equal Replay
HA-16  Forecast COMPLETED/BLOCKED separation preserved
HA-17  Scenario source eligibility preserved
HA-18  Residual eligibility preserved
HA-19  online State readback
HA-20  online Forecast and Health readback
HA-21  zero public HTTP writer
HA-22  zero automatic Recommendation/Approval/AO-ACT/Dispatch
HA-23  zero Model Activation and active-config switch
HA-24  exact-SHA artifact, semantic digest and R2 retention
```

## 6. Governance entry sequence

```text
S0 foundation present on protected main
→ trusted Candidate Registry rule added in a later PR
→ S0 authorization Candidate may then be declared
→ exact merge-SHA effectiveness
→ S1 implementation entry may be considered
```

A PR that modifies the Registry cannot rely on that modified Registry as trusted
authority for its own Candidate Declaration.

## 7. Frozen nonclaims

```text
NO_CAP09_IMPLEMENTATION_AUTHORITY
NO_RUNTIME_SOURCE_DELTA
NO_DATABASE_MIGRATION
NO_CANONICAL_WRITE_AUTHORITY
NO_PUBLIC_HTTP_WRITER
NO_LIVE_DEVICE_GATEWAY
NO_MULTI_FIELD_SCHEDULER
NO_DISTRIBUTED_HA
NO_AUTOMATIC_RECOMMENDATION
NO_AUTOMATIC_APPROVAL
NO_AO_ACT_CREATION
NO_DISPATCH
NO_MODEL_ACTIVATION
NO_MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE
NO_PRODUCTIZATION_COMPLETE
```
