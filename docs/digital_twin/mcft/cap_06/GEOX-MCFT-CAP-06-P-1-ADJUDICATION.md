<!-- docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P-1-ADJUDICATION.md -->
# GEOX MCFT-CAP-06 P-1 — DT-02 Calibration / Shadow Adjudication

## 0. Authority and boundary

```text
capability_line_id:
MCFT-CAP-06

delivery_slice_id:
MCFT-CAP-06.P-1.DT02-CALIBRATION-SHADOW-ADJUDICATION-V1

slice_kind:
ARCHITECTURE_GOVERNANCE_ONLY

verified_main_at_candidate_start:
9c4030e43d3b65857cf40d7936d5dfa8e80c17d1

runtime_source_authorized:
false

migration_authorized_in_this_slice:
false

canonical_write_authorized:
false

model_activation_authorized:
false
```

This adjudication interprets the already-frozen DT-02 object and transaction authorities for MCFT-CAP-06. It creates no Runtime implementation, migration, canonical fact, projection, route, scheduler, active binding, approval, or Model Activation.

## 1. Final outcome

```text
P-1 outcome:
REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED

DT-02 architecture amendment required:
false

conditional P-1A required:
false

calibration-governance Runtime Config object required:
false

conditional S4 retained:
false
```

Rationale:

1. `twin_calibration_candidate_v1` and `twin_shadow_evaluation_v1` already exist as non-lineage canonical model-governance history.
2. Both objects already use `D_MODEL_GOVERNANCE_STEP_COMMIT`.
3. D already supports candidate/evaluation indexes and limits active-config CAS to Activation.
4. The existing base envelope and NON_LINEAGE_CONTEXT envelope are sufficient.
5. Immutable policy artifacts and hashes can freeze calibration/search/evaluation policy without creating a policy-only Runtime Config.

## 2. Candidate object profile

```text
object_type:
twin_calibration_candidate_v1

reuse_status:
REUSE_WITHOUT_AMENDMENT

record_class:
CANONICAL_MODEL_GOVERNANCE_HISTORY

lineage_member:
false

envelope_profile:
NON_LINEAGE_CONTEXT

transaction:
D_MODEL_GOVERNANCE_STEP_COMMIT

atomic append cardinality:
exactly one Candidate object per Candidate governance transition
```

Required CAP-06 interpretation:

```text
residual_refs:
exactly 16 ordered canonical twin_forecast_residual_v1 object refs

base_config_ref:
required and non-null for the CAP-06 Candidate profile

base_config_hash:
required and non-null

context_lineage_ref:
required by the CAP-06 profile

context_revision_ref:
required by the CAP-06 profile
```

The DT-02 base envelope allows nullable Runtime Config fields globally, but the Candidate object-specific `base_config_ref` requirement and the established explicit Replay Config chain make null inappropriate for this capability profile. A missing or non-unique base Config fails closed.

## 3. Shadow Evaluation object profile

```text
object_type:
twin_shadow_evaluation_v1

reuse_status:
REUSE_WITHOUT_AMENDMENT

record_class:
CANONICAL_MODEL_GOVERNANCE_HISTORY

lineage_member:
false

envelope_profile:
NON_LINEAGE_CONTEXT

transaction:
D_MODEL_GOVERNANCE_STEP_COMMIT

atomic append cardinality:
exactly one Evaluation object per Evaluation governance transition
```

The generic `NON_LINEAGE_CONTEXT` envelope optional fields apply to every non-lineage object. Therefore Evaluation may directly carry:

```text
context_lineage_ref
context_revision_ref
```

The object-specific `optional_refs: []` entry means that Evaluation defines no additional object-specific optional predecessor refs. It does not revoke optional fields already granted by the generic NON_LINEAGE_CONTEXT envelope and DT-02 Architecture Amendment 01.

```text
Evaluation context rule:
DIRECT_CONTEXT_REFS_ALLOWED

architecture amendment required:
false
```

## 4. Context identity kinds

Current MCFT Runtime precedent supplies non-lineage context from the State lineage fields rather than from the active-lineage pointer object.

The CAP-06 compatibility rule is therefore:

```text
context_lineage_identity_kind:
SEMANTIC_LINEAGE_ID

context_revision_identity_kind:
SEMANTIC_REVISION_ID

context_lineage_ref value:
exact lineage_id shared by all eligible source cases

context_revision_ref value:
exact revision_id shared by all eligible source cases

active_lineage_object_ref:
recorded separately by predecessor lock; not substituted into context_lineage_ref
```

This rule preserves compatibility with canonical CAP-05 Forecast Residual history, whose current builder writes State `lineage_id` and `revision_id` into the non-lineage context fields.

Candidate and Evaluation must use the same context values. Any mixed lineage or revision context fails closed.

## 5. D transaction reuse

```text
transaction_id:
D_MODEL_GOVERNANCE_STEP_COMMIT

reuse_status:
REUSE_WITHOUT_AMENDMENT
```

Candidate transition:

```text
canonical append:
exactly one twin_calibration_candidate_v1

projection writes:
Candidate projection and Candidate lookup/index rows only

forbidden:
Evaluation append in the same transition
Runtime Config append in the same transition
Model Activation append
active-config index create/update
State/checkpoint mutation
```

Evaluation transition:

```text
canonical append:
exactly one twin_shadow_evaluation_v1

projection writes:
Evaluation projection, Candidate-to-Evaluation index, embedded case-result projection

forbidden:
Candidate append in the same transition
Runtime Config append in the same transition
Model Activation append
active-config index create/update
State/checkpoint mutation
```

