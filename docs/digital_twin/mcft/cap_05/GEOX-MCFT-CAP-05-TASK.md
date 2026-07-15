<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md -->

# GEOX MCFT-CAP-05 — Human Decision and Execution-Receipt Feedback

## 完整任务线 v0.4 P-1-Ready Architecture-Conformance Revision

本任务线以以下权威为依据：

```text
GEOX Complete Agricultural Digital Twin Master Task Line
GEOX DT-02 Frozen Architecture
GEOX DT-02 Canonical Object Set
GEOX DT-02 Atomic Transaction Matrix
GEOX DT-02 to MCFT Implementation Map
MCFT-CAP-03 observation-aware State continuation contract
MCFT-CAP-04 Forecast / Scenario Runtime and final COMPLETE evidence
current PostgreSQL append-only facts and rebuildable projections
existing executed-irrigation aggregation contract
existing Action / AO-ACT governance boundary
```

当前状态：

```text
architecture_direction:
CONFORMANT

design_status:
DESIGN_FROZEN

implementation_status:
S8_AUTHORIZED_NOT_STARTED

authorization_effective:
true

runtime_source_authorized:
true

active_delivery_slice_id:
MCFT-CAP-05.MCFT-07-11.FORECAST-OBSERVATION-RESIDUAL-C-COMMIT-V1

dt02_architecture_amendment_status:
NOT_REQUIRED_MERGED_EFFECTIVE

first_permitted_repository_action:
MCFT-CAP-05.MCFT-07-11.FORECAST-OBSERVATION-RESIDUAL-C-COMMIT-V1
```

P-1 至 S7 已按各自 lifecycle 形成 merged-effective 事实。当前活动切片为 S8 Forecast Observation Residual；仅授权其受控 Runtime 实现，仍不授权 CAP-06、校准、模型激活、自动建议或因果效果声明。

## P-1 adjudication merged-effective result

```text
adjudication_result:
REUSE_WITHOUT_AMENDMENT

decision_object:
reuse twin_decision_record_v1 through G_HUMAN_DECISION_LINK_COMMIT

action_feedback_object:
reuse twin_action_feedback_v1 through H_ACTION_FEEDBACK_COMMIT

forecast_residual_object:
reuse twin_forecast_residual_v1 through C_FORECAST_RESIDUAL_COMMIT

new canonical object:
none

new transaction family:
none

DT-02 Architecture Amendment 03:
not required

repository_effectiveness:
MERGED_EFFECTIVE

P0_permitted:
true
```

## v0.4 修订裁决摘要

v0.4 在 v0.3 基础上冻结以下修订：

```text
1. Forecast Residual 与 Assimilation Innovation 分离。
2. Forecast-to-observation projection 采用 root-zone storage → root-zone mean VWC H=1，
   不声称生成 200 mm 点位预测。
3. Forecast Residual 可引用 Assimilation Update，但不得复制或拥有 Assimilation gain、posterior authority。
4. Approved Plan Snapshot 与 Approval Assertion Evidence 分离并显式互相引用。
5. Replay Evidence ingress、identity、hash、availability 和 idempotency 成为正式契约。
6. ActionFeedbackToExecutedIrrigationCandidateAdapterV1 补齐 binding、scope、eligibility 和 quality mapping。
7. Action Feedback 的时效 authority 改为 logical-time Evidence cutoff 与 frozen Evidence Window，
   不再使用“在目标 tick commit 前到达”。
8. selected_option_ref 定义为 GEOX semantic member reference，不冒充 RFC 6901 JSON Pointer。
9. feedback-cycle projection 必须显式展示 Dispatch disposition。
10. P0 必须完整清理 CAP-04 Matrix 陈旧 lifecycle 字段，而非只修 implementation_status。
11. canonical Twin object fact delta、Replay Evidence fact delta 和 projection row delta 分开计数。
12. P-1 仍优先裁决 REUSE_WITHOUT_AMENDMENT，但不得预先假定结果。
```

---

# 0. 核心裁决

```text
capability_line_id:
MCFT-CAP-05

display_alias:
MCFT-5

canonical_name:
Human Decision and Execution-Receipt Feedback

runtime_mode:
REPLAY

target_completion_level:
Level A — Deterministic Replay Twin

predecessor_capability_line_id:
MCFT-CAP-04

successor_capability_line_id:
MCFT-CAP-06

successor_authorized:
false
```

Owner work packages：

```text
primary_owner_work_package_ids:
MCFT-13 — Human Decision
MCFT-15 — Execution Feedback

contributing_owner_work_package_ids:
MCFT-01 — Replay Evidence
MCFT-02 — Canonical Contracts
MCFT-03 — Persistence / Idempotency / Projection
MCFT-04 — Tick / Checkpoint / Recovery
MCFT-05 — Evidence Window
MCFT-06 — Dynamics
MCFT-07 — Observation and Assimilation
MCFT-08 — Posterior State
MCFT-09 — Forecast
MCFT-10 — Scenario
MCFT-11 — Forecast Residual
MCFT-14 — Action Lifecycle Boundary
MCFT-16 — Closed-Loop Orchestration

excluded_owner_work_package_ids:
MCFT-12 — Calibration and Model Activation
MCFT-17 — Runtime Read APIs
MCFT-18 — Operator Integration
```

## 0.1 本能力线建立什么

```text
1. 从 canonical twin_scenario_set_v1 中形成受控 Human Decision。

2. Human Decision 复用：
   twin_decision_record_v1
   G_HUMAN_DECISION_LINK_COMMIT。

3. 记录并验证外部或人类提供的 Approval Assertion Evidence
   和 Approved Irrigation Plan Snapshot Evidence。

4. Approval Assertion 与 Plan Snapshot 保持两个可独立追溯的 Replay Evidence record；
   它们不自动升级为新的 canonical Twin object。

5. Execution Receipt Evidence 被标准化为：
   twin_action_feedback_v1
   并通过 H_ACTION_FEEDBACK_COMMIT 持久化。

6. Scenario amount、approved amount、actual covered-footprint amount
   和 target-scope-equivalent irrigation 严格分离。

7. 只有在 Evidence cutoff 之前已可用、进入 frozen Evidence Window、
   scope 精确匹配、可信且明确 eligible 的 Action Feedback，
   才能成为下一正常 State Tick 的 irrigation input。

8. Decision、Approval Evidence、Plan Evidence 和 Action Feedback commit
   均不得直接修改 State 或 checkpoint。

9. 下一正常 A1/A2 State Tick 消费 Action Feedback，
   并继续生成 posterior State、72-hour Forecast 和 Scenario Set。

10. 后续实际观测必须与明确的历史 Forecast point 匹配。

11. Forecast Residual 复用：
    twin_forecast_residual_v1
    C_FORECAST_RESIDUAL_COMMIT。

12. Forecast point 必须先通过冻结的 H=1 observation-domain projection，
    从 root-zone storage 投影到 root-zone mean VWC fraction。

13. Forecast error 与 Assimilation innovation 是两个不同量：
    它们共享 actual observation 和 trace context，
    但只有在显式 equivalence proof 成立时才允许数值相等。

14. Residual、Assimilation Update、posterior State、
    regenerated Forecast 和 regenerated Scenario
    必须形成可重建追溯链。

15. feedback-cycle projection 必须显式展示：
    Decision、Approval、Dispatch disposition、Execution、Outcome Observation、
    Forecast Residual、Assimilation 和 Updated State。

16. 建立受控 Level A Replay manual runner。

17. 建立 bounded multi-tick feedback chain。

18. 建立 restart、response-loss、projection rebuild、
    late-receipt no-shift 和 canonical recovery。
```

---

## 0.2 本能力线不建立什么

```text
NO_AUTOMATIC_RECOMMENDATION
NO_POLICY_EVALUATION
NO_GEOX_APPROVAL_REQUEST_WORKFLOW
NO_GEOX_APPROVAL_AUTHORITY_EXERCISE
NO_FORMAL_OPERATION_PLAN_V1
NO_AO_ACT_TASK_CREATION
NO_AUTOMATIC_TASK_PROJECTION
NO_AUTOMATIC_DISPATCH
NO_GEOX_DEVICE_COMMAND
NO_DEVICE_CONTROL
NO_EXECUTION_ACCEPTANCE
NO_EXECUTION_VALIDATION_SCORE
NO_CAUSAL_EFFECT_ATTRIBUTION
NO_ACTION_EFFECTIVENESS_CLAIM
NO_FORECAST_RESIDUAL_ASSIMILATION_INNOVATION_IDENTITY_CLAIM
NO_POINT_200MM_FORECAST_PROFILE_CLAIM
NO_ROI
NO_FIELD_MEMORY
NO_CALIBRATION_CANDIDATE
NO_SHADOW_EVALUATION
NO_MODEL_ACTIVATION
NO_ACTIVE_MODEL_PARAMETER_CHANGE
NO_LATE_EXECUTION_EVIDENCE_REVISION_RUNTIME
NO_AUTOMATIC_HISTORY_REWRITE
NO_CONTINUOUS_SCHEDULER
NO_SHADOW_ONLINE_CLAIM
NO_LIVE_FIELD_CLAIM
NO_CONTROLLED_FIELD_TWIN_COMPLETE_CLAIM
NO_MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
```

---

# 1. 当前仓库事实基线

本设计审查时，最新已验证 `main` 为：

```text
main:
3eba797307388bd652dc5c65e91d634375e1b8c2

CAP-04 v0.5 package / Closure SSOT remediation:
PR #2422
merge commit dbedff0eaa44cd638d461abbfd420f8f7b9fdc8d

repository CI stabilization:
PR #2428
exact head d2a2b0bfe616f122620f0f6d7dfa644de7b83072
merge commit 3eba797307388bd652dc5c65e91d634375e1b8c2
```

P-1、P0 和 S0 不得永久把上述 SHA 当作未来基线。它们必须在执行时记录最新 verified main、exact-head CI、merge commit、tree equivalence 和 merged-main Gate。

总任务书中的 `97f5f5c...` 是 2026-07-08 的历史交接快照，只保留战略和边界 authority，不再作为当前仓库状态 SSOT。

## 1.1 已验证 predecessor 能力

当前仓库已经建立：

```text
MCFT-CAP-01 COMPLETE:
first-class water State bootstrap and persisted handoff

MCFT-CAP-02 COMPLETE:
hourly Dynamics, persistence, executed-irrigation aggregation,
restart/resume and bounded backfill

MCFT-CAP-03 COMPLETE:
observation selection, state assimilation, innovation trace,
posterior correction and observation-aware continuation

MCFT-CAP-04 COMPLETE:
72-hour Forecast, three fixed Scenario options,
A1/A2/B persistence, 24-tick range and restart/recovery
```

CAP-04 closure authority records：

```text
checkpoint sequence end = 72
global State count = 73
next logical tick = 2026-06-04T02:00:00.000Z
latest successful Forecast = non-null
latest Scenario Set = non-null
```

## 1.2 CAP-04 全局 Matrix 当前仍有 SSOT 偏差

当前全局 Matrix 中 CAP-04 同时存在：

```text
status = COMPLETE
implementation_status = S8_IMPLEMENTATION_CANDIDATE
active_delivery_slice_id = null
next_delivery_slice_id = MCFT-CAP-04.CLOSURE-CANDIDATE-V1
next_delivery_slice_authorized = false
latest_effective_slice_id = stale historical implementation slice
effectiveness_condition = stale S0 authorization condition
```

而 Closure authority 已经记录：

```text
status = COMPLETE
implementation_status = COMPLETE
closure_effective = true
capability_complete = true
active_delivery_slice_id = null
pending_completion_claims = []
effective completion claims = frozen CAP-04 set
```

因此 P0 必须执行完整 CAP-04 Matrix reconciliation，而不是只修改 `implementation_status`。

P0 必须：

```text
1. 将 current CAP-04 lifecycle fields 对齐到 COMPLETE authority。
2. 清除 stale next-delivery / authorization / effectiveness pointers。
3. 保留历史 delivery-slice baseline、merge commit、Gate 和 predecessor evidence，禁止改写历史。
4. 只更新明确标识为 current/reconciled/current_repository_baseline 的字段。
5. 将 CAP-05 provisional entry 建立为 NOT_AUTHORIZED。
6. 记录 P0 执行时的 latest verified main，而不是覆盖历史 commit authority。
```

---

# 2. DT-02 冻结架构约束

DT-02 已冻结：

```text
twin_decision_record_v1
→ NON_LINEAGE_CONTEXT
→ G_HUMAN_DECISION_LINK_COMMIT

twin_action_feedback_v1
→ NON_LINEAGE_CONTEXT
→ H_ACTION_FEEDBACK_COMMIT

twin_forecast_residual_v1
→ NON_LINEAGE_CONTEXT
→ C_FORECAST_RESIDUAL_COMMIT
```

DT-02 已冻结八个 transaction families：

```text
A_STATE_TICK_COMMIT
B_SCENARIO_COMMIT
C_FORECAST_RESIDUAL_COMMIT
D_MODEL_GOVERNANCE_STEP_COMMIT
E_REVISION_LINEAGE_STEP_COMMIT
F_OPERATIONAL_ATTEMPT_HEALTH
G_HUMAN_DECISION_LINK_COMMIT
H_ACTION_FEEDBACK_COMMIT
```

以下 v0.2 设计已撤回：

