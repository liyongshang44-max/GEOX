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

---

## Sprint 22 · Apple III · AO-ACT Multi-tenant Isolation v0

Tag: apple_iii_ao_act_multitenant_isolation_v0

Frozen scope:

- Hard multi-tenant isolation enforced at AO-ACT boundaries
- Isolation key is the strict triple: tenant_id + project_id + group_id
- tenant_id is the only SSOT field name (namespace is forbidden as alias)
- All AO-ACT entrypoints (task / receipt / index) require the full triple
- receipt device evidence references must resolve within the same tenant triple

Acceptance:

- scripts/ACCEPTANCE_AO_ACT_MULTITENANT_ISOLATION_V0.ps1

Return code semantics (frozen):

- 401: missing or invalid token
- 400: required tenant/project/group fields missing
- 404: cross-tenant or cross-scope access (uniform, non-enumerable)

Hard boundaries (must remain true):

- No soft isolation (UI / convention-only isolation is forbidden)
- No cross-tenant aggregation or views
- No shared executors across tenant_id
- No scheduler / queue / auto-trigger
- No change to Sprint 19 AuthZ core semantics
Sprint 23 · Apple III · Delivery Envelope v0 (Acceptance & Evidence Export)

Key anchors:

Branch: main

Tag: apple_iii_delivery_envelope_v0

Commit: 1064e8b

Frozen scope:

Delivery-level envelope for AO-ACT acceptance and evidence export

Single entry delivery compose (docker-compose.delivery.yml)

Deterministic acceptance aggregation into acceptance_report_v0

Explicit, opt-in evidence pack export for a single AO-ACT task

No new runtime semantics introduced

Included components (frozen):

docker-compose.delivery.yml

Delivery-only compose

No new services

No runtime behavior change

scripts/DELIVERY/ACCEPTANCE_DELIVERY_ENVELOPE_V0.ps1

scripts/DELIVERY/ACCEPTANCE_DELIVERY_ENVELOPE_V0_RUNNER.cjs

Executes existing acceptance scripts as a closed set

Aggregates results into a single delivery report

scripts/DELIVERY/EXPORT_EVIDENCE_PACK_V0.ps1

scripts/DELIVERY/EXPORT_EVIDENCE_PACK_V0_RUNNER.cjs

Explicit, manual export of evidence pack for a given act_task_id

Requires explicit token with ao_act.index.read

Produces file-system artifacts only

docs/delivery/GEOX-Delivery-Envelope-v0.md

Delivery contract (descriptive, non-authoritative)

Derived view only

Acceptance (delivery-level):

powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/DELIVERY/ACCEPTANCE_DELIVERY_ENVELOPE_V0.ps1


Acceptance outputs (frozen semantics):

_exports/delivery/acceptance_report_v0.json (SSOT, machine-readable)

_exports/delivery/acceptance_report_v0.txt (human-readable mirror)

_exports/delivery/cases/**/stdout.txt

_exports/delivery/cases/**/stderr.txt

Evidence export (explicit, non-automatic):

$env:GEOX_AO_ACT_TOKEN_EXPORT="dev_ao_act_admin_v0"

powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/DELIVERY/EXPORT_EVIDENCE_PACK_V0.ps1 `
  -TenantId <tenant_id> `
  -ProjectId <project_id> `
  -GroupId <group_id> `
  -TaskId <act_task_id>


Evidence export outputs (non-acceptance artifacts):

_exports/delivery/evidence_pack_v0/<tenant>/<project>/<group>/<act_task_id>/

_exports/delivery/evidence_pack_*.zip (best-effort, optional)

Hard boundaries (must remain true):

Delivery envelope introduces no new execution semantics

No scheduler, queue, or background job

No auto-export of evidence

No side effects on AO-ACT runtime behavior

No modification of Sprint 19 AuthZ semantics

No modification of Sprint 20 idempotency semantics

Evidence export is explicit, token-gated, and offline

_exports/ is a delivery artifact directory and must never be committed

Negative assertions (explicitly NOT included):

No new AO-ACT endpoints

No new token types or IAM features

No batch or cross-task export

No cross-tenant evidence aggregation

No Judge or Agronomy coupling

No UI-triggered delivery actions

Governance meaning of tag:

apple_iii_delivery_envelope_v0 freezes delivery mechanics only

Runtime behavior, governance semantics, and execution authority remain unchanged

This tag is safe to consume by external delivery / audit pipelines


------------------------------------------------------------
Sprint 25 · Approval Runtime v1 (Human-in-the-loop Workbench)
------------------------------------------------------------

Scope (what this Sprint adds)

Adds a minimal, append-only “approval runtime” that productizes a human-in-the-loop approval flow without touching
decision_plan_v0 (Sprint 16 sealed) and without changing AO-ACT semantics.

New APIs (v1 only; v0 remains sealed)

POST /api/control/approval_request/v1/request

GET  /api/control/approval_request/v1/requests

POST /api/control/approval_request/v1/approve

Notes

All approval endpoints reuse AO-ACT token/scope authorization (Sprint 19) and enforce Sprint 22 tenant triple isolation.

Approval approval issues AO-ACT tasks by calling the existing AO-ACT endpoint internally, preserving AO-ACT audit behavior.

Acceptance

powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE.ps1

Hard boundaries (must remain true)

Sprint 16 decision_plan_v0 remains sealed: NO decision_plan list/query APIs

No scheduler, queue, or background executor is introduced

No coupling to Judge/Agronomy and no mutation of existing facts


------------------------------------------------------------
Sprint 26 · Evidence Export API v1 (Async Jobs; keep evidence_pack_v0 offline)
------------------------------------------------------------

Scope (what this Sprint adds)

Adds a service-facing evidence export API (v1) implemented as async jobs (reusing the existing importJobs pattern).
This Sprint does NOT change or replace Sprint 23's offline evidence_pack_v0 script; v0 remains the offline delivery fallback.

New APIs (v1)

POST /api/delivery/evidence_export/v1/jobs

GET  /api/delivery/evidence_export/v1/jobs/:job_id

GET  /api/delivery/evidence_export/v1/jobs/:job_id/download

New fact (v1)

acceptance_result_v1 (append-only)
- Minimal template in v1: ao_act_basic_v1 (task must exist => PASS else FAIL)
- Binds acceptance_result_v1 to the produced artifact via artifact_sha256 and a deterministic_hash

Notes

All endpoints reuse AO-ACT token/scope auth with read-only scope (ao_act.index.read) and enforce Sprint 22 tenant triple isolation + 404 non-enumerability.

Artifacts are written under runtime/evidence_exports_v1/ (runtime is excluded from git; safe for generated delivery artifacts).

Acceptance

powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/ACCEPTANCE_SPRINT26_EVIDENCE_EXPORT_V1_SMOKE.ps1

Hard boundaries (must remain true)

evidence_pack_v0 remains an offline script with unchanged semantics

No scheduler, no background executor, no coupling to Judge/ProblemState


# Sprint 27 · Executor Runtime v1 (deployable adapter, not scheduler)

- Added apps/executor (pnpm workspace app) with a run-once executor adapter.
- Executor v1 reads AO-ACT index (tenant-filtered), appends ao_act_receipt_v0 for tasks without receipts, then triggers evidence_export_api_v1 job and waits for completion.
- Added acceptance: scripts/ACCEPTANCE_SPRINT27_EXECUTOR_RUNTIME_V1_SMOKE.ps1 (creates approval_request_v1 -> approves -> runs executor -> verifies receipt).

Governance: executor is explicit/run-once; no infinite auto-scheduling loop, and no cross-tenant enumeration.
