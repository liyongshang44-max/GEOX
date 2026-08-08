# GEOX MCFT-CAP-09 — Shadow-Online Promotion

## Complete Taskbook v0.5 — Stage 1B Design Freeze / S6 Amendment-01 + Amendment-02 + Amendment-03 + Amendment-04 Bound

```text
document_id:
GEOX-MCFT-CAP-09-TASK-V0.5-STAGE-1B-S6-AMENDMENT-01-02-03-04-BOUND

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
STAGE_1B_DESIGN_FROZEN_WITH_S6_AMENDMENT_01_02_03_04

s6_amendment_01_ref:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md

s6_amendment_02_ref:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-02-GFS-SOLAR-RADIATION-SOURCE-AUTHORITY.md

s6_amendment_03_ref:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-03-GFS-SFLUX-EXPANDING-AVERAGE-RECONSTRUCTION-AUTHORITY.md

s6_amendment_04_ref:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-04-GFS-SFLUX-INSTANTANEOUS-PIECEWISE-LINEAR-SOLAR-AUTHORITY.md

minimum_complete_field_twin_complete:
false
```

> Repository-state and authorization booleans in the original v0.1 S0 preamble
> were historical S0 snapshots. Current delivery/effectiveness is determined by
> protected-main Registry/status plus exact-SHA/R2 evidence. v0.2 changed S6
> External Reality/source/crop entry authority. v0.3 added only the separately
> adjudicated solar-radiation source exception required after EA1N fail-closed
> the pgrb2 hourly DSWRF reconstruction. v0.4 added only the separately
> adjudicated sflux six-hour-block expanding-average reconstruction candidate
> required after effective EA1O-B proved the Amendment-02 direct-one-hour source
> requirement is not satisfied by production sflux. v0.5 adds only the
> separately adjudicated instantaneous-endpoint piecewise-linear solar candidate
> required after effective EA1O-C proved the Amendment-03 weighted-difference
> value route produces negative hourly candidates under the frozen no-repair
> policy. None of these revisions reopens S0–S5.

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

Amendment-01 is the separately adjudicated S6 architecture correction that
changes Formal Reality/source/crop entry authority only. Amendment-02 is a
second, narrower S6 architecture correction: it permits a separately qualified
GFS surface-flux product to serve only the solar-radiation input role used to
derive future ET0 after EA1N proved the pgrb2 rolling-average route cannot
identify a unique exact hourly scalar under the no-clipping policy.

EA1O-B then live-proved that production sflux provides only 12 direct
preceding-one-hour surface DSWRF averages across the governed 72 target
intervals and 60 multi-hour averages. Its effective decision is:

```text
REJECTED_AS_AMENDMENT02_DIRECT_1H_SOURCE_AUTHORITY
```

Amendment-03 is the third narrow S6 architecture correction. It does not
reinterpret that rejection as a pass. It permits exactly one six-hour-block
expanding-average weighted-difference algorithm to become a candidate for a
new live packing/value/spatial qualification.

EA1O-C then live-proved the actual sflux native grid and KBS spatial selection,
but the Amendment-03 weighted-difference route produced five negative hourly
candidates out of 72. Its effective protected-main decision is:

```text
REJECTED_AS_AMENDMENT03_SFLUX_RECONSTRUCTION_VALUE_AUTHORITY
```

That value rejection is authoritative. The separately observed native sflux
spatial PASS is also retained as a predecessor fact, but it does not rescue the
failed value authority and must be re-proved for a later source role.

Amendment-04 is the fourth narrow S6 architecture correction. It stops claiming
that a provider direct-hourly average can be recovered. It permits the same
cycle's instantaneous sflux DSWRF forecast points to become endpoint samples of
one explicitly frozen piecewise-linear temporal model, whose one-hour integral
is a `MODEL_DERIVED_PIECEWISE_LINEAR_FORECAST_INTERPOLATION` candidate with
`quality.status = LIMITED` and `direct_field_equivalence=false`.

None of the four amendments changes the shared canonical kernel, Runtime
forcing selector, transaction families, persistence semantics or action
authority.

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

S6 contains the following entry-authority sub-lifecycles before O00:

```text
S6-EA0   Taskbook Amendment / Architecture Adjudication
S6-EA1   External Site and Source Qualification
S6-EA1O  Solar-radiation source/reconstruction/model-derived temporal amendments + source/spatial re-freeze
S6-EA2   Formal Reality / Source / Crop Authority Freeze
S6-EA3   External Collector + Canonicalizer Candidate
S6-EA4   Live Source Exact-Head Qualification
S6-EA5   Formal Authority V3 + Database Preflight
```

`S6-EA1O` is a governed sub-lifecycle inside EA1, not a new capability slice.
S0–S5 are not reopened.

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
72-point future forcing. Amendment-02 changes only the eligible source-product
family for the future-ET0 solar-radiation derivation input. Amendment-03 changes
only the eligible expanding-average temporal-normalization candidate for that
same solar role after EA1O-B rejected direct-one-hour coverage. Amendment-04
changes only the eligible epistemic/temporal candidate for that same solar role
after EA1O-C rejected weighted-difference values: instantaneous endpoint
samples plus a frozen piecewise-linear interpolation/integration model with
`quality.status=LIMITED`. None deletes, replaces or weakens HA-01–HA-24.

## 6. Governance entry sequence

The historical S0→S5 delivery sequence remains settled by the repository's
protected-main/exact-SHA evidence. The remaining S6 sequence is:

```text
S6-EA0 effective architecture adjudication
→ S6-EA1 fail-closed site/source qualification
→ S6-EA1O Amendment-02 solar-radiation source exception effective
→ S6-EA1O-B direct-one-hour sflux rejection effective
→ S6-EA1O Amendment-03 expanding-average reconstruction candidate effective
→ S6-EA1O-C weighted-difference value rejection effective; native spatial predecessor fact retained
→ S6-EA1O Amendment-04 instantaneous endpoint piecewise-linear candidate effective
→ S6-EA1O-D live instantaneous endpoint/value/native-spatial qualification
→ S6-EA2 External Formal authorities frozen
→ S6-EA3 collector/canonicalizer qualification
→ S6-EA4 live source exact-head proof
→ S6-EA5 fresh-scope Formal bootstrap and preflight
→ actual UTC O00–O23
→ final exact-SHA/R2 effectiveness
```

No stage may infer authority from an unmerged or non-effective later stage.
EA1O-D must pass before EA2. A failed EA1O-D does not route around the failure;
it requires a new separately adjudicated architecture decision.

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

The following S6 rules remain part of this Taskbook when Amendment-01 is
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

## 9. Amendment-02 binding rules

When Amendment-02 is present on protected main, the following additional rules
apply without weakening Amendment-01:

```text
pgrb2.0p25 remains the primary future-weather product family
EA1N pgrb2 hourly DSWRF reconstruction rejection is authoritative
only the future-ET0 solar-radiation input role may use the sflux exception
candidate source = gfs.tCCz.sfluxgrbfFFF.grib2
candidate parameter = surface DSWRF direct preceding-one-hour average
surface DSWRF "N hour fcst" is not interchangeable with an interval average
EA1O-B direct-one-hour sflux rejection is authoritative
REJECTED_AS_AMENDMENT02_DIRECT_1H_SOURCE_AUTHORITY
sflux remains NOT_QUALIFIED unless a later separately adjudicated temporal path passes exact-head source/spatial proof
future weather and future ET0 must still share the same exact GFS cycle
solar-radiation source-object and native-grid provenance must remain explicit
silent pgrb2/sflux grid equivalence is forbidden
direct_field_equivalence remains false
silent interpolation is forbidden unless separately adjudicated
negative clipping and zero-thresholding are forbidden
missing solar radiation fails the future ET0 interval; no fallback to rejected pgrb2 reconstruction
Runtime remains forbidden from fetching public providers
Amendment-02 does not start Formal O00-O23
```

Normative detail is in:

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-02-GFS-SOLAR-RADIATION-SOURCE-AUTHORITY.md
```

## 10. Amendment-03 binding rules

When Amendment-03 is present on protected main, it supersedes only
Amendment-02's **direct-one-hour-only temporal eligibility rule** for the same
future-ET0 solar-radiation role. All Amendment-01/02 source-family, chronology,
provenance, no-fallback and spatial re-freeze requirements remain in force.

The only newly eligible temporal-normalization candidate is:

```text
b = 6 * floor((f - 1) / 6)
n = f - b

