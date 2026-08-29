# GEOX MCFT-CAP-09 HANDOFF — 2026-08-20 — AMENDMENT-19 FRESH-V3 EXACT-HEAD QUALIFICATION FRONTIER

> **HANDOFF / CONVERSATION CONTEXT TRANSPORT ONLY — NOT REPOSITORY AUTHORITY**
>
> 本文用于把 MCFT-CAP-09 当前真实工程前沿完整交给下一对话。它不是 Taskbook、Amendment、machine authority、protected `main`、GitHub live run 或 Neon live state 的替代品。
>
> 若本文与以下任一事实冲突：Digital Twin Master Task Line、MCFT-CAP-09 Taskbook、有效 Amendment / machine authority JSON、当前 Delivery Policy / ruleset、protected `main`、exact live GitHub run/artifact、Neon live state，则 **本文失效，以上游事实为准**。
>
> 本文明确 supersede 2026-08-19 的旧 handoff transport（PR #3217）。旧 handoff 停留在 `530b8577...` 的 rehydration blocker；该 frontier 已经被后续真实 persistent execution、多个 deterministic contract repair 和 fresh-v3 qualification store 重建显著推进。

---

## 0. Handoff identity

```text
handoff_date:
2026-08-20

repository:
liyongshang44-max/GEOX

capability:
MCFT-CAP-09

master_task_line:
docs/digital_twin/master/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

protected_main_at_handoff:
cf6bf3e69f2d7f40e7586308f4d846b3350efb1c

protected_main_tree:
521c7b299b0fa27d44854e5ef36516bb36c00c12

protected_main_last_merge:
PR #3229
MCFT-CAP-09: repair Amendment-19 persisted forcing readback

current_frontier:
WAITING_FOR_FRESH_CF6BF3_EXACT_HEAD_ROLLING_AND_V3_PERSISTENT_REQUALIFICATION

current_known_deterministic_code_blocker:
NONE FOUND AFTER EXACT-HEAD STATIC EXECUTION-GRAPH AUDIT

current_machine_graduation_pass:
false

future_formal_epoch_selected:
false

formal_o00_started:
false

stage_1b_formal_closure:
false

mcft_cap09_completed:
false
```

Current protected `main` must be treated as frozen while the fresh exact-head rolling/persistent qualification is pending:

```text
cf6bf3e69f2d7f40e7586308f4d846b3350efb1c
```

Do not resume from:

```text
530b857765da471a442727daee9687206059e5c4
35e82c8c37dea81ed26a286071c8d120f9324316
fc7241de6f8f11705b35c92feaa75caf91abb15e
```

Those SHAs are important historical evidence subjects, but are not the current qualification subject.

---

# 1. Executive summary — what we are actually doing

MCFT-CAP-09 is in the final S6 / Stage-1B qualification-and-graduation line of the agricultural digital twin.

The objective is no longer to invent the runtime architecture. The current architecture is already frozen around Amendment-19:

```text
provider publication cadence
        !=
runtime scheduler cadence
```

The runtime must advance hourly without waiting for a future KBS publication batch. At each logical boundary T it uses either:

```text
Mode A:
complete exact provider interval pair available causally by T
→ EXACT_PROVIDER_INTERVAL_PAIR
→ HEALTHY
```

or:

```text
Mode B:
complete exact pair not available by T
→ prior-step causal GFS weather + ET0 assumption pair
→ PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
→ ASSUMED / DEGRADED
```

The development strategy is also already frozen:

```text
same canonical core, persistence-free 24T
        ↓
same production execution graph, accelerated boundary clock only
        ↓
13 machine statuses PASS + static_blocker_count=0
        ↓
freeze exact implementation subject
        ↓
future real Formal epoch
        ↓
24 actual UTC hourly boundaries O00–O23
        ↓
Stage-1B closure
```

The accelerated run is **qualification**, not a substitute for the final real 24-hour Formal run.

The major progress since the previous handoff is substantial:

```text
old rehydration mismatch
        ↓
unchanged producer-bound rehydration replay PASS
        ↓
first real production persistent graph reached
        ↓
facts schema helper drift found and fixed
        ↓
real 900s DB bootstrap lease reached
        ↓
blocked-no-causal-forcing production scenario executed correctly
        ↓
stale checkpoint pseudo-contract found and fixed
        ↓
Formal graduation machine wiring added
        ↓
restart checkpoint pseudo-contract found and fixed before expensive rerun
        ↓
fresh exact-head rolling candidate on fc724 produced
        ↓
rehydration PASS
        ↓
blocked proof PASS
        ↓
main O00 production tick entered
        ↓
persisted forcing readback contract drift found
        ↓
#3229 fixed nested canonical readback
        ↓
new protected main cf6bf3
        ↓
fresh v3 qualification stores provisioned and still zero-state
```

Therefore the current frontier is **not**:

```text
rehydration semantic hash debugging
facts schema debugging
blocked proof debugging
checkpoint tick_sequence debugging
KBS daily-batch research
Formal epoch execution
```

The current frontier is:

```text
obtain a fresh rolling candidate on exact main cf6bf3...
        ↓
run fresh Amendment-19 persistent production-graph qualification
against fresh qualification stores v3
```

At handoff time there is no known deterministic static blocker remaining, but that is not equivalent to a machine qualification PASS.

---

# 2. Authority order — do not invert this

Use this order whenever two pieces of evidence disagree:

```text
1. Digital Twin Master Task Line
2. MCFT-CAP-09 Taskbook
3. Effective Amendment / machine authority JSON
4. Delivery Policy / main ruleset / governed registry rules
5. Protected main exact SHA
6. Exact live GitHub run / job / artifact
7. Exact Neon live database state
8. This handoff
```

At minimum, the Amendment-19 line requires reading:

```text
docs/digital_twin/master/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-*.md/json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-CADENCE-DECOUPLING.md

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-CADENCE-DECOUPLING-AUTHORITY-V1.json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE.md

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE-V1.json
```

Do not promote a handoff sentence, issue description, PR body or debugging note above a frozen authority.

---

# 3. Current protected main and source-control topology

## 3.1 Protected main

```text
main:
cf6bf3e69f2d7f40e7586308f4d846b3350efb1c

tree:
521c7b299b0fa27d44854e5ef36516bb36c00c12

merge time:
2026-08-19T17:02:23Z

merge source:
PR #3229
```

PR #3229 repaired the Amendment-19 persisted forcing readback contract and rolled the failed qualification stores from v2 to fresh v3 identities.

## 3.2 Why current main must stay frozen

Qualification authority is exact-subject sensitive.

A rolling candidate produced under SHA S0 cannot be silently rebound to a later protected main S1.

Likewise, persistent qualification evidence produced by S0 cannot qualify S1 merely because the diff appears unrelated.

The legal rule is:

```text
producer subject SHA
=
consumer checkout SHA
=
current protected main SHA
```

where required by the exact-head workflow chain.

Any main drift now creates a new qualification subject and requires a fresh rolling candidate and fresh qualification-store execution.

## 3.3 Historical main subjects that still matter as evidence

```text
530b857765da471a442727daee9687206059e5c4
old handoff/replay/facts-schema frontier

35e82c8c37dea81ed26a286071c8d120f9324316
first true persistent blocked-lane execution

fc7241de6f8f11705b35c92feaa75caf91abb15e
first persistent run to pass blocked proof and enter main O00

cf6bf3e69f2d7f40e7586308f4d846b3350efb1c
CURRENT qualification subject
```

Do not confuse historical usefulness with current authority transferability.

---

# 4. What MCFT-CAP-09 still must prove before completion

The final Taskbook closure remains a true wall-clock 24-hour Shadow-online graduation.

Amendment-19 did not delete that requirement.

The final run must prove properties that an accelerated test cannot fully prove:

```text
24 actual UTC hourly boundaries
real GitHub/runner scheduling over >24h
long-lived persistent database/state survival
real provider availability movement
real network jitter
real process restart/retry timing
cross-24h checkpoint continuity
no future leakage over real time
no duplicate canonical terminal work
no retroactive State rewrite
```

