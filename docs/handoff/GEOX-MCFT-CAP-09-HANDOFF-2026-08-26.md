# GEOX MCFT-CAP-09 Conversation Handoff — 2026-08-26 — Production Hosting Phase-1 Frontier

Status: **CONVERSATION HANDOFF / CURRENT FRONTIER — NOT MASTER-TASK AUTHORITY**

Timestamp: **2026-08-26 12:28 +08:00**

Repository: `liyongshang44-max/GEOX`

Purpose: hand off the exact MCFT-CAP-09 engineering frontier after the qualification-control-plane work, the MCFT-01→09 architecture re-audit, and the production-hosting architecture freeze.

> This handoff supersedes the earlier 2026-08-26 conversation handoff in Draft PR #3290 for **current-conversation state only**.
> It does not supersede `docs/SSOT.md`, the MCFT Master Task Line, any CAP Taskbook, accepted historical authority, or immutable Formal-v4 NO-GO evidence.

---

## 0. READ THIS FIRST — mandatory authority order

Before changing any MCFT-CAP-09 runtime, workflow, schema, database, provider, scheduler, Compose service, or Formal activation logic, the next engineer **MUST** reconstruct authority in this order:

1. repository-level SSOT / frozen repository authority;
2. MCFT Master Task Line / total task book;
3. the individual CAP Taskbooks relevant to the change;
4. immutable accepted predecessor evidence for CAP-01→08;
5. immutable Formal-v4 NO-GO authority;
6. the frozen v13 successor subject in Draft PR #3289;
7. the qualification-control-plane work in Draft PR #3291;
8. the production-hosting architecture freeze in Draft PR #3292;
9. only then this conversation handoff.

### 0.1 The most important new mandatory reading

**Do not start Phase 1 implementation until you have read this exact frozen development-route document in full:**

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

It is currently **NOT on protected `main`**.

Read it from either:

- Draft PR **#3292** branch: `docs/mcft-cap09-production-hosting-architecture-v1`; or
- exact commit: `2f7a065cc95e4a5a2c95411fb381fe5e4479d645`.

That file is marked:

`FROZEN DEVELOPMENT ROUTE — ARCHITECTURE FREEZE — DOCS ONLY`

It freezes the **successor development route** after a full MCFT-01→09 architecture audit.

It does **not** override the Master Task Line or any CAP Taskbook.

It exists specifically to prevent the next engineer from repeating the wrong migration assumption that all MCFT-9 production responsibilities should be moved into one `twin-runtime` Docker service.

### 0.2 Three different numbering systems exist — do not mix them

**CAP numbering:** `MCFT-CAP-01` … `MCFT-CAP-09`.

**Qualification control-plane phases:** `CP-0` … `CP-5` only.

**Production-hosting migration phases:** `Phase 0`, `Phase 0A`, `Phase 1` … `Phase 7`.

There is no frozen `CP-6` in the qualification-control-plane handoff.

`Phase 6` in the production-hosting route is **not** `CP-6`.

---

## 1. Current task in one sentence

We are closing the MCFT-CAP-09 qualification-control-plane CP-5 exact-head blockers and then beginning **Phase 1: canonical Runtime composition extraction + CAP-08 semantic-equivalence proof**, under the newly frozen two-plane production architecture where **Live Evidence Runtime and Twin Runtime are independent long-running production roles and GitHub exits production cadence/execution**.

---

## 2. Exact repository / PR / SHA matrix

### 2.1 Protected main

`main = 26c1383f7f45abb76c99e28ec3d06714e85d1b2c`

Treat this exact SHA as protected baseline until an explicitly authorized merge changes it.

Do not merge docs-only PRs merely for visibility if doing so would invalidate an exact-main qualification chain.

### 2.2 Frozen v13 successor implementation subject

Draft PR: **#3289**

Branch: `fix/mcft-cap09-v13-autonomous-forcing-foundation`

Base: `26c1383f7f45abb76c99e28ec3d06714e85d1b2c`

Frozen head:

`3bbf096ee5cb73e8e0e0251dc400733d6cab501f`

Rules:

- do not modify;
- do not rebase;
- do not rewrite;
- do not force-push;
- do not treat it as MCFT-CAP-09 completion;
- do not treat it as v13 post-merge qualification;
- do not treat it as Graduation;
- do not start Formal-v5 from it merely because its structural checks passed.

### 2.3 Qualification control-plane stream

Draft PR: **#3291**

Title: `feat(mcft-cap09): centralize qualification applicability and blocker inventory`

Branch: `fix/mcft-cap09-qualification-control-plane-v1`

Base: frozen #3289 head `3bbf096ee5cb73e8e0e0251dc400733d6cab501f`

Current exact head at handoff:

`ea31198d63b8d24ae04ec4b6522ac9e4b0486d96`

Latest commit message:

`fix(mcft-cap09): freeze CP4 synthetic dependency baseline`

Status:

**DRAFT / OPEN / CP-5 NOT CLOSED / EXACT HEAD NOT ALL GREEN**

### 2.4 Production-hosting architecture freeze

Draft PR: **#3292**

Title: `docs(mcft-cap09): freeze production hosting architecture route v1`

Branch: `docs/mcft-cap09-production-hosting-architecture-v1`

Exact commit:

`2f7a065cc95e4a5a2c95411fb381fe5e4479d645`

Base: protected `main @ 26c1383...`

File:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

Status:

**DOCS ONLY / FROZEN DEVELOPMENT ROUTE / NOT MERGED**

### 2.5 Previous handoff

Draft PR: **#3290**

Old handoff branch:

`docs/mcft-cap09-handoff-2026-08-26-v13-control-plane-frontier`

Old handoff commit:

`62c9fa95397e7c3aa4d6d2748eb986962a7673b3`

The old handoff described the v13 qualification-control-plane frontier before the production-hosting architecture audit.

This new handoff supersedes it for current conversation state.

### 2.6 This new handoff branch

