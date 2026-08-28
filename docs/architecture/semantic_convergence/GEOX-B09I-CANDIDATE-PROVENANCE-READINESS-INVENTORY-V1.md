# GEOX B-09i Candidate Provenance Readiness Inventory V1

## Status

B-09i is stacked exactly on completed B-09h product head:

`8acb1b9e39f84a498e0a794cae0837537a452383`.

B-09i is analysis/governance only.

It does not create a CandidateDecision runtime producer, does not bind the
B-09h criterion to a candidate, does not connect B-07e Decision Eligibility
Runtime, and does not perform consumer migration or authority removal.

## Question

B-09h established an auditable shadow-only `QUALIFIED_EVIDENCE` criterion,
but deliberately left:

```text
candidate_binding_state = NOT_BOUND
candidate_ref = null
decision_eligibility_runtime_connected = false
```

B-09i asks the next required question:

> Can the current formal/product recommendation path supply the canonical
> CandidateDecision identity and provenance needed to bind that criterion
> without inventing authority?

The answer on the analyzed path is: **not yet**.

## Analyzed path

The runtime corpus covers only:

```text
POST /api/v1/recommendations/generate
  -> decision_recommendation_v1 persisted fact
```

The analyzed producer is the registered
`decision-engine-recommendation` path in
`apps/server/src/routes/decision_engine_v1.ts`.

This inventory does not adjudicate the other historical Candidate producers,
including Agronomy Agent, rule engine, legacy Operator writers, decision-plan,
prescription, or operation-plan candidate views.

## Exact runtime proof

Successful validation:

- run: `33163943525`
- job: `98824762777`
- validation head: `78e925914a174407446db870637ee6706ca440f7`
- locked product head: `8acb1b9e39f84a498e0a794cae0837537a452383`
- artifact: `9682819929`
- artifact name: `b09i-candidate-provenance-runtime-corpus`
- digest:
  `sha256:693df9ff04e32ea07656963c14eb715af44063d35d50dcc503197071ac5ea9d9`

The corpus is explicitly `SYNTHETIC_ACCEPTANCE_RUNTIME`, not customer
production traffic.

The exact runtime path was:

```text
product raw-sample persistence
  -> post-COMMIT raw-sample availability markers
  -> product observation / sensing read-model pipeline
  -> real HTTP recommendation generation
  -> persisted decision_recommendation_v1
```

The recommendation endpoint created no Approval, OperationPlan, Task, or
Receipt fact in that bounded call.

## What the persisted recommendation proves

The observed source fact provides:

- immutable `fact_id`;
- `decision_recommendation_v1` source type;
- tenant/project/group/field/season scope;
- candidate-like status `proposed`;
- top-level action type `IRRIGATE`;
- fact `occurred_at`;
- legacy `recommendation_id`;
- legacy `snapshot_id`;
- legacy `crop_stage`;
- legacy `evidence_refs`.

The same runtime corpus proves:

```text
candidate_decision_v1 fact count = 0
candidate_decision_v1 table      = absent
candidate_decision_index_v1      = absent
persisted candidate_id           = absent
```

## B-06c contract interpretation

The existing B-06c adapter
`projectLegacyRecommendationCandidateV1` requires an explicit projection
context.

Some fields are resolvable from the persisted source:

```text
source_ref  <- immutable source fact_id
source_type <- decision_recommendation_v1
scope       <- scoped source payload
created_at  <- fact occurred_at
```

The canonical `candidate_id` is different.

`CandidateDecisionV1` requires a non-empty `candidate_id`, and B-06c
requires that ID to be supplied by projection context. The analyzed runtime
path does not persist such an identity and the repository does not establish a
policy that permits deriving it from `recommendation_id` or `fact_id`.

Therefore B-09i must not invent one.

## Nullable basis refs are not the same as proven provenance

The CandidateDecision contract allows:

- `context_snapshot_ref = null`;
- `crop_stage_state_ref = null`;
- `calculation_result_refs = []`;
- `evidence_qualification_refs = []`;
- `decision_time = null`.

