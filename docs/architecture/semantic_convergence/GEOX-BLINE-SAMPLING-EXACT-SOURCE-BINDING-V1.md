# GEOX B-Line Sampling Exact-Source Binding V1

## Status

Status: **AUTHORIZED IMPLEMENTATION / P0-RES-010 CLOSURE**

Exact stacked base:

```text
#3446
0c28819ae58336d8881761febc995055b5e475a2
```

MCFT boundary:

```text
DO NOT MODIFY MCFT IMPLEMENTATION
```

This package closes the Sampling latest-wins authority defect recorded as `P0-RES-010`. It does not define a new temporal version-selection policy and does not modify MCFT State, Forecast, Scenario, persistence, runtime ownership, production hosting, scheduler, Formal stores, or candidate promotion.

This package does not define a supersession/current-version policy. Append history remains representable, but no row becomes authoritative merely because it is later.

## Identity model

Sampling facts are append/history capable. A business identifier is a consistency assertion; it is not sufficient authority for choosing one immutable fact when more than one fact can exist.

```text
sampling_plan_v1
business identity: plan_id
exact identity:    plan_fact_id

sample_receipt_v1
business identity: plan_id + sample_id
exact identity:    receipt_fact_id

lab_result_import_v1
business identity: sample_id + import_id
exact identity:    lab_fact_id

sampling_acceptance_v1
business identity: acceptance_id + plan_id + sample_id + import_id
exact identity:    acceptance_fact_id
```

Multiple historical Lab imports and repeated Sampling evaluations remain representable. This package does not invent `revision`, `supersedes`, `current`, or `effective` semantics.

## Frozen rule

```text
occurred_at is event/persistence metadata
occurred_at is not source-selection authority
ORDER BY occurred_at DESC LIMIT 1 is forbidden for formal Sampling source selection
```

Where an API or projection lacks an exact identity and more than one candidate is possible, the result must fail closed or become non-customer-visible/ambiguous. It must not silently select by recency.

## Exact chain

The formal chain is:

```text
exact sampling_plan_v1 fact
  -> sample_receipt_v1 freezes plan_fact_id
  -> lab_result_import_v1 freezes receipt_fact_id + plan_fact_id
  -> sampling_acceptance_v1 freezes plan_fact_id + receipt_fact_id + lab_fact_id
  -> downstream formal consumer binds the exact sampling_acceptance_v1 fact/chain
```

Required persisted fields:

```text
sample_receipt_v1
  receipt_id
  plan_fact_id

lab_result_import_v1
  receipt_fact_id
  plan_fact_id

sampling_acceptance_v1
  plan_fact_id
  receipt_fact_id
  lab_fact_id
```

## Route requirements

`POST /api/v1/sampling/receipt` requires `plan_fact_id` and proves that the exact plan fact matches `plan_id` and authenticated tenant/project/group/field scope.

`POST /api/v1/sampling/lab-result` requires `receipt_fact_id` and proves that the exact receipt fact matches `sample_id` and authenticated scope. The Lab fact inherits the exact plan binding from that receipt.

`POST /api/v1/sampling/acceptance/evaluate` requires `plan_fact_id`, `receipt_fact_id`, and `lab_fact_id`, plus the existing business IDs. All exact facts and their chain continuity must match before a verdict can be persisted.

Missing or mismatched exact identity is not converted into a new `INSUFFICIENT_EVIDENCE` Acceptance fact. The write fails closed.

## Report projection

Sampling report projection must not join independently selected “latest” Receipt, Lab, and Acceptance facts.

A customer-visible PASS requires one internally continuous exact chain. Ambiguous plan/receipt/lab/acceptance history without an exact chain is non-customer-visible and must expose a blocking reason rather than choosing by timestamp.

## Fertilization boundary in this package

This package may change the Fertilization `SAMPLING_LAB` consumer only as required to consume the exact Sampling chain.

It does **not** close `P0-RES-009`. Fertilization execution-zone assertions, Receipt/AsExecuted verification, and Fertilization Acceptance provenance remain a separate B-Line package.

## Non-effects

This package does not:

- make Sampling Acceptance equal operation success;
- make Lab PASS equal agronomy recommendation;
- define a supersession/current-version policy;
- create Recommendation, Approval, AO-ACT, execution, ROI, or Field Memory authority;
- modify MCFT implementation;
- close Fertilization `P0-RES-009`.

## Completion

P0-RES-010 may be marked closed only when one exact head proves:

```text
Sampling exact-source static governance gate PASS
Sampling contract gate                         PASS
Sampling API live gate                         PASS
Formal Sampling E2E                            PASS
Sampling report projection                     PASS
Fertilization Sampling consumer regression     PASS
Typecheck/build/server selfcheck               PASS
full acceptance                                PASS
Controlled Pilot / Commercial MVP0             PASS
MCFT implementation delta                      0
```
