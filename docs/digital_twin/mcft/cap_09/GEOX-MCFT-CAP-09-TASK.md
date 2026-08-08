# GEOX MCFT-CAP-09 — Shadow-Online Promotion

## Complete Taskbook v0.2 — Stage 1B Design Freeze / S6 Amendment-01 Bound

```text
document_id:
GEOX-MCFT-CAP-09-TASK-V0.2-STAGE-1B-S6-AMENDMENT-01-BOUND

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
STAGE_1B_DESIGN_FROZEN_WITH_S6_AMENDMENT_01

s6_amendment_ref:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md

minimum_complete_field_twin_complete:
false
```

> Repository-state and authorization booleans in the original v0.1 S0 preamble
> were historical S0 snapshots. Current delivery/effectiveness is determined by
> protected-main Registry/status plus exact-SHA/R2 evidence. This v0.2 changes
> S6 entry authority only; it does not reopen S0–S5.

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

Amendment-01 is the separately adjudicated S6 architecture correction permitted
by this section. It changes Formal Reality/source/crop entry authority only and
does not change the shared canonical kernel.

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

For S6 Formal closure the six-key scope is a newly bootstrapped qualified
External Research Scope. Reuse of the CAP-08 `field_c8_demo` Replay identity is
not required and cross-scope canonical stitching is forbidden.

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
uses role-specific event time and ingested/availability time
excludes future and post-boundary Evidence
records coverage, freshness, maximum gap and exclusions
does not synthesize sensor truth
does not create production gateway authority
```

For S6, public External Evidence reaches this adapter only after a separate
governed collector/canonicalizer and restricted append-only Formal ingress.
Runtime itself does not call public providers.

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

Delivered the Taskbook foundation, machine scope contract, exact CAP-08
predecessor lock, non-candidate authority/status seeds, changed-file boundary,
focused workflow and validator.

### S1 — Adapter contracts and configuration freeze

Freeze TypeScript interfaces and immutable config for the five adapter classes.

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

S6 now contains the following entry-authority sub-lifecycles before O00:

```text
S6-EA0  Taskbook Amendment / Architecture Adjudication
S6-EA1  External Site and Source Qualification
S6-EA2  Formal Reality / Source / Crop Authority Freeze
S6-EA3  External Collector + Canonicalizer Candidate
S6-EA4  Live Source Exact-Head Qualification
S6-EA5  Formal Authority V3 + Database Preflight
```

These are not new capability slices. S0–S5 are not reopened.

Allowed claim only after S6 O00–O23 plus final exact-SHA/R2 effectiveness:

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

Amendment-01 adds entry proof for External Site, Reality, Source, Crop Context,
raw provenance, spatial support, temporal release, hourly reference ET and
72-point future forcing. It does not delete, replace or weaken HA-01–HA-24.

## 6. Governance entry sequence

The historical S0→S5 delivery sequence remains settled by the repository's
protected-main/exact-SHA evidence. The remaining S6 sequence is:

```text
S6-EA0 effective architecture adjudication
→ S6-EA1 fail-closed site/source qualification
→ S6-EA2 External Formal authorities frozen
→ S6-EA3 collector/canonicalizer qualification
→ S6-EA4 live source exact-head proof
→ S6-EA5 fresh-scope Formal bootstrap and preflight
→ actual UTC O00–O23
→ final exact-SHA/R2 effectiveness
```

No stage may infer authority from an unmerged or non-effective later stage.

## 7. Frozen nonclaims

```text
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

## 8. Amendment-01 binding rules

The following S6 rules are now part of this Taskbook when Amendment-01 is
present on protected main:

```text
CAP08 predecessor semantic authority != Replay scope identity authority
External Formal scope requires fresh bootstrap
cross-scope canonical stitching is forbidden
controlled-synthetic crop schedule is forbidden as Formal crop context
raw public-source provenance must precede canonicalization
Internet collection is separated from Runtime
current-season crop identity must be proved for the exact Formal season
crop water-use stage is a derived model context, not an observed biological stage
crop-stage derivation is strictly as-of and may not use future observations
forward stage-stability guard is an explicit assumption, not future Observation
NOAA/NCEP GFS 0.25-degree hourly is the primary 72-point future weather authority
72 forecast points align exactly T+1h through T+72h
only a complete GFS cycle genuinely available before the freeze boundary is eligible
future weather and future ET0 share the same exact source cycle
historical/future ET0 use ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1
ET0 canonical output is mm_per_hour
missing required meteorology fails the ET0 interval; no silent imputation
CAP-08 numerical soil/crop configuration is MODEL_PRIOR_FROM_CAP08 only
MODEL_PRIOR_FROM_CAP08 is not field calibration or site soil truth
External qualification is entry proof and does not itself complete S6
```

Normative detail is in:

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md
```
