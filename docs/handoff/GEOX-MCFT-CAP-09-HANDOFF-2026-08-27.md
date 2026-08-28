# GEOX MCFT-CAP-09 Conversation Handoff — 2026-08-28 Continuation — Phase 7 Candidate Promotion Composition / Dual-Closure Governance Frontier

Status: **CONVERSATION HANDOFF / CURRENT AUTHORITATIVE CONTINUATION — NOT MASTER-TASK AUTHORITY**

Timestamp: **2026-08-28 22:35 +08:00**

Repository: liyongshang44-max/GEOX

Purpose: continue the same MCFT-CAP-09 Production Hosting route after Phase 6 closed and the first Phase 7 private-candidate I/O predecessor formally closed. This section records the accepted #3362 predecessor, the clean successor-branch checkpoint that existed before implementation was attached, the current #3364 capture/promotion composition implementation and machine proof, and the exact dual-dependency-closure governance defect that must be repaired before fresh requalification evidence may be registered.

> **This section is now the highest-priority conversation continuation in this file.**
>
> The previous Phase 6 continuation beginning with E0 is intentionally preserved in full below as historical reasoning/evidence.
>
> The earlier Phase 5, Phase 4/3/2 continuations remain preserved below that.
>
> Do not delete or rewrite those historical sections. They explain why GitHub production ownership was retired, why private durable candidate state exists, why failed Formal-v4 state cannot be reused, and why current Phase 7 work must remain stacked and fail-closed.
>
> This handoff does **not** supersede docs/SSOT.md, the Digital Twin Master Task Line, the CAP-09 taskbook, accepted CAP-01→08 authority, immutable Formal evidence, the qualification control plane, or the frozen Production Hosting route.

---

## F0. READ THIS FIRST — the user-supplied clean-branch snapshot was correct, but the repository advanced afterward

The handoff request supplied this checkpoint:

~~~
#3362 closure head = 46c9c7b6b59c113848fc69daff88fb183fccc954
successor branch =
  feat/mcft-cap09-phase7-candidate-promotion-composition-v1

successor branch == 46c9c7b6...
capture/promotion composition blobs = unattached
candidate manifest upgrade blobs    = unattached
focused acceptance blobs            = unattached
~~~

That was a valid intermediate state.

The live repository has advanced since that snapshot.

The authoritative current frontier is now:

~~~
Draft PR #3364
feat(mcft-cap09): compose Phase7 private candidate fenced promotion

base =
  46c9c7b6b59c113848fc69daff88fb183fccc954

current head =
  fe9df68e2d446cdc6543cb50f92aadacf3c298d0

commits       = 3
changed_files = 8
Draft         = true
open          = true
mergeable     = true
~~~

Therefore do **not** tell the next engineer that the successor branch is still clean or that the implementation exists only as unattached blobs.

That statement is now historical context.

Current implementation and qualification work is already attached to #3364.

---

## F1. Current task in one sentence

**Close the Phase 7 private candidate capture/promotion composition by making its cross-plane dependency ownership truthful: the new Evidence-side adapter must participate in both the Phase 3 Evidence Runtime qualification closure and the existing V13 autonomous-forcing/fenced-promotion closure, then the affected exact-head workflows must fresh-requalify and durable evidence must be registered only after the final dependency sets stabilize; do this without production process wiring, without provider refetch during promotion, without arming Formal-v5, and without moving protected main.**

---

## F2. Authority reconstruction order for the next engineer

Read in this order:

1. docs/SSOT.md
2. docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md
3. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
4. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md
5. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json
6. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json
7. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json
8. #3362 terminal predecessor evidence
9. #3364 current exact head / control-plane artifact
10. this handoff, newest continuation first

Weekly/status notes are operational context only.

They are not authority.

---

## F3. Protected main remains untouched

Protected main is still exactly:

~~~
26c1383f7f45abb76c99e28ec3d06714e85d1b2c
~~~

Latest main commit message remains the historical merge of PR #3286.

Neither #3362 nor #3364 is merged into protected main.

No Phase 7 implementation in this continuation changes that fact.

---

## F4. #3362 is formally closed and is the exact Phase 7 predecessor

Draft PR:

~~~
#3362
feat(mcft-cap09): add Phase7 private candidate I/O foundation
~~~

Accepted head:

~~~
46c9c7b6b59c113848fc69daff88fb183fccc954
~~~

Stacked base:

~~~
d6c015b49d09960591185ff9c930e64dac7e2806
~~~

GitHub state:

~~~
open       = true
Draft      = true
mergeable  = true
commits    = 6
files      = 9
~~~

Closure is machine-evidence closure of the stacked predecessor.

It does **not** mean protected main was merged.

### F4.1 Exact-head workflow closure

At 46c9c7b6... the full exact-head set is 12/12 SUCCESS:

~~~
33168990476  mcft-cap-08-authority-reconciliation                  SUCCESS
33168990445  mcft-main-ruleset-readiness-v1                       SUCCESS
33168990473  mcft-candidate-declaration-selftest-v2                SUCCESS
33168990454  mcft-cap-09-phase6-runtime-independence               SUCCESS
33168990422  mcft-cap-09-ea5e2-runtime-dependency-graph            SUCCESS
33168990436  mcft-delivery-policy-v2                               SUCCESS
33168990461  mcft-release-lane-v1                                  SUCCESS
33168990545  mcft-cap-09-ea5e2-live-window-preflight-hardening     SUCCESS
33168990459  mcft-cap-09-ea5e2-successor-runner-qualification      SUCCESS
33168990430  mcft-cap-09-phase3-evidence-runtime-persistence       SUCCESS
33168990431  mcft-cap-09-qualification-control-plane-v1            SUCCESS
33168990490  ci                                                    SUCCESS
~~~

### F4.2 #3362 central closure proof

Central run:

~~~
33168990431
~~~

Artifact:

~~~
artifact id =
  9684863842

artifact name =
  mcft-cap09-qualification-control-plane-46c9c7b6b59c113848fc69daff88fb183fccc954

artifact digest =
  sha256:e93f9bfebf04caf09ebafa0125282f4b39ca5c4d204dd3087cae2517a79a5e88
~~~

Machine preflight:

~~~
status                = PASS
planner_status        = PASS

total_checks          = 16
pass                  = 12
fail                  = 0
not_applicable        = 4
carry_forward         = 4
required              = 6
requalify             = 2
unknown               = 0
forbidden             = 0

authority_errors      = 0
unknown_changed_paths = 0
blocker_count         = 0
blockers              = []
~~~

### F4.3 #3362 ordinary CI closure

CI run:

~~~
33168990490
~~~

Jobs:

~~~
build-test = SUCCESS
acceptance = SUCCESS
~~~

The acceptance job completed all repository commercial/customer-report gates, final runtime hygiene, artifact collection, and shutdown.

### F4.4 Why #3362 matters

#3362 established the durable private candidate I/O foundation.

The important boundary was:

~~~
capture
  may persist private candidate authority

capture
  must not write Formal facts

promotion / rehydration
  must not depend on GitHub artifacts

promotion / rehydration
  must not refetch providers

private retained raw
  remains private durable Evidence-plane authority
~~~

The successor work in #3364 is stacked exactly on this accepted head.

---

## F5. Important intermediate checkpoint — clean successor branch before attachment

Immediately after #3362 closure, the successor branch was created:

~~~
feat/mcft-cap09-phase7-candidate-promotion-composition-v1
~~~

At that checkpoint it was exactly equal to:

~~~
46c9c7b6b59c113848fc69daff88fb183fccc954
~~~

No implementation commit had been attached yet.

The following had been prepared only as unattached Git blobs:

- capture/promotion composition;
- candidate manifest upgrade;
- focused acceptance.

This checkpoint is worth preserving because it demonstrates that the next slice was deliberately staged before mutation.

However, it is **not** the current frontier anymore.

Do not reset the branch back to this state unless there is a concrete reason to discard #3364.

---

## F6. Current successor PR — #3364

Current Draft PR:

~~~
#3364
feat(mcft-cap09): compose Phase7 private candidate fenced promotion
~~~

Branch:

~~~
feat/mcft-cap09-phase7-candidate-promotion-composition-v1
~~~

Exact stacked base:

~~~
46c9c7b6b59c113848fc69daff88fb183fccc954
~~~

Current exact head:

~~~
fe9df68e2d446cdc6543cb50f92aadacf3c298d0
~~~

GitHub facts:

~~~
state         = open
Draft         = true
mergeable     = true
commits       = 3
changed_files = 8
~~~

Current changed files are:

~~~
.github/workflows/mcft-cap-09-phase6-runtime-independence.yml

.github/workflows/mcft-cap-09-phase7-candidate-promotion-composition.yml

.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml

apps/server/src/external_evidence/
  mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts

apps/server/src/external_evidence/
  s3_compatible_private_candidate_manifest_store_v1.ts

docs/digital_twin/mcft/cap_09/
  GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json

docs/digital_twin/mcft/cap_09/
  GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json

scripts/runtime_acceptance/
  ACCEPTANCE_MCFT_CAP_09_PHASE7_CANDIDATE_PROMOTION_COMPOSITION_V1.ts
~~~

This is now the sole current Phase 7 candidate-promotion implementation frontier.

---

## F7. #3364 exact commit progression

The current three commits are:

~~~
bb68f98583e6f8158c3d9f826f29d90859529761
feat(mcft-cap09): compose private candidate fenced promotion

5f933c20a4c6b8a94fe5f2e9b9863fb005aa8eb4
fix(mcft-cap09): narrow candidate replay timestamp

fe9df68e2d446cdc6543cb50f92aadacf3c298d0
fix(mcft-cap09): qualify full 72h promotion payload
~~~

Do not collapse these into a statement that the first implementation commit was already final.

The second and third commits record real refinement of replay/promotion semantics and qualification payload coverage.

---

## F8. What the current capture/promotion composition is intended to do

The new product adapter is:

~~~
apps/server/src/external_evidence/
mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts
~~~

It bridges:

~~~
Phase3 Evidence/provider/private-candidate side
        ↓
private candidate manifest
        ↓
private retained raw references
        ↓
deterministic replay / decoder identity
        ↓
exact semantic-manifest equality
        ↓
existing V13 fenced exact-base promotion
        ↓
Formal facts
        ↓
controller attestation
        ↓
cursor advancement only after attestation
~~~

The design intentionally does **not** make GitHub artifact storage an operational authority.

It intentionally does **not** authorize provider refetch during promotion.

It intentionally does **not** write Formal facts during capture.

It intentionally does **not** activate a production process graph in this slice.

---

## F9. Candidate manifest upgrade

Current candidate manifest implementation is:

~~~
apps/server/src/external_evidence/
s3_compatible_private_candidate_manifest_store_v1.ts
~~~

#3364 extends the candidate replay authority carried by that private manifest.

The PR contract states that the v1 manifest remains backward-readable while optional deterministic replay-authority fields are added.

The intended replay contract now includes enough authority to bind:

- exact semantic record identity;
- raw private retention references;
- decoder identity / factory selection;
- frozen canonical record ingestion time needed for deterministic replay;
- exact replay equality before Formal mutation.

Do not turn the manifest into a raw-value dump.

The manifest remains a semantic/private-reference authority.

---

## F10. Current focused composition workflow is already machine green

Workflow:

~~~
.github/workflows/
mcft-cap-09-phase7-candidate-promotion-composition.yml
~~~

Exact-head run:

~~~
33178399042
head = fe9df68e2d446cdc6543cb50f92aadacf3c298d0
conclusion = SUCCESS
~~~

Artifact:

~~~
artifact id =
  9688644422

artifact name =
  mcft-cap09-phase7-candidate-promotion-composition-fe9df68e2d446cdc6543cb50f92aadacf3c298d0

artifact digest =
  sha256:f32cec6ae5e11a8c132943856ada34400d32e7606d10dc39856e49fedbc25034
~~~

### F10.1 What the focused proof actually demonstrates

Machine proof:

~~~
qualification_mode =
  REAL_MINIO_PLUS_REAL_POSTGRES_V13_FENCED_PROMOTION

capture_provider_work_item_count = 2
capture_raw_object_count         = 2
candidate_semantic_record_count  = 3

candidate_manifest_private_readback = true
replay_authority_fields_complete    = true

promotion_provider_refetch_count          = 0
promotion_github_artifact_rehydration_count = 0
promotion_raw_store_write_count           = 0

rehydration_semantic_manifest_exact_match = true
rehydration_decoder_factory_count         = 2

real_postgres_fenced_promotion             = true
real_postgres_formal_fact_present_count    = 3
exact_three_facts_single_fenced_transaction = true

promotion_did_not_advance_cursor      = true
controller_attestation_after_promotion = true
cursor_advanced_only_after_attestation = true

pre_mutation_failure_fails_closed = true
capture_formal_database_write_count = 0
~~~

### F10.2 Explicit non-effects proved by the workflow

The artifact also records:

~~~
production_process_graph_wiring = false
production_owner_activation     = false
formal_v5_store_provisioned     = false
formal_v5_epoch_selected        = false
formal_v5_armed                 = false
o00_started                     = false
protected_main_mutated          = false
mcft_cap09_completed            = false
~~~

This is a bounded composition proof.

It is not Formal-v5 activation.

---

## F11. Current Phase3 exact-head workflow is also green

Exact-head Phase3 run:

~~~
33178399052
mcft-cap-09-phase3-evidence-runtime-persistence
head = fe9df68e2d446cdc6543cb50f92aadacf3c298d0
conclusion = SUCCESS
~~~

Artifact:

~~~
artifact id =
  9688644702

artifact digest =
  sha256:b42c5d978cddd738938675e93698cf39bc33c133c88eb2e3e9e61ecb8f58b9a4
~~~

The workflow passes, among other things:

- product and acceptance type proof;
- durable Evidence lease / supply cursor semantics;
- one canonical Evidence Runtime cycle;
- long-running Evidence Runtime host lifecycle;
- GFS product bundle composition;
- private candidate object store lifecycle;
- retained-raw I/O;
- Evidence Runtime ACL separation;
- deployable Evidence Runtime composition;
- no Twin runtime/cadence ownership.

Important:

**This green Phase3 run is valuable functional evidence, but it does not prove that the new adapter is currently owned by the Phase3 dependency resolver.**

Those are separate questions.

---

## F12. Current ordinary CI is fully green

Current CI run:

~~~
33178399092
head = fe9df68e2d446cdc6543cb50f92aadacf3c298d0
conclusion = SUCCESS
~~~

Jobs:

~~~
build-test = SUCCESS
acceptance = SUCCESS
~~~

The full repository acceptance suite completed successfully.

Therefore the current #3364 blocker is not ordinary compilation/build/commercial regression.

---

## F13. Current exact-head workflow matrix on #3364

At fe9df68e...:

~~~
33178399132  mcft-main-ruleset-readiness-v1                       SUCCESS
33178398864  mcft-release-lane-v1                                  SUCCESS
33178398941  mcft-cap-09-ea5e2-live-window-preflight-hardening     SUCCESS
33178398904  mcft-delivery-policy-v2                               SUCCESS
33178399024  mcft-candidate-declaration-selftest-v2                SUCCESS
33178398967  mcft-cap-09-phase6-runtime-independence               SUCCESS
33178398983  mcft-cap-08-authority-reconciliation                  SUCCESS
33178398921  mcft-cap-09-ea5e2-runtime-dependency-graph            SUCCESS
33178399033  mcft-cap-09-ea5e2-successor-runner-qualification      SUCCESS
33178399042  mcft-cap-09-phase7-candidate-promotion-composition    SUCCESS
33178399052  mcft-cap-09-phase3-evidence-runtime-persistence       SUCCESS
33178399092  ci                                                    SUCCESS
33178399199  mcft-cap-09-qualification-control-plane-v1            FAILURE
~~~

So the exact-head matrix is:

~~~
12 SUCCESS
1 FAILURE
~~~

The only red workflow is central control-plane.

---

## F14. Current central failure — exact facts

Central run:

~~~
33178399199
~~~

Artifact:

~~~
artifact id =
  9688800772

artifact name =
  mcft-cap09-qualification-control-plane-fe9df68e2d446cdc6543cb50f92aadacf3c298d0

artifact digest =
  sha256:e9b75bc6375e9fa0d44b50c9db20cef4510134b9f1f8ecbfa441b1dc66601935
~~~

Steps 1–7 are SUCCESS.

Failure is only:

~~~
Step 8
Enumerate all blockers without fail-fast
~~~

Current preflight counts:

~~~
total_checks          = 17
pass                  = 11
fail                  = 2
not_applicable        = 4
carry_forward         = 4
required              = 6
requalify             = 3
unknown               = 0
forbidden             = 0

authority_errors      = 0
unknown_changed_paths = 0
blocker_count         = 2
~~~

Current machine blockers are:

~~~
PHASE3_EVIDENCE_RUNTIME_FOUNDATION
  INVALID_OR_MISSING_REQUALIFICATION_EVIDENCE

PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION
  INVALID_OR_MISSING_REQUALIFICATION_EVIDENCE
~~~

If this were only an evidence-registration problem, the next action would be to bind fresh runs.

It is **not** safe to do that yet.

The dependency ownership is still semantically incomplete.

---

## F15. The critical governance defect — dedicated Phase7 ownership is not enough

Current control plane added:

~~~
PHASE7_PRIVATE_CANDIDATE_PROMOTION_IMPORT_CLOSURE
~~~

with root:

~~~
apps/server/src/external_evidence/
mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts
~~~

and additional exact paths for:

~~~
.github/workflows/mcft-cap-09-phase7-candidate-promotion-composition.yml

scripts/runtime_acceptance/
ACCEPTANCE_MCFT_CAP_09_PHASE7_CANDIDATE_PROMOTION_COMPOSITION_V1.ts
~~~

This is useful.

It is not sufficient.

The adapter crosses two pre-existing governance domains:

~~~
Evidence/private-candidate capture side
        belongs to
PHASE3_EVIDENCE_RUNTIME_FOUNDATION

and

autonomous controller / fenced Formal promotion side
        belongs to
V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE
~~~

A dedicated Phase7 closure may remain.

It must not hide the adapter from either underlying domain.

---

## F16. Current proof that Phase3 does not fully see the adapter

At current fe9df68e...:

~~~
PHASE3_EVIDENCE_RUNTIME_FOUNDATION
kind = EXACT_PATH_SET
~~~

It owns the existing private candidate store and reader modules.

It does **not** currently own:

~~~
apps/server/src/external_evidence/
mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts
~~~

Current Phase3 central plan therefore says:

~~~
status = REQUALIFY

changed_dependencies =
  apps/server/src/external_evidence/
  s3_compatible_private_candidate_manifest_store_v1.ts
~~~

It does **not** list the new capture/promotion adapter as a Phase3 changed dependency.

That is incomplete because the adapter performs the capture-side composition that consumes the Phase3 Evidence/provider/private-candidate graph.

The green run 33178399052 does not repair this ownership omission by itself.

---

## F17. Current proof that V13 incorrectly remains carry-forward

Current resolver:

~~~
V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE
kind = IMPORT_CLOSURE
~~~

Its roots include the existing autonomous controller, scheduler/viability, continuity/admission/lifecycle repositories, and:

~~~
apps/server/src/persistence/twin_runtime/
postgres_external_formal_fenced_exact_base_fact_promotion_v1.ts
~~~

The new adapter imports/uses the fenced-promotion side.

But the V13 closure is rooted in the existing V13 graph.

Import closure follows dependencies **from those roots**.

It does not automatically discover a new reverse-dependent adapter that imports the V13 promotion code.

At fe9df68e... the new adapter is not part of:

~~~
V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE.roots
~~~

and is not in:

~~~
V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE.additional_exact_paths
~~~

Therefore central currently reports all three premerge V13 checks as unchanged carry-forward:

~~~
V13_AUTONOMOUS_FORCING_FOUNDATION
  CARRY_FORWARD

V13_HOLISTIC_SCHEMA
  CARRY_FORWARD

V13_NEXT_TICK_VIABILITY
  CARRY_FORWARD
~~~

Their current V13 dependency digest remains:

~~~
sha256:41726256b3fd6a7a6f885696ce113aa92757097d4a3b5b55fab7340c43711979
~~~

and changed_dependencies is empty.

This is the central semantic defect.

The code now uses the V13 fenced promotion boundary, but V13 qualification does not know it changed.

Do **not** accept this carry-forward as final.

---

## F18. Why current unknown_changed_paths = 0 does not mean ownership is correct

Current central artifact says:

~~~
unknown_changed_paths = []
authority_errors      = []
resolver_errors       = []
~~~

This is true.

It only means every changed file is known to *some* resolver.

The new dedicated Phase7 import closure prevents an unknown-path failure.

But dependency governance must answer a stronger question:

~~~
which established semantic/qualification domains must invalidate when this path changes?
~~~

For the new adapter, the correct answer is not only:

~~~
PHASE7_PRIVATE_CANDIDATE_PROMOTION_IMPORT_CLOSURE
~~~

It must also invalidate/requalify the underlying domains it composes:

~~~
PHASE3_EVIDENCE_RUNTIME_FOUNDATION
V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE
~~~

This is why “central has no unknown paths” is not sufficient closure evidence.

---

## F19. Current two machine blockers must not be cleared yet

Current central blockers are only:

~~~
Phase3 fresh evidence missing
Phase7 composition fresh evidence missing
~~~

It would be technically possible to register runs:

~~~
33178399052
33178399042
~~~

against the current dependency digests and attempt to make central green.

Do **not** do that first.

Why:

1. the Phase3 dependency set is incomplete;
2. the V13 dependency set is incomplete;
3. after correct dual-domain registration, dependency digests/applicability will change;
4. current evidence bindings would then become stale or misleading;
5. V13 should stop carrying forward and require fresh requalification.

Correct order:

~~~
fix ownership
    ↓
fix workflow trigger completeness
    ↓
rerun exact central plan
    ↓
confirm Phase3 sees adapter
    ↓
confirm V13 sees adapter
    ↓
fresh Phase3 + V13 + Phase7 qualification
    ↓
only then durable evidence registration
    ↓
final central blockers=[]
~~~

---

## F20. Required next control-plane shape

At minimum the next governance patch must make this source path visible to both underlying closures:

~~~
apps/server/src/external_evidence/
mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts
~~~

### F20.1 Phase3 side

PHASE3_EVIDENCE_RUNTIME_FOUNDATION must treat the adapter as a governed dependency because its capture half owns/uses:

- provider work-item acquisition;
- raw retention;
- private candidate authority;
- deterministic capture manifest semantics.

The corresponding Phase3 workflow trigger must fire when that adapter changes.

Do not merely add the path to the resolver and forget the workflow trigger.

### F20.2 V13 side

V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE must treat the adapter as a governed dependency because its promotion half owns/uses:

- existing V13 autonomous forcing controller contract;
- existing fenced exact-base Formal promotion;
- controller attestation ordering;
- cursor advancement after attestation.

Because the adapter is a reverse dependent of existing V13 roots, relying on transitive import closure alone is insufficient.

Use an explicit governed path/root relationship appropriate to the current control-plane model.

### F20.3 Focused acceptance / workflow governance

The dedicated Phase7 resolver/check may remain.

Do not delete it merely because the adapter becomes shared.

Audit whether these paths must also be shared dependencies for Phase3/V13:

~~~
.github/workflows/
mcft-cap-09-phase7-candidate-promotion-composition.yml

scripts/runtime_acceptance/
ACCEPTANCE_MCFT_CAP_09_PHASE7_CANDIDATE_PROMOTION_COMPOSITION_V1.ts
~~~

The key rule is:

**a qualification that claims the capture or fenced-promotion boundary must itself not become an invisible dependency of the underlying domain.**

Do not solve this with a broad directory wildcard.

---

## F21. Workflow trigger completeness is part of the fix

Updating only the JSON resolver is not enough.

For each check that becomes REQUALIFY because the shared adapter changed, the relevant execution workflow must actually be triggered on the successor PR.

Audit at least:

~~~
Phase3:
  .github/workflows/
  mcft-cap-09-phase3-evidence-runtime-persistence.yml

V13 premerge qualification:
  .github/workflows/
  mcft-cap-09-v13-autonomous-forcing-foundation.yml

  .github/workflows/
  mcft-cap-09-v13-holistic-schema-postgres.yml

  .github/workflows/
  mcft-cap-09-v13-next-tick-viability-postgres.yml

and any fenced-promotion workflow whose proof is part of the V13 closure
~~~

Do not assume “resolver says REQUALIFY” means GitHub will automatically run the correct workflow.

Earlier Phase3/Phase5 work already exposed this exact class of trigger-completeness defect.

---

## F22. What the next central plan must look like before evidence registration

After the ownership/trigger patch, run the exact central planner **before** binding new evidence.

Required observations:

### Phase3

Current wrong shape:

~~~
changed_dependencies =
  candidate manifest store only
~~~

Required successor shape must include the new adapter as a governed Phase3 dependency.

### V13

Current wrong shape:

~~~
V13_AUTONOMOUS_FORCING_FOUNDATION = CARRY_FORWARD
V13_HOLISTIC_SCHEMA               = CARRY_FORWARD
V13_NEXT_TICK_VIABILITY           = CARRY_FORWARD
~~~

Required successor behavior:

the adapter delta must invalidate the relevant V13 dependency closure and force the applicable premerge V13 checks to REQUALIFY.

If V13 still says dependency digest unchanged / CARRY_FORWARD after the adapter is registered, stop.

Do not register evidence.

### Phase7 dedicated composition

It should remain governed and fresh-qualified.

### Control-plane hygiene

Still require:

~~~
unknown_changed_paths = []
authority_errors      = []
resolver_errors       = []
~~~

---

## F23. Fresh machine qualification sequence after the governance patch

Once the dependency sets and triggers are stable:

### Step 1 — freeze the new exact head

Do not keep editing while fresh qualification is running unless a terminal error identifies a concrete defect.

### Step 2 — run Phase3 fresh qualification

Require the current product Evidence/private-candidate graph plus the new adapter dependency.

Do not rely on 33178399052 as final durable evidence after the resolver changes.

It remains valuable functional evidence from the pre-ownership-fix head.

### Step 3 — run V13 fresh qualification

At minimum require the applicable successor/premerge V13 workflows to execute against the exact new head.

Do not carry forward 3bbf096e-era V13 evidence if the final dependency closure changed.

### Step 4 — run dedicated Phase7 candidate/promotion composition

Require the same strong proof already demonstrated at fe9df68e...:

- private candidate readback;
- zero provider refetch;
- zero GitHub artifact rehydration;
- exact semantic replay equality;
- real Postgres fenced promotion;
- exactly three facts in one fenced transaction;
- cursor advances only after controller attestation;
- pre-mutation failure fail-closed.

### Step 5 — run ordinary CI

Require:

~~~
build-test = SUCCESS
acceptance = SUCCESS
~~~

### Step 6 — read generated final dependency digests