```text
field_twin_human_decision_v0
field_twin_action_plan_ref_v0
field_twin_execution_receipt_ref_v0
field_twin_residual_v0
field_twin_outcome_evidence_window_v0

H1_HUMAN_DECISION_COMMIT
H2_APPROVED_PLAN_REFERENCE_COMMIT
H3_EXECUTION_RECEIPT_REFERENCE_COMMIT
H4_OUTCOME_RESIDUAL_LINK_COMMIT
```

它们不得进入 Runtime 实现。

---

# 3. P-1 — DT-02 Object / Transaction Adjudication

```text
delivery_slice_id:
MCFT-CAP-05.P-1.DT02-OBJECT-TRANSACTION-ADJUDICATION-V1

slice_kind:
ARCHITECTURE_GOVERNANCE_ONLY

runtime_source_authorized:
false

migration_authorized:
false

canonical_write_authorized:
false
```

P-1 已 merged-effective；P0 是当前唯一允许的下一步。

## 3.1 P-1 必须裁决的十六项问题

```text
1. Human Decision 是否完整复用 twin_decision_record_v1。
2. CAP-05 v1 是否取消 DEFER。
3. selected_option_ref 是否采用 GEOX semantic member reference，及其解析规则。
4. Decision second-write / supersession policy。
5. Approval Assertion 与 Approved Plan 是否保持两个 Replay Evidence record。
6. Replay Evidence ingress、source namespace、identity、hash、availability 和 idempotency。
7. Execution Receipt 是否完整复用 twin_action_feedback_v1。
8. execution_status / validation_status / source quality 映射。
9. Action Feedback 到 ExecutedIrrigationCandidateV1 的完整字段映射。
10. Forecast Residual 是否完整复用 twin_forecast_residual_v1。
11. Forecast Residual 与 Assimilation Innovation 的分离边界。
12. Outcome feedback trace 是 projection 还是 canonical object。
13. 是否只使用 C / G / H 冻结事务。
14. NON_LINEAGE_CONTEXT envelope 的 logical_time / as_of / context refs。
15. Forecast point 到 observation unit-domain 的 H=1 projection math 和 variance math。
16. actual amount、coverage、target-scope-equivalent irrigation 和 Evidence cutoff 的物理/时间语义。
```

---

## 3.2 首选 adjudication outcome

```text
Decision:
reuse twin_decision_record_v1
reuse G_HUMAN_DECISION_LINK_COMMIT

Selected option reference:
GEOX semantic member reference
not RFC 6901 JSON Pointer

Approval:
approval_assertion_evidence_v1
plus approved_irrigation_plan_snapshot_v1
both controlled Replay Evidence
plus rebuildable non-canonical binding projection

Execution Receipt:
reuse twin_action_feedback_v1
reuse H_ACTION_FEEDBACK_COMMIT

Forecast Residual:
reuse twin_forecast_residual_v1
reuse C_FORECAST_RESIDUAL_COMMIT
keep forecast error separate from assimilation innovation

Forecast observation projection:
FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1
with deterministic variance projection

Outcome feedback window:
rebuildable non-canonical trace projection

Dispatch:
explicit disposition in trace projection
no new canonical Dispatch object

new canonical object type:
none

new transaction family:
none

DT-02 Architecture Amendment:
NOT REQUIRED
```

该结果已由 P-1 exact-head、tree-equivalence 和 merged-main Gate 证明并生效。

---

## 3.3 Amendment trigger

若 P-1 证明以下任一条件成立：

```text
Approved Plan 必须成为 first-class canonical object
Approval Assertion 必须成为 first-class canonical Twin object
Outcome Window 必须成为 first-class canonical object
DEFER 必须成为合法 Decision disposition
Decision supersession 无法由现有 envelope / G transaction 表达
twin_action_feedback_v1 无法表达必要执行语义
twin_forecast_residual_v1 无法表达 forecast error 和 projection trace
必须新增第九 transaction family
必须改变现有 C / G / H atomic boundary
```

则进入：

```text
MCFT-CAP-05.P-1A.DT02-ARCHITECTURE-AMENDMENT-V1
```

以下情况本身不触发 DT-02 amendment：

```text
新增 Replay Evidence record type
新增 deterministic projection
新增 adapter
新增 CAP-05 profile validator
新增 Runtime Config policy field
新增 projection table or idempotency table
```

P-1A 合并且 merged-main Architecture Gate 通过之前，P0 不得开始。

---

## 3.4 P-1 exact changed-file boundary

```text
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md

docs/digital_twin/mcft/cap_05/
GEOX-MCFT-CAP-05-TASK.md
GEOX-MCFT-CAP-05-P-1-ADJUDICATION.md
GEOX-MCFT-CAP-05-P-1-STATUS.json

scripts/governance_acceptance/
ACCEPTANCE_MCFT_CAP_05_P_MINUS_1_ADJUDICATION.cjs
```

P-1 禁止修改 DT-02 canonical files、Runtime source、migration、routes、web、facts、CAP-04 source 和 AO-ACT source。

## 3.5 Conditional P-1A boundary

仅当 P-1 输出 `AMENDMENT_REQUIRED` 时，P-1A 才允许：

```text
docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json
docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-03.md

docs/digital_twin/mcft/cap_05/
GEOX-MCFT-CAP-05-P-1A-STATUS.json

scripts/governance_acceptance/
ACCEPTANCE_DT_02_ARCHITECTURE_AMENDMENT_03.cjs
```

P-1A 仍禁止 Runtime source 和 migration。

---

# 4. 修订后的 object vocabulary

在首选复用路径下，CAP-05 新增使用的 canonical objects 只有：

```text
twin_decision_record_v1
twin_action_feedback_v1
twin_forecast_residual_v1
```

继续复用：

```text
twin_evidence_window_v1
twin_state_transition_v1
twin_assimilation_update_v1
twin_state_estimate_v1
twin_forecast_run_v1
twin_runtime_tick_v1
twin_runtime_checkpoint_v1
twin_runtime_health_v1
twin_scenario_set_v1
twin_runtime_config_v1
```

Replay Evidence record types：

```text
approval_assertion_evidence_v1
approved_irrigation_plan_snapshot_v1
irrigation_execution_receipt_evidence_v1
soil_moisture_observation_v1
optional external_dispatch_evidence_v1
```

非 canonical deterministic artifacts：

```text
decision_eligibility_evaluation_v1
selected_scenario_option_resolution_v1
approved_plan_binding_projection_v1
ActionFeedbackToExecutedIrrigationCandidateAdapterV1 trace
forecast_observation_projection_v1
forecast_assimilation_equivalence_evaluation_v1
action_feedback_cycle_projection_v1
```

Authority hierarchy：

```text
canonical Twin object truth:
append-only canonical facts

Replay Evidence truth:
append-only Evidence facts and source semantic hash

projection truth:
none; projections are rebuildable indexes or views

adapter output:
derived Runtime input; never a new execution authority
```

Projection 永远不是 canonical truth；Adapter 永远不能把 Approved、Planned、Dispatched 或 Scenario amount 转换成 execution authority。

---

# 5. NON_LINEAGE_CONTEXT envelope

以下对象保持：

```text
lineage_member = false
envelope_profile = NON_LINEAGE_CONTEXT
```

适用对象：

```text
twin_decision_record_v1
twin_action_feedback_v1
twin_forecast_residual_v1
```

它们不得要求：

```text
lineage_id
revision_id
```

CAP-05 profile 必须要求：

```text
context_lineage_ref
context_revision_ref
```

Base object envelope 的 Reality scope 仍必须完整存在。

冻结 logical-time profile：

```text
twin_decision_record_v1.logical_time
= source Scenario Set logical_time

twin_decision_record_v1.as_of
= decided_at

twin_action_feedback_v1.logical_time
= execution_end

twin_action_feedback_v1.as_of
= available_to_runtime_at

twin_forecast_residual_v1.logical_time
= forecast point target_time

twin_forecast_residual_v1.as_of
= observation available_to_runtime_at
```

`created_at` 仅表示持久化创建时间，继续排除在 determinism hash 之外。

---

# 6. Cycle identities

## 6.1 Decision cycle

```text
decision_cycle_id
=
sha256(
  canonical(
    Reality scope
    + scenario_set_ref
    + scenario_set_hash
    + decision_window_start
    + decision_window_end
    + decision_policy_id
    + decision_policy_version
  )
)
```

规则：

```text
one decision_cycle_id
→ zero or one active twin_decision_record_v1
```

## 6.2 Feedback cycle

```text
feedback_cycle_id
=
sha256(
  canonical(
    decision_ref
    + decision_hash
    + approved_plan_evidence_ref
    + approved_plan_evidence_hash
    + feedback_policy_id
    + feedback_policy_version
  )
)
```

规则：

```text
one selected irrigation Decision
→ zero or one active feedback cycle
```

---

# 7. Human Decision Contract

Canonical type：

```text
twin_decision_record_v1
```

Transaction：

```text
G_HUMAN_DECISION_LINK_COMMIT
```

## 7.1 CAP-05 v1 disposition

CAP-05 v1 只允许：

```text
SELECT_SCENARIO_OPTION
```

`DEFER` 不建立 canonical Decision。未作出决策时，不存在 `twin_decision_record_v1`。

若以后需要 first-class DEFER：

```text
DT-02 Architecture Amendment required
```

## 7.2 selected option semantic member ref

冻结格式：

```text
selected_option_ref
=
<twin_scenario_set_v1.object_id>#/options/<option_id>
```

示例：

```text
scenario_set_abc123#/options/NO_ACTION
scenario_set_abc123#/options/IRRIGATE_NOW_15MM
scenario_set_abc123#/options/IRRIGATE_NOW_25MM
```

该格式定义为：

```text
GEOX_SCENARIO_OPTION_SEMANTIC_MEMBER_REF_V1
```

它不是 RFC 6901 JSON Pointer，因为 CAP-04 `options` 是数组。

解析规则：

```text
1. 读取 canonical Scenario Set ref/hash。
2. 验证 object_type = twin_scenario_set_v1。
3. 在 payload.options 中按 option_id 精确查找。
4. 必须且只能命中一个 option。
5. 重算 option semantic hash。
6. 验证 selected_option_id、selected_option_ref 和 hash 三者一致。
```

Decision 还保存：

```text
selected_option_id
selected_option_semantic_hash
selected_option_ref_policy_id = GEOX_SCENARIO_OPTION_SEMANTIC_MEMBER_REF_V1
```

## 7.2.1 Decision immutability

CAP-05 v1 冻结：

```text
one decision_cycle_id
→ at most one canonical Decision

same cycle + same request id + same hash
→ existing idempotent success

same cycle + different semantic hash
→ DECISION_CYCLE_CONFLICT

Decision supersession
→ not supported in CAP-05 v1
```

改变选择必须产生新的 decision cycle；不得原地修改或覆盖既有 Decision。

---

## 7.3 Decision eligibility evaluation

CAP-04 历史 Scenario payload 不新增 `decision_eligibility` 字段。CAP-05 使用纯派生：

```text
decision_eligibility_evaluation_v1
```

最低检查：

```text
source Forecast status = COMPLETED
source Forecast points = 72
Scenario Set came from successful B_SCENARIO_COMMIT
Scenario option set matches frozen CAP-04 policy
Scenario Set ref/hash canonical readback valid
Reality scope exact match
context lineage/revision refs valid
Scenario logical time equals controlled decision cycle source time
Scenario Set is current for its source Forecast
selected option exists
selected option ref resolves
selected option hash matches
decision request time falls inside config-pinned decision window
```

## 7.4 Decision payload minimum

```yaml
object_type: twin_decision_record_v1

decision_cycle_id: ...
decision_disposition: SELECT_SCENARIO_OPTION

scenario_set_ref: ...
scenario_set_hash: ...

selected_option_ref: ...
selected_option_id: ...
selected_option_semantic_hash: ...

source_forecast_ref: ...
source_forecast_hash: ...

source_posterior_ref: ...
source_posterior_hash: ...

context_lineage_ref: ...
context_revision_ref: ...

human_actor:
  actor_id: ...
  namespace: ...
  source_class: CONTROLLED_REPLAY

logical_time: <source Scenario Set logical_time>
as_of: <decided_at>

decided_at: ...
available_to_runtime_at: ...

decision_window_start: ...
decision_window_end: ...

rationale_codes: [...]
comment_ref: null | ...

recommendation_ref: null
policy_evaluation_ref: null
approval_request_ref: null

no_automatic_action: true
```

## 7.5 G transaction boundary

G commit：

```text
appends exactly one twin_decision_record_v1
writes decision and action-lifecycle read projection
infers no Approval
infers no Plan
infers no Task
modifies no State
modifies no checkpoint
```

---

# 8. Approval Assertion and Approved Plan Evidence

首选路径使用两个 Replay Evidence record：

```text
approval_assertion_evidence_v1
approved_irrigation_plan_snapshot_v1
```

它们都不是新的 canonical Twin object。

## 8.1 Approval Assertion Evidence

语义：

```text
external or human authority asserted APPROVED
GEOX did not create an approval request
GEOX did not exercise approval authority
```

最低 Evidence payload：

```yaml
record_type: approval_assertion_evidence_v1

decision_ref: ...
decision_hash: ...

selected_option_ref: ...
selected_option_hash: ...

scope: ...

approval_authority:
  kind: human | external_system
  authority_id: ...
  namespace: ...
  authority_scope_ref: null | ...

approval_status: APPROVED
approved_at: ...
available_to_runtime_at: ...

approval_semantics: EXTERNAL_OR_HUMAN_EVIDENCE_ASSERTION

geox_approval_request_created: false
geox_approval_authority_exercised: false

source_identity: ...
source_record_hash: ...
```

