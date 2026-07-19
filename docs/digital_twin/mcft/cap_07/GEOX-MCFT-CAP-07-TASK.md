# GEOX MCFT-CAP-07 任务线设计 v0.2.5 FINAL

## Minimal Field Twin Read Model and Timeline

```text
document_id:
GEOX-MCFT-CAP-07-TASK-V0.2.5

capability_line_id:
MCFT-CAP-07

display_alias:
MCFT-7

capability_name:
Minimal Field Twin Read Model and Timeline

document_status:
FROZEN

design_direction:
APPROVED

implementation_authorized:
false

runtime_mode:
READ_ONLY_DETERMINISTIC_REPLAY

target_completion_level:
Level A — Deterministic Field Twin Read Surface

predecessor:
MCFT-CAP-06

successor:
MCFT-CAP-08

primary_owner_work_package_id:
MCFT-17

contributing_work_package_ids:
- MCFT-02
- MCFT-03
- MCFT-04
- MCFT-16
- MCFT-18

current_repository_main:
dadb3dc7bca1f484d49a727fa0754bbaf4bee086
```

---

# 0. 文档裁决

本版本取代 MCFT-CAP-07 v0.2.4 的设计内容。

v0.2.5 在 v0.2.4 已成立的 PostgreSQL visibility pagination、per-Slice authority、external effectiveness、HMAC、Replay Evidence、Runtime Health 双语义和 hash ownership 基础上，完成八项冻结级收口：

```text
1. 冻结独立数据库 migration authority、migration credential 与 application runtime credential；
   schema migration 必须由独立 one-shot startup migration process 完成，
   Runtime server 使用独立 runtime credential，只做 startup preflight，禁止自行执行 DDL。

2. 扩大 S2 changed-file boundary，仅允许为上述角色、credential、migration ledger、
   startup migration orchestration、Runtime startup preflight 和 visibility support
   增加必要文件；仍禁止新增 canonical writer 或修改 canonical semantic envelope。

3. API wire cursor 固定为无 padding 的 base64url string。
   FieldTwinCursorPayloadV1 / FieldTwinCursorEnvelopeV1 是 server-internal semantic types；
   HTTP request/response 只暴露 CursorWireTextV1。

4. 修正 Timeline hash 等价范围：
   timeline_items_content_hash 对 exact event page set 稳定；
   timeline_page_content_hash 只有在 visibility snapshot、fixed root、filter、limit、
   cursor boundary 和 item set 全部相同时才要求相等。
   新 visibility snapshot 不构成 content divergence。

5. 所有可能返回多对象的 history/optional collection endpoint 必须 bounded、
   keyset-paginated、HMAC cursor-bound。
   `/runtime` 只返回 collection summary，不返回无界 items arrays。

6. visibility epoch schema 改为多 epoch retained-row model：
   visibility index 使用 (visibility_epoch_id, fact_id) composite identity；
   rotation 不覆盖旧 epoch row，旧 epoch metadata 按冻结 retention policy 保留并受控清理。

7. 冻结 artifact identity 与 retention hierarchy：
   semantic artifact digest、transport archive digest、workflow locator 分层；
   predecessor digest 必须进入 successor committed authority；
   S6 closure 与 epoch-rotation artifact 使用更长 retention。

8. v0.2.4 已冻结的 visibility_anchor_xid8 / visibility_anchor_kind、
   SECURITY DEFINER、Xid8TextV1、HTTP 503、Runtime Attempt direct inventory、
   root/attachment/health hash ownership全部保持。
```

v0.2.5 FINAL 在冻结前完成四项合同闭合：

```text
1. 将 MCFT exact-SHA attestation 长期保留权威绑定到独立的
   S3_COMPAT_OBJECT_LOCK_V1 retention namespace；
   GitHub Actions artifact 仅作为最长 90 天的 transient convenience copy，
   不承担 R1/R2/R3 authority。

2. 冻结 FieldTwinTimelineFilterV1、inclusive/exclusive 时间边界、
   null canonicalization、filter_hash 和 cursor continuation conflict rules。

3. 冻结完整 FieldTwinCollectionKindV1 inventory，
   所有 collection 统一按 logical_time DESC, object_ref ASC 排序；
   object_type 只进入 item semantic identity，不作为前导排序键。

4. 修正 Hard Acceptance 重复 ID，
   visibility metadata service unavailable 使用 I019。
```

当前裁决：

```text
MCFT-7 DESIGN DIRECTION:
APPROVED

MCFT-7 v0.2.5 TASKBOOK FREEZE:
FROZEN

FREEZE READINESS:
APPROVED

P-1A CAP-06 EXTERNAL EXACT-SHA ATTESTATION:
SATISFIED

P-1B DETECTOR_AND_REGISTRY_BOOTSTRAP:
MERGED_EFFECTIVE

MCFT-7 IMPLEMENTATION:
NOT_AUTHORIZED

MCFT-7 S0 CANDIDATE PR:
AUTHORIZED

MCFT-8:
NOT_AUTHORIZED
```

# 1. 权威关系

## 1.1 Repository authority files

S0 必须创建并维护：

```text
docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-TASK.md
docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-RESOLVED-MANIFEST-V1.json
docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CURRENT-AUTHORITY-V1.json
docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json
docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-ROUTE-OWNERSHIP-LOCK-V1.json
docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-HARD-ACCEPTANCE-LEDGER-V1.json
docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S1-DELIVERY-STATUS-V1.json
```

后继 Slice 状态文件路径在本 Taskbook 中冻结，但由其前驱 Slice 创建：

```text
S1 creates GEOX-MCFT-CAP-07-S2-DELIVERY-STATUS-V1.json
S2 creates GEOX-MCFT-CAP-07-S3-DELIVERY-STATUS-V1.json
S3 creates GEOX-MCFT-CAP-07-S4-DELIVERY-STATUS-V1.json
S4 creates GEOX-MCFT-CAP-07-S5-DELIVERY-STATUS-V1.json
S5 creates GEOX-MCFT-CAP-07-S6-DELIVERY-STATUS-V1.json
```

交付基础设施 authority：

```text
docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V2.json
docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json
docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json
docs/digital_twin/mcft/MCFT-MAIN-RULESET-PROFILE-V1.json
```

权威优先级：

```text
1. RESOLVED-MANIFEST-V1
2. CURRENT-AUTHORITY-V1 committed conditional state
3. per-Slice DELIVERY-STATUS-V1 committed candidate state
4. SOURCE-VALIDATION-MATRIX-V1
5. ROUTE-OWNERSHIP-LOCK-V1
6. HARD-ACCEPTANCE-LEDGER-V1 committed evidence state
7. 当前 TASK.md
8. repository-wide Delivery Policy / Candidate Registry
9. GEOX-DIGITAL-TWIN-MASTER-TASK-LINE
10. 历史 MCFT / Operator / Twin Kernel 文档
```

禁止：

```text
直接解析历史 taskbook 条款决定当前 Slice 权威
通过 amendment 文件运行时拼接当前任务图
让历史 Operator 文档覆盖 MCFT-CAP-07 当前权威
让前端代码反向定义 Runtime read model 语义
把 external attestation artifact 伪装成已提交的 repository record
让当前 PR 修改后的 registry 为当前 PR 自授权
```

## 1.2 Per-Slice external effectiveness authority

S0—S6 每个 Slice 均采用同一三层模型：

```text
Layer 1:
Committed Slice Candidate State

Layer 2:
Immutable Slice Exact-Merge-SHA Attestation Artifact

Layer 3:
Effective Delivery Frontier Projection
```

Layer 1 存在于 repository。它只声明条件状态，不声明未来 merge SHA 或 workflow result。

Layer 2、Layer 3 由 read-only `push:main` exact-SHA workflow 生成并作为 artifact 保存；禁止 postmerge SSOT writeback。

每个 Slice 的 committed status 必须包含：

```text
slice_id
candidate_field
candidate_value
effectiveness_condition = PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS
effective_status_when_attested
effective_next_slice_when_attested
predecessor_effective_evidence_requirement
successor_registry_bootstrap
runtime_authority_delta
canonical_write_authority_delta
```

Effective Delivery Frontier 只能由以下联合解析：

```text
committed candidate state
+ exact merge SHA
+ candidate-to-merge tree equivalence
+ required checks result
+ immutable attestation artifact digest
```

S1—S6 candidate PR 必须消费前驱 Slice artifact，并证明：

```text
prior_slice_effective = true
artifact subject = exact predecessor merge SHA
artifact digest retained
predecessor effective next slice = current slice
```

S6 合并前，repository 只能声明：

```text
s6_candidate_implemented = true
effective_completion_condition = PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS
effective_completion_state = MCFT_CAP_07_COMPLETE
```

不得在任何 Slice PR 内预填未来的：

```text
merge_commit
workflow_run_id
job_id
artifact_id
verified_at
```

## 1.3 不可变规则

Taskbook freeze 后，以下内容不可原地改变语义：

```text
Slice 图
per-Slice candidate authority graph
per-Slice external effectiveness graph
对象图
source validation profile family
required source inventory
mandatory root graph
Runtime Health dual semantics
API namespace
content-hash / response-instance-hash family
canonical visibility snapshot family
Cursor payload/envelope/authentication family
route ownership schema
completion claims
```

语义修改必须：

```text
提升 taskbook / manifest version
明确 supersedes
重新经过治理授权
```

---

# 2. 能力目标

MCFT-CAP-07 的唯一能力目标是：

```text
从现有 append-only canonical facts、Replay Evidence facts、
record-set identity indexes 和可重建 projections 中，
构建一个只读、确定性、可追溯、可分页、可重建的
Minimal Field Twin Runtime Read Model。
```

它必须在完整六维 scope 下回答：

```text
1. 当前 active Runtime lineage 是什么？
2. 当前 checkpoint、terminal Tick、terminal record-set Health 和 latest operational Health 分别是什么？
3. terminal record set 的 identity、members 和 aggregate hash 是否一致？
4. 当前 Tick 使用了哪个 Evidence Window？
5. prior、propagation、selected observation、innovation、assimilation disposition、posterior 分别是什么？
6. 当前 Tick Forecast 是 COMPLETED 还是 BLOCKED？
7. latest successful Forecast 是否早于当前 Tick？
8. current Scenario 是否 exact attached 到 current Forecast？
9. 是否存在 Human Decision、Approved Plan 和一个或多个 Action Feedback？
10. 是否存在一个或多个 Forecast Residual？
11. Residual 是否 exact connected 到 current/historical Runtime graph？
12. 是否存在一个或多个 Calibration Candidate 和 Shadow Evaluation？
13. Candidate 是否仍为 NOT_ACTIVE？
14. 哪些对象 complete、absent、unattached 或 inconsistent？
15. 每个对象的 exact evidence、hash、scope 和时间是什么？
16. restart / projection rebuild 后，content hashes 是否保持相同；跨请求 timeline pagination 是否正确绑定 signed canonical visibility snapshot 和 fixed root；每次 response instance 是否只绑定本次 response_started_at？
```

---

# 3. 明确非目标

```text
NO_NEW_CANONICAL_OBJECT_WRITER
NO_NEW_CANONICAL_STORE
NO_RUNTIME_TICK_CREATION
NO_STATE_MUTATION
NO_FORECAST_EXECUTION
NO_SCENARIO_EXECUTION
NO_RECOMMENDATION_CREATION
NO_APPROVAL_CREATION
NO_AO_ACT_TASK_CREATION
NO_DISPATCH
NO_ACTION_EXECUTION
NO_CALIBRATION_CANDIDATE_CREATION
NO_SHADOW_EVALUATION_EXECUTION
NO_MODEL_ACTIVATION
NO_ACTIVE_CONFIG_CHANGE
NO_CHECKPOINT_ADVANCE
NO_LINEAGE_ACTIVATION
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_CROSS_DATABASE_GRAPH_STITCHING
NO_HISTORICAL_POINTER_TIME_TRAVEL
NO_CROSS_REQUEST_POSTGRESQL_MVCC_SNAPSHOT_RESTORATION
NO_LIVE_FIELD_CLAIM
NO_PRODUCTION_RUNTIME_CLAIM
NO_REAL_DATA_CALIBRATION_CLAIM
NO_MCFT_CAP_08_CLOSURE
```

全部 Runtime/API/UI 交付必须保持：

```text
read-only
fact-preserving
config-preserving
checkpoint-preserving
activation-preserving
```

---

# 4. 基础不变量

## 4.1 Canonical authorities

```text
public.facts
```

是 canonical history storage authority，但 facts 内存在两类不同 envelope：

```text
CANONICAL_TWIN_OBJECT
REPLAY_EVIDENCE_RECORD
```

二者不得使用同一 envelope validator。

所有 projection、pointer、binding、record-set index 和 composite read model 均为：

```text
mutable
rebuildable
non-canonical
non-authoritative
```

## 4.2 完整 scope

固定 scope：

```text
tenant_id
project_id
group_id
field_id
season_id
zone_id
```

来源：

```text
tenant/project/group:
authenticated request scope

field:
route path

season/zone:
explicit query parameters
或独立冻结的 authoritative exact binding
```

错误：

```text
400 MCFT_SCOPE_INCOMPLETE
403 MCFT_SCOPE_FORBIDDEN
409 MCFT_SCOPE_AMBIGUOUS
```

禁止：

```text
按 updated_at 猜 active season
按 created_at 猜 zone
缺少 season/zone 时降级为 field-only
存在多个候选时选择 latest
只因 field_id 相同就拼接对象
```

## 4.3 时间语义

必须原样保留：

```text
logical_time
as_of
observed_at
available_to_runtime_at
execution_start
execution_end
created_at
updated_at
```

不存在的时间为显式 null。

禁止：

```text
observed_at 替代 available_to_runtime_at
created_at 替代 logical_time
DB insert order 推断 Runtime order
updated_at 选择 canonical current object
```

---

# 5. Source Validation Profiles

MCFT-CAP-07 固定八类 source-validation profile。

## 5.1 CANONICAL_AGGREGATE_PROJECTION

初始映射：

```text
twin_state_history_projection_v1
twin_forecast_run_projection_v1
twin_scenario_set_projection_v1
twin_decision_record_projection_v1
twin_action_feedback_projection_v1
twin_forecast_residual_projection_v1
twin_calibration_candidate_projection_v1
twin_shadow_evaluation_projection_v1
```

验证必须由逐表 obligation matrix 驱动，不得假定所有 projection 都拥有相同列。

通用要求：

```text
source_fact_id exact resolve
fact envelope family correct
fact record type correct
projection identity equals canonical identity
scope paths equal
available time columns equal
available canonical payload columns equal
available refs/hashes equal
projection determinism hash equal
```

失败：

```text
MCFT_AGGREGATE_PROJECTION_CANONICAL_DIVERGENCE
```

## 5.2 EMBEDDED_CHILD_PROJECTION

初始映射：

```text
twin_forecast_point_projection_v1
twin_scenario_point_projection_v1
twin_shadow_evaluation_case_projection_v1
```

Child row 必须经 parent aggregate fact 解析：

```text
child row
→ parent projection identity
→ parent source_fact_id
→ parent canonical payload
→ exact child lookup path
```

Child 不得描述为独立 canonical object。

失败：

```text
MCFT_EMBEDDED_CHILD_CANONICAL_DIVERGENCE
```

## 5.3 OPERATIONAL_POINTER_INDEX

初始映射：

```text
twin_active_lineage_index_v1
twin_state_latest_index_v1
twin_forecast_result_latest_index_v1
twin_forecast_success_latest_index_v1
twin_scenario_latest_index_v1
twin_runtime_checkpoint_latest_index_v1
twin_runtime_health_latest_index_v1
```

要求：

```text
scope exact
pointer target exact
canonical target exists
lineage/revision/time/hash fields match where present
activation authority fields valid
expected_previous_active_lineage validated
pointer row itself不获得 canonical determinism claim
```

失败：

```text
MCFT_OPERATIONAL_POINTER_INVALID
```

## 5.4 RECORD_SET_IDENTITY_INDEX

初始映射：

```text
twin_object_idempotency_index_v1
```

仅用于：

```text
record_set_id
aggregate determinism_hash
identity_basis
member_object_ids
member_determinism_hashes
```

验证：

```text
identity_kind 与 record-set family 匹配
record_set_id exact
member type set exact
member IDs exact
member hashes exact
aggregate hash recompute exact
operation identity basis exact
```

它不是 canonical Timeline event，也不是 canonical Trace node。

失败：

