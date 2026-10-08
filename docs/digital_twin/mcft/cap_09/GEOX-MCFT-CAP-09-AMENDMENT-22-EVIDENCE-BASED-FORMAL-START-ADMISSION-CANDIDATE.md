# GEOX MCFT CAP-09 Amendment-22 — Evidence-Based Formal Start Admission (Candidate)

**Status: DRAFT — NOT EFFECTIVE. DO NOT MERGE OR EXECUTE WHILE THE CURRENT FORMAL-v5 ARM REMAINS VALID.**

**Proposed successor to:** Amendment-06's fixed 36-hour epoch lead and fixed `O00 - 12h` readiness deadline, for **a future separately authorized Formal-v5 successor only**.

**Protected-main predecessor:** `a60aa6858662ce87b989ff752c50969f21ad4619`.

**Scope of this PR:** architecture proposal, read-only/deterministic selector prototype, synthetic acceptance. It does **not** change active production entrypoints, frozen Runtime semantics, deployed images, PostgreSQL schema, owner leases, existing arm, A0, O00, or O23.

## 1. Decision sought

Replace elapsed-time-as-authority:

```text
O00 >= arm_time + 36h
readiness_deadline = O00 - 12h
```

with **independently verifiable start-admission evidence**:

```text
qualified actual pre-A0 preparation envelope
+ fresh protected-main/runtime/image identity
+ valid owner/lease/fencing and H5
+ schema/ACL + target scope pristine
+ current effective stage authority with A0..O23 coverage
+ A0 evidence/forcing preparation and physical provenance
+ exact future database-UTC A0/O00
+ verified causality/replay constraints
+ explicit authorized fresh successor arm
= START_ELIGIBLE (subject to fresh final just-in-time revalidation)
```

**A passed test is not permission to start.** A governed acceptance run must verify referenced *immutable evidence*, not trust client-provided booleans; the prototype selector returns `PROPOSED_NOT_AUTHORIZED` even on success.

## 2. Original risk and the replacement invariant

Amendment-06 protected against the EA5E0 incident where O00–O05 were already in the past before the authority became effective. Its 36h padding was chosen to give 24h before a separate O00−12h readiness deadline. This was a conservative governance mechanism, not a scheduler or persistence requirement.

Amendment-21 already recognized a separate mismatch: 36h lead exceeds 30h current biological-stage forward stability, so the stage truth cannot be pinned at arm time and must be refreshed after arm before A0.

**Replacement invariant:** No production mutation occurs until all required authorities and implementation prerequisites are effective, independently witnessed, and still current. No A0 or O00 may be backdated; no missed readiness deadline may be reinterpreted as a historical tick.

A future selector chooses A0 as a **future, exact UTC hourly boundary**, constrained by a proven pre-A0 execution envelope (distinct from the V13 per-base forcing budget) and by the actual current authority's coverage. O00=A0+1h; O23=O00+23h. The 24-slot Formal-v5 acceptance contract remains in force in this limited successor. Rolling-window production qualification is a separate future design and is **not** smuggled into Amendment-22.

## 3. Mandatory PRE-ARM evidence set

All referenced evidence must identify the exact subject, scope, producer, digest and verification time; qualifiers cannot substitute for raw machine evidence.

