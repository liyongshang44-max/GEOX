# GEOX MCFT-CAP-09 Conversation Handoff — 2026-08-26 — Production Hosting Phase-2 Evidence-Module Frontier

Status: **CONVERSATION HANDOFF / CURRENT FRONTIER — NOT MASTER-TASK AUTHORITY**

Timestamp: **2026-08-26 19:06 +08:00**

Repository: `liyongshang44-max/GEOX`

Purpose: hand off the exact MCFT-CAP-09 engineering frontier after **CP-5 exact-head closure** and **Production Hosting Phase 1 completion**, with the next implementation frontier now frozen at **Phase 2 — production Evidence provider module extraction**.

> This handoff supersedes Draft PR #3295 for current-conversation state only.
> It does not supersede `docs/SSOT.md`, the MCFT Master Task Line, any CAP Taskbook, accepted CAP-01→08 historical authority, immutable Formal-v4 NO-GO evidence, or the production-hosting architecture freeze.

---

## 0. READ THIS FIRST — mandatory authority order

Before changing MCFT-CAP-09 runtime, workflow, schema, database, provider, scheduler, Compose, production ownership, Formal, or Graduation logic, reconstruct authority in this order:

1. repository-level SSOT / frozen repository authority;
2. MCFT Master Task Line / total task book;
3. applicable CAP Taskbooks;
4. accepted CAP-01→08 predecessor evidence;
5. immutable Formal-v4 NO-GO authority;
6. frozen v13 successor subject in Draft PR #3289;
7. qualification control-plane in Draft PR #3291;
8. production-hosting architecture freeze in Draft PR #3292 / exact commit `2f7a065cc95e4a5a2c95411fb381fe5e4479d645`;
9. completed Phase 1 successor in Draft PR #3297;
10. only then this handoff.

### 0.1 Mandatory production-hosting architecture document

Read in full before Phase 2 implementation:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

Frozen architecture commit:

`2f7a065cc95e4a5a2c95411fb381fe5e4479d645`

The same architecture document is also an ancestor of the Phase 1 branch/PR #3297.

Hard architecture statement:

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

The Evidence Runtime and Twin Runtime are independent production roles with separate cursors, leases/fences, storage authorities, and database permissions.

GitHub remains CI / qualification / deployment / independent audit. It must not become the routine production provider clock or Twin tick scheduler.

### 0.2 Do not mix the three numbering systems

Capability sequence:

```text
MCFT-CAP-01 → MCFT-CAP-09
```

Qualification control-plane sequence:

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

`Phase 6` is production ownership cutover, not a qualification-control-plane phase.

---

## 1. Current task in one sentence

**CP-5 and Production Hosting Phase 1 are complete at their exact successor heads; the next task is Phase 2: extract production Evidence provider / retention / decoder / canonicalizer / governed-ingress / visibility / EvidenceSupplyCursor modules out of acceptance-only plumbing, without activating production.**

---

## 2. Current status summary

Current engineering frontier:

```text
CP-5 exact-head closure                         PASS / CLOSED
        ↓
Phase 1 typed Runtime composition extraction    PASS / CLOSED
        ↓
CAP08_FROZEN_REPLAY_EQUIVALENCE                 PASS / CLOSED
        ↓
Phase 2 production Evidence module extraction   NOT STARTED
        ↓
Phase 3 Evidence Runtime host                    BLOCKED ON PHASE 2
        ↓
Phase 4 Twin Runtime host                        BLOCKED
        ↓
Phase 5 two-service accelerated 24T              BLOCKED
        ↓
Phase 6 production ownership cutover             BLOCKED
        ↓
Phase 7 fresh Formal-v5                          BLOCKED
```

MCFT-CAP-09 overall status remains:

**IN PROGRESS — NOT COMPLETE — FORMAL-V5 NOT ARMED**

Do not interpret Phase 1 completion as CAP-09 completion.

---

## 3. Exact repository / PR / SHA matrix

### 3.1 Protected main

Protected `main` remains:

`26c1383f7f45abb76c99e28ec3d06714e85d1b2c`

No runtime or docs PR from this conversation has been merged into protected main.

Do not silently advance main merely to make branch ancestry convenient.

### 3.2 Frozen v13 successor subject — PR #3289

Draft PR: **#3289**

Branch:

`fix/mcft-cap09-v13-autonomous-forcing-foundation`

Frozen exact head:

`3bbf096ee5cb73e8e0e0251dc400733d6cab501f`

Base:

`main @ 26c1383f7f45abb76c99e28ec3d06714e85d1b2c`

Treat this as frozen predecessor subject / evidence authority.

Do not mutate, rebase, rewrite, force-push, or reuse it as Formal-v5 completion authority.

### 3.3 Qualification control plane — PR #3291

Draft PR: **#3291**

Title:

`feat(mcft-cap09): centralize qualification applicability and blocker inventory`

Branch:

`fix/mcft-cap09-qualification-control-plane-v1`

Base:

`3bbf096ee5cb73e8e0e0251dc400733d6cab501f`

Current exact head:

`14653ba622bb12261a1ea79f3ea7e42be0b49f92`

Status:

**CP-5 CLOSED / ACCEPTED SUCCESSOR PREDECESSOR FOR PHASE 1**

Important exact-head successful closure runs include:

- control-plane: `32939043712` — SUCCESS;
- EA5E2 runtime dependency graph: `32939043653` — SUCCESS;
- persistent-24T qualification: `32939043641` — SUCCESS;
- EA5E2 successor runner: `32939043683` — SUCCESS;
- ordinary `ci`: `32939043668` — SUCCESS.

Later runs on the same SHA may appear red because old workflows were re-triggered under different stacked-PR contexts. Do not use a later unrelated trigger to erase the accepted CP-5 closure evidence. Always inspect workflow context, base, and applicability.

### 3.4 Production-hosting architecture freeze — PR #3292

Draft PR: **#3292**

Branch:

`docs/mcft-cap09-production-hosting-architecture-v1`

Exact architecture commit:

`2f7a065cc95e4a5a2c95411fb381fe5e4479d645`

Status:

**FROZEN DEVELOPMENT ROUTE / DOCS ONLY / NOT MERGED TO MAIN**

### 3.5 Completed Phase 1 implementation — PR #3297

Draft PR: **#3297**

Title:

`refactor(mcft-cap09): extract typed ReplayHost composition with CAP08 equivalence`

Branch:

`feat/mcft-cap09-phase1-typed-runtime-composition-v1`

Base branch:

`fix/mcft-cap09-qualification-control-plane-v1`

Base exact SHA:

`14653ba622bb12261a1ea79f3ea7e42be0b49f92`

Current exact Phase 1 head:

`8943c752a354cb916cc7f144681203aa9a19f70b`

PR state:

**DRAFT / OPEN / MERGEABLE / PHASE 1 QUALIFICATION CLOSED**

Current PR statistics at handoff:

```text
16 commits
15 changed files
2148 additions
41 deletions
```

The Phase 0A architecture commit `2f7a065...` is a branch-local second parent in #3297 so that both CP-5 closure and architecture freeze are machine-provable ancestors.

Protected main remains untouched.

### 3.6 Previous handoff — PR #3295

Draft PR #3295 recorded the earlier frontier:

```text
CP-5 exact-head closure
        ↓
Phase 1 composition extraction
```

That snapshot is now historical.

This handoff supersedes #3295 because CP-5 and Phase 1 have since closed.

---

## 4. Historical authority that remains frozen

### 4.1 CAP-01→07

Accepted completion remains historical authority.

Do not reopen CAP-01→07 merely because provider/runtime hosting is being productized.

### 4.2 CAP-08

CAP-08 Stage 1A bounded Replay closure remains accepted historical authority.

Frozen CAP-08 completion subject used by Phase 1 equivalence:

`67bd71560268046a7fa9a9433ee074ad3999cb71`

Phase 1 did not rewrite or reopen CAP-08 completion.

It proved the new application composition reproduces the frozen replay semantics.

### 4.3 Formal-v4

Formal-v4 remains immutable:

**NO-GO / DEAD / AUDIT-ONLY**

Known failed-v4 database:

`geox_mcft_cap09_s6_formal_t4r1_24h_v4`

Known failure:

O08 / `2026-08-25T12:00:00Z` had no causal current-interval forcing pair.

The runtime failed closed correctly.

Do not:

- repair the failed epoch;
- insert late forcing into the failed epoch;
- resume it;
- clone its state into a new generation;
- use it as hidden warm-start;
- weaken selector semantics to turn NO-GO into PASS.

### 4.4 Formal-v3 lesson remains active

GitHub workflow chaining / recursive event suppression exposed orchestration fragility.

The production-hosting migration is specifically intended to remove GitHub from routine production cadence and execution.

Do not solve a control-plane problem by weakening causal data semantics.

---

## 5. CP-5 closure — what actually happened

The old handoff froze #3291 at:

`ea31198d63b8d24ae04ec4b6522ac9e4b0486d96`

with four exact-head red workflows.

That is no longer the current state.

### 5.1 Original four red items

At `ea31198...` the major red items were:

1. control-plane generation / durable-anchor / dependency-digest selftest;
2. EA5E2 strict graph binding;
3. successor-runner structural acceptance;
4. persistent-24T immutable-base resolution.

They did not share one root cause.

### 5.2 EA5E2 requalification was legitimate

The planner correctly selected:

`REQUALIFY`

for the EA5E2 runtime dependency graph.

Do not rewrite that history as a false positive.

The original mismatch was between:

```text
expected graph digest
sha256:018c5d02cb5c2118e4dea329d74c083872117beb58c5e22c4a190b7a63f8358c

old carrier digest
sha256:e61c9f6298dba7dece25f6ec1c4968de729285314ea7c450e13edf8514b5672e
```

The correct response was to audit the 93-path graph and rebind lawfully, not force `CARRY_FORWARD` and not loosen graph acceptance.

### 5.3 EA5E2 carrier self-reference was ruled out

The evaluator normalizes the carrier marker before hashing.

The carrier being inside the graph does not create an impossible self-referential hash loop.

### 5.4 The EOF-newline trap

During the first carrier rebind, an accidental trailing newline changed the byte-level graph digest again.

This produced a misleading second expected digest (`584f...`) even though no semantic graph change had occurred.

The correct fix was to restore the original EOF byte shape, not chase the new hash with another semantic rebind.

Avoidance rule:

**When graph carriers are byte-hashed, preserve exact EOF/newline identity. Never assume a text editor's newline normalization is semantically inert.**

