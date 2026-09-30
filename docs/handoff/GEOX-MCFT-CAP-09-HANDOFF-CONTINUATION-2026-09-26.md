# GEOX MCFT CAP-09 HANDOFF CONTINUATION — 2026-09-26

## 2026-09-30 ACTIVE CHECKPOINT — QCP causal-basis central registration first-red / CAP-09 closure frontier

This is the newest active checkpoint. It supersedes the 2026-09-29, 2026-09-27 and 2026-09-26 current-state summaries below wherever facts conflict. Older sections are intentionally preserved as engineering history and must not be deleted.

### A. Mandatory takeover reading — there are TWO handoffs, and both are required

The next engineer / conversation must not start from this continuation alone. There are exactly two MCFT CAP-09 handoff documents in the current model and both must be read before changing code:

1. Historical canonical handoff — frozen archive / prior engineering history:
   `docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md`

2. Active continuation handoff — current-state authority from 2026-09-26 onward:
   `docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-09-26.md`

Also read the MCFT / Digital Twin master task document and the CAP-09 task, acceptance, governance and qualification documents before engineering changes.

Interpretation rule:

```text
canonical handoff = historical engineering / governance context
continuation      = newest exact frontier / current machine state
```

Do not use either handoff in isolation. The newest continuation checkpoint supersedes stale SHA / workflow / blocker facts, but it does not supersede frozen mandate, authority boundaries or acceptance requirements from the canonical history and task documents.

### B. Live repository identity at this checkpoint

Handoff PR:

```text
PR            #3298
state         DRAFT / OPEN / UNMERGED
head branch   docs/mcft-cap09-handoff-2026-08-26-phase2-evidence-module-frontier
head before this checkpoint commit
              9f60e24356100114c81223923170dd952216ca07
purpose       documentation / handoff only
```

Active engineering successor:

```text
PR            #3636
state         DRAFT / OPEN / UNMERGED
head branch   integration/mcft-cap09-qualified-runtime-infra-v1
base SHA      8f63c498bd48978e2dd525ad57b6b8fdb7ada560
exact head    c5fbfa25ce339bcc7186432569d078e2e9be3b62
```

Frozen Runtime remains:

`3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`

This checkpoint does not authorize or imply any protected-main mutation, merge, Runtime mutation, production mutation, Formal-v5 arm, A0, O00–O23, Stage 1B closure or CAP-09 completion.

### C. What task is active now

Only T0 / CAP-09 closure is active.

The current task is NOT feature development and is NOT to add more Twin capability. The current task is:

```text
make the central CAP-09 Qualification Control Plane formally consume
and adjudicate the new causal-revision temporal-semantics qualification basis,
then close the remaining exact-head immutable requalification evidence,
without reopening frozen Runtime semantics
```

Post-CAP-09 T1–T6 direction remains planned but deferred:

```text
T1 Field-State Authority Export
T2 Measurement Semantic Package
T3 GEOX Field ↔ ADR target binding
T4 ADR single-subject cutover
T5 ADR → B-Line seam
T6 DecisionTimeAuthorityManifest proof
```

Do not put T1–T6 into PR #3636 while T0 is still open.

### D. What has been completed since the 2026-09-29 checkpoint

The integration line has moved materially forward without reopening frozen Runtime.

Closed / converged items include:

```text
H6 strict-typecheck / frozen-Runtime boundary repair
Phase2 qualification path repair
Phase3 private S3 / taxonomy acceptance repair
Phase7 qualification / fail-closed repair
EA5C1 frozen-generation qualification repair
Private Store governed-boundary repair
Production Twin V2 Routing integration requalification mode
AM19 import-closure / workflow applicability repair
Phase5 exact-digest immutable MinIO mirror repair
```

Important Phase5 root cause was infrastructure / image routing, not Runtime semantics and not PostgreSQL:

```text
old server pin
quay.io/minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e

verified mirror
 ghcr.io/datalens-tech/minio:25.09@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e

old mc pin
quay.io/minio/mc@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727

verified mirror
 docker.io/apecloud/mc:RELEASE.2025-08-13T08-35-41Z@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727
```

The software digests were unchanged; only the registry/image route changed, and the mirror had independent exact-digest pull/start/S3 compatibility proof.

On current exact head `c5fbfa25...`, important machine-green workflows now include:

```text
Causal-revision temporal semantics qualification            PASS
Causal-revision immutable contract qualification            PASS
Phase5 two-service accelerated 24T                         PASS
Formal-v5 H6 post-graduation readiness                      PASS
QCP immutable-evidence freshness doctor                     PASS
QCP exact-scope qualification inspector                     PASS
```

