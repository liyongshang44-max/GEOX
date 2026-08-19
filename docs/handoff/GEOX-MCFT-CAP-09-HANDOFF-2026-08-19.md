# GEOX MCFT-CAP-09 HANDOFF — 2026-08-19 — AMENDMENT-19 PERSISTENT QUALIFICATION + REHYDRATION BLOCKER

> **HANDOFF / CONTEXT TRANSPORT ONLY — NOT REPOSITORY AUTHORITY**
>
> This document is intentionally subordinate to the repository authority chain listed below.
> It records the exact development frontier reached after the failed 2026-08-17 Formal epoch, fresh-v3 store requalification, Amendment-19 cadence decoupling, accelerated graduation-gate introduction, canonical-core qualification, production persistent cutover, and the first exact-main persistent-24T live attempts.
>
> If this handoff conflicts with protected `main`, a frozen Taskbook/Amendment, a machine authority JSON, a required acceptance script, or a live GitHub/Neon fact, **the handoff loses**.

---

## 0. Handoff identity

```text
handoff_date:
2026-08-19

repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
530b857765da471a442727daee9687206059e5c4

current_capability:
MCFT-CAP-09

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

master_task_line:
docs/digital_twin/master/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md

current_frontier:
AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_REHYDRATION_SEMANTIC_HASH_BLOCKER

formal_epoch_selected:
false

formal_o00_started:
false

stage_1b_formal_closure:
false
```

This handoff is based on exact protected `main`:

```text
530b857765da471a442727daee9687206059e5c4
```

That commit is the merge result of PR **#3215**:

```text
MCFT-CAP-09: normalize T3R1 credential seed for v3 persistent qualification
```

Do **not** start the next conversation from the old protected-main subject recorded in the 2026-08-18 handoff.

The old handoff was created when the frontier was still:

```text
failed Formal epoch
→ runtime-environment requalification
→ fresh v3 store qualification
```

The frontier has moved materially since then.

---

# 1. Executive summary

The current MCFT-9 problem is no longer:

```text
Can we build a 24-hour Shadow-online runtime?
```

and it is no longer:

```text
Should the hourly Runtime wait for KBS exact-T data?
```

Those architectural questions have already been adjudicated.

The current problem is much narrower:

```text
Can the exact-main rolling candidate be rehydrated deterministically
from producer-bound retained raw evidence,
then enter the already-built production-equivalent persistent 24T qualification graph?
```

The latest exact-main live chain is:

```text
protected main
530b857765da471a442727daee9687206059e5c4
        ↓
rolling capture run
32210446530
        ↓
rolling candidate target
2026-08-19T04:00:00Z
        ↓
rolling artifact
9351658033
        ↓
workflow_run-triggered persistent qualification
32213857092
        ↓
credential-seed normalization
PASS
        ↓
persistence-free canonical 24T reproof
PASS
        ↓
producer-bound R2 rehydration
FAIL
        ↓
MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
        ↓
production persistent qualification
SKIPPED
        ↓
Neon A0 write
NOT REACHED
```

Therefore the exact current frontier is:

```text
ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

not:

```text
waiting for KBS daily batch
```

not:

```text
waiting for the old Formal epoch
```

not:

```text
scheduler/lease debugging
```

and not:

```text
Formal 24h execution
```

At handoff time:

```text
PERSISTENCE_FREE_24T = PASS
PERSISTENT_24T       = NOT PASS / NOT YET CLAIMED
future Formal epoch  = FORBIDDEN TO CREATE
Formal O00           = FORBIDDEN TO START
```

The next owner must first make rehydration deterministic on an immutable exact-main rolling candidate **without weakening semantic equality**.

---

# 2. Authority order — do not invert this

The working authority order remains:

```text
1. Digital Twin Master Task Line
2. MCFT-CAP-09 Taskbook + effective Amendments / machine authority JSON
3. Current Delivery Policy / main ruleset / trusted registry policy
4. Protected main
5. Exact live GitHub run / artifact / Neon state
6. This handoff
```

When resolving current Amendment-19 work, include at minimum:

```text
docs/digital_twin/master/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-*.md/json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-CADENCE-DECOUPLING.md

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-CADENCE-DECOUPLING-AUTHORITY-V1.json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE.md

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE-V1.json
```

The graduation-gate machine authority is particularly important because it freezes what an accelerated lane is allowed to prove and what it is **not** allowed to substitute.

---

# 3. Source-control topology at handoff

## 3.1 Protected main

```text
main:
530b857765da471a442727daee9687206059e5c4
```

This main includes:

```text
#3206 fresh-v3 zero-state store qualification
#3207 Amendment-19 cadence decoupling
#3208 Amendment-19 accelerated graduation gate
#3209 persistence-free same-canonical-core 24T
#3210 production persistent Amendment-19 cutover
#3211 parameterized V3 runtime-config chain
#3212 accelerated scheduler boundary-clock seam
#3213 persistent 24T driver/workflow
#3215 T3R1 credential-seed normalization fix
```

## 3.2 Do not confuse historical branches with the current execution subject

Many historical branches remain in the repository, including old Amendment-11 / EA5E2 / A18D / failed-v2 branches.

Their presence does not make them current authority.

In particular, do not select an old branch because a historical workflow expects it.

The runtime subject for current work is protected main unless an exact diagnostic branch is intentionally created and explicitly classified as non-authoritative.

## 3.3 Old handoff transport

The previous handoff transport was:

```text
#3205
docs(mcft-cap09): hand off failed Formal epoch and runtime requalification
```

It was intentionally docs-only and not the runtime subject.

This 2026-08-19 handoff supersedes that transport context.

---

# 4. What MCFT-CAP-09 still has to prove

The Taskbook's final S6 / Stage-1B closure still requires a true 24-hour Shadow-online run over actual UTC hourly boundaries.

That requirement has **not** been deleted by Amendment-19.

Amendment-19 changed the development/qualification model, not the final closure requirement.

The correct development model is now:

```text
code change
   ↓