```text
MCFT_RECORD_SET_IDENTITY_INVALID
```

## 5.5 EVIDENCE_BINDING_PROJECTION

初始映射：

```text
twin_approved_plan_binding_projection_v1
twin_action_feedback_evidence_index_v1
twin_candidate_evaluation_index_v1
```

要求：

```text
每个 ref/hash exact resolve
scope exact
Decision selected option 与 Approved Plan exact binding
Scenario amount / approved amount / executed amount 分离
Candidate-to-Evaluation relationship 来自 Evaluation canonical payload
```

失败：

```text
MCFT_EVIDENCE_BINDING_INVALID
```

## 5.6 DERIVED_COMPOSITE_PROJECTION

初始映射：

```text
twin_action_feedback_cycle_projection_v1
```

必须从 exact refs 重建 composite 并重新计算 projection_hash。

禁止 latest/same-scope fallback。

失败：

```text
MCFT_DERIVED_COMPOSITE_REBUILD_MISMATCH
```

## 5.7 CANONICAL_TWIN_FACT_DIRECT

Taskbook 冻结的 required canonical fact inventory：

```text
twin_runtime_lineage_v1
twin_revision_run_v1
twin_lineage_promotion_v1
twin_runtime_tick_v1
twin_evidence_window_v1
twin_state_transition_v1
twin_assimilation_update_v1
twin_runtime_attempt_v1
twin_forecast_failure_v1
twin_runtime_checkpoint_v1
twin_runtime_health_v1
twin_runtime_config_v1
twin_model_activation_v1
```

要求：

```text
exact semantic object_id
record_json.type
canonical object envelope
scope path family
lineage/revision
logical_time/as_of where required
determinism hash recompute
source/evidence refs
object_id uniqueness
```

Active Lineage authority 必须分支验证：

```text
INITIAL:
active lineage pointer
→ activation_authority_ref
→ twin_runtime_lineage_v1
→ lineage_kind = INITIAL
→ expected_previous_active_lineage = null

REVISION:
active lineage pointer
→ activation_authority_ref
→ twin_lineage_promotion_v1
→ candidate_lineage_ref
→ twin_runtime_lineage_v1(lineage_kind = REVISION_CANDIDATE)
→ revision_run_ref
→ exact twin_revision_run_v1 terminal event(status = COMPLETED)
→ validated_chain_refs
```

`twin_revision_run_v1` 是 append-only status event family。Resolver 必须使用 promotion object 的 exact refs 或 frozen identity relation；禁止对 revision ID 使用 timestamp-latest 猜测。

失败：

```text
MCFT_DIRECT_CANONICAL_TWIN_FACT_INVALID
MCFT_ACTIVE_LINEAGE_AUTHORITY_INVALID
MCFT_REVISION_PROMOTION_CHAIN_INVALID
```

---

## 5.8 REPLAY_EVIDENCE_FACT_DIRECT

Taskbook 冻结的 required Replay Evidence record-type inventory 只有：

```text
approval_assertion_evidence_v1
approved_irrigation_plan_snapshot_v1
external_dispatch_evidence_v1
irrigation_execution_receipt_evidence_v1
```

这些 record type 已有明确 repository contract 或 exact resolver usage，才允许进入 required direct-fact inventory。

Optional reference kinds 另行冻结为：

```text
AS_EXECUTED
ACCEPTANCE
TASK
```

Optional reference kind 只表示 canonical Action Feedback / evidence-binding projection 中存在 exact ref；它不自动证明存在同名独立 Replay Evidence fact type，也不得调用 `REPLAY_EVIDENCE_FACT_DIRECT` validator。

Replay Evidence envelope 至少包含：

```text
record_type
source_record_id
source_record_hash
evidence_identity_key 或冻结的 evidence-specific identity field
available_to_runtime_at
canonical_payload
```

验证：

```text
record_type exact and frozen
source_record_id exact
source_record_hash recompute exact
evidence identity exact
scope exact
available_to_runtime_at exact
evidence-specific payload contract exact
source_payload/canonical_payload equivalence where contract requires it
```

禁止：

```text
使用 canonical Twin object validator
把 evidence_kind 当作独立 fact record_type
把 AS_EXECUTED / ACCEPTANCE / TASK 自动提升为 direct Replay Evidence fact
由 S0 临时增加 required record type
```

新增 Replay Evidence record type 必须：

```text
提升 Taskbook / Resolved Manifest version
冻结 exact envelope contract
冻结 exact hash policy
经过重新授权
```

失败：

```text
MCFT_DIRECT_REPLAY_EVIDENCE_INVALID
MCFT_REPLAY_EVIDENCE_RECORD_TYPE_NOT_FROZEN
```

## 5.9 Source Validation Matrix schema

Taskbook freeze 必须冻结 obligation-row schema：

```text
source_name
profile_family
envelope_family
identity_field
scope_path
payload_path
logical_time_path
as_of_path
available_to_runtime_at_path
available_projection_columns
required_column_comparisons
source_fact_envelope_profile
parent_lookup_path
child_lookup_path
cardinality
canonical_hash_function
fact_visibility_metadata_source
visibility_anchor_xid8_path
visibility_anchor_kind_path
visibility_epoch_source
snapshot_visibility_predicate
visibility_snapshot_eligible
health_attempt_ref_path
health_operation_discriminator_path
health_transaction_family_resolution_rule
health_role_resolution_rule
failure_code
```

Taskbook freeze 还必须冻结：

```text
eight profile families
required source inventory
required canonical Twin fact-type inventory
required Replay Evidence record-type inventory
optional evidence reference-kind inventory
required obligation kinds
row uniqueness key
profile-to-failure-code mapping
route-lock row schema
```

Taskbook freeze **不要求** S0 authority files 已经存在，也不要求逐表 obligation rows 已物化。

S0 Exit 才要求：

```text
every required source table mapped exactly once
every required fact type mapped exactly once
every available projection column obligation complete
every source-fact resolver path complete
every active-lineage authority branch complete
every route ownership row complete
matrix and route focused Gate PASS
```

禁止在 S0 期间扩大 required source inventory；新增 source 必须提升 Taskbook/Manifest 版本。

---

# 6. Mandatory Current-Runtime Root Graph

Mandatory canonical nodes：

```text
active lineage
checkpoint
terminal Runtime Tick
Evidence Window
State Transition
Assimilation Update
Posterior State
current Tick Forecast result
terminal_record_set_health
Runtime Config
```

Mandatory non-canonical validation support：

```text
active lineage pointer
checkpoint pointer
state pointer
forecast result pointer
record-set identity index
```

Independent operational-health support：

```text
runtime health latest pointer
latest_operational_runtime_health
```

逻辑图：

```text
Active Lineage Pointer
  → activation authority graph
  → Active Lineage Fact

Checkpoint Pointer
  → Checkpoint Fact
  → terminal Tick
  → record-set identity

Runtime Tick / record-set identity
  → Evidence Window
  → State Transition
  → Assimilation Update
  → Posterior State
  → current Tick Forecast result
  → terminal_record_set_health
  → Checkpoint

record-set identity
  → exact member IDs
  → exact member hashes
  → aggregate hash

all applicable members
  → Runtime Config
```

`terminal_record_set_health` 必须由 record-set identity 的 exact member set 解析，不得由 health latest pointer 替代。

`latest_operational_runtime_health` 必须由 `twin_runtime_health_latest_index_v1` 解析。它可以：

```text
等于 terminal_record_set_health
晚于 terminal Tick
来自 F_OPERATIONAL_ATTEMPT_HEALTH
存在而 terminal root 不存在
```

后续独立 operational health 不得使已经完整的 canonical terminal root 失效。

## 6.1 Runtime Health exact role resolution

`transaction_family` 和 `health_role` 不是根据时间或“是否 latest”猜测。固定算法如下。

A-family / terminal member：

```text
1. exact health object_id 存在于已验证的 A0/A1/A2 record-set identity member set；
2. member hash 与 record-set identity 中的 member_determinism_hash exact；
3. health payload 中可用的 tick_ref/checkpoint_ref/state_ref/forecast_result_ref
   与同一 record set 成员 exact；
4. scope、Runtime Config 和 logical context exact。

结果：
transaction_family = A_STATE_TICK_COMMIT
health_role = TERMINAL_RECORD_SET_MEMBER
atomic_group_ref = record_set_id
```

F-family / independent operational audit：

```text
1. health object 不是任何已验证 A0/A1/A2 record-set member；
2. S0 Source Validation Matrix 冻结 exact attempt-ref 或 operation-discriminator path；
3. health.attempt_ref 必须按 S0 Matrix 冻结的 exact path 解析到
   twin_runtime_attempt_v1.object_id；
4. Attempt 的 attempt_id、scope、context refs、object hash exact；
5. optional forecast_failure_ref 存在时，必须解析到 twin_forecast_failure_v1，
   且 Forecast Failure 与 Health 指向同一 exact attempt；
6. 不得声明 terminal Tick / checkpoint commit success。

结果：
transaction_family = F_OPERATIONAL_ATTEMPT_HEALTH
health_role = OPERATIONAL_ATTEMPT_AUDIT
atomic_group_ref = null
```

仅凭“不在当前 terminal record set”不足以判定 F-family。若 exact resolver evidence 不足：

```text
MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED
```

S0 Matrix 必须为每个可接受 Health envelope 冻结：

```text
attempt_ref_path
operation_discriminator_path
forecast_failure_ref_path
required/forbidden terminal refs
transaction-family resolution rule
health-role resolution rule
failure code
```

## 6.2 Health relationship

Health relationship 固定为：

```text
SAME_OBJECT
LATEST_OPERATIONAL_IS_LATER
TERMINAL_ONLY
OPERATIONAL_ONLY
BOTH_ABSENT
```

禁止补图：

```text
same field latest
same logical time
same lineage arbitrary object
same Runtime Config arbitrary object
DB insertion order
updated_at
created_at
用 runtime health latest pointer 替代 terminal health member
不在 terminal set 就猜为 F-family
```

Root graph 只允许：

```text
COMPLETE_EXACT_GRAPH
NOT_AVAILABLE
INCONSISTENT
```

`PARTIAL_EXACT_GRAPH` 不适用于 mandatory root。

错误：

```text
404 MCFT_RUNTIME_GRAPH_NOT_AVAILABLE
409 MCFT_RUNTIME_GRAPH_INCONSISTENT
409 MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED
```

409 不得返回可消费 current payload。

`/runtime/health` 的 operational-health pointer 或 role resolution 不一致可返回 health endpoint 409；不得反向污染已经验证通过的 terminal root，除非同一错误同时破坏 terminal member exactness。

# 7. Optional Domains and Cardinality

Optional domain status 固定为：

```text
ATTACHED_EXACT
ABSENT_OPTIONAL_DOMAIN
NOT_ATTACHED_TO_CURRENT_RUNTIME_GRAPH
INCONSISTENT_EXACT_REFERENCE
```

额外语义使用 `reason_code`，不得扩展第五种 status。

## 7.1 Single/current attachment

```text
current_scenario_attachment
current_human_decision
current_approved_plan
```

只有存在 exact relationship 才可 `ATTACHED_EXACT`。

## 7.2 Collections

以下 domain relationship 必须保持 plural collection 语义：

```text
Action Feedback
Forecast Residual
Calibration Candidate
Shadow Evaluation
Model Activation
```

不得使用 `ORDER BY logical_time DESC LIMIT 1` 伪造 single current authority。

`/runtime` 只提供 `FieldTwinOptionalCollectionSummaryV1`；具体 items 只能由 bounded `FieldTwinCollectionPageV1<T>` endpoint 返回。

每个 collection summary 必须提供：

```text
attachment_status
reason_code
has_items
count_status = NOT_COMPUTED | EXACT_VALIDATED_PROJECTION
total_count nullable
latest_item_ref nullable
```

每个 collection page 必须提供：

```text
bounded items[]
page_limit
has_more derived by limit + 1 fetch
CursorWireTextV1 next_cursor
collection_items_content_hash
collection_page_content_hash
```

禁止在任何 endpoint 返回完整无界 `unattached_item_refs[]` 或 `inconsistent_item_refs[]`；诊断明细必须使用同一 bounded collection pagination contract。

## 7.3 Scenario views

必须分别输出：

```text
current_scenario_attachment
latest_scenario_in_scope
scenario_source_forecast
```

当 current Forecast BLOCKED：

```text
current_scenario_attachment.status = NOT_ATTACHED_TO_CURRENT_RUNTIME_GRAPH
current_scenario_attachment.reason_code = CURRENT_FORECAST_BLOCKED
```

旧 Scenario 可以作为 historical/latest-in-scope 信息展示，但不得呈现为 current Scenario。

---

# 8. Forecast 三指针契约

必须分别输出：

```text
current_tick_forecast_result
latest_successful_forecast
scenario_source_forecast
```

## 8.1 current_tick_forecast_result

唯一来源：

```text
current Runtime Tick.forecast_result_ref
```

```text
COMPLETED → 72 points
BLOCKED   → 0 points + reason_codes
```

禁止用 old successful Forecast 替代 BLOCKED current result。

## 8.2 latest_successful_forecast

来源：

```text
twin_forecast_success_latest_index_v1
→ exact canonical Forecast
```

输出：

```text
is_current_tick_forecast
stale_relative_to_current_tick
logical_time_delta
```

## 8.3 scenario_source_forecast

来源：

```text
attached/latest Scenario.source_forecast_ref
```

必须验证：

```text
status = COMPLETED
point_count = 72
source hash exact
```

只有其 object ID 等于 current Tick Forecast object ID 时，Scenario 才可 attached to current graph。

---

# 9. Timeline 契约

## 9.1 Event taxonomy

```text
EVIDENCE_WINDOW
STATE_TRANSITION
ASSIMILATION_UPDATE
POSTERIOR_STATE
FORECAST_RESULT
FORECAST_FAILURE
RUNTIME_TICK
CHECKPOINT
RUNTIME_HEALTH
SCENARIO_SET
HUMAN_DECISION
APPROVED_PLAN_EVIDENCE
ACTION_FEEDBACK
FORECAST_RESIDUAL
CALIBRATION_CANDIDATE
SHADOW_EVALUATION
MODEL_ACTIVATION
```

禁止：

```text
STATE_UPDATE
EVIDENCE
OTHER
UNKNOWN_EVENT
```

## 9.2 Atomic grouping and Health roles

同一 State Tick record set 的：

```text
Evidence Window
State Transition
Assimilation Update
Posterior State
Forecast result
Runtime Tick
Checkpoint
terminal_record_set_health
```

必须共享：

```text
atomic_group_ref = record_set_id
```

A-family Health event 只能由 validated record-set membership 判定：

```text
transaction_family = A_STATE_TICK_COMMIT
health_role = TERMINAL_RECORD_SET_MEMBER
atomic_group_ref = record_set_id
health_resolution_basis = EXACT_RECORD_SET_MEMBERSHIP
```

F-family Health event 只能由 S0 Matrix 冻结的 exact attempt / failure relation 判定：

```text
transaction_family = F_OPERATIONAL_ATTEMPT_HEALTH
health_role = OPERATIONAL_ATTEMPT_AUDIT
atomic_group_ref = null
health_resolution_basis = EXACT_OPERATIONAL_ATTEMPT_RELATION
```

禁止：

```text
把 F-family Health 伪装为 terminal record-set member
把所有非 terminal Health 自动归类为 F-family
用 latest pointer、logical_time 或 operation_status 文本单独猜 transaction family
```

无法 exact 分类必须：

```text
MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED
```

## 9.3 Event fields

```text
event_id
event_kind
event_rank
object_ref
object_type
object_hash
scope
lineage_id
revision_id
logical_time
as_of
observed_at
available_to_runtime_at
created_at
transaction_family
health_role
health_resolution_basis
health_resolution_evidence_refs
atomic_group_ref
source_fact_ref
source_refs
evidence_refs
attachment_status
limitations
```

非 Health event 的 `health_role`、`health_resolution_basis` 和 `health_resolution_evidence_refs` 显式 null。

不存在字段显式 null。

---

## 9.4 Ordering

Canonical ascending order：

```text
logical_time ASC
event_rank ASC
object_ref ASC
```

Ranks：

