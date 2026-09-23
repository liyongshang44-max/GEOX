# GEOX MCFT-CAP-09 Amendment-19 — Fresh-v3 Formal Successor Implementation Prep V1

Status: **DESIGN / IMPLEMENTATION PREP ONLY — OFF-MAIN — NO RUNTIME OR FORMAL EFFECT**

Issue: **#3225**

Design base protected main:

```text
fc7241de6f8f11705b35c92feaa75caf91abb15e
```

Companion design:

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-FRESH-V3-FORMAL-SUCCESSOR-DESIGN-V1.md
```

This note refines the implementation boundary only. It must not be treated as authority, merged while the current exact-head qualification is pending, used to write `geox_mcft_cap09_s6_formal_t3r1_24h_v3`, or used to start a Formal epoch.

---

## 1. Current qualification observation at 2026-08-19T14:46Z

The current exact protected subject remains:

```text
fc7241de6f8f11705b35c92feaa75caf91abb15e
```

At approximately `2026-08-19T14:46Z`, both current qualification databases remained exact zero-state:

```text
geox_mcft_cap09_s6_accel24t_am19_v2
geox_mcft_cap09_s6_accel24t_am19_blocked_v2

facts = 0
scheduler slots = 0
terminal ticks = 0
leases = 0
checkpoints = 0
state history = 0
```

This is not evidence of failure. The rolling planner running near `14:05Z` deterministically selects:

```text
target_t = 2026-08-19T15:00:00.000Z
soil_window_start = 2026-08-19T14:45:00.000Z
```

and the rolling preboundary implementation begins the real soil phase at T-15m. Therefore a zero-state persistent qualification store at 14:46Z is consistent with the rolling live capture still being inside its provider window.

No conclusion about PASS/FAIL may be drawn until the rolling run reaches terminal evidence or the persistent stores begin to write.

---

## 2. Successor orchestration topology

The existing qualification chain is:

```text
rolling candidate
      ↓ workflow_run
persistent 24T
      ↓ workflow_run
graduation gate
```

GitHub Actions allows at most three sequential `workflow_run` levels after an initial workflow. With the current chain, a graduation-triggered Formal-arm workflow would consume the last available chained level and leave no further `workflow_run` successor depth. The successor therefore should not spend that final level unnecessarily.

Preferred successor topology:

```text
ROLLING
  ├──> PERSISTENT 24T
  │       └──> GRADUATION GATE
  │
  └──> FORMAL ARM CANDIDATE EVALUATOR
           │
           ├── requires an already-existing same-subject graduation gate OPEN artifact
           ├── rejects every rolling candidate observed before gate OPEN
           └── arms the first later exact-subject rolling candidate that satisfies all lead-time rules
```

`FORMAL ARM CANDIDATE EVALUATOR` listens to successful rolling completion, not to graduation completion.

This has four advantages:

```text
1. preserves workflow_run chain budget
2. naturally consumes the first post-gate rolling candidate
3. candidate producer subject is already explicit
4. no date-specific workflow commit is required
```

The arm evaluator must never infer that a candidate is "post-gate" merely from wall-clock ordering. It must require the exact same subject SHA and a durable graduation artifact whose run completed before the candidate is armed.

---

## 3. Formal arm lead-time invariant

For a selected rolling candidate:

```text
A0  = candidate.target_t
O00 = A0 + PT1H
O23 = A0 + PT24H
```

The old v2 provider-watermark collector has already established an operational GFS preboundary start rule of at least T-30m, and the rolling planner itself uses a 35-minute minimum target lead.

The successor SHOULD freeze:

```text
MIN_FORMAL_ARM_TO_O00_LEAD_MINUTES = 35
```

as an operational safety rule, not temporal authority.

Required arm admission:

```text
arm_completed_at <= O00 - 35m
```

If the candidate cannot satisfy this, reject it with zero Formal effects and wait for the next exact-subject rolling candidate.

This prevents an arm from being created so late that the first O00 GFS preboundary collection cannot legally begin with the already-qualified minimum lead.

No relabeling from one candidate T to a later T is allowed.

---

## 4. Bootstrap lease-expiry invariant

`ExternalFormalBootstrapPersistenceServiceV1` acquires a production Runtime lease when it persists A0. The current production lease duration used by this line is 900 seconds.

The final Formal O00 scheduler claim must not depend on accelerated clock substitution.

Therefore the arm/bootstrap supervisor must prove before O00:

```text
bootstrap lease uses real DB transaction time
bootstrap lease expiry <= O00 wall-clock boundary
```

A simple sufficient operational rule is:

```text
A0 bootstrap terminal success <= O00 - 15m
```

but the machine proof should prefer the actual persisted lease `expires_at <= O00` rather than infer expiry only from the nominal duration.

If the bootstrap lease cannot expire by O00, reject/fail the selected epoch before Formal O00 instead of modifying the lease clock.

---

## 5. File-level implementation extraction map

### 5.1 Shared Amendment-19 manifest builder

Source logic currently embedded in:

```text
scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts
  buildQualification(...)
