<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION.md -->
# GEOX MCFT-CAP-03 — S2 Semantic Conformance Remediation

## 1. Authority

```text
remediation_id:
MCFT-CAP-03.S2-SEMANTIC-CONFORMANCE-REMEDIATION-V1

baseline_main_commit:
55f2d56b05d2a1f0ada0e9b46eea5a3baa7187c2

activation_branch:
mcft-cap-03-s2-semantic-conformance-remediation-activation-v1

r1_implementation_branch:
mcft-cap-03-s2-semantic-conformance-v2-v1

r1_effectiveness_branch:
mcft-cap-03-s2-semantic-conformance-v2-effectiveness-v1
```

This remediation is additive governance over the frozen MCFT-CAP-03 task. It does not rewrite the task, historical V1 canonical facts, or already merged commit history.

Before the R0 activation PR merges and its merged-main Gate passes:

```text
R1 implementation = NOT_AUTHORIZED
S6 effectiveness = PAUSED
S7 = BLOCKED
S8 = BLOCKED
MCFT-CAP-04 = UNAUTHORIZED
```

## 2. Confirmed nonconformities

The following hard-acceptance defects are confirmed against current `main`.

### Hard Acceptance #32 — PT15M boundary

Current behavior truncates age to integer seconds before comparing with 900 seconds. This incorrectly admits observations aged from 900.001 through 900.999 seconds.

Required authority:

```text
logical_time_ms - observed_at_ms <= 900000
```

Exactly 900000 ms is usable. Any larger value is stale.

### Hard Acceptance #39 — conflicting duplicate detection

Current behavior performs physical-bound and FAIL-quality exclusion before semantic duplicate grouping. A conflicting record sharing one semantic identity can therefore be hidden before conflict detection.

Required order:

```text
canonical structure
scope / time / binding / supported type
semantic identity
semantic content hash
duplicate resolution
physical-bound eligibility
quality eligibility
latest usable selection
```

Different semantic content under one semantic identity must fail the entire tick closed. This includes PASS versus FAIL and in-range versus out-of-range content.

### Hard Acceptance #46 — independently recomputable semantic content hash

Current V1 selector hashes the complete source canonical payload but commits only `{ unit, value }` in the candidate trace. The committed candidate is therefore not sufficient to recompute the recorded hash.

The corrected V2 candidate must commit the complete canonical hash basis:

```text
canonical_payload
quality.status
source_unit
canonical_unit
conversion_rule
epistemic_class
```

A V2 validator must recompute the semantic content hash solely from the committed candidate payload and reject any mismatch.

### Hard Acceptance #58 — unsupported record type

An unsupported `record_type` is malformed canonical observation input, not an ordinary candidate exclusion.

Required behavior:

```text
MALFORMED_CANONICAL_OBSERVATION:UNSUPPORTED_RECORD_TYPE
```

The entire tick must fail closed before assimilation or persistence.

## 3. Versioning decision

The existing V1 contract and historical V1 readback are immutable.

Forbidden:

```text
expanding assimilated_continuation_contracts_v1 in place
reinterpreting historical V1 candidate payloads under V2 semantics
rewriting historical V1 canonical facts
changing historical V1 aggregate hashes
accepting unknown contract versions
```

Required:

```text
ADDITIVE_VERSIONED_V2
additive MCFT-CAP-03 assimilated continuation V2 contract
additive V2 selector and Evidence Window
V1 validator remains capable of reading historical V1 records
V2 validator recomputes the committed semantic content hash
unknown or mismatched versions fail closed
```

R1 is pure contract and application logic only. It does not write canonical facts or execute a Runtime tick.

## 4. Remediation graph

### R0 — Remediation Authority Freeze

Scope:

```text
record confirmed nonconformities
freeze V2 strategy
freeze R1 exact changed-file boundary
place S6 effectiveness on remediation hold
keep S7, S8, and MCFT-CAP-04 blocked
```

R0 may change only four governance files.

### R1 — S2 Versioned V2 Semantic Conformance

Scope:

```text
additive V2 candidate contract
V2 semantic hash recomputation validator
millisecond PT15M authority
semantic duplicate resolution before physical and quality eligibility
unsupported record type fail closed
positive and negative controlled fixtures
historical V1 compatibility proof
```

