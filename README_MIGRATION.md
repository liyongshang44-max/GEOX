GEOX – Migration / Freeze Index
====================================

Constitution Role (domain reference)
------------------------

This document is a domain-specific reference.
The repository-level documentation entry is defined in docs/SSOT.md.

This file is the migration and freeze reference for:

- Sprint numbering and scope
- Freeze snapshots
- Capability boundaries
- Git tags that lock governance and execution semantics
- Acceptance commands that prove invariants

Hard constitutional rules (must remain true):

### Repository-level entry reference

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


## Sprint R1 · Recommendation → Operation Plan Closure v1

Key anchors:

- Branch: main
- Commit anchor: 8281c29 (or later equivalent merge commit containing operation_plan chain updates)

Frozen scope:

- recommendation submit-approval returns `operation_plan_id`
- approval decision maps recommendation chain into `operation_plan_v1`
- receipt uplink updates `operation_plan_transition_v1` / `operation_plan_v1`
- operations console and plan read model expose recommendation → approval → task → receipt lifecycle
- evidence export bundles must include `operation_plan_v1` and `operation_plan_transition_v1` when the chain is present

Acceptance:

- `node scripts/agronomy_acceptance/ACCEPTANCE_AGRONOMY_E2E_V1.cjs`

Hard boundaries:

- recommendation facts are advisory only and have no execution authority
- no direct recommendation → dispatch bypass is allowed
- receipts require idempotency metadata
- cross-tenant plan reads must stay non-enumerable (404)
- duplicate receipts must be rejected

Derived design note:

- `docs/controlplane/GEOX_Operation_Plan_Execution_Chain_v1.md`

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

- RuleSet v0 canonical reference is repo-only
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

- scripts/legacy/powershell/ACCEPTANCE_SPRINT12_AO_ACT_READMODEL_NEGATIVE.ps1

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

- scripts/legacy/powershell/ACCEPTANCE_SPRINT14_AGRONOMY_INTERPRETATION_V1_NEGATIVE.ps1

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

- scripts/legacy/powershell/ACCEPTANCE_SPRINT15_DECISION_PLAN_NEGATIVE.ps1

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

- scripts/legacy/powershell/ACCEPTANCE_SPRINT16_DECISION_PLAN_V0_NEGATIVE.ps1

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

- scripts/legacy/powershell/ACCEPTANCE_AO_ACT_AUTHZ_V0.ps1

Hard boundaries:

- Token / scope only
- No IAM
- No scheduler
- No auto-trigger

---

## Sprint 20 · Apple III · AO-ACT Receipt Idempotency v0

Tag: apple_iii_ao_act_idempotency_v0

Acceptance:

- scripts/legacy/powershell/ACCEPTANCE_AO_ACT_IDEMPOTENCY_V0.ps1

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

- scripts/legacy/powershell/ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0.ps1

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
- tenant_id is the only canonical field name (namespace is forbidden as alias)
- All AO-ACT entrypoints (task / receipt / index) require the full triple
- receipt device evidence references must resolve within the same tenant triple

Acceptance:

- scripts/legacy/powershell/ACCEPTANCE_AO_ACT_MULTITENANT_ISOLATION_V0.ps1

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

scripts/legacy/delivery/ACCEPTANCE_DELIVERY_ENVELOPE_V0.ps1

scripts/legacy/delivery/ACCEPTANCE_DELIVERY_ENVELOPE_V0_RUNNER.cjs

Executes existing acceptance scripts as a closed set

Aggregates results into a single delivery report

scripts/legacy/delivery/EXPORT_EVIDENCE_PACK_V0.ps1

scripts/legacy/delivery/EXPORT_EVIDENCE_PACK_V0_RUNNER.cjs

Explicit, manual export of evidence pack for a given act_task_id

Requires explicit token with ao_act.index.read

Produces file-system artifacts only

docs/delivery/GEOX-Delivery-Envelope-v0.md

Delivery contract (descriptive, non-authoritative)

Derived view only

Acceptance (delivery-level):

powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/legacy/delivery/ACCEPTANCE_DELIVERY_ENVELOPE_V0.ps1


Acceptance outputs (frozen semantics):

_exports/delivery/acceptance_report_v0.json (machine-readable reference)

_exports/delivery/acceptance_report_v0.txt (human-readable mirror)

