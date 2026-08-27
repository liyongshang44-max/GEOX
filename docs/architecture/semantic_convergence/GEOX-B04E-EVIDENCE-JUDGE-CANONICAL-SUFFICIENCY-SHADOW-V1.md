# GEOX B-04e Evidence Judge Canonical Sufficiency Shadow V1

## 0. Status

B-Line bounded implementation proposal.

Stacked on B-04d4 completed product head:

`730bc7d0fc386aaffad5a83c3548a4c4c849469e`

This document is not repository-level SSOT and does not authorize protected-main merge.

## 1. Purpose

B-04e implements the Evidence Judge side of Evidence Runtime convergence.

The frozen B-Line amendment requires:

```text
Evidence Judge
-> problem-specific sufficiency facade over canonical qualification,
not a second raw physical-truth engine
```

The existing `evaluateEvidenceJudgeV2` is retained as compatibility authority until B-09. It still runs historical soil-moisture quality and freshness skills.

B-04e adds a separate runtime shadow path that consumes persisted canonical `EvidenceQualificationV1` and performs only problem-level sufficiency aggregation.

## 2. Runtime path

```text
persisted raw_samples + post-COMMIT availability marker
  -> Apple-II canonical EvidenceQualification projection
  -> evaluateEvidenceJudgeCanonicalSufficiencyShadowV1
  -> Evidence Judge output shadow
```

The route uses `evaluateEvidenceJudgeV2WithCanonicalShadow(pool, body)`.

The canonical shadow is persisted inside the existing Judge result `outputs`, but it is marked:

```text
authority_mode = SHADOW_NON_AUTHORITATIVE
```

## 3. No raw truth recomputation in the canonical facade

The canonical sufficiency facade does not inspect:

- raw soil-moisture numeric ranges;
- observation age;
- heartbeat age;
- physical thresholds;
- source allowlists;
- spatial scope rules;
- conflict detection rules.

Those dimensions must already be represented by `EvidenceQualificationV1`.

## 4. Sufficiency semantics

For the currently projected role `STAGE1_FORMAL_EVIDENCE`:

- no qualifications -> `NEEDS_EVIDENCE`;
- at least one role-eligible qualification -> `SUFFICIENT`;
- qualifications exist but none are role-eligible -> `NEEDS_EVIDENCE`.

An invalid evidence item does not automatically make the problem insufficient when independent role-eligible evidence remains.

This is evidence-level sufficiency only. It does not create action-level Decision Eligibility or `BLOCK`.

## 5. Compatibility and B-09 boundary

B-04e does not remove historical Evidence Judge authority.

The legacy verdict, severity, reasons, skill traces, and source refs remain unchanged by the canonical shadow.

If the canonical read/build fails, the shadow becomes `UNKNOWN` and the legacy verdict remains unchanged.

Per the frozen amendment, B-09 remains the only phase allowed to perform:

```text
legacy/canonical shadow comparison
-> semantic divergence inventory
-> consumer migration
-> remove legacy authority
```

Accordingly, the B-02 removal targets for `stage1-formal-gate` and `evidence-judge-v2` are corrected to B-09.

## 6. Governance

A new registered runtime consumer is added:

`evidence-judge-canonical-sufficiency-shadow`

with connectivity edge:

`C-033`

from:

`canonical-evidence-qualification-shadow`

to the Evidence Judge canonical sufficiency shadow.

No new Evidence Qualification owner is created.

## 7. Non-effects

B-04e does not:

- change Stage-1 trigger authority;
- change legacy Evidence Judge verdict authority;
- create Decision Eligibility;
- change Context/Crop Stage;
- change CandidateDecision;
- modify MCFT implementation or authority;
- connect ADR or LLM;
- change approval, AO-ACT, task, receipt, or acceptance authority.
