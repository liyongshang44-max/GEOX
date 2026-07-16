<!-- docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-ENTRY-CONTRACT.md -->

# MCFT-CAP-06 S3 Entry Contract

```text
delivery_slice_id:
MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1

status:
CANDIDATE_IMPLEMENTATION_IN_PROGRESS

baseline_main_commit:
ea198cc0cad063c7e70a59727171908f2f8c7e7d

predecessor_slice:
S2 MERGED_EFFECTIVE

successor_slices:
BLOCKED_PENDING_S3_EFFECTIVENESS
```

## 1. S3 owns

S3 is the sole owner of the first production-grade persistence substrate for:

```text
twin_calibration_candidate_v1
twin_shadow_evaluation_v1
D_MODEL_GOVERNANCE_STEP_COMMIT
```

S3 may establish only:

```text
one additive PostgreSQL migration
exact-ref PostgreSQL Residual adapter
Candidate canonical append support
Evaluation canonical append support
idempotency and concurrency serialization
canonical readback
response-loss recovery
rebuildable Candidate projection
rebuildable Evaluation projection
one-Candidate-to-zero-or-many-Evaluations index
embedded Evaluation case-result projection
facts-based guard/projection rebuild
corruption and divergence fail-closed behavior
```

`public.facts` remains the sole canonical store. Every S3 table is mutable, discardable and rebuildable support state.

## 2. S2 remains the sole mathematical authority

S3 must consume the exact S2 contracts and drafts. S3 must not introduce any alternative implementation of:

```text
case construction semantics
fixed-point replay math
metric math
grid search
parameter ranking
sensitivity
wetness-regime classification
objective flatness
best-vs-second margin
boundary disposition
no-op disposition
paired shadow compute
shadow threshold evaluation
```

The same boundary applies downstream:

```text
S5 may add only repository adapters, orchestration,
canonical envelope invocation and D transaction integration.

S6 may add only holdout orchestration and invocation of
the exact S2 paired-shadow engine.
```

S5 and S6 are forbidden from creating a second calibration or shadow mathematics authority.

## 3. Exact-ref PostgreSQL ownership

S2 froze the narrow domain port:

```text
loadExactCalibrationResiduals(orderedResidualRefs)
```

S3 owns the PostgreSQL implementation and SQL-shape proof.

Allowed query behavior:

```text
exact ordered object-ref batch input
exact canonical Residual type filter
exact object-id membership lookup
caller-provided order restoration
injected exact graph-resolution delegation
```

Forbidden repository surface:

```text
listResiduals
searchResiduals
latestResiduals
loadResidualsAfter
query by time range
query by scope range
generic facts query exposure
holdout projection exposure
```

Graph-resolution semantics remain deterministic and exact-ref rooted. S5 may supply orchestration for full graph resolution but may not widen the repository port.

## 4. Migration and projection boundary

P-1 adjudicated exactly one additive migration. It may:

```text
extend existing idempotency identity kinds
add Candidate projection
add Evaluation projection
add Candidate-to-Evaluation index
add embedded case-result projection
```

It must not:

```text
create an active-config index
modify an active-config pointer
create Model Activation persistence
create State/checkpoint persistence
change Forecast, Assimilation or Dynamics persistence
create public routes
create background workers or schedulers
```

Candidate-to-Evaluation cardinality is:

```text
one Candidate -> zero or many Evaluations
```

`candidate_ref` alone must not be unique.

## 5. Transaction and recovery boundary

Each D transition appends exactly one canonical object type:

```text
Candidate commit:
exactly one twin_calibration_candidate_v1

Evaluation commit:
exactly one twin_shadow_evaluation_v1
```

Same-key behavior:

```text
same key + same semantic hash
-> existing canonical success

same key + different semantic hash
-> deterministic conflict
```

Concurrent same-key operations must serialize to exactly one canonical append.

Recovery must support:

```text
idempotency-guard loss
projection deletion
response loss after commit
full facts-based rebuild
surviving corrupt projection fail-closed
canonical object-id divergence fail-closed
```

Failed Candidate/Evaluation attempts remain P-1 Mode A:

```text
NO_PERSISTENT_ATTEMPT_OBJECT
failed D canonical append delta = 0
operational F append delta = 0
```

## 6. Permanent focused regression

The exact workflow authorized by this contract is:

```text
.github/workflows/mcft-cap-06-s3-focused-validation.yml
```

It is a permanent path-scoped regression, not a branch materializer or proof-only temporary workflow. It must run on relevant pull requests and on pushes to `main` that change the S3 persistence boundary.

The focused regression must execute:

```text
repository typecheck and build
corrected S1 PostgreSQL graph reproduction
corrected S1 wetness-regime reproduction
exact S2 contracts/math reproduction
S3 isolated PostgreSQL persistence acceptance
S3 governance Gate
```

The workflow must not be locked to one branch name and must not obtain write permission.

## 7. Governance repair applied from S3 onward

Historical Slice Gates must prove immutable facts of their own Slice. They must not encode every future delivery-frontier phase.

```text
S1 Gate:
corrected S1 evidence only

S2 Gate:
S2 contracts/math effectiveness and zero-write boundary only

S3 Gate:
current S3 candidate/effectiveness frontier
```

Current delivery state and immutable predecessor effectiveness are separate concepts. S3 introduces separate evidence files for those roles while retaining existing aggregate files only as compatibility projections.

## 8. Explicit nonclaims

```text
NO_S5_CANDIDATE_ORCHESTRATION
NO_S6_SHADOW_ORCHESTRATION
NO_PRODUCTION_CALIBRATION_RUN
NO_PRODUCTION_SHADOW_RUN
NO_MODEL_ACTIVATION
NO_ACTIVE_CONFIG_SWITCH
NO_RUNTIME_PARAMETER_CHANGE
NO_STATE_MUTATION
NO_CHECKPOINT_MUTATION
NO_PUBLIC_ROUTE
NO_WEB_CHANGE
NO_SCHEDULER
NO_MCFT_CAP_07_AUTHORIZATION
```
