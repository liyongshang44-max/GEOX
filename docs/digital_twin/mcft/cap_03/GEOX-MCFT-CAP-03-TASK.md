<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TASK.md -->
# GEOX MCFT-CAP-03 — Observation Assimilation and State Innovation

## 完整任务线 v1.2 最终冻结候选

> **Versioned contract amendment:**
> [GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md](./GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md)
> records the additive V2 semantic-conformance path established by R4 remediation.
> The v1.2 text remains historical authority and is not rewritten or reinterpreted.

```text
capability_line_id:
MCFT-CAP-03

display_alias:
MCFT-3

canonical_name:
Observation Assimilation and State Innovation

task_display_name:
Observation Assimilation and Innovation Residual

runtime_mode:
REPLAY

target_completion_level:
Level A — Deterministic Replay Twin

primary_owner_work_package_id:
MCFT-07

contributing_owner_work_package_ids:
MCFT-02
MCFT-03
MCFT-04
MCFT-05
MCFT-06
MCFT-08
MCFT-09

excluded_owner_work_package_ids:
MCFT-10 through MCFT-18

design_status:
FINAL_FROZEN_CANDIDATE_V1_2

design_freeze_effectiveness_condition:
S0_MERGED_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS

implementation_status:
NOT_AUTHORIZED

repository_authority_main:
d1a3948d06e4c7896d513168d31ef52409c3e0f0

predecessor_capability_line_id:
MCFT-CAP-02

predecessor_status:
COMPLETE

successor_capability_line_id:
MCFT-CAP-04

successor_authorized:
false
```

本文件冻结候选中的语义、边界、Delivery Slice Graph、验收标准、完成声明和保留 nonclaims。

本文件本身不授权 Runtime 实现。只有 `S0 — Authorization and Predecessor Lock` 合并并通过 merged-main Authorization Gate 后：

```text
design_status = DESIGN_FROZEN
implementation_status = READY_FOR_IMPLEMENTATION
active_delivery_slice_id =
MCFT-CAP-03.MCFT-02-07-08.ASSIMILATION-CONTRACTS-CONFIG-V1
```

在此之前：

```text
repository_write = NONE
MCFT-CAP-03 implementation = NOT_AUTHORIZED
first permitted repository action = S0 Authorization and Predecessor Lock
MCFT-CAP-04 = NOT_AUTHORIZED
```

---

# 0. 任务定位

MCFT-CAP-03 的目标是把 MCFT-CAP-02 已建立的纯 Dynamics progression：

```text
previous posterior
→ hourly propagation
→ propagated prior
→ unchanged posterior
```

升级为：

```text
previous posterior
→ hourly propagation
→ propagated prior
→ observation prediction
→ innovation / state-observation residual
→ observation disposition
→ bounded assimilation update
→ posterior State
→ persisted checkpoint
```

本能力线第一次使新的、受授权的土壤水分观测参与持续 State 更新。

本能力线建立：

```text
State Observation Assimilation
State Observation Innovation Residual
Posterior State Correction
Posterior Uncertainty Update
```

本能力线不建立：

```text
Forecast Residual Monitoring
72-Hour Forecast
Scenario
Recommendation
Decision
Action
Model Calibration
Shadow Evaluation
Model Activation
Automatic Learning
Late-Evidence Revision
Continuous Runtime
```

---

# 1. 仓库对齐事实

## 1.1 前置能力已完成

当前 canonical `main`：

```text
d1a3948d06e4c7896d513168d31ef52409c3e0f0
```

MCFT-CAP-02 已正式建立：

```text
hourly Dynamics
fixed 300 mm State coordinate
controlled additive process uncertainty
exact-hour Evidence Window
A2 eight-object transaction
24 contiguous continuation ticks
25-State predecessor-inclusive CAP-02 range
restart/resume
bounded forward backfill
failure recovery
canonical uniqueness
projection rebuild
```

当前状态：

```text
MCFT-CAP-02 status = COMPLETE
closure_effective = true
active_delivery_slice_id = null
```

## 1.2 前置 nonclaims

MCFT-CAP-02 仍保留：

```text
NO_OBSERVATION_UPDATE_APPLIED
NO_OBSERVATION_INNOVATION_COMPUTED
NO_FORECAST_RESIDUAL
NO_SUCCESSFUL_FORECAST
NO_CALIBRATED_CONFIDENCE_MODEL
NO_MODEL_ACTIVATION
NO_LATE_EVIDENCE_REVISION
```

MCFT-CAP-03 只关闭：

```text
NO_OBSERVATION_UPDATE_APPLIED
NO_OBSERVATION_INNOVATION_COMPUTED
```

其余 nonclaims 继续保留，或由 CAP-03 更精确的 nonclaims 扩展。

## 1.3 现有可复用实现

仓库已有：

```text
SCALAR_GAUSSIAN_ASSIMILATION_V1
POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1
PASS / LIMITED quality weighting
sensor variance
representativeness variance
A_STATE_TICK_COMMIT
A2_BLOCKED_FORECAST
eight-object continuation aggregate
lease + fencing
expected-current CAS
idempotency index
canonical readback
projection rebuild
```

本任务必须复用这些已成立边界，不重新设计同义公式或事务。

---

# 2. Predecessor handoff 勘误与权威起点

## 2.1 已发现的历史元数据错误

当前 MCFT-CAP-02 Main Verification 中存在：

```text
successor.required_start_logical_time:
2026-06-02T01:00:00.000Z
```

但 CAP-02 的第 24 个 continuation tick 已位于：

```text
last_continuation_logical_time:
2026-06-02T01:00:00.000Z
```

其 checkpoint 指向：

```text
next_tick_logical_time:
2026-06-02T02:00:00.000Z
```

因此 `01:00` 不能作为 CAP-03 第一个 tick。

## 2.2 不回写 predecessor 历史事实

禁止静默修改已经闭合的 MCFT-CAP-02 Main Verification、Closure Record 或已生效 completion artifact。

S0 必须新增 additive governance artifacts：

```text
GEOX-MCFT-CAP-02-HANDOFF-ERRATUM-01.json
GEOX-MCFT-CAP-03-PREDECESSOR-LOCK.json
```

勘误至少记录：

```yaml
superseded_field:
  artifact: GEOX-MCFT-CAP-02-MAIN-VERIFICATION.json
  field: successor.required_start_logical_time
  historical_value: 2026-06-02T01:00:00.000Z

canonical_authority:
  source: persisted checkpoint canonical read path
  field: next_tick_logical_time
  expected_value: 2026-06-02T02:00:00.000Z

mutation_policy:
  predecessor_historical_artifact_rewrite: FORBIDDEN
  additive_erratum_only: REQUIRED
```

## 2.3 PostgreSQL canonical handoff 是唯一权威

授权前必须从隔离 PostgreSQL canonical read path 提取：

```text
active_lineage_ref
lineage_id
revision_id
latest_state_ref
latest_state_hash
latest_checkpoint_ref
latest_checkpoint_hash
latest_forecast_result_ref
latest_forecast_result_hash
latest_successful_forecast_ref
runtime_config_ref
runtime_config_hash
checkpoint.tick_sequence
checkpoint.next_tick_logical_time
```

CAP-03 第一个 tick 的权威起点只能来自：

```text
checkpoint.next_tick_logical_time
```

预期值：

```text
2026-06-02T02:00:00.000Z
```

若数据库读出值不是该时间，S0 必须失败并停止授权，不得通过以下方式规避：

```text
新 revision
重放 01:00
覆盖现有 State
修改 predecessor canonical facts
绕过 canonical uniqueness
手工指定另一个起点
```

---

# 3. Residual 语义冻结

MCFT-CAP-03 中的 residual 固定定义为：

```text
state observation innovation residual
=
actual observation
-
predicted observation from propagated prior
```

数学表达：

```text
y_t     = selected observation
x⁻_t    = propagated prior State
H       = observation operator
ŷ_t     = H × x⁻_t
r_t     = y_t - ŷ_t
```

冻结：

```text
innovation == residual
```

两者数值必须完全一致，但语义标签同时保留：

```text
innovation:
State-estimation terminology

residual:
Product and trace terminology

residual_kind:
STATE_OBSERVATION_INNOVATION
```

本任务禁止创建：

```text
twin_forecast_residual_v1
```

`C_FORECAST_RESIDUAL_COMMIT` 只适用于：

```text
historical COMPLETED Forecast point
+
later matched observation
```

当前 Forecast 仍为 `BLOCKED`，没有 Forecast point。

CAP-03 residual 必须作为 first-class `twin_assimilation_update_v1` payload 的一部分提交。

