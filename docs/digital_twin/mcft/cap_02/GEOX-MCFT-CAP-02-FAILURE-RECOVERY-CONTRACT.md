<!-- docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-FAILURE-RECOVERY-CONTRACT.md -->
# GEOX MCFT-CAP-02 Failure Recovery Contract

contract_identity:

~~~text
GEOX-MCFT-CAP-02-FAILURE-RECOVERY-CONTRACT-V1
~~~

delivery_slice_id:

~~~text
MCFT-CAP-02.FAILURE-RECOVERY-V1
~~~

capability_line_id:

~~~text
MCFT-CAP-02
~~~

display_alias:

~~~text
MCFT-2
~~~

runtime_mode:

~~~text
REPLAY
~~~

baseline_main_commit:

~~~text
3166e9fb301f86499c82dce3590cfb6f5db15173
~~~

branch:

~~~text
mcft-cap-02-failure-recovery-v1
~~~

dependency:

~~~text
MCFT-CAP-02.MCFT-04.RESTART-BACKFILL-V1
RESTART_BACKFILL_MERGED_MAIN_VERIFIED
~~~

## 1. Purpose

This slice consolidates cross-layer failure and recovery proof for the existing MCFT-CAP-02 Runtime.

It does not establish a second Runtime path, a second persistence family, a scheduler, an HTTP write route, or a new model.

The default implementation posture is:

~~~text
acceptance and governance only
no production Runtime source change
no database migration
no route
no web change
no workflow change
~~~

If consolidated acceptance exposes a real production defect, the exact changed-file boundary must be amended before any source fix is committed.

## 2. Required failure classes

The slice must prove all ten taskbook classes:

~~~text
1. fault injection
2. stale fencing
3. CAS conflict
4. missing ET0
5. missing rainfall
6. duplicate conflict
7. invalid config
8. mass-balance violation
9. idempotent crash retry
10. projection divergence
~~~

## 3. Existing proof surfaces

The consolidated Gate must reuse and independently verify the already merged proof surfaces.

### 3.1 Persistence and transaction recovery

Existing PostgreSQL acceptance proves:

~~~text
fifteen transaction fault stages roll back
stale fencing rejects before A2 writes
lease owner mismatch rejects
expired lease rejects
checkpoint CAS conflict rejects
State latest CAS conflict rejects
Forecast result CAS conflict rejects
active lineage and revision mismatch reject
same key and same hash returns existing success
same key and different hash returns IDEMPOTENCY_CONFLICT
projection rebuild restores five continuation projections
guard-loss canonical uniqueness prevents a second terminal tick
~~~

### 3.2 Evidence and configuration failure

Existing acceptance proves:

~~~text
missing exact-hour rainfall rejects
missing exact-hour ET0 rejects
conflicting duplicate Evidence rejects
invalid pinned Runtime Config rejects
wrong Reality Binding rejects
wrong crop-stage context rejects
~~~

### 3.3 Dynamics invariant failure

Existing pure-domain acceptance proves:

~~~text
conflicting execution duplicate rejects
invalid water and geometry inputs reject
mass-balance tamper rejects
trace self-hash rejects
uncertainty invariant violations reject
~~~

### 3.4 Restart projection divergence

Existing restart acceptance proves:

~~~text
missing terminal tick rejects
checkpoint-to-State divergence rejects
checkpoint-to-terminal-tick divergence rejects
lineage divergence rejects
revision divergence rejects
Runtime does not silently repair projection divergence
~~~

## 4. Consolidated crash-retry proof

The Failure Recovery PostgreSQL acceptance must add a process-boundary proof.

### 4.1 Pre-commit crash

~~~text
ticks 1 through 12 are committed
tick 13 is attempted
fault is injected before commit
the process terminates nonzero
tick 13 has zero A2 canonical append
tick 13 has zero A2 projection write
checkpoint remains at tick 12
latest State remains at tick 12
latest Forecast result remains at tick 12
active lineage remains unchanged
a fresh process retries tick 13
tick 13 commits exactly once
range continues only after tick 13 succeeds
~~~

### 4.2 Post-commit response loss