persistence-free canonical 24T
   ↓
persistent production-graph accelerated 24T
   ↓
fault injection / restart / backfill / idempotency / readback
   ↓
all machine gates PASS
static_blocker_count = 0
   ↓
freeze exact main / config / schema / environment
   ↓
select earliest safe future Formal epoch
   ↓
one real wall-clock O00–O23 graduation run
```

The old model is retired:

```text
change code
→ wait for a real window
→ fail at hour 3
→ change code
→ wait again
→ fail at hour 8
→ repeat
```

The real 24h run remains necessary because only it proves:

```text
actual UTC boundaries
GitHub runner real scheduling
long-lived DB connection/state survival
real provider availability movement
real network jitter
real restart/retry timing
cross-24h checkpoint continuity
no future leakage
```

But it is now a **graduation test**, not the development loop.

---

# 5. Why Amendment-19 exists

KBS was empirically established to have:

```text
observation resolution:
HOURLY

publication cadence:
DAILY_BATCH
```

It publishes approximately a day's hourly observations in a daily batch.

The old operational wiring effectively behaved like:

```text
Runtime tick T
→ wait for KBS exact-T
→ provider has not published it yet
→ scheduler cannot terminalize
→ wait until next daily batch
```

That is the wrong architecture for an hourly digital twin runtime.

The frozen Amendment-19 rule is:

```text
exact-T is an Evidence identity/admission condition
NOT a Runtime scheduler wait condition
```

The provider watermark remains evidence-admission authority.

It is **not** scheduler eligibility authority.

The runtime advances each hour using evidence causally available at the boundary.

---

# 6. Amendment-19 current-interval forcing semantics

At each logical boundary `T`, current interval forcing covers:

```text
(T-1h, T]
```

There are two valid modes.

## 6.1 Mode A — exact provider interval pair

If the complete exact pair is available by the boundary:

```text
exact rainfall(T)
+
exact historical ET0(T)
```

then:

```text
forcing mode = EXACT_PROVIDER_INTERVAL_PAIR
runtime health = HEALTHY
```

The exact pair must satisfy the existing evidence authority requirements:

```text
same authorized source family
exact interval/event identity
real availability chronology
quality gates
raw-retention-first
no future leakage
no timestamp relabel
no interpolation
no source substitution
```

## 6.2 Mode B — prior-step causal assumption pair

If the exact provider pair is not fully available by boundary `T`, use the forecast-assumption pair already known before `T`:

```text
prior-step GFS weather assumption
+
prior-step future ET0 assumption
```

The intended semantics are exactly:

```text
causally available forecast assumption
→ used as current process forcing
→ epistemic class remains ASSUMED
→ runtime health = DEGRADED
```

Mode B is explicitly **not**:

```text
fake observation
persistence fill
source substitution
timestamp relabel
retroactive rewrite
```

## 6.3 Partial exact pair rule

If only one exact provider family has arrived:

```text
rainfall only
```

or:

```text
historical ET0 only
```

then the runtime must **not** mix:

```text
one exact family + one assumed family
```

It must use the whole Mode-B pair.

## 6.4 Late exact evidence

When the daily KBS batch later delivers exact historical evidence:

```text
late exact-T
```

it may be admitted append-forward under its real chronology.

It must not rewrite the already terminal State/checkpoint for historical tick T.

---

# 7. User-frozen accelerated-lane hard constraints

The accelerated lane is prohibited from becoming a second implementation.

The first knife must call the exact same production-facing canonical core that the persistent path uses.

The frozen core is:

```text
apps/server/src/runtime/twin_runtime/external_formal_amendment19_canonical_tick_core_v1.ts

