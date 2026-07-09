<!-- GEOX_MCFT_CAP_02_HOURLY_DYNAMICS_AND_PERSISTENCE_TASK_V2.md -->

# GEOX MCFT-CAP-02 — Hourly Dynamics and Persistence

# 完整任务书 v2.2

---

## 0. 文档身份与当前状态

```text
document_id:
GEOX-MCFT-CAP-02-TASK-V2.2

capability_line_id:
MCFT-CAP-02

display_alias:
MCFT-2

name:
Hourly Dynamics and Persistence

type:
second executable vertical Twin capability line

runtime_mode:
REPLAY

target_completion_level:
Level A — Deterministic Replay Twin

design_status:
DESIGN_FROZEN_WITH_VERIFIED_GOVERNANCE_BLOCKERS

implementation_status:
BLOCKED

predecessor:
MCFT-CAP-01 — First-Class Water State Estimate

predecessor_remediation:
MCFT-CAP-01.CLOSURE-REMEDIATION-V1

predecessor_remediation_pr:
#2316

predecessor_implementation_candidate_head:
193f9785e42eb146e300e2a64abeed455f10e54e

predecessor_implementation_candidate_ci:
CI_4491_PASS

predecessor_final_closure_head:
7fedd85815cd65f0e3d2aedc74e4d0d9ed1b0558

predecessor_final_closure_ci:
CI_4501_PASS

predecessor_merge_commit:
7da8fee4daf1f022edff29078a1bbac207d1a32f

predecessor_merge_status:
MERGED

predecessor_main_verification:
PENDING

capability_authorization:
MCFT-CAP-02-AUTHORIZATION-V1

capability_authorization_status:
NOT_YET_MERGED

successor:
MCFT-CAP-03 — Observation Assimilation and State Innovation

successor_authorization:
NONE
```

MCFT-CAP-02 的设计主体冻结。PR #2316 已合并，但 Runtime 实现仍被以下条件阻断：

```text
1. local main HEAD == 7da8fee4daf1f022edff29078a1bbac207d1a32f
2. MCFT-CAP-01 final closure Gate rerun on merged main = PASS
3. merged-main verification evidence written into repository governance artifact
4. predecessor working tree = CLEAN
5. predecessor canonical identity snapshot extracted from PostgreSQL read path
6. MCFT-CAP-02-AUTHORIZATION-V1 merged
7. capability matrix contains MCFT-CAP-02 with READY_FOR_IMPLEMENTATION
8. exact predecessor State/checkpoint/config/lineage identities frozen
```

以下事实已经成立：

```text
PR #2316 merged:
true

final PR head:
7fedd85815cd65f0e3d2aedc74e4d0d9ed1b0558

merge commit:
7da8fee4daf1f022edff29078a1bbac207d1a32f

final PR-head CI:
#4501 SUCCESS
```

以下事实尚未成立：

```text
merge-commit-associated workflow run:
none

merged-main final closure Gate repository evidence:
missing

predecessor canonical identity lock:
incomplete
```

冻结治理表达：

```text
NO_NEW_DT_02_ARCHITECTURE_AMENDMENT_EXPECTED

NEW_VERTICAL_CAPABILITY_AUTHORIZATION_REQUIRED
```

只有发现本任务与已冻结 DT-02 canonical object、transaction family、lineage、checkpoint 或 CAS 语义发生真实冲突时，才允许提出新的 DT-02 architecture amendment。不得为了普通实现便利重开 DT-02。

---

## 0.1 v2.2 实现冲突修订记录

本版本在 v2.1 基础上修复三个实现级冲突：

```text
1. 删除 mass-balance trace 的递归自哈希
2. 唯一冻结 merged-main verification artifact 路径
3. 冻结 available_water_fraction 与 depletion 的 storage-basis 公式
```

冻结结论：

```text
mass_balance_trace
  does not contain any self-hash field

mass_balance_trace_hash
  = semantic hash of canonical mass_balance_trace

merged-main verification artifact
  = docs/digital_twin/mcft/cap_01/
    GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json

available_water_fraction
  computed from storage computation basis

depletion_from_field_capacity_mm
  computed from storage computation basis
```

这三项完成后，任务书内部不存在已知实现级自相矛盾；Runtime 实现仍受 merged-main verification、predecessor identity lock 与 MCFT-CAP-02 authorization 三项治理前置阻断。

---

## 0.1 v2.1 核查修订记录

本版本根据合并后仓库核查修订以下事实：

```text
PR #2316:
MERGED

implementation candidate head:
193f9785e42eb146e300e2a64abeed455f10e54e

final closure head:
7fedd85815cd65f0e3d2aedc74e4d0d9ed1b0558

merge commit:
7da8fee4daf1f022edff29078a1bbac207d1a32f

final PR-head CI:
#4501 SUCCESS

merge-commit workflow run:
NOT PRESENT

merged-main verification artifact:
NOT PRESENT

MCFT-CAP-02 authorization:
NOT PRESENT
```

因此当前阻断不是 architecture mismatch，而是：

```text
merged-main verification evidence missing
predecessor canonical identity lock incomplete
MCFT-CAP-02 governance authorization missing
```

仓库当前只有 MCFT-CAP-01，且其 `next_authorized_slice_ids` 为空；不得直接进入 Dynamics、persistence 或 Runtime integration。


---

# 1. 权威来源

MCFT-CAP-02 必须继承而不是重写以下权威：

```text
docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json
docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json
docs/digital_twin/GEOX-DT-02-RUNTIME-ARCHITECTURE-FREEZE.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md

docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json
docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json
docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json

docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-TASK.md
docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE-RECORD.json
docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json
docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE-REMEDIATION-STATUS.json
```

本任务沿用 DT-02 已冻结语义：

```text
transition_kind = CONTINUATION
checkpoint_kind = CONTINUATION
transaction family = A_STATE_TICK_COMMIT
operation variant = A2_BLOCKED_FORECAST
canonical facts are append-only
facts and projections commit in one database transaction
projection switches use expected-current CAS
failed A transaction does not advance checkpoint
F operational audit is separate from A transaction
```

本任务不新增第二套 canonical object family，不新增第二套 persistence family。

---

# 2. 能力线目标

MCFT-CAP-02 第一次建立：

```text
persisted MCFT-CAP-01 posterior State
→ persisted next-tick handoff
→ frozen exact-hour Evidence Window
→ deterministic hourly water-balance propagation
→ additive process uncertainty budget
→ explicit no-observation update
→ immutable continuation posterior State
→ A2 eight-object atomic commit
→ continuation checkpoint
→ next hourly tick
→ process restart/resume
→ bounded contiguous forward backfill
```

MCFT-CAP-02 必须证明 State 随时间连续推进，而不是每小时重新 bootstrap。

最终标准链：

```text
1 INITIAL State
+
24 CONTINUATION States
=
25 immutable canonical States
```

冻结时间：

```text
bootstrap State:
2026-06-01T01:00:00.000Z

first continuation tick:
2026-06-01T02:00:00.000Z

last continuation tick:
2026-06-02T01:00:00.000Z

continuation tick count:
24
```

---

# 3. 能力边界

MCFT-CAP-02 只建立：

```text
hourly water Dynamics
continuation State chain
continuation checkpoint chain
continuation persistence
process uncertainty budget
single-tick execution
24-tick contiguous range
restart/resume
bounded forward backfill
projection rebuild
idempotent crash retry
```

MCFT-CAP-02 不建立：

```text
soil-moisture observation assimilation
observation innovation correction
Forecast residual
successful Forecast
72-hour Forecast
Scenario
Recommendation
Decision
AO-ACT
calibration candidate
shadow evaluation
model activation
late-Evidence revision lineage
720-tick Gate-A closure
continuous scheduler
background daemon
live device connectivity
Minimum Complete Field Twin
```

冻结说明：

```text
24 persisted continuation ticks
≠
continuous production Runtime

bounded forward backfill
≠
late-Evidence revision replay

BLOCKED Forecast canonical object
≠
Forecast capability

assimilation_update.status = NOT_APPLIED
≠
observation assimilation established
```

---

# 4. 独立治理授权

在任何 Runtime source 实现之前，必须交付并合并：

```text
MCFT-CAP-02-AUTHORIZATION-V1
```

至少包含：

```yaml
capability_line_id:
  MCFT-CAP-02

display_alias:
  MCFT-2

name:
  Hourly Dynamics and Persistence

runtime_mode:
  REPLAY

target_completion_level:
  Level A

predecessor_capability_lines:
  - MCFT-CAP-01

authorized_owner_work_package_ids:
  - MCFT-02
  - MCFT-03
  - MCFT-04
  - MCFT-05
  - MCFT-06
  - MCFT-07
  - MCFT-08
  - MCFT-09

primary_owner_work_package_id:
  MCFT-06

excluded_owner_work_package_ids:
  - MCFT-10
  - MCFT-11
  - MCFT-12
  - MCFT-13
  - MCFT-14
  - MCFT-15
  - MCFT-16
  - MCFT-17
  - MCFT-18

successor:
  MCFT-CAP-03

successor_authorization:
  NONE
```

授权文件必须同时冻结：

```text
delivery-slice graph
exact dependency graph
owner/contributor boundaries
completion claims
preserved nonclaims
changed-file boundary
merge-before-next rule
predecessor merge SHA
```

不允许仅通过在 capability matrix 中手工新增一行来替代完整授权。

---

# 5. Repository owner work packages

```text
MCFT-02
Continuation canonical contracts, Runtime Config extension,
identity and graph validation

MCFT-03
Continuation persistence, transaction, idempotency,
projection CAS and rebuild

MCFT-04
Hourly tick orchestration, checkpoint progression,
restart/resume and bounded backfill

MCFT-05
Continuation Evidence Window and consumption trace

MCFT-06
Hourly soil-water Dynamics and additive uncertainty budget

MCFT-07
Explicit no-observation assimilation disposition only

MCFT-08
Continuation posterior State chain

MCFT-09
BLOCKED Forecast outcome only
```

Primary owner：

```text
MCFT-06
```

关闭 MCFT-CAP-02 不等于关闭所有横向 owner work packages。

---

# 6. 合并后 main 复验与启动前置锁定

