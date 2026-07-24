# GEOX MCFT-CAP-08 — 24-Tick End-to-End Closure

## 完整任务线 v0.3.9 — FULL TASKBOOK RESTORED / S2 EFFECTIVE / S3 DESIGN FROZEN

```text
document_id:
GEOX-MCFT-CAP-08-TASK-V0.3.9-FULL-TASKBOOK-RESTORED-S2-EFFECTIVE-S3-DESIGN-FROZEN

capability_line_id:
MCFT-CAP-08

display_alias:
MCFT-8

canonical_name:
24-Tick End-to-End Closure

runtime_mode:
REPLAY

target_stage:
STAGE_1A_REPLAY_BACKED_CLOSURE

predecessor:
MCFT-CAP-07 — Minimal Field Twin Read Model and Timeline

successor:
MCFT-CAP-09 — Shadow-Online Promotion

document_status:
S2_EFFECTIVE_S3_DESIGN_FROZEN_GOVERNANCE_ENTRY_PENDING

design_status:
FULL_TASKBOOK_RESTORED_FROM_V0_3_5_AND_REALIGNED_TO_MAIN

base_full_taskbook_ref:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK-v0.3.5-HISTORICAL-FULL.md

base_full_taskbook_blob:
ab4f4e7d9d3978ac3be979583cda4ccdc94a2fb6

current_repository_main:
1f37d6247a5f2e90327720c9feed4faf729d1db3

s0_authority_reconciliation:
EFFECTIVE

s1_effective:
true

s1_effective_subject_sha:
f39b7df37571156f23cfb9153bad024fdb723261

s1_exact_sha_workflow_run:
29980589779

s1_artifact_id:
8553043184

s1_semantic_artifact_digest:
sha256:7f8e6d61f038ddfd6a6b86430c230fc7e36509011d4131bae1670034ff2b74bc

s2_effective:
true

s2_original_candidate_pr:
2637

s2_original_candidate_head:
88dba989203d93a994ed0a7e7002b0a106ed7d88

s2_original_candidate_merge:
15d26d86ff955bab982871adf6e1bd8c75b07972

s2_exact_sha_remediation_pr:
2638

s2_effective_subject_sha:
1f37d6247a5f2e90327720c9feed4faf729d1db3

s2_exact_sha_workflow_run:
30034240206

s2_artifact_id:
8574593152

s2_artifact_digest:
sha256:8bb99559bcdbda63de5ff196bb9d7040269d07acf7b80374341a620beae60da7

s2_effective_status:
S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE

s2_effective_next_slice:
S3

independent_review_satisfied:
false

independent_review_waived:
true

s3_design_status:
FROZEN_IN_THIS_TASKBOOK

s3_status_seed_present_on_main:
false

s3_registry_candidate_rule_present_on_main:
false

s3_implementation_authorized:
false

s3_candidate_implemented:
false

first_legal_s3_action:
PRE_CANDIDATE_GOVERNANCE_SEED_AND_REGISTRY_RULE

bounded_replay_runner_authorized:
true

bounded_canonical_transaction_authorized:
true

production_runtime_source_authorized:
false

http_write_authorized:
false

background_scheduler_authorized:
false

live_ingestion_authorized:
false

model_activation_authorized:
false

mcft_cap_09_authorized:
false

minimum_complete_field_twin_complete:
false
```

> 本文件以 v0.3.5 的完整任务书为架构基础。完整历史正文以 Git Blob `ab4f4e7d9d3978ac3be979583cda4ccdc94a2fb6` 归档在相邻文件中。  
> 历史文件保留完整数学、对象、事务、Hard Acceptance 和 nonclaim 设计，但其中关于 repository baseline、PR-0/PR-1 pending、Freeze Gate 1/17、Slice 编号与实施授权的陈述均已失效，不得作为当前状态 authority。  
> 本 v0.3.9 是当前主任务书：它吸收历史架构，按 merged-main 和 exact-SHA 事实修正 S1/S2 状态，并冻结现行 S3 Decision + Action Feedback 的实施与验收设计。  
> v0.3.8 Compact 版本仅保留为历史 S0 transport 记录，不再是 S3–S6 的充分实施设计。

---

# 0. 决定性裁决

## 0.1 版本与 authority

```text
v0.3.5 architecture body:
RETAINED

v0.3.5 repository status statements:
SUPERSEDED

v0.3.8 compact taskbook:
HISTORICAL_S0_TRANSPORT_RECORD_ONLY

v0.3.9 current taskbook:
CURRENT_DESIGN_AUTHORITY

implementation effectiveness authority:
PROTECTED_MERGE_PLUS_EXACT_SHA_PLUS_IMMUTABLE_ARTIFACT

postmerge SSOT writeback:
FORBIDDEN
```

历史 v0.3.5 中以下设计继续有效，并由本文件与机器契约共同引用：

```text
24-Tick Stage 1A scope
B00 bootstrap root
FVO-01 ... FVO-24 mapping
R-01 ... R-24 mapping
T10 Outcome = FVO-10 identity
T16 append-forward late correction math
full posterior-to-posterior sensitivity
resolve → E → H → A → B → G → C → barrier
bounded writer authority
25-state Progress Resolver contract
semantic / operational / closure digest split
24 Hard Acceptance items
completion nonclaims
```

