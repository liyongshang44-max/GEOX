<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-TASK.md -->
# GEOX MCFT-CAP-01 / MCFT-1

# First-Class Water State Estimate 实施任务书 v2.1

## 0. 当前任务身份

```text
capability_line_id:
MCFT-CAP-01

display_alias:
MCFT-1

name:
First-Class Water State Estimate

runtime_mode:
REPLAY

target_completion_level:
Level A — Deterministic Replay Twin

authority_baseline_commit:
94fe516ccbf8831be05c36ede5e2732bf7e19d55

authority_baseline_meaning:
DT02-AMENDMENT-02 Initial Lineage and Bootstrap State Semantics merged

implementation_baseline_branch:
main

implementation_baseline_commit:
b0b364933956a65345b927c6c5618e9d4ebe22af

implementation_baseline_meaning:
PR #2310 merged; S1 Canonical Replay Dataset, S2 A0 Contracts/Config, and S3A A0 Persistence closed on main

status:
IN_IMPLEMENTATION

active_delivery_slice:
MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1
```

当前机器状态：

```text
S1  MCFT-CAP-01.MCFT-01.CANONICAL-REPLAY-DATASET-V1
    COMPLETE

S2  MCFT-CAP-01.MCFT-02.A0-CONTRACTS-AND-CONFIG-V1
    COMPLETE

S3A MCFT-CAP-01.MCFT-03.A0-PERSISTENCE-V1
    COMPLETE

S3B MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1
    READY_FOR_IMPLEMENTATION

S4  MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1
    NOT_YET_AUTHORIZED

S5  MCFT-CAP-01.CLOSURE-V1
    NOT_YET_AUTHORIZED
```

本版本不重新授权 S1、S2 或 S3A。当前只能实施 S3B。S4 必须等待 S3B 合并后另行开始。

---

# 1. 权威来源与优先级

```text
1. DT-02 Runtime Architecture Freeze
2. DT02-AMENDMENT-01
3. DT02-AMENDMENT-02
4. MCFT-00 Reality Binding Contract
5. MCFT-VERTICAL-AMENDMENT-01
6. MCFT Vertical Capability Line Matrix
7. GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json
8. 本任务书
9. 各 delivery slice 实现文档
```

若本任务书与更高层权威冲突：

```text
禁止在 Runtime 代码中静默修正
禁止通过宽松 validator 绕过
禁止修改 canonical 语义适配实现
必须停止冲突部分并单独形成 architecture amendment
```

本任务不得重新设计：

```text
A0_BOOTSTRAP_STATE_COMMIT
NULL_TO_INITIAL activation
INITIAL lineage
embedded bootstrap prior
INITIAL revision_id
INITIAL checkpoint
nine-object atomic append set
aggregate idempotency
BLOCKED Forecast
zero partial-write failure semantics
```

---

# 2. 已成立基础

当前 main 已经具备：

```text
30-day Canonical Replay Dataset
3604 governed source records
byte-identical Replay regeneration
A0 canonical object contracts
production canonical JSON and deterministic identity
Runtime Config compiler
Postgres A0 persistence foundation
lease / fencing / idempotency
nine-fact atomic transaction implementation
rebuildable A0 projections
```

S1 记录结构已经冻结为：

```text
common envelope
+
role-specific source_payload
+
role-specific canonical_payload
```

标量字段只适用于标量 role：

```text
source_payload.value
source_payload.unit
canonical_payload.value
canonical_payload.unit
```

Future snapshot、approved plan 与 execution Evidence 必须保留结构化 payload，不得被强制压平成公共 `source_value` / `canonical_value`。

这些基础不得在 S3B 中重写。

---

# 3. S3B 唯一目标

```text
delivery_slice_id:
MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1

primary_owner_work_package_ids:
MCFT-07
MCFT-08

status:
READY_FOR_IMPLEMENTATION

depends_on:
MCFT-CAP-01.MCFT-02.A0-CONTRACTS-AND-CONFIG-V1  COMPLETE

parallel_dependency_status:
MCFT-CAP-01.MCFT-03.A0-PERSISTENCE-V1  COMPLETE
```

S3B 只实现纯 Domain 计算：

```text
configured weak bootstrap prior
+
one quality-controlled 200 mm point observation
→
posterior root-zone Water State
```

不得访问：

