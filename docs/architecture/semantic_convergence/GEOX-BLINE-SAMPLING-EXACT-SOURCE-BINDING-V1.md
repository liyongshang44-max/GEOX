# GEOX B-Line Sampling Exact Source Binding V1

## Status

Status: **IMPLEMENTATION PREPARED / EXACT QUALIFICATION PENDING**

Stacked base:

```text
#3446
0c28819ae58336d8881761febc995055b5e475a2
```

MCFT boundary:

```text
DO NOT MODIFY MCFT IMPLEMENTATION
```

## Problem

The active Sampling runtime previously selected source facts with:

```text
ORDER BY occurred_at DESC
LIMIT 1
```

This affected Sampling service lookups, operation-report projection, and the Fertilization `SAMPLING_LAB` formal trigger.

That behavior allowed time ordering to act as implicit source authority.

## Exact identity model

The closure uses the identities already present in the product contract where possible:

```text
plan_id
-> exact sampling_plan fact_id = sp_<plan_id>

tenant/project/group + sample_id
-> exactly one active sample_receipt_v1
-> deterministic receipt identity policy:
   SAMPLE_RECEIPT_SCOPE_SAMPLE_SHA256_V1

import_id
-> exact lab_result fact_id = sl_<import_id>

exact plan fact
+ exact receipt fact or explicit missing state
+ exact lab fact or explicit missing state
-> deterministic sampling_acceptance_v1
   policy = SAMPLING_ACCEPTANCE_EXACT_CHAIN_V1
```

Repeated evaluation of the same exact source chain is idempotent and returns the same Acceptance identity.

## Fail-closed rules

The active runtime must not select a latest source when:

- one scoped `sample_id` maps to more than one receipt;
- one report operation maps to more than one Sampling relation;
- one plan maps to more than one receipt for the single-sample report projection;
- one report chain maps to more than one Sampling Acceptance;
- a lab result is not bound to the exact receipt fact;
- a Sampling Acceptance is not bound to the exact plan / receipt / lab facts.

Ambiguity blocks customer-visible eligibility instead of choosing a source.

## Fertilization boundary

Formal `SAMPLING_LAB` Fertilization may consume Sampling evidence only when:

```text
exact lab_result_import_v1 fact
-> exact sample_receipt_v1 fact
-> exact PASS sampling_acceptance_v1
   bound to that same lab fact and receipt fact
```

Fertilization does not own Sampling source selection and does not recreate latest-wins semantics.

This package does not otherwise redesign Fertilization recommendation, prescription, approval, execution, or fertilization acceptance authority.

## Audit correction

The independent audit found an omitted active surface:

```text
apps/server/src/services/sampling/sampling_projection_v1.ts
```

It is directly called by `reports_v1.ts` and computes Sampling customer-visible eligibility. It is now registered as `RES-305`.

## Runtime proof required before COMPLETE

The exact head must pass:

- B-Line residual authority audit;
- B-Line active runtime surface closure;
- B-Line Sampling exact source binding gate;
- Sampling contract gate;
- Sampling live API;
- Formal Sampling E2E;
- Sampling report projection;
- Fertilization static/live/Formal E2E regressions;
- TypeScript typecheck;
- build;
- server selfcheck;
- full acceptance;
- Controlled Pilot / Commercial MVP0 regressions;
- MCFT boundary qualification as read-only evidence only.