The engineering lane exists to prevent the real 24h window from being used as a debugging loop.

Correct lifecycle:

```text
static audit
→ persistence-free canonical 24T
→ persistent production-graph accelerated 24T
→ fault matrix
→ machine gate
→ real 24h graduation once
```

Wrong lifecycle:

```text
wait 24h
→ discover deterministic bug
→ patch
→ wait another 24h
→ discover another deterministic bug
→ repeat
```

This conversation explicitly changed working discipline toward static execution-graph auditing before each expensive live qualification.

---

# 5. Amendment-19 forcing semantics — frozen boundary

For logical tick T, current process forcing represents:

```text
(T-1h, T]
```

## 5.1 Mode A

If exact provider rainfall and exact historical ET0 for the same interval are both causally available by T:

```text
mode = EXACT_PROVIDER_INTERVAL_PAIR
health = HEALTHY
```

The pair must retain all existing evidence constraints:

```text
same authorized source family
exact interval identity
real availability chronology
real ingestion chronology
quality checks
raw-retention-first
no future leakage
no interpolation
no source substitution
no timestamp relabel
```

## 5.2 Mode B

If the exact provider pair is incomplete at T:

```text
mode = PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
health = DEGRADED
epistemic class = ASSUMED
```

The pair comes from the prior-step causal GFS future-weather and future-ET0 assumptions already available before the boundary.

Mode B is not:

```text
fake observation
persistence fill
source substitution
historical rewrite
provider timestamp relabel
```

## 5.3 Partial exact pair

One exact family alone must not be mixed with one assumed family.

Expected:

```text
rainfall exact only + ET0 missing
→ whole Mode B

ET0 exact only + rainfall missing
→ whole Mode B
```

## 5.4 Late exact evidence

Late exact evidence may enter append-forward under real chronology.

It must not rewrite an already terminal historical State/checkpoint/tick.

---

# 6. Provider cadence is not runtime cadence

KBS Raw Hourly historically showed a daily-batch operating profile, but this is descriptive provider behavior, not scheduler authority.

Amendment-19 freezes the separation:

```text
PROVIDER_AVAILABILITY_WATERMARK_V1
=
Evidence admission authority

NOT
=
Runtime scheduler eligibility authority
```

The historical `<=6h` value remains diagnostic only.

Never reintroduce:

```text
authority_pass = age <= 6h
```

Do not invent a replacement 24h or 36h freshness authority either.

---

# 7. KBS publication anomaly #3220 — monitoring only

Issue #3220 remains open as provider-profile monitoring debt.

Observed snapshot around:

```text
2026-08-19T02:16:51Z
```

showed:

```text
previous explicitly recorded latest:
2026-08-17T04:00:00Z

new latest:
2026-08-18T21:00:00Z

forward hourly events:
41

missing hours:
0

duplicate / row-variant conflict:
0

disappearance observed:
0
```

Snapshot digest:

```text
sha256:0cda1baf00cc2192f8bcb7c1ede504f0d13af846e2698057c68b77200f5201f3
```

Latest-row identity hash:

```text
sha256:3e14de2b0bee0afc9524ee91d05fb0fd966f000002e8bf562bd99edf4a3a4a52
```

This is insufficient to amend temporal authority.

Re-adjudication requires repeated independently bracketed first-seen transitions, not one anomalous tail.

Current mainline qualification must not drift because of #3220.

---

# 8. Accelerated qualification hard constraint — same implementation

The accelerated lane must not become “another code path that happens to pass tests.”

Canonical production-facing core:

```text
apps/server/src/runtime/twin_runtime/external_formal_amendment19_canonical_tick_core_v1.ts
```

Canonical symbol:

```text
executeExternalFormalAmendment19CanonicalTickV1
```

The persistence-free first knife calls this core directly.

The production persistent service also calls this exact core.

The shared semantic chain includes:

```text
current-interval forcing selection
→ State propagation
→ assimilation
→ future-forcing selection
→ Forecast
→ canonical A1/A2 record construction
```

Forbidden:

```text
simplified engineering State runner
simplified engineering Forecast runner
parallel test-only forcing selector
in-memory substitute for persistent production graph
```

---

# 9. Persistent second knife — production graph except boundary wait

Production persistent service:

```text
apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts
```

Production runner:

```text
apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.ts
```

Production scheduler remains:

```text
PostgresPersistentSequentialSchedulerAdapterV1
```

Persistent accelerated qualification must reuse:

```text
same schema
same runtime config chain
same persistence repositories
same scheduler
same slot ledger
same lease/fencing
same runner
same persistent tick service
same health path
same checkpoint path
same lineage path
same canonical record builders
```

Only this may be replaced:

```text
wait until the next PT1H boundary
```

Lease and fencing continue to use real DB transaction time.

---

# 10. The real 900-second bootstrap lease is intentional

A0 bootstrap acquires the real production lease.

Qualification constant:

```text
LEASE_SECONDS = 900
```

The bootstrap phase intentionally waits for this lease to expire naturally before the next production-style claim.

This is not a random GitHub Actions delay.

Historical run #32234990562 proved the timing precisely:

```text
bootstrap-main acquired:
2026-08-19T08:56:39.698993Z

bootstrap-main expires:
2026-08-19T09:11:39.698993Z

blocked run-id owner acquired:
2026-08-19T09:11:40.924882Z

delta after expiry:
~1.226s
```

Therefore do not interpret the first ~15 minutes without an `am19-p24-<RUN_ID>` owner as a stall.

The owner-state sequence is meaningful machine observability:

```text
am19-p24-bootstrap-main
am19-p24-bootstrap-blocked
        ↓ real 900s DB lease expiry
am19-p24-blocked-<GITHUB_RUN_ID>
        ↓ blocked proof PASS
am19-p24-<GITHUB_RUN_ID>
        ↓ main 24T
```

---

# 11. Graduation machine gate — exact required statuses

A future Formal epoch may not be armed until all required statuses are terminal PASS:

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

Human judgement cannot replace this gate with:

```text
"looks good enough"
```

At the current `cf6bf3...` subject, these persistent graduation statuses are **not yet claimed**.

---

# 12. Persistence-free first knife — completed

PR #3209 established:

```text
PERSISTENCE_FREE_24T = PASS
```

The proof chains 24 sequential logical ticks through the same canonical core.

It proved:

```text
24 canonical ticks
23 Mode B ASSUMED/DEGRADED ticks
1 Mode A HEALTHY tick
rainfall-only partial pair → Mode B
ET0-only partial pair → Mode B
late exact does not rewrite prior canonical outputs
missing causal assumption pair blocks without provider wait
zero DB/provider/scheduler side effects
```

This remains a valid repository engineering proof.

It does not by itself grant the persistent graduation statuses for current exact head.

---

# 13. Production persistent Amendment-19 cutover — completed

PR #3210 introduced the production successor path.

Key facts:

```text
DB Evidence source freezes evidence at selected logical slot T

soil + future weather + future ET0 are required causal inputs

exact rainfall + historical ET0 are optional at boundary

persistent service calls same Amendment-19 canonical core

runner uses production scheduler/claim/fence/terminalization

Mode B terminal health remains DEGRADED

missing causal forcing terminalizes blocked/failed without provider wait
```

Old Amendment-11 fixed-lag execution surfaces remain historical/regression surfaces, not the new Amendment-19 production path.

---

# 14. V3 runtime-config chain and accelerated scheduler seam — completed

PR #3211 parameterized successor V3 A0/O00–O23 config-chain construction away from the failed historical epoch constants.

PR #3212 added the only authorized accelerated clock seam.

The scheduler still owns:

```text
cursor
slot ledger
claim
fencing token
oldest-first missed-slot selection
terminal CAS
```

No test scheduler was introduced.

---

# 15. Persistent 24T orchestration — completed as implementation

PR #3213 added the persistent qualification driver/workflow.

Workflow:

```text
.github/workflows/mcft-cap-09-amendment19-persistent-24t-qualification.yml
```

Live flow:

```text
successful rolling workflow_run
→ exact triggering head SHA
→ exact triggering run ID
→ exact rolling artifact only
→ persistence-free reproof
→ producer-bound retained-raw rehydration
→ production persistent qualification
→ machine result artifact
```

It does not search a mutable “latest candidate”.

This exact trigger binding is important because rolling runs can overlap or queue across main changes.

---

# 16. Old rehydration semantic mismatch — no longer current blocker

Old protected main:

```text
530b857765da471a442727daee9687206059e5c4
```

Rolling producer:

```text
run 32210446530
artifact 9351658033
target 2026-08-19T04:00:00Z
```

Persistent run:

```text
32213857092
job 95951578934
```

First failure:

```text
MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

This initially looked like a producer/consumer semantic reconstruction blocker.

A diagnostic path observed replay sensitivity, including an ET0-family mismatch in one reproduction.

Crucially, an unchanged rerun against the same producer-bound evidence later passed rehydration.

Therefore the old handoff #3217 correctly froze that issue as the frontier at its time, but that is not the current frontier anymore.

Do not restart the next conversation by reopening this old mismatch unless a new current-head run reproduces it.

---

# 17. First true production persistent graph entry exposed a facts schema helper drift

Once producer-bound rehydration passed, the persistent graph encountered:

```text
column "ingested_at" of relation "facts" does not exist
```

This was a qualification helper contract drift, not a production schema defect.

Production facts contract is:

```text
fact_id
occurred_at
source
record_json
```

Causal ingestion chronology remains inside canonical JSON:

```text
record_json.payload.role_time.ingested_at
```

PR #3219 repaired both direct qualification seed helpers:

```text
copyRealFacts()
insertFixture()
```

to use the production four-column schema.

Protected main after that merge:

```text
35e82c8c37dea81ed26a286071c8d120f9324316
```

Do not ever “fix” this by adding a table-level `facts.ingested_at` column to the frozen production schema.

---

# 18. First remote persistent qualification — run 32234990562

Exact subject:

```text
35e82c8c37dea81ed26a286071c8d120f9324316
```

Run:

```text
32234990562
```

Job:

```text
96012839632
```

Event:

```text
workflow_run
```

Started:

```text
2026-08-19T08:55:23Z
```

Conclusion:

```text
FAILURE
```

Persistent artifact:

```text
artifact id:
9359080571

name:
mcft-cap09-am19-persistent24-35e82c8c37dea81ed26a286071c8d120f9324316-32234990562

digest:
sha256:6f95d6b6bdaa4c6e0667644dee072343a1bf8f2e9f678fb6eb210fe8b1edda25
```

This run had already proven important progress:

```text
exact-head trigger path reached
persistence-free 24T passed
producer-bound rehydration passed
remote Neon bootstrap entered
real bootstrap lease created
blocked-fault production graph executed
```

First substantive harness failure:

```text
AM19_P24_BLOCKED_NO_CAUSAL_FORCING_PROOF_REQUIRED
```

The scenario itself was later proven correct by Neon.

---

# 19. Failed qualification v1 databases — immutable audit evidence

## 19.1 Main v1

Database:

```text
geox_mcft_cap09_s6_accel24t_am19_v1
```

Verified audit snapshot:

```text
facts = 113
leases = 1
slots = 0
terminal_ticks = 0
checkpoints = 1
state_history = 1
runtime_configs = 25
```

Lease:

```text
lease_owner = am19-p24-bootstrap-main
fencing_token = 1
acquired_at = 2026-08-19T08:56:39.698993Z
expires_at = 2026-08-19T09:11:39.698993Z
```

Main v1 never switched to `am19-p24-32234990562` because blocked proof was evaluated first and the stale harness assertion aborted the run.

## 19.2 Blocked v1

Database:

```text
geox_mcft_cap09_s6_accel24t_am19_blocked_v1
```

Audit snapshot:

```text
facts = 38
slots = 1
terminal_ticks = 0
checkpoints = 1
state_history = 1
runtime_configs = 25
```

Lease:

```text
lease_owner = am19-p24-blocked-32234990562
fencing_token = 2
acquired_at = 2026-08-19T09:11:40.924882Z
heartbeat_at = 2026-08-19T09:11:42.404175Z
```

O00 scheduler row:

```text
logical_time = 2026-08-19T10:00:00Z
state = FAILED
health_ref = MCFT_CAP09_EXTERNAL_FORMAL_V3_AM19_RUNNER_V1:O00:BLOCKED_NO_CAUSAL_FORCING
terminal tick uniqueness rows = 0
```

This is the expected blocked-no-causal-forcing shape.

A blocked slot does not need to fabricate a successful canonical terminal tick.

Both v1 stores are permanently audit-only.

---

# 20. Stale checkpoint pseudo-contract — root cause and repair #3223

The blocked scenario itself worked.

The qualification harness incorrectly required:

```text
Number(snapshot.checkpoint.payload.tick_sequence) !== 0
```

But production `PersistedNextTickSnapshotV1` does not persist or validate a `payload.tick_sequence` field as checkpoint authority.

Production checkpoint authority is built around fields such as:

```text
checkpoint kind
logical_time
next_tick_logical_time
state/forecast/terminal refs
runtime-config binding
```

PR #3223:

```text
MCFT-CAP-09: align AM19 blocked proof with persisted checkpoint contract
```

merged to:

```text
ac8ab3d8f6ea07d682facc9d59a6fd5b41b2ff22
```

It repaired:

```text
blocked A0 proof
final full-readback proof
```

and moved qualification from failed v1 stores to fresh v2 stores.

Do not restore `tick_sequence` as checkpoint authority.

---

# 21. Graduation wiring gap #3221 — discovered and closed by #3222

Issue #3221 identified a deterministic post-qualification governance seam.

Persistent qualification emits statuses under:

```text
machine_statuses
```

while the Formal graduation preflight consumes a normalized top-level machine-gate shape plus proof that engineering and production use the same canonical core/graph.

Before #3222 there was no evidence-faithful assembler and no live wiring from persistent PASS to the existing Formal graduation preflight.

PR #3222 added:

```text
scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_GRADUATION_INPUT_V1.cjs

.github/workflows/mcft-cap-09-amendment19-formal-graduation-wiring.yml
```

Merged main:

```text
e083b6c88c44851cf0ddc1bba1dd38bb884d8608
```

Issue #3221 is closed.

The assembler fail-closes unless one exact subject proves:

```text
fresh persistent PASS
all 13 machine statuses PASS
static_blocker_count=0
PROVIDER_AVAILABILITY_WATERMARK_V1 preserved
same canonical core
production scheduler reuse
production repository reuse
production lease/fencing reuse
production runner reuse
production persistent tick service reuse
zero runtime provider/R2 requests
blocked-no-assumption proof
persistence-free 24T proof
producer-bound rehydration identity proof
production cutover proof
no premature Formal effects
```

The graduation workflow then invokes the existing Formal preflight unchanged.

It does **not** start Formal.

---

# 22. Restart pseudo-contract — found by static audit before expensive rerun

After #3223, whole-runner static execution-graph audit found a third stale pseudo-contract:

```text
restartSnapshot.checkpoint.payload.tick_sequence === 6
```

This would have deterministically failed after six successful ticks even if the production graph was healthy.

PR #3224 replaced it with the actual persisted O05→O06 closure:

```text
checkpoint.logical_time = O05
checkpoint.next_tick_logical_time = O06
previous posterior logical_time = O05
previous forecast logical_time = O05
last terminal tick logical_time = O05
checkpoint refs close to those exact objects
runtime-config binding = exact O05 manifest pin
```

PR:

```text
#3224 — MCFT-CAP-09: align restart proof with persisted checkpoint contract
```

Merged protected main:

```text
fc7241de6f8f11705b35c92feaa75caf91abb15e
```

Whole runner audit then found:

```text
remaining .checkpoint.payload.tick_sequence references = 0
```

This is an important process lesson: static-audit the entire future execution graph before paying another live qualification window.

---

# 23. Exact-head rolling candidate on fc724 — run 32264854033

A fresh rolling candidate was successfully produced on exact protected main:

```text
fc7241de6f8f11705b35c92feaa75caf91abb15e
```

Rolling run:

```text
32264854033
```

Live job started around:

```text
2026-08-19T14:51:38Z
```

Planner execution:

```text
2026-08-19T14:52:07.557Z
```

Selected target:

```text
T = 2026-08-19T16:00:00Z
```

Operational pre-boundary target:

```text
T-30m = 2026-08-19T15:30:00Z
```

Authorized soil window:

```text
2026-08-19T15:45:00Z
→
2026-08-19T16:00:00Z
```

Provider phase PASS:

```text
2026-08-19T15:55:22Z
```

Causal soil observation used:

```text
2026-08-19T15:45:00Z
```

Same-cycle GFS identity:

```text
20260819T060000Z cycle
```

Candidate semantic manifest digest:

```text
sha256:3ce4f8e4a8d2a113c895362389247858e59ed000b1a64fa2828e9e283212b978
```

Rolling artifact:

```text
artifact id:
9372851111