## 0.2 当前 externally effective frontier

```text
S0 authority reconciliation:
EFFECTIVE

S1 Base Runtime:
S1_BASE_RUNTIME_IMPLEMENTED_EFFECTIVE
subject = f39b7df37571156f23cfb9153bad024fdb723261
workflow = 29980589779
artifact = 8553043184

S2 Forcing/Evidence/State/Forecast:
S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE
subject = 1f37d6247a5f2e90327720c9feed4faf729d1db3
workflow = 30034240206
artifact = 8574593152

next effective slice:
S3
```

S2 exact-SHA 证明：

```text
successful Tick = 24
formal Forcing windows = 24
formal State outputs = 24
formal Forecast outputs = 24
Forecast points = 1728
ordinary State observations = 5
residual-only observations quarantined = 17
late source quarantined = 1
unavailable absence witnesses = 15
completion authority negative cases = N1-N14
completed replay canonical delta = 0
candidate-to-merge tree delta = 0
immutable readback = PASS
```

仓库中的 S1/S2 status JSON 保存 candidate-state 记录，不做 post-merge 改写。外部 effectiveness 必须从 exact-SHA artifact 投影，不能只看 status JSON。

## 0.3 Slice 编号修正

| v0.3.5 名称 | 当前名称 | 当前状态 |
|---|---|---|
| S1 Base 24-Tick Runtime | S1 Base Runtime + 24-Tick skeleton | EFFECTIVE |
| S2 Replay Decision/Execution/Outcome | S3 Decision + Action Feedback | DESIGN FROZEN |
| S3 Recovery and Late Evidence | S4 Late Evidence append-forward | FUTURE |
| S4 Residual/Calibration/Shadow | S5 Residual/Calibration/Shadow | FUTURE |
| S5 Read Model and Operator | 并入 S6 final closure | FUTURE |
| S6 Final Closure | S6 final two-run closure + recovery + read model/operator | FUTURE |

当前 sequence：

```text
S1 Base Runtime + 24-Tick skeleton
→ S2 Forcing / Evidence / State / Forecast
→ S3 Decision + Action Feedback
→ S4 Late Evidence append-forward correction
→ S5 Residual + Calibration + Shadow
→ S6 final two-run closure + restart/recovery + read model/operator + exact-SHA closure
```

## 0.4 S3 当前法律状态

```text
S3 design:
FROZEN_BY_THIS_TASKBOOK

S3 predecessor effectiveness:
SATISFIED_BY_S2_ARTIFACT

S3 status seed on main:
ABSENT

S3 Registry rule on main:
ABSENT

S3 implementation_authorized:
false

S3 candidate declaration:
FORBIDDEN_UNTIL_TRUSTED_BASE_RULE_EXISTS
```

第一合法动作：

```text
create non-candidate GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json
register s3_candidate_implemented=true in trusted Registry
freeze focused/exact-SHA workflow identities
bind S2 predecessor artifact/readback
prove Runtime source delta = 0
protected merge
```

本任务书修订本身不创建 candidate signal，也不授权 S3 Runtime source change。

---

# 1. Stage 1A 完成语义

Authority Reconciliation 后，Stage 1A 定义为：

```text
one governed field / season / zone
one formal Replay lineage and revision
one complete bootstrap Runtime root
24 continuous successful hourly Tick
24 successful 72-hour Forecast
24 three-option Scenario Set
one replayed historical Decision/Execution/Outcome episode
24 Forecast Verification Observations
24 Forecast Residual
16 Calibration cases
8 Holdout cases
one Calibration Candidate
one Shadow Evaluation
zero Model Activation
fresh-process restart and recovery
late Evidence append-forward correction
complete Read Model / Timeline / Trace / Operator readback
```

仍未建立：

```text
720-Tick long-horizon qualification
five-scenario extended qualification
historical revision reprocessing
live sensor Runtime
shadow-online Runtime
background scheduler
automatic Recommendation/Approval/AO-ACT/Dispatch
Model Activation
causal effect proof
ROI proof
multi-field scale
Minimum Complete Field Twin complete
MCFT-CAP-09 authority
```

---

# 2. Authority 与 SSOT

## 2.1 Architecture authority

```text
GEOX-DIGITAL-TWIN-MASTER-TASK-LINE
GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2
this v0.3.9 taskbook
machine-readable CAP-08 contracts
```

## 2.2 Delivery authority

```text
MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json
capability status files
resolved manifest
exact changed-file boundary
Candidate Declaration
```

## 2.3 Effectiveness authority

```text
protected merge
exact merge-SHA status
canonical authority artifact
immutable retention locator/readback
```

任一 authority drift：

```text
candidate declaration = REJECTED
Runtime implementation = BLOCKED
```

## 2.4 S3 Registry gap

Trusted Registry 当前只登记：

```text
CAP-08 Current Authority
S1 candidate path/rule
S2 candidate path/rule
```

当前缺失：

```text
S3 status path
s3_candidate_implemented=true rule
mcft-cap-08-s3-decision-action-feedback binding
S3 exact-SHA status context
```

`effective_next_slice=S3` 表示下一合法 Slice，不等于 S3 已授权。

---

# 3. S3 pre-candidate governance

S3 implementation 前必须先完成普通、非候选治理 delivery。

