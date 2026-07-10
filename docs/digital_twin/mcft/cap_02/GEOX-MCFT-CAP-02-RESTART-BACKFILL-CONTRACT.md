<!-- docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-RESTART-BACKFILL-CONTRACT.md -->
<!-- Purpose: freeze restart/resume and bounded forward-backfill semantics for MCFT-CAP-02. -->

# GEOX MCFT-CAP-02 Restart and Backfill Contract V1

## 1. Identity

~~~yaml
contract_id: GEOX-MCFT-CAP-02-RESTART-BACKFILL-CONTRACT-V1
capability_line_id: MCFT-CAP-02
display_alias: MCFT-2
delivery_slice_id: MCFT-CAP-02.MCFT-04.RESTART-BACKFILL-V1
primary_owner_work_package_id: MCFT-04
contributing_work_package_ids:
  - MCFT-03
  - MCFT-08
runtime_mode: REPLAY
baseline_main_commit: af798ecdffd1d85e9caa9472d465433c20da9957
predecessor_slice_id: MCFT-CAP-02.MCFT-04-08.TWENTY-FOUR-TICK-RANGE-V1
predecessor_merge_commit: ebf637fcafaee58dc1e72bc366e8591881257863
predecessor_verified_main_commit: af798ecdffd1d85e9caa9472d465433c20da9957
~~~

## 2. Established predecessor proof

~~~text
24-tick positive acceptance: 9 PASS, 0 FAIL
24-tick negative acceptance: 13 PASS, 0 FAIL
24-tick PostgreSQL acceptance: 8 PASS, 0 FAIL
24-tick final Gate: 68 PASS, 0 FAIL
server typecheck: PASS
server build: PASS
exact-head CI #4559: SUCCESS
~~~

## 3. Single execution path

The only range execution core is:

~~~text
runContiguousContinuationRangeV1()
~~~

The following operator intents must all reuse that range core and the existing verified single-tick transaction path:

~~~text
single-tick
range
resume
backfill
~~~

Restart/Backfill must not:

~~~text
implement a second tick loop
implement a second persistence path
write canonical facts directly
bypass operation idempotency
bypass fencing or CAS
recompute committed history
create a second active lineage
~~~

## 4. Required persisted handoff APIs

The slice must provide:

~~~text
prepareNextTickInputV1()
resumeFromCheckpointV1()
runBoundedBackfillV1()
~~~

`prepareNextTickInputV1()` must reconstruct its result only from one PostgreSQL repeatable-read snapshot.

The snapshot must contain:

~~~text
active lineage canonical object
active semantic lineage ID
revision ID
latest checkpoint
latest posterior State
last terminal runtime tick
pinned continuation Runtime Config
Reality Binding snapshot
next logical tick time
State computation basis
~~~

No in-memory State from a previous process may be accepted as restart authority.

## 5. Checkpoint consistency

The persisted snapshot must satisfy:

~~~text
checkpoint.last_posterior_state_ref
==
latest State.object_id
~~~

~~~text
checkpoint.last_completed_tick_ref
==
last terminal tick.object_id
~~~

~~~text
checkpoint.lineage_id
==
State.lineage_id
==
terminal tick.lineage_id
==
active lineage.lineage_id
~~~

~~~text
checkpoint.revision_id
==
State.revision_id
==
terminal tick.revision_id
==
active lineage.revision_id
~~~

~~~text
checkpoint.logical_time
==
terminal tick.logical_time
~~~

~~~text
checkpoint.next_tick_logical_time
==
terminal tick.logical_time + PT1H
~~~

The continuation State must contain a valid persisted computation basis.

Any mismatch must fail with:

~~~text
CHECKPOINT_PROJECTION_DIVERGENCE
~~~

Restart must not silently repair projections. Projection repair remains an explicit rebuild operation outside this slice.

## 6. Standard restart case

The uninterrupted reference run is:

~~~text
first continuation tick:
2026-06-01T02:00:00.000Z

last continuation tick:
2026-06-02T01:00:00.000Z

continuation tick count:
24
~~~

The restart proof is split as follows:

~~~text
process 1:
ticks 1 through 12

process 1 final logical time:
2026-06-01T13:00:00.000Z

persisted checkpoint sequence:
12

persisted next logical tick:
2026-06-01T14:00:00.000Z

process 1:
terminates completely
~~~

A new operating-system process must then execute:

~~~text
process 2:
ticks 13 through 24

resume target:
2026-06-02T01:00:00.000Z
~~~