1. **Protected main / Runtime:** exact current main and clean host checkout; exact immutable deployed image ID/digest on both owners; accepted CI, QCP and G11/R6/G12/G13 qualifications. A non-authority protected-main change invalidates the arm.
2. **Owner security:** current H5 for Evidence and Twin, exact-one fenced lease per role, matching host/container/image, T1/T2 lease readbacks, and absence of an unauthorized Formal-v5 ACTIVE owner.
3. **Database:** current Formal-v5 physical store/schema/ACL and role separation; target A0 state absent under the existing 29-table/2-routine/zero-row contract until separately revised by another amendment. No schema/ACL or zero-state relaxation is granted here.
4. **Biological authority:** an effective current-crop authority selected from the canonical governed registry, exact six-key scope, ACTIVE/RESOLVED/VALID lifecycle, R5-or-R6 water-use stage LATE/Kc=0.6 where permitted, and explicit authority coverage through candidate A0..O23. No stage inferred from a future observation.
5. **Time preparation envelope:** measured and controlled-delay-proven *pre-A0* duration covering authority readback, qualified raw/forcing warm start, materialization, revalidation, promotion readiness and actor handoff as applicable. It must carry an immutable proof digest, source/runtime binding and explicit safety margin. The already-frozen **2,081,804 ms V13 forcing-base acquisition budget cannot be repurposed** as this envelope.
6. **Execution authorizations:** dedicated successor approval, frozen exact-main implementation/proof, explicit operator go/no-go, local non-GitHub execution identity and retired GitHub production triggers.

**Fail closed** if any of these is unavailable, stale, inapplicable, inconsistent, or not actually proved. The selector must not choose a clock in the past or relax a deadline to rescue a slot.

## 4. Candidate clock construction

Let `Tdb` be the fresh read-only PostgreSQL server time, `Tproof` the time of the latest verified admission receipt, and `BpreA0` the **independently qualified** complete pre-A0 preparation envelope with explicit margin.

```text
earliest_safe_A0 = ceil_to_next_actual_UTC_hour(
  max(Tdb, Tproof) + BpreA0
)
candidate_O00 = earliest_safe_A0 + 1h
candidate_O23 = candidate_O00 + 23h
```

Reject unless:
- A0 > Tdb, O00 > Tdb, all clocks exact UTC hours, and the lifecycle horizon covers O23.
- Stage authority is already effective and available at admission, not future-visible; it was effective no later than Tproof, has `authority_as_of <= A0`, and `authority_valid_until >= O23`.
- The candidate's six-key scope/epoch identity is unique; any previous A0 identity/terminal slot conflict causes rejection.
- All effective authorities, hash pins, H5, F5 ownership and final proofs **remain valid at A0**. If a future candidate is invalidated by new evidence before A0, abort and select a new prospective window. No historical catch-up.
- The per-base acquisition deadline `base - selected_budget_ms` and physical visibility deadline `base` remain independently enforced, including the A0 seed and all 23 post-A0 V13 receipts.
- Exact stage-validity/cadence checks remain; current stage coverage does **not** become an arm-time future truth pin unless the independent source authority already makes that specific claim.

If the current authority cannot cover 24h, return `NO_ELIGIBLE_WINDOW`. Do not fabricate rollover/cross-authority semantics to make one.

## 5. Independent A0 and O00 guards

**A0 pre-mutation admission:** fresh protected main/arm/host/image continuity, exact scope pristine and CAS/idempotency, fenced owner release/claim prerequisites, correct PostgreSQL principal/schema/ACL, new-stage authority, actual acquired A0 forcing provenance and explicit manifest pins, and real-clock future-bound check. Any missing proof => **HOLD A0**, no partial bootstrap.

**O00 preclaim admission:** A0 committed and physically readable in Formal store; forcing current-base visibility proved; viable V13 forcing controller; G11 ACTIVE route/image verified; no preformal/ACTIVE double owner; post-A0 new fencing token; V5 viability checked **before** scheduler claim; all timing and stage/evidence invariants revalidated. Any missing proof => **HOLD O00**, not claim-then-fail.

The 24-hour qualification still requires sequential O00–O23 terminal ticks, 23 V13 physical-visibility receipts, G12 independent readback/zero-downstream proof and G13 independent operator-authorized completion. No `DEGRADED` state alone waives the applicable causal or business gate.

## 6. Migration boundary and current-arm preservation

