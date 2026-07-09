<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE.md -->
# MCFT-CAP-01 Historical Closure and Active Remediation

```text
capability_line_id: MCFT-CAP-01
display_alias: MCFT-1
name: First-Class Water State Estimate
runtime_mode: REPLAY
target_completion_level: Level A
historical_closure_main_commit: 250053aba801075c17098f8d505d527eb54390e9
historical_closure_status: SUPERSEDED_PENDING_REMEDIATION
active_delivery_slice_id: MCFT-CAP-01.CLOSURE-REMEDIATION-V1
remediation_pr: 2316
current_capability_status: IN_IMPLEMENTATION
successor: NOT_YET_AUTHORIZED
```

## 1. Why the historical closure was reopened

The historical closure proved that the implemented A0 path could produce one deterministic bootstrap posterior, append nine canonical facts atomically, rebuild six projections, create an INITIAL lineage and checkpoint, produce a BLOCKED Forecast result, and expose a checkpoint `next_tick_logical_time`.

A later code-level audit established that three closure claims exceeded the actual implementation:

```text
MCFT_CAP_01_COMPLETE
CONTROLLED_REPLAY_BOOTSTRAP_CLOSURE_ESTABLISHED
NEXT_TICK_HANDOFF_ESTABLISHED
```

The historical evidence is retained, but these claims are suspended until remediation passes.

## 2. Proven implementation retained

```text
S1 Canonical Replay Evidence Dataset
  720 hourly intervals
  3604 governed Evidence records
  seven Evidence roles
  deterministic regeneration

S2 A0 Contracts and Runtime Config subset
  deterministic object identity
  immutable Runtime Config

S3A Persistence subset
  fenced lease
  aggregate idempotency
  nine-fact atomic append
  six rebuildable projections

S3B Bootstrap State Math
  posterior_mean: 0.192595
  posterior_variance: 0.002678
  posterior_stddev: 0.051746

S4 A0 Runtime Integration
  controlled Replay A0 transaction
  INITIAL lineage
  INITIAL checkpoint
  BLOCKED zero-point Forecast result
  checkpoint next_tick_logical_time: 2026-06-01T02:00:00.000Z
```

The following claims remain valid:

```text
BOOTSTRAP_STATE_MATH_ESTABLISHED
STATIC_BOOTSTRAP_ASSIMILATION_ESTABLISHED
FIRST_BOOTSTRAP_POSTERIOR_ESTABLISHED
A0_ATOMIC_COMMIT_ESTABLISHED
ACTIVE_INITIAL_LINEAGE_ESTABLISHED
INITIAL_CHECKPOINT_ESTABLISHED
BLOCKED_FORECAST_RESULT_ESTABLISHED
NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED
```

## 3. Confirmed remediation requirements

### Persisted next-tick handoff

A checkpoint time pointer is not a complete handoff. The remediated path must reconstruct, from PostgreSQL:

```text
active lineage
latest checkpoint
previous posterior State
Runtime Config
Reality Binding Runtime snapshot
```

and return:

```text
previous_posterior_ref
previous_checkpoint_ref
lineage_id
prior_mean
prior_variance
next_logical_tick_time
runtime_config_ref/hash
reality_binding_ref/hash
```

### Conflicting duplicate observation rejection

The soil selector must use:

```text
observed_at descending
ingested_at descending
source_record_id ascending
```

Same origin source and observation time with different canonical payload must produce:

```text
CONFLICTING_DUPLICATE_OBSERVATION
zero Runtime Config fact delta
zero A0 fact delta
zero projection delta
```

### Complete Evidence consumption trace

Evidence Window inclusion and estimator consumption are separate semantics. Every entry must preserve ingestion time, freshness, quality, unit conversion, limitations, disposition and model-consumption status.

```text
soil observation:
CONSUMED_BY_BOOTSTRAP_ESTIMATOR

rainfall and historical ET0:
CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR
```

### Complete A0 reference-graph validation

All internal object references must be validated independently of member and aggregate hashes. A modified reference remains invalid even after every affected hash is recomputed.

### Manual Runtime entry

The capability requires the explicit one-shot entry:

```text
apps/server/scripts/mcft/MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER.ts
```

The runner is not a scheduler and does not establish continuous Runtime.

### Crop-stage configuration context

The Dataset package must include time-resolved crop-stage context derived from the frozen Configuration Binding Matrix. It remains:

```text
CONFIGURATION_DERIVED_CONTEXT
not Evidence
```

## 4. Current remediation implementation

The remediation branch establishes candidate implementations for:

```text
PrepareNextTickInputServiceV1
PostgresNextTickRepositoryV1
immutable Reality Binding Runtime snapshot
conflicting-observation rejection
observed/ingested/id deterministic selection
complete Evidence Window consumption trace
complete A0 cross-reference graph validator
manual MCFT-1 runner
configuration_context.json
manifest_v2.json
```

These are candidate facts until specialized static and PostgreSQL Gates, legacy regressions, runner execution, exact-head CI and final closure governance pass.

## 5. Historical evidence retained

```text
S1 Replay Dataset Gate: 12 PASS, 0 FAIL
S2 Contracts/Config Gate: 10 PASS, 0 FAIL
S3A Static Persistence Gate: 16 PASS, 0 FAIL
S3A PostgreSQL Gate: 8 PASS, 0 FAIL
S3B State Math Gate: 108 PASS, 0 FAIL
S3B Closure Gate: 36 PASS, 0 FAIL
S4 Static Runtime Gate: 20 PASS, 0 FAIL
S4 PostgreSQL Runtime Gate: 12 PASS, 0 FAIL
S4 Closure Gate: 57 PASS, 0 FAIL
Historical Closure Readiness Gate: 104 PASS, 0 FAIL
Historical Final Closure Gate: 169 PASS, 0 FAIL
```

These Gates prove the behavior they tested. They do not prove the newly identified missing requirements.

## 6. Preserved nonclaims

```text
NO_MCFT_CAP_01_CLOSURE
NO_PERSISTED_NEXT_TICK_HANDOFF
NO_PROPAGATION
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_DECISION
NO_AO_ACT
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_RESTART_BACKFILL_PROOF
NO_LATE_EVIDENCE_REVISION_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

## 7. Reclosure condition

Only after PR #2316 passes all remediation Gates, merges into `main`, and the merged main commit is verified may the capability line re-establish:

```text
MCFT_CAP_01_COMPLETE
FIRST_CLASS_WATER_STATE_ESTIMATE_LEVEL_A_ESTABLISHED
CONTROLLED_REPLAY_BOOTSTRAP_CLOSURE_ESTABLISHED
PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED
CONFLICTING_DUPLICATE_OBSERVATION_REJECTION_ESTABLISHED
EVIDENCE_MODEL_CONSUMPTION_TRACE_ESTABLISHED
A0_CROSS_REFERENCE_GRAPH_VALIDATION_ESTABLISHED
OPERATOR_INVOKABLE_MANUAL_RUNTIME_ENTRY_ESTABLISHED
CROP_STAGE_CONFIGURATION_CONTEXT_ESTABLISHED
```

No MCFT-2 work is authorized before this transition.