Process 2 must construct fresh:

~~~text
PostgreSQL connection pool
repositories
handoff service
tick service
range service
restart service
Replay Evidence adapter
~~~

Process 2 must not receive:

~~~text
an in-memory State object
an in-memory checkpoint
a serialized service instance
a cached handoff DTO from process 1
~~~

## 7. Restart equivalence

The split-process restart run must exactly match the uninterrupted run for:

~~~text
ordered continuation operation keys
ordered record-set IDs
ordered record-set determinism hashes
all eight canonical object IDs per tick
all eight canonical determinism hashes per tick
final State object ID and hash
final checkpoint object ID and hash
final BLOCKED Forecast object ID and hash
final Runtime Health object ID and hash
final persisted T+1 handoff
~~~

The standard final values remain:

~~~text
logical time:
2026-06-02T01:00:00.000Z

storage mean:
56.788512 mm

storage variance:
247.020977062500 mm²

VWC mean:
0.189295

VWC variance:
0.002745

available-water fraction:
0.384972

depletion:
33.211488 mm

checkpoint sequence:
24

next logical tick:
2026-06-02T02:00:00.000Z
~~~

## 8. Bounded forward backfill

Backfill means only:

~~~text
operator-requested missed-schedule catch-up
starting from persisted checkpoint.next_tick_logical_time
~~~

Backfill rules:

~~~text
forward only
contiguous only
hour-aligned only
maximum 24 ticks per invocation
stop on first failure
each tick commits independently
same pinned continuation Runtime Config
same active lineage and revision
same single-tick transaction path
~~~

Backfill must not:

~~~text
run before bootstrap exists
skip an hour
write a later hour before an earlier hour
recompute an already committed hour
create a revision lineage
treat late Evidence as forward backfill
use current wall-clock time as logical time
~~~

Required reason codes include:

~~~text
BACKFILL_BEFORE_BOOTSTRAP
LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN
CONTINUATION_RANGE_TARGET_NOT_CANONICAL_HOUR
CONTINUATION_RANGE_MAX_TICKS_EXCEEDED
CHECKPOINT_PROJECTION_DIVERGENCE
~~~

An already-completed target returns an idempotent no-write result.

## 9. Runtime runner

The slice must deliver:

~~~text
apps/server/scripts/mcft/MCFT_CAP_02_HOURLY_DYNAMICS_RUNNER.ts
~~~

Required modes:

~~~text
--mode single-tick --logical-time <ISO>
--mode range --to <ISO>
--mode resume --to <ISO>
--mode backfill --to <ISO>
~~~

The runner must:

~~~text
require an explicit DATABASE_URL
require an explicit mode
require explicit Replay operator intent
use the persisted checkpoint
use the pinned Runtime Config
print machine-readable JSON
exit non-zero on failure
~~~

The runner must not provide:

~~~text
a public HTTP write route
a browser State-write path
a scheduler
a daemon
implicit wall-clock logical time
~~~

## 10. Acceptance boundary

Positive acceptance must prove:

~~~text
ticks 1–12 commit
process 1 exits
a new process resumes ticks 13–24
ticks 1–12 are not executed again
restart uses the existing range and single-tick paths
split-process hashes equal uninterrupted hashes
bounded backfill reaches the same final State and hashes
completed-target retry writes nothing
~~~

Negative acceptance must include:

~~~text
missing bootstrap
missing checkpoint
missing latest State
missing terminal tick
checkpoint/State divergence
checkpoint/tick divergence
lineage mismatch
revision mismatch
invalid computation basis
non-hour-aligned target
backfill skips an hour
backfill exceeds 24 ticks
late Evidence presented as forward backfill
second active lineage attempt
~~~

## 11. Preserved nonclaims

Until merged-main verification succeeds:

~~~text
NO_RESTART_RESUME_PROOF
NO_BOUNDED_BACKFILL_PROOF
~~~

This slice also preserves:

~~~text
NO_OBSERVATION_UPDATE_APPLIED
NO_OBSERVATION_INNOVATION_COMPUTED
NO_FORECAST_RESIDUAL
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_DECISION
NO_AO_ACT
NO_CALIBRATED_CONFIDENCE_MODEL
NO_MODEL_ACTIVATION
NO_LATE_EVIDENCE_REVISION
NO_DYNAMIC_ROOT_ZONE_GEOMETRY
NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_720_TICK_REPLAY_CLOSURE
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
NO_MCFT_CAP_02_COMPLETE_CLAIM
~~~
