# GEOX MCFT CAP-09 HANDOFF CONTINUATION — 2026-09-26

## 2026-09-27 ACTIVE CHECKPOINT — Runtime admission closed; qualification / infra convergence is the only active engineering frontier

This section is the newest continuation checkpoint and supersedes older current-state summaries below where they conflict. The 2026-09-26 material is intentionally preserved after this section as historical baseline.

### A. Current task split

MCFT CAP-09 engineering has now been deliberately split into two independent lines to stop qualification/control-plane churn from invalidating Runtime fault-discovery evidence.

```text
RUNTIME HARDENING / FDG
    ↓ frozen exact candidate
    b497896d61ff391a941a2420368bc41961f629e4
    ↓
    Runtime admission = PASS
    FINAL_24H_ADMITTED = true

QUALIFICATION / INFRA CONVERGENCE
    ↓ active frontier
    PR #3633
    ↓
    accepted-base immutable evidence restore/materialization
```

The Runtime line must not be reopened merely because CI/QCP/delivery/release infrastructure is red. A Runtime change is justified only by new machine evidence showing a Runtime defect that could make final R00–R23 fail.

### B. Current repository identities — reverified 2026-09-27

Protected main:

`8f63c498bd48978e2dd525ad57b6b8fdb7ada560`

Runtime-only PR:

```text
PR            #3632 — MCFT CAP-09 Runtime Hardening / FDG closure
state         OPEN / DRAFT / UNMERGED
base          fix/mcft-cap09-v2-qualification-equivalence-v1
base SHA      22c2b055e715f06e555d7d4e719ccace806b84ee
head branch   diag/mcft-cap09-runtime-hardening-fdg-v1
exact head    b497896d61ff391a941a2420368bc41961f629e4
```

Qualification-only convergence PR:

```text
PR            #3633 — MCFT CAP-09 qualification control-plane convergence probe
state         OPEN / DRAFT / UNMERGED
base          main
base SHA      8f63c498bd48978e2dd525ad57b6b8fdb7ada560
head branch   qual/mcft-cap09-control-plane-convergence-v1
exact head    26a90a552c5004afdcd8a45cb29c5d5565e56d95
changed scope qualification probe only
```

Do not merge either PR merely because this handoff records green evidence. Merge remains separately governed.

### C. Runtime five-blocker frontier is now 5 / 5 CLOSED

The former five Runtime admission blockers are now machine-closed on exact Runtime head `b497896d61ff391a941a2420368bc41961f629e4`:

```text
CLOSED   1. taxonomy compatibility seam
CLOSED   2. exact P0-H controlled raw
CLOSED   3. full resource envelope
CLOSED   4. accelerated restart / oldest-first backfill
CLOSED   5. 2–4h live-provider soak
```

#### C1. Taxonomy compatibility seam

The three-state Evidence attempt taxonomy remains constrained to the attempt/orchestration boundary:

```text
RETRYABLE
ATTEMPT_REJECTED
PROCESS_FATAL
```

Compatibility with the legacy two-state pool/host boundary is handled at one seam. Do not spread the three-state type through Twin, pool, and older acceptance contracts unless new evidence requires it.

#### C2. Exact P0-H controlled raw

The historical real raw was recovered from the `7360...` rehearsal control tree and copied as a controlled external fixture without re-download, regeneration, or reserialization.

Local controlled fixture:

`C:\Users\mylr1\.geox\mcft-cap09\controlled-fixtures\P0_H_KBS_CSV_FIELD_TOO_LARGE.raw`

Frozen identity:

```text
bytes   205205
sha256  931512bb7df21cab42b3d359f7985b76ef554f4eb8d90ee28c924030381fd618
```

Exact-P0H acceptance on `b497...` = PASS:

```text
normalized scientific failure
= MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE

runtime disposition
= ATTEMPT_REJECTED

evidence promotion authorized
= false

host survival required
= true
```

#### C3. Full resource envelope

The existing full resource harness was executed with:

```text
exact P0-H replay    ×100
live GFS acquisition ×3
GFS leads            73 per acquisition
RSS / heap / external memory
FD
Temp-root leak
```

Important: the first Windows execution returned PASS but `fd_count=null / fd_delta=null`. That result is not sufficient proof of the frozen FD requirement.

The exact same existing harness was therefore run under Linux Docker from an exact `git archive` of `b497...`, using the same controlled P0-H raw and without a code change.

Linux result = PASS:

```text
subject SHA              b497896d61ff391a941a2420368bc41961f629e4
baseline FD              44
final FD                 38
FD delta                 -6
maximum allowed FD delta 8
peak RSS delta           52,510,720 bytes
final heap delta         6,279,696 bytes
final external delta     15,513,643 bytes
temp-root leak           false
P0-H ×100                proven
GFS ×3 / 73 leads        proven
```

This is the resource-envelope evidence to rely on, not the Windows `fd=null` result.

#### C4. Accelerated restart / oldest-first backfill

Exact-head Phase4 evidence:

```text
run      36295480881
head     b497896d61ff391a941a2420368bc41961f629e4
result   PASS
```

This proves the existing accelerated restart/backfill path; no substitute workflow was invented.

#### C5. 2–4h live-provider soak

Exact-head soak evidence:

```text
run      36295480860
head     b497896d61ff391a941a2420368bc41961f629e4
result   PASS
soak     >= 2h and <= 4h
```

The result-only adjudication also passed.

Associated exact-head FDG run:

```text
run      36295480791
result   SUCCESS
```

### D. Final Runtime admission adjudication is PASS

The exact-head evidence was assembled without changing Runtime code and the existing `FINAL_24H_ADMISSION` adjudicator was run.

Result:

```text
status                                              PASS
final_24h_admitted                                  true
pending                                             []
failure_taxonomy_compatibility_seam                 true
exact_p0h_raw_materialized_and_hash_verified        true
full_resource_envelope                              true
accelerated_restart_missed_slot_oldest_first_backfill true
live_provider_soak_2_to_4h                          true

authority_effect                                    false
production_effect                                   false
formal_v5_arm                                       false
a0_authorized                                       false
o00_o23_authorized                                  false
mcft_cap09_completed                                false
```

Durable local admission bundle:

`C:\Users\mylr1\.geox\mcft-cap09\runtime-admission\b497896d61ff391a941a2420368bc41961f629e4`

This distinction is mandatory:

```text
FINAL_24H_ADMITTED = true
    ≠ final R00–R23 started
    ≠ Formal-v5 armed
    ≠ A0 authorized
    ≠ O00–O23 authorized
    ≠ Stage 1B closed
    ≠ MCFT CAP-09 completed
```

No final R00–R23 window was started in this continuation.

### E. Why #3632 QCP was red and why Runtime must not be changed for it

Old QCP run on the stacked Runtime PR:

`36295480783`

Its first failure was:

`Require governed successor predecessor and zero production bindings`

The root cause was structural: PR #3632 is stacked on non-main base `fix/mcft-cap09-v2-qualification-equivalence-v1@22c2...`, while the governed successor admission requires the qualifying successor to originate from exact protected `main` for the relevant non-historical predecessor case.

Therefore:

```text
QCP red on #3632
≠ Runtime defect
≠ production-binding corruption
≠ reason to modify b497 Runtime candidate
```

The qualification/control-plane work was correctly split to a new main-based branch instead.

### F. Qualification / infra convergence — current active frontier

PR #3633 was created from exact protected main specifically to converge qualification/control-plane infrastructure while keeping Runtime `b497...` frozen.

Machine evidence already established on #3633 includes:

```text
current-main proof-bound re-anchor               PASS
run                                               36311511561 SUCCESS

governed successor / zero production bindings   PASS
central exact-path applicability                 PASS
dependency digest / durable anchor chain         PASS
immutable evidence resolution in QCP path        PASS
all-blocker current-PR preflight                 PASS
zero-bypass qualification report                 PASS
QCP run                                           36311511485 SUCCESS
```