Do not guess them.

Do not reuse the current pre-fix Phase3 / Phase7 digests after the closure definitions change.

### Step 7 — register durable requalification evidence

Only bind successful runs from the final dependency state.

### Step 8 — rerun central

Require:

~~~
status         = PASS
planner_status = PASS
blocker_count  = 0
blockers       = []

unknown_changed_paths = []
authority_errors      = []
resolver_errors       = []
~~~

### Step 9 — only then declare #3364 closure

Closure is exact-head machine closure.

Not “the focused workflow was green once”.

---

## F24. Current #3364 positive evidence must still be preserved

Although it cannot yet close the final governance state, do not discard current successful evidence.

Keep:

~~~
Phase7 composition run =
  33178399042

Phase7 artifact =
  9688644422

Phase3 run =
  33178399052

Phase3 artifact =
  9688644702

CI run =
  33178399092

central diagnostic artifact =
  9688800772
~~~

These runs prove the implementation is not currently failing because of compilation, MinIO, PostgreSQL fenced promotion, ordinary CI, or commercial acceptance.

They are valuable diagnostic/engineering proof.

They are simply not the final durable requalification evidence after dual-closure ownership is repaired.

---

## F25. Current real blocker / not-blocker table

### Real current blocker

~~~
PHASE7_CANDIDATE_PROMOTION_DUAL_DEPENDENCY_OWNERSHIP_INCOMPLETE
~~~

Specifically:

~~~
new adapter not owned by Phase3 exact dependency set
+
new adapter not owned by V13 autonomous forcing closure
+
V13 incorrectly remains carry-forward
~~~

### Secondary expected blocker after ownership is repaired

Fresh requalification evidence will be required for the newly changed dependency closures.

This is expected.

### Not current blockers

The following are not current implementation blockers:

- #3362 private candidate I/O foundation;
- private MinIO candidate persistence;
- retained-raw readback;
- deterministic replay fields;
- focused composition TypeScript build;
- real PostgreSQL fenced exact-base promotion;
- exactly-three Formal fact transaction;
- controller attestation ordering;
- cursor advancement ordering;
- provider refetch;
- GitHub artifact rehydration;
- ordinary build-test;
- commercial acceptance;
- Phase6 runtime independence;
- protected main drift;
- Formal-v5 activation.

The first group is currently green.

The last items remain intentionally inactive.

---

## F26. High-value failure / repair history to preserve

### F26.1 Do not register evidence before dependency ownership stabilizes

This is the most important immediate trap.

A green exact-head run is not enough if the resolver that decides what the run qualifies is incomplete.

### F26.2 unknown_changed_paths=[] is necessary but not sufficient

A path can be owned by the wrong/narrow closure and still fail to invalidate an underlying semantic domain.

### F26.3 Import closure is directional

A new adapter that imports an existing V13 module is a **reverse dependent** of the V13 root.

A root-based import closure will not automatically discover it.

Do not assume transitive import resolution works both directions.

### F26.4 Dedicated Phase7 qualification does not replace underlying-domain requalification

The adapter composes existing Phase3 and V13 authorities.

Its own focused proof is additive.

It is not a substitute for invalidating/requalifying those authorities when the shared dependency changes.

### F26.5 Do not add a broad apps/server wildcard

That would hide ownership errors and cause unrelated work to invalidate huge qualification surfaces.

Use exact/shared dependencies.

### F26.6 Do not modify historical V13 immutable evidence to make the digest match

The correct result of a changed dependency closure is fresh requalification.

Not rewritten history.

### F26.7 Do not bind current fe9df68e runs to a dependency digest that did not include the adapter

That would manufacture false provenance.

### F26.8 Do not start Formal-v5 because candidate promotion now works

Current proof explicitly says:

~~~
formal_v5_store_provisioned = false
formal_v5_epoch_selected    = false
formal_v5_armed             = false
o00_started                 = false
~~~

Preserve that boundary.

### F26.9 Do not wire this adapter into the production process graph in the governance-fix commit

Current #3364 scope explicitly keeps:

~~~
production_process_graph_wiring = false
production_owner_activation     = false
~~~

First close composition/qualification ownership.

Production activation is a later bounded step.

### F26.10 Do not make promotion refetch providers

Promotion must rehydrate from private retained raw only.

Current focused proof has:

~~~
promotion_provider_refetch_count = 0
~~~

Keep it zero.

### F26.11 Do not reintroduce GitHub artifact rehydration

Current focused proof has:

~~~
promotion_github_artifact_rehydration_count = 0
~~~

Runtime authority remains durable private object/database state.

### F26.12 Do not advance the forcing cursor inside promotion before attestation

Current proof deliberately establishes:

~~~
promotion_did_not_advance_cursor = true
controller_attestation_after_promotion = true
cursor_advanced_only_after_attestation = true
~~~

Do not collapse these stages.

### F26.13 Do not weaken exact semantic-manifest equality

The candidate manifest is the pre-mutation replay authority.

If rehydration does not exactly match, fail before Formal mutation.

### F26.14 Do not mix B-Line

B-Line remains outside MCFT-CAP-09.

No B-Line refactor belongs in the dual-closure governance fix.

---

## F27. First 30 minutes for the next engineer

### Minute 0–5 — lock current GitHub truth

Verify:

~~~
#3362 head =
  46c9c7b6b59c113848fc69daff88fb183fccc954

#3364 base =
  46c9c7b6b59c113848fc69daff88fb183fccc954

#3364 head =
  fe9df68e2d446cdc6543cb50f92aadacf3c298d0
  or a documented successor

#3364 Draft = true
#3364 merged = false

protected main =
  26c1383f7f45abb76c99e28ec3d06714e85d1b2c
~~~

If #3364 head changed, re-read central plan before using any conclusion in this section.

### Minute 5–10 — inspect central artifact first

Current diagnostic reference:

~~~
run      = 33178399199
artifact = 9688800772
head     = fe9df68e...
~~~

Confirm:

~~~
unknown_changed_paths = []
authority_errors      = []
blocker_count         = 2
~~~

Then inspect the V13 decisions and confirm they are still incorrectly CARRY_FORWARD at this reference head.

### Minute 10–15 — inspect exact resolver membership

Check:

~~~
PHASE3_EVIDENCE_RUNTIME_FOUNDATION

V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE

PHASE7_PRIVATE_CANDIDATE_PROMOTION_IMPORT_CLOSURE
~~~

For the adapter:

~~~
apps/server/src/external_evidence/
mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts
~~~

At this handoff reference head:

~~~
dedicated Phase7 closure = YES
Phase3 closure           = NO
V13 closure              = NO
~~~

### Minute 15–20 — patch dependency ownership

Add the shared adapter to the correct Phase3 and V13 dependency closure definitions.

Do not broaden unrelated roots.

Do not remove dedicated Phase7 ownership.

### Minute 20–25 — patch workflow trigger completeness

Ensure the affected exact-head qualification workflows actually run when the shared adapter changes.

Audit both:

~~~
Phase3
V13
~~~

Do not assume central REQUALIFY alone schedules them.

### Minute 25–30 — run central plan before evidence binding

The first post-fix central plan is a diagnostic.

Do not immediately register evidence.

Verify:

~~~
Phase3 sees adapter change
V13 sees adapter change
Phase7 remains governed
unknown paths = 0
authority errors = 0
resolver errors = 0
~~~

Only after that launch/accept fresh requalification evidence.

---

## F28. High-value exact file map

### Frozen route

~~~
docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md
~~~

### V13 Formal-store authority

~~~
docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json
~~~

### Central control plane

~~~
docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json

docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json

.github/workflows/
mcft-cap-09-qualification-control-plane-v1.yml
~~~

### New Phase7 adapter

~~~
apps/server/src/external_evidence/
mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts
~~~

### Private candidate manifest

~~~
apps/server/src/external_evidence/
s3_compatible_private_candidate_manifest_store_v1.ts
~~~

### Private retained-raw reader predecessor

~~~
apps/server/src/external_evidence/
s3_compatible_private_retained_raw_reader_v1.ts
~~~

### Phase7 focused workflow

~~~
.github/workflows/
mcft-cap-09-phase7-candidate-promotion-composition.yml
~~~

### Phase7 focused acceptance

~~~
scripts/runtime_acceptance/
ACCEPTANCE_MCFT_CAP_09_PHASE7_CANDIDATE_PROMOTION_COMPOSITION_V1.ts
~~~

### Phase3 workflow

~~~
.github/workflows/
mcft-cap-09-phase3-evidence-runtime-persistence.yml
~~~

### V13 fenced promotion implementation

~~~
apps/server/src/persistence/twin_runtime/
postgres_external_formal_fenced_exact_base_fact_promotion_v1.ts
~~~

### V13 autonomous controller

~~~
apps/server/src/runtime/twin_runtime/
external_formal_forcing_autonomous_controller_service_v1.ts
~~~

### V13 autonomous qualification workflow

~~~
.github/workflows/
mcft-cap-09-v13-autonomous-forcing-foundation.yml
~~~

### V13 schema / viability qualification

~~~
.github/workflows/
mcft-cap-09-v13-holistic-schema-postgres.yml

.github/workflows/
mcft-cap-09-v13-next-tick-viability-postgres.yml
~~~

---

## F29. #3364 closure checklist

Do not declare #3364 closed until one exact final head satisfies all of the following:

### Dependency governance

- [ ] new adapter is owned by PHASE3_EVIDENCE_RUNTIME_FOUNDATION;
- [ ] new adapter is owned by V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE;
- [ ] dedicated PHASE7_PRIVATE_CANDIDATE_PROMOTION_IMPORT_CLOSURE remains valid;
- [ ] workflow trigger coverage is complete for each affected resolver;
- [ ] unknown_changed_paths = 0;
- [ ] authority_errors = 0;
- [ ] resolver_errors = 0.

### Phase3

- [ ] final central plan shows adapter in Phase3 changed dependency closure;
- [ ] fresh exact-head Phase3 workflow SUCCESS;
- [ ] final Phase3 dependency digest read from machine output;
- [ ] durable Phase3 requalification evidence valid.

### V13

- [ ] final central plan no longer incorrectly carries V13 forward;
- [ ] applicable V13 premerge checks fresh-requalify;
- [ ] fresh exact-head V13 workflow(s) SUCCESS;
- [ ] V13 dependency digest reflects the shared adapter;
- [ ] durable V13 evidence valid where required.

### Phase7 composition

- [ ] dedicated composition workflow SUCCESS on final governed state;
- [ ] private candidate readback PASS;
- [ ] provider refetch = 0;
- [ ] GitHub artifact rehydration = 0;
- [ ] exact semantic-manifest replay equality PASS;
- [ ] real Postgres fenced promotion PASS;
- [ ] exactly three Formal facts PASS;
- [ ] cursor does not advance during promotion;
- [ ] attestation precedes cursor advancement;
- [ ] pre-mutation mismatch fails closed.

### Repository

- [ ] build-test SUCCESS;
- [ ] acceptance SUCCESS;
- [ ] Phase6 successor sentinel SUCCESS;
- [ ] EA5E2 / successor governance still SUCCESS as applicable.

### Final central closure

- [ ] planner_status = PASS;
- [ ] blocker_count = 0;
- [ ] blockers = [];
- [ ] all required durable evidence references valid.

### Non-effects

- [ ] protected main unchanged;
- [ ] no production process wiring;
- [ ] no production owner activation;
- [ ] no remote Formal-v5 store provisioned;
- [ ] no Formal-v5 epoch selected;
- [ ] Formal-v5 not armed;
- [ ] O00 not started;
- [ ] MCFT-CAP-09 not declared complete.

---

## F30. What comes after #3364 — do not jump there early

The current slice is still product composition / qualification.

It does not authorize immediately skipping to a live Formal-v5 epoch.

After #3364 closes, the next bounded Phase7 decision must be taken from the frozen Production Hosting route and V13 authority.

Likely remaining categories include:

- explicit production composition/owner wiring;
- fresh Formal-v5 store/epoch authority;
- post-Graduation activation gates;
- fresh timing / exact-one-owner obligations;
- eventual Formal-v5 O00→O23 execution.

Do not collapse these into #3364 merely because candidate promotion works in isolated qualification.

The correct progression remains governed and staged.

---

## F31. Current bottom line

The project is no longer at the Phase6 runtime-independence frontier.

It has now reached:

~~~
Phase5
  CLOSED

Phase6
  CLOSED

Phase7 private candidate I/O foundation
  #3362 CLOSED
  exact head = 46c9c7b6b59c113848fc69daff88fb183fccc954
  12/12 exact-head workflows SUCCESS
  central blockers = []

        ↓

Phase7 candidate capture / fenced promotion composition
  #3364 IN PROGRESS
  base = 46c9c7b6...
  head = fe9df68e...
  3 commits
  8 files

  focused composition = SUCCESS
  Phase3 workflow      = SUCCESS
  build-test           = SUCCESS
  acceptance           = SUCCESS
  Phase6 sentinel      = SUCCESS

  central              = FAILURE
  blocker_count        = 2

        but

  current real governance defect =
    adapter is only in dedicated Phase7 closure
    adapter is NOT in Phase3 closure
    adapter is NOT in V13 closure
    V13 therefore incorrectly CARRY_FORWARD

        ↓

next legitimate action =
  repair dual dependency ownership
  +
  repair workflow trigger completeness
  +
  rerun central plan
  +
  require fresh Phase3/V13/Phase7 qualification
  +
  only then bind durable evidence
  +
  blockers=[]
~~~

The most important instruction to the next engineer is:

**Do not make the current central red state green by registering the already-successful Phase3 and Phase7 runs before fixing shared dependency ownership.**

That would prove the wrong dependency graph.

First make the graph truthful.

Then requalify it.

Formal-v5 remains unarmed.

Protected main remains untouched.


---

# Historical continuation preserved below

# GEOX MCFT-CAP-09 Conversation Handoff — 2026-08-28 Continuation — Phase 6 GitHub Production-Owner Retirement / Runtime-Independence Frontier

Status: **CONVERSATION HANDOFF / CURRENT AUTHORITATIVE CONTINUATION — NOT MASTER-TASK AUTHORITY**

Timestamp: **2026-08-28 13:29 +08:00**

Repository: liyongshang44-max/GEOX

Purpose: continue the same MCFT-CAP-09 Production Hosting route after Phase 5 formally closed. This section records the machine-accepted Phase 5 closure, the independent stacked Phase 6 ownership-cutover PR, the implemented retirement of GitHub production execution ownership, the remaining runtime-independence acceptance, the two parser-only blackout-probe failures already repaired, and the exact next steps before any fresh Formal-v5 epoch may be armed.

> **This section is now the highest-priority conversation continuation in this file.**
>
> The previous Phase 5 continuation beginning with D0 is intentionally preserved in full below as historical reasoning/evidence.
>
> The earlier C continuation and original Phase 2 continuation remain preserved below that.
>
> Do not delete or rewrite those historical sections. They explain how the system reached the current Phase 6 frontier and why several apparently simpler shortcuts are forbidden.
>
> This handoff does **not** supersede docs/SSOT.md, the Digital Twin Master Task Line, the CAP-09 taskbook, accepted CAP-01→08 authority, immutable Formal evidence, the qualification control plane, or the frozen Production Hosting route.

---

## E0. READ THIS FIRST — authority reconstruction order changed because Phase 5 is now CLOSED

The next engineer must reconstruct authority in this order:

1. docs/SSOT.md
2. docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md
3. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
4. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md
5. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PHASE6-GITHUB-PRODUCTION-EXECUTION-RETIREMENT-AUTHORITY-V1.json
6. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json
7. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json
8. this handoff, newest continuation first
9. weekly/status notes only as operational context, never as authority

The essential phase transition is now:

~~~
Phase 5 production-equivalent graph
        CLOSED
        exact closure head = 75d4961279bd64dc1c9dd7d68aac189c72c98846
        control-plane blockers = []
        ↓
Phase 6 GitHub production execution retirement
        IMPLEMENTED at control-plane / workflow ownership layer
        ↓
Phase 6 runtime independence
        CURRENT FRONTIER
        exact head = 43529e13dbab2d21c6f4174a4c54a6122e166f1d
        run = 33144759220
        ↓
Phase 7 fresh Formal-v5
        FORBIDDEN UNTIL PHASE 6 TERMINAL PASS
~~~

Do **not** resume Phase 5 development unless Phase 6 proves a genuine Phase 5 regression.

Do **not** arm Formal-v5 merely because GitHub production triggers have been retired.

---

## E1. Current task in one sentence

**Finish Phase 6 by proving on the real production-equivalent Compose graph that Evidence Runtime and Twin Runtime remain operational while the GitHub control plane is blacked out, that both services recover from durable cursor/checkpoint authority after restart without GitHub artifact rehydration, and that the exact 24T still closes; do this without restoring any retired GitHub production owner, without introducing a fallback collector/scheduler, and without arming Formal-v5.**

---

## E2. Exact current repository / PR state

### E2.1 Protected main

Protected main remains exactly:

~~~
26c1383f7f45abb76c99e28ec3d06714e85d1b2c
~~~

GitHub reports the branch is protected.

Neither the Phase 5 closure work nor the Phase 6 stack has moved protected main.

### E2.2 Phase 5 closure predecessor — #3323

Draft PR:

~~~
#3323
feat(mcft-cap09): build Phase5 production-equivalent containers
~~~

Branch:

~~~
feat/mcft-cap09-phase5-production-equivalent-containers-v1
~~~

Base:

~~~
16ff7160473c0a25dc059db6b2b6b7ba07f54dd1
~~~

Current / closure head:

~~~
75d4961279bd64dc1c9dd7d68aac189c72c98846
~~~

GitHub state at this handoff:

~~~
open       = true
Draft      = true
mergeable  = true
commits    = 90
files      = 46
merged     = false
~~~

Important:

**Phase 5 is closed by machine evidence at this head even though #3323 is still a stacked Draft PR and is not merged into protected main.**

Do not confuse “Phase closed in the governed stacked development route” with “merged to main”.

### E2.3 Current Phase 6 frontier — #3351

Independent stacked Draft PR:

~~~
#3351
feat(mcft-cap09): retire GitHub production execution ownership
~~~

Branch:

~~~
feat/mcft-cap09-phase6-retire-github-production-execution-v1
~~~

Base is locked exactly to the Phase 5 closure head:

~~~
75d4961279bd64dc1c9dd7d68aac189c72c98846
~~~

Current head:

~~~
43529e13dbab2d21c6f4174a4c54a6122e166f1d
~~~

GitHub state:

~~~
open          = true
Draft         = true
mergeable     = true
commits       = 10
changed_files = 31
~~~

This exact base relationship is mandatory.

Do not rebase #3351 to protected main.

Do not silently move its base away from the Phase 5 closure subject.

### E2.4 Conversation handoff PR — #3298

Docs-only Draft PR remains:

~~~
#3298
branch = docs/mcft-cap09-handoff-2026-08-26-phase2-evidence-module-frontier
base   = protected main @ 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
~~~

Before this continuation commit:

~~~
head          = aa894b42a288d62bbf1149bc3b7cc1de032552ba
commits       = 4
changed_files = 2
Draft         = true
open          = true
mergeable     = true
~~~

#3298 must remain docs-only.

No Phase 5 or Phase 6 implementation mutation belongs in this branch.

---

## E3. Current phase map

~~~
Phase 0 architecture route / invariants             FROZEN
        ↓
Phase 1 common Runtime composition                  CLOSED predecessor
        ↓
Phase 2 production Evidence modules                 CLOSED predecessor
        ↓
Phase 3 durable Evidence Runtime                    CLOSED predecessor
        ↓
Phase 4 durable Twin Runtime                        CLOSED predecessor
        ↓
Phase 5 production-equivalent two-service graph     CLOSED
        exact closure = 75d496127...
        blockers = []
        ↓
Phase 6 retire GitHub production execution          IMPLEMENTED
        ↓
Phase 6 runtime independence / blackout proof       IN PROGRESS  ← CURRENT
        exact head = 43529e13...
        run = 33144759220
        ↓
Phase 7 fresh Formal-v5                             NOT STARTED / FORBIDDEN
~~~

Current CAP-09 status:

~~~
IN PROGRESS
PHASE5 CLOSED
PHASE6 OWNERSHIP RETIREMENT IMPLEMENTED
PHASE6 RUNTIME INDEPENDENCE NOT YET TERMINAL
PHASE7 NOT STARTED
FORMAL-V5 NOT ARMED
PROTECTED MAIN UNCHANGED
~~~

---

## E4. Phase 5 is formally closed — do not reopen the old blocker frontier

Phase 5 closure head:

~~~
75d4961279bd64dc1c9dd7d68aac189c72c98846
~~~

The decisive current-head machine runs include:

~~~
33140680373  mcft-cap-09-amendment19-persistent-24t-qualification   SUCCESS
33140680423  mcft-cap-09-phase3-evidence-runtime-persistence        SUCCESS
33140680432  mcft-cap-09-phase4-twin-runtime-persistence            SUCCESS
33140680393  mcft-cap-09-phase5-production-equivalent-containers    SUCCESS
33140680396  mcft-cap-09-phase5-two-service-accelerated-24t         SUCCESS
33140680425  mcft-cap-09-qualification-control-plane-v1             SUCCESS
~~~

Control-plane run 33140680425 machine output includes:

~~~
status        = PASS
planner_status= PASS
blocker_count = 0
blockers      = []
~~~

The accepted evidence resolution includes:

~~~
LEGACY_AM19_PERSISTENT_24T                    PASS
PHASE3_EVIDENCE_RUNTIME_FOUNDATION            PASS
PHASE4_TWIN_RUNTIME_FOUNDATION                PASS
PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS       PASS
~~~

The current valid registry evidence includes, among other durable entries:

~~~
PHASE3_EVIDENCE_RUNTIME_FOUNDATION_REQUAL_7F767921
PHASE4_TWIN_RUNTIME_FOUNDATION_REQUAL_12473C49
PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS_REQUAL_7F767921
LEGACY_AM19_PERSISTENT_24T_REQUAL_480C0746
~~~

### E4.1 Phase 5 closure did not fake a fresh late crop-window 24T

A full fresh live 24T crop window had become temporally impossible under the frozen A18 crop-context guard.

The accepted Phase 5 closure therefore used the explicit fail-closed temporal-settlement path:

~~~
immutable earlier full causal 24T
+
fresh Evidence container restart/fencing proof
+
fresh Twin container DB-fencing proof
+
protected semantic-core equivalence
+
central durable evidence adjudication
~~~

The current-head Phase5 run 33140680396 therefore shows:

~~~
fresh-live capture / full-live Steps 8-13  = SKIPPED by adjudicated temporal mode
immutable baseline proof download          = SUCCESS
fresh Evidence resilience proof download   = SUCCESS
semantic equivalence adjudication           = SUCCESS
focused historical canonical seed           = SUCCESS
historical runtime-config prepare            = SUCCESS
two real Twin containers O00-O07 fencing     = SUCCESS
temporal settlement finalization             = SUCCESS
artifact upload                              = SUCCESS
~~~

This is **not** permission to create future test-only shortcuts.

The settlement was accepted only because the fresh full window had expired and the changed semantic surface was explicitly bounded and requalified.

---

## E5. Why Phase 6 exists

The frozen Production Hosting route states that GitHub Actions may remain:

- CI;
- qualification;
- deployment;
- schema migration / one-shot governed work where explicitly permitted;
- read-only audit;
- final adjudication;
- evidence registration.

GitHub Actions must **not** own routine production behavior for Formal-v5 or later:

~~~
production provider cadence
production provider request loop
EvidenceSupplyCursor
Formal runtime wake cadence
RuntimeTickCursor
production slot claim
production Twin tick execution
Formal Twin checkpoint mutation
production retry / recovery state
~~~

Hard Formal target:

~~~
GitHub provider request count         = 0
GitHub Formal Twin DB mutation count  = 0
GitHub production tick execution      = 0
GitHub hourly wake dependency         = 0
~~~

Phase 6 is therefore not cosmetic workflow cleanup.

It is a production ownership cutover.

---

## E6. Phase 6 retirement authority now exists

Authoritative file:

~~~
docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-PHASE6-GITHUB-PRODUCTION-EXECUTION-RETIREMENT-AUTHORITY-V1.json
~~~

Current authority status:

~~~
PHASE6_GITHUB_TRIGGER_RETIREMENT_IMPLEMENTED_PENDING_RUNTIME_INDEPENDENCE_PROOF
~~~

It binds Phase 6 to:

~~~
phase5_closure_head =
75d4961279bd64dc1c9dd7d68aac189c72c98846
~~~

The retirement authority explicitly records:

~~~
protected_main_mutation       = false
phase5_history_rewrite        = false
formal_v5_arm                 = false
fresh_formal_v5_epoch_creation= false
production_container_activation = false
mcft_cap09_completed          = false
~~~

This is the correct current status.

Ownership has been retired, but production activation / Formal-v5 has not occurred.

---

## E7. GitHub production owners retired in Phase 6

### E7.1 Production-execution workflows retired to PR-only sentinels

The authority identifies the following production-execution owners and replaces their live production triggers with PR-only sentinels:

1. .github/workflows/mcft-cap-09-rolling-preboundary-capture.yml
2. .github/workflows/mcft-cap-09-t4r1-rolling-hourly-scheduler.yml
3. .github/workflows/mcft-cap-09-t4r1-rolling-preboundary-capture.yml
4. .github/workflows/mcft-cap-09-amendment19-formal-hourly-evidence.yml
5. .github/workflows/mcft-cap-09-amendment19-formal-arm.yml
6. .github/workflows/mcft-cap-09-amendment19-formal-a0-bootstrap.yml
7. .github/workflows/mcft-cap-09-amendment19-formal-live-runner.yml
8. .github/workflows/mcft-cap-09-pre-runtime-hardening.yml
9. .github/workflows/mcft-cap-09-s6-formal-24-hour-stage-1b-closure.yml
10. .github/workflows/mcft-cap-09-formal-bootstrap-evidence-authority.yml
11. .github/workflows/mcft-cap-09-t4r1-formal-v3-o01-recovery.yml
12. .github/workflows/mcft-cap-09-ea5e2-rolling-operational-activation-live.yml
13. .github/workflows/mcft-cap-09-t4r1-formal-v3-prebootstrap-recovery.yml

These are retired because they previously represented provider-facing, scheduled, mutating, or failed-Formal recovery ownership that cannot remain a production executor under the frozen hosting route.

### E7.2 Provider-facing scheduled audit/observer workflows also retired

The following scheduled provider-facing observers were also removed from routine GitHub scheduling:

1. .github/workflows/mcft-cap-09-rolling-kbs-intersection.yml
2. .github/workflows/mcft-cap-09-kbs-batch-qualification-window.yml
3. .github/workflows/mcft-cap-09-kbs-publication-cadence-observer.yml
4. .github/workflows/mcft-cap-09-ea9b-current-main-window-observer.yml