## 8.2 Approved Irrigation Plan Snapshot

最低 Evidence payload：

```yaml
record_type: approved_irrigation_plan_snapshot_v1

decision_ref: ...
decision_hash: ...

selected_option_ref: ...
selected_option_hash: ...

approval_assertion_ref: ...
approval_assertion_hash: ...

scope: ...

approved_at: ...
available_to_runtime_at: ...

valid_from: ...
valid_to: ...

action_type: IRRIGATE

scenario_requested_amount_mm: "15.000000"
approved_amount_mm: "15.000000"

difference_from_scenario_mm: "0.000000"
difference_reason_codes: []

source_approval_status: APPROVED

supersedes_plan_evidence_ref: null | ...
supersedes_plan_evidence_hash: null | ...

source_identity: ...
source_record_hash: ...
```

Plan Snapshot 不得自行声明审批 authority；它必须引用有效 Approval Assertion Evidence。

## 8.3 Replay Evidence ingress authority

CAP-05 Evidence 必须通过现有 append-only Replay Evidence ingress 持久化。

P-1 / S1 必须冻结：

```text
record_type
source namespace
origin_source_id
source_version
source_record_id
source_record_hash
semantic identity basis
idempotency key
occurred_at mapping
available_to_runtime_at
canonical unit and conversion rule
quality status
Reality scope
```

相同 Evidence identity：

```text
same identity + same semantic hash
→ existing idempotent success

same identity + different semantic hash
→ EVIDENCE_IDEMPOTENCY_CONFLICT
```

Projection 不是 Evidence ingress authority。

## 8.4 Plan binding projection

```text
approved_plan_binding_projection_v1
```

只做：

```text
Decision
→ valid Approval Assertion Evidence
→ current approved Plan Evidence
→ validity window
→ supersession chain
```

规则：

```text
one Decision
→ zero or one active approved Plan Evidence
```

Projection 丢失后必须从 Decision canonical fact、Approval Evidence 和 Plan Evidence 重建。

## 8.5 External dispatch context

feedback-cycle projection 必须存在：

```text
dispatch_disposition:
NOT_OBSERVED
NOT_APPLICABLE
EXTERNALLY_RECORDED
```

当 disposition = EXTERNALLY_RECORDED 时允许：

```text
external_dispatch_ref
external_dispatch_hash
```

External dispatch Evidence 只是 Context，不是 Execution，不得成为 Dynamics input。

---

# 9. Action Feedback Contract

Canonical type：

```text
twin_action_feedback_v1
```

Transaction：

```text
H_ACTION_FEEDBACK_COMMIT
```

## 9.1 Execution status mapping

```text
external delivery FULL
→ execution_status = EXECUTED

external delivery PARTIAL
→ execution_status = PARTIALLY_EXECUTED

external delivery UNKNOWN
→ execution_status = EXECUTION_UNCERTAIN

external delivery NONE
→ execution_status = NOT_EXECUTED
```

`source_delivery_disposition` 可作为 source trace，但 canonical authority 是 DT-02 `execution_status`。

## 9.2 Validation status

CAP-05 不建立 Execution Acceptance。

标准 Action Feedback：

```text
validation_status:
NOT_YET_VALIDATED
```

必须保持：

```text
source_quality
≠ validation_status
```

`NOT_YET_VALIDATED` 并不自动禁止 State input。

## 9.3 Action Feedback payload minimum

```yaml
object_type: twin_action_feedback_v1

feedback_cycle_id: ...

origin_kind: CONTROLLED_REPLAY_EXTERNAL

execution_event_id: ...

execution_status:
  EXECUTED
  PARTIALLY_EXECUTED
  EXECUTION_UNCERTAIN
  NOT_EXECUTED

validation_status: NOT_YET_VALIDATED

eligible_for_state_input: true | false
eligibility_reason_codes: [...]

actual_amount_mm: "13.600000"
actual_amount_semantics: AVERAGE_DELIVERED_DEPTH_OVER_COVERED_FOOTPRINT

spatial_coverage_fraction: "0.910000"

execution_start: ...
execution_end: ...
executed_at: <same as execution_end>
available_to_runtime_at: ...

source_identity:
  origin_source_id: ...
  executor_id: ...
  executor_namespace: ...

source_quality:
  PASS
  LIMITED
  FAIL

task_ref: null

receipt_ref: ...
receipt_hash: ...
as_executed_ref: null | ...
as_executed_hash: null | ...
acceptance_ref: null

context_lineage_ref: ...
context_revision_ref: ...

logical_time: <execution_end>
as_of: <available_to_runtime_at>

source_refs:
  - decision_ref
  - approved_plan_evidence_ref

evidence_refs:
  - approval_assertion_evidence_ref
  - approved_plan_evidence_ref
  - receipt_ref
  - as_executed_ref_if_any

limitations:
  - NO_EXECUTION_ACCEPTANCE
  - NO_CAUSAL_EFFECT_ATTRIBUTION
```

Action Feedback 必须保留 Scenario、Approved 和 actual amount 的来源 refs，但 canonical amount authority 只能是 trusted execution Evidence。

---

## 9.4 Eligibility mapping

Eligible：

```text
execution_status in EXECUTED, PARTIALLY_EXECUTED
validation_status = NOT_YET_VALIDATED
receipt_ref or as_executed_ref exists
source quality = PASS or LIMITED
actual_amount_mm > 0
spatial_coverage_fraction > 0
exact Reality scope match
execution start/end in one hourly interval
execution lies inside active Plan validity window
available_to_runtime_at <= target tick logical_time
Evidence is present in the target tick frozen Evidence snapshot
no conflicting duplicate
no second distinct event in same exact scope/interval
```

Ineligible：

```text
EXECUTION_UNCERTAIN
NOT_EXECUTED
source quality FAIL
available_to_runtime_at > target tick logical_time
not included in frozen Evidence Window
terminal target tick already committed
scope mismatch
cross-hour event
unsupported unit conversion
multiple distinct events
conflicting duplicate
missing active Approval Assertion
missing active Plan Snapshot
execution outside Plan validity window
```

禁止使用：

```text
"arrived before database commit"
```

作为时效 authority。Evidence eligibility 必须在 State Tick 运算前由 logical-time cutoff 和 frozen Evidence Window 固定。

---

# 10. Quantity semantics

```text
actual_amount_mm
=
average delivered water depth
over the physically covered footprint
```

```text
spatial_coverage_fraction
=
covered target area / total bound target area
```

```text
target_scope_equivalent_irrigation_mm
=
actual_amount_mm × spatial_coverage_fraction
```

标准示例：

```text
actual covered-footprint depth:
13.600000 mm

coverage:
0.910000

target-scope-equivalent irrigation:
12.376000 mm
```

CAP-05 v1 不直接接受：

```text
water_l
water_m3
pump_duration
valve_open_seconds
flow_rate
```

若 source 不是 millimetres over covered footprint：

```text
VOLUME_TO_DEPTH_CONVERSION_NOT_AUTHORIZED
```

---

# 11. Receipt Evidence Adapter Mapping

新增：

```text
ActionFeedbackToExecutedIrrigationCandidateAdapterV1
```

输出复用：

```text
ExecutedIrrigationCandidateV1
```

完整冻结映射：

```text
binding_id
=
current canonical Reality Binding binding_id

scope
=
exact Action Feedback Reality scope

event_id
=
twin_action_feedback_v1.execution_event_id

source_record_id
=
source Receipt Evidence record ID

executed_at
=
execution_end

ingested_at
=
available_to_runtime_at

origin_source_id
=
trusted execution source namespace
+ ":"
+ executor identity

executed_amount_mm
=
actual_amount_mm

coverage_fraction
=
spatial_coverage_fraction

eligible_for_state_input
=
twin_action_feedback_v1.eligible_for_state_input

source_quality
=
PASS    → USABLE
LIMITED → USABLE
FAIL    → UNUSABLE and adapter output must not be selected

execution_status
=
EXECUTED
```

对于 canonical `PARTIALLY_EXECUTED`：

```text
existing candidate execution_status = EXECUTED
source execution status retained in adapter trace = PARTIALLY_EXECUTED
```

原因：现有 `ExecutedIrrigationCandidateV1` 表达的是“存在可消费的实际执行事件”，而不是外部 delivery completion class。

Adapter trace 最低字段：

```text
action_feedback_ref/hash
receipt_ref/hash
source_execution_status
candidate_execution_status
binding_id
scope hash
eligibility mapping
quality mapping
adapter policy id/version
adapter determinism hash
```

Adapter 不得输出或读取为执行 authority：

```text
approved amount
planned amount
dispatched amount
scenario amount
already coverage-weighted effective amount
```

`target_scope_equivalent_irrigation_mm` 只能由既有 irrigation aggregator 计算，禁止 Adapter 预先乘 coverage，避免 double weighting。

---

# 12. Same-hour、multi-event 和 late safety

## 12.1 Same-hour

```text
execution_start
and
execution_end
must belong to the same hourly interval
```

```text
01:30–01:50
→ eligible for 02:00 tick

01:50–02:20
→ REQUIRES_INTERVAL_SPLIT
```

## 12.2 Multiple events

```text
one distinct irrigation execution event
per exact Reality scope
per hourly interval
```

允许 identical duplicate collapse；拒绝多个不同 execution events。

## 12.3 Late Evidence cutoff and late after commit

对目标 tick `T`，正常 eligibility 要求：

```text
available_to_runtime_at <= T.logical_time
and
Action Feedback was included in T frozen Evidence Window
```

若 execution 属于 `(T-1h, T]`，但：

```text
available_to_runtime_at > T.logical_time
or
T Evidence Window already frozen without this feedback
or
terminal tick T already committed
```

则：

```text
eligible_for_state_input = false

reason_code:
REVISION_REQUIRED_LATE_AFTER_CUTOFF
or
REVISION_REQUIRED_LATE_AFTER_COMMIT
```

它不得被平移到 `T+1`，不得改写 State，不得触发自动 history rewrite。

---

# 13. Receipt-consuming State Tick

Decision、Approval Assertion、Plan Evidence 和 Action Feedback commit 均不得直接修改 State。

只有既有 `A_STATE_TICK_COMMIT` 可以推进 State。

执行顺序：

```text
1. Read persisted predecessor handoff.
2. Resolve explicitly pinned Runtime Config.
3. Set deterministic Evidence cutoff = target logical_time.
4. Freeze current Evidence Window input snapshot.
5. Read eligible twin_action_feedback_v1 contained in that snapshot.
6. Adapt to complete ExecutedIrrigationCandidateV1.
7. Apply existing irrigation aggregator.
8. Derive target-scope-equivalent irrigation exactly once.
9. Execute Dynamics.
10. Execute observation selection.
11. Execute Assimilation if eligible observation exists.
12. Build posterior State.
13. Generate 72-hour Forecast.
14. Commit A1 or A2.
15. If A1, commit B Scenario Set.
16. Read canonical graph back.
```

A1/A2 member count 不变。Action Feedback 通过 `twin_evidence_window_v1.action_feedback_refs` 进入 State trace。

Evidence Window 必须记录：

```text
evidence_cutoff_time
action_feedback_refs
action_feedback_adapter_policy_id
selected execution source refs
deduplicated receipt refs
excluded feedback refs and reason codes
```

Action Feedback consumed by Dynamics does not imply execution validation or causal effectiveness。

---

# 14. Forecast Residual Contract

Canonical type：

```text
twin_forecast_residual_v1
```

Transaction：

```text
C_FORECAST_RESIDUAL_COMMIT
```

Required refs：

```text
forecast_run_ref
forecast_point_ref
observation_ref
runtime_config_ref
```

Context refs：

```text
context_lineage_ref
context_revision_ref
```

## 14.1 Forecast point semantic member ref

```text
forecast_point_ref
=
<twin_forecast_run_v1.object_id>#/points/<horizon_hour>
```

该格式定义为：

```text
GEOX_FORECAST_POINT_SEMANTIC_MEMBER_REF_V1
```

解析必须验证：

```text
horizon_hour integer in 1..72
exactly one point at horizon
point target_time matches issued_at + horizon
point semantic hash matches
```

## 14.2 Source Forecast selection

对于 observation at `O`，候选 Forecast 必须：

```text
Forecast.status = COMPLETED
Forecast point target_time = O
Forecast issued_at < O
Forecast canonical object existed before observation became available
Forecast source posterior already consumed Action Feedback
Forecast scope and context refs match
Forecast point projection method supported
```

若多个候选，选择最大 `Forecast.issued_at`；若仍并列，使用 deterministic object_id order 并要求 semantic equivalence，否则 fail closed。

## 14.3 Residual payload minimum