Therefore do not reopen already-closed Runtime / Phase5 / H6 semantics merely because the central QCP remains red.

### E. Current authoritative first-red — QCP fails BEFORE the old 11 evidence blockers

Current central QCP:

```text
workflow   MCFT CAP-09 Qualification Control Plane
run        36662310640
job        109719560352
head       c5fbfa25ce339bcc7186432569d078e2e9be3b62
result     FAILURE
```

The exact failing step is:

`Phase 0-2: changed-scope planner and successor-chain candidate qualification (fail-closed)`

Steps before it are green. Later QCP phases are skipped because Phase 0-2 fails first.

The machine first-red is successor-chain control-plane recognition, with errors including:

```text
CP2_SUCCESSOR_CHAIN_CANDIDATE_UNKNOWN_PATH
CP2_SUCCESSOR_CHAIN_CANDIDATE_UNKNOWN_OUTSIDE_ACCEPTED_ANCHOR
```

The affected causal-revision package is exactly these five paths:

```text
.github/workflows/mcft-cap-09-causal-revision-temporal-semantics-postgres-v1.yml

docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-CAUSAL-REVISION-TEMPORAL-SEMANTICS-QUALIFICATION-BASIS-V1.json

scripts/governance_acceptance/
ACCEPTANCE_MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_POSTGRES_WIRING_V1.cjs

scripts/governance_acceptance/
ACCEPTANCE_MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_QUALIFICATION_BASIS_V1.cjs

scripts/runtime_acceptance/
ACCEPTANCE_MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_POSTGRES_V1.ts
```

This is now more upstream than the previously discussed 11 `NO_VALID_REQUALIFICATION_EVIDENCE` entries.

Do NOT start by graduating those 11 old entries. Until CP2 accepts this causal package, the central QCP has not reached the later semantic/evidence adjudication layer. After CP2 becomes green, re-read the new exact-head QCP artifact and enumerate the then-current evidence blockers from machine output.

### F. Causal-revision qualification basis exists and is not the missing scientific proof

The causal-revision temporal-semantics proof / contract already exists and current-head qualification workflows are green.

The intended semantic rule is:

```text
for historical cutoff T:
select only revisions with revision.visible_at <= T,
then select the latest revision legal at that cutoff
```

The replacement qualification basis explicitly preserves the old 24T evidence as historical evidence but forbids silently reinterpreting it as proof of the new causal-revision semantics.

The replacement subject must be established through the governed causal-revision basis, including real PostgreSQL proof, exact frozen Runtime identity, revision ancestry and current-head qualification. Missing or ambiguous replacement evidence must fail closed.

Therefore the current problem is not “prove temporal semantics from scratch”. The current problem is central QCP registration / adjudication of an already-created governed causal package.

### G. The `central-register` workflow was diagnosed — do not repeat the investigation

Current helper workflow:

`.github/workflows/mcft-cap-09-qcp-causal-basis-central-register-v1.yml`

It is NOT itself the central registration. It is a one-time patch generator intended to:

1. mutate the central QCP authority JSON in an isolated runner;
2. verify the resulting QCP acceptance;
3. publish a QCP-only registration patch to a temporary automation branch.

Observed run:

```text
workflow    QCP causal basis central registration
run         36662307332
job         109719511228
result      FAILURE
steps 1–5   PASS
Publish     SKIPPED
```

Critical exact finding from the failing step:

The generated QCP mutation itself passed:

`PASS ACCEPTANCE_MCFT_CAP_09_QUALIFICATION_CONTROL_PLANE_V1`

and the acceptance output recognized the intended causal replacement state, including:

```text
causal_revision_qualification_basis_v1 = ...QUALIFICATION-BASIS-V1.json
causal_revision_replacement_key        = MCFT_CAP09_PERSISTENT_24T_POSTGRES_CAUSAL_REVISION_V1
legacy_am19_semantic_action            = SEMANTIC_SUPERSEDED
requalification_requirements_action    = SEMANTIC_SUPERSEDED
```

The generator then failed its own changed-scope guard because it deliberately deleted itself and simultaneously required the candidate patch to modify only one QCP JSON file.

Exact generated tree delta was:

```text
D .github/workflows/mcft-cap-09-qcp-causal-basis-central-register-v1.yml
M docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json
```

Exact error:

`central-register patch must modify only the QCP JSON`

Therefore:

```text
intended QCP JSON mutation             acceptance PASS
self-deletion in same candidate patch  adds second changed file
QCP-only scope guard                   correctly rejects 2-file delta
Publish                                never runs
central QCP                            remains unregistered
CP2                                    sees five causal package paths as UNKNOWN
```

