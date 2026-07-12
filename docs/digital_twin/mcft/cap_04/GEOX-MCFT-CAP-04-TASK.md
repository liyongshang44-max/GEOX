<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md -->

# GEOX MCFT-CAP-04 — 72-Hour Forecast and Three Scenarios

## 完整任务线 v0.5 最终冻结候选

本任务线以当前 `main`、DT-02 冻结架构、MCFT-CAP-03 R4 最终验证、GEOX Complete Agricultural Digital Twin Master Task Line 和阶段一交接边界为依据。

本任务线已经解决的主要实现冲突包括：

```text
1. MCFT-07 被错误排除
2. A1 COMPLETED 与 A2 BLOCKED 被混入同一 record-set contract
3. 24-tick Runtime Config parent-chain 未冻结
4. Future Forcing snapshot 选择和 canonical trace 不唯一
5. Forecast uncertainty 与 interval 公式不完整
6. Scenario application efficiency、stress、difference 公式不完整
7. A1/A2 跨变体 terminal tick 唯一性未冻结
8. P0 全局 SSOT 修复没有独立 delivery contract
9. Replay Runtime Config authority 被误写为 active-config pointer
10. latest successful Forecast pointer 被错误冻结为永远 null
11. Tick-root recovery 未区分六个直接引用与 Health 反向查找
12. Forecast envelope 未冻结 Weather / ET0 Evidence refs
13. 旧 Forecast / Scenario 算法复用分类存在 OR 歧义
14. canonical Scenario projection authority 未与 legacy compatibility projection 分离
15. Scenario assumption_ref 缺少可解析 authority
16. S10 缺少仓库内 postmerge effectiveness reconciliation
```

当前状态：

```text
design_status:
FINAL_FROZEN_CANDIDATE_V0_5

implementation_status:
NOT_AUTHORIZED

first_permitted_repository_action:
MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1
```

本文件本身不授权 Runtime 实现。

---

# 0. 核心裁决

```text
capability_line_id:
MCFT-CAP-04

display_alias:
MCFT-4

canonical_name:
72-Hour Forecast and Three Scenarios

runtime_mode:
REPLAY

target_completion_level:
Level A — Deterministic Replay Twin

primary_owner_work_package_id:
MCFT-09

contributing_owner_work_package_ids:
MCFT-02
MCFT-03
MCFT-04
MCFT-05
MCFT-06
MCFT-07
MCFT-08
MCFT-10

excluded_owner_work_package_ids:
MCFT-11
MCFT-12
MCFT-13
MCFT-14
MCFT-15
MCFT-16
MCFT-17
MCFT-18

predecessor_capability_line_id:
MCFT-CAP-03

successor_capability_line_id:
MCFT-CAP-05

successor_authorized:
false
```

MCFT-CAP-03 已在 `main` 完成 R4 最终验证：

```text
status:
COMPLETE

verified_on_main:
true

remaining_nonconformant_count:
0

remaining_unadjudicated_contract_deviation_count:
0

successor:
MCFT-CAP-04

successor_authorized:
false
```

MCFT-CAP-04 仍须经过：

```text
P0 Global CAP-03 SSOT Reconciliation
↓
S0 CAP-04 Authorization and Predecessor Lock
↓
Runtime delivery slices
```

不得跳过 P0/S0 直接修改 Runtime source。

## 0.1 本能力线建立什么

```text
每个新 posterior State 同 tick 生成 successful Forecast
严格 +1h 到 +72h 的 72 点 Forecast
完整 Future Forcing canonical trace
逐小时 deterministic mean propagation
逐小时 additive process uncertainty propagation
A1_COMPLETED canonical persistence
A2_BLOCKED_FORECAST 合法降级路径
三个固定 Scenario options
B_SCENARIO_COMMIT canonical persistence
A1/A2 跨变体 terminal tick 唯一性
A1 成功后 B 缺失的恢复屏障
24 个连续 Forecast + Scenario Runtime ticks
restart / forward backfill / response-loss recovery
canonical readback 和 projection rebuild
```

## 0.2 本能力线不建立什么

```text
Forecast Residual
Recommendation
Policy Evaluation
Human Decision
Approval
Action Plan
AO-ACT
Dispatch
Execution Receipt
Outcome Evidence
Calibration Candidate
Shadow Evaluation
Model Activation
Late-Evidence Revision
Continuous Scheduler
Shadow-online Runtime
Live Field Runtime
MCFT-GATE-A Closure
Minimum Complete Field Twin Complete
```

---

# 1. 与总任务书的关系

总任务书水平能力：

```text
MCFT-09 — 72-hour Forecast Runtime
MCFT-10 — Irrigation Scenario Runtime
```

Forecast 必须：

```text
source posterior at T
point 1 = T + PT1H
...
point 72 = T + PT72H
exactly 72 points
```

Gate A 的完整固定情景集合是：

```text
NO_ACTION
IRRIGATE_NOW_10MM
IRRIGATE_NOW_20MM
IRRIGATE_NOW_30MM
DELAY_24H_20MM
```

本能力线只建立阶段一最小三情景：

```text
NO_ACTION
IRRIGATE_NOW_15MM
IRRIGATE_NOW_25MM
```

因此冻结：

```text
MCFT-CAP-04 closes:
successful 72-hour Forecast Runtime
minimal three-option Scenario Runtime

MCFT-CAP-04 does not close:
horizontal MCFT-10 in full
MCFT-GATE-A five-scenario requirement
MCFT-GATE-A Replay-backed Closure
```

不得把三情景 completion claim 冒充五情景或 Gate A completion claim。

---

# 2. 架构裁决

## 2.1 成功 Forecast 属于 A1 State Tick 原子事务

成功 Forecast 必须在同一个：

```text
A_STATE_TICK_COMMIT
operation_variant = A1_COMPLETED
```

中与当小时 posterior State 原子提交。

每个 A1 tick 恰好包含：

```text
1. twin_evidence_window_v1
2. twin_state_transition_v1
3. twin_assimilation_update_v1
4. twin_state_estimate_v1
5. twin_forecast_run_v1
6. twin_runtime_tick_v1
7. twin_runtime_checkpoint_v1
8. twin_runtime_health_v1
```

A1 preconditions：

```text
Forecast.status = COMPLETED
Forecast.points.length = 72
Forecast.horizons = 1..72
```

A1 outcome：

```text
tick.status = COMPLETED
checkpoint advances
latest State advances
latest Forecast result advances
latest successful Forecast advances
scenario_eligible = true
```

禁止：

```text
先提交 CAP-03 A2 State Tick
再补写 successful Forecast
把 Forecast 作为 State Tick 外部附件
单独更新 successful Forecast pointer
```

正确顺序：

```text
Evidence Window
→ Dynamics
→ Observation Selection
→ Assimilation
→ Posterior State
→ 72-Hour Forecast
→ A1_COMPLETED atomic commit
```

## 2.2 BLOCKED Forecast 使用 A2，不得伪装成 A1

合法 BLOCKED Forecast 必须使用：

```text
A_STATE_TICK_COMMIT
operation_variant = A2_BLOCKED_FORECAST
```

A2 preconditions：

```text
posterior is valid
Forecast.status = BLOCKED
Forecast.points.length = 0
Forecast.reason_codes non-empty
```

A2 outcome：

```text
tick.status = COMPLETED_WITH_LIMITATIONS
checkpoint advances
latest State advances
latest Forecast result advances
latest successful Forecast does not advance
scenario_eligible = false
Scenario Set is not created
```

冻结两个独立 record-set authorities：

```text
MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1
→ A1_COMPLETED

MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1
→ A2_BLOCKED_FORECAST
```

禁止一个 A1 builder 同时生成 COMPLETED 和 BLOCKED record set。

## 2.3 Scenario 是独立 B 事务

Scenario 使用：

```text
B_SCENARIO_COMMIT
```

Source Forecast 必须：

```text
status = COMPLETED
points.length = 72
horizons = 1..72
scenario_eligible = true
```

B transaction：

```text
canonical appends:
exactly one twin_scenario_set_v1

projection writes:
scenario set index
scenario point index
latest scenario index
```

完整标准链：

```text
A1_COMPLETED
  posterior + successful Forecast + tick + checkpoint
↓
B_SCENARIO_COMMIT
  three-option Scenario Set
```

B 失败：

```text
does not roll back A1
does not alter source Forecast
does not write partial Scenario Set
does not advance scenario latest
```

## 2.4 A1 成功后 B 缺失与 A2 BLOCKED 必须分离

### A1 succeeded, B missing

```text
source Forecast is successful and scenario-eligible
Scenario Set is expected but missing
next standard range tick is blocked by recovery barrier
Runtime must recover B idempotently first
```

状态：

```text
PENDING_SCENARIO_RECOVERY
```

### A2 BLOCKED

```text
source Forecast is not scenario-eligible
Scenario Set is not expected
not a missing-B recovery case
```

标准 v1 range policy：

```text
stop_after_blocked_forecast = true
```

A2 提交后：

```text
checkpoint has advanced
same logical tick cannot later become A1 in same lineage/revision
range stops with explicit BLOCKED terminal result
operator may begin a later invocation from the next persisted tick
```

Closure standard fixture 不得出现 A2。

## 2.5 不新增 canonical object type

使用现有对象：

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
```

新增 DTO、validator、contract ID 和 projection implementation 不等于新增 canonical object type。

预期：

```text
DT-02 Architecture Amendment:
NOT REQUIRED
```

若 S1 发现现有 frozen object 无法表达必要语义，必须停止并提出独立 DT-02 Amendment，不得在 CAP-04 Runtime source 中隐式改变 architecture。

---

# 3. P0 — CAP-03 全局 SSOT 修复

## 3.1 当前问题

CAP-03 专属 R4 Final Verification 已正确记录：

```text
status = VERIFIED_ON_MAIN
capability_status = COMPLETE
active_delivery_slice_id = null
pending_completion_claim_count = 0
remaining findings = 0
successor_authorized = false
```

但全局 Capability Matrix / Implementation Map 仍可能保留：

```text
S8_FINALIZATION_READY_FOR_MERGE
closure_effective = false
capability_complete = false
candidate-only authorization text
```

这些历史残留必须先消除。

## 3.2 Delivery identity

```text
delivery_slice_id:
MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1

slice_kind:
GOVERNANCE_ONLY

runtime_source_authorized:
false

cap_04_authorized:
false
```

## 3.3 Exact changed-file boundary

只允许：

```text
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json

docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md