```yaml
object_type: twin_forecast_residual_v1

match_status: MATCHED | UNMATCHED

forecast_run_ref: ...
forecast_run_hash: ...
forecast_point_ref: ...
forecast_point_hash: ...
forecast_issued_at: ...
prediction_target_time: ...

observation_ref: ...
observation_hash: ...
observation_observed_at: ...
observation_available_to_runtime_at: ...
observation_quality: PASS | LIMITED | FAIL

projection_method_id: FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1
projection_method_version: 1
projection_input_hash: ...
projection_trace_hash: ...

predicted_observation:
  value: ...
  unit: fraction
  variance: ...

actual_observation:
  value: ...
  unit: fraction
  variance: ...

forecast_residual: ...
normalized_forecast_residual: ...
normalization_basis: FORECAST_PLUS_OBSERVATION_VARIANCE_V1

matching_policy_id: ...
matching_policy_version: ...

assimilation_update_ref: null | ...
posterior_state_ref: null | ...

runtime_config_ref: ...
runtime_config_hash: ...
context_lineage_ref: ...
context_revision_ref: ...

logical_time: <prediction_target_time>
as_of: <observation_available_to_runtime_at>

limitations:
  - FORECAST_ERROR_NOT_CAUSAL_EFFECT
  - ASSIMILATION_INNOVATION_NOT_ASSUMED_EQUAL
```

Forecast Residual 不拥有：

```text
assimilation gain authority
posterior estimate authority
model parameter update authority
causal attribution authority
```

这些 authority 分别属于 Assimilation Update、State Estimate 和后续 Model Governance。

---

# 15. Forecast Observation Projection

CAP-04 Forecast point 表达 root-zone storage / AWF；CAP-03 observation domain 是 VWC fraction。

禁止：

```text
Forecast storage mm
==
observation VWC fraction
```

也禁止声称：

```text
root-zone mean State
==
200 mm point forecast profile
```

必须建立：

```text
forecast_observation_projection_v1
```

## 15.1 冻结方法

首选方法 ID：

```text
FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1
```

方法语义：

```text
predicted_observation_vwc_fraction
=
storage_mean_mm / root_zone_depth_mm
```

它与 CAP-03 的 H=1 observation operator 对齐：

```text
observation operator predicts root-zone mean VWC
point-to-zone mismatch is represented by observation representativeness variance
no vertical profile inversion is claimed
no 200 mm point forecast is claimed
```

## 15.2 Variance projection

```text
forecast_vwc_variance
=
storage_variance_mm2 / (root_zone_depth_mm ^ 2)
```

Observation variance 复用 CAP-03 对同一 observation 的：

```text
sensor variance
+ representativeness variance
adjusted by quality weight
```

Normalized Forecast Residual：

```text
forecast_residual
=
actual_observation_vwc
-
predicted_forecast_observation_vwc

forecast_error_variance
=
forecast_vwc_variance
+
observation_variance

normalized_forecast_residual
=
forecast_residual / sqrt(forecast_error_variance)
```

若 `forecast_error_variance <= 0`，必须 fail closed。

## 15.3 Projection input/output

最低输入：

```text
Forecast run ref/hash
Forecast point ref/hash
storage_mean_mm
storage_variance_mm2
root-zone geometry/config ref/hash
root_zone_depth_mm
observation operator ID/version
target observation quantity/unit
Runtime Config ref/hash
rounding rule ID/version
```

最低输出：

```text
predicted_observation_vwc_fraction
forecast_vwc_variance
projection_method_id/version
projection_input_hash
projection_trace_hash
limitations
```

## 15.4 Forecast Residual 与 Assimilation Innovation

必须分离：

```text
Forecast Residual
=
actual observation
-
historical Forecast point projected observation

Assimilation Innovation
=
actual observation
-
current tick propagated-prior predicted observation
```

必须满足的共享关系：

```text
Residual.actual_observation_ref
== AssimilationUpdate.selected_observation_ref

Residual.actual_observation
== AssimilationUpdate.actual_observation

Residual.observation operator family
== AssimilationUpdate observation operator family
```

默认不得要求：

```text
Residual.predicted_observation
== AssimilationUpdate.predicted_observation

Residual.forecast_residual
== AssimilationUpdate.innovation

Residual.normalized_forecast_residual
== AssimilationUpdate.normalized_innovation
```

可选非 canonical：

```text
forecast_assimilation_equivalence_evaluation_v1
```

只有证明以下全部相同后才允许输出 `EQUIVALENT`：

```text
same source posterior
same interval forcing
same Dynamics/model/config
same geometry
same observation operator
same numeric precision and rounding
```

该 evaluation 不得改变任何 canonical object。

---

# 16. Outcome Trace Projection

首选路径不新增 canonical Outcome Window。

使用：

```text
action_feedback_cycle_projection_v1
```

它从以下 authority 重建：

```text
twin_decision_record_v1
Approval Assertion Evidence
Approved Plan Snapshot Evidence
dispatch disposition / optional external Dispatch Evidence
twin_action_feedback_v1
receipt-consuming Evidence Window
receipt-consuming State
post-receipt Forecast
later observation
twin_forecast_residual_v1
Assimilation Update
updated State
regenerated Forecast
regenerated Scenario Set
```

必须固定：

```text
dispatch_disposition:
NOT_OBSERVED | NOT_APPLICABLE | EXTERNALLY_RECORDED

causal_attribution_status:
NOT_ESTABLISHED

validation_status:
EVIDENCE_LINKED_NOT_CAUSALLY_VALIDATED

forecast_assimilation_relation:
DISTINCT | EQUIVALENT_WITH_PROOF | NOT_COMPARABLE
```

Projection 不得把：

```text
Approved → Dispatched
Dispatched → Executed
Executed → Validated
Outcome change → causal effect
Forecast Residual → Assimilation Innovation
```

做隐式推断。

---

# 17. 标准 Replay 时间线

## 17.1 Predecessor

S0 预期从 PostgreSQL canonical readback 证明：

```text
CAP-04 final checkpoint sequence:
72

CAP-04 latest logical time:
2026-06-04T01:00:00.000Z

CAP-05 first tick:
2026-06-04T02:00:00.000Z

latest successful Forecast:
non-null

latest Scenario Set:
non-null
```

## 17.2 Decision, approval and dispatch disposition

```text
2026-06-04T01:10:00.000Z

Human Decision:
SELECT_SCENARIO_OPTION
IRRIGATE_NOW_15MM
```

```text
2026-06-04T01:14:00.000Z

Approval Assertion Evidence:
approval_status = APPROVED
GEOX approval authority exercised = false
```

```text
2026-06-04T01:15:00.000Z

Approved Plan Snapshot Evidence:
approval_assertion_ref = exact 01:14 assertion
scenario amount = 15.000000 mm
approved amount = 15.000000 mm
valid_from = 01:30
valid_to = 02:00
```

```text
dispatch_disposition:
NOT_OBSERVED
```

`NOT_OBSERVED` 不阻止外部执行 Evidence 被记录，但禁止推断 GEOX 已 Dispatch。

## 17.3 Execution

```text
2026-06-04T01:30:00.000Z
through
2026-06-04T01:50:00.000Z

actual covered-footprint depth:
13.600000 mm

spatial coverage:
0.910000
```

```text
2026-06-04T01:55:00.000Z

Receipt available_to_runtime_at
```

Dynamics input：

```text
13.600000 × 0.910000
=
12.376000 mm target-scope-equivalent irrigation
```

## 17.4 Receipt-consuming tick

```text
2026-06-04T02:00:00.000Z

evidence cutoff = 02:00
frozen Evidence Window contains Action Feedback
consumes Action Feedback
updates State through normal A1
generates new 72h Forecast
generates new Scenario Set
```

## 17.5 Outcome observation, Forecast Residual and Assimilation

Exact fixture：

```text
observation observed_at:
2026-06-04T03:00:00.000Z

observation available_to_runtime_at:
2026-06-04T03:00:00.000Z

canonical unit:
VWC fraction
```

Forecast Residual source：

```text
02:00 Forecast
horizon 1
target_time = 03:00
project storage mean/variance into root-zone mean VWC H=1 domain
```

Outcome tick：

```text
2026-06-04T03:00:00.000Z

selects 03:00 observation
propagates current-tick prior using actual tick inputs
performs Assimilation
commits updated State
generates Forecast and Scenario
then commits C_FORECAST_RESIDUAL_COMMIT
```

Trace 必须同时保留：

```text
Forecast Residual:
actual observation - historical 02:00 Forecast horizon-1 projection

Assimilation Innovation:
actual observation - 03:00 current-tick propagated-prior prediction
```

它们共享 observation，但默认不要求数值相等。

`02:50 observation` fixture 已撤回。

---

# 18. Runtime Config Chain

标准 bounded closure 计划使用 8 个新 hourly ticks，因此预期建立 8 个 immutable Runtime Config objects。

```text
F1.parent_config_ref/hash
= CAP-04 terminal State 引用的 active Runtime Config ref/hash

F2.parent = F1
...
F8.parent = F7
```

Config purpose：

```text
HUMAN_DECISION_EXECUTION_RECEIPT_FEEDBACK_RUNTIME_V1
```

最低字段：

```text
human_decision_policy_id
selected_option_member_ref_policy_id
decision_cycle_identity_policy_id
decision_second_write_policy_id
feedback_cycle_identity_policy_id
approval_assertion_evidence_policy_id
approved_plan_evidence_policy_id
replay_evidence_ingress_policy_id
external_approval_semantics_policy_id
dispatch_disposition_policy_id
action_feedback_normalization_policy_id
execution_status_mapping_policy_id
validation_status_policy_id
action_feedback_state_input_policy_id
evidence_cutoff_policy_id
late_receipt_policy_id
execution_interval_policy_id
multiple_execution_event_policy_id
spatial_overlap_policy_id
actual_amount_semantics_policy_id
effective_irrigation_policy_id
volume_to_depth_policy_id
action_feedback_adapter_policy_id
forecast_residual_matching_policy_id
forecast_point_member_ref_policy_id
forecast_observation_projection_method_id
forecast_observation_projection_version
forecast_residual_normalization_policy_id
forecast_assimilation_relation_policy_id
outcome_trace_projection_policy_id
causal_attribution_policy_id
```

每个 tick request 必须显式 pin：

```text
runtime_config_ref
runtime_config_hash
```

任何 Config 变化仍不得隐式修改 active model parameters。

---

# 19. Transaction Model

CAP-05 只允许复用：

```text
G_HUMAN_DECISION_LINK_COMMIT
→ twin_decision_record_v1

H_ACTION_FEEDBACK_COMMIT
→ twin_action_feedback_v1

A_STATE_TICK_COMMIT
→ existing State Tick aggregate

B_SCENARIO_COMMIT
→ twin_scenario_set_v1

C_FORECAST_RESIDUAL_COMMIT
→ twin_forecast_residual_v1

D_MODEL_GOVERNANCE_STEP_COMMIT
→ Runtime Config chain
```

不得新增 H1/H2/H3/H4 或第九 transaction family，除非 P-1A 正式修改 DT-02。

---

# 20. Identity and Idempotency

## 20.1 Human Decision

```text
idempotency key
=
human_decision_request_id
```

Semantic identity 至少包括：

```text
decision_cycle_id
scenario_set_ref/hash
selected_option_ref/hash
human identity
decided_at
decision window
rationale
context lineage/revision refs
```

## 20.2 Action Feedback

DT-02 identity：

```text
source executed-Evidence identity
+ normalization version
+ semantic hash
```

最低包含：

```text
receipt_ref/hash
execution_event_id
execution_status
validation_status
actual_amount_mm
coverage
executed_at
source identity
quality
context refs
```

## 20.3 Forecast Residual

```text
forecast point
+ observation
+ matching-rule version
+ projection method/version
+ normalization policy version
```

最低包含：

```text
forecast_run_ref/hash
forecast_point_ref/hash
observation_ref/hash
projection method/version
projection input hash
projection trace hash
predicted value/variance
actual value/variance
forecast residual
normalized forecast residual
matching rule/version
context refs
```

Assimilation Update ref 可以参与 trace，但不得成为 Forecast Residual identity authority。

---

## 20.4 Canonical recovery

所有 canonical uniqueness 和 idempotency 的最终 authority 是：

```text
append-only facts
```

Projection 删除后必须扫描 canonical facts、验证 envelope/hash、重建 projection 并返回 existing object。

---

# 21. Fact and Projection Delta Accounting

v0.2 的：

```text
85 canonical facts
```

已撤回。

在首选 no-amendment profile 下，标准 8-tick 路径的 provisional canonical Twin object delta：

```text
8 Runtime Config facts
1 twin_decision_record_v1
1 twin_action_feedback_v1
1 twin_forecast_residual_v1
64 A1 facts
8 B facts

provisional canonical_twin_object_fact_delta:
83
```

Replay Evidence fact delta 单独统计，至少包括：

```text
1 approval_assertion_evidence_v1
1 approved_irrigation_plan_snapshot_v1
1 irrigation_execution_receipt_evidence_v1
1 post-execution soil_moisture_observation_v1
0 or 1 external_dispatch_evidence_v1
```

正式 Evidence delta 由 S1 fixture materialization 冻结。

Projection / support row delta 单独统计：

```text
approved_plan_binding_projection_v1 rows
action lifecycle projection rows
feedback Evidence index rows
forecast residual index rows
forecast observation projection rows
action_feedback_cycle_projection_v1 rows
lease rows
idempotency rows
```

Operational audit facts 另行统计。

禁止使用单一“83 facts”表达数据库总增量。正式 count 必须在 P-1/P-1A、S1 和 S3 后分别冻结。

---

# 22. Delivery Slice Graph

严格：

```text
merge-before-next
postmerge-Gate-before-next
```

任务图：