## 3.1 S3 seed

```text
schema_version
capability_line_id = MCFT-CAP-08
slice_id = MCFT-CAP-08.S3
record_status = PRE_REGISTERED_SUCCESSOR_STATUS_SEED
candidate_field = s3_candidate_implemented
candidate_value = false
implementation_authorized = false
effectiveness_condition = PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS
effective_status_when_attested = S3_DECISION_ACTION_FEEDBACK_IMPLEMENTED_EFFECTIVE
effective_next_slice_when_attested = S4
predecessor_effective_evidence_requirement = REQUIRED
predecessor_subject_sha = 1f37d6247a5f2e90327720c9feed4faf729d1db3
predecessor_exact_sha_workflow_run = 30034240206
predecessor_artifact_id = 8574593152
runtime_authority_delta = DECISION_ACTION_FEEDBACK_PROVIDERS
canonical_write_authority_delta = BOUNDED_G_H_AND_OUTCOME_EVIDENCE_WRITES
production_runtime_source_authorized = false
postmerge_ssot_writeback_allowed = false
```

## 3.2 Registry rule

```json
{
  "status_file": "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json",
  "field_path": "s3_candidate_implemented",
  "allowed_candidate_values": [true],
  "focused_workflow": "mcft-cap-08-s3-decision-action-feedback",
  "standard_workflow": "ci",
  "predecessor_effective_evidence_required": true
}
```

## 3.3 Governance PR nonclaims

```text
Candidate Declaration = absent
s3_candidate_implemented = false
Runtime source delta = 0
canonical data delta = 0
database ACL delta = 0
production authority delta = 0
```

只有 seed/rule 进入 trusted main 后，S3 implementation PR 才能把预登记字段从 `false` 转为 `true`。

S2 的 owner review waiver 不自动传递给 S3。S3 governance 必须显式决定 review policy。

---

# 4. Formal scope 与 run identity

```yaml
tenant_id: tenantA
project_id: projectA
group_id: groupA
field_id: field_c8_demo
season_id: season_2026_c8_corn
zone_id: zone_mcft_c8_water_001
```

禁止：

```text
fieldA / seasonA / zoneA
anonymous fixture
scope relabeling
cross-scope stitching
local-demo lineage/checkpoint/config reuse
```

Formal root：

```text
B00 bootstrap root
counted as successful Tick = false
same formal lineage/revision as T00-T23 = true
```

B00 包含：

```text
active lineage
frozen revision
Reality Binding
Runtime Config
bootstrap State
bootstrap Tick
bootstrap Checkpoint
bootstrap Forecast result
persisted next-tick handoff
```

Run identity：

```text
run_contract_id = GEOX-MCFT-CAP-08-24-TICK-RUN-CONTRACT-V1
formal_run_id = deterministic scope+dataset+config identity
lineage_strategy = NEW_FORMAL_REPLAY_LINEAGE
revision_strategy = ONE_FROZEN_REVISION
T00 = runtime_start
T23 = runtime_start + PT23H
T24 = verification target only, not Runtime Tick
```

---

# 5. FVO / Residual due map

```text
T00 Forecast H=1 → FVO-01 at T01
...
T23 Forecast H=1 → FVO-24 at T24
```

Cardinality：

```text
successful Tick = 24
successful Forecast = 24
FVO = 24
Residual = 24
Calibration = R-01 ... R-16
Holdout = R-17 ... R-24
```

关键 due semantics：

| Phase | State assimilation | Forecast evaluation | Late | Residual obligation |
|---|---|---|---|---|
| T01 | none | none | FVO-01 hidden | none |
| T02 | FVO-02 | FVO-02 | FVO-01 hidden | R-02 future S5 |
| T03 | FVO-03 LIMITED | FVO-03 | FVO-01 hidden | R-03 future S5 |
| T04 | FVO-04 selected | FVO-04 | FVO-01 hidden | R-04 future S5 |
| T05–T09 | none | FVO-05...09 residual-only | FVO-01 hidden | future S5 |
| T10 | FVO-10 | FVO-10 | FVO-01 hidden | R-10 future S5 |
| T11–T15 | none | residual-only | FVO-01 hidden | future S5 |
| T16 | no ordinary observation | FVO-16 residual-only | FVO-01 late correction | R-01 + R-16 future S5 |
| T17–T21 | none | residual-only | none | future S5 |
| T22 | FVO-22 | FVO-22 | none | R-22 future S5 |
| T23 | none | FVO-23 | none | R-23 future S5 |
| G00 | none | FVO-24 | none | R-24 future S5 |

S2 已完成 Evidence qualification、State/Forecast 和 quarantine；S3 只消费与 Decision/Action/Outcome 有关的时间身份，不提交 Residual。

---

# 6. State、Dynamics、Forecast 与 Scenario

State coordinate：

```text
root_zone_water_storage_mm
root_zone_mean_vwc_fraction
water_stress_state
root_zone_depth_mm
```

Dynamics：

```text
water(t)
= water(t-1)
+ effective rainfall
+ executed irrigation
- evapotranspiration
- runoff
- drainage
```

普通 assimilation：

```text
POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1
SCALAR_GAUSSIAN_ASSIMILATION_V1
```