Do NOT solve this by weakening or deleting the QCP-only guard.

Do NOT invent a second registry mechanism.

Do NOT interpret a green helper acceptance as proof that the real central QCP consumed the registration; verify the actual committed QCP authority JSON and the real QCP run.

### H. Exact next plan

Proceed in this order:

```text
1. Preserve frozen Runtime 3d5fd13c... exactly.

2. Preserve #3636 as DRAFT / OPEN / UNMERGED.

3. Audit/extract the exact QCP JSON mutation already generated by the
   central-register helper and already proven by
   ACCEPTANCE_MCFT_CAP_09_QUALIFICATION_CONTROL_PLANE_V1.

4. Land a genuinely QCP-JSON-only registration patch on the #3636
   integration line, OR minimally repair the generator so its published
   candidate is genuinely QCP-only.

5. Keep helper cleanup / self-deletion separate from the QCP-only
   registration change. Do not weaken the one-file scope guard.

6. Re-run the real central QCP on the new exact head.

7. Require the five causal package paths to stop producing
   CP2_*UNKNOWN* errors.

8. Take the NEW machine first-red only.

9. If the next red is causal supersession adjudication:
   - preserve old 24T evidence historically;
   - do not reinterpret old 24T as new causal-revision proof;
   - require the exact replacement basis;
   - fail closed on missing / ambiguous replacement evidence.

10. Only after CP2 / semantic adjudication is green, read the new QCP
    artifact and enumerate the CURRENT immutable requalification blockers.

11. Graduate evidence only from real successful exact-head runs/artifacts
    through the existing immutable registry / anchor mechanism.

12. Do not hand-create evidence JSON and do not edit dependency digests
    to make old evidence look current.

13. Rerun QCP and drive the real blocker count to zero.

14. Even after QCP=green, do NOT merge #3636, arm Formal-v5, start A0,
    or start O00–O23 without a separate explicit authorization.
```

### I. The old “11 evidence blockers” are historical context, not the immediate action list

At a previous stable exact head, QCP had 11 current requalification / successor-chain evidence blockers after the direct H6 / Private Store diagnostics were closed.

Many corresponding execution workflows are now green on current head, including Phase5 and H6.

However, current `c5fb...` QCP dies earlier at CP2. Consequently:

```text
old 11-list ≠ current immediate work queue
```

Do not hard-code the old list or graduate evidence against a moving head. First fix CP2. Then obtain the new exact-head blocker inventory from QCP.

Every head movement can invalidate subject identity / dependency digest / evidence binding. Evidence graduation must happen only after the execution/control-plane head is stable.

### J. Pitfalls / rules learned in this closure work — do not repeat

1. **First-red controls the work order.** Do not work on downstream blocker counts when QCP dies earlier in CP2.

2. **QCP binding, not workflow name similarity, determines which workflow counts.** Several similarly named Phase5 workflows existed; only the QCP-bound execution workflow was relevant.

3. **Do not reopen frozen Runtime for a compiler-policy mismatch.** H6 ad-hoc `tsc --strict` recursively pulled frozen Runtime through type-only imports and exposed TS7022, while canonical server Typecheck/Build passed. The correct fix was the H6 boundary / seam identity proof, not Runtime mutation.

4. **Removing a few strict roots was insufficient.** Type-only import closure can recurse into producer code. Split the qualification boundary explicitly.

5. **No `@ts-ignore`, fake `.d.ts`, broad cast workaround, `|| true`, `noResolve` hiding imports, or global strict disable.**

6. **Registry pull failure is not automatically Runtime or DB failure.** In Phase5, `postgres Interrupted` was compose fallout after MinIO pull authorization failed. Diagnose the first causal error.

7. **Exact-digest mirrors are acceptable only when content digest remains identical and the mirror itself is verified.** Never replace with floating `latest`.

8. **Historical evidence cannot be silently reinterpreted under revised semantics.** The old 24T result remains evidence of its old proposition only.

9. **Do not graduate immutable evidence before final exact head stabilizes.** A subsequent control-plane commit can invalidate current-head evidence and dependency digests.

10. **Do not fabricate evidence or manually rewrite subject/dependency-digest fields.** Use real runs/artifacts and the existing registry/anchor mechanism.

11. **A helper “register” workflow being locally green is not the same as central QCP consuming registration.** Verify the committed authority JSON and real QCP machine output.

12. **Do not weaken successor-chain fail-closed gates with broad allowlists/globs.** Register only the governed exact package/boundary required by the contract.

13. **Specifically for the current central-register failure: do not weaken the one-file guard.** Its mechanical contradiction is self-deletion in the same candidate patch. Separate cleanup from registration.