B-09i therefore does **not** claim that the legacy recommendation is
structurally impossible to project merely because those refs are absent.

But absence does not authorize legacy promotion.

The current source contains `snapshot_id`, `crop_stage`,
`evidence_refs`, and `created_ts`. B-06c already forbids treating those as
canonical Context, CropStage, EvidenceQualification, or canonical creation
time.

B-09i preserves that boundary.

## Prohibited promotions

B-09i explicitly forbids:

```text
recommendation_id -> candidate_id
fact_id           -> candidate_id
evidence_refs     -> EvidenceQualification refs
snapshot_id       -> ContextSnapshot ref
crop_stage        -> QualifiedCropStageState ref
created_ts        -> canonical created_at
```

The immutable `fact_id` may be used as `source_ref`.

The canonical `created_at` basis may be the persisted fact
`occurred_at`, as already required by B-06c compatibility semantics.

## The cross-route referential gap

B-09h lives on the Agronomy Judge evidence-shadow path.

Its criterion output remains:

```text
candidate_binding_state = NOT_BOUND
candidate_ref = null
```

The analyzed B-09i recommendation path has no proven referential edge to that
Agronomy Judge shadow.

This is not a naming problem. It is a semantic continuity problem.

B-07e derives the final candidate reference as:

```text
candidate_decision_v1:<candidate.candidate_id>
```

B-07e also requires:

1. every CandidateDecision EvidenceQualification ref to appear in canonical
   runtime inputs; and
2. every criterion support ref to be authorized by the candidate and canonical
   runtime inputs.

Without one canonical candidate identity and a proven join between the
candidate and criterion provenance, those continuity checks cannot be
satisfied responsibly.

## Readiness adjudication

For the analyzed formal/product recommendation path:

```text
canonical candidate identity policy       = MISSING
persisted canonical candidate identity     = MISSING
B-06c runtime projection connection        = NOT CONNECTED
B-09h criterion candidate binding          = NOT BOUND
proven recommendation -> B-09h join        = ABSENT
B-07e runtime connection readiness         = NOT READY
consumer migration                         = NOT PERFORMED
authority removal                          = NOT PERMITTED
```

## Repository effects

B-09i adds no:

- TypeScript runtime implementation;
- route;
- schema or database migration;
- workflow;
- CandidateDecision producer;
- Decision Eligibility producer;
- connectivity edge;
- Approval/Plan/Task/Receipt behavior;
- MCFT / ADR / LLM integration.

The Parallel Authority Graph and B-09 replacement-readiness inventory remain
byte-equivalent to B-09h.

All 29 grandfathered authority records remain unchanged.

The semantic ownership register changes only by appending two B-09i notes to
`decision.candidate`; its producer set, consumer set, guards, and authority
classification remain unchanged.

## Completion gate

B-09i is complete only when one exact product head proves:

- the machine-readable provenance inventory parses;
- runtime corpus identity/run/artifact/digest are exact;
- `decision_recommendation_v1` source fact provenance is resolvable;
- no persisted CandidateDecision identity exists on the analyzed path;
- B-06c still requires externally supplied canonical `candidate_id`;
- `recommendation_id` and `fact_id` are not promoted to candidate identity;
- legacy evidence/snapshot/stage/time fields are not promoted;
- B-09h remains candidate-unbound and runtime-disconnected;
- B-07e continuity requirements remain unchanged;
- no new CandidateDecision or criterion producer is registered;
- no graph or replacement-readiness mutation occurs;
- all 29 grandfathered authority records remain exact;
- no runtime/schema/workflow/MCFT/ADR/LLM path changes occur;
- general CI/full acceptance and the four MCFT boundary lanes pass.

## Next permitted step

Only after this inventory is accepted may a later B-Line step establish and
shadow-prove:

1. a canonical CandidateDecision identity policy for the chosen source path;
2. a bounded CandidateDecision projection/persistence or equivalent canonical
   identity seam; and
3. a referential binding from the relevant canonical criterion provenance to
   that same candidate.

Even then, the first connection must remain shadow-only. B-09i itself
authorizes neither B-07e runtime cutover nor historical authority removal.