docs/digital_twin/mcft/cap_04/
GEOX-MCFT-CAP-04-TASK.md
GEOX-MCFT-CAP-04-P0-STATUS.json

scripts/governance_acceptance/
ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs
```

禁止：

```text
CAP-03 Runtime source
CAP-03 canonical facts
CAP-03 historical task amendment
CAP-03 final verification evidence
CAP-04 Runtime source
persistence migrations
routes
web
```

## 3.4 P0 completion conditions

必须证明：

```text
CAP-03 status = COMPLETE
CAP-03 implementation_status = COMPLETE
CAP-03 verified_on_main = true
CAP-03 active_delivery_slice_id = null
CAP-03 pending_completion_claims = []
CAP-03 remaining_nonconformant_count = 0
CAP-03 remaining_unadjudicated_contract_deviation_count = 0
CAP-04 provisional capability-line entry exists
CAP-04 status = NOT_AUTHORIZED
CAP-04 design_status = FINAL_FROZEN_CANDIDATE_V0_5
CAP-04 implementation_status = NOT_AUTHORIZED
CAP-04 runtime_source_authorized = false
CAP-04 active_delivery_slice_id = null
CAP-04 predecessor_capability_line_id = MCFT-CAP-03
CAP-04 successor_capability_line_id = MCFT-CAP-05
CAP-04 successor_authorized = false
CAP-04 pending_completion_claims = []
CAP-04 effective_completion_claims = []

global Capability Matrix schema_version is advanced
global Capability Matrix latest_governance_update identifies CAP-04 P0
global successor authorization rule includes CAP-04 boundary
Implementation Map is updated through CAP-04 provisional state
```

P0：

```text
does not reopen CAP-03
does not create a CAP-04 completion claim
does not authorize S1
```

---

# 4. S0 — Authorization and Predecessor Lock

## 4.1 Delivery identity

```text
delivery_slice_id:
MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1

depends_on:
MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1
```

S0 合并并通过 merged-main Gate 后，才允许：

```text
design_status = DESIGN_FROZEN
implementation_status = READY_FOR_IMPLEMENTATION
active_delivery_slice_id =
MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1
```

## 4.2 Predecessor PostgreSQL canonical read

必须从 canonical read path 提取：

```text
active_lineage_ref
lineage_id
revision_id

latest_posterior_state_ref
latest_posterior_state_hash

latest_checkpoint_ref
latest_checkpoint_hash

latest_forecast_result_ref
latest_forecast_result_hash

latest_successful_forecast_ref

predecessor_state_runtime_config_ref
predecessor_state_runtime_config_hash

reality_binding_ref
reality_binding_hash

next_tick_logical_time
checkpoint_sequence
```

当前预期：

```text
checkpoint_sequence:
48

latest logical time:
2026-06-03T01:00:00.000Z

next tick:
2026-06-03T02:00:00.000Z

latest successful Forecast:
null
```

必须验证：

```text
active_lineage_ref resolves canonical twin_runtime_lineage_v1

lineage.lineage_id
==
State.lineage_id
==
checkpoint.lineage_id
==
latest Forecast result.lineage_id

lineage.revision_id
==
State.revision_id
==
checkpoint.revision_id
==
latest Forecast result.revision_id

checkpoint.last_posterior_state_ref
==
latest State.object_id

checkpoint.forecast_result_ref
==
latest Forecast result.object_id

predecessor_state_runtime_config_ref/hash
==
State.runtime_config_ref/hash

predecessor State-bound Runtime Config ref/hash
resolves exactly one canonical twin_runtime_config_v1

Reality Binding ref/hash
==
persisted predecessor authority snapshot ref/hash

Replay Runtime Config authority is not an active-config pointer.

next_tick_logical_time
==
latest logical time + PT1H
```

任何不一致：

```text
fail closed
no CAP-04 authorization
```

## 4.3 Predecessor lock artifact

```text
docs/digital_twin/mcft/cap_04/
GEOX-MCFT-CAP-04-PREDECESSOR-LOCK.json
```

不得：

```text
从 expected fixture 猜测 object IDs
从源代码重新 bootstrap
使用日志片段代替 canonical DB readback
把 active_lineage_ref 与 semantic lineage_id 混同
```

## 4.4 S0 exact changed-file boundary

只允许：

```text
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json

docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION.md
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PREDECESSOR-LOCK.json
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S0-ALIGNMENT-REVIEW.md

scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_AUTHORIZATION.cjs
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PREDECESSOR_PREFLIGHT.ts
```

禁止：

```text
CAP-04 Runtime source
persistence migrations
routes
web
Forecast or Scenario canonical writes
```

## 4.5 S0 effectiveness condition

```text
P0 merge commit
=
S0 exact baseline main commit
```

只有同时满足：

```text
S0 implementation PR merged to main
+
S0 merged-main Authorization Gate PASS
```

才允许：

```text
S1 Runtime source authorized
design_status = DESIGN_FROZEN
implementation_status = READY_FOR_IMPLEMENTATION
```

S0 premerge readiness、candidate branch status 或 exact-head CI 单独通过，均不构成 Runtime authority。

---

# 5. Forecast 时间合同

对于 logical tick `T` 的 posterior State：

```text
issued_at = T
source_posterior.as_of = T
```

Forecast point：

```text
point 1:
target_time = T + PT1H
horizon_hour = 1

...

point 72:
target_time = T + PT72H
horizon_hour = 72
```

禁止：

```text
target_time = T
horizon 0
horizons 0..71
71 points
73 points
non-hour-aligned target
duplicate target
gap
overlap
out-of-order points
```

每点必须满足：

```text
target_time
=
issued_at + horizon_hour × PT1H
```

每点对应 forcing interval：

```text
interval_start = target_time - PT1H
interval_end = target_time
```

---

# 6. Forecast baseline assumption

Forecast baseline：

```text
NO_NEW_IRRIGATION
```

含义：

```text
source posterior 已经吸收的历史 executed irrigation 保留在 State 中

Forecast horizon 内：
assumed future irrigation = 0
```

它不代表：

```text
Recommendation
Policy conclusion
Decision
Instruction not to irrigate
```

Forecast horizon 内不执行：

```text
new soil observation read
assimilation
posterior persistence
active config mutation
execution receipt consumption
```

Forecast 是同一个 source posterior 的未来推演，不是未来 State history。

---

# 7. Future Forcing Window

新增纯 Domain/Runtime DTO：

```text
ForecastForcingWindowV1
```

它不是 canonical object，但其完整语义必须进入 Forecast determinism basis。

## 7.1 Coherent forcing-cycle pair policy

每个 Forecast 必须选择一个联合 forcing cycle pair：

```text
exactly one FUTURE_WEATHER_ASSUMPTION snapshot
+
exactly one FUTURE_ET0_ASSUMPTION snapshot
```

二者不是独立选出后再组合，而是必须先形成可机器验证的 pair。

冻结：

```yaml
forcing_cycle_key:
  scope
  issued_at
  available_to_runtime_at
  valid_from
  valid_to
```

必须满足：

```text
weather.forcing_cycle_key
==
et0.forcing_cycle_key
```

对于当前 Level A Replay，进一步要求：

```text
weather.issued_at
==
et0.issued_at

weather.available_to_runtime_at
==
et0.available_to_runtime_at

weather.valid_from
==
et0.valid_from

weather.valid_to
==
et0.valid_to
```

Weather 与 ET0 snapshot 各自还必须满足：

```text
scope exact match
binding authorized
quality usable
issued_at <= T
available_to_runtime_at <= T
72 points
covers exactly (T, T+72h]
hour-contiguous
no gap
no overlap
point interval_end = Forecast target_time
```

Snapshot identity authority 冻结为：

```text
snapshot_ref
=
Evidence.source_record_id

snapshot_hash
=
Evidence.source_record_hash
```

禁止使用以下值替代 snapshot ref：

```text
binding_id
origin_source_id
file path
fixture path
materialized location
```

v1 禁止跨多个 snapshots 拼接，也禁止跨 forcing cycles 配对。

冻结 policy：

```text
future_forcing_pair_policy:
JOINT_MATCHING_FORCING_CYCLE_V1

future_forcing_fallback_policy:
NO_CROSS_SNAPSHOT_STITCHING_V1
```

若不存在完整 matching pair：

```text
Forecast BLOCKED
A2_BLOCKED_FORECAST
reason code explicit
```

## 7.2 Joint pair selection order

先按 `forcing_cycle_key` 建立 weather/ET0 matching pairs，再对 pair 排序：

```text
pair.available_to_runtime_at descending
pair.issued_at descending
weather.source_record_id ascending
et0.source_record_id ascending
```

只能选择排序第一的完整 matching pair。

禁止：

```text
weather cycle N + ET0 cycle N-1
weather/ET0 issued_at mismatch
weather/ET0 availability mismatch
weather/ET0 valid_from mismatch
weather/ET0 valid_to mismatch
独立选择后再组合
```

## 7.3 Duplicate / conflict

单个 snapshot semantic identity 至少包括：

```text
binding_id
origin_source_id
scope
issued_at
available_to_runtime_at
valid_from
valid_to
snapshot_kind
```

行为：

```text
same semantic identity + same canonical payload
→ deterministic identical duplicate collapse

same semantic identity + different canonical payload
→ CONFLICTING_FORCING_SNAPSHOT
→ no A1/A2 canonical append
```

Pair identity 至少包括：

```text
forcing_cycle_key
weather.source_record_id
weather.source_record_hash
et0.source_record_id
et0.source_record_hash
```

同一 `forcing_cycle_key` 下存在多个无法通过 identical-duplicate collapse 归一化的 weather 或 ET0 snapshot：

```text
→ CONFLICTING_FORCING_CYCLE
→ no A1/A2 canonical append
```

Conflict 是 malformed input，不是 Forecast BLOCKED。

## 7.4 每小时 forcing DTO

```text
horizon_hour
interval_start
interval_end
target_time

forcing_cycle_key

precipitation_assumption_mm
precipitation_snapshot_ref
precipitation_snapshot_hash
precipitation_issued_at
precipitation_available_to_runtime_at
precipitation_epistemic_status = ASSUMED

et0_assumption_mm
et0_snapshot_ref
et0_snapshot_hash
et0_issued_at
et0_available_to_runtime_at
et0_epistemic_status = ASSUMED

crop_stage_context_ref
crop_stage_context_hash
crop_stage_code
kc

runtime_config_ref
runtime_config_hash