```text
10  EVIDENCE_WINDOW
20  STATE_TRANSITION
30  ASSIMILATION_UPDATE
40  POSTERIOR_STATE
50  FORECAST_RESULT
60  FORECAST_FAILURE
70  RUNTIME_TICK
80  CHECKPOINT
90  RUNTIME_HEALTH
100 SCENARIO_SET
110 HUMAN_DECISION
120 APPROVED_PLAN_EVIDENCE
130 ACTION_FEEDBACK
140 FORECAST_RESIDUAL
150 CALIBRATION_CANDIDATE
160 SHADOW_EVALUATION
170 MODEL_ACTIVATION
```

---

# 10. Trace Graph 契约

只允许：

```text
exact nodes
exact edges
explicit unattached objects
explicit missing diagnostics
record-set validation summary
```

Node 至少包含：

```text
node_id
object_ref
object_type
object_hash
scope
lineage_id
revision_id
logical_time
source_fact_ref
validation_profile
validation_status
```

record-set identity 不作为 canonical node，进入：

```text
record_set_validation
```

Edge kinds：

```text
ACTIVE_LINEAGE_TARGET
CHECKPOINT_TARGET
TERMINAL_TICK_MEMBER
EVIDENCE_FOR_TICK
TRANSITION_FOR_TICK
ASSIMILATION_FOR_TICK
POSTERIOR_FOR_TICK
FORECAST_FOR_TICK
HEALTH_FOR_TICK
CONFIG_USED_BY
FORECAST_SOURCE_FOR_SCENARIO
SCENARIO_SELECTED_BY_DECISION
DECISION_BOUND_TO_PLAN
PLAN_EXECUTED_BY_FEEDBACK
FORECAST_MATCHED_BY_RESIDUAL
RESIDUAL_USED_BY_CALIBRATION
CANDIDATE_EVALUATED_BY
CANDIDATE_ACTIVATED_BY
SUPERSEDES
```

禁止 inferred edge。

---

# 11. State 和 Confidence

当 canonical State 声明：

```text
confidence.status = NOT_ESTABLISHED
reason_code = NO_CALIBRATED_CONFIDENCE_MODEL
```

API/UI 必须原样显示。

禁止：

```text
根据 score 推断 HIGH/MEDIUM/LOW
根据 coverage 推断 confidence
把 Shadow disposition 当 State confidence
```

Use eligibility 分别展示：

```text
state_valid
posterior_chain_eligible
forecast_source_eligible
recommendation_input_eligible
action_input_eligible
```

---

# 12. Per-request Snapshot、Canonical Visibility Snapshot 和时间过滤

## 12.1 Per-request PostgreSQL snapshot

每个 HTTP 请求内部：

```sql
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
```

要求：

```text
one PostgreSQL connection
one transaction
one six-dimensional scope
one response_started_at
all repositories receive same transaction client
no cross-database stitching
no write SQL in product read path
```

`response_started_at` 在事务开始时读取一次 `transaction_timestamp()`，只表示本次 response 的时间元数据。

明确非声明：

```text
response_started_at 不是 PostgreSQL MVCC snapshot identity
后续 HTTP 请求不通过 response_started_at 恢复前一事务可见集合
不使用 pg_export_snapshot / SET TRANSACTION SNAPSHOT 保持跨请求长事务
```

## 12.2 Current repository baseline and required physical support

当前 repository baseline 的 `public.facts` 只有：

```text
fact_id
occurred_at
source
record_json
```

因此 Taskbook 禁止依赖不存在的 ingestion-time 或 commit-time column。

跨请求 visibility pagination 需要一个 additive、non-canonical physical support contract：

```text
twin_fact_visibility_epoch_v1
  visibility_epoch_id PRIMARY KEY
  schema_version
  status = STAGING | ACTIVE | RETIRED
  activated_at
  retired_at nullable
  activation_xid8
  baseline_fact_count
  baseline_fact_id_set_hash
  rotation_semantic_artifact_digest nullable
  rotation_transport_archive_sha256 nullable
  retention_not_before nullable
  index_rows_purged_at nullable
  purge_semantic_artifact_digest nullable
  purge_transport_archive_sha256 nullable

constraints:
  partial unique index permits exactly one ACTIVE epoch
  ACTIVE epoch retired_at is null
  RETIRED epoch retired_at and retention_not_before are required

twin_fact_visibility_index_v1
  visibility_epoch_id NOT NULL
  fact_id NOT NULL → facts.fact_id
  visibility_anchor_xid8 xid8 NOT NULL
  visibility_anchor_kind text NOT NULL
    CHECK (
      visibility_anchor_kind IN (
        'FACT_INSERT_TRANSACTION',
        'INITIAL_BASELINE_TRANSACTION',
        'EPOCH_ROTATION_TRANSACTION'
      )
    )
  PRIMARY KEY (visibility_epoch_id, fact_id)
```

数据库 trigger：

```text
AFTER INSERT ON facts FOR EACH ROW
→ resolve exactly one ACTIVE visibility_epoch_id
→ insert exactly one visibility-index row
→ visibility_anchor_xid8 = pg_current_xact_id()
→ visibility_anchor_kind = FACT_INSERT_TRANSACTION
→ same database transaction as canonical fact append
```

该支持状态：

```text
不是 canonical fact
不进入 object_id / determinism_hash / source_record_hash
不改变 record_json envelope
不允许 application supplied visibility_anchor_xid8 或 visibility_anchor_kind
不授予 canonical object write authority
```

S2 允许一个且仅一个 additive migration 建立该支持。Migration 必须在排除 `facts` insert 的 maintenance transaction 内按以下顺序执行：

```text
1. lock facts against concurrent insert;
2. create epoch/index tables and exact constraints;
3. create one new ACTIVE visibility epoch;
4. backfill every existing fact with:
   visibility_anchor_xid8 = migration top-level pg_current_xact_id();
   visibility_anchor_kind = INITIAL_BASELINE_TRANSACTION;
   visibility_epoch_id = active epoch;
5. create/enable the row trigger before writes resume;
6. prove fact-count equality, unique coverage and epoch equality;
7. commit atomically.
```

CAP-07 cursor 在 migration/epoch activation 完成前不可签发。

所有 repository facts INSERT 必须经过 trigger；missing、duplicate 或 wrong-epoch metadata 必须 fail：

```text
MCFT_FACT_VISIBILITY_METADATA_INCONSISTENT
```

## 12.2.1 Canonical Fact Visibility Metadata Protection

Visibility metadata 是 non-canonical physical support，但它直接决定跨请求 Timeline 的可见集合，因此必须由数据库权限而不是应用约定保护。

冻结数据库 ownership 与 privilege contract：

```text
visibility epoch/index tables:
owned by migration authority role

application runtime role:
SELECT only on public.twin_fact_visibility_epoch_v1
SELECT only on public.twin_fact_visibility_index_v1
no direct INSERT
no direct UPDATE
no direct DELETE
no TRUNCATE
no ALTER TABLE
no trigger enable/disable authority
non-superuser
cannot set session_replication_role to replica
```

Trigger function contract：

```text
execution:
SECURITY DEFINER

owner:
dedicated migration/visibility-metadata owner role

search_path:
fixed to pg_catalog

relation references:
fully qualified public.facts
fully qualified public.twin_fact_visibility_epoch_v1
fully qualified public.twin_fact_visibility_index_v1

function references:
pg_catalog-qualified where applicable

direct invocation:
REVOKE EXECUTE FROM PUBLIC
REVOKE EXECUTE FROM application runtime role
```

`AFTER INSERT FOR EACH ROW` trigger 在 canonical fact INSERT 的同一 SQL statement、同一 database transaction 中写入 metadata。Trigger function 只能：

```text
读取 exactly one ACTIVE epoch
插入当前 NEW.fact_id 的一条 visibility row
使用 pg_current_xact_id() 生成 top-level visibility anchor
设置 visibility_anchor_kind = FACT_INSERT_TRANSACTION
返回 NEW
```

禁止：

```text
从 NEW.record_json、session variable 或应用参数接受 xid8/kind
覆盖已有 visibility row
更新或删除历史 visibility row
在 zero/multiple ACTIVE epoch 时继续写入
在 trigger disabled 或 replica-role bypass 条件下执行 authoritative fact write
```

维护路径：

```text
INITIAL baseline:
authorized migration transaction only

epoch rotation:
authorized epoch-rotation maintenance transaction only

normal application runtime:
no direct metadata mutation authority
```

Visibility index row 的 UPDATE/DELETE 在正常运行中永久禁止。Epoch rotation 必须创建新 epoch 和新 baseline，不得原位改写旧 epoch 的 anchor identity。唯一允许的 DELETE 是满足 retention contract 后由 migration credential 执行的 retired-epoch index purge；它不得删除 epoch authority row。任何不满足 privilege、trigger、epoch-cardinality、retention 或 immutability contract 的环境必须 fail closed：

```text
MCFT_VISIBILITY_METADATA_PRIVILEGE_CONTRACT_INVALID
MCFT_VISIBILITY_TRIGGER_CONTRACT_INVALID
MCFT_VISIBILITY_TRIGGER_BYPASS_DETECTED
MCFT_VISIBILITY_ACTIVE_EPOCH_CARDINALITY_INVALID
MCFT_VISIBILITY_METADATA_IMMUTABILITY_VIOLATION
```

## 12.2.2 Xid8TextV1

PostgreSQL `xid8` 在 TypeScript/JSON/domain 层一律表示为 canonical decimal string：

```text
Xid8TextV1:
  regex = ^(?:0|[1-9][0-9]*)$
  leading zero forbidden except "0"
  JavaScript number conversion forbidden
  JSON number serialization forbidden
  parse target = bigint or PostgreSQL xid8 only
```

冻结字段类型：

```text
FieldTwinCanonicalVisibilitySnapshotV1.snapshot_xmin:
Xid8TextV1

FieldTwinCanonicalVisibilitySnapshotV1.snapshot_xmax:
Xid8TextV1

snapshot_xip_values_for_hash:
Xid8TextV1[] derived validation sequence

visibility repository result.visibility_anchor_xid8:
Xid8TextV1
```

排序必须是 xid8 numeric ascending：

```text
preferred:
PostgreSQL ORDER BY xid8

allowed pure-domain implementation:
BigInt(a) < BigInt(b)

forbidden:
JavaScript default string sort
Number(a) - Number(b)
localeCompare
```

序列化前必须 canonicalize 为 decimal strings；`snapshot_xip_hash` 只能基于 numeric-sorted `Xid8TextV1[]` 计算。

## 12.2.3 Migration authority、Runtime role、credential 和 startup migration

数据库身份必须物理分离。名称可以由部署环境映射，但 authority relationship 不得改变。

角色/credential 由独立 database platform bootstrap authority 预先建立；Runtime server 和 migration workload 均不得创建、修改或自行提升数据库身份：

```text
database_platform_bootstrap_authority:
  external administrative authority
  provisions owner/migrator/runtime roles and credentials
  executes reviewed role/grant bootstrap SQL
  unavailable to Runtime application
  not reused as migration or Runtime credential

geox_mcft_migration_owner_v1:
  NOLOGIN
  owns visibility epoch/index tables
  owns migration ledger
  owns SECURITY DEFINER trigger function
  owns required grants and constraints
  not used by application connection pool

geox_mcft_migrator_v1:
  LOGIN or external workload identity
  NOINHERIT by default
  dedicated migration credential
  may SET ROLE geox_mcft_migration_owner_v1 only inside authorized migration process
  unavailable to Runtime server process

geox_runtime_v1:
  LOGIN or external workload identity
  dedicated Runtime credential
  no membership in migration owner/migrator roles
  no DDL
  no direct visibility metadata DML
  no migration ledger write
  normal canonical facts write authority remains governed by existing Runtime contracts
```

Credential contract：

```text
GEOX_MIGRATION_DATABASE_URL:
  available only to one-shot migration workload
  forbidden in long-running Runtime server environment

DATABASE_URL or GEOX_RUNTIME_DATABASE_URL:
  resolves only to geox_runtime_v1
  forbidden for schema migration

same credential for migration and Runtime:
  forbidden

fallback from missing migration credential to Runtime credential:
  forbidden

credential values:
  never committed
  never logged
  never copied into attestation artifact
```

Migration ledger 固定为 non-canonical physical governance state：

```text
geox_schema_migration_ledger_v1
  migration_id PRIMARY KEY
  migration_checksum_sha256
  taskbook_version
  subject_commit
  applied_at
  applied_by_session_user
  applied_by_current_user
  status = APPLIED
```

同一 `migration_id` checksum 不同必须 fail closed；ledger 不允许 Runtime role 写入。

Startup migration 必须是独立 process，不得嵌入正常 Runtime server bootstrap：

```text
Phase B — one-time database identity bootstrap
1. external database platform authority creates exact roles;
2. grants migrator only the frozen SET ROLE relationship;
3. grants Runtime only frozen application privileges;
4. stores migration/runtime credentials in separate secret identities;
5. verifies Runtime cannot inherit or assume migration authority.

Phase M — one-shot migration workload
1. connect using migration credential;
2. acquire dedicated PostgreSQL advisory lock;
3. verify current_user / session_user / allowed SET ROLE graph;
4. read migration ledger and exact migration checksum;
5. apply only pending registered migration in deterministic order;
6. establish roles, grants, epoch/index schema, trigger and baseline;
7. run post-migration privilege/trigger/coverage/epoch checks;
8. write migration ledger success row with migration_id and checksum;
9. release lock and exit 0.

Phase R — Runtime server startup
1. connect using Runtime credential;
2. assert current_user = configured Runtime role;
3. assert no pending required migration;
4. assert migration ledger checksum and schema version exact;
5. assert exactly one ACTIVE epoch;
6. assert trigger enabled and owned by migration owner;
7. assert Runtime role lacks forbidden metadata DML/DDL/trigger-bypass privileges;
8. assert visibility metadata count/epoch coverage is valid;
9. only after PASS may the HTTP listener become ready.
```

Runtime startup 只允许 read-only preflight。禁止：

```text
server process automatic DDL
server process SET ROLE migration owner
server process migration credential access
“best effort” migration
pending migration while serving traffic
readiness PASS before visibility preflight PASS
```

部署编排必须保证：

```text
migration workload success
→ Runtime workload startup/readiness

Docker Compose:
service_completed_successfully or equivalent explicit one-shot dependency

Kubernetes/production:
migration Job/init orchestration with independent secret and identity

process restart with no pending migration:
does not rerun destructive baseline or rotate epoch
```

失败码：

```text
MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID
MCFT_MIGRATION_CREDENTIAL_SEPARATION_INVALID
MCFT_RUNTIME_ROLE_PRIVILEGE_INVALID
MCFT_REQUIRED_MIGRATION_PENDING
MCFT_MIGRATION_LEDGER_CHECKSUM_MISMATCH
MCFT_STARTUP_VISIBILITY_PREFLIGHT_FAILED
```

## 12.3 Why raw facts.xmin is not authority

禁止使用：

```sql
facts.xmin::text::xid8
```

作为长期 authoritative visibility identity，原因：

```text
xmin 是 32-bit xid，而 pg_snapshot 使用 full xid8
xid 会 wrap，text cast 不提供冻结的 epoch reconstruction
subtransaction insert 的 tuple xmin 可能是 subxid
pg_visible_in_snapshot 不保证 subxid 判定正确
table rewrite / physical maintenance 不得改变 semantic visibility authority
```

`pg_current_xact_id()` 返回 top-level full xid8；因此 visibility index 必须在建立可见性锚点的事务内保存该值，而不是从 tuple system column 事后推断。

## 12.4 FieldTwinCanonicalVisibilitySnapshotV1

第一页在同一 REPEATABLE READ READ ONLY transaction 中获取 active snapshot：

```sql
SELECT pg_current_snapshot()::text;
```

冻结：

```text
FieldTwinCanonicalVisibilitySnapshotV1
  snapshot_schema_version
  database_visibility_epoch_id
  pg_snapshot_token
  snapshot_xmin: Xid8TextV1
  snapshot_xmax: Xid8TextV1
  snapshot_xip_hash
  visibility_snapshot_hash

derived validation sequence:
  snapshot_xip_values_for_hash: Xid8TextV1[]
  serialization = DERIVED_ONLY_NOT_WIRE
```

派生与验证：

```text
snapshot_xmin =
canonical Xid8TextV1(pg_snapshot_xmin(pg_snapshot_token))

snapshot_xmax =
canonical Xid8TextV1(pg_snapshot_xmax(pg_snapshot_token))

snapshot_xip_values_for_hash =
pg_snapshot_xip(pg_snapshot_token)
→ xid8 numeric ascending
→ canonical Xid8TextV1[]

snapshot_xip_hash =
semanticHashV1(snapshot_xip_values_for_hash)

visibility_snapshot_hash = semanticHashV1(
  omitSemanticFieldsV1(snapshot, [
    "visibility_snapshot_hash"
  ])
)
```