name:
mcft-cap09-rolling-preboundary-20260819t160000z-fc7241de6f8f11705b35c92feaa75caf91abb15e

zip digest:
9b2254f0489a96180d9325a08815509ec95c9cae3da406c5b7d68d252412483b
```

This candidate is valuable historical proof but cannot qualify current `cf6bf3...` after #3229 changed protected main.

---

# 24. Persistent run 32272928666 — deepest successful path before #3229

Persistent qualification:

```text
run_id:
32272928666

job_id:
96133446359

triggering rolling run:
32264854033

subject:
fc7241de6f8f11705b35c92feaa75caf91abb15e

started:
2026-08-19T15:55:29Z

completed:
2026-08-19T16:12:11Z

conclusion:
FAILURE
```

Artifact:

```text
artifact id:
9373462832

name:
mcft-cap09-am19-persistent24-fc7241de6f8f11705b35c92feaa75caf91abb15e-32272928666

digest:
sha256:974616500da62ce03d893d07a1dfceb0872f55253573bb5ab0b36c5aa9c98862
```

This run passed more of the production qualification chain than every earlier attempt:

```text
exact protected-main gate
persistence-free canonical 24T
producer-bound retained-raw rehydration
schema/environment preconditions
both real 900s bootstrap leases
blocked-no-causal-forcing production scenario
```

It then entered the main production graph and attempted O00.

First substantive main-lane failure:

```text
AM19_P24_MAIN_RUNNER_UNEXPECTED:
FAILED_TERMINAL_RECORDED:
EXTERNAL_FORMAL_V3_AM19_PERSISTED_FORCING_MODE_REQUIRED
```

This failure is the direct predecessor to #3228/#3229.

---

# 25. Failed qualification v2 databases — immutable audit evidence

Both v2 stores were consumed by run `32272928666` and are permanently audit-only.

## 25.1 Main v2

```text
geox_mcft_cap09_s6_accel24t_am19_v2
```

Verified read-only snapshot:

```text
facts = 121
leases = 1
slots = 1
terminal_ticks = 1
checkpoints = 1
state_history = 2
runtime_configs = 25
```

Lease:

```text
lease_owner = am19-p24-32272928666
fencing_token = 2
acquired_at = 2026-08-19T16:12:02.908597Z
heartbeat_at = 2026-08-19T16:12:05.009673Z
expires_at = 2026-08-19T16:12:05.009673Z
```

O00 scheduler row:

```text
logical_time = 2026-08-19T17:00:00Z
state = FAILED
health_ref = MCFT_CAP09_EXTERNAL_FORMAL_V3_AM19_RUNNER_V1:O00:FAILED
```

The database contains one correctly persisted Mode-B evidence window at the canonical nested forcing path.

This proves the canonical write happened before the readback failure.

## 25.2 Blocked v2

```text
geox_mcft_cap09_s6_accel24t_am19_blocked_v2
```

Verified snapshot:

```text
facts = 38
leases = 1
slots = 1
terminal_ticks = 0
checkpoints = 1
state_history = 1
runtime_configs = 25
```

Lease:

```text
lease_owner = am19-p24-blocked-32272928666
fencing_token = 2
acquired_at = 2026-08-19T16:12:02.046754Z
heartbeat_at = 2026-08-19T16:12:02.452125Z
```

O00 scheduler row:

```text
logical_time = 2026-08-19T17:00:00Z
state = FAILED
health_ref = MCFT_CAP09_EXTERNAL_FORMAL_V3_AM19_RUNNER_V1:O00:BLOCKED_NO_CAUSAL_FORCING
terminal_ticks = 0
```

This proves #3223 fixed the blocked proof correctly.

Do not reset, truncate, delete or reuse either v2 database.

---

# 26. Persisted forcing readback bug #3228 — exact root cause

The O00 canonical `twin_evidence_window_v1` persisted the forcing mode correctly under:

```text
payload.base_continuation_window.current_interval_forcing.mode
```

Actual value at O00:

```text
PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
```

But two readback helpers still looked at the superseded top-level path:

```text
payload.current_interval_forcing.mode
```

Affected logic included:

```text
forcing mode readback
persisted health derivation
qualification final Mode A/B SQL readback
```

Therefore a correct canonical write was rejected after persistence.

Classification:

```text
DETERMINISTIC PERSISTED READBACK CONTRACT DRIFT
```

Not:

```text
provider failure
rehydration failure
runtime-config failure
canonical-core write failure
scheduler failure
lease failure
```

Issue #3228 captured this evidence and is now closed.

---

# 27. PR #3229 — current protected-main repair

PR:

```text
#3229
MCFT-CAP-09: repair Amendment-19 persisted forcing readback
```

Merged:

```text
2026-08-19T17:02:24Z
```

Current main:

```text
cf6bf3e69f2d7f40e7586308f4d846b3350efb1c
```

Changed files:

```text
.github/workflows/mcft-cap-09-amendment19-persisted-forcing-readback.yml

apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts

scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_19_PERSISTED_FORCING_READBACK_V1.cjs

scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts
```

Repair boundary:

```text
read canonical nested forcing path
one parser drives mode + health interpretation
qualification runtime proof uses same shape
final SQL Mode A/B readback uses same shape
failed v2 store names replaced by fresh v3 store names
cheap regression gate rejects old top-level shape and v2 reuse
```

No change to:

```text
provider semantics
canonical evidence-window shape
scheduler semantics
lease/fencing semantics
checkpoint schema
Formal authority
```

A real v2 readback replay after the repair proved:

```text
old path non-null count = 0
new nested Mode-B match = 1
```

The additional null forcing window is the A0 bootstrap evidence window and is expected.

---

# 28. Current fresh v3 accelerated qualification stores

Neon project:

```text
delicate-glade-62464340
```

Neon branch:

```text
br-cold-dust-a6j6aymz
```

Main qualification DB:

```text
geox_mcft_cap09_s6_accel24t_am19_v3
```

Blocked-fault DB:

```text
geox_mcft_cap09_s6_accel24t_am19_blocked_v3
```

Frozen schema fingerprints:

```text
column fingerprint:
873a8e86f55d75a04a5f671627e98ae1

constraint fingerprint:
7803f7e7706e52eca3ca2aa4290ff5dd

