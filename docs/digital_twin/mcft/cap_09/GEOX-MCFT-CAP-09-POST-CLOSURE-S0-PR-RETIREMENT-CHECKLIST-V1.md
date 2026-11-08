# GEOX MCFT CAP-09 — Post-Closure S0 / Historical PR Retirement Checklist V1

Status: **PREPARED / DO NOT EXECUTE BEFORE EFFECTIVE CAP-09 CLOSURE**

This checklist is subordinate to the actual CAP-09 terminal closure evidence.
It does not close, merge, relabel, or mutate any PR during Formal-v5.

## 1. Entry gate

Do not begin S0 retirement until all are machine-proven:

- O00–O23 actual UTC completed;
- automatic final readback PASS;
- final read-only completion adjudication PASS;
- CAP-09 completion/closure is effective under the governing chain;
- protected main is re-read after closure.

Then create S0 from the exact closure main. Do not use any historical PR head as
a successor base.

## 2. PRs excluded from blanket retirement

These require special handling:

| PR | Disposition |
| --- | --- |
| #3298 | KEEP through closure as the dedicated historical handoff PR. After terminal checkpoint is prepended to the existing active continuation, close under handoff policy; never merge merely to retire it. |
| #3659 | CARRY_FORWARD_REBASE_REQUIRED. Recreate/rebase Field-State Authority successor design on exact closure main, bind terminal CAP-09 authority/evidence, then perform formal S0 audit. |
| #3658 | HOLD / S6_REEVALUATION. Product side lane stays Draft during CAP-09; after closure evaluate against the Field-State successor and Product Projection boundary. |
| #3657 | Likely SUPERSEDED_BY_3658; verify no unique changes before close. |
| #3528 | HISTORICAL_PREDECESSOR_CONCEPTS_CARRIED_FORWARD. Real-target subject/geometry invariants were absorbed into #3659 design; old base must not be used directly. |

## 3. Current-crop refresh / rolling qualification history

Expected post-closure disposition: **HISTORICAL_EVIDENCE_ONLY or
SUPERSEDED_BY_MAIN; CLOSE_WITHOUT_MERGE after exact-main ancestry/content
verification.**

PRs:

```text
#3647  fresh current-crop refresh 2026-10-04 qualification carrier
#3622  September 21 current-crop authority graduation
#3552  September 11 current-crop refresh
#3546  rolling crop governance from registry
#3545  September 10 effective crop materialization v3
#3544  September 10 fresh crop source lock v3
#3542  September 10 fresh crop materialization
#3541  September 10 source completeness v2
#3534  September 10 source completeness v1
#3531  rolling current-crop qualification output path
```

Required verification before close:

- no unique authority artifact exists only on the stale branch;
- any effective authority is already present on closure main or superseded by a
  later effective registry entry;
- no stale PR should be merged just to preserve history;
- PR Conversation may link the final closure/S0 retirement record.

## 4. T0 / QCP / FDG / qualification-convergence history

Expected disposition: **HISTORICAL_EVIDENCE_ONLY / SUPERSEDED_BY_MAIN /
CLOSE_WITHOUT_MERGE. Runtime reopening forbidden unless S0 finds a concrete
missing invariant.**

```text
#3638  DA09 exact requalification evidence closure control
#3637  DA09 exact-run qualification evidence binding
#3635  frozen Runtime integration probe
#3634  immutable MinIO mirror preflight
#3632  Runtime Hardening / FDG closure
#3631  Failure Discovery Gate v1
#3616  real-clock rehearsal crop fixture isolation
#3608  Formal-v5 writer-owner management grants
#3600  Formal-v5 local actual-arm successor
#3586  live-owner reattestation in arm readiness
#3563  exact-main thermal transport timeout diagnostic
#3551  blocker failure deferral to final proof
#3508  d17f production-owner read-only requalification
```

Specific preliminary rulings:

- #3631/#3632/#3635: HISTORICAL_EVIDENCE_ONLY; do not reopen frozen Runtime.
- #3600/#3586: SUPERSEDED by actual owner cutover + actual Formal-v5 arm +
  post-arm revalidation.
- #3608/#3546: verify the effective successor content is already in closure
  main; never merge stale heads.
- #3563: diagnostic history only.
- #3551: historical QCP control-plane work only after QCP convergence.

## 5. Biological-stage / Twin V2 predecessor stack

These are old stacked branches from the September 3 convergence line. Expected
disposition is **SUPERSEDED_BY_MAIN / CLOSE_WITHOUT_MERGE** after a compact
ancestry/content audit.

```text
#3491 #3490 #3489 #3488 #3487 #3486 #3485 #3484
#3483 #3482 #3481 #3480 #3479 #3478 #3477 #3476
#3474 #3473 #3472 #3471 #3470 #3468 #3467 #3466
#3465 #3464 #3463 #3462 #3461 #3460 #3459 #3458
#3457 #3456
```

Do not merge the stack in sequence. Its semantics have already been converged
through later protected-main successors. S0 must only prove whether any
still-required invariant is absent from closure main.

## 6. Original CAP-09 implementation stack

Expected disposition: **HISTORICAL_IMPLEMENTATION_LINE /
SUPERSEDED_BY_MAIN / CLOSE_WITHOUT_MERGE**.

```text
#3376  engineering readiness / producer harness migration
#3364  Phase7 private candidate fenced promotion
#3362  Phase7 private candidate I/O
#3359  Phase7 Evidence forcing ownership
#3356  fresh Formal-v5 preparation
#3351  retire GitHub production execution ownership
#3342  Phase5 qualification control plane
#3323  Phase5 production-equivalent containers
#3319  Phase5 accelerated 24T
#3315  Phase4 Twin Runtime persistence
#3308  Phase3 durable Evidence Runtime
#3299  Phase2a Evidence provider seams
```

These branches must not be used as post-closure development bases.

## 7. S0 exact procedure

After closure:

1. Read exact protected-main SHA and bind the S0 audit to it.
2. Re-read #3298 terminal handoff checkpoint.
3. Re-read #3659, then recreate/rebase successor design from closure main.
4. Enumerate every still-open MCFT/CAP-09 PR again; do not trust this static
   inventory if the set changed.
5. For each historical PR compute:
   - merge-base with closure main;
   - ahead/behind;
   - changed paths;
   - whether every changed semantic surface is already present/superseded;
   - whether it contains immutable evidence not already referenced elsewhere.
6. Assign exactly one final disposition:
   - `SUPERSEDED_BY_MAIN`
   - `HISTORICAL_EVIDENCE_ONLY`
   - `CLOSE_WITHOUT_MERGE`
   - `CARRY_FORWARD_REBASE_REQUIRED`
7. No historical branch may be merged merely to make the open-PR count smaller.
8. Close only after the classification artifact is frozen and independently
   re-read.
9. Then begin successor S1 only from closure main / adjudicated successor base.

## 8. S0 required outputs

Minimum S0 outputs:

- exact closure-main SHA;
- terminal CAP-09 authority/evidence refs;
- complete open MCFT PR inventory;
- per-PR final disposition;
- carry-forward changed-path inventory;
- proof that frozen Runtime is not silently reopened;
- successor design rebase status;
- Product #3658/#3657 disposition;
- resulting frontier = Field-State Authority S1 or explicit HOLD.

## 9. Non-effects during current Formal-v5 window

As of preparation:

```text
historical PR closed       0
historical PR merged       0
successor PR merged        0
Product PR merged          0
Runtime mutation           0
database/schema mutation   0
deployment                 0
```