### 5.5 Successor-runner was an upstream-blocked false suspect

The successor-runner originally failed before executing its real runner semantics because the EA5E2 graph proof failed first.

After EA5E2 closure, the successor-runner passed.

Do not classify that old red run as a runner semantic defect.

### 5.6 Persistent-24T base invariant was stale

The old workflow required:

```text
pull_request.base.sha == protected main
```

but #3291 was intentionally stacked on frozen #3289.

That invariant was incompatible with the governed stacked qualification topology.

The fix was not to remove base validation.

The fix was to permit explicitly governed predecessor subjects while retaining fail-closed base identity.

### 5.7 Historical V3 symbols must not be aliased to V4 authority

A historical orchestration typecheck exposed removed V3 authority exports.

V3 and V4 pointed at different authority stores.

A compatibility alias would have lied about authority identity.

The adopted solution preserved frozen historical source blobs and created a successor-maintenance routing mode rather than falsifying V3 semantics.

### 5.8 Synthetic control-only fixture contamination

One CP2 selftest passed:

```text
changedPaths = [REGISTRY_PATH]
```

while simultaneously asserting that real EA5E2 / persistent workflow dependencies had changed.

That was internally inconsistent.

The fix was:

- current-generation selftest uses the real merge-base diff;
- future-generation synthetic test remains isolated synthetic input.

Avoidance rule:

**Never mix assertions derived from the real branch delta with a synthetic one-file fixture.**

### 5.9 Fresh requalification evidence became first-class

For checks that legitimately `REQUALIFY` but have no cheap local diagnostic, the control plane now supports durable immutable workflow-run requalification evidence.

The model binds at least:

- check identity;
- workflow name/path;
- run id;
- success conclusion;
- subject SHA;
- governed PR base;
- dependency subject;
- dependency digest;
- immutable binding hash;
- durable repository-side run snapshot;
- subject ancestry to current head.

The online GitHub verifier independently cross-checks the registered run identity.

Do not replace this with "the Actions page looks green".

### 5.10 Persistent CP-5 fresh evidence

Accepted evidence:

`LEGACY_AM19_24T_CP5_REQUAL_E76EA85C`

Source run:

`32937368439`

Source subject:

`e76ea85ccbbb51ddc21420a719ee7226e1ac9c76`

Current dependency digest consumed by final preflight:

`sha256:66b2cdbaf92c5a08863c189791af98b8acc6558cab9f9ee600d52f3c1890a492`

### 5.11 CP-5 final accepted predecessor

The CP-5 branch closed at:

`14653ba622bb12261a1ea79f3ea7e42be0b49f92`

This exact SHA became the governed predecessor for Phase 1.

---

## 6. Production Hosting Phase 1 — COMPLETED

### 6.1 Objective

Phase 1 frozen objective:

- lift production-worthy Runtime composition out of acceptance-only wiring;
- establish a formal ReplayHost/application composition;
- continue calling the existing canonical Runtime Kernel;
- preserve frozen CAP-08 semantics;
- prove `CAP08_FROZEN_REPLAY_EQUIVALENCE`.

This objective is now satisfied at PR #3297 exact head `8943c752...`.

### 6.2 Actual canonical entrypoint discovered during audit

The original guessed path `script/runtime_acceptance/...` was wrong.

The real CAP-08 entrypoint is:

`scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/qualification_workflow_entrypoint_v2.ts`

It loads authority-gated ports and enters:

`executeRunAQualificationHarnessV1`

The qualification harness is an orchestration shell, not the canonical tick core.

The important composition debt was below it in the single-run materializer / product-chain / port bundle.

### 6.3 `product_chain_v1.cjs` was not a simplified runner

Audit established that the CAP-08 product chain directly instantiates existing product Runtime classes, including canonical PostgreSQL repositories, forcing/input preparation, forecast/scenario tick services, receipt-consuming ticks, completion evidence, and corrected T16→T17 handoff.

That was important because Phase 1 must not create a second simplified Runtime path.

### 6.4 Acceptance-only S4 monkey patch was the key composition debt

The old CAP-08 loader/wiring used acceptance-side shared atomic persistence and private-field replacement around:

- S4 append-forward service repository;
- corrected-predecessor resolver repository;
- chain reader.

Copying `product_chain_v1.cjs` wholesale into production code would have productized qualification plumbing.

That approach was rejected.

### 6.5 Experimental PR #3293 was audited but not adopted as final implementation

Draft PR #3293 concentrated the old behavior into a ReplayHost composition but still used private-field mutation / type coercion to alter internal service dependencies.

It was useful as reference evidence, not final production-grade composition.

Avoidance rule:

**A test-path monkey patch does not become production architecture merely because it is moved under `apps/server`.**

### 6.6 Typed dependency injection was adopted

Final Phase 1 implementation adds typed dependency seams while preserving historical defaults.

Key files:

`apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.ts`

`apps/server/src/runtime/twin_runtime/cap08_s4_t17_corrected_predecessor_resolver_v1.ts`

New formal application composition:

`apps/server/src/runtime/twin_runtime/cap08_replay_host_composition_v1.ts`

The historical two-argument S4 constructor remains valid and preserves historical topology.

The successor ReplayHost can explicitly inject the shared repository through typed constructor dependencies.

No private-field mutation is required in the formal application composition.