```

New production-shared pure surface:

```text
apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.ts
```

Responsibilities:

```text
consume ExternalFormalPrewindowAuthorityBundleV3
consume exact subject SHA
consume database identity
materialize exact 24 crop-context hashes
construct exact parent-linked slot pins
construct ExternalFormalV3Am19WindowManifestV1
compute semantic manifest identity including subject SHA
no filesystem
no DB
no provider
no wall clock
```

Then update accelerated qualification to use this builder. Do not duplicate its logic into a Formal-only implementation.

### 5.2 Formal-arm assembler / validator

New script, conceptually:

```text
scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_ARM_V1.cjs
```

Consumes only:

```text
same-subject graduation gate OPEN artifact
same-subject rolling candidate PASS artifact
rolling retained-raw provenance
fresh-v3 store authority
current protected-main SHA
```

Emits immutable arm JSON only. No DB/provider/R2 write.

### 5.3 A0 bootstrap executor

New script, conceptually:

```text
scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_FORMAL_V3_A0_BOOTSTRAP_V1.ts
```

Reuse:

```text
buildExternalFormalPrewindowAuthorityBundleV3
shared Amendment-19 manifest builder
ExternalFormalBootstrapPersistenceServiceV1
PostgresRuntimeRepositoryV1
PostgresNextTickRepositoryV1
PostgresExternalFormalEvidenceIngressV1
existing raw-retention verification primitives
```

Do not reuse old A18B/A18D date pins.

### 5.4 Manifest-driven provider ingress

Reference implementation to decompose, not copy wholesale:

```text
scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E3_FORMAL_V2_PROVIDER_WATERMARK_COLLECTOR_V2.ts
```

Reusable behavior:

```text
GFS transport + decoder
KBS soil transport + decoder
KBS delayed-exact decoder
raw retention before canonicalization
atomic GFS pair ingress
atomic delayed-exact pair ingress
bounded operational GFS retry
soil T-15m..T admission window
actual completion/ingestion clocks
PostgresExternalFormalEvidenceIngressV1
```

Must be removed/replaced:

```text
hard-coded EPOCH_ID
hard-coded O00/O23
hard-coded v2 database
old EA5E3 authority document dependency
old pre-runtime-hardening authority dependency
v2 dataset naming authority
old date-specific schedule assumptions
```

New executor consumes the unique exact-subject arm manifest.

### 5.5 Real Formal runner CLI

New script, conceptually:

```text
scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_FORMAL_V3_PRODUCTION_RUNNER_V1.ts
```

Must compose:

```text
ExternalFormalV3Amendment19RunnerV1
ExternalFormalV3Amendment19PersistentTickServiceV1
PostgresExternalFormalAmendment19EvidenceSourceV1
PostgresPersistentSequentialSchedulerAdapterV1
PostgresRuntimeRepositoryV1
PostgresNextTickRepositoryV1
PostgresForecastScenarioRecoveryRepositoryV1
shared Amendment-19 manifest builder / validator
production crop materializer
```

It must not import:

```text
ExternalFormalV3Amendment11PersistentTickServiceV1
mcft_cap09_a18c_formal_live_manifest_v1.ts
failed v2 epoch constants
```

### 5.6 Final readback / completion gate

New machine-only final readback must require the same arm subject, manifest and DB identity and must prove 24 real slots before any MCFT-CAP-09 completion claim.

---

## 6. Provider/runtime separation is mandatory

The Amendment-19 runtime evidence source is intentionally read-only and DB-only.

Runtime path:

```text
DB evidence
  ↓
