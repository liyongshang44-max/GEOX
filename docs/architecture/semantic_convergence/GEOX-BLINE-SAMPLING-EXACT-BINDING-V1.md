# GEOX B-Line Sampling Exact Binding V1

## Status

Status: **IMPLEMENTATION CLOSED / EXACT QUALIFICATION PENDING**

Stacked base:

```text
#3446
0c28819ae58336d8881761febc995055b5e475a2
```

MCFT boundary:

```text
DO NOT MODIFY MCFT IMPLEMENTATION
```

This package closes the Sampling source-identity debt only. It does not close the independent Fertilization Acceptance provenance debt P0-RES-009.

## Problem

The active Sampling workflow previously relied on latest-wins fact selection:

```text
business id
-> ORDER BY occurred_at DESC
-> LIMIT 1
-> treat selected row as source authority
```

This affected:

- Sampling plan/receipt/lab lookups;
- Sampling Acceptance source selection;
- Sampling operation report projection;
- Fertilization `SAMPLING_LAB` formal assessment input.

A newer row could therefore silently replace the fact that an earlier semantic decision was supposed to reference.

## Exact identity chain

The repaired chain is:

```text
sampling_plan_v1 fact
-> sample_receipt_v1 fact
-> lab_result_import_v1 fact
-> sampling_acceptance_v1 fact
```

The exact plan fact identity is propagated through relation, receipt, lab result, and Acceptance.

### Plan

`plan_id` deterministically resolves to:

```text
sp_<plan_id>
```

No timestamp ordering is used.

### Receipt

`sample_id` is not treated as a fact identity.

`sample_id` is not declared globally unique by the frozen Sampling contract, so B-Line does not create such a policy.

Receipt semantic uniqueness is bounded by exact tenant/project/group + `sampling_plan_fact_id` + `sample_id`:

- the same `sample_id` may appear under a different Sampling Plan;
- a second receipt for the same exact plan + sample identity is rejected;
- receipt **fact identity** is deterministically derived from a canonical JSON tuple containing scope + exact plan fact + sample_id, so concurrent duplicate creation converges at the facts primary key;
- the externally returned `receipt_id` remains an opaque UUID.

Compatibility readers that only have `sample_id` may resolve it only when exactly one receipt exists in scope. Multiple matches are explicit ambiguity; they are never timestamp-ranked.

### Lab result

`import_id` is a business locator, not a globally unique fact identity.

New lab fact identity is deterministically derived from a canonical JSON tuple containing tenant/project/group, sample identity, exact receipt fact, exact plan fact, and `import_id`. The lab fact also persists the exact receipt and plan references. Historical `sl_<import_id>` facts remain readable through unique chain lookup; multiple matches fail closed.

If `import_id` is omitted, more than one candidate lab fact is an explicit ambiguity; no latest fallback is permitted.

### Sampling Acceptance

`sampling_acceptance_v1` persists:

- `sampling_plan_fact_id`;
- `sample_receipt_fact_id`;
- `lab_result_fact_id`.

Re-evaluating the same exact source chain is idempotent and returns the existing Acceptance identity.

The Acceptance **fact identity** is deterministically derived from a canonical JSON tuple containing the exact plan/receipt/lab chain plus scope/sample/import identity. The externally returned `acceptance_id` remains an opaque UUID. Concurrent evaluations converge on one fact identity; the loser reloads the committed row and returns the winner's `acceptance_id` with `idempotent=true`.

If historical data contains more than one Acceptance for the same exact chain, or the same exact chain would now produce a different verdict/reason set, the path fails closed.

## Report projection

`sampling_projection_v1.ts` is now explicitly registered as residual surface RES-305.

The report projection no longer selects latest relation/receipt/lab/Acceptance rows.

Ambiguity produces blocking reasons such as:

- `AMBIGUOUS_SAMPLING_OPERATION_RELATION`;
- `AMBIGUOUS_SAMPLE_RECEIPT_FOR_PLAN`;
- `AMBIGUOUS_LAB_RESULT_FOR_SAMPLE`;
- `AMBIGUOUS_SAMPLING_ACCEPTANCE_FOR_CHAIN`;
- `SAMPLING_EXACT_CHAIN_NOT_ESTABLISHED`.

`customer_visible_eligible=true` requires exact plan→receipt→lab→Acceptance continuity plus PASS lab quality and PASS Sampling Acceptance.

## Fertilization downstream binding

For `trigger_source=SAMPLING_LAB`, Fertilization now requires an explicit:

```text
sampling_acceptance_fact_id
```

The service exact-loads that Acceptance and then exact-loads the referenced plan, receipt, and lab facts.

It validates:

- tenant/project/group/field;
- sample identity;
- import identity;
- Sampling Acceptance PASS;
- exact plan fact continuity;
- exact receipt fact continuity;
- exact lab fact continuity;
- lab quality PASS.

Formal Fertilization evidence refs use fact identities, not sample/import business IDs.

This change only removes Sampling source ambiguity from Fertilization. It does **not** close P0-RES-009: Fertilization Acceptance still has a separate caller-supplied zone-application provenance debt.

## Runtime invariants

The package requires:

```text
no latest-wins Sampling authority selector
duplicate receipt for the same exact plan + sample -> 409
same sample_id on a different plan -> allowed
ambiguous sample_id-only lab locator -> 409 until sample_receipt_fact_id is supplied
historical receipt/lab/Acceptance ambiguity -> fail closed
lab import requires exact receipt -> exact plan continuity
repeat exact Sampling Acceptance -> same fact identity
concurrent duplicate receipt creation -> exactly one success + one duplicate conflict
concurrent exact Sampling Acceptance evaluation -> one shared fact/acceptance identity
report visibility requires exact chain
Fertilization SAMPLING_LAB -> exact sampling_acceptance_fact_id
```

## Non-effects

This package does not change:

- MCFT implementation or runtime ownership;
- Fertilization recommendation semantics;
- Fertilization prescription approval semantics;
- Fertilization Acceptance P0-RES-009;
- Receipt / AsExecuted execution authority;
- generic Acceptance authority;
- ROI;
- Formal Field Memory;
- Decision Eligibility;
- Forecast integration.

## Qualification required before COMPLETE

This package is not COMPLETE until the latest exact head passes:

- B-Line residual authority audit;
- B-Line active runtime surface closure;
- B-Line Sampling exact source binding gate;
- Sampling contract/API/formal E2E;
- Fertilization static/live/formal E2E regressions;
- TypeScript typecheck;
- build;
- server selfcheck;
- full acceptance;
- Controlled Pilot strict;
- Commercial MVP0;
- runtime hygiene;
- MCFT boundary qualification as read-only evidence only.
