# GEOX B-09j Decision Recommendation Candidate Referential Shadow V1

## Status

B-09j is stacked exactly on completed B-09i product head:

`39cab94721e73b055770b5c51d7a5073a26a28f6`.

B-09j is shadow-only semantic migration work. It does not replace the
decision-engine recommendation producer, does not change the legacy Agronomy
Judge verdict, does not invoke Decision Eligibility Runtime, and does not
perform consumer migration or historical authority removal.

## Why B-09j exists

B-09h established an auditable shadow-only `QUALIFIED_EVIDENCE` criterion,
but it deliberately remained:

```text
candidate_binding_state = NOT_BOUND
candidate_ref = null
```

B-09i then proved on the formal/product recommendation path that the persisted
`decision_recommendation_v1` source fact is resolvable, but no canonical
CandidateDecision identity policy existed.

B-09j closes only that referential gap.

## Existing seams reused

No new API field is required.

The Agronomy Judge request already accepts `recommendation_id`.
`evaluateAgronomyJudgeV2` already carries that value into
`JudgeResultV2.recommendation_id`.

The existing B-06c
`projectLegacyRecommendationCandidateV1` remains the only CandidateDecision
projector used by this path.

The existing B-09f and B-09h shadows remain the only source of canonical
EvidenceQualification refs and the `QUALIFIED_EVIDENCE` criterion.

## Candidate identity policy

B-09j establishes one explicit policy for this bounded source path:

```text
SOURCE_FACT_SCOPE_SHA256_V1
```

Hash material is:

```text
policy version
decision_recommendation_v1
tenant_id
project_id
group_id
immutable source fact_id
```

The resulting candidate id is:

```text
candidate_sfsha256_<64 lowercase hex>
```

The legacy `recommendation_id` is **not** part of candidate identity.

It is used only to perform the scoped source lookup.

The immutable source `fact_id` remains the B-06c `source_ref`; B-09j does
not simply rename the fact id into a candidate id.

## Source lookup

B-09j queries `decision_recommendation_v1` by:

- tenant;
- project;
- group;
- caller-provided recommendation_id.

The query returns at most two rows.

The binding fails closed when:

- recommendation_id is absent;
- no source fact exists;
- more than one scoped source fact exists;
- source type is not `decision_recommendation_v1`;
- source writer is not `api/v1/recommendations/generate`;
- canonical scope cannot be established;
- requested field/season/device conflicts with persisted source scope.

This deliberately does not reuse the decision-engine's historical
`loadRecommendationById(... LIMIT 1)` behavior for canonical identity. A
duplicate identity is an ambiguity, not a reason to silently choose the latest
row.

## Candidate projection

After source binding succeeds, B-09j calls the existing B-06c adapter with:

```text
candidate_id                  = SOURCE_FACT_SCOPE_SHA256_V1 result
source_ref                    = immutable source fact_id
source_type                   = decision_recommendation_v1
scope                         = persisted scoped source fact
evidence_qualification_refs   = B-09h QUALIFIED_EVIDENCE support refs
context_snapshot_ref          = null
crop_stage_state_ref          = null
calculation_result_refs       = []
interpretation_refs           = []
created_at                    = source fact occurred_at
decision_time                 = null
```

Legacy `evidence_refs`, `snapshot_id`, `crop_stage`, `created_ts`, and
expected-effect semantics remain legacy provenance and are not promoted.

## Candidate-to-criterion continuity

B-09j accepts a criterion only when B-09f and B-09h are both ready:

```text
B-09f binding_state = BOUND
B-09f criterion_shadow_provenance_readiness = READY_FOR_CRITERION_SHADOW
B-09h projection_state = CRITERION_PROJECTED
B-09h criterion_assessment != null
```

It then requires exact set equality across:

1. B-09f canonical EvidenceQualification refs;
2. B-09h canonical EvidenceQualification refs;
3. B-09h criterion support refs;
4. projected CandidateDecision basis EvidenceQualification refs.

Only then does the B-09j wrapper report:

```text
binding_state = BOUND
criterion_candidate_binding_state = BOUND_TO_SAME_CANDIDATE
canonical_evidence_continuity_state = EXACT_REF_SET_MATCH
```

The original B-09h object is not rewritten and still reports
`candidate_ref=null`.

## Why B-07e remains disconnected

