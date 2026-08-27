# GEOX B-04 Completion Gap Closure V1

## 0. Status

B-Line bounded completion-gap correction stacked on B-04e completed head:

`7b11d8830c643698e4f45cc2ba909bb7ba7fccc0`

This document is not repository-level SSOT and does not authorize protected-main merge.

## 1. Why this correction exists

The frozen B-Line amendment requires B-04 mandatory fixtures to include:

```text
RH = 102.7 %
physically impossible soil-moisture value
missing observation
stale observation
source-unqualified observation
spatially limited observation
```

The B-04 overall audit after B-04e found that:

- RH 102.7% already had direct physical-QC coverage;
- physically impossible soil moisture already had direct physical-QC coverage;
- source-unqualified evidence already had canonical runtime coverage;
- OUT_OF_SCOPE evidence already had canonical runtime coverage;
- missing evidence was contract-safe but lacked an explicit B-04 zero-evidence sufficiency fixture;
- spatial LIMITED existed in the projector but lacked an explicit runtime fixture;
- canonical raw-sample projection did not yet emit `temporal_eligibility = STALE`.

Therefore B-04 could not be honestly declared complete.

## 2. Stale temporal qualification

The current raw-sample canonical projection is explicitly role-scoped to:

`STAGE1_FORMAL_EVIDENCE`.

This correction adds an optional `freshness_max_age_ms` input to that shadow projection.

The pure projector does not invent a freshness threshold when the value is absent.

Runtime callers bind the same existing Apple-II freshness policy already used by the compatibility path:

```text
freshness_max_age_ms
or
max(expected_sample_interval_ms * 2, 1 hour)
```

Temporal negative-evidence precedence remains conservative:

```text
future observation
-> FUTURE_RELATIVE_TO_DECISION

created after decision
-> NOT_AVAILABLE_AT_DECISION

older than bound freshness threshold
-> STALE

otherwise
-> marker-backed ELIGIBLE / conservative UNKNOWN
```

STALE is hard evidence-role ineligibility in accordance with the B-03 contract.

This remains shadow-only and does not change Stage-1 compatibility authority.

## 3. Spatially limited fixture

The existing projector already returns `spatial_authority = LIMITED` when field/tenant match but the requested scope does not assert complete project/group authority.

An explicit fixture now proves that spatially limited evidence:

- remains visible;
- is not upgraded to EXACT_SCOPE;
- remains evidence `LIMITED`;
- remains role `LIMITED`.

## 4. Missing observation fixture

The B-03 contract already forbids a MISSING qualification from referencing a fabricated observation or retaining qualified/eligible authority.

B-04e now also explicitly proves the runtime consumer-side case:

```text
zero canonical qualifications
-> NEEDS_EVIDENCE
-> no fabricated replacement observation
```

No default sensor value, state value, or substitute observation is created.

## 5. Non-effects

This correction does not:

- change the legacy Apple-II evidence_sufficiency verdict;
- change Stage-1 trigger authority;
- remove Evidence Judge authority;
- create Decision Eligibility;
- modify Context/Crop Stage;
- modify CandidateDecision;
- modify MCFT implementation, provider, scheduler, Formal, Twin persistence, schema, or binding;
- connect ADR or LLM;
- change approval, AO-ACT, task, receipt, or acceptance authority.

B-09 remains the only intentional historical authority-removal phase.
