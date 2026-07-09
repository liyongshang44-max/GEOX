<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-TASK.md -->
# GEOX MCFT-CAP-01 / MCFT-1

# First-Class Water State Estimate 当前实施任务书 v3.0

## 0. 当前身份

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
Level A — Deterministic Replay Bootstrap State

authority_baseline_commit:
94fe516ccbf8831be05c36ede5e2732bf7e19d55

runtime_delivery_main_commit:
4a0fd03beb05298028101a4999c67a5e053dadb8

historical_closure_main_commit:
250053aba801075c17098f8d505d527eb54390e9

status:
IN_IMPLEMENTATION

active_delivery_slice:
MCFT-CAP-01.CLOSURE-REMEDIATION-V1

successor:
NOT_YET_AUTHORIZED
```

`250053aba801075c17098f8d505d527eb54390e9` 保留为历史 closure commit，但其无条件 `MCFT_CAP_01_COMPLETE` 声明已因后续代码级审计发现实质缺口而暂停生效。

本任务书取代旧 v2.1 中已经过期的：

```text
status: IN_IMPLEMENTATION
active_delivery_slice: MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1
S4 NOT_YET_AUTHORIZED
S5 NOT_YET_AUTHORIZED
```

旧状态不再具有实施指导效力。

---

## 1. 已成立且继续保留的事实

```text
S1 Canonical Replay Evidence Dataset
  720 hourly intervals
  3604 governed Evidence records
  seven Evidence roles
  deterministic regeneration

S2 A0 Contracts and Runtime Config subset
  deterministic identity
  immutable Runtime Config

S3A A0 Persistence subset
  fenced lease
  aggregate idempotency
  nine-fact atomic append
  six rebuildable projections

S3B Bootstrap State Math
  prior_mean 0.210000
  prior_variance 0.008100
  observation 0.184000
  posterior_mean 0.192595
  posterior_variance 0.002678
  posterior_stddev 0.051746

S4 A0 Runtime Integration
  one controlled Replay bootstrap transaction
  INITIAL lineage
  INITIAL checkpoint
  BLOCKED zero-point Forecast result
  checkpoint next_tick_logical_time pointer
```

以下声明继续成立：

```text
BOOTSTRAP_STATE_MATH_ESTABLISHED
STATIC_BOOTSTRAP_ASSIMILATION_ESTABLISHED
FIRST_BOOTSTRAP_POSTERIOR_ESTABLISHED
A0_ATOMIC_COMMIT_ESTABLISHED
ACTIVE_INITIAL_LINEAGE_ESTABLISHED
INITIAL_CHECKPOINT_ESTABLISHED
BLOCKED_FORECAST_RESULT_ESTABLISHED
NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED
```

以下声明在 remediation 完成前暂停：

```text
MCFT_CAP_01_COMPLETE
NEXT_TICK_HANDOFF_ESTABLISHED
```

---

## 2. 已确认的 closure 缺口

### R1 Persisted next-tick handoff

必须实现：

```text
prepareNextTickInput()
```

并从 PostgreSQL 一致性快照读取：

```text
active lineage
latest checkpoint
previous posterior State
Runtime Config
Reality Binding Runtime snapshot
```

必须返回：

```text
previous_posterior_ref
previous_checkpoint_ref
lineage_id
prior_mean
prior_variance
next_logical_tick_time
runtime_config_ref
runtime_config_hash
reality_binding_ref
reality_binding_hash
```

禁止从当前内存 record set 直接伪装成 persisted handoff。

### R2 Conflicting duplicate observation rejection

soil observation selector 必须使用：

```text
observed_at descending
ingested_at descending
source_record_id ascending
```

并执行：

```text
same origin_source_id
+ same observed_at
+ different canonical payload
→ CONFLICTING_DUPLICATE_OBSERVATION
→ zero Runtime Config fact delta
→ zero A0 canonical fact delta
→ zero projection delta
```

### R3 Complete Evidence Window consumption semantics

每个 entry 必须记录：

```text
event time
ingested_at
available_to_runtime_at
freshness
quality
source unit
canonical unit
conversion rule
limitations
window disposition
model consumption status
model consumption reason
```

必须区分：

```text
CONSUMED_BY_BOOTSTRAP_ESTIMATOR
CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR
NOT_CONSUMED_EXCLUDED
```

A0 中：

```text
soil moisture observation
  CONSUMED_BY_BOOTSTRAP_ESTIMATOR

rainfall observation
  CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR

historical ET0 input
  CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR
```

### R4 Complete A0 cross-reference graph validation

validator 必须独立于 member hash 和 aggregate hash 验证完整对象图，包括：

```text
lineage activation authority
transition → Evidence Window
transition → Assimilation
transition → posterior State
Assimilation → transition
Assimilation → posterior State
State → transition
State → Assimilation
State → Evidence Window
Forecast → source posterior
Tick → Evidence/transition/Assimilation/State/Forecast/checkpoint
Checkpoint → Tick/State/Forecast
Health → Tick/checkpoint/lineage/State/Forecast
next logical tick time consistency
Runtime Config ref/hash consistency
```

必须证明：篡改 ref、重算 member hash、重算 aggregate hash后仍被拒绝。

### R5 Operator-invokable manual Runtime entry

必须提供：

```text
apps/server/scripts/mcft/MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER.ts
```

runner 必须：

```text
require explicit logical time
load frozen authority artifacts
persist Reality Binding Runtime snapshot
execute A0BootstrapRuntimeServiceV1
invoke prepareNextTickInput()
print machine-readable result
```

runner 不是 scheduler，也不建立 continuous Runtime。

### R6 Crop-stage configuration-derived Dataset context

crop-stage context 必须保持：

```text
CONFIGURATION_DERIVED_CONTEXT
not Evidence
```

Dataset package 必须显式引用：

```text
Configuration Binding Matrix
crop water-use binding
crop-stage mapping source
time-resolved crop-stage schedule
Kc
crop root depth
effective model root depth
```

不得把 crop stage 伪造为 observed Evidence record。

### R7 Governance consistency

必须同步：

```text
Vertical Capability Line Matrix
Delivery Slice Status
Closure Record
Closure narrative
本任务书
remediation status
```

所有文件必须表达相同状态。

---

## 3. Remediation changed-file boundary

允许：

```text
apps/server/src/domain/twin_runtime/**
apps/server/src/runtime/twin_runtime/**
apps/server/src/persistence/twin_runtime/**
apps/server/src/adapters/twin_runtime/**
apps/server/scripts/mcft/**
apps/server/db/migrations/*mcft_cap_01_closure_remediation*
apps/server/package.json
scripts/mcft/GENERATE_MCFT_CAP_01_REPLAY_DATASET.cjs
scripts/runtime_acceptance/*MCFT_CAP_01_CLOSURE_REMEDIATION*
fixtures/mcft/water_state/configuration_context_source_v1.json
fixtures/mcft/water_state/replay_v1/configuration_context.json
fixtures/mcft/water_state/replay_v1/manifest_v2.json
docs/digital_twin/mcft/cap_01/**
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
```

禁止：

```text
MCFT-06 propagation
successful Forecast
Scenario
Recommendation
Decision
AO-ACT
continuous scheduler
restart/backfill
late-Evidence revision Runtime
public routes
web UI
MCFT Gate A/B/C closure
Minimum Complete Field Twin claim
```

---

## 4. Remediation 硬验收

必须全部通过：

```text
legacy S1 Replay Dataset Gate
legacy S2 Contracts/Config Gate
legacy S3A persistence Gates
legacy S3B State Math Gate
legacy S4 A0 Runtime static Gate
legacy S4 PostgreSQL Gate
closure remediation static Gate
closure remediation PostgreSQL Gate
manual runner execution against isolated PostgreSQL
server typecheck
server build
exact-head CI
git diff --check
clean working tree
```

专项负测至少包括：

```text
conflicting duplicate observation
same-value duplicate deterministic tie-break
missing Reality Binding snapshot
active-lineage/checkpoint mismatch
checkpoint/State revision mismatch
Runtime Config mismatch
rehashed transition ref corruption
rehashed Assimilation ref corruption
rehashed State ref corruption
rehashed Tick ref corruption
rehashed Checkpoint ref corruption
rehashed Health ref corruption
crop-stage context gap
crop-stage context overlap
crop-stage context mislabeled as Evidence
```

---

## 5. 完成条件

只有以下全部成立，才允许重新声明：

```text
MCFT_CAP_01_COMPLETE
FIRST_CLASS_WATER_STATE_ESTIMATE_LEVEL_A_ESTABLISHED
CONTROLLED_REPLAY_BOOTSTRAP_CLOSURE_ESTABLISHED
PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED
CONFLICTING_DUPLICATE_OBSERVATION_REJECTION_ESTABLISHED
EVIDENCE_MODEL_CONSUMPTION_TRACE_ESTABLISHED
A0_CROSS_REFERENCE_GRAPH_VALIDATION_ESTABLISHED
OPERATOR_INVOKABLE_MANUAL_RUNTIME_ENTRY_ESTABLISHED
CROP_STAGE_CONFIGURATION_CONTEXT_ESTABLISHED
```

重新闭合后仍必须保留：

```text
NO_PROPAGATION
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_DECISION
NO_AO_ACT
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_RESTART_BACKFILL_PROOF
NO_LATE_EVIDENCE_REVISION_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

---

## 6. 后续顺序

```text
MCFT-CAP-01.CLOSURE-REMEDIATION-V1
↓
重新闭合 MCFT-0 / MCFT-1
↓
单独授权 MCFT-2 Hourly Dynamics and Persistence
```

在 remediation 合并并重新闭合前，禁止开始 MCFT-2。
