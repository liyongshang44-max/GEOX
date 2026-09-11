# AD — 2026-09-11 Dual-Adoption Closure / 1E59 Protected-Main Re-Anchor / Freshness-Owner Formal-v5 Pre-Arm Frontier

```text
CONVERSATION CONTINUATION ONLY

NOT NEW ARCHITECTURE AUTHORITY

NOT PRODUCTION AUTHORIZATION

#3547 ADOPTION = COMPLETE

#3549 ADOPTION = COMPLETE

CURRENT PROTECTED MAIN =
1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20

CURRENT ENGINEERING FRONTIER =
1E59 PROOF-BOUND CURRENT-MAIN RE-ANCHOR RCA

STOP BEFORE FORMAL-v5 ARM
```

This AD-section is the current MCFT-CAP-09 continuation entry point.

AC and every historical section below it remain historical evidence and MUST remain byte-preserved. AC correctly captured the pre-adoption proof-bound convergence frontier. Since AC, two explicitly authorized adoptions were completed, protected main moved twice, and the active frontier moved from #3547 adoption to a second protected-main re-anchor after #3549.

Do not resume from AC's `#3547 OPEN / DRAFT / UNMERGED` state. That state is historical.

This section records execution/governance state only. It does not create new Production Owner authority, Production Runtime authority, crop freshness authority, Formal-v5 arm authority, or Stage 1B completion authority.

---

## AD0 — One-line continuation conclusion

```text
MCFT-CAP-09
= ACTIVE

canonical phase
= STAGE_1B_SHADOW_ONLINE_CLOSURE

active frontier
= FO1 / T4R1

#3547
= MERGED / ADOPTED

#3549
= MERGED / ADOPTED

protected main
= 1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20

protected-main tree
= 5ea0e43f43e6765f424b872d60099d9466f3cb33

post-merge authoritative push CI
= SUCCESS

post-merge EA5E2 successor-runner
= SUCCESS

current exact engineering task
= FINISH 1E59 PROOF-BOUND CURRENT-MAIN RE-ANCHOR RCA
  THEN FIX ONLY THE MACHINE-PROVEN FAULTY LAYER

current exact engineering blocker
= FIRST_PARENT_SUCCESSOR_LENGTH_MISMATCH
  UNDER EXACT RCA

fresh current-crop authority
= NOT AVAILABLE

2026-09-10T04Z authority
= EXPIRED AS CURRENT AUTHORITY
= PREDECESSOR / HISTORICAL EVIDENCE ONLY

EXACT_ONE_PRODUCTION_OWNER
= NOT LIVE-PROVEN

Production Runtime
= NOT STARTED

Formal-v5
= NOT ARMED

A0
= NOT STARTED

formal O00-O23
= NOT STARTED

MCFT-CAP-09 complete
= FALSE
```

The immediate continuation is not to start Production Runtime and not to arm Formal-v5. It is to finish the 1E59 lineage RCA and produce a bounded successor only after the faulty layer is machine-proven.

---

## AD1 — Exact repository / adoption matrix

### AD1.1 AC protected-main predecessor

AC began from:

```text
protected main =
7cb7cdc8c00252d3c87a685fbab38d96316afa3e
```

That SHA is no longer current protected main. It remains predecessor evidence only.

### AD1.2 #3547 adoption — COMPLETE

```text
PR =
#3547

title =
fix(mcft-cap09): bind registry dependencies and prove current-main admission

base =
7cb7cdc8c00252d3c87a685fbab38d96316afa3e

exact PR head =
c833a8df7595583c60d33ee29100ea1aeaf8c8ea

final state =
MERGED

merge commit =
512fb706040bf609c949aabb641afa300bd4c91b

merged_at =
2026-09-11T11:00:50Z
```

The user-issued merge instruction was the explicit #3547 adoption / merge authorization. Branch protection was not to be bypassed; required checks were allowed to re-evaluate after Draft -> Ready before merge.

After merge:

```text
c833a8df... PR-head qualification
= PREDECESSOR EVIDENCE

512fb706... protected main
= NEW ACTION-TIME BASE
```

### AD1.3 #3549 proof-bound re-anchor adoption — COMPLETE

```text
PR =
#3549

title =
fix(mcft-cap09): re-anchor proof-bound qualification to merged main

base =
512fb706040bf609c949aabb641afa300bd4c91b

final exact PR head =
cba75fa68bccb6bef4e039c3e54ca112f5575d93

final state =
MERGED

merge commit =
1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20

merged_at =
2026-09-11T13:01:33Z
```

The second user-issued merge instruction was the explicit #3549 adoption / merge authorization.

After merge:

```text
cba75fa6... PR-head qualification
= PREDECESSOR EVIDENCE

1e59d001... protected main
= CURRENT ACTION-TIME BASE
```

No PR-head proof may silently substitute for a protected-main successor proof after the protected-main SHA moves.

---

## AD2 — What #3547 actually closed

#3547 closed the bounded pre-adoption proof-bound qualification/control-plane repair represented by AC. In particular, the #3547 exact head had reached PR-head qualification convergence before adoption, and the user then explicitly authorized adoption.