1. This candidate remains **Draft/Open/Unmerged** while the current Formal-v5 arm is live; the protected main and host remain unchanged.
2. No previous arm is automatically grandfathered. The current arm and evidence-epoch candidate are bound to the Amendment-06/21 **36h contract**; they may run only under that exact contract.
3. To activate the successor, first create an approved governance decision to retire/invalidate the old arm and abandon its unused epoch, with immutable evidence. **Never merge Amendment-22 silently into the currently armed main.**
4. Qualify all actual consumers together on a new exact-main subject: selector, Evidence handoff, owner cutover, arm assembler, manifest, A0, G11 ACTIVE cutover, G12/G13 final readback, tests, QCP, runbook and failure matrix.
5. Reissue a *new immutable* arm artifact under the successor's schema/selection mode. No in-place rewrite of old arm.
6. Repeat exact owner/image/H5, read-only schema/ACL, stage/registry and admission proofs on the new subject, prior to any A0.
7. No preformal shutdown, V5 ACTIVE activation, real A0, raw write, database write or deployment is authorized by this Draft.

## 7. Engineering impact inventory

| Surface | Amendment-22 implementation expectation |
|---|---|
| Amendment-06/21 | Add narrowly scoped effective successor; **preserve historical amendments immutable** |
| H6 production activation authority | Separate successor policy; do not rewrite historical H6 authority blob |
| Evidence handoff authority V1 | New version carrying evidence-gated selection; preserve V1 existing arms |
| Epoch selector V1 | New V2 that uses proven BpreA0 and actual stage/lifecycle coverage |
| Owner cutover V1 | New/guarded candidate construction with matching V2 clock; no two-epoch mismatch |
| Arm assembler V1 | New version/pin; verifies exact candidate, evidence hashes and operator authorization |
| A0 bootstrap | Admission gate only; persistence/A0 semantics unchanged |
| G11 ACTIVE | Preserve V5 runner/viability/persistent tick/provider semantics |
| G12/G13 | Requalify new arm/epoch fields; preserve read-only completion rules |
| QCP/CI | New exact-head first-red, fail-closed negative cases, real PostgreSQL isolated A0→O00 |
| Operator runbook | Completely regenerate exact SHA, clock, host, DB principals, post-A0 monitoring |

## 8. Mandatory acceptance matrix before any adoption

PASS requires at least:
- eligible future A0 under fully qualified evidence, exact O00/O23;
- fail if no proven BpreA0, missing safety margin, wrong/missing evidence digest or source, expired receipt;
- fail if any H5/owner/image/schema/ACL/continuity/target-zero proof absent or stale;
- fail for backdated A0/O00, insufficient stage coverage, future-invisible stage, lifecycle expired, incorrect R5/R6-to-LATE binding;
- fail for owner cutover/arm candidate mismatch; across-hour selection drift; partial readiness;
- fail for unready A0 forcing/provenance, failed V13 viability before claim, double owner/fencing regression;
- fail if runtime semantic or scheduler/tick/provider/revision contract changes;
- positive isolated production-equivalent PostgreSQL A0→O00 with real new selector/arm/host route;
- old exact-arm V1 remains read-only verifiable and **cannot** silently migrate to V2;
- G12 24T closure readback and G13 independent adjudication regressions;
- no CI or GitHub production wake, no manual `tsx` factory invocation, no raw/DB/production effect.

## 9. Explicit nonclaims

This PR **does not yet abolish 36h in the effective production contract**; it proposes the governed replacement and initial non-effectful selector proof. The fixed 36h and O00−12h gates stay enforceable until **all effective consumers and QCP** are updated, qualified and deliberately adopted. Nor does this PR:
- allow a zero-minute ad hoc start;
- authorize starting the currently armed epoch sooner;
- convert Formal-v5 into an indefinite production runner or a rolling 24T adjudicator;
- relax Formal store/database-zero, temporal semantics, authorization scope, provider timing, human approval or evidence provenance;
- promise Site data visibility.

**Status at publication: engineering/proposal only, not a production decision.**