executeExternalFormalAmendment19CanonicalTickV1
```

The semantic chain frozen behind that entrypoint is:

```text
current-interval forcing selector
→ State propagation
→ observation assimilation
→ future-forcing selection
→ Forecast
→ canonical A1/A2 record set
```

Engineering code is forbidden from directly implementing an easier copy of:

```text
State math
Forecast math
forcing selection
A1/A2 canonicalization
```

The second knife must be:

```text
Formal production execution graph
minus real one-hour waiting
plus accelerated boundary clock
```

Only the boundary-wait clock may differ.

The following must remain the real production components:

```text
fresh v3 schema
exact runtime config chain
persistence repositories
scheduler
lease/fencing
runner
health
checkpoint
lineage
canonical record-set builders
```

No in-memory substitute is allowed for persistent 24T.

No simplified qualification runner is allowed.

---

# 8. Graduation machine gate

A future Formal epoch may not be created until all of these are terminal PASS:

```text
PERSISTENCE_FREE_24T
PERSISTENT_24T
O00_WARM_START
MODE_A
MODE_B
PARTIAL_PAIR
LATE_EXACT_NO_REWRITE
RESTART
MISSED_SLOT_BACKFILL
IDEMPOTENCY
ZERO_PROVIDER_WAIT
SCHEMA_ENV_PREFLIGHT
FULL_CHAIN_READBACK
```

Additionally:

```text
static_blocker_count = 0
human_override_authorized = false
```

Do not manually decide:

```text
"looks stable enough, pick an epoch"
```

The epoch decision is machine-gated.

---

# 9. Required second-knife scenario matrix

The persistent accelerated run must include all of the following.

## 9.1 O00 warm-start

```text
O00_WARM_START_REAL_CAUSAL_GFS_H1
```

O00 process forcing must be a real causally captured GFS H1 pair.

## 9.2 Consecutive Mode B

Multiple consecutive ticks must prove:

```text
forcing epistemic class = ASSUMED
runtime health = DEGRADED
scheduler still advances
checkpoint/state still advance
```

## 9.3 Mode A switch

At one selected tick, make the complete exact KBS pair available by the boundary.

Expected:

```text
Mode A
HEALTHY
```

## 9.4 Partial pair

Inject:

```text
rainfall only
```

and independently:

```text
ET0 only
```

Expected:

```text
whole Mode B
no mixing
```

## 9.5 Late exact no rewrite

After a tick is terminal, append its exact KBS pair with a real later availability/ingestion time.

Prove unchanged:

```text
State hash
checkpoint hash
terminal slot identity
```

## 9.6 Restart

Destroy/recreate process-side production objects and database pool.

Resume from persisted checkpoint.

## 9.7 Missed-slot backfill

Skip one scheduler slot intentionally.

Then prove:

```text
oldest-first backfill
```

using the production scheduler.

## 9.8 Idempotency

Re-execute the same due slot / rerun runner.

Prove no duplicate canonical work.

## 9.9 Missing assumption pair

On a separate fresh fault DB, remove the causal prior pair.

Expected:

```text
BLOCKED
provider wait = 0
```

Do not corrupt the main 24T continuity lane with this deliberate failure.

## 9.10 Full chain readback

After 24 ticks, read back and reconcile:

```text
State
Forecast
Health
Checkpoint
Lineage
Scheduler slot ledger
Terminal results
```

---

# 10. First knife — completed

PR #3209 completed the persistence-free canonical qualification.

Protected main after merge:

```text
a69c221cf7b6dcaf3f6565dff64633abc6f9d47d
```

The acceptance did not run 24 independent fixtures.

It chained each next tick from the previous canonical output:

```text
State
checkpoint
Forecast
→ next handoff
```

Verified:

```text
24 canonical ticks
1 Mode-A tick
23 Mode-B ASSUMED/DEGRADED ticks
rainfall-only partial pair
ET0-only partial pair
late exact no rewrite
no causal assumption pair → blocked
provider wait count = 0
```

It explicitly did not claim:

```text
PERSISTENT_24T
real O00 GFS proof
production runner cutover
Stage-1B Formal closure
future Formal epoch
```

Current official fact:

```text
PERSISTENCE_FREE_24T = PASS
```

---

# 11. Production persistent cutover — completed

PR #3210 merged the Amendment-19 production successor classes.

Protected main after merge:

```text
65e7aa53044db7423af38fb480a2061ebd86ba87
```

Important production changes:

```text
DB Evidence source:
soil + future_weather + future_et0 required at boundary
exact rain/historical ET0 optional at boundary

persistent tick service:
calls the same canonical core as first knife

runner:
real scheduler
real claim/fence
real persistence
real terminal ledger

snapshot:
bound to selected logical slot T
```

Mode-B terminal scheduler state is allowed to be:

```text
DEGRADED
```

It is not relabeled healthy.

Missing causal forcing is terminally blocked/failed with zero provider wait.

Old Amendment-11 runtime classes remain useful as historical/regression surfaces but are not the new Formal execution path.

---

# 12. V3 runtime-config chain — completed

PR #3211 removed dependence on the failed-v2 hard-coded epoch/config identity.

Protected main after merge:

```text
95ec662ea171ada89ba1f8ba1c848be6c20dab86
```

The successor V3 builder parameterizes:

```text
epoch id
A0
created_at
fresh-store authority
```

while retaining the canonical compiler and same source/reality/crop/config authorities.

Do not reuse old A18D V2 constants.

Do not revive:

```text
2026-08-17 failed epoch
old v2 database identity
old A0/O00/O23 constants
```

---

# 13. Scheduler accelerated clock seam — completed

PR #3212 merged the only allowed clock substitution.

Protected main after merge:

```text
67f801df7e50df96e89ba61d62978faa8412fc86
```

The production scheduler remains:

```text
PostgresPersistentSequentialSchedulerAdapterV1
```

Default production clock authority remains database UTC.

Accelerated qualification may inject only:

```text
ACCELERATED_ENGINEERING_ONLY boundary clock
```

It may not replace:

```text
slot ledger
cursor
lease
fencing
claim semantics
oldest-first
terminal CAS
```

### Bootstrap lease rule

A0 bootstrap uses the real production lease.

It does not actively release that lease.

Therefore the qualification must respect the real bootstrap lease TTL:

```text
900 seconds
```

Do **not** shorten or bypass lease/fencing merely to make the accelerated test faster.

Main and blocked lanes may bootstrap in parallel and pay this real lease wait once.

After hourly terminalization, normal production lease behavior applies.

---

# 14. Persistent 24T driver/workflow — implemented

PR #3213 merged the second-knife orchestration.

Protected main after merge:

```text
24a1b5d957e042a0a92543ca2d9742901a22d453
```

Current workflow:

```text
.github/workflows/mcft-cap-09-amendment19-persistent-24t-qualification.yml
```

The live path is:

```text
successful rolling workflow_run
→ exact triggering run id
→ exact triggering head SHA
→ exact rolling artifact
→ persistence-free reproof
→ producer-bound R2 rehydration into isolated local DB
→ production persistent driver
→ Neon qualification DBs
→ machine result
```

The workflow does **not** search for "latest artifact".

It binds to the triggering run ID and triggering exact SHA.

That protects against concurrent-run artifact mixups.

The rehydration workflow applicability was expanded to allow `workflow_run` while leaving the rehydration implementation itself otherwise unchanged.

Because that file is governed by the EA5E2 dependency graph, the graph carrier was correctly rebound to:

```text
sha256:3e78a7948bdd74711b4193c910d81d06d7d05a0aa36b9f7f30f3bf23d9e308a7
```

Do not treat a dependency-graph digest change as automatically "CI noise".

First prove why it changed.

---

# 15. Credential-seed binding bug and fix — completed

The first persistent-live attempt exposed a configuration bug before any Neon write.

The existing secret:

```text
GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL
```

historically and intentionally pointed at:

```text
geox_mcft_cap09_s6_formal_t3r1_24h
```

The initial #3213 workflow incorrectly interpreted the secret pathname as if it were itself the current v3 authority.

That caused a DB identity preflight failure.

PR #3215 fixed the interpretation.

Current protected main:

```text
530b857765da471a442727daee9687206059e5c4
```

The workflow now treats the secret as a stable credential seed.

Allowed seed pathnames are strictly bounded to governed T3R1 sibling identities.

The workflow normalizes only the pathname to:

```text
geox_mcft_cap09_s6_formal_t3r1_24h_v3
```

while preserving:

```text
host
username/password
encryption/TLS/query parameters
```

This normalization is **not** authority by itself.

The driver still validates actual database identity and frozen schema fingerprints.

Latest live run proves this fix works:

```text
credential normalization step = PASS
seed database = old governed T3R1 sibling
target database = v3
credential fields preserved = true
```

---

# 16. Neon database topology

## 16.1 Formal pristine store

```text
geox_mcft_cap09_s6_formal_t3r1_24h_v3
```

Purpose:

```text
future real Formal epoch only
```

Do not use it for accelerated persistent 24T writes.

## 16.2 Main accelerated qualification store

```text
geox_mcft_cap09_s6_accel24t_am19_v1
```

Purpose:

```text
main persistent 24T continuity / fault matrix
```

## 16.3 Isolated blocked-fault store

```text
geox_mcft_cap09_s6_accel24t_am19_blocked_v1
```

Purpose:

```text
NO_ASSUMPTION_PAIR_BLOCKS_EXPLICITLY_WITHOUT_WAIT
```

This prevents deliberate blocking from breaking the main 24T chain.

## 16.4 Frozen schema fingerprints

The exact 26-relation schema was previously qualified with:

```text
columns:
873a8e86f55d75a04a5f671627e98ae1

