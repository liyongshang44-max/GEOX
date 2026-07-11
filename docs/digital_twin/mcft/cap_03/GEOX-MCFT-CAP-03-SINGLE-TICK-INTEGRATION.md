<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-SINGLE-TICK-INTEGRATION.md -->
# GEOX MCFT-CAP-03 S4 — Single-Tick Integration v1

## 1. Slice identity

```text
capability_line_id:
MCFT-CAP-03

delivery_slice_id:
MCFT-CAP-03.MCFT-04-05-06-07-08-09.SINGLE-TICK-INTEGRATION-V1

runtime_mode:
REPLAY

baseline_main_commit:
17c837c961e53a958bc94b2d6c216fa4fc23e10b

branch:
mcft-cap-03-single-tick-integration-v1
```

S4 starts only after S3B implementation and merged-main effectiveness are both established. S4 does not authorize S5, MCFT-CAP-04, range execution, continuous runtime, or any downstream decision/action capability.

## 2. Runtime objective

S4 establishes exactly one explicit observation-aware continuation tick:

```text
persisted canonical predecessor handoff
→ explicit Replay logical time T
→ pinned CAP-03 Runtime Config
→ exact-hour rainfall / historical ET0 selection
→ configuration-derived crop stage
→ pure hourly Dynamics
→ propagated prior
→ authorized soil-moisture observation selection
→ innovation / State-observation residual
→ bounded scalar Gaussian assimilation
→ posterior State
→ BLOCKED Forecast result
→ existing A_STATE_TICK_COMMIT / A2_BLOCKED_FORECAST transaction
→ eight canonical facts
→ five continuation projections
→ canonical record-set readback
→ persisted T+1 handoff
```

Execution cardinality is:

```text
EXACTLY_ONE_REQUESTED_NEXT_TICK
```

There is no loop, implicit wall-clock logical time, scheduler, route, daemon, range, restart mode, or backfill mode.

## 3. Predecessor authority

The only permitted starting point is the persisted CAP-02 final handoff:

```text
checkpoint.tick_sequence = 24
checkpoint.next_tick_logical_time = 2026-06-02T02:00:00.000Z
latest successful Forecast ref = null
```

The prepared handoff must contain canonical ref/hash pairs for:

```text
previous posterior State
previous checkpoint
previous BLOCKED Forecast result
previous State Runtime Config
Reality Binding
```

### 3.1 Additive Forecast hash plumbing

S4 preflight found that the canonical predecessor Forecast-result hash existed in PostgreSQL and in the predecessor lock, but `PreparedNextTickInputV1` exposed only the Forecast ref.

The correction is additive:

```text
PostgresNextTickRepositoryV1
  reads checkpoint.forecast_result_ref
  reads the referenced canonical twin_forecast_run_v1 fact
  returns previous_forecast_result in PersistedNextTickSnapshotV1

PrepareNextTickInputServiceV1
  validates scope / lineage / revision / Runtime Config authority
  returns previous_forecast_result_hash
```

This is not a DT-02 Architecture Amendment. It creates no object type, transaction family, projection, schema column, migration, lineage, or revision. It only carries an existing canonical authority value into the S4 builder input.

Historical callers remain source-compatible because the added snapshot and prepared-handoff fields are optional at the shared type boundary. S4 itself requires the hash and fails closed when it is absent.

## 4. Frozen execution order

The service order is frozen:

```text
1. Validate explicit logical_time, created_at and lease request.
2. Read persisted next-tick handoff.
3. Derive the existing A2 operation identity.
4. Lookup idempotency before Runtime Config, Evidence and lease.
5. For an existing complete record set, return EXISTING_IDEMPOTENT_SUCCESS.
6. Require requested T == persisted checkpoint.next_tick_logical_time.
7. Require predecessor Forecast ref/hash authority.
8. Read and validate pinned CAP-03 Runtime Config.
9. Require parent Runtime Config ref/hash == predecessor State Runtime Config ref/hash.
10. Require Reality Binding ref/hash equality.
11. Load Replay Evidence candidates.
12. Build CAP-03 Evidence Window and deterministic observation selection.
13. Execute exact-hour Dynamics.
14. Compute assimilation from the propagated prior, never from the previous posterior directly.
15. Finalize Evidence consumed/evaluated/applied trace classes.
16. Build the immutable eight-object CAP-03 A2 candidate.
17. Repeat idempotency lookup to close the build/commit race.
18. Acquire lease only for a new key.
19. Commit through existing A_STATE_TICK_COMMIT / A2_BLOCKED_FORECAST.
20. Read the canonical record set back.
21. Prepare persisted T+1 handoff and verify State/checkpoint/Forecast refs and Forecast hash.
```

