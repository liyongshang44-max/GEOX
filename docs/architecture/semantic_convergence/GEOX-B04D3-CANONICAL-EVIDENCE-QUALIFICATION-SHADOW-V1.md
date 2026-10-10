# GEOX B-04d3 Canonical Evidence Qualification Shadow V1

## 0. Status and exact base

Status: **implementation candidate**

Exact stacked base:

```text
B-04d2r1 COMPLETE
7306e9bad103b1284fbab0f6e280d47ec53fe6af
```

B-04d3 is the first runtime projection of the B-03 `EvidenceQualificationV1` vocabulary onto the active raw-sample / Apple-II / Stage-1 path.

It is deliberately **shadow-only and non-authoritative**.

B-04d3 does not transfer Stage-1 trigger authority to the new projection.

---

## 1. Purpose

The repository already has established evidence dimensions in separate bounded seams:

```text
raw source class
caller measurement quality
shared physical QC
request/sample scope
Apple-II conflict result
event time
raw_samples.created_at
decision time
```

B-04d3 maps those existing decisions into the B-03 contract:

```text
EvidenceQualificationV1
```

without introducing another independent evidence classifier.

The target question is:

> Can the current evidence semantics be represented in one canonical typed object without changing the existing production verdict path?

For B-04d3 the answer must be demonstrated in shadow mode before authority migration.

---

## 2. Canonical projector

Runtime module:

```text
apps/server/src/evidence/raw_sample_evidence_qualification_projection_v1.ts
```

The projector consumes already-established inputs:

```text
source_formal_eligible
RawSampleObservationQualityDecisionV1
RawSampleStage1PhysicalQcDecisionV1
Apple-II conflict state
requested scope
sample scope
event time
raw row created_at
decision time
```

and emits validated:

```text
EvidenceQualificationV1
```

through:

```text
evidenceQualificationV1Schema.parse(...)
```

The projector does not own:

- metric physical ranges;
- raw source normalization;
- caller-QC interpretation;
- Apple-II conflict detection;
- decision eligibility;
- approval or execution.

Those inputs remain owned by their existing B-04 seams during B-04d3.

---

## 3. Shadow authority boundary

The batch wrapper is explicitly:

```text
schema_version = raw_sample_evidence_qualification_projection_v1
authority_mode = SHADOW_NON_AUTHORITATIVE
role = STAGE1_FORMAL_EVIDENCE
```

and carries the limitation:

```text
DO_NOT_USE_FOR_STAGE1_TRIGGER_ELIGIBILITY_YET
```

Apple-II attaches this projection to:

```text
evidence_sufficiency_v1
  .canonical_evidence_qualification_projection_v1
```

while preserving the existing Apple-II `evidence_sufficiency` verdict as the current compatibility authority.

Stage-1 exposes the projection through its debug surface, but:

```text
evaluateFormalStage1TriggerGateV1(...)
```

does not read the shadow projection for eligibility in B-04d3.

A negative shadow qualification must therefore not change an otherwise identical legacy Stage-1 gate result.

---

## 4. Temporal authority is intentionally incomplete

B-04d2r1 proved a useful negative time boundary:

```text
raw_samples.created_at > decision_time
=> NOT_AVAILABLE_AT_DECISION
```

However:

```text
raw_samples.created_at
```

is the row creation timestamp inside the append transaction.

It is **not** exact post-COMMIT visibility evidence.

Therefore B-04d3 must not make this invalid promotion:

```text
created_at <= decision_time
=> exact available_to_runtime_at established
=> temporal ELIGIBLE
```

For an otherwise-good row whose `created_at` is not after the decision:

```text
temporal_eligibility = UNKNOWN
reason = POST_COMMIT_RUNTIME_AVAILABILITY_NOT_ESTABLISHED
```

The qualification can therefore be `LIMITED`, but not fully `QUALIFIED`, solely from the current raw-sample storage semantics.

This is intentional fail-closed representation of missing temporal authority.

---

## 5. Qualification mapping

### Source authority

```text
formal source policy true  -> QUALIFIED
formal source policy false -> UNQUALIFIED
```

This is a projection of the existing source policy result, not a new source-policy engine.

### Physical validity

```text
B-04 physical QUALIFIED          -> PASS
B-04 physical INELIGIBLE_INVALID -> FAIL
legacy / unknown classification  -> UNKNOWN
```

### Spatial authority

Exact tenant/project/group/field agreement can project:

```text
EXACT_SCOPE
```

A mismatch projects:

```text
OUT_OF_SCOPE
```

Missing dimensions remain `UNKNOWN` or `LIMITED`; they are not fabricated.

### Conflict state

Only the current Apple-II conflict result is projected.

B-04d3 does not create a second conflict detector.

### Role eligibility

The initial role is:

```text
STAGE1_FORMAL_EVIDENCE
```

Invalid source/quality/physical/time/scope/conflict dimensions can project `INELIGIBLE`.

Unresolved temporal authority or other bounded uncertainty projects `LIMITED` / `UNKNOWN`.

Because exact runtime availability is not established, B-04d3 must not create a fully authoritative Stage-1 `ELIGIBLE` result.

---

## 6. Runtime visibility

Current bounded path:

```text
raw_samples
  -> existing Apple-II source/quality/physical/conflict logic
  -> projectRawSampleEvidenceQualificationV1(...)
  -> EvidenceQualificationV1[] shadow batch
  -> evidence_sufficiency_v1 attachment
  -> Stage-1 debug visibility
```

Current authoritative gate remains:

```text
existing Apple-II compatibility sufficiency
  -> existing Stage-1 evidence gate
```

No authority transfer occurs in B-04d3.

---

## 7. Machine ownership registration

B-02 registers:

```text
producer:
  canonical-evidence-qualification-shadow

consumers:
  appleii-canonical-evidence-shadow
  stage1-canonical-evidence-shadow-debug

runtime edges:
  C-031
  C-032
```

and static guard:

```text
G-B02-10-canonical-evidence-qualification-projector
```

Only the registered canonical projector may directly instantiate runtime `EvidenceQualificationV1` via:

```text
evidenceQualificationV1Schema.parse
```

unless the ownership register is explicitly amended.

---

## 8. Required negative invariants

B-04d3 must prove:

```text
raw evidence retained
physical FAIL -> qualification INELIGIBLE
non-formal source -> source UNQUALIFIED
scope mismatch -> OUT_OF_SCOPE
future event -> FUTURE_RELATIVE_TO_DECISION
created after decision -> NOT_AVAILABLE_AT_DECISION
missing/insufficient availability proof -> temporal UNKNOWN
created_at <= decision does NOT imply temporal ELIGIBLE
shadow INELIGIBLE does NOT change Stage-1 gate authority
shadow projector does NOT create Decision Eligibility
shadow projector does NOT create approval/task/execution authority
```

---

## 9. Non-effects

B-04d3 does not:

- modify MCFT State / Forecast / Scenario semantics;
- modify MCFT-CAP-09 production hosting;
- activate ADR;
- connect an LLM;
- change crop/context authority;
- modify Agronomy Agent;
- replace Evidence Judge;
- create Decision Eligibility;
- change approval, operation-plan, AO-ACT, receipt or acceptance authority;
- change Stage-1 trigger semantics;
- claim exact `available_to_runtime_at` from `raw_samples.created_at`;
- make the new qualification projection authoritative.

---

## 10. Completion gate

B-04d3 is COMPLETE only when one exact head proves:

```text
EvidenceQualificationV1 projector contract fixtures   PASS
physical/source/scope/time negative fixtures           PASS
no fabricated temporal ELIGIBLE                       PASS
Apple-II shadow projection integration                 PASS
legacy Apple-II sufficiency behavior preserved         PASS
Stage-1 shadow visibility                              PASS
Stage-1 gate non-authority equivalence                 PASS
B-04d2r1 exact SQL placeholder regression              PASS
B-04d1/B-04c/B-04b/B-04a regressions                  PASS
B-02 semantic contract linter                          PASS
unknown_unclassified_production_edge = 0               PASS
server typecheck                                       PASS
general CI                                             PASS
existing MCFT governance/release lanes                 PASS
```

No completion statement may be made from focused tests alone.

---

## 11. Next frontier after B-04d3

B-04d3 should be followed by a bounded availability-authority phase, not immediate Stage-1 authority transfer.

The next design question is:

> What durable append-only evidence proves when a source observation became visible to the runtime after commit?

The next phase should first audit existing telemetry durable-raw / post-commit patterns and then establish an explicit availability authority, for example through a governed post-COMMIT marker or equivalent persisted visibility fact.

Only after that authority exists should GEOX perform:

```text
legacy Apple-II qualification
        vs
canonical EvidenceQualificationV1
        -> shadow comparison
        -> divergence inventory
        -> authority-transfer gate
```

Stage-1 must not consume the canonical projection as authoritative before those prerequisites are satisfied.