if n == 1:
    H_f = A_f

if n > 1:
    H_f = n * A_f - (n - 1) * A_(f-1)
```

where `A_f` and `A_(f-1)` are unique live surface-DSWRF `avg` records from the
same six-hour block, same exact GFS cycle, and same freeze boundary.

Additional hard rules are:

```text
six-hour block size is exactly 6
cross-block reconstruction is forbidden
N-hour forecast DSWRF remains forbidden as direct interval-average input
support lead = canonical_lead_start-1 only when the first target is inside a block
support lead is provenance input, not a 73rd canonical forecast point
support lead must share the exact cycle and freeze boundary
live GRIB packing metadata is required
packing half-quantum and propagated reconstruction error are diagnostics only
quantization uncertainty may not repair a negative value
any non-finite reconstructed value fails closed
any negative reconstructed value fails closed
negative clipping is forbidden
zero-thresholding is forbidden
silent imputation is forbidden
pgrb2 DSWRF fallback is forbidden
sflux native grid must still be live re-frozen
silent pgrb2 grid-coordinate reuse is forbidden
interpolation remains forbidden unless separately adjudicated
EA1O-C value rejection is authoritative
REJECTED_AS_AMENDMENT03_SFLUX_RECONSTRUCTION_VALUE_AUTHORITY
EA1O-C native sflux spatial PASS is retained as a predecessor fact only
weighted-difference reconstruction authority remains rejected
EA2 remains forbidden until a later separately adjudicated temporal path passes
Formal O00-O23 remains unstarted
```

Normative detail is in:

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-03-GFS-SFLUX-EXPANDING-AVERAGE-RECONSTRUCTION-AUTHORITY.md
```

## 11. Amendment-04 binding rules

When Amendment-04 is present on protected main, it supersedes only the failed
Amendment-03 temporal-value candidate for the same future-ET0 solar role. It
does not reinterpret EA1O-B or EA1O-C as passing and does not upgrade sflux to
observation truth.

The newly eligible epistemic/temporal candidate is:

```text
epistemic_class = MODEL_DERIVED_PIECEWISE_LINEAR_FORECAST_INTERPOLATION
quality.status = LIMITED
direct_field_equivalence = false

I_(f-1) = instantaneous surface DSWRF forecast endpoint at lead f-1
I_f     = instantaneous surface DSWRF forecast endpoint at lead f

I(u) = (1-u) * I_(f-1) + u * I_f,  u in [0,1]
H_f = (I_(f-1) + I_f) / 2
Rs_f = H_f * 0.0036 MJ/m^2/hour
```

Additional hard rules are:

```text
exactly 72 canonical target intervals remain T+1h through T+72h
exactly one support endpoint = canonical_lead_start-1
73 instantaneous endpoint messages are required
all endpoints share the exact EA1K-selected GFS cycle and freeze boundary
surface DSWRF "N hour fcst" is an instantaneous endpoint sample only
N-hour forecast DSWRF remains forbidden as a direct interval average
no midpoint invention, spline, higher-order fit, persistence fill or heuristic
all 73 endpoint values must be finite and nonnegative
all 72 H_f values must be finite and nonnegative
all 72 Rs_f values must be finite and nonnegative
negative clipping is forbidden
zero-thresholding is forbidden
silent imputation is forbidden
pgrb2 DSWRF fallback is forbidden
EA1O-C native spatial PASS must be live re-proved for the instantaneous role
silent pgrb2/sflux grid equivalence remains forbidden
spatial interpolation remains forbidden
MODEL_DERIVED provenance and transformation limitations are mandatory
quality.status=PASS is forbidden for this solar temporal transformation
Runtime continues to consume only final canonical future_et0_assumption_v1
instantaneous_endpoint_source_qualified=false until EA1O-D passes
piecewise_linear_temporal_transformation_qualified=false until EA1O-D passes
EA2 remains forbidden until EA1O-D passes
Formal O00-O23 remains unstarted
```

Normative detail is in:

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-04-GFS-SFLUX-INSTANTANEOUS-PIECEWISE-LINEAR-SOLAR-AUTHORITY.md
```