## 6.1 Merged-main verification

PR-head CI 成功不能替代 merged-main verification。

必须在本地同步：

```text
main
=
7da8fee4daf1f022edff29078a1bbac207d1a32f
```

然后执行并记录：

```text
MCFT-CAP-01 final closure Gate on merged main
git diff --check
git status --short
server typecheck
server build
```

至少要求：

```text
final closure Gate:
173 PASS, 0 FAIL

git diff --check:
PASS

working tree:
CLEAN
```

随后必须生成且只允许生成以下 repository governance evidence：

```text
docs/digital_twin/mcft/cap_01/
GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json
```

这是 predecessor closure 的 merged-main verification artifact，因此归属 `cap_01`。不得改放到 `cap_02`，不得由实现者自行选择路径，也不得开放整个 `cap_01/**` 修改权限。

建议结构：

```yaml
schema_version:
  geox_mcft_cap_01_main_verification_v1

capability_line_id:
  MCFT-CAP-01

pr:
  2316

implementation_candidate_head:
  193f9785e42eb146e300e2a64abeed455f10e54e

final_closure_head:
  7fedd85815cd65f0e3d2aedc74e4d0d9ed1b0558

merge_commit:
  7da8fee4daf1f022edff29078a1bbac207d1a32f

main_head_verified:
  7da8fee4daf1f022edff29078a1bbac207d1a32f

final_closure_gate:
  173_PASS_0_FAIL

server_typecheck:
  PASS

server_build:
  PASS

git_diff_check:
  PASS

working_tree:
  CLEAN

verification_status:
  COMPLETE
```

该 verification artifact 只能证明 merged main 没有破坏 predecessor closure；它不能代替 MCFT-CAP-02 authorization。

## 6.2 三类 predecessor SHA 的冻结语义

禁止继续使用模糊字段：

```text
predecessor_remediation_candidate_head
```

必须拆分为：

```text
predecessor_implementation_candidate_head
=
193f9785e42eb146e300e2a64abeed455f10e54e

predecessor_final_closure_head
=
7fedd85815cd65f0e3d2aedc74e4d0d9ed1b0558

predecessor_merge_commit
=
7da8fee4daf1f022edff29078a1bbac207d1a32f
```

语义分别为：

```text
implementation candidate head:
最后一个被专项 Runtime/DB/runner 验证的实现候选

final closure head:
写入最终治理状态并通过 final closure Gate 与 CI 的 PR head

merge commit:
真正进入 main 的 Git merge commit
```

authorization、predecessor lock、closure record 和 acceptance Gate 不得混用这三个 SHA。

## 6.3 Predecessor canonical identity extraction

以下身份目前不能仅从现有治理文件完整获得：

```text
active lineage canonical object ref
revision_id
bootstrap State determinism_hash
bootstrap checkpoint determinism_hash
bootstrap Runtime Config determinism_hash
```

这些值必须在 merged-main verification 使用的隔离 PostgreSQL 中，通过正式 canonical read path 提取。

禁止：

```text
从 expected fixture 猜测
从对象命名规则推导
从源码重新 bootstrap 后只使用内存返回值
手写 hash
使用历史日志中的不完整字段替代数据库 readback
```

必须读取：

```text
twin_active_lineage_index_v1.active_lineage_ref
resolved twin_runtime_lineage_v1 canonical object
latest twin_runtime_checkpoint_v1 canonical object
latest twin_state_estimate_v1 canonical object
referenced twin_runtime_config_v1 canonical object
Reality Binding Runtime snapshot
```

并验证：

```text
active_lineage_ref
=
lineage canonical object_id

resolved lineage object.lineage_id
=
checkpoint.lineage_id
=
State.lineage_id

resolved lineage object.revision_id
=
checkpoint.revision_id
=
State.revision_id

checkpoint.last_posterior_state_ref
=
State.object_id

State.runtime_config_ref
=
Runtime Config.object_id

State.runtime_config_hash
=
Runtime Config.determinism_hash
```

## 6.4 Predecessor lock

实现分支创建前必须生成 machine-readable predecessor lock：

```text
docs/digital_twin/mcft/cap_02/
GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json
```

至少冻结：

```yaml
predecessor_implementation_candidate_head:
  193f9785e42eb146e300e2a64abeed455f10e54e

predecessor_final_closure_head:
  7fedd85815cd65f0e3d2aedc74e4d0d9ed1b0558

predecessor_merge_commit:
  7da8fee4daf1f022edff29078a1bbac207d1a32f

predecessor_main_verification_commit:
  <commit created by merged-main verification evidence update, if applicable>

mcft_cap_01_status:
  COMPLETE

mcft_cap_01_final_gate:
  PASS

reality_binding_ref:
  mcft_rb_bf1da664164a4fedda249bcb

reality_binding_hash:
  sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f

source_matrix_hash:
  sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b

configuration_matrix_hash:
  sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5

geometry_semantic_hash:
  sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51

active_lineage_object_ref:
  <twin_runtime_lineage_v1.object_id>

lineage_id:
  <semantic lineage_id>

revision_id:
  <semantic revision_id>

bootstrap_state_ref:
  <MCFT-CAP-01 posterior State object_id>

bootstrap_state_hash:
  <determinism_hash>

bootstrap_checkpoint_ref:
  <MCFT-CAP-01 checkpoint object_id>

bootstrap_checkpoint_hash:
  <determinism_hash>

bootstrap_runtime_config_ref:
  <MCFT-CAP-01 Runtime Config object_id>

bootstrap_runtime_config_hash:
  <determinism_hash>

next_logical_tick_time:
  2026-06-01T02:00:00.000Z

crop_stage_context_ref:
  fixtures/mcft/water_state/replay_v1/configuration_context.json

crop_stage_context_hash:
  sha256:2287c71e983b1ba529e49939f025d9b035e09e195a5effc994fe54b4ef7863ce
```

禁止：

```text
复制 expected fixture 作为 previous State
重新计算 bootstrap posterior
源码写死 previous State object ID
测试直接构造 previous State 作为数据库替代
从 in-memory A0 execution result 开始
忽略 active lineage canonical object
```

MCFT-CAP-02 必须通过 persisted read path 获取 predecessor。

---

# 7. 冻结 Reality scope

沿用 MCFT-00 scope：

```text
tenant_id:
tenantA

project_id:
projectA

group_id:
groupA

field_id:
field_c8_demo

season_id:
season_2026_c8_corn

zone_id:
zone_mcft_c8_water_001

crop_code:
corn

governed hydrologic control volume:
0–300 mm
```

所有 scope 必须从 Reality Binding 和 Runtime Config 读取。

Dynamics 源码禁止复制：

```text
tenant_id
project_id
group_id
field_id
season_id
zone_id
root-zone depth
hydraulic values
Kc
runoff fraction
drainage coefficient
```

---

# 8. Root-zone resolution policy

MCFT-CAP-02 冻结固定 300 mm State control volume：

```yaml
root_zone_resolution_policy:
  policy_id:
    GOVERNED_FIXED_ROOT_ZONE_300MM_V1

  state_control_volume_depth_mm:
    300

  source_geometry:
    MCFT-00 governed root zone

  consumed_crop_stage_fields:
    - stage_code
    - kc

  non_consumed_crop_stage_fields:
    - crop_root_depth_mm
    - effective_model_root_depth_mm

  reason:
    MCFT_CAP_02_DOES_NOT_ESTABLISH_DYNAMIC_ROOT_ZONE_GEOMETRY
```

当前 crop-stage context 的 INITIAL stage 虽含：

```text
crop_root_depth_mm = 150
effective_model_root_depth_mm = 150
```

MCFT-CAP-02 不使用这些字段改变 State coordinate。

因此新增并保留 nonclaim：

```text
NO_DYNAMIC_ROOT_ZONE_GEOMETRY
```

若未来要随作物根深改变 State control volume，必须独立建立：

```text
State coordinate transformation
storage remapping
uncertainty remapping
geometry transition semantics
```

不得在 MCFT-CAP-02 内暗中完成。

---

# 9. Continuation Runtime Config

MCFT-CAP-02 不修改 MCFT-00 历史 artifacts，也不修改已经提交的 MCFT-CAP-01 Runtime Config。

它通过独立：

```text
D_MODEL_GOVERNANCE_STEP_COMMIT
```

追加一个 immutable：

```text
twin_runtime_config_v1
```

Runtime Config 选择模式：

```text
EXPLICIT_REPLAY_PIN
```

配置必须在任何 A2 continuation tick 之前 canonical persistence。

## 9.1 Required config structure

