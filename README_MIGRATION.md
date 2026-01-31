GEOX – Migration / Freeze Index (SSOT)
Constitution Role (SSOT)

This file is the single, authoritative source of truth for:

Sprint numbering and scope

Freeze snapshots

Capability boundaries

Git tags that lock governance and execution semantics

Acceptance commands that prove invariants

Hard constitutional rules (must remain true):

Single SSOT

README_MIGRATION.md is the only canonical index for Sprint / Tag / Freeze state.

No other file may act as an alternative or competing authority.

No dual index

Do NOT introduce:

SPRINT_INDEX.md

MIGRATION_INDEX.md

GOVERNANCE_INDEX.md

CHANGELOG.md as an authority for sprint or freeze state

Any such file, if present, must be explicitly marked NON-AUTHORITATIVE and only link back here.

Derivation discipline

Any document mentioning sprint / tag / freeze must be treated as a derived view.

In case of conflict or drift, README_MIGRATION.md always wins.

Change control

Any change that affects:

sprint scope

freeze boundaries

governance meaning of a tag
must update this file in the same commit.

Audit requirement

Every freeze snapshot must declare:

Branch / Tag / Commit

Scope summary (what is frozen)

Acceptance entrypoint(s)

Hard boundaries (negative spec)

This role is constitutional and must not be bypassed.

GEOX – Sprint 10 AO-ACT v0 Governance Docs Freeze Snapshot

Key anchors:

Branch: main

Tag: apple_iii_ao_act_v0

Scope frozen by this tag (what is actually in the tag):

Governance docs only (Step 3 / Step 4):

docs/controlplane/GEOX-CP-AO-ACT-Execution-Contract-v0.md (Step 3)

docs/controlplane/GEOX-CP-AO-ACT-Contracts-v0.md (Step 4)

Explicitly NOT asserted by this tag:

This tag does not freeze AO-ACT implementation code, executor adapters, or acceptance scripts.

Any AO-ACT runtime/implementation progress must be anchored by its own later tag(s) or acceptance(s), not inferred here.

Hard boundaries (must remain true):

AO-ACT is execution & audit only (no decision / agronomy)

No auto-trigger from ProblemState

Append-only ledger (no rewrites)

Acceptance:

None frozen by this tag (docs-only freeze).

GEOX – Control Constitution / Repo-Const Ruleset v0 Freeze Snapshot

Key anchors:

Branch: main

Tag: control_repo_const_ruleset_v0

Commit: 52c03f4 (tag anchor commit)

What this adds (frozen):

Constitution docs (repo-const ruleset governance):

docs/controlplane/constitution/GEOX-ControlConstitution-RepoConst-Ruleset-Layout-v0.md

docs/controlplane/constitution/GEOX-ControlConstitution-RepoConst-Ruleset-Loading-Policy-v0.md

Validator hardening:

packages/control-constitution-validator emits type declarations (dist/index.d.ts)

fixtures normalized under packages/control-constitution-validator/fixtures/rulesets_v0/

Repo-const harness (dev/test-only):

New package: packages/control-repo-const-harness

Explicit file-path ruleset loading (no scanning, no defaults)

Kernel-bridge mapping: validator output (rules[].expr) → kernel consumption shape (rules[].template), harness-only

Negative guard: verifies no runtime package depends on harness

Acceptance / reproducibility (frozen proof):

Verified on tag:

pnpm -C packages/control-repo-const-harness test

[OK] S1 applied -> verdict: DENY

[OK] S2 missing -> UNDETERMINED + MISSING

[OK] S3 invalid -> UNDETERMINED + INVALID

Hard boundaries (must remain true):

RuleSet v0 SSOT is repo files only (repo-const). No DB / ledger / env injection of ruleset content.

Runtime default does NOT load rulesets. Only explicit developer/test harness may load by exact file path.

@geox/control-kernel contains no filesystem / path / discovery logic for rulesets.

control-repo-const-harness must remain non-runtime; runtime packages must not depend on it.

GEOX – Sprint 11 AO-ACT → Judge Read-Only Consumption Contract Freeze Snapshot

Key anchors:

Branch: main

Tag: (no dedicated sprint11 tag declared in repo tag list; therefore this sprint is anchored by implementation + acceptance files on main)

What Sprint 11 freezes:

Defines the only allowed consumption path from AO-ACT into Judge:

AO-ACT receipt is readable by Judge as evidence only

Receipt may participate in interpretation / explanation

Receipt must NOT:

drive ProblemState transitions

affect determinism_hash

affect SSOT config or rule loading

Governance contract:

AO-ACT remains execution & audit only

Judge remains the sole owner of state transitions

Acceptance / proof:

This sprint is primarily contractual; enforcement is validated by later negative acceptance in Sprint 12+ (see below).

Hard boundaries (must remain true):

AO-ACT receipt is read-only evidence, not a control signal

No receipt-triggered state change

No reverse write from Judge into AO-ACT

GEOX – Sprint 12 AO-ACT ReadModel v0 (Explain-Only) Freeze Snapshot

Key anchors:

Branch: main

Tag: (no dedicated sprint12 tag declared in repo tag list; therefore this sprint is anchored by implementation + acceptance files on main)

What Sprint 12 adds (frozen):

AO-ACT ReadModel (Judge-side explain/debug mirror):

Projection layer for AO-ACT facts

Explain-only, human-facing

ReadModel guarantees (frozen):

No mutation of ProblemState

No participation in determinism_hash

No rule evaluation side effects

Anchors in repo:

Implementation entrypoint:

apps/judge/src/ao_act_readmodel.ts (explicitly marked Sprint 12; read-only mirror for explain/debug only)

Governance doc(s):

docs/controlplane/GEOX-CP-AO-ACT-ReadModel-Governance-Sprint12.md

Acceptance (negative):

scripts/ACCEPTANCE_SPRINT12_AO_ACT_READMODEL_NEGATIVE.ps1

Hard boundaries (must remain true):

ReadModel is not a state machine

ReadModel is not a trigger source

ReadModel must be discardable and replayable at any time

GEOX – Sprint 14 Agronomy Interpretation v1 (Explain-Only) Freeze Snapshot

Key anchors:

Branch: main

Tag: sprint14_agronomy_interpretation_v1_explain_only

What Sprint 14 adds (frozen):

Agronomy Interpretation v1:

Produces interpretation facts

Explains observed states and actions

Explicitly non-goals (frozen):

No decision making

No action proposal

No execution authority

Anchors in repo:

Governance contract:

docs/controlplane/GEOX-CP-Agronomy-Interpretation-Contract-v1.md

Acceptance (negative):

scripts/ACCEPTANCE_SPRINT14_AGRONOMY_INTERPRETATION_V1_NEGATIVE.ps1

Hard boundaries (must remain true):

Agronomy is interpretive only

Agronomy output must not:

alter state

select actions

gate control flow

Agronomy facts are append-only and explain-only

GEOX – Sprint 15 Decision / Plan v0 (Proposal-Only) Freeze Snapshot

Key anchors:

Branch: main

Tag: apple_v_decision_plan_v0

What Sprint 15 adds (frozen):

Decision / Plan v0:

Produces action proposals

Purely hypothetical and advisory

Separation enforced (frozen):

Decision ≠ Execution

Plan ≠ Task

Anchors in repo:

Governance contract:

docs/controlplane/GEOX-CP-Decision-Plan-Contract-v0.md

Acceptance (negative):

scripts/ACCEPTANCE_SPRINT15_DECISION_PLAN_NEGATIVE.ps1

Hard boundaries (must remain true):

Decision / Plan must never execute

No automatic conversion from Plan → AO-ACT task

All plans are discardable without system impact

GEOX – Sprint 16 Decision / Plan v0 Non-Coupling Freeze Snapshot

Key anchors:

Branch: main

Tag: sprint16_decision_plan_v0_non_coupling

What Sprint 16 freezes (governance closure on non-coupling):

Decision / Plan remains non-executing and non-coupled:

No implicit promotion between layers

No auto-trigger path into AO-ACT

No backdoor coupling through Judge / rules / configs

Anchors in repo:

Freeze note:

docs/controlplane/GEOX-CP-Sprint16-Decision-Plan-Freeze.md

Acceptance (negative):

scripts/ACCEPTANCE_SPRINT16_DECISION_PLAN_V0_NEGATIVE.ps1

Hard boundaries (must remain true):

No layer collapse (interpretation ≠ decision ≠ execution)

No implicit promotion between layers

Constitution > Kernel > Runtime > UI (one-way authority)

Notes on Tag Semantics (Constitutional)

A sprint entry only claims what is provably frozen by its anchors:

If a tag contains only docs, it is a docs-only freeze and must not imply implementation.

If a sprint has no dedicated tag, it must be anchored via explicit repo paths (implementation/doc) + acceptance scripts; otherwise it is not a valid freeze snapshot.

Any future sprint (e.g., Sprint 17 Execution Adapter v0) must follow the same discipline:

Define tag + acceptance entrypoints + hard boundaries, all recorded here in the same commit.