constraints:
7803f7e7706e52eca3ca2aa4290ff5dd

indexes:
ea5b3ba0392fd52fb471bc754e94ed35
```

Both qualification stores were created from the pristine V3 shape and verified against the frozen schema authority.

## 16.5 Current write state

After the latest persistent-live failure, the driver still had not entered the remote persistent production graph.

The last verified state in this conversation was:

```text
main accel facts = 0
main accel authority snapshot = 0
main accel leases = 0
main accel slots = 0
main accel terminals = 0
main accel state history = 0

blocked accel corresponding runtime rows = 0

Formal v3 corresponding runtime rows = 0
```

Therefore the current `*_v1` qualification stores have **not yet been consumed by a partial persistent run**.

They remain eligible to use after the rehydration blocker is fixed.

### Critical audit rule

If a future persistent run produces any qualification-store writes and then fails:

```text
DO NOT TRUNCATE
DO NOT CLEAR
DO NOT "RESET" AND REUSE
```

That physical qualification DB becomes audit-only.

Create a successor:

```text
..._v2
```

instead.

The same principle that invalidated reuse of failed-v2 Formal applies here.

---

# 17. Fresh-v3 store qualification — completed

PR #3206 closed the old fresh-store blocker.

The fresh v3 store was created zero-state rather than copied from the failed Formal DB.

The important lesson from that work:

```text
Do not reconstruct the Formal schema by "running whatever migrations look current".
```

A later CAP06 migration had changed a relation in a way that would not match the frozen Formal reference.

The safe process was:

```text
historical/frozen catalog
→ exact 26-relation contract
→ exact catalog reconstruction
→ exact fingerprint comparison
→ zero-state proof
```

That discipline must remain.

---

# 18. O00 real-causal GFS warm-start mapping

One critical mapping was resolved during this conversation.

A rolling candidate `target_t` should map to:

```text
qualification A0 = candidate.target_t
qualification O00 = candidate.target_t + 1h
```

Do **not** map candidate target directly to O00.

Why:

```text
rolling soil observation occurs near target_t
→ valid for A0 bootstrap window

retained GFS assumption valid_from = target_t
→ H1 covers [target_t, target_t+1h]
→ exactly covers (A0,O00]
```

This allows:

```text
O00_WARM_START_REAL_CAUSAL_GFS_H1
```

without changing provider timestamps.

Do not relabel historical retrieval/availability times.

---

# 19. Do not over-expand the real GFS requirement

A temporary design detour considered extending live GFS support to ~95h so every accelerated tick could be backed by a separately shifted real H1 snapshot.

That was rejected as unnecessary architecture expansion.

The user-frozen requirement is specifically:

```text
O00 warm-start uses real causal GFS H1
```

The later accelerated engineering ticks may use controlled qualification assumptions, provided they still enter through:

```text
facts
→ production DB Evidence adapter
→ production selector
→ same canonical core
```

and remain explicitly:

```text
ASSUMED
ENGINEERING_FIXTURE_ONLY
NOT_FORMAL_EXTERNAL_EVIDENCE
```

Do not convert this into a new 95h provider project.

---

# 20. Soil temporal constraint

Continuation soil observation is not indefinitely reusable.

The current runtime evidence contract requires a recent soil observation near each tick boundary.

The A0 real soil observation is only for bootstrap.

For O00–O23 accelerated qualification, controlled qualification soil observations must be provided per tick through the normal facts/evidence path.

Do not reuse A0 soil across the entire 24T run.

Do not weaken soil freshness merely to simplify the test.

---

# 21. Crop materializer temporal constraint

Current production crop materialization on this path is not a generic all-stage materializer.

It expects the bounded current MID consensus and includes backward/forward transition guards.

The qualification driver must run the real materializer before remote DB mutation.

It must not hard-code MID merely because the current field is expected to be MID.

If any slot falls outside the allowed materialization interval:

```text
fail closed
choose another candidate
```

Do not coerce stage identity to make the accelerated run pass.

---

# 22. Historical failed Formal epoch — permanent NO-GO

The old Formal epoch was:

```text
O00:
2026-08-17T20:00:00.000Z

