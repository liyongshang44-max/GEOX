# GEOX MCFT-CAP-05 S8 — Forecast Observation Residual C Commit

## 1. Delivery slice

```text
MCFT-CAP-05.MCFT-07-11.FORECAST-OBSERVATION-RESIDUAL-C-COMMIT-V1
```

S8 adds one bounded Runtime composition around already-established authorities:

```text
existing CAP-04 outcome A1/B tick
→ exact applied observation readback
→ historical post-receipt Forecast-point match
→ frozen Forecast-to-observation projection
→ C_FORECAST_RESIDUAL_COMMIT
→ canonical readback
```

S8 does not create a new State, Forecast, observation-selection, Assimilation, persistence family or projection store.

## 2. Effective baseline

```text
S7 settlement merge:
8340a6d4ea369ae6913b67f8d3323ce029625167

S8 residual-contract remediation merge:
509fe707104a12fbdbbf08823b6d71a70342e0ad

S8 remediation merged-main probe:
PR #2472
workflow 29352931798
SUCCESS
```

The pre-S8 remediation is the contract authority for Forecast-point member refs, target-time equality, projection hashes, root-zone geometry identity, effective observation variance and non-positive-variance fail-closed behavior.

## 3. Runtime composition

### 3.1 Outcome tick

The caller supplies one explicit CAP-04 tick request. S8 delegates State propagation, observation selection, Assimilation, posterior State, 72-hour Forecast, A1/A2 persistence and B Scenario persistence to the existing CAP-04 service.

S8 requires the outcome path to produce:

```text
successful A1
+
B Scenario Set
+
applied observation Assimilation
+
completed current Forecast
```

A blocked Forecast or missing Scenario Set is not an S8 success path.

### 3.2 Observation authority

The Residual observation is read from the canonical outcome-tick Evidence Window and Assimilation Update. S8 verifies:

```text
selected observation ref/hash exact match
observed_at = outcome logical_time
available_to_runtime_at <= outcome logical_time
quality = PASS or LIMITED
Assimilation status = APPLIED
Assimilation selected_observation_ref exact match
Assimilation actual observation exact match
observation operator family exact match
```

S8 does not perform a second observation selection.

### 3.3 Historical Forecast source

The PostgreSQL source reads candidates through:

```text
twin_forecast_run_projection_v1
+
twin_forecast_point_projection_v1
+
public.facts canonical readback
```

Every projection row is checked against the canonical Forecast fact. The selected Forecast must be:

```text
status = COMPLETED
same exact Reality scope
same lineage and revision
issued_at < observation target time
created_at <= observation available_to_runtime_at
contains exactly one point targeting the observation time
source posterior State exists canonically
source posterior Evidence Window exists canonically
Evidence Window consumed at least one canonical twin_action_feedback_v1
```

Projection presence alone is never canonical authority.

### 3.4 Deterministic match

The match policy is:

```text
LATEST_COMPLETED_FORECAST_POINT_TARGETING_OBSERVATION_V1
```

Candidate order:

```text
issued_at descending
object_id ascending
```

If multiple latest-issued candidates remain:

```text
semantic equivalence proven
→ object_id ascending winner

semantic equivalence not proven
→ fail closed
```

The Forecast point ref is:

```text
<forecast_object_id>#/points/<horizon_hour>
```

under:

```text
GEOX_FORECAST_POINT_SEMANTIC_MEMBER_REF_V1
```

## 4. Forecast Residual math

S8 reuses the remediated pure contract:

```text
predicted VWC
= historical Forecast storage mean / root-zone depth

forecast VWC variance
= historical Forecast storage variance / root-zone depth²

residual
= actual observation - historical Forecast projected observation

total residual variance
= forecast VWC variance + CAP-03 effective observation variance

normalized residual
= residual / sqrt(total residual variance)
```

The CAP-03 effective observation variance already contains sensor, representativeness and quality effects. S8 does not add representativeness variance a second time.

```text
total residual variance <= 0
→ fail closed
```

## 5. Transaction and persistence

S8 uses the existing transaction variant:

```text
C_FORECAST_RESIDUAL_COMMIT
```

and existing persistence implementation:

```text
PostgresFeedbackPersistenceRepositoryV1
```

It appends exactly one:

```text
twin_forecast_residual_v1
```

with existing:

```text
C_FORECAST_RESIDUAL idempotency guard
Forecast Residual projection
canonical fact readback
facts-based support-state rebuild
```

No migration and no ninth transaction family are introduced.

## 6. Residual versus Assimilation Innovation

The Runtime trace preserves:

```text
shared actual observation ref/hash/value
shared observation operator family
historical Forecast projected prediction
historical Forecast residual
current-tick propagated-prior prediction
current-tick Assimilation innovation
```

It always preserves:

```text
equivalence_claimed = false
causal_effect_claimed = false
```

unless a future separately authorized proof contract establishes equivalence. S8 does not establish such proof.

Forecast Residual does not own:

```text
Assimilation gain
posterior State
model-parameter update
causal-effect attribution
calibration candidate
model activation
```

## 7. Idempotency and replay

Replaying the same completed outcome tick and same observation returns:

```text
existing A1/B
+
EXISTING_IDEMPOTENT_SUCCESS C object
```

with the same object ID, determinism hash and fact ID. No second C fact is created.

Same semantic identity with a different C hash fails through the existing CAP-05 idempotency conflict boundary.

## 8. Acceptance obligations

The S8 candidate must prove:

```text
repository typecheck
repository build
server selfcheck
in-memory real CAP-04 outcome tick
historical post-receipt Forecast selection
canonical H-consumption proof
exact horizon-1 member match
C insert and canonical readback
C idempotent replay
Residual/Innovation distinction
non-equivalent tie fail-closed
PostgreSQL projection-to-fact source proof
PostgreSQL C projection and guard
facts-based C support-state recovery
S7 validated regression
S7 NOT_YET_VALIDATED regression
S6 validation-orthogonality regression
CAP-04 single-tick regression
standard acceptance
commercial release gate
```

## 9. Preserved boundaries

S8 does not authorize or claim:

```text
new canonical object type
new transaction family
migration
public route
web workflow
range loop
restart/backfill
late receipt history rewrite
outcome causal attribution
Forecast Residual = Assimilation Innovation
calibration candidate
model parameter update
model activation
Recommendation
AO-ACT change
CAP-06
MCFT Gate A closure
minimum complete field twin
```

## 10. Effectiveness condition

The Runtime candidate is not effective merely because its branch CI passes.

```text
S8 Runtime PR merged to main
+
exact-head to merge tree equivalence
+
merged-main S8 effectiveness probe passes
+
separate SSOT settlement
```

Only the separate settlement may mark S8 `MERGED_EFFECTIVE` and authorize the next CAP-05 slice. This Runtime PR does not authorize the successor slice or CAP-06.