14. **User local worktree has intentionally been kept on the frozen Runtime line during integration work.** Prefer fetch/object inspection or detached temporary worktrees; do not casually checkout #3636 over that working tree.

15. **Remote drift must fail closed.** Re-read #3636 exact head before any write. No force push.

16. **Keep PR #3298 documentation-only.** Engineering changes belong on the engineering line, not the handoff branch.

### K. Authority ceiling remains unchanged

Unless the user separately and explicitly authorizes it:

- do not merge #3636;
- do not mutate protected main;
- do not mutate frozen Runtime semantics;
- do not mutate production DB / Formal store;
- do not activate / cut over production owners merely to satisfy qualification;
- do not arm Formal-v5;
- do not start A0;
- do not start O00–O23;
- do not claim Stage 1B closure;
- do not claim MCFT CAP-09 completion;
- do not start T1–T6 MCFT→ADR→B-Line implementation yet;
- do not weaken exact SHA / digest / authority / successor-chain / evidence identity checks.

### L. Compact takeover state — 2026-09-30

```text
MANDATORY READ — BOTH HANDOFFS
1. docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md
2. docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-09-26.md

FROZEN RUNTIME
3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a
Runtime feature line                  FROZEN
FINAL_24H_ADMITTED                    true
Formal-v5                             NOT ARMED
A0                                    NOT AUTHORIZED
O00–O23                               NOT AUTHORIZED
CAP-09 complete                       false

ACTIVE ENGINEERING
PR #3636                              DRAFT / OPEN / UNMERGED
base                                  8f63c498bd48978e2dd525ad57b6b8fdb7ada560
exact head                            c5fbfa25ce339bcc7186432569d078e2e9be3b62

CURRENT QCP
run                                   36662310640
job                                   109719560352
first-red                             Phase 0-2 successor-chain candidate qualification
error family                          CP2_*UNKNOWN*
affected causal package paths         5

CENTRAL-REGISTER HELPER
run                                   36662307332
job                                   109719511228
QCP JSON acceptance in isolation      PASS
candidate tree delta                  2 files
                                       D helper workflow
                                       M QCP JSON
QCP-only guard                        FAIL — correctly
Publish                               SKIPPED

CURRENT ROOT BLOCKER
central QCP has not yet committed / consumed the
causal-revision qualification-basis registration

NEXT
land/audit genuine QCP-JSON-only registration
→ rerun central QCP
→ require CP2 unknown=0
→ take new first-red
→ only then enumerate/graduate current-head immutable evidence

DO NOT
reopen Runtime
weaken QCP-only or successor-chain guards
fabricate evidence
reuse stale 11-blocker list as current queue
merge #3636
arm Formal-v5
start A0 / O00–O23
start T1–T6
```

---

## 2026-09-29 ACTIVE CHECKPOINT — CAP-09 blocker convergence on main-based integration successor

This section is the newest continuation checkpoint. It supersedes the 2026-09-27 and 2026-09-26 current-state summaries below wherever they conflict. Older sections are intentionally preserved as historical engineering context.

### A. Mandatory reading order for the next engineer

There are exactly two MCFT CAP-09 handoff documents in the current handoff model. Read both before changing code:

1. Historical canonical archive — frozen, do not rewrite:
   `docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md`

2. Active continuation — current-state authority from 2026-09-26 onward:
   `docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-09-26.md`

Also read the MCFT / Digital Twin master task document and the CAP-09 task / acceptance / governance documents before engineering changes. Do not start from this handoff alone.

### B. What task is active now

The active task is no longer Runtime feature development and is not “continue building Twin”.

The active task is:

```text
close the remaining qualification / governance blockers on the
main-based MCFT CAP-09 integration successor
without reopening the frozen Runtime line
```

Current integration successor:

```text
PR            #3636 — MCFT CAP-09 integration successor: qualified infra + frozen Runtime
state         OPEN / DRAFT / UNMERGED
base          main
base SHA      8f63c498bd48978e2dd525ad57b6b8fdb7ada560
head branch   integration/mcft-cap09-qualified-runtime-infra-v1
exact head    8b14b729be755bd9c800bd13b1b9d688bcf99fd6
mergeable     true
```

Exact component inputs recorded by #3636:

```text
qualified infra   29c0ca1379940516482e05ae1661770c67d3cb74
frozen Runtime    3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a
original combined synthetic merge object
                  b77f8ffcc640f44eb8ce50742098ae1729509ed8
```

PR #3636 remains qualification / integration only. It does not authorize merge, production mutation, Formal-v5 arm, A0, O00–O23, Stage 1B closure, or CAP-09 completion.