A0:
2026-08-17T19:00:00.000Z
```

That epoch failed.

It must never be resumed or reclassified as current.

The failed v2 database is audit-only.

Do not:

```text
clear it
repair rows in place
reuse it for a successor epoch
resume old Oxx slots
```

The current V3 / Amendment-19 work is a successor qualification path.

---

# 23. Historical failed GFS raw recovery — do not retry this investigation

We investigated whether the failed epoch's GFS raw could be recovered as a legitimate real O00 warm-start source.

The collector ordering is:

```text
fetch
→ raw retain
→ retention verification
→ decode
```

The failed epoch died in the decoder environment.

However the preboundary failure path also deletes tracked transient retained raw, and no complete producer-bound rehydration manifest survived for that failed epoch.

Therefore:

```text
no complete original provenance
→ no safe historical rehydration
```

Do not download old GFS today and relabel it as if it had been available before old O00.

Use a new rolling causal capture instead.

---

# 24. Latest exact-main rolling capture — verified

Current protected main:

```text
530b857765da471a442727daee9687206059e5c4
```

A new rolling capture **did** occur on this exact main.

This supersedes the earlier working note that we were still waiting to see whether a post-02:05Z rolling capture existed.

Producer run:

```text
32210446530
```

Candidate target:

```text
2026-08-19T04:00:00Z
```

Rolling artifact:

```text
name:
mcft-cap09-rolling-preboundary-20260819t040000z-530b857765da471a442727daee9687206059e5c4

artifact_id:
9351658033

digest:
sha256:609f87169cfcd0844f2be08a4c1ca226f206303bcba05f387049f598f4e7dc7c
```

The artifact was consumed by the persistent qualification workflow using:

```text
triggering run id
+
triggering exact head SHA
```

not by a mutable "latest" lookup.

---

# 25. Latest persistent qualification — exact current blocker

Persistent qualification run:

```text
run_id:
32213857092

job_id:
95951578934

event:
workflow_run

subject:
530b857765da471a442727daee9687206059e5c4

started:
2026-08-19T03:55:17Z

conclusion:
FAILURE
```

The job successfully completed the following before failure:

```text
exact protected-main checkout
exact triggering subject gate
secret presence gate
credential-seed normalization to v3
exact triggering artifact download
one-candidate cardinality gate
Node/Python/decoder environment installation
eccodes selfcheck
persistence-free canonical 24T reproof
```

Credential normalization proved:

```text
seed_database:
geox_mcft_cap09_s6_formal_t3r1_24h

target_database:
geox_mcft_cap09_s6_formal_t3r1_24h_v3

credential_fields_preserved:
true
```

The failure occurred at:

```text
Governed producer-bound R2 rehydration into isolated local DB
```

with:

```text
MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

Therefore these steps were skipped:

```text
Execute production-graph persistent 24T qualification
Validate machine graduation result
```

No A0 write occurred in Neon.

## 25.1 Failed persistent safe-proof artifact

The failed run uploaded a safe proof artifact:

```text
artifact_id:
9351679190

zip_digest:
ed7dba927c1de0fef8519c6d9aba75ae7ad23c0b8205c66909c1019cdb4e7522
```

Preserve it for audit.

---

# 26. Rehydration mismatch history — important nuance

Do not assume the semantic mismatch is already understood.

Earlier in the conversation an older exact-main persistent attempt also saw:

```text
MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

A controlled diagnostic/rerun using the same candidate/raw path later succeeded once.

That means the failure has shown **replay-path sensitivity / possible nondeterminism**, but the exact divergent field has not yet been proven.

A temporary diagnostic PR was opened:

```text
#3214
```

It was diagnostic-only and was closed without merge.

Protected main was not changed by #3214.

A temporary theory was that soil `ingested_at` was not preserved in the manifest.

Static code audit then showed the soil decoder derives `ingested_at` deterministically from producer provenance `retrieved_at`.

Therefore:

```text
DO NOT implement a speculative soil chronology fix
until expected-vs-actual structural diff proves it.
```

The current exact-main live run has now reproduced the semantic hash mismatch again.

So the blocker is real and reproducible enough to prioritize, but the precise field-level root cause is still open.

---

# 27. Current correct blocker classification

```text
PRIMARY BLOCKER:
producer-bound R2 rehydration semantic equality instability/mismatch

FAILURE PHASE:
local isolated rehydration

REMOTE NEON WRITE:
not reached

PRODUCTION SCHEDULER:
not reached

A0 BOOTSTRAP:
not reached

900s LEASE:
not reached

O00:
not reached
```

Do not debug later stages before fixing this.

---

# 28. Secondary red signal — do not confuse with primary blocker

A separate current-main run was observed:

```text
run_id:
32214185399

workflow family:
mcft-cap-09-pre-runtime-hardening
```

Its `static-contract` job passed.

Its historical `live-formal-runner` failed at:

```text
Require unified exact hardening main
```

and then skipped old v2/live A0/provider/A18D steps.

This is a retired predecessor/live-v2 path rejecting the Amendment-19 successor main.

Do not repair MCFT-9 by reverting current main toward this old Formal-v2 workflow.

The active frontier is the Amendment-19 persistent qualification rehydration blocker.

The old workflow may later need lifecycle/applicability cleanup, but it is not the reason current `PERSISTENT_24T` is blocked.

---

# 29. GitHub run-discovery limitation and approved workaround

A practical tooling constraint was discovered in this conversation.

The available GitHub connector does not expose a convenient general "list recent scheduled/workflow_run history" action.

The local execution environment also did not have a usable `gh` CLI for this repository workflow inspection.

Do not guess run IDs.

The reliable two-signal method used here is:

```text
1. GitHub notification email
   → identify workflow name + run URL/run ID