The reason is not that audit is forbidden.

The reason is that a scheduled GitHub provider request is still a provider-facing cadence owner.

### E7.3 Preserved automatic GitHub roles

Not every scheduled/workflow_run action is forbidden.

The retirement authority intentionally preserves bounded non-production roles, including:

~~~
mcft-cap-09-s6-production-equivalent-shadow-simulator.yml
    ISOLATED_NON_PRODUCTION_SIMULATION

mcft-cap-09-amendment19-formal-final-readback.yml
    READ_ONLY_FINAL_DB_AUDIT

mcft-cap-09-amendment19-persistent-24t-qualification.yml
    QUALIFICATION_ONLY

mcft-cap-09-amendment19-formal-graduation-wiring.yml
    ZERO_EFFECT_ONE_SHOT_GOVERNANCE
~~~

Do not delete these merely because they are automatic.

Classification matters.

---

## E8. Retirement is trigger/authority cutover, not historical erasure

The retirement contract explicitly requires:

~~~
retired workflow allowed triggers =
    pull_request
    merge_group

forbidden retired triggers =
    schedule
    workflow_run
    workflow_dispatch
    repository_dispatch
    workflow_call
    push
~~~

Also:

~~~
retired workflow actions:write              FORBIDDEN
historical live implementation deletion     NOT REQUIRED
historical artifact deletion                FORBIDDEN
phase5 historical blob binding              REQUIRED
~~~

The historical implementations are intentionally retained/bound to their Phase 5 blob SHAs so the system can prove exactly what was retired.

Do not “clean up” by deleting historical implementation bodies or old qualification artifacts.

That would destroy retirement auditability.

---

## E9. Phase 6 implementation progression on #3351

The current 10-commit progression is:

~~~
c2dc097879a0a6d3fe9f25afb87ef92de5d404e8
feat(mcft-cap09): establish Phase6 GitHub owner retirement audit

4d7416a4df793bfefb25f46ae4680275cc350ccb
feat(mcft-cap09): retire GitHub production triggers

36bb4541325ce552e1425f45f655c9b28d1ca82c
fix(mcft-cap09): route Phase6 retirement successors

15cd6ea630a55afd7295dfce22d8ed67aa0a81df
fix(mcft-cap09): route EA5E2 through Phase6 retirement

4d5b90c2875e25118fba09f5a05136017ef02bf6
fix(mcft-cap09): govern Phase6 from Phase5 closure

f4decec3281fc28f01a2d804c738407809689407
fix(mcft-cap09): govern Phase6 retired graph preflight

10d86530f4fd4cb17b89e254ee14aa9b76daf333
fix(mcft-cap09): validate Phase6 unchanged Phase3 Phase5 stack

62c58eae3dc9b0c0e92904762616b6e690d0768c
test(mcft-cap09): prove Phase6 runtime independence

406dacfcde35f26f1ce91a5bf3d6561f379371c8
fix(mcft-cap09): parse Phase6 blackout probe deterministically

43529e13dbab2d21c6f4174a4c54a6122e166f1d
fix(mcft-cap09): emit blackout proof newline canonically
~~~

Current exact head is the last commit above.

---

## E10. Phase 6 owner-retirement machine gates are already green

At current #3351 head, the following important runs are already SUCCESS:

~~~
33144759215
mcft-cap-09-phase6-retire-github-production-execution
SUCCESS

33144759193
mcft-cap-09-qualification-control-plane-v1
SUCCESS

33144759128
mcft-cap-09-closure-control-plane-audit
SUCCESS

33144759239
mcft-cap-09-ea5e2-runtime-dependency-graph
SUCCESS

33144759243
mcft-release-lane-v1
SUCCESS

33144759205
mcft-main-ruleset-readiness-v1
SUCCESS

33144759190
mcft-cap-09-final-semantic-closure
SUCCESS

33144759130
mcft-cap-09-ea5e2-successor-runner-qualification
SUCCESS
~~~

Additional retired/sentinel workflows triggered by the PR also report SUCCESS.

The normal CI build-test job at current head is SUCCESS:

~~~
Typecheck       SUCCESS
Build           SUCCESS
Server selfcheck SUCCESS
~~~

At the latest handoff refresh, the broader CI acceptance job was still executing downstream commercial/customer-report suites. It had already passed setup, service readiness, PR18I preflight, controlled pilot gate, frontend audit, Stage-1 fixture gate, and P1 smoke preflight.

Do not conflate a still-running broad repository acceptance suite with the Phase 6 runtime-independence blocker.

---

## E11. Current Phase 6 runtime-independence workflow

Workflow:

~~~
.github/workflows/mcft-cap-09-phase6-runtime-independence.yml
~~~

Compose base:

~~~
docker-compose.mcft-cap09-phase5-qualification.yml
~~~

GitHub-blackout override:

~~~
docker-compose.mcft-cap09-phase6-github-blackout.override.yml
~~~

Reuse contract from the retirement authority:

~~~
SAME_PHASE5_PRODUCTION_PROCESS_GRAPH_WITH_GITHUB_RUNTIME_NETWORK_BLACKOUT_ONLY
~~~

GitHub artifact rehydration:

~~~
FORBIDDEN
~~~

Required claims:

~~~
GITHUB_CONTROL_PLANE_OUTAGE_DOES_NOT_STOP_EVIDENCE_INGRESS

GITHUB_CONTROL_PLANE_OUTAGE_DOES_NOT_STOP_TWIN_RUNTIME

PROCESS_RESTART_RECOVERS_FROM_DURABLE_OPERATIONAL_AUTHORITY_WITHOUT_GITHUB_ARTIFACT_REHYDRATION
~~~

Also preserved from the frozen route:

~~~
EVIDENCE_RUNTIME_OUTAGE_DOES_NOT_CAUSE_TWIN_RUNTIME_PROVIDER_FALLBACK

TWIN_RUNTIME_OUTAGE_DOES_NOT_ALLOW_EVIDENCE_RUNTIME_TO_ADVANCE_TWIN_STATE
~~~

---

## E12. Exact current runtime-independence run

Authoritative current run:

~~~
33144759220
mcft-cap-09-phase6-runtime-independence
run_number = 3
head       = 43529e13dbab2d21c6f4174a4c54a6122e166f1d
status     = in_progress
~~~

At the final handoff refresh, the step map is:

~~~
1  Set up job                                                     SUCCESS
2  Checkout exact Phase6 subject                                  SUCCESS
3  Require exact head / private qualification roots               SUCCESS
4  Require retirement authority / stacked base / central owner    SUCCESS
5  Require fresh no-artifact runtime-independence execution       SUCCESS
6  Build exact scientific Runtime image                           SUCCESS
7  Start isolated PostgreSQL and private raw store                SUCCESS
8  Prove GitHub control plane unreachable from Runtime containers SUCCESS
9  Capture real causal A0 soil and GFS raw objects                IN PROGRESS
10 Duplicate Evidence containers / fenced takeover / restart      PENDING
11 Prepare A0 + exact 24-slot manifest                            PENDING
12 Duplicate Twin containers O00-O07 / DB fencing                 PENDING
13 Restart Twin / recover O08-O23 from durable cursor             PENDING
14 Verify exact 24T canonical + DB isolation                      PENDING
15 Assemble GitHub-outage + durable-restart proof                 PENDING
16 Upload non-raw runtime-independence proof                      PENDING
17 Destroy qualification state / raw fixture                      PENDING
~~~

This is the true current frontier.

The parser bug is no longer the current failure: Step 8 is now machine SUCCESS.

---

## E13. What the final Phase 6 runtime proof is actually proving

The proof chain is deliberately stronger than “workflow YAML says GitHub is disabled”.

It is:

~~~
Runtime containers start with GitHub control-plane network blackout
        ↓
no GitHub credentials / no reachable GitHub control-plane endpoint
        ↓
real causal soil/GFS acquisition still proceeds through Evidence Runtime
        ↓
duplicate Evidence containers use DB lease/fencing
        ↓
Evidence process restart recovers from durable EvidenceSupplyCursor
        ↓
canonical Evidence DB remains physically visible
        ↓
24-slot manifest prepared from canonical Evidence
        ↓
duplicate Twin containers use DB scheduler lease/fencing
        ↓
O00-O07 terminal progression
        ↓
Twin restart
        ↓
O08-O23 recovery from RuntimeTickCursor / checkpoint authority
        ↓
exact 24T final verifier
        ↓
Evidence/Twin DB separation remains intact
        ↓
no GitHub artifact rehydration was required
~~~

The only permitted change from the Phase 5 production graph is the GitHub runtime network blackout.

The Runtime implementation itself must remain the same.

---

## E14. Two prior runtime-independence failures — both parser/probe defects, not architecture defects

### E14.1 Run 1

Head:

~~~
62c58eae3dc9b0c0e92904762616b6e690d0768c
~~~

Run:

~~~
33143611538
run_number = 1
conclusion = FAILURE
~~~

This was the initial runtime-independence proof implementation.

It exposed the blackout-proof parsing path and led to commit:

~~~
406dacfcde35f26f1ce91a5bf3d6561f379371c8
fix(mcft-cap09): parse Phase6 blackout probe deterministically
~~~

### E14.2 Run 2

Head:

~~~
406dacfcde35f26f1ce91a5bf3d6561f379371c8
~~~

Run:

~~~
33143825049
run_number = 2
conclusion = FAILURE
~~~

It passed:

~~~
exact head / stacked base / central ownership
fresh no-artifact requirement
scientific image build
PostgreSQL + private raw store
~~~

and failed only at:

~~~
Step 8
Prove GitHub control plane is unreachable from Runtime containers
~~~

Exact machine symptom:

~~~
jq: parse error: Invalid numeric literal at line 2, column 0
Process completed with exit code 5
~~~

The probe was emitting:

~~~
JSON.stringify(...)+ "\\n"
~~~

as a literal backslash-n sequence in the shell/Node quoting path rather than a canonical line ending consumable by jq.

This is why the correct repair was **not** to weaken the blackout check.

The repair was:

~~~
43529e13dbab2d21c6f4174a4c54a6122e166f1d
fix(mcft-cap09): emit blackout proof newline canonically
~~~

Run 33144759220 has now passed the exact same Step 8.

Therefore the parser bug is CLOSED.

---

## E15. Do not misclassify the current long-running Step 9

Current Step 9 is:

~~~
Capture real causal A0 soil and GFS raw objects
~~~

This is intentionally live-provider work and can be long-running.

It is not a deadlock merely because it spends minutes in provider acquisition.

Do not repeat the earlier Phase 5 mistake of classifying a long provider capture as “stuck” without terminal evidence.

The correct interpretation at this handoff is:

~~~
blackout precondition = SUCCESS
runtime graph alive    = YES
live causal capture    = IN PROGRESS
architecture blocker  = NONE KNOWN
~~~

Only a terminal failure with a concrete error should create a new blocker.

---

## E16. What remains before Phase 6 can close

The retirement authority itself lists the remaining mandatory proof families:

~~~
ZERO_RETIRED_GITHUB_PRODUCTION_OWNERS_AND_TRIGGERS

GITHUB_CONTROL_PLANE_OUTAGE_DOES_NOT_STOP_EVIDENCE_INGRESS

GITHUB_CONTROL_PLANE_OUTAGE_DOES_NOT_STOP_TWIN_RUNTIME

PROCESS_RESTART_RECOVERS_FROM_DURABLE_OPERATIONAL_AUTHORITY_WITHOUT_GITHUB_ARTIFACT_REHYDRATION
~~~

The first item is already implemented/audited by the retirement workflow.

The current run must provide the remaining runtime proof.

Phase 6 is **not** closed until:

1. run 33144759220 or a later exact-head successor is terminal SUCCESS;
2. exact 24T final verifier passes;
3. GitHub-blackout claims are in the uploaded non-raw proof;
4. Evidence restart proof is durable-cursor based;
5. Twin restart proof is durable RuntimeTickCursor/checkpoint based;
6. no GitHub artifact rehydration path exists;
7. no Runtime GitHub credential/control-plane dependency exists;
8. no provider fallback appears in Twin Runtime;
9. no Evidence-to-Twin state mutation appears;
10. the qualification control plane is rerun on the final exact head and returns zero applicable blockers;
11. evidence registration is durable and exact-head bound where required.

---

## E17. Current blocker / not-blocker table

### Current real blocker

There is no known code-level architecture blocker at this handoff.

The only open requirement is:

~~~
PHASE6_RUNTIME_INDEPENDENCE_FINAL_MACHINE_ACCEPTANCE
~~~

Current state:

~~~
RUNNING
not failed
not closed
~~~

### Not blockers

The following are **not** current blockers:

- Phase 5 O00 successor checkpoint;
- Phase 5 container resilience;
- Phase 5 temporal settlement;
- Phase 5 durable evidence registration;
- LEGACY_AM19 persistent qualification;
- Phase 3 Evidence Runtime;
- Phase 4 Twin Runtime;
- GitHub production trigger retirement;
- retired-owner central audit;
- Phase6 central exact-path ownership;
- blackout JSON parser/newline bug;
- protected main drift;
- Formal-v5 scheduling.

All of these are either closed, deliberately unchanged, or not yet permitted.

---

## E18. High-value failure / repair history to preserve

### E18.1 Do not interpret Phase 5 closure as permission to skip Phase 6

Phase 5 proved the production-equivalent graph.

Phase 6 proves that GitHub is no longer part of that graph's runtime authority.

These are separate obligations.

### E18.2 Do not “retire GitHub” by deleting all workflows

GitHub remains valid for CI, qualification, deployment, bounded governance, read-only audit, and evidence registration.

Retirement is role-specific.

### E18.3 Do not delete historical live workflow bodies

The retirement authority binds retired paths to their Phase 5 blob SHAs.

Historical bodies are audit evidence.

### E18.4 Do not delete historical artifacts

GitHub artifacts may remain independent audit evidence.

The prohibition is only:

~~~
runtime recovery MUST NOT REQUIRE GitHub artifact rehydration
~~~

### E18.5 Do not restore schedule/workflow_run/workflow_dispatch to a retired sentinel

A retired production owner is intentionally PR-only / merge-group-only.

Restoring a live trigger recreates a second production owner.

### E18.6 Do not add a GitHub fallback collector when Evidence Runtime is unavailable

Forbidden architecture:

~~~
Evidence Runtime outage
→ fallback GitHub production collector
~~~

### E18.7 Do not add a GitHub fallback Twin scheduler

Forbidden architecture:

~~~
Twin Runtime outage
→ GitHub hourly tick / manual rescue
~~~

### E18.8 Do not satisfy blackout by breaking all networking

The blackout must make GitHub control-plane endpoints unavailable to Runtime containers while preserving:

- PostgreSQL;
- private raw store;
- KBS/NOMADS/provider networking;
- Evidence Runtime ↔ DB;
- Twin Runtime ↔ DB.

A general network outage proves nothing about GitHub independence.

### E18.9 Do not pass GitHub credentials into Runtime containers

The blackout proof explicitly checks for GitHub credentials.

A hidden token plus unreachable hostname is not architectural independence.

### E18.10 Do not confuse shell escaping with architecture failure

The run-2 failure was:

~~~
literal "\\n"
→ jq parse error
~~~

not:

~~~
GitHub blackout breaks Runtime
~~~

When a proof parser fails, inspect raw probe bytes before changing runtime semantics.

### E18.11 Do not “fix” proof output by removing jq validation

The correct repair was canonical newline emission.

The jq parse gate remains useful and should stay.

### E18.12 Do not use old GitHub artifacts to restart live cursor/checkpoint state

Artifacts may support audit/adjudication only.

Restart must use durable operational authority in PostgreSQL/object storage as defined by the production graph.

### E18.13 Do not collapse EvidenceSupplyCursor and RuntimeTickCursor

They remain separate ownership planes.

Evidence Runtime owns EvidenceSupplyCursor.

Twin Runtime owns RuntimeTickCursor/checkpoint/scheduler state.

### E18.14 Do not let retirement sentinels write actions state

Retired workflows have actions:write forbidden.

### E18.15 Do not reuse failed Formal-v3/v4 state

The retirement of historical recovery workflows does not convert failed Formal state into valid successor state.

Phase 7 must create a fresh Formal-v5 store/epoch authority.

### E18.16 Do not arm Formal-v5 while runtime-independence is still running

Phase6 owner retirement alone is insufficient.

The frozen route explicitly requires outage independence and artifact-free durable recovery before Formal-v5 activation.

### E18.17 Do not mix B-Line

B-Line remains a separate engineering line.

No B-Line implementation should be pulled into #3351 merely because both concern production convergence.

---

## E19. Exact next execution sequence

### Step 1 — freeze current Phase 6 head while run 33144759220 is active

Do not mutate #3351 during the current live run unless a terminal machine failure identifies a concrete defect.

Current subject:

~~~
43529e13dbab2d21c6f4174a4c54a6122e166f1d
~~~

### Step 2 — let real causal capture finish

Require Step 9 terminal result.

If it fails, classify the exact failure:

- provider availability;
- causal timing;
- raw capture;
- object retention;
- blackout network override accidentally affecting provider access.

Do not assume architecture failure.

### Step 3 — require Evidence Runtime to continue under GitHub blackout

Step 10 must prove:

- two Evidence containers;
- one effective lease owner;
- fenced takeover;
- restart;
- durable cursor recovery;
- no GitHub control-plane dependency.

### Step 4 — require canonical Evidence DB → 24-slot prepare

Step 11 must use canonical Evidence already produced under blackout.

No GitHub artifact seed/rehydration.

### Step 5 — require Twin Runtime to continue under GitHub blackout

Step 12 must prove:

- two Twin containers;
- DB fencing;
- one effective scheduler owner;
- O00-O07 progression.

### Step 6 — restart Twin and recover O08-O23

Step 13 must recover from durable RuntimeTickCursor/checkpoint authority.

No artifact restore.

No workflow state replay.

### Step 7 — exact 24T final verifier

Step 14 must re-prove:

- 24 terminal ticks;
- canonical facts;
- checkpoint/cursor consistency;
- Evidence/Twin DB isolation;
- no provider fallback;
- no cross-plane mutation.

### Step 8 — assemble Phase 6 proof

Step 15 must explicitly record:

~~~
GitHub control plane unreachable
Evidence ingress continued
Twin Runtime continued
Evidence restart recovered durably
Twin restart recovered durably
GitHub artifact rehydration count = 0
~~~

### Step 9 — if run SUCCESS, register final Phase 6 evidence if required by control plane

Use the exact successful head/run.

Do not bind failed run 1 or run 2.

### Step 10 — rerun qualification/control-plane on the final exact head

Require:

~~~
status        = PASS
planner_status= PASS
blocker_count = 0
blockers      = []
~~~

for all applicable Phase6 successor checks.

### Step 11 — only then declare Phase 6 CLOSED

Do not merge/arm Formal-v5 merely because one runtime workflow is green if central evidence registration/adjudication is still pending.

### Step 12 — only after Phase 6 closure, start Phase 7 fresh Formal-v5 planning

Phase 7 must be a new epoch/store.

No failed Formal-v4 continuation.

---

## E20. First 30 minutes for the next engineer

### Minute 0–5 — restore exact state

Read:

~~~
git / GitHub PR #3351
base = 75d496127...
head = 43529e13...
run  = 33144759220
~~~

Confirm #3323 still points to the Phase 5 closure head.

Confirm protected main remains 26c1383f....

### Minute 5–10 — inspect run 33144759220

Do not start with code review.

Read the current terminal step.

If still Step 9, wait/read provider logs.

If later, inspect the first non-success step only.

### Minute 10–15 — verify blackout proof remains green

Step 8 must remain SUCCESS.

If it regresses, inspect raw blackout JSON bytes before modifying Runtime code.

### Minute 15–20 — inspect durable restart evidence

For Evidence:

~~~
EvidenceSupplyCursor
lease owner
fencing token
post-COMMIT visibility
restart progression
~~~

For Twin:

~~~
RuntimeTickCursor
scheduler slots
checkpoint latest index
canonical checkpoint
lease owner
fencing token
~~~

### Minute 20–25 — confirm no artifact rehydration

Search the runtime-independence workflow and runtime logs for any path that downloads/restores GitHub Actions artifacts into live operational state.

The count must remain zero.

### Minute 25–30 — decide only from terminal machine evidence

If all runtime steps pass, move to evidence registration/control-plane closure.

If one step fails, fix only that exact defect.

Do not reopen Phase 5 wholesale.

---

## E21. High-value exact file map

### Frozen production hosting route

~~~
docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md
~~~

### Phase 6 retirement authority

~~~
docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-PHASE6-GITHUB-PRODUCTION-EXECUTION-RETIREMENT-AUTHORITY-V1.json
~~~

### Central control plane

~~~
docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json

docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json

scripts/governance_acceptance/
PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs
~~~

### Phase 6 owner audit

~~~
scripts/governance_acceptance/
AUDIT_MCFT_CAP_09_PHASE6_GITHUB_PRODUCTION_OWNERS_V1.cjs
~~~

### Phase 6 retirement workflow

~~~
.github/workflows/
mcft-cap-09-phase6-retire-github-production-execution.yml
~~~

### Runtime-independence workflow

~~~
.github/workflows/
mcft-cap-09-phase6-runtime-independence.yml
~~~

### GitHub blackout Compose override

~~~
docker-compose.mcft-cap09-phase6-github-blackout.override.yml
~~~

### Reused production-equivalent Compose base

~~~
docker-compose.mcft-cap09-phase5-qualification.yml
~~~

### Phase 5 closure execution workflow

~~~
.github/workflows/
mcft-cap-09-phase5-two-service-accelerated-24t.yml
~~~

---

## E22. Current authoritative runs worth retaining

### Phase 5 closure head 75d496127...

~~~
33140680373  AM19 persistent 24T            SUCCESS
33140680423  Phase3 Evidence persistence    SUCCESS
33140680432  Phase4 Twin persistence        SUCCESS
33140680393  Phase5 packaging               SUCCESS
33140680396  Phase5 two-service 24T         SUCCESS
33140680425  qualification control-plane    SUCCESS / blockers=[]
~~~

### Phase 6 current head 43529e13...

~~~
33144759215  Phase6 retirement workflow     SUCCESS
33144759193  qualification control-plane    SUCCESS
33144759128  closure control-plane audit    SUCCESS
33144759239  EA5E2 dependency graph         SUCCESS
33144759242  normal CI build-test           SUCCESS
33144759220  runtime independence           IN PROGRESS
~~~

### Phase 6 failed parser/probe runs to retain for history

~~~
33143611538
head = 62c58eae...
runtime independence run 1
FAILURE

33143825049
head = 406dacfc...
runtime independence run 2
FAILURE at blackout proof parser
jq: Invalid numeric literal
~~~

These failures are useful because they show the blackout proof remained fail-closed while the parser was repaired.

---

## E23. Phase 6 closure definition

Phase 6 is CLOSED only when all of the following are simultaneously true:

~~~
GitHub scheduled production Evidence owner count = 0
GitHub scheduled production Twin owner count     = 0
retired workflow_run production owner count      = 0
retired downstream production trigger count      = 0
Evidence Runtime effective owner count            = exactly 1
Twin Runtime effective scheduler owner count      = exactly 1
GitHub control-plane blackout does not stop Evidence ingress
GitHub control-plane blackout does not stop Twin Runtime
Evidence Runtime outage does not create Twin provider fallback
Twin Runtime outage does not allow Evidence Runtime Twin mutation
Evidence restart recovers from durable authority
Twin restart recovers from durable authority
GitHub artifact rehydration required for recovery = 0
exact production-equivalent 24T verifier           = PASS
all applicable central qualification gates         = PASS
blockers                                            = []
~~~

Current state at this handoff:

~~~
ownership retirement      IMPLEMENTED / machine green
blackout parser           CLOSED / Step 8 machine green
runtime independence      IN PROGRESS
Phase6 overall            NOT YET CLOSED
Phase7                    FORBIDDEN
~~~

---

## E24. Formal-v5 activation remains forbidden

The frozen route requires Phase 0 through Phase 6 acceptance before Phase 7.

Formal-v5 prerequisites still include:

- production-equivalent two-service qualification accepted;
- restart/recovery accepted for both services;
- no Runtime provider fallback;
- no Evidence-to-Twin mutation crossing;
- GitHub production owner count zero;
- exactly one effective Evidence owner;
- exactly one effective Twin scheduler owner;
- GitHub outage independence;
- recovery without GitHub artifact rehydration;
- all applicable qualification gates terminal and accepted;
- fresh Formal-v5 store/epoch authority.

Therefore:

~~~
DO NOT ARM FORMAL-V5 NOW
~~~

Phase 7 must be a fresh epoch.

No failed Formal-v4 continuation or late repair is permitted.

---

## E25. Things not to do next

Do not:

1. modify protected main;
2. rebase #3351 onto protected main;
3. move #3351 base away from Phase5 closure head 75d496127...;
4. reopen Phase5 unless a terminal Phase6 failure proves a genuine Phase5 regression;
5. restore schedules to retired GitHub production workflows;
6. restore workflow_run production ownership;
7. add workflow_dispatch as a routine production rescue;
8. add GitHub provider fallback;
9. add GitHub Twin scheduler fallback;
10. pass GitHub credentials into Evidence/Twin Runtime containers;
11. use GitHub artifacts as live restart state;
12. collapse EvidenceSupplyCursor and RuntimeTickCursor;
13. weaken blackout networking so broadly that provider/DB access also fails;
14. delete historical workflow implementations or artifacts;
15. remove jq/proof parsing just to avoid parser failures;
16. reuse failed Formal-v3/v4 state;
17. arm Formal-v5 before Phase6 machine closure;
18. mix B-Line work into MCFT-9 Phase6;
19. treat broad CI acceptance runtime as the Phase6 runtime-independence proof;
20. call run 33144759220 “stuck” merely because live provider capture is long-running.

---

## E26. Bottom line

The project has crossed the major architectural boundary that the previous handoff was still working toward.

The current truth is:

~~~
Phase5 production-equivalent hosting
    CLOSED

control-plane
    blockers = []

Phase6 GitHub production owner retirement
    IMPLEMENTED
    audit / retirement workflow / central control = SUCCESS

Phase6 runtime-independence
    exact head = 43529e13dbab2d21c6f4174a4c54a6122e166f1d
    run        = 33144759220
    Step 8 GitHub blackout proof = SUCCESS
    Step 9 real causal capture   = IN PROGRESS

known code blocker
    NONE

known parser blocker
    CLOSED

next legitimate action
    finish the same-head runtime-independence proof
    then register/adjudicate final Phase6 evidence
    then require blockers=[]
    only then start Phase7 fresh Formal-v5
~~~

There is no reason to continue changing architecture at the current frontier unless run 33144759220 produces a concrete terminal failure.

The correct posture is:

**preserve the exact Phase6 subject, let the real Compose graph complete the blackout/restart/24T proof, and treat Phase7 as forbidden until that proof and the final central adjudication are terminal.**

---

# Historical continuation preserved below

The following content is intentionally preserved verbatim from the previous authoritative handoff frontier.

# GEOX MCFT-CAP-09 Conversation Handoff — 2026-08-28 Continuation — Phase 5 Exact-Head Production-Equivalent 24T / O00 Successor-Checkpoint Frontier

Status: **CONVERSATION HANDOFF / CURRENT AUTHORITATIVE CONTINUATION — NOT MASTER-TASK AUTHORITY**

Timestamp: **2026-08-28 01:17 +08:00**

Repository: liyongshang44-max/GEOX

Purpose: continue the same MCFT-CAP-09 Production Hosting Phase 5 handoff after the previous 2026-08-27 continuation. This section records the actual repository state reached after Phase 5 central registration, the Evidence work-item seam, fresh Phase 3/4 requalification, Twin canonical-fact DB hardening, migration of the useful #3319 scientific-runtime/two-service qualification capability into #3323, real NOMADS/KBS raw capture, and the first production-equivalent accelerated 24T run that crossed raw capture, Evidence canonical ingestion, and A0/24-slot preparation before failing at the first post-O00 Phase4 successor-checkpoint consistency check.

> **This section is now the highest-priority conversation continuation in this file.**
>
> The previous top-level Phase 5 continuation beginning with `C0` is intentionally preserved in full below as the historical state before this later Phase 5 work.
>
> The original Phase 2 continuation remains preserved below that.
>
> Do not delete either historical section: together they preserve the full Phase2 → Phase3 → Phase4 → Phase5 reasoning chain.
>
> This handoff does **not** supersede `docs/SSOT.md`, the MCFT Master Task Line, the CAP-09 taskbook, accepted CAP-01→08 authority, immutable Formal evidence, the qualification control plane, or the frozen Production Hosting route.

---

## D0. READ THIS FIRST — the current frontier changed after the last conversational status message

The last conversational status supplied by the user said run `33096293529` was still spending a long time in:

`Capture real causal A0 soil and GFS raw objects`

and that there was no new failure signal.

That statement was correct at the moment it was written, but the repository advanced immediately afterward.

The authoritative current GitHub result is now:

```text
#3323 exact head = a40260236c4716ba15fbb2511c5720713a524687
24T run          = 33096293529
24T conclusion   = FAILURE
```

The important correction is:

```text
Step 7  Capture real causal A0 soil and GFS raw objects                 SUCCESS
Step 8  Run same Evidence process graph against captured raw            SUCCESS
Step 9  Prepare A0 and exact 24-slot manifest from canonical Evidence   SUCCESS
Step 10 Run O00-O07 then graceful Twin container stop                   FAILURE
```

The current runtime error is:

```text
PHASE4_SUCCESSOR_CHECKPOINT_TIME_MISMATCH
```

Therefore the project is **not stuck in provider acquisition** and is **not deadlocked**.

The true current frontier is:

```text
real raw capture              CLOSED for this exact head/run
        ↓
same Evidence process graph   CLOSED for this exact head/run
        ↓
canonical Evidence DB         CLOSED for this exact head/run
        ↓
A0 + O00-O23 manifest         CLOSED for this exact head/run
        ↓
O00 Twin terminal commit      REACHED
        ↓
Phase4 successor viability    CURRENT BLOCKER
        ↓
O01-O07                       NOT REACHED
restart
O08-O23
final verifier                NOT REACHED
```

Do not wait for live capture again as if Step 7 were still running.

---

## D1. Current task in one sentence

**Keep #3323 as the sole Phase 5 implementation frontier and repair the exact post-O00 checkpoint/successor consistency defect exposed by the real production-equivalent two-service 24T, without weakening Phase4 successor viability, without changing the qualified Evidence/Twin production graph into a test-only graph, and without registering LEGACY_AM19 or Phase5 durable closure evidence until a fresh exact-head 24T actually completes O00→O23 including restart and final DB-isolation verification.**

---

## D2. Exact current repository / PR state

### D2.1 Protected main

Protected `main` remains exactly:

```text
26c1383f7f45abb76c99e28ec3d06714e85d1b2c
```

GitHub reports it is protected.

None of the Phase 5 work in this continuation has moved protected `main`.

### D2.2 Frozen stacked predecessors

Production-hosting predecessor chain remains:

```text
Phase2 closure = c3346768a44b16b127378cb690ada1d8cfec1049
Phase3 closure = 0e874b254c695b32fd94c7dc7034fd71b8aa3bc3
Phase4 closure = 16ff7160473c0a25dc059db6b2b6b7ba07f54dd1
```

Phase 5 remains stacked on Phase 4.

### D2.3 Current Phase 5 main frontier — #3323

Draft PR:

```text
#3323
feat(mcft-cap09): build Phase5 production-equivalent containers
```

Branch:

```text
feat/mcft-cap09-phase5-production-equivalent-containers-v1
```

Base:

```text
16ff7160473c0a25dc059db6b2b6b7ba07f54dd1
```

Current exact head:

```text
a40260236c4716ba15fbb2511c5720713a524687
```

GitHub facts at this handoff:

```text
state         = open
Draft         = true
mergeable     = true
commits       = 71
changed_files = 41
```

**#3323 is the only current Phase 5 implementation frontier.**

Do not split new Phase 5 semantics back into #3319.

### D2.4 #3319 is now a historical capability source, not the active graph

Draft PR #3319 remains open:

```text
#3319
feat(mcft-cap09): qualify Phase5 two-service accelerated 24T
head = 5c59a81a58f5ebf171d8206f821042c549d20e6d
base = 16ff7160473c0a25dc059db6b2b6b7ba07f54dd1
```

It was audited and used only as the source of useful infrastructure ideas/capability:

- scientific Runtime image;
- two-service container orchestration;
- 24T preparation/verification shape.

Its old hosting/runtime assembly is **not authoritative** and must not be revived.

The current rule is:

```text
#3319 infrastructure capability
        ↓ migrate only the useful primitives
#3323 latest production process graph
        ↓
qualification
```

not:

```text
run #3319 old hosting runtime beside #3323
```

### D2.5 Conversation handoff PR

Docs-only Draft PR #3298 remains:

```text
branch = docs/mcft-cap09-handoff-2026-08-26-phase2-evidence-module-frontier
base   = 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
```

Before this update:

```text
head         = 7b35a755e751dfc2d95dae90ce275ea8c04a3917
commits      = 3
changed_files= 2
Draft        = true
open         = true
mergeable    = true
```

This continuation remains docs-only.

Do not mix implementation mutation into #3298.

---

## D3. Current phase map

```text
Phase 2 production Evidence productization       MACHINE CLOSED predecessor
        exact = c3346768…
        ↓
Phase 3 durable Evidence Runtime                 MACHINE CLOSED predecessor
        exact closure = 0e874b25…
        fresh successor anchors exist
        ↓
Phase 4 durable Twin Runtime                     MACHINE CLOSED predecessor
        exact closure = 16ff7160…
        fresh successor anchors exist
        ↓
Phase 5 production-equivalent containers / 24T   IN PROGRESS  ← CURRENT
        exact head = a4026023…
        raw capture / Evidence ingress / prepare crossed
        O00 successor-checkpoint blocker
        ↓
Phase 6 production ownership cutover             NOT STARTED / FORBIDDEN
        ↓
Phase 7 fresh Formal-v5                          NOT ARMED
```

Current CAP-09 status:

```text
IN PROGRESS
NOT COMPLETE
NOT GRADUATED
PHASE5 NOT CLOSED
PHASE6 NOT STARTED
FORMAL-V5 NOT ARMED
PROTECTED MAIN UNCHANGED
```

---

## D4. What was completed after the previous `8671ac74…` handoff

The previous continuation stopped before the Evidence qualification seam, dedicated Compose, full central registration, Twin DB writer hardening, and real 24T were complete.

Those areas have materially advanced.

### D4.1 Phase 5 central exact-path ownership was repaired

The old state had Phase5 paths in:

```text
unknown_changed_paths
```

with:

```text
authority_errors = []
resolver_errors  = []
```

That gap has been closed.

The current exact 24T workflow itself now passes:

```text
Require central exact-path ownership = SUCCESS
```

EA5E2 graph on current exact head is also SUCCESS.

Do not reintroduce broad directory wildcards.

### D4.2 Evidence `work_item_factory` seam landed and default production identity was preserved

The agreed Phase3 composition seam was implemented.

Production default remains the real:

```text
ProductionEvidenceWorkItemFactoryV1
```

Qualification may inject the controlled work-item factory at the explicit qualification boundary.

The rest of the Evidence graph remains production-owned:

```text
Evidence host
→ cycle service
→ provider transport
→ raw retention
→ scientific decoder
→ canonicalizer
→ fenced governed DB COMMIT
→ post-COMMIT visibility
→ EvidenceSupplyCursor
```

### D4.3 Per-target Evidence source-family selection was added without changing the default

Current target-level selection supports explicit source families such as:

```text
KBS_SOIL
KBS_RAW_HOURLY
GFS_BUNDLE
```

Production default remains all required source families.

This seam exists so a qualification target can request only the source families that are semantically needed for that target.

It is **not** permission to bypass the production Evidence pipeline.

### D4.4 Evidence qualification entrypoint now uses the same production process graph

A stable qualification entrypoint was added that delegates into the same Evidence process/composition graph while injecting only the controlled provider/work-item boundary.

Do not create a second simplified Evidence runner.

### D4.5 Twin accelerated-clock qualification entrypoint now uses the same production Twin process

The Phase4 Twin composition/process now exposes explicit qualification clock seams while preserving production defaults:

```text
production host DB clock = PostgreSQL transaction time
production scheduler clock = SYSTEM_DATABASE_UTC
qualification override = explicit accelerated engineering clock only
```

The qualification Twin entrypoint calls the same:

```text
runMcftCap09TwinRuntimeProcessV1()
```

It does not reimplement scheduler, lease, runner, persistence, checkpoint, or successor semantics.

### D4.6 Dedicated Phase5 qualification Compose now exists

The current dedicated qualification topology includes separate services/roles for:

- PostgreSQL;
- private raw object store;
- platform bootstrap;
- Phase5 service-principal bootstrap;
- fixture/raw capture;
- Evidence Runtime;
- qualification prepare;
- Twin Runtime;
- qualification verifier.

It is qualification-only.

It does not cut over production ownership.

### D4.7 Per-container runtime lease identity was repaired

An early Compose version accidentally fixed runtime lease owners in environment variables.

That is unsafe for duplicate-container fencing because two containers could look like the same owner.

The current rule is:

```text
long-running Evidence/Twin runtime
        ↓
HOSTNAME-derived default lease owner
        ↓
container-unique owner identity
```

Qualification bootstrap ownership is separate and short-lived.

Do not put a fixed long-running Twin/Evidence owner back into Compose.

### D4.8 Qualification bootstrap lease now expires naturally

An intermediate implementation tried to release the bootstrap Twin lease by administrator UPDATE.

That was rejected.

Current qualification bootstrap uses a short TTL and:

```text
bootstrap_lease_release_mode = NATURAL_TTL_EXPIRY
```

The qualification orchestrator must not become a privileged lease-table repair mechanism.

---

## D5. Twin canonical-fact DB writer hardening — the major Phase 5 security repair

The user explicitly required:

```text
Evidence/Twin DB layer must provide real bidirectional isolation
```

This is now materially implemented.

### D5.1 Prior weakness

Evidence Runtime had already been narrowed to a governed SECURITY DEFINER writer.

Twin Runtime still had application paths that could directly:

```sql
INSERT INTO public.facts
```

through its runtime privilege role.

That meant the separation was partly an application convention rather than a DB-enforced boundary.

### D5.2 Current Twin writer design

New/qualified boundary:

```text
Twin LOGIN
   ↓
geox_mcft_cap09_twin_runtime_v1 privilege role
   ↓
NO direct INSERT on public.facts
   ↓
EXECUTE only on fenced Twin SECURITY DEFINER writer
   ↓
NOLOGIN Twin writer owner
   ↓
scope + object family + lease owner + fencing token + expiry checks
   ↓
canonical Twin fact append
```

Key implementation:

`apps/server/src/persistence/twin_runtime/postgres_mcft_cap09_twin_canonical_fact_writer_v1.ts`

Phase 5 hardening migration:

`apps/server/db/migrations/2026_08_27_mcft_cap_09_phase5_twin_fact_writer_acl.sql`

### D5.3 DB function checks stale ownership before idempotent-existing success

Hard invariant:

```text
stale owner
   ↓
must be rejected first
   ↓
must not reach "existing idempotent success" shortcut
```

This mirrors the Evidence-plane pre-COMMIT fencing requirement.

### D5.4 Twin writer cannot manufacture Evidence fact families

The DB function only authorizes the governed Twin canonical object families required by the current Runtime graph.

Evidence families such as soil observations are rejected at the DB boundary.

### D5.5 Evidence and Twin writer EXECUTE authority is cross-denied

Required matrix:

```text
Evidence role → Evidence writer EXECUTE  yes
Evidence role → Twin writer EXECUTE      no

Twin role     → Twin writer EXECUTE      yes
Twin role     → Evidence writer EXECUTE  no

Twin role     → direct facts INSERT      no
Evidence role → arbitrary facts INSERT   no
```

### D5.6 Current Phase 5 production composition explicitly injects the fenced writer

The active production Twin composition uses:

```text
PostgresMcftCap09TwinCanonicalFactWriterV1
```

for the canonical A-record-set / Forecast / Scenario path used by the Phase5 Twin process.

Do not remove this injection to make a test easier.

### D5.7 Important nuance — do not mechanically delete every historical direct INSERT string

Some historical/bootstrap repository methods retain old direct-write semantics for control-plane/prewindow bootstrap paths.

The engineering goal is **not** “grep returns zero INSERT strings”.

The real goal is:

```text
the deployed long-running Phase5 Twin LOGIN
cannot directly insert facts
and the current O00-O23 production Twin graph
uses the fenced writer
```

Do not mutate frozen historical/bootstrap semantics merely for cosmetic source purity.

---

## D6. #3319 capability migration — what moved and what did not

### D6.1 What was worth migrating

From #3319:

- a dedicated MCFT-CAP-09 scientific Runtime image;
- required Python scientific dependencies;
- two-service container orchestration pattern;
- raw capture / prepare / verify orchestration concepts.

### D6.2 Scientific Runtime image

Current Phase5 image:

`docker/mcft-cap09-runtime.Dockerfile`

It carries the scientific stack required by the actual product decoders, including the real GFS/eccodes path.

This was necessary because the generic commercial runtime image did not prove the scientific decoding environment required by the production GFS product path.

### D6.3 What was explicitly not migrated

Do not revive:

```text
apps/server/src/hosting/mcft_cap09_phase5_two_service_runtime_v1.ts
```

or any equivalent #3319 test-only runtime assembly.

The authority rule is:

```text
scientific image / Compose / orchestration may migrate
runtime algorithm may not
```

### D6.4 Current active execution graph

Evidence:

```text
compiled qualification Evidence entry
        ↓
current Evidence production process
        ↓
current Phase3 product composition
```

Twin:

```text
compiled qualification Twin entry
        ↓
current Twin production process
        ↓
current Phase4 product composition
        ↓
ExternalFormalV3Amendment19RunnerV1
        ↓
canonical persistent tick graph
```

This is the core “do not test another implementation” requirement.

---

## D7. Live A0 raw capture and NOMADS provider repairs

The exact-head 24T lane now performs real external raw acquisition.

### D7.1 No fake GRIB

The lane does **not** create a tiny synthetic GFS GRIB to satisfy the product decoder.

It captures real provider bytes and later replays those bytes through the real product scientific decoder.

### D7.2 A0 is chosen from real causal provider availability

The live capture stage resolves a real A0 from causal:

- KBS soil raw;
- GFS raw bundle.

The successful current run resolved:

```text
A0  = 2026-08-27T18:00:00.000Z
O00 = 2026-08-27T19:00:00.000Z
O07 = 2026-08-28T02:00:00.000Z
O23 = 2026-08-28T18:00:00.000Z
```

### D7.3 Docker bind-mount EBUSY was a false infrastructure blocker

The capture helper originally attempted to recursively remove the bind mount root itself.

Docker correctly returned:

```text
EBUSY
```

Repair:

- preserve the mount point;
- clear only the directory contents.

Do not `rmSync(root, recursive)` on a mounted fixture root.

### D7.4 GFS retained-member 220 vs 219 was an accounting bug, not raw loss

The product composer had captured all real raw members.

The qualification helper incorrectly subtracted every directory rejection from retained-member count, including candidates rejected before any raw request happened.

Repair:

- count actual retained rejected-directory objects;
- assert captured raw count equals product `raw_provider_object_count`;
- do not weaken retention-before-parse.

### D7.5 NOMADS F070 HTTP 302 exposed a real production acquisition problem

The first fully live GFS attempt hit HTTP 302 around PGRB2 F070.

The correct conclusion was not:

```text
accept 302
follow arbitrary redirect
qualification retry hack
```

The real issue was overly aggressive repeated use of the NOMADS Grib Filter CGI.

### D7.6 NOMADS responsible-sharing cadence is now product behavior

`GfsNomadsLiveProviderV1` now enforces the NOAA Grib Filter responsible-sharing cadence.

Production minimum interval:

```text
10,000 ms
```

The cadence belongs in the product provider because that is the layer that knows which requests are Grib Filter CGI requests.

It does not belong in the generic HTTPS transport or the qualification runner.

### D7.7 Timer jitter must not create false <10s failures

An initial cadence implementation measured at the wrong boundary and could fail because real timers wake slightly early.

The final cadence logic was repaired to enforce the interval at the observed request-start boundary rather than trusting a timer request duration.

Do not weaken the 10s requirement; measure it correctly.

### D7.8 Test cadence may use a virtual/injected clock but production may not

Focused acceptance may use an injected cadence port so the test suite does not literally wait 10 seconds.

The live provider default still uses real elapsed time.

Never let the test port become the production default.

### D7.9 Root-owned proof files were an orchestration issue, not a semantic failure

Capture/prepare containers can create root-owned proof files on bind mounts.

The runner later needs to inspect/upload them.

The workflow now explicitly hands proof metadata back to the runner.

Do not confuse Linux bind-mount ownership with provider/Runtime failure.

---

## D8. Fresh predecessor anchors now exist and must not be confused with Phase 5 closure

The current evidence registry contains fresh immutable successor anchors after the new Phase3/Phase4 seams.

Important current anchors include:

### D8.1 Phase 3 post-NOMADS-cadence anchor

```text
evidence_id = PHASE3_EVIDENCE_RUNTIME_FOUNDATION_REQUAL_76C920E1
subject_sha = 76c920e15546b55b4a4f5e317cc9ad820b20b0f8
run_id      = 33085589432
conclusion  = success
dependency_digest =
  sha256:9569eb7630e736e70cfa56942e15a39a14c933c804e194c83050047fd67b8b94
```

### D8.2 Phase 4 post-Phase5-writer anchor

```text
evidence_id = PHASE4_TWIN_RUNTIME_FOUNDATION_REQUAL_76C920E1
subject_sha = 76c920e15546b55b4a4f5e317cc9ad820b20b0f8
run_id      = 33085589444
conclusion  = success
dependency_digest =
  sha256:e503940c018c286bfaafa10b7ad71113c057727d356c71f0d3d709617539fe82
```

Earlier focused anchors such as the post-work-item Phase3 and post-clock-seam Phase4 anchors remain historical evidence in the registry.

These fresh predecessor anchors are legitimate because they bind real successful runs.

They are **not Phase5 durable closure evidence**.

Do not use them as a substitute for successful production-equivalent 24T.

---

## D9. Current exact-head machine evidence on `a4026023…`

Current exact head:

```text
a40260236c4716ba15fbb2511c5720713a524687
```

Exact-head workflows:

```text
ci
run 33096293513
SUCCESS

mcft-cap-09-phase3-evidence-runtime-persistence
run 33096293572
SUCCESS

mcft-cap-09-phase4-twin-runtime-persistence
run 33096293581
SUCCESS

mcft-cap-09-phase5-production-equivalent-containers
run 33096293662
SUCCESS

mcft-cap-09-ea5e2-runtime-dependency-graph
run 33096293584
SUCCESS

mcft-cap-09-ea5e2-successor-runner-qualification
run 33096293728
SUCCESS

mcft-cap-09-qualification-control-plane-v1
run 33096293612
FAILURE — bounded blocker inventory only

mcft-cap-09-phase5-two-service-accelerated-24t
run 33096293529
FAILURE — Step 10 successor-checkpoint mismatch
```

This combination is important:

```text
Phase3/4/5 packaging and graph are green
while
the first real integrated 24T has exposed a runtime cross-component consistency defect
```

Do not interpret the Step 10 failure as “Phase4 was never qualified”.

It is a new integration-scale successor/checkpoint interaction exposed by the current production-equivalent topology.

---

## D10. Current production-equivalent 24T — exact result of run `33096293529`

### D10.1 What definitely passed

On exact head `a4026023…`:

1. checkout exact Phase5 subject — SUCCESS;
2. require exact head/private qualification roots — SUCCESS;
3. central exact-path ownership — SUCCESS;
4. build exact scientific Runtime image — SUCCESS;
5. isolated PostgreSQL + private raw store — SUCCESS;
6. capture real causal A0 soil + GFS raw objects — SUCCESS;
7. same Evidence process graph against captured raw — SUCCESS;
8. A0 + exact 24-slot manifest from canonical Evidence DB — SUCCESS.

The Evidence Runtime log reached:

```text
CYCLE_COMPLETED
PLANNER_EXHAUSTED
```

Therefore this run proves that the following chain really executed together:

```text
real provider raw
        ↓
scientific runtime image
        ↓
current Evidence process
        ↓
raw retention
        ↓
current scientific decoder
        ↓
canonical Evidence ingress
        ↓
canonical Evidence DB
        ↓
qualification prepare reading canonical DB
```

This is a major frontier advance over all earlier static/packaging proofs.

### D10.2 What happened at O00

The Twin container started successfully.

Observed health progression:

```text
STARTING
cycle_attempt=0
terminal_slot_count=0
        ↓
HEALTHY
cycle_attempt=1
terminal_slot_count=1
detail=TERMINAL_SLOT_RECORDED
        ↓
DEGRADED
cycle_attempt=2
terminal_slot_count=1
detail=FATAL_CYCLE_FAILURE
```

Fatal error:

```text
PHASE4_SUCCESSOR_CHECKPOINT_TIME_MISMATCH
```

Call stack:

```text
PostgresTwinRuntimeSuccessorViabilityV1.verifyAfterTerminal
→ TwinRuntimeHostV1.run
→ runMcftCap09TwinRuntimeProcessV1
→ runMcftCap09Phase5TwinRuntimeQualificationV1
```

This means:

- O00 reached terminal scheduler state;
- successor viability ran after O00;
- the host failed before O01 could proceed.

### D10.3 O08-O23 and final verifier did not run

Because Step 10 failed:

```text
Restart Twin container and recover O08-O23 from durable cursor = SKIPPED
Verify exact 24T canonical and DB isolation closure            = SKIPPED
```

Therefore do not claim:

- restart recovery PASS;
- O00-O23 PASS;
- 24 terminal ticks;
- final DB-isolation verifier PASS;
- Phase5 durable closure.

### D10.4 Artifact retained for diagnosis

Run `33096293529` uploaded:

```text
artifact id = 9657000663
artifact name =
  mcft-cap09-phase5-two-service-24t-a40260236c4716ba15fbb2511c5720713a524687
artifact zip sha256 =
  fee34a95e84962b47123adbaf1c23efe137fc51984ec6fbdb55483785e3c9297
```

The workflow uploads proof/log metadata, not the raw provider fixture as durable qualification evidence.

Use this artifact/log evidence to diagnose Step 10.

Do not register it as a successful Phase5 durable anchor.

---

## D11. Current real blocker — `PHASE4_SUCCESSOR_CHECKPOINT_TIME_MISMATCH`

The relevant Phase4 successor check is in:

`apps/server/src/runtime/twin_runtime/postgres_twin_runtime_successor_viability_v1.ts`

For terminal slot O00 the checker computes:

```text
terminalTime
        =
schedule_start + slot_index * 1h

expectedCheckpointNext
        =
terminalTime + 1h
```

For the current run:

```text
O00 terminalTime          = 2026-08-27T19:00:00.000Z
expected checkpoint next  = 2026-08-27T20:00:00.000Z
```

The checker then reads the checkpoint referenced by:

```text
twin_runtime_checkpoint_latest_index_v1
        JOIN
public.facts
```

and requires both:

```text
checkpoint logical_time == O00 terminal time
checkpoint next_tick_logical_time == O01
```

The observed failure proves at least one of those values did not match.

### D11.1 Do not guess which side is wrong yet

The current run was torn down after failure, so the next step must reproduce/diagnose the persisted values explicitly.

The likely classes to distinguish are:

1. latest checkpoint index points at the wrong checkpoint object;
2. checkpoint canonical fact has the wrong outer logical time;
3. checkpoint payload has the wrong `next_tick_logical_time`;
4. successor viability is reading the canonical checkpoint path incorrectly;
5. bootstrap/A0 checkpoint remains current when O00 commit should have advanced it;
6. an accelerated-clock integration assumption has exposed a previously untested transaction/readback ordering issue.

Do not select one by intuition.

### D11.2 Exact diagnostic values to read on the next reproduction

Immediately after O00 terminal commit and before cleanup, capture:

```text
scheduler cursor:
  schedule_start_logical_time
  next_slot_index
  next_slot_id
  next_logical_time
  last_terminal_slot_id
  last_terminal_logical_time

terminal O00 scheduler row:
  state
  logical_time

checkpoint latest index:
  checkpoint_object_id
  logical_time
  source_fact_id

checkpoint canonical fact:
  payload.logical_time
  payload.payload.next_tick_logical_time
  object_id
  determinism_hash
  previous_checkpoint_ref
  last_completed_tick_ref
  last_posterior_state_ref
  forecast_result_ref

expected:
  checkpoint logical_time = 2026-08-27T19:00:00.000Z
  checkpoint next          = 2026-08-27T20:00:00.000Z
```

Also compare against the O00 A-record-set member:

```text
twin_runtime_checkpoint_v1
```

that was just committed.

### D11.3 Do not weaken the successor check to make O01 run

Forbidden repairs include:

- skip `verifyAfterTerminal()`;
- change mismatch from fatal to warning;
- advance cursor manually;
- force checkpoint index to O01 from workflow code;
- delete the checkpoint check only in accelerated qualification;
- replace the successor viability adapter with a test stub;
- continue O01 after mismatch.

The successor check exists precisely to prove the canonical checkpoint and durable scheduler cursor agree.

The integrated run has found a real inconsistency.