### C. Frozen Runtime state — do not reopen for QCP / CI red

The Runtime candidate used by the current integration line is:

`3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`

Exact-head final Runtime admission was machine-proven:

```text
status                 PASS
FINAL_24H_ADMITTED     true
pending                0
authority_effect       false
production_effect      false
formal_v5_arm          false
a0_authorized          false
o00_o23_authorized     false
```

Admission requirements on this exact Runtime subject include:

```text
failure taxonomy compatibility seam                  PASS
exact P0-H raw materialized / hash verified          PASS
full resource envelope                               PASS
accelerated restart / missed-slot oldest-first       PASS
2–4h live-provider soak                              PASS
```

This is Runtime admission, not Formal closure:

```text
FINAL_24H_ADMITTED = true
    ≠ Formal-v5 armed
    ≠ A0 authorized
    ≠ O00–O23 authorized
    ≠ Stage 1B closed
    ≠ MCFT CAP-09 completed
```

Do not modify Runtime merely because qualification evidence, workflow topology, registry binding, or QCP is red. Runtime changes now require new machine evidence of an actual Runtime defect.

### D. Important Runtime hardening completed after the older b497 checkpoint

The Runtime line advanced beyond the 2026-09-27 `b497...` checkpoint and closed a real KBS failure mode before freezing at `3d5fd13c...`.

Root cause discovered from retained real objects:

- non-KBS GRIB payloads could reach the KBS raw-hourly scientific parser;
- the parser attempted UTF-8 decoding;
- raw `UnicodeDecodeError` escaped as an unclassified scientific subprocess failure;
- the production classifier could therefore promote the attempt to `PROCESS_FATAL` and kill Evidence Runtime.

The fix normalized these provider payload failures:

```text
MCFT_CAP09_KBS_RAW_HOURLY_NON_CSV_PAYLOAD:<type>
MCFT_CAP09_KBS_RAW_HOURLY_INVALID_UTF8
```

Both classify as:

`ATTEMPT_REJECTED`

and do not kill the host.

Committed acceptance coverage includes:

```text
ACCEPTANCE_MCFT_CAP_09_KBS_NON_CSV_PAYLOAD_REJECTION_V1.cjs
ACCEPTANCE_MCFT_CAP_09_KBS_NON_CSV_CLASSIFIER_REPLAY_V1.cjs
FAILURE_DISCOVERY_GATE matrix cases
Phase5 process-boundary taxonomy alignment
```

Known-case `UNCLASSIFIED_ERROR` remains zero in the FDG contract.

### E. Qualification path-ownership blocker closed

The first major #3636 QCP blocker was not a Runtime defect. The central applicability planner saw new failure-discovery / qualification files as unknown changed paths.

A narrow control-plane authority change added 17 exact paths to:

`dependency_resolvers.CONTROL_PLANE_FILES.paths`

in:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json`

Commit:

`3c98bd2d0bf5c320fe3910ae4ec97f25f140b88a — Govern failure-discovery qualification paths`

The result after the patch:

```text
planner exit             0
planner status           PASS
generation               v13
unknown_changed_paths    0
authority_errors         0
resolver_errors          0
planner blockers         0

CONTROL_PLANE_INTEGRITY
status                   REQUALIFY
reason                   GOVERNED_DEPENDENCY_CHANGED
```

Central applicability self-acceptance also passed:

```text
status                         PASS
resolver_count                 32
all resolvers materialized     true
unknown changed path fails closed
                               true