```text
Postgres
filesystem
environment variables
wall clock
network
Fastify
scheduler
global mutable state
```

S3B 不得：

```text
构建 Evidence Window
选择 Replay Evidence
运行 A0 orchestrator
写 canonical facts
更新 projections
建立 active lineage
建立 Initial Checkpoint
创建 Forecast
执行 next-tick handoff
```

这些属于 S4。

---

# 4. 输入与冻结配置

标准输入：

```text
observation:
0.184000 fraction VWC

quality_status:
PASS

wilting_point_fraction:
0.12

field_capacity_fraction:
0.30

saturation_fraction:
0.45

root_zone_depth_mm:
300
```

Bootstrap model config：

```text
model_component_id:
mcft_static_gaussian_bootstrap_water_state_v1

prior_rule_id:
MIDPOINT_WILTING_FIELD_CAPACITY_WEAK_PRIOR_V1

observation_operator_id:
POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1

assimilation_method_id:
SCALAR_GAUSSIAN_ASSIMILATION_V1

uncertainty_method_id:
GAUSSIAN_APPROXIMATION_95_INTERVAL_V1

numeric_output_decimals:
6

rounding_rule:
DECIMAL_HALF_AWAY_FROM_ZERO_V1

physical_bound_version:
ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1

gaussian_interval_rule:
NORMAL_95_Z_1_96_V1

uncertainty_interval_clip_rule:
CLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1

interval_clip_bounds:
[0, saturation_fraction]
```

Synthetic uncertainty parameters：

```text
sensor_measurement_stddev_fraction:
0.02

point_to_zone_representativeness_stddev_fraction:
0.06

quality_weights.PASS:
1.0

quality_weights.LIMITED:
0.5

quality_weights.FAIL:
0.0
```

这些参数必须标记：

```text
CONTROLLED_SYNTHETIC
NOT_FIELD_CALIBRATED
```

上述 physical-bound、Gaussian interval 和 clipping rule 身份必须进入 Runtime Config semantic payload，并由 S3B domain output 引用。

---

# 5. Latent State 与显式 unavailable 状态

唯一被估计的 latent variable：

```text
ROOT_ZONE_VOLUMETRIC_WATER_CONTENT_FRACTION
```

派生变量：

```text
ROOT_ZONE_WATER_STORAGE_MM
AVAILABLE_WATER_FRACTION
ROOT_ZONE_DEPLETION_FROM_FIELD_CAPACITY_MM
```

以下必须显式 unavailable/not-established：

```text
surface_soil_moisture_state:
UNAVAILABLE_NO_BOUND_SURFACE_OBSERVATION

water_stress_state:
NOT_ESTABLISHED_NO_STRESS_MODEL

drainage_state:
NOT_ESTABLISHED_MCFT_06_NOT_STARTED
```

不得从 200 mm 点位传感器虚构 surface State。`direct_state_equivalence=false` 必须保留。

---

# 6. 数学定义

## 6.1 Weak prior

```text
prior_mean
=
(wilting_point_fraction + field_capacity_fraction) / 2

prior_stddev
=
(field_capacity_fraction - wilting_point_fraction) / 2

prior_variance
=
prior_stddev²
```

标准值：

```text
prior_mean:     0.210000
prior_stddev:   0.090000
prior_variance: 0.008100
```

Prior 必须作为可嵌入 `twin_state_transition_v1` 的纯 Domain DTO 输出，不创建独立 canonical prior object，也不产生 `bootstrap_prior_ref`。

## 6.2 Observation operator

```text
H = 1
```

含义：首版局部均质假设下，root-zone mean 到 200 mm 观测期望的线性映射系数为 1；point-to-zone 差异由 representativeness uncertainty 表达。该定义不改变 `direct_state_equivalence=false`。

## 6.3 Observation variance

```text
sensor_variance
=
0.02²
=
0.000400

representativeness_variance
=
0.06²
=
0.003600

base_observation_variance
=
0.004000

effective_observation_variance
=
base_observation_variance / quality_weight
```

`FAIL` observation 必须被拒绝，不得进入 assimilation。

## 6.4 Scalar Gaussian assimilation