```yaml
config_purpose:
  HOURLY_DYNAMICS_CONTINUATION

config_selection_mode:
  EXPLICIT_REPLAY_PIN

parent_runtime_config_ref:
  <MCFT-CAP-01 Runtime Config object_id>

parent_runtime_config_hash:
  <MCFT-CAP-01 Runtime Config determinism_hash>

reality_binding_ref:
  <same MCFT-00 Reality Binding>

reality_binding_hash:
  <same frozen hash>

source_matrix_hash:
  <same frozen hash>

configuration_matrix_hash:
  <same frozen hash>

geometry_semantic_hash:
  <same frozen hash>

crop_stage_context:
  context_kind:
    CONFIGURATION_DERIVED_CONTEXT

  context_ref:
    fixtures/mcft/water_state/replay_v1/configuration_context.json

  context_hash:
    sha256:2287c71e983b1ba529e49939f025d9b035e09e195a5effc994fe54b4ef7863ce

  resolution_policy_id:
    GOVERNED_FIXED_ROOT_ZONE_300MM_V1

dynamics_model:
  model_component_ref:
    <canonical model component ref or governed component identity>

  model_id:
    ROOT_ZONE_HOURLY_WATER_BALANCE_V1

  model_version:
    1

  step_duration:
    PT1H

soil_hydraulic_snapshot:
  source_config_ref:
    <MCFT-00 soil hydraulic config ref>

  source_config_hash:
    <determinism hash>

  root_zone_depth_mm:
    300.000000

  wilting_point_fraction:
    0.120000

  wilting_point_storage_mm:
    36.000000

  field_capacity_fraction:
    0.300000

  field_capacity_storage_mm:
    90.000000

  saturation_fraction:
    0.450000

  saturation_storage_mm:
    135.000000

dynamics_parameters:
  parameter_class:
    CONTROLLED_SYNTHETIC

  field_calibration_status:
    NOT_FIELD_CALIBRATED

  runoff_fraction:
    0.050000

  drainage_coefficient_per_hour:
    0.030000

process_uncertainty:
  policy_id:
    CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1

  policy_version:
    1

  structural_process_stddev_mm_per_hour:
    0.500000

  rainfall_relative_stddev:
    0.100000

  crop_et_relative_stddev:
    0.150000

  executed_irrigation_relative_stddev:
    0.100000

  covariance_policy:
    ZERO_COVARIANCE_CONTROLLED_ASSUMPTION_V1

  physical_clipping_reduces_latent_variance:
    false

irrigation_input_policy:
  policy_id:
    COVERAGE_WEIGHTED_EXECUTED_AMOUNT_SUM_V1

  event_order:
    executed_at_asc_ingested_at_asc_source_record_id_asc

  spatial_overlap_deduplication:
    NOT_ESTABLISHED

no_observation_update_policy:
  policy_id:
    DEFER_OBSERVATION_ASSIMILATION_TO_MCFT_CAP_03_V1

forecast_block_policy:
  policy_id:
    MCFT_CAP_02_PINNED_CONFIG_NO_FORECAST_COMPONENT_V1

rounding:
  output_decimals:
    6

  computation_storage_mean_scale:
    6

  computation_storage_variance_scale:
    12

  rule:
    DECIMAL_HALF_AWAY_FROM_ZERO_V1

soil_root_zone_config_refs:
  - <governed soil/root-zone config ref>

model_component_refs:
  - <Dynamics component ref>
  - <uncertainty-policy component ref>
  - <no-observation policy component ref>
  - <Forecast-block policy component ref>
```

所有新增 Dynamics 和 uncertainty 参数必须标记：

```text
CONTROLLED_SYNTHETIC
NOT_FIELD_CALIBRATED
```

本任务不创建：

```text
twin_model_activation_v1
active model switch
calibration candidate
shadow evaluation
```

---

# 10. State 数值权威与 computation basis

MCFT-CAP-02 冻结：

```text
Dynamics computational mean authority:
computation_basis.storage_mean_mm_decimal

Dynamics computational variance authority:
computation_basis.storage_variance_mm2_decimal
```

以下为 published derived values：

```text
root_zone_storage_mm.mean
root_zone_storage_mm.stddev
root_zone_vwc_fraction.mean
root_zone_vwc_fraction.variance
root_zone_vwc_fraction.stddev
confidence interval
available_water_fraction
depletion_from_field_capacity_mm
```

禁止：

```text
从 rounded VWC mean 反推 next storage
从 rounded VWC variance 反推后续 storage variance
使用隐藏的内存精度作为下一 tick 输入
```

## 10.1 First continuation bridge

MCFT-CAP-01 State 尚未持久化 storage variance computation basis，因此第一个 continuation tick 允许且只允许一次转换：

```text
initial_storage_variance_mm2
=
persisted MCFT-CAP-01 VWC variance
× governed root_zone_depth_mm²
```

标准值：

```text
0.002678 × 300²
=
241.020000000000 mm²
```

首个 continuation State 必须记录：

```yaml
computation_basis:
  basis_origin:
    DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1

  source_posterior_ref:
    <MCFT-CAP-01 State object_id>

  source_vwc_variance:
    "0.002678"

  root_zone_depth_mm:
    "300.000000"

  storage_mean_mm_decimal:
    value:
      "57.753012"
    scale:
      6

  storage_variance_mm2_decimal:
    value:
      "241.270014630625"
    scale:
      12
```

## 10.2 Subsequent continuation ticks

从第二个 continuation tick 开始：

```yaml
computation_basis:
  basis_origin:
    CARRIED_FROM_PREVIOUS_CONTINUATION_STATE

  previous_state_ref:
    required

  previous_storage_mean_mm_decimal:
    required

  previous_storage_variance_mm2_decimal:
    required
```

不得再次从 published VWC variance 反推 storage variance。

## 10.3 Published consistency

```text
abs(
  storage_mean_mm / 300
  - root_zone_vwc_fraction.mean
)
<= 0.0000005 fraction
```

## 10.4 Derived State formulas

`available_water_fraction` 与 `depletion_from_field_capacity_mm` 必须以 storage computation basis 为权威，不得从已舍入的 published VWC 反推。

### Available water fraction

```text
raw_available_water_fraction
=
(
  next_storage_mm
  - wilting_point_storage_mm
)
/
(
  field_capacity_storage_mm
  - wilting_point_storage_mm
)
```

```text
available_water_fraction
=
clamp(
  raw_available_water_fraction,
  0,
  1
)
```

其中：

```text
wilting_point_storage_mm:
36.000000

field_capacity_storage_mm:
90.000000
```

### Depletion from field capacity

```text
depletion_from_field_capacity_mm
=
max(
  0,
  field_capacity_storage_mm
  - next_storage_mm
)
```

### Computational authority

```text
next_storage_mm
=
computation_basis.storage_mean_mm_decimal

wilting_point_storage_mm
=
continuation Runtime Config soil_hydraulic_snapshot.wilting_point_storage_mm

field_capacity_storage_mm
=
continuation Runtime Config soil_hydraulic_snapshot.field_capacity_storage_mm
```

禁止：

```text
从 published VWC mean 计算 AWF
从 rounded VWC mean 计算 depletion
使用 crop-stage root depth 改变 AWF denominator
使用未冻结的 field-capacity 或 wilting-point 常量
```

### Publishing rule

```text
available_water_fraction:
  6 decimal places

depletion_from_field_capacity_mm:
  6 decimal places

rounding:
  DECIMAL_HALF_AWAY_FROM_ZERO_V1
```

Clipping metadata：

```yaml
available_water_fraction_trace:
  raw_value:
  lower_bound:
    0
  upper_bound:
    1
  clipping_applied:
  published_value:
  rounding_rule:
    DECIMAL_HALF_AWAY_FROM_ZERO_V1
```

标准首 tick：

```text
available_water_fraction
=
(57.753012 - 36) / (90 - 36)
=
0.402833555...
→ 0.402834
```

标准第 24 tick：

```text
available_water_fraction
=
(56.788512 - 36) / (90 - 36)
=
0.384972444...
→ 0.384972
```

```text
depletion
=
90 - 56.788512
=
33.211488 mm
```

---

# 11. Fixed-point arithmetic

所有水量 flux 与 storage 计算必须使用显式 decimal-string / BigInt 定点工具。

禁止依赖：

```text
JavaScript implicit binary floating-point formatting
toFixed() as computational authority
hidden floating-point carry
locale-sensitive formatting
```

建议内部尺度：

```text
water amount:
micrometre water depth or 10^-6 mm

variance:
10^-12 mm²
```

冻结 rounding：

```text
DECIMAL_HALF_AWAY_FROM_ZERO_V1
```

Domain rerun 必须 byte-equivalent。

---

# 12. Hourly Dynamics model

```text
model_id:
ROOT_ZONE_HOURLY_WATER_BALANCE_V1
```

模型性质：

```text
transparent
deterministic
single-zone
single-fixed-root-zone
hourly
controlled synthetic
```

不是：

```text
Richards equation
multi-layer hydraulic simulation
field-calibrated crop model
formal water-stress diagnosis
irrigation recommendation
```

---

# 13. 必需输入

每个 continuation tick 必须消费：

```text
previous canonical posterior State
previous canonical checkpoint
active lineage canonical object
semantic lineage_id
semantic revision_id
explicitly pinned continuation Runtime Config
exact-hour rainfall Evidence
exact-hour historical ET0 Evidence
configuration-derived crop-stage context
eligible executed-irrigation Evidence, if any
explicit Replay logical time
```

可进入 Evidence Window 但不参与 MCFT-CAP-02 State 数学：

```text
soil-moisture observations
future-weather assumptions
future ET0 assumptions
approved irrigation plans
```

---

# 14. Exact-hour interval policy

Continuation window：

```text
(T - PT1H, T]
```

但 rainfall 和 historical ET0 不能仅以“落入窗口”选择，必须精确满足：

```text
interval_start == T - PT1H
interval_end == T
```

禁止接受：

```text
30-minute interval
2-hour aggregate
cross-window interval
adjacent-hour interval
record whose interval_end differs from T
```

Exact-hour selection failure：

```text
MISSING_EXACT_HOURLY_RAINFALL_INTERVAL
MISSING_EXACT_HOURLY_ET0_INTERVAL
```

---

# 15. Water-balance equations

## 15.1 Surface runoff

```text
surface_runoff_mm
=
gross_rainfall_mm
× runoff_fraction
```

## 15.2 Effective rainfall

```text
effective_rainfall_mm
=
gross_rainfall_mm
- surface_runoff_mm
```

## 15.3 Executed irrigation

只有满足以下条件的 execution Evidence 可进入 State：

```text
eligible_for_state_input = true
actual executed amount exists
executed time is in exact tick interval
source quality is usable
scope matches
coverage is in [0,1]
```

单条：

```text
event_effective_irrigation_mm
=
executed_amount_mm
× coverage_fraction
```

多条：

```text
effective_irrigation_mm
=
Σ event_effective_irrigation_mm
```

确定性顺序：

```text
executed_at ascending
ingested_at ascending
source_record_id ascending
```

不得使用：

```text
approved_amount_mm
planned_amount_mm
dispatched_amount_mm
```

Level A limitation：

```text
coverage_fraction is treated as event-level effective coverage
events are additive
spatial overlap correction is not established
```

保留 nonclaim：

```text
NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION
```

## 15.4 Crop ET

```text
requested_crop_et_mm
=
historical_et0_mm
× kc
```

```text
water_before_et_mm
=
previous_storage_mm
+ effective_rainfall_mm
+ effective_irrigation_mm
```

```text
actual_crop_et_mm
=
min(
  requested_crop_et_mm,
  water_before_et_mm
)
```

```text
unmet_crop_et_mm
=
requested_crop_et_mm
- actual_crop_et_mm
```

`unmet_crop_et_mm` 只作为 trace，不得解释为正式 water-stress State。