regex fallback used            false
runtime mutation               false
production workflow activation false
formal database mutation       false
```

This means the old “unknown path / ownership” first-red is CLOSED. Do not reopen it by weakening the planner or adding broad globs.

### F. #3636 advanced after 3c98 — current exact head is 8b14

After the path-ownership fix, #3636 advanced five commits to current head `8b14b729...`.

The changes were narrow workflow / acceptance convergence, not a reopening of the Runtime feature line. The commit sequence includes:

```text
Fix Phase3 immutable MinIO mirror source
Align KBS baseline acceptance with rejection taxonomy
Fix Phase7 immutable MinIO mirror sources
Keep Phase7 mirror fix source-only
Fix EA5C2B1 immutable MinIO mirror sources
```

Changed paths from `3c98...` to `8b14...` are limited to:

```text
.github/workflows/mcft-cap-09-ea5c2b1-live-kbs-soil-ingress-executor.yml
.github/workflows/mcft-cap-09-phase3-evidence-runtime-persistence.yml
.github/workflows/mcft-cap-09-phase7-candidate-promotion-composition.yml
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_PUBLICATION_BASELINE_V1.ts
```

The immutable MinIO rule remains:

```text
exact digest / immutable mirror required
floating latest forbidden
```

### G. Current QCP first-red — blocker inventory, not topology or ownership

Latest QCP on current exact head:

```text
run      36509905988
job      109219520177
head     8b14b729be755bd9c800bd13b1b9d688bcf99fd6
result   FAILURE
artifact 11008573410
```

Step state:

```text
Require governed successor predecessor and zero production bindings   PASS
Prove central applicability semantics                                 PASS
Prove generation, durable-anchor, dependency-digest semantics         PASS
Resolve immutable qualification evidence references                   PASS
Generate exact PR applicability plan                                  PASS
Enumerate all blockers without fail-fast                              FAIL
Validate control-plane machine proof                                  SKIPPED
```

Official blocker artifact counts:

```text
total checks           33
pass                   15
fail                   13
not applicable          5
unknown                  0
forbidden                0
authority errors         0
unknown changed paths    0
blocker count           13
planner status          PASS
```

Therefore the current QCP failure is NOT:

- unknown path ownership;
- central applicability semantics;
- predecessor topology;
- durable anchor generation;
- immutable evidence reference resolution.

It is now the next layer: exact-head requalification evidence plus two remaining diagnostics.

### H. Current official 13 blockers

The GitHub QCP artifact on exact head `8b14...` lists:

```text
1.  V13_AUTONOMOUS_FORCING_FOUNDATION
2.  V13_HOLISTIC_SCHEMA
3.  V13_NEXT_TICK_VIABILITY
4.  EA5C1_DURABLE_RAW_RESTRICTED_INGRESS
5.  LEGACY_AM19_PERSISTENT_24T
6.  PHASE2_EVIDENCE_PROVIDER_MODULES
7.  PHASE3_EVIDENCE_RUNTIME_FOUNDATION
8.  PHASE4_TWIN_RUNTIME_FOUNDATION
9.  PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS
10. PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION
11. FORMAL_V5_H6_SUCCESSOR_SEAM
12. PRODUCTION_TWIN_PROCESS_V2_ROUTING
13. PRODUCTION_EVIDENCE_RUNTIME_PRIVATE_STORE_BINDING
```

Classification:

```text
11 = invalid / missing current successor requalification evidence
 2 = diagnostic failures
```

For most durable evidence candidates, the repeated decisive mismatch is:

`dependency_digest_match = false`

Phase3 and Phase5 use successor-chain-specific requalification evidence and also remain unresolved on the current integration subject.

Do not interpret these 11 entries as eleven independent Runtime bugs. The dominant pattern is stale / non-current evidence identity after integration dependency closure changed.

### I. Two current diagnostic blockers that require careful governance analysis

#### I1. FORMAL_V5_H6_SUCCESSOR_SEAM

Current diagnostic error:

```text
H6_HISTORICAL_OR_PRODUCTION_V2_REWRITE_FORBIDDEN:
apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts

actual blob   f1f379a40e55d81d43c5d1b7975aded74d10092c
expected blob f91baec7e075f282b8e2cecaf56d4256fc728113
```

Do not “fix” this by casually rewriting the frozen H6 acceptance or production V2 Runtime. First determine whether current integration contains an already-governed successor replacement that the H6 diagnostic must bind to, or whether this is a genuine forbidden rewrite.

#### I2. PRODUCTION_EVIDENCE_RUNTIME_PRIVATE_STORE_BINDING

The current diagnostic fails its changed-path / exact-boundary assertion against the large integration successor.

Earlier local inspection showed this acceptance was written around a narrow historical successor boundary. Do not treat a bare diagnostic failure on an 83-file integration PR as proof that private-store Runtime is broken.

First determine the correct governed successor mode / evidence path for the current integration subject. Do not weaken the private-store contract merely to make QCP green.

### J. Current workflow landscape on 8b14

Important exact-head workflows already green include:

```text
ci                                             SUCCESS
mcft-release-lane-v1                           SUCCESS
mcft-delivery-policy-v2                        SUCCESS
mcft-cap09-minio-immutable-mirror-preflight-v1 SUCCESS
mcft-cap-09-failure-discovery-gate-v1          SUCCESS
mcft-cap-09-phase4-twin-runtime-persistence    SUCCESS
mcft-cap-09-phase5-production-equivalent-containers SUCCESS
mcft-cap-09-ea5e2-runtime-dependency-graph     SUCCESS
mcft-cap-09-ea5e2-successor-runner-qualification SUCCESS
mcft-cap-09-v13-autonomous-forcing-foundation  SUCCESS
mcft-cap-09-v13-holistic-schema-postgres       SUCCESS
mcft-cap-09-v13-next-tick-viability-postgres   SUCCESS
MCFT CAP-09 Current-Main Re-Anchor 2144        SUCCESS
MCFT CAP-09 Production Runtime Owner Cutover    SUCCESS
```

Important exact-head workflows still red include:

```text
mcft-cap-09-qualification-control-plane-v1
mcft-cap-09-phase3-evidence-runtime-persistence
mcft-cap-09-ea5c1-durable-raw-restricted-ingress
mcft-cap-09-ea5c2b1-live-kbs-soil-ingress-executor
mcft-cap-09-phase7-candidate-promotion-composition
mcft-cap-09-amendment-19-persistent-production-cutover
mcft-cap-09-phase5-two-service-accelerated-24t
MCFT CAP-09 Production Twin Process V2 Routing
MCFT CAP-09 Production Evidence Runtime Private Store Binding
mcft-cap-09-formal-v5-post-graduation-readiness
mcft-cap-09-v13-fenced-fact-promotion-postgres
```

At the time of this checkpoint, the current-head failure-discovery live-provider soak workflow was still in progress. Do not assume a final result without re-reading GitHub.

The fact that many component workflows are green while QCP still reports `NO_VALID_REQUALIFICATION_EVIDENCE` is a critical clue: successful workflow execution and durable requalification-evidence graduation are separate things.

### K. Immediate next plan — handle blocker root causes, not the count

Proceed in this order:

```text
1. Keep frozen Runtime 3d5fd13c... unchanged.