Visibility Snapshot 只表达数据库可见性边界。Scope、filter、read-model/source-profile version、fixed root 和 cursor lifetime 由 `FieldTwinCursorPayloadV1` 单独绑定，避免重复 authority fields。

## 12.5 Visibility predicate

第一页和后续页对 canonical facts 使用同一 predicate：

```sql
JOIN twin_fact_visibility_index_v1 fv
  ON fv.fact_id = facts.fact_id
WHERE fv.visibility_epoch_id = $1
  AND pg_visible_in_snapshot(
    fv.visibility_anchor_xid8,
    $2::pg_snapshot
  )
```

该 predicate 排除：

```text
在第一页 snapshot 之后启动并提交的 transaction
第一页 snapshot 时仍 in-progress、之后才提交的 transaction
页面之间新增的 canonical facts
```

`pg_visible_in_snapshot` 只消费 top-level xid8。正常 fact trigger 使用 `pg_current_xact_id()` 建立 `FACT_INSERT_TRANSACTION` anchor；baseline/rotation maintenance 使用各自 top-level `pg_current_xact_id()` 建立对应 kind 的 visibility anchor。即使 canonical writer 使用 SAVEPOINT，也不依赖 tuple subxid。

## 12.6 First-page selection

首屏在一个 REPEATABLE READ READ ONLY 事务中完成：

```text
1. 获取 pg_current_snapshot token；
2. 读取并绑定 exactly one ACTIVE database_visibility_epoch_id；
3. exact 解析 current mandatory root；
4. 计算 fixed_root_ref 和 fixed_root_graph_content_hash；
5. 用 visibility predicate 生成 timeline page；
6. 生成 signed Cursor Envelope。
```

`fixed_root_ref` 必须是 exact terminal root identity，例如 terminal Tick / checkpoint-bound root identity；不得用 field-level latest timestamp 代替。

## 12.7 Cursor continuation

下一页是新的 REPEATABLE READ READ ONLY transaction。它必须：

```text
1. 验证 Cursor HMAC、expiry 和 signing key；
2. 验证 scope/filter/read-model/source-profile；
3. 验证 database_visibility_epoch_id；
4. 解析并验证 pg_snapshot token/xmin/xmax/xip hash；
5. 复用 fixed_root_ref 和 fixed_root_graph_content_hash；
6. 只读取 pg_visible_in_snapshot = true 且 epoch exact 的 canonical facts；
7. projection 只做 canonical validation，不重新选择 current root；
8. 从 last_sort_tuple 继续 keyset pagination。
```

两个请求之间发生的：

```text
new canonical fact append
pointer latest switch
projection rebuild/update
new operational health append
```

不得进入旧 cursor 的后续页面，也不得改变 fixed root。

本机制声明的是：

```text
SIGNED_HISTORICAL_VISIBILITY_PREDICATE_CONTINUATION
```

不是：

```text
RESTORED_POSTGRESQL_MVCC_SNAPSHOT
IMPORTED_POSTGRESQL_SNAPSHOT
LONG_LIVED_PAGINATION_TRANSACTION
```

## 12.8 Cursor lifetime and visibility epoch rotation

Cursor lifetime 冻结为：

```text
default TTL = 900 seconds
maximum configurable TTL = 3600 seconds
issued_at and expires_at are HMAC-protected Cursor Payload fields
expired cursor fails closed
```

以下事件必须在 maintenance transaction 中轮换 `database_visibility_epoch_id` 并重建 visibility index baseline：

```text
database logical restore
independent cluster clone
visibility-index loss or repair
physical metadata contract version change
unsupported cluster migration
```

轮换要求：

```text
maintenance lock excludes facts inserts
create new STAGING epoch
insert one new visibility row per existing fact under new epoch
visibility_anchor_xid8 = rotation transaction top-level pg_current_xact_id()
visibility_anchor_kind = EPOCH_ROTATION_TRANSACTION
verify new-epoch fact-count equality and fact-id-set hash
atomically RETIRE old ACTIVE epoch and ACTIVATE new epoch
trigger resolves only the new ACTIVE epoch before writes resume
old cursor fails MCFT_CURSOR_VISIBILITY_EPOCH_MISMATCH
canonical facts and semantic hashes remain unchanged
old epoch/index rows are not overwritten
```

Epoch row-retention model：

```text
ACTIVE epoch:
  epoch row and all index rows retained

RETIRED epoch:
  epoch authority row retained for repository/database lifetime
  index rows retained for at least EPOCH_INDEX_RETENTION_MIN_DAYS = 30
  retention_not_before = retired_at + 30 days
  retention period is audit/recovery retention, not old-cursor compatibility

authorized purge:
  migration credential only
  retired epoch only
  never ACTIVE/STAGING
  only after retention_not_before
  must emit purge artifact with epoch ID, pre/post row counts,
  fact-id-set hash, semantic artifact digest and transport digest
  purge deletes only retired epoch index rows
  epoch authority row and artifact digests remain

old cursor:
  invalid immediately after epoch rotation
  retention of old rows does not re-authorize old cursor
```

Rotation/purge failure codes：

```text
MCFT_VISIBILITY_EPOCH_ROTATION_BASELINE_MISMATCH
MCFT_VISIBILITY_EPOCH_RETENTION_NOT_SATISFIED
MCFT_ACTIVE_EPOCH_PURGE_FORBIDDEN
MCFT_VISIBILITY_EPOCH_PURGE_ARTIFACT_INVALID
```

普通 process restart、projection rebuild 和 server deployment 不轮换 visibility epoch。

读副本/standby 上的 visibility predicate 不在 v1 authority 范围内；v1 cursor pagination 必须在同一 primary database visibility epoch 上执行。

---

# 13. Hash 契约

必须复用：

```text
canonicalJsonV1
semanticHashV1
omitSemanticFieldsV1
```

固定点 decimal 保持 string。

`omitSemanticFieldsV1` 不提供隐式排除。每个 hash builder 必须传入冻结的 exact exclusion list。

## 13.1 Content-hash family

```text
root_graph_content_hash
attachment_content_hash
health_content_hash
timeline_items_content_hash
timeline_page_content_hash
collection_items_content_hash
collection_page_content_hash
trace_graph_content_hash
```

Content hashes 用于：

```text
deterministic identity
restart equivalence
projection rebuild equivalence
insertion-order independence
```

Content hashes 一律不得包含：

```text
response_started_at
request_id
transaction metadata
server metadata
CursorWireTextV1 base64url string
server-internal cursor auth tag
自身 hash 字段
其他 derived hash 字段
response_instance_hash
```

### root_graph_content_hash

只覆盖 mandatory current Runtime root：

```text
read model/schema version
six-dimensional scope
root status
mandatory object IDs/hashes
record-set identity summary
terminal_record_set_health identity/hash
current_tick_forecast_result identity/hash/status
active-lineage authority summary
validation profile version
```

明确不包含：

```text
latest_successful_forecast
scenario_source_forecast
latest_scenario_in_scope
optional collection item payloads
latest_operational_runtime_health
```

因此后续 Scenario、Residual、Calibration 或 operational-health append 不改变 mandatory root content identity。

### attachment_content_hash

覆盖 Runtime endpoint 返回的非 mandatory-root context：

```text
latest_successful_forecast
scenario_source_forecast
current_scenario_attachment
latest_scenario_in_scope
optional domain statuses
reason codes
optional collection summary status/has_items/count_status/optional exact count/latest identities only
```

不包含 `latest_operational_runtime_health`；Health endpoint 使用独立 hash。

### health_content_hash

仅供 `/runtime/health`：

```text
terminal_record_set_health identity/hash/role
latest_operational_runtime_health identity/hash/role
health_relationship
health role-resolution evidence summary
health pointer validation summary
```

### timeline_items_content_hash

覆盖本页 exact ordered canonical Timeline events：

```text
event semantic payloads
logical_time,event_rank,object_ref exact order
event taxonomy/order contract version
```

明确排除：

```text
canonical visibility snapshot
fixed root
scope/filter
limit
request/next cursor boundary
response metadata
all derived hashes
```

### timeline_page_content_hash

覆盖：

```text
read model version
scope
filter hash
canonical visibility snapshot hash
fixed root ref/hash
sort direction
page limit
request cursor boundary
timeline_items_content_hash
first/last sort tuple
has_more
ordering version
```

只有上述全部输入相同时才要求相等。不得包含 `response_started_at`、encoded next cursor 或 cursor auth tag，不得扫描完整无限历史。

### collection_items_content_hash

覆盖当前 collection page 的 exact ordered canonical items：

```text
collection_kind
item semantic identities/hashes
logical_time DESC, object_ref ASC order
collection contract version
```

### collection_page_content_hash

覆盖：

```text
collection_items_content_hash
collection_kind
scope/filter hash
canonical visibility snapshot hash
fixed root ref/hash
page limit
request cursor boundary
first/last sort tuple
has_more
sort contract ID
```

不得扫描完整 collection 历史。

### trace_graph_content_hash

覆盖当前返回的 exact nodes、edges、diagnostics、record-set validation、Health role resolution 和 active-lineage authority validation。

## 13.2 Response instance hash

`response_instance_hash` 用于绑定一次具体 response instance，覆盖：

```text
endpoint ID/version
scope
response_started_at
request filter hash
request cursor boundary
canonical visibility snapshot hash when applicable
endpoint content hashes
next_cursor_envelope_digest when present
```

其中：

```text
next_cursor_envelope_digest =
semanticHashV1(decoded FieldTwinCursorEnvelopeV1 semantic object)
```

Digest 输入是 decoded envelope semantic object，不是 base64url encoded string。`response_instance_hash` 不作为 restart/rebuild content-equivalence 断言。

## 13.3 Frozen exclusion sets

每个 builder 必须冻结：

```text
included_semantic_paths
excluded_semantic_paths
stable_sort_contract
null_contract
self_hash_exclusion
derived_hash_exclusion
```

全局 exclusions 至少包括：

```text
fact_id
generated_at
rebuilt_at
persisted_at
DB physical row order
request_id
server instance id
transaction id
latency
response_started_at for content hashes
root_graph_content_hash
attachment_content_hash
health_content_hash
timeline_page_content_hash
trace_graph_content_hash
response_instance_hash
cursor_auth_tag
visibility_snapshot_hash when hashing the visibility snapshot itself
snapshot_xip_hash when hashing the sorted xip set
```

## 13.4 Stable sort

```text
Timeline: logical_time,event_rank,object_ref
Trace nodes: object_type,object_ref
Trace edges: edge_kind,from_ref,to_ref
limitations: reason_code,object_ref
evidence refs: ref type,ref value
collection items: logical_time DESC,object_ref ASC
object_type: included in item semantic identity/hash only; not a collection sort key
snapshot xip values: xid8 numeric ASC
```

# 14. Cursor 契约

## 14.1 FieldTwinCursorPayloadV1

```text
cursor_schema_version
cursor_kind = TIMELINE | OPTIONAL_COLLECTION
collection_kind nullable and required only for OPTIONAL_COLLECTION
sort_contract_id
read_model_version
source_profile_version
scope_hash
filter_hash
canonical_visibility_snapshot: FieldTwinCanonicalVisibilitySnapshotV1
fixed_root_ref
fixed_root_graph_content_hash
sort_direction
last_sort_tuple (tagged by cursor_kind)
issued_at
expires_at
```

`last_sort_tuple` 必须与 `cursor_kind` 和 `sort_contract_id` 精确匹配：

```text
TIMELINE:
  logical_time
  event_rank
  object_ref

OPTIONAL_COLLECTION:
  logical_time
  object_ref
```

Payload 不包含 checksum、self hash 或 authentication tag 字段，因此不存在递归自引用。

## 14.2 FieldTwinCursorEnvelopeV1

```text
payload
cursor_auth_scheme = HMAC_SHA256_V1
cursor_signing_key_id
cursor_auth_tag
```

认证与编码顺序固定：

```text
payload_bytes = canonicalJsonV1(FieldTwinCursorPayloadV1)
auth_input = canonicalJsonV1({
  cursor_auth_scheme,
  cursor_signing_key_id,
  payload
})
cursor_auth_tag = HMAC_SHA256(server_key[cursor_signing_key_id], auth_input)
envelope = {
  payload,
  cursor_auth_scheme,
  cursor_signing_key_id,
  cursor_auth_tag
}
encoded_cursor = base64url(canonicalJsonV1(envelope))
next_cursor_envelope_digest = semanticHashV1(envelope)
```

验证要求：

```text
base64url decode exact
canonical envelope shape exact
known signing key ID
constant-time HMAC comparison
issued_at/expires_at exact and not expired
scope hash exact
filter hash exact
read-model/source-profile version exact
visibility snapshot token/components/hash exact
database visibility epoch exact
fixed root ref/hash exact
last sort tuple valid
```

Cursor key contract：

```text
signing key is server-side only
signing key must be stable across restart for its key ID
key material is never returned or logged
rotation may retain explicitly authorized previous key IDs for bounded compatibility
checksum-only cursor is forbidden for authoritative pagination
```

错误：

```text
400 MCFT_CURSOR_INVALID
400 MCFT_CURSOR_AUTH_INVALID
400 MCFT_CURSOR_EXPIRED
400 MCFT_CURSOR_SCOPE_MISMATCH
400 MCFT_CURSOR_FILTER_MISMATCH
400 MCFT_CURSOR_VISIBILITY_SNAPSHOT_INVALID
400 MCFT_CURSOR_FIXED_ROOT_MISMATCH
409 MCFT_CURSOR_VERSION_CONFLICT
409 MCFT_CURSOR_VISIBILITY_EPOCH_MISMATCH
503 MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE
503 MCFT_VISIBILITY_METADATA_SERVICE_UNAVAILABLE
400 MCFT_CURSOR_WIRE_INVALID
400 MCFT_COLLECTION_LIMIT_INVALID
400 MCFT_COLLECTION_KIND_INVALID
```

## 14.3 CursorWireTextV1 — HTTP wire contract

`FieldTwinCursorPayloadV1` 与 `FieldTwinCursorEnvelopeV1` 是 server-internal semantic types，不得作为 JSON object 直接暴露给客户端。

HTTP wire type 固定为：

```text
CursorWireTextV1:
  type = string
  encoding = base64url without "=" padding
  alphabet = A-Z a-z 0-9 _ -
  whitespace forbidden
  standard base64 "+" and "/" forbidden
  JSON object/array cursor forbidden
  maximum length = 65535 characters
```

Wire mapping：

```text
response.next_cursor:
CursorWireTextV1 | null

request query cursor:
CursorWireTextV1

decode:
CursorWireTextV1
→ base64url decode
→ canonical JSON parse
→ FieldTwinCursorEnvelopeV1 validation
→ HMAC verification
```

禁止：

```text
next_cursor: { payload, cursor_auth_tag, ... }
cursor query containing raw JSON
base64 padding normalization
accepting multiple textual encodings for the same envelope
```

OpenAPI 必须将 cursor 声明为 `type: string`，而不是 object schema。Wire size 超限返回：

```text
400 MCFT_CURSOR_WIRE_INVALID
```

## 14.4 FieldTwinTimelineFilterV1 and filter_hash

Timeline first-page request 使用唯一冻结 filter contract：

```text
FieldTwinTimelineFilterV1:
  filter_schema_version = field_twin_timeline_filter_v1
  from_logical_time: CanonicalUtcInstantV1 | null
  until_logical_time: CanonicalUtcInstantV1 | null
```

Canonicalization：

```text
query parameter absent:
  canonical value = null

timestamp:
  RFC3339 UTC canonical string
  parsed instant must round-trip to one canonical UTC representation

range:
  from_logical_time is inclusive
  until_logical_time is exclusive
  when both non-null:
    from_logical_time < until_logical_time
```

Invalid timestamp、non-canonical timestamp 或 invalid range：

```text
400 MCFT_TIMELINE_FILTER_INVALID
```

Hash：

```text
filter_hash =
semanticHashV1({
  filter_schema_version,
  from_logical_time,
  until_logical_time
})
```

Cursor continuation：

```text
cursor payload is filter authority

continuation request:
  may omit from/until entirely
  or provide values exactly equivalent after canonicalization

query filter differs from cursor filter:
  400 MCFT_CURSOR_FILTER_MISMATCH
```

不得用 cursor continuation 重新解释、扩大或缩小第一页 filter。