## 15.5 Drainage

```text
storage_before_drainage_mm
=
water_before_et_mm
- actual_crop_et_mm
```

```text
drainage_mm
=
max(
  0,
  storage_before_drainage_mm
  - field_capacity_storage_mm
)
× drainage_coefficient_per_hour
```

```text
storage_after_drainage_mm
=
storage_before_drainage_mm
- drainage_mm
```

## 15.6 Saturation overflow

```text
saturation_overflow_mm
=
max(
  0,
  storage_after_drainage_mm
  - saturation_storage_mm
)
```

```text
next_storage_mm
=
storage_after_drainage_mm
- saturation_overflow_mm
```

冻结范围：

```text
0 <= next_storage_mm <= 135
```

---

# 16. Mass-balance invariant

每个 transition 必须嵌入完整 trace：

```yaml
mass_balance_trace:
  previous_storage_mm:
  gross_rainfall_mm:
  surface_runoff_mm:
  effective_rainfall_mm:

  execution_events:
    - source_record_id:
      executed_at:
      executed_amount_mm:
      coverage_fraction:
      effective_irrigation_mm:

  effective_irrigation_mm:
  reference_et0_mm:
  crop_stage_code:
  kc:
  requested_crop_et_mm:
  actual_crop_et_mm:
  unmet_crop_et_mm:
  storage_before_drainage_mm:
  drainage_mm:
  storage_after_drainage_mm:
  saturation_overflow_mm:
  next_storage_mm:
  mass_balance_error_mm:

mass_balance_trace_hash:
  semantic hash of canonical mass_balance_trace
```

`mass_balance_trace` 内部禁止包含：

```text
trace_determinism_hash
mass_balance_trace_hash
self_hash
任何依赖其自身完整内容计算的 hash 字段
```

哈希顺序冻结为：

```text
1. 构造不含任何自哈希字段的 canonical mass_balance_trace
2. 对 canonical mass_balance_trace 计算 semantic hash
3. 将结果写入 sibling field mass_balance_trace_hash
4. Transition.mass_balance_trace_hash
   ==
   State.mass_balance_trace_hash
```

守恒式：

```text
previous storage
+ gross rainfall
+ effective irrigation

=

next storage
+ surface runoff
+ actual crop ET
+ drainage
+ saturation overflow
```

要求：

```text
internal fixed-point mass_balance_error = 0
published mass_balance_error_mm = 0.000000
```

八对象集合中不新增单独的 mass-balance canonical object。

冻结引用方式：

```text
complete trace embedded in twin_state_transition_v1

twin_state_estimate_v1.transition_ref
  → transition object_id

twin_state_transition_v1.mass_balance_trace_hash
  → semantic hash of embedded canonical mass_balance_trace

twin_state_estimate_v1.mass_balance_trace_hash
  → exact same hash
```

必须满足：

```text
Transition.mass_balance_trace_hash
==
State.mass_balance_trace_hash
```

禁止：

```text
dangling mass_balance_trace_ref
trace 内部自哈希
Transition 与 State 记录不同 trace hash
```

---

# 17. Additive process uncertainty budget

MCFT-CAP-02 不声称完整非线性统计传播。

冻结名称：

```text
CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1
```

## 17.1 Previous variance

```text
previous_storage_variance_mm2
=
persisted computation_basis.storage_variance_mm2_decimal
```

首 tick 使用第 10.1 节唯一 bridge。

## 17.2 Input budget

```text
rainfall_variance_mm2
=
(gross_rainfall_mm × 0.10)²
```

```text
crop_et_variance_mm2
=
(requested_crop_et_mm × 0.15)²
```

```text
irrigation_variance_mm2
=
(effective_irrigation_mm × 0.10)²
```

```text
structural_variance_mm2
=
0.50²
=
0.250000
```

## 17.3 Next variance

```text
next_storage_variance_mm2
=
previous_storage_variance_mm2
+ rainfall_variance_mm2
+ crop_et_variance_mm2
+ irrigation_variance_mm2
+ structural_variance_mm2
```

```text
next_vwc_variance
=
next_storage_variance_mm2
/ 300²
```

假设：

```text
input errors independent
covariance = 0
physical clipping does not reduce latent variance
runoff/drainage nonlinear sensitivity is not separately propagated
```

无 observation update 时：

```text
next variance > previous variance
```

标准 config 不允许 structural uncertainty 为零。

## 17.4 Confidence interval

```text
raw_lower =
mean - 1.96 × stddev

raw_upper =
mean + 1.96 × stddev
```

Published interval 可按物理 VWC 范围 `[0,0.45]` clipping，但必须记录：

```yaml
interval:
  raw_lower:
  raw_upper:
  published_lower:
  published_upper:
  clipping_applied:
  clipping_lower_bound:
  clipping_upper_bound:
  clipping_policy_id:
```

Interval clipping 不改变 latent variance。

---

# 18. Observation handling

MCFT-CAP-02 不执行 soil-moisture assimilation。

每 tick 仍必须生成：

```text
twin_assimilation_update_v1
```

合同：

```yaml
status:
  NOT_APPLIED

disposition:
  DEFERRED_TO_MCFT_CAP_03

candidate_observation_refs:
  <usable soil observations in Evidence Window>

consumed_observation_refs:
  []

predicted_observation:
  null

innovation:
  null

residual:
  null

assimilation_gain:
  null

prior_mean:
  <propagated mean>

posterior_mean:
  <same propagated mean>

prior_variance:
  <propagated variance>

posterior_variance:
  <same propagated variance>

reason_codes:
  - OBSERVATION_UPDATE_OUT_OF_SCOPE_MCFT_CAP_02
```

禁止：

```text
copy soil observation into State
compute innovation
compute observation residual
compute assimilation gain
reduce uncertainty
reuse MCFT-CAP-01 bootstrap gain
```

准确 nonclaim：

```text
NO_OBSERVATION_UPDATE_APPLIED
NO_OBSERVATION_INNOVATION_COMPUTED
```

---

# 19. Continuation Evidence Window

每条 record 必须记录：

```text
role
event or interval time
ingested_at
available_to_runtime_at
quality
freshness
source unit
canonical unit
conversion rule
limitations
window disposition
model consumption status
exclusion reason
```

Consumption status：

```text
CONSUMED_BY_DYNAMICS
AVAILABLE_NOT_CONSUMED_MCFT_CAP_02
CONTEXT_ONLY_NOT_EXECUTED
AVAILABLE_NOT_CONSUMED_FORECAST_BLOCKED
EXCLUDED_LATE
EXCLUDED_FUTURE
EXCLUDED_QUALITY
EXCLUDED_SCOPE
EXCLUDED_CONFLICT
EXCLUDED_INTERVAL_MISMATCH
```

角色规则：

```text
RAINFALL_OBSERVATION
  exactly one usable exact-hour semantic record required
  consumption = CONSUMED_BY_DYNAMICS

HISTORICAL_ET0_INPUT
  exactly one usable exact-hour semantic record required
  consumption = CONSUMED_BY_DYNAMICS

IRRIGATION_EXECUTION_EVIDENCE
  zero or more eligible event records
  consumption = CONSUMED_BY_DYNAMICS

SOIL_MOISTURE_OBSERVATION
  zero or more
  consumption = AVAILABLE_NOT_CONSUMED_MCFT_CAP_02

APPROVED_IRRIGATION_PLAN
  never physical input
  consumption = CONTEXT_ONLY_NOT_EXECUTED

FUTURE_WEATHER_ASSUMPTION
FUTURE_ET0_ASSUMPTION
  never consumed by MCFT-CAP-02
  consumption = AVAILABLE_NOT_CONSUMED_FORECAST_BLOCKED
```

Missing exact rainfall 或 exact ET0 不允许静默设零。

无 irrigation execution record：

```text
effective_irrigation_mm = 0
```

这是明确的“无 execution event”，不是缺失传感器输入。

---

# 20. Duplicate and conflict policy

## 20.1 Rainfall semantic identity

```text
binding_id
origin_source_id
scope
interval_start
interval_end
```

## 20.2 ET0 semantic identity

```text
binding_id
origin_source_id
scope
interval_start
interval_end
calculation_method
method_version
```

## 20.3 Execution semantic identity

```text
binding_id
origin_source_id
scope
executed_at
event_id or stable source execution identity
```

行为：

```text
same semantic identity
+ same canonical payload
→ deterministic deduplication

same semantic identity
+ different canonical payload
→ CONFLICTING_DUPLICATE_EVIDENCE
→ A2 tick failure
```

不得按 record ID 任意选择冲突值。

Deterministic duplicate winner only用于 identical duplicates：

```text
ingested_at descending
source_record_id ascending
```

冲突发生时不得选择 winner。

---

# 21. Operation identity 与 aggregate hash

必须严格分离：

## 21.1 Continuation operation idempotency key

```yaml
continuation_operation_key:
  scope:
  lineage_id:
  revision_id:
  logical_time:
  operation_variant:
    A2_BLOCKED_FORECAST
```

该 key 代表：

```text
同一 active lineage/revision
在同一 logical time
只允许一个 terminal continuation operation
```

## 21.2 Record-set determinism hash

至少包含：

```text
continuation operation key
previous posterior ref/hash
previous checkpoint ref/hash
Runtime Config ref/hash
Reality Binding ref/hash
Evidence Window semantic digest
crop-stage context ref/hash
Dynamics model version
uncertainty policy version
no-observation-update policy version
Forecast block policy version
all eight member determinism hashes
```

行为：

```text
same operation key + same aggregate hash
→ verify complete eight-object set
→ EXISTING_IDEMPOTENT_SUCCESS
→ no new lease
→ no new fence token
→ no new facts
→ no new projections

same operation key + different aggregate hash
→ IDEMPOTENCY_CONFLICT

different operation key
→ new-tick path
```

## 21.3 Canonical uniqueness

即使 idempotency projection 丢失，也必须通过 canonical fact scan 或 canonical uniqueness guard拒绝：

```text
scope
+ lineage_id
+ revision_id
+ logical_time
+ operation_variant
```

对应第二个 terminal continuation tick。

---

# 22. Canonical continuation record set

每个 continuation tick 使用：