~~~text
tick N commits atomically
the caller receives no success response
a fresh process retries the same operation key and hash
existing canonical success is returned
no new lease is acquired
fencing token does not increase
facts do not increase
projections do not increase
object IDs remain identical
determinism hashes remain identical
~~~

## 5. Projection divergence and explicit repair

Projection divergence must fail closed.

~~~text
restart reads inconsistent checkpoint or latest projection
restart returns CHECKPOINT_PROJECTION_DIVERGENCE
zero current-tick A2 append
zero current-tick projection write
zero lease acquisition
no silent repair
~~~

Repair is allowed only through the explicit projection rebuild procedure.

The acceptance sequence must prove:

~~~text
1. canonical facts and A2 guard remain intact
2. a projection is deliberately removed or corrupted
3. restart refuses to continue
4. explicit rebuild is invoked
5. rebuilt projections match canonical facts
6. restart handoff becomes valid
7. continuation resumes through the existing single-tick path
~~~

## 6. Stop-on-first-failure invariant

For a bounded range where tick 13 fails:

~~~text
ticks 1 through 12 remain committed
tick 13 has zero A2 partial writes
ticks 14 through target do not run
checkpoint remains at tick 12
State latest remains at tick 12
Forecast result latest remains at tick 12
active lineage remains unchanged
~~~

Each tick remains an independent database transaction.

## 7. Negative fixture metadata

Every Failure Recovery fixture must include:

~~~yaml
fixture_id:
failure_class:
expected_reason_code:
expected_stage:
expected_no_current_tick_a2_append:
expected_no_current_tick_projection_write:
expected_checkpoint_unchanged:
expected_state_latest_unchanged:
expected_forecast_result_latest_unchanged:
expected_active_lineage_unchanged:
optional_f_audit_allowed:
existing_proof_source:
consolidated_proof_required:
~~~

## 8. Exact changed-file boundary

Exactly these six files are authorized:

~~~text
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-FAILURE-RECOVERY-CONTRACT.md
fixtures/mcft/water_state/negative/MCFT_CAP_02_FAILURE_RECOVERY_FIXTURES.json
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY_DB.ts
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.cjs
~~~

Forbidden unless the boundary is formally amended first:

~~~text
apps/server/src/**
apps/server/db/migrations/**
apps/server/src/routes/**
apps/web/**
.github/workflows/**
existing canonical fixture bytes
existing Runtime acceptance semantics
~~~

## 9. Allowed claims during implementation

Before PR merge and merged-main verification, only these claims are allowed:

~~~text
FAILURE_RECOVERY_CONTRACT_FROZEN
FAILURE_RECOVERY_ACCEPTANCE_SLICE_ACTIVE
EXISTING_RUNTIME_RECOVERY_SURFACE_AUDITED
~~~

The following remains prohibited:

~~~text
FAILURE_RECOVERY_SLICE_COMPLETE
MCFT_CAP_02_COMPLETE
MCFT_GATE_A_CLOSURE
MCFT_GATE_B_CLOSURE
MCFT_GATE_C_CLOSURE
MINIMUM_COMPLETE_FIELD_TWIN
CONTINUOUS_RUNTIME
CONTINUOUS_SCHEDULER
LIVE_FIELD_RUNTIME
~~~

## 10. Completion condition

The slice may become READY_FOR_MERGE only when:

~~~text
all ten failure classes have executable consolidated proof
pre-commit crash retry is proven across process boundary
post-commit response-loss retry is idempotent
stop-on-first-failure is proven
projection divergence refuses silent repair
explicit rebuild restores canonical-equivalent projections
all negative fixtures preserve zero current-tick partial writes
server typecheck passes
server build passes
git diff --check passes
exact-head CI succeeds
PostgreSQL acceptance passes on an isolated database
exact changed-file boundary remains six files
~~~

The slice becomes effective only after:

~~~text
PR merged to main
merged-main Failure Recovery Gate passes
RESTART_BACKFILL_MERGED_MAIN_VERIFIED remains recorded
CLOSURE-V1 remains blocked until this slice is merged-main verified
~~~

## 11. Preserved nonclaims

~~~text
NO_FAILURE_RECOVERY_SLICE_COMPLETION_CLAIM
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