index fingerprint:
ea5b3ba0392fd52fb471bc754e94ed35
```

Required relation count:

```text
26
```

Latest read-only main-v3 snapshot at handoff:

```text
db_now = 2026-08-19T17:43:52.754Z
facts = 0
leases = 0
slots = 0
terminal_ticks = 0
checkpoints = 0
state_history = 0
runtime_configs = 0
```

Latest blocked-v3 snapshot:

```text
db_now = 2026-08-19T17:44:08.850Z
facts = 0
leases = 0
slots = 0
terminal_ticks = 0
checkpoints = 0
state_history = 0
runtime_configs = 0
```

Therefore:

```text
fresh v3 qualification stores are still strict zero-state
```

They have not yet been consumed by a current `cf6bf3...` persistent production-graph run.

---

# 29. Pristine Formal v3 store — still untouched

Formal store:

```text
geox_mcft_cap09_s6_formal_t3r1_24h_v3
```

Latest read-only snapshot:

```text
db_now = 2026-08-19T17:47:38.324Z
facts = 0
leases = 0
slots = 0
terminal_ticks = 0
checkpoints = 0
state_history = 0
```

This store remains reserved for the future real Formal epoch.

Do not use it for accelerated qualification.

Do not clone failed qualification state into it.

---

# 30. Current exact frontier — why zero-state is not a failure

After #3229, protected main changed from:

```text
fc7241de...
```

to:

```text
cf6bf3e6...
```

Therefore the fc724 rolling candidate and run `32272928666` cannot be reused to qualify cf6.

A fresh exact-head rolling candidate is mandatory.

Current rolling workflow has serial concurrency:

```text
mcft-cap09-rolling-preboundary-live-main
cancel-in-progress: false
```

It performs the exact-main check at live-capture entry, then may continue through dependency install, planner wait and provider capture without rechecking protected main during the wait.

Therefore an older-SHA rolling run that passed its exact-main check before #3229 merged may legitimately occupy the serial live slot for a while.

Its eventual old-SHA candidate cannot contaminate current qualification because downstream persistent `workflow_run` performs its own exact-current-main gate.

Thus current v3 zero-state means:

```text
CURRENT FRESH-HEAD PERSISTENT REMOTE GRAPH HAS NOT ENTERED THE STORES YET
```

It does **not** yet mean:

```text
qualification failed
workflow deadlocked
provider broken
```

---

# 31. Rolling target planner timing — do not guess target T from cron minute

Rolling planner uses:

```text
MIN_TARGET_LEAD_MINUTES = 35
```

It selects the next canonical hour after `now + 35m`.

Therefore cron time is not equal to target identity.

Rules:

```text
provider pre-boundary target = T-30m
soil authorized window = [T-15m, T]
evidence deadline = T
candidate retention = 36h
```

A delayed GitHub runner can cause a later target hour to be selected.

Do not say “17:05 cron means T=18:00” without reading actual planner output.

---

# 32. Current static execution-graph audit — what was checked

Before waiting on the next expensive live qualification, the current main path was audited for deterministic successor failures.

Checked areas include:

```text
protected main exact subject
same canonical-core import/call
persistent service forcing readback shape
checkpoint readback pseudo-contracts
restart O05→O06 closure
blocked A0 closure
final O23 readback
scheduler lease/fencing continuity
oldest-first backfill sequence
Mode A/B sequence
partial pair sequence
late-exact no-rewrite sequence
idempotent no-duplicate invocation sequence
artifact naming producer→graduation
triggering run binding
graduation assembler field compatibility
Formal graduation preflight inputs
absence of old v2 DB hardcode in graduation wiring
absence of old epoch/SHA constant in the final machine gate
```

No new deterministic static blocker was found after #3229.

Important wording:

```text
"no known deterministic static blocker found"
```

is **not** the same claim as:

```text
machine static_blocker_count = 0
```

Only the authoritative persistent machine result may make the latter graduation claim.

---

# 33. Expected current v3 lease-state transitions

Once current-head persistent execution actually enters Neon, first expected markers are:

```text
main:
am19-p24-bootstrap-main
fencing_token = 1

blocked:
am19-p24-bootstrap-blocked
fencing_token = 1
```

After real 900s expiry:

```text
blocked:
am19-p24-blocked-<GITHUB_RUN_ID>
likely fencing_token = 2
```

If blocked proof passes:

```text
main:
am19-p24-<GITHUB_RUN_ID>
likely fencing_token >= 2
```

This is the most reliable current run-discovery mechanism when general Actions listing is unavailable.

---

# 34. GitHub run-discovery tooling limitation — do not guess run IDs

The current GitHub connector can inspect a known workflow-run ID, jobs, logs and artifacts.

It does not expose a reliable general scheduled/workflow_run listing filtered by current `head_sha`.

A direct attempt to query the generic Actions runs collection through the connector was rejected as unsupported.

Therefore do not invent or numerically extrapolate run IDs.

Approved practical method:

```text
1. read Neon current v3 stores
2. detect lease owner transition
3. extract <GITHUB_RUN_ID> from owner
4. fetch exact GitHub run by that ID
5. fetch exact jobs/logs/artifacts
```

This method is evidence-faithful and does not rely on notification email behavior.

---

# 35. Current conservative machine-gate status

At current protected main `cf6bf3...`:

| Gate | Current status | Meaning |
|---|---|---|
| `PERSISTENCE_FREE_24T` | **PASS as repository engineering proof** | same canonical core 24T already frozen |
| `PERSISTENT_24T` | **NOT YET CLAIMED on cf6** | fresh v3 stores untouched |
| `O00_WARM_START` | **NOT YET CLAIMED on cf6** | new current-head rolling candidate not yet consumed |
| `MODE_A` | **NOT YET CLAIMED on cf6 persistent graduation** | prior engineering proof is not current persistent PASS |
| `MODE_B` | **NOT YET CLAIMED on cf6 persistent graduation** | fc724 O00 wrote Mode B but failed and cannot transfer |
| `PARTIAL_PAIR` | **NOT YET CLAIMED on cf6 persistent graduation** | scenario implementation exists |
| `LATE_EXACT_NO_REWRITE` | **NOT YET CLAIMED on cf6 persistent graduation** | scenario implementation exists |
| `RESTART` | **NOT YET CLAIMED** | static contract repaired; live v3 not run |
| `MISSED_SLOT_BACKFILL` | **NOT YET CLAIMED** | scenario implementation exists |
| `IDEMPOTENCY` | **NOT YET CLAIMED** | scenario implementation exists; see #3226 debt |
| `ZERO_PROVIDER_WAIT` | **NOT YET CLAIMED on cf6 persistent graduation** | architecture frozen, fresh machine result absent |
| `SCHEMA_ENV_PREFLIGHT` | **PRECONDITION VERIFIED, machine status not yet emitted for cf6 run** | v3 stores match frozen schema and are zero-state |
| `FULL_CHAIN_READBACK` | **NOT YET CLAIMED** | no current-head 24T chain exists |

Do not aggregate these into a current graduation PASS.

---

# 36. Formal graduation wiring — now implemented but deliberately non-executing

Current path after a successful persistent result is:

```text
persistent 24T workflow SUCCESS
        ↓
exact triggering run artifact only
        ↓
production-cutover proof regenerated on exact checkout
        ↓
Amendment-19 graduation input assembler
        ↓
existing Formal epoch graduation preflight
        ↓
formal_epoch_creation_gate = OPEN
```

At the same time the proof requires:

```text
future_formal_epoch_selected = false
formal_o00_started = false
mcft_cap09_completed = false
final_actual_24h_still_required = true
```

So:

```text
GATE OPEN
!=
FORMAL STARTED
```

This distinction must survive the next conversation.

---

# 37. Deterministic post-gate successor gap #3225 — still open

Issue:

```text
#3225
MCFT-CAP-09: wire Amendment-19 graduation to fresh-v3 Formal launcher
```

Static post-gate audit found that the existing old live Formal launcher path is not legal for the Amendment-19 current frontier.

Reasons include:

```text
old pre-runtime hardening live subject pinned to historical cd2056...
old workflow binds failed Formal _v2 DB
old A18C manifest belongs to failed/expired 2026-08-17 v2 epoch
old future-epoch candidate is not a current future epoch
```

Therefore a successor is required after accelerated graduation.

But **do not merge a #3225 implementation now while current exact-head qualification is pending.**

Any such merge would change protected main and invalidate the current qualification subject.

---

# 38. Off-main successor design #3227 — prepared, not authority

Draft PR:

```text
#3227
docs(mcft-cap09): design fresh-v3 Formal successor for #3225
```

Branch:

```text
docs/mcft-cap09-3225-fresh-v3-formal-successor-design
```

Head:

```text
8ac42a65f87ac498a1dc7ea213d71250696f4745
```

It contains two design documents only.

No runtime/workflow/schema/DB/provider/Formal code change.

Important: #3227 was based on `fc7241de...`; current main is now `cf6bf3...` after #3229.

Therefore #3227 is useful design context but must not be blindly merged.

Current user constraint:

```text
keep #3225/#3227 off-main during current qualification
user decides whether/when successor implementation merges
```

---

# 39. Fresh-v3 Formal successor design — frozen intent

The eventual #3225 successor must use the Amendment-19 production path, not resurrect the old Amendment-11/A18C fixed-epoch runner chain.

Target production path:

```text
ExternalFormalV3Amendment19RunnerV1
ExternalFormalV3Amendment19PersistentTickServiceV1
executeExternalFormalAmendment19CanonicalTickV1
PostgresExternalFormalAmendment19EvidenceSourceV1
PostgresPersistentSequentialSchedulerAdapterV1
production runtime/next-tick/recovery repositories
real DB lease/fencing
ExternalFormalBootstrapPersistenceServiceV1
fresh Formal v3 DB
```

The accelerated and real Formal lanes should share one Amendment-19 window manifest builder rather than duplicate manifest semantics.

Tentative design symbol:

```text
buildExternalFormalAmendment19WindowManifestV1
```

This extraction itself changes production/qualification code and therefore, once merged in the future, will require a full new exact-head accelerated qualification on fresh stores.

---

# 40. Future Formal arm model — do not select epoch by post-gate code commit

Preferred successor design:

```text
exact-head accelerated gate OPEN
        ↓