```text
predicted_observation
=
H × prior_mean

innovation
=
observation - predicted_observation

assimilation_gain
=
prior_variance / (H² × prior_variance + observation_variance)

posterior_mean
=
prior_mean + assimilation_gain × innovation

posterior_variance
=
(1 - assimilation_gain × H) × prior_variance
```

禁止把 `assimilation_gain` 命名为 confidence、accuracy 或 truth probability。

中间计算不得逐步取整。只有 emitted semantic fields 执行最终 6 位小数半离零取整。

---

# 7. 标准精确结果

```text
predicted_observation: 0.210000
innovation:            -0.026000
assimilation_gain:      0.669421
posterior_mean:         0.192595
posterior_variance:     0.002678
posterior_stddev:       0.051746

interval_low:           0.091172
interval_high:          0.294018

storage_mean_mm:        57.778512
storage_stddev_mm:      15.523909
storage_interval_low:   27.351652
storage_interval_high:  88.205373

available_water_fraction:
0.403306

depletion_from_field_capacity_mm:
32.221488
```

标准 posterior 必须同时满足：

```text
posterior_mean != prior_mean
posterior_mean != raw_observation
posterior_variance < prior_variance
```

---

# 8. Physical bounds 与 uncertainty

必须验证：

```text
0 <= observation <= 1
0 <= posterior_mean <= saturation_fraction
posterior_variance >= 0
stddev² approximately equals variance
storage_mean = posterior_mean × root_zone_depth_mm
available_water_fraction = (posterior_mean - wilting_point) / (field_capacity - wilting_point)
depletion_mm = max(0, field_capacity_storage_mm - storage_mean_mm)
```

规则：

```text
observation 超界:
hard rejection

posterior mean 超界:
hard failure

uncertainty interval 超界:
clip to [0, saturation_fraction]
retain unclipped interval
retain interval_clipped metadata

available_water_fraction:
clamp to [0,1]

depletion:
不得为负
```

Uncertainty output：

```text
distribution_family:
GAUSSIAN_APPROXIMATION

primary_measure:
STANDARD_DEVIATION

interval_level:
0.95

mean
variance
stddev
interval_low
interval_high
unclipped_interval
interval_clipped
uncertainty_sources
```

`uncertainty_sources` 至少包括：

```text
weak configured prior
sensor measurement uncertainty
point-to-zone representativeness uncertainty
controlled synthetic hydraulic configuration
single-observation bootstrap limitation
```

---

# 9. Confidence 与 eligibility

```text
confidence.status:
NOT_ESTABLISHED

confidence.reason_code:
NO_CALIBRATED_CONFIDENCE_MODEL
```

禁止 numeric confidence score，也禁止用 HIGH/MEDIUM/LOW 代替 uncertainty。

标准 eligibility：

