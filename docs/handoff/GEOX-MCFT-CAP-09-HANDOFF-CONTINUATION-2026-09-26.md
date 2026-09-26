# GEOX MCFT CAP-09 HANDOFF CONTINUATION — 2026-09-26

## Status and authority boundary

This file is the active continuation handoff for MCFT CAP-09 from 2026-09-26 onward.

Historical handoff remains preserved at:

`docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md`

The historical file is intentionally left untouched. It is now treated as a frozen archive of prior handoff history because it has grown beyond the practical size limit of the ordinary GitHub Contents API workflow.

This continuation does not authorize merge of engineering PRs, production database mutation, production owner activation, Formal-v5 arm, A0, O00-O23, Stage 1B closure, or MCFT CAP-09 completion.

---

## 1. Current engineering object

Current diagnostic successor:

`PR #3631 — MCFT CAP-09 Failure Discovery Gate v1`

Exact base:

`22c2b055e715f06e555d7d4e719ccace806b84ee`

Current head at handoff creation:

`82b13c7d497499373fb4c2e0d7ed1a1862efcee9`

Branch:

`diag/mcft-cap09-failure-discovery-gate-v1`

PR #3631 is diagnostic / qualification-hardening only and is explicitly non-authority-bearing.

Do not merge PR #3631 while the `22c2b055...` real-clock canary is still running.

The live canary and the diagnostic branch must remain isolated:

- do not restart the live canary because of diagnostic-branch work;
- do not rebuild or replace its running container/image identity;
- do not mutate its store to satisfy diagnostic tests;
- do not reinterpret diagnostic CI evidence as evidence produced by the live canary.

---

## 2. Why the qualification strategy changed

MCFT CAP-09 must no longer use a full 24-hour real-clock rehearsal as the primary fault-discovery mechanism.

The recent KBS raw CSV failure proved that deterministic defects can consume hours of wall-clock qualification time even though the underlying raw object can be preserved and exactly replayed offline.

Observed failure class:

```text
_csv.Error:
field larger than field limit (131072)
```

The relevant KBS raw object was approximately 205,205 bytes and exact replay reproduced the failure.

At the time, Twin Runtime had already progressed through degraded slots while Evidence Runtime disappeared. This exposed a runtime-survival / failure-classification / raw-input robustness boundary, not merely a scheduler-timing issue.

Therefore the qualification funnel has been inverted:

```text
historical deterministic failures
        ↓
exact replay
        ↓
failure taxonomy / host-survival proof
        ↓
fast resource sanity
        ↓
accelerated restart / missed-slot / oldest-first backfill
        ↓
production-equivalent final candidate
        ↓
short live-provider soak
        ↓
real exact P0-H / field evidence
        ↓
FINAL_24H_ADMITTED
        ↓
final real-clock qualification
```

A final 24-hour window is a qualification instrument, not the primary debugger.

---

## 3. Failure Discovery Gate current machine state

Current frozen state:

```text
FDG fast gate                         PASS
known-case UNCLASSIFIED_ERROR         0
ATTEMPT_REJECTED host survival        PROVEN
fast resource sanity                  PASS

FINAL_24H_ADMITTED                    false
remaining blockers                    5
```

Interpretation:

- the fast Failure Discovery Gate is green;
- known historical failure cases are classified;
- no known case remains as `UNCLASSIFIED_ERROR`;
- rejected provider/scientific input has proven host-survival behavior;
- fast resource sanity is green;
- final 24-hour admission is still false;
- five blockers remain.

Evidence failure taxonomy remains:

```text
RETRYABLE
ATTEMPT_REJECTED
PROCESS_FATAL
```

A rejected attempt must not accidentally become process death. A known failure scenario that escapes as `UNCLASSIFIED_ERROR` remains an admission blocker.

---

## 4. Immediate engineering frontier

The next narrow target is the existing production-equivalent accelerated 24T chain at:

`Check central exact-path ownership and required-check applicability`

This is the next path to make genuinely green.

Do not invent a weaker replacement test or a parallel synthetic path.

The existing accelerated 24T chain must itself prove the required behavior.

Closing this chain is required to materially close:

```text
accelerated_restart_missed_slot_oldest_first_backfill
production_equivalent_final_candidate
```

The proof must exercise the relevant system path, including:

1. runtime restart;
2. persisted scheduler state surviving restart;
3. an intentionally missed slot being detected;
4. oldest-first recovery;
5. actual backfill of the missed slot;
6. duplicate execution remaining idempotent;
7. production-equivalent packaging/process boundaries;
8. exact-path required-check applicability.

A unit-only or substitute path is insufficient.

---

## 5. Expected possible next red: MinIO exact digest

If the accelerated 24T path advances and the next red is the previously known `quay.io/minio` image authorization failure, repair that only on the diagnostic branch.