Optional collection endpoints v1 不支持额外业务 filter。其固定 filter 为：

```text
FieldTwinEmptyCollectionFilterV1:
  filter_schema_version = field_twin_empty_collection_filter_v1
  filter_kind = NONE

filter_hash =
semanticHashV1(FieldTwinEmptyCollectionFilterV1)
```

`collection_kind`、scope、source profile 和 version 仍分别进入 cursor/page hash，不通过未定义 filter 字段隐式编码。

# 15. Runtime Read Models

## 15.1 MinimalFieldTwinRuntimeReadModelV1

```text
schema_version
root_graph_content_hash
attachment_content_hash
response_instance_hash
request_scope
source_profile_id
response_started_at
root_graph_status
active_lineage
active_lineage_authority_validation
checkpoint
runtime_tick
evidence_window
state_transition
assimilation_update
posterior_state
terminal_record_set_health
runtime_config
record_set_validation
current_tick_forecast_result
latest_successful_forecast
scenario_source_forecast
current_scenario_attachment
latest_scenario_in_scope
current_human_decision
current_approved_plan
action_feedback_summary
forecast_residual_summary
calibration_candidate_summary
shadow_evaluation_summary
model_activation_summary
limitations
validation_summary
```

`MinimalFieldTwinRuntimeReadModelV1` 不用 health latest pointer 替代 `terminal_record_set_health`。

`latest_successful_forecast` 与 `scenario_source_forecast` 进入 `attachment_content_hash`，不进入 `root_graph_content_hash`。

## 15.1.1 Optional collection summary and bounded page contracts

`/runtime` 禁止嵌入 unbounded optional/history arrays。每类 collection 只返回：

```text
FieldTwinOptionalCollectionSummaryV1
  collection_kind
  attachment_status
  reason_code nullable
  has_items
  count_status = NOT_COMPUTED | EXACT_VALIDATED_PROJECTION
  total_count nullable
  latest_item_ref nullable
  latest_item_hash nullable
  collection_endpoint
```

`/runtime` summary 禁止为了得到 count 扫描完整 canonical history。`total_count` 默认 `null / NOT_COMPUTED`；只有 Source Validation Matrix 冻结了可 exact canonical-validate 的 count projection 时，才允许 `EXACT_VALIDATED_PROJECTION`。

所有可能返回多对象的 endpoint 必须使用：

```text
FieldTwinCollectionPageV1<T>
  collection_kind
  canonical_visibility_snapshot
  fixed_root_ref
  fixed_root_graph_content_hash
  items: T[]
  page_limit
  has_more
  next_cursor: CursorWireTextV1 | null
  collection_items_content_hash
  collection_page_content_hash
  response_started_at
  response_instance_hash
```

冻结分页范围：

```text
/states
/forecasts
/scenarios
/residuals
/action-lifecycle  (Action Feedback page)
/model-governance (one selected collection per request)
```

完整 collection kind inventory 固定为：

```text
FieldTwinCollectionKindV1 =
STATE
| FORECAST
| SCENARIO
| ACTION_FEEDBACK
| FORECAST_RESIDUAL
| CALIBRATION_CANDIDATE
| SHADOW_EVALUATION
| MODEL_ACTIVATION
```

Endpoint mapping：

```text
/states            → STATE
/forecasts         → FORECAST
/scenarios         → SCENARIO
/action-lifecycle  → ACTION_FEEDBACK
/residuals         → FORECAST_RESIDUAL
/model-governance?collection_kind=CALIBRATION_CANDIDATE
/model-governance?collection_kind=SHADOW_EVALUATION
/model-governance?collection_kind=MODEL_ACTIVATION
```

`/model-governance` 每次请求必须明确选择一个 governance collection kind。不得在同一 response 中返回三个无界集合或三个独立 next cursor。

Unknown endpoint/kind mapping 或 cursor kind mismatch：

```text
400 MCFT_COLLECTION_KIND_INVALID
400 MCFT_CURSOR_COLLECTION_KIND_MISMATCH
```

Collection limit：

```text
default = 50
minimum = 1
maximum = 200
limit above maximum → 400 MCFT_COLLECTION_LIMIT_INVALID
```

Collection stable order：

```text
logical_time DESC
object_ref ASC
```

Collection cursor payload 是 `FieldTwinCursorPayloadV1` 的 tagged variant：

```text
cursor_kind = OPTIONAL_COLLECTION
collection_kind
sort_contract_id = LOGICAL_TIME_DESC_OBJECT_REF_ASC_V1
last_sort_tuple:
  logical_time
  object_ref
```

Timeline cursor variant：

```text
cursor_kind = TIMELINE
sort_contract_id = LOGICAL_TIME_EVENT_RANK_OBJECT_REF_ASC_V1
last_sort_tuple:
  logical_time
  event_rank
  object_ref
```

Collection continuation 与 Timeline 相同，必须绑定：

```text
scope hash
filter hash
visibility snapshot
database visibility epoch
fixed root ref/hash
read-model/source-profile version
issued_at/expires_at
```

禁止 offset pagination、unbounded `SELECT *`、full-history array materialization 或 timestamp-only cursor。

## 15.2 Endpoint-specific models

```text
FieldTwinTimelinePageV1
  - canonical_visibility_snapshot
  - fixed_root_ref
  - fixed_root_graph_content_hash
  - timeline_items_content_hash
  - timeline_page_content_hash
  - next_cursor: CursorWireTextV1 | null
  - response_started_at
  - response_instance_hash

FieldTwinTraceGraphV1
  - trace_graph_content_hash
  - response_started_at
  - response_instance_hash

FieldTwinStatesReadModelV1
FieldTwinForecastsReadModelV1
FieldTwinScenariosReadModelV1
FieldTwinResidualCollectionV1
FieldTwinActionLifecycleReadModelV1
FieldTwinModelGovernanceReadModelV1

FieldTwinHealthReadModelV1
  - terminal_record_set_health
  - latest_operational_runtime_health
  - health_relationship
  - health_content_hash
  - response_started_at
  - response_instance_hash
```

## 15.3 Inconsistent root prohibition

409 payload 只允许返回：

```text
error_code
failed_profiles
diagnostics
request_id
```

不得返回 current root payload。

# 16. API 契约

Canonical namespace：

```text
/api/v1/operator/twin/fields/:field_id/runtime
```

Endpoints：

```text
GET /api/v1/operator/twin/fields/:field_id/runtime
GET /api/v1/operator/twin/fields/:field_id/runtime/timeline
GET /api/v1/operator/twin/fields/:field_id/runtime/trace
GET /api/v1/operator/twin/fields/:field_id/runtime/states
GET /api/v1/operator/twin/fields/:field_id/runtime/forecasts
GET /api/v1/operator/twin/fields/:field_id/runtime/scenarios
GET /api/v1/operator/twin/fields/:field_id/runtime/residuals
GET /api/v1/operator/twin/fields/:field_id/runtime/action-lifecycle
GET /api/v1/operator/twin/fields/:field_id/runtime/model-governance
GET /api/v1/operator/twin/fields/:field_id/runtime/health
```

Wire pagination parameters：

```text
Timeline first page:
GET .../timeline
  ?from=<RFC3339-UTC optional>
  &until=<RFC3339-UTC optional>
  &limit=<1..200>

Timeline continuation:
GET .../timeline
  ?cursor=<CursorWireTextV1>
  &limit=<same effective limit or omitted>

Optional collection first page:
GET multi-object endpoint
  ?limit=<1..200>

Optional collection continuation:
GET multi-object endpoint
  ?cursor=<CursorWireTextV1>
  &limit=<same effective limit or omitted>

/model-governance additionally requires:
collection_kind=<CALIBRATION_CANDIDATE|SHADOW_EVALUATION|MODEL_ACTIVATION>
```

Continuation authority：

```text
timeline cursor carries exact FieldTwinTimelineFilterV1/filter_hash
collection cursor carries exact fixed empty-filter hash and collection_kind
query filters/kind must be omitted or exactly equivalent to cursor authority
limit conflict → 400 MCFT_CURSOR_LIMIT_MISMATCH
filter conflict → 400 MCFT_CURSOR_FILTER_MISMATCH
collection kind conflict → 400 MCFT_CURSOR_COLLECTION_KIND_MISMATCH
```

Response pagination：

```text
next_cursor:
CursorWireTextV1 | null

server-internal FieldTwinCursorEnvelopeV1:
never serialized as a JSON object field
```

所有 endpoints 消费同一：

```text
snapshot repository
canonical resolver
source validation matrix
read-model composer family
```

HTTP：

```text
200 valid complete/current/optional/paginated result
400 scope/filter/cursor/time-travel invalid
403 authenticated scope conflict
404 Runtime graph not established
409 graph/reference/version/ambiguity/visibility-epoch inconsistent
503 cursor signing key or visibility metadata dependency unavailable
```

GET-only route module 禁止：

```text
POST PUT PATCH DELETE
INSERT UPDATE DELETE FROM DDL
write transaction
random persistence identity
facts writer
recommendation builder
approval service
AO-ACT service
dispatch service
model activation service
```

---

# 17. Operator Route 物理拆分

目标结构：

```text
apps/server/src/routes/v1/mcft_field_twin_read_v1.ts
apps/server/src/routes/v1/operator_twin_read_legacy_v1.ts
apps/server/src/routes/v1/operator_twin_write_legacy_v1.ts
```

注册函数：

```text
registerMcftFieldTwinReadRoutesV1
registerOperatorTwinReadLegacyRoutesV1
registerOperatorTwinWriteLegacyRoutesV1
```

硬边界：

```text
canonical read 不 import legacy composer
canonical read 不 import write module
legacy write 不 import canonical read composer
不得共享 Fastify registration function
不得 duplicate method + exact path
```

现有 legacy：

```text
GET /api/v1/operator/twin/fields/:field_id/scenarios
```

继续由 legacy read module 兼容。

新 canonical：

```text
GET /api/v1/operator/twin/fields/:field_id/runtime/scenarios
```

S0 Route Ownership Lock 必须逐 route 冻结：

```text
method
exact_path
current_owner
future_owner
response_contract
replacement_policy
compatibility_policy
duplicate_registration_forbidden
```

---

# 18. Legacy Operator Index 边界

不得作为 MCFT truth：

```text
water_state_estimate_index_v1
soil_moisture_sensing_window_index_v1
weather_forecast_index_v1
irrigation_scenario_set_index_v1
decision_recommendation_index_v1
root_zone_irrigation_scenario_set_index_v1
```

`field_index_v1` 仅用于：

```text
display name
metadata label
breadcrumb
```

不得用于 Runtime graph selection。

---

# 19. Calibration 和 Model Governance

Semantic collections（wire exposure 必须使用 bounded page）：

```text
Calibration Candidate collection
Shadow Evaluation collection
Model Activation collection
```

Candidate 必须显示：

```text
activation_status = NOT_ACTIVE
eligible_for_state_input = false
eligible_for_runtime_config_use = false
```

Shadow Evaluation 不得推导 activation。

Model Activation 只有在 exact object 明确连接：

```text
candidate/evaluation
→ activated Runtime Config
→ active lineage/revision
```

时才可 attached。

Profile A Runtime DB 与 Profile B Calibration DB 不得跨库拼图。

---

# 20. Pre-S0 Repository Foundation

## 20.1 P-1A

```text
CAP-06 external exact-SHA attestation:
SATISFIED

workflow_run_id:
29679453784

artifact_id:
8440066081

subject_commit:
ea8caa10e6369ec5018d7c7b6630e2330d1ca085
```

## 20.2 P-1B

```text
P-1B:
MCFT Candidate Detector and CAP-07 Registry Bootstrap

PR:
#2600

candidate_head:
b01f8b0df51fcd82992a32a487b1884340e5c914

merge_commit:
dadb3dc7bca1f484d49a727fa0754bbaf4bee086

exact_tree_delta:
0 files

status:
MERGED_EFFECTIVE
```

P-1B 建立：

```text
explicit delivery signal contract
business Candidate term separation
unregistered explicit delivery signal fail closed
trusted default-branch registry
CAP-07 S0 minimal status registration
CAP-07 implementation remains unauthorized
```

P-1B 不再需要修改。新 detector 的 live trusted negative/corrected exercise 纳入 S0 operational acceptance，而不是新增 P-1C。

## 20.3 Current state before S0

```text
status:
READY_FOR_S0_AUTHORIZATION_PR

active_delivery_slice_id:
null

implementation_authorized:
false

read_runtime_implementation_authorized:
false

S0_candidate_pr_authorized:
true

canonical_write_authorized:
false

runtime_source_authorized:
false

mcft_cap_08_authorized:
false
```

Frozen Taskbook authority boundary：

```text
status:
READY_FOR_S0_AUTHORIZATION_PR

active_delivery_slice_id:
null

S0_candidate_pr_authorized:
true

read_runtime_implementation_authorized:
false
```

不得直接写 `AUTHORIZED_NOT_STARTED` 或 `IN_PROGRESS`。

---

# 21. Delivery Slice Graph

```text
S0 Authorization, predecessor evidence, source matrix and route lock
S1 Contracts, validation registry, content hashes, response hash, ordering and cursor
S2 Read-only snapshot repository and exact resolvers
S3 Runtime, Timeline, Trace, action, health and governance composers
S4 GET-only API, OpenAPI and route physical split
S5 Operator Field Runtime canonical integration
S6 Integrated readback, restart, rebuild and external closure candidate
```

每个 Slice：

```text
one implementation PR
bounded output
explicit consumer
successor probe
changed-file boundary
registered candidate declaration
focused acceptance
standard CI
protected merge
read-only exact-merge-SHA attestation
effective delivery frontier projection
```

## 21.1 Candidate authority graph

S0 已由 P-1B 在 main 上预注册：

```text
status_file:
GEOX-MCFT-CAP-07-CURRENT-AUTHORITY-V1.json

candidate_field:
status

candidate_value:
AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE

focused_workflow:
mcft-cap-07-s0-authorization
```

S1—S6 使用独立 boolean transition：

```text
S1  GEOX-MCFT-CAP-07-S1-DELIVERY-STATUS-V1.json  s1_candidate_implemented = true  mcft-cap-07-s1-contracts
S2  GEOX-MCFT-CAP-07-S2-DELIVERY-STATUS-V1.json  s2_candidate_implemented = true  mcft-cap-07-s2-repository
S3  GEOX-MCFT-CAP-07-S3-DELIVERY-STATUS-V1.json  s3_candidate_implemented = true  mcft-cap-07-s3-composers
S4  GEOX-MCFT-CAP-07-S4-DELIVERY-STATUS-V1.json  s4_candidate_implemented = true  mcft-cap-07-s4-api
S5  GEOX-MCFT-CAP-07-S5-DELIVERY-STATUS-V1.json  s5_candidate_implemented = true  mcft-cap-07-s5-operator-integration
S6  GEOX-MCFT-CAP-07-S6-DELIVERY-STATUS-V1.json  s6_candidate_implemented = true  mcft-cap-07-s6-closure
```

标准 workflow 均为：

```text
ci
```

每个 Slice 的 `semantic_snapshot_files` 至少覆盖：

```text
current Slice delivery-status authority
Resolved Manifest / Current Authority affected rows
current Slice canonical deliverables
Hard Acceptance ledger affected rows
successor registry extension and successor status seed when applicable
```

## 21.2 Successor registry bootstrap

```text
P-1B main registers S0
S0 PR creates S1 status seed and registers S1
S1 PR creates S2 status seed and registers S2
S2 PR creates S3 status seed and registers S3
S3 PR creates S4 status seed and registers S4
S4 PR creates S5 status seed and registers S5
S5 PR creates S6 status seed and registers S6
S6 registers no CAP-08 implementation authority
```

Successor seed 初始值：

```text
sN_candidate_implemented = false
implementation_authorized = false
effectiveness_condition = null
```

当前 PR 修改的 registry 只供后继 PR 使用，绝不能授权当前 PR。

## 21.3 Per-Slice committed/effective state

S0 committed candidate：

```text
status = AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE
effective_status_when_attested = IN_PROGRESS
effective_next_slice_when_attested = S1
```

S1—S5 committed candidate：

```text
sN_candidate_implemented = true
delivery_state = IMPLEMENTED_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION
effective_next_slice_when_attested = S(N+1)
```

S6 committed candidate：

```text
s6_candidate_implemented = true
delivery_state = IMPLEMENTED_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION
effective_completion_condition = PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS
effective_completion_state = MCFT_CAP_07_COMPLETE
```