## 6. Envelope source, Evidence, and Config mapping

Candidate:

```text
source_refs:
ordered residual refs followed by base_config_ref

evidence_refs:
ordered unique actual Observation Evidence refs resolved from the 16 Residual payloads

runtime_config_ref/hash:
base_config_ref/hash, non-null
```

Evaluation:

```text
source_refs:
candidate_ref followed by ordered holdout residual refs

evidence_refs:
ordered unique actual Observation Evidence refs resolved from the 8 holdout Residual payloads

runtime_config_ref/hash:
Candidate base_config_ref/hash, non-null
```

Canonical Residual objects are sources, not Evidence. A Residual ref in `evidence_refs` is a contract violation.

## 7. Base Config authority

```text
config_authority_mode:
EXPLICIT_REPLAY_PIN

active binding assumed:
false
```

All 16 calibration cases may reference different immutable per-operation Runtime Config objects only when their effective semantics are homogeneous.

Required homogeneity:

```text
effective drainage coefficient
model parameter bundle hash
model component set hash
geometry hash
observation operator hash
Runtime replay numeric policy hash
```

Deterministic base Config selection:

1. Resolve all case-referenced canonical Runtime Configs.
2. Reject any effective semantic heterogeneity.
3. Select the latest eligible case-referenced Config by `logical_time DESC`, then `object_id ASC`.
4. Persist all ordered unique source Config refs and the source Config set hash in Candidate.
5. Use the selected non-null Config as Candidate and Evaluation envelope Runtime Config authority.

An active binding, if introduced by a future predecessor, may be read only as an additional authority check. CAP-06 does not establish it.

## 8. Calibration-governance Config decision

```text
calibration_governance_config_object_required:
false

S4 execution:
OMITTED

canonical Config delta from policy freezing:
0
```

Search bounds, sensitivity rules, metric rules, selection rules, Shadow thresholds, engine identities, and numeric policies must be immutable repository artifacts with semantic hashes. They are not State-tick configuration and do not justify a policy-only `twin_runtime_config_v1` append.

## 9. Migration decision

```text
S3 migration count:
EXACTLY_ONE_ADDITIVE_MIGRATION
```

Reason:

1. The current idempotency identity-kind constraint has no D Candidate or D Evaluation identities.
2. Candidate, Evaluation, Candidate-to-Evaluation, and embedded case-result projections do not exist.
3. These tables are rebuildable support state; `public.facts` remains the sole canonical store.

The migration must be additive and must not create an active-config index. It may extend the existing idempotency identity-kind allowlist and create only CAP-06 projection/index tables required by the frozen S3 contract.

## 10. Failed-attempt persistence

```text
failed_attempt_persistence_mode:
MODE_A_NO_PERSISTENT_ATTEMPT_OBJECT
```

Failed calibration or evaluation attempts return deterministic in-memory results and acceptance evidence only.

They do not append:

```text
twin_calibration_candidate_v1
twin_shadow_evaluation_v1
twin_runtime_attempt_v1
twin_runtime_health_v1
```

A later capability may authorize operational F-family attempt history, but CAP-06 Level A does not need it.

## 11. Candidate-to-Evaluation cardinality

```text
one Candidate:
zero or many Evaluations

candidate_ref alone unique:
false
```

Evaluation uniqueness must include:

```text
candidate_ref
evaluation_dataset_hash
evaluation_policy_hash
replay engine identity
metric numeric policy hash
```

## 12. Forecast Evidence cutoff graph

The existing A-record-set graph is sufficient without amendment.

Deterministic traversal:

```text
Forecast Run
→ payload.source_posterior_ref
→ exact twin_state_estimate_v1
→ payload.evidence_window_ref
→ exact twin_evidence_window_v1
```

Cutoff authority:

```text
Evidence Window envelope logical_time/as_of
and
Evidence Window payload window_end_inclusive when present
```

All resolved values must agree. The Evidence Window graph and Forecast envelope `as_of` establish the anti-future-leakage cutoff. Operational `created_at` is excluded.

```text
forecast_evidence_cutoff_graph_status:
RESOLVABLE_WITHOUT_AMENDMENT
```

## 13. P37–P44 reuse

```text
bounded delta search:
PURE_ALGORITHM_REFERENCE

deterministic hashing:
PURE_ALGORITHM_REFERENCE

no-op candidate concept:
PURE_ALGORITHM_REFERENCE

paired metric concept:
PURE_ALGORITHM_REFERENCE

old policies and fixture shapes:
SEMANTIC_REFERENCE_ONLY

local ledger and old record types:
FORBIDDEN_AS_CANONICAL_AUTHORITY

old Activation path:
FORBIDDEN
```

## 14. Model Activation exclusion

```text
twin_model_activation_v1 creation:
FORBIDDEN

active-config CAS:
FORBIDDEN

approval creation:
FORBIDDEN

Candidate automatic Runtime consumption:
FORBIDDEN

Evaluation automatic Runtime consumption:
FORBIDDEN
```

The phrase “Capability Completion Effectiveness Activation” applies only to completion-claim effectiveness and never means Model Activation.

## 15. Consequence for the delivery graph

P-1 selects Outcome B.

After this P-1 candidate is merged and the merged-main P-1 Gate passes:

```text
P-1A:
omitted

next eligible governance slice:
MCFT-CAP-06.P0.CAP-05-TERMINAL-SSOT-RECONCILIATION-AND-PROVISIONAL-SSOT-V1

S4:
omitted

S5 dependency after Runtime authorization:
S3 merged-effective
```

No Runtime authority becomes effective from this P-1 candidate or its merge alone.