---

# 4. 架构判定

## 4.1 不需要 DT-02 Architecture Amendment

现有 `A_STATE_TICK_COMMIT` / `A2_BLOCKED_FORECAST` 已包含：

```text
twin_evidence_window_v1
twin_state_transition_v1
twin_assimilation_update_v1
twin_state_estimate_v1
twin_forecast_run_v1
twin_runtime_tick_v1
twin_runtime_checkpoint_v1
twin_runtime_health_v1
```

A2 的永久语义是：

```text
posterior valid
Forecast.status = BLOCKED
Forecast.points = []
Forecast.reason_codes non-empty
checkpoint advances
tick = COMPLETED_WITH_LIMITATIONS
```

A2 不永久要求：

```text
assimilation.status = NOT_APPLIED
```

当前 CAP-02 的 `NOT_APPLIED / DEFERRED_TO_MCFT_CAP_03` 只是 CAP-02 contract 边界。

因此 CAP-03：

```text
不新增 transaction family
不新增 canonical object type
不新增第九个 residual object
不改变八对象 aggregate
不改变 active lineage
不创建 revision lineage
不创建 successful Forecast
```

## 4.2 Architecture Amendment 触发条件

只有发现以下真实冲突，才允许提出 DT-02 Architecture Amendment：

```text
canonical object type 无法表达所需语义
A2 transaction family 无法保持 atomicity
现有 lineage/revision 规则无法维持
现有 CAS 或 idempotency 无法保证 canonical uniqueness
必须新增 projection 才能满足 canonical readback
```

实现便利、类型重构、文件布局或测试组织不构成 Amendment 理由。

---

# 5. Versioned contract 与历史兼容

## 5.1 历史 validator 不得被覆盖

禁止直接修改 CAP-02 validator，使旧 canonical facts 被新规则重新解释。

必须实行版本化 dispatch：

```text
MCFT-CAP-02 record set
→ ContinuationRecordSetV1
→ continuation contract v1
→ NOT_APPLIED / DEFERRED_TO_MCFT_CAP_03 validator

MCFT-CAP-03 record set
→ AssimilatedContinuationRecordSetV1
→ assimilated continuation contract v1
→ APPLIED / NOT_APPLIED observation-aware validator
```

以下类型必须保持 immutable：

```text
ContinuationAggregateIdentityInputV1
ContinuationRecordSetV1
```

CAP-03 必须新增独立类型：

```text
AssimilatedContinuationAggregateIdentityInputV1
AssimilatedContinuationRecordSetV1
```

不得原地扩展 V1 并让历史 readback 依赖新字段。

## 5.2 新 contract discriminator

CAP-03 必须新增 immutable discriminator：

```text
record_set_contract_id:
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
```

该字段必须：

```text
存在于 twin_runtime_tick_v1 payload
存在于 CAP-03 record-set aggregate identity input
进入 aggregate determinism hash
进入 canonical readback dispatch
不进入 operation key
不改变 A2 operation_variant
```

CAP-02 历史 record set 没有该字段，历史 dispatch 必须依赖其 immutable Runtime Config purpose：

```text
HOURLY_DYNAMICS_CONTINUATION
```

CAP-03 dispatch 必须同时要求：

```text
record_set_contract_id =
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1

runtime_config.config_purpose =
HOURLY_DYNAMICS_WITH_OBSERVATION_ASSIMILATION
```

未知、缺失或不一致的组合必须：

```text
fail closed
zero A2 canonical write
zero A2 projection mutation
```

不得依赖：

```text
当前日期
数据库插入顺序
分支名称
代码版本号
猜测 payload 形状
```

## 5.3 Operation key 与 aggregate hash

operation key 继续保持：

```text
scope
lineage_id
revision_id
logical_time
operation_variant = A2_BLOCKED_FORECAST
```

operation key 禁止包含：

```text
Evidence digest
selected observation
Runtime Config ref/hash
record_set_contract_id
member hashes
```

CAP-03 aggregate identity / aggregate determinism hash 必须包含：

```text
record_set_contract_id
runtime_config_ref/hash
evidence_window_semantic_digest
previous posterior ref/hash
previous checkpoint ref/hash
previous Forecast-result ref/hash
Reality Binding ref/hash
observation policy version
assimilation method version
member determinism hashes
```

因此：

```text
same operation key + same aggregate hash
→ EXISTING_IDEMPOTENT_SUCCESS

same operation key + different aggregate hash
→ IDEMPOTENCY_CONFLICT
```

---

# 6. Runtime Config

CAP-03 必须创建新的 immutable Runtime Config，不得隐式改变 CAP-02 config。

```text
config_purpose:
HOURLY_DYNAMICS_WITH_OBSERVATION_ASSIMILATION

config_selection_mode:
EXPLICIT_REPLAY_PIN

parent_runtime_config_ref:
predecessor_latest_posterior.runtime_config_ref

parent_runtime_config_hash:
predecessor_latest_posterior.runtime_config_hash
```

S0 必须验证 parent config 与 predecessor State、checkpoint、persisted config 一致。

该 config 通过：

```text
D_MODEL_GOVERNANCE_STEP_COMMIT
```

追加一个 `twin_runtime_config_v1`。

每个 CAP-03 tick request 必须显式携带并验证：

```text
runtime_config_ref
runtime_config_hash
```

禁止：

```text
按 latest inserted config 自动选择
通过 active-config pointer 隐式选择
缺失 explicit pin 时继续执行
```

缺失、hash 不一致或 purpose/contract 不一致必须 fail closed。

禁止：

```text
active config pointer activation
model activation
active model parameter mutation
```

必须继承并保持不变：

```text
Reality Binding
source matrix
configuration matrix
geometry hash
300 mm governed root zone
hydraulic bounds
Dynamics model
runoff coefficient
drainage coefficient
process uncertainty
irrigation aggregation policy
rounding policy
Forecast BLOCK policy
```

必须移除 CAP-02 的：

```text
DEFER_OBSERVATION_ASSIMILATION_TO_MCFT_CAP_03_V1
```

并新增：

```text
observation_selector_id:
LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V1

observation_binding_id:
soil_obs_c8_20cm_v1

observation_quantity_kind:
VOLUMETRIC_WATER_CONTENT

canonical_unit:
fraction

observation_operator_id:
POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1

observation_operator_h:
1

direct_state_equivalence:
false

sensor_measurement_stddev_fraction:
0.02

point_to_zone_representativeness_stddev_fraction:
0.06

quality_weights:
PASS: 1.0
LIMITED: 0.5
FAIL: 0.0

assimilation_method_id:
SCALAR_GAUSSIAN_ASSIMILATION_V1

innovation_outlier_policy_id:
SQUARED_NORMALIZED_INNOVATION_MAX_16_INCLUSIVE_V1

max_squared_normalized_innovation:
16.0

reported_max_absolute_normalized_innovation:
4.0

physical_bound_version:
ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1

posterior_clip_policy:
CLIP_MEAN_TO_ZERO_AND_SATURATION_RETAIN_LATENT_VARIANCE_V1

record_set_contract_id:
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1

active_model_parameter_change:
FORBIDDEN
```

冻结约束：

```text
R_base > 0

configured quality weights:
PASS ∈ (0, 1]
LIMITED ∈ (0, 1]
FAIL = 0

selected usable observation quality weight:
(0, 1]

FAIL quality:
never enters R_effective calculation
never becomes selected observation

prior variance >= 0
all numeric config values finite
```

---

# 7. Evidence Window 与 observation selector

## 7.0 Versioned observation-aware Evidence Window

CAP-02 的以下类型和实现保持 immutable：

```text
ContinuationEvidenceWindowV1
buildContinuationEvidenceWindowV1
```

其历史语义继续保持：

```text
soil moisture =
AVAILABLE_NOT_CONSUMED_MCFT_CAP_02
```

CAP-03 必须新增独立 application contract，例如：

```text
AssimilatedContinuationEvidenceWindowV1
buildAssimilatedContinuationEvidenceWindowV1
```

该 contract 必须：

```text
复用 CAP-02 rainfall / ET0 / irrigation selection semantics
不修改 CAP-02 historical Evidence Window payload
对 soil_moisture_records 执行 CAP-03 observation-specific selector
输出 candidate assessments
输出 evaluated / applied / rejected Evidence classifications
生成 CAP-03 专属 semantic digest
支持 canonical readback 与 deterministic rebuild
```

CAP-03 canonical `twin_evidence_window_v1` payload 必须声明：

```text
evidence_window_contract_id:
MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V1
```