transformation_refs
limitations
```

## 7.5 Canonical Forecast forcing trace

`twin_forecast_run_v1` envelope 必须记录：

```text
evidence_refs
=
sorted unique [
  weather_snapshot.source_record_id,
  et0_snapshot.source_record_id
]
```

其中两个 ref 都必须解析为被选中 matching pair 的 canonical Evidence records。

`twin_forecast_run_v1` payload 必须至少记录：

```text
forcing_window_hash
forcing_cycle_key

weather_snapshot_ref
weather_snapshot_hash
weather_snapshot_issued_at
weather_snapshot_available_to_runtime_at

et0_snapshot_ref
et0_snapshot_hash
et0_snapshot_issued_at
et0_snapshot_available_to_runtime_at

crop_stage_context_ref
crop_stage_context_hash

future_forcing_pair_policy_id
future_forcing_policy_id
future_forcing_fallback_policy_id
transformation_refs
```

`forcing_window_hash` 必须由完整 72-point canonical forcing DTO 计算。

Forecast aggregate determinism hash 必须包含：

```text
source posterior ref/hash
runtime config ref/hash
forcing cycle key
weather snapshot ref/hash
ET0 snapshot ref/hash
forcing window hash
Forecast model version
uncertainty method version
all 72 point semantic hashes
```

Scenario 必须消费 source Forecast 已冻结的 forcing trace，不得重新选择 snapshots。

## 7.6 No-future-leakage

在 `T` 运行时禁止消费：

```text
T 后 observed rainfall
T 后 ingested actual ET0
T 后 soil observation
T 后 weather forecast revision
future execution receipt
actual outcome data
```

即使实际未来天气目标时间与 Forecast point 相同，也不能倒灌至历史 Forecast。

## 7.7 24-tick forcing coverage

标准 CAP-04 24 ticks：

```text
first issued_at:
2026-06-03T02:00:00.000Z

last issued_at:
2026-06-04T01:00:00.000Z
```

Forecast target union：

```text
2026-06-03T03:00:00.000Z
through
2026-06-07T01:00:00.000Z
```

共：

```text
95 unique target hours
```

每个 Forecast 必须独立绑定一个完整的 72-point matching weather/ET0 forcing-cycle pair。

## 7.8 Exact Replay selection fixture

对于 logical tick `T`，当前 Replay fixture 的正确 matching pair 为：

```text
issued_at:
T - PT1H15M

available_to_runtime_at:
T - PT55M

valid_from:
T

valid_to:
T + PT72H
```

其 72 个点覆盖：

```text
[T, T+1h]
...
[T+71h, T+72h]
```

S2 必须建立 exact fixture：

```text
FORECAST_AT_T_SELECTS_LATEST_AVAILABLE_MATCHING_FORCING_CYCLE
```

并证明：

```text
不选择在 T+PT5M 才可用的下一版 snapshot
不选择不能完整覆盖目标窗口的 snapshot
weather forcing_cycle_key == ET0 forcing_cycle_key
weather/ET0 source refs and hashes are exact Evidence identities
```

---

# 8. Runtime Config chain

## 8.1 不能使用单一静态 config 覆盖 24 ticks

现有 continuation contract 要求：

```text
current Runtime Config.parent_runtime_config_ref/hash
==
previous State.runtime_config_ref/hash
```

因此标准 24-tick range 必须建立 24 个 immutable Runtime Config objects：

```text
C1.parent = CAP-03 final State config
C2.parent = C1
C3.parent = C2
...
C24.parent = C23
```

每个 config 均通过：

```text
D_MODEL_GOVERNANCE_STEP_COMMIT
```

独立 canonical append。

每个 tick request 必须显式 pin：

```text
runtime_config_ref
runtime_config_hash
```

禁止：

```text
latest config implicit lookup
one config self-parent
one static config reused while violating parent chain
Runtime source dynamically mutating config
```

## 8.2 Config chain identity

每个 config 至少包含：

```text
config_purpose =
FORECAST_AND_THREE_SCENARIO_CONTINUATION_RUNTIME_V1

effective_logical_time

parent_runtime_config_ref
parent_runtime_config_hash

reality_binding_ref
reality_binding_hash

configuration_matrix_hash
geometry_semantic_hash
crop_stage_context_ref
crop_stage_context_hash

forecast_method_id
forecast_method_version
forecast_horizon_hours = 72
forecast_step_hours = 1

future_forcing_pair_policy_id
future_forcing_policy_id
future_forcing_fallback_policy_id
future_forcing_freshness_policy_id

uncertainty_propagation_method_id
forecast_interval_method_id

scenario_policy_id
scenario_option_ids

scenario_application_efficiency_policy:
  component_ref
  policy_id
  value
  parameter_class
  field_calibration_status

stress_threshold_policy:
  component_ref
  policy_id
  value
  comparator
  parameter_class
  field_calibration_status

physical_bound_policy_id
decimal_scale_policy_id
rounding_policy_id

soil_root_zone_config_refs
model_component_refs
```

不得出现没有独立 authority object 的悬空字段：

```text
scenario_application_efficiency_ref
scenario_application_efficiency_hash
stress_threshold_ref
stress_threshold_hash
```

## 8.3 Standard controlled Replay parameters

标准 fixture 冻结为 Runtime Config 内嵌 policy：

```yaml
scenario_application_efficiency_policy:
  component_ref:
    mcft_component_scenario_application_efficiency_v1

  policy_id:
    CONTROLLED_SCENARIO_APPLICATION_EFFICIENCY_V1

  value:
    1.000000

  parameter_class:
    CONTROLLED_SYNTHETIC

  field_calibration_status:
    NOT_FIELD_CALIBRATED

stress_threshold_policy:
  component_ref:
    mcft_component_available_water_stress_threshold_v1

  policy_id:
    CONTROLLED_AWF_STRESS_THRESHOLD_V1

  value:
    0.350000

  comparator:
    STRICT_LESS_THAN

  parameter_class:
    CONTROLLED_SYNTHETIC

  field_calibration_status:
    NOT_FIELD_CALIBRATED
```

权威关系：

```text
parameter semantic authority
=
pinned Runtime Config payload

parameter integrity authority
=
Runtime Config determinism_hash
```

两个 `component_ref` 必须进入 `model_component_refs`，其 policy payload 必须进入 Runtime Config semantic identity 和 determinism hash。

保留 nonclaims：

```text
NO_FIELD_CALIBRATED_SCENARIO_APPLICATION_EFFICIENCY
NO_FIELD_CALIBRATED_STRESS_THRESHOLD
```

## 8.4 Config chain determinism

同一：

```text
scope
effective logical time
parent ref/hash
semantic payload
```

必须生成同一 config object ID/hash。

同一 effective time + parent identity + 不同 payload：

```text
CONFIG_IDEMPOTENCY_CONFLICT
```

标准 S1 必须物化并验收完整 24-config chain。

---

# 9. Forecast 数学

## 9.1 Mean propagation

每个 horizon 复用 CAP-02 water-balance physical rules：

```text
previous_forecast_storage(h)
+ effective_precipitation_assumption(h)
+ assumed_baseline_irrigation(h)
- actual_crop_et(h)
- drainage(h)
- saturation_overflow(h)
=
forecast_storage(h)
```

Baseline：

```text
assumed_baseline_irrigation(h) = 0
```

每点必须记录：

```text
previous_storage_mm
gross_precipitation_assumption_mm
surface_runoff_mm
effective_precipitation_mm
assumed_irrigation_mm
reference_et0_mm
crop_stage_code
kc
requested_crop_et_mm
actual_crop_et_mm
unmet_crop_et_mm
drainage_mm
saturation_overflow_mm
storage_mean_mm
mass_balance_error_mm
```

Mass-balance internal error：

```text
exactly zero in fixed-point arithmetic
```

Published：

```text
0.000000
```

## 9.2 Available water fraction

```text
raw_available_water_fraction(h)
=
(
  storage_mean_mm(h)
  - wilting_point_storage_mm
)
/
(
  field_capacity_storage_mm
  - wilting_point_storage_mm
)
```

```text
available_water_fraction(h)
=
clamp(raw_available_water_fraction(h), 0, 1)
```

## 9.3 Depletion

```text
depletion_from_field_capacity_mm(h)
=
max(
  0,
  field_capacity_storage_mm
  - storage_mean_mm(h)
)
```

Storage computation basis是权威，禁止从 rounded VWC 反推 AWF/depletion。

## 9.4 Physical bounds

```text
0
<= storage_mean_mm(h)
<= saturation_storage_mm
```

必须记录：

```text
pre_bound_storage_mm
post_bound_storage_mm
lower_bound_applied
upper_bound_applied
overflow_mm
```

---

# 10. Forecast uncertainty

## 10.1 Capability claim boundary

v1 建立：

```text
deterministic mean trajectory
+
controlled additive process uncertainty budget
```

不建立：

```text
calibrated probabilistic Forecast
weather ensemble distribution
precipitation probability
calibrated confidence level
scenario compliance probability
```

## 10.2 Variance authority

```text
P_storage(0)
=
source posterior
computation_basis.storage_variance_mm2_decimal
```

如果 predecessor State 缺少该 computation basis：

```text
fail closed
```

不得从 rounded published VWC variance 重新构造。

## 10.3 Hourly variance increment

Forecast baseline：

```text
rainfall_variance_mm2(h)
=
(
  gross_precipitation_assumption_mm(h)
  × rainfall_relative_stddev
)²
```

```text
crop_et_variance_mm2(h)
=
(
  requested_crop_et_mm(h)
  × crop_et_relative_stddev
)²
```

```text
baseline_irrigation_variance_mm2(h)
=
0
```

```text
structural_variance_mm2(h)
=
structural_process_stddev_mm_per_hour²
```

```text
Q(h)
=
rainfall_variance_mm2(h)
+ crop_et_variance_mm2(h)
+ baseline_irrigation_variance_mm2(h)
+ structural_variance_mm2(h)
```

```text
P_storage(h)
=
P_storage(h-1)
+ Q(h)
```

冻结 assumptions：

```text
zero covariance
physical clipping does not reduce latent variance
runoff/drainage nonlinear sensitivity not separately propagated
```

## 10.4 Interval method

冻结：

```text
forecast_interval_method_id:
NORMAL_95_PERCENT_Z_1_96_V1