```text
P-1
DT-02 Object / Transaction Adjudication
↓
P-1A
DT-02 Architecture Amendment
only when P-1 says REQUIRED
↓
P0
CAP-04 Settlement / CAP-05 Provisional SSOT
↓
S0
Authorization and Predecessor Lock
↓
S1
Controlled Decision / Approval / Receipt / Observation Dataset
↓
S2
Contracts, Scope, Status Mapping, Projection Math and Config Chain
↓
S3
Persistence, Idempotency, Projection and Canonical Recovery
↓
S4
Human Decision through G transaction
↓
S5
Approved Plan Evidence Binding Projection
↓
S6
Action Feedback through H transaction and Dynamics Adapter
↓
S7
Receipt-consuming State Tick and regenerated Forecast/Scenario
↓
S8
Forecast Observation Projection and Residual through C transaction
↓
S9
Restart, Response-loss, Late Receipt and Projection Rebuild
↓
S10
Bounded 8-tick Feedback Chain
↓
S11
Closure and Merged-main Finalization
```

---

# 23. P0 — CAP-04 Settlement / CAP-05 Provisional SSOT

```text
delivery_slice_id:
MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1
```

P0 candidate identity：

```text
baseline_main_commit:
5391a3a8f811fc166fa187d7da70342ee36ab5fa

P-1 exact head:
ca83b67241b4df0082e78d3bfdf45e9338d82ad4

P-1 merge commit:
5391a3a8f811fc166fa187d7da70342ee36ab5fa

P-1 merged-main Gate workflow:
29305092038 SUCCESS

P-1 adjudication result:
REUSE_WITHOUT_AMENDMENT

P0 status:
READY_FOR_MERGE

Runtime source authorized:
false

S0 authorized:
false
```


Preconditions：

```text
P-1 merged-effective

if amendment required:
P-1A merged-effective

CAP-04 package remediation #2422 merged-effective

repository CI stabilization #2428 merged-effective

latest verified main resolved
```

P0 必须以 CAP-04 Closure Record / Main Verification / Finalization Effectiveness 为 authority，完整修正 current Matrix lifecycle fields：

```text
status = COMPLETE
implementation_status = COMPLETE
closure_effective = true
capability_complete = true
active_delivery_slice_id = null
pending_completion_claims = []
current next delivery slice = null
current next delivery authorization = false
current stale effectiveness condition = cleared or replaced by completed authority
current latest effective slice = finalization / closure authority, not historical S5B
current repository baseline = latest verified main at P0 execution
```

P0 必须保留：

```text
historical delivery slice baselines
historical merge commits
historical Gate evidence
historical predecessor refs
historical authorization and closure evidence
```

禁止把所有历史 `baseline_main_commit` 覆盖为最新 main。

并建立 CAP-05 provisional entry：

```text
status = NOT_AUTHORIZED
design_status = P_MINUS_1_MERGED_EFFECTIVE
implementation_status = NOT_AUTHORIZED
runtime_source_authorized = false
active_delivery_slice_id = null
predecessor = MCFT-CAP-04
successor = MCFT-CAP-06
successor_authorized = false
```

P0 不得授权 S1 或 Runtime source；S0 仍是独立 authorization boundary。

---

# 24. S0 — Authorization and Predecessor Lock

S0 candidate identity：

```text
baseline_main_commit:
2d4d00aec8cd1e925687ee67e5de429c324cc1b2

P0 exact head:
75a270fc2fd044fd57858227b7d1d91b1386cf8a

P0 merge commit:
2d4d00aec8cd1e925687ee67e5de429c324cc1b2

P0 merged-main Gate workflow:
29305450785 SUCCESS

S0 status:
READY_FOR_MERGE

authorization effective:
false

runtime source authorized:
false

predecessor checkpoint sequence:
72

predecessor latest logical time:
2026-06-04T01:00:00.000Z

canonical next logical tick:
2026-06-04T02:00:00.000Z

predecessor lock:
docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json

S1 authorized:
false
```


S0 从 PostgreSQL canonical read path 锁定：

```text
active lineage object ref
latest posterior State ref/hash
latest checkpoint ref/hash
latest Forecast result ref/hash
latest successful Forecast ref/hash
latest Scenario Set ref/hash
active Runtime Config ref/hash
checkpoint sequence
latest logical time
next logical tick
```

Expected：

```text
checkpoint sequence = 72
latest logical time = 2026-06-04T01:00:00.000Z
next logical tick = 2026-06-04T02:00:00.000Z
```

只有：

```text
S0 PR merged
+
S0 merged-main Authorization Gate PASS
```

才允许 S1。

---

# 25. S1 — Controlled Replay Dataset

S1 implementation candidate identity：

```text
baseline_main_commit:
55b61b36a7d408ab68c2786499e14bab886d01e2

S0 exact head:
0d86de86c1f887a0d1b1a4a1aeb98afab6ed432f

S0 merge commit:
55b61b36a7d408ab68c2786499e14bab886d01e2

S0 merged-main Authorization Gate workflow:
29306075015 SUCCESS

S1 status:
IMPLEMENTATION_CANDIDATE

S1 materialization workflow:
29306561067

positive Replay Evidence records:
8

negative fixtures:
12

canonical Twin object fact delta:
0

Replay Evidence fact delta:
8

S2 authorized:
false
```


必须交付并通过现有 Replay Evidence ingress 持久化：

```text
controlled Human Decision request
approval_assertion_evidence_v1
approved_irrigation_plan_snapshot_v1
irrigation_execution_receipt_evidence_v1
optional external_dispatch_evidence_v1
post-execution soil observation at exact 03:00
rainfall / ET0 context
source semantic hashes
available_to_runtime_at timestamps
Evidence identity and idempotency keys
```

Plan Snapshot 必须引用 Approval Assertion Evidence。

negative fixtures：

```text
late after logical-time cutoff
late after Evidence Window freeze
cross-hour
multiple event
conflicting duplicate
wrong scope
wrong binding
wrong unit
wrong status
missing approval assertion
plan/assertion mismatch
Evidence identity conflict
```

S1 不创建 Decision、Action Feedback 或 Residual canonical objects。

---

# 26. S2 — Contracts and Projection Math

S2 implementation candidate identity：

```text
baseline_main_commit:
552d19505f0cd93584c899665b7d7b339f67e9fe

S1 exact head:
6e2e3e238c5b7886e4d21d7899406e5642192500

S1 merge commit:
552d19505f0cd93584c899665b7d7b339f67e9fe

S1 merged-main Gate workflow:
29306783482 SUCCESS

S2 status:
IMPLEMENTATION_CANDIDATE

S2 pure validation workflow:
29307407557 SUCCESS

S2 materialization workflow:
29309046407

canonical Twin object fact delta:
0

migration delta:
0

S3 authorized:
false
```


必须冻结：

```text
twin_decision_record_v1 CAP-05 profile
GEOX Scenario option semantic member ref format
Decision second-write conflict policy
decision eligibility evaluation
Approval Assertion Evidence contract
Approved Plan Snapshot Evidence contract
Replay Evidence ingress and idempotency contract
approval semantics
dispatch disposition policy
twin_action_feedback_v1 CAP-05 profile
execution status mapping
validation status policy
actual amount semantics
coverage semantics
complete Action Feedback adapter mapping
twin_forecast_residual_v1 CAP-05 profile
Forecast point semantic member ref format
FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1
Forecast VWC variance formula
normalized Forecast Residual formula
Forecast Residual / Assimilation Innovation separation
optional equivalence evaluation contract
Runtime Config chain
explicit validator dispatch
```

S2 必须包含数值 fixture，证明：

```text
storage mm → VWC fraction
storage variance mm² → VWC variance
observation variance composition
normalized Forecast Residual
coverage weighting exactly once
```

---

# 27. S3 — Persistence and Recovery

S3 implementation candidate identity：

```text
baseline_main_commit:
651878f63a704f78503acb8565087d7f980ada5a

S2 exact head:
ce2ec8b627b628977e7a31e0a1bcb630fffb5dfd

S2 merge commit:
651878f63a704f78503acb8565087d7f980ada5a

S2 merged-main Gate workflow:
29309185464 SUCCESS

active_delivery_slice_id:
MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1

S3 status:
IMPLEMENTATION_CANDIDATE

S3 PostgreSQL acceptance workflow:
29309606079 SUCCESS

migration count:
1

canonical store:
public.facts

S4 authorized:
false
```


预计需要：

```text
exactly one additive CAP-05 migration
```

首选 profile 最低职责：

```text
Decision idempotency and projections
Action Feedback idempotency and Evidence index
Residual idempotency and matching trace projection
approved Plan binding projection
action feedback cycle projection
canonical facts-based rebuild
```

---

# 28. S4–S10 Implementation Slices

## S4 — Human Decision

S4 implementation candidate identity：

```text
baseline_main_commit:
7e2de9c00a4ecc305c27b6572a63914f38157dbd

S3 exact head:
e63018ee0fef1e8862d73260489c858eccfebf07

S3 merge commit:
7e2de9c00a4ecc305c27b6572a63914f38157dbd

S3 merged-main Gate workflow:
29310035502 SUCCESS

active_delivery_slice_id:
MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1

S4 status:
IMPLEMENTATION_CANDIDATE

S4 PostgreSQL acceptance workflow:
29310564723 SUCCESS

canonical Decision fact delta:
1

downstream inferred fact delta:
0

migration delta:
0

S5 authorized:
false
```


证明 Scenario readback、selected option semantic member ref/hash、human identity、G transaction、Decision second-write conflict、idempotency，以及 no Recommendation/Approval/Plan/Task inference。

## S5 — Approval Assertion and Approved Plan Evidence Binding

S5 implementation candidate identity：

```text
baseline_main_commit:
7f2f2bec144cee4d90608c3a25c3dc7cac9f9189

S4 exact head:
e9f3b81e2aa8b68498263049086d79184ead6108

S4 merge commit:
7f2f2bec144cee4d90608c3a25c3dc7cac9f9189

S4 merged-main Gate workflow:
29311761419 SUCCESS

active_delivery_slice_id:
MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1

S5 status:
IMPLEMENTATION_CANDIDATE

S5 PostgreSQL acceptance workflow:
29312412661 SUCCESS

approval_assertion_evidence fact delta:
1

approved_plan_evidence fact delta after supersession:
2

canonical Twin object delta:
0

transaction family delta:
0

migration delta:
0

S6 authorized:
false
```


证明 Approval Assertion 与 Plan Snapshot 分离、Evidence ingress/idempotency、amount separation、validity、supersession、explicit dispatch disposition 和 rebuildable projection。

## S6 — Action Feedback and Adapter

证明 H transaction、status mapping、validation orthogonality、covered-footprint amount、coverage、adapter field mapping、same-hour、single-event、late no-shift 和 no volume conversion。

## S7 — Receipt-consuming State Tick

标准数据：

```text
actual_amount_mm = 13.600000
spatial_coverage_fraction = 0.910000
target_scope_equivalent_irrigation_mm = 12.376000
```

证明 A1 State、new Forecast、new Scenario 和 complete Evidence trace。

## S8 — Forecast Projection and Residual

证明 exact 03:00 target、02:00 Forecast horizon 1、root-zone mean VWC H=1 projection、variance projection、projection trace、Forecast Residual、C transaction 和 trace projection。

必须证明：

```text
Forecast Residual uses historical Forecast point
Assimilation Innovation uses current tick propagated prior
shared observation refs/values are equal
predicted values are not assumed equal
numeric equality requires explicit equivalence evaluation proof
```

## S9 — Restart and Failure Recovery

证明 G/H/C response-loss retry、projection rebuild、late no-shift、cross-hour rejection、multi-event rejection、stale fencing、CAS conflict 和 canonical divergence fail closed。

## S10 — Bounded 8-Tick Chain

```text
Tick 1:
02:00 receipt-consuming tick

Tick 2:
03:00 observation / Assimilation / Residual

Ticks 3–8:
04:00 through 09:00 contiguous continuation
```

Expected：

```text
8 posterior States
8 successful Forecast Runs
8 Scenario Sets
576 Forecast points
1728 Scenario points
checkpoint 73..80
global State count 81
next logical tick 2026-06-04T10:00:00.000Z
```

Fact delta accounting：

```text
canonical_twin_object_fact_delta:
TO_BE_FROZEN_AFTER_P-1

provisional no-amendment canonical delta:
83

Replay Evidence fact delta:
TO_BE_FROZEN_AFTER_S1

projection row delta:
TO_BE_FROZEN_AFTER_S3
```

---

# 29. S11 — Closure and Finalization

Lifecycle：

```text
S11A
Closure candidate
claims pending

S11B
exact-head CI
merge
head-to-merge tree equivalence
merged-main Finalization Gate

S11C
only when repository must materialize
merge commit / postmerge effectiveness evidence
```

只有最终 effectiveness 成立后：

```text
status = COMPLETE
implementation_status = COMPLETE
active_delivery_slice_id = null
pending_completion_claims = []
effective_completion_claims = frozen set
successor_authorized = false
```

---

# 30. Required Deliverables