B-07e does not accept reference strings alone. Its runtime requires full
canonical `EvidenceQualificationV1` objects and validates their ids against
Candidate basis and criterion support refs.

B-09j has proven ref continuity, but it has not materialized those full
canonical qualification objects at this Agronomy seam.

Therefore B-09j explicitly reports:

```text
decision_eligibility_input_materialization_state
  = NOT_READY_CANONICAL_EVIDENCE_OBJECTS_NOT_BOUND

decision_eligibility_runtime_connected
  = false
```

The next frontier must solve canonical EvidenceQualification object
materialization/binding before any B-07e shadow invocation.

## Runtime effects

The Agronomy route still constructs the legacy JudgeResult first:

```text
buildJudgeResultV2(evaluateAgronomyJudgeV2(body))
```

Only afterward it computes and attaches:

- B-09f evidence dependency shadow;
- B-09h qualified-evidence criterion shadow;
- B-09j candidate/criterion referential shadow.

No legacy evaluator input or verdict is substituted.

## Repository authority effects

B-09j adds no new CandidateDecision producer.

The existing B-06c adapter remains the producer; B-09j is its first explicitly
registered shadow runtime consumer.

G-B02-15 CandidateDecision producer paths remain unchanged.

G-B02-17 criterion producer paths remain unchanged.

G-B02-18 Decision Eligibility Runtime consumer boundary remains unchanged.

All 29 grandfathered authority records remain exact.

B-09 replacement-readiness remains unchanged.

No Approval, OperationPlan, Task, Receipt, execution, MCFT, ADR, or LLM
authority is added.

## Completion gate

B-09j is complete only when one exact head proves:

- deterministic candidate identity is stable for the same scoped immutable
  source fact and changes when source fact identity changes;
- recommendation_id is lookup provenance only;
- zero/multiple/wrong-producer/wrong-scope source rows fail closed;
- B-06c remains the CandidateDecision projector;
- legacy evidence/context/stage/time fields are not promoted;
- exact canonical EvidenceQualification ref continuity is required;
- B-09h remains unchanged and candidate-unbound in its own contract;
- B-07e is never called;
- Decision Eligibility Runtime remains disconnected;
- Candidate producer allowlist and criterion producer allowlist remain exact;
- all 29 grandfathered authority records remain unchanged;
- replacement-readiness remains unchanged;
- no runtime schema/workflow/MCFT/ADR/LLM change occurs;
- general CI/full acceptance and MCFT boundary lanes pass.

## Next permitted step

After B-09j, the next B-Line step may bind/materialize the full canonical
`EvidenceQualificationV1` objects referenced by the candidate and criterion.

That next step must still begin shadow-only. B-09j does not authorize B-07e
runtime invocation, consumer cutover, or historical authority removal.


## B-02 connectivity registration

B-09j does not treat every dependency as if it belonged to
`decision.candidate`.

The exact registered connectivity is:

```text
C-040 decision.candidate
  decision-engine-recommendation
    -> b09j-decision-recommendation-candidate-criterion-shadow-binding

C-041 decision.candidate
  legacy-recommendation-candidate-compatibility-adapter
    -> b09j-decision-recommendation-candidate-criterion-shadow-binding

C-042 governance.semantic_authority_migration
  agronomy-evidence-dependency-shadow-binding-v1
    -> b09j-decision-recommendation-candidate-criterion-shadow-binding

C-043 decision.eligibility
  agronomy-qualified-evidence-criterion-shadow-v1
    -> b09j-decision-recommendation-candidate-criterion-shadow-binding

C-044 governance.semantic_authority_migration
  b09j-decision-recommendation-candidate-criterion-shadow-binding
    -> judge-v2-agronomy-candidate-criterion-referential-shadow
```

B-09f and B-09h remain their existing shadow producers. Their
`new_runtime_consumer_creation` policy changes only from `FORBIDDEN` to
`ALLOWED_ONLY_BY_EXPLICIT_REGISTER` so that this one B-09j shadow consumer can
be named and audited by B-02. This is not a new authority grant and does not
change either producer's output semantics.

B-09j itself is registered as a
`governance.semantic_authority_migration` `SHADOW_ONLY_BINDING` producer,
not as an additional CandidateDecision or DecisionEligibility producer.

The CandidateDecision producer allowlist and criterion-instantiation allowlist
remain unchanged.