```text
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

---

# 10. S3B Changed-File Boundary

允许：

```text
apps/server/src/domain/soil_water/**
apps/server/src/domain/twin_runtime/physical_bounds_v1.ts
apps/server/src/domain/twin_runtime/runtime_config_v1.ts
apps/server/src/runtime/twin_runtime/runtime_config_compile_service_v1.ts
fixtures/mcft/water_state/expected/**
fixtures/mcft/water_state/negative/**
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_STATE_MATH.*
docs/digital_twin/mcft/cap_01/**
S3B capability/status evidence files
```

对 Runtime Config 文件的修改仅允许：

```text
增加并验证 physical_bound_version
增加并验证 gaussian_interval_rule
增加并验证 uncertainty_interval_clip_rule
增加并验证 interval_clip_bounds
```

禁止借此修改：

```text
Reality/source/configuration frozen hashes
canonical identity rules
A0 object set
persistence transaction ordering
lease/fencing/idempotency semantics
```

明确禁止：

```text
Postgres
migration
Runtime orchestration
Evidence selection
Replay clock
route
web
Forecast construction
A0 commit
projection writes
MCFT-06 propagation
Scenario
Recommendation
AO-ACT
```

---

# 11. S3B 必需实现文件

建议：

```text
apps/server/src/domain/twin_runtime/physical_bounds_v1.ts

apps/server/src/domain/soil_water/bootstrap_water_prior_v1.ts
apps/server/src/domain/soil_water/root_zone_observation_operator_v1.ts
apps/server/src/domain/soil_water/scalar_gaussian_assimilation_v1.ts
apps/server/src/domain/soil_water/root_zone_water_posterior_v1.ts

fixtures/mcft/water_state/expected/MCFT_CAP_01_STATE_MATH_EXPECTED.json
fixtures/mcft/water_state/negative/**

scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_STATE_MATH.ts
```

所有新增代码文件首行必须标注路径，并写明职责与边界。

---

# 12. S3B 硬验收

必须包括：

```text
standard exact-value case
LIMITED quality case
FAIL quality rejection
observation below zero
observation above one
missing observation
NaN
Infinity
invalid prior
invalid variance
invalid hydraulic ordering
posterior physical-bound violation
interval clipping
available-water clamp
depletion non-negative
deterministic rerun
input immutability
domain purity scan
Runtime Config physical-bound identities present
```

必须证明：

```text
prior_mean = 0.210000
prior_variance = 0.008100
observation = 0.184000
observation_variance = 0.004000
innovation = -0.026000
assimilation_gain = 0.669421
posterior_mean = 0.192595
posterior_variance = 0.002678
posterior_stddev = 0.051746
storage_mean_mm = 57.778512
available_water_fraction = 0.403306
depletion_mm = 32.221488
```

Purity scan 必须拒绝：

```text
Date.now
new Date
process.env
filesystem imports
pg imports
Fastify imports
network imports
random UUID / nanoid
global mutable state
```

---

# 13. S3B 必需负测

```text
VWC below zero
VWC above one
NaN
Infinity
quality FAIL consumed
invalid wilting/field-capacity/saturation ordering
negative prior variance
negative posterior variance
posterior above saturation
numeric confidence score present
recommendation eligibility true
action eligibility true
direct_state_equivalence=true
input object mutated
nondeterministic rerun
Postgres import introduced
filesystem import introduced
wall-clock read introduced
S4 Runtime file introduced
```

每个 negative fixture 必须声明：

```text
fixture_id
failure_stage
expected_reason_code
expected_output_delta
```

S3B 失败不得产生 canonical write；本 slice 不应拥有 write capability。

---

# 14. S3B 完成条件

只有以下全部成立，才允许将 S3B 标记为 COMPLETE：

```text
pure Domain prior implementation exists
pure observation operator exists
pure scalar Gaussian assimilation exists
posterior derivation exists
physical bounds implementation exists
uncertainty and clipping metadata are explicit
confidence remains NOT_ESTABLISHED
eligibility fields are correct
standard exact values pass
all negative cases pass
deterministic rerun passes
input immutability passes
domain purity passes
server typecheck passes
server build passes
exact-head CI passes
working tree is clean
```

S3B 完成后只允许声明：

```text
BOOTSTRAP_STATE_MATH_ESTABLISHED
STATIC_BOOTSTRAP_ASSIMILATION_ESTABLISHED
POSTERIOR_WATER_STATE_DTO_ESTABLISHED
STATE_UNCERTAINTY_MATH_EXPLICIT
PHYSICAL_BOUNDS_RULE_ESTABLISHED
```

不得声明：

```text
A0_RUNTIME_EXECUTION
BOOTSTRAP_STATE_COMMITTED
ACTIVE_INITIAL_LINEAGE
INITIAL_CHECKPOINT_ESTABLISHED
SUCCESSFUL_FORECAST
CONTINUOUS_RUNTIME
PROPAGATION
SCENARIO
ACTION_LOOP
MCFT_CAP_01_COMPLETE
```

---

# 15. 后续拓扑

```text
main@b0b364933956a65345b927c6c5618e9d4ebe22af
↓
PR-D S3B Bootstrap State Math
↓
PR-E S4 A0 Runtime Integration
↓
PR-F S5 Closure
```

S4 只有在 S3B 合并 main 后才获得实施条件。不得在 S3B PR 中顺手实现 Evidence Window、A0 runner、Forecast、Checkpoint 或 next-tick handoff。

---

# 16. Nonclaims

```text
NO_A0_RUNTIME_EXECUTION
NO_BOOTSTRAP_STATE_COMMITTED
NO_ACTIVE_INITIAL_LINEAGE
NO_INITIAL_CHECKPOINT
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_PROPAGATION
NO_CONTINUOUS_RUNTIME
NO_RECOMMENDATION
NO_ACTION_LOOP
NO_LIVE_FIELD_CLAIM
NO_MCFT_CAP_01_CLOSURE
```