R1 must not change persistence, the eight-object aggregate, transaction families, routes, schedulers, web, workflows, successful Forecast behavior, or revision lineage.

### R2 — S3A through S6 V2 Revalidation and SSOT Reconciliation

R2 is not authorized by R0. Its exact boundary is frozen only after R1 effectiveness.

Required outcomes:

```text
versioned V2 builder and validator dispatch
historical V1 readback preservation
S3A, S3B, S4, S5, and S6 regression evidence under V2
recomputed V2 deterministic hashes in controlled fresh replay scopes
removal of obsolete top-level nonclaims
machine-readable Delivery Status reconciliation
no historical V1 fact rewrite
```

### R3 — S6 Postmerge Effectiveness Resume

R3 may begin only after R1 and R2 merged-main Gates pass.

Required outcomes:

```text
S6 implementation merge recorded
S6 merged-main restart/backfill/recovery Gate rerun
S6 effectiveness condition satisfied
S7 remains blocked until explicit activation
```

## 5. R1 frozen file boundary

```text
apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.ts
apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts
apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-OBSERVATION-ASSIMILATION-STATUS.json
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION-STATUS.json
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION.md
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION.cjs
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION_NEGATIVE.ts
scripts/runtime_acceptance/mcft_cap_03_s2_semantic_conformance_remediation_fixture_v1.ts
```

## 6. R1 hard acceptance

R1 must prove at least:

1. Exactly 15 minutes is usable.
2. 15 minutes plus 1 ms is stale.
3. Unsupported record type throws `MALFORMED_CANONICAL_OBSERVATION:UNSUPPORTED_RECORD_TYPE`.
4. Missing ID, hash, time, payload, and unknown quality continue to fail closed.
5. Same semantic identity and same content produce deterministic duplicate suppression.
6. Same semantic identity with different quality fails the whole selection.
7. Same semantic identity with different canonical value fails the whole selection, even when one value is physically invalid.
8. Duplicate input order cannot change the error or semantic result.
9. A committed V2 candidate independently recomputes its semantic content hash.
10. Any committed hash-basis field mutation is rejected.
11. V1 historical fixture validation remains unchanged.
12. R1 contains no persistence, migration, route, scheduler, web, workflow, canonical write, or tick execution.

## 7. Preserved boundaries

Throughout R0 through R3:

```text
NO_SUCCESSFUL_FORECAST
NO_FORECAST_RESIDUAL
NO_72_HOUR_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_DECISION
NO_AO_ACT
NO_CALIBRATION_CANDIDATE
NO_SHADOW_EVALUATION
NO_MODEL_ACTIVATION
NO_ACTIVE_MODEL_PARAMETER_CHANGE
NO_LATE_EVIDENCE_REVISION
NO_CONTINUOUS_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_CAP_03_COMPLETE_CLAIM
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

## 8. Effectiveness

R0 becomes effective only when:

```text
R0 activation PR merged to main
AND
merged-main S2 remediation activation Gate PASS
```

R1 becomes authorized only after that condition. No remediation implementation claim is effective on the activation branch.


## 9. R1 implementation candidate

```text
R1 implementation baseline = 9d9d218fa030bf38278be7e8877c4b98463ebfe5
R1 implementation branch = mcft-cap-03-s2-semantic-conformance-v2-v1
R1 implementation candidate = NOT_EFFECTIVE_UNTIL_MERGED_MAIN_GATE
V1 historical contract and readback = IMMUTABLE
V2 contract = MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2
V2 Evidence Window = MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V2
V2 selector = LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2
Hard Acceptance #32 remediation = IMPLEMENTED_CANDIDATE
Hard Acceptance #39 remediation = IMPLEMENTED_CANDIDATE
Hard Acceptance #46 remediation = IMPLEMENTED_CANDIDATE
Hard Acceptance #58 remediation = IMPLEMENTED_CANDIDATE
S6 effectiveness = PAUSED
S7 = BLOCKED
S8 = BLOCKED
MCFT-CAP-04 = UNAUTHORIZED
```

This R1 branch establishes only additive pure contract and application logic.
It does not activate V2 builder dispatch, persistence, canonical writes, Runtime
ticks, Forecast success, revision lineage, R2, R3, S7, S8, or MCFT-CAP-04.
