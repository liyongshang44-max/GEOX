# GEOX MCFT-CAP-09 Amendment-19 — Fresh-v3 Formal Successor Design V1

Status: **DESIGN ONLY — OFF-MAIN — NO RUNTIME OR FORMAL EFFECT**

Issue: **#3225 — wire Amendment-19 graduation to fresh-v3 Formal launcher**

Design base protected main:

```text
fc7241de6f8f11705b35c92feaa75caf91abb15e
```

This document is intentionally non-authoritative while the current exact-head Amendment-19 qualification is pending. It defines the successor implementation boundary without modifying protected `main`, starting a Formal epoch, writing the Formal v3 database, changing provider temporal semantics, or transferring qualification evidence across Git heads.

---

## 1. Problem statement

Amendment-19 now has a machine-only accelerated graduation gate, but the repository does not yet have a legal successor path from that gate to a fresh-v3 real wall-clock Formal epoch.

The existing live Formal surface is not reusable for the current frontier:

```text
.github/workflows/mcft-cap-09-pre-runtime-hardening.yml
scripts/runtime_acceptance/RUN_MCFT_CAP_09_A18C_FORMAL_V3_PRODUCTION_RUNNER_V1.ts
scripts/runtime_acceptance/mcft_cap09_a18c_formal_live_manifest_v1.ts
```

Those surfaces are frozen to the failed 2026-08-17 v2 epoch and/or its exact old hardening subject. In particular they bind:

```text
formal database:
  geox_mcft_cap09_s6_formal_t3r1_24h_v2

failed epoch:
  mcft_cap09_external_formal_window_epoch_20260817t200000z_v2
```

Current fresh-store authority instead requires:

```text
formal database:
  geox_mcft_cap09_s6_formal_t3r1_24h_v3

failed v2 database reuse:
  FORBIDDEN

next legal frontier:
  NEW_FUTURE_EPOCH_SELECTION_AND_REPLACEMENT_A0_CONFIG_CHAIN
```

The old A18C production runner also imports the Amendment-11 persistent service rather than the new Amendment-19 production service that calls the canonical Amendment-19 tick core. Therefore the successor cannot be implemented as a workflow-only database-name change.

---

## 2. Non-negotiable exact-head rule

The current protected main is intentionally frozen while qualification runs:

```text
fc7241de6f8f11705b35c92feaa75caf91abb15e
```

Any successful qualification produced by this head is evidence for this head only.

The successor implementation required by #3225 will necessarily add or change production execution surfaces. Once that implementation is merged, protected main will have a new SHA. Therefore:

```text
fc7241... qualification PASS
        !=
future successor-head Formal authorization
```

The following transfer is forbidden:

```text
qualify fc7241...
      ↓
merge Formal successor code
      ↓
reuse fc7241... machine-gate artifact
      ↓
start Formal
```

That would violate the exact-subject rule.

Required sequence:

```text
1. Let fc7241... qualification reach a terminal evidence state.
2. Keep #3225 implementation off-main while that evidence is pending.
3. Review the successor implementation against the fc7241... evidence.
4. Merge one bounded successor implementation only when ready.
5. Freeze the new protected-main SHA.
6. Provision fresh accelerated qualification stores for the new SHA.
7. Re-run exact-head rolling -> rehydration -> persistence-free 24T -> persistent production-graph 24T -> machine graduation.
8. Only a PASS gate produced by that same successor SHA may arm a Formal epoch.
```

The current fc7241... run is therefore not wasted. It provides real evidence about the current runtime graph and may expose defects before the successor is merged. It is simply not transferable across a production-head change.

---

## 3. Fresh qualification stores after successor merge

The current qualification stores are:

```text
geox_mcft_cap09_s6_accel24t_am19_v2
geox_mcft_cap09_s6_accel24t_am19_blocked_v2
```

After the successor implementation merges, these stores MUST NOT be reused for the successor-head qualification, regardless of whether the current fc7241... run passed, failed, or partially wrote state.

Provision new zero-state clones from the Formal v3 schema, for example:

```text
geox_mcft_cap09_s6_accel24t_am19_v3
geox_mcft_cap09_s6_accel24t_am19_blocked_v3
```

The exact names may be frozen by the implementation unit, but the contract is:

```text
new generation
zero state
same 26-table production schema
same column / constraint / index fingerprints
no copy of failed or successful qualification state
no reuse of previous scheduler/checkpoint/lease state
```

The production Formal database itself remains:

```text
geox_mcft_cap09_s6_formal_t3r1_24h_v3
```

It must remain untouched by successor-head accelerated qualification.

---

## 4. Production semantic path to reuse

The real Formal successor MUST use the same Amendment-19 production path that the accelerated persistent lane qualifies.

Canonical semantic core:

```text
apps/server/src/runtime/twin_runtime/external_formal_amendment19_canonical_tick_core_v1.ts
executeExternalFormalAmendment19CanonicalTickV1
```

Production persistent tick service:

```text
apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts
ExternalFormalV3Amendment19PersistentTickServiceV1
```

Production runner:

```text
apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.ts
ExternalFormalV3Amendment19RunnerV1
```

Production DB-only evidence source:

```text
apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.ts
PostgresExternalFormalAmendment19EvidenceSourceV1
```

Production scheduler / lease / fencing:

```text
apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts
PostgresPersistentSequentialSchedulerAdapterV1
```

Production persistence repositories:

```text
PostgresRuntimeRepositoryV1
PostgresNextTickRepositoryV1
PostgresForecastScenarioRecoveryRepositoryV1
```

Bootstrap persistence:

```text
apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.ts
ExternalFormalBootstrapPersistenceServiceV1
```

Restricted durable external-evidence ingress:

```text
apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts
PostgresExternalFormalEvidenceIngressV1
```

The old A18C Formal runner MUST NOT remain the real successor execution path.

---

## 5. Shared manifest construction — no second implementation

The current accelerated qualification already contains generic future-epoch construction using:

```text
buildExternalFormalPrewindowAuthorityBundleV3(...)
```

and then builds an `ExternalFormalV3Am19WindowManifestV1` from the exact 24 runtime configs and crop-context pins.

The successor implementation SHOULD extract this generic manifest construction into a production shared pure builder, for example:

```text
apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.ts
buildExternalFormalAmendment19WindowManifestV1
```

Required inputs:

```text
exact subject SHA
epoch_id
formal database name
ExternalFormalPrewindowAuthorityBundleV3
crop-context authority
configuration matrix
```

Required output:

```text
ExternalFormalV3Am19WindowManifestV1
manifest semantic hash
exact 24 slot pins
runtime-config ref/hash pins
parent ref/hash pins
crop context identity hashes
crop materialization hashes
O00 / O23
```

The manifest semantic hash SHOULD include the exact subject SHA so that a manifest produced under one code head cannot be silently reused under another head.

After extraction:

```text
accelerated persistent qualification
        and
real Formal launcher
```

must call the same shared manifest builder.

Copy-pasting the existing qualification-only `buildQualification()` manifest logic into a second Formal script is forbidden.

---

## 6. Do not freeze the future epoch with a post-gate Git commit

A future Formal epoch is selected only after the machine gate is open.

Committing a new date-specific manifest after the gate would change protected main and immediately invalidate the exact-head gate that authorized it.

Therefore the successor must NOT use this pattern:

```text
machine gate PASS
  -> edit O00/O23 constants
  -> commit manifest
  -> merge
  -> start Formal
```

Instead, epoch selection and manifest freeze must be machine-produced under the already-qualified exact successor SHA, with no further Git commit.

---

## 7. Formal arming source: next exact-subject rolling candidate

The preferred epoch-selection mechanism is to reuse the existing causal rolling-candidate path rather than invent another time-selection protocol.

After the successor exact-head machine graduation gate is OPEN:

```text
next successful exact-subject rolling preboundary candidate
        ↓
candidate.target_t becomes Formal A0
        ↓
O00 = A0 + PT1H
        ↓
O23 = A0 + PT24H
```

This matches the parameterization already used by the Amendment-19 persistent qualification.

The arm step MUST require:

```text
candidate.status = PASS
candidate.producer_subject_sha = current protected main SHA
candidate temporal authority = PROVIDER_AVAILABILITY_WATERMARK_V1
candidate not expired
exact three preboundary record types
producer-bound retained-raw provenance intact
machine graduation gate artifact belongs to same subject SHA
gate status = PASS
gate formal_epoch_creation_gate = OPEN
static_blocker_count = 0
human override = false
current protected main still equals subject SHA
Formal database = geox_mcft_cap09_s6_formal_t3r1_24h_v3
v2 database reuse = forbidden
```