PostgresExternalFormalAmendment19EvidenceSourceV1
  ↓
ExternalFormalV3Amendment19RunnerV1
  ↓
ExternalFormalV3Amendment19PersistentTickServiceV1
  ↓
canonical core
```

Provider path:

```text
provider raw bytes
  ↓
durable private raw retention
  ↓
decoder/canonicalizer
  ↓
PostgresExternalFormalEvidenceIngressV1
  ↓
DB facts
```

Runtime provider waits/fetches remain forbidden.

This means a "new Formal runner" without a manifest-driven real evidence ingress lane is incomplete even if it compiles.

---

## 7. Expired preboundary gap is terminal epoch failure, not perpetual NOT_READY

`PostgresExternalFormalAmendment19EvidenceSourceV1` requires, at every selected T:

```text
soil >= 1
future_weather >= 1
future_et0 >= 1
```

and excludes any record whose:

```text
available_to_runtime_at > T
or
ingested_at > T
```

The production runner performs this evidence precheck before claiming the scheduler slot. Missing required families therefore return a preclaim not-ready result.

For a real Formal boundary, once wall clock has passed T, a required family that was not ingested by T can never later become legal evidence for that T. Re-running the runner forever would be semantically wrong and would also block oldest-first progression behind an impossible slot.

Therefore the successor provider/supervisor layer MUST have an explicit terminal epoch rule:

```text
if wall_clock >= T
and required preboundary dataset for T was not durably ingested with ingested_at <= T
then
  FORMAL_EPOCH = NO_GO_FAIL_CLOSED
  reason = EXPIRED_PREBOUNDARY_CAUSAL_GAP
  do not claim/relabel T
  do not wait for late evidence to repair T
  do not continue claiming later slots as if the 24h graduation remained valid
```

This is an epoch-level qualification failure artifact, not a synthetic scheduler terminal tick.

Late evidence may still be retained for audit, but cannot restore the failed graduation epoch.

---

## 8. Exact per-slot wall-clock sequence

For each Formal slot T after O00:

```text
T-70m .. T-30m
  bounded GFS preboundary start window

T-15m .. T
  soil observation admission window

<= T
  all required raw retention + canonical ingress must complete

T
  evidence cutoff freezes at exact logical T

T or later real GitHub invocation
  scheduler lists oldest due slot
  runner prechecks exact manifest/runtime config/crop context/DB evidence
  scheduler claims using real DB lease/fencing
  Amendment-19 canonical core executes
  scheduler records terminal result
```

If the runner invocation is late, the selected evidence snapshot remains T.

If required preboundary evidence missed T, section 7 applies and the epoch fails.

---

## 9. One-merge successor discipline

Before the future #3225 implementation may merge to protected main, the off-main implementation should already contain and pass PR-only tests for all of:

```text
shared manifest builder
accelerated runner switched to shared builder
arm assembler
arm exact-subject validator
A0 bootstrap executor
manifest-driven provider ingress
real Amendment-19 Formal runner
final readback gate
workflow wiring
old v2/A18C selection prohibition
repeat-run false-red repair if included
```

After that single implementation merge:

```text
new protected SHA
  ↓
freeze
  ↓
new zero-state accelerated qualification databases
  ↓
new exact-head rolling
  ↓
new persistent 24T
  ↓
new graduation gate
  ↓
next post-gate same-subject rolling candidate
  ↓
Formal arm
```

Do not merge partial successor slices one-by-one into protected main.

---

## 10. Nonclaims

This implementation-prep note does NOT claim:

```text
current rolling capture PASS
current persistent 24T started
current persistent 24T PASS
#3225 implemented
new successor SHA exists
Formal arm exists
v3 A0 exists
Formal O00 started
MCFT-CAP-09 completed
```

It changes no runtime, workflow, database, provider, authority or Formal state.