每 Tick 必须保存 prior、predicted observation、actual/absence、innovation、gain、posterior、uncertainty、disposition、refs/hashes。

Forecast：

```text
24 Forecast
72 points each
1728 total points
```

Scenario：

```text
NO_ACTION
IRRIGATE_NOW_15MM
IRRIGATE_NOW_25MM
24 Scenario Set
72 options
5184 trajectory points
```

```text
Scenario is not Recommendation
Scenario is not Approval
Scenario is not Execution
```

---

# 7. Stable orchestration and Progress Resolver

Stable order：

```text
resolve → E → H → A → B → G → C → barrier
```

Provider progression：

```text
S1 = base range engine + empty G/H/C
S2 = formal E/A/B providers
S3 = G/H Decision + Action Feedback providers
S4 = recovery + late A profile
S5 = C Residual + post-run D
S6 = full closure + read model/operator
```

`phase_engine_contract_digest` 不得漂移；source digest 可以因非语义修复变化，但必须解释 source delta 并重跑 contract conformance。

Progress Resolver 当前事实：

```text
25-state contract = frozen
6-query catalog = frozen
witness catalog = frozen
mode = read-only deterministic earliest pending
repair authority = false
S1/S2 B00/E/A/B/completion coverage = established
G/H/C/D recovery coverage = partial pending S3-S6
extreme pointer recovery = not established pending S6
```

Barrier：前一 Tick 未满足全部 due obligations，不得开始下一 Tick。

---

# 8. S3 — Decision + Action Feedback

## 8.1 Canonical scope

```text
slice_id = MCFT-CAP-08.S3
canonical_name = Decision + Action Feedback
formal episode = ONE_REPLAYED_HISTORICAL_DECISION_EXECUTION_OUTCOME_EPISODE
runtime mode = REPLAY
```

S3 建立：

```text
one Human Decision
one Approval Assertion Evidence
one Approved Plan Snapshot Evidence
one Execution Receipt Evidence
one Action Feedback
one Outcome Observation shared with FVO-10
G/H provider integration
same-Tick H-before-A rule
idempotent G/H persistence
negative Evidence and pointer fail-closed proof
```

S3 不建立：

```text
Recommendation
AO-ACT
Dispatch
device command
late correction
Residual
Calibration
Shadow
Model Activation
full recovery closure
production Runtime source
```

## 8.2 Object separation and cardinality

```text
Scenario ≠ Human Decision
Human Decision ≠ Approval Assertion
Approval Assertion ≠ Approved Plan Snapshot
Approved Plan ≠ Execution Receipt
Execution Receipt ≠ Action Feedback
Action Feedback ≠ Outcome Observation
Outcome Observation ≠ causal effect proof
```

```text
Human Decision = exactly 1
Approval Assertion = exactly 1
Approved Plan Snapshot = exactly 1
Execution Receipt = exactly 1
Action Feedback = exactly 1
Outcome/FVO-10 canonical identity = exactly 1
Outcome/FVO duplicate = 0
Recommendation = 0
AO-ACT = 0
Dispatch = 0
```

Replay values：

```text
approved_amount_mm = 15.000000
executed_amount_mm = 13.600000
coverage_fraction = 0.910000
target_scope_equivalent_amount_mm = 12.376000
```

## 8.3 Event timeline

| Tick | Event | Required proof |
|---:|---|---|
| T05 | B 后提交 Human Decision | exact Scenario predecessor；no Recommendation |
| T06 | Approval Assertion + Plan visible | Decision/Approval/Plan separated |
| T07 | physical execution；Receipt unavailable | no premature State consumption |
| T08 | Receipt visible；H before A | executed amount first enters T08 Dynamics |
| T09 | outcome interval underway；FVO-10 not observed | no premature Outcome use |
| T10 | Outcome = FVO-10；ordinary A | one Evidence identity, two purposes |

S3 不提交 R-10；只冻结其 future predecessor identity。

## 8.4 G provider contract

Input：

```text
formal_run_id
six-key scope
lineage/revision refs+hashes
T05 Scenario Set ref+hash
selected Scenario option
human/replay source identity
observed_at / available_to_runtime_at
idempotency identity
```

Output：

```text
one twin_decision_record_v1
exact Scenario edge
replay provenance
approved intent amount
canonical hash
```

G 必须在 B(T05) 后。Decision before Scenario、foreign Scenario、wrong run/scope/lineage/revision、conflicting duplicate 均 fail closed。

## 8.5 H provider contract

Input：

```text
formal_run_id
six-key scope
lineage/revision refs+hashes
Decision ref+hash
Approval Evidence ref+hash
Plan Evidence ref+hash
Receipt Evidence ref+hash
approved amount
executed amount
coverage fraction
target-scope-equivalent amount
receipt available_to_runtime_at
A snapshot cutoff
idempotency identity
```

Output：

```text
one twin_action_feedback_v1
Decision/Plan/Receipt predecessor edges
amount separation
first legal consumption Tick
canonical hash
```

Same-Tick rule：

```text
Receipt available_to_runtime_at <= T08 cutoff
AND H committed before A snapshot
→ A(T08) may consume H

otherwise
→ T08 consumption forbidden
→ first legal consumption = T09
```

Formal dataset 固定前者。

## 8.6 Outcome = FVO-10 identity