The rolling cron minute remains operational scheduling only. It is not temporal authority.

If the candidate completes too late to safely bootstrap before O00, that candidate is rejected without Formal side effects and the system waits for a later exact-subject candidate. No target timestamp relabeling is allowed.

---

## 8. Immutable machine arm artifact

The arm workflow produces an immutable machine artifact, conceptually:

```text
MCFT_CAP_09_AMENDMENT_19_FORMAL_ARM_V1.json
```

Suggested schema:

```text
schema_version
status = PASS
subject_sha
machine_gate_run_id
machine_gate_artifact_id / digest
rolling_candidate_run_id
rolling_candidate_artifact_id / digest
rolling_candidate_target_t
rolling_candidate_captured_at
rolling_candidate_expires_at
epoch_id
formal_database_name = geox_mcft_cap09_s6_formal_t3r1_24h_v3
a0
o00
o23
manifest_ref
manifest_hash
manifest
runtime_config_ref_hash_pins[24]
bootstrap_runtime_config_ref/hash
crop_context_identity/materialization pins
provider_availability_watermark = PROVIDER_AVAILABILITY_WATERMARK_V1
formal_o00_started = false
formal_execution_count = 0/24
mcft_cap09_completed = false
```

Artifact name must include exact subject SHA and epoch identity.

There must be at most one active Formal arm for one exact subject. Multiple non-superseded arm artifacts for the same subject fail closed.

The arm artifact itself has no Formal runtime write effect.

---

## 9. How later scheduled jobs recover the arm without a Git commit

The successor live workflows are date-independent and live on the already-qualified successor head.

At runtime, each scheduled job:

```text
1. checks out github.sha
2. requires refs/heads/main
3. fetches origin/main
4. requires HEAD == origin/main
5. queries GitHub Actions for the unique successful Formal-arm artifact for this exact subject SHA
6. downloads that artifact
7. verifies subject, gate evidence, epoch, database and manifest hash
8. executes only if the current wall clock is inside the artifact's operational phase window
```

No workflow contains hard-coded O00/O23 dates.

If the arm artifact is missing, duplicated, expired, deleted, malformed, or belongs to another SHA, live jobs fail closed or no-op without Formal writes.

The arm artifact is machine evidence, not a substitute for database state. Once A0 is persisted, the database remains the runtime source of state/checkpoint/config continuity while the artifact supplies immutable epoch/manifest pins.

---

## 10. A0 bootstrap lane

A separate scheduled bootstrap lane executes after A0 evidence is causally available and before O00.

It MUST:

```text
require exact current main == arm.subject_sha
require unique valid arm artifact
bind only geox_mcft_cap09_s6_formal_t3r1_24h_v3
re-run v3 database identity/schema checks
require zero runtime/scheduler/checkpoint state before first bootstrap
recover the exact rolling candidate raw provenance
promote/copy candidate raw objects into durable Formal raw retention without provider refetch
verify raw hashes after promotion
canonicalize/ingress the exact A0 soil + future-weather + future-ET0 records through PostgresExternalFormalEvidenceIngressV1
use buildExternalFormalPrewindowAuthorityBundleV3
use the shared Amendment-19 manifest builder
persist A0 + exact 24 runtime configs with ExternalFormalBootstrapPersistenceServiceV1
read back A0 state/checkpoint/config chain
require formal_window_started = false
```

The raw promotion step is required because the rolling candidate is qualification-oriented and transient-retention semantics must not silently become the long-lived Formal audit-retention contract.

Provider refetch during promotion is forbidden. The retained bytes and digest must remain producer-bound.

A0 bootstrap may be idempotently retried only against exactly matching pins. Any semantic conflict fails closed.

---

## 11. Real evidence ingress during O00-O23

The Amendment-19 runner is intentionally DB-only. It never waits for or fetches providers.

Therefore real provider ingress is a separate production lane.

The successor SHOULD generalize the currently proven provider-watermark collector logic rather than retain the old epoch constants.

For each upcoming Formal slot T, the ingress lane must independently perform:

```text
PREBOUNDARY CAUSAL DATASET
  soil_moisture_observation_v1
  future_weather_assumption_v1
  future_et0_assumption_v1

OPTIONAL DELAYED EXACT DATASET
  observed_rainfall_v1
  historical_et0_estimate_v1
```

Rules:

```text
raw retention before canonical DB ingress
PostgresExternalFormalEvidenceIngressV1 only
multi-record GFS pair atomic commit
multi-record delayed exact pair atomic commit
no partial exact pair authority
actual available_to_runtime_at
actual ingested_at
no timestamp relabel
no interpolation
no persistence fill
no source substitution
provider retry policy operational only
KBS daily-batch profile not temporal authority
```

The existing Amendment-19 DB evidence source freezes all families at exact logical T and requires at least:

```text
soil
future_weather
future_et0
```

Delayed exact rainfall/ET0 remains optional at the boundary. If it becomes available only after T, it may be retained as historical evidence but cannot rewrite the already-terminal tick.

---

## 12. Fixed operational schedules, dynamic epoch guard

The successor workflows may use recurring schedules such as periodic provider collection and runner attempts, but those schedules are not authority.

Each job derives its due/no-due state from the exact arm manifest and current wall clock.

Conceptual jobs:

```text
mcft-cap-09-am19-formal-arm
mcft-cap-09-am19-formal-a0-bootstrap
mcft-cap-09-am19-formal-evidence-ingress
mcft-cap-09-am19-formal-production-runner
mcft-cap-09-am19-formal-final-readback
```

No date-specific cron expressions.

No live `workflow_dispatch` path may bypass the machine gate. If workflow dispatch is retained at all, it must be static/read-only qualification only.

---

## 13. Real Formal production runner

Create a new successor CLI rather than repurposing the old A18C date-pinned runner in place, for example:

```text
scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_FORMAL_V3_PRODUCTION_RUNNER_V1.ts
```

It composes only:

```text
ExternalFormalV3Amendment19RunnerV1
ExternalFormalV3Amendment19PersistentTickServiceV1
PostgresExternalFormalAmendment19EvidenceSourceV1
PostgresPersistentSequentialSchedulerAdapterV1
PostgresRuntimeRepositoryV1
PostgresNextTickRepositoryV1
PostgresForecastScenarioRecoveryRepositoryV1
shared Amendment-19 manifest builder
production crop materializer
```

Hard requirements:

```text
GITHUB_REF = refs/heads/main
GITHUB_SHA = arm.subject_sha
origin/main = arm.subject_sha
formal DB identity = v3
manifest hash recomputes exactly
runtime config ref/hash pin exact
scheduler wall clock is real
lease/fencing clock is real database transaction time
evidence snapshot is exact selected slot logical T
provider_request_count = 0
r2_request_count = 0
one due slot per invocation
oldest missed slot first
terminalization uses same claim/fence
Mode A -> COMPLETED / HEALTHY
Mode B -> DEGRADED / ASSUMED
no future leakage
no downstream recommendation/approval/action/dispatch/model activation
```

The runner must not import or call the old Amendment-11 candidate execution path.

---

## 14. Wall-clock O00-O23 execution

The final run remains a real 24-boundary graduation test.

For each slot:

```text
provider ingress happens independently before/around T
        ↓
runner invocation occurs from real GitHub scheduling
        ↓
runner asks production scheduler for oldest due slot
        ↓
evidence source freezes DB evidence at exact slot logical T
        ↓
claim / fencing
        ↓
Amendment-19 canonical core
        ↓
persistence / checkpoint / health / lineage
        ↓
terminal scheduler state
```

If GitHub scheduling is late, oldest-first backfill may execute a missed slot, but evidence remains frozen at that slot's logical T. The system may not reinterpret the late wall clock as the evidence cutoff.

Final proof must record actual scheduler/observer timestamps so GitHub jitter and recovery behavior remain inspectable.

---

## 15. Completion gate

Machine epoch creation gate OPEN is not MCFT-CAP-09 completion.

After O23, final readback must prove at minimum:

```text
exact 24 terminal runtime slots
O00-O23 logical sequence complete
no duplicate terminal canonical work
state/checkpoint/forecast pointers closed
active lineage consistent
restart/retry continuity intact
health sequence inspectable
Mode A / Mode B semantics retained
all provider ingress facts obey causal cutoff
late exact evidence did not rewrite terminal state
no provider request from runtime runner
no R2 request from runtime runner
no downstream action side effects
protected main remained exact arm.subject_sha for the whole epoch
formal database remained v3
```

Only this final machine result may support:

```text
formal_execution_count = 24/24
Stage-1B graduation PASS
MCFT-CAP-09 completion adjudication
```

---

## 16. Required implementation acceptance before successor merge

The future implementation PR must prove statically and in selftests:

```text
A. no successor production reference to geox_mcft_cap09_s6_formal_t3r1_24h_v2 except explicit FORBIDDEN assertions
B. no successor production reference to failed 2026-08-17 epoch
C. no hard-coded future O00/O23 dates
D. old A18C runner is not the successor execution path
E. real Formal runner imports Amendment-19 runner/service
F. Amendment-19 service calls executeExternalFormalAmendment19CanonicalTickV1
G. accelerated qualification and real Formal use the same manifest builder
H. real Formal uses buildExternalFormalPrewindowAuthorityBundleV3
I. exact subject SHA is included in arm/manifest identity
J. all live jobs fail closed on main drift
K. v3 database exact identity required
L. v2 database explicitly forbidden
M. machine gate artifact exact-subject binding required
N. rolling candidate exact-subject binding required
O. no human override
P. no live provider call in runtime runner
Q. durable raw verification before canonical Formal ingress
R. delayed exact pair optional at T and cannot cause retroactive rewrite
S. current operational cron/cadence is not temporal authority
T. final real 24h remains mandatory
```

---

## 17. Main-freeze integration plan

While current protected main remains:

```text
fc7241de6f8f11705b35c92feaa75caf91abb15e
```

allowed work is:

```text
review this design
prepare implementation off-main
run PR-only static/unit/selftests that do not touch Formal v3
inspect current qualification evidence
```

Forbidden work is:

```text
merge #3225 implementation
change protected main
write Formal v3 DB
select/arm a Formal epoch
reuse failed v2 DB
reuse a qualification artifact across heads
start O00
```

When the current qualification reaches terminal evidence:

```text
if FAIL:
  adjudicate the failure first; do not merge around it.

if PASS:
  use it as pre-change runtime evidence;
  finish successor review;
  merge one bounded successor implementation;
  freeze the new main;
  create fresh successor-head qualification stores;
  run the accelerated gate again on the new exact head;
  only then arm the next valid rolling candidate as Formal A0.
```

---

## 18. Explicit nonclaims of this design document

This document does NOT claim:

```text
#3225 implemented
successor code qualified
current fc7241... qualification passed
future Formal epoch selected
Formal v3 database armed
A0 persisted
runtime configs persisted
Formal O00 started
Formal execution > 0/24
MCFT-CAP-09 completed
```

It changes no authority and has no runtime effect.

---

## 19. Recommended implementation unit boundary

To minimize post-merge uncertainty, implement #3225 as one bounded successor unit containing all code needed before the successor-head accelerated requalification:

```text
1. shared Amendment-19 manifest builder
2. accelerated qualification updated to call that shared builder
3. formal-arm artifact assembler/validator
4. v3 A0 bootstrap executor
5. manifest-driven real evidence collector
6. Amendment-19 real Formal production runner CLI
7. date-independent live workflow wiring
8. final wall-clock readback gate
9. governance acceptance proving old v2/A18C surfaces cannot be selected
10. #3226 repeat-run false-red fix if it can be done without widening semantics
```

Do not split these across multiple protected-main merges. Multiple merges would repeatedly invalidate exact-head qualification and make the graduation chain more expensive and harder to audit.

The implementation PR remains off-main until current qualification evidence is terminal and the successor unit is complete enough that one merge can establish the next exact qualification subject.

---

## 20. Companion implementation-prep note

Concrete file-level extraction, orchestration-depth, arm lead-time, bootstrap lease-expiry and expired-preboundary fail-closed rules are refined in:

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-FRESH-V3-FORMAL-SUCCESSOR-IMPLEMENTATION-PREP-V1.md
```

The companion remains design-only and off-main. It does not widen this document into repository authority.