```text
docs/digital_twin/mcft/cap_05/
  GEOX-MCFT-CAP-05-TASK.md
  GEOX-MCFT-CAP-05-P-1-ADJUDICATION.md
  GEOX-MCFT-CAP-05-P-1-STATUS.json
  GEOX-MCFT-CAP-05-P0-STATUS.json
  GEOX-MCFT-CAP-05-AUTHORIZATION.md
  GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json
  GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json
  GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json
  GEOX-MCFT-CAP-05-DECISION-PROFILE.json
  GEOX-MCFT-CAP-05-APPROVAL-ASSERTION-EVIDENCE-CONTRACT.json
  GEOX-MCFT-CAP-05-APPROVED-PLAN-EVIDENCE-CONTRACT.json
  GEOX-MCFT-CAP-05-REPLAY-EVIDENCE-INGRESS-CONTRACT.json
  GEOX-MCFT-CAP-05-ACTION-FEEDBACK-PROFILE.json
  GEOX-MCFT-CAP-05-RESIDUAL-PROFILE.json
  GEOX-MCFT-CAP-05-FORECAST-OBSERVATION-PROJECTION-CONTRACT.json
  GEOX-MCFT-CAP-05-FORECAST-ASSIMILATION-RELATION-CONTRACT.json
  GEOX-MCFT-CAP-05-TRACE-PROJECTION-CONTRACT.json
  GEOX-MCFT-CAP-05-RUNTIME-CONFIG-CONTRACT.json
  GEOX-MCFT-CAP-05-RUNTIME-CONFIG-CHAIN.json
  GEOX-MCFT-CAP-05-PERSISTENCE-MATRIX.json
  GEOX-MCFT-CAP-05-FAILURE-RECOVERY-CONTRACT.md
  GEOX-MCFT-CAP-05-CLOSURE-RECORD.json
  GEOX-MCFT-CAP-05-MAIN-VERIFICATION.json

fixtures/mcft/water_state/feedback_v1/**
fixtures/mcft/water_state/expected/MCFT_CAP_05_*
fixtures/mcft/water_state/negative/MCFT_CAP_05_NEGATIVE_FIXTURES.json

apps/server/scripts/mcft/
  MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts

scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_*
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_*
```

---

# 31. Capability-wide Changed-File Boundary

允许路径：

```text
docs/digital_twin/mcft/cap_05/**
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md

conditional P-1A only:
docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json
docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-03.md

apps/server/src/domain/twin_runtime/**
apps/server/src/domain/soil_water/**
apps/server/src/runtime/twin_runtime/**
apps/server/src/persistence/twin_runtime/**
apps/server/src/projections/twin_runtime/**
apps/server/src/adapters/twin_runtime/**
apps/server/src/evidence/twin_runtime/**

apps/server/db/migrations/<one exact CAP-05 additive migration>

apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts

fixtures/mcft/water_state/feedback_v1/**
fixtures/mcft/water_state/expected/MCFT_CAP_05_*
fixtures/mcft/water_state/negative/MCFT_CAP_05_*

scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_*
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_*

apps/server/package.json
only for exact runner command
```

禁止：

```text
apps/web/**
public generated-object write routes
/api/v1/actions/* changes
AO-ACT source changes
operation plan source changes
approval workflow source changes
device runtime source changes
CAP-04 historical fact rewrites
CAP-04 contract rewrites
Forecast math rewrites
Scenario math rewrites
automatic scheduler
late-evidence revision Runtime
calibration
model activation
ROI
Field Memory
```


---

# 32. Hard Acceptance

## A. P-1 architecture conformance

1. P-1 is the first permitted repository action.
2. P-1 changes no Runtime source.
3. P-1 changes no migration.
4. P-1 changes no canonical facts.
5. P-1 adjudicates Decision object reuse.
6. P-1 adjudicates Action Feedback object reuse.
7. P-1 adjudicates Forecast Residual object reuse.
8. P-1 adjudicates Approval Assertion and Approved Plan Evidence status.
9. P-1 adjudicates Outcome Trace status.
10. P-1 adjudicates DEFER.
11. P-1 adjudicates GEOX semantic member refs.
12. P-1 adjudicates Decision second-write policy.
13. P-1 adjudicates Forecast observation projection.
14. P-1 adjudicates Forecast Residual / Assimilation Innovation separation.
15. P-1 adjudicates complete Action Feedback adapter mapping.
16. P-1 adjudicates amount / coverage / cutoff semantics.
17. P-1 output is REUSE_WITHOUT_AMENDMENT or AMENDMENT_REQUIRED.
18. P0 cannot start while P-1 is unresolved.
19. P-1A is mandatory when amendment is required.
20. P-1 merged-main Gate is required before P0.

## B. Predecessor settlement

21. CAP-04 status is COMPLETE.
22. CAP-04 implementation status is COMPLETE.
23. CAP-04 closure effective is true.
24. CAP-04 capability complete is true.
25. CAP-04 active delivery slice is null.
26. CAP-04 pending claims are empty.
27. CAP-04 remediation #2422 is merged-effective.
28. Repository CI stabilization #2428 is merged-effective.
29. P0 baseline is latest verified main at P0 execution.
30. Matrix CAP-04 implementation status is reconciled to COMPLETE.
31. Matrix stale next-delivery fields are cleared.
32. Matrix stale current effectiveness condition is reconciled.
33. Historical delivery slice baselines remain unchanged.
34. Historical merge and Gate evidence remains unchanged.
35. CAP-05 remains unauthorized before S0.
36. CAP-05 provisional entry exists.

## C. Predecessor PostgreSQL lock

37. Predecessor lock comes from PostgreSQL canonical readback.
38. No object ID is guessed from fixture.
39. Checkpoint sequence equals 72.
40. Latest logical time equals `2026-06-04T01:00:00.000Z`.
41. Next logical tick equals `2026-06-04T02:00:00.000Z`.
42. Latest successful Forecast exists.
43. Latest Scenario Set exists.
44. Scenario source Forecast equals latest successful Forecast.
45. Checkpoint State ref equals latest State.
46. Active Runtime Config equals latest State config.

## D. Decision

47. Decision uses `twin_decision_record_v1`.
48. Decision commits through G transaction.
49. Decision is NON_LINEAGE_CONTEXT.
50. Decision has context lineage ref.
51. Decision has context revision ref.
52. Decision logical_time equals source Scenario logical_time.
53. Decision as_of equals decided_at.
54. Decision requires scenario_set_ref.
55. Decision requires selected_option_ref.
56. selected_option_ref follows GEOX semantic member ref policy.
57. selected_option_ref is not treated as RFC 6901 JSON Pointer.
58. selected option resolves by exact option_id lookup.
59. selected option hash is recomputed from canonical Scenario.
60. Forged option hash fails closed.
61. CAP-05 v1 creates no DEFER Decision record.
62. NO_ACTION is represented by selected NO_ACTION option.
63. Scenario from BLOCKED Forecast is rejected.
64. Wrong-scope Scenario is rejected.
65. Wrong-context Scenario is rejected.
66. Non-current Scenario for the same source Forecast is rejected.
67. Decision actor is human.
68. Decision source class is CONTROLLED_REPLAY.
69. Same decision key/hash returns existing success.
70. Same decision cycle with different semantics conflicts.
71. Decision supersession is not supported in CAP-05 v1.
72. G commit infers no Approval, Plan or Task.
73. G commit modifies no State or checkpoint.

## E. Approval and Plan Evidence

74. Approval Assertion is Replay Evidence.
75. Approved Plan Snapshot is Replay Evidence.
76. Neither is a canonical Twin object under no-amendment profile.
77. Approval Assertion references Decision ref/hash.
78. Approval Assertion references selected option ref/hash.
79. Approval semantics are EXTERNAL_OR_HUMAN_EVIDENCE_ASSERTION.
80. GEOX approval request created is false.
81. GEOX approval authority exercised is false.
82. Approval status is APPROVED.
83. Plan Snapshot references Approval Assertion ref/hash.
84. Plan Snapshot references Decision ref/hash.
85. Plan Snapshot references selected option ref/hash.
86. Approved amount may differ from Scenario amount.
87. Nonzero difference requires reason codes.
88. Approved amount never enters Dynamics.
89. One active Plan Evidence exists per Decision.
90. Superseding Plan Evidence references prior Evidence ref/hash.
91. Plan binding projection rebuilds from canonical Decision and Evidence.
92. Evidence ingress preserves source identity and source semantic hash.
93. Same Evidence identity/hash is idempotent.
94. Same Evidence identity with different hash conflicts.
95. Dispatch disposition is explicit.
96. External Dispatch Evidence remains Context only.

## F. Action Feedback

97. Execution normalization uses `twin_action_feedback_v1`.
98. Action Feedback commits through H transaction.
99. Action Feedback is NON_LINEAGE_CONTEXT.
100. Action Feedback has context lineage ref.
101. Action Feedback has context revision ref.
102. Action Feedback logical_time equals execution_end.
103. Action Feedback as_of equals available_to_runtime_at.
104. FULL maps to EXECUTED.
105. PARTIAL maps to PARTIALLY_EXECUTED.
106. UNKNOWN maps to EXECUTION_UNCERTAIN.
107. NONE maps to NOT_EXECUTED.
108. Standard validation status is NOT_YET_VALIDATED.
109. Source quality is not validation status.
110. NOT_YET_VALIDATED may be State-input eligible.
111. EXECUTION_UNCERTAIN is not State-input eligible.
112. NOT_EXECUTED is not State-input eligible.
113. FAIL source quality is not State-input eligible.
114. task_ref is null for CONTROLLED_REPLAY_EXTERNAL.
115. receipt_ref or as_executed_ref exists.
116. acceptance_ref is null.
117. H commit modifies no past State.
118. H commit modifies no checkpoint.

## G. Quantity semantics and adapter

119. actual_amount_mm means covered-footprint average depth.
120. coverage means covered area divided by total target area.
121. target-scope-equivalent irrigation is amount times coverage.
122. Standard amount is `13.600000`.
123. Standard coverage is `0.910000`.
124. Standard target-scope-equivalent irrigation is `12.376000`.
125. Adapter binding_id equals current Reality Binding.
126. Adapter scope equals exact Action Feedback scope.
127. event_id equals execution_event_id.
128. source_record_id equals source Receipt Evidence ID.
129. executed_at equals execution_end.
130. ingested_at equals available_to_runtime_at.
131. origin_source_id is derived from trusted source namespace and executor.
132. executed amount maps from actual_amount_mm.
133. coverage maps from spatial_coverage_fraction.
134. candidate eligibility maps from canonical eligibility.
135. PASS maps to USABLE.
136. LIMITED maps to USABLE.
137. FAIL maps to UNUSABLE and is not selected.
138. PARTIALLY_EXECUTED retains source status trace.
139. Existing candidate execution_status is EXECUTED for consumable actual events.
140. Approved amount is not adapter input.
141. Planned amount is not adapter input.
142. Dispatched amount is not adapter input.
143. Scenario amount is not adapter execution authority.
144. Effective amount is not Receipt authority.
145. Adapter does not apply coverage weighting.
146. Existing aggregator applies coverage exactly once.
147. Adapter emits existing candidate shape.
148. Adapter modifies no State.

## H. Time, late and multi-event safety

149. Execution start follows approval.
150. Execution end follows execution start.
151. Execution lies inside Plan validity window.
152. Execution start and end are in one hourly interval.
153. Cross-hour execution is rejected.
154. Evidence cutoff equals target logical time.
155. Action Feedback available after logical time is not consumed.
156. Feedback absent from frozen Evidence Window is not consumed.
157. Future Action Feedback is not consumed.
158. Late-after-cutoff Action Feedback is ineligible.
159. Late-after-commit Action Feedback is ineligible.
160. Late Action Feedback is not shifted to a later tick.
161. Late Action Feedback does not rewrite State.
162. Late Action Feedback remains canonical and traceable.
163. Identical duplicate event collapses deterministically.
164. Conflicting duplicate fails closed.
165. Multiple distinct events in same scope/hour fail closed.
166. Spatial overlap deduplication is not claimed.
167. Volume-to-depth conversion is not claimed.

## I. Receipt-consuming State Tick

168. Decision commit does not modify State.
169. Approval Evidence does not modify State.
170. Plan Evidence does not modify State.
171. H commit does not modify State.
172. Only a normal State Tick consumes Action Feedback.
173. Evidence Window records evidence_cutoff_time.
174. Evidence Window references Action Feedback.
175. Evidence Window records selected and excluded feedback trace.
176. Existing Dynamics aggregator is reused.
177. Existing observation selection is reused.
178. Existing Assimilation is reused.
179. Posterior State is produced normally.
180. A1/A2 member count is unchanged.
181. Active model is unchanged.
182. Active parameters are unchanged.
183. Receipt-consuming A1 generates 72 Forecast points.
184. Receipt-consuming A1 generates one Scenario Set.
185. Forecast source posterior is the receipt-updated State.
186. Scenario source Forecast is the receipt-updated Forecast.

## J. Forecast observation projection and Residual

187. Outcome observation occurs exactly at `03:00:00Z`.
188. Observation is available at `03:00:00Z`.
189. Source Forecast is issued at `02:00:00Z`.
190. Source Forecast horizon 1 targets `03:00:00Z`.
191. Source Forecast already includes Action Feedback.
192. Forecast point ref follows GEOX semantic member ref policy.
193. Forecast point ref resolves deterministically.
194. Forecast storage is not compared directly to VWC.
195. Projection method is `FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1`.
196. Projection does not claim a 200 mm point forecast.
197. Projection geometry/config refs are hash-pinned.
198. Projection output is VWC fraction.
199. Forecast VWC variance equals storage variance divided by root depth squared.
200. Observation variance uses CAP-03 operator semantics.
201. Normalized Forecast Residual uses Forecast plus observation variance.
202. Projection trace hash is deterministic.
203. Residual uses `twin_forecast_residual_v1`.
204. Residual commits through C transaction.
205. Residual is NON_LINEAGE_CONTEXT.
206. Residual logical_time equals target_time.
207. Residual as_of equals observation availability time.
208. Residual references exact Forecast run.
209. Residual references exact Forecast point.
210. Residual references exact observation.
211. Residual predicted value equals Forecast projection output.
212. Residual actual observation equals selected observation value.
213. Forecast Residual equals actual minus projected Forecast value.
214. Forecast Residual does not own Assimilation gain.
215. Forecast Residual does not own posterior estimate authority.
216. Assimilation actual observation equals the same selected observation.
217. Assimilation predicted observation may differ from Forecast projection.
218. Assimilation innovation may differ from Forecast Residual.
219. Equality requires explicit equivalence evaluation proof.
220. Prediction mismatch to its own projection fails closed.
221. C failure does not rollback A1/B.

## K. Projection and recovery

222. Approved Plan binding is rebuildable.
223. Forecast observation projection is reproducible.
224. Forecast/Assimilation relation evaluation is reproducible.
225. Feedback cycle trace is rebuildable.
226. Projection deletion does not create new canonical facts.
227. G retry with same key/hash returns existing success.
228. H retry with same key/hash returns existing success.
229. C retry with same key/hash returns existing success.
230. Same key with different hash conflicts.
231. Response loss does not duplicate Decision.
232. Response loss does not duplicate Action Feedback.
233. Response loss does not duplicate Residual.
234. Canonical facts are canonical recovery authority.
235. Replay Evidence facts are Evidence recovery authority.
236. Stale fencing fails closed.
237. CAS conflict fails closed.

## L. Bounded chain

238. Exactly 8 new State ticks are committed.
239. Closure ticks are A1 unless the task is amended.
240. Exactly 8 posterior States are created.
241. Exactly 8 successful Forecast Runs are created.
242. Exactly 8 Scenario Sets are created.
243. Exactly 576 Forecast points are created.
244. Exactly 1728 Scenario points are created.
245. Checkpoint sequence is 73 through 80.
246. Global State count is 81.
247. Next logical tick is `2026-06-04T10:00:00.000Z`.
248. Exactly 8 Runtime Config facts are created.
249. Canonical Twin object fact delta is frozen only after P-1.
250. Under no-amendment profile provisional canonical delta is 83.
251. Replay Evidence fact delta is reported separately.
252. Projection row delta is reported separately.
253. Completed-chain rerun adds zero canonical Twin object facts.
254. Completed-chain rerun adds zero duplicate Evidence facts.

## M. Boundaries and closure

255. No automatic Recommendation is created.
256. No Policy Evaluation is created.
257. No GEOX Approval Request is created.
258. GEOX does not exercise approval authority.
259. No operation_plan_v1 is created.
260. No AO-ACT task is created.
261. No automatic Dispatch is created.
262. No device command is created.
263. No Execution Acceptance is created.
264. No causal effect is claimed.
265. Forecast Residual is not claimed identical to Assimilation Innovation.
266. No 200 mm point forecast profile is claimed.
267. No ROI is created.
268. No Field Memory is created.
269. No Calibration Candidate is created.
270. No Model Activation is created.
271. No late-Evidence revision is executed.
272. No public write route is added.
273. No web path is modified.
274. No scheduler is created.
275. No live-field claim is made.
276. No Controlled Field Twin completion is claimed.
277. No Minimum Complete Field Twin completion is claimed.
278. Completion claims remain pending before merged-main effectiveness.
279. Final active delivery slice is null.
280. CAP-06 remains unauthorized.
281. Exact-head CI passes.
282. Head-to-merge tree equivalence passes.
283. Merged-main Finalization Gate passes.

---

# 33. Required Negative Tests

```text
P-1 missing
P-1 unresolved
amendment required but P-1A absent
P0 started before architecture adjudication

CAP-04 not COMPLETE
CAP-04 Matrix implementation_status stale
CAP-04 Matrix stale next-delivery pointer retained
historical CAP-04 baseline rewritten
CAP-04 remediation not effective
latest verified main not locked
CAP-05 unauthorized Runtime write

wrong predecessor checkpoint
wrong predecessor State
wrong predecessor Forecast
missing predecessor Scenario Set
wrong active lineage ref
wrong context revision ref
wrong Runtime Config parent

Decision uses non-DT02 object type
Decision uses non-G transaction
Decision without selected_option_ref
DEFER Decision attempted
selected_option_ref treated as JSON array pointer
selected_option_ref malformed
selected option missing
multiple selected option matches
selected option hash mismatch
Scenario from BLOCKED Forecast
Scenario from wrong scope
Scenario from wrong context
non-current Scenario selected
Decision actor not human
second distinct Decision in same cycle
Decision supersession attempted

Approval Assertion claims GEOX approval authority
approval status not APPROVED
Approval Assertion Decision mismatch
Approval Assertion option mismatch
Plan missing Approval Assertion ref
Plan/assertion hash mismatch
Plan validity inversion
nonzero amount difference without reason
second active Plan Evidence without supersession
Evidence identity same but semantic hash differs
projection used as Evidence authority

Action Feedback uses non-DT02 object type
Action Feedback uses non-H transaction
missing validation_status
source quality used as validation_status
FULL mapped to PARTIALLY_EXECUTED
PARTIAL mapped to EXECUTED
NOT_EXECUTED marked eligible
EXECUTION_UNCERTAIN marked eligible
task_ref present for CONTROLLED_REPLAY_EXTERNAL
missing receipt_ref and as_executed_ref
wrong logical_time or as_of mapping

actual amount interpreted as full-scope equivalent
coverage applied twice
approved amount emitted to adapter
planned amount emitted to adapter
dispatched amount emitted to adapter
scenario amount emitted as execution authority
effective amount accepted as Receipt authority
missing adapter binding_id
wrong adapter binding_id
adapter scope mismatch
PASS mapped to UNUSABLE
LIMITED mapped to UNUSABLE
FAIL mapped to USABLE
canonical eligibility differs from candidate eligibility

negative actual amount
coverage below zero
coverage above one
execution before approval
execution outside Plan window
cross-hour execution
unsupported volume unit
future Action Feedback
available after logical-time cutoff
feedback absent from frozen Evidence Window
late Action Feedback shifted to later tick
quality FAIL Action Feedback consumed
scope mismatch Action Feedback consumed
multiple distinct events in same scope/hour
conflicting duplicate Action Feedback

Decision commit modifies State
H commit modifies State
H commit advances checkpoint
Decision creates Recommendation
Plan Evidence creates AO-ACT
external dispatch Evidence treated as execution
Action Feedback creates acceptance

outcome observation at 02:50
Forecast point target-time mismatch
Forecast issued after observation
Forecast generated before Action Feedback consumption
Forecast point hash mismatch
Forecast storage compared directly to VWC
projection claims 200 mm point forecast
projection geometry missing
root-zone depth zero
projection method unpinned
projection trace hash mismatch
Forecast variance projection mismatch
Forecast error variance nonpositive
Residual uses non-DT02 object type
Residual uses non-C transaction
Residual forecast value mismatch
Residual actual observation mismatch
Residual copies Assimilation gain
Residual owns posterior authority
Forecast Residual forced equal to Assimilation innovation without proof
equivalence proof with different forcing
equivalence proof with different source posterior
causal attribution marked ESTABLISHED

G response-loss duplicate
H response-loss duplicate
C response-loss duplicate
projection deleted then duplicate accepted
Evidence projection deleted then Evidence duplicated
stale fencing accepted
CAS conflict accepted
late receipt history rewrite
public write route introduced
scheduler introduced
web modified
CAP-06 auto-authorized
```

每个 negative fixture 必须包含：

```yaml
fixture_id: ...
expected_reason_code: ...
expected_failure_stage: ...

expected_no_current_operation_partial_canonical_write: true
expected_no_current_operation_partial_projection_write: true
expected_no_duplicate_evidence_write: true

expected_state_latest_behavior: ...
expected_checkpoint_behavior: ...
expected_forecast_latest_behavior: ...
expected_scenario_latest_behavior: ...

expected_decision_projection_behavior: ...
expected_plan_binding_projection_behavior: ...
expected_action_feedback_projection_behavior: ...
expected_residual_projection_behavior: ...
expected_trace_projection_behavior: ...

optional_operational_audit_allowed: true | false
```

---

# 34. Completion Claims Candidate

只有最终 merged-main effectiveness 成立后才允许激活：

```text
MCFT_CAP_05_COMPLETE

DT02_DECISION_OBJECT_REUSE_ESTABLISHED
DT02_ACTION_FEEDBACK_OBJECT_REUSE_ESTABLISHED
DT02_FORECAST_RESIDUAL_OBJECT_REUSE_ESTABLISHED

HUMAN_SCENARIO_DECISION_LINK_ESTABLISHED
SELECTED_SCENARIO_OPTION_SEMANTIC_MEMBER_REF_ESTABLISHED
SCENARIO_RECOMMENDATION_BOUNDARY_ESTABLISHED

EXTERNAL_APPROVAL_EVIDENCE_ASSERTION_ESTABLISHED
APPROVAL_ASSERTION_PLAN_SNAPSHOT_SEPARATION_ESTABLISHED
REPLAY_EVIDENCE_INGRESS_IDEMPOTENCY_ESTABLISHED
GEOX_APPROVAL_AUTHORITY_NONEXERCISE_ESTABLISHED
APPROVED_EXECUTED_AMOUNT_SEPARATION_ESTABLISHED
EXPLICIT_DISPATCH_DISPOSITION_ESTABLISHED

ACTION_FEEDBACK_STATUS_MAPPING_ESTABLISHED
ACTION_FEEDBACK_COMPLETE_ADAPTER_MAPPING_ESTABLISHED
LOGICAL_TIME_EVIDENCE_CUTOFF_ESTABLISHED
ACTION_FEEDBACK_VALIDATION_ORTHOGONALITY_ESTABLISHED
NOT_EXECUTED_FEEDBACK_NONCONSUMPTION_ESTABLISHED

LATE_FEEDBACK_NO_SHIFT_POLICY_ESTABLISHED
SINGLE_INTERVAL_EXECUTION_POLICY_ESTABLISHED
MULTIPLE_EXECUTION_EVENT_FAIL_CLOSED_ESTABLISHED

COVERED_FOOTPRINT_AMOUNT_SEMANTICS_ESTABLISHED
COVERAGE_WEIGHTED_STATE_INPUT_ESTABLISHED
ACTION_FEEDBACK_NEXT_TICK_CONSUMPTION_ESTABLISHED

POST_EXECUTION_STATE_UPDATE_ESTABLISHED
POST_EXECUTION_FORECAST_REGENERATION_ESTABLISHED
POST_EXECUTION_SCENARIO_REGENERATION_ESTABLISHED

FORECAST_OBSERVATION_UNIT_PROJECTION_ESTABLISHED
FORECAST_OBSERVATION_VARIANCE_PROJECTION_ESTABLISHED
FORECAST_POINT_RESIDUAL_ESTABLISHED
FORECAST_RESIDUAL_ASSIMILATION_INNOVATION_SEPARATION_ESTABLISHED
RESIDUAL_ASSIMILATION_TRACE_ESTABLISHED

POST_EXECUTION_FEEDBACK_TRACE_PROJECTION_ESTABLISHED
NO_CAUSAL_ATTRIBUTION_BOUNDARY_ESTABLISHED

ACTION_FEEDBACK_IDEMPOTENCY_ESTABLISHED
ACTION_FEEDBACK_CANONICAL_RECOVERY_ESTABLISHED
ACTION_FEEDBACK_RESTART_RECOVERY_ESTABLISHED

BOUNDED_FEEDBACK_CHAIN_PERSISTED
NO_DIRECT_AO_ACT_OR_AUTOMATIC_DISPATCH_BOUNDARY_ESTABLISHED
ACTION_FEEDBACK_END_TO_END_TRACEABILITY_ESTABLISHED
```

---

# 35. Preserved Nonclaims

```text
NO_DEFER_DECISION_OBJECT_IN_CAP_05_V1
NO_NEW_CANONICAL_APPROVAL_ASSERTION_OBJECT_UNLESS_DT02_AMENDED
NO_NEW_CANONICAL_PLAN_OBJECT_UNLESS_DT02_AMENDED
NO_NEW_CANONICAL_OUTCOME_WINDOW_UNLESS_DT02_AMENDED
NO_NINTH_TRANSACTION_FAMILY_UNLESS_DT02_AMENDED

NO_AUTOMATIC_RECOMMENDATION
NO_POLICY_EVALUATION
NO_GEOX_APPROVAL_REQUEST_WORKFLOW
NO_GEOX_APPROVAL_AUTHORITY_EXERCISE
NO_FORMAL_OPERATION_PLAN_V1
NO_AO_ACT_TASK_CREATION
NO_AUTOMATIC_TASK_PROJECTION
NO_AUTOMATIC_DISPATCH
NO_GEOX_DEVICE_COMMAND
NO_DEVICE_CONTROL
NO_EXECUTION_ACCEPTANCE
NO_EXECUTION_VALIDATION_SCORE
NO_CAUSAL_EFFECT_ATTRIBUTION
NO_ACTION_EFFECTIVENESS_CLAIM
NO_FORECAST_RESIDUAL_ASSIMILATION_INNOVATION_IDENTITY_CLAIM
NO_POINT_200MM_FORECAST_PROFILE_CLAIM
NO_ROI
NO_FIELD_MEMORY
NO_VOLUME_TO_DEPTH_CONVERSION_CLAIM
NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION
NO_MULTI_EVENT_EXECUTION_AGGREGATION
NO_LATE_EXECUTION_EVIDENCE_REVISION_RUNTIME
NO_AUTOMATIC_HISTORY_REWRITE
NO_CALIBRATION_CANDIDATE
NO_SHADOW_EVALUATION
NO_MODEL_ACTIVATION
NO_ACTIVE_MODEL_PARAMETER_CHANGE
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_SHADOW_ONLINE_CLAIM
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_CONTROLLED_FIELD_TWIN_COMPLETE_CLAIM
NO_MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE_CLAIM
```