2. Neon write state
   → determine whether persistent driver crossed preflight/A0
```

Then, once a run ID is known, use GitHub Actions APIs to fetch:

```text
run metadata
jobs
steps
logs
artifacts
```

Absence of an email is **not** proof of success.

GitHub notification settings may not email successful runs.

Use Neon state and direct run inspection as authoritative follow-up.

---

# 30. Current machine-gate status

Do not overclaim accelerated graduation statuses.

Current conservative machine status at handoff:

| Gate | Status | Evidence / note |
|---|---|---|
| `PERSISTENCE_FREE_24T` | **PASS** | canonical-core 24T proof merged and repeatedly reproved |
| `PERSISTENT_24T` | **NOT PASS / NOT YET CLAIMED** | persistent driver never reached remote execution |
| `O00_WARM_START` | **NOT YET CLAIMED** | real rolling candidate exists, but persistent qualification blocked before A0/O00 |
| `MODE_A` | **NOT YET CLAIMED for persistent graduation** | semantics proved persistence-free only |
| `MODE_B` | **NOT YET CLAIMED for persistent graduation** | semantics proved persistence-free only |
| `PARTIAL_PAIR` | **NOT YET CLAIMED for persistent graduation** | persistence-free proof exists |
| `LATE_EXACT_NO_REWRITE` | **NOT YET CLAIMED for persistent graduation** | persistence-free hash proof exists |
| `RESTART` | **NOT YET CLAIMED** | remote production graph not entered |
| `MISSED_SLOT_BACKFILL` | **NOT YET CLAIMED** | remote production graph not entered |
| `IDEMPOTENCY` | **NOT YET CLAIMED** | remote production graph not entered |
| `ZERO_PROVIDER_WAIT` | **NOT YET CLAIMED for persistent graduation** | core proof PASS; persistent blocked before runner |
| `SCHEMA_ENV_PREFLIGHT` | **PRECONDITION PROVED, graduation status not yet emitted** | qualification DBs/fingerprints already qualified |
| `FULL_CHAIN_READBACK` | **NOT YET CLAIMED** | no 24T persistent chain exists yet |

Do not convert "precondition already proved" into a graduation PASS until the persistent qualification result emits the required machine status.

---

# 31. Immediate next-step plan — exact order

The next owner should follow this order and avoid widening scope.

## Step 1 — preserve immutable current evidence

Preserve / reference:

```text
producer run:
32210446530

rolling artifact:
9351658033

digest:
sha256:609f87169cfcd0844f2be08a4c1ca226f206303bcba05f387049f598f4e7dc7c

persistent failed run:
32213857092

persistent job:
95951578934