Preserve fail-closed behavior until the exact cause is understood.

---

## D12. Central control plane — only two legitimate blockers remain

Current central run:

```text
33096293612
```

The first seven steps passed, including:

- exact control-plane checkout;
- successor predecessor / zero production binding checks;
- central applicability semantics;
- generation/durable-anchor/dependency-digest semantics;
- immutable evidence references;
- exact PR applicability plan.

Failure is at:

```text
Enumerate all blockers without fail-fast
```

There are two material blockers.

### D12.1 `LEGACY_AM19_PERSISTENT_24T`

Reason:

```text
NO_VALID_REQUALIFICATION_EVIDENCE
```

Historical candidates remain valid workflow runs/anchors in many respects, but:

```text
dependency_digest_match = false
```

because GFS provider acquisition semantics changed when NOMADS responsible-sharing cadence became real product behavior.

Therefore old AM19 24T evidence cannot simply carry forward.

Correct repair:

```text
first finish/fix current integrated 24T
        ↓
stabilize exact dependency set
        ↓
fresh LEGACY_AM19_PERSISTENT_24T requalification
        ↓
only then bind new immutable evidence
```

Do not rebind old evidence to a new digest.

### D12.2 `PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS`

Reason:

```text
NO_VALID_REQUALIFICATION_EVIDENCE
candidates = []
```

This is expected.

There must be no Phase5 durable candidate until the integrated production-equivalent qualification actually succeeds.

### D12.3 These blockers must not be “fixed” before 24T success

Do not add:

- fake Phase5 durable evidence;
- hand-written success anchor;
- carry-forward from packaging run;
- durable anchor for failed run `33096293529`.

The correct order remains:

```text
24T success
        ↓
fresh required requalification
        ↓
final dependency digests
        ↓
durable evidence registration
        ↓
central closure
```

---

## D13. The current 24T qualification is not a late-exact KBS batch proof

The current successful capture/prepare path establishes real causal A0 soil + GFS and then exercises the production Runtime graph.

Do not silently reinterpret this run as proof of every KBS daily-batch temporal case.

The KBS publication model remains:

```text
daily batch publication
!= hourly publication
```

The current integrated 24T's primary purpose is production-equivalent process/container/persistence/restart qualification.

Late-exact KBS batch semantics remain governed separately by the Phase3 cadence/event-time model and any explicit qualification that claims that case.

Do not add a late-exact claim to Phase5 evidence unless the run actually exercised it.

---

## D14. High-value failure / repair history from this continuation

These are the traps most likely to be reintroduced by the next engineer.

### D14.1 Do not test a second implementation

The entire Phase5 route is built around:

```text
qualification graph == future production graph
except explicit provider/clock substitution
```

No simplified Evidence runner.

No simplified Twin runner.

No test scheduler.

No test persistence repository.

### D14.2 Do not use fake small GRIB

The product GFS decoder expects the real product scientific geometry/contracts.

A small fake payload can make a test green while proving the wrong decoder.

### D14.3 Docker bind mount roots cannot be recursively removed like ordinary directories

Bad:

```text
rm/rmSync(mount_root, recursive)
```

Good:

```text
preserve mount point
clear children only
```

### D14.4 Raw capture accounting must follow actual requests, not abstract rejected candidates

`directory_rejection_count` can include candidates rejected before a raw request occurs.

Do not infer retained-object cardinality by subtracting every logical rejection.

### D14.5 NOMADS Grib Filter must be responsibly paced

Do not remove the production minimum request interval to make qualification faster.

Do not turn HTTP 302 into an accepted success response.

Do not add an unrestricted redirect fallback.

### D14.6 Measure cadence at observed request boundaries

Timers can wake slightly early.

The invariant is the actual observed request-start interval.

Do not use a timer's requested sleep duration as proof of elapsed time.

### D14.7 Focused acceptance can fail on TypeScript/Fetch typing before testing semantics

The earlier Response `BodyInit` problem was a compile/test harness issue.

Keep focused acceptance compilable under the repository's actual Node/TypeScript environment.

Do not misclassify a harness type error as provider failure.

### D14.8 EA5E2 dependency graph digest must follow the real dependency set

The GFS provider cadence change legitimately changed a governed dependency.

Correct sequence:

```text
finish path set
→ generate graph
→ read expected digest
→ legal carrier rebind
→ rerun graph
```

Do not guess or hand-edit unrelated frozen digests.

### D14.9 Root-owned proof metadata must be handed back to the runner

Container bind mounts may create root-owned files.

The runner must regain read/upload access explicitly.

Do not grant broad container privileges to solve this.

### D14.10 A green packaging workflow is not a green integrated 24T

Current proof is the strongest example:

```text
Phase3 = green
Phase4 = green
Phase5 packaging = green
EA5E2 graph = green
        but
integrated 24T = red at O00 successor viability
```

Do not infer closure from component-level greens.

### D14.11 Do not bypass Phase4 successor viability

The current failure is valuable precisely because the successor check stayed enabled in the real Twin host.

Do not remove the guard.

### D14.12 Do not register durable evidence before the runtime graph stabilizes

The old LEGACY_AM19 anchors are now stale specifically because a legitimate product provider dependency changed.

Durable registration must remain late.

### D14.13 Do not mix B-Line

B-Line remains outside this implementation line.

No B-Line semantic refactor belongs in the O00 checkpoint repair.

---

## D15. Recommended exact execution sequence from the current frontier

### Step 1 — freeze `a4026023…` as the diagnostic reference

Do not reuse the old statement that capture is still running.

Record:

```text
subject = a40260236c4716ba15fbb2511c5720713a524687
run     = 33096293529
error   = PHASE4_SUCCESSOR_CHECKPOINT_TIME_MISMATCH
```

### Step 2 — reproduce O00 with explicit checkpoint diagnostics

Use the same:

- scientific image;
- real raw capture semantics;
- Evidence process;
- canonical DB;
- prepare path;
- Twin process.

Add/read diagnostic evidence at the exact successor boundary.

Do not stub the Runtime.

### Step 3 — determine whether persistence or viability readback is wrong

Compare:

```text
O00 committed checkpoint member
checkpoint latest index
checkpoint fact
RuntimeTickCursor
terminal scheduler row
```

The repair must target the actual inconsistency.

### Step 4 — preserve fail-closed successor semantics

Whatever changes, the post-terminal invariant must remain:

```text
terminal slot
+
RuntimeTickCursor
+
canonical checkpoint
+
checkpoint next tick
all agree
```

### Step 5 — fresh predecessor qualification if a Phase4 dependency changes

If the repair touches:

- Phase4 successor viability;
- Phase4 persistence;
- Twin composition;
- checkpoint/cursor semantics;

then run fresh Phase4 qualification and bind new predecessor evidence only after success.

If the repair touches Phase3/Evidence dependencies, fresh Phase3 is also required.

### Step 6 — rerun Phase5 packaging + EA5E2 graph

Minimum before new 24T:

```text
Phase3 if applicable = SUCCESS
Phase4 if applicable = SUCCESS
Phase5 packaging      = SUCCESS
EA5E2 graph           = SUCCESS
ordinary CI           = SUCCESS
central exact paths   = owned
```

### Step 7 — freeze one new exact head and rerun the full 24T

Do not continue from the failed DB after code changes.

Fresh isolated qualification state.

Required execution:

```text
real A0 raw capture
→ Evidence canonical ingestion
→ A0 prepare
→ O00-O07
→ graceful SIGTERM
→ restart same Twin image/process
→ durable cursor recovery
→ O08-O23
→ final DB isolation / 24T verifier
```

### Step 8 — only after 24T SUCCESS, repair the two central durable blockers

Then:

1. fresh `LEGACY_AM19_PERSISTENT_24T` requalification;
2. register Phase5 durable evidence;
3. rerun central blocker inventory;
4. require blocker_count=0;
5. rerun graph/successor/CI as required.

Only then discuss Phase5 closure.

---

## D16. First 30 minutes for the next engineer

### Minute 0–5 — restore authority and exact state

Read:

```text
docs/SSOT.md
MCFT master task line
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md
this handoff top continuation
```

Verify:

```text
main
#3323 head/base
#3323 Draft/open
latest 24T run
latest central run
```

### Minute 5–10 — read the failed 24T artifact/logs

Primary run:

```text
33096293529
```

Primary error:

```text
PHASE4_SUCCESSOR_CHECKPOINT_TIME_MISMATCH
```

Do not start from old GFS 302 or capture EBUSY failures; those are already historical.

### Minute 10–20 — trace O00 checkpoint end-to-end

Files:

```text
apps/server/src/runtime/twin_runtime/postgres_twin_runtime_successor_viability_v1.ts
apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts
apps/server/src/runtime/twin_runtime/external_formal_cap04_a_record_set_builder_v1.ts
apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts
```

Trace:

```text
build O00 checkpoint
→ fenced fact append
→ checkpoint latest index update
→ scheduler terminal
→ successor read-only verification
```

### Minute 20–30 — make the smallest diagnostic/fix

Preferred first move:

- capture actual checkpoint/index/cursor values;
- prove which value diverges;
- then patch exactly one semantic owner.

Do not alter:

- Evidence provider cadence;
- scientific image;
- canonical Evidence ingress;
- service principals;
- DB writer isolation;
- central registration;
- graph digest;

unless evidence shows they are causally involved.

---

## D17. High-value exact file map for the current frontier

### Phase5 exact-head 24T

`.github/workflows/mcft-cap-09-phase5-two-service-accelerated-24t.yml`

`docker/mcft-cap09-runtime.Dockerfile`

`docker-compose.mcft-cap09-phase5-qualification.yml`

### Live raw capture

`apps/server/src/external_evidence/qualification/mcft_cap09_phase5_capture_a0_fixture_v1.ts`

### Evidence product/qualification graph

`apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts`

`apps/server/src/external_evidence/mcft_cap09_evidence_runtime_composition_v1.ts`

`apps/server/src/external_evidence/mcft_cap09_production_evidence_work_items_v1.ts`

`apps/server/src/external_evidence/qualification/mcft_cap09_phase5_controlled_evidence_work_items_v1.ts`

`apps/server/src/external_evidence/qualification/mcft_cap09_phase5_evidence_runtime_qualification_v1.ts`

### GFS live provider / cadence

`apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.ts`

`apps/server/src/external_evidence/provider/gfs_nomads_raw_bundle_composer_v1.ts`

### Twin current graph

`apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts`

`apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts`

`apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_twin_runtime_qualification_v1.ts`

### 24T prepare / verify

`apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_prepare_24t_v1.ts`

`apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_verify_24t_v1.ts`

### Current O00 blocker

`apps/server/src/runtime/twin_runtime/postgres_twin_runtime_successor_viability_v1.ts`

`apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts`

`apps/server/src/runtime/twin_runtime/external_formal_cap04_a_record_set_builder_v1.ts`

`apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts`

### Twin DB isolation

`apps/server/src/persistence/twin_runtime/postgres_mcft_cap09_twin_canonical_fact_writer_v1.ts`

`apps/server/db/migrations/2026_08_27_mcft_cap_09_phase5_twin_fact_writer_acl.sql`

### Central control

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json`

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json`

`scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs`

`.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml`

---

## D18. Exact commits worth retaining from this continuation

### Qualification clock / Compose frontier

```text
9b0f6eec4c4bb5f98e935947a4e1c06310990fc7
feat(mcft-cap09): add dedicated Phase5 qualification Compose

58ff5eb78baa58f289f3f280181977eec261aed6
chore(mcft-cap09): anchor fresh Phase4 clock-seam qualification

be3e77cf3ae6b0273a60b42748bd8ae467674b73
fix(mcft-cap09): render qualification Compose profile in acceptance
```

### Twin DB writer hardening

```text
519b0ca6c89f03d50d9e0837749320be53300847
feat(mcft-cap09): fence Twin canonical fact writer

cbecbfee73561656856d632dd176c615a6dcb1ba
chore(mcft-cap09): govern Twin DB writer hardening

674b3347ae16299f4876045b40832040ccb64f30
fix(mcft-cap09): model stale Twin fence legally
```

### Evidence source-family / 24T topology

```text
1ea2499cddbf5e4acf0ee63906eab2603df744e5
feat(mcft-cap09): select Evidence source families per target

6fbb1c4f9b7fea5ddc9dab8b45c10eef6442fe16
feat(mcft-cap09): capture real A0 raw for Phase5 24T

1cdc6dc6fc9976e5b23df242f42f5c530e3abd53
feat(mcft-cap09): wire two-service 24T qualification topology

512f2efe7fed4ef4cc547f14f81bbed5b73088f6
chore(mcft-cap09): govern exact-head Phase5 24T lane
```

### Live capture repairs

```text
7ae8842fe4d19527057aba22442d91e7f745ec7a
fix(mcft-cap09): preserve mounted fixture root during capture

99ccfd8a2eee93676ccb89c93589db3dd16e39f8
fix(mcft-cap09): account retained GFS replay members exactly

11dfa7a4d7d8ebba781709ef80617286d1f7453b
fix(mcft-cap09): pace NOMADS Grib Filter acquisition

d306b74fdf5ee22db8ab2e1afbffba0bff6c517e
fix(mcft-cap09): enforce NOMADS cadence at observed boundary

76c920e15546b55b4a4f5e317cc9ad820b20b0f8
test(mcft-cap09): align cadence client ceiling with product
```

### Fresh anchors / graph and proof handoff

```text
4267324353cbe6a46f460d6197b4a6c12ebf7685
chore(mcft-cap09): anchor fresh Phase3/4 and rebind EA5E2 graph

529a3242259871b14544d4e9d9b32b6efb72e6b7
fix(mcft-cap09): hand capture proof metadata back to runner

a40260236c4716ba15fbb2511c5720713a524687
fix(mcft-cap09): return 24T proof metadata to runner
```

---

## D19. Exact runs worth retaining

### Current exact head `a4026023…`

```text
33096293513  ci                                            SUCCESS
33096293572  Phase3 Evidence Runtime persistence           SUCCESS
33096293581  Phase4 Twin Runtime persistence               SUCCESS
33096293662  Phase5 production-equivalent packaging        SUCCESS
33096293584  EA5E2 runtime dependency graph                SUCCESS
33096293728  EA5E2 successor runner qualification          SUCCESS
33096293612  qualification control plane                   FAILURE
33096293529  production-equivalent accelerated 24T         FAILURE
```

### Fresh predecessor anchors

```text
33085589432  Phase3 post-NOMADS-cadence                    SUCCESS
33085589444  Phase4 post-Phase5-writer                     SUCCESS
```

### Current integrated 24T failure point

```text
33096293529
Step 7 capture       SUCCESS
Step 8 Evidence      SUCCESS
Step 9 prepare       SUCCESS
Step 10 Twin O00-O07 FAILURE
error:
PHASE4_SUCCESSOR_CHECKPOINT_TIME_MISMATCH
```

---

## D20. Phase 5 closure definition from this frontier

Phase 5 is **not** closed.

Do not close until one governed exact head proves all of the following together:

- [x] separate Evidence/Twin LOGIN principals;
- [x] Evidence-only raw-storage credentials;
- [x] Twin has no provider/raw-storage fallback;
- [x] DB-layer Evidence/Twin writer isolation;
- [x] Twin direct facts INSERT denied for deployed runtime role;
- [x] fenced Twin canonical writer;
- [x] production clock default preserved;
- [x] accelerated clock isolated to qualification;
- [x] dedicated scientific Runtime image;
- [x] dedicated qualification Compose;
- [x] central exact-path ownership;
- [x] real causal A0 soil/GFS raw capture;
- [x] same Evidence process graph consumes captured raw;
- [x] canonical Evidence DB is used by prepare;
- [x] exact 24-slot manifest created;
- [ ] O00-O07 completes without successor mismatch;
- [ ] graceful Twin stop succeeds;
- [ ] restart recovers from durable RuntimeTickCursor;
- [ ] O08-O23 completes;
- [ ] exact terminal slot count = 24;
- [ ] final checkpoint/cursor consistency verifier PASS;
- [ ] final Evidence/Twin DB isolation verifier PASS in integrated topology;
- [ ] no Twin provider requests;
- [ ] no Twin raw-storage credentials;
- [ ] fresh LEGACY_AM19_PERSISTENT_24T requalification valid;
- [ ] Phase5 durable evidence registered only after final dependency state;
- [ ] central blocker_count = 0;
- [ ] no unknown_changed_paths;
- [ ] EA5E2 graph PASS at final exact head;
- [ ] ordinary CI PASS;
- [ ] Phase6 remains unstarted during Phase5 qualification;
- [ ] Formal-v5 remains unarmed.

Only then discuss Phase5 closure.

---

## D21. Current not-blockers

Do not spend the next conversation reopening these unless new evidence points back to them:

```text
Phase3 work_item_factory default identity
Phase3 Evidence lease/fencing/cursor
Phase4 database clock default
Phase4 scheduler lease/fencing
Phase5 process packaging
service-principal separation
Twin DB writer isolation
central exact-path registration
EA5E2 graph digest
scientific Runtime image
Docker fixture mount EBUSY
GFS raw retained-member accounting
NOMADS high-rate F070 302 cause
NOMADS 10s cadence timing
capture proof file ownership
real raw capture
Evidence canonical ingestion
A0/24-slot prepare
```

The active engineering problem is now much narrower:

```text
O00 canonical checkpoint
↔ checkpoint latest index
↔ RuntimeTickCursor
↔ Phase4 successor viability
```

---

## D22. Things not to do next

Do not:

1. wait for run `33096293529` as if it were still capturing — it has finished;
2. rerun capture repeatedly without addressing the O00 successor failure;
3. remove/relax `PHASE4_SUCCESSOR_CHECKPOINT_TIME_MISMATCH`;
4. skip successor viability in qualification;
5. force RuntimeTickCursor to O01;
6. update checkpoint latest index from workflow code;
7. create a qualification-only checkpoint adapter;
8. switch Twin back to direct `facts INSERT`;
9. restore broad Twin DB privileges;
10. give Twin S3/provider credentials;
11. remove NOMADS cadence to speed up 24T;
12. accept arbitrary 302 responses;
13. use fake GRIB;
14. revive #3319 hosting runtime;
15. split new Phase5 work into #3319;
16. mutate protected main;
17. register Phase5 durable evidence now;
18. rebind LEGACY_AM19 old evidence to a new digest;
19. start Phase6;
20. arm Formal-v5;
21. mix B-Line changes into this checkpoint repair.

---

## D23. Bottom line

The previous conversation frontier was:

```text
"production-equivalent 24T is still spending time in live GFS capture"
```

That is now stale.

The repository has moved to:

```text
a4026023 exact head
        +
real causal A0 soil/GFS capture SUCCESS
        +
same Evidence process graph SUCCESS
        +
canonical Evidence DB SUCCESS
        +
A0 / O00-O23 prepare SUCCESS
        +
O00 terminal slot recorded
        ↓
Phase4 read-only successor viability detects:
PHASE4_SUCCESSOR_CHECKPOINT_TIME_MISMATCH
        ↓
O01 not entered
restart not entered
O08-O23 not entered
final verifier not entered
        ↓
Phase5 remains IN PROGRESS
```

The next engineer should therefore **not** return to provider cadence or container packaging first.

The next exact task is:

```text
reproduce O00
        ↓
read exact persisted checkpoint/index/cursor/terminal values
        ↓
identify whether the checkpoint write, latest-index projection,
canonical record shape, or successor readback expectation is wrong
        ↓
repair the semantic owner without weakening the invariant
        ↓
fresh affected predecessor qualification
        ↓
one new frozen exact-head full 24T
        ↓
only after SUCCESS: fresh LEGACY_AM19 + Phase5 durable evidence
        ↓
central blocker_count = 0
        ↓
then discuss Phase5 closure
```

There is no deadlock.

There is a bounded, newly exposed integrated Runtime consistency defect after the first real O00 terminal commit.

---

# Historical continuation retained below — previous 2026-08-27 Phase 5 packaging / accelerated-provider frontier

# GEOX MCFT-CAP-09 Conversation Handoff — 2026-08-27 — Phase 5 Production-Equivalent Containers / Accelerated Evidence Provider Frontier

Status: **CONVERSATION HANDOFF / CURRENT FRONTIER — NOT MASTER-TASK AUTHORITY**

Timestamp: **2026-08-27 18:36 +08:00**

Repository: liyongshang44-max/GEOX

Purpose: hand off the exact MCFT-CAP-09 production-hosting migration frontier after Phase 2, Phase 3, and Phase 4 were machine-closed as stacked predecessors and Phase 5 was opened. This continuation records the Phase 3 Evidence Runtime authority/fencing/cursor repairs, the Phase 4 Twin Runtime host/DB-clock/restart/ACL/successor closure, the first Phase 5 production process and service-principal packaging, the current accelerated Evidence provider boundary, the still-open central applicability registration for Phase 5, the exact work that remains before an accelerated 24T can be called production-equivalent, and the failure modes that must not be reintroduced.

> This section supersedes the earlier Phase 2-only top-level state in this same 2026-08-27 handoff.
>
> The original Phase 2 continuation is intentionally preserved in full below as a historical snapshot. Do not delete it: it explains how the current production-hosting lineage was reached.
>
> The 2026-08-26 handoff remains the historical record of the initial Phase 2 takeover state.
>
> This handoff does **not** supersede docs/SSOT.md, the MCFT Master Task Line, the CAP-09 taskbook, accepted CAP-01→08 predecessor authority, immutable Formal evidence, the qualification control plane, or the frozen production-hosting architecture route.

---

## C0. READ THIS FIRST — current authority reconstruction order

Before changing MCFT-CAP-09 runtime, workflow, schema, database, provider, scheduler, container packaging, production ownership, Formal, Graduation, or qualification-control-plane logic, restore authority in this order:

1. docs/SSOT.md and repository-level frozen authority;
2. the digital-twin master task line / total task book;
3. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md;
4. accepted CAP-01→08 predecessor evidence;
5. immutable Formal-v4 NO-GO / later accepted successor evidence;
6. qualification-control-plane authorities and durable evidence registry;
7. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md;
8. Phase 2 closure c3346768a44b16b127378cb690ada1d8cfec1049;
9. Phase 3 closure 0e874b254c695b32fd94c7dc7034fd71b8aa3bc3;
10. Phase 4 closure 16ff7160473c0a25dc059db6b2b6b7ba07f54dd1;
11. this handoff for the current Phase 5 conversation frontier;
12. current exact-head GitHub Actions evidence for PR #3323.

Do not infer current authority from branch names, PR titles, or an old green run alone. Exact SHA + exact dependency set + exact workflow evidence remain the governing unit.

### C0.1 Frozen architecture that still governs everything

The mandatory route remains:

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md

Frozen topology:

~~~text
External Providers
        ↓
Evidence Runtime / Live Evidence Plane
        ↓
governed database Evidence
        ↓
Twin Runtime Plane
        ↓
canonical Twin state / Forecast / Scenario / checkpoint
~~~

Evidence Runtime and Twin Runtime are separate production roles.

GitHub Actions remains:

~~~text
CI
qualification
deployment
independent audit
~~~

GitHub Actions must **not** remain the routine production provider clock, Twin tick scheduler, or production cadence owner after Phase 6.

### C0.2 Do not mix the three numbering systems

Capability line:

~~~text
MCFT-CAP-01 → MCFT-CAP-09
~~~

Qualification-control-plane line:

~~~text
CP-0 → CP-5
~~~

Production-hosting migration line:

~~~text
Phase 0
Phase 0A
Phase 1
Phase 2
Phase 3
Phase 4
Phase 5
Phase 6
Phase 7
~~~

There is no frozen CP-6.

Production-hosting Phase 6 means ownership cutover, not a new qualification-control-plane phase.

### C0.3 B-Line is a separate engineering line

A separate B-Line is being developed in parallel by another owner.

Hard rule:

~~~text
MCFT-9 production-hosting line != B-Line semantic-convergence line
~~~

This MCFT-9 continuation must not:

- merge B-Line work into this stack;
- mutate B-Line branches or PRs;
- use B-Line completion as a substitute for MCFT-9 qualification;
- let Phase 5 container work become a semantic-convergence refactor.

The two lines may be integrated only later under an explicit integration decision after MCFT-9 finishes its frozen migration scope.

---

## C1. Current task in one sentence

**Continue Production Hosting Phase 5 by building a production-equivalent two-service accelerated qualification around the already machine-closed Phase 3 Evidence Runtime and Phase 4 Twin Runtime, using the same production host/canonicalizer/persistence/lease/cursor/runner paths and substituting only the explicitly frozen test-provider boundary and waiting clock, without starting Phase 6 ownership cutover or Phase 7 Formal-v5.**

---

## C2. Exact current repository / branch / PR state

### C2.1 Protected main

Protected main is still exactly:

26c1383f7f45abb76c99e28ec3d06714e85d1b2c

It has not been moved by the Phase 2, Phase 3, Phase 4, Phase 5, or handoff work described here.

Do not merge stacked production-hosting PRs merely to simplify development.

### C2.2 Phase 2 closure

Draft PR #3299:

refactor(mcft-cap09): phase2a extract production Evidence provider seams

Branch:

feat/mcft-cap09-phase2-evidence-production-modules-v1

Base:

8943c752a354cb916cc7f144681203aa9a19f70b

Exact Phase 2 closure head:

c3346768a44b16b127378cb690ada1d8cfec1049

Current repository facts at handoff:

~~~text
state      = open
Draft      = true
merged     = false
commits    = 74
files      = 28
additions  = 4319
deletions  = 368
~~~

Important closure evidence on c3346768…:

- ordinary ci run 33032685968 = SUCCESS;
- central qualification-control-plane run 33032685846 = SUCCESS;
- EA5E2 runtime dependency graph run 33032685856 = SUCCESS;
- successor runner run 33032685892 = SUCCESS;
- EA5C2B1 KBS soil successor run 33032685984 = SUCCESS.

Phase 2 is a historical closed predecessor for the current stack.

### C2.3 Phase 3 closure

Draft PR #3308:

feat(mcft-cap09): phase3 durable Evidence Runtime foundation

Base:

c3346768a44b16b127378cb690ada1d8cfec1049

Exact Phase 3 closure head:

0e874b254c695b32fd94c7dc7034fd71b8aa3bc3

Repository facts:

~~~text
state      = open
Draft      = true
merged     = false
commits    = 73
files      = 34
additions  = 6111
deletions  = 296
~~~

Important exact-head evidence:

- Phase3 Evidence Runtime persistence run 33039951199 = SUCCESS;
- qualification control plane run 33039951208 = SUCCESS;
- EA5E2 graph run 33039951186 = SUCCESS;
- successor runner run 33039951242 = SUCCESS;
- AM19 persistent 24T compatibility run 33039951169 = SUCCESS;
- EA5C2B1 successor run 33039951185 = SUCCESS.