## 5. Idempotency

Frozen behavior:

```text
same operation key + same aggregate hash:
EXISTING_IDEMPOTENT_SUCCESS

same operation key + different aggregate hash:
IDEMPOTENCY_CONFLICT
```

A completed same-tick replay:

```text
must not load Evidence
must not recompute Dynamics
must not recompute assimilation
must not acquire another lease
must not append facts
must not rewrite projections
must not perform another canonical readback
```

The existing-record path validates the persisted record set and verifies that the current canonical handoff points to its State, checkpoint, and BLOCKED Forecast result.

## 6. Standard first tick

```text
T = 2026-06-02T02:00:00.000Z
previous checkpoint sequence = 24
committed checkpoint sequence = 25
next logical time = 2026-06-02T03:00:00.000Z
```

Standard observation:

```text
observed_at = 2026-06-02T01:50:00.000Z
available_to_runtime_at = 2026-06-02T01:55:00.000Z
value = 0.184500 fraction
quality = PASS
binding = soil_obs_c8_20cm_v1
```

Standard propagated prior authority:

```text
storage mean = 57.727512 mm
storage variance = 241.520029261250 mm²
VWC mean = 0.192425000000
VWC variance = 0.002683555881
```

Standard assimilation authority:

```text
innovation == residual = -0.007925000000
observation variance = 0.004000000000
assimilation gain = 0.401516188206...
posterior VWC = 0.189242984208
posterior VWC variance = 0.001606064753
posterior storage = 56.772895 mm
posterior storage variance = 144.545827754111 mm²
```

Canonical fixture values are produced by repository-owned decimal functions and validated in acceptance. Design-stage approximate values do not override canonical scale and rounding rules.

## 7. Canonical result

S4 reuses:

```text
transaction family = A_STATE_TICK_COMMIT
operation variant = A2_BLOCKED_FORECAST
identity kind = A2_RECORD_SET
record_set_contract_id = MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
canonical fact count = 8
projection count = 5
```

The eight members remain:

```text
twin_evidence_window_v1
twin_state_transition_v1
twin_assimilation_update_v1
twin_state_estimate_v1
twin_forecast_run_v1
twin_runtime_tick_v1
twin_runtime_checkpoint_v1
twin_runtime_health_v1
```

Forecast remains:

```text
status = BLOCKED
points = []
scenario_eligible = false
successful_forecast_ref = null
```

No successful Forecast projection is written and active lineage is verify-only.

## 8. Failure policy

The tick fails closed on:

```text
missing predecessor Forecast hash
requested T not equal to persisted next logical time
missing or wrong-version CAP-03 Runtime Config
parent Runtime Config ref/hash mismatch
Reality Binding mismatch
crop-stage configuration matrix hash mismatch
conflicting semantic duplicate Evidence
invalid observation / unit / scope / freshness
cross-reference or determinism-hash violation
lease or fencing failure
State/checkpoint/Forecast CAS conflict
persistence fault
canonical readback mismatch
T+1 handoff mismatch
```

A failure before commit must leave predecessor State, checkpoint, Forecast-result pointer, facts, projections and idempotency guard unchanged.

## 9. Acceptance

The Gate includes:

```text
positive in-memory single-tick acceptance
negative fail-closed acceptance
isolated PostgreSQL end-to-end service acceptance
exact-value assertions
canonical Forecast hash handoff assertion
idempotent replay before lease assertion
server Typecheck
server Build
git diff --check
exact changed-file boundary
Draft / Final / Postmerge lifecycle modes
```

The isolated database script requires:

```text
MCFT_CAP_03_S4_DESTRUCTIVE_ACCEPTANCE=1
DATABASE_URL=<isolated database whose name contains mcft/cap03/s4/single_tick/acceptance/test>
```

## 10. Preserved nonclaims

S4 does not establish:

```text
24 observation-aware tick range
range execution
restart or backfill proof
successful Forecast
72-hour Forecast
Scenario
Recommendation
Policy evaluation
Decision
AO-ACT
calibration candidate
shadow evaluation
model activation
active model parameter change
late-evidence revision
continuous runtime
live-field operation
MCFT-CAP-03 completion
Minimum Complete Field Twin
MCFT-CAP-04 authorization
```

S5 remains blocked until the S4 implementation PR is merged and the merged-main S4 Postmerge Gate passes, followed by a separate explicit S5 activation.