interval_semantics:
CONTROLLED_UNCALIBRATED_NORMAL_APPROXIMATION
```

每个 Forecast aggregate 必须保留：

```text
NO_CALIBRATED_FORECAST_PROBABILITY
NORMALITY_NOT_FIELD_VALIDATED
WEATHER_ENSEMBLE_UNCERTAINTY_NOT_MODELED
```

```text
storage_stddev_mm(h)
=
sqrt(P_storage(h))
```

```text
unclipped_interval_low_mm
=
storage_mean_mm - 1.96 × storage_stddev_mm
```

```text
unclipped_interval_high_mm
=
storage_mean_mm + 1.96 × storage_stddev_mm
```

```text
emitted_interval_low_mm
=
clamp(unclipped low, 0, saturation_storage_mm)
```

```text
emitted_interval_high_mm
=
clamp(unclipped high, 0, saturation_storage_mm)
```

必须记录：

```text
physical_bound_applied
lower_interval_bound_applied
upper_interval_bound_applied
```

Latent variance不得因 interval clipping 被改写。

## 10.5 Arithmetic and publication

```text
mean/storage internal scale:
10^-6 mm

variance internal scale:
10^-12 mm²

published decimal places:
6

rounding:
DECIMAL_HALF_AWAY_FROM_ZERO_V1
```

Square root必须使用受控 deterministic implementation，不得依赖平台差异造成 hash 漂移。

---

# 11. 三情景定义

Scenario Set 恰好包含：

```text
NO_ACTION
IRRIGATE_NOW_15MM
IRRIGATE_NOW_25MM
```

Scenario 使用 source Forecast 的：

```text
source posterior
forcing trace
crop-stage trajectory
physical model
Runtime Config
uncertainty method
```

不得重新选择 forcing snapshots。

## 11.1 NO_ACTION

```text
requested_irrigation_mm = 0.000000
effective_irrigation_mm = 0.000000
application_horizon = null
```

硬约束：

```text
NO_ACTION.trajectory_points
=
exact canonical deep copy of source Forecast.points
```

Scenario option metadata 必须位于 `trajectory_points` 之外，不得注入每个 trajectory point。

验收：

```text
canonicalJson(NO_ACTION.trajectory_points)
==
canonicalJson(sourceForecast.points)

sha256(canonicalJson(NO_ACTION.trajectory_points))
==
sha256(canonicalJson(sourceForecast.points))
```

NO_ACTION 不得重新计算出“近似相同”结果，也不得比较整个 Scenario option object 与 Forecast aggregate。

## 11.2 IRRIGATE_NOW_15MM

```text
requested_irrigation_mm = 15.000000
application_horizon = 1
application_interval = (T, T+PT1H]
epistemic_status = ASSUMED
execution_status = NOT_EXECUTED
```

## 11.3 IRRIGATE_NOW_25MM

```text
requested_irrigation_mm = 25.000000
application_horizon = 1
application_interval = (T, T+PT1H]
epistemic_status = ASSUMED
execution_status = NOT_EXECUTED
```

## 11.4 Application efficiency

```text
effective_irrigation_mm
=
requested_irrigation_mm
× Runtime Config.scenario_application_efficiency_policy.value
```

Standard controlled Replay：

```text
component_ref:
mcft_component_scenario_application_efficiency_v1

policy_id:
CONTROLLED_SCENARIO_APPLICATION_EFFICIENCY_V1

value:
1.000000

parameter_class:
CONTROLLED_SYNTHETIC

field_calibration_status:
NOT_FIELD_CALIBRATED
```

必须记录：

```text
efficiency component_ref
efficiency policy_id
efficiency value
parameter class
field calibration status
source Runtime Config ref/hash
limitations
```

不得记录无 authority object 的 efficiency ref/hash。

Scenario irrigation：

```text
is simulated assumption
is not executed evidence
does not enter canonical State
```

Scenario Runtime 禁止构造或消费伪造的：

```text
IRRIGATION_EXECUTION_EVIDENCE
executed_irrigation_candidates
receipt
as-executed record
```

CAP-02 物理方程可复用，但 irrigation 输入必须通过分离的纯 Domain adapter：

```text
State Dynamics adapter:
executed irrigation Evidence

Forecast adapter:
zero assumed irrigation

Scenario adapter:
simulated assumed irrigation
```

Scenario adapter 最低输入：

```text
assumed_irrigation_mm
source_forecast_ref
source_forecast_hash
runtime_config_ref
runtime_config_hash
scenario_policy_id
option_id
epistemic_status = ASSUMED
execution_status = NOT_EXECUTED
```

不得引入无法解析到 canonical Forecast、Runtime Config 或 frozen Scenario policy 的裸 `assumption_ref`。

共享 pure water-step kernel 不得自行读取 Evidence、数据库或 action lifecycle object。

## 11.5 Scenario uncertainty

v1 冻结：

```text
simulated irrigation amount is a deterministic assumption

scenario_assumed_irrigation_variance_mm2:
0
```

Scenario variance仍递推：

```text
previous scenario variance
+ rainfall variance
+ crop ET variance
+ structural variance
```

不加入：

```text
execution compliance variance
equipment variance
application-efficiency uncertainty
```

必须记录 limitation：

```text
SCENARIO_ACTION_COMPLIANCE_UNCERTAINTY_NOT_MODELED
```

## 11.6 Stress contract

Standard threshold 来自 pinned Runtime Config：

```text
component_ref:
mcft_component_available_water_stress_threshold_v1

policy_id:
CONTROLLED_AWF_STRESS_THRESHOLD_V1

value:
0.350000

comparator:
STRICT_LESS_THAN
```

判定：

```text
STRESS
iff
available_water_fraction
<
Runtime Config.stress_threshold_policy.value
```

相等时：

```text
NO_STRESS
```

```text
stress_hour_count
=
count of 72 target points where state = STRESS
```

```text
first_stress_target_time
=
first target_time where state = STRESS
```

无 stress：

```text
first_stress_target_time = null
stress_hour_count = 0
```

不得输出 calibrated stress probability。

## 11.7 每个 option 最低输出

```text
option_id
option_kind

source_forecast_ref
source_forecast_hash
source_posterior_ref
source_posterior_hash

runtime_config_ref
runtime_config_hash

requested_irrigation_mm
application_efficiency_fraction
effective_irrigation_mm
application_horizon
application_interval
epistemic_status
execution_status

72 trajectory points

minimum_available_water_fraction
first_stress_target_time
stress_hour_count
final_storage_mm

total_precipitation_mm
total_crop_et_mm
total_irrigation_mm
total_runoff_mm
total_drainage_mm
total_overflow_mm

difference_from_no_action

uncertainty_basis
assumption_basis:
  source_forecast_ref/hash
  runtime_config_ref/hash
  scenario_policy_id
  option_id
limitations
```

## 11.8 Difference from baseline

NO_ACTION：

```text
all deltas = 0
```

Irrigation options至少记录：

```text
final_storage_delta_mm
minimum_awf_delta
stress_hour_count_delta
total_irrigation_delta_mm
total_drainage_delta_mm
total_overflow_delta_mm
```

公式：

```text
option metric - NO_ACTION metric
```

`stress_hour_count_delta` 允许为负。

## 11.9 Scenario semantic identity

必须满足：

```text
Scenario.lineage_id
==
source Forecast.lineage_id

Scenario.revision_id
==
source Forecast.revision_id

Scenario.logical_time
==
source Forecast.logical_time

Scenario.runtime_config_ref/hash
==
source Forecast.runtime_config_ref/hash

Scenario.source_forecast_ref/hash
==
source Forecast.object_id/determinism_hash
```

Scenario option order冻结：

```text
1. NO_ACTION
2. IRRIGATE_NOW_15MM
3. IRRIGATE_NOW_25MM
```

---

# 12. Versioned contract authorities

## 12.1 Historical contracts immutable

必须保持：

```text
CAP-02 continuation V1
CAP-03 assimilated continuation V1
CAP-03 assimilated continuation V2
```

不可变。

## 12.2 CAP-04 contracts

```text
MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1
operation variant = A1_COMPLETED
member count = 8
```

```text
MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1
operation variant = A2_BLOCKED_FORECAST
member count = 8
```

```text
MCFT_CAP_04_THREE_SCENARIO_SET_V1
transaction = B_SCENARIO_COMMIT
member count = 1 canonical Scenario Set
```

## 12.3 Explicit validator dispatch

必须显式 dispatch：

```text
MCFT_CAP_02_CONTINUATION_V1
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2
MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1
MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1
MCFT_CAP_04_THREE_SCENARIO_SET_V1
```

禁止：

```text
payload-shape guessing
Forecast status inference as contract dispatch
silent fallback to older validator
```

---

# 13. Identity、idempotency 与唯一性

## 13.1 Terminal tick canonical uniqueness

A1 和 A2 必须共享：

```text
terminal_tick_uniqueness_key
=
scope
+ lineage_id
+ revision_id
+ logical_time
```

规则：

```text
existing A1 prevents later A2
existing A2 prevents later A1
same lineage/revision/logical_time permits one terminal State Tick only
```

Operation variant不得绕过 terminal uniqueness。

在任何新的 A1/A2 write 之前，必须执行 canonical terminal uniqueness authority：

```text
1. derive terminal_tick_uniqueness_key

2. query canonical facts for twin_runtime_tick_v1 by:
   scope + lineage_id + revision_id + logical_time

3. validate every matching canonical Tick envelope

4. zero matches:
   new operation may proceed

5. one match:
   read Tick.record_set_id and Tick.aggregate_determinism_hash

6. resolve the exact eight-member canonical aggregate:
   Evidence Window
   Transition
   Assimilation Update
   State
   Forecast
   Tick
   Checkpoint
   Health

7. validate all eight canonical envelopes

8. validate the complete cross-reference graph

9. recompute every member determinism hash

10. recompute aggregate determinism hash

11. same operation variant + same aggregate:
    EXISTING_IDEMPOTENT_SUCCESS

12. different operation variant or different aggregate:
    TERMINAL_TICK_CONFLICT

13. more than one canonical terminal Tick:
    CANONICAL_TERMINAL_UNIQUENESS_VIOLATION
```

S1 必须冻结 Tick 作为 canonical recovery root。Tick 必须能够提供：

```text
record_set_id
aggregate_determinism_hash
operation_variant

evidence_window_ref
state_transition_ref
assimilation_update_ref
posterior_state_ref
forecast_result_ref
checkpoint_ref
```

Runtime Health 不新增 `health_ref` 到 Tick。它必须通过 canonical reverse lookup 恢复：

```text
health.payload.tick_ref
==
Tick.object_id

