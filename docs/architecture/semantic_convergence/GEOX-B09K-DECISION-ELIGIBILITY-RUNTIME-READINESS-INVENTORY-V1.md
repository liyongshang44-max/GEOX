# GEOX B-09k Decision Eligibility Runtime Readiness Inventory V1

## Status

B-09k is stacked exactly on completed B-09j product head:

`03490b4ce54cdb35f2a2965193ed87fdcab24523`.

B-09k is analysis/governance only.

It creates no runtime producer, no route, no schema, no graph edge, no Decision
Eligibility invocation, no consumer migration and no historical authority
removal.

## Why B-09k exists

B-09j established, for the bounded formal/product recommendation path:

```text
decision_recommendation_v1
  -> deterministic CandidateDecision identity
  -> exact canonical EvidenceQualification ref continuity
  -> B-09h QUALIFIED_EVIDENCE criterion bound to the same candidate
```

The B-09j shadow then remained disconnected from B-07e.

Its conservative readiness field said:

`NOT_READY_CANONICAL_EVIDENCE_OBJECTS_NOT_BOUND`.

B-09k audits whether that is the actual B-07e blocker.

It is not.

## Correction: B-07e consumes refs, not EvidenceQualification objects

The B-07e runtime input type carries:

```text
canonical_inputs.evidence_qualification_refs: string[]
```

It does not accept `EvidenceQualificationV1[]` as a runtime argument.

B-07e proves:

1. every CandidateDecision evidence-basis ref remains present in the canonical
   runtime EvidenceQualification ref set; and
2. every criterion support ref belongs to the allowed canonical input/basis
   union.

Therefore the absence of full EvidenceQualification objects inside the B-09j
shadow object is not, by itself, a B-07e interface blocker.

This does **not** weaken Evidence authority.

B-04 already exposes the shared canonical helper:

`buildCanonicalRawSampleEvidenceQualificationProjectionV1`

in:

`apps/server/src/domain/sensing/appleii_evidence_sufficiency_v1.ts`.

At a fixed decision boundary it reads persisted:

- `raw_samples`;
- post-COMMIT `raw_sample_runtime_available_v1` markers;

and deterministically rebuilds:

`RawSampleEvidenceQualificationProjectionBatchV1.qualifications: EvidenceQualificationV1[]`.

Qualification identity remains:

`evidence_qualification_v1:raw_sample:<sample_id>:<decision_time_ms>`.

Thus full canonical qualification objects are reconstructable from persisted
B-04 inputs when needed. B-07e itself consumes their canonical identities.

## What B-09j has actually made ready

Exact B-09j runtime proof:

- run: `33168228447`
- job: `98838685815`
- validation head: `5ba359e42ce8e7c8a38ad6023c44be7e58dfeda0`
- artifact: `9684515431`
- digest:
  `sha256:9b99dda859bf79c2256d2f2c350d3e7d00f5033b8d35a93076d5096c2c313c8e`

It proves:

```text
Candidate identity                    READY / shadow-bound
Candidate source/scope                READY / shadow-bound
canonical EvidenceQualification refs  READY / exact-set bound
QUALIFIED_EVIDENCE criterion          READY / shadow-bound
duplicate recommendation identity     fail-closed SOURCE_AMBIGUOUS
CandidateDecision persistence         0
downstream authority facts            0
B-07e runtime                         disconnected
```

The runtime corpus observed 72 canonical EvidenceQualification refs and
`QUALIFIED_EVIDENCE=SATISFIED`.

## The actual first blocker: there is no product eligibility policy

B-07d intentionally has no hidden default required-criterion set.

The evaluator requires an explicit:

```text
policy_ref
required_criteria
```

B-07e additionally requires:

`applicable_action_types`.

The B-07e contract test uses:

```text
QUALIFIED_EVIDENCE
CONTEXT
STATE
PERMISSION
ACTION_WINDOW
```

as its fixture policy.

That fixture is not a repository-wide default.

B-09k therefore forbids two shortcuts:

1. treating that test fixture as if it were the product policy; or
2. inventing a one-criterion `QUALIFIED_EVIDENCE` policy merely to make the
   current B-09j shadow callable by B-07e.

Until the bounded IRRIGATE path has an explicit product eligibility policy,
the system does not know which canonical criteria are mandatory.

That is the first unconditional blocker.

## Policy-dependent readiness gaps

Once a real policy exists, the current candidate path still has several
unresolved provenance families.

### Context

The B-09j Candidate carries:

`context_snapshot_ref = null`.

B-05b can project typed FieldProgram declared context into
`ContextSnapshotV1`, but remains:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

No B-09k runtime binding is performed.

### Crop stage

The B-09j Candidate carries:

`crop_stage_state_ref = null`.

B-05 deliberately refuses to promote legacy `crop_stage`.

The target crop-stage owner remains Twin Runtime using qualified Evidence plus
Context.

B-Line does not connect or modify MCFT to fill this gap.

### Calculation / STATE

The B-09j Candidate carries:

`calculation_result_refs = []`.

B-06b has a pure `CalculationResultV1` compatibility adapter, also as a
manual capability island.

B-07c requires non-empty canonical CalculationResult refs before it may project
WATER_DEFICIT/PASS into a `STATE` criterion.

Legacy Agronomy Judge calculation outputs cannot be promoted.

Therefore the STATE criterion is not runtime-ready on the analyzed path.

### Permission / ActionWindow / lifecycle

B-07e has canonical ref slots for Permission and ActionWindow, and B-07d
contains lifecycle consistency rules.

The analyzed product path establishes no B-Line canonical Permission or
ActionWindow provenance and no product-policy-bound lifecycle source.

B-09k does not synthesize any of them.

### Forecast / Scenario / Knowledge policy

These are policy-dependent canonical input families.

Forecast/scenario target authority remains outside this B-Line product path and
is not product-connected here. MCFT remains an external boundary and is not
touched.

B-09k does not assume these families are required or optional; the explicit
eligibility policy must decide that.

## Readiness adjudication

For the bounded formal/product IRRIGATE path:

```text
candidate identity                   READY_SHADOW_BOUND
canonical EvidenceQualification refs READY_SHADOW_BOUND
QUALIFIED_EVIDENCE criterion         READY_SHADOW_BOUND
full EvidenceQualification objects   RECONSTRUCTABLE / not B07e interface blocker

explicit product eligibility policy  MISSING
required criterion set               MISSING
policy applicable action types       MISSING

ContextSnapshot candidate binding    NOT BOUND
QualifiedCropStage candidate binding NOT BOUND
CalculationResult candidate binding  NOT BOUND
STATE criterion runtime readiness    NOT READY
Permission provenance                NOT ESTABLISHED
ActionWindow provenance              NOT ESTABLISHED
lifecycle-policy binding             NOT ESTABLISHED

B-07e runtime invocation              NOT READY
consumer migration                   NOT PERFORMED
authority removal                    NOT PERMITTED
```

The ordering matters.

The next step is not “wire every possible criterion”.

The next step is to establish the explicit product eligibility policy for the
bounded action path. Only that policy can say which canonical criteria and
input families must then be shadow-bound.

## Repository effects

B-09k changes no:

- TypeScript runtime;
- route;
- database/schema;
- workflow;
- Parallel Authority Graph;
- B-09 replacement readiness;
- CandidateDecision producer set;
- Decision Eligibility producer set;
- criterion producer set;
- Approval/Plan/Task/Receipt behavior;
- MCFT implementation;
- ADR/LLM integration.

The semantic ownership register receives notes only.

All 29 grandfathered authority records remain unchanged.

## Completion gate

B-09k is complete only when one exact product head proves:

- machine-readable readiness inventory parses;
- B-09j exact runtime anchor is locked;
- B-07e consumes canonical EvidenceQualification refs rather than full objects;
- B-04 shared canonical reader reconstructs EvidenceQualificationV1 objects from
  persisted raw sample/availability evidence;
- B-07d still has no hidden required-criterion default;
- B-07c still requires canonical CalculationResult refs for STATE projection;
- B-05b Context and B-06b Calculation adapters remain capability islands;
- no product eligibility policy is invented;
- B-07e remains disconnected;
- no Candidate/criterion/final eligibility producer set changes;
- graph and B-09 replacement readiness remain byte-equivalent;
- all 29 grandfathered authorities remain exact;
- no runtime/schema/workflow/MCFT mutation occurs;
- B-02 governance PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- four MCFT boundary lanes PASS.

## Next permitted step

Establish and shadow-prove explicit product eligibility policy provenance for
the bounded IRRIGATE path:

```text
policy_ref
required_criteria
applicable_action_types
lifecycle/action-window semantics where required
```

Only after that policy exists may later B-Line work bind the criteria it
actually requires.

B-09k does not authorize a B-07e runtime call, consumer migration, or historical
authority removal.