The generic ci run on that exact head was not the final production-hosting closure criterion because it exposed a migration-order integration defect later repaired in Phase 4. That defect is recorded below and must not be forgotten.

Phase 3 is treated by the current stacked route as the machine-closed Evidence Runtime predecessor.

### C2.4 Phase 4 closure

Draft PR #3315:

feat(mcft-cap09): build Phase4 Twin Runtime persistence

Branch:

feat/mcft-cap09-phase4-twin-runtime-persistence-v1

Base:

0e874b254c695b32fd94c7dc7034fd71b8aa3bc3

Exact Phase 4 closure head:

16ff7160473c0a25dc059db6b2b6b7ba07f54dd1

Repository facts:

~~~text
state      = open
Draft      = true
merged     = false
commits    = 39
files      = 15
additions  = 2708
deletions  = 11
~~~

Exact-head closure runs:

- ordinary ci run 33048911663 = SUCCESS;
- Phase4 Twin Runtime persistence run 33048911787 = SUCCESS;
- central qualification-control-plane run 33048911662 = SUCCESS;
- EA5E2 graph run 33048911804 = SUCCESS;
- successor runner run 33048911766 = SUCCESS.

Central proved at closure:

~~~text
blocker_count = 0
unknown_changed_paths = []
~~~

Phase 4 is frozen. Do not append new Phase 5 code to #3315.

### C2.5 Current Phase 5 implementation PR

Draft PR #3323:

feat(mcft-cap09): build Phase5 production-equivalent containers

Branch:

feat/mcft-cap09-phase5-production-equivalent-containers-v1

Exact base:

16ff7160473c0a25dc059db6b2b6b7ba07f54dd1

Current exact head at this handoff:

8671ac74873d2312ee170870bc737927502a9206

Repository facts:

~~~text
state      = open
Draft      = true
merged     = false
commits    = 14
files      = 9
additions  = 1827
deletions  = 2
~~~

Current changed files are only the first-layer Phase 5 packaging / principal boundary:

- .github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml
- apps/server/scripts/write_dist_entries.cjs
- apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts
- apps/server/src/infra/mcft_cap09_phase5_service_principal_bootstrap_v1.ts
- apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts
- apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts
- apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts
- scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts
- scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_SERVICE_PRINCIPALS_V1.ts

This exact changed-file list is important because the planned Phase 3 composition seam described later is **not yet committed** at this handoff.

### C2.6 Current conversation handoff PR

Docs-only Draft PR #3298 remains:

docs(mcft-cap09): hand off Phase 2 KBS/graph frontier

Branch:

docs/mcft-cap09-handoff-2026-08-26-phase2-evidence-module-frontier

Base:

26c1383f7f45abb76c99e28ec3d06714e85d1b2c

Before this update its head was:

29b82bc9b7a63490e3646e5bb28eeb56b649d952

The handoff remains docs-only and must not perturb any implementation dependency graph.

---

## C3. Current production-hosting phase map

~~~text
CP-5 qualification control plane                    HISTORICAL CLOSED
        ↓
Phase 1 typed Runtime composition                   HISTORICAL CLOSED
        ↓
Phase 2 production Evidence productization          MACHINE CLOSED
        exact = c3346768…
        ↓
Phase 3 durable Evidence Runtime                    MACHINE CLOSED
        exact = 0e874b25…
        ↓
Phase 4 durable Twin Runtime                        MACHINE CLOSED
        exact = 16ff7160…
        ↓
Phase 5 production-equivalent two-service 24T       IN PROGRESS  ← CURRENT
        exact current head = 8671ac74…
        ↓
Phase 6 production ownership cutover                NOT STARTED / FORBIDDEN NOW
        ↓
Phase 7 fresh Formal-v5                             NOT ARMED
~~~

MCFT-CAP-09 remains:

~~~text
IN PROGRESS
NOT COMPLETE
NOT GRADUATED
PHASE5 NOT CLOSED
PHASE6 NOT STARTED
FORMAL-V5 NOT ARMED
PROTECTED MAIN UNCHANGED
~~~

---

## C4. Phase 3 — what was actually fixed and why it matters to Phase 5

Phase 3 was not just “add a durable cursor”. Several authority defects were found during audit and had to be corrected before Evidence Runtime could be trusted as a production predecessor.

### C4.1 DB Evidence writer authority was repaired

The Evidence Runtime database role must not have arbitrary INSERT authority over public.facts.

The repaired design is:

~~~text
Evidence Runtime role
        ↓
no direct arbitrary facts INSERT
        ↓
governed SECURITY DEFINER Evidence append boundary
        ↓
record-type / scope / fence checks
        ↓
External Evidence canonical fact only
~~~

Machine qualification proved:

- direct arbitrary INSERT facts is denied;
- Twin canonical facts cannot be manufactured through the Evidence writer;
- Evidence role cannot mutate Twin runtime state;
- facts UPDATE / DELETE remain denied on the Evidence plane.

This is a hard production boundary. Do not re-grant broad facts write authority for convenience in Phase 5 containers.

### C4.2 Fencing was moved to the governed COMMIT boundary

The original weakness was that stale Evidence ownership could be noticed only when advancing EvidenceSupplyCursor.

That was insufficient: a stale owner could theoretically have written canonical Evidence before the cursor failed.

The repair bound governed ingress to the current EvidenceProducerLeaseClaim and rechecked lease owner / fencing token / expiry inside the database write transaction.

Required invariant:

~~~text
stale Evidence owner
        ↓
must fail before canonical fact insert / COMMIT
        ↓
stale canonical fact count = 0
~~~

Phase 5 duplicate Evidence-container qualification must preserve this exact property.

### C4.3 EvidenceSupplyCursor became a two-axis durable model

The earlier single watermark mixed two different concepts:

1. when a publication became available to Runtime;
2. whether observation/event-time data is continuous.

That is wrong for real KBS publication behavior.

Phase 3 split them.

Publication axis:

~~~text
publication_available_through
~~~

Event-time axis:

~~~text
event_time_contiguous_from
event_time_contiguous_through
event_time_max_seen
event_gap_count
~~~

A durable per-event ledger was added to support:

- KBS daily batch;
- true hourly publication;
- outage / gap;
- late backfill;
- same-event governed revision;
- publication order different from event-time order.

Do not collapse this back into a single “latest timestamp”.

### C4.4 Generic cadence/profile qualification was added

At minimum, three supply models are now machine-qualified:

~~~text
KBS daily batch
true hourly
hourly outage + backfill + revision
~~~

For KBS daily batch, many hourly event records may share the same publication timestamp.

Therefore:

~~~text
same publication timestamp != duplicate event
daily batch != hourly publication
~~~

This directly constrains the Phase 5 accelerated provider adapter.

### C4.5 Central applicability reached unknown_changed_paths = 0

Phase 3 explicitly repaired the central resolver rather than hiding unknown paths with broad wildcards.

The correct pattern remains:

~~~text
new production dependency
        ↓
exact resolver ownership
        ↓
machine applicability plan
        ↓
unknown_changed_paths = 0
~~~

Do not silence central by broad directory wildcarding.

### C4.6 Phase 3 migration exposed a generic ordering bug later

Phase 3 introduced same-day persistence and ACL migrations.

The generic migration runner sorted files lexically, which caused:

~~~text
..._acl.sql
before
..._persistence.sql
~~~

in ordinary commercial bootstrap.

The Phase 3 focused workflow did not reveal the defect because it manually applied persistence before ACL.

Phase 4 repaired the generic migration ordering rule:

~~~text
same date:
schema/data migrations
        ↓
ACL migration
~~~

This is a major lesson: a focused qualification workflow can accidentally mask production bootstrap ordering.

Phase 5 must continue to run the full database-platform bootstrap, not only hand-picked migrations.

---

## C5. Phase 4 — machine-closed Twin Runtime foundation

Phase 4 converted the already-qualified canonical Runtime graph into a long-running production-hostable Twin Runtime without creating a second execution algorithm.

### C5.1 Long-running Twin Runtime host

Product host:

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.ts

Hard design:

~~~text
long-running process lifecycle
        ↓
PostgreSQL transaction-time clock
        ↓
existing ExternalFormalV3Amendment19RunnerV1.executeOneDueSlot()
        ↓
existing canonical tick / persistence graph
~~~

The host does not implement a simplified Twin algorithm.

### C5.2 Product composition was lifted out of acceptance-only wiring

Product composition:

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts

It reuses:

- PostgresPersistentSequentialSchedulerAdapterV1;
- PostgresExternalFormalAmendment19EvidenceSourceV1;
- PostgresNextTickRepositoryV1;
- PostgresRuntimeRepositoryV1;
- PostgresForecastScenarioRecoveryRepositoryV1;
- ExternalFormalV3Amendment19PersistentTickServiceV1;
- ExternalFormalV3Amendment19RunnerV1;
- materializeExternalFormalA18CropContextV3.

The rule established here is critical for Phase 5:

**qualification and production packaging must instantiate this same graph, not a test-only runner.**

### C5.3 Database clock is the Runtime time authority

Phase 4 added:

PostgresTwinRuntimeDatabaseClockV1

Clock source:

~~~sql
SELECT transaction_timestamp() AS database_now
~~~

This avoids:

~~~text
Node wall-clock authority
GitHub workflow clock authority
container local-clock authority
~~~

for governed scheduler decisions.

### C5.4 Durable RuntimeTickCursor and scheduler fencing were requalified

Real PostgreSQL qualification proved:

- oldest-due-first;
- future-slot rejection;
- same-owner idempotent claim;
- duplicate owner rejection;
- expired active slot recovery;
- monotonic fencing-token advance;
- stale fence rejection;
- process restart reads durable cursor;
- bounded O00→O03 catch-up;
- no scheduler-only canonical fact write.

### C5.5 Twin Runtime database ACL was separated from Evidence plane

Independent privilege role:

geox_mcft_cap09_twin_runtime_v1

It may use only the governed Runtime/Twin/Forecast/Scenario persistence surface it actually needs.

It is explicitly denied direct mutation of:

~~~text
external_evidence_producer_lease_v1
external_evidence_supply_event_v1
external_evidence_supply_cursor_v1
~~~

It reads governed Evidence through public.facts.

This separation must remain true when Phase 5 introduces real LOGIN service principals.

### C5.6 Read-only successor viability replaced old forcing-target control semantics

The old V13 successor-viability path could mutate autonomous forcing-target control state.

That was rejected for Phase 4 because it would reintroduce Evidence/forcing ownership into the Twin Runtime plane.

Phase 4 instead added read-only successor viability:

apps/server/src/runtime/twin_runtime/postgres_twin_runtime_successor_viability_v1.ts

It proves after a terminal tick:

~~~text
terminal scheduler row exists
RuntimeTickCursor last_terminal matches
RuntimeTickCursor next slot matches
canonical checkpoint next_tick_logical_time matches
active slot count = 0
~~~

O23 is allowed only as range complete.

It does not fetch providers and does not mutate EvidenceSupplyCursor or forcing target state.

### C5.7 Phase 4 central closure

Exact closure:

16ff7160473c0a25dc059db6b2b6b7ba07f54dd1

Machine result:

~~~text
blocker_count = 0
unknown_changed_paths = []
~~~

Phase 4 durable evidence, DB-clock scheduler, restart/fencing, successor viability, Twin ACL, ordinary CI, graph, and successor qualification are all closed at that exact predecessor.

Do not reopen Phase 4 merely because Phase 5 needs qualification seams. If Phase 5 must change a Phase 3 or Phase 4 source file, treat that as an explicit predecessor dependency change and requalify the affected predecessor.

---

## C6. Phase 5 — frozen purpose and allowed substitution

Frozen Phase 5 route:

~~~text
Evidence Runtime
       ↓
governed database Evidence
       ↓
Twin Runtime
       ↓
canonical persisted Twin state / Forecast / Scenario / checkpoint
~~~

The accelerated clock substitutes **waiting only**.

Phase 5 must test at least:

~~~text
normal progression
restart of Evidence Runtime
restart of Twin Runtime
duplicate Evidence containers with fencing
duplicate Twin containers with fencing
DB reconnect
idempotent retry
missing Evidence backpressure
no provider fallback from Twin Runtime
no Twin-state mutation from Evidence Runtime
checkpoint recovery
cursor independence
post-COMMIT visibility
owner uniqueness
~~~

The system under qualification must remain production-equivalent except at explicitly permitted test boundaries.

### C6.1 What may be substituted

The frozen route allows an explicit test provider-adapter boundary for accelerated qualification.

That means a controlled qualification provider may replace:

~~~text
real external network/provider availability
~~~

It must **not** replace:

~~~text
Evidence Runtime host
Evidence cycle service
raw retention
canonicalizer
governed fenced DB COMMIT
post-COMMIT visibility
EvidenceSupplyCursor
Evidence lease/fencing
Twin Runtime host
canonical Twin runner
Runtime scheduler
RuntimeTickCursor
checkpoint
Twin persistence
service DB principals
~~~

This distinction is now the central Phase 5 engineering rule.

---

## C7. Phase 5 first-layer production packaging — completed

The first layer of Phase 5 is real product packaging, not the final two-container 24T yet.

### C7.1 Shared production process lifecycle

Product file:

apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts

It provides shared:

- SIGTERM / SIGINT handling;
- wait / backoff;
- health lifecycle;
- failure classification.

This lifecycle belongs to product code, not scripts/runtime_acceptance.

### C7.2 Twin Runtime production process

Product file:

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts

It directly composes the Phase 4 canonical Twin Runtime composition.

Required process authority includes:

~~~text
GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL
Twin-specific DB principal assertion
Phase4 composeMcftCap09TwinRuntimeV1
shared lifecycle
~~~

It must not acquire Evidence provider credentials.

### C7.3 Stable compiled Twin Runtime entrypoint

Production build now writes a stable compiled entry:

apps/server/dist/runtime/mcft_cap09_twin_runtime.js

Phase 5 workflow proves it exists and contains the Twin production process entry without importing acceptance scripts.

### C7.4 Evidence Runtime production process factory

Product file:

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts

It directly composes the Phase 3 Evidence Runtime composition.

Required process authority includes:

~~~text
GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL
Evidence-specific S3 credentials
Phase3 composeEvidenceRuntimeV1
target planner
shared lifecycle
~~~

Twin Runtime must not receive those S3 credentials.

### C7.5 Evidence and Twin use different DB URLs

Phase 5 does not rely on a single all-powerful runtime login.

The two process contracts use separate database URLs.

This is intentional even though both ultimately target the same PostgreSQL database.

### C7.6 Independent PostgreSQL LOGIN principals

Two LOGIN principals now exist:

~~~text
geox_mcft_cap09_evidence_runtime_login_v1
geox_mcft_cap09_twin_runtime_login_v1
~~~

They are not the privilege roles themselves.

Membership model:

~~~text
Evidence LOGIN
        ↓
inherits only geox_mcft_cap09_evidence_runtime_v1

Twin LOGIN
        ↓
inherits only geox_mcft_cap09_twin_runtime_v1
~~~

Cross-plane membership is forbidden.

The service principal bootstrap and runtime startup both verify expected identity.

### C7.7 Phase 5 process/principal qualification is already green

The first key Phase 5 run:

33060881394

completed SUCCESS.

At the latest exact head 8671ac74…, Phase 5 process-packaging run:

33061092188

also completed SUCCESS.

Those runs prove:

- TypeScript;
- production build;
- production PostgreSQL init chain;
- exact database-platform bootstrap + full migration inventory;
- service-principal provisioning;
- real Evidence/Twin login;
- cross-plane DB privilege denial;
- stable compiled Twin entrypoint;
- process authority boundaries.

This is **not** proof that Phase 5 as a whole is complete.

---

## C8. Current exact-head CI nuance — Phase 5 is green but central registration is not closed

At current head:

8671ac74873d2312ee170870bc737927502a9206

important observed runs include:

- Phase5 production-equivalent process-packaging run 33061092188 = SUCCESS;
- ordinary ci = SUCCESS;
- EA5E2 successor runner = SUCCESS;
- EA5E2 runtime dependency graph run 33061092176 = FAILURE.

The graph failure happens before full graph qualification:

~~~text
Generate central applicability plan = FAILURE
Route EA5E2 from central planner = not reached
full graph qualification = not reached
~~~

Current central plan reports these Phase 5 paths as unknown:

- .github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml
- apps/server/scripts/write_dist_entries.cjs
- apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts
- apps/server/src/infra/mcft_cap09_phase5_service_principal_bootstrap_v1.ts
- apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts
- apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts
- apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts
- scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts
- scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_SERVICE_PRINCIPALS_V1.ts

At that failure:

~~~text
authority_errors = []
resolver_errors  = []
~~~

Therefore this red lane is a bounded central-applicability ownership gap, not evidence that the process packaging itself failed.

Do not rebind the EA5E2 graph digest before central ownership is repaired and the graph generator actually runs.

---

## C9. Current critical Phase 5 frontier — accelerated Evidence provider boundary

This is the most important unfinished engineering point.

### C9.1 Why a tiny fake GFS payload is not acceptable

The product GFS scientific decoder expects the real product scientific geometry / data contract.

The current product SFLUX path expects native regular_gg N=768 scale, including the real point-count contract.

Therefore it is not legitimate to create a tiny fake GRIB merely to make Phase 5 run quickly.

That would prove:

~~~text
test-only decoder path
~~~

not:

~~~text
future production decoder / canonical Evidence path
~~~

The Phase 5 qualification must not “measure another implementation”.

### C9.2 The correct permitted seam

The converged design is to add an injectable work-item factory seam to:

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_composition_v1.ts

Target API concept:

~~~text
composeEvidenceRuntimeV1(...)
        ↓
optional work_item_factory injection
~~~

Default production behavior must remain:

~~~text
ProductionEvidenceWorkItemFactoryV1
~~~

Only Phase 5 qualification supplies a controlled provider work-item factory.

### C9.3 What the qualification seam must not bypass

After the controlled provider work item enters the Evidence Runtime, the remainder must still be the exact production graph:

~~~text
Evidence Runtime host
        ↓
cycle
        ↓
raw retention
        ↓
canonicalizer
        ↓
fenced governed COMMIT
        ↓
post-COMMIT database visibility
        ↓
EvidenceSupplyCursor
~~~

No Phase 5 qualification adapter may write public.facts directly.

No Phase 5 qualification adapter may advance EvidenceSupplyCursor directly.

No Phase 5 qualification adapter may bypass raw retention.

No Phase 5 qualification adapter may manufacture Twin state.

### C9.4 Current implementation status of this seam

**Not yet committed at this handoff.**

Evidence:

the current #3323 changed-file list does not include:

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_composition_v1.ts

Therefore the next engineer must not assume the work-item seam already exists.

The design is agreed; implementation and requalification remain.

### C9.5 Phase 3 must be freshly requalified after the seam lands

This is non-negotiable.

The seam changes a Phase 3 composition source.

Even if the default remains ProductionEvidenceWorkItemFactoryV1, the dependency subject changed.

Therefore:

~~~text
modify Phase3 composition
        ↓
fresh Phase3 exact-head requalification
        ↓
do not carry old Phase3 durable evidence blindly
~~~

The qualification must prove:

- default production composition still instantiates ProductionEvidenceWorkItemFactoryV1;
- only the explicit Phase 5 qualification path injects the controlled factory;
- no host / canonicalizer / DB / retention / lease / cursor path changes;
- product process still uses the default production behavior unless explicitly configured for qualification.

---

## C10. Phase 5 work that remains

Do not say “Phase 5 complete” until these are closed at one governed exact head.

### C10.1 Central applicability registration

Register all Phase 5 product / workflow / acceptance paths in the qualification control plane.

Goal:

~~~text
unknown_changed_paths = []
authority_errors = []
resolver_errors = []
~~~

Prefer a bounded Phase 5 resolver or import closure. Do not use a broad wildcard to hide future dependencies.

### C10.2 Implement the Evidence work-item factory seam

Modify the Phase 3 Evidence composition with an optional injected factory.

Default must remain ProductionEvidenceWorkItemFactoryV1.

Add focused proof for default identity.

### C10.3 Fresh Phase 3 requalification

Because Phase 3 composition changes, rerun the exact Phase 3 qualification set and regenerate durable evidence only after the dependency set stabilizes.

Do not register durable evidence early.

### C10.4 Controlled qualification provider adapter

Build a controlled provider boundary that can deterministically produce the provider work items required for accelerated Phase 5.

It must replace only the external provider boundary.

It must not replace scientific/canonical persistence semantics that are supposed to be production-owned.

### C10.5 Evidence qualification process entrypoint

Add a qualification entrypoint that launches the real Evidence process/composition with the controlled work-item factory.

Keep the production entrypoint/default untouched.

### C10.6 Dedicated Phase 5 qualification Compose

Build a dedicated qualification topology, not an accidental production cutover.

Expected roles:

~~~text
PostgreSQL
Evidence Runtime container A
optional duplicate Evidence Runtime container B
Twin Runtime container A
optional duplicate Twin Runtime container B
controlled provider adapter / fixture boundary
qualification clock/control harness
~~~

Do not mutate docker-compose.commercial_v1.yml into the production owner merely to run this test.

### C10.7 Duplicate Evidence-container fencing

Prove:

~~~text
two Evidence containers
        ↓
one valid producer owner
        ↓
stale/losing owner rejected before canonical COMMIT
        ↓
no duplicate canonical Evidence
        ↓
no duplicate cursor advance
~~~

### C10.8 Evidence Runtime restart

Prove restart using durable:

~~~text
Evidence producer lease / fencing
Evidence event ledger
EvidenceSupplyCursor
canonical facts
raw retention references
~~~

Restart must not rely on in-memory target history.

### C10.9 Duplicate Twin-container fencing

Prove two Twin Runtime containers cannot both own the same governed Runtime slot.

Use the existing Phase 4 database-clock lease/fencing path.

Do not implement a container-level mutex that bypasses the database authority.

### C10.10 Twin Runtime restart

Prove restart reconstructs from:

~~~text
RuntimeTickCursor
canonical checkpoint
scheduler slot ledger
canonical persisted Twin / Forecast / Scenario state
~~~

No provider fallback is allowed.

### C10.11 DB reconnect and idempotent retry

Prove both services recover safely from a transient PostgreSQL reconnect.

Important distinctions:

~~~text
retry transport/process failure
!=
repeat semantic write
~~~

Idempotency/fencing must determine whether a write is new, repeated, stale, or conflicting.

### C10.12 Missing Evidence backpressure

When Evidence is unavailable or not yet eligible:

~~~text
Twin Runtime
        ↓
NOT_READY_PRECLAIM / backpressure
        ↓
no provider fallback
        ↓
no guessed evidence
        ↓
no cursor corruption
~~~

### C10.13 Cursor independence

Prove simultaneously:

~~~text
EvidenceSupplyCursor
!=
RuntimeTickCursor
~~~

Evidence publication progress must not be inferred from Twin progress.

Twin tick progress must not mutate Evidence supply state.

### C10.14 Post-COMMIT visibility in the two-service topology

Evidence must become consumable by Twin only after:

~~~text
fenced canonical COMMIT
        ↓
fresh DB readback
        ↓
exact identity verification
        ↓
EvidenceSupplyCursor advancement
~~~

The container topology must not weaken this ordering.

### C10.15 Accelerated full 24T

Only after all previous subproofs stabilize, execute the production-equivalent accelerated O00→O23.

The accelerated clock may replace waiting.

It must not replace:

~~~text
schema
runtime config chain
persistent repositories
scheduler
lease/fencing
host
runner
health
checkpoint
canonical state propagation
forecast
Evidence ingress
Evidence/Twin service separation
~~~

### C10.16 Final Phase 5 exact-head closure

At one final exact head, require:

- Phase5 dedicated qualification workflow PASS;
- ordinary ci PASS;
- central control plane PASS;
- unknown_changed_paths = 0;
- EA5E2 graph PASS;
- successor runner PASS;
- affected Phase3 fresh requalification PASS;
- all duplicate/restart/backpressure/reconnect scenarios PASS;
- accelerated 24T PASS;
- durable Phase5 evidence registered only after dependency state is final;
- no Phase6 ownership cutover;
- no Formal-v5 arm.

---

## C11. Phase 6 and Phase 7 remain out of scope

### C11.1 Phase 6 — not started

Phase 6 is the actual ownership cutover.

Only after Phase 5 production-equivalent qualification closes may the project consider:

~~~text
GitHub routine Evidence acquisition owner → removed
GitHub routine Twin wake/tick owner → removed
long-running service ownership → enabled
deployment / audit workflows remain
~~~

At this handoff:

**Phase 6 has not started.**

Do not delete, disable, or rewrite current routine GitHub ownership paths yet.

### C11.2 Phase 7 / Formal-v5 — not armed

Formal-v5 remains forbidden until the frozen production-hosting prerequisites close.

Do not interpret a green accelerated 24T as Formal qualification.

Do not mutate Graduation.

---

## C12. Failure / repair history — high-value lessons that must survive the conversation

### C12.1 Never test a different implementation just because it is easier to accelerate

This is the most important Phase 5 rule.

Bad pattern:

~~~text
engineering lane
    uses simplified runner / fake decoder
production lane
    uses canonical core / real decoder
~~~

That can yield:

~~~text
engineering PASS
production FAIL
~~~

Phase 5 must share the same canonical production graph.

### C12.2 A fake tiny GFS GRIB is not a valid substitute for the product decoder

If the product decoder requires the native scientific geometry, do not weaken it for qualification.

Use the explicitly permitted provider-adapter seam instead.

### C12.3 Accelerated clock substitutes waiting only

Do not use acceleration to replace:

- scheduler semantics;
- lease expiry semantics;
- persistence;
- checkpoint;
- DB readback;
- canonical processing;
- container ownership;
- Evidence/Twin separation.

### C12.4 Do not give both services one broad database login

The two LOGIN principals are part of the production-equivalence claim.

Do not regress to:

~~~text
one postgres superuser URL for both containers
~~~

because it makes cross-plane ACL proofs meaningless.

### C12.5 Evidence S3 credentials belong only to Evidence Runtime

Twin Runtime must not receive raw-provider / S3 acquisition credentials.

If Twin needs raw-object access to continue, the architecture has regressed.

### C12.6 Twin Runtime must never use provider fallback

The correct missing-Evidence behavior is backpressure / fail-closed.

Never “make the 24T pass” by letting Twin call the provider.

### C12.7 Stale Evidence owner must fail before COMMIT

Cursor failure after a stale canonical write is too late.

Keep the Phase 3 DB fence at the governed canonical write boundary.

### C12.8 Do not collapse publication cadence into event-time cadence

KBS is a daily batch of many hourly events.

Publication availability and event continuity are separate axes.

Do not reintroduce:

~~~text
authority_pass = age <= N hours
~~~

as a universal Evidence admission rule.

### C12.9 Backfill and revision are not the same as duplicate publication

The durable event ledger distinguishes:

- exact idempotent republish;
- later availability update;
- backfill of a missing event;
- governed semantic revision at the same event time.

Keep those cases explicit.

### C12.10 Do not directly grant Evidence Runtime arbitrary INSERT facts

The SECURITY DEFINER governed writer exists because table-level arbitrary INSERT is too broad.

Phase 5 service LOGIN must inherit the privilege role, not bypass it.

### C12.11 Do not directly grant Twin Runtime Evidence-plane coordination rights

Twin consumes governed Evidence through facts.

It must not mutate:

- external_evidence_producer_lease_v1;
- external_evidence_supply_event_v1;
- external_evidence_supply_cursor_v1.

### C12.12 Same-day migration ACL ordering matters

The generic migration runner previously applied ACL before schema because of lexical ordering.

Keep:

~~~text
same-day schema/data
        ↓
same-day ACL
~~~

and continue testing full bootstrap.

### C12.13 Central unknown paths are supposed to fail closed

The current Phase 5 graph red is useful.

Do not hide the nine unknown Phase 5 paths with a broad wildcard.

Register them deliberately.

### C12.14 EA5E2 graph digest is not a magic constant

Correct order:

~~~text
stabilize dependency set
        ↓
central ownership PASS
        ↓
run graph generator
        ↓
inspect expected digest
        ↓
legal carrier rebind if required
~~~

Do not guess or precompute the digest before the full graph step is reached.

### C12.15 Strict lexical gates can be tripped by comments

Earlier phases hit false positives because comments contained forbidden tokens such as RuntimeTickCursor.

Do not weaken the gate.

Fix scanner-safe comments when the dependency is not real.

### C12.16 Historical gates must remain historical

Do not rewrite old EA5C2B1, AM19, Formal, or predecessor gates to accept a new Phase 5 candidate.

Use successor routing / fresh requalification.

### C12.17 Durable evidence must be registered late

Do not register a run before the dependency set is stable.

Any later source/path change can invalidate the digest and force a new exact-head run.

### C12.18 A green focused workflow does not equal stage closure

Phase 5 process-packaging is green.

Phase 5 is still incomplete because:

- central ownership is not closed;
- provider acceleration seam is not implemented;
- duplicate/restart scenarios are not closed;
- accelerated 24T is not run.

### C12.19 Do not turn commercial Compose into production owner during Phase 5 qualification

Phase 5 requires a dedicated production-equivalent qualification topology.

Actual ownership cutover belongs to Phase 6.

### C12.20 Do not mix the B-Line

B-Line is a parallel project line.

Do not “helpfully” resolve an MCFT-9 blocker by importing unintegrated B-Line semantics.

---

## C13. Recommended exact execution sequence from this handoff

### Step 1 — lock the current Phase 5 exact head

Verify:

~~~text
#3323 Draft = true
#3323 base = 16ff7160473c0a25dc059db6b2b6b7ba07f54dd1
#3323 head = expected current head
protected main = 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
~~~

If head changed, do not reuse the exact run assumptions below blindly.

### Step 2 — repair Phase 5 central applicability ownership

Register all current nine Phase 5 paths.

Rerun central applicability.

Target:

~~~text
unknown_changed_paths = []
~~~

Do this before graph digest work.

### Step 3 — implement the work_item_factory seam in Phase 3 composition

Keep default:

ProductionEvidenceWorkItemFactoryV1

Inject only in explicit qualification composition.

Add focused default-identity and injection-boundary tests.

### Step 4 — rerun fresh Phase 3 qualification

Because the Phase 3 composition source changed, obtain new exact-head Phase 3 evidence.

Do not carry the old Phase 3 run solely because behavior is intended to be identical.

### Step 5 — add controlled provider adapter / work-item factory

Make it deterministic and explicit.

Do not write canonical facts directly.

### Step 6 — add Evidence qualification entrypoint

Launch the same production Evidence host/process graph with only the provider work-item factory substituted.

### Step 7 — add dedicated qualification Compose

Keep commercial production ownership unchanged.

Use real service LOGIN principals.

### Step 8 — duplicate/restart/fencing matrix

Execute:

~~~text
duplicate Evidence
Evidence restart
duplicate Twin
Twin restart
DB reconnect
idempotent retry
missing Evidence
~~~

### Step 9 — accelerated O00→O23

Only after the topology and failure matrix are green.

### Step 10 — final central / graph / durable evidence closure

Run all required exact-head workflows.

Register durable evidence only at the stable final Phase 5 dependency set.

Then and only then evaluate opening Phase 6.

---

## C14. First 45 minutes for the next engineer

### Minute 0–5 — restore authority

Read:

- docs/SSOT.md;
- MCFT Master Task Line;
- docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md;
- frozen production-hosting route;
- this current section;
- the preserved historical Phase 2 snapshot below if a dependency history is unclear.

### Minute 5–10 — verify stacked SHAs

Confirm:

~~~text
main   = 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
Phase2 = c3346768a44b16b127378cb690ada1d8cfec1049
Phase3 = 0e874b254c695b32fd94c7dc7034fd71b8aa3bc3
Phase4 = 16ff7160473c0a25dc059db6b2b6b7ba07f54dd1
Phase5 base = 16ff7160…
~~~

### Minute 10–15 — inspect #3323 current changed files

If mcft_cap09_evidence_runtime_composition_v1.ts is now changed, the work-item seam has started and Phase 3 fresh requalification is mandatory.

If it is not changed, do not assume the seam exists.

### Minute 15–20 — inspect central red

Current known exact-head central red is unknown Phase 5 paths.

Check whether that is still true before making any graph change.

### Minute 20–30 — implement the smallest central ownership patch

Use an exact Phase 5 resolver / bounded import closure.

No wildcard.

Rerun central.

### Minute 30–45 — implement/inspect the qualification work-item seam

Verify:

~~~text
production default factory unchanged
qualification injection explicit
no direct facts write
no direct cursor write
raw retention preserved
canonicalizer preserved
fenced COMMIT preserved
post-COMMIT visibility preserved
~~~

---

## C15. High-value exact file map

### Frozen route / task authority

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md

### Central control plane

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json

scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs

.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml

### Phase 3 Evidence Runtime

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_composition_v1.ts

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_cycle_service_v1.ts

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_host_v1.ts

apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.ts

apps/server/src/external_evidence/mcft_cap09_evidence_supply_cadence_profile_v1.ts

apps/server/src/persistence/external_evidence/postgres_evidence_runtime_persistence_v1.ts

apps/server/src/persistence/external_evidence/postgres_evidence_runtime_governed_ingress_v1.ts

apps/server/db/migrations/2026_08_27_mcft_cap_09_phase3_evidence_runtime_persistence.sql

apps/server/db/migrations/2026_08_27_mcft_cap_09_phase3_evidence_runtime_acl.sql

### Phase 4 Twin Runtime

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.ts

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts

apps/server/src/runtime/twin_runtime/postgres_twin_runtime_successor_viability_v1.ts

apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts

apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.ts

apps/server/db/migrations/2026_08_27_mcft_cap_09_phase4_twin_runtime_acl.sql

.github/workflows/mcft-cap-09-phase4-twin-runtime-persistence.yml

### Phase 5 product packaging

apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts

apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts

apps/server/src/infra/mcft_cap09_phase5_service_principal_bootstrap_v1.ts

apps/server/scripts/write_dist_entries.cjs

.github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml

scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts

scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_SERVICE_PRINCIPALS_V1.ts

### EA5E2 graph

scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs

scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs

.github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml

---

## C16. Exact commits / runs worth preserving in the mental model

### Phase 2 closure

c3346768a44b16b127378cb690ada1d8cfec1049

### Phase 3 closure

0e874b254c695b32fd94c7dc7034fd71b8aa3bc3

Central:

33039951208 = SUCCESS

Phase3:

33039951199 = SUCCESS

### Phase 4 closure

16ff7160473c0a25dc059db6b2b6b7ba07f54dd1

Central:

33048911662 = SUCCESS

Phase4:

33048911787 = SUCCESS

Ordinary ci:

33048911663 = SUCCESS

### Phase 5 initial packaging commits

1c6d88d62b59998ec65897651f8b052c207c5546
feat(mcft-cap09): add production process lifecycle adapters

a65f0e610f3615b9d8f6c034c6c8855c85ff7157
feat(mcft-cap09): add Twin Runtime production process

d025f6dd4ac1ddca430c132760901e365294944d
build(mcft-cap09): package Twin Runtime entrypoint

158ab8cb7d171ae02c09ed410af37555287cf300
feat(mcft-cap09): add Evidence Runtime production process factory

e956cd4306f030d7abcc4771ef422735451bfdb3
test(mcft-cap09): qualify Phase5 process boundaries

89883b065e651cc64e12175d8bbf9757cc7bb407
ci(mcft-cap09): qualify Phase5 production process packaging

548633baba6f11eee23acc586198bec351cb844d
feat(mcft-cap09): add isolated service database principals

b34fcec573db272b55ac45c2da23ea3cb127a0ba
fix(mcft-cap09): harden service principal bootstrap SQL

c7d81ae84e359c74bf24d9e95347939930a279ee
fix(mcft-cap09): verify Twin Runtime database principal on startup

0627ecc41c0613b68c9950e1bf829b945020c62e
fix(mcft-cap09): verify Evidence Runtime database principal on startup

b9f7294ae403e6e4766735b8cd918ca308ede0d5
test(mcft-cap09): qualify isolated service database principals

d1741bbfc96d0855419b1b5cb084eab757b1d21a
ci(mcft-cap09): qualify isolated Phase5 service principals

5ae3a6acbfa2a5afb43fd997d865f1ae00ae4ede
feat(mcft-cap09): add service principal bootstrap entry

8671ac74873d2312ee170870bc737927502a9206
build(mcft-cap09): package Phase5 principal bootstrap

### Phase 5 key runs

33060881394 = Phase5 process-packaging SUCCESS

33061092188 = latest exact-head Phase5 process-packaging SUCCESS

33061092176 = EA5E2 graph FAILURE at central applicability plan because current Phase5 paths are unregistered

---

## C17. Exact non-effects that still hold

As of this handoff:

- protected main remains unchanged;
- #3299 remains Draft / unmerged;
- #3308 remains Draft / unmerged;
- #3315 remains Draft / unmerged;
- #3323 remains Draft / unmerged;
- B-Line is untouched;
- production commercial Compose is not the new owner;
- Phase 6 GitHub ownership cutover has not started;
- Formal-v5 is not armed;
- Graduation is not mutated;
- Evidence Runtime is not allowed to mutate Twin canonical state;
- Twin Runtime is not allowed to fetch provider/R2 fallback;
- Twin Runtime does not receive Evidence S3 credentials;
- Evidence and Twin service LOGIN principals remain separated;
- accelerated 24T has not yet been executed as the Phase 5 production-equivalent proof;
- Phase 5 is not complete;
- MCFT-CAP-09 is not complete.

---

## C18. Current blockers / not-blockers

### Current real blockers

1. Phase 5 paths are not yet centrally registered, so EA5E2 graph routing fails closed at the planner.
2. The controlled accelerated Evidence provider boundary is not yet implemented.
3. Phase 3 work-item factory seam is not yet committed.
4. Fresh Phase 3 requalification after that seam is still required.
5. Dedicated qualification Compose is not yet built.
6. duplicate Evidence / duplicate Twin fencing is not yet qualified.
7. Evidence restart / Twin restart is not yet qualified in the Phase 5 two-service topology.
8. DB reconnect / idempotent retry / missing Evidence backpressure is not yet qualified in that topology.
9. accelerated O00→O23 has not yet run.
10. final Phase 5 durable evidence / central closure is not yet registered.

### Not blockers / already solved

- Phase 2 provider productization;
- Phase 3 durable Evidence Runtime;
- Phase 3 DB writer authority;
- stale Evidence pre-COMMIT fencing;
- daily-batch-aware EvidenceSupplyCursor;
- Phase 4 long-running Twin Runtime host;
- DB-clock scheduler;
- RuntimeTickCursor persistence;
- Twin restart/fencing/checkpoint;
- read-only successor viability;
- Twin ACL;
- same-day migration ACL ordering;
- first-layer Phase 5 process packaging;
- separate Evidence/Twin service principals;
- stable compiled Twin entrypoint.

Do not reopen solved layers unless a new dependency change actually invalidates them.

---

## C19. Handoff bottom line

The project is no longer at the Phase 2 KBS/graph frontier preserved in the historical section below.

The exact current state is:

~~~text
Phase 2
production Evidence provider modules
machine closed at c3346768…
        ↓
Phase 3
durable Evidence Runtime
DB writer authority
pre-COMMIT fencing
two-axis EvidenceSupplyCursor
daily-batch / gap / backfill / revision qualification
machine closed at 0e874b25…
        ↓
Phase 4
long-running Twin Runtime
DB-clock scheduler
RuntimeTickCursor
restart / fencing / checkpoint
read-only successor viability
Twin ACL
machine closed at 16ff7160…
        ↓
Phase 5
production-equivalent containers
IN PROGRESS
current head 8671ac74…
        ↓
shared process lifecycle exists
Twin production process exists
Evidence production process exists
stable compiled Twin entry exists
separate DB URLs exist
independent Evidence/Twin LOGIN principals exist
cross-plane DB denial is machine-proved
Phase5 process-packaging is green
        ↓
BUT
central Phase5 path ownership is not closed
accelerated provider seam is not implemented
Phase3 composition seam is not committed
fresh Phase3 requalification remains
dedicated qualification Compose remains
duplicate/restart/reconnect/backpressure matrix remains
accelerated full 24T remains
        ↓
Phase5 remains IN PROGRESS
Phase6 ownership cutover NOT STARTED
Formal-v5 NOT ARMED
MCFT-CAP-09 NOT COMPLETE
~~~

The immediate next action is **not** to fake a small GFS product, not to start Phase 6, and not to modify commercial Compose into the production owner.

The immediate sequence is:

~~~text
register current Phase5 paths centrally
        ↓
central unknown_changed_paths = 0
        ↓
implement optional work_item_factory seam in Phase3 composition
production default remains ProductionEvidenceWorkItemFactoryV1
        ↓
fresh Phase3 requalification
        ↓
controlled Phase5 provider adapter
        ↓
same production Evidence host/cycle/retention/canonicalizer/fenced COMMIT/visibility/cursor
        ↓
dedicated qualification Compose
        ↓
duplicate/restart/fencing/backpressure/reconnect matrix
        ↓
accelerated O00→O23 with clock-only acceleration
        ↓
final central / graph / durable-evidence closure
        ↓
only then consider Phase6
~~~

Keep #3323 Draft.

Keep #3315 frozen.

Keep protected main untouched.

Keep B-Line separate.

Keep Phase 6 closed.

Keep Formal-v5 unarmed.

---

# Historical snapshot retained below — original 2026-08-27 Phase 2 continuation

The following section is the original 2026-08-27 Phase 2 frontier. It is intentionally retained so later engineers can reconstruct why the current Phase 3/4/5 architecture exists. Treat its “current” language as historical relative to the C0–C19 continuation above.

## 0. READ THIS FIRST — mandatory authority order

Before changing MCFT-CAP-09 runtime, workflow, schema, database, provider, scheduler, Compose, production ownership, Formal, Graduation, or qualification-control-plane logic, reconstruct authority in this order:

1. repository-level SSOT / frozen repository authority;
2. MCFT Master Task Line / digital-twin total task book;
3. applicable CAP Taskbooks;
4. accepted CAP-01→08 predecessor evidence;
5. immutable Formal-v4 NO-GO authority;
6. frozen v13 successor subject;
7. qualification control-plane / CP-5 closure;
8. frozen production-hosting architecture route;
9. Production Hosting Phase 1 closure;
10. `docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-26.md` for the initial Phase 2 takeover state;
11. **this handoff** for the current Phase 2 implementation frontier;
12. current exact-head GitHub Actions evidence.

### 0.1 Mandatory frozen architecture document

Read in full before continuing Phase 2:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

Frozen architecture commit:

`2f7a065cc95e4a5a2c95411fb381fe5e4479d645`

Hard architecture:

```text
External Providers
        ↓
Evidence Runtime / Live Evidence Plane
        ↓
governed database Evidence
        ↓
Twin Runtime Plane
        ↓
canonical Twin state / Forecast / Scenario / checkpoint
```

Evidence Runtime and Twin Runtime are separate production roles.

GitHub Actions remains CI / qualification / deployment / independent audit. It must not become the routine production provider clock, the Twin tick scheduler, or the production cadence owner.

### 0.2 Do not mix the numbering systems

Capability sequence:

```text
MCFT-CAP-01 → MCFT-CAP-09
```

Qualification-control-plane sequence:

```text
CP-0 → CP-5
```

Production-hosting migration sequence:

```text
Phase 0
Phase 0A
Phase 1
Phase 2
Phase 3
Phase 4
Phase 5
Phase 6
Phase 7
```

There is no frozen `CP-6`.

`Phase 6` in the production-hosting plan means production ownership cutover, not a qualification-control-plane phase.

---

## 1. Current task in one sentence

**Continue Production Hosting Phase 2 by making the KBS Raw Hourly Evidence path fully governed and qualification-equal-to-production, then productize the remaining GFS scientific core, while preserving post-COMMIT visibility / EvidenceSupplyCursor ordering and without starting Phase 3, a production Evidence Runtime host, Compose, Formal-v5, or production cadence ownership.**

---

## 2. Exact authority / branch / PR state at handoff time

### 2.1 Protected main

Protected `main` remains:

`26c1383f7f45abb76c99e28ec3d06714e85d1b2c`

No Phase 2 implementation work in this conversation has been merged into protected `main`.

Do not casually rebase Phase 2 onto a later main.

Any main movement must be treated as a new authority event, not as a harmless sync.

### 2.2 CP-5 predecessor

CP-5 closure predecessor remains:

PR #3291 exact head:

`14653ba622bb12261a1ea79f3ea7e42be0b49f92`

### 2.3 Production Hosting Phase 1 predecessor

Phase 1 implementation / qualification predecessor remains:

PR #3297 exact head:

`8943c752a354cb916cc7f144681203aa9a19f70b`

This is the exact base of the current Phase 2 implementation PR.

### 2.4 Current Phase 2 implementation PR

Draft PR:

**#3299 — `refactor(mcft-cap09): phase2a extract production Evidence provider seams`**

Branch:

`feat/mcft-cap09-phase2-evidence-production-modules-v1`

Base:

`feat/mcft-cap09-phase1-typed-runtime-composition-v1`

Exact base SHA:

`8943c752a354cb916cc7f144681203aa9a19f70b`

Current exact head at this handoff:

`b24c81097da101f5f17ba4d72b8761d54d53505e`

At verification time:

```text
state      = open
Draft      = true
merged     = false
mergeable  = true
commits    = 35
files      = 18
additions  = 2156
deletions  = 264
```

Do not merge #3299 merely because individual lanes are green.

Phase 2 is not closed.

### 2.5 Conversation handoff PR

The docs-only conversation handoff remains in:

PR #3298

Branch:

`docs/mcft-cap09-handoff-2026-08-26-phase2-evidence-module-frontier`

It is deliberately separate from #3299 so handoff edits do not perturb the implementation PR's controlled dependency graph.

The 2026-08-27 handoff is added to that docs-only branch.

---

## 3. Current phase map

```text
CP-5 exact-head closure                         PASS / HISTORICAL CLOSED
        ↓
Phase 1 typed Runtime composition               PASS / HISTORICAL CLOSED
        ↓
CAP08_FROZEN_REPLAY_EQUIVALENCE                 PASS / HISTORICAL CLOSED
        ↓
Phase 2 production Evidence productization      IN PROGRESS  ← CURRENT
        ↓
Phase 3 Evidence Runtime host                   BLOCKED ON PHASE 2
        ↓
Phase 4 Twin Runtime host                       BLOCKED
        ↓
Phase 5 two-service accelerated 24T             BLOCKED
        ↓
Phase 6 production ownership cutover            BLOCKED
        ↓
Phase 7 fresh Formal-v5                         FORBIDDEN / NOT ARMED
```

MCFT-CAP-09 remains:

```text
IN PROGRESS
NOT COMPLETE
NOT GRADUATED
FORMAL-V5 NOT ARMED
PRODUCTION OWNERSHIP NOT CUT OVER
```

---

## 4. Frozen Phase 2 boundary — what belongs here

Phase 2 is the production-module extraction / composition phase for the Evidence plane.

Allowed Phase 2 concerns include:

```text
provider acquisition
HTTPS transport
scientific decoding
raw-retention-first composition
canonical Evidence construction
governed Evidence ingress composition
post-COMMIT physical visibility proof
EvidenceSupplyCursor contract / ordering
qualification proving future production uses the same modules
machine governance of exact changed paths / dependencies
```

Phase 2 does **not** mean:

```text
production Evidence Runtime host
production cadence loop
durable Evidence Runtime ownership
production scheduler
lease/fencing owner
Compose service activation
durable EvidenceSupplyCursor database table
cursor migration
Formal-v5
Graduation
production Twin Runtime host
```

The most important boundary reconfirmed during this conversation is:

**Phase 2 requires the EvidenceSupplyCursor contract/composition and the ordering proof. Durable cursor persistence belongs to Phase 3.**

Therefore do not add a cursor table or migration now just because an `EvidenceSupplyCursorPortV1` exists.

---

## 5. What Phase 2 has materially completed so far

This section records only work that actually entered the current Phase 2 implementation lineage.

### 5.1 Formal HTTPS transport exists in product tree

Product module:

`apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.ts`

This is the production Evidence transport seam used by the product provider modules.

The intent is to avoid a future architecture where qualification fetches one way and production fetches another way.

### 5.2 KBS variate-25 soil provider was extracted into product tree

Product module:

`apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts`

Historical `formal_live_kbs_soil_ingress_executor_v1.ts` was retained as compatibility composition while provider/decoder behavior moved toward formal product modules.

Historical EA5C2B1 authority was not rewritten.

### 5.3 Historical EA5C2B1 governance was preserved by successor routing

The old EA5C2B1 gate was a historical exact-base / exact-candidate gate.

It was not legal to simply edit that old gate to pretend the Phase 2 candidate was the historical candidate.

The correct repair was:

```text
historical gate stays historical
        +
Phase 2 successor requalification gate
        +
exact Phase 1 predecessor
```

Current successor governance gate:

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs`

It requires exact Phase 1 base:

`8943c752a354cb916cc7f144681203aa9a19f70b`

It freezes historical authority dependencies and permits only explicitly declared sensitive deltas.

### 5.4 EA5E2 / AM19 governance history was repaired without rewriting history

During Phase 2 extraction, several dependency closures legitimately changed.

The work did **not** rewrite historical evidence.

Instead it used:

```text
successor requalification
rolling dependency graph rebind
durable requalification evidence
exact predecessor sets
```

A historical AM19 V3/V4 authority-symbol mismatch was discovered only after an older base guard stopped masking it.

The Phase 1 base already contained that mismatch.

It was therefore wrong to "fix" the historical runner as if Phase 2 had caused it.

The solution was a byte-locked generated compatibility subject:

`scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_AM19_PHASE2_AUTHORITY_SYMBOL_COMPATIBILITY_V1.ts`

That compatibility proof does not mutate the historical runner, does not activate persistent Formal execution, and does not convert a historical qualification inconsistency into a new runtime semantic change.

### 5.5 Central control-plane reached a historical all-green Phase 2 point

At exact head:

`11c44224cf95b102164c27d73190db30749d8fe2`

commit:

`gov(mcft-cap09): govern phase2 visibility and supply cursor modules`

the Phase 2 visibility/cursor paths were explicitly registered in the central control plane.

At that point, repository Actions evidence showed ordinary `ci` SUCCESS.

During the same stabilized lineage, central control-plane, EA5E2 graph, successor runner, and AM19 reached SUCCESS before the next KBS Raw Hourly adapter delta moved the governed dependency frontier again.

This is important:

**do not interpret the current red central/EA5E2 status as proof that those mechanisms are fundamentally broken. They were closed before the new KBS adapter became a new governed dependency.**

### 5.6 Post-COMMIT visibility entered product tree

Product Evidence-plane composition:

`apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.ts`

Product PostgreSQL read-only visibility adapter:

`apps/server/src/persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.ts`

The frozen ordering is:

```text
governed ingress returns after COMMIT
        ↓
fresh PostgreSQL readback
        ↓
exact committed Evidence identity verification
        ↓