```text
A2_BLOCKED_FORECAST
```

一次事务恰好追加八个 canonical facts：

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

不再追加：

```text
twin_runtime_lineage_v1
```

Active lineage canonical object ref、semantic lineage ID 和 revision ID 必须沿用 MCFT-CAP-01。

---

# 23. `twin_state_transition_v1`

```yaml
transition_kind:
  CONTINUATION

previous_posterior_ref:
  required

previous_posterior_hash:
  required

process_model_status:
  APPLIED

process_model_id:
  ROOT_ZONE_HOURLY_WATER_BALANCE_V1

process_model_version:
  1

propagation_start:
  T - PT1H

propagation_end:
  T

previous_state_runtime_config_ref:
  required

current_runtime_config_ref:
  required

mass_balance_trace:
  required

mass_balance_trace_hash:
  required

assimilation_update_ref:
  required

posterior_state_ref:
  required
```

禁止：

```text
bootstrap_prior
bootstrap_prior_ref
previous_posterior_ref = null
```

---

# 24. `twin_assimilation_update_v1`

必须符合第 18 节 explicit no-update contract。

它是 canonical object存在，但不得被解释为 assimilation capability。

---

# 25. `twin_state_estimate_v1`

必须包含：

```text
state_kind = POSTERIOR
previous_posterior_ref
transition_ref
assimilation_update_ref
Evidence Window ref
Runtime Config ref/hash
Reality Binding ref/hash
lineage_id
revision_id
logical_time
root-zone storage
root-zone VWC
uncertainty
computation basis
available-water fraction
depletion
mass_balance_trace_hash
model version
limitations
confidence
use eligibility
```

Confidence：

```yaml
status:
  NOT_ESTABLISHED

reason_code:
  NO_CALIBRATED_CONFIDENCE_MODEL

numeric_score:
  forbidden
```

Use eligibility：

```yaml
state_valid:
  true

posterior_chain_eligible:
  true

forecast_source_eligible:
  true

recommendation_input_eligible:
  false

action_input_eligible:
  false
```

不得新增：

```text
scenario_input_eligible
```

Scenario eligibility属于 Forecast，不属于 State。

---

# 26. `twin_forecast_run_v1`

MCFT-CAP-02 不建立 successful Forecast。

```yaml
status:
  BLOCKED

points:
  []

scenario_eligible:
  false

source_posterior_ref:
  required

successful_forecast_ref:
  null

reason_codes:
  - FORECAST_MODEL_COMPONENT_NOT_CONFIGURED_IN_PINNED_RUNTIME_CONFIG
  - SUCCESSFUL_FORECAST_NOT_AUTHORIZED_FOR_MCFT_CAP_02
```

禁止 reason codes：

```text
PROGRAM_NOT_IMPLEMENTED
FAKE_BLOCKED_RESULT
TEMPORARY_STUB
```

Future weather 已可用不改变 pinned Runtime Config 中没有 Forecast component 的事实。

---

# 27. `twin_runtime_tick_v1`

```yaml
transaction_family:
  A_STATE_TICK_COMMIT

operation_variant:
  A2_BLOCKED_FORECAST

status:
  COMPLETED_WITH_LIMITATIONS

transition_kind:
  CONTINUATION

limitations:
  - STATE_PROPAGATION_SUCCEEDED
  - OBSERVATION_UPDATE_NOT_APPLIED
  - FORECAST_BLOCKED_BY_PINNED_CONFIG_AND_CAPABILITY_BOUNDARY
```

---

# 28. `twin_runtime_checkpoint_v1`

```yaml
checkpoint_kind:
  CONTINUATION

previous_checkpoint_ref:
  required

last_completed_tick_ref:
  required

last_posterior_state_ref:
  required

forecast_result_ref:
  required

successful_forecast_ref:
  null

next_tick_logical_time:
  T + PT1H

tick_sequence:
  previous tick_sequence + 1
```

MCFT-CAP-01 INITIAL checkpoint 必须定义 bootstrap `tick_sequence` 的基准。若 predecessor 中未显式持久化，MCFT-CAP-02 contracts slice必须冻结唯一 bridge：

```text
INITIAL checkpoint implicit tick_sequence = 0
first CONTINUATION checkpoint tick_sequence = 1
```

不得由不同服务自行猜测。

---

# 29. `twin_runtime_health_v1`

Health 必须描述当前成功 tick 的受限状态：

```yaml
operation_status:
  CONTINUATION_STATE_COMMITTED_WITH_BLOCKED_FORECAST

runtime_mode:
  REPLAY

active_lineage_ref:
  <lineage canonical object_id>

lineage_id:
  <semantic lineage ID>

revision_id:
  <semantic revision ID>

tick_ref:
checkpoint_ref:
state_ref:
forecast_result_ref:
successful_forecast_ref:
  null

limitation_reason_codes:
  - OBSERVATION_UPDATE_OUT_OF_SCOPE_MCFT_CAP_02
  - FORECAST_MODEL_COMPONENT_NOT_CONFIGURED_IN_PINNED_RUNTIME_CONFIG
  - NO_CALIBRATED_CONFIDENCE_MODEL
```

Health 不得包含 Recommendation、Action 或 water-stress conclusion。

---

# 30. Persistence semantics

扩展现有 A0 persistence family 支持 continuation。

不得建立平行：

```text
second facts table
second lineage index
second state latest family
second checkpoint family
```

需要支持：

```text
continuation operation idempotency
eight-object record-set readback
State history append
State latest CAS
Forecast result latest CAS
checkpoint latest CAS
Runtime health latest update
successful Forecast latest non-write verification
active lineage verification
projection rebuild
canonical uniqueness recovery
fault injection
```

每个 tick 独立数据库事务。

24-tick range 不是一个大事务。

若 tick 13 失败：

```text
ticks 1–12 remain committed
tick 13 has zero A2 canonical append
tick 13 has zero A2 projection write
checkpoint remains at tick 12
latest State remains at tick 12
latest Forecast result remains at tick 12
active lineage remains unchanged
ticks 14–24 do not run
optional F operational audit may append separately
```

---

# 31. Active lineage identity

必须明确区分：

```text
active_lineage_ref
=
twin_runtime_lineage_v1.object_id

lineage_id
=
semantic lineage identity

revision_id
=
semantic revision identity
```

CAS input：

```yaml
expected_active_lineage_object_ref:
  required

expected_lineage_id:
  required

expected_revision_id:
  required

expected_previous_checkpoint_ref:
  required

expected_previous_state_ref:
  required

expected_previous_forecast_result_ref:
  required

expected_latest_successful_forecast_ref:
  null
```

事务内必须验证：

```text
active lineage index ref resolves a canonical lineage object

resolved lineage object.lineage_id
==
checkpoint.lineage_id
==
previous State.lineage_id
==
expected_lineage_id

checkpoint.revision_id
==
previous State.revision_id
==
expected_revision_id
```

---

# 32. Fencing and CAS

每个新-key continuation commit 必须验证：

```text
lease owner
lease expiry
fencing token
active lineage object ref
semantic lineage_id
semantic revision_id
expected previous checkpoint ref
expected previous State ref
expected previous Forecast result ref
expected latest successful Forecast ref
```

错误码至少包括：

```text
STALE_FENCING_TOKEN
LEASE_EXPIRED
ACTIVE_LINEAGE_OBJECT_REF_MISMATCH
ACTIVE_LINEAGE_ID_MISMATCH
LINEAGE_REVISION_MISMATCH
CHECKPOINT_CAS_CONFLICT
STATE_LATEST_CAS_CONFLICT
FORECAST_RESULT_CAS_CONFLICT
SUCCESSFUL_FORECAST_POINTER_UNEXPECTED
CANONICAL_CONTINUATION_UNIQUENESS_CONFLICT
```

失败必须保持当前 tick 零 A2 写入。

---

# 33. Restart and resume

必须提供：

```text
prepareNextTickInputV1()
resumeFromCheckpointV1()
```

Restart 从 PostgreSQL consistent read读取：

```text
active lineage canonical object ref
active semantic lineage ID
revision ID
latest checkpoint
latest posterior State
last terminal tick
pinned continuation Runtime Config
Reality Binding snapshot
next logical tick time
computation basis
```

必须检查：

```text
checkpoint.last_posterior_state_ref
==
State latest object_id
```

```text
checkpoint.last_completed_tick_ref
==
last tick object_id
```

```text
checkpoint.lineage_id / revision_id
==
State lineage_id / revision_id
```

```text
checkpoint.next_tick_logical_time
==
last tick logical_time + PT1H
```

```text
State computation basis exists and is valid
```

不一致：

```text
CHECKPOINT_PROJECTION_DIVERGENCE
```

Runtime 不得静默修复 projection。

Projection repair只能通过独立、显式、可验收 rebuild procedure。

---

# 34. Range、resume 与 backfill

只允许一个核心 application service：

```text
runContiguousContinuationRangeV1()
```

CLI modes 只是不同 operator intent：

```text
single-tick:
  execute exactly one requested next tick

range:
  operator-requested contiguous range

resume:
  process restart/resume from persisted checkpoint

backfill:
  bounded missed-schedule catch-up
```

四种 mode 必须调用同一 single-tick transaction path。

## 34.1 Bounded forward rules

```text
forward only
contiguous only
hour-aligned only
starts from persisted checkpoint.next_tick_logical_time
maximum 24 ticks per invocation
stops on first failure
each tick commits independently
```

禁止：

```text
skip missing tick
write future tick before earlier tick
recompute committed history under a different operation key
treat late Evidence as forward backfill
create revision lineage
```

---

# 35. Runtime execution order

单 tick 冻结顺序：

```text
1. Read active lineage/checkpoint/State pointers
2. Prepare persisted next-tick input
3. Resolve explicitly pinned continuation Runtime Config
4. Load Replay Evidence candidates
5. Build and freeze exact-hour continuation Evidence Window
6. Resolve configuration-derived crop stage
7. Execute pure Dynamics
8. Execute additive uncertainty budget
9. Build explicit no-observation assimilation update
10. Build complete eight-object candidate record set
11. Validate physical invariants
12. Validate complete cross-reference graph
13. Compute continuation operation idempotency key
14. Compute aggregate determinism hash
15. Lookup idempotency index
16. Same key/hash:
      verify complete eight-object record set
      return existing success
      do not acquire lease
17. Same key/different hash:
      fail IDEMPOTENCY_CONFLICT
18. New key:
      acquire or renew lease
19. Begin database transaction
20. Revalidate lease and fencing token
21. Revalidate active lineage object ref / lineage ID / revision ID
22. Revalidate expected checkpoint/State/Forecast pointers
23. Revalidate canonical continuation uniqueness
24. Commit eight facts, projections and idempotency guard atomically
25. Commit transaction
26. Read canonical record set back
27. Prepare next-tick input
```

Range runner：

```text
while persisted_next_tick <= target_tick:
  execute exact one continuation tick
  read committed checkpoint
  advance exactly PT1H
```

---

# 36. Standard numerical case

## 36.1 First continuation tick

```text
logical tick:
2026-06-01T02:00:00.000Z

interval:
[2026-06-01T01:00:00.000Z,
 2026-06-01T02:00:00.000Z]
```

Evidence record interval semantics must exactly bind this hour. Evidence Window remains expressed as `(T-1h,T]`, while interval records carry exact `interval_start` and `interval_end`.

Previous State：

```text
storage mean:
57.778512 mm

VWC variance:
0.002678

derived initial storage variance basis:
241.020000000000 mm²
```

Inputs：

```text
rainfall:
0.000000 mm

historical ET0:
0.085000 mm

stage:
INITIAL

Kc:
0.300000

executed irrigation:
0.000000 mm
```

Expected fluxes：

```text
surface runoff:
0.000000 mm

effective rainfall:
0.000000 mm

requested crop ET:
0.025500 mm

actual crop ET:
0.025500 mm

unmet crop ET:
0.000000 mm

drainage:
0.000000 mm

saturation overflow:
0.000000 mm
```

Expected State：

```text
storage mean:
57.753012 mm

VWC mean:
0.192510

available-water fraction:
0.402834

depletion:
32.246988 mm
```

Uncertainty budget：

```text
process variance increment:
0.250014630625 mm²

next storage variance basis:
241.270014630625 mm²

next VWC variance:
0.002681

next VWC stddev:
0.051776

raw/published 95% interval:
[0.091029, 0.293991]
```

---

# 37. 24-tick final State

前 24 个 continuation intervals：

```text
total rainfall:
0.000000 mm

total executed irrigation:
0.000000 mm

total ET0:
3.300000 mm

Kc:
0.300000

total crop ET:
0.990000 mm
```

最终：

```text
logical time:
2026-06-02T01:00:00.000Z

storage mean:
56.788512 mm

VWC mean:
0.189295

storage variance basis:
247.020977062500 mm²

VWC variance:
0.002745

VWC stddev:
0.052390

95% interval:
[0.086611, 0.291979]

available-water fraction:
0.384972

depletion:
33.211488 mm
```

State chain：

```text
bootstrap State count:
1

continuation State count:
24

total State count:
25
```

所有 count 必须限定：

```text
frozen scope
expected lineage_id
expected revision_id
logical time range
```

不得查询全库总数。

---

# 38. Additional pure-domain fixtures

至少四类：

## A. Dry ET-only propagation

使用 standard first continuation tick。

## B. Rainfall and drainage

```text
previous storage:
89.000000 mm

gross rainfall:
3.200000 mm

surface runoff:
0.160000 mm

effective rainfall:
3.040000 mm

actual crop ET:
0.030000 mm

drainage:
0.060300 mm

next storage:
91.949700 mm
```

## C. Executed irrigation

```text
executed amount:
13.600000 mm

coverage fraction:
0.910000

effective irrigation:
12.376000 mm
```

必须证明 approved amount、planned amount、dispatched amount 未进入计算。

## D. Saturation overflow

必须证明：

```text
final storage:
135.000000 mm

overflow:
explicitly recorded

mass balance:
closed
```

## E. Multiple execution events

至少两条 execution Evidence：

```text
deterministic ordering
per-event trace retained
coverage-weighted sum exact
identical duplicate deduplicated
conflicting duplicate rejected
```

---

# 39. Runtime CLI

必须交付：

```text
apps/server/scripts/mcft/
MCFT_CAP_02_HOURLY_DYNAMICS_RUNNER.ts
```

支持：

```text
--mode single-tick
--logical-time <ISO>

--mode range
--to <ISO>

--mode resume
--to <ISO>

--mode backfill
--to <ISO>
```

必须：

```text
require explicit database URL
require explicit mode
use persisted checkpoint
use pinned Runtime Config
print machine-readable JSON
exit non-zero on failure
```

禁止：

```text
public HTTP tick endpoint
public State write endpoint
browser-generated State
background daemon
production scheduler
implicit wall-clock logical time
```

---

# 40. Delivery slice graph

正式实施按独立 PR、merge-before-next：

```text
MCFT-CAP-02.GOV-AUTHORIZATION-V1
↓
MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1
↓
MCFT-CAP-02.MCFT-06.PURE-HOURLY-DYNAMICS-V1
↓
MCFT-CAP-02.MCFT-05.CONTINUATION-EVIDENCE-WINDOW-V1
↓
MCFT-CAP-02.MCFT-03.CONTINUATION-PERSISTENCE-V1
↓
MCFT-CAP-02.MCFT-04-06-08-09.SINGLE-TICK-INTEGRATION-V1
↓
MCFT-CAP-02.MCFT-04-08.TWENTY-FOUR-TICK-RANGE-V1
↓
MCFT-CAP-02.MCFT-04.RESTART-BACKFILL-V1
↓
MCFT-CAP-02.FAILURE-RECOVERY-V1
↓
MCFT-CAP-02.CLOSURE-V1
```

每个 slice 必须声明：

```yaml
capability_line_id:
display_alias:
delivery_slice_id:
primary_owner_work_package_id:
contributing_work_package_ids:
depends_on_delivery_slice_ids:
baseline_main_commit:
branch:
status:
allowed_claims:
preserved_nonclaims:
exact_changed_file_boundary:
effectiveness_condition:
```

---

# 41. Slice definitions

## 41.1 GOV-AUTHORIZATION-V1

```text
freeze capability identity
freeze owner/contributor map
freeze predecessor merge SHA
freeze delivery graph
freeze claims/nonclaims
freeze changed-file boundaries
authorize no Runtime source
```

## 41.2 CONTINUATION-CONTRACTS-CONFIG-V1

```text
CONTINUATION transition contract
NOT_APPLIED assimilation contract
CONTINUATION checkpoint contract
operation-key / aggregate-hash separation
continuation graph validator
fixed 300 mm root-zone policy
continuation Runtime Config contract
D transaction config persistence
```

## 41.3 PURE-HOURLY-DYNAMICS-V1

```text
fixed-point arithmetic
water balance
runoff
executed irrigation aggregation
crop ET
drainage
overflow
mass-balance trace
additive uncertainty budget
standard numerical fixtures
```

## 41.4 CONTINUATION-EVIDENCE-WINDOW-V1

```text
exact-hour rainfall selection
exact-hour ET0 selection
execution Evidence selection
consumption statuses
duplicate conflict handling
crop-stage context resolution
model-consumption trace
```

## 41.5 CONTINUATION-PERSISTENCE-V1

```text
eight-fact transaction
operation idempotency
aggregate hash conflict
canonical uniqueness recovery
State/checkpoint/Forecast CAS
fault injection
readback
projection rebuild
```

## 41.6 SINGLE-TICK-INTEGRATION-V1

```text
execute T=2026-06-01T02:00:00Z
verify exact expected State
verify computation basis
verify checkpoint
verify BLOCKED Forecast
verify next persisted handoff
```

## 41.7 TWENTY-FOUR-TICK-RANGE-V1

```text
execute 24 contiguous ticks
verify 25-State chain
verify final expected State
verify monotonic logical time
verify monotonic uncertainty budget
verify exact object counts by lineage
```

## 41.8 RESTART-BACKFILL-V1

```text
run ticks 1–12
terminate process
new process resumes ticks 13–24
bounded contiguous backfill
same final State/hashes as uninterrupted run
```

## 41.9 FAILURE-RECOVERY-V1

```text
fault injection
stale fencing
CAS conflict
missing ET0
missing rainfall
duplicate conflict
invalid config
mass-balance violation
idempotent crash retry
projection divergence
```

## 41.10 CLOSURE-V1

```text
all slice statuses COMPLETE
capability matrix update
implementation map update
closure record
exact-head CI
main verification
clean tree
successor remains unauthorized
```

---

# 42. Suggested code layout

```text
apps/server/src/domain/soil_water/
  fixed_point_water_decimal_v1.ts
  hourly_water_balance_v1.ts
  additive_process_uncertainty_budget_v1.ts
  water_mass_balance_trace_v1.ts
  executed_irrigation_input_v1.ts

apps/server/src/domain/twin_runtime/
  continuation_operation_identity_v1.ts
  continuation_record_set_identity_v1.ts
  continuation_contracts_v1.ts
  continuation_cross_ref_validator_v1.ts
  continuation_runtime_config_v1.ts

apps/server/src/runtime/twin_runtime/
  continuation_evidence_window_service_v1.ts
  continuation_tick_service_v1.ts
  contiguous_continuation_range_service_v1.ts
  restart_resume_service_v1.ts
  next_tick_input_service_v1.ts

apps/server/src/adapters/twin_runtime/
  replay_hourly_clock_adapter_v1.ts
  replay_range_intent_adapter_v1.ts

apps/server/src/persistence/twin_runtime/
  postgres_continuation_repository_v1.ts
  postgres_continuation_read_repository_v1.ts
  continuation_projection_rebuilder_v1.ts

apps/server/scripts/mcft/
  MCFT_CAP_02_HOURLY_DYNAMICS_RUNNER.ts
```

Domain 层禁止：

```text
Postgres
filesystem
wall clock
environment
network
Fastify
random UUID
mutable global state
```

---

# 43. Deliverables