This proves the previous stacked-base first red has been eliminated without touching Runtime.

### G. Current blocker — first red in remaining CI / delivery / release lane

The current first actionable red is:

`Verify immutable accepted-base semantic acceptance evidence`

Failure token/path:

```text
MCFT_CAP09_ACCEPTED_BASE_SEMANTIC_ACCEPTANCE_EVIDENCE_FILE_MISSING:
.mcft-cap09/qualification/accepted-base-semantic-acceptance-evidence.production.json
```

The dependency identities were checked and match:

```text
head dependency digest
= 131b480958613590c710325392e637b16a3e2d884f38d2947dbc96a12a6ec49f

accepted-base dependency digest
= 131b480958613590c710325392e637b16a3e2d884f38d2947dbc96a12a6ec49f
```

Current adjudication:

- this is not a Runtime failure;
- this is not a dependency-digest mismatch;
- this is not evidence that accepted-base semantic acceptance must be rerun from the current head;
- the missing piece is the qualification evidence restore/materialization chain into the verifier's canonical path.

No fix commit for this current blocker had been written at the time of this handoff update. Do not claim it is fixed until a new exact head proves it.

### H. Next engineering plan — narrow first-red convergence only

Proceed in this exact order:

```text
1. Keep Runtime candidate b497896d... frozen.

2. Stay on qualification-only PR #3633.

3. Trace the authoritative immutable accepted-base semantic acceptance artifact/source.

4. Confirm its exact accepted-base identity and integrity before materialization.

5. Patch only the qualification workflow restore/materialization seam so the real immutable accepted-base evidence is placed at:

   .mcft-cap09/qualification/
   accepted-base-semantic-acceptance-evidence.production.json

6. Do NOT regenerate that evidence from current head.

7. Do NOT fabricate a JSON file.

8. Do NOT relax, skip, or rewrite the verifier to make the lane green.

9. Run the same CI / delivery / release lane on the new exact #3633 head.

10. If it passes this step, take the next machine first-red only.

11. Continue qualification/infra convergence independently from Runtime.

12. Do not merge #3633 without separate authorization.
```

After qualification/infra convergence is genuinely green, re-adjudicate what exact merge/rebind sequence is required before any final real-clock qualification. Do not assume current historical qualification evidence automatically survives a merge or protected-main movement.

### I. Explicitly prohibited actions at this checkpoint

Unless separately and explicitly authorized:

- do not merge a PR that changes or invalidates running qualification/canary identity;
- do not mutate the production database;
- do not cut over or restart production owners;
- do not mutate or clear the Formal store;
- do not arm Formal-v5;
- do not start A0;
- do not start O00–O23;
- do not claim Stage 1B closure;
- do not claim MCFT CAP-09 completion;
- do not disturb any live canary or governed production runtime in order to make qualification CI pass.

A local observation earlier in this continuation showed production Runtime containers in restart loops. That observation was not re-adjudicated as part of this handoff update and does not authorize repair/restart. Treat production owner state as separately governed and require fresh evidence before acting.

### J. Pitfalls discovered in this continuation — do not repeat

#### 1. Windows `python3` alias can create a false Runtime diagnosis

On the user's Windows host, `python3` initially resolved to:

`C:\Users\mylr1\AppData\Local\Microsoft\WindowsApps\python3.exe`

That Microsoft Store alias failed before the scientific subprocess could execute and surfaced upstream as:

`MCFT_CAP09_KBS_SCIENTIFIC_SUBPROCESS_UNCLASSIFIED`

The real interpreter was:

`C:\Users\mylr1\AppData\Local\Programs\Python\Python312\python.exe`

with Python 3.12.10. Once the real interpreter and exact scientific stack were used, the exact P0-H failure normalized correctly.

Do not treat environment-launch failure as classifier evidence.

#### 2. A PASS containing `fd_delta=null` is not FD proof