failed safe-proof artifact:
9351679190
```

Do not replace these references with a later candidate before understanding the mismatch.

## Step 2 — instrument the existing rehydration fail path safely

Modify the existing governed rehydration diagnostics so that semantic mismatch records enough structural information to identify the divergent member.

Safe output should include, at most:

```text
record_type
source_record_id
expected semantic hash
actual semantic hash
non-sensitive structural field path / shape difference
```

Do **not** dump credentials, R2 secrets, full raw payloads, or sensitive agronomic values to Actions logs.

Do **not** weaken equality.

The final success criterion remains:

```text
expected semantic manifest == actual semantic manifest
```

## Step 3 — reproduce against immutable producer-bound evidence

Use the exact rolling artifact/raw provenance above.

The goal is not to create a synthetic reproduction.

The goal is to identify why the producer-bound rehydration path can mismatch.

## Step 4 — identify the exact root field/algorithm

Possible categories to test, but do not assume any one is correct:

```text
chronology reconstruction
record ordering
canonical payload serialization
source payload normalization
float/decimal normalization
GFS decoder version/environment
ET0 computation/environment
soil decoder provenance mapping
source-record identity ordering
semantic-hash input shape
```

## Step 5 — fix root cause, preserve semantic gate

The fix must make rehydration deterministic.

Forbidden fix:

```text
ignore semantic mismatch
sort away unexplained differences after hashing
compare only subset of fields
allow approximate equality
```

## Step 6 — run normal CI/ruleset and merge exact-head fix

Any main change creates a new protected-main SHA.

The current rolling candidate was produced by:

```text
530b8577...
```

If consumer workflow requires producer subject == consumer protected main, the old candidate cannot become the successor candidate after a new main merge.

Do not spoof producer SHA.

## Step 7 — wait for / capture a new rolling candidate on the fixed exact main

Use the new protected-main subject.

Verify producer run/artifact identity.

## Step 8 — follow persistent-live until first Neon write

The first critical milestone after rehydration PASS is:

```text
A0 bootstrap persisted
```

At that moment immediately record:

```text
DB identity
A0 State hash
checkpoint hash
lease row
runtime config chain identity
```

## Step 9 — if any remote write occurs and run later fails, retire v1 DBs

If main or blocked qualification DB becomes non-zero and the run does not fully qualify:

```text
mark physical DB audit-only
create v2 successor
```

Do not clear it.

## Step 10 — complete the full persistent fault matrix

Only after persistent execution starts should effort move to:

```text
real 900s bootstrap lease expiry
O00 real GFS H1
multi-tick Mode B
Mode A
partial pair
late exact no rewrite
restart
missed-slot backfill
idempotency
blocked-no-assumption lane
24T readback
```

## Step 11 — require all 13 machine statuses + zero blockers

Do not select future Formal epoch until:

```text
all 13 = PASS
static_blocker_count = 0
```

## Step 12 — freeze exact implementation

Freeze:

```text
protected main SHA
runtime config chain
schema fingerprints
environment/dependency versions
workflow/runner identity
```

## Step 13 — choose earliest safe future Formal epoch

Only now create the new epoch.

## Step 14 — run one real wall-clock 24h graduation

Do not delete this final test.

Do not return to using it as a development loop.

---

# 32. PR / merge evolution since the previous handoff

The following sequence is essential context.

## #3206 — fresh V3 Formal store qualification

Result:

```text
fresh v3 identity qualified
26-relation schema qualified
zero-state qualified
hard nonclaims qualified
```

Important consequence:

```text
store/schema blocker closed
```

## #3207 — Amendment-19 cadence decoupling

Result:

```text
provider cadence separated from runtime cadence
provider wait removed from scheduler semantics
Mode A / Mode B authority introduced
late exact append-forward preserved
```

## #3208 — accelerated graduation gate

Result:

```text
same canonical core hard constraint
same production graph hard constraint
13-status Formal-epoch gate
final real 24h retained as graduation test
```

## #3209 — persistence-free canonical 24T

Result:

```text
PERSISTENCE_FREE_24T = PASS
```

## #3210 — Amendment-19 persistent production cutover

Result:

```text
same canonical core now used by persistent production successor path
```

## #3211 — V3 dynamic runtime-config chain

Result:

```text
new epoch/config chain no longer hard-coded to failed V2 subject
```

## #3212 — accelerated scheduler clock seam

Result:

```text
only hourly-boundary waiting may be accelerated
lease/fencing preserved
```

## #3213 — persistent 24T qualification orchestration

Result:

```text
exact workflow_run producer binding
real Postgres graph orchestration
main + blocked qualification lanes
machine result structure
```

## #3214 — diagnostic-only rehydration PR

Result:

```text
closed without merge
no protected-main effect
```

Do not cite it as repository authority.

## #3215 — credential-seed normalization

Result:

```text
old stable T3R1 connection secret may be used as credentials
workflow derives v3 pathname fail-closed
actual DB authority still independently verified
```

Current main:

```text
530b857765da471a442727daee9687206059e5c4
```

---

# 33. Pitfalls already encountered — do not repeat

## Pitfall 1 — treating KBS publication cadence as Runtime cadence

Wrong:

```text
hourly tick must wait for provider exact-T
```

Correct:

```text
hourly runtime advances
exact pair if available → Mode A
otherwise causal assumption pair → Mode B / DEGRADED
```

## Pitfall 2 — changing `<=6h` into another freshness authority

Historical `<=6h` is diagnostic, not late exact-T authority.

Do not regress to:

```text
authority_pass = age <= 6h
```

or replace it with arbitrary 24h/36h authority.

## Pitfall 3 — using accelerated lane to test another implementation

Forbidden:

```text
engineering simplified State runner
engineering simplified Forecast
in-memory fake persistence graph
```

## Pitfall 4 — accelerating lease/fencing

Only hourly-boundary waiting may be accelerated.

Do not bypass the production 900s bootstrap lease.

## Pitfall 5 — using Formal v3 as accelerated write DB

Formal v3 must stay pristine.

Use qualification DBs.

## Pitfall 6 — clearing a failed physical DB

Once a persistent qualification DB has meaningful writes and a failed qualification history:

```text
audit-only
```

Create a successor DB.

## Pitfall 7 — trusting `pg_stat` estimates as zero-state proof

Use strict `COUNT(*)` on required relations.

## Pitfall 8 — computing schema fingerprints with an ad-hoc table set

An earlier hand-built query accidentally used a 15-table subset and produced meaningless fingerprints.

Use the exact frozen 26-relation list and exact authority serialization SQL.

## Pitfall 9 — running "all latest migrations" to reconstruct the Formal schema

This can produce a schema that is newer but not equal to the frozen Formal contract.

Catalog equality wins.

## Pitfall 10 — cloning pristine v3 while background connections exist

Neon `TEMPLATE` clone may fail if the source has active connections.

Do not repeatedly race it.

If a clone is truly required and no Formal epoch is active, use an auditable controlled connection-disable/terminate/clone/re-enable procedure and reverify pristine zero-state afterward.

## Pitfall 11 — recovering failed-epoch raw without full provenance

No original chronology → no causal authority.

Do not backfill provenance from today's download time.

## Pitfall 12 — mapping rolling target directly to O00

Wrong:

```text
O00 = candidate.target_t
```

Correct:

```text
A0 = candidate.target_t
O00 = candidate.target_t + 1h
```

## Pitfall 13 — using H2/H3 as if they were new prior-step H1 snapshots

Do not relabel horizons.

The user only requires real GFS H1 at O00 for this qualification.

Later controlled assumptions remain explicit engineering fixtures.

## Pitfall 14 — reusing A0 soil for all ticks

Soil freshness prohibits this.

## Pitfall 15 — hard-coding MID to make the run pass

Use the real crop materializer.

## Pitfall 16 — treating a red historical workflow as automatically a current blocker

First read its first failing step.

Some historical workflows reject successor main because their old exact-candidate lifecycle is intentionally frozen.

But do not ignore them without proof.

## Pitfall 17 — treating dependency-graph digest drift as noise

If a governed runtime entry changes, the carrier digest should change.

Rebind it transparently after proving:

```text
missing = 0
uncovered = 0
```

## Pitfall 18 — treating a connection secret pathname as runtime authority

The stable T3R1 secret may be credential seed.

Actual DB authority is verified after connection.

## Pitfall 19 — weakening rehydration equality because it is inconvenient

Current blocker must be fixed by deterministic reconstruction.

Do not turn:

```text
semantic hash equality
```

into approximate/subset equality.

## Pitfall 20 — "fixing" suspected soil chronology before proving it

A temporary theory about soil `ingested_at` was not enough.

Static code showed deterministic mapping from provenance.

Instrument first, then fix the actual divergent field.

## Pitfall 21 — assuming no notification email means success

Use run API / Neon state.

## Pitfall 22 — guessing scheduled run IDs

Do not guess.

Use notification/run URL or another auditable source.

## Pitfall 23 — creating a Formal epoch before graduation gate

Forbidden.

The cost of creating an epoch is real wall-clock time.

The machine gate exists specifically to prevent premature epoch creation.

---

# 34. What is explicitly not the current task

Do not expand current work into:

```text
new crop-source discovery
new KBS cadence research
new provider architecture
95h GFS redesign
new scheduler implementation
new persistence architecture
new health subsystem
new Formal epoch selection
old epoch recovery
```

Those are not required to clear the current blocker.

The current task is:

```text
make producer-bound rolling rehydration deterministic
→ enter existing persistent production graph
→ finish the frozen qualification matrix
```

---

# 35. Formal nonclaims at handoff

The following claims are false and must remain false until proven:

```text
MCFT-CAP-09 is complete
Stage-1B Formal closure is complete
PERSISTENT_24T = PASS
new Formal epoch exists
Formal O00 has started
real 24h graduation has passed
```

The following claim is true:

```text
PERSISTENCE_FREE_24T = PASS
```

The following implementation fact is true:

```text
production persistent Amendment-19 graph exists on protected main
```

The following blocker is true:

```text
current exact-main live candidate cannot yet pass governed rehydration semantic equality reliably
```

---

# 36. Suggested first checks for the next conversation

Start by proving exact current subject:

```text
protected main == expected handoff subject?
```

If main has moved since this handoff:

```text
STOP
re-audit current main before consuming this frontier
```

Then inspect:

```text
latest rolling run on current protected main
latest persistent workflow_run triggered by it
rehydration step
Neon qualification DB row counts
```

If the semantic mismatch remains current:

```text
instrument expected-vs-actual semantic member diff
```

Do not start with scheduler timing tests.

Do not start with a new Formal epoch.

Do not start with KBS cadence observation.

---

# 37. Evidence references that should survive conversation handoff

```text
CURRENT PROTECTED MAIN
530b857765da471a442727daee9687206059e5c4

