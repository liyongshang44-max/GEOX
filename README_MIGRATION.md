GEOX – Migration / Freeze Index (SSOT)
====================================

Constitution Role (SSOT)
------------------------

This file is the single, authoritative source of truth for:

- Sprint numbering and scope
- Freeze snapshots
- Capability boundaries
- Git tags that lock governance and execution semantics
- Acceptance commands that prove invariants

Hard constitutional rules (must remain true):

### Single SSOT

README_MIGRATION.md is the only canonical index for Sprint / Tag / Freeze state.

No other file may act as an alternative or competing authority.

### No dual index

Do NOT introduce:

- SPRINT_INDEX.md
- MIGRATION_INDEX.md
- GOVERNANCE_INDEX.md
- CHANGELOG.md as an authority for sprint or freeze state

Any such file, if present, must be explicitly marked NON-AUTHORITATIVE and only link back here.

### Derivation discipline

Any document mentioning sprint / tag / freeze must be treated as a derived view.

In case of conflict or drift, README_MIGRATION.md always wins.

### Change control

Any change that affects:

- sprint scope
- freeze boundaries
- governance meaning of a tag

must update this file in the same commit.

### Audit requirement

Every freeze snapshot must declare:

- Branch / Tag / Commit
- Scope summary (what is frozen)
- Acceptance entrypoint(s)
- Hard boundaries (negative spec)

This role is constitutional and must not be bypassed.

---

## GEOX – Sprint 10 AO-ACT v0 Governance Docs Freeze Snapshot

Key anchors:

- Branch: main
- Tag: apple_iii_ao_act_v0

Scope frozen by this tag:

Governance docs only (Step 3 / Step 4):

- docs/controlplane/GEOX-CP-AO-ACT-Execution-Contract-v0.md
- docs/controlplane/GEOX-CP-AO-ACT-Contracts-v0.md

Explicitly NOT asserted by this tag:

- AO-ACT implementation code
- executor adapters
- acceptance scripts

Hard boundaries:

- AO-ACT is execution & audit only
- No auto-trigger from ProblemState
- Append-only ledger

Acceptance:

- None (docs-only freeze)

---

## GEOX – Control Constitution / Repo-Const Ruleset v0 Freeze Snapshot

Key anchors:

- Branch: main
- Tag: control_repo_const_ruleset_v0
- Commit: 52c03f4

Frozen scope:

- Constitution docs
- Repo-const ruleset loading discipline
- Validator hardening
- Non-runtime harness separation

Acceptance:

- pnpm -C packages/control-repo-const-harness test

Hard boundaries:

- RuleSet v0 SSOT is repo-only
- Runtime does NOT auto-load rulesets
- No harness dependency in runtime packages

---

## GEOX – Sprint 11 AO-ACT → Judge Read-Only Consumption Contract Freeze Snapshot

Key anchors:

- Branch: main
- Tag: (no dedicated tag; anchored by contract + later negative acceptance)

Frozen scope:

- AO-ACT receipt may be consumed by Judge as evidence only
- Receipt must not affect ProblemState or determinism

Hard boundaries:

- AO-ACT receipt is not a control signal
- No reverse write from Judge into AO-ACT

---

## GEOX – Sprint 12 AO-ACT ReadModel v0 (Explain-Only) Freeze Snapshot

Key anchors:

- Branch: main
- Tag: (no dedicated tag)

Frozen scope:

- AO-ACT ReadModel for explain/debug only

Acceptance:

- scripts/ACCEPTANCE_SPRINT12_AO_ACT_READMODEL_NEGATIVE.ps1

Hard boundaries:

- No state mutation
- No triggers
- Fully discardable and replayable

---

## GEOX – Sprint 14 Agronomy Interpretation v1 (Explain-Only) Freeze Snapshot

Key anchors:

- Branch: main
- Tag: sprint14_agronomy_interpretation_v1_explain_only

Frozen scope:

- Agronomy interpretation facts (explain-only)

Acceptance:

- scripts/ACCEPTANCE_SPRINT14_AGRONOMY_INTERPRETATION_V1_NEGATIVE.ps1

Hard boundaries:

- No decisions
- No execution authority
- No control flow gating

---

## GEOX – Sprint 15 Decision / Plan v0 (Proposal-Only) Freeze Snapshot

Key anchors:

- Branch: main
- Tag: apple_v_decision_plan_v0

Frozen scope:

- Hypothetical decision / plan outputs only

Acceptance:

- scripts/ACCEPTANCE_SPRINT15_DECISION_PLAN_NEGATIVE.ps1

Hard boundaries:

- Plan ≠ Task
- No execution
- Fully discardable

---

## GEOX – Sprint 16 Decision / Plan v0 Non-Coupling Freeze Snapshot

Key anchors:

- Branch: main
- Tag: sprint16_decision_plan_v0_non_coupling

Frozen scope:

- Governance closure on non-coupling

Acceptance:

- scripts/ACCEPTANCE_SPRINT16_DECISION_PLAN_V0_NEGATIVE.ps1

Hard boundaries:

- No layer collapse
- One-way authority: Constitution → Kernel → Runtime → UI

---

## Sprint 17 · Apple III · Execution Adapter v0

Tag: apple_iii_execution_adapter_v0

Acceptance:

- scripts/ACCEPTANCE_AO_ACT_EXECUTOR_V0.ps1

Hard boundaries:

- Not a scheduler
- Explicit invocation only
- AO-ACT endpoints only

---

## Sprint 18 · Apple III · AO-ACT Audit Tools v0

Tag: apple_iii_ao_act_audit_tools_v0

Acceptance:

- scripts/ACCEPTANCE_AO_ACT_AUDIT_V0.ps1

Hard boundaries:

- Offline only
- DB-only
- No runtime side effects

---

## Sprint 19 · Apple III · AO-ACT AuthZ Contract v0

Tag: apple_iii_ao_act_authz_v0

Acceptance:

- scripts/ACCEPTANCE_AO_ACT_AUTHZ_V0.ps1

Hard boundaries:

- Token / scope only
- No IAM
- No scheduler
- No auto-trigger

---

## Sprint 20 · Apple III · AO-ACT Receipt Idempotency v0

Tag: apple_iii_ao_act_idempotency_v0

Acceptance:

- scripts/ACCEPTANCE_AO_ACT_IDEMPOTENCY_V0.ps1

Hard boundaries:

- Retry-safe receipt writes
- No server-side auto-retry
- No AuthZ semantic change

---

## Sprint 21 · Apple III · AO-ACT Device Adapter v0 (L2)

Tag: apple_iii_ao_act_device_adapter_v0

Frozen scope:

- Pointer-only device evidence integration
- device_ref facts are opaque
- receipt references device_ref by fact_id only

Acceptance:

- scripts/ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0.ps1

Hard boundaries:

- No device control
- No realtime control
- No scheduler / queue
- No Judge or Agronomy side effects