未知 Evidence Window contract、CAP-02/CAP-03 contract 混用或历史 payload 重解释必须 fail closed。

## 7.1 时间窗口

继续使用：

```text
(T - PT1H, T]
```

Observation 必须同时满足：

```text
observed_at > T - PT1H
observed_at <= T
available_to_runtime_at <= T
ingested_at <= T
T - observed_at <= PT15M
```

边界冻结：

```text
observed_at = T - PT15M
→ eligible

observed_at < T - PT15M
→ stale, not eligible

observed_at = T
→ eligible if available/ingested <= T
```

## 7.2 授权输入

v1 只允许：

```text
record_type:
soil_moisture_observation_v1

epistemic_class:
OBSERVED

binding_id:
soil_obs_c8_20cm_v1

quantity_kind:
VOLUMETRIC_WATER_CONTENT

canonical_payload.unit:
fraction

physical range:
0 <= value <= saturation_fraction
```

权威数值来自：

```text
canonical_payload.value
```

`source_payload` 只用于 trace，不得参与 assimilation。

普通 candidate exclusion 不得消费：

```text
未转换的 percent source value
其他 depth/binding
其他 zone
其他 field
其他 season
未来 observation
late observation
FAIL quality
physical bound violation
```

以下不是普通 exclusion，而是 malformed canonical Evidence：

```text
missing source_record_hash
missing source_record_id
missing role_time
missing canonical_payload
missing source_payload.unit
missing quality.status
unknown quality status
unsupported record_type
unsupported epistemic_class
non-finite canonical value
```

处理固定为：

```text
MALFORMED_CANONICAL_OBSERVATION
→ contract failure
→ entire A2 tick fail closed
```

## 7.3 Observation semantic identity 与内容等价

semantic duplicate identity 固定为：

```text
tenant_id
project_id
group_id
field_id
season_id
zone_id
binding_id
quantity_kind
observed_at
origin_source_kind
origin_source_id
source_version
```

另行计算：

```text
observation_semantic_content_hash
=
hash(
  canonical_payload,
  quality.status,
  source_unit,
  canonical_unit,
  conversion_rule,
  epistemic_class
)
```

同一 semantic identity：

```text
same observation_semantic_content_hash
→ IDENTICAL_DUPLICATE_SUPPRESSED

different observation_semantic_content_hash
→ CONFLICTING_DUPLICATE_EVIDENCE
→ entire tick fail closed
```

`source_record_hash` 必须保留为 provenance trace，但不得单独决定内容等价。

字段来源固定为：

```text
record_type
← canonical Evidence envelope

epistemic_class
← canonical Evidence envelope

source_unit
← source_payload.unit

canonical_unit
← canonical_payload.unit

conversion_rule
← authorized source-binding conversion policy

canonical_payload
← canonical Evidence envelope
```

`observation_semantic_content_hash` 必须使用仓库统一 canonical semantic hash，禁止使用普通 `JSON.stringify` 或依赖对象插入顺序。

canonical readback validator 必须能够仅根据已提交 canonical payload 重算该 hash。

`source_record_id` 不属于 semantic identity，只用于确定性 winner 和排序。

## 7.4 Candidate 处理顺序

固定顺序：

```text
1. canonical structure validation
2. scope / time / binding / record-type / epistemic-class validation
3. compute semantic identity
4. compute observation_semantic_content_hash
5. identical/conflicting duplicate resolution
6. physical-bound and quality eligibility
7. latest usable selection
8. selected observation prediction and innovation
9. exact squared normalized-innovation gate
10. decide APPLIED or NOT_APPLIED
```

这样保证同一 semantic identity 下的 quality、canonical payload 或 conversion-rule 差异不会在 duplicate resolution 前被掩盖。

## 7.5 Duplicate winner 与确定性排序

identical duplicate winner 固定为：

```text
ingested_at DESC
source_record_id ASC
```

完成 duplicate resolution 后，usable candidates 排序：

```text
observed_at DESC
ingested_at DESC
source_record_id ASC
```

candidate 输入顺序任意打乱时，duplicate winner、selector 输出和 semantic digest 必须完全一致。

## 7.6 多 observation 边界

v1 不做多传感器融合。

同一授权 binding 存在多个不同时间 usable observations：

```text
只选择 latest usable
其他记录 = NOT_SELECTED_OLDER_USABLE
```

不同 binding：

```text
candidate_assessment = REJECTED_UNAUTHORIZED_BINDING
```

不得：

```text
平均
拼接
加权融合
隐式 multi-sensor fusion
```

---

# 8. Candidate assessment、Update disposition 与 failure 分类

## 8.1 Candidate assessment enum

每个 candidate 必须有独立 assessment：

```text
ELIGIBLE
SELECTED
NOT_SELECTED_OLDER_USABLE
IDENTICAL_DUPLICATE_SUPPRESSED
REJECTED_SCOPE
REJECTED_TIME_FUTURE
REJECTED_TIME_LATE
REJECTED_TIME_STALE
REJECTED_UNAUTHORIZED_BINDING
REJECTED_RECORD_TYPE
REJECTED_QUANTITY
REJECTED_CANONICAL_UNIT
REJECTED_PHYSICAL_BOUNDS
REJECTED_QUALITY_FAIL
```

每条 candidate 必须保留足以独立重算 semantic content hash 的字段：

```text
observation_ref
source_record_id
source_record_hash
observation_semantic_content_hash
record_type
epistemic_class
observed_at
available_to_runtime_at
ingested_at
binding_id
quantity_kind
source_unit
canonical_unit
conversion_rule
canonical_payload
canonical_value
quality_status
temporal_offset_seconds
candidate_assessment
reason_codes
```

每个 candidate 只能有一个 primary assessment。多条件同时成立时，primary assessment 优先级固定为：

```text
REJECTED_SCOPE
>
REJECTED_TIME_FUTURE
>
REJECTED_TIME_LATE
>
REJECTED_TIME_STALE
>
REJECTED_UNAUTHORIZED_BINDING
>
REJECTED_RECORD_TYPE
>
REJECTED_QUANTITY
>
REJECTED_CANONICAL_UNIT
>
REJECTED_PHYSICAL_BOUNDS
>
REJECTED_QUALITY_FAIL
```

其余命中条件进入 `reason_codes`，不得改变 primary assessment。

## 8.2 Update status

顶层 `twin_assimilation_update_v1`：

```text
update_status:
APPLIED | NOT_APPLIED
```

## 8.3 Update disposition

```text
update_disposition:
ACCEPTED
DOWNWEIGHTED
REJECTED_OUTLIER
NO_USABLE_OBSERVATION
```

冻结组合：

```text
APPLIED / ACCEPTED
APPLIED / DOWNWEIGHTED
NOT_APPLIED / REJECTED_OUTLIER
NOT_APPLIED / NO_USABLE_OBSERVATION
```

其他组合非法。

## 8.4 APPLIED / ACCEPTED

条件：

```text
selected quality = PASS
candidate checks pass
innovation² <= 16 × innovation_variance
```

结果：

```text
quality_weight = 1.0
selected_observation_ref = non-null
evaluated_observation_refs = [selected]
applied_observation_refs = [selected]
consumed_observation_refs = [selected]
```

## 8.5 APPLIED / DOWNWEIGHTED

条件：

```text
selected quality = LIMITED
candidate checks pass
innovation² <= 16 × innovation_variance
```

结果：

```text
quality_weight = 0.5
R_effective > PASS case
gain < same-input PASS case
selected/evaluated/applied/consumed = [selected]
```

## 8.6 NOT_APPLIED / REJECTED_OUTLIER

条件：

```text
selected candidate usable
innovation² > 16 × innovation_variance
```

结果：

```text
selected_observation_ref = non-null
evaluated_observation_refs = [selected]
applied_observation_refs = []
consumed_observation_refs = []

candidate_assimilation_gain = non-null
applied_assimilation_gain = null

candidate_unclipped_posterior_mean = null
candidate_posterior_variance = null

published_posterior_mean = propagated prior mean
published_posterior_variance = propagated prior variance

state_correction_vwc = 0
state_correction_storage_mm = 0
```

本任务冻结：

```text
predicted observation = non-null
actual observation = non-null
innovation/residual = non-null
innovation variance = non-null
normalized innovation = non-null
observation variance = non-null
```

`candidate_assimilation_gain` 仅表示在当前 prior 与 R 下可计算的审计参数，不表示该 gain 被应用。

因为 outlier gate 位于 Gaussian posterior candidate 之前，REJECTED_OUTLIER 不生成 candidate posterior，也不得让任何 posterior 字段呈现为“已应用更新”。