next successful same-subject rolling preboundary candidate
        ↓
immutable FORMAL_ARM artifact
```

The arm should bind:

```text
exact protected subject SHA
graduation gate digest
rolling run/artifact identity
candidate target_t
future A0/O00/O23
timing/expiry
fresh Formal v3 DB identity
manifest/hash
A0 + 24 config refs/hashes
no O00 effect
```

Proposed operational arm lead:

```text
MIN_FORMAL_ARM_TO_O00_LEAD_MINUTES = 35
```

This is an operational scheduling guard for preboundary capture, not a new temporal-evidence authority.

Do not create a post-gate Git commit merely to freeze the epoch; that would create another exact-head drift.

---

# 41. Final Formal requires a separate durable provider ingress lane

The Amendment-19 runtime runner is intentionally DB-only.

It performs zero provider/R2 runtime calls.

Therefore the final real Formal 24h needs an independent durable provider ingress path before each exact T.

Existing production ingress contract:

```text
PostgresExternalFormalEvidenceIngressV1
```

already enforces:

```text
source profile
raw-retention-first
private retained-raw verification
scope/binding
no replay/debug authority
conflict fail-closed
append-only facts
idempotency
```

Final runtime then consumes the already-ingested causal DB evidence.

If a required preboundary causal family was not durably ingested by exact T:

```text
expired_preboundary_causal_gap
→ terminal NO-GO
```

A later ingestion must not retroactively rescue the historical exact boundary.

---

# 42. Exact-head consequence of future #3225 implementation

Suppose current `cf6bf3...` qualification passes.

That proves the current implementation subject.

If later #3225 implementation merges to new protected SHA S1:

```text
cf6 qualification evidence
cannot automatically transfer to S1
```

Legal sequence:

```text
1. current cf6 qualification terminal evidence
2. review one bounded #3225 implementation change
3. merge once to successor SHA S1
4. freeze S1
5. provision NEW fresh accelerated qualification stores
6. fresh S1 rolling candidate
7. S1 rehydration
8. S1 persistence-free proof
9. S1 persistent production-graph 24T
10. all 13 PASS + blocker=0 on S1
11. only S1 may arm Formal
```

Goal: one future main drift, not a chain of tiny post-gate commits.

---

# 43. Nonblocking audit debt #3226

Issue:

```text
#3226
MCFT-CAP-09: tighten Amendment-19 repeat-run and idempotency proof semantics
```

This is deliberately below the current fresh qualification priority.

## 43.1 Repeat-run graduation false-red

Persistent workflow may return:

```text
ALREADY_QUALIFIED_READ_ONLY
```

for a later unchanged audit-only reverify after a successful first qualification.

Graduation assembler currently expects fresh:

```text
PASS
```

Therefore a later read-only reverify could produce a downstream red even though no new qualification claim should be made.

This does not block the first fresh qualification because current v3 stores are zero-state.

## 43.2 Idempotency proof semantic narrowness

Authority scenario name:

```text
SAME_SLOT_REEXECUTION_IDEMPOTENT_NO_DUPLICATE_CANONICAL_WORK
```

Current runner proves scheduler-level duplicate invocation suppression:

```text
O07/O08 oldest-first backfill
→ invoke through O08 again after cursor advanced
→ NO_DUE_SLOT
→ work footprint unchanged
```

This proves no duplicate work at scheduler level, but does not literally re-enter persistence for an already terminal claimed slot.

Do not fail the current qualification solely because of this audit note.

Before final closure, adjudicate whether terminal scheduler suppression is sufficient or add a controlled persistence-path same-slot replay.

If #3225 implementation can close #3226 without widening semantics, bundle it into the same future main drift.

---

# 44. Current immediate next-step plan — exact order

## Step 1 — freeze current main

Require:

```text
protected main = cf6bf3e69f2d7f40e7586308f4d846b3350efb1c
```

Do not merge #3227 or unrelated work into main.

## Step 2 — monitor current fresh v3 stores read-only

Watch:

```text
geox_mcft_cap09_s6_accel24t_am19_v3
geox_mcft_cap09_s6_accel24t_am19_blocked_v3
```

Initial expected state remains all zero.

## Step 3 — wait for exact-head rolling producer to finish

Require rolling candidate producer SHA exactly:

```text
cf6bf3e69f2d7f40e7586308f4d846b3350efb1c
```

Do not reuse fc724 rolling artifact.

## Step 4 — detect persistent remote entry via bootstrap lease

Expected first v3 rows:

```text
am19-p24-bootstrap-main
am19-p24-bootstrap-blocked
```

Record:

```text
acquired_at
expires_at
fencing_token
```

## Step 5 — wait real bootstrap lease expiry

Do not shorten 900s lease.

After expiry, read blocked owner and extract exact `GITHUB_RUN_ID`.

## Step 6 — inspect exact GitHub run

Once run ID is known, fetch:

```text
run metadata
job ID
step conclusions
logs
artifact ID/name/digest
```

Do not guess.

## Step 7 — if blocked proof passes, verify main owner transition

Expected:

```text
am19-p24-<RUN_ID>
```

This marks main 24T production graph execution.

## Step 8 — if failure occurs, identify the first substantive failure only

Do not patch downstream errors before the first real failure is understood.

Static-audit the remainder of the graph before preparing another expensive rerun.

## Step 9 — failed physical v3 store handling

If either v3 store gains meaningful qualification writes and the overall fresh qualification fails:

```text
v3 becomes audit-only
```

Do not reset it.

After an actual repair, create fresh:

```text
..._v4
..._blocked_v4
```

and rerun on the new exact protected main.

## Step 10 — if persistent run passes, require exact machine result

Require:

```text
13/13 required statuses = PASS
static_blocker_count = 0
human override = false
```

## Step 11 — verify graduation wiring

Require exact triggering persistent artifact → assembler → Formal machine gate.

Expected:

```text
formal_epoch_creation_gate = OPEN
future_formal_epoch_selected = false
formal_o00_started = false
mcft_cap09_completed = false
```

## Step 12 — stop before Formal

Do not start Formal automatically.

User has not authorized the current conversation to start the final Formal epoch.

## Step 13 — separately adjudicate #3225 implementation

Only after current qualification evidence is terminal should protected-main successor implementation be considered.

---

# 45. What is explicitly NOT the current task

Do not expand current work into:

```text
new crop-source research
new KBS cadence amendment
new provider source family
95h GFS redesign
new scheduler implementation
new persistence architecture
new checkpoint schema
new health subsystem
old failed Formal epoch recovery
v2 database repair/reuse
Formal O00 start
```

Do not merge #3227 merely because its design is mature.

Current task is narrower:

```text
fresh current-head rolling
→ fresh v3 persistent production-graph qualification
→ machine graduation gate evidence
```

---

# 46. Formal nonclaims at this handoff

The following statements are false and must remain false until new evidence proves them:

```text
MCFT-CAP-09 is complete
Stage-1B is closed
PERSISTENT_24T = PASS on cf6bf3
all 13 machine statuses are PASS on cf6bf3
static_blocker_count=0 has been machine-emitted on cf6bf3
future Formal epoch has been selected
Formal O00 has started
real 24h graduation has passed
```

True statements:

```text
PERSISTENCE_FREE_24T repository proof exists and is PASS
production Amendment-19 persistent graph exists on main
blocked-no-causal-forcing production behavior was proven in failed historical runs
fc724 run reached real main O00 before deterministic readback failure
#3229 repaired that deterministic readback contract
fresh v3 qualification stores are currently zero-state
Formal v3 is pristine
current main is cf6bf3
```

---

# 47. PR / issue evolution essential for the next owner

## #3206 — fresh Formal v3 store qualification

Closed the fresh Formal store/schema blocker after the failed old Formal epoch.

## #3207 — Amendment-19 cadence decoupling

Separated provider publication cadence from hourly runtime cadence.

## #3208 — accelerated graduation gate

Froze same-core/same-production-graph constraints and the 13 machine statuses.

## #3209 — persistence-free 24T

Established `PERSISTENCE_FREE_24T = PASS`.

## #3210 — production persistent cutover

Bound persistent production path to Amendment-19 canonical core.

## #3211 — parameterized successor config chain

Removed failed-v2 hardcoded epoch/config dependency.

## #3212 — scheduler accelerated boundary-clock seam

Allowed only boundary wait acceleration; real lease/fencing preserved.

## #3213 — persistent 24T driver/workflow

Created exact-triggering rolling → rehydration → production persistent qualification chain.

## #3215 — T3R1 credential seed normalization

Clarified stable DB URL secret as credential seed, not runtime DB authority.

## #3217 — old handoff

Docs-only handoff at `530b857...`; now stale and superseded by this handoff.

## #3219 — facts seed alignment

Fixed stale qualification-only table-level `ingested_at` writes.

## #3220 — KBS publication anomaly tracking

Monitoring only; no current authority change.

## #3221 — graduation wiring gap

Static governance blocker discovered; now closed by #3222.

## #3222 — persistent PASS → Formal machine-gate wiring

Evidence-faithful assembler and live graduation wiring added.

## #3223 — blocked/final checkpoint contract repair

Removed stale checkpoint `tick_sequence` pseudo-contract and moved v1→v2 stores.

## #3224 — restart checkpoint contract repair

Removed third `tick_sequence` pseudo-contract before expensive rerun.

## #3225 — fresh-v3 Formal successor wiring

Open deterministic post-gate successor issue; keep off-main during current qualification.

## #3226 — repeat-run/idempotency audit debt

Open, nonblocking to first fresh qualification.

## #3227 — off-main fresh-v3 Formal successor design

Draft docs-only design; do not merge now.

## #3228 — persisted forcing readback contract

Closed deterministic O00 failure found by run 32272928666.

## #3229 — persisted forcing readback repair

Merged and produced current protected main `cf6bf3...`; qualification stores rolled v2→v3.

---

# 48. Pitfalls already encountered — do not repeat

## Pitfall 1 — provider cadence as scheduler cadence

Wrong:

```text
hourly runtime waits for future KBS exact-T
```

Correct:

```text
Mode A if exact pair causal by T
else Mode B causal prior-step assumptions
```

## Pitfall 2 — turning `<=6h` back into authority

`<=6h` is diagnostic only.

## Pitfall 3 — creating a simplified accelerated implementation

Engineering qualification must use the same canonical core and production graph.

## Pitfall 4 — accelerating lease/fencing

Only boundary wait may be accelerated.

## Pitfall 5 — using Formal v3 for accelerated writes

Never.

## Pitfall 6 — resetting a failed qualification DB

A consumed failed physical DB is audit-only forever.

## Pitfall 7 — trusting `pg_stat` estimates for zero-state

Use strict `COUNT(*)` on governed relations.

## Pitfall 8 — ad-hoc schema fingerprint relation lists

Use the exact frozen 26-relation contract and exact authority serialization.

## Pitfall 9 — reconstructing frozen Formal schema by running all current migrations

Newer is not necessarily equal to the frozen Formal contract.

Catalog equality wins.

## Pitfall 10 — recovering old raw data without original provenance

No original chronology means no causal authority.

## Pitfall 11 — mapping rolling target directly to O00

Correct mapping:

```text
A0 = rolling candidate target_t
O00 = A0 + 1h
```

## Pitfall 12 — relabeling GFS horizons

Do not treat H2/H3 as a newly captured H1.

## Pitfall 13 — reusing A0 soil for all accelerated ticks

Soil freshness semantics prohibit this.

## Pitfall 14 — hard-coding crop MID to make qualification pass

Use the real materializer and fail closed if the candidate is not admissible.

## Pitfall 15 — treating every old red workflow as a current blocker

Read the first failing step and classify lifecycle applicability first.

## Pitfall 16 — ignoring governed dependency graph digest drift

If a governed entry changes, recompute and prove graph closure before rebinding.

## Pitfall 17 — treating connection URL pathname as authority

The connection secret may be a credential seed. Actual connected database identity and schema are independently verified.

## Pitfall 18 — weakening rehydration semantic equality

Do not compare subsets or approximate equality to make replay pass.

## Pitfall 19 — speculative chronology fix before proving divergent field

Instrument first; fix the actual contract drift.

## Pitfall 20 — no email means success

Notification behavior is not authority.

## Pitfall 21 — guessing scheduled run IDs

Never guess run IDs.

## Pitfall 22 — creating Formal epoch before machine gate

Forbidden.

---

# 49. New pitfalls discovered after old #3217 handoff

## Pitfall 23 — adding `facts.ingested_at` to production schema

The bug was in qualification helper inserts, not schema.

Production facts table remains four-column canonical contract.

## Pitfall 24 — using `checkpoint.payload.tick_sequence` as persistence authority

Three stale pseudo-contracts were found:

```text
blocked proof
final full readback
restart proof
```

All were wrong.

Use actual persisted logical time / next tick / pointer closure / config binding.

## Pitfall 25 — reading persisted forcing from the old top-level path

Correct canonical location:

```text
payload.base_continuation_window.current_interval_forcing
```

Not:

```text
payload.current_interval_forcing
```

## Pitfall 26 — requiring a successful terminal tick for an intentionally blocked scenario

Blocked-no-causal-forcing expected shape includes:

```text
scheduler slot FAILED
health BLOCKED_NO_CAUSAL_FORCING
terminal tick uniqueness = 0
```

## Pitfall 27 — treating the 900s lease as unexplained CI silence

It is an intentional production lease/fencing proof.

## Pitfall 28 — expecting main run-id lease owner before blocked proof

Execution order is blocked proof first, main 24T second.

## Pitfall 29 — transferring qualification authority across a merge

Any protected-main change invalidates exact-head candidate reuse.

## Pitfall 30 — fixing PR-only stale predecessor gates while live path is healthy

A PR static workflow may contain an old construction-time predecessor guard and red before runtime.

Do not widen main solely to make such a non-authoritative PR-only path green unless it blocks actual delivery policy or live qualification.

## Pitfall 31 — interpreting graduation gate OPEN as Formal execution

Gate opening deliberately requires no Formal start side effect.

## Pitfall 32 — merging #3225 successor while current qualification is pending

That would invalidate the exact subject being qualified.

## Pitfall 33 — calling static audit blocker count a machine result

Static audit can say “no known deterministic blockers found”; only the machine result may say `static_blocker_count=0` for graduation.

## Pitfall 34 — assuming a serial rolling cron run immediately uses current main

Older already-admitted runs can occupy the serial live concurrency slot.

Downstream exact-head checks make them harmless but they can delay current-head execution.

## Pitfall 35 — declaring fresh v3 qualification stalled while stores are still zero before persistent entry

Zero-state alone is not failure evidence.

## Pitfall 36 — allowing `ALREADY_QUALIFIED_READ_ONLY` to create a new graduation claim

See #3226. Audit-only reverify must not pretend to be fresh qualification evidence.

---

# 50. Suggested first checks in the next conversation

Do these first, in order:

```text
1. fetch protected main
2. require main == cf6bf3... unless a known later merge is explicitly explained
3. read both accelerated v3 DBs
4. read Formal v3 DB
5. if bootstrap lease exists, capture timestamps
6. if run-id owner exists, extract exact run ID
7. fetch exact run/jobs/logs/artifacts
8. classify the first substantive live failure or PASS
```

If main has moved from `cf6bf3...`:

```text
STOP treating this handoff frontier as the execution subject
→ inspect the merge(s)
→ determine why main moved
→ re-evaluate exact-head qualification state
```

Do not begin with KBS cadence research.

Do not begin with a new Formal epoch.

Do not begin by editing #3227 into main.

---

# 51. Evidence ledger — key references that must survive conversation handoff

```text
CURRENT PROTECTED MAIN
cf6bf3e69f2d7f40e7586308f4d846b3350efb1c