---

# 36. Existing Repository Component Reuse

```text
DT-02 twin_decision_record_v1:
REUSE_PENDING_P_MINUS_1_CONFIRMATION

DT-02 G_HUMAN_DECISION_LINK_COMMIT:
REUSE_PENDING_P_MINUS_1_CONFIRMATION

DT-02 twin_action_feedback_v1:
REUSE_PENDING_P_MINUS_1_CONFIRMATION

DT-02 H_ACTION_FEEDBACK_COMMIT:
REUSE_PENDING_P_MINUS_1_CONFIRMATION

DT-02 twin_forecast_residual_v1:
REUSE_PENDING_P_MINUS_1_CONFIRMATION

DT-02 C_FORECAST_RESIDUAL_COMMIT:
REUSE_PENDING_P_MINUS_1_CONFIRMATION

CAP-04 State Tick A1/A2:
REUSE_AS_IS

CAP-04 Scenario B:
REUSE_AS_IS

CAP-04 Runtime Config parent-chain pattern:
REUSE_AS_PATTERN

CAP-03 Observation Selection:
REUSE_AS_IS

CAP-03 Assimilation Update:
REUSE_AS_IS
AS DISTINCT AUTHORITY FROM FORECAST RESIDUAL

CAP-02 executed irrigation aggregation:
REUSE_AS_IS
WITH CAP-05 SINGLE-EVENT SAFETY GUARD
AND COVERAGE APPLIED EXACTLY ONCE

CAP-02 physical water Dynamics:
REUSE_AS_IS

/api/v1/actions/*:
REFERENCE_ONLY
DO_NOT_CALL

actionReceiptRequestSchemaV1:
REFERENCE_ONLY
DO_NOT_USE_AS CAP-05 INGRESS

operation-plan-to-AO-ACT builder:
REFERENCE_ONLY
DO_NOT_CALL

Operator UI:
DEFER_TO MCFT-18
```

---

# 37. 最终任务线判断

MCFT-CAP-05 的核心不是：

```text
增加一套新的 Decision / Receipt / Residual 对象
```

也不是：

```text
把 Scenario 自动转换成执行任务
```

它要建立的是：

```text
canonical twin_scenario_set_v1
↓
controlled human selection
↓
twin_decision_record_v1
↓
external/human Approval Assertion Evidence
↓
Approved Plan Snapshot Evidence
↓
explicit Dispatch disposition
↓
Execution Receipt Evidence
↓
twin_action_feedback_v1
↓
next normal A1 State Tick
↓
actual covered-footprint amount × coverage exactly once
↓
updated posterior State
↓
new Forecast and Scenario
↓
later exact-time observation
↓
historical Forecast point projected into root-zone mean VWC H=1 domain
↓
twin_forecast_residual_v1
↓
separate current-tick Assimilation innovation
↓
updated State / Forecast / Scenario
↓
rebuildable feedback-cycle projection
```

始终保持：

```text
Scenario ≠ Recommendation
Decision ≠ Approval
External approval assertion ≠ GEOX approval authority
Approval ≠ Dispatch
Dispatch ≠ Execution
Execution ≠ Acceptance
Forecast storage ≠ observed VWC
Root-zone mean forecast ≠ 200 mm point forecast profile
Forecast Residual ≠ Assimilation Innovation by default
Outcome observation ≠ causal effect
```

完成后只允许声明：

```text
GEOX 在 Level A Replay 下，
能够复用 DT-02 冻结的 Decision、Action Feedback
和 Forecast Residual 对象及事务，
把受控的人类 Scenario 选择、外部批准证据
和实际执行回执安全地反馈到下一 State Tick，
并把后续实际观测通过明确的 H=1 单位与方差投影
连接到历史 Forecast point 和 Forecast Residual，
同时保持当前 Tick Assimilation innovation 的独立 authority，
最终形成 updated State、regenerated Forecast、Scenario
和可重建 feedback-cycle trace。
```

仍不可声明：

```text
GEOX 会自动推荐行动
GEOX 完成了审批
GEOX 自动下发任务
GEOX 控制真实设备
GEOX 验证了行动效果
GEOX 建立了 200 mm 点位 Forecast profile
Forecast Residual 与 Assimilation Innovation 必然相同
GEOX 已完成正式闭环控制
GEOX 已成为 Controlled Field Twin
GEOX 已成为 Minimum Complete Field Twin
```

当前准确状态：

```text
architecture_direction:
CONFORMANT_PENDING_P_MINUS_1_ADJUDICATION

design_status:
P_MINUS_1_ADJUDICATION_COMPLETE_CANDIDATE

implementation_status:
NOT_AUTHORIZED

runtime_source_authorized:
false

dt02_architecture_amendment_status:
NOT_REQUIRED_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS

current_repository_action:
MCFT-CAP-05.P-1.DT02-OBJECT-TRANSACTION-ADJUDICATION-V1

next_repository_action_after_merge_and_postmerge_gate:
MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1

P0_authorized_now:
false

automatic_successor_authorization:
NONE
```

P-1 首选预期结果仍为：

```text
REUSE_WITHOUT_AMENDMENT
```

但只有 P-1 文档、Gate、merge 和 merged-main effectiveness 成立后，该裁决才成为仓库事实。


---

## S5 Remediation — Recovery / Evidence Hash / Fixed-Point

```text
remediation_id:
MCFT-CAP-05.S5.RECOVERY-HASH-FIXED-POINT-REMEDIATION-V1

baseline_main_commit:
ef1c789b15a3e73f93c7e63907519faecb027563

merged S5 PR:
2451

independent prior S5 remediation PR found:
false

new remediation PR:
2457

S5 remediation status:
IMPLEMENTATION_CANDIDATE

initial wiring and typecheck workflow:
29315823499 SUCCESS

PostgreSQL remediation and S3 recovery regression workflow:
29316507189 SUCCESS

source_record_hash policy:
S1_FULL_RECORD_MINUS_HASH_AND_MATERIALIZED_LOCATION_V1

amount policy:
WATER_AMOUNT_SCALE_6_HALF_AWAY_FROM_ZERO_V1

recovery policy:
REVALIDATE_ASSERTION_DECISION_PLAN_AMOUNT_AVAILABILITY_VALIDITY_SUPERSESSION_V1

canonical object delta:
0

transaction family delta:
0

migration delta:
0

S6 authorized:
false
```


---

## S6 SSOT Activation — S6 Effective / S7 Authorized

```text
activation_id:
MCFT-CAP-05.S6.SSOT-ACTIVATION-V1

baseline_main_commit:
be8b5ecf061ba5e49c1ae33a7a9d4827aa6b0bbe

activation PR:
2463

S6 Runtime PR:
2456

S6 exact head:
1a4f09278ce8b5ee65af8688f0c4d992a5d10035

S6 merge commit:
be8b5ecf061ba5e49c1ae33a7a9d4827aa6b0bbe

S6 candidate CI:
29323156789 SUCCESS

S6 exact-head CI:
29325080521 SUCCESS

S6 merged-main Gate:
29325686434 SUCCESS

S6 status:
MERGED_EFFECTIVE

S7 delivery slice:
MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1

S7 status after activation:
AUTHORIZED_NOT_STARTED

S7 Runtime implementation started:
false

canonical object delta:
0

transaction family delta:
0

migration delta:
0

CAP-06 authorized:
false
```


---

## S7 SSOT Settlement — S7 Effective / S8 Authorized

```text
activation_id:
MCFT-CAP-05.S7.SSOT-SETTLEMENT-V1

baseline_main_commit:
a4ea0f0c6af45a5d8daaad94be6b95bc3efefd78

activation PR:
2469

S7 Runtime PR:
2467

S7 exact head:
bda7dc07293fbfb187dd8c5cc0109ac5c577952d

S7 merge commit:
a4ea0f0c6af45a5d8daaad94be6b95bc3efefd78

S7 exact-head CI:
29339485877 SUCCESS

S7 merged-main Gate:
29340134021 SUCCESS

S7 validated path:
15 PASS / 0 FAIL

S7 trustworthy NOT_YET_VALIDATED path:
7 PASS / 0 FAIL

S7 PostgreSQL H source path:
8 PASS / 0 FAIL

S7 status:
MERGED_EFFECTIVE

S8 delivery slice:
MCFT-CAP-05.MCFT-07-11.FORECAST-OBSERVATION-RESIDUAL-C-COMMIT-V1

S8 status after activation:
AUTHORIZED_NOT_STARTED

S8 Runtime implementation started:
false

canonical object delta:
0

transaction family delta:
0

migration delta:
0

CAP-06 authorized:
false
```

---

## S8 SSOT Settlement — S8 Effective / S9 Authorized

```text
capability_line_id:
MCFT-CAP-05

activation_id:
MCFT-CAP-05.S8.SSOT-SETTLEMENT-V1

baseline_main_commit:
ca61e86c5a6c1e035b82312b92116a111a76ccc7

activation_pr_number:
2477

implementation_status:
S9_AUTHORIZED_NOT_STARTED

active_delivery_slice_id:
MCFT-CAP-05.MCFT-03-04.RESTART-LATE-RECEIPT-REBUILD-V1

S8 Runtime exact head:
172ee2ac2e306b7e04f2db7d05a3163f881b490a

S8 Runtime merge commit:
0610ed542067e699b7dd9828199661f12e1cdbde

S8 Runtime candidate workflow:
29360620207 SUCCESS

strict-availability exact head:
ff2fc0ea9a2b387b01fe86560f85c65428cb0fee

strict-availability merge commit:
ca61e86c5a6c1e035b82312b92116a111a76ccc7

strict-availability candidate workflow:
29385358058 SUCCESS

invalid probe:
PR #2474 CLOSED_WITHOUT_MERGE_OR_EFFECTIVENESS_CLAIM

corrected merged-main probe:
PR #2476
workflow 29385741895 SUCCESS
closed without merge

strict availability governance:
44 PASS / 0 FAIL

S8 in-memory outcome path:
16 PASS / 0 FAIL

S8 PostgreSQL source/C/recovery path:
8 PASS / 0 FAIL

S8 status:
MERGED_EFFECTIVE

S9 status:
AUTHORIZED_NOT_STARTED

S9 runtime_source_authorized:
true

S9 implementation_started:
false

S10 authorized:
false

CAP-06 authorized:
false
```

Governance effect:

- settle the original S8 Runtime and strict pre-observation Forecast-availability hardening as merged-main effective;
- preserve PR #2474 as an invalid orchestration proof, not a Runtime failure;
- freeze PR #2476 workflow 29385741895 as the corrected merged-main effectiveness proof;
- explicitly authorize, but do not implement, S9 restart, response-loss, late-receipt and projection-rebuild work;
- preserve S10 and CAP-06 as unauthorized;
- add no Runtime source, canonical object, transaction family, migration, route or web change.

---

## S9 SSOT Settlement — S9 Effective / S10 Authorized

```text
activation_id:
MCFT-CAP-05.S9.SSOT-SETTLEMENT-V1

baseline_main_commit:
07485e93ab17c5a4f9dc057f6c79e190a38d425f

implementation_status:
S10_AUTHORIZED_NOT_STARTED

active_delivery_slice_id:
MCFT-CAP-05.MCFT-04-16.BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN-V1

S9_status:
MERGED_EFFECTIVE

S9_exact_head:
cfe0766d474c0e0a37f38fbe2166fcac79ff96de

S9_exact_head_workflow:
29392113827 SUCCESS

S9_merge_commit:
07485e93ab17c5a4f9dc057f6c79e190a38d425f

S9_head_to_merge_file_delta_count:
0

S9_postmerge_probe_PR:
2480 CLOSED_WITHOUT_MERGE

S9_postmerge_probe_workflow:
29392566574 SUCCESS

S9_governance:
54 PASS / 0 FAIL

S9_PostgreSQL_restart_late_rebuild_path:
13 PASS / 0 FAIL

inherited_CAP03_recovery_path:
15 PASS / 0 FAIL

S10_status:
AUTHORIZED_NOT_STARTED

S10_runtime_source_authorized:
true

S10_implementation_started:
false

CAP_06_authorized:
false
```

Governance effect:

- settle S9 restart, G/H/C response-loss, late-receipt no-shift and support-rebuild Runtime as merged-main effective;
- explicitly authorize, but do not implement, the bounded eight-tick feedback-chain S10 slice;
- preserve the prohibition on automatic history rewrite, late-Evidence revision Runtime, calibration, model activation and CAP-06 authority;
- add no Runtime source, canonical object, transaction family, migration, route or web change.