exactly one matching canonical Health required
```

若 frozen `twin_runtime_tick_v1` 无法表达 `record_set_id`、aggregate hash、operation variant 或上述六个直接引用，S1 必须停止并提出独立 DT-02 Amendment。Health 的唯一反向查找是本任务线冻结的合法八成员恢复方式；不得把恢复算法留给 projection 或进程内缓存。

Projection unique indexes只能作为并发 guard 和 rebuildable read optimization，不能替代 canonical facts authority。

如果同 tick 需要基于 late evidence 重算：

```text
must use revision lineage
must not rewrite active lineage history
```

## 13.2 A1/A2 operation key

```text
scope
lineage_id
revision_id
logical_time
operation_variant
```

## 13.3 A1/A2 aggregate hash

至少包含：

```text
operation key
previous State ref/hash
previous checkpoint ref/hash
previous Forecast result ref/hash
Runtime Config ref/hash
Evidence Window hash
assimilation update hash
posterior State hash
forcing window hash
Forecast points hashes
Tick/checkpoint/health hashes
```

行为：

```text
same key + same aggregate hash
→ EXISTING_IDEMPOTENT_SUCCESS

same key + different aggregate hash
→ IDEMPOTENCY_CONFLICT
```

即使 idempotency projection 丢失，canonical terminal uniqueness仍必须阻止第二个 tick。

## 13.4 B Scenario canonical uniqueness and operation idempotency

### Canonical uniqueness key

```text
scenario_set_uniqueness_key
=
source_forecast_ref
+ source_forecast_hash
+ lineage_id
+ revision_id
```

同一 successful Forecast 在同一 lineage/revision 下只能存在一个 canonical Scenario Set。

### Operation idempotency key

```text
source_forecast_ref
+ source_forecast_hash
+ scenario_policy_id
+ runtime_config_ref
+ runtime_config_hash
```

提交 B 前必须先按 `scenario_set_uniqueness_key` 查询 canonical `twin_scenario_set_v1` facts。

行为：

```text
no existing Scenario Set
→ new B may proceed

same canonical uniqueness + same aggregate
→ EXISTING_IDEMPOTENT_SUCCESS

same canonical uniqueness + different policy/config/hash
→ SCENARIO_SET_CANONICAL_CONFLICT

more than one canonical Scenario Set for same uniqueness key
→ CANONICAL_SCENARIO_SET_UNIQUENESS_VIOLATION
```

不得通过更换 policy/config 在同一 source Forecast 下追加第二个 Scenario Set。

如需用新 policy 重算历史 Forecast：

```text
must use revision lineage
must not append a second Scenario Set under the same source Forecast
```

Projection unique index只能作为并发 guard 和 rebuildable read optimization，不能替代 canonical facts authority。
---

# 14. Failure classification

## 14.1 Forecast BLOCKED → A2

只有安全、预期、可解释的 prerequisite 不满足才可 BLOCKED，例如：

```text
source State.forecast_source_eligible = false

完整 coherent 72h weather snapshot 不可用

完整 coherent 72h ET0 snapshot 不可用

future forcing policy 明确禁止 fallback
```

结果：

```text
A2_BLOCKED_FORECAST
points = []
reason_codes non-empty
checkpoint advances
latest Forecast result advances
latest successful Forecast unchanged
Scenario not expected
range stops explicitly
```

Scenario-only prerequisite缺失不得让 Forecast BLOCKED。

例如：

```text
stress threshold missing
scenario efficiency missing
scenario policy invalid
```

这些应在 A1 成功后导致 B failure。

## 14.2 Forecast FAILED → no terminal tick

以下属于 FAILED：

```text
malformed forcing canonical payload
forcing semantic hash mismatch
conflicting forcing snapshot
Runtime Config ref/hash mismatch
Forecast model component not present in pinned config
Forecast model component version mismatch
Runtime Config purpose mismatch
Runtime Config parent mismatch
non-contiguous horizon generated
duplicate horizon generated
mass-balance invariant failure
arithmetic invariant failure
canonical graph invalid
A1 persistence failure
terminal uniqueness conflict
```

结果：

```text
no terminal Tick
no checkpoint advance
no A1/A2 partial canonical writes
optional F operational audit permitted
twin_forecast_failure_v1 permitted
```

## 14.3 Scenario failure

```text
A1 remains committed
source Forecast remains successful
no partial Scenario Set
scenario latest unchanged
next standard range tick blocked by PENDING_SCENARIO_RECOVERY
```

恢复顺序：

```text
previous checkpoint.forecast_result_ref
→ resolve exact immediately previous terminal-tick Forecast
→ if COMPLETED and scenario_eligible = true:
     detect exact source-Forecast Scenario Set
     retry B idempotently when missing
→ verify canonical readback
→ then execute next State Tick
```

`forecast successful latest` 只用于 successful Forecast read model，不得作为 Scenario recovery 的主权威。

## 14.4 Response-loss recovery

必须证明：

```text
A1 commit succeeded, response lost
→ retry returns same eight-object set
→ no duplicate facts/projections

B commit succeeded, response lost
→ retry returns same Scenario Set
→ no duplicate facts/projections
```

---

# 15. Runtime execution order

## 15.1 Single tick

```text
1. Read persisted predecessor handoff
2. Verify no pending Scenario recovery barrier
3. Verify requested logical time is persisted next tick
4. Resolve explicitly pinned Runtime Config ref/hash
5. Verify config parent ref/hash equals previous State config ref/hash
6. Load current-tick Evidence candidates
7. Build CAP-03 V2 observation-aware Evidence Window
8. Execute CAP-02 Dynamics
9. Execute CAP-03 observation selection and assimilation
10. Build posterior State
11. Select coherent future weather snapshot
12. Select coherent future ET0 snapshot
13. Build canonical 72-point forcing window
14. Execute pure 72-hour Forecast
15. Build A1 or A2 candidate record set
16. Validate physical invariants and complete graph
17. Compute terminal uniqueness key
18. Compute operation key and aggregate hash
19. Idempotency lookup
20. New operation: acquire lease
21. Begin transaction
22. Revalidate fencing, lineage, revision and expected pointers
23. Revalidate terminal tick canonical uniqueness
24. Commit A1 or A2 atomically
25. Read canonical record set back
26. If A2: stop with explicit BLOCKED result
27. If A1: build three Scenario trajectories
28. Validate Scenario Set
29. Commit B transaction
30. Read Scenario Set back
31. Prepare next persisted handoff
```

## 15.2 Range

Range必须在每个 tick 开始前读取：

```text
previous checkpoint.forecast_result_ref
```

并解析立即前一个 terminal tick 的 exact Forecast result。

判定规则：

```text
if previous Forecast.status == COMPLETED
and previous Forecast.scenario_eligible == true:
  exact source Forecast Scenario Set is required

if previous Forecast.status == BLOCKED:
  no Scenario Set is expected
  no pending-B recovery barrier
```

如果：

```text
previous exact Forecast is COMPLETED
+
expected Scenario Set is missing
```

先恢复该 exact source Forecast 的 B。

禁止：

```text
使用 forecast successful latest
替代 previous checkpoint.forecast_result_ref
```

因为 A2 后 `forecast successful latest` 仍可能指向更早的 A1 Forecast。

如果：

```text
previous tick was A2 BLOCKED
```

其 Scenario 不属于缺失；range已在该 tick 停止。后续新 invocation 可从 checkpoint.next_tick 开始。
---

# 16. Delivery Slice Graph

严格 merge-before-next：

```text
P0  CAP-03 Global SSOT Reconciliation
↓
S0  CAP-04 Authorization and Predecessor Lock
↓
S1  Forecast / Scenario Contracts, Config Chain and Dispatch
↓
S2  Future Forcing Window and No-Future-Leakage
↓
S3  Pure 72-Hour Forecast Math
↓
S4  Pure Three-Scenario Math
↓
S5A A1/A2 Record-Set Builders
↓
S5B A1/A2 + B Persistence, Uniqueness and Recovery
↓
S6  Single-Tick Forecast and Scenario Integration
↓
S7  24-Tick Forecast / Scenario Regeneration Range
↓
S8  Restart, Backfill and Failure Recovery
↓
S9  Capability Closure Candidate
↓
S10 Finalization and Main Verification — mandatory three-stage effectiveness lifecycle
```

## P0

```text
MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1
```

只修全局治理镜像。

## S0

```text
MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1
```

只允许：

```text
task
authorization
predecessor DB preflight
predecessor lock
delivery SSOT
authorization Gate
```

不允许 Runtime source。

## S1

```text
MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1
```

产出：

```text
A1 contract
A2 contract
B contract
Forecast point contract
Scenario option contract
24-config chain compiler/materializer
D transaction config persistence
explicit validator dispatch
terminal uniqueness contract
Scenario Set canonical uniqueness contract
positive/negative acceptance
```

## S2

```text
MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1
```

产出：

```text
joint matching weather/ET0 forcing-cycle pair selector
forcing_cycle_key derivation and equality validation
72-point forcing DTO
no-future-leakage
duplicate/conflict rules
forcing_window_hash
95-hour range fixture
FORECAST_AT_T_SELECTS_LATEST_AVAILABLE_MATCHING_FORCING_CYCLE exact fixture
```

## S3

```text
MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1
```

产出：

```text
72-step fixed-point mean propagation
storage-basis AWF/depletion
additive variance propagation
95% interval
physical bounds
mass-balance proof
Domain purity
exact fixtures
```

## S4

```text
MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1
```

产出：

```text
NO_ACTION identity
15mm option
25mm option
application efficiency
scenario uncertainty policy
stress summary
difference-from-baseline
no recommendation/action behavior
```

## S5A

```text
MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1
```

产出：

```text
A1 eight-object builder
A2 eight-object builder
strict status/variant separation
complete cross-reference validation
terminal uniqueness identity
aggregate identity/hash
no DB access
```

## S5B

```text
MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1
```

产出：

```text
A1 atomic persistence
A2 atomic persistence
B atomic persistence
cross-variant terminal uniqueness guard
canonical eight-member aggregate recovery from Tick root
Scenario Set canonical uniqueness guard
idempotency guards
Forecast/Scenario projections
pending Scenario recovery detection
canonical readback
projection rebuild
fault injection
```

S5B 必须包含 exactly one additive CAP-04 migration。

该 migration 最低职责冻结为：

```text
extend twin_object_idempotency_index_v1 identity_kind with:
A1_RECORD_SET
B_SCENARIO_SET