Repository 不通过 postmerge writeback 把这些条件状态改成 effective state。

---

# 22. S0 — Authorization, Source Matrix and Route Lock

## Entry

```text
CAP-06 external attestation PASS
P-1B merged effective
ruleset operational authority established
current main exact SHA locked
v0.2.5 FROZEN
CAP-07 S0 status path registered on main
```

S0 candidate state：

```text
status = AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE
active_delivery_slice_id = null
implementation_authorized = false
effective_status_when_attested = IN_PROGRESS
effective_next_slice_when_attested = S1
```

S0 允许：

```text
TASK.md
RESOLVED-MANIFEST-V1
CURRENT-AUTHORITY-V1
SOURCE-VALIDATION-MATRIX-V1
ROUTE-OWNERSHIP-LOCK-V1
HARD-ACCEPTANCE-LEDGER-V1 skeleton
S1-DELIVERY-STATUS-V1 seed
registry extension for S1 candidate authority
generic per-Slice read-only exact-SHA attestation workflow
MCFT attestation retention uploader/readback helper
S3_COMPAT_OBJECT_LOCK retention contract manifest
S0 focused gate
```

S0 禁止：

```text
Runtime code
migration
route implementation
frontend
projection
canonical writer
```

## S0 materialization obligations

S0 必须把 Taskbook 已冻结的设计物化为机器 authority：

```text
every required source table/fact type mapped to exactly one profile
all obligation rows complete
INITIAL and REVISION active-lineage authority rows complete
terminal and operational Runtime Health rows separate
all route ownership rows complete
all Hard Acceptance IDs materialized
S1 candidate status seed and registry rule complete
MCFT attestation retention store preflight PASS
S0 exact-SHA workflow configured to fail closed when long-term retention upload/readback fails
```

## S0 live trusted operational exercise

必须使用同一 S0 PR 的两个 exact heads：

```text
Negative intermediate head:
- 保持合法已注册 S0 transition
- 加入未注册 exact delivery status probe
- ordinary/focused checks 可通过
- mcft-candidate-integrity-enforce-current-pr 必须 FAIL
- merge 必须被 Ruleset 拒绝

Corrected final head:
- 删除 negative probe
- 保留业务文本 “Calibration Candidate”
- 保留合法已注册 S0 transition
- trusted candidate enforcement PASS
- trusted release-lane enforcement PASS
- all required checks PASS
- negative probe absent from final tree
```

仅 candidate-head selftest 不构成 live trusted proof。

## S0 Exit and effective frontier

S0 committed repository state 保持条件状态。

S0 protected merge 后，read-only exact-SHA artifact 必须产生：

```text
subject_commit = exact S0 merge SHA
candidate_to_merge_tree_delta = 0
required_checks = PASS
S0 authority predicates = PASS
runtime_authority_delta = ZERO
effective_status = IN_PROGRESS
effective_active_delivery_slice_id = S1
artifact digest retained
```

S1 PR 消费该 artifact 后，才可证明 effective frontier 已到 S1。

---

# 23. S1 — Contracts, Validation, Hash, Ordering, Visibility Snapshot and Cursor

Entry：

```text
S0 external exact-SHA artifact PASS
effective frontier = S1
S1 status path/field/value registered on main
```

仅允许 pure domain logic。

Deliverables：

```text
MinimalFieldTwinRuntimeReadModelV1
FieldTwinTimelineEventV1
FieldTwinTraceGraphV1
FieldTwinCanonicalVisibilitySnapshotV1
FieldTwinCursorPayloadV1
FieldTwinCursorEnvelopeV1
CursorWireTextV1
FieldTwinCursorAuthenticationContractV1
CanonicalFactVisibilityMetadataContractV1
FieldTwinSourceValidationResultV1
FieldTwinRootGraphStatusV1
FieldTwinOptionalAttachmentStatusV1
FieldTwinOptionalCollectionSummaryV1
FieldTwinCollectionPageV1
FieldTwinCollectionAttachmentV1
FieldTwinRecordSetValidationV1
FieldTwinRuntimeHealthRoleV1
FieldTwinRuntimeHealthRoleResolutionV1
SourceValidationProfileRegistryV1
SourceValidationObligationMatrixV1
root/attachment/health/timeline-items/timeline-page/collection-items/collection-page/trace content hash builders
response instance hash builder
```

S1 必须：

```text
flip s1_candidate_implemented false → true
consume and validate S0 artifact
create S2 delivery-status seed
register S2 candidate authority for future PR
freeze exact hash inclusion/exclusion sets
freeze PostgreSQL visibility-snapshot predicate and epoch contract
freeze Cursor payload/envelope/HMAC and base64url wire contract
freeze bounded optional/history collection pagination contract
freeze Runtime Health role resolution contract
```

禁止 PostgreSQL、route、migration、frontend。

S2 必须实际消费 S1 contracts。

# 24. S2 — Read-only Per-request Snapshot Repository and Exact Resolvers

Entry：

```text
S1 external exact-SHA artifact PASS
effective frontier = S2
S2 authority registered on main
```

Components：

```text
PostgresFieldTwinSnapshotRepositoryV1
CanonicalFactVisibilityMetadataRepositoryV1
McftCap07MigrationLedgerRepositoryV1
McftCap07StartupMigrationRunnerV1
McftCap07RuntimeStartupPreflightV1
CanonicalVisibilitySnapshotResolverV1
CanonicalTwinFactResolverV1
ReplayEvidenceFactResolverV1
AggregateProjectionValidatorV1
EmbeddedChildProjectionValidatorV1
OperationalPointerValidatorV1
RecordSetIdentityValidatorV1
ActiveLineageAuthorityValidatorV1
EvidenceBindingValidatorV1
DerivedCompositeValidatorV1
RuntimeHealthDualResolverV1
RuntimeHealthRoleResolverV1
```

每个请求：

```text
one connection
one REPEATABLE READ READ ONLY transaction
one response_started_at
one six-dimensional scope
```

Timeline first page 额外冻结：

```text
one FieldTwinCanonicalVisibilitySnapshotV1
one fixed_root_ref
one fixed_root_graph_content_hash
```

Cursor continuation 使用新的 read-only transaction 和旧 signed visibility snapshot；禁止声称恢复旧 MVCC snapshot。

Resolver 只返回 validated result 或 explicit failure。

S2 必须：

```text
flip s2_candidate_implemented false → true
consume and validate S1 artifact
create S3 delivery-status seed
register S3 candidate authority for future PR
prove exact four-record Replay Evidence inventory
prove direct Runtime Attempt inventory and F-family relation
prove visibility metadata migration/trigger/epoch contract
prove migration-owner / migrator / Runtime-role credential separation
prove one-shot startup migration and Runtime readiness preflight
prove retained multi-epoch row model and authorized purge contract
prove Health role resolver failure-closed
```

S2 允许且只允许一个 additive physical-visibility-support migration：

```text
twin_fact_visibility_epoch_v1
twin_fact_visibility_index_v1
geox_schema_migration_ledger_v1
migration owner / migrator / Runtime role grants
facts AFTER INSERT visibility trigger
existing-facts baseline backfill
one-shot startup migration entrypoint
Runtime startup preflight
visibility metadata/epoch/retention acceptance
```

禁止：

```text
修改 facts semantic columns
修改 record_json envelope
修改 object/hash identity
新增 canonical object writer
让 application supplied xid 成为 authority
使用 raw xmin::text::xid8
```

Migration/trigger contract 未建立时必须 fail：

```text
MCFT_CANONICAL_VISIBILITY_METADATA_NOT_ESTABLISHED
```

不得降级为 timestamp、fact_id 或 raw xmin 伪 snapshot cursor。

S3 不得直接查询相关 tables。

# 25. S3 — Read-model Composers

Entry：

```text
S2 external exact-SHA artifact PASS
effective frontier = S3
S3 authority registered on main
```

```text
CurrentRuntimeComposerV1
FieldTwinTimelineComposerV1
FieldTwinTraceGraphComposerV1
ActionLifecycleComposerV1
ModelGovernanceComposerV1
BoundedCollectionPageComposerV1
RuntimeHealthComposerV1
```

必须：

```text
mandatory root + terminal_record_set_health
latest_operational_runtime_health independent view
record-set validation
INITIAL/REVISION active-lineage authority validation
Forecast 三指针
collection cardinality
optional collection summary-only root response
bounded keyset pagination for every multi-object endpoint
optional statuses/reasons
bounded endpoint content hashes
health content hash
response instance hashes
canonical-visibility-snapshot keyset pagination
fixed-root cursor continuation
exact edges only
```

S3 必须：

```text
flip s3_candidate_implemented false → true
consume and validate S2 artifact
create S4 delivery-status seed
register S4 candidate authority for future PR
```

Timeline 与所有 multi-object collection endpoint 默认 limit 50、最大 200，不得硬编码 8/24 Tick，也不得返回无界 optional collection。

---

# 26. S4 — GET-only API and Route Physical Split

Entry：

```text
S3 external exact-SHA artifact PASS
effective frontier = S4
S4 authority registered on main
```

必须：

```text
canonical /runtime namespace
three physical route modules
independent registration
OpenAPI exact schemas
scope validation
historical runtime time-travel rejection
cursor validation
HTTP mapping
static and transitive write-boundary gate
```

Gate 必须证明：

```text
canonical read non-GET method count = 0
write-capable direct import count = 0
write-capable transitive import count = 0
SQL write verb count = 0
facts writer dependency count = 0
recommendation/approval/AO-ACT/activation dependency count = 0
duplicate route count = 0
```

S4 必须：

```text
flip s4_candidate_implemented false → true
consume and validate S3 artifact
create S5 delivery-status seed
register S5 candidate authority for future PR
```

---

# 27. S5 — Operator Canonical Integration

Entry：

```text
S4 external exact-SHA artifact PASS
effective frontier = S5
S5 authority registered on main
```

Canonical tabs：

```text
Overview
State
Forecast
Scenario
Action Lifecycle
Residual Verification
Calibration
Evidence / Trace
Health
```

UI 必须区分全部 root/attachment statuses 和 reason codes。

Forecast 同时显示：

```text
Current Tick Forecast Result
Latest Successful Forecast
Scenario Source Forecast
```

Health 必须同时显示：

```text
Terminal Record-Set Health
Latest Operational Runtime Health
Health Relationship
```

禁止 legacy truth fallback、numeric confidence fabrication、field-only degradation。

S5 必须：

```text
flip s5_candidate_implemented false → true
consume and validate S4 artifact
create S6 delivery-status seed
register S6 candidate authority for future PR
```

---

# 28. S6 — Integrated Readback, Restart, Rebuild and Closure Candidate

## 28.1 Entry and acceptance profiles

Entry：

```text
S5 external exact-SHA artifact PASS
effective frontier = S6
S6 authority registered on main
```

Profile A：

```text
A1 current COMPLETED, 72 points, current Scenario, Decision, Plan, Feedback collection, Residual collection, updated posterior
A2 current BLOCKED, 0 points, older success exists, older Scenario exists, current Scenario unattached
A3 terminal_record_set_health exists and later F-family operational health becomes latest
```

Profile B：

```text
multiple Candidate/Evaluation capable
Candidate remains NOT_ACTIVE
no active config change
no Runtime use
no cross-DB stitching
```

Profile C negative：

```text
missing mandatory ref
hash/scope/lineage mismatch
record-set identity mismatch
child divergence
pointer mismatch
binding mismatch
composite mismatch
Replay Evidence hash mismatch
revision promotion authority mismatch
cursor mismatch
ambiguous season/zone
legacy temptation
duplicate route
historical runtime as_of request
terminal health/latest operational health conflation
```

## 28.2 Restart/rebuild and pagination stability

Content equivalence 必须在相同：

```text
scope
filters
read model version
source profile version
fixed root identity
```

下证明：

```text
root_graph_content_hash equal
attachment_content_hash equal
health_content_hash equal when health endpoint compared
timeline semantic event sequence equal
timeline_page_content_hash equal for same visibility snapshot/page boundary
trace_graph_content_hash equal
DB insertion order irrelevant
```

新的事务可产生不同 `response_started_at` 和不同 `response_instance_hash`；这不构成 content divergence。

Cursor continuation 必须使用：

```text
new PostgreSQL read-only transaction
same signed canonical visibility snapshot
same database_visibility_epoch_id
same fixed_root_ref
same fixed_root_graph_content_hash
same scope/filter/version
next last_sort_tuple
```

不得要求新事务恢复前一事务的 MVCC snapshot。

必须包含并发负向测试：

```text
between page 1 and page 2 append a new canonical fact
between page 1 and page 2 advance a mutable latest pointer
new fact/pointer must not enter old cursor continuation
fixed root must remain unchanged
fresh first-page request may observe the new state
```

以下并发事务必须被旧 cursor 排除：

```text
started after first-page snapshot
started before snapshot but still in progress at snapshot
committed only after page 1
```

Acceptance 必须直接断言 `pg_visible_in_snapshot(visibility_anchor_xid8, pg_snapshot_token) = false`。

Projection truncate/rebuild 只允许：

```text
isolated acceptance database
```

## 28.3 Zero-write observation window

只统计产品 API/read operation window：

```text
canonical fact delta = 0
active lineage delta = 0
checkpoint delta = 0
active config delta = 0
candidate/evaluation/activation delta = 0
AO-ACT/recommendation/approval delta = 0
```

测试 harness rebuild writes 不得混入该窗口。

## 28.4 S6 committed and external state

S6 必须：

```text
flip s6_candidate_implemented false → true
consume and validate S5 artifact
register no CAP-08 implementation authority
```

Committed repository state：

```text
delivery_state = IMPLEMENTED_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION
effective_completion_condition = PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS
effective_completion_state = MCFT_CAP_07_COMPLETE
```

Merge 后由 read-only exact-SHA workflow 生成 external artifact 和 effective completion projection。

---

# 29. Hard Acceptance

每个 item：

```text
item_id
category
assertion
executable_predicate
expected_result
actual_result
status
evidence_refs
workflow_run_id
job_id
artifact_ref
subject_commit
verified_at
evidence_layer
```

`evidence_layer`：

```text
COMMITTED_CANDIDATE
EXTERNAL_EXACT_SHA_ATTESTATION
EFFECTIVE_DELIVERY_FRONTIER_PROJECTION
EFFECTIVE_COMPLETION_PROJECTION
```

任何 Slice premerge 的 external items 必须是：

```text
PENDING_EXTERNAL_ATTESTATION
```

不得伪造 PASS。

最低项目：

## A. Authority and Entry

```text
A001 CAP-06 external exact-SHA attestation PASS
A002 P-1B protected merge effective
A003 delivery signal contract exact-enum only
A004 business Calibration Candidate is not delivery signal
A005 unregistered exact delivery status fails closed
A006 trusted default-branch registry enforced
A007 PR self-modified registry not trusted
A008 ruleset active and strict
A009 current main SHA locked
A010 S0 creates no Runtime authority
A011 S0 negative intermediate head trusted check FAIL
A012 S0 negative merge blocked by Ruleset
A013 corrected S0 head trusted checks PASS
A014 negative probe absent from final tree
A015 domain Calibration Candidate text passes live trusted check
A016 S1—S6 independent status paths/fields/values frozen
A017 predecessor Slice artifact required for successor entry
A018 successor registry bootstrap cannot self-authorize current PR
A019 S0 attestation long-term retention store preflight PASS
A020 S0 exact-SHA artifact upload/readback failure prevents external effectiveness
```

## B. Validation Profiles

```text
B001 aggregate valid
B002 aggregate divergence rejected
B003 Forecast child via parent
B004 Forecast child divergence rejected
B005 Scenario child via parent
B006 Scenario child divergence rejected
B007 Shadow case via parent
B008 pointer profiles exact
B009 record-set identity valid
B010 record-set member mismatch rejected
B011 aggregate record-set hash mismatch rejected
B012 approved plan binding exact
B013 candidate/evaluation binding exact
B014 feedback composite rebuild exact
B015 composite mismatch rejected
B016 direct Tick fact
B017 direct Evidence Window fact
B018 direct State Transition fact
B019 direct Assimilation fact
B020 direct Runtime Health fact
B021 direct Revision Run fact
B022 direct Lineage Promotion fact
B023 INITIAL active-lineage authority exact
B024 REVISION active-lineage promotion chain exact
B025 revision status timestamp-latest inference forbidden
B026 approval_assertion_evidence_v1 valid
B027 approved_irrigation_plan_snapshot_v1 valid
B028 external_dispatch_evidence_v1 valid
B029 irrigation_execution_receipt_evidence_v1 valid
B030 Replay Evidence hash mismatch rejected
B031 AS_EXECUTED/ACCEPTANCE/TASK remain optional reference kinds
B032 S0 cannot add unversioned Replay Evidence record type
B033 direct Runtime Attempt fact
B034 F-family Health → Attempt → optional Forecast Failure exact relation
```