The adoption establishes that the bounded #3547 changes are part of protected main. It does not establish any of the following:

```text
CURRENT-MAIN SUCCESSOR RE-ANCHOR ON A LATER MERGE SHA
CURRENT-CROP FRESHNESS
EXACT_ONE_PRODUCTION_OWNER LIVE PROOF
PRODUCTION RUNTIME START
FORMAL-v5 ARM
A0
O00-O23
STAGE_1B_SHADOW_ONLINE_CLOSURE_COMPLETE
MCFT_CAP_09_COMPLETE
```

The exact PR-head SHA remains useful as predecessor evidence but is not the current action-time base.

---

## AD3 — What #3549 actually closed

#3549 was required because #3547 adoption moved protected main to `512fb706...`; proof-bound qualification could not be preserved by merely adding that SHA to a historical allowlist.

#3549 therefore carried a bounded re-anchor from the #3547 merge result and was itself explicitly adopted.

The important consequence is recursive but bounded:

```text
#3549 PR-head proof
!=
automatic proof for #3549 merge SHA
```

Once #3549 merged, protected main became `1e59d001...`. That new protected-main SHA must itself be reconstructed under the proof-bound current-main lineage rules.

#3549 therefore closed its own bounded adoption but did not prove that the newly created merge SHA `1e59d001...` is already eligible for all successor authority roles.

---

## AD4 — 1E59 post-merge evidence and current first red

The accepted post-merge facts are:

```text
protected main =
1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20

protected-main tree =
5ea0e43f43e6765f424b872d60099d9466f3cb33

post-merge push CI =
SUCCESS

post-merge EA5E2 successor-runner =
SUCCESS
```

These greens prove those bounded executions only. They do not automatically materialize durable QCP evidence or current Production Owner authority.

The active proof-bound current-main successor path is still red under exact RCA:

```text
FIRST_PARENT_SUCCESSOR_LENGTH_MISMATCH
```

A current-main workflow observation on `1e59d001...` also shows the dedicated `MCFT CAP-09 Current-Main Successor Re-Anchor 2077` path failing. That observation is diagnostic evidence for the RCA, not permission to broaden the repair.

The current engineering task is therefore:

```text
identify exact lineage input
identify exact expected successor cardinality
identify exact actual successor cardinality
identify why the first-parent relation diverges
prove which layer owns the mismatch
fix only that layer
```

Do not modify adjacent authority semantics merely because they are in the same workflow path.

---

## AD5 — 1E59 RCA / allowed repair boundary

The repair must remain proof-bound and fail-closed.

Hard rules:

```text
active proof-bound admission count
= EXACTLY ONE

new protected-main SHA in legacy predecessor allowlist
= FORBIDDEN

baseline_qualification_carry_forward_authorized
= false
= MUST REMAIN false

repair scope
= ONLY MACHINE-PROVEN FAULTY LAYER

unproven authority broadening
= FORBIDDEN
```

A new protected-main SHA is not made eligible by inserting it into a historical allowlist. The successor relationship must be proven by the current lineage model.

If RCA proves the producer is correct and the validator is wrong, repair the validator. If it proves the producer is wrong and the validator is correct, repair the producer. If the mismatch is test-fixture-only, repair only the fixture. Do not decide this in advance.

---

## AD6 — Negative selftest and live acceptance discipline

The bounded successor must pass both an isolated negative selftest and the live acceptance path before a successor Draft PR is considered ready for exact-head convergence.

A prior trap is now frozen:

```text
single-element lineage
+ reverse()
!=
valid negative test
```

Reversing a single-element list does not create a structural lineage violation. A negative test must actually violate the condition being enforced, for example by constructing an invalid successor count, non-successor first-parent relation, or another machine-verifiable invalid lineage shape appropriate to the proven faulty layer.

Required sequence:

```text
RCA
-> minimal fix
-> real negative selftest fails for the intended reason
-> positive selftest passes
-> live acceptance passes
-> only then create bounded successor Draft PR
```

---

## AD7 — QCP durable-evidence rule

A green workflow is not by itself durable QCP evidence.

Keep separate:

```text
workflow execution result
!=
durable qualification evidence
!=
current authority
```

The bounded 1E59 successor must re-establish the exact-head evidence chain required by the QCP control plane. Evidence must be bound to the actual exact head and the correct workflow/event context.

No baseline qualification carry-forward is authorized:

```text
baseline_qualification_carry_forward_authorized = false
```

That boolean must not be flipped merely to make the successor green.

---

## AD8 — Phase5 binding rule

The Phase5 blocker/qualification binding must refer to the actual accelerated-24T workflow that supplies that evidence role.

A different green Phase5-adjacent workflow does not satisfy the binding just because its name or scope looks similar.

Frozen rule:

```text
Phase5 evidence role
-> bind actual accelerated-24T workflow
-> bind exact run / exact head where required
-> do not substitute another green workflow
```

This applies during the later exact-head QCP / V13 / Phase3 / Phase5 convergence step.

---