EvidenceSupplyCursor advance
```

The product composition is:

`PostCommitVisibleExternalFormalEvidenceIngressV1`

The PostgreSQL adapter performs a fresh read of `public.facts` by exact `fact_id` and verifies:

```text
record_type
source_record_id
source_record_hash
semantic hash
retention_ref
raw_sha256
raw_bytes
```

before cursor advancement is allowed.

There is no raw-object fallback in the visibility adapter.

### 5.7 EvidenceSupplyCursor is currently a contract / port, not durable state

The Phase 2 contract is:

`EvidenceSupplyCursorPortV1`

with:

`advanceAfterVisibleEvidence(...)`

This proves the supply-side ordering seam.

It does **not** create:

```text
cursor table
cursor migration
durable cursor repository
scheduler
lease/fencing
runtime host
production cadence owner
```

Those belong to Phase 3.

### 5.8 Visibility/cursor acceptance was repaired for Node 20 / tsx

Acceptance:

`scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE2_POST_COMMIT_VISIBILITY_CURSOR_V1.ts`

The initial version used:

`import.meta.dirname`

under the Node 20 / tsx execution path.

That caused startup failure before the actual acceptance semantics ran.

Commit:

`2e482bbbdc7abea4240391b0e334315d2ec8a1d0`

changed the root resolution to:

`path.resolve(process.cwd())`

The important lesson is that this was an acceptance bootstrapping defect, not an Evidence ordering defect.

After the repair, the post-COMMIT visibility / cursor-ordering proof executed.

### 5.9 KBS Raw Hourly scientific core is now product-owned

Product Python scientific core:

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

The current product core owns, among other things:

```text
KBS Raw Hourly CSV header discovery
provider UTC timestamp parsing
exact target-hour row selection
provider-latest diagnostic age
rainfall range checks
temperature / vapor / solar / wind checks
10 m → 2 m wind factor
W/m² → MJ/m²/h conversion
ASCE short hourly ET0 via refet
exact interval JSON result
```

The current core is no longer a wrapper around the old EA4 acceptance Python.

It imports product/runtime dependencies directly:

```text
numpy
refet
```

and does not import from `scripts/runtime_acceptance`.

That is a material improvement over the earlier Phase 2 frontier.

### 5.10 KBS Raw Hourly TypeScript product adapter exists

Product adapter:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

It exports:

```text
KbsRawHourlyLiveTransportV1
KbsRawHourlyExactIntervalDecoderV1
```

Transport behavior reuses:

`HttpsExternalEvidenceTransportV1`

The scientific decoder invokes the product-owned Python core:

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

The TypeScript adapter does not own:

```text
raw retention
database writer
scheduler
lease/fencing
Twin state mutation
GitHub run identity
production cadence ownership
```

The product Python core is invoked as a scientific decoding process, not as an acceptance runner.

### 5.11 KBS Raw Hourly successor governance explicitly recognizes the product modules

Current Phase 2 successor gate explicitly names:

```text
apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts
apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py
```

and checks forbidden dependency markers.

The gate deliberately rejects product scientific code that contains direct qualification/runtime-control dependencies such as:

```text
scripts/runtime_acceptance
acceptance-output
MCFT_SUBJECT_SHA
GITHUB_
github.run
importlib.util
subprocess
os.environ
tempfile
urlopen
INSERT INTO
RuntimeTickCursor
twin_state
```

for the Python scientific core.

### 5.12 Strict lexical governance caught a comment-only false positive

The KBS TypeScript adapter originally contained the literal marker:

`RuntimeTickCursor`

inside a comment describing what the adapter does **not** own.

The strict successor gate is lexical and rejected that marker.

This was not an actual RuntimeTickCursor import or dependency.

The correct response was **not** to weaken the gate.

Commit:

`b24c81097da101f5f17ba4d72b8761d54d53505e`

changed only the comment wording:

`RuntimeTickCursor` → `runtime tick cursor`

and preserved the gate.

This exact pitfall must not be "fixed" later by broadening or disabling the forbidden-marker check.

---

## 6. Current exact-head status — `b24c8109…`

Current #3299 exact head:

`b24c81097da101f5f17ba4d72b8761d54d53505e`

### 6.1 Current green lanes

At this head, verified successful lanes include:

```text
EA5E2 successor runner qualification
AM19 persistent-24T static/successor qualification
EA5C2B1 live KBS soil successor qualification
release-lane / policy / ruleset related checks
candidate declaration checks
```

These successes mean the current problem should not be diagnosed as a generic runtime collapse.

### 6.2 Current central control-plane red

Current run:

`mcft-cap-09-qualification-control-plane-v1`

run:

`32995220687`

job:

`98262519972`

fails at:

`Prove generation, durable-anchor, and dependency-digest semantics`

The preceding steps pass:

```text
Checkout exact control-plane subject                     PASS
Require governed successor predecessor                  PASS
Prove central applicability semantics                   PASS
```

The failure occurs before immutable evidence resolution / exact PR blocker enumeration.

### 6.3 Current EA5E2 graph red happens before full graph qualification

Current run:

`mcft-cap-09-ea5e2-runtime-dependency-graph`

run:

`32995220862`

job:

`98262520479`

fails at:

`Generate central applicability plan`

The following graph steps are skipped:

```text
Route EA5E2 from central planner                    SKIPPED
Run full EA5E2 runtime dependency qualification     SKIPPED
Validate full EA5E2 qualification proof             SKIPPED
```

Therefore:

**there is no current generated expected graph digest from this head that is safe to bind yet.**

Do not edit the carrier digest speculatively.

### 6.4 Exact central-planner gap causing the current frontier

The current central authority defines:

`PHASE2_EVIDENCE_PROVIDER_MODULES`

as an exact path set.

It currently includes the KBS product Python core:

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

but it does **not** currently include the new TypeScript adapter:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

This is the key current governance drift.

The adapter exists in the product tree and is recognized by the KBS successor gate, but the central Phase 2 resolver has not yet been advanced to own that exact path.

This is why the next step starts in central planning, not by changing the EA5E2 digest.

---

## 7. EA5E2 graph capability already supports the required fix

EA5E2 graph acceptance:

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs`

already has explicit sets:

```text
ENTRY
STATIC
MUST
```

and an import/discovery closure.

It is not necessary to introduce a directory wildcard to govern the KBS product modules.

The graph can explicitly add stable production dependencies.

For the KBS Raw Hourly path, the intended governance approach is:

```text
explicit exact product adapter path
+
explicit exact product Python scientific-core path
+
existing import/generated closure
```

not:

```text
apps/server/src/external_evidence/provider/**
```

as a semantic dependency declaration.

Workflow path triggers may remain broad where historically required, but the governed runtime dependency graph itself must remain explicit and reviewable.

---

## 8. What remains incomplete in the KBS Raw Hourly path

### 8.1 Central control-plane registration

Add the exact adapter path:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

to the appropriate Phase 2 control-plane resolver / governed dependency set.

Do not solve this with an unknown-path exemption.

Do not solve it with a branch-name exemption.

### 8.2 EA5E2 production dependency graph registration

Once central planning recognizes the path, add the KBS adapter + scientific core to EA5E2 graph using the existing explicit STATIC/MUST mechanism as appropriate.

Do not change the rolling carrier digest before this governed path set is stable and the graph generator actually runs.

### 8.3 Focused qualification of the actual product adapter is still required

The repository now contains:

```text
KbsRawHourlyLiveTransportV1
KbsRawHourlyExactIntervalDecoderV1
```

but Phase 2 is not closed merely because those classes exist and the Python core selftest passes.

A focused qualification must actually instantiate:

`KbsRawHourlyLiveTransportV1`

and:

`KbsRawHourlyExactIntervalDecoderV1`

and prove that qualification is executing the same implementation intended for future production.

The test should prove at minimum:

```text
real product transport class is instantiated
real product decoder class is instantiated
decoder calls product-owned Python core
same exact-T semantics
same diagnostic freshness semantics
same ASCE ET0 method/version
no acceptance Python implementation used as scientific authority
no GitHub run identity required
no direct DB writer
no scheduler
no RuntimeTickCursor
no Twin state mutation
no production cadence activation
```

This focused qualification is the missing bridge between:

```text
"product module exists"
```

and:

```text
"qualification proves future production uses this module"
```

### 8.4 KBS current production-core caveat from earlier audit is resolved

Earlier in the Phase 2 conversation, an intermediate KBS product-core version still loaded EA4 qualification helpers.

That is no longer true at current head.

Do **not** carry that old blocker forward.

At `b24c8109…`, the KBS product Python core contains its own parsing / exact-T / ET0 implementation and the successor gate explicitly forbids `scripts/runtime_acceptance`.

The remaining KBS blocker is governance + focused product-adapter qualification, not acceptance-Python import removal.

---

## 9. GFS scientific core remains the larger Phase 2 debt

After KBS Raw Hourly closes, Phase 2 still is **not** complete.

GFS scientific/provider logic still needs the same productization treatment.

The remaining GFS scientific debt includes, at minimum:

```text
cycle selection
provider-cycle availability semantics
NOMADS / GFS acquisition semantics
GRIB / eccodes decoding
APCP accumulation differencing
solar integration / interval semantics
ASCE ET0 computation
quality / exact-source / exact-time handling
```

The frozen rule is:

**do not create one GFS algorithm for qualification and a different simplified GFS algorithm for production.**

The product module must become the implementation both use.

A valid Phase 2 GFS extraction should end with:

```text
qualification runner
        ↓
product GFS provider / scientific core
        ↓
same future production Evidence module
```

not:

```text
qualification-only Python
        +
new production rewrite
```

---

## 10. Phase 2 visibility / cursor closure semantics

The current Evidence-plane order is a hard contract:

```text
raw provider bytes
        ↓
durable raw retention
        ↓
decode retained bytes
        ↓
canonicalize Evidence
        ↓
governed DB ingress
        ↓
COMMIT
        ↓
fresh DB readback
        ↓
exact identity verification
        ↓
EvidenceSupplyCursor advance
```

Two ordering rules must not be weakened:

1. raw retention occurs before decode / canonical Evidence admission;
2. EvidenceSupplyCursor advances only after committed Evidence is physically visible and identity-matched.

If fresh readback returns:

```text
0 rows
>1 row
wrong source_record_hash
wrong semantic hash
wrong raw provenance
missing fact_id
```

cursor advancement must fail closed.

---

## 11. Phase 2 vs Phase 3 — do not cross this line

### Phase 2 owns

```text
EvidenceSupplyCursorPortV1
cursor advance request/result contract
ordering composition
post-COMMIT visibility
read-only visibility adapter
focused qualification
provider/scientific product modules
```

### Phase 3 owns

```text
durable Evidence Runtime host
durable cursor persistence
cursor table / migration if frozen design requires it
lease/fencing
restart/recovery ownership
provider cadence loop
runtime process lifecycle
production configuration / secrets binding
Compose service if authorized
```

Do not add Phase 3 artifacts to #3299 to make Phase 2 "look complete."

---

## 12. Exact non-effects that still hold

At current frontier, none of the Phase 2 work authorizes or performs:

```text
protected main mutation
production Evidence Runtime activation
production Twin Runtime activation
production provider cadence ownership
Runtime provider fallback
Formal-v5 arm
Formal database production mutation
Graduation
MCFT-CAP-09 completion
Phase 3 durable EvidenceSupplyCursor persistence
new cursor table
new cursor migration
production Compose service
```

Keep these explicit in every Phase 2 acceptance result and governance gate.

---

## 13. Failure / repair history that must be remembered

### 13.1 EA5E2 graph digest is not a magic constant

Earlier Phase 2 changes legitimately changed the governed graph.

A stale carrier digest caused failure.

The safe sequence is:

```text
finish exact governed path set
        ↓
central planner PASS
        ↓
run generated graph
        ↓
read generated expected digest
        ↓
only then rebind carrier
        ↓
rerun exact-head graph qualification
```

Do not guess the digest.

### 13.2 Distinguish inner frozen authority from rolling carrier binding

Do not see one digest mismatch and change every digest-like value.

Historical/frozen graph identity and rolling successor carrier identity may be different layers.

Changing the wrong layer rewrites history.

### 13.3 Unknown changed paths are supposed to fail closed

When central planning says a path is unknown, that is not CI noise.

It means the control plane has no machine-owned reason why the path is allowed to change.

The repair is:

```text
explicit resolver ownership
+
exact predecessor
+
qualified execution workflow
```

not:

```text
ignore unknown path
```

### 13.4 Do not use broad directory wildcards as governance semantics

The EA5E2 graph can name STATIC/MUST product dependencies explicitly.

Use that.

Avoid turning Phase 2 governance into:

`provider/**`

because it destroys the ability to tell which files are actually part of the qualified runtime graph.

### 13.5 Strict lexical gates can be triggered by comments

The `RuntimeTickCursor` comment incident proves this.

When a forbidden marker appears only in commentary:

- verify it is not a real dependency;
- keep the gate strict;
- remove/rephrase the misleading literal from the comment.

Do not weaken the gate just because a false positive is inconvenient.

### 13.6 Node 20 / tsx does not guarantee `import.meta.dirname`

The visibility acceptance failed before test execution because it relied on:

`import.meta.dirname`

The stable repo-root execution path used:

`path.resolve(process.cwd())`

For future acceptance scripts, do not introduce runtime-specific path assumptions without proving them in the repository's pinned Node/tsx environment.

### 13.7 Do not rewrite historical gates to accept new candidates

EA5C2B1 and AM19 both showed why this is dangerous.

Historical gate:

```text
historical subject
historical base
historical blobs
historical meaning
```

Successor change:

```text
new exact predecessor
new successor gate
new requalification evidence
```

Do not turn the historical gate into a moving allowlist.

### 13.8 Do not "fix" a pre-existing historical failure as a Phase 2 semantic change

The AM19 V3/V4 symbol mismatch existed in the Phase 1 base.

Phase 2 merely exposed it after a base guard was repaired.

The correct repair was a byte-frozen compatibility proof, not changing the historical runner.

### 13.9 Do not register durable requalification evidence too early

If a workflow or dependency path will still change, its digest can change again.

The safe sequence is:

```text
finish governing code
        ↓
exact-head successful run
        ↓
final dependency digest
        ↓
immutable evidence binding
        ↓
durable anchor
```

Registering evidence before the dependency graph stabilizes creates immediately stale evidence.

### 13.10 Separate independent red lanes

Do not assume:

```text
central red
EA5E2 red
AM19 red
KBS red
```

all have one cause.

Earlier in this conversation, several were independently classified:

```text
dependency graph requalification
historical base guard
historical V3/V4 compatibility
central evidence registry
```

Always inspect the exact failed step before editing code.

### 13.11 A green successor runner does not mean the graph is closed

At current `b24c8109…`:

successor runner is green while the EA5E2 graph workflow fails in central planning.

These are different proofs.

Do not infer graph closure from runner success.

### 13.12 A product class existing is not enough

For KBS Raw Hourly, the TypeScript adapter exists.

Phase 2 still requires focused qualification to instantiate it.

The architecture requirement is:

**qualification implementation == future production implementation**

not merely:

**qualification semantics approximately match product code.**

---

## 14. Current KBS Raw Hourly semantic facts to preserve

The current product scientific core preserves these important semantics:

### 14.1 Exact target-hour admission

The target must be canonical UTC hour.

There must be exactly one matching row at target T.

### 14.2 Provider availability vs historical freshness diagnostic

The old `<=6h` concept remains diagnostic.

It is not the late-authoritative admission gate.

Current product result explicitly carries:

`freshness_is_late_authoritative_admission_gate: false`

Do not regress to:

```text
authority_pass = age <= 6h
```

### 14.3 Plausibility / quality bounds

Current core validates finite and bounded:

```text
rainfall
air temperature
actual vapor pressure
solar radiation
wind
ET0
```

Do not silently remove these checks in a future "production rewrite."

### 14.4 ASCE hourly ET0 method

Current core uses `refet.Hourly` with:

`method="asce"`

and the product adapter records:

`method_version: "refet-0.4.2"`

Keep qualification and future production on the same method.

---

## 15. Current central-control-plane repair sequence

The immediate repair sequence should be:

### Step A — lock exact head

Before modifying anything:

```text
PR #3299 head
PR #3299 base
protected main
current workflow runs
```

If head moved from `b24c8109…`, rebuild evidence from the new exact head.

### Step B — register the missing KBS adapter path centrally

Add exact:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

to the appropriate Phase 2 resolver / control-plane ownership.

Do not add an unknown-path escape hatch.

### Step C — rerun central plan before graph digest work

The expected signal is that the central planner gets past the current exact-path ownership problem.

Only after that should EA5E2 proceed to generated graph qualification.

### Step D — add KBS adapter + core to EA5E2 graph explicitly

Use existing STATIC/MUST facilities.

The exact choice between STATIC and MUST should reflect whether the dependency is required to be present in the qualified production path, not merely changed in the PR.

Do not use a directory wildcard.

### Step E — generate graph and inspect the actual expected digest

Only when the graph acceptance actually runs should the new expected digest be read.

If:

`carrier_dependency_graph_sha256 != expected_dependency_graph_sha256`

then perform one legal rolling carrier rebind.

Do not touch unrelated frozen graph authority.

### Step F — rerun exact-head graph + central + successor lanes

Minimum evidence:

```text
central control-plane PASS
unknown_changed_paths = 0
authority_errors = 0
resolver_errors = 0
EA5E2 graph PASS
successor runner PASS
AM19 PASS
KBS soil successor PASS
ordinary CI PASS
```

Do not declare closure from a subset.

---

## 16. Focused KBS product-adapter qualification design

The focused qualification should be bounded.

Recommended shape:

```text
fixture / retained raw bytes
        ↓
instantiate KbsRawHourlyLiveTransportV1
        ↓
instantiate KbsRawHourlyExactIntervalDecoderV1
        ↓
product-owned Python scientific core
        ↓
GovernedDecodedEvidenceDraftV1[]
```

The qualification should avoid creating a second scientific implementation.

### 16.1 Positive proof

Prove:

```text
correct request builder / endpoint
HTTPS final-host constraints
product transport identity
product decoder identity/version
product scientific core path
exact-T decode
rainfall Evidence draft
historical ET0 Evidence draft
diagnostic freshness flag remains non-authoritative
raw payload not embedded
no direct SQL
no Twin mutation
```

### 16.2 Negative proof

Prove fail-closed for at least:

```text
non-canonical target hour
missing exact target row
duplicate target row
invalid / nonfinite ET0 inputs
out-of-range rain
out-of-range air temperature
out-of-range vapor
out-of-range solar
out-of-range wind
scientific result target mismatch
provider locator mismatch
provider id mismatch
source family mismatch
```

### 16.3 Product/qualification identity proof

The qualification should assert it imports/instantiates the product TypeScript classes.

Do not duplicate their behavior inside the acceptance script.

---

## 17. GFS Phase 2 extraction plan after KBS

Do not start this until the KBS graph / focused qualification is stable.

### GFS step 1 — map actual qualification implementation

Inventory the exact current files/functions for:

```text
cycle selection
provider request
GRIB download
eccodes field extraction
APCP differencing
solar integration
temperature/dewpoint/wind transformation
ASCE ET0
quality semantics
```

### GFS step 2 — identify which logic is scientific core vs transport

Keep separate:

```text
transport / request / bytes
scientific decoding / transformation
Evidence canonicalization
```

### GFS step 3 — move scientific implementation to product-owned module

Do not rewrite from memory.

Move the qualified algorithm.

### GFS step 4 — route qualification through the product module

The old qualification runner may remain as orchestration, but its scientific decision must call the product implementation.

### GFS step 5 — graph/control-plane registration

Add exact product paths.

Generate digest after path set stabilizes.

### GFS step 6 — focused product proof

Prove:

```text
qualification uses product GFS core
same cycle selection
same APCP difference
same solar interval meaning
same ET0
same causal source-time semantics
```

---

## 18. Phase 2 completion definition

Do not say "Phase 2 complete" until all of the following are true at one exact head:

### Product modules

- [ ] KBS Raw Hourly TypeScript adapter governed.
- [ ] KBS Raw Hourly scientific core governed.
- [ ] focused KBS product-adapter qualification PASS.
- [ ] GFS transport/provider product seam complete.
- [ ] GFS scientific core product-owned.
- [ ] GFS qualification uses product implementation.
- [ ] no second GFS scientific algorithm exists only for production.
- [x] formal HTTPS transport product-owned.
- [x] KBS variate-25 soil provider product-owned.
- [x] raw retention adapter already product-owned.
- [x] canonicalizer already product-worthy.
- [x] governed ingress adapter already product-worthy.
- [x] post-COMMIT visibility product-owned.
- [x] EvidenceSupplyCursor contract/composition product-owned.

### Governance / graph

- [ ] all Phase 2 product paths explicitly owned by central control plane.
- [ ] unknown_changed_paths = 0.
- [ ] authority_errors = 0.
- [ ] resolver_errors = 0.
- [ ] EA5E2 generated graph contains the required product dependencies.
- [ ] carrier digest equals generated expected digest.
- [ ] no broad semantic wildcard introduced to hide dependencies.
- [ ] immutable/requalification evidence only reflects final dependency state.

### CI / qualification

- [ ] central control-plane PASS.
- [ ] EA5E2 graph PASS.
- [ ] successor runner PASS.
- [ ] AM19 PASS.
- [ ] KBS successor/live soil qualification PASS.
- [ ] ordinary CI PASS.
- [ ] focused KBS adapter proof PASS.
- [ ] focused GFS product proof PASS.

### Non-effects

- [ ] no protected main mutation.
- [ ] no production Evidence Runtime activation.
- [ ] no production Twin Runtime activation.
- [ ] no production cadence owner.
- [ ] no Runtime provider fallback.
- [ ] no durable Phase 3 cursor persistence.
- [ ] no Compose production service.
- [ ] no Formal-v5 arm.
- [ ] no Graduation.
- [ ] MCFT-CAP-09 still not marked complete until later frozen phases close.

Only after these hold may Phase 3 be opened.

---

## 19. First 30 minutes for the next engineer

### Minute 0–5 — restore authority

Read:

```text
docs/SSOT.md
MCFT master task line
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-26.md
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md
```

### Minute 5–10 — lock GitHub facts

Verify:

```text
main == 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
#3299 base == 8943c752a354cb916cc7f144681203aa9a19f70b
#3299 head == expected current head
#3299 Draft == true
#3299 merged == false
```

If any SHA changed, do not reuse old CI conclusions blindly.

### Minute 10–15 — inspect current red steps

For central:

```text
which exact step failed?
did central applicability semantics pass?
did exact PR plan run?
unknown_changed_paths?
authority_errors?
resolver_errors?
```

For EA5E2:

```text
did failure occur at central plan?
did route step run?
did full graph generator run?
was a new expected digest actually emitted?
```

### Minute 15–20 — inspect exact Phase 2 resolver

Confirm whether:

`kbs_raw_hourly_live_provider_v1.ts`

is present in `PHASE2_EVIDENCE_PROVIDER_MODULES`.

At this handoff it is not.

### Minute 20–30 — make the smallest governance patch

Preferred first patch:

```text
central resolver exact-path registration
+
EA5E2 explicit STATIC/MUST product dependency registration
```

Then rerun before touching carrier digest.

---

## 20. Things not to do in the next conversation

Do not:

1. start again from old Draft PR #3295;
2. call Phase 1 incomplete;
3. start Phase 2 from protected main;
4. merge #3297 just to simplify the stack;
5. merge #3299 before Phase 2 closure;
6. change Formal-v5;
7. start production Evidence Runtime host;
8. add Compose production service;
9. add durable EvidenceSupplyCursor table in Phase 2;
10. add production scheduler / lease owner;
11. let Twin Runtime fetch provider/R2 fallback directly;
12. change graph digest before the graph generator runs;
13. use a directory wildcard to silence unknown paths;
14. weaken strict forbidden-marker gates because a comment tripped one;
15. rewrite historical EA5C2B1 or AM19 authority;
16. "fix" historical AM19 runner semantics as a Phase 2 change;
17. create a simplified GFS production algorithm that differs from qualification;
18. declare KBS closed before focused product-adapter qualification;
19. declare Phase 2 complete before GFS scientific core is product-owned;
20. interpret one green workflow as complete system qualification.

---

## 21. High-value exact file map

### Frozen route

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

### Central control plane

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json`

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json`

`scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs`

`.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml`

### EA5E2 graph

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs`

`scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs`

`.github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml`

### Existing product Evidence core

`apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts`

`apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts`

`apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts`

### Visibility / supply cursor

`apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.ts`

`apps/server/src/persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.ts`

`scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE2_POST_COMMIT_VISIBILITY_CURSOR_V1.ts`

### KBS product modules

`apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.ts`

`apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts`

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

### KBS successor governance

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs`

`.github/workflows/mcft-cap-09-ea5c2b1-live-kbs-soil-ingress-executor.yml`

### AM19 compatibility

`scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_AM19_PHASE2_AUTHORITY_SYMBOL_COMPATIBILITY_V1.ts`

`.github/workflows/mcft-cap-09-amendment19-persistent-24t-qualification.yml`

---

## 22. Exact known commits worth preserving in the mental model

### Initial Phase 2 implementation branch base

`8943c752a354cb916cc7f144681203aa9a19f70b`

Phase 1 closure / exact predecessor.

### Visibility/cursor control-plane registration

`11c44224cf95b102164c27d73190db30749d8fe2`

Message:

`gov(mcft-cap09): govern phase2 visibility and supply cursor modules`

### Node 20 / tsx acceptance root fix

`2e482bbbdc7abea4240391b0e334315d2ec8a1d0`

Message:

`fix(mcft-cap09): resolve phase2 visibility acceptance from repo root`

### Current comment-only strict-gate repair / handoff head

`b24c81097da101f5f17ba4d72b8761d54d53505e`

Message:

`fix(mcft-cap09): avoid false runtime-cursor marker in KBS provider`

---

## 23. Why the current problem is bounded

The current red state is not an unknown production failure.

Evidence:

```text
successor runner = SUCCESS
AM19 = SUCCESS
KBS soil successor = SUCCESS
central applicability semantics step = SUCCESS
EA5E2 full graph step = not reached
```

The new TypeScript adapter was introduced after a previously stabilized governance state.

The central Phase 2 exact path set has not yet been updated to own that adapter.

Therefore the next investigation should remain in:

```text
control-plane exact-path ownership
        ↓
EA5E2 explicit graph dependency
        ↓
generated digest
```

not jump to:

```text
provider semantics rewrite
database change
scheduler
Formal
```

---

## 24. Why Phase 2 must not be declared complete yet

Three independent reasons remain:

### Reason 1 — current exact head is not centrally qualified

Central / EA5E2 are red at `b24c8109…`.

### Reason 2 — KBS product adapter is not yet focused-qualified

The product classes exist but qualification has not yet fully demonstrated that it instantiates the exact future-production adapter/decoder pair.

### Reason 3 — GFS scientific core is still acceptance-era debt

Even a fully closed KBS path does not close Phase 2 while GFS scientific logic remains qualification-only.

---

## 25. Recommended next PR slicing inside #3299

Do not widen #3299 into Phase 3.

Preferred bounded slices:

### Slice A — KBS governance closure

```text
central exact-path registration
EA5E2 exact production dependency registration
generated digest / legal carrier rebind if required
```

### Slice B — KBS focused product qualification

```text
instantiate product transport
instantiate product decoder
product Python core
positive / negative proof
machine non-effects
```

### Slice C — GFS scientific-core extraction

```text
move existing qualified scientific semantics into product-owned core
qualification routes through product core
focused product proof
graph / central registration
```

### Slice D — Phase 2 exact-head closure

```text
central
EA5E2
successor
AM19
KBS
GFS focused proof
ordinary CI
non-effects
```

Only after Slice D:

open Phase 3.

---

## 26. Handoff bottom line

The project is no longer at:

```text
"Phase 2 has not started"
```

and it is also not at:

```text
"Phase 2 complete"
```

The precise current state is:

```text
Phase 2 product Evidence architecture materially exists
        +
post-COMMIT visibility / EvidenceSupplyCursor ordering is productized
        +
KBS Raw Hourly scientific core is product-owned
        +
KBS Raw Hourly TypeScript transport/decoder adapter exists
        +
historical successor governance has been preserved
        +
central/EA5E2 were previously green before the latest adapter delta
        ↓
current adapter is not yet fully registered in central/EA5E2 governed dependency sets
        +
focused qualification of the product adapter pair is still missing
        +
GFS scientific core remains to be productized
        ↓
Phase 2 remains IN PROGRESS
```

The immediate next action is **not** to change graph digest.

It is:

```text
register exact KBS adapter ownership in central control plane
        ↓
register exact KBS product dependencies in EA5E2 STATIC/MUST graph
        ↓
rerun central plan
        ↓
only after graph generation, read/rebind digest if needed
        ↓
focused-qualify KbsRawHourlyLiveTransportV1
+ KbsRawHourlyExactIntervalDecoderV1
        ↓
then productize GFS scientific core
```

Keep #3299 Draft.

Keep protected `main` untouched.

Keep Formal-v5 unarmed.

Keep Phase 3 closed until Phase 2 exact-head closure is machine-proved.