## C. Scope, Per-request Snapshot, Visibility Predicate and Time

```text
C001 six-dimensional scope
C002 missing season rejected
C003 missing zone rejected
C004 auth conflict rejected
C005 ambiguous scope rejected
C006 one read-only transaction per HTTP request
C007 REPEATABLE READ per request
C008 write SQL rejected in product read path
C009 cross-DB stitching rejected
C010 same request response_started_at consistent
C011 response_started_at is not MVCC snapshot identity
C012 cross-request MVCC restoration/import claim forbidden
C013 /runtime historical as_of rejected
C014 timeline from/until filter does not rebuild or reselect historical pointer
C014a Timeline filter from is inclusive and until is exclusive
C014b absent from/until canonicalize to null
C014c invalid/non-canonical range rejected
C014d continuation filter omission or exact equivalence accepted
C014e cursor/query filter conflict rejected with MCFT_CURSOR_FILTER_MISMATCH
C015 first-page pg_current_snapshot token exact
C016 snapshot xmin/xmax/xip hash exact
C017 visibility epoch exact
C018 visibility_anchor_xid8 comes from exact top-level pg_current_xact_id
C019 raw facts.xmin::text::xid8 authority forbidden
C020 future transaction excluded from old cursor
C021 early-start/late-commit transaction excluded from old cursor
C022 mutable pointer advancement does not reselect fixed root
C023 visibility metadata missing/duplicate fails closed
C024 visibility epoch rotation invalidates old cursor
C025 cursor expiry exact
C026 content hashes exclude response_started_at
C027 response instance hash binds response_started_at
C028 existing facts use INITIAL_BASELINE_TRANSACTION anchor
C029 facts insert and visibility-index insert same transaction
C030 primary database visibility epoch required
C031 epoch rotation uses EPOCH_ROTATION_TRANSACTION anchor
C032 application cannot directly insert visibility metadata
C033 application cannot update/delete/truncate visibility metadata
C034 SECURITY DEFINER trigger writes metadata without direct application metadata DML
C035 zero or multiple ACTIVE epochs rejected
C036 trigger disablement / replica-role bypass / unsafe search_path rejected
C037 external bootstrap authority provisions exact owner/migrator/Runtime roles
C038 migration owner and Runtime role are distinct
C039 migration and Runtime credentials are distinct and non-fallback
C040 one-shot migration completes before Runtime readiness
C041 Runtime startup with pending migration rejected
C042 Runtime role cannot SET ROLE migration owner
C043 visibility index uses composite (epoch_id,fact_id) identity
C044 rotation retains old epoch rows without overwrite
C045 retired index purge before retention_not_before rejected
C046 retired purge emits valid epoch artifact and preserves epoch authority row
```

## D. Mandatory Root and Health

```text
D001 active lineage exact
D002 checkpoint exact
D003 terminal Tick exact
D004 Evidence Window exact
D005 State Transition exact
D006 Assimilation exact
D007 posterior exact
D008 current Forecast exact
D009 terminal_record_set_health exact member
D010 Runtime Config exact
D011 record-set identity exact
D012 unresolved mandatory ref → 409
D013 hash/scope/lineage/record-set mismatch → 409
D014 no current payload on 409
D015 no active Runtime → 404
D016 later F-family health does not invalidate terminal root
D017 latest operational health pointer exact
D018 health relationship exact
D019 operational-only health does not fabricate terminal graph
D020 A-family Health classified only by exact record-set membership
D021 F-family Health classified only by exact attempt/failure relation
D022 non-member alone is insufficient for F-family classification
D023 unresolved Health role fails MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED
```

## E. Forecast and Scenario

```text
E001 COMPLETED = 72
E002 BLOCKED = 0
E003 old success never replaces current BLOCKED
E004 latest success independent
E005 stale flag exact
E006 Scenario source exact
E007 old Scenario not current-attached
E008 current/latest/source pointer consistency
E009 blocked current uses NOT_ATTACHED + CURRENT_FORECAST_BLOCKED
E010 latest Scenario in scope separated from current attachment
```

## F. Timeline and Trace

```text
F001 all event kinds
F002 event_rank present
F003 no generic replacement
F004 terminal A-family health shares record_set_id
F005 F-family health atomic_group_ref null
F006 Health transaction_family exact
F007 Health health_role exact
F008 Health resolution basis/evidence exact
F009 unresolved Health classification rejected
F010 observed_at preserved
F011 available_to_runtime_at preserved
F012 deterministic events/nodes/edges
F013 no scope/time/latest inferred edge
F014 no false Residual-to-Assimilation edge
F015 pagination beyond 24 Tick
F016 record-set support not represented as canonical node
```

## G. Optional Collections

```text
G001 absent optional domain
G002 same-scope unlinked object → NOT_ATTACHED
G003 broken exact ref → 409
G004 multiple Action Feedback preserved
G005 multiple Residual preserved
G006 multiple Candidate/Evaluation preserved
G007 Decision/Plan exact
G008 scenario/approved/executed amount separate
G009 Candidate NOT_ACTIVE
G010 Shadow does not imply activation
G011 Model Activation exact only
G012 /runtime returns collection summaries, not unbounded arrays
G013 each multi-object endpoint default limit 50 and maximum 200
G014 collection keyset order = logical_time DESC, object_ref ASC
G014a FieldTwinCollectionKindV1 inventory exact for all collection endpoints
G014b object_type is not a collection leading sort key
G014c endpoint-to-collection-kind mapping exact
G015 collection cursor scope/filter/snapshot/fixed-root bound
G016 model-governance returns one selected collection kind per request
G017 offset pagination and timestamp-only collection cursor rejected
G018 collection page hash bounded to returned page
G019 collection page uses limit+1, not full COUNT(*)
G020 /runtime collection summary does not scan full canonical history
G021 total_count present only for EXACT_VALIDATED_PROJECTION
```

## H. Hash, Visibility Snapshot and Cursor

```text
H001 canonicalJsonV1 reused
H002 semanticHashV1 reused
H003 decimal strings
H004 null/status stable
H005 explicit omitSemanticFieldsV1 exclusions
H006 content hashes exclude response_started_at/request/transaction metadata
H007 each hash excludes itself and all derived hashes
H008 root hash contains current Tick Forecast only
H009 latest successful/scenario-source Forecast belong to attachment hash
H010 health endpoint uses independent health_content_hash
H011 timeline page content hash bounded and visibility-snapshot-bound
H012 trace content hash exact
H013 response instance hash includes response_started_at and endpoint content hashes
H014 CursorPayload contains no self hash/auth field
H015 CursorEnvelope shape exact
H016 HMAC_SHA256 auth input/order exact
H017 unknown key ID rejected
H018 modified cursor with recomputed semantic checksum still rejected
H019 cursor scope/filter/version validation
H020 cursor visibility-snapshot/epoch/fixed-root validation
H021a root/attachment/health/trace content hashes remain stable across restart/rebuild for the same validated canonical content
H021b timeline_items_content_hash remains stable only for the exact same ordered event item set
H021c timeline_page_content_hash equality is required only when visibility snapshot, fixed root, scope/filter, limit, cursor boundary and item set are all identical
H021d a fresh visibility snapshot may change timeline_page_content_hash without canonical content divergence
H022 response instance hash may differ across restart without content divergence
H023 new/late-committing fact between pages excluded from old cursor
H024 fresh first page may observe post-snapshot fact
H025 next_cursor_envelope_digest = semanticHashV1(decoded envelope)
H026 expired cursor rejected
H027 visibility epoch mismatch rejected
H028 xid8 values serialized as canonical decimal strings
H029 xid8 JavaScript number conversion and JSON number serialization rejected
H030 snapshot xip ordering is numeric xid8 order, not lexicographic order
H031 API wire cursor is base64url string without padding
H032 JSON-object cursor request/response rejected
H033 decoded internal envelope round-trips to one canonical wire string
H034 collection cursor tagged variant validation
H035 artifact semantic digest and transport digest are distinct and exact
H036 artifact retention level selected by Slice/epoch artifact class
H037 GitHub Actions artifact alone rejected as R1/R2/R3 authority
H038 MCFT S3_COMPAT retention prefix/bucket/credential contract exact
H039 object versioning and WORM retention proof exact
H040 transport digest stored as external immutable metadata
H041 authorized-store readback recomputes semantic and transport digests
H042 product Evidence Export namespace/route rejected as attestation authority
```

## I. API and Route Boundary

```text
I001 three physical modules
I002 independent registrations
I003 canonical namespace exact
I004 legacy /scenarios preserved
I005 no duplicate route
I006 GET-only
I007 direct/transitive write imports zero
I008 SQL writes zero
I009 writer/recommendation/approval/AO-ACT/activation deps zero
I010 OpenAPI exact
I011 400/403/404/409/503 exact
I012 /runtime returns terminal health only
I013 /runtime/health returns both health views and relationship
I014 signing key unavailable → 503
I015 next_cursor wire type is base64url string or null
I016 object-shaped cursor rejected
I017 collection limit/default/max exact
I018 model-governance collection_kind exact
I019 visibility metadata service unavailable → 503
I020 Timeline from/until wire contract exact
I021 continuation filter conflict → 400 MCFT_CURSOR_FILTER_MISMATCH
I022 collection kind conflict → 400 MCFT_CURSOR_COLLECTION_KIND_MISMATCH
```

## J. Operator Integration

```text
J001 canonical tabs use MCFT API
J002 legacy water/weather/scenario/recommendation truth not consumed
J003 confidence fabrication rejected
J004 missing season/zone does not degrade
J005 timestamp latest selection absent
J006 BLOCKED Forecast UI exact
J007 collection cardinality visible
J008 optional statuses/reasons visible
J009 409 visible
J010 inconsistent graph renders no current payload
J011 terminal and latest operational health visibly separated
```

## K. Restart, Rebuild and Zero Delta

```text
K001 restart root content hash stable
K002 projection rebuild content hashes stable
K003 pointer rebuild stable
K004 child rebuild stable
K005 composite rebuild stable
K006 timeline semantic sequence stable
K007 insertion order irrelevant
K008 acceptance rebuild isolated DB only
K009 read observation window zero writes
K010 new response_started_at does not fail content equivalence
```

## L. Delivery and External Closure

```text
L001 one PR per Slice
L002 no proof-only/settlement PR
L003 declaration exact
L004 base/head exact
L005 required checks PASS
L006 strict up-to-date PASS
L007 exact-tree release lane PASS
L008 protected merge PASS
L009 each Slice committed external items pending, not forged
L010 each Slice exact merge-SHA attestation artifact PASS
L011 each Slice effective delivery frontier projection PASS
L012 successor consumes predecessor artifact
L013 successor registry bootstrap effective only after predecessor merge
L014 artifact retained and digest recorded
L015 S6 effective completion projection PASS
L016 CAP-08 remains unauthorized
```

---

# 30. Delivery Governance

## 30.1 PR model

```text
one implementation PR per Slice
```

禁止：

```text
proof-only PR
effectiveness carrier PR
settlement PR
closed-without-merge proof branch
multiple Slice implementation in one PR
postmerge SSOT writeback
```

## 30.2 Candidate transitions

S0：

```text
CURRENT-AUTHORITY-V1.status
null/NOT_STARTED_REGISTRY_BOOTSTRAPPED
→ AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE
```

S1—S6：

```text
sN_candidate_implemented
false → true
```

禁止所有 Slice 复用同一全局 status 值作为唯一 transition authority。

Candidate declaration 必须使用 21.1 冻结的 exact：

```text
slice_id
status_file
candidate_field
candidate_value
focused_workflow
standard_workflow
semantic snapshot paths/blobs
candidate/base SHA
```

## 30.3 Per-Slice external attestation

Workflow：

```text
push:main
read-only
exact merge SHA
no repository write
no branch/tag write
no SSOT writeback
artifact retained
```

每个 Slice artifact 必须包含：

```text
slice_id
subject_commit
candidate_head
exact_tree_equivalence
required checks
focused acceptance result
predecessor artifact validation
committed candidate state
effective delivery frontier projection
runtime/canonical-write authority delta
artifact digest
```

S6 artifact 额外包含：

```text
Hard Acceptance external resolution
zero-write result
completion claims
nonclaims
effective completion projection
```

## 30.3.1 Artifact identity、digest 和 retention hierarchy

每个 exact-SHA attestation artifact 必须同时冻结三层 identity：

```text
workflow locator:
  workflow_run_id
  job_id
  artifact_id
  artifact_name

semantic artifact identity:
  canonical_artifact_json
  semantic_artifact_digest =
    semanticHashV1(canonical_artifact_json excluding semantic_artifact_digest)

transport integrity:
  exact uploaded archive bytes
  transport_archive_sha256
```

Authority rule：

```text
semantic_artifact_digest:
  determines semantic evidence identity

transport_archive_sha256:
  detects archive-byte corruption only

workflow/artifact IDs:
  locators only

these values are not interchangeable
```

Retention hierarchy：

```text
R0 — committed digest authority
  predecessor semantic_artifact_digest
  subject_commit
  artifact locator metadata
  effective frontier projection
  committed by successor Slice PR
  retained for repository lifetime

R1 — S0—S5 immutable artifact payload
  minimum payload retention = 180 days
  and until successor exact-SHA artifact PASS + 30 days,
  whichever is later

R2 — S6 capability-closure artifact payload
  minimum payload retention = 730 days
  and until CAP-08 authorization/closure consumption + 365 days,
  whichever is later

R3 — visibility epoch rotation/purge artifact payload
  minimum payload retention = 365 days
  rotation semantic/transport digests retained in epoch authority row
  purge semantic/transport digests retained in epoch authority row
  epoch authority row retained for database lifetime
```

Artifact payload expiry before required successor consumption：

```text
fails closed
predecessor_effective cannot be newly re-proven from locator/digest alone
manual replacement artifact requires independent governance authority
```

GitHub Actions artifact 在 public repository 中最多保留 90 天，因此只允许作为 transient convenience copy，不承担 R1/R2/R3 retention authority。Workflow 可以设置平台允许的最大 retention，但长期权威必须同步写入以下冻结 store。

## 30.3.2 MCFT Authorized Attestation Retention Store

Authorized store type：

```text
store_contract_id:
MCFT_ATTESTATION_S3_COMPAT_OBJECT_LOCK_V1

physical_backend_family:
existing GEOX S3_COMPAT object-storage transport

authority_boundary:
separate from product Evidence Export delivery authority
```

可以复用现有 S3-compatible endpoint/bucket infrastructure，但不得复用 `evidence-exports-v1/<tenant_id>/<job_id>/...` 产品 Evidence Export namespace、产品下载 route 或 application Runtime credential。MCFT attestation 使用独立 workflow-only credential 与独立 immutable namespace。

Configuration/credential contract：

```text
GEOX_MCFT_ATTESTATION_S3_ENDPOINT
GEOX_MCFT_ATTESTATION_S3_BUCKET
GEOX_MCFT_ATTESTATION_S3_REGION
GEOX_MCFT_ATTESTATION_S3_FORCE_PATH_STYLE

workflow secret identity:
geox_mcft_attestation_retention_writer_v1

readback identity:
geox_mcft_attestation_retention_reader_v1

Runtime server credential:
forbidden

product Evidence Export credential:
forbidden as MCFT authority
```

Writer credential 最小权限：

```text
PutObject
PutObjectRetention or backend-equivalent immutable-retention operation
GetObject/HeadObject only for immediate readback verification
ListBucket only under exact MCFT prefix when technically required

DeleteObject:
forbidden

overwrite existing object key/version:
forbidden
```

Object namespace：

```text
mcft-attestations-v1/
  <repository_owner>/
  <repository_name>/
  <capability_line_id>/
  <slice_id>/
  <subject_commit>/
  <workflow_run_id>/
  <artifact_name>/
```

Required immutable objects：

```text
canonical-artifact.json
artifact-archive.bin
transport-metadata.json
retention-manifest.json
```

Object key segments 必须使用冻结 safe-segment normalization；不得包含 tenant/product Evidence Export key，也不得依赖 mutable branch name 作为唯一 identity。

Immutability/retention：