## 8.7 NOT_APPLIED / NO_USABLE_OBSERVATION

窗口中没有 usable observation：

```text
selected_observation_ref = null
evaluated_observation_refs = []
applied_observation_refs = []
consumed_observation_refs = []

predicted_observation = null
actual_observation = null
innovation = null
residual = null
innovation_variance = null
normalized_innovation = null
observation_variance = null

candidate_assimilation_gain = null
applied_assimilation_gain = null
candidate_unclipped_posterior_mean = null
candidate_posterior_variance = null

published_posterior_mean = propagated prior mean
published_posterior_variance = propagated prior variance

state_correction_vwc = 0
state_correction_storage_mm = 0
```

这是合法 State tick，不是 Runtime failure。

## 8.8 Candidate exclusion、policy rejection、contract failure 分离

A. Candidate exclusion，tick 可继续：

```text
future
late
stale
scope mismatch
binding mismatch
quantity mismatch
unit mismatch
physical bound violation
FAIL quality
```

B. Policy rejection，tick 可提交 NOT_APPLIED：

```text
normalized innovation outlier
no usable observation
```

C. Contract/runtime failure，整个 A2 tick 零写入：

```text
MALFORMED_CANONICAL_OBSERVATION
CONFLICTING_DUPLICATE_EVIDENCE
INVALID_RUNTIME_CONFIG
NON_FINITE_CANONICAL_VALUE
UNKNOWN_RECORD_SET_CONTRACT
VALIDATOR_DISPATCH_MISMATCH
HASH_MISMATCH
SELECTOR_NONDETERMINISM
CAS_CONFLICT
STALE_FENCING
```

Contract/runtime failure 不得伪装成合法 `NOT_APPLIED` State tick。

如需要 operational audit，只能通过现有：

```text
F_OPERATIONAL_ATTEMPT_HEALTH
```

单独追加，且不得包含 posterior、terminal tick 或 checkpoint。

---

# 9. Evidence trace 分类

Evidence Window 必须区分：

```text
dynamics_consumed_evidence_refs
assimilation_evaluated_evidence_refs
assimilation_applied_evidence_refs
context_only_evidence_refs
rejected_evidence_refs
```

兼容字段：

```text
consumed_evidence_refs
```

冻结定义：

```text
consumed_evidence_refs
=
lexicographic ASC unique union(
  dynamics_consumed_evidence_refs,
  assimilation_applied_evidence_refs
)
```

因此 outlier observation：

```text
存在于 assimilation_evaluated_evidence_refs
不存在于 assimilation_applied_evidence_refs
不存在于 consumed_evidence_refs
```

总 selected refs 与 classification 必须可从 candidate assessments 确定性重建。

CAP-02 历史 Evidence Window 不得重新解释。

---

# 10. 数学顺序与精度

## 10.1 固定顺序

```text
previous posterior
↓
hourly Dynamics
↓
propagated prior
↓
observation prediction
↓
innovation variance
↓
squared normalized-innovation gate
↓
Gaussian assimilation candidate
↓
physical clipping
↓
published posterior
```

禁止先 assimilation 再 Dynamics。

## 10.2 Propagated prior

Dynamics 生成：

```text
x⁻_t
P⁻_t
```

mass-balance trace 只解释：

```text
previous posterior storage
→ propagated prior storage
```

不得声称解释 assimilation correction。

## 10.3 Observation prediction

```text
ŷ_t = Hx⁻_t
```

v1：

```text
H = 1
direct_state_equivalence = false
```

H=1 仅表示线性 observation operator，不表示 point observation 与根区 State 直接等价。

## 10.4 Observation variance

```text
R_base
=
sensor_stddev²
+
representativeness_stddev²
```

```text
R_effective
=
R_base / quality_weight
```

PASS：

```text
R = 0.02² + 0.06²
  = 0.004
```

LIMITED：

```text
R = 0.004 / 0.5
  = 0.008
```

冻结：

```text
R_base > 0
R_effective > 0
```

## 10.5 Innovation variance 与 threshold authority

```text
S
=
H²P⁻ + R
```

```text
innovation
=
observation - predicted_observation
```

用于 trace 的 normalized innovation：

```text
normalized_innovation
=
innovation / sqrt(S)
```

必须保存：

```text
innovation_variance = S
```

threshold authority 不使用先开方后的浮点值，而使用精确平方比较：

```text
innovation² <= 16 × S
→ accepted/downweighted

innovation² > 16 × S
→ rejected outlier
```

因此边界冻结为：

```text
exact squared ratio = 16
→ accepted

squared ratio > 16
→ rejected
```

`normalized_innovation` 是可审计 trace，不是 threshold decision authority。

## 10.6 Gain 与 posterior candidate

```text
K
=
P⁻H / (H²P⁻ + R)
```

H=1：

```text
K
=
P⁻ / (P⁻ + R)
```

```text
x⁺_latent
=
x⁻ + K × innovation
```

```text
P⁺
=
(1 - KH)P⁻
```

禁止：

```text
posterior = observation
```

在 APPLIED 且 `P⁻ > 0` 时：

```text
P⁺ < P⁻
```

zero innovation 时：

```text
posterior mean = prior mean
posterior variance < prior variance
```

## 10.7 Physical clipping

保留：

```text
unclipped_posterior_mean
clipped_posterior_mean
clipping_applied
clipping_delta
lower_bound
upper_bound
```

发布 State 使用 clipped mean。

latent variance 不因 clipping 自动减小：

```text
physical_clipping_reduces_latent_variance = false
```

下一 tick 消费：

```text
clipped posterior mean
retained latent posterior variance
```

## 10.8 Canonical decimal authority

CAP-03 的输入权威继承 CAP-02 已冻结的 fixed-point authority：

```text
propagated prior storage mean:
canonical scale-6 Dynamics result

propagated prior storage variance:
canonical scale-12 Dynamics result
```

从上述 storage authority 只派生一次：

```text
propagated prior VWC mean
propagated prior VWC variance
```

冻结：

```text
不得从 rounded display VWC 反推 storage
不得在 assimilation 中进行额外 intermediate rounding
threshold 使用 canonical decimal/rational authority
最终 canonical decimal 在公式完成后按声明 scale 一次性舍入
```

最低 canonical authority：

```yaml
propagated_prior_storage_mean_mm_decimal:
  value: "<6 decimals>"
  scale: 6

propagated_prior_storage_variance_mm2_decimal:
  value: "<12 decimals>"
  scale: 12

propagated_prior_vwc_decimal:
  value: "<12 decimals>"
  scale: 12

propagated_prior_vwc_variance_decimal:
  value: "<12 decimals>"
  scale: 12

posterior_vwc_decimal:
  value: "<12 decimals>"
  scale: 12

posterior_vwc_variance_decimal:
  value: "<12 decimals>"
  scale: 12

storage_mean_mm_decimal:
  value: "<6 decimals>"
  scale: 6

storage_variance_mm2_decimal:
  value: "<12 decimals>"
  scale: 12
```

禁止：

```text
scientific notation
negative zero
locale-dependent decimal
round-trip from display values
```

rounding rule：

```text
DECIMAL_HALF_AWAY_FROM_ZERO_V1
```

## 10.9 Storage coordinate

```text
posterior_storage_mm
=
clipped posterior_vwc × 300 mm
```

```text
posterior_storage_variance_mm²
=
posterior_vwc_variance × 300²
```

计算使用 assimilation 内部 decimal authority，发布时按 storage scale 舍入。

下一 tick 必须消费 posterior storage 和 posterior variance，不得消费 propagated prior。

---

# 11. Continuation assimilation composer

现有：

```text
scalar_gaussian_assimilation_v1.ts
root_zone_observation_operator_v1.ts
```

可以复用。

禁止把整个 CAP-01 bootstrap posterior composer 直接作为 CAP-03 continuation composer，因为它冻结的是 bootstrap weak prior 与 bootstrap-specific physical validation。

CAP-03 必须新增独立 pure composer，例如：

```text
assimilated_continuation_posterior_v1.ts
```

其职责：

```text
接收 propagated prior
接收 selected observation assessment
计算 observation variance
计算 innovation / innovation variance
执行 exact squared outlier gate
计算 Gaussian candidate
执行 physical clipping
输出 canonical decimal basis
不访问数据库
不选择 Evidence
不持久化
不读取 wall clock
```

---

# 12. twin_assimilation_update_v1

最低 payload：