Required rule:

```text
exact immutable digest     required
floating :latest           forbidden
```

Do not make CI green by weakening the image pin to a floating tag.

Use an accessible immutable digest or correct the image-resolution/authentication path while preserving exact pinning.

No such repair authorizes touching the running `22c2` live canary.

---

## 6. Remaining evidence classes that cannot be synthesized

Not all remaining blockers can close in CI.

Two important classes still require real evidence.

### Exact P0-H raw evidence

The exact P0-H requirement must be closed using the required real raw evidence path.

A reconstructed fixture, inferred equivalent, or manually manufactured replacement is not sufficient where the contract requires exact field/provider raw evidence.

### 2–4 hour live-provider soak

The short live-provider soak must observe real provider behavior over the required real-time interval.

It is intentionally shorter than the final 24-hour qualification window, but it is still real-time provider evidence.

Do not replace it with accelerated time or a local fixture loop.

The three layers prove different things:

```text
fast deterministic admission
≠ live-provider soak
≠ final 24-hour real-clock qualification
```

---

## 7. Required next sequence

Proceed in this order unless new evidence forces a narrower corrective step:

```text
1. Keep the 22c2 live canary untouched.

2. Continue only on PR #3631 diagnostic branch.

3. Make the existing production-equivalent accelerated 24T chain pass:
   Check central exact-path ownership and required-check applicability

4. Continue the same chain until:
   accelerated_restart_missed_slot_oldest_first_backfill
   is materially proven.

5. Continue until:
   production_equivalent_final_candidate
   is materially proven.

6. If the next red is MinIO exact-digest unauthorized:
   fix image resolution/authentication while preserving immutable digest pinning.

7. Re-run the fast admission inventory.

8. Obtain exact P0-H raw evidence through the required real evidence path.

9. Complete the required 2–4 hour live-provider soak.

10. Recalculate the admission inventory.

11. Only when:
      remaining blockers = 0
      and
      FINAL_24H_ADMITTED = true
    may another final 24-hour real-clock qualification window begin.

12. Formal-v5 / A0 / O00-O23 remain separately governed and separately authorized.
```

---

## 8. Engineering discipline / known pitfalls

Do not use the final 24-hour run as the debugger.

Do not patch one exception and immediately spend another 24-hour window without forcing the revealed failure class through the fast gate.

Do not weaken exact SHA, image digest, raw identity, authority identity, or execution-path identity merely to make CI green.

Do not confuse an invalid provider/scientific attempt with a process-fatal host failure.

Do not manufacture real-field evidence with fixtures.

Do not disturb the running live canary from the diagnostic branch.

Do not claim final admission from partial green checks.

Current state remains:

`FINAL_24H_ADMITTED = false`

until all blockers are genuinely closed.

---

## 9. Handoff storage decision made on 2026-09-26

The previous canonical handoff file exceeded the practical size limit for the ordinary GitHub Contents API workflow and PR patch retrieval was not reliable for reconstructing the full historical file.

No unsafe overwrite was performed.

The attempted local PowerShell pure-prepend helper also failed before any repository write because its helper function name collided with PowerShell command resolution and recursed into itself (`CallDepthOverflow`). No commit or push resulted from that failure.

Therefore the handoff storage model is now:

```text
historical archive:
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md
    ↓ frozen / do not rewrite

active continuation:
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-09-26.md
    ↓ future current-state updates go here
```

This avoids risking truncation or accidental normalization of the 50k+ line historical file.

The old handoff remains historical authority for earlier phases. This file is the current continuation authority for engineering-state transfer from 2026-09-26 onward.

---

## 10. Compact state for the next engineer / conversation

```text
FDG fast gate                         PASS
known-case UNCLASSIFIED_ERROR         0
ATTEMPT_REJECTED host survival        PROVEN
fast resource sanity                  PASS

FINAL_24H_ADMITTED                    false
remaining admission blockers          5

current diagnostic PR                 #3631
base                                   22c2b055e715f06e555d7d4e719ccace806b84ee
head at handoff creation               82b13c7d497499373fb4c2e0d7ed1a1862efcee9

next narrow target:
Check central exact-path ownership and required-check applicability

major accelerated blockers:
accelerated_restart_missed_slot_oldest_first_backfill
production_equivalent_final_candidate

real evidence still required:
exact P0-H raw
2–4h live-provider soak

22c2 live canary:
PRESERVE / DO NOT TOUCH

PR #3631:
DIAGNOSTIC
NON-AUTHORITY-BEARING
DO NOT MERGE WHILE 22c2 CANARY IS RUNNING

active handoff:
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-09-26.md
```

The immediate objective is failure-discovery and admission closure. It is not yet final 24-hour qualification and it is not Formal closure.