_exports/delivery/cases/**/stdout.txt

_exports/delivery/cases/**/stderr.txt

Evidence export (explicit, non-automatic):

$env:GEOX_AO_ACT_TOKEN_EXPORT="<set-real-export-token-via-env>"

powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/legacy/delivery/EXPORT_EVIDENCE_PACK_V0.ps1 `
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
  -File scripts/legacy/powershell/ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE.ps1

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
  -File scripts/legacy/powershell/ACCEPTANCE_SPRINT26_EVIDENCE_EXPORT_V1_SMOKE.ps1

Hard boundaries (must remain true)

evidence_pack_v0 remains an offline script with unchanged semantics

No scheduler, no background executor, no coupling to Judge/ProblemState


# Sprint 27 · Executor Runtime v1 (deployable adapter, not scheduler)

- Added apps/executor (pnpm workspace app) with a run-once executor adapter.
- Executor v1 reads AO-ACT index (tenant-filtered), appends ao_act_receipt_v0 for tasks without receipts, then triggers evidence_export_api_v1 job and waits for completion.
- Added acceptance: scripts/legacy/powershell/ACCEPTANCE_SPRINT27_EXECUTOR_RUNTIME_V1_SMOKE.ps1 (creates approval_request_v1 -> approves -> runs executor -> verifies receipt).

Governance: executor is explicit/run-once; no infinite auto-scheduling loop, and no cross-tenant enumeration.


# Sprint A1 · Telemetry MQTT Ingest v1 (MVP-观测)

Scope

- MQTT topic: telemetry/{tenant_id}/{device_id}
- Ingest: mqtt → append-only telemetry facts (idempotent by (tenant_id,device_id,metric,ts_ms))
- Projection: telemetry_index_v1 (query by device/metric/time)
- Read API: GET /api/telemetry/v1/query

Dev run (Windows minimal)

- If you are on Windows + Node 24 without VS C++ Build Tools: use `pnpm ... --ignore-scripts` to bypass native module build for dev-only slices.
- For Sprint A1 only, you may run server with Apple II disabled:

  $env:GEOX_DISABLE_APPLE_II = "1"

  (Commercial delivery must not disable Apple II.)

Acceptance

powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/legacy/powershell/ACCEPTANCE_SPRINTA1_TELEMETRY_MQTT_SMOKE.ps1
## Sprint A1/A2 · Telemetry ingest + Devices/Credentials + Telemetry query (v1)

本次交付新增了 Telemetry 侧闭环（MQTT→ingest→append-only facts→query），并引入 Devices/Credentials 管理接口。

### 新增/变更点
- 新增 API：
  - POST /api/devices  （devices.write）
  - GET  /api/devices/:device_id （devices.read）
  - POST /api/devices/:device_id/credentials （devices.credentials.write）
  - POST /api/devices/:device_id/credentials/:credential_id/revoke （devices.credentials.revoke）
  - GET  /api/telemetry/v1/query （telemetry.read）
- 新增 apps/telemetry-ingest（MQTT 订阅 + credential 校验 + 写入 telemetry facts）
- 新增投影表：telemetry_index_v1 / device_index_v1（见 docker/postgres/init/008/009）

### Token/Scope 说明（重要）
为支持上述新增 API 与验收脚本，本次扩展了 example_tokens.json 的 scopes：
- devices.write / devices.read
- devices.credentials.write / devices.credentials.revoke
- telemetry.read

该扩展仅用于 Sprint A1/A2 的“观测闭环 + 设备凭据闭环”最小能力，不改变 AO-ACT task/receipt 的语义边界。

## Governance: Recommendation Execution Boundary

- recommendation ǽ󣬱ûִȨ
- recommendation 뾭 approval ܽ operation_plan / AO-ACT task
- executor ֻ AO-ACT task recommendation

Negative acceptance must cover:

- δȨʣ401
- ⻧ʣ403/404
-  recommendationfail
- δִУforbidden
- ظ dispatchidempotent, no duplicate execution

---

## GEOX – P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo Freeze Snapshot

Key anchors:

- Branch: main
- PR: #2146
- Completion tag: p8_real_evidence_closed_loop_demo_completion
- Main merge tag: p8_real_evidence_closed_loop_demo_main_merge
- Completion commit: 3441fc7157741a80800aec69e54c680a862e111b
- Main merge commit: 36fbe07528af7ace9c04d087e21f87491e30633e

Frozen scope:

- P8 real evidence closed-loop replay demo
- Real raw_samples evidence window
- Real soil moisture state estimate
- Real soil moisture prediction run
- Real actual holdout observation window
- Backtest error report
- Calibration candidate report
- Product replay demo report

P8 fixed replay scope:

- problem = soil_moisture_state_estimation
- project_id = P_DEFAULT
- sensor_group_id = G_CAF
- sensor_id = CAF009
- metric_kind = soil_moisture
- history_window = 2009-06-09T00:00:00.000Z -> 2009-06-09T04:00:00.000Z
- prediction_window = 2009-06-09T05:00:00.000Z -> 2009-06-09T07:00:00.000Z
- actual_window = 2009-06-09T05:00:00.000Z -> 2009-06-09T07:00:00.000Z
- expected_interval_ms = 3600000

Acceptance:

- node scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs

Hard boundaries:

- P8 replay runtime is read-only
- No database write by replay runtime
- No fact write
- No Field Memory write
- No model write or automatic learning loop
- No execution object
- No AO-ACT task
- No dispatch
- No receipt
- No server route
- No frontend authority
- Prediction is not authorization
- Calibration candidate is not model update

Related post-merge convergence:

- docs/REPOSITORY_HANDOFF_MAP.md
- docs/twin_kernel/README.md
- docs/legacy/POST_P8_NON_MAINLINE_CANDIDATES.md

﻿
---

## P9-00 Twin Kernel Dual-Line Freeze Backfill Snapshot

Key anchors:

- Branch: p9-00-twin-kernel-freeze-index-backfill
- Authority source: README_MIGRATION.md
- Domain reference: docs/twin_kernel/README.md
- Acceptance: node scripts/governance_acceptance/P9_00_TWIN_KERNEL_FREEZE_INDEX_BACKFILL_ACCEPTANCE.cjs

Frozen scope:

- server_persisted_twin_kernel = product runtime line
- offline_real_evidence_replay_kernel = offline replay / validation line
- P8 remains an offline real-evidence replay line.
- Persisted server Twin Kernel remains the product runtime line.
- No silent crossing between the two Twin Kernel lines is allowed before a future reconciliation contract exists.

Hard boundaries:

- No runtime code change
- No server route change
- No frontend change
- No database migration
- No seed change
- No replay algorithm change
- No model update
- No Field Memory write
- No AO-ACT task
- No dispatch
- No receipt
- No dashboard authority

---

## P9-00 POST-P8 Historical Task Doc Cleanup Freeze Backfill Snapshot

Key anchors:

- Branch: main
- Tag: post_p8_historical_task_doc_apply_bundle_main_merge
- Commit: 3e9663fc071ffe355d9dbcdc1f095ad40b3e6912
- Acceptance: node scripts/governance_acceptance/POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_ACCEPTANCE.cjs
- Report: docs/legacy/POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_REPORT.json

Frozen scope:

- POST-P8 historical_task_doc cleanup apply bundle
- moved_file_count = 48
- reference_update_plan_item_count = 371
- runtime_surface_diff_count = 0
- Historical task documents selected by POST-P8-18 have been moved into docs/legacy/tasks.
- Exact references from the apply bundle have been updated.
- Runtime surface remained unchanged.

Cleanup closure:

- POST-P8 historical_task_doc cleanup is complete and no further POST-P8 historical cleanup gate is added by P9-00.

Hard boundaries:

- No continuation of POST-P8 cleanup as a P9 task
- No runtime code change
- No server route change
- No frontend change
- No database migration
- No seed change
- No Twin Kernel runtime persistence change
- No replay case registry change in P9-00
- No model version manifest change in P9-00
- No replay artifact mapping change in P9-00


---

## P10-10 Runtime Reconciliation Read-Only Adapter Proof Freeze Closure

Key anchors:

- Branch: main
- P10 merge commit: 8a44fc47
- Final closure tag: p10_runtime_reconciliation_read_only_adapter_proof
- Prior artifact-merge tag: p10_runtime_reconciliation_non_persisted_candidate_adapter_proof
- Acceptance:
  - node scripts/governance_acceptance/P10_07_READ_ONLY_DRY_RUN_ADAPTER_PROOF_V0_ACCEPTANCE.cjs
  - node scripts/governance_acceptance/P10_09_RUNTIME_RECONCILIATION_COMPLETION_REVIEW_ACCEPTANCE.cjs

Frozen scope:

- P10 Runtime Reconciliation Contract / Non-Persisted Candidate Adapter Proof is complete.
- P8 offline replay artifacts can be converted into non-persisted candidate Twin object envelopes.
- Default adapter proof uses committed fixtures only.
- raw_samples is not required by default acceptance.
- P8 replay is not invoked by default acceptance.
- Candidate bundle count is 7.
- All write counts are zero.

Freeze closure result:

- P10 functional / governance artifact line = complete
- P10 main merge = complete
- P10 runtime boundary = clean
- P10 persistence boundary = not crossed
- P10 freeze ledger = closed by P10-10
- Final closure tag = p10_runtime_reconciliation_read_only_adapter_proof

Hard boundaries:

- No runtime code change
- No server route change
- No frontend change
- No database migration
- No seed change
- No package manager change
- No CI change
- No persisted Twin object creation
- No fact write
- No DB write
- No Field Memory write
- No model update
- No AO-ACT task
- No dispatch
- No receipt
- No dashboard authority
- No kernel line merge

Post-P10 baseline:

- Next phase must start after tag p10_runtime_reconciliation_read_only_adapter_proof.
- Any persistence work requires a new phase and a new contract.
- P11 must not treat P10 candidate envelopes as persisted runtime objects without a new persistence policy, object identity policy, idempotency policy, migration/table policy, rollback policy, audit policy, operator review gate, and human authorization gate.


---

## P11 Controlled Persistence Preconditions / Runtime Adapter Design Gate Freeze Closure

Key anchors:

- Branch: main
- Baseline tag: p10_runtime_reconciliation_read_only_adapter_proof
- Baseline commit: 38e1ea82
- Final closure tag: p11_controlled_persistence_preconditions_runtime_adapter_design_gate
- Acceptance:
  - node scripts/governance_acceptance/P11_09_PERSISTENCE_PREFLIGHT_PROOF_V0_ACCEPTANCE.cjs
  - node scripts/governance_acceptance/P11_10_COMPLETION_REVIEW_ACCEPTANCE.cjs

Frozen scope:

- P11 Controlled Persistence Preconditions / Runtime Adapter Design Gate is complete.
- All 7 P10 candidate envelopes are covered by persistence preflight policies.
- Deterministic future object identity keys can be derived.
- Deterministic future idempotency keys can be derived.
- Future persistence requires operator review and human authorization.
- Future schema/table design is proposed but not implemented.
- Rollback, supersession, audit, and projection policies exist.
- P11 remains policy-covered but not persisted.

Freeze closure result:

- candidate_count = 7
- policy_coverage_count = 7
- future_object_identity_key_count = 7
- future_idempotency_key_count = 7
- persistence_execution_allowed = false
- implementation_readiness_status = blocked_until_P12
- persisted_object_count = 0
- persistence_intent_created = false
- write_count = 0
- db_write_count = 0
- fact_write_count = 0
- audit_write_count = 0
- field_memory_write_count = 0
- model_update_count = 0
- ao_act_task_count = 0
- runtime_surface_changed = false
- forbidden_path_diff_count = 0

Hard boundaries:

- No runtime code change
- No server route change
- No frontend change
- No database migration
- No seed change
- No package manager change
- No CI change
- No persisted Twin object creation
- No fact write
- No DB write
- No Field Memory write
- No model update
- No calibration application
- No AO-ACT task
- No dispatch
- No receipt
- No dashboard authority
- No runtime adapter implementation
- No table creation
- No P8 replay invocation
- No automatic persistence intent
- No automatic human authorization

Post-P11 baseline:

- Next phase must start after tag p11_controlled_persistence_preconditions_runtime_adapter_design_gate.
- P11 proves policy coverage for future controlled persistence only.
- P11 does not prove persisted object creation, server runtime adapter operation, DB migration correctness, production write safety, dashboard use, recommendation use, or AO-ACT use.
- P12 may only begin controlled persistence adapter implementation after a new phase contract.

