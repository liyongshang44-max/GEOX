<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-TASK.md -->
# GEOX MCFT-CAP-01 / MCFT-1

# First-Class Water State Estimate 最终任务状态 v4.0

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

remediation_implementation_candidate_head:
193f9785e42eb146e300e2a64abeed455f10e54e

status:
COMPLETE

active_delivery_slice:
null

successor:
NOT_YET_AUTHORIZED

effectiveness_condition:
PR_2316_MERGED_AND_VERIFIED_ON_MAIN
```

历史 closure `250053aba...` 已被 remediation slice 取代，但保留为审计历史。

---

## 1. 最终成立的能力边界

```text
CONTROLLED_CANONICAL_REPLAY_EVIDENCE_DATASET_ESTABLISHED
CROP_STAGE_CONFIGURATION_CONTEXT_ESTABLISHED
A0_CANONICAL_CONTRACT_SUBSET_ESTABLISHED
A0_CROSS_REFERENCE_GRAPH_VALIDATION_ESTABLISHED
A0_PERSISTENCE_SUBSET_ESTABLISHED
REALITY_BINDING_RUNTIME_SNAPSHOT_ESTABLISHED
BOOTSTRAP_STATE_MATH_ESTABLISHED
STATIC_BOOTSTRAP_ASSIMILATION_ESTABLISHED
FIRST_BOOTSTRAP_POSTERIOR_ESTABLISHED
A0_RUNTIME_EXECUTION_ESTABLISHED
A0_ATOMIC_COMMIT_ESTABLISHED
ACTIVE_INITIAL_LINEAGE_ESTABLISHED
INITIAL_CHECKPOINT_ESTABLISHED
NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED
PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED
CONFLICTING_DUPLICATE_OBSERVATION_REJECTION_ESTABLISHED
EVIDENCE_MODEL_CONSUMPTION_TRACE_ESTABLISHED
BLOCKED_FORECAST_RESULT_ESTABLISHED
OPERATOR_INVOKABLE_MANUAL_RUNTIME_ENTRY_ESTABLISHED
MCFT_CAP_01_COMPLETE
FIRST_CLASS_WATER_STATE_ESTIMATE_LEVEL_A_ESTABLISHED
CONTROLLED_REPLAY_BOOTSTRAP_CLOSURE_ESTABLISHED
```

---

## 2. Persisted next-tick handoff

`prepareNextTickInput()` 从 PostgreSQL `REPEATABLE READ READ ONLY` 一致性快照读取：

```text
active lineage object ref
active lineage semantic id
latest checkpoint
previous posterior State
Runtime Config
Reality Binding Runtime snapshot
```

返回：

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

身份边界明确为：

```text
active_lineage_ref
  = twin_runtime_lineage_v1.object_id

lineage_id
  = semantic lineage identity
```

repository 必须先解析 active lineage canonical object，再将其 semantic lineage id 与 checkpoint 和 State 比较。

---

## 3. Evidence selector 与消费语义

soil selector 顺序：

```text
observed_at descending
ingested_at descending
source_record_id ascending
```

冲突规则：

```text
same origin_source_id
+ same observed_at
+ different canonical payload
→ CONFLICTING_DUPLICATE_OBSERVATION
→ zero Runtime Config fact delta
→ zero A0 canonical fact delta
→ zero lease/guard/projection delta
```

Evidence Window 区分：

```text
soil:
CONSUMED_BY_BOOTSTRAP_ESTIMATOR

rainfall and historical ET0:
CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR

excluded records:
NOT_CONSUMED_EXCLUDED
```

每个 entry 保留 event/ingested/available time、freshness、quality、source/canonical unit、conversion rule、limitations、disposition 与 model-consumption status。

---

## 4. A0 graph validity

A0 validator 在 aggregate hash 校验前独立校验完整对象图：

```text
Lineage
Evidence Window
Transition
Assimilation
State
Forecast
Tick
Checkpoint
Health
Runtime Config ref/hash
next logical tick time
```

14 组 ref 篡改在重算 member hash 与 aggregate hash 后仍被拒绝。

---

## 5. Manual Runtime entry

```text
apps/server/scripts/mcft/MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER.ts
```

正式 runner：

```text
requires explicit logical time
loads frozen authority artifacts
persists immutable Reality Binding Runtime snapshot
executes A0BootstrapRuntimeServiceV1
calls PrepareNextTickInputServiceV1
prints machine-readable output
```

验收结果：

```text
first execution: INSERTED
second execution: EXISTING_IDEMPOTENT_SUCCESS
posterior mean: 0.192595
posterior variance: 0.002678
next logical tick: 2026-06-01T02:00:00.000Z
```

该 runner 不是 scheduler，不建立 continuous Runtime。

---

## 6. Crop-stage context

Replay package 包含：

```text
configuration_context.json
manifest_v2.json
```

crop stage 保持：

```text
CONFIGURATION_DERIVED_CONTEXT
not Evidence
```

原 3604 条 Evidence 与 MCFT-00 frozen authority byte-unchanged。

---

## 7. 验收证据

```text
S1 Replay Dataset: 12 PASS, 0 FAIL
S4 A0 Runtime static: 21 PASS, 0 FAIL
S4 A0 Runtime PostgreSQL: 12 PASS, 0 FAIL
Remediation static: 18 PASS, 0 FAIL
Remediation PostgreSQL: 7 PASS, 0 FAIL
Governance readiness: 106 PASS, 0 FAIL
Server Typecheck: PASS
Server Build: PASS
git diff --check: PASS
working tree: CLEAN
CI #4491 / run 29038423099: SUCCESS
```

---

## 8. 继续保留的非声明

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

## 9. 后续授权

MCFT-CAP-01 完成不自动授权 MCFT-2。MCFT-2 必须在 PR #2316 合并并于 main 复验后，由独立任务书明确授权。