### 6.7 Frozen CAP-08 product loader / product chain remain untouched

The Phase 1 static gate verifies that the frozen CAP-08 loader and product chain are not rewritten to make successor equivalence easier.

A qualification-only adapter binds the new formal factory into the successor replay lane.

Key adapter:

`scripts/runtime_acceptance/mcft_cap09_phase1_typed_replay_host_product_chain_v1.cjs`

This adapter is qualification plumbing, not the production composition itself.

### 6.8 Mandatory equivalence workflow

Workflow:

`mcft-cap-09-phase1-typed-cap08-frozen-replay-equivalence-v1`

Final exact-head run:

`32957101943`

Exact head:

`8943c752a354cb916cc7f144681203aa9a19f70b`

Result:

**SUCCESS**

Artifact:

`mcft-cap09-phase1-typed-cap08-frozen-replay-equivalence-2a3b3cd4131d0f6d588ae2ff6ea9ff206bc5d91a`

Artifact id:

`9602453133`

Artifact digest:

`sha256:d54f68a7f15e3a71c3f01b7652a8694a2cb93d1d5ad648ee99e2af12902cbd1e`

### 6.9 What the final equivalence run proved

The workflow executed:

- static typed-composition boundary proof;
- server typecheck;
- two independent disposable PostgreSQL 16 databases;
- frozen CAP-08 predecessor replay at `67bd71560268046a7fa9a9433ee074ad3999cb71`;
- exact-head typed ReplayHost successor replay;
- 24 ticks;
- 153 canonical receipts;
- 7 recovery vectors;
- CAP-07 read-model surfaces/request variants;
- normalized semantic response-body equality;
- final canonical semantic manifest equality.

Final gate artifact:

`MCFT_CAP_09_PHASE1_TYPED_CAP08_FROZEN_REPLAY_EQUIVALENCE_V1_RESULT.json`

Result fields include:

```text
status = PASS
semantic_equivalence = true
canonical_receipt_count = 153
historical_cap08_completion_reopened = false
production_runtime_activation = false
provider_request = false
formal_database_mutation = false
formal_v5_arm = false
graduation_effect = false
mcft_cap09_completed = false
```

### 6.10 Predecessor/successor semantic digest equality

Predecessor semantic manifest digest:

`sha256:aaeddac6877f9cd9fe5f358a3ab1b61cd4f741ebed598b827668d6408ff44c5d`

Successor semantic manifest digest:

`sha256:aaeddac6877f9cd9fe5f358a3ab1b61cd4f741ebed598b827668d6408ff44c5d`

Exact equality was achieved after fixing the comparison oracle, not by changing Runtime semantics.

### 6.11 CAP-07 visibility-instance trap

The first Phase 1B equivalence experiment failed with 48 differences.

All 48 differences were CAP-07 response/page `content_hash` / selector read-model surface hashes.

The underlying Runtime state, forecast/scenario, receipts, S4/S5 outputs, recovery, and table counts were already equal.

Root cause:

CAP-07 content hashes include PostgreSQL visibility snapshot identity (`pg_current_snapshot` / xmin/xmax/xip-derived identity).

Two independent disposable databases naturally have different transaction/snapshot identities.

The frozen CAP-07 contract explicitly allows a new visibility snapshot without declaring content divergence.

The correct oracle therefore:

- excludes physical database-instance / visibility-instance identity;
- excludes response-instance identity where frozen contract says it is non-semantic;
- continues comparing canonical response body semantics, item content, ordering, pagination semantics, Runtime objects, receipts, S4/S5 outputs, recovery, and table cardinality.

Avoidance rule:

**Do not demand equality of physical PostgreSQL snapshot hashes across independent databases. Do not respond by globally ignoring hashes either. Normalize only fields explicitly defined as instance identity and keep semantic payload equality strict.**

### 6.12 S4 successor requalification

Changing the typed S4 service seam correctly triggered historical S4 qualification attention.

The old boundary script used an enormous historical `git diff --check` range and failed on unrelated old Markdown whitespace before reaching S4 semantics.

The adopted fix preserved the historical boundary and added a successor-aware S4 requalification boundary scoped to the governed Phase 1 delta.

Full successor S4 qualification executed:

- successor boundary;
- server typecheck;
- 12 frozen vectors;
- fresh PostgreSQL bootstrap;
- exact S3 predecessor;
- S4 append-forward DB proof;
- cleanup.

Fresh success run during implementation:

`32952882706`

Final exact-head S4 workflow:

`32957102054` — SUCCESS.

Avoidance rule:

**Do not “repair” unrelated historical Markdown solely because a legacy global diff check scans years of history. Add a governed successor boundary that proves the actual changed semantic surface.**

### 6.13 EA5E2 during Phase 1

Phase 1 changes triggered `REQUALIFY` in the central planner because governed dependency catalogs changed.

The canonical EA5E2 93-path graph itself remained structurally valid.

Final exact-head EA5E2 run:

`32957102042` — SUCCESS.

Final graph remains:

```text
runtime_dependency_graph_count = 93
expected_dependency_graph_sha256 = sha256:018c5d02cb5c2118e4dea329d74c083872117beb58c5e22c4a190b7a63f8358c
carrier_dependency_graph_sha256 = sha256:018c5d02cb5c2118e4dea329d74c083872117beb58c5e22c4a190b7a63f8358c
static_gate_uncovered_paths = []
required_runtime_discovery_missing = []
```

Important distinction:

Planner dependency-digest change does not automatically mean the strict 93-path graph carrier changed.

Do not confuse the two digest layers.

### 6.14 Successor runner final result

Final exact-head workflow:

`mcft-cap-09-ea5e2-successor-runner-qualification`

Run:

`32957102171`

Result:

**SUCCESS**

### 6.15 Central control-plane ownership expanded for Phase 1

Phase 1 paths were added as explicit governed ownership in:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json`

Unknown changed paths remain fail-closed.

The solution was not to disable unknown-path rejection.

New check identity:

`PHASE1_TYPED_RUNTIME_COMPOSITION`

### 6.16 Phase 1 immutable requalification evidence

Evidence id:

`PHASE1_TYPED_RUNTIME_COMPOSITION_REQUAL_7AA34EA5`

Fresh source run:

`32952882654`

Evidence subject:

`7aa34ea50c81fcd843b4cd817746ff7eeb42376a`

Evidence base:

`14653ba622bb12261a1ea79f3ea7e42be0b49f92`

Dependency digest:

`sha256:bf2e5b8d78d7b6aea9ff7f76e0de836d44d9d1c9e2fcf6bdebf673d8402febea`

The evidence is repository-versioned and durable-anchored, then independently cross-checked against GitHub Actions run identity.

### 6.17 Governed predecessor-base set evolved explicitly

The requalification evidence model originally only understood the old frozen #3289 predecessor.

Phase 1 is intentionally stacked on the accepted CP-5 closure.

The valid successor-predecessor model was extended explicitly to include:

```text
3bbf096ee5cb73e8e0e0251dc400733d6cab501f
14653ba622bb12261a1ea79f3ea7e42be0b49f92
```

This is an allowlisted governed frontier, not an open "any PR base is valid" rule.

Avoidance rule:

**When the stack advances, extend the governed predecessor set explicitly. Never replace exact predecessor authority with a permissive branch-name or any-base check.**

### 6.18 Final central control-plane proof at Phase 1 head

Final workflow:

`mcft-cap-09-qualification-control-plane-v1`

Run:

`32957101877`

Exact head:

`8943c752a354cb916cc7f144681203aa9a19f70b`

Result:

**SUCCESS**

Artifact id:

`9602441570`

Artifact digest:

`sha256:af63d5c8c27509ceffb3dd23a9f1dd0624a444529a2ce0d601eaa51956c916a8`

Final non-fail-fast preflight:

```text
status = PASS
total_checks = 12
pass = 8
fail = 0
not_applicable = 4
carry_forward = 4
required = 0
requalify = 4
unknown = 0
forbidden = 0
authority_errors = 0
unknown_changed_paths = 0
blocker_count = 0
```

Final `REQUALIFY` checks that were accepted:

- `CONTROL_PLANE_INTEGRITY` — diagnostic PASS;
- `EA5E2_RUNTIME_DEPENDENCY_GRAPH` — full diagnostic PASS;
- `LEGACY_AM19_PERSISTENT_24T` — durable fresh requalification evidence PASS;
- `PHASE1_TYPED_RUNTIME_COMPOSITION` — durable fresh requalification evidence PASS.

### 6.19 Final ordinary CI

Workflow:

`ci`

Run:

`32957102051`

Result:

**SUCCESS**

Do not claim Phase 1 closure using only the special workflow; ordinary repository CI was also terminal green at the same exact head.

### 6.20 Final exact-head workflow matrix for #3297

At `8943c752...`, observed PR-triggered workflows were terminal SUCCESS, including:

- `mcft-cap-09-qualification-control-plane-v1` — `32957101877`;
- `mcft-cap-09-phase1-typed-cap08-frozen-replay-equivalence-v1` — `32957101943`;
- `mcft-cap-08-s4-late-evidence-append-forward` — `32957102054`;
- `mcft-cap-09-ea5e2-runtime-dependency-graph` — `32957102042`;
- `mcft-cap-09-ea5e2-successor-runner-qualification` — `32957102171`;
- `mcft-cap-09-ea5e2-live-window-preflight-hardening` — `32957102166`;
- `mcft-cap-08-authority-reconciliation` — `32957101955`;
- `mcft-cap-08-s1-base-runtime` — `32957102058`;
- `mcft-main-ruleset-readiness-v1` — `32957102071`;
- `mcft-delivery-policy-v2` — `32957102233`;
- `mcft-release-lane-v1` — `32957102286`;
- `mcft-candidate-declaration-selftest-v2` — `32957102557`;
- `ci` — `32957102051`.

This is the basis for saying **Phase 1 is complete**.

---

## 7. What Phase 1 did NOT do

Phase 1 did not:

- create the final Evidence Runtime host;
- create the final Twin Runtime long-running host;
- activate a production scheduler;
- call public providers in production;
- create `EvidenceSupplyCursor` production ownership;
- create `RuntimeTickCursor` production ownership;
- establish final Evidence producer lease/fencing;
- establish final Twin scheduler lease/fencing;
- perform database ACL split qualification;
- retire GitHub production ownership;
- arm Formal-v5;
- start O00;
- claim Graduation;
- claim MCFT-CAP-09 completion.

Phase 1 is composition extraction + equivalence only.

---

## 8. Current frontier — Phase 2

Frozen architecture Phase 2 title:

**Extract production Evidence provider modules**

At this handoff:

**NO Phase 2 implementation PR was found. Phase 2 implementation has not started.**

### 8.1 Phase 2 objective

Per frozen development route, Phase 2 must:

- remove source-generation / string-replacement / test-run identity dependence from production implementation;
- formalize provider acquisition modules;
- formalize raw retention modules;
- formalize decoder modules;
- formalize canonicalizer modules;
- formalize governed ingress modules;
- formalize visibility/readback modules;
- formalize `EvidenceSupplyCursor` modules;
- ensure qualification and future production Evidence host call the same production modules.

### 8.2 Explicit Phase 2 non-effect

**No live production activation in Phase 2.**

Phase 2 extracts production-worthy modules.

Phase 3 builds the long-running Evidence Runtime host around them.

Do not collapse Phase 2 and Phase 3 merely to move faster.

### 8.3 Architecture boundary for Phase 2

Evidence-side application modules should conceptually cover:

```text
apps/server/src/external_evidence/
    provider/
    retention/
    decoder/
    canonicalizer/
    ingress/
```

The exact final package path is not frozen.

The semantic requirement is frozen:

```text
GitHub qualification
and
Evidence Runtime production host
must call the same production provider/canonicalization modules
```

No separate simplified qualification provider implementation is allowed.

### 8.4 Evidence-plane ownership to preserve

Evidence plane may own:

```text
provider acquisition state
raw retention metadata
governed evidence ingress
provider watermark/acquisition state
EvidenceSupplyCursor
evidence producer lease/fence
visibility/readback evidence
```

Evidence plane must not gain direct mutation authority over:

```text
Twin state
Forecast
Scenario
RuntimeTickCursor
Runtime scheduler state
Twin checkpoint
Twin runtime terminal state
```

### 8.5 Twin plane must remain provider-free

During Phase 2 work, do not introduce any convenience fallback in Twin Runtime such as:

```text
missing governed Evidence
→ Twin Runtime calls provider
```

or:

```text
missing governed Evidence
→ Twin Runtime reads raw R2/S3
→ Twin Runtime decodes its own Evidence
```

Both are architecture violations.

---

## 9. Recommended Phase 2 first audit

Before writing new Evidence modules, perform a source-level extraction audit of the current CAP-09 provider/evidence path.

At minimum trace:

1. current external provider request entrypoints;
2. request policy / provider-watermark authority;
3. raw payload retention path;
4. KBS / other decoder implementations;
5. canonicalization path;
6. governed DB ingress / promotion path;
7. post-COMMIT readback / visibility proof;
8. any source rewriting / generated temp source;
9. any dependency on `GITHUB_RUN_ID`, workflow identity, runner `_temp`, or GitHub artifacts;
10. current cursor/progress representation;
11. idempotency keys;
12. retry/backoff state;
13. provider-specific vs canonical responsibilities;
14. tests that already use product modules vs tests that execute acceptance-only implementations.

Do not begin Phase 2 by guessing package names.

Build the import/effect graph first, as was done for Phase 1.

---

## 10. Phase 2 adoption criteria to establish before coding expands

The next engineer should define a machine-checkable Phase 2 gate before broad extraction.

Minimum expected properties:

- production provider modules contain no GitHub run identity dependency;
- production modules do not import acceptance scripts;
- production modules do not require source string replacement;
- production modules do not require generated temporary source files;
- qualification calls the same provider/decoder/canonicalizer modules intended for production;
- raw-retention-before-governed-ingress semantics remain preserved;
- provider availability watermark authority remains preserved;
- exact-source/exact-time causal semantics remain preserved;
- post-COMMIT visibility/readback semantics remain preserved;
- no Twin-state mutation is reachable from Evidence modules;
- no Runtime scheduler/cursor mutation is reachable from Evidence modules;
- provider request count remains zero unless the qualification lane explicitly authorizes a provider test;
- no Formal store is mutated;
- no production owner is activated.

Do not write a large host before these module-level boundaries are testable.

---

## 11. Important pitfalls from this conversation

### 11.1 Wrong canonical CAP-08 path

Bad assumption:

`script/runtime_acceptance/...`

Correct prefix:

`scripts/runtime_acceptance/...`

Always verify paths from repository facts before reasoning about composition.

### 11.2 `shell: node {0}` / runner `_temp` module resolution

Inline Actions scripts may execute from runner temporary directories.

Relative `require()` resolution can therefore differ from repository-root assumptions.

Avoid test designs that accidentally depend on `_temp` path semantics.

### 11.3 v14 generation selftest scope too broad

Future-generation synthetic tests must remain isolated from real branch delta.

Do not make a synthetic future-generation fixture consume current branch mutations unless that is explicitly the test.

### 11.4 GitHub Actions artifact retention is not durable authority

Artifacts expire.

Historical carry-forward / requalification identity must be repository-versioned and cryptographically anchored.

Live artifacts are cross-checks, not the only durable record.

### 11.5 Correct `REQUALIFY` must not be forced to `CARRY_FORWARD`

A red gate caused by a real governed dependency change is not a nuisance to be silenced.

Execute the original qualification or produce valid fresh requalification evidence.

### 11.6 Synthetic control-only case polluted by real branch diff

Keep synthetic fixtures synthetic.

Keep real exact-head plan tests based on real merge-base diffs.

Do not mix them.

### 11.7 Partial green does not equal exact-head green

Always enumerate every relevant PR-triggered workflow for the current exact SHA.

Do not quote a prior green head after the branch has moved.

### 11.8 S4 old global diff check scanned irrelevant history

Legacy checks that scan from an ancient baseline may fail on unrelated historical formatting.

Do not mutate history to satisfy them.

Create an explicit successor requalification boundary with frozen authority and current semantic delta.

### 11.9 Private-field mutation is not production-grade dependency injection

The #3293 reference implementation concentrated monkey patches but did not eliminate them.

Final Phase 1 used typed constructor dependencies.

Use #3293 as audit history, not a pattern to extend.

### 11.10 CAP-07 physical snapshot identity is not semantic equality

Cross-database replay equivalence must not compare physical PostgreSQL transaction/snapshot identities as domain semantics.

Normalize only frozen instance-identity fields.

Keep actual response-body semantics strict.

### 11.11 Planner dependency digest and EA5E2 graph carrier digest are different layers

A planner resolver digest may change even when the strict 93-path EA5E2 graph carrier remains valid.

Inspect both artifacts before rebinding a carrier.

### 11.12 Do not confuse R2 raw retention with governed Runtime Evidence

Raw retention is an Evidence-plane durability mechanism.

Twin Runtime authority is governed DB Evidence.

Twin Runtime must not consume raw R2 as a fallback evidence path.

### 11.13 GitHub must not remain the hidden production clock

Moving code into containers is insufficient if GitHub still owns hourly wake, provider cadence, slot claim, tick execution, or recovery.

Phase 6 explicitly removes those production owners.

### 11.14 Evidence and Twin Runtime must not share one operational cursor/lease

Each plane has its own exactly-one production owner and its own durable progression authority.

Do not create a shared lease that re-couples both planes.

### 11.15 Hosting migration does not reopen CAP-01→08

Do not re-run capability completion as if productization invalidated accepted semantics.

Use semantic-equivalence and dependency-governed requalification.

### 11.16 Do not assign all red workflows one root cause

This conversation repeatedly found independent failure classes:

- stale base invariant;
- strict graph rebind;
- synthetic fixture mismatch;
- historical source compatibility;
- physical visibility identity;
- old global diff scope.

Diagnose exact failed steps independently.

### 11.17 Byte-level EOF matters for digest carriers

Do not allow formatting tools to silently add/remove terminal newlines in byte-hashed authority carriers.

### 11.18 Branch ancestry is authority, not convenience

#3297 intentionally proves both CP-5 closure and Phase 0A architecture freeze as ancestors.

Do not casually rebase away that ancestry without rebuilding qualification evidence.

---

## 12. Experimental branches / PRs — how to treat them

### 12.1 #3293

Draft PR #3293 was an early Phase 1 implementation/reference.

It demonstrated useful behavior but retained private-field mutation.

Do not adopt it as the final production composition.

### 12.2 #3294

Draft PR #3294 was an early equivalence proof/reference.

Its first equality oracle over-counted CAP-07 physical visibility identity and therefore failed despite domain semantics already matching.

The corrected normalization principle was carried into final #3297 proof.

Treat #3294 as experiment/audit history, not the final Phase 1 authority.

---

## 13. Current control-plane semantics after Phase 1

The central planner still uses:

```text
REQUIRED
CARRY_FORWARD
REQUALIFY
NOT_APPLICABLE
FORBIDDEN
UNKNOWN
```

Hard rules remain:

- unknown changed path fails closed;
- no regex fallback for governed dependency ownership;
- dependency resolvers must materialize;
- carry-forward requires unchanged governed dependency digest and durable evidence;
- `REQUALIFY` executes original qualification or consumes valid fresh immutable requalification evidence;
- failed Formal-v4 reuse remains FORBIDDEN;
- generation authority comes from existing Formal-store authority, not inferred database names.

Phase 2 must register its governed paths/checks in this control plane rather than adding ad-hoc exceptions.

---

## 14. Production-hosting route after Phase 1

Current route:

### Phase 0 — historical authority freeze

**DONE / PRESERVED**

### Phase 0A — production-hosting architecture freeze

**DONE / FROZEN at `2f7a065...`**

### Phase 1 — common Runtime composition extraction

**DONE / PASS at #3297 `8943c752...`**

Mandatory `CAP08_FROZEN_REPLAY_EQUIVALENCE`:

**PASS**

### Phase 2 — production Evidence module extraction

**CURRENT FRONTIER / NOT STARTED**

### Phase 3 — Evidence Runtime host

**NOT STARTED / BLOCKED ON PHASE 2**

### Phase 4 — Twin Runtime host

**NOT STARTED**

### Phase 5 — production-equivalent two-service accelerated 24T

**NOT STARTED**

### Phase 6 — production ownership cutover proof

**NOT STARTED**

### Phase 7 — fresh Formal-v5

**NOT STARTED / FORBIDDEN UNTIL PHASES 0–6 ACCEPTED**

---

## 15. Next engineer — first 60 minutes

### Minute 0–10 — exact-state verification

Confirm:

- protected main is still `26c1383f7f45abb76c99e28ec3d06714e85d1b2c`;
- #3291 head is still `14653ba622bb12261a1ea79f3ea7e42be0b49f92`;
- #3297 head is still `8943c752a354cb916cc7f144681203aa9a19f70b`;
- #3297 remains Draft/open unless explicitly authorized otherwise;
- Phase 1 final workflow matrix has not been invalidated by a new head.

If any SHA has changed, stop and reconstruct the exact-head evidence before continuing.

### Minute 10–20 — reread frozen Phase 2 requirements

Read architecture sections covering:

- provider implementation extraction;
- physical visibility versus independent audit;
- GitHub target role;
- backpressure/missing-evidence behavior;
- production-equivalent qualification;
- Phase 2 development route.

### Minute 20–40 — build current Evidence-path graph

Trace current provider/evidence code from provider request through:

```text
provider request
→ raw retention
→ decoder
→ canonicalizer
→ governed ingress
→ commit
→ readback/visibility proof
→ evidence authority available to Runtime
```

Mark every edge that depends on:

- acceptance script;
- generated source;
- string replacement;
- GitHub run identity;
- workflow artifact;
- test-only process spawning;
- temporary filesystem path.

### Minute 40–50 — identify first extraction seam

Select the smallest production-worthy module boundary that can be extracted without starting a long-running host.

Prefer explicit typed ports and pure application modules.

Do not start with Docker/Compose.

### Minute 50–60 — design Phase 2 qualification gate

Before broad implementation, define:

- governed Phase 2 resolver paths;
- central control-plane check identity;
- negative effect assertions;
- qualification-vs-production same-module proof;
- raw-retention / visibility invariants;
- provider-call authorization boundary.

Then open a bounded Phase 2 implementation branch stacked on accepted #3297 only after exact ancestry is confirmed.

---

## 16. Recommended branch discipline for Phase 2

Do not implement Phase 2 on:

- protected main;
- frozen #3289;
- #3291 CP-5 branch;
- #3297 Phase 1 branch unless the change is strictly required to repair Phase 1 evidence.

Preferred direction:

```text
#3297 exact accepted Phase 1 head
        ↓
new bounded Phase 2 implementation branch
        ↓
Phase 2 provider-module extraction PR
```

If Phase 2 needs the architecture document as ancestry, preserve that ancestry explicitly rather than copying the document into an unrelated history without explanation.

Keep Phase 2 separate from Phase 3 long-running host construction.

---

## 17. Phase 2 hard non-effects

A Phase 2 PR should explicitly prove:

```text
production_evidence_runtime_activation = false
production_twin_runtime_activation = false
provider_routine_production_owner_activation = false
runtime_scheduler_owner_activation = false
formal_database_mutation = false
formal_v5_arm = false
formal_v5_o00_start = false
graduation_effect = false
mcft_cap09_completed = false
```

A qualification provider request may be permitted only in an explicitly bounded provider test lane whose effect is part of the qualification contract.

Do not allow a test provider call to become routine production ownership.

---

## 18. Things the next engineer must NOT do

Do not:

1. merge #3292 merely to make the architecture doc easier to read;
2. merge #3297 merely because Phase 1 is green unless merge authorization is explicit;
3. start Phase 3 before Phase 2 modules are extracted and qualified;
4. put public-provider code inside Twin Runtime;
5. make Twin Runtime read raw R2/S3 as a fallback;
6. make Evidence Runtime mutate Twin state/Forecast/Scenario;
7. share EvidenceSupplyCursor and RuntimeTickCursor;
8. share one production lease between both planes;
9. use GitHub scheduled workflows as the target production clock;
10. reuse failed Formal-v4 state;
11. re-open CAP-08 completion;
12. create a simplified qualification-only provider implementation;
13. hide new Phase 2 paths from the central control plane;
14. force `CARRY_FORWARD` when Phase 2 changes a governed dependency;
15. compare physical PostgreSQL snapshot identity as cross-database semantic equality;
16. weaken causal forcing/provider availability semantics to make hosting easier;
17. treat artifact retention as durable operational authority;
18. start Formal-v5 before Phase 6 cutover/outage-independence proof.

---

## 19. Current completion statement

At this handoff the correct statement is:

```text
CP-5 qualification control plane
= CLOSED / PASS

Production Hosting Phase 1
= CLOSED / PASS

CAP08_FROZEN_REPLAY_EQUIVALENCE
= PASS

Production Hosting Phase 2
= NOT STARTED / CURRENT FRONTIER

MCFT-CAP-09
= IN PROGRESS / NOT COMPLETE

Formal-v5
= NOT ARMED / BLOCKED ON PHASES 2–6
```

Do not revert to the earlier handoff wording:

```text
CP-5 exact-head requalification closure
        ↓
Phase 1 canonical composition extraction
```

That frontier has been completed.

The new frontier is:

```text
Phase 2 production Evidence module extraction
        ↓
Phase 3 Evidence Runtime host
        ↓
Phase 4 Twin Runtime host
```

with Phases 5–7 remaining downstream.

---

## 20. Final handoff sentence

The next engineer should **not touch Formal-v5, production scheduling, or Docker host ownership first**. Start by auditing and extracting the current CAP-09 external Evidence acquisition/canonicalization path into production-grade modules that can be called identically by qualification and the future Evidence Runtime, while preserving raw-retention-first, provider-watermark, causal identity, governed ingress, post-COMMIT visibility, and strict separation from Twin Runtime state mutation.