create or extend rebuildable canonical Runtime projections under:
apps/server/src/projections/twin_runtime/**

for:
Forecast run
Forecast point
Scenario Set
Scenario point
latest Scenario

projection authority:
new twin_runtime Forecast / Scenario projections are authoritative
legacy root_zone_irrigation_scenario_set_index_v1 remains compatibility-only
legacy projection is not canonical truth and is not a CAP-04 write authority

create or support:
cross-variant terminal tick uniqueness authority
```

不得建立第二套 canonical store。所有 projection 仍可由 append-only facts 重建。

## S6

```text
MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1
```

标准链：

```text
persisted CAP-03 handoff
→ current Evidence
→ Dynamics
→ Assimilation
→ posterior State
→ joint matching forcing-cycle pair
→ successful 72h Forecast
→ A1 commit
→ three Scenario options
→ B commit
→ readback
→ T+1 handoff
```

## S7

```text
MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1
```

标准结果：

```text
24 new posterior States
24 successful Forecast Runs
24 Scenario Sets

1728 Forecast points
5184 Scenario points

24 Runtime Config canonical facts established in S1

192 A1 canonical facts created by S7 range
24 B canonical facts created by S7 range
216 canonical facts created by S7 range operation

240 canonical facts across standard S1 config chain + S7 range execution

operational F audit facts are excluded from successful standard-path counts

checkpoint sequence:
49..72

global State count:
73

next tick:
2026-06-04T02:00:00.000Z
```

所有 24 ticks 必须是 A1；closure fixture 不允许 A2。

## S8

```text
MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1
```

证明：

```text
ticks 1–12 in process 1
ticks 13–24 in fresh process
restart hashes == uninterrupted hashes
bounded backfill hashes == uninterrupted hashes
A1 response-loss idempotency
B response-loss idempotency
A1 success/B failure recovery barrier
A2 blocked stop behavior
cross-variant uniqueness
stale fencing rejection
CAS conflict rejection
projection divergence fail closed
explicit rebuild
```

## S9

```text
MCFT-CAP-04.CLOSURE-CANDIDATE-V1
```

聚合证据但不激活 completion claims。

## S10

```text
MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1

mandatory_lifecycle:
S10A_CANDIDATE
+
S10B_MAIN_VERIFICATION
+
S10C_POSTMERGE_EFFECTIVENESS_RECONCILIATION
```

### S10A — Closure and Finalization Candidate

S10A 形成 closure/finalization candidate：

```text
completion claims remain pending
status is not COMPLETE
implementation_status is not COMPLETE
S10A exact-head CI must pass
```

S10A merge 后，S10B 必须从已合并的 S10A main 读取并记录：

```text
S10A exact-head commit
S10A exact-head CI
S10A merge commit
S10A head-to-merge tree equivalence
```

### S10B — Main Verification Candidate

S10B 基于 S10A merged main。

`GEOX-MCFT-CAP-04-MAIN-VERIFICATION.json` 的验证主语冻结为：

```yaml
verification_subject:
  S10A_MERGED_MAIN

verification_subject_commit:
  <S10A merge commit>

effectiveness_subject:
  S10B_FINALIZATION_MERGE

effectiveness_evidence_location:
  S10C_REPOSITORY_ARTIFACT
```

S10B 只能准备 conditioned finalization state，不得在 premerge、exact-head 或 merge 前宣称 effectiveness 已满足。

S10B repository artifact 必须明确：

```text
effectiveness_condition:
S10B_MERGED_AND_POSTMERGE_FINALIZATION_GATE_PASS_AND_S10C_RECONCILED

effectiveness_condition_satisfied:
false
```

### S10C — Finalization Effectiveness Reconciliation

S10B 合并后，Finalization Gate 必须在实际 S10B merge commit 上运行。随后 S10C 独立 PR 必须把以下证据写回仓库：

```text
S10B PR number
S10B exact head commit
S10B exact-head CI result
S10B merge commit
S10B head-to-merge tree equivalence
postmerge Finalization Gate result
postmerge Finalization Gate subject commit
```

只有同时满足：

```text
S10B merged to main
+
postmerge Finalization Gate PASS on the actual S10B merge commit
+
S10C evidence PR merged to main
+
S10C merged-main reconciliation Gate PASS
```

仓库内 effective state 才允许成为：

```text
status = COMPLETE
implementation_status = COMPLETE
active_delivery_slice_id = null
pending_completion_claims = []
effective_completion_claims = frozen set
successor_authorized = false
```

S10C 是 repository-verifiable effectiveness authority。外部 check 可提供执行证据，但不能替代仓库内最终 reconciliation artifact。
---

# 17. Deliverables

```text
docs/digital_twin/mcft/cap_04/
  GEOX-MCFT-CAP-04-TASK.md
  GEOX-MCFT-CAP-04-P0-STATUS.json
  GEOX-MCFT-CAP-04-AUTHORIZATION.md
  GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json
  GEOX-MCFT-CAP-04-PREDECESSOR-LOCK.json
  GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json
  GEOX-MCFT-CAP-04-RUNTIME-CONFIG-CONTRACT.json
  GEOX-MCFT-CAP-04-RUNTIME-CONFIG-CHAIN.json
  GEOX-MCFT-CAP-04-FUTURE-FORCING-CONTRACT.json
  GEOX-MCFT-CAP-04-FORECAST-CONTRACT.json
  GEOX-MCFT-CAP-04-SCENARIO-CONTRACT.json
  GEOX-MCFT-CAP-04-PERSISTENCE-MATRIX.json
  GEOX-MCFT-CAP-04-FAILURE-RECOVERY-CONTRACT.md
  GEOX-MCFT-CAP-04-CLOSURE-RECORD.json
  GEOX-MCFT-CAP-04-MAIN-VERIFICATION.json
  GEOX-MCFT-CAP-04-FINALIZATION-EFFECTIVENESS.json

fixtures/mcft/water_state/expected/
  MCFT_CAP_04_SINGLE_TICK_FORECAST_EXPECTED.json
  MCFT_CAP_04_SINGLE_TICK_SCENARIOS_EXPECTED.json
  MCFT_CAP_04_24_TICK_EXPECTED.json
  MCFT_CAP_04_CONFIG_CHAIN_EXPECTED.json

fixtures/mcft/water_state/negative/
  MCFT_CAP_04_NEGATIVE_FIXTURES.json

apps/server/src/domain/twin_runtime/**
apps/server/src/domain/soil_water/**
apps/server/src/runtime/twin_runtime/**
apps/server/src/persistence/twin_runtime/**
apps/server/src/projections/twin_runtime/**
apps/server/src/adapters/twin_runtime/**

apps/server/scripts/mcft/
  MCFT_CAP_04_FORECAST_SCENARIO_RUNNER.ts

scripts/runtime_acceptance/
  ACCEPTANCE_MCFT_CAP_04_PREDECESSOR_PREFLIGHT.ts
  ACCEPTANCE_MCFT_CAP_04_CONTRACTS_CONFIG.ts
  ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING.ts
  ACCEPTANCE_MCFT_CAP_04_FORECAST_MATH.ts
  ACCEPTANCE_MCFT_CAP_04_SCENARIO_MATH.ts
  ACCEPTANCE_MCFT_CAP_04_PERSISTENCE_DB.ts
  ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK.ts
  ACCEPTANCE_MCFT_CAP_04_24_TICK.ts
  ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL.ts
  ACCEPTANCE_MCFT_CAP_04_FAILURE_RECOVERY.ts

scripts/governance_acceptance/
  ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs
  ACCEPTANCE_MCFT_CAP_04_AUTHORIZATION.cjs
  ACCEPTANCE_MCFT_CAP_04_CLOSURE.cjs
  ACCEPTANCE_MCFT_CAP_04_FINALIZATION_EFFECTIVENESS.cjs
```

---

# 18. Changed-file boundary

## 18.1 Capability-wide allowed paths

```text
docs/digital_twin/mcft/cap_04/**
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md

apps/server/src/domain/soil_water/**
apps/server/src/domain/twin_runtime/**
apps/server/src/runtime/twin_runtime/**
apps/server/src/persistence/twin_runtime/**
apps/server/src/projections/twin_runtime/**
apps/server/src/adapters/twin_runtime/**

apps/server/db/migrations/<exact CAP-04 additive migration>

apps/server/scripts/mcft/
MCFT_CAP_04_FORECAST_SCENARIO_RUNNER.ts

fixtures/mcft/water_state/expected/MCFT_CAP_04_*
fixtures/mcft/water_state/negative/MCFT_CAP_04_*

scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_*
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_*

apps/server/package.json
only for exact runner command
```

## 18.2 Forbidden paths/changes

```text
apps/web/**
public generated-object write routes
CAP-03 historical canonical facts
CAP-03 R4 final verification evidence
CAP-03 V1/V2 contract rewrites
MCFT-00 authority artifacts
Replay Evidence historical bytes

Forecast Residual Runtime
Recommendation
Decision
AO-ACT
Calibration
Shadow Evaluation
Model Activation
Late-Evidence Revision
Scheduler
workflow changes not explicitly authorized
```

Capability-wide allowance不等于单 slice 可修改全部目录。每个 slice必须冻结 exact changed files。

---

# 19. Hard acceptance

## A. Governance and predecessor

1. P0 SSOT reconciliation merged and effective.
2. CAP-03 status = COMPLETE.
3. CAP-03 implementation_status = COMPLETE.
4. CAP-03 verified_on_main = true.
5. CAP-03 active delivery slice = null.
6. CAP-03 pending claims = [].
7. CAP-03 remaining findings = 0.
8. CAP-04 remains unauthorized before S0.
9. S0 predecessor lock comes from PostgreSQL canonical read path.
10. checkpoint sequence = 48.
11. next tick = `2026-06-03T02:00:00.000Z`.
12. latest successful Forecast = null.
13. active lineage object ref and semantic lineage ID are distinguished.
14. State/checkpoint/Forecast/config refs and hashes all agree.
15. predecessor mismatch fails closed.
16. S0 merged-main authorization Gate passes before Runtime source.

## B. Config chain

17. Exactly 24 CAP-04 immutable Runtime Config objects exist for standard range.
18. C1 parent is CAP-03 final config.
19. Cn parent is C(n-1), n=2..24.
20. Every tick request pins config ref and hash.
21. Config effective logical time matches tick.
22. Same config input is idempotent.
23. Same effective time/parent with different payload conflicts.
24. No implicit latest-config selection.
25. Config includes Forecast method/version.
26. Config includes forcing policies.
27. Config includes uncertainty/interval methods.
28. Config includes Scenario policy/options.
29. Config includes the complete embedded scenario application-efficiency policy and component ref.
30. Config includes the complete embedded stress-threshold policy, comparator and component ref.
31. Controlled synthetic parameters are labeled not field calibrated.

## C. Current State tick and assimilation

32. Every CAP-04 tick continues CAP-03 V2 observation-aware path.
33. MCFT-07 observation selection remains active.
34. Dynamics executes before assimilation.
35. Posterior State is produced before Forecast.
36. A1/A2 contains one assimilation update.
37. Runtime Config explicit ref/hash pin is enforced.
38. No CAP-03 V1/V2 historical contract is modified.

## D. Forecast time and structure

39. Forecast has exactly 72 points when COMPLETED.
40. First target is T+1h.
41. Last target is T+72h.
42. T is not a Forecast point.
43. Horizons are exactly 1..72.
44. Target times are UTC hour aligned.
45. No gap.
46. No duplicate.
47. No overlap.
48. target_time matches issued_at + horizon.
49. Same semantic input rerun gives same hash.

## E. Forcing

50. Exactly one weather snapshot participates in the selected matching forcing-cycle pair.
51. Exactly one ET0 snapshot participates in the selected matching forcing-cycle pair.
52. Weather and ET0 forcing_cycle_key values are exactly equal.
53. Both snapshots are available at T and cover the exact same 72 intervals.
54. Cross-snapshot stitching and cross-cycle pairing are forbidden.
55. Joint pair selection order is deterministic.
56. Identical duplicates collapse deterministically.
57. Conflicting snapshots fail with no terminal write.
58. Future actual rainfall does not leak.
59. Future actual ET0 does not leak.
60. Future soil observation does not leak.
61. Future forecast revision does not leak.
62. forcing window hash is independently reproducible.
63. Forecast stores exact Evidence source_record_id/source_record_hash identities for both snapshots, and envelope evidence_refs contains both selected source_record_id values.
64. Scenario reuses source Forecast forcing and never reselects a forcing pair.
65. Exact Replay fixture proves Forecast at T selects the latest available matching forcing cycle, not the T+5m unavailable cycle; the 24-tick target union still covers 95 unique target hours.

## F. Forecast math

66. Point 1 starts from source posterior computation basis.
67. Each point consumes previous Forecast point.
68. Baseline assumed future irrigation is zero.
69. CAP-02 physical rules are reused.
70. Each point mass balance closes exactly.
71. Storage is physically bounded.
72. Runoff is explicit.
73. Drainage is explicit.
74. Overflow is explicit.
75. AWF is storage-basis and reproducible.
76. Depletion is storage-basis and reproducible.
77. Domain has no DB access.
78. Domain has no wall clock.
79. Domain does not mutate input.
80. 72-point semantic hash is independently reproducible.

## G. Forecast uncertainty

81. P(0) comes from posterior storage variance computation basis.
82. Missing computation basis fails closed.
83. Hourly rainfall variance is explicit.
84. Hourly ET variance is explicit.
85. Baseline irrigation variance is zero.
86. Structural variance is explicit.
87. Zero covariance assumption is explicit.
88. P(h)=P(h-1)+Q(h).
89. Latent variance is not clipped.
90. Interval method is z=1.96 controlled uncalibrated normal approximation; it is not a calibrated probability claim.
91. Unclipped and emitted intervals are recorded.
92. Bound metadata is complete.
93. Fixed-point scales are deterministic.
94. Published values use six decimals.
95. Rounding is HALF_AWAY_FROM_ZERO.

## H. Scenario math

96. Scenario Set has exactly three options.
97. Option order is fixed.
98. NO_ACTION requested/effective amount is zero.
99. NO_ACTION.trajectory_points is an exact canonical deep copy of source Forecast.points; option metadata remains outside trajectory_points.
100. 15mm requested amount is exact.
101. 25mm requested amount is exact.
102. Both irrigation options apply at horizon 1.
103. Efficiency formula is explicit.
104. Standard efficiency is 1.000000.
105. Irrigation options are ASSUMED / NOT_EXECUTED.
106. Scenario action variance is zero in v1.
107. Scenario limitation records compliance uncertainty not modeled.
108. Stress threshold is explicit.
109. Standard threshold is 0.350000.
110. STRESS uses strict `<`.
111. first stress time/null semantics are correct.
112. stress hour count counts Forecast targets.
113. Every option has 72 points.
114. Resource totals are reproducible.
115. Difference-from-baseline fields are reproducible.
116. Scenario creates no Recommendation.
117. Scenario creates no Decision.
118. Scenario creates no AO-ACT.

## I. A1/A2 canonical graph

119. A1 record set has exactly 8 objects.
120. A2 record set has exactly 8 objects.
121. A1 only permits COMPLETED Forecast.
122. A2 only permits BLOCKED Forecast.
123. A1 Tick = COMPLETED.
124. A2 Tick = COMPLETED_WITH_LIMITATIONS.
125. Forecast source posterior is same-tick posterior.
126. Tick references Forecast.
127. Checkpoint references Forecast.
128. Health references Tick/State/Forecast/checkpoint.
129. Runtime Config refs/hashes agree across all members.
130. lineage/revision agree across all members.
131. Complete cross-reference graph validates.
132. Fact ID and created_at do not affect semantic hashes.

## J. Terminal uniqueness and idempotency

133. A1/A2 share terminal uniqueness key.
134. Existing A1 blocks same-tick A2.
135. Existing A2 blocks same-tick A1.
136. Same A1 key/hash returns existing success.
137. Same A1 key/different hash conflicts.
138. Same A2 key/hash returns existing success.
139. Same A2 key/different hash conflicts.
140. Projection loss triggers Tick-rooted six-direct-ref plus unique Health reverse-lookup eight-member canonical aggregate recovery and does not permit a second terminal tick.
141. Idempotent retry acquires no second lease.
142. Idempotent retry adds no facts.
143. Idempotent retry adds no projections.
144. Response-loss returns identical object IDs/hashes.

## K. B persistence and recovery

145. B source is COMPLETED Forecast only, and Scenario Set canonical uniqueness is keyed independently from operation idempotency.
146. Scenario identity includes source Forecast ref/hash.
147. Scenario config equals source Forecast config.
148. Scenario lineage/revision/logical time equal source Forecast.
149. Same Scenario canonical uniqueness plus same aggregate returns existing success.
150. Same Scenario canonical uniqueness plus different policy/config/hash returns SCENARIO_SET_CANONICAL_CONFLICT.
151. B fault writes no partial Scenario Set.
152. B failure does not rollback A1.
153. B failure does not advance latest Scenario.
154. A1 success/B missing creates a recovery barrier resolved from previous checkpoint.forecast_result_ref.
155. Next standard range tick does not use forecast-success-latest as recovery authority and does not bypass the exact previous-Forecast barrier.
156. B recovery completes before next tick.
157. A2 BLOCKED does not create false pending-B state.

## L. 24-tick range

158. Exactly 24 new posterior States.
159. Exactly 24 successful Forecast Runs.
160. Exactly 24 Scenario Sets.
161. Exactly 1728 Forecast points.
162. Exactly 5184 Scenario points.
163. Exactly 192 A1 facts.
164. Exactly 24 B facts.
165. Exactly 216 canonical facts are created by the S7 range operation, and exactly 240 canonical facts exist across the standard S1 config chain plus S7 range execution.
166. checkpoint sequence = 49..72.
167. global State count = 73 within frozen lineage/revision.
168. next tick = `2026-06-04T02:00:00.000Z`.
169. Every closure-range tick is A1.
170. No closure-range tick is A2.
171. Completed range retry adds zero writes.

## M. Restart/backfill/failure recovery

172. Process 1 commits ticks 1–12.
173. Fresh process commits ticks 13–24.
174. Restart terminal hashes equal uninterrupted run.
175. Bounded backfill hashes equal uninterrupted run.
176. A1 response-loss recovery is idempotent.
177. B response-loss recovery is idempotent.
178. A1 success/B failure recovers correctly.
179. A2 BLOCKED stops range explicitly.
180. Stale fencing fails closed.
181. Lease expiry fails closed.
182. State CAS conflict fails closed.
183. Forecast result CAS conflict fails closed.
184. Successful Forecast CAS conflict fails closed.
185. Checkpoint CAS conflict fails closed.
186. Scenario latest CAS conflict fails closed.
187. Projection divergence fails closed.
188. Explicit rebuild restores equivalent authoritative twin_runtime projections; legacy root-zone Scenario projection remains compatibility-only.
189. Fault injection leaves no current-operation partial writes.

## N. Boundaries and closure

190. No Forecast Residual is created.
191. No Recommendation is created.
192. No Policy Evaluation is created.
193. No Decision is created.
194. No Action is created.
195. No Calibration Candidate is created.
196. No Shadow Evaluation is created.
197. No Model Activation is created.
198. No late-evidence revision is created.
199. No scheduler is created.
200. No public generated-object write route is created.
201. Operator web pages are not modified.
202. Gate A is not claimed.
203. Minimum Complete Field Twin is not claimed.
204. S10A candidate keeps claims pending and does not mark the capability COMPLETE.
205. MAIN-VERIFICATION verifies S10A_MERGED_MAIN.
206. CAP-05 remains unauthorized.
207. S10A exact-head CI and head-to-merge tree equivalence pass.
208. S10B repository artifacts keep effectiveness_condition_satisfied=false before merge.
209. S10B postmerge Finalization Gate passes on the actual S10B merge commit.
210. S10C records the actual S10B merge commit, exact-head CI, tree equivalence and postmerge Gate.
211. S10C merged-main reconciliation Gate passes before completion claims become effective.
212. Working tree is clean.

---

# 20. Required negative tests

```text
P0 not effective
CAP-03 not COMPLETE
CAP-03 remaining findings nonzero
CAP-04 unauthorized Runtime write

wrong predecessor checkpoint
wrong predecessor State
wrong active lineage ref
wrong semantic lineage ID
wrong revision
wrong predecessor Forecast result
non-null unexpected successful Forecast
wrong predecessor config ref/hash

config chain gap
config chain parent mismatch
config effective-time mismatch
same config identity different payload
implicit latest config selection

MCFT-07 omitted from tick
assimilation bypassed
Forecast generated from propagated prior instead of posterior
Runtime Config hash pin missing

weather snapshot unavailable at T
ET0 snapshot unavailable at T
weather/ET0 forcing_cycle_key mismatch
weather/ET0 issued_at mismatch
weather/ET0 available_to_runtime_at mismatch
weather/ET0 valid_from/to mismatch
weather cycle N paired with ET0 cycle N-1
snapshot_ref is not Evidence.source_record_id
snapshot_hash is not Evidence.source_record_hash
weather coverage 71 points
ET0 coverage 73 points
forcing gap
forcing overlap
cross-snapshot stitching
future actual weather leakage
future forecast revision leakage
conflicting weather snapshot
conflicting ET0 snapshot
forcing hash mismatch

Forecast includes T as point
horizon 0
missing horizon
duplicate horizon
non-hour target
wrong target/horizon relation
Forecast COMPLETED with 71 or 73 points
Forecast BLOCKED through A1
Forecast COMPLETED through A2

mass-balance mismatch
storage below zero
storage above saturation after bounds
AWF from rounded VWC
depletion from rounded VWC
missing storage variance basis
variance decreases
wrong interval multiplier
latent variance altered by clipping
wrong rounding mode

Scenario source is BLOCKED Forecast
Scenario reselects forcing
Scenario has 2 or 4 options
wrong option order
NO_ACTION differs from Forecast
15mm requested amount wrong
25mm requested amount wrong
application at wrong horizon
efficiency missing
efficiency policy component/value mismatch or Runtime Config determinism hash mismatch
stress threshold missing
stress equality classified as STRESS
first stress time wrong
difference-from-baseline sign wrong
Scenario creates Recommendation/Decision/AO-ACT
Scenario synthesizes or consumes IRRIGATION_EXECUTION_EVIDENCE

same tick A1 after A2
same tick A2 after A1
idempotency projection deleted then second terminal tick accepted
Tick found but eight-member canonical aggregate is not reconstructed and validated
Tick aggregate member hash mismatch accepted
same A1 key different hash accepted
second Scenario Set for same source Forecast under different policy/config accepted
same Scenario canonical uniqueness different aggregate accepted
same B operation key different hash accepted

A1 partial fact injection
A1 partial projection injection
A2 partial fact injection
B partial trajectory injection
A1 success/B failure bypassed
Scenario recovery uses forecast successful latest instead of previous checkpoint.forecast_result_ref
A2 falsely treated as missing Scenario
response-loss duplicate write
stale fencing
lease expired
checkpoint CAS conflict
State CAS conflict
Forecast CAS conflict
Scenario CAS conflict
projection divergence silently repaired

public Runtime write route introduced
scheduler introduced
web modified
Gate A claimed
Minimum Complete Field Twin claimed
S10B premerge artifact claims its own final merge SHA or effectiveness
MAIN-VERIFICATION verifies the wrong merge subject
S10C missing actual S10B merge SHA
S10C accepts failed or wrong-subject postmerge Gate
S10C marks completion before its own merged-main reconciliation Gate
CAP-05 auto-authorized
```

每个 negative fixture 必须包含：

```text
fixture_id
expected_reason_code
expected_failure_stage

expected_no_current_operation_partial_canonical_write
expected_no_current_operation_partial_projection_write

expected_checkpoint_behavior
expected_state_latest_behavior
expected_forecast_latest_behavior
expected_successful_forecast_behavior
expected_scenario_latest_behavior
expected_active_lineage_behavior

optional_operational_audit_allowed
```

---

# 21. Completion Claims

只有 S10C merged-main Finalization effectiveness reconciliation 生效后允许激活：

```text
MCFT_CAP_04_COMPLETE

SUCCESSFUL_72_HOUR_FORECAST_RUNTIME_ESTABLISHED

EXACT_72_POINT_FORECAST_HORIZON_ESTABLISHED

FORECAST_T_PLUS_1_TO_T_PLUS_72_TIME_CONTRACT_ESTABLISHED

JOINT_FORECAST_FORCING_CYCLE_PAIR_SELECTION_ESTABLISHED

FORECAST_FUTURE_FORCING_TRACE_ESTABLISHED

FORECAST_NO_FUTURE_OBSERVATION_LEAKAGE_ESTABLISHED

FORECAST_ADDITIVE_UNCERTAINTY_PROPAGATION_ESTABLISHED

FORECAST_95_PERCENT_INTERVAL_TRACE_ESTABLISHED

FORECAST_PHYSICAL_BOUND_TRACE_ESTABLISHED

A1_COMPLETED_CANONICAL_PERSISTENCE_ESTABLISHED

A2_BLOCKED_FORECAST_DEGRADED_PATH_ESTABLISHED

A1_A2_CROSS_VARIANT_TERMINAL_UNIQUENESS_ESTABLISHED

THREE_FIXED_IRRIGATION_SCENARIOS_ESTABLISHED

NO_ACTION_SCENARIO_BASELINE_EQUIVALENCE_ESTABLISHED

IRRIGATE_NOW_15MM_SCENARIO_ESTABLISHED

IRRIGATE_NOW_25MM_SCENARIO_ESTABLISHED

SCENARIO_RESOURCE_AND_STRESS_SUMMARY_ESTABLISHED

SCENARIO_SET_CANONICAL_PERSISTENCE_ESTABLISHED

FORECAST_SCENARIO_IDEMPOTENCY_ESTABLISHED

MISSING_SCENARIO_RECOVERY_BARRIER_ESTABLISHED

TWENTY_FOUR_FORECAST_SCENARIO_TICKS_PERSISTED

FORECAST_SCENARIO_RESTART_BACKFILL_PROVEN

VERSIONED_CAP_04_RECORD_SET_COMPATIBILITY_ESTABLISHED
```

---

# 22. Preserved Nonclaims

```text
NO_FORECAST_RESIDUAL

NO_FULL_MCFT_10_FIVE_SCENARIO_CLOSURE

NO_RECOMMENDATION

NO_POLICY_EVALUATION

NO_HUMAN_DECISION

NO_APPROVAL

NO_ACTION_PLAN

NO_AO_ACT

NO_DISPATCH

NO_EXECUTION_RECEIPT

NO_OUTCOME_EVIDENCE

NO_CALIBRATION_CANDIDATE

NO_SHADOW_EVALUATION

NO_MODEL_ACTIVATION

NO_ACTIVE_MODEL_PARAMETER_CHANGE

NO_CALIBRATED_FORECAST_PROBABILITY

NO_CALIBRATED_STRESS_PROBABILITY

NO_WEATHER_ENSEMBLE_UNCERTAINTY

NO_SCENARIO_ACTION_COMPLIANCE_PROBABILITY

NO_FIELD_CALIBRATED_SCENARIO_APPLICATION_EFFICIENCY

NO_FIELD_CALIBRATED_STRESS_THRESHOLD

NO_LATE_EVIDENCE_REVISION

NO_AUTOMATIC_RECOMPUTE_ON_LATE_EVIDENCE

NO_CONTINUOUS_RUNTIME

NO_CONTINUOUS_SCHEDULER

NO_SHADOW_ONLINE_CLAIM

NO_LIVE_FIELD_CLAIM

NO_MCFT_GATE_A_CLOSURE

NO_MCFT_GATE_B_CLOSURE

NO_MCFT_GATE_C_CLOSURE

NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

---

# 23. Existing repository component reuse

```text
CAP-02 hourly Dynamics physical equations:
REUSE_THROUGH_SHARED_PURE_STEP_KERNEL
DO_NOT_SYNTHESIZE_EXECUTION_EVIDENCE

CAP-02 fixed-point arithmetic:
REUSE_AS_IS

CAP-02 physical bounds:
REUSE_AS_IS

CAP-03 V2 observation selection:
REUSE_AS_IS

CAP-03 V2 assimilation:
REUSE_AS_IS

CAP-03 next-tick handoff:
REUSE_WITH_ADAPTER

CAP-03 V2 range config ref/hash pin pattern:
REUSE_AS_PATTERN

CAP-03 A2 record-set builder:
REFERENCE_PATTERN_ONLY
DO_NOT_MUTATE_IN_PLACE INTO A1

CAP-03 persistence repository:
REUSE_WITH_ADDITIVE_VERSIONED_DISPATCH

DT-02 A1_COMPLETED:
IMPLEMENT_FROZEN_VARIANT

DT-02 A2_BLOCKED_FORECAST:
REUSE_OR_ADDITIVELY_EXTEND_WITH_CAP_04_CONTRACT

DT-02 B_SCENARIO_COMMIT:
IMPLEMENT_FROZEN_VARIANT

P42 Forecast contract and negative boundaries:
REFERENCE_ONLY

P50 linear demo Forecast mathematics:
REPLACE

root_zone_soil_water_forecast_builder_v1 daily bucket formula:
EXTRACT_ALGORITHM_ONLY

root_zone_soil_water_forecast_builder_v1 daily Forecast contract:
REPLACE

root_zone_irrigation_scenario_builder_v1 fixed options and trajectory rules:
EXTRACT_ALGORITHM

root_zone_irrigation_scenario_builder_v1 Scenario contract:
REUSE_WITH_ADAPTER

P42 / P50 file persistence and runners:
DO_NOT_PROMOTE_AS_RUNTIME_AUTHORITY

Operator Forecast / Scenario pages:
DEFER_TO MCFT-7 / MCFT-17 / MCFT-18
```

---

# 24. Final task-line judgment

MCFT-CAP-04 的核心不是“生成一个 72 点数组”，而是：

```text
每一个新 posterior State
↓
在同一个 A1 canonical State Tick 中生成 successful Forecast
↓
Forecast 绑定 joint matching future forcing-cycle pair
↓
Forecast 持久化 72 点 mean + uncertainty + physical trace
↓
从 successful Forecast 独立提交三情景 Scenario Set
↓
A1 成功/B 缺失时先恢复 B
↓
下一小时 State 更新后重新生成
↓
连续运行、重启、backfill 和 response-loss recovery
```

完成后只可声明：

```text
GEOX 在 Level A Replay 下，
已经能够从每小时 posterior State
连续生成 first-class 72-hour Forecast，
并比较三个固定的 simulated irrigation scenarios。
```

仍不可声明：

```text
系统已经推荐灌溉
系统已经作出人类决策
系统已经批准或执行灌溉
系统已经形成 Forecast Residual
系统已经完成五情景 Gate A
系统已经关闭 Gate A
系统已经成为 Minimum Complete Field Twin
```

当前准确状态：

```text
architecture_direction:
CORRECT

DT_02_ARCHITECTURE_AMENDMENT:
NOT_REQUIRED_EXPECTED

design_status:
FINAL_FROZEN_CANDIDATE_V0_5

implementation_status:
NOT_AUTHORIZED

next_repository_action:
MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1

automatic_successor_authorization:
NONE
```