Branch:

`docs/mcft-cap09-handoff-2026-08-26-production-hosting-phase1`

Base:

`26c1383f7f45abb76c99e28ec3d06714e85d1b2c`

Artifact:

`docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-26.md`

Keep this branch docs-only.

---

## 3. What changed since the earlier 2026-08-26 handoff

The earlier handoff correctly identified a missing qualification applicability/control-plane layer.

Since then, four material developments occurred:

1. the central qualification applicability/control-plane was implemented substantially in #3291;
2. CP-4 negative cases and evidence/digest semantics were strengthened;
3. CP-5 began with EA5E2 as the first real planner consumer, but exact-head requalification is still red;
4. a full MCFT-01→09 architecture re-audit changed the production-hosting conclusion from a single `twin-runtime` service to **two isolated production planes**: Evidence Runtime and Twin Runtime.

The fourth item is the most important architecture correction in this conversation.

Do not continue from the earlier assumption that:

`GitHub MCFT-9 -> one Docker twin-runtime`

The frozen successor architecture is:

`External Providers -> Evidence Runtime -> governed storage -> Twin Runtime -> canonical twin state`

with GitHub outside the production execution loop.

---

## 4. Historical authority that remains frozen

### 4.1 CAP-01→07

Treat their accepted completion as historical authority.

Do not reopen them merely because production hosting is being extracted.

### 4.2 CAP-08

CAP-08 Stage 1A bounded replay closure remains accepted historical authority.

Do not rewrite its historical closure.

Phase 1 exists to extract composition with a semantic-equivalence proof, not to re-litigate CAP-08 completion.

### 4.3 Formal-v4

Formal-v4 remains immutable NO-GO / DEAD / AUDIT-ONLY.

Known failed-v4 database:

`geox_mcft_cap09_s6_formal_t4r1_24h_v4`

Known failure:

O08 / `2026-08-25T12:00:00Z` had no causal current-interval forcing pair.

The runtime failed closed correctly.

Do not:

- repair the failed epoch;
- insert forcing late into the failed epoch;
- resume the failed epoch;
- reuse the failed-v4 DB as a new generation;
- clone its state into v13/v5;
- use it as a hidden warm-start;
- convert its NO-GO into a PASS by changing selector semantics.

### 4.4 Formal-v3 lesson

Formal-v3 exposed a GitHub orchestration/control-plane failure.

A major historical failure mode involved GitHub Actions trigger semantics / `GITHUB_TOKEN` recursive-event suppression.

The lesson is not to loosen causal data selection.

The lesson is that production evidence cadence/runtime progression must not depend on GitHub workflow chaining.

---

## 5. #3289 — frozen v13 successor subject

#3289 remains the implementation predecessor for the qualification-control-plane work.

It introduced/froze v13 successor mechanics around autonomous forcing, next-tick viability, persistence, fencing, schema, and related evidence.

Important non-effects:

- it does not provision the final Formal-v5 epoch;
- it does not make v13 qualification complete;
- it does not authorize Graduation;
- it does not authorize production activation;
- it does not authorize GitHub as the final production scheduler;
- it does not supersede the Taskbook separation between Internet Evidence collection and Runtime.

One particularly important frozen authority fact is:

`exact_one_production_owner_per_role_required_before_effectiveness = true`

This means the system is allowed — and now expected — to have separate exactly-one owners for different production roles.

Specifically, the new hosting route can require:

- exactly one Evidence production owner;
- exactly one Twin Runtime production owner;

without violating the frozen v13 authority.

---

## 6. #3291 qualification control plane — what has been implemented

### 6.1 Purpose

#3291 exists to stop repeated qualification drift where every changed file caused ad-hoc reasoning about which old proofs still apply.

The control plane centralizes:

- check identity;
- owner;
- generation scope;
- authority refs;
- dependency resolvers;
- execution workflow status;
- carry-forward evidence;
- requalification triggers;
- fail policy;
- applicability stage;
- blocker inventory.

### 6.2 Core files

Current control-plane files include:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json`

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json`

`scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs`

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs`

`scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs`

`.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml`

First CP-5 consumer:

`.github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml`

Related strict binding carrier:

`scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs`

### 6.3 Decision states

The planner uses:

`REQUIRED`

`CARRY_FORWARD`

`REQUALIFY`

`NOT_APPLICABLE`

`FORBIDDEN`

`UNKNOWN`

### 6.4 Dependency semantics

Frozen design direction:

- exact path sets;
- import closure;
- generated dependency graphs;
- no regex fallback;
- unknown changed path fails closed;
- transitive dependencies must be visible;
- dependency digest must be recomputable;
- evidence carry-forward requires unchanged governed dependency semantics.

### 6.5 Generation semantics

Generation context is taken from existing Formal-store authority.

Do not infer generation from database names.

Do not make up a `v5` generation field from naming.

### 6.6 Evidence semantics

Carry-forward now requires more than a green historical run.

It requires:

- immutable evidence identity;
- subject match;
- durable repository-side anchor;
- valid check binding;
- unchanged governed dependency digest;
- no forbidden failed-generation reuse.

GitHub Actions artifacts are useful live cross-checks but are not permanent historical authority because retention expires.

### 6.7 Failed-v4 evidence

Failed-v4 reuse is explicitly `FORBIDDEN` based on existing Formal-store authority.

Never downgrade that to `UNKNOWN` or `CARRY_FORWARD` merely to make a gate green.

### 6.8 CP-4

CP-4 negative matrix was expanded to cover at least:

- known unchanged dependency;
- known changed dependency;
- unknown changed path;
- transitive/shared dependency;
- historical evidence mutation;
- duplicate check ID;
- missing authority ref;
- missing artifact/evidence ref;
- generation N/A;
- failed-v4 reuse FORBIDDEN;
- non-fail-fast enumeration.

Several intermediate exact heads were green for CP-4.

However the **current exact #3291 head must be judged independently**.

### 6.9 CP-5

CP-5 started by migrating EA5E2 runtime dependency graph workflow to consume the central planner.

Required routing behavior:

`CARRY_FORWARD` -> validate durable evidence + dependency digest and skip full graph only when legitimate.

`REQUALIFY` / `REQUIRED` -> execute the original full qualification.

`NOT_APPLICABLE` -> machine-recorded skip.

`FORBIDDEN` / `UNKNOWN` -> fail closed.

`workflow_dispatch` -> full qualification; do not allow manual dispatch to bypass requalification.

### 6.10 Critical current fact: CP-5 is NOT CLOSED

At handoff, #3291 exact head:

`ea31198d63b8d24ae04ec4b6522ac9e4b0486d96`

has multiple failed workflows.

Do not quote an older green head.

Do not say #3291 is all green.

---

## 7. #3291 current exact-head failures

### 7.1 Control-plane workflow

Workflow:

`mcft-cap-09-qualification-control-plane-v1`

Run:

`32922219373`

Exact head:

`ea31198d63b8d24ae04ec4b6522ac9e4b0486d96`

Job:

`98037876437`

Observed step state:

- Checkout exact control-plane subject — PASS;
- Require frozen stacked predecessor and zero production bindings — PASS;
- Prove central applicability semantics — PASS;
- **Prove generation, durable-anchor, and dependency-digest semantics — FAIL**;
- later plan/preflight/validation steps skipped;
- artifact upload executed.

Important:

The handoff does **not** assert the exact root cause of this current run unless its exact failed-step log is inspected.

Next engineer must inspect this exact run, not infer from an older failure.

### 7.2 EA5E2 runtime dependency graph workflow

Workflow:

`mcft-cap-09-ea5e2-runtime-dependency-graph`

Run:

`32922219401`

Job:

`98037876453`

Routing behavior was correct:

- checkout exact subject — PASS;
- exact PR head identity — PASS;
- central applicability plan — PASS;
- route EA5E2 — PASS;
- planner selected **REQUALIFY**;
- full EA5E2 qualification ran;
- **full EA5E2 graph qualification failed**.

Planner summary on this exact head:

`status = PASS`

`generation = v13`

`base = 3bbf096ee5cb73e8e0e0251dc400733d6cab501f`

`head = ea31198d63b8d24ae04ec4b6522ac9e4b0486d96`

`unknown_changed_paths = []`

`authority_errors = []`

`resolver_errors = []`

Decision counts:

- REQUIRED: 0;
- CARRY_FORWARD: 5;
- REQUALIFY: 2;
- NOT_APPLICABLE: 4;
- FORBIDDEN: 0;
- UNKNOWN: 0.

Control-plane integrity = `REQUALIFY`.

EA5E2 runtime dependency graph = `REQUALIFY`.

Other eligible frozen checks carry forward.

Current EA5E2 check-level dependency digest:

`current = sha256:8c20d8394949d7ae97fb5edb06c0263053d7a27e544e3bd6f78fd4b8df732ad3`

`historical = sha256:755b4e1c1bae0f94281c2a5f2bd0f056399944d0e3404e58b4de99e330ac0200`

Changed governed dependencies include:

`.github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml`

`scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs`

Full 93-path graph result:

`expected_dependency_graph_sha256 = sha256:018c5d02cb5c2118e4dea329d74c083872117beb58c5e22c4a190b7a63f8358c`

`carrier_dependency_graph_sha256 = sha256:e61c9f6298dba7dece25f6ec1c4968de729285314ea7c450e13edf8514b5672e`

Error:

`EA5E2_ROLLING_RUNTIME_DEPENDENCY_GRAPH_V4_UNBOUND`

Observed properties:

- `digestMatch = false`;
- no missing graph paths;
- no uncovered graph paths;
- carrier remains critical;
- this is a strict binding mismatch, not a planner routing bug.

Required repair direction:

Recompute/review the intended 93-path graph change.

If every changed path is intended, requalify the binding carrier to the exact expected current graph digest.

Do **not** force `CARRY_FORWARD`.

Do **not** loosen the graph acceptance.

Do **not** update a digest blindly without reviewing the path delta.

### 7.3 EA5E2 successor runner qualification

Workflow run:

`32922219347`

Observed:

`acceptance` job `98037876466` failed.

Steps:

- checkout exact qualification subject — PASS;
- setup Node — PASS;
- setup pnpm — PASS;
- install dependencies — PASS;
- **Run structural acceptance — FAIL**;
- later runtime graph / delayed-forcing guard / successor-runner execution were skipped;
- `require-acceptance` failed because acceptance failed.

Do not automatically label this as the same EA5E2 digest root cause until its exact failed log is inspected.

It is likely related to the same changed structural surface, but that is not yet frozen fact in this handoff.

### 7.4 Amendment-19 persistent 24T qualification

Workflow run:

`32922219348`

Observed:

`detect-base-sha` job `98037876489` failed.

Steps:

- checkout exact qualification subject — PASS;
- **Resolve immutable qualification base — FAIL**;
- later steps skipped.

This is a distinct preflight/base-resolution failure at the current exact head.

Inspect the exact failed-step log before modifying anything.

Do not assume it is an EA5E2 digest problem.

### 7.5 What to do with these four failures

Priority:

1. close the exact EA5E2 graph binding mismatch with reviewed intended path delta;
2. rerun exact head;
3. inspect current control-plane generation/digest proof failure;
4. inspect successor-runner structural acceptance failure;
5. inspect persistent-24T immutable-base failure;
6. only call CP-5 closed after all applicable exact-head workflows reach terminal success or explicit N/A.

---

## 8. MCFT-01→09 architecture re-audit — corrected conclusion

The major architecture correction from this conversation is:

**Do not put all MCFT-9 production responsibilities into one `twin-runtime` Docker service.**

The Master Task Line and CAP-09 Taskbook require Live Internet Evidence collection and Runtime to remain separated.

Twin Runtime must read already governed Evidence.

Twin Runtime must not call public providers.

The production architecture therefore requires at least two independent long-running roles:

1. **GEOX Evidence Runtime**;
2. **GEOX Twin Runtime**.

GitHub exits production cadence/execution and remains CI, qualification, deployment, and independent audit.

---

## 9. MCFT-01→09 capability map after the re-audit

### CAP-01

First-Class Water State Estimate.

Replay/bootstrap capability.

Key semantics:

- A0 bootstrap;
- reality binding;
- evidence window;
- bootstrap state;
- lineage;
- checkpoint;
- persisted next-tick handoff;
- PostgreSQL persistence.

It is not a continuous scheduler.

Future production reuse belongs in the canonical Runtime Kernel/composition, not in a CAP-01 daemon.

### CAP-02

Hourly Dynamics and Persistence.

`Hourly` means exact logical-hour semantics, not real-world hosting cadence.

Key semantics:

- previous persisted State;
- exact logical hour;
- propagation;
- persistence;
- next checkpoint;
- 24 contiguous ticks;
- restart/resume;
- bounded forward backfill;
- failure recovery;
- idempotency.

`24 persisted continuation ticks != continuous production Runtime`.

### CAP-03

Observation Assimilation.

Kernel semantics:

- observation selection;
- innovation;
- bounded assimilation;
- posterior State;
- evidence-window and recovery semantics.

Remain canonical Runtime Kernel.

### CAP-04

72h Forecast + Scenarios.

Kernel semantics:

- posterior -> Forecast;
- A1 atomic commit;
- Scenario B commit;
- blocked forecast behavior;
- range/restart/backfill/recovery.

CAP-09 must call this canonical semantic path; do not reimplement forecast/scenario for online hosting.

### CAP-05

Human Decision + Execution Feedback.

Production-hosting extraction may reuse:

- trustworthy action/execution Evidence consumption;
- residual semantics;
- feedback linkage.

Production-hosting extraction must not introduce:

- automatic recommendation;
- automatic approval;
- automatic dispatch;
- device command.

CAP-05 does not authorize turning `twin-runtime` into an action execution engine.

### CAP-06

Calibration Candidate + Historical Replay Shadow Evaluation.

This is governance/replay work, not online self-learning.

Future host form:

`one-shot governed job`

not a resident hourly loop.

Historical lesson:

CAP-06 already demonstrated that frozen taskbooks plus repeated ad-hoc prerequisites can become a `TASKBOOK_DESIGN_DEFECT`.

Do not repeat that pattern in CAP-09 by endlessly layering workflow gates instead of fixing hosting architecture.

### CAP-07

Minimal Field Twin Read Model and Timeline.

Belongs to the existing server/API read surface.

Do not move it into `twin-runtime`.

Correct direction:

`Twin Runtime writes canonical state -> Postgres -> GEOX Server/CAP-07 APIs -> UI/operator`

### CAP-08

24-Tick End-to-End Closure.

Bounded Replay / Stage 1A.

GitHub as bounded qualification host is acceptable.

Current debt:

some real application composition/wiring remains in `scripts/runtime_acceptance`.

Do not reopen CAP-08 closure.

Phase 1 must extract composition and prove semantic equivalence.

### CAP-09

Shadow-Online Promotion / first real long-lived real-clock operating layer.

This is where production hosting needs:

- actual UTC boundaries;
- long-lived processes;
- durable scheduler/cursors;
- live evidence flow;
- lease/fencing;
- restart recovery;
- continuous health.

It must be decomposed into Evidence Plane and Twin Runtime Plane.

---

## 10. Frozen production topology

Target topology:

```text
External Providers
      |
      v
GEOX Evidence Runtime
  provider acquisition / cadence
  raw retention
  decoder / canonicalizer
  governed ingress
  EvidenceSupplyCursor
  evidence lease/fencing
  post-COMMIT visibility mechanics
      |                 \
      v                  v
   R2 / S3           Neon / Postgres
 raw provenance       governed Evidence
                         |
                         v
                  GEOX Twin Runtime
                  DatabaseEvidenceAdapter ONLY
                  RuntimeTickCursor
                  real scheduler
                  runtime lease/fencing
                  canonical tick
                  state / assimilation
                  forecast / scenario
                  checkpoint / recovery / health
                         |
                         v
                  canonical state/facts
                         |
                         v
                    GEOX Server
                    CAP-07 APIs
                         |
                         v
                    Operator / UI
```

Existing `jobs`, `executor`, `telemetry-ingest`, `mqtt`, `web` keep their existing responsibilities unless separately authorized.

Do not use this migration as an excuse to redraw unrelated commercial-v1 service boundaries.

---

## 11. Evidence Runtime frozen responsibilities

Evidence Runtime may own:

- external provider HTTP/API access;
- provider cadence/acquisition scheduling;
- raw immutable retention;
- R2/S3 raw object persistence;
- provider watermark/provenance;
- decoder;
- canonicalizer;
- governed Evidence ingress;
- EvidenceSupplyCursor;
- evidence producer lease/fencing;
- post-COMMIT fresh readback / physical visibility mechanics;
- evidence-runtime health/restart state.

Evidence Runtime must not own:

- twin State mutation;
- Forecast mutation;
- Scenario mutation;
- RuntimeTickCursor;
- runtime tick claim;
- runtime checkpoint;
- recommendation;
- approval;
- dispatch;
- device command;
- model activation.

---

## 12. Twin Runtime frozen responsibilities

Twin Runtime may own:

- read governed database Evidence;
- RuntimeTickCursor;
- actual runtime scheduler;
- runtime lease/fencing;
- tick claim;
- bootstrap;
- State propagation;
- observation assimilation;
- Forecast;
- Scenario;
- checkpoint;
- restart/recovery;
- bounded catch-up under frozen authority;
- runtime health;
- successor viability;
- runtime trace/audit facts.

Twin Runtime must not:

- call public Internet providers;
- possess provider credentials;
- download raw provider payloads;
- use R2 raw data as an emergency fallback;
- decode/canonicalize raw provider payloads;
- mutate provider watermarks;
- mutate EvidenceSupplyCursor;
- perform recommendation/approval/dispatch/device commands;
- activate calibration/model candidates.

---

## 13. Storage authority and ACL invariants

### 13.1 R2/S3

R2/S3 is:

`raw immutable provenance / retention`

R2/S3 is **not**:

`Twin Runtime consumable state authority`

Twin Runtime must never respond to missing governed DB Evidence by reading raw R2 and self-canonicalizing.

### 13.2 Governed Postgres/Neon Evidence

Governed DB Evidence is the Runtime-consumable authority.

### 13.3 Database role separation

Future deployment must enforce plane separation at database permissions, not only TypeScript interfaces.

Evidence Runtime role should be allowed to write only Evidence-plane tables/state needed by its authority.

It must be denied twin State/Forecast/Scenario/runtime scheduler/checkpoint mutations.

Twin Runtime role should read governed Evidence and write Runtime-plane state.

It must be denied provider raw-ingress/watermark/EvidenceSupplyCursor mutations.

Negative ACL tests are required before production cutover.

---

## 14. Cursor, lease, and owner invariants

`EvidenceSupplyCursor != RuntimeTickCursor`

Evidence cursor answers:

`How far has governed external evidence supply progressed?`

Runtime cursor answers:

`Which runtime logical/actual slot is next to execute?`

Evidence cursor advancement must not automatically advance Runtime.

Runtime must not advance Evidence cursor.

Exactly-one owner is **per role**:

- Evidence producer owner = exactly 1;
- Twin Runtime scheduler owner = exactly 1.

Separate leases/fencing are required.

Do not use one shared generic CAP-09 lease that grants cross-plane authority.

---

## 15. Physical visibility vs independent audit

Evidence Runtime may own the mechanics:

`COMMIT -> fresh transaction/readback -> visibility evidence`

But it must not be its own sole independent certifier.

Qualification/audit must independently verify visibility evidence and invariants.

Production evidence generation and independent adjudication are separate roles.

---

## 16. Provider shim debt

Current qualification surfaces have included plumbing such as:

- reading old TS source;
- blob checks;
- string replacement;
- temporary generated TS;
- `GITHUB_RUN_ID` identity;
- spawning `pnpm tsx` from acceptance scripts.

That is qualification plumbing, not the final production provider implementation.

Phase 2 must extract real modules, for example:

- provider adapter;
- raw retention;
- decoder;
- canonicalizer;
- governed ingress;
- visibility/readback;
- evidence cursor.

GitHub qualification and future Evidence Runtime must call the same real modules.

Do not maintain qualification implementation A and production implementation B.

---

## 17. GitHub final role

GitHub Actions MAY:

- build;
- typecheck;
- test;
- run bounded qualification;
- deploy;
- start/restart deployment as deployment action;
- inspect;
- independently audit;
- publish immutable qualification evidence.

GitHub Actions MUST NOT in final production hosting:

- own provider production cadence;
- own EvidenceSupplyCursor;
- own Formal wake cadence;
- claim Runtime slots;
- execute routine Formal State ticks;
- mutate Formal runtime checkpoint/state;
- act as required hourly wake source;
- become fallback provider collector when Evidence Runtime is unavailable.

Deployment plane is not runtime plane.

After deployment, GitHub is not the clock.

---

## 18. Mandatory outage / isolation tests for later phases

Future qualification must include:

`GITHUB_CONTROL_PLANE_OUTAGE_DOES_NOT_STOP_EVIDENCE_INGRESS`

`GITHUB_CONTROL_PLANE_OUTAGE_DOES_NOT_STOP_TWIN_RUNTIME`

`EVIDENCE_RUNTIME_OUTAGE_DOES_NOT_CAUSE_TWIN_RUNTIME_PROVIDER_FALLBACK`

`TWIN_RUNTIME_OUTAGE_DOES_NOT_ALLOW_EVIDENCE_RUNTIME_TO_ADVANCE_TWIN_STATE`

`PROCESS_RESTART_RECOVERS_FROM_DURABLE_POSTGRES_AUTHORITY_WITHOUT_GITHUB_ARTIFACT_REHYDRATION`

Also require:

- no GitHub artifact needed to recover production cursor;
- no GitHub artifact needed to recover active epoch operational state;
- no GitHub outage-induced runtime loss when DB/R2/provider/containers are healthy.

---

## 19. Production-hosting Phase roadmap — frozen sequence

These are the Phase numbers the user instructed us to follow.

### Phase 0 — preserve historical authority

Status: **DONE / FROZEN**

Preserve:

- protected main baseline;
- CAP-01→07 completion;
- CAP-08 Stage 1A completion;
- Formal-v4 immutable NO-GO;
- frozen #3289 v13 successor subject.

Do not mutate these just to simplify migration.

### Phase 0A — freeze production-hosting architecture

Status: **DONE AS DOCS-ONLY FREEZE / #3292 / NOT MERGED**

Authority document:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

Exact commit:

`2f7a065cc95e4a5a2c95411fb381fe5e4479d645`

### Phase 1 — canonical composition extraction + CAP-08 semantic equivalence

Status at handoff:

**AUDIT STARTED / IMPLEMENTATION NOT YET CREATED**

Objectives:

- identify true CAP-08 composition entrypoints;
- identify real runtime wiring hidden under acceptance scripts;
- extract common application/runtime composition into formal module(s);
- create a ReplayHost/composition entry that reuses canonical semantics;
- retain historical CAP-08 closure untouched;
- run old frozen CAP-08 composition and new ReplayHost composition against equivalent controlled input;
- prove semantic/result equivalence;
- no provider/live Internet;
- no production scheduler activation;
- no Formal DB mutation.

### Phase 2 — extract production Evidence modules

Status: **NOT STARTED**

Objectives:

- real provider adapter;
- raw retention;
- decoder/canonicalizer;
- governed ingress;
- physical visibility mechanics;
- EvidenceSupplyCursor;
- remove generated-source shim dependence from production path.

### Phase 3 — Evidence Runtime host

Status: **NOT STARTED**

Build long-running Evidence Runtime with:

- real daemon lifecycle;
- durable cursor;
- own lease/fencing;
- restart recovery;
- DB ACL;
- no twin mutations;
- no production activation until qualification.

### Phase 4 — Twin Runtime host

Status: **NOT STARTED**

Build long-running Twin Runtime with:

- DB-clock scheduler;
- RuntimeTickCursor;
- own lease/fencing;
- canonical production runner/core;
- checkpoint/recovery;
- governed DB Evidence only;
- no Internet/provider access;
- no production activation until qualification.

### Phase 5 — production-equivalent two-service accelerated 24T

Status: **NOT STARTED**

Do not call this merely `same-image`.

Required:

`Qualification Evidence Host == Production Evidence Host except permitted clock/provider test adapter`

`Qualification Twin Host == Production Twin Host except accelerated clock`

Must preserve:

- same repositories;
- same schema;
- same cursors;
- same leases/fencing;
- same scheduler;
- same canonicalization modules;
- same Runtime core;
- same checkpoint/recovery;
- same health semantics.

Only waiting/clock and an explicitly frozen test-provider adapter may differ.

### Phase 6 — production ownership cutover proof

Status: **NOT STARTED**

Required target:

`scheduled GitHub production owner = 0`

`GitHub provider production owner = 0`

`Evidence Runtime production owner = exactly 1`

`Twin Runtime production owner = exactly 1`

Run outage/isolation/restart matrix.

### Phase 7 — fresh Formal-v5

Status: **BLOCKED / NOT STARTED**

Only after Phase 1→6 pass:

- fresh DB;
- fresh epoch;
- real wall clock;
- real Evidence Runtime;
- real Twin Runtime;
- no GitHub production execution;
- no failed-v4 state reuse;
- independent final audit/readback.

---

## 20. Phase 1 audit performed in this conversation

The user explicitly instructed:

`现在按既定的PHASE序号推进吧`

We began **Phase 1 audit only**.

No Phase 1 implementation branch/commit/PR has been created yet.

### 20.1 One path-assumption mistake occurred

An old/guessed CAP-08 path was requested and GitHub returned `404`.

That path assumption was not turned into code.

We switched to repository-level search/tree discovery.

Lesson:

Do not guess CAP-08 composition paths from memory.

### 20.2 Actual CAP-08 composition entrypoint located

Actual entrypoint found:

`scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/qualification_workflow_entrypoint_v2.ts`

It loads an authority-gated port bundle and calls:

`executeRunAQualificationHarnessV1`

### 20.3 Actual composition wiring area

Real port composition/wiring is under the `mcft_cap08_s6_run_a_qualification_ports*` surfaces.

This is not merely mock/test helper code.

It carries real composition responsibilities such as:

- PostgreSQL repository wiring;
- weather/fallback adapter wiring;
- canonical adapter/port assembly;
- qualification runtime composition.

This is the Phase 1 composition debt.

### 20.4 Phase 1 work still required before any extraction

Before moving code:

1. enumerate the exact CAP-08 workflow entrypoint import graph;
2. enumerate all ports in the authority-gated bundle;
3. classify each port as canonical Kernel, host/composition, replay adapter, persistence adapter, clock adapter, or test-only;
4. identify which composition is already formal runtime code and which lives only under `scripts/runtime_acceptance`;
5. identify the accepted CAP-08 result/evidence contract and any semantic/result digests;
6. define the minimal formal ReplayHost composition root;
7. design an equivalence proof before editing historical entrypoints;
8. ensure the new composition does not introduce Internet/provider access;
9. ensure no production scheduler is activated;
10. ensure CAP-08 historical workflow remains reproducible.

### 20.5 Do not write a simplified Phase 1 runner

Hard rule:

Do not create a new easy-to-test ReplayHost that does not call the same canonical core/ports as the frozen CAP-08 semantics.

The equivalence proof must be meaningful.

---

## 21. Recommended immediate sequencing from this handoff

There are two active streams:

A. finish #3291 CP-5 exact-head control-plane requalification;

B. begin Phase 1 production-hosting composition extraction.

The safer sequencing is:

### Step A — close #3291 CP-5 first

Reason:

The central planner is needed to adjudicate which Phase 1 dependency changes require requalification.

Exact current known blocker:

EA5E2 93-path graph carrier digest does not match exact current graph.

Fix/requalify that intentionally.

Then inspect all current exact-head red workflows.

Do not continue from an older green head.

### Step B — create a separate Phase 1 implementation branch

Do not put Phase 1 into #3291.

Do not put Phase 1 into #3292.

Do not modify #3289.

Suggested conceptual branch naming:

`feat/mcft-cap09-production-hosting-phase1-runtime-composition`

Exact branch name may differ, but it should:

- be separate;
- bind the #3292 architecture freeze by exact commit/ref in PR body/tests;
- make dependency/requalification effects explicit;
- not activate production.

### Step C — implement smallest equivalence-preserving extraction

Move composition, not semantics.

Prefer:

- new formal application/runtime composition module;
- thin historical CAP-08 adapter if necessary;
- thin new ReplayHost adapter;
- equivalence acceptance.

Do not duplicate repositories or canonical core.

### Step D — prove equivalence before Phase 2

Phase 1 DoD must be green before extracting provider production modules.

---

## 22. Pitfalls encountered and how to avoid them

### Pitfall 1 — wrong canonical ingress path in CP self-test

Wrong:

`apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts`

Correct:

`apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts`

Fix the test path.

Never weaken unknown-path fail-closed to hide a bad path.

### Pitfall 2 — inline Node `shell: node {0}` path resolution

GitHub writes inline script to runner `_temp`.

Therefore:

`require('./scripts/...')`

can resolve relative to `_temp` and fail with `MODULE_NOT_FOUND`.

Use `process.cwd()` / absolute repository-resolved path.

Do not change semantic assertions to fix a runner CWD problem.

### Pitfall 3 — overbroad v14 generation self-test

Frozen v13 checks can correctly become:

`GENERATION_NOT_APPLICABLE`

while future checks in the same stage can correctly be:

`STAGE_NOT_APPLICABLE`

Do not change the planner to satisfy an incorrectly broad test assertion.

Fix test scope.

### Pitfall 4 — GitHub artifact retention mistaken for permanent evidence

Historical EA5E2 artifact:

`artifact_id = 9575862147`

known expiry:

`2026-09-01`

Do not make permanent carry-forward authority depend solely on a temporary Actions artifact.

Use durable repository/DB evidence identity + live cross-check when available.

### Pitfall 5 — CP-5 consumer migration legitimately changes dependency graph

Changing the EA5E2 workflow changes its governed graph.

Planner returning `REQUALIFY` is correct.

Do not force `CARRY_FORWARD` to get green.

### Pitfall 6 — synthetic control-only test polluted by real current branch diff

A CP-4 case intended to prove `control-plane-only change` accidentally observed real CP-5 branch changes.

Synthetic negative/positive cases must use a truly synthetic/frozen baseline.

Do not let current worktree drift redefine the scenario under test.

### Pitfall 7 — partial green mistaken for exact-head green

Several intermediate heads had green control-plane runs.

Current head later became red due to legitimate dependency changes.

Always query exact-head Actions comprehensively.

### Pitfall 8 — file path guessed from memory in Phase 1

A guessed historical CAP-08 path returned 404.

Use repository search/tree/import graph.

Never write migration code based on remembered file names.

### Pitfall 9 — single-container migration assumption

Earlier direction assumed:

`GitHub Formal -> twin-runtime container`

Full MCFT-01→09 audit showed this violates the frozen Evidence-vs-Runtime separation.

Always read #3292 before Phase implementation.

### Pitfall 10 — mixing raw retention with Runtime authority

R2 raw data is not governed Runtime Evidence.

Do not let Twin Runtime recover missing DB Evidence by reading R2 raw payloads.

### Pitfall 11 — using GitHub as the hidden runtime clock

Moving code into Docker while Docker still depends on GitHub hourly artifacts/dispatch is not a real migration.

Restart authority and operational cursor state must be durable outside GitHub.

### Pitfall 12 — one shared lease across planes

Evidence and Runtime are separate production roles.

Use distinct owner/lease/fencing authorities.

### Pitfall 13 — re-opening accepted historical CAPs

Composition extraction does not imply CAP-01→08 semantic reopening.

Use equivalence.

### Pitfall 14 — CAP-06 pattern: ad-hoc prerequisite accumulation

If repeated gates reveal a structural architecture defect, freeze architecture and repair the design.

Do not keep appending prerequisite workflows indefinitely.

### Pitfall 15 — assuming all #3291 current failures share one root cause

Current exact head has four red workflows at different failing steps.

EA5E2 root cause is known.

Control-plane proof, successor structural acceptance, and persistent immutable-base failures require exact log inspection.

Do not apply one blanket fix.

---

## 23. What must NOT happen next

Do not:

- modify protected main casually;
- modify/rebase frozen #3289;
- merge #3292 solely to make its docs visible;
- claim #3291 all-green;
- skip current #3291 exact-head red workflows;
- start Formal-v5;
- provision/mutate Formal-v5 as part of Phase 1;
- reuse failed-v4 DB/state;
- repair failed-v4 O08;
- loosen causal forcing selectors;
- preinsert 24 future forcing pairs;
- put provider access into Twin Runtime;
- make Evidence Runtime advance twin State;
- make Twin Runtime decode raw R2 data;
- create a second simplified canonical tick path;
- fold CAP-07 read APIs into Twin Runtime;
- turn CAP-05 into auto-action control;
- turn CAP-06 into online self-learning;
- activate new Docker services before qualification;
- use GitHub artifact as the only restart authority;
- call production-hosting Phase 6 `CP-6`.

---

## 24. Non-effects required for current work

Until explicitly authorized later phases, current CP-5/Phase-1 work must preserve:

`runtime_production_activation = false`

`evidence_runtime_production_activation = false`

`twin_runtime_production_activation = false`

`formal_v5_activation = false`

`formal_database_mutation = false`

`provider_live_request_from_phase1 = false`

`graduation_effect = false`

`mcft_cap09_completed = false`

---

## 25. First commands / queries for the next engineer

Start by reconstructing exact state.

```bash
git fetch origin
git rev-parse origin/main

