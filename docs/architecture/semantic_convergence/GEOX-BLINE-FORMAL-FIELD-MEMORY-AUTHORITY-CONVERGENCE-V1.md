# GEOX B-Line Formal Field Memory Authority Convergence V1

## Status

Status: **IMPLEMENTATION CLOSED / EXACT QUALIFICATION PENDING**

Exact stacked base:

```text
#3445
b9a01f89541ee1a200202cae30baca02f5f96156
```

MCFT boundary:

```text
DO NOT MODIFY MCFT IMPLEMENTATION
```

This package converges one B-Line debt family: Formal Field Memory authority. It does not redefine MCFT State, Forecast, Scenario, persistence, runtime ownership, production hosting, scheduler, Formal stores, or candidate-promotion semantics.

## Authority ordering

Repository authority layering remains:

```text
docs/SSOT.md
-> README_MIGRATION.md
-> later frozen P26-P31 contracts
-> B-Line semantic-convergence governance
-> implementation/runtime proof
```

The older H58 Field Memory boundary remains useful as historical product context, but where it conflicts with later frozen P26-P31 semantics, the later frozen chain controls.

## Frozen chain

The materialization path now requires:

```text
P26-compatible formal Acceptance
-> P27 outcome_review_v1 (REVIEWED)
-> P27 roi_boundary_v1 (roi_review_eligible=true)
-> P28 roi_ledger_v1 (RECORDED + exact accounting basis)
-> P29 field_memory_candidate_v1 (CANDIDATE_RECORDED + independent memory basis)
-> P30 field_memory_record_v1 (RECORD_COMMITTED + reviewed promotion basis)
-> same-field Formal Field Memory materialization
```

The P27/P28/P29/P30 controlled runners remain frozen governance fixtures. This package does not invoke those runners as product services and does not create their authority.

## Runtime-use boundary

P30 says a committed `field_memory_record_v1` does not itself authorize arbitrary runtime use.

This package therefore requires:

```text
record_scope = same_field_only
reuse_boundary.scope = same_field_only
```

and explicitly blocks:

```text
record_scope = review_only_no_runtime_use
```

The materializer is a customer/report memory projection only. It does not invoke the P31 Twin state-estimation runtime, does not parse the record as estimator training data, and does not update or activate a model.

`learning_eligible=true` remains an eligibility label on the historical Field Memory product contract; it is not model-update authority. Any model update still requires a separate governed gate.

## Repairs in this package

### 1. Acceptance authority narrowed

`POST /api/v1/acceptance/evaluate` no longer writes Formal Field Memory as a PASS side effect.

```text
Acceptance -> acceptance_result_v1
```

Acceptance is necessary provenance, never sufficient memory authority.

### 2. Canonical materializer proof-gated

`POST /api/v1/field-memory/from-acceptance` remains a compatibility entrypoint, but now requires `field_memory_record_ref` and exact scope/identity continuity through the full P26-P30 chain.

It fails closed for missing or ambiguous record identity, Acceptance mismatch, operation/task/field mismatch, missing or unreviewed Outcome evidence, missing or ineligible ROI boundary, non-RECORDED ROI ledger, missing or invalid accounting basis, blocked P29/P30 basis, forbidden basis reuse, debug/simulated source lanes, review-only records, and non-same-field reuse scope.

### 3. Legacy Twin writers retired

Both active legacy Twin Field Memory routes retain compatibility/human audit surfaces but no longer directly `INSERT field_memory_v1`.

They delegate to the same canonical proof-gated materializer.

### 4. Scope fabrication removed

Current/fresh schema paths no longer manufacture:

```text
project_id = projectA
group_id = groupA
```

for Field Memory. A forward migration drops existing column defaults without rewriting historical migration records.

### 5. Controlled Pilot / C8 upgraded

C8 now seeds a controlled, explicitly pre-authorized proof chain containing P27 outcome review, P27 ROI boundary, P28 ROI ledger plus accounting basis, P29 candidate plus independent memory basis, and P30 same-field committed record plus independent promotion basis.

The product route consumes these facts but does not create them.

Runtime negatives prove another Acceptance cannot reuse the committed proof, `review_only_no_runtime_use` cannot materialize product Formal Field Memory, and a candidate missing the P27/P28 source chain cannot materialize product Formal Field Memory.

## Non-effects

This package does not change Receipt / AsExecuted authority, Acceptance verdict computation, ROI product economics outside the proof chain, technical skill/execution memory lanes, Approval, AO-ACT, execution, dispatch, Decision Eligibility, Forecast integration, MCFT implementation, or P27/P28/P29/P30/P31 frozen runners/contracts.

## Qualification required before COMPLETE

The package is not COMPLETE until the latest exact head passes residual authority audit, active runtime surface closure, operation-state read-only, execution lifecycle, evidence-export boundary, operator-dispatch intent, all four new Formal Memory B-Line gates, TypeScript typecheck, build, server selfcheck, full acceptance, Controlled Pilot strict, Commercial MVP0, runtime hygiene, and MCFT boundary qualification without any MCFT implementation change.