CURRENT MAIN TREE
521c7b299b0fa27d44854e5ef36516bb36c00c12

CURRENT MAIN MERGE
PR #3229

HISTORICAL FIRST TRUE PERSISTENT RUN
32234990562

HISTORICAL FIRST TRUE PERSISTENT JOB
96012839632

HISTORICAL V1 ARTIFACT
9359080571

HISTORICAL V1 ARTIFACT DIGEST
sha256:6f95d6b6bdaa4c6e0667644dee072343a1bf8f2e9f678fb6eb210fe8b1edda25

FC724 ROLLING PRODUCER RUN
32264854033

FC724 ROLLING TARGET
2026-08-19T16:00:00Z

FC724 ROLLING ARTIFACT
9372851111

FC724 ROLLING ARTIFACT DIGEST
9b2254f0489a96180d9325a08815509ec95c9cae3da406c5b7d68d252412483b

FC724 PERSISTENT RUN
32272928666

FC724 PERSISTENT JOB
96133446359

FC724 PERSISTENT ARTIFACT
9373462832

FC724 PERSISTENT ARTIFACT DIGEST
sha256:974616500da62ce03d893d07a1dfceb0872f55253573bb5ab0b36c5aa9c98862

FC724 FIRST MAIN FAILURE
EXTERNAL_FORMAL_V3_AM19_PERSISTED_FORCING_MODE_REQUIRED