2. Stay on #3636 main-based integration successor.

3. For current failed formal workflows, retrieve the first failed job/step/log on exact head 8b14...:
   - Phase3
   - EA5C1
   - EA5C2B1
   - AM19
   - Phase7
   - accelerated 24T
   - Production Twin V2 Routing
   - Private Store Binding
   - Formal-v5 post-graduation readiness

4. Separate failures into:
   A. workflow genuinely fails;
   B. workflow succeeds but current exact-head durable evidence is not graduated / registered;
   C. bare diagnostic is inapplicable because required governed-base / successor context is missing.

5. Prioritize the common upstream evidence problem:
   current dependency digest / subject / stage / binding identity must produce or select valid successor requalification evidence.

6. Do not manufacture evidence JSON.

7. Do not copy old evidence and edit subject/digest fields.

8. Do not weaken `dependency_digest_match` or successor-chain checks.

9. For H6 and Private Store diagnostics, establish whether a current governed successor mode exists before changing acceptance code.

10. Re-run QCP only after one root blocker is materially closed; take the new machine first-red.

11. Do not merge #3636 without separate user authorization.

12. Formal-v5 arm / A0 / O00–O23 remain separate explicit authorization boundaries.
```

### L. Post-CAP-09 direction — planned, NOT YET STARTED

Once CAP-09 is genuinely closed, MCFT must stop being an open-ended Twin feature-development line.

The agreed direction is:

```text
MCFT
→ stable Field-State Authority provider
→ exact, read-only state export
→ ADR-consumable measurement/context semantics
→ governed GEOX Field ↔ ADR target binding
→ ADR Applicability / RuntimeBinding / DecisionResult
→ B-Line Approval / Execution Authorization / ExecutionReceipt
→ DecisionTimeAuthorityManifest composition / replay proof
```

The first integrated chain must deliberately remain small:

```text
ONE REAL FIELD
ONE REAL DECISION SUBJECT
```

The first irrigation integration is allowed to end in:

`ADR = UNRESOLVED / ASK`

when FC/AWC/PWP, root-zone aggregation, crop/stage, MAD or other scientific semantics are not qualified. MCFT must not fabricate scientific parameters or turn measurement availability into agronomic authority.

Do NOT start this T1–T6 integration work while CAP-09 closure is still open. Current priority is blocker convergence only.

After closure, retain only a small MCFT maintenance / authority-provider ownership and move the main engineering effort to a temporary MCFT + ADR + B-Line integration workstream. The integration team owns no new authority.

### M. Pitfalls discovered in the 2026-09-28 / 2026-09-29 work — do not repeat

1. **Local all-blockers preflight can produce false diagnostic reds.**
   Bare diagnostic execution may omit required exact-base environment / governed successor context. The local preflight once showed 19 blockers while the formal GitHub QCP artifact reduced the authoritative set to 13. Use formal workflow evidence for adjudication.

2. **Do not equate a green component workflow with durable requalification evidence.**
   QCP can still reject historical candidates on `dependency_digest_match=false`. Evidence graduation / registry binding is a separate step.

3. **Do not feed arbitrary retained objects to the KBS parser based on size alone.**
   Retention contains heterogeneous objects, including GRIB. Fingerprint payloads first. GRIB-at-KBS was the root of a real `PROCESS_FATAL` escape before classification was fixed.

4. **PowerShell `elseif` cannot be entered as a new independent command after an `if` block has already executed.**
   Keep `if / elseif / else` in the same submitted block.

5. **Windows PowerShell 5.1 does not support `Set-Content -Encoding utf8NoBOM`.**
   Use `[System.Text.UTF8Encoding]::new($false)` with `WriteAllText` when a BOM-free script is required.

6. **UTF-8 BOM before a Node shebang causes `SyntaxError: Invalid or unexpected token`.**
   Verify first bytes when generating `.cjs` scripts; `23 21 2F 75...` is the expected `#!/u...` prefix.