## AD9 — Owned dependency digest rule

A qualification-only marker can be a semantic no-op for runtime behavior and still modify the owned dependency digest.

Therefore:

```text
semantic no-op
!=
digest no-op
```

Any successor qualification marker that changes an owned dependency must be accounted for by the proof-bound dependency/digest model. Do not dismiss a digest drift solely because the marker has no runtime semantic effect.

---

## AD10 — Workflow event / Draft-Ready authority separation

The same commit SHA can have multiple GitHub Actions executions under different event contexts. Those executions are not automatically interchangeable as authority evidence.

Frozen distinction:

```text
push run on SHA X
!=
long-lived pull_request run on SHA X
```

Each evidence role must bind the event context required by that role.

Also:

```text
Draft -> Ready
= may retrigger required checks
```

Do not treat pre-Ready green checks as immutable if the branch ruleset causes reevaluation after Ready transition.

---

## AD11 — Current-crop freshness adjudication remains unresolved

Fresh current-crop authority is not presently available.

The previously valid authority at:

```text
2026-09-10T04Z
```

is now:

```text
EXPIRED AS CURRENT AUTHORITY
PREDECESSOR / HISTORICAL EVIDENCE ONLY
```

It must not be promoted into a current eligible authority merely because the payload remains historically valid or because later engineering qualification is green.

Current-crop freshness adjudication occurs only after the 1E59 successor is adopted and protected-main reconstruction has converged.

---

## AD12 — Production Owner / Runtime / Formal-v5 boundary

Current authority state remains:

```text
EXACT_ONE_PRODUCTION_OWNER
= NOT LIVE-PROVEN

Production Runtime
= NOT STARTED

Formal-v5
= NOT ARMED

A0
= NOT STARTED

O00-O23
= NOT STARTED
```

No current engineering green may silently promote any of these states.

The required progression remains:

```text
current-main reconstruction
-> current-crop freshness adjudication
-> live EXACT_ONE_PRODUCTION_OWNER proof
-> Formal-v5 PRE-ARM package
-> STOP BEFORE ARM
```

Production Runtime must not start before its authority prerequisites are live-proven. Formal-v5 must not be armed in this continuation without a later explicit authorization after PRE-ARM convergence.

---

## AD13 — Exact continuation sequence

The continuation order is frozen as:

```text
finish 1E59 lineage RCA
-> fix only proven faulty layer
-> negative selftest + positive selftest + live acceptance PASS
-> clean bounded 1E59 successor Draft PR
-> exact-head QCP / V13 / Phase3 / Phase5 convergence
-> explicit merge authorization
-> protected-main reconstruction
-> current-crop freshness adjudication
-> live Production Owner proof
-> Formal-v5 PRE-ARM
-> STOP BEFORE ARM
```

Do not skip directly from a local/selftest green to a merge request. Do not skip from PR-head convergence to protected-main authority. Do not skip from protected-main convergence to current-crop freshness. Do not skip from crop freshness to Production Runtime without the live owner proof.

---

## AD14 — Temporary handoff materializer incident / isolation

The previous handoff materializer attempt failed before authoritative mutation. The authoritative #3298 branch remained at `736ad59a...` throughout that failure sequence.

The prior temporary carrier was found to contain a literal truncation marker inside the embedded AD payload. Its Git blob therefore did not contain the complete draft and could not be treated as a recoverable byte-exact source.

This incident is handoff transport history only. It is not MCFT engineering evidence and must never enter the authoritative handoff ancestry/tree.

Frozen clean-graft rule for this AD landing:

```text
authoritative parent
= 736ad59a127fa0b17767b84a08807ebced894550

changed files
= exactly 1

file
= docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md

deletions
= 0

historical AC/AB/AA/... bytes
= exact preserved suffix

temp workflow / temp payload / temp carrier
= ABSENT FROM AUTHORITATIVE TREE

temp commit ancestry
= ABSENT FROM AUTHORITATIVE ANCESTRY
```

Do not cherry-pick the temporary materializer commit into #3298. The temporary branch is only a byte-materialization and validation carrier.

---

## AD15 — Takeover checklist / stop conditions

Before engineering work resumes, verify:

```text
#3298 top section = AD
#3298 new head sole parent = 736ad59a...
#3298 changed files from 736ad59a... = 1
handoff deletions = 0
old AC-and-below payload = exact suffix
protected main = 1e59d001...
Production Runtime = NOT STARTED
Formal-v5 = NOT ARMED
```

Then resume only the 1E59 RCA.

Stop and re-adjudicate if any of the following occurs:

```text
protected main drifts from 1e59d001...
#3298 head drifts unexpectedly during clean-graft
RCA shows more than one faulty authority layer
repair would require enabling baseline carry-forward
repair would require adding 1e59 to a legacy allowlist
repair would create more than one active proof-bound admission
current-crop freshness remains unresolved when owner proof is attempted
Formal-v5 arm would occur before explicit authorization
```

This AD section does not close MCFT-CAP-09. It records the exact dual-adoption closure and the bounded path to the next admissible engineering successor.

---