FAILED QUALIFICATION DB V1 MAIN
geox_mcft_cap09_s6_accel24t_am19_v1

FAILED QUALIFICATION DB V1 BLOCKED
geox_mcft_cap09_s6_accel24t_am19_blocked_v1

FAILED QUALIFICATION DB V2 MAIN
geox_mcft_cap09_s6_accel24t_am19_v2

FAILED QUALIFICATION DB V2 BLOCKED
geox_mcft_cap09_s6_accel24t_am19_blocked_v2

CURRENT FRESH QUALIFICATION DB V3 MAIN
geox_mcft_cap09_s6_accel24t_am19_v3

CURRENT FRESH QUALIFICATION DB V3 BLOCKED
geox_mcft_cap09_s6_accel24t_am19_blocked_v3

CURRENT PRISTINE FORMAL DB
geox_mcft_cap09_s6_formal_t3r1_24h_v3

NEON PROJECT
delicate-glade-62464340

NEON BRANCH
br-cold-dust-a6j6aymz

FROZEN COLUMN FINGERPRINT
873a8e86f55d75a04a5f671627e98ae1

FROZEN CONSTRAINT FINGERPRINT
7803f7e7706e52eca3ca2aa4290ff5dd

FROZEN INDEX FINGERPRINT
ea5b3ba0392fd52fb471bc754e94ed35

OPEN POST-GATE ISSUE
#3225

OFF-MAIN SUCCESSOR DESIGN
#3227 @ 8ac42a65f87ac498a1dc7ea213d71250696f4745

NONBLOCKING AUDIT DEBT
#3226

KBS MONITORING ISSUE
#3220
```

---

# 52. Definition of the next meaningful milestone

The next meaningful milestone is not another static green PR.

It is:

```text
fresh exact-head cf6 rolling candidate
        ↓
producer-bound rehydration PASS
        ↓
persistence-free reproof PASS
        ↓
v3 remote bootstrap lease appears
        ↓
blocked proof PASS
        ↓
main run-id lease owner appears
        ↓
main O00 succeeds past the #3229 readback seam
```

The first successful main O00 on fresh v3 is especially valuable because it proves the last deterministic forcing-readback repair in the real persistent graph.

After that, continue through the already-audited O01–O23 scenario matrix rather than reopening architecture.

---

# 53. Definition of the next failure milestone

If the next fresh current-head persistent run fails, record **before changing code**:

```text
protected subject SHA
rolling run ID
rolling target/artifact ID/digest
persistent run ID
job ID
artifact ID/digest
v3 main/blocked DB row counts
lease owner/fencing/timestamps
first scheduler slot state
first terminal health/tick ref
checkpoint logical/next time
first substantive error message
```

Then static-audit every downstream use of the same contract before another merge.

Do not fix only the first textual occurrence if the same stale assumption appears again later in the runner.

This lesson came directly from the three separate `tick_sequence` pseudo-contracts.

---

# 54. Definition of MCFT-CAP-09 completion from here

Remaining legal path:

```text
fresh current-head rolling
        ↓
current-head persistent 24T production graph PASS
        ↓
all 13 machine statuses PASS
        ↓
static_blocker_count = 0
        ↓
Formal machine creation gate OPEN
        ↓
(no Formal side effect yet)
        ↓
future successor implementation/arm on one frozen exact head
        ↓
if implementation changes main: fresh full accelerated requalification on that head
        ↓
select/arm genuinely future Formal epoch
        ↓
A0 durable causal ingress + bootstrap
        ↓
real O00–O23 on 24 actual UTC boundaries
        ↓
full real readback / no-leakage / restart-retry evidence
        ↓
Stage-1B closure evidence
        ↓
MCFT-CAP-09 finalization under Taskbook authority
```

Until the real 24-boundary run passes, MCFT-CAP-09 is not complete.

---

# 55. Why the project is now in a materially better state than the old handoff

The previous handoff stopped before remote production persistence could even be trusted.

Since then we have real evidence for progressively deeper layers:

```text
rehydration can pass producer-bound retained evidence

production facts schema boundary was exercised

real Neon bootstrap was exercised

real DB lease TTL was exercised

real fencing token transition was exercised

blocked no-causal-forcing behavior was exercised

real production scheduler slot terminalization was exercised

main O00 canonical State/evidence persistence was reached

real persisted canonical evidence shape was inspected

readback drift was isolated and repaired

graduation gate wiring was built before declaring qualification done
```

This is no longer an architecture-prototyping problem.

It is now a controlled exact-head production-qualification problem.

---

# 56. Final handoff statement

The next owner should not return to broad MCFT-9 discovery.

The architecture is sufficiently frozen to proceed narrowly.

Current protected subject:

```text
cf6bf3e69f2d7f40e7586308f4d846b3350efb1c
```

Current fresh qualification stores:

```text
geox_mcft_cap09_s6_accel24t_am19_v3
geox_mcft_cap09_s6_accel24t_am19_blocked_v3
```

Current live state at handoff:

```text
both fresh qualification stores = strict zero-state
Formal v3 = strict zero-state
no current-head persistent machine PASS yet
no future Formal epoch
no Formal O00
```

Current correct frontier:

```text
WAIT FOR / IDENTIFY FRESH EXACT-HEAD ROLLING ON cf6bf3
        ↓
RUN FRESH V3 PERSISTENT PRODUCTION-GRAPH QUALIFICATION
```

Do not broaden scope unless the next real machine failure proves a new blocker.

Do not weaken the machine gate.

Do not reset failed DBs.

Do not merge the off-main Formal successor during the current exact-head qualification.

Do not start Formal merely because the accelerated gate eventually opens.

The final wall-clock 24-hour graduation remains mandatory.