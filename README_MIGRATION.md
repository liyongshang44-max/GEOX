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
## Sprint 17 · Apple III · Execution Adapter v0

Tag: apple_iii_execution_adapter_v0

Scope:
- AO-ACT executor adapter (runtime) established: explicit task → executor → receipt → facts
- Two adapters: sim + device (device via internal gateway stub for acceptance/demo only)
- No new governance, no new rules, no auto-decision, no ProblemState → AO-ACT auto-trigger

Hard boundaries:
- NOT a scheduler: default does not run; primary entry is explicit `--taskFactId` / `--actTaskId`
- `--once` / index-pick mode is demo-only and fixed to: pick first task with no receipt (no other filtering)
- Executor only calls AO-ACT endpoints: POST /task, POST /receipt, GET /index
- No changes to AO-ACT v0 contracts/schemas; no changes to Judge/Agronomy semantics; no runtime ruleset discovery/loading

Acceptance:
- powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ACCEPTANCE_AO_ACT_EXECUTOR_V0.ps1

Notes:
- Server route registration for AO-ACT is required (apps/server/src/server.ts registers control_ao_act routes).
Index-only update (post-tag). No code changes.


Sprint 18 · Apple III · AO-ACT Audit Tools v0 (Offline Evidence Pack + Integrity Check)

Tag: apple_iii_ao_act_audit_tools_v0

Scope (what is frozen)

AO-ACT 的离线审计工具链，仅用于事实回放与一致性校验：

Evidence Pack v0

从 facts 账本中 离线导出 某一 act_task_id 对应的：

task fact

receipts（按冻结顺序规则）

refs（仅指针集合，不解析内容）

Integrity Check v0

对同一 act_task_id 做 只读一致性校验

输出独立的 integrity_report_v0

该 Sprint 不新增任何 runtime 能力，仅提供 DB-only / offline audit tooling。

What this Sprint explicitly adds (frozen)

Offline tools (DB-only):

scripts/audit/ao_act_evidence_pack_v0.cjs

scripts/audit/ao_act_integrity_check_v0.cjs

_env_v0.cjs / _db_v0.cjs（仅工具内部依赖）

Acceptance (proof of invariants):

scripts/ACCEPTANCE_AO_ACT_AUDIT_V0.ps1

scripts/ACCEPTANCE_AO_ACT_AUDIT_V0_RUNNER.cjs

Governance documentation:

docs/controlplane/GEOX-CP-AO-ACT-AuditTools-v0.md

Explicit non-goals (hard boundaries)

以下能力 明确不在本 Sprint 内，且被 acceptance 间接约束：

NOT a server feature

不新增 API endpoint

不提供 list / queue / discovery

不引入任何 audit HTTP 接口

NOT runtime execution

工具不参与任务执行

不被 executor / scheduler 调用

NOT governance mutation

不写入任何新 fact type

不影响 determinism_hash

不进入 Judge / Agronomy 语义路径

NOT interpretation

不解析 logs / refs 内容

只收集 pointer（existence-level）

Acceptance / Reproducibility (frozen proof)

Primary acceptance entrypoint:

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ACCEPTANCE_AO_ACT_AUDIT_V0.ps1


Acceptance 证明以下不变量成立：

Evidence Pack 类型、排序规则、字段结构固定

Task / Receipt 事实来源于账本（append-only）

Receipt 顺序规则冻结为 fact_id_lex_asc

Integrity report 必须 ok = true 且 errors 为空

工具链仅触达 AO-ACT 三个既有 server 端点（task / receipt / index）

Ordering & determinism guarantees (frozen)

Evidence Pack 类型：ao_act_receipt_evidence_pack_v0

Receipt ordering rule：fact_id_lex_asc

同一输入账本状态下，Evidence Pack 输出 确定性可重现

Hard boundaries (must remain true)

Audit Tools 只读 facts

不产生 side effects

不引入新的系统入口

不改变任何已有 Sprint 的治理语义

可随时删除、重跑、回放，不影响系统状态

Notes

本 Sprint 是 审计能力补齐，不是系统行为扩展

所有 audit 输出均为 派生物（derived artifacts）

若未来引入 audit API / audit fact，必须单独开 Sprint，并先冻结 Audit Non-Goals


Sprint 19 · Apple III · AO-ACT AuthZ Contract v0 (Token/Scope + Revocation + Audit Fact)

Purpose (scope)

为 AO-ACT 引入最小商用安全边界：

- Token/Scope：写 task / 写 receipt / 读 index 的最小授权
- 默认 deny-all
- 可撤销（撤销对后续请求立即生效）
- 可追责：授权通过时写入 append-only 审计 fact（不修改 task/receipt contract）

Key files (frozen paths)

docs/controlplane/GEOX-CP-AO-ACT-AuthZ-Contract-v0.md

config/auth/ao_act_tokens_v0.json

apps/server/src/auth/ao_act_authz_v0.ts

apps/server/src/routes/control_ao_act.ts

packages/contracts/ao_act_authz_audit_v0.schema.json

Acceptance / Reproducibility

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ACCEPTANCE_AO_ACT_AUTHZ_V0.ps1

Negative guarantees (must remain true)

- 无 token 不能写 task
- 低权限 token 不能写 receipt
- token 撤销后立即拒绝
- 不引入 IAM / scheduler / auto-trigger / queue

Tag (to be created after verification)

apple_iii_ao_act_authz_v0

Sprint 20 · Apple III · AO-ACT Receipt Idempotency v0 (Retry-safe receipt write)

Purpose (scope)

让客户“敢重试”。网络失败或重放不会造成 receipt 事实重复写入，从而污染语义。

Key behavior

- POST /api/control/ao_act/receipt 必须提供 meta.idempotency_key（非空字符串）
- 服务器以 (act_task_id, executor_id.kind, executor_id.id, executor_id.namespace, meta.idempotency_key) 作为幂等去重范围
- 若命中重复：HTTP 409，返回 existing_fact_id

Key files (frozen paths)

docs/controlplane/GEOX-CP-AO-ACT-Idempotency-Contract-v0.md

apps/server/src/routes/control_ao_act.ts

scripts/ACCEPTANCE_AO_ACT_IDEMPOTENCY_V0.ps1

scripts/ACCEPTANCE_AO_ACT_IDEMPOTENCY_V0_RUNNER.cjs

Acceptance / Reproducibility

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ACCEPTANCE_AO_ACT_IDEMPOTENCY_V0.ps1

Negative guarantees (must remain true)

- 不引入 scheduler / queue
- 不引入 server 端自动重试
- 不修改 AuthZ 语义

Tag (to be created after verification)

apple_iii_ao_act_idempotency_v0

Sprint 21 · Apple III · AO-ACT Device Adapter (L2) v0 (Protocol skeleton; pointer-only)

Status

- In progress (not frozen)

Purpose (scope)

为“真实设备接入”建立最小协议骨架：允许将设备侧材料作为 append-only facts 写入，并在 receipt 中以 refs 方式引用。

Key behavior

- 新增事实类型：ao_act_device_ref_v0（通过通用 /api/raw 写入）
- ao_act_receipt_v0 可选字段 payload.device_refs[]：仅允许 kind=device_ref_fact + ref=fact_id
- Server 端只做结构校验 + 存在性校验：ref 必须存在且 type=ao_act_device_ref_v0
- 不解析 device_ref 的内容，不产生任何控制信号，不触碰 Judge/Agronomy

Key files (draft paths)

docs/controlplane/GEOX-CP-AO-ACT-DeviceAdapter-Contract-v0.md

packages/contracts/ao_act_device_ref_v0.schema.json

packages/contracts/ao_act_receipt_v0.schema.json

apps/server/src/routes/control_ao_act.ts

scripts/ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0.ps1

scripts/ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0_RUNNER.cjs

Acceptance / Reproducibility

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0.ps1

Negative guarantees (must remain true)

- 不引入实时控制 / 下发指令
- 不解析 device_ref 内容
- 不引入 scheduler / queue / auto-trigger
- 不让设备结果写回 Judge

Tag (to be created after verification)

apple_iii_ao_act_device_adapter_v0

GEOX 鈥?Sprint 21 AO-ACT Device Adapter v0 (L2) Freeze Snapshot (DRAFT)

Tag: (pending)

Purpose:
Introduce a minimal, pointer-only device evidence contract for AO-ACT receipts without binding to any specific hardware and without introducing control/automation.

Frozen files (SSOT):
- docs/controlplane/GEOX-CP-AO-ACT-DeviceAdapter-Contract-v0.md
- packages/contracts/ao_act_device_ref_v0.schema.json
- packages/contracts/ao_act_receipt_v0.schema.json (adds optional device_refs[] pointer list)
- apps/server/src/routes/control_ao_act.ts (receipt validates device_refs existence only)
- scripts/ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0.ps1
- scripts/ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0_RUNNER.cjs

Acceptance:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0.ps1

Hard boundaries (must remain true):
- No device control, no realtime control, no scheduler/queue.
- device_refs are pointers only; server does not parse device content.
- No automatic writes into Judge or Agronomy as a side-effect of AO-ACT writes.