7. **`node --expose-gc` can be lost through a wrapper invocation.**
   The working form for the TS resource sanity acceptance was:
   `node --expose-gc --import tsx <script.ts>`.

8. **An empty Docker container ID is dangerous.**
   `docker stats --no-stream $Cid` with an empty `$Cid` can display every running container and create a false diagnosis. Test the ID before inspect/stats.

9. **Do not install toolchains ad hoc inside the proof container when the base image can provide them exactly.**
   A first full-resource proof attempt failed because NodeSource TLS failed, Debian `nodejs` installed without npm, and the script stopped. The robust path used a multi-stage Node + Python proof image.

10. **MinIO exact digest pinning must remain immutable and pipefail-safe.**
    Do not use floating tags. The digest parser was changed from early-exit `awk ... { print $2; exit }` to a pipefail-safe accumulator because early pipe termination can make the producer fail under `set -o pipefail`.

11. **Do not treat QCP / workflow / evidence-registry red as permission to reopen Runtime.**
    The frozen Runtime already has exact-head admission proof. New Runtime work needs new Runtime-defect evidence.

12. **Exact-head proofs are SHA-bound.**
    Every new commit invalidates assumptions about prior exact-head qualification unless the governance contract explicitly carries evidence forward.

13. **Long Windows applicability self-acceptance is not necessarily hung.**
    It may spend substantial time spawning Git operations. Check CPU delta and new Git subprocesses before aborting.

14. **Keep the handoff branch documentation-only.**
    Do not mix engineering changes into PR #3298.

### N. Explicit authority ceiling at this checkpoint

Unless separately authorized:

- do not merge #3636;
- do not merge #3632 merely because Runtime admission is green;
- do not mutate production DB or Formal store;
- do not restart / cut over production owners to satisfy qualification;
- do not arm Formal-v5;
- do not start A0;
- do not start O00–O23;
- do not claim Stage 1B closure;
- do not claim MCFT CAP-09 completion;
- do not begin MCFT→ADR→B-Line implementation before CAP-09 closure;
- do not weaken exact SHA / digest / authority / evidence identity checks.

### O. Compact state for the next engineer — 2026-09-29

```text
READ FIRST
1. docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md
2. docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-09-26.md

protected main
8f63c498bd48978e2dd525ad57b6b8fdb7ada560

FROZEN RUNTIME
3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a
Runtime admission            PASS
FINAL_24H_ADMITTED           true
pending                      0
Formal-v5                    NOT ARMED
A0                           NOT AUTHORIZED
O00–O23                      NOT AUTHORIZED
CAP-09 complete              false

ACTIVE INTEGRATION
PR #3636                    DRAFT / OPEN / UNMERGED
base                         main@8f63c498bd48978e2dd525ad57b6b8fdb7ada560
head                         8b14b729be755bd9c800bd13b1b9d688bcf99fd6
qualified infra              29c0ca1379940516482e05ae1661770c67d3cb74
frozen Runtime component     3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a

QCP
run                          36509905988
step 3                       PASS
step 4                       PASS
step 5                       PASS
step 6                       PASS
step 7                       PASS
step 8 blocker inventory     FAIL
planner                      PASS
unknown_changed_paths        0
authority_errors             0
blockers                     13

CURRENT BLOCKER SHAPE
11  current requalification evidence / successor-chain evidence
 2  diagnostics: H6 successor seam + Private Store Binding

NEXT
retrieve exact failed workflow first-reds
identify common evidence-graduation / digest-binding root cause
fix one upstream blocker only
rerun QCP

DO NOT
reopen Runtime for qualification red
fabricate evidence
weaken digest checks
merge without authorization
arm Formal-v5 / start A0 / O00–O23
start post-CAP09 MCFT→ADR→B-Line work yet
```

---

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