```yaml
status: APPLIED | NOT_APPLIED
disposition: ACCEPTED | DOWNWEIGHTED | REJECTED_OUTLIER | NO_USABLE_OBSERVATION

policy_id: ...
record_set_contract_id: MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
assimilation_method_id: SCALAR_GAUSSIAN_ASSIMILATION_V1
observation_selector_id: ...

candidate_observations:
  - observation_ref: ...
    source_record_id: ...
    source_record_hash: ...
    observation_semantic_content_hash: ...
    record_type: soil_moisture_observation_v1
    epistemic_class: OBSERVED
    observed_at: ...
    available_to_runtime_at: ...
    ingested_at: ...
    binding_id: ...
    quantity_kind: VOLUMETRIC_WATER_CONTENT
    quality_status: ...
    source_unit: percent_vwc
    canonical_unit: fraction
    conversion_rule:
      id: ...
      version: ...
    canonical_payload:
      unit: fraction
      value: ...
    temporal_offset_seconds: ...
    candidate_assessment: ...
    reason_codes: ...

selected_observation_ref: ...
evaluated_observation_refs: [...]
applied_observation_refs: [...]
consumed_observation_refs: [...]

observation_operator:
  id: ...
  h: 1
  direct_state_equivalence: false

predicted_observation: ...
actual_observation: ...
innovation: ...
residual: ...
residual_kind: STATE_OBSERVATION_INNOVATION
innovation_variance: ...
normalized_innovation: ...
squared_normalized_innovation: ...
threshold_decision_basis: INNOVATION_SQUARED_LE_16_TIMES_VARIANCE

prior_mean: ...
prior_variance: ...
observation_variance: ...

candidate_assimilation_gain: ...
applied_assimilation_gain: ...

candidate_unclipped_posterior_mean: ...
candidate_posterior_variance: ...

published_posterior_mean: ...
published_posterior_variance: ...

state_correction_vwc: ...
state_correction_storage_mm: ...

clipping:
  applied: ...
  lower_bound: 0
  upper_bound: 0.45
  delta: ...

state_transition_ref: ...
posterior_state_ref: ...
runtime_config_ref: ...
runtime_config_hash: ...
model_parameter_change_applied: false
reason_codes: [...]
```

组合语义固定为：

```text
APPLIED / ACCEPTED or DOWNWEIGHTED:
candidate_assimilation_gain = non-null
applied_assimilation_gain = candidate_assimilation_gain
candidate posterior = non-null
published posterior = clipped candidate posterior

NOT_APPLIED / REJECTED_OUTLIER:
candidate_assimilation_gain = non-null
applied_assimilation_gain = null
candidate posterior = null
published posterior = propagated prior
state correction = 0

NOT_APPLIED / NO_USABLE_OBSERVATION:
candidate_assimilation_gain = null
applied_assimilation_gain = null
candidate posterior = null
published posterior = propagated prior
state correction = 0
```

必须满足：

```text
innovation == residual
posterior_state_ref 指向同一 aggregate 的 State
selected observation 存在于 CAP-03 Evidence Window
evaluated refs 只能来自 selected observation
applied refs 是 evaluated refs 的子集
consumed refs 等于 applied refs
semantic content hash 可从 candidate canonical payload 独立重算
runtime_config_ref/hash 与 record-set aggregate 一致
model_parameter_change_applied = false
```

---

# 13. State Estimate

`twin_state_estimate_v1` 的主要状态值必须代表 posterior。

必须同时保存：

```text
propagated prior
posterior
assimilation correction
```

computation basis：

```yaml
basis_origin: CARRIED_FROM_PREVIOUS_CONTINUATION_STATE

previous_state_ref: ...

previous_storage_mean_mm_decimal: ...
previous_storage_variance_mm2_decimal: ...

propagated_prior_storage_mean_mm_decimal: ...
propagated_prior_storage_variance_mm2_decimal: ...

storage_mean_mm_decimal: ...
storage_variance_mm2_decimal: ...

storage_coordinate_semantics:
  propagated_prior_storage_mean_mm_decimal: PRIOR
  propagated_prior_storage_variance_mm2_decimal: PRIOR
  storage_mean_mm_decimal: POSTERIOR
  storage_variance_mm2_decimal: POSTERIOR
```

保留现有：

```text
storage_mean_mm_decimal
storage_variance_mm2_decimal
```

作为 posterior 权威，以复用 next-tick reader。

State 必须引用：

```text
previous_posterior_ref
transition_ref
assimilation_update_ref
evidence_window_ref
Reality Binding
Runtime Config
mass_balance_trace_hash
```

Confidence：

```text
status = NOT_ESTABLISHED
reason_code = NO_CALIBRATED_CONFIDENCE_MODEL
```

Eligibility：

```text
state_valid = true
posterior_chain_eligible = true
forecast_source_eligible = true
recommendation_input_eligible = false
action_input_eligible = false
```

---

# 14. Tick、Checkpoint、Health 与 Forecast

## 14.1 Forecast

继续：

```text
status = BLOCKED
points = []
scenario_eligible = false
latest successful Forecast = null
```

禁止在 CAP-03 中实现 Forecast。

## 14.2 Tick

APPLIED：

```text
status:
COMPLETED_WITH_LIMITATIONS

limitations:
OBSERVATION_UPDATE_APPLIED
FORECAST_BLOCKED_BY_PINNED_CONFIG_AND_CAPABILITY_BOUNDARY
NO_CALIBRATED_CONFIDENCE_MODEL
```

NOT_APPLIED / REJECTED_OUTLIER：

```text
OBSERVATION_UPDATE_REJECTED_OUTLIER
FORECAST_BLOCKED_BY_PINNED_CONFIG_AND_CAPABILITY_BOUNDARY
```

NOT_APPLIED / NO_USABLE_OBSERVATION：

```text
OBSERVATION_UPDATE_NOT_APPLIED_NO_USABLE_OBSERVATION
FORECAST_BLOCKED_BY_PINNED_CONFIG_AND_CAPABILITY_BOUNDARY
```

Tick payload 必须包含：

```text
record_set_contract_id:
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
```

## 14.3 Checkpoint

继续推进：

```text
tick_sequence + 1
last_posterior_state_ref = current posterior
next_tick_logical_time = T + PT1H
```

Checkpoint sequence 必须继承 CAP-02，不得从 1 重新开始。

CAP-03 首 tick 预期：

```text
checkpoint sequence = 25
```

CAP-03 24-tick range 末 tick 预期：

```text
checkpoint sequence = 48
```

## 14.4 Health

合法状态：

```text
CONTINUATION_STATE_ASSIMILATED_WITH_BLOCKED_FORECAST
CONTINUATION_STATE_PROPAGATED_WITH_REJECTED_OUTLIER
CONTINUATION_STATE_PROPAGATED_WITHOUT_USABLE_OBSERVATION
```

Candidate exclusion 或 outlier rejection 不得标记成系统失败。

只有以下情况属于失败：

```text
contract violation
hash mismatch
validator dispatch failure
duplicate conflict
CAS conflict
stale fencing
persistence fault
projection divergence
```

---

# 15. Persistence

继续复用：

```text
A_STATE_TICK_COMMIT
A2_BLOCKED_FORECAST
A2_RECORD_SET
8 canonical facts
5 continuation projections
```

优先：

```text
zero migration
```

如 S3A preflight 发现 discriminator 无法通过现有 canonical facts/readback 保存，必须先证明 zero migration 不可行，再提出最小 persistence change。不得预先扩表。

必须保持：

```text
idempotency lookup before lease validation
lease + fencing
expected-current State CAS
expected-current checkpoint CAS
expected-current Forecast-result CAS
active lineage verify-only
latest successful Forecast remains null
one transaction
canonical readback
projection rebuild
```

同一：

```text
scope
lineage
revision
logical_time
operation_variant
```

只能存在一个 canonical terminal tick。

Late observation v1：

```text
REJECT_FROM_ACTIVE_TICK
NO_RECOMPUTE
NO_APPEND_CORRECTION
NO_REVISION_LINEAGE
```

禁止因 late observation 或不同 Evidence 内容创建同一 active lineage、同一 logical time 的第二个结果。

---

# 16. 标准首 tick

权威起点最终由 PostgreSQL predecessor lock 决定。

预期：

```text
T:
2026-06-02T02:00:00.000Z
```

标准 observation：

```text
observed_at:
2026-06-02T01:50:00.000Z

available_to_runtime_at:
2026-06-02T01:55:00.000Z

ingested_at:
2026-06-02T01:55:00.000Z

value:
0.184500

canonical unit:
fraction

quality:
PASS

binding:
soil_obs_c8_20cm_v1
```

标准输入：

```text
previous storage:
56.788512 mm

previous storage variance:
247.020977062500 mm²

ET0 01:00–02:00:
0.085000 mm

Kc:
0.300000

rainfall:
0.000000 mm

executed irrigation:
0.000000 mm
```

冻结候选计算值：

```text
propagated prior storage:
56.763012 mm

propagated prior VWC:
0.189210040000

propagated prior storage variance:
247.270991693125 mm²

propagated prior VWC variance:
0.002747455463256944...

observation:
0.184500000000

effective observation variance:
0.004000000000

innovation / residual:
-0.004710040000

innovation variance:
0.006747455463256944...

normalized innovation:
-0.057339589842...

assimilation gain:
0.407183934480...

unclipped posterior VWC:
0.187292187381...

posterior VWC variance:
0.001628735737919651...

posterior storage:
56.187656214373... mm

posterior storage variance:
146.586216412769... mm²

posterior VWC stddev:
0.040357598267...

raw 95% interval:
[0.108191294777..., 0.266393079986...]
```

正式 canonical fixture 值必须由 S2 repository-owned decimal implementation 计算，并按声明 scale 舍入。上述值是设计阶段的交叉验证值，不替代 S2 fixture authority。

---

# 17. 24-tick 全局计数

CAP-02 已有：

```text
1 bootstrap State
24 CAP-02 continuation States
checkpoint sequence = 24
192 CAP-02 A2 facts
```

CAP-03 新增：

```text
24 CAP-03 continuation States
checkpoint sequence advances 25..48
192 new A2 facts
```

因此 CAP-03 标准链完成后：

```text
total State count = 49
total continuation State count = 48
CAP-03 first checkpoint sequence = 25
CAP-03 final checkpoint sequence = 48
CAP-03 new A2 fact count = 192
cumulative CAP-02 + CAP-03 A2 fact count = 384
```

CAP-03 局部 range：

```text
1 predecessor State
+
24 new CAP-03 States
=
25 local-range States
```

禁止把局部 25-State count 误写为全局 active-lineage count。

标准 canonical 24-tick chain 应优先使用：

```text
24 PASS observations
24 APPLIED / ACCEPTED updates
```

以下 disposition 通过独立 controlled fixtures / scopes 验证，不污染标准 canonical chain：

```text
LIMITED / DOWNWEIGHTED
REJECTED_OUTLIER
NO_USABLE_OBSERVATION
candidate exclusion
duplicate conflict
```

---

# 18. Delivery Slice Graph

全线严格执行：

```text
merge-before-next
postmerge-verify-before-next
one active implementation slice
no parallel downstream PR
```

每个 slice 的 Delivery Status 必须包含：

```yaml
delivery_slice_id: ...
primary_owner_work_package_id: ...
contributing_owner_work_package_ids: [...]
depends_on_delivery_slice_ids: [...]
baseline_main_commit: ...
branch: ...
status: ...
allowed_claims: [...]
preserved_nonclaims: [...]
exact_changed_file_boundary: [...]
effectiveness_condition: ...
```

文件路径可在 slice activation preflight 中精确冻结，但不得改变本任务书语义。

## S0 — Authorization and Predecessor Lock

```text
delivery_slice_id:
MCFT-CAP-03.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1

primary_owner:
MCFT-07

contributors:
MCFT-02
MCFT-03
MCFT-04
MCFT-05
MCFT-06
MCFT-08
MCFT-09

depends_on:
MCFT-CAP-02 COMPLETE
```

范围：

```text
验证 MCFT-CAP-02 COMPLETE
从 PostgreSQL 提取 canonical handoff
新增 predecessor handoff erratum
冻结 predecessor State/checkpoint/config/lineage/revision
冻结 predecessor posterior Runtime Config parent ref/hash
冻结 02:00 起点
冻结 owner boundary
使本任务书 v1.2 design freeze 生效
更新 capability matrices
建立 Delivery Status
建立 Authorization Gate:
  --draft
  --final
  --postmerge
```

禁止：

```text
Runtime source change
migration
route
scheduler
model implementation
tick execution
predecessor historical artifact rewrite
```

## S1 — Contracts and Config

```text
delivery_slice_id:
MCFT-CAP-03.MCFT-02-07-08.ASSIMILATION-CONTRACTS-CONFIG-V1

primary_owner:
MCFT-02

contributors:
MCFT-07
MCFT-08

depends_on:
S0 merged-main verified
```

范围：

```text
record_set_contract_id
immutable CAP-02 V1 contracts
new CAP-03 aggregate/record-set types
versioned assimilation contract
candidate assessment enums
update status/disposition enums
Runtime Config
D transaction config append/readback
validator dispatch
aggregate identity discriminator
historical CAP-02 compatibility Gate
unknown-version fail-closed Gate
```

不执行 tick。

## S2 — Observation Selection and Pure Assimilation Math

```text
delivery_slice_id:
MCFT-CAP-03.MCFT-05-07.OBSERVATION-SELECTION-AND-ASSIMILATION-MATH-V1

primary_owner:
MCFT-07

contributors:
MCFT-05

depends_on:
S1 merged-main verified
```

范围：

```text
candidate assessment
semantic duplicate identity
observation semantic content hash
AssimilatedContinuationEvidenceWindowV1
buildAssimilatedContinuationEvidenceWindowV1
CAP-02 Evidence Window compatibility Gate
latest usable selector
time-alignment policy
quality weighting
observation operator
innovation / residual
innovation variance
exact squared outlier gate
Gaussian assimilation
outlier rejection
physical clipping
canonical decimal conversion
positive and negative fixtures
```

纯函数，不访问数据库。

## S3A — Assimilated Record-Set Contract and Builder

```text
delivery_slice_id:
MCFT-CAP-03.MCFT-02-07-08.ASSIMILATED-A2-RECORD-SET-BUILDER-V1

primary_owner:
MCFT-02

contributors:
MCFT-07
MCFT-08

depends_on:
S2 merged-main verified
```

范围：

```text
eight-object builder
CAP-03 Evidence Window canonical payload
CAP-03 cross-reference validator
record-set contract discriminator
AssimilatedContinuationAggregateIdentityInputV1
AssimilatedContinuationRecordSetV1
Evidence trace classifications
posterior State computation basis
Tick/Checkpoint/Health/Forecast payloads
historical/readback validator dispatch
```

不访问数据库。

## S3B — Persistence, Readback, Rebuild and Fault Injection

```text
delivery_slice_id:
MCFT-CAP-03.MCFT-03-08.ASSIMILATED-A2-PERSISTENCE-RECOVERY-V1

primary_owner:
MCFT-03

contributors:
MCFT-08

depends_on:
S3A merged-main verified
```

范围：

```text
existing A2 transaction reuse
idempotency-before-lease
lease/fencing
State/checkpoint/Forecast CAS
canonical readback
five-projection rebuild
precommit fault injection
postcommit response-loss
projection divergence
historical CAP-02 readback
zero-migration proof or minimal-change justification
```

## S4 — Single-Tick Integration

```text
delivery_slice_id:
MCFT-CAP-03.MCFT-04-05-06-07-08-09.SINGLE-TICK-INTEGRATION-V1

primary_owner:
MCFT-04

contributors:
MCFT-05
MCFT-06
MCFT-07
MCFT-08
MCFT-09

depends_on:
S3B merged-main verified
```

范围：

```text
persisted predecessor handoff
T = canonical next logical time
exact-hour Dynamics
observation selection
assimilation
posterior State
BLOCKED Forecast
A2 atomic commit
T+1 handoff
standard exact-value fixture
```

## S5 — 24 Observation-Aware Ticks

```text
delivery_slice_id:
MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1

primary_owner:
MCFT-04

contributors:
MCFT-07
MCFT-08

depends_on:
S4 merged-main verified
```

范围：

```text
24 contiguous hourly ticks
24 immutable assimilation objects
24 posterior States
local 25-State range
global 49-State active lineage
checkpoint sequence 25..48
192 new A2 facts
24 PASS accepted standard chain
same-input deterministic replay
independent LIMITED fixture
independent no-observation fixture
independent outlier-rejection fixture
independent candidate-exclusion fixture
```

最终数值在该 slice 内生成并冻结。

## S6 — Restart, Backfill and Recovery

```text
delivery_slice_id:
MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1

primary_owner:
MCFT-04

contributors:
MCFT-03
MCFT-07
MCFT-08

depends_on:
S5 merged-main verified
```

范围：

```text
process 1 commits CAP-03 ticks 1–12
fresh process resumes ticks 13–24
uninterrupted and restarted hashes identical
bounded forward backfill identical
precommit crash rollback
postcommit response-loss idempotency
stale fencing
CAS conflict
projection divergence fail closed
explicit canonical rebuild
late Evidence no recompute
```

## S7 — Closure Evidence

```text
delivery_slice_id:
MCFT-CAP-03.CLOSURE-V1

primary_owner:
MCFT-07

contributors:
MCFT-02
MCFT-03
MCFT-04
MCFT-05
MCFT-06
MCFT-08
MCFT-09

depends_on:
S6 merged-main verified
```

范围：

```text
aggregate all merged-main evidence
freeze completion claims/nonclaims
Closure Draft Gate
Closure Final Gate
Closure Postmerge Gate
exact-head CI
governance-only PR
```

Gate 从第一版支持：

```text
--draft
--final
--postmerge
```

Closure 合并前：

```text
closure_effective = false
completion claims pending
successor unauthorized
```

## S8 — Postmerge Finalization

```text
delivery_slice_id:
MCFT-CAP-03.CLOSURE-FINALIZATION-V1

primary_owner:
MCFT-07

contributors:
MCFT-02
MCFT-03
MCFT-04
MCFT-05
MCFT-06
MCFT-08
MCFT-09

depends_on:
S7 Closure PR merged and merged-main Closure Gate passed

finalization_effectiveness_condition:
S8_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_FINALIZATION_GATE_PASS
```

范围：

```text
verify Closure merge commit
write MAIN-VERIFICATION candidate
prepare pending completion claims
Draft Finalization Gate
Final Finalization Gate
exact-head CI
Finalization PR merge
merged-main Finalization Gate
clean working tree
git diff --check
activate completion claims only after merged-main Gate
set closure_effective = true
set capability status = COMPLETE
clear active_delivery_slice_id
keep successor unauthorized
```

状态转换冻结：

```text
S8 branch before merge:

capability status =
FINALIZATION_READY_FOR_MERGE

closure_effective =
false

completion claims =
pending

active_delivery_slice_id =
MCFT-CAP-03.CLOSURE-FINALIZATION-V1
```

只有在：

```text
S8 PR merged to main
AND
merged-main Finalization Gate PASS
```

之后才允许：

```text
capability status = COMPLETE
closure_effective = true
completion claims = effective
active_delivery_slice_id = null
MCFT-CAP-04 authorized = false
```

该 slice 从任务线第一版就显式列出，不作为临时补丁。

---

# 19. 硬验收

必须至少覆盖以下条件。

## 19.1 数学与精度

1. Dynamics 必须先于 assimilation。
2. predicted observation 必须来自 propagated prior。
3. residual 必须等于 observation − prediction。
4. innovation 必须等于 residual。
5. innovation variance 必须等于 `H²P⁻ + R`。
6. threshold authority 必须使用 `innovation² <= 16 × innovation_variance`。
7. reported normalized innovation 必须与 innovation/variance 一致。
8. posterior 不得简单等于 observation。
9. PASS 与 LIMITED 必须使用不同 effective variance。
10. 相同 observation 下，LIMITED gain 必须小于 PASS gain。
11. APPLIED 且 prior variance > 0 时，posterior variance 必须小于 prior variance。
12. zero innovation 时 posterior mean 不变，但 posterior variance 下降。
13. NOT_APPLIED 时 posterior 必须等于 propagated prior。
14. clipping 不得隐式减小 latent variance。
15. storage/VWC 转换必须保持 300 mm coordinate。
16. mass-balance trace 只解释 propagated prior，不解释 assimilation correction。
17. propagated prior storage mean 必须使用 CAP-02 canonical scale-6 authority。
18. propagated prior storage variance 必须使用 CAP-02 canonical scale-12 authority。
19. 不得从 rounded display VWC 反推 storage。
20. 不得使用 scientific notation、negative zero 或 locale-dependent decimal。
21. configured FAIL quality weight 必须精确为 0，且不得进入 R_effective。
22. selected usable quality weight 必须位于 (0, 1]。
23. candidate gain 与 applied gain 必须独立表达。
24. REJECTED_OUTLIER 的 applied gain 必须为 null，candidate posterior 必须为 null。
25. NOT_APPLIED 的 State correction 必须精确为 0。

## 19.2 Evidence 与 selector

26. selected observation 必须存在于 Evidence Window。
27. evaluated refs 只能指向 selected observation。
28. applied refs 必须是 evaluated refs 的子集。
29. consumed observation refs 必须等于 applied observation refs。
30. future observation 不得消费。
31. late observation 不得消费。
32. 超过 15 分钟 staleness 不得消费。
33. scope mismatch 不得消费。
34. binding mismatch 不得消费。
35. unit/quantity mismatch 不得消费。
36. FAIL observation 不得消费。
37. identical duplicates 必须按 semantic identity + semantic content hash 确定性去重。
38. quality status 不同不得被视为 identical duplicate。
39. conflicting duplicates 必须整 tick fail closed。
40. 多 usable observations 必须确定性选择 latest。
41. candidate 输入顺序变化不得改变 selector output 或 semantic digest。
42. 不得进行隐式多传感器融合。
43. outlier observation 必须 evaluated 但不得 applied/consumed。
44. CAP-03 必须使用独立 AssimilatedContinuationEvidenceWindowV1。
45. CAP-02 Evidence Window V1 历史 payload 与 readback 必须保持不变。
46. candidate payload 必须足以独立重算 observation_semantic_content_hash。
47. identical duplicate winner 必须为 ingested_at DESC、source_record_id ASC。
48. candidate rejection primary assessment 必须遵循冻结优先级。
49. consumed_evidence_refs 必须为 lexicographic ASC unique union。

## 19.3 Failure classification

50. Candidate exclusion 必须允许 tick 继续。
51. NO_USABLE_OBSERVATION 必须提交合法 NOT_APPLIED tick。
52. REJECTED_OUTLIER 必须提交合法 NOT_APPLIED tick。
53. conflicting duplicate 不得降级为合法 NOT_APPLIED。
54. unknown contract 不得降级为合法 NOT_APPLIED。
55. invalid config/hash/dispatch mismatch 必须零 A2 write。
56. Operational audit 不得创建 posterior、terminal tick 或 checkpoint。
57. malformed canonical observation 必须整 tick fail closed。
58. missing source hash/id/time/payload、unknown quality 或 unsupported record type 不得降级为普通 exclusion。

## 19.4 Canonical graph

59. 八对象数量和类型集合必须精确。
60. 所有内部 refs 必须双向一致。
61. State 必须引用 assimilation update。
62. Assimilation update 必须引用 State Transition 和 posterior State。
63. Tick、Checkpoint、Health 必须引用同一 posterior。
64. Runtime Config ref/hash 必须一致。
65. lineage/revision 必须与 predecessor handoff 一致。
66. next tick 必须严格增加一小时。
67. checkpoint sequence 必须严格增加一。
68. Forecast 必须保持 BLOCKED、零 points。
69. Tick 必须包含 CAP-03 record_set_contract_id。
70. CAP-02 历史 record set 必须继续由 V1 validator 读取。
71. CAP-03 record set 必须由 CAP-03 validator 读取。
72. unknown/mismatched discriminator 必须 fail closed。
73. CAP-02 V1 aggregate/record-set types 不得原地扩展。

## 19.5 Persistence

74. 八个 canonical facts 必须同一事务提交。
75. 任一 fault stage 必须零 partial write。
76. Idempotency lookup 必须先于 lease。
77. 同 key、同 hash 返回 existing success。
78. 同 key、不同 hash 返回 conflict。
79. stale fencing 必须零写入。
80. State/checkpoint/Forecast CAS conflict 必须零写入。
81. canonical object ID 必须唯一。
82. projection loss 不得允许第二个 canonical tick。
83. projection rebuild 必须与 canonical facts 等价。
84. historical MCFT-CAP-02 record sets 必须继续通过 readback。
85. operation key 不得包含 Evidence/config/contract version。
86. aggregate hash 必须包含 Evidence/config/contract version。
87. parent Runtime Config 必须来自 predecessor latest posterior，而不是假设的 active-config pointer。

## 19.6 Range 与恢复

88. 连续运行必须建立 24 个 CAP-03 observation-aware ticks。
89. 每 tick 必须产生 immutable State。
90. 每 tick 必须产生 explicit assimilation disposition。
91. 标准链必须产生 24 个 APPLIED / ACCEPTED updates。
92. 全局 State count 必须为 49。
93. 全局 continuation State count 必须为 48。
94. 首 checkpoint sequence 必须为 25。
95. 末 checkpoint sequence 必须为 48。
96. 新增 A2 fact count 必须为 192。
97. CAP-02 + CAP-03 累积 A2 facts 必须为 384。
98. 重启后只继续未完成 ticks。
99. restart 与 uninterrupted chain hash 必须相同。
100. bounded backfill 结果必须相同。
101. completed target retry 必须零 mutation。
102. response loss retry 不得重复 facts。
103. late Evidence 不得静默修改 active history。

## 19.7 边界

104. 不得创建 successful Forecast。
105. 不得创建 `twin_forecast_residual_v1`。
106. 不得创建 Scenario。
107. 不得创建 Recommendation。
108. 不得创建 Policy Evaluation。
109. 不得创建 Decision。
110. 不得创建 AO-ACT。
111. 不得创建 Calibration Candidate。
112. 不得创建 Shadow Evaluation。
113. 不得修改 active model 参数。
114. 不得创建 revision lineage。
115. 不得声明 field-validated observation operator。
116. 不得声明 field-calibrated assimilation noise model。
117. 不得声明 continuous Runtime、live field 或 production Twin。
118. Tick request 必须显式 pin runtime_config_ref/hash。
119. latest-inserted config 或 active-config pointer 不得作为隐式选择权威。
120. S8 branch 状态不得提前激活 completion claims。
121. S8 PR merge 后必须运行 merged-main Finalization Gate。
122. merged-main Finalization Gate 未通过时 capability 不得标记 COMPLETE。
123. S8 生效后 active_delivery_slice_id 必须为 null，MCFT-CAP-04 必须仍未授权。

---

# 20. Completion Claims

只有 `S8_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_FINALIZATION_GATE_PASS` 成立后，才允许激活以下 15 项：

```text
MCFT_CAP_03_COMPLETE

OBSERVATION_ASSIMILATION_V1_ESTABLISHED

STATE_OBSERVATION_INNOVATION_RESIDUAL_ESTABLISHED

DETERMINISTIC_OBSERVATION_SELECTION_ESTABLISHED

PASS_OBSERVATION_ACCEPTANCE_ESTABLISHED

LIMITED_OBSERVATION_DOWNWEIGHTING_ESTABLISHED

OBSERVATION_CANDIDATE_EXCLUSION_ESTABLISHED

INNOVATION_OUTLIER_REJECTION_ESTABLISHED

POSTERIOR_STATE_CORRECTION_ESTABLISHED

ASSIMILATION_UNCERTAINTY_UPDATE_ESTABLISHED

OBSERVATION_DISPOSITION_TRACE_ESTABLISHED

TWENTY_FOUR_OBSERVATION_AWARE_TICKS_PERSISTED

ASSIMILATION_RESTART_BACKFILL_PROVEN

ASSIMILATED_STATE_CANONICAL_UNIQUENESS_ESTABLISHED

VERSIONED_ASSIMILATION_RECORD_SET_COMPATIBILITY_ESTABLISHED
```

临时 pre-effectiveness nonclaim：

```text
NO_MCFT_CAP_03_COMPLETE_CLAIM
```

只在 S8 finalization 生效后移除。

---

# 21. Preserved Nonclaims

以下 28 项在 CAP-03 Closure 后继续成立：

```text
NO_FORECAST_RESIDUAL

NO_SUCCESSFUL_FORECAST

NO_72_HOUR_FORECAST

NO_SCENARIO

NO_RECOMMENDATION

NO_POLICY_EVALUATION

NO_DECISION

NO_AO_ACT

NO_CALIBRATION_CANDIDATE

NO_SHADOW_EVALUATION

NO_MODEL_ACTIVATION

NO_ACTIVE_MODEL_PARAMETER_CHANGE

NO_CALIBRATED_CONFIDENCE_MODEL

NO_MULTI_SENSOR_FUSION

NO_DYNAMIC_ROOT_ZONE_GEOMETRY

NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION

NO_LATE_EVIDENCE_REVISION

NO_AUTOMATIC_RECOMPUTE_ON_LATE_EVIDENCE

NO_CONTINUOUS_RUNTIME

NO_CONTINUOUS_SCHEDULER

NO_720_TICK_REPLAY_CLOSURE

NO_LIVE_FIELD_CLAIM

NO_FIELD_VALIDATED_OBSERVATION_OPERATOR

NO_FIELD_CALIBRATED_ASSIMILATION_NOISE_MODEL

NO_MCFT_GATE_A_CLOSURE

NO_MCFT_GATE_B_CLOSURE

NO_MCFT_GATE_C_CLOSURE

NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

---

# 22. 冻结规则

1. Task document 只冻结语义、范围、slice graph 和验收，不承担持续状态 SSOT。
2. 当前状态只写入 machine-readable Delivery Status。
3. 本文件当前为 `FINAL_FROZEN_CANDIDATE_V1_2`；正式 design freeze 只在 S0 merged-main Gate 后生效。
4. successor 起点只能从 PostgreSQL canonical checkpoint handoff 获取。
5. predecessor 历史验证错误只能通过 additive erratum 修正。
6. 所有 Gate 从第一版支持 `--draft`、`--final` 与 `--postmerge`。
7. Closure 与 Finalization 从任务线第一版分列。
8. 旧 validator 和 V1 TypeScript contract 永不被新 capability 语义覆盖。
9. Forecast residual 与 observation innovation 永久使用不同名称和 transaction family。
10. A2 aggregate 继续保持八对象。
11. 第一版只支持一个授权 observation binding。
12. candidate exclusion、policy rejection、contract failure 必须分层。
13. evaluated、applied、consumed Evidence refs 必须分开。
14. duplicate identity 与 semantic content equality 必须分开。
15. quality status 必须进入 observation semantic content hash。
16. late Evidence 明确 reject，不半实现 revision。
17. State assimilation 不改变 active Runtime Config 或 active model。
18. parent Runtime Config 必须来自 predecessor latest posterior 的 pinned config。
19. threshold decision 使用 exact squared comparison，不使用开方后的浮点值作为权威。
20. CAP-02 fixed-point storage mean/variance 是 CAP-03 propagated-prior 输入权威。
21. storage 不得从 rounded display VWC 反推。
22. record_set_contract_id 进入 aggregate hash，不进入 operation key。
23. CAP-03 使用独立 aggregate/record-set type，不原地扩展 CAP-02 V1。
24. 每个 slice 必须在前一 slice 合并并完成 merged-main Gate 后启动。
25. 禁止并行打开下游实现 PR。
26. 每个 slice activation 必须冻结 exact changed-file boundary。
27. 每个 slice 必须明确 allowed claims 与 preserved nonclaims。
28. 只有真实 DT-02 canonical object、transaction、lineage 或 CAS 冲突才允许 Architecture Amendment。
29. horizontal owner work package 不因 capability-line closure 自动标记 COMPLETE。
30. MCFT-CAP-04 在 CAP-03 S8 生效前保持未授权。
31. CAP-03 必须使用独立 observation-aware Evidence Window contract，不得修改 CAP-02 Evidence Window V1。
32. malformed canonical observation 属于 contract failure，不得降级为 candidate exclusion。
33. consumed_evidence_refs 使用 lexicographic ASC unique union。
34. S8 只有在 PR 合并且 merged-main Finalization Gate 通过后才生效。

---

# 23. 最终阶段判断

MCFT-CAP-03 完成后，系统将首次具备：

```text
持续 hourly Dynamics
+
现实 observation selection
+
state observation innovation / residual
+
bounded State assimilation
+
posterior uncertainty update
+
persistent restartable posterior chain
```

但仍不具备：

```text
72-hour Forecast
Forecast residual
Scenario
Recommendation
Policy Evaluation
Decision
Action feedback
Calibration
Shadow online
Model activation
Late-Evidence revision
Continuous production Runtime
```

计划 successor：

```text
MCFT-CAP-04
72-Hour Forecast and Three Scenarios
```

MCFT-CAP-04 必须由独立 authorization 启动，不因 MCFT-CAP-03 任务书冻结、实现完成或 Closure 自动获得授权。

---

# 24. 当前冻结结论

```text
task_line:
FINAL_FROZEN_CANDIDATE_V1_2

repository_write:
NONE

MCFT-CAP-03 implementation:
NOT_AUTHORIZED

first permitted action:
S0 Authorization and Predecessor Lock

formal design freeze:
PENDING_S0_MERGED_MAIN_AUTHORIZATION_GATE

finalization effectiveness:
S8_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_FINALIZATION_GATE_PASS

MCFT-CAP-04:
NOT_AUTHORIZED
```