CURRENT ROLLING PRODUCER RUN
32210446530

CURRENT ROLLING TARGET
2026-08-19T04:00:00Z

CURRENT ROLLING ARTIFACT
9351658033

CURRENT ROLLING ARTIFACT DIGEST
sha256:609f87169cfcd0844f2be08a4c1ca226f206303bcba05f387049f598f4e7dc7c

CURRENT PERSISTENT RUN
32213857092

CURRENT PERSISTENT JOB
95951578934

CURRENT PERSISTENT SAFE ARTIFACT
9351679190

CURRENT PERSISTENT SAFE ARTIFACT ZIP DIGEST
ed7dba927c1de0fef8519c6d9aba75ae7ad23c0b8205c66909c1019cdb4e7522

CURRENT FAILURE
MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH

CURRENT FORMAL STORE
geox_mcft_cap09_s6_formal_t3r1_24h_v3

CURRENT MAIN ACCEL STORE
geox_mcft_cap09_s6_accel24t_am19_v1

CURRENT BLOCKED ACCEL STORE
geox_mcft_cap09_s6_accel24t_am19_blocked_v1

FROZEN COLUMN FINGERPRINT
873a8e86f55d75a04a5f671627e98ae1

FROZEN CONSTRAINT FINGERPRINT
7803f7e7706e52eca3ca2aa4290ff5dd

FROZEN INDEX FINGERPRINT
ea5b3ba0392fd52fb471bc754e94ed35

CURRENT EA5E2 DEPENDENCY GRAPH CARRIER
sha256:3e78a7948bdd74711b4193c910d81d06d7d05a0aa36b9f7f30f3bf23d9e308a7
```

---

# 38. Definition of the next meaningful milestone

The next meaningful milestone is **not** another green static PR.

It is:

```text
exact-main rolling candidate
→ rehydration semantic equality PASS
→ remote production qualification begins
→ first A0 bootstrap write appears in main accel DB
```

Once that happens, immediately record the new frontier before debugging anything else.

If the run then fails after A0:

```text
qualification DB v1 becomes audit evidence
→ create v2 successor DB
```

If it proceeds:

```text
wait real bootstrap lease expiry
→ accelerated O00–O23
→ machine gate evaluation
```

---

# 39. Definition of MCFT-9 completion from here

The remaining intended path is:

```text
rehydration deterministic
        ↓
persistent 24T production graph PASS
        ↓
all 10 scenario proofs PASS
        ↓
all 13 machine statuses PASS
        ↓
static_blocker_count = 0
        ↓
freeze exact main/config/schema/environment
        ↓
select earliest safe future Formal epoch
        ↓
run one real wall-clock 24h O00–O23 graduation
        ↓
Stage-1B closure evidence
        ↓
MCFT-CAP-09 completion/finalization under Taskbook authority
```

The current work should remain on this path.

---

# 40. Final handoff statement

The repository is no longer blocked on whether KBS daily publication should stall an hourly runtime.

That architecture has been corrected.

The repository is no longer blocked on whether the accelerated lane is allowed to test a simplified implementation.

That has been forbidden by machine authority.

The repository is no longer blocked on whether a persistence-free 24T canonical path exists.

That path is PASS.

The repository is no longer blocked on whether a production-equivalent persistent successor graph exists.

That graph is implemented on protected main.

The current blocker is substantially narrower:

```text
producer-bound rolling evidence must rehydrate to the exact same semantic manifest deterministically
```

Until that closes:

```text
PERSISTENT_24T remains unqualified
Formal epoch creation remains forbidden
```

Do not broaden the audit scope before resolving this blocker.

Do not weaken semantic equality to get past it.

Once rehydration passes, the next proof must be the first real A0 write into the isolated accelerated qualification store, followed by the already-frozen production-graph qualification sequence.