```text
bucket versioning:
enabled

object lock or backend-equivalent WORM:
required

overwrite:
denied

delete before retain_until:
denied

R1 retain_until:
max(uploaded_at + 180 days,
    successor exact-SHA artifact PASS at + 30 days)

R2 retain_until:
max(uploaded_at + 730 days,
    CAP-08 authorization/closure consumption at + 365 days)

R3 retain_until:
uploaded_at + at least 365 days
```

Lifecycle policy 可以在 `retain_until` 后转入 archive tier，但不能在 required readback window 内删除。无法证明 versioning、immutability 或 lifecycle policy 时，artifact upload 必须 fail closed：

```text
MCFT_ATTESTATION_RETENTION_AUTHORITY_UNAVAILABLE
```

Digest authority：

```text
canonical-artifact.json:
  contains semantic_artifact_digest
  semantic_artifact_digest excludes itself

artifact-archive.bin:
  exact transport bytes

transport_archive_sha256:
  produced only after exact archive bytes exist
  obtained from upload-artifact output,
  workflow SHA-256 over exact archive bytes,
  or external object-store put-result/checksum metadata

transport-metadata.json:
  stores transport_archive_sha256
  object key
  object version id
  ETag/checksum metadata
  workflow_run_id/job_id
  uploaded_at

retention-manifest.json:
  stores retention level
  retain_until
  object-lock/versioning proof
  credential identity class
```

`transport_archive_sha256` 不得被要求预先存在于它所哈希的同一个 archive 内。GitHub `upload-artifact` digest 是上传完成后的外部 transport metadata；外部 S3_COMPAT authority 的 digest 也必须作为 archive 外的 immutable metadata 保存。

Upload result locator：

```text
store_contract_id
bucket
object_prefix
canonical_artifact_object_key
archive_object_key
transport_metadata_object_key
retention_manifest_object_key
object_version_ids
semantic_artifact_digest
transport_archive_sha256
retention_level
retain_until
```

Download/readback procedure：

```text
1. use reader identity, never Runtime/product credential
2. HeadObject exact versioned keys
3. verify object-lock/versioning/retain_until metadata
4. GetObject exact canonical-artifact.json and archive bytes
5. recompute semantic_artifact_digest
6. recompute transport_archive_sha256
7. compare locator, subject_commit, workflow IDs and object version IDs
8. fail closed on missing, mutable, expired, digest-divergent or wrong-prefix object
```

Presigned product Evidence Export URL 不能作为 predecessor attestation authority。Successor Slice 必须消费上述 versioned locator 与 digest set。

Artifact purge/retention acceptance must verify：

```text
semantic digest reproducible from canonical artifact JSON
transport SHA-256 matches downloaded exact archive
transport digest is external metadata, not recursively embedded in archive
authorized prefix/bucket/store contract exact
workflow writer and readback identities exact
versioning/object-lock/WORM proof exact
successor committed record carries predecessor semantic digest
retention deadline meets the correct R-level
S6 and epoch-rotation artifacts cannot inherit shorter S0—S5 retention
GitHub Actions artifact alone cannot satisfy R1/R2/R3
product Evidence Export namespace/route/credential cannot satisfy MCFT authority
```

## 30.4 Successor consumption

S1—S6 PR 必须引用前驱：

```text
PR number
candidate head
merge commit
required workflow IDs
attestation run/job
artifact ID/digest
effective frontier projection
```

CAP-08 authorization PR 必须引用相同结构的 CAP-07 S6 closure artifact。

---

# 31. Changed-file Boundary

## S0

```text
cap_07 authority docs
source matrix and route lock materialization
Hard Acceptance ledger skeleton
S1 delivery-status seed
candidate registry extension for S1
governance acceptance
generic read-only exact-SHA attestation workflow
MCFT attestation S3_COMPAT retention uploader/readback helper
retention store contract/credential declaration metadata
workflow declaration metadata
```

禁止 Runtime/migration/route/frontend。

## S1

```text
pure contracts
pure validation registry
pure content-hash/response-hash/cursor/order
contract tests
S2 delivery-status seed
candidate registry extension for S2
```

## S2

```text
read-only repository
exact resolvers
validators
one additive fact-visibility-support migration
visibility epoch/index/trigger/retention acceptance
migration owner / migrator / Runtime role grant SQL
migration ledger schema and checksum contract
one-shot startup migration runner
Runtime startup visibility/privilege preflight
deployment startup dependency wiring limited to migration-before-runtime
credential-name/example configuration without secret values
DB acceptance
S3 delivery-status seed
candidate registry extension for S3
```

S2 changed-file boundary 可包含且只可包含与冻结设计直接对应的：

```text
apps/server/db/migrations/<one CAP-07 visibility migration>.sql
one migration-ledger/runner module
one Runtime startup preflight module
one migration command/entrypoint
Docker Compose or deployment startup dependency delta
environment example/schema names for separate migration/runtime credentials
startup/readiness orchestration contract
no secret values or credentials committed
focused DB/governance acceptance
```

禁止：

```text
把 migration credential 注入 Runtime server
让 Runtime server执行 DDL
修改 unrelated deployment topology
增加第二个 CAP-07 migration
修改 canonical facts semantic columns/envelope
新增 canonical writer
```

除冻结的 physical visibility support、角色/credential 和 startup migration contract 外，禁止其他 migration/deployment authority。

## S3

```text
composers
timeline/trace/action/health/governance builders
composer tests
S4 delivery-status seed
candidate registry extension for S4
```

## S4

```text
route modules
registration
OpenAPI
API acceptance
legacy route relocation only
S5 delivery-status seed
candidate registry extension for S5
```

不得改变 write behavior 语义。

## S5

```text
Operator UI
API client
canonical adapters
frontend acceptance
S6 delivery-status seed
candidate registry extension for S6
```

## S6

```text
integrated acceptance
isolated fixtures
closure candidate records
matrix/ledger final candidate updates
attestation workflow final predicates
```

不得注册 CAP-08 implementation authority，不得借 closure 加产品能力。

---

# 32. Completion Claims

仅允许：

```text
MCFT_CAP_07_COMPLETE
MINIMAL_FIELD_TWIN_READ_MODEL_ESTABLISHED
EXACT_CURRENT_RUNTIME_GRAPH_READ_ESTABLISHED
TERMINAL_RECORD_SET_HEALTH_ESTABLISHED
LATEST_OPERATIONAL_RUNTIME_HEALTH_ESTABLISHED
RUNTIME_HEALTH_DUAL_SEMANTICS_ESTABLISHED
RUNTIME_HEALTH_EXACT_ROLE_RESOLUTION_ESTABLISHED
RECORD_SET_IDENTITY_VALIDATION_ESTABLISHED
ACTIVE_LINEAGE_INITIAL_AND_REVISION_AUTHORITY_VALIDATION_ESTABLISHED
EIGHT_SOURCE_VALIDATION_PROFILES_ESTABLISHED
FROZEN_REPLAY_EVIDENCE_RECORD_TYPE_INVENTORY_ESTABLISHED
DETERMINISTIC_FIELD_TWIN_TIMELINE_ESTABLISHED
EXACT_FIELD_TWIN_TRACE_GRAPH_ESTABLISHED
FORECAST_POINTER_SEPARATION_ESTABLISHED
OPTIONAL_COLLECTION_ATTACHMENT_SEMANTICS_ESTABLISHED
READ_ONLY_PER_REQUEST_REPEATABLE_READ_ESTABLISHED
CURRENT_RUNTIME_TIME_TRAVEL_BOUNDARY_ESTABLISHED
CANONICAL_TIMELINE_VISIBILITY_SNAPSHOT_PAGINATION_ESTABLISHED
BOUNDED_CONTENT_HASH_FAMILY_ESTABLISHED
RESPONSE_INSTANCE_HASH_ESTABLISHED
SIGNED_SCOPE_BOUND_CURSOR_ESTABLISHED
OPERATOR_CANONICAL_RUNTIME_INTEGRATION_ESTABLISHED
LEGACY_OPERATOR_TWIN_TRUTH_FALLBACK_RETIRED_FOR_MCFT_SURFACE
RESTART_REBUILD_CONTENT_EQUIVALENCE_ESTABLISHED
PER_SLICE_EXTERNAL_EFFECTIVENESS_FRONTIER_ESTABLISHED
```

这些 claims 只有 S6 external effective completion projection PASS 后生效。

---

# 33. Preserved Nonclaims

```text
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_LIVE_FIELD_VALIDATION
NO_REAL_DATA_CALIBRATION_ESTABLISHED
NO_PRODUCTION_MODEL_ACTIVATION
NO_AUTONOMOUS_MODEL_ACTIVATION
NO_RUNTIME_PARAMETER_CHANGE
NO_NEW_STATE_ESTIMATION_MATH
NO_NEW_FORECAST_MODEL
NO_NEW_SCENARIO_MODEL
NO_AUTOMATIC_RECOMMENDATION
NO_AUTOMATIC_APPROVAL
NO_AUTOMATIC_DISPATCH
NO_AUTOMATIC_AO_ACT
NO_CAUSAL_EFFECT_ESTABLISHED
NO_HISTORICAL_CURRENT_POINTER_TIME_TRAVEL
NO_CROSS_REQUEST_POSTGRESQL_MVCC_SNAPSHOT_RESTORATION
NO_24_TICK_END_TO_END_CAPABILITY_CLOSURE
NO_SHADOW_ONLINE_RUNTIME_CLOSURE
NO_CONTROLLED_ACTION_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_PRODUCTION_CLAIM
```

---

# 34. MCFT-CAP-08 Boundary

CAP-08 不得硬编码：

```text
8 Tick
24 Tick
fixture count
timeline page count
```

可消费：

```text
MinimalFieldTwinRuntimeReadModelV1
FieldTwinTimelineEventV1
FieldTwinTraceGraphV1
FieldTwinCanonicalVisibilitySnapshotV1
FieldTwinCursorPayloadV1
FieldTwinCursorEnvelopeV1
root_graph_content_hash
attachment_content_hash
health_content_hash
timeline_page_content_hash
trace_graph_content_hash
```

CAP-07 完成不自动授权 CAP-08。

CAP-08 独立授权条件：

```text
CAP-07 S6 committed conditional state present on main
CAP-07 exact merge-SHA artifact PASS
CAP-07 effective completion projection PASS
restart/rebuild content equivalence PASS
Hard Acceptance no FAIL
current main locked
successor authorization PR protected merge
```

---

# 35. 最终冻结条件与裁决

v0.2.5 只有在以下设计审查通过后才能 `FROZEN`：

```text
taskbook internal consistency PASS
P-1A evidence locked
P-1B merge locked
eight source profile families frozen
required source table/canonical fact/Replay Evidence record-type inventory frozen
obligation matrix row schema frozen
route ownership row schema frozen
mandatory root includes terminal_record_set_health
latest operational health independent semantics frozen
record-set identity support frozen
INITIAL/REVISION active-lineage authority graphs frozen
optional cardinality and bounded collection pagination frozen
Forecast/Scenario pointer model frozen
Timeline taxonomy/rank/health role frozen
per-request snapshot boundary frozen
canonical visibility snapshot predicate, physical xid8 metadata and fixed-root continuation frozen
no cross-request MVCC restoration/import claim frozen
pg_snapshot + pg_visible_in_snapshot predicate frozen
physical top-level xid8 metadata migration/trigger frozen
visibility_anchor_xid8 and visibility_anchor_kind semantics frozen
visibility metadata owner/privilege/SECURITY DEFINER/search_path/immutability/bypass contract frozen
external database role bootstrap authority frozen
migration owner / migrator / Runtime role and credential separation frozen
one-shot startup migration, migration ledger and Runtime readiness preflight frozen
multi-epoch retained-row and authorized purge model frozen
Xid8TextV1 decimal-string and numeric-sort contract frozen
visibility epoch rotation, retained-row purge and cursor expiry frozen
content hash vs response instance hash frozen
Timeline item/page and collection item/page hash equivalence scopes frozen
hash self/derived exclusion sets frozen
Cursor payload/envelope/HMAC authentication and base64url wire-string contract frozen
exact Replay Evidence record-type inventory frozen
Runtime Health exact role-resolution algorithm frozen
twin_runtime_attempt_v1 direct inventory and F-family relation frozen
root/attachment/health hash ownership frozen
HTTP 503 and cursor envelope digest semantics frozen
three-module route ownership design frozen
canonical /runtime namespace frozen
seven-Slice producer/consumer graph frozen
S0—S6 independent candidate authority graph frozen
successor registry bootstrap graph frozen
per-Slice external effectiveness frontier frozen
artifact semantic/transport digest and retention hierarchy frozen
MCFT S3_COMPAT_OBJECT_LOCK retention authority, prefix, credential and readback contract frozen
Timeline filter/filter_hash and continuation conflict contract frozen
complete collection kind inventory and stable order frozen
Hard Acceptance IDs unique and coverage frozen
current main exact SHA recorded
```

以下内容不是 Taskbook freeze 前置，而是 S0 Exit：

```text
all concrete source tables/facts mapped to eight profiles
all obligation rows materialized and complete
all route ownership rows materialized and complete
S0 live trusted negative → corrected exercise PASS
S1 authority seed and registry extension present
S0 committed candidate state complete
```

v0.2.5 FINAL 裁决：

```text
migration authority / Runtime credential separation:
FROZEN_IN_DESIGN

startup migration / Runtime readiness order:
FROZEN_IN_DESIGN

API cursor wire type:
BASE64URL_STRING_ONLY

Timeline hash equivalence scope:
CORRECTED

optional collection bounded pagination:
FROZEN_IN_DESIGN

visibility epoch retained-row model:
FROZEN_IN_DESIGN

artifact digest and retention hierarchy:
FROZEN_IN_DESIGN

architecture revision required:
NONE_BEYOND_V0.2.5

taskbook internal consistency:
PASS

repository factual alignment:
PASS

physical executability:
PASS

freeze status:
FROZEN
```

当前 repository 状态保持：

```text
capability_line_id:
MCFT-CAP-07

status:
READY_FOR_S0_AUTHORIZATION_PR

active_delivery_slice_id:
null

implementation_authorized:
false

read_runtime_implementation_authorized:
false

S0_candidate_pr_authorized:
true

runtime_source_authorized:
false

canonical_write_authorized:
false

mcft_cap_08_authorized:
false
```

S0 protected merge 后 repository committed state 仍是：

```text
status:
AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE

effectiveness_condition:
PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS
```

S0 exact-SHA artifact PASS 后，external effective frontier 为：

```text
effective_status:
IN_PROGRESS

effective_active_delivery_slice_id:
S1

read_runtime_implementation_authorized:
true

runtime_source_authorized:
false

canonical_write_authorized:
false

mcft_cap_08_authorized:
false
```

该 external truth 不通过 postmerge SSOT writeback 修改 S0 committed record；S1 PR 必须显式消费它。

最终设计裁决：

```text
MCFT-CAP-07 capability purpose:
VALID

repository architecture alignment:
PASS

canonical authority boundary:
VALID

source validation design:
EIGHT_PROFILES_WITH_FROZEN_INVENTORY_AND_S0_MATERIALIZATION

mandatory root graph:
TERMINAL_HEALTH_AND_RECORD_SET_COMPLETE

operational health model:
DUAL_SEMANTICS_COMPLETE

active lineage authority:
INITIAL_AND_REVISION_EXACT_RESOLUTION_COMPLETE

Forecast/Scenario semantics:
COMPLETE

optional cardinality and bounded pagination:
COMPLETE_IN_DESIGN

snapshot/time-travel boundary:
PG_SNAPSHOT_VISIBILITY_PREDICATE_WITH_PROTECTED_VISIBILITY_ANCHOR_XID8_SUPPORT

hash/cursor contract:
CONTENT_AND_RESPONSE_INSTANCE_SEPARATED_WITH_SIGNED_VISIBILITY_SNAPSHOT_AND_BASE64URL_WIRE

Operator route boundary:
THREE_MODULES

API namespace:
RUNTIME_SUBNAMESPACE

external effectiveness state machine:
PER_SLICE_THREE_LAYER_MODEL_COMPLETE

candidate authority graph:
S0_TO_S6_INDEPENDENT_TRANSITIONS_COMPLETE

Slice graph:
SEVEN_SLICES_PRESERVED

P-1B repository foundation:
MERGED_EFFECTIVE

taskbook version:
v0.2.5

freeze status:
FROZEN

implementation authorization:
FALSE

S0 candidate PR authorization:
TRUE
```
