# GEOX B-05 Closure — B-09 Removal-Target Governance Correction V1

## 0. Status

Pure B-Line governance correction stacked on completed B-05d product head:

`1588ee403e905011d184888e7b79c3be4196c37e`

No runtime semantics are changed.

## 1. Defect

The original B-02 register used `removal_target` as if the same phase that builds a canonical replacement could also remove the historical authority.

Examples remained:

```text
evidence duplicate -> B-04
context/stage duplicate -> B-05
candidate/calculation duplicate -> B-06
eligibility precursor -> B-07
```

Amendment-01 later froze a stricter sequencing rule:

```text
B-09 is the only phase that may intentionally remove historical semantic authority.
```

Therefore the old register/graph meaning drifted from the later frozen sequencing contract.

## 2. Correct semantic split

```text
target_phase
= phase that builds/proves the canonical replacement or convergence boundary

removal_target
= phase that may actually remove historical semantic authority
= B-09
```

This preserves B-04/B-05/B-06/B-07 sequencing without authorizing premature deletion or authority transfer.

## 3. Register correction

Every `registered_producer` with `grandfathered_duplicate = true` now requires:

`removal_target = B-09`.

Its semantic `target_phase` remains unchanged.

## 4. Parallel graph correction

Every `current_parallel_edges[*].removal_target` is normalized to B-09.

The graph still describes current parallel authorities; it no longer implies that an earlier convergence phase may remove them.

## 5. Machine governance

B-02 linter now fails if a grandfathered producer or current parallel authority points removal anywhere other than B-09.

Failure families:

- `GRANDFATHERED_REMOVAL_TARGET_NOT_B09`
- `PARALLEL_REMOVAL_TARGET_NOT_B09`

## 6. Non-effects

No Stage-1, Evidence Judge, Context, crop-stage, Agronomy Rule/Judge/Agent/Decision Engine, operation-plan, MCFT, provider, scheduler, Formal, Twin persistence, schema, binding, CandidateDecision, Decision Eligibility, approval, AO-ACT, task, receipt or acceptance runtime behavior changes.

This correction does not perform B-09 authority removal.

## 7. B-05 closure implication

B-05 may establish Context/Stage contracts, compatibility adapters and UNKNOWN-preserving boundaries.

B-05 must not claim that historical field-program/stage-resolver/rule-engine authority has been removed. Those paths remain visible and grandfathered until B-09 prerequisites are demonstrated.