T10 只允许一个 Evidence：

```text
observed_at = T10
available_to_runtime_at <= T10 cutoff
eligible_for_state_assimilation = true
eligible_for_forecast_evaluation = true
purpose includes STATE_ASSIMILATION
purpose includes FORECAST_EVALUATION
```

禁止：

```text
Outcome visible at T09
separate cloned Outcome and FVO
one observation producing two R-10 identities
Outcome attached to foreign Receipt
```

## 8.7 S3 micro-sequence

```text
T05: resolve → E → A → B → G → barrier
T06: resolve → E(Approval+Plan) → A → B → barrier
T07: resolve → E(no Receipt) → A → B → barrier
T08: resolve → E(Receipt) → H → freeze A snapshot → A consumes H → B → barrier
T09: resolve → E(no Outcome) → H readback → A → B → barrier
T10: resolve → E(Outcome=FVO-10) → H readback → A ordinary assimilation → B → barrier
```

C provider 在 S3 保持 empty。

## 8.8 S3 negative Evidence matrix

| ID | Case | Expected |
|---|---|---|
| S3-N01 | Decision before Scenario | reject, zero write |
| S3-N02 | foreign Scenario | reject, zero write |
| S3-N03 | Approval without Decision | reject |
| S3-N04 | Plan without Approval | reject |
| S3-N05 | Receipt wrong scope | reject |
| S3-N06 | Receipt wrong formal run | reject |
| S3-N07 | Receipt wrong lineage | reject |
| S3-N08 | Receipt wrong revision | reject |
| S3-N09 | Receipt after T08 cutoff | no T08 consumption; legal T09 |
| S3-N10 | duplicate Action Feedback exact payload | idempotent readback |
| S3-N11 | duplicate Action Feedback conflicting payload | fenced conflict |
| S3-N12 | approved/executed amount conflated | reject |
| S3-N13 | coverage outside bounds | reject |
| S3-N14 | target-scope-equivalent mismatch | reject |
| S3-N15 | Outcome/FVO-10 visible at T09 | reject |
| S3-N16 | cloned Outcome/FVO identities | reject |
| S3-N17 | Outcome references foreign Receipt | reject |
| S3-N18 | unit-invalid Outcome candidate | invalid rejected |
| S3-N19 | spatial-mismatch Outcome candidate | reject/context-only |
| S3-N20 | stale visibility epoch | reject |
| S3-N21 | completed replay rerun | zero mutation |
| S3-N22 | active config/model change during G/H | reject |

每个 rejection 必须证明：

```text
canonical fact delta = 0
projection delta = 0
pointer delta = 0
lease delta = 0
authority snapshot delta = 0
```

## 8.9 Pointer integrity matrix

S3 必须覆盖：

```text
missing Decision predecessor pointer
stale Scenario pointer
foreign Action Feedback pointer
wrong current Checkpoint pointer
cross-lineage current pointer
second active pointer candidate
```

裁决：

```text
repair in place = forbidden
silent pointer reconstruction = forbidden
result = fail closed or exact deterministic canonical readback
```

以下留给 S6：

```text
multiple simultaneous pointer loss
full pointer/index rebuild from canonical facts
fresh-process recovery across H/A/B/G/C/D pending states
projection loss plus response loss
pointer loss plus response loss
```

S3 不得因能检测 pointer 错误而宣称 full recovery complete。

## 8.10 Fresh PostgreSQL acceptance

每次 focused run：

```text
new disposable PostgreSQL database
production bootstrap order
bounded runner provision and verification
rebuild/replay S2 base chain
slice-specific run_id and lineage/revision
slice_acceptance_only = true
final_formal_run_id = null
```

Positive proof：

```text
24 Tick/State/Forecast/Scenario preserved
Decision = 1
Approval Assertion = 1
Approved Plan = 1
Execution Receipt = 1
Action Feedback = 1
Outcome/FVO-10 identity = 1
T08 H-before-A = PASS
T09 Outcome absence = PASS
T10 ordinary assimilation = PASS
phase_engine_contract_digest unchanged = PASS
Recommendation/AO-ACT/Dispatch = 0
Residual/Calibration/Shadow/Activation = 0
completed rerun write delta = 0
```

Negative proof 必须执行 S3-N01–S3-N22，不得以字符串扫描代替数据库验收。

## 8.11 S3 workflow and artifact

Focused workflow：

```text
mcft-cap-08-s3-decision-action-feedback
```

Exact-SHA workflow：

```text
mcft-cap-08-s3-exact-sha-attestation
status context = mcft-cap-08/s3-exact-sha-attestation
```

Candidate artifact：

```text
candidate head/tree
S2 predecessor locator/readback
taskbook section digest
G/H contract digest
phase contract/source digests
positive cardinalities
S3-N01–S3-N22 results
pointer matrix
completed rerun zero delta
nonclaims
```

Exact merge-SHA 必须：

```text
candidate tree = merge tree
replay boundary on detached candidate
fresh PostgreSQL positive/negative proof
canonical artifact finalization
immutable R1 upload/readback
commit status success
```

只有 PASS 后投影：

```text
effective_status = S3_DECISION_ACTION_FEEDBACK_IMPLEMENTED_EFFECTIVE
effective_next_slice = S4
decision_action_feedback_authorized = true
late_append_forward_authorized = false
residual_calibration_shadow_authorized = false
production_runtime_source_authorized = false
```

---

# 9. S4 — Late Evidence append-forward

S4 建立：

```text
FVO-01 first visible at T16
FVO-16 residual-only
Dynamics-only base T16 posterior
LATE_APPEND_FORWARD correction
full posterior-to-posterior sensitivity
historical object hashes unchanged
T17 consumes corrected posterior
```

Transport：

```text
g_k(x) = OrdinaryAssimilation_k(Dynamics_k(x), frozen Evidence, Config, quality, clipping)
a_k = [g_k(x+epsilon)-g_k(x-epsilon)]/(2*epsilon)
Phi_t_tau = product(a_k)
delta_x_t = exp(-lambda*lag) * transported_gain * innovation
```

S4 必须消费已冻结的 12 shared vectors，覆盖 positive/negative residual、LIMITED、max lag、lag rejection、upper/lower clipping、non-finite、intermediate ordinary assimilation、zero sensitivity、variance floor、deterministic rerun。

S4 不建立 extreme multi-pointer rebuild；该能力留给 S6。

---

# 10. S5 — Residual / Calibration / Shadow

```text
Residual = exactly 24
Calibration = exactly 16
Holdout = exactly 8
Candidate = exactly 1
Shadow = exactly 1
Model Activation = exactly 0
active Runtime Config switch = 0
```

Residual mapping：

```text
R-i = Forecast T(i-1) H=1 + FVO-i
ordered by forecast_target_time
R-01 remains first although committed at T16
```

Candidate oracle：

```text
parameter = dynamics_parameters.drainage_coefficient_per_hour
base = 0.030000
expected candidate = 0.034000
grid points = 21
```

若 formal dataset 不再选择 `0.034000`，必须进入 Architecture Deviation Adjudication；不得静默改 expected value。

Shadow：8 holdout paired replay、future leakage 0、candidate inactive、active config unchanged、State/checkpoint unchanged by D。

---

# 11. S6 — Final closure / Recovery / Read Model

S6 是唯一 final formal run authority，并吸收旧 v0.3.5 的独立 Read Model Slice。

必须执行：

```text
RUN_A and RUN_B in independent fresh databases
same deterministic formal_run_id
different operational run_instance_id
B00 → T00-T23 → G00-G02
all E/H/A/B/G/C/D/F obligations enabled from start
no Slice acceptance object reuse
no cross-run stitching
```

必须建立：

```text
fresh-process restart
pre-commit rollback
post-commit response-loss recovery
concurrency fencing
extreme pointer loss and deterministic rebuild
full 24 Hard Acceptance ledger
CAP-07 ten GET surfaces
Timeline/Trace/pagination
Operator readback
zero-write product proof
semantic digest equality
operational invariant digest equality
closure digest equality
candidate/merge tree equality
exact merge-SHA R2 artifact/readback
```

S6 不创建或授权 MCFT-CAP-09。

---

# 12. Writer authority and database identity

```text
bounded writer = geox_mcft_cap08_runner_v1
NOINHERIT
non-superuser
no CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS
no role membership/ownership/SET ROLE
production geox_runtime_v1 as CAP-08 writer = forbidden
```

每个 fresh database：

```text
external-admin bootstrap
bootstrap source digest verification
role flags and membership verification
exact grants/revokes
negative privilege probes
bounded credential exposure only after PASS
```

Database role 只建立 relation-level least privilege，不建立 six-key row isolation。Scope/run/lineage/revision 由 application validation + canonical identity + repository CAS/fencing 强制。

禁止：

```text
blanket ALL TABLES/SEQUENCES/FUNCTIONS
schema CREATE
database CREATE/TEMP
DELETE/TRUNCATE/REFERENCES/TRIGGER
unrelated commercial domain write
Runtime credential fallback
```

---

# 13. Determinism policy

```text
semantic_chain_digest_v1
operational_invariant_digest_v1
operational_instance_manifest_v1
closure_digest_v1
```

Semantic digest 排除 worker、lease owner、attempt timestamp、PID、raw logs。

Operational invariant digest 覆盖 fault stage、rollback outcome、restart boundary、response-loss outcome、concurrency winner count、duplicate count、resolver terminal state、projection rebuild equality；排除 wall clock、worker name、lease token、job ID。

```text
closure_digest = hash(taskbook, run contract, semantic digest, operational invariant digest, HA ledger)
```

RUN_A/RUN_B 必须满足 semantic、operational invariant、closure digest byte equality。

---

# 14. Cardinality oracle

```text
bootstrap root = 1
bootstrap State/Tick/Checkpoint/Forecast = 1 each
successful T00-T23 Tick = 24
new posterior State = 24
bootstrap-inclusive State = 25
Forecast = 24
Forecast points = 1728
Scenario Set = 24
Scenario options = 72
Scenario trajectory points = 5184
FVO = 24
Residual = 24
Decision = 1
Approval Assertion = 1
Approved Plan = 1
Execution Receipt = 1
Action Feedback = 1
Outcome Evidence identity = 1
Calibration = 16
Holdout = 8
Candidate = 1
Shadow = 1
Activation = 0
Recommendation = 0
AO-ACT = 0
Dispatch = 0
```

---

# 15. Hard Acceptance summary

完整 24 项 Hard Acceptance 以历史 full taskbook 为基础并继续有效。本版强调以下 Slice 归属：

```text
HA-01 determinism → S6
HA-02...11 base/F/E/A/B → S1/S2, final proof S6
HA-12...15 Decision/Action/Outcome → S3, final proof S6
HA-16 authority immutability → every Slice
HA-17 Residual due map → S5, final proof S6
HA-18 Candidate/Shadow non-consumption → S5/S6
HA-19 restart/recovery → S6
HA-20 late correction → S4/S6
HA-21 no Recommendation/AO-ACT/Dispatch → every Slice
HA-22 fault/response-loss/concurrency → S6
HA-23 full trace → S6
HA-24 Operator zero-write → S6
```

不得把单 Slice acceptance 直接提升为 Stage 1A closure evidence。

---

# 16. Delivery graph and exit gates

## 16.1 Effective

```text
S0 = EFFECTIVE
S1 = EFFECTIVE
S2 = EFFECTIVE
```

## 16.2 S3 exit gate

```text
trusted S3 seed/rule = PASS
S2 predecessor readback = PASS
Decision/Approval/Plan/Receipt/Feedback/Outcome = exact
T08/T09/T10 timing = PASS
S3-N01...N22 = PASS
pointer matrix = PASS
phase contract unchanged = PASS
Recommendation/AO-ACT/Dispatch = 0
Residual/Calibration/Shadow/Activation = 0
candidate/merge tree delta = 0
exact-SHA R1 readback = PASS
S4 seed/rule = present
```

## 16.3 S4 exit gate

```text
late correction vectors = PASS
historical rewrite = 0
FVO-01 correction = 1
FVO-16 ordinary assimilation = 0
phase contract unchanged = PASS
S5 seed/rule = present
```

## 16.4 S5 exit gate

```text
24/16/8/1/1/0 cardinality = PASS
candidate non-consumption = PASS
phase contract unchanged = PASS
S6 seed/rule = present
```

## 16.5 S6 exit gate

```text
two complete fresh runs = PASS
restart/fault/response-loss/concurrency = PASS
extreme pointer rebuild = PASS
24 HA = PASS
read model/operator = PASS
zero-write reads = PASS
three digest equalities = PASS
candidate/merge tree equality = PASS
exact merge-SHA R2 readback = PASS
CAP-09 rule/seed = absent
```

---

# 17. CI and delivery discipline

```text
one exact candidate tree
fresh database per Slice acceptance
no CI source transport
no proof-only carrier PR
no postmerge SSOT writeback
candidate head change invalidates focused evidence
candidate-to-merge tree delta must be 0
```

S3 focused workflow：

```text
mcft-cap-08-s3-decision-action-feedback
```

必须覆盖：

```text
server typecheck/build
exact boundary
phase contract conformance
fresh PostgreSQL bootstrap
S2 predecessor replay
G/H positive proof
T08/T09/T10 proof
S3-N01...N22
pointer matrix
completed rerun zero delta
candidate artifact finalizer
```

S3 exact-SHA：

```text
mcft-cap-08-s3-exact-sha-attestation
mcft-cap-08/s3-exact-sha-attestation
```

S3/S4/S5 Slice artifact retention = R1；S6 final closure = R2。

禁止：

```text
same-PR Registry self-authorization
owner comment substituted for proof
workflow string scanning substituted for DB acceptance
partial negative matrix reported complete
missing pointer silently repaired
slice acceptance promoted to closure evidence
S3 claiming late/Residual/Recovery complete
```

---

# 18. Local acceptance

S3 Windows PowerShell flow：

```text
checkout exact head
verify clean tree/manifest
create fresh PostgreSQL database
run production bootstrap order
provision/verify bounded runner
verify S2 artifact/readback
run S3 boundary/contracts
replay S2 base chain
run G/H positive proof
run T08/T09/T10 semantics
run S3-N01...N22
run pointer matrix
run completed replay zero delta
finalize candidate artifact
```

S4/S5：fresh DB、slice run_id、slice lineage/revision、`slice_acceptance_only=true`、`final_formal_run_id=null`、phase digest unchanged。

S6：two fresh DBs、same formal_run_id、different run_instance_id、full chain、all recovery/pointer cases、read model/operator、digest equality。

Cleanup 只允许 disposable DB/volume；不得对 append-only formal facts 做 surgical DELETE。

---

# 19. Current Freeze Gate

## 19.1 Foundation

```text
S0 authority = PASS
bounded writer bootstrap = PASS
run contract/due map = PASS
late vectors = PASS
phase contract = PASS
Progress Resolver contracts = PASS
exact-SHA transport = PASS
```

## 19.2 Implemented Slice

```text
S1 exact-SHA/readback = PASS
S2 exact-SHA/readback = PASS
next slice = S3
```

## 19.3 S3 Entry

| Gate | State |
|---|---|
| S2 subject/readback | PASS |
| v0.3.9 taskbook | PENDING_PROTECTED_MERGE |
| S3 status seed on main | ABSENT |
| S3 Registry rule on main | ABSENT |
| S3 object/timeline design | FROZEN HERE |
| S3 negative matrix | FROZEN HERE |
| S3 pointer matrix | FROZEN HERE |
| S3 implementation authority | false |

```text
ready to merge taskbook restoration PR = yes
ready to create S3 pre-candidate governance after merge = yes
ready to open S3 implementation candidate now = no
ready to modify S3 Runtime source now = no
```

---

# 20. Completion declaration

仅 S6 exact merge-SHA R2 PASS 后：

```text
MCFT-CAP-08 = COMPLETE
completion_level = STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE
formal bootstrap root = PASS
successful ticks/forecasts/scenarios = 24/24/24
FVO/Residual = 24/24
Calibration/Holdout = 16/8
Decision/Execution/Outcome episode = PASS
restart = PASS
late append-forward = PASS
Candidate/Shadow = PASS/PASS
Candidate consumed = false
Model Activation = false
CAP-07 readback = PASS
Operator full-chain Timeline = PASS
product read write delta = 0
MCFT-CAP-09 authorized = false
```

---

# 21. Completion nonclaims

```text
NO_720_TICK_LONG_HORIZON_QUALIFICATION
NO_EXTENDED_FIVE_SCENARIO_QUALIFICATION
NO_HISTORICAL_REVISION_REPROCESSING
NO_LIVE_SENSOR_RUNTIME
NO_SHADOW_ONLINE
NO_BACKGROUND_SCHEDULER
NO_AUTOMATIC_RECOMMENDATION
NO_AUTOMATIC_APPROVAL
NO_AO_ACT
NO_DISPATCH
NO_DEVICE_CONTROL
NO_MODEL_ACTIVATION
NO_CAUSAL_ACTION_EFFECT_PROOF
NO_ROI_PROOF
NO_FIELD_MEMORY_LEARNING
NO_MULTI_FIELD_SCALE
NO_PRODUCTIZATION_COMPLETE
NO_MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE
NO_MCFT_CAP_09_AUTHORITY
NO_DATABASE_ROW_LEVEL_SCOPE_ISOLATION
```

---

# 22. 当前裁决

```text
THREE_WAY_ALIGNMENT:
S0_S1_S2_ALIGNED

TASKBOOK_FULL_BASE:
V0_3_5_ARCHIVED_AND_INCORPORATED

V0_3_8_COMPACT_STATUS:
HISTORICAL_S0_TRANSPORT_RECORD_ONLY

CURRENT_MAIN:
1f37d6247a5f2e90327720c9feed4faf729d1db3

S1_EFFECTIVE:
TRUE

S2_EFFECTIVE:
TRUE

S2_INDEPENDENT_REVIEW:
WAIVED_NOT_SATISFIED

S3_DESIGN:
FROZEN

S3_STATUS_SEED:
ABSENT

S3_REGISTRY_RULE:
ABSENT

S3_IMPLEMENTATION_AUTHORIZED:
FALSE

S3_FIRST_LEGAL_ACTION:
PRE_CANDIDATE_GOVERNANCE_SEED_AND_REGISTRY_RULE

S3_NEGATIVE_EVIDENCE_MATRIX:
FROZEN_S3_N01_TO_S3_N22

S3_POINTER_MATRIX:
FROZEN

EXTREME_POINTER_REBUILD:
DEFERRED_TO_S6

PRODUCTION_RUNTIME_SOURCE_AUTHORIZED:
FALSE

MODEL_ACTIVATION_AUTHORIZED:
FALSE

MCFT_CAP_09_AUTHORIZED:
FALSE

MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE:
FALSE
```

本任务书修订 PR 只允许：

```text
archive full v0.3.5 baseline
restore current full taskbook
record S1/S2 evidence
freeze S3 design
correct Slice numbering and facts
```

禁止：

```text
create s3_candidate_implemented=true
modify Runtime source
write canonical Runtime data
change ACL
claim S3 effective
claim S4 authorized
```

本文件 protected merge 后，下一合法动作是 S3 non-candidate seed + Registry rule governance；该治理 merge 后才允许 S3 implementation candidate。

---

# 23. v0.3.9 Revision Summary

```text
1. 恢复 v0.3.5 作为完整架构基础，并归档其 full Git Blob；
2. 废止 v0.3.8 作为后续 Slice 充分设计的地位；
3. 按 exact-SHA 事实记录 S1/S2 effective；
4. 修正 Slice 编号与 S6 Read Model 合并；
5. 冻结 S3 G/H contracts、T05-T10 timeline、Outcome=FVO-10 identity；
6. 新增 S3-N01...S3-N22 负向 Evidence matrix；
7. 新增 S3 pointer integrity matrix；
8. 将 extreme pointer rebuild 和 full recovery 留给 S6；
9. 明确 S3 seed/rule absent，直接编码未授权；
10. 继续禁止 production source、HTTP writer、scheduler、live ingestion、Activation 与 CAP-09。
```

```text
READY_TO_MERGE_FULL_TASKBOOK_RESTORATION_PR = YES
READY_TO_CREATE_S3_PRE_CANDIDATE_GOVERNANCE_PR_AFTER_MERGE = YES
READY_TO_OPEN_S3_IMPLEMENTATION_CANDIDATE = NO_PENDING_TRUSTED_SEED_AND_REGISTRY_RULE
S3_RUNTIME_SOURCE_CHANGE_AUTHORIZED = FALSE
```