```text
docs/digital_twin/mcft/cap_02/
  GEOX-MCFT-CAP-02-AUTHORIZATION.md
  GEOX-MCFT-CAP-02-AUTHORIZATION-STATUS.json
  GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json
  GEOX-MCFT-CAP-02-TASK.md
  GEOX-MCFT-CAP-02-DYNAMICS-MATH-CONTRACT.md
  GEOX-MCFT-CAP-02-CONTINUATION-OBJECT-CONTRACT.json
  GEOX-MCFT-CAP-02-RUNTIME-CONFIG-CONTRACT.json
  GEOX-MCFT-CAP-02-IDENTITY-CONTRACT.json
  GEOX-MCFT-CAP-02-PERSISTENCE-MATRIX.json
  GEOX-MCFT-CAP-02-RESTART-BACKFILL-CONTRACT.md
  GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json
  GEOX-MCFT-CAP-02-CLOSURE-RECORD.json

fixtures/mcft/water_state/expected/
  MCFT_CAP_02_FIRST_CONTINUATION_EXPECTED.json
  MCFT_CAP_02_24_TICK_EXPECTED.json
  MCFT_CAP_02_DYNAMICS_FIXTURES.json

fixtures/mcft/water_state/negative/
  MCFT_CAP_02_NEGATIVE_FIXTURES.json

apps/server/src/domain/soil_water/**
apps/server/src/domain/twin_runtime/**
apps/server/src/runtime/twin_runtime/**
apps/server/src/adapters/twin_runtime/**
apps/server/src/persistence/twin_runtime/**
apps/server/src/projections/twin_runtime/**

apps/server/db/migrations/
  <date>_mcft_cap_02_continuation_persistence.sql

apps/server/scripts/mcft/
  MCFT_CAP_02_HOURLY_DYNAMICS_RUNNER.ts

scripts/runtime_acceptance/
  ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.ts
  ACCEPTANCE_MCFT_CAP_02_DYNAMICS.ts
  ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW.ts
  ACCEPTANCE_MCFT_CAP_02_CONTINUATION_DB.ts
  ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK.ts
  ACCEPTANCE_MCFT_CAP_02_24_TICK.ts
  ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL.ts
  ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.ts

scripts/governance_acceptance/
  ACCEPTANCE_MCFT_CAP_02_AUTHORIZATION.cjs
  ACCEPTANCE_MCFT_CAP_02_CLOSURE.cjs
```

---

# 44. Changed-file boundary

## 44.1 Capability-wide allowed paths

```text
docs/digital_twin/mcft/cap_02/**
docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md

apps/server/src/domain/soil_water/**
apps/server/src/domain/twin_runtime/**
apps/server/src/runtime/twin_runtime/**
apps/server/src/adapters/twin_runtime/**
apps/server/src/persistence/twin_runtime/**
apps/server/src/projections/twin_runtime/**

apps/server/db/migrations/<exact MCFT-CAP-02 migration>
apps/server/scripts/mcft/MCFT_CAP_02_HOURLY_DYNAMICS_RUNNER.ts

fixtures/mcft/water_state/expected/MCFT_CAP_02_*.json
fixtures/mcft/water_state/negative/MCFT_CAP_02_*.json

scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_*
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_*

apps/server/package.json
only if exact runner command required
```

## 44.2 Forbidden

```text
apps/web/**
apps/server/src/routes/**
public Runtime write APIs

MCFT-00 authority artifacts
MCFT-CAP-01 canonical facts
MCFT-CAP-01 fixture history
MCFT-CAP-01 docs except the single exact file:
  docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json
existing Replay Evidence bytes

Forecast engine
Scenario engine
Forecast Residual runtime
Calibration
Model activation
Decision
Recommendation
AO-ACT
Approval
Dispatch
Customer reports
Field Memory
ROI
workflow changes
new mathematical dependency
```

## 44.3 Per-slice boundary

Capability-wide allowance不等于任一 slice 可修改整个目录。

每个 slice Gate 必须冻结 exact changed files，并禁止修改：

```text
unrelated a0_* source
bootstrap math
MCFT-CAP-01 docs
MCFT-CAP-01 expected fixtures
MCFT-00 hashes
```

除非有已证明的 predecessor compatibility defect，并通过独立 remediation 授权。

唯一无须 predecessor remediation 授权的 `cap_01` 路径是：

```text
docs/digital_twin/mcft/cap_01/
GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json
```

该例外仅允许 create/update 这一个精确文件，不允许修改同目录任何其他文件。

---

# 45. Hard acceptance

> 本节编号用于审计定位。后续新增条目允许产生非连续编号；Gate 必须按 requirement code 或完整文本匹配，不得依赖数组位置。


## Authority and governance

1. PR #2316 已合并；merged-main verification 仍待建立仓库证据。
2. predecessor exact merge SHA 已冻结。
3. predecessor final Gate 在 main 通过。
4. MCFT-CAP-02-AUTHORIZATION-V1 已合并。
5. capability matrix status 为 READY_FOR_IMPLEMENTATION 或当前 slice 状态。
6. 所有 slice 声明 exact dependency。
7. 无 successor 自动授权。
8. 工作树 clean。
9. exact-head CI green。
10. 无 DT-02 未授权修改。

## Predecessor consumption

11. 从 Postgres 读取 MCFT-CAP-01 State。
12. 从 Postgres 读取 MCFT-CAP-01 checkpoint。
13. 从 Postgres 读取 active lineage canonical object。
14. active lineage object ref 与 semantic lineage ID 被区分。
15. Runtime Config 从 canonical fact读取。
16. Reality Binding snapshot 可验证。
17. 不重新 bootstrap。
18. 不读取 expected fixture 代替 predecessor。
19. previous State hash 精确匹配。
20. previous checkpoint hash 精确匹配。

## Runtime Config

21. Continuation Runtime Config 通过 D transaction canonical append。
22. parent config ref/hash存在。
23. Reality/source/config/geometry hashes一致。
24. crop-stage context ref/hash一致。
25. 300 mm resolution policy显式。
26. wilting/field-capacity/saturation参数完整。
27. Dynamics参数标记 controlled synthetic。
28. uncertainty policy标记 additive budget。
29. config selection mode = EXPLICIT_REPLAY_PIN。
30. `soil_root_zone_config_refs` 完整。
31. `model_component_refs` 完整。

## Dynamics

32. 使用 persisted previous storage computation basis。
33. 首 tick variance bridge只执行一次。
34. 后续 variance消费 persisted storage variance basis。
35. Rainfall使用 exact hourly interval。
36. ET0使用 exact hourly interval。
37. Kc来自 configuration context。
38. crop root depth字段不改变300 mm State coordinate。
39. Approved plan不进入水量平衡。
40. Dispatched amount不进入水量平衡。
41. 只有 eligible execution Evidence进入 irrigation。
42. 多 execution events 按冻结顺序聚合。
43. Coverage fraction保留在trace。
44. Runoff可复算。
45. Crop ET可复算。
46. Drainage可复算。
47. Overflow可复算。
48. Mass-balance internal error为零。
49. Published mass-balance error为0.000000。
50. Storage位于 `[0,135]`。
51. VWC位于 `[0,0.45]`。
52. Domain rerun byte-equivalent。
53. Domain无IO、clock、random。

## Uncertainty budget

54. Previous storage variance从 computation basis读取。
55. Structural variance显式增加。
56. Rainfall budget显式。
57. ET budget显式。
58. Irrigation budget显式。
59. covariance assumption显式。
60. 无 observation update 时 variance不下降。
61. computation basis持久化。
62. published VWC variance可复算。
63. interval可复算。
64. clipping metadata完整。
65. clipping不改变latent variance。
66. 不声明完整非线性统计传播。

## Evidence Window

67. Rainfall interval_start/end精确。
68. ET0 interval_start/end精确。
69. missing rainfall失败。
70. missing ET0失败。
71. future record不进入current tick。
72. late unavailable record不进入current tick。
73. quality FAIL不消费。
74. scope mismatch不消费。
75. identical duplicate确定性dedup。
76. conflicting duplicate失败。
77. Soil observation只作为candidate。
78. approved plan标记context-only。
79. future assumptions标记Forecast blocked not consumed。
80. 每条entry具有完整消费语义。

## Canonical objects

81. 每 tick 恰好8 facts。
82. 不追加第二个 lineage object。
83. Transition kind = CONTINUATION。
84. previous posterior必填。
85. bootstrap prior不存在。
86. assimilation update = NOT_APPLIED。
87. consumed observation refs为空。
88. innovation/residual/gain为空。
89. State与propagated prior数值一致。
90. State不含scenario_input_eligible。
91. Forecast = BLOCKED。
92. Forecast points为空。
93. Forecast reason codes精确。
94. Tick = COMPLETED_WITH_LIMITATIONS。
95. Checkpoint kind = CONTINUATION。
96. previous checkpoint必填。
97. tick_sequence连续。
98. mass-balance trace嵌入Transition。
99. State记录mass-balance trace hash。
100. 完整cross-ref graph验证。
101. Runtime Config refs/hashes全体一致。
102. lineage/revision全体一致。
103. fact ID不参与semantic hash。
104. created_at不参与semantic hash。

## Identity and idempotency

105. operation key不包含Evidence digest。
106. aggregate hash包含Evidence digest。
107. 同 operation key、同hash返回existing success。
108. 同 operation key、不同hash返回conflict。
109. idempotent retry不获取新lease。
110. idempotent retry不增加fence token。
111. idempotent retry不增加facts。
112. idempotent retry不增加projections。
113. object IDs相同。
114. determinism hashes相同。
115. idempotency projection丢失时canonical uniqueness仍阻止第二tick。

## Persistence and CAS

116. Facts与projections同事务。
117. State history每tick增加一条。
118. State latest每tick CAS。
119. Checkpoint latest每tick CAS。
120. Forecast result latest每tick CAS。
121. Successful Forecast latest保持空。
122. Active lineage pointer不变化。
123. Active lineage canonical object可解析。
124. Projection可重建。
125. Rebuild后latest/history等价。
126. 任一fault stage当前tick零A2部分写。
127. 可选F audit不被误算为A2 partial success。

## Single and 24-tick chain

128. first continuation tick exact expected。
129. first computation basis exact expected。
130. 恰好24 continuation ticks。
131. Logical time每次增加PT1H。
132. 每个State指向前一State。
133. 每个checkpoint指向前一checkpoint。
134. 同一lineage/revision总State count为25。
135. 最终storage = `56.788512 mm`。
136. 最终VWC mean = `0.189295`。
137. 最终storage variance basis = `247.020977062500 mm²`。
138. 最终VWC variance = `0.002745`。
139. 最终AWF = `0.384972`。
140. 最终depletion = `33.211488 mm`。
141. 所有count按scope/lineage/revision/time限定。

## Restart/resume/backfill

142. 第12 tick后停止。
143. 新进程从第13 tick继续。
144. 不重新执行前12 ticks。
145. resume使用同一single-tick path。
146. range使用同一single-tick path。
147. backfill使用同一single-tick path。
148. Backfill只补连续缺口。
149. Backfill不跳过失败tick。
150. Backfill最大24 ticks。
151. Restart最终State与单次运行一致。
152. Restart最终hashes与单次运行一致。
153. Forward backfill不创建revision lineage。
154. Late Evidence不作为forward backfill输入。

---

# 46. Required negative tests

至少包括：

```text
predecessor PR not merged
predecessor main verification missing
predecessor verification artifact written under cap_02
unapproved cap_01 doc modified
MCFT-CAP-02 authorization missing
wrong predecessor merge SHA
missing previous State
missing previous checkpoint
missing active lineage object
active lineage object ref mismatch
semantic lineage ID mismatch
wrong revision
wrong scope
wrong Runtime Config ref
wrong Runtime Config hash
wrong Reality Binding hash
wrong crop-stage context hash
dynamic root depth applied without authorization
missing computation basis
second tick re-derives variance from rounded VWC

missing exact rainfall interval
missing exact ET0 interval
30-minute rainfall used as hourly
2-hour ET0 used as hourly
future rainfall
future ET0
late rainfall
late ET0
quality FAIL rainfall
quality FAIL ET0
scope mismatch rainfall
scope mismatch ET0
conflicting duplicate rainfall
conflicting duplicate ET0
conflicting duplicate execution
identical duplicate nondeterministic winner

approved plan used as execution
planned amount used as execution
dispatched amount used as execution
ineligible execution used
coverage below 0
coverage above 1
negative executed amount
execution event double-counted
NaN flux
negative ET0
negative rainfall

mass-balance trace contains self hash
Transition and State mass_balance_trace_hash mismatch
mass-balance hash computed from trace containing hash field
mass-balance mismatch
AWF computed from rounded VWC
AWF not clipped below zero
AWF not clipped above one
depletion computed from rounded VWC
wrong AWF rounding rule
wrong depletion rounding rule
negative final storage
storage above saturation after overflow
negative variance
uncertainty decreases without observation update
hidden bootstrap prior in CONTINUATION
CONTINUATION without previous posterior
CONTINUATION checkpoint without previous checkpoint
invalid tick_sequence

Forecast BLOCKED with points
Forecast BLOCKED without reason codes
successful Forecast index advanced
Scenario created
Forecast residual created
observation innovation created
assimilation gain created
soil observation copied into State
scenario_input_eligible introduced on State

operation key includes Evidence digest
same operation key different hash accepted
second same-time continuation written after idempotency projection deletion

stale fencing token
lease expired
checkpoint CAS conflict
State latest CAS conflict
Forecast result CAS conflict
active lineage pointer conflict
partial fact-write injection
partial projection-write injection
idempotency guard injection
projection divergence silently repaired

backfill before bootstrap
backfill skips hour
backfill exceeds maximum
late Evidence treated as forward backfill
second active lineage created
public HTTP tick route introduced
background scheduler introduced
```

每个 negative fixture 必须包含：

```yaml
fixture_id:
expected_reason_code:
expected_stage:
expected_no_current_tick_a2_append:
expected_no_current_tick_projection_write:
expected_checkpoint_unchanged:
expected_state_latest_unchanged:
expected_forecast_result_latest_unchanged:
expected_active_lineage_unchanged:
optional_f_audit_allowed:
```

---

# 47. 六个运行问题

## 输入的现实证据是什么？

```text
previous persisted posterior State
hourly observed rainfall
hourly historical ET0 estimate
eligible irrigation execution Evidence
configuration-derived crop-stage code and Kc
```

Soil observation 可进入窗口，但不参与 MCFT-CAP-02 State update。

## 产生哪个 first-class Twin object？

每小时产生：

```text
twin_state_estimate_v1
```

以及不可分割的：

```text
Evidence Window
State transition
NOT_APPLIED assimilation update
BLOCKED Forecast
terminal tick
continuation checkpoint
Runtime Health
```

## 状态如何变化？

```text
previous storage
+ effective rainfall
+ effective executed irrigation
- actual crop ET
- drainage
- overflow
→ next storage
```

## 不确定性如何变化？

```text
previous persisted storage variance budget
+ rainfall budget
+ ET budget
+ irrigation budget
+ structural budget
→ next persisted storage variance budget
```

## 输出如何被下一 tick 消费？

下一 tick 从 PostgreSQL 读取：

```text
active lineage canonical object ref
semantic lineage_id
revision_id
previous posterior
previous checkpoint
pinned Runtime Config
next logical time
storage mean computation basis
storage variance computation basis
```

## Nonclaims 是什么？

见第 49 节。

---

# 48. Completion claims

全部验收通过后只允许声明：

```text
MCFT_CAP_02_COMPLETE

HOURLY_WATER_DYNAMICS_V1_ESTABLISHED

TWENTY_FOUR_CONTINUATION_TICKS_PERSISTED

CONTINUATION_STATE_CHAIN_ESTABLISHED

CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_ESTABLISHED

CONTINUATION_CHECKPOINT_CHAIN_ESTABLISHED

CONTINUATION_OPERATION_IDEMPOTENCY_ESTABLISHED

CONTINUATION_CANONICAL_UNIQUENESS_ESTABLISHED

RESTART_RESUME_PROVEN

BOUNDED_FORWARD_BACKFILL_PROVEN

EXACT_HOURLY_EVIDENCE_SELECTION_ESTABLISHED

EXECUTED_IRRIGATION_INPUT_POLICY_ESTABLISHED
```

---

# 49. Preserved nonclaims

```text
NO_OBSERVATION_UPDATE_APPLIED

NO_OBSERVATION_INNOVATION_COMPUTED

NO_FORECAST_RESIDUAL

NO_SUCCESSFUL_FORECAST

NO_SCENARIO

NO_RECOMMENDATION

NO_DECISION

NO_AO_ACT

NO_CALIBRATED_CONFIDENCE_MODEL

NO_MODEL_ACTIVATION

NO_LATE_EVIDENCE_REVISION

NO_DYNAMIC_ROOT_ZONE_GEOMETRY

NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION

NO_CONTINUOUS_RUNTIME

NO_CONTINUOUS_SCHEDULER

NO_720_TICK_REPLAY_CLOSURE

NO_LIVE_FIELD_CLAIM

NO_MCFT_GATE_A_CLOSURE

NO_MCFT_GATE_B_CLOSURE

NO_MCFT_GATE_C_CLOSURE

NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

---

# 50. Completion standard

MCFT-CAP-02 只有在以下事实同时成立时完成：

```text
MCFT-CAP-01 remediation merged and main-verified
MCFT-CAP-02 authorization merged
predecessor canonical State consumed
no re-bootstrap
fixed 300 mm State coordinate preserved
hourly Dynamics mathematically established
mass balance closes exactly
additive process uncertainty budget persists
first continuation tick committed
24 continuation States committed
all State refs form one chain
all checkpoint refs form one chain
all ticks use one active lineage/revision
each tick is atomic
same operation rerun idempotent
different aggregate under same operation key conflicts
canonical uniqueness survives projection loss
restart from persisted checkpoint proven
bounded forward backfill proven
projection rebuild proven
final numerical State matches expected
all negative fixtures rejected
final working tree clean
final exact-head CI green
final closure Gate green
merged main verification green
```

---

# 51. Successor

唯一计划 successor：

```text
MCFT-CAP-03
Observation Assimilation and State Innovation
```

它必须从：

```text
2026-06-02T01:00:00.000Z
```

的最后 posterior 和 checkpoint 开始。

它不得：

```text
重新 bootstrap
重写前24个 continuation ticks
重新定义 Dynamics
重新定义 additive uncertainty budget
重新选择 State coordinate authority
将 observation innovation 冒充 Forecast residual
```

冻结区分：

```text
State innovation / observation innovation
  belongs to twin_assimilation_update_v1

Forecast residual
  belongs to twin_forecast_residual_v1
  requires historical COMPLETED Forecast point
```

由于 MCFT-CAP-02 保留 `NO_SUCCESSFUL_FORECAST`，MCFT-CAP-03 不得建立 Forecast residual。

MCFT-CAP-03 只有在 MCFT-CAP-02 merged、main-verified、closure COMPLETE 后，才可通过独立授权进入设计或实现。

---

# 52. 最终冻结结论

```text
MCFT-CAP-02 DESIGN:
FROZEN

MCFT-CAP-02 IMPLEMENTATION:
BLOCKED

PREDECESSOR PR:
MERGED

PREDECESSOR FINAL PR-HEAD CI:
PASS

BLOCKER 1:
MCFT_CAP_01_MERGED_MAIN_VERIFICATION_ARTIFACT_COMPLETE

BLOCKER 2:
MCFT_CAP_01_PREDECESSOR_CANONICAL_IDENTITY_LOCK_COMPLETE

BLOCKER 3:
MCFT_CAP_02_AUTHORIZATION_V1_MERGED

AUTOMATIC_SUCCESSOR:
NONE
```

填入 predecessor final merge SHA、Runtime Config object ID、bootstrap State ID、bootstrap checkpoint ID、active lineage object ref、lineage ID 和 revision ID 后，不需要重新设计主体。

任何后续实施不得弱化本任务书中的：

```text
operation key / aggregate hash separation
fixed 300 mm State coordinate
storage computation basis authority
storage-basis AWF and depletion formulas
non-recursive mass-balance trace hashing
exact merged-main verification artifact path
exact-hour Evidence selection
active lineage ref / lineage ID distinction
A2 eight-object atomicity
per-tick transaction boundary
restart/resume persisted read path
preserved nonclaims
```