gh pr view 3289 --json number,title,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid
gh pr view 3291 --json number,title,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid
gh pr view 3292 --json number,title,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid

git show 2f7a065cc95e4a5a2c95411fb381fe5e4479d645:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md

gh run view 32922219373 --log-failed
gh run view 32922219401 --log-failed
gh run view 32922219347 --log-failed
gh run view 32922219348 --log-failed
```

Then locate Phase 1 composition from repository facts, not memory.

```bash
git grep -n "qualification_workflow_entrypoint_v2"
git grep -n "executeRunAQualificationHarnessV1"
git grep -n "mcft_cap08_s6_run_a_qualification_ports"
git grep -n "single_run_ports"
git grep -n "CAP_08" scripts/runtime_acceptance apps/server/src
```

Do not begin extraction until you can draw the actual import/port graph.

---

## 26. CP-5 Definition of Done

CP-5 is not done until:

- current exact #3291 head is known;
- EA5E2 graph path delta reviewed;
- strict graph binding matches the intended exact graph;
- EA5E2 planner consumer routes correctly;
- full EA5E2 requalification passes when REQUALIFY;
- control-plane generation/durable-anchor/digest proof passes;
- successor-runner structural acceptance passes or is explicitly adjudicated;
- persistent-24T immutable-base preflight passes or is explicitly adjudicated;
- unknown paths = 0;
- authority errors = 0;
- resolver errors = 0;
- no failed-v4 evidence reuse;
- no production side effects;
- all applicable exact-head workflows terminal-success;
- N/A decisions machine-recorded rather than silently skipped.

---

## 27. Phase 1 Definition of Done

Phase 1 is not done merely because a new `ReplayHost` file exists.

It requires:

1. exact old CAP-08 composition call graph documented;
2. real port-bundle responsibilities classified;
3. formal common composition root extracted;
4. canonical Kernel semantics unchanged;
5. old CAP-08 historical closure preserved;
6. new ReplayHost uses same canonical semantic core;
7. same repository/port semantics where authority requires;
8. controlled old-vs-new execution performed;
9. semantic/result equivalence machine-proven;
10. no public provider access;
11. no production scheduler activation;
12. no Formal DB mutation;
13. central planner reports appropriate requalification for changed dependencies;
14. exact-head CI/acceptance green;
15. Phase 1 evidence durable enough for Phase 2 dependency planning.

---

## 28. Phase 2 entry gate

Do not start Phase 2 until Phase 1 DoD is satisfied.

Phase 2 may begin only when:

- composition debt is removed or bounded;
- CAP-08 equivalence is proven;
- there is one canonical application composition path to reuse;
- no simplified duplicate runtime path remains;
- the central planner can enumerate the changed dependency surface.

---

## 29. Formal-v5 entry gate

Formal-v5 remains blocked until at least:

- Phase 1 PASS;
- Phase 2 PASS;
- Phase 3 PASS;
- Phase 4 PASS;
- Phase 5 production-equivalent two-service accelerated 24T PASS;
- Phase 6 ownership cutover PASS;
- GitHub production owners = 0;
- Evidence Runtime owner = exactly 1;
- Twin Runtime owner = exactly 1;
- outage/isolation matrix PASS;
- restart from durable operational authority PASS;
- fresh Formal-v5 DB/epoch authorized;
- failed-v4 reuse proven impossible.

Only then should a fresh wall-clock Formal-v5 O00→O23 begin.

---

## 30. First 60 minutes for the next engineer

### Minute 0–10: authority reconstruction

- verify `main == 26c1383...` or stop and adjudicate drift;
- verify #3289 exact frozen head;
- verify #3291 current head;
- verify #3292 exact architecture-freeze commit;
- read the production-hosting freeze in full.

### Minute 10–25: CP-5 exact-head red-state reconstruction

- inspect run 32922219373;
- inspect run 32922219401;
- inspect run 32922219347;
- inspect run 32922219348;
- record exact failing step + root cause per workflow;
- do not combine unrelated failures.

### Minute 25–40: EA5E2 binding adjudication

- reproduce 93-path graph;
- diff intended graph paths from previous carrier;
- confirm workflow + binding-carrier changes are legitimate;
- update/requalify strict carrier only after path review;
- rerun exact-head planner + full graph.

### Minute 40–55: Phase 1 call-graph audit

- open `qualification_workflow_entrypoint_v2.ts`;
- enumerate port bundle;
- trace `executeRunAQualificationHarnessV1`;
- classify composition vs semantic core;
- locate accepted CAP-08 result/evidence contract.

### Minute 55–60: decide next commit boundary

If CP-5 is still red:

- keep fixing CP-5;
- do not start Phase 1 implementation.

If CP-5 is green and Phase 1 call graph is understood:

- create separate Phase 1 implementation branch;
- make first extraction commit minimal and semantics-preserving;
- add equivalence acceptance in same workstream.

---

## 31. Compact current-state summary

**What are we doing?**

Moving MCFT-CAP-09 from GitHub-hosted production-like orchestration toward the Taskbook-consistent production architecture while preserving MCFT-01→08 semantic authority.

**What is complete?**

- historical CAP-01→08 authorities remain accepted;
- Formal-v4 immutable NO-GO remains frozen;
- v13 successor subject #3289 is frozen;
- production-hosting architecture was re-audited and frozen docs-only in #3292;
- much of CP-0→CP-4 control-plane semantics is implemented;
- CP-5 first real consumer migration has started;
- Phase 1 audit has located the actual CAP-08 composition entrypoint/debt.

**What is not complete?**

- #3291 CP-5 exact head is not green;
- EA5E2 strict binding is stale against the current intended graph;
- three other exact-head red workflows require exact log adjudication;
- Phase 1 implementation has not started;
- Evidence Runtime does not exist as final production host;
- Twin Runtime does not exist as final production host;
- two-service accelerated qualification has not run;
- GitHub production ownership has not been retired;
- Formal-v5 has not started;
- MCFT-CAP-09 is not complete.

**What is next?**

Close #3291 CP-5 exact-head red state first, then create a separate Phase 1 implementation branch and extract common Runtime composition with a CAP-08 semantic-equivalence proof.

---

## 32. Final handoff instruction

The next engineer must not treat this handoff as permission to improvise architecture.

Before any Phase implementation, read:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

from exact commit:

`2f7a065cc95e4a5a2c95411fb381fe5e4479d645`

Then reconstruct #3291 exact-head status from GitHub Actions.

Do not continue from a stale green run.

Do not collapse Evidence Runtime and Twin Runtime into one production authority.

Do not let GitHub remain the production clock after cutover.

Do not reopen CAP-01→08 or failed Formal-v4 merely because hosting composition is changing.

Current frontier:

`CP-5 exact-head requalification closure -> Phase 1 canonical composition extraction + CAP-08 equivalence`

MCFT-CAP-09 status:

**IN PROGRESS — NOT COMPLETE — FORMAL-V5 BLOCKED**