The Windows full-resource result was not sufficient for the frozen FD requirement even though the harness status was PASS. The gap was closed with the same harness under Linux where `/proc/self/fd` is measurable.

Never promote `null / unmeasured` to `proven` merely because a top-level status is green.

#### 3. Do not let three-state taxonomy diffuse through all legacy contracts

The correct architecture is one compatibility seam:

```text
Provider/scientific attempt
    ↓
RETRYABLE / ATTEMPT_REJECTED / PROCESS_FATAL
    ↓ adapter
legacy host/pool boundary
```

Do not rewrite Twin/pool/old acceptance contracts unless independently required.

#### 4. Do not mix Runtime closure with QCP / image / provenance / generic CI churn

The earlier FDG branch became slow because Runtime fixes and the proof/control plane were coupled. Maintain:

```text
TEST EARLY, QUALIFY LATE
```

and the critical-path test:

```text
If this work is omitted, could FINAL R00–R23 fail?
YES → Runtime critical path
NO  → qualification/infra or another line
```

#### 5. Exact-head evidence is invalidated by unnecessary code churn

The live-provider soak and other expensive evidence are bound to exact SHA. Do not commit cosmetic or control-plane changes onto the frozen Runtime candidate after evidence begins.

#### 6. Evidence colocation/assembly is not Runtime repair

Phase4/restart/backfill evidence already existed on the exact Runtime head and only needed to be assembled into the adjudicator's expected location. Do not create a new Runtime patch merely to move evidence between paths.

#### 7. A stacked PR can be structurally ineligible for governed successor qualification

PR #3632's base shape was itself the QCP first red. The solution was a separate main-based qualification convergence line, not weakening the successor gate.

#### 8. Immutable accepted-base evidence must be restored, not recreated

The current #3633 failure is a materialization/restore problem. Never manufacture replacement accepted-base evidence from the current PR head to satisfy a verifier that explicitly asks for immutable accepted-base evidence.

#### 9. Historical green does not imply current exact-head qualification

Every SHA/base/main movement must be rebound and reverified. Old success records are evidence of the old identity only.

#### 10. `FINAL_24H_ADMITTED` is an admission result, not a closure result

Do not collapse admission, final real-clock execution, Formal governance, Stage 1B closure, and CAP-09 completion into one state.

### K. Compact state for the next engineer / conversation — 2026-09-27

```text
protected main
8f63c498bd48978e2dd525ad57b6b8fdb7ada560

RUNTIME LINE
PR #3632                    DRAFT / OPEN / UNMERGED
exact head                  b497896d61ff391a941a2420368bc41961f629e4
Runtime blockers            5 / 5 CLOSED
Runtime admission           PASS
FINAL_24H_ADMITTED           true
final R00–R23               NOT STARTED

exact P0-H                  PASS
raw bytes                    205205
raw sha256                   931512bb7df21cab42b3d359f7985b76ef554f4eb8d90ee28c924030381fd618
resource envelope/Linux FD   PASS
restart/backfill             PASS — run 36295480881
live-provider soak           PASS — run 36295480860
FDG                           SUCCESS — run 36295480791

QUALIFICATION / INFRA LINE
PR #3633                    DRAFT / OPEN / UNMERGED
base                         main@8f63c498bd48978e2dd525ad57b6b8fdb7ada560
exact head                   26a90a552c5004afdcd8a45cb29c5d5565e56d95
QCP                          SUCCESS — run 36311511485
current-main re-anchor       SUCCESS — run 36311511561

CURRENT FIRST RED
Verify immutable accepted-base semantic acceptance evidence

missing canonical path
.mcft-cap09/qualification/
accepted-base-semantic-acceptance-evidence.production.json

next action
restore/materialize the real immutable accepted-base evidence
into the canonical verifier path; do not regenerate or weaken gate

Formal-v5                   NOT ARMED
A0                          NOT AUTHORIZED
O00–O23                     NOT AUTHORIZED
Stage 1B closure            false
MCFT CAP-09 complete        false
```

---

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
