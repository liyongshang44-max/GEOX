# GEOX MCFT-CAP-08 — 24-Tick End-to-End Closure

## 完整任务线 v0.4.0 — SINGLE-DOCUMENT SSOT / S2 EFFECTIVE / S3 DESIGN FROZEN

```text
document_id:
GEOX-MCFT-CAP-08-TASK-V0.4.0-SINGLE-DOCUMENT-SSOT-S2-EFFECTIVE-S3-DESIGN-FROZEN

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
FULL_V0_3_5_BODY_EMBEDDED_AND_REALIGNED_TO_MAIN

base_full_taskbook_embedded:
true

base_full_taskbook_blob:
ab4f4e7d9d3978ac3be979583cda4ccdc94a2fb6

single_document_consolidation_base:
e8dc01b72def45c9931d70dab06f78dbc2b5a527

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

> 本文件以 v0.3.5 完整任务书为架构基础；其 4,820 行原始正文已完整内嵌于本文件附录 A，不再依赖相邻历史文件。  
> 附录 A 保留数学、对象、事务、Hard Acceptance 与 nonclaim 的原始审计文本；其中旧 repository baseline、PR-0/PR-1 pending、Freeze Gate 1/17、旧 Slice 编号和旧授权陈述均属于历史记录，不得覆盖正文的当前裁决。  
> 本 v0.4.0 是唯一主任务书 SSOT：正文按 merged-main 与 exact-SHA 事实记录 S1/S2，并冻结现行 S3 Decision + Action Feedback 的实施与验收设计。  
> v0.3.8 Compact 只作为历史 S0 transport 事实被正文说明，不再单独承担任何后续 Slice 设计 authority。

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

v0.4.0 current taskbook:
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
this v0.4.0 taskbook
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

# 23. v0.4.0 Revision Summary

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

---

# 附录 A — v0.3.5 完整架构基线（内嵌历史审计文本）

> **Authority classification:** `HISTORICAL_ARCHITECTURE_SOURCE_EMBEDDED_NOT_CURRENT_REPOSITORY_STATUS`  
> **Original Git Blob:** `ab4f4e7d9d3978ac3be979583cda4ccdc94a2fb6`  
> 本附录按原始正文完整内嵌，用于保留详细数学、对象、事务、验收和 nonclaim 设计。凡与本文件正文在 repository SHA、Freeze Gate、PR 状态、Slice 编号、授权状态或 effectiveness 上冲突，以正文和机器契约为准。

<details>
<summary>展开 v0.3.5 完整原始正文</summary>

# GEOX MCFT-CAP-08 — 24-Tick End-to-End Closure

> **PR-1 materialization record**  
> `design_review_repository_baseline = 82c99e84e0813142ff15dccf852876033d853730`  
> `pr_0_protected_merge_sha = ade35875ff6f5ef92ec76f04ab9fc302c57f700e`  
> `pr_1_base_sha = ade35875ff6f5ef92ec76f04ab9fc302c57f700e`  
> `candidate_slice_id = MCFT-CAP-08.S0`  
> Repository state in this file remains conditional until protected merge plus exact-SHA attestation; Runtime implementation remains unauthorized.


## 完整任务线 v0.3.5 — REGISTRY-BOOTSTRAPPED PR-1 AUTHORIZED BOUNDARY CANDIDATE

```text
document_id:
GEOX-MCFT-CAP-08-TASK-V0.3.5-REGISTRY-BOOTSTRAPPED-PR-1-AUTHORIZED-BOUNDARY-CANDIDATE

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
PR_1_AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE

design_status:
FROZEN_AUTHORITY_RECONCILIATION_CANDIDATE

taskbook_core_redesign_status:
PASS

governance_pr_0_readiness:
PASS

governance_pr_1_readiness:
AUTHORIZED_BY_PR_0_PROTECTED_MERGE

freeze_gate_effective_completion:
1_OF_17

runtime_implementation_prerequisites:
INCOMPLETE

pr_1_scope_coherence:
PASS

pr_1_changed_file_boundary_model:
FROZEN

taskbook_internal_consistency:
PASS

p0_freeze_blockers:
0

p1_freeze_obligations:
FROZEN_PENDING_PR_1_REPOSITORY_PROOF

candidate_registry_transition_schema:
DELIVERY_CANDIDATE_SIGNAL_ONLY_OBJECT_REGISTRATION_FROZEN

late_transport_operator:
FULL_POSTERIOR_TO_POSTERIOR_SENSITIVITY_FROZEN

fvo_residual_due_obligation_map:
FROZEN

candidate_merge_tree_equivalence_model:
FROZEN

schema_structure_and_privilege_digest_split:
FROZEN

late_correction_shared_test_vectors:
REQUIRED

slice_acceptance_database_model:
FRESH_DISPOSABLE_POSTGRESQL_DATABASE_ONLY

phase_orchestration_skeleton:
FROZEN_FOR_PR_2_IMPLEMENTATION

phase_engine_stability_proof:
CONTRACT_DIGEST_GATING_PLUS_SOURCE_DIGEST_AUDIT

registry_bootstrap_model:
PR_0_P_1B_REQUIRED

per_slice_candidate_authority_graph:
PR_1_THROUGH_PR_7_SUCCESSOR_PRE_REGISTRATION_FROZEN

pr_1_semantic_snapshot_set:
EXACT_20_FILES_FROZEN

external_effectiveness_projection_model:
FROZEN

slice_acceptance_run_isolation:
FROZEN

final_formal_run_authority:
PR_7_ONLY

writer_scope_enforcement_model:
APPLICATION_VALIDATION_PLUS_REPOSITORY_CAS

database_row_level_scope_isolation:
NOT_ESTABLISHED

authority_reconciliation_strategy:
OPTION_B_WITH_PRECEDING_PR_0_REGISTRY_BOOTSTRAP

platform_security_bootstrap_strategy:
PR_1_EXTERNAL_ADMIN_ONE_SHOT_BOOTSTRAP_AFTER_PR_0_EFFECTIVE

implementation_status:
NOT_AUTHORIZED

design_review_repository_baseline:
82c99e84e0813142ff15dccf852876033d853730

pr_0_protected_merge_sha:
ade35875ff6f5ef92ec76f04ab9fc302c57f700e

pr_1_base_sha:
ade35875ff6f5ef92ec76f04ab9fc302c57f700e

predecessor_closure_subject_sha:
81579b7f67a3dcd3cf557abbf29c9462d8b7736b

predecessor_closure_attestation_run:
29836198341

predecessor_closure_artifact_id:
8497395139

post_closure_productization_pr:
2619

post_closure_productization_merge:
82c99e84e0813142ff15dccf852876033d853730

runtime_source_authorized:
false

bounded_replay_runner_authorized:
false

bounded_canonical_transaction_authorized:
false

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

> 本文件取代 `GEOX-MCFT-CAP-08-TASK-v0.3.4-PR-1-AUTHORIZED-BOUNDARY-CANDIDATE.md`。  
> v0.3.4 及更早版本不得作为 implementation authority、candidate declaration、changed-file boundary、completion oracle 或 closure evidence 使用。  
> 本文件冻结一个先于 PR-1 的 `PR-0 / P-1B Candidate Registry Bootstrap`。PR-0 protected merge 后的 trusted Candidate Registry 已注册 CAP-08 S0 Current Authority transition；由于 `pr_modified_registry_trusted_for_same_pr = false`，PR-1 不得在同一个 PR 中修改 Registry 并依赖该修改为自身 candidate transition 授权。  
> 本文件允许创建并打开 PR-0；PR-0 已以 merge SHA `ade35875ff6f5ef92ec76f04ab9fc302c57f700e` protected merge；authoritative PR-1 现已允许创建。PR-0 只预注册 PR-1 的唯一显式 delivery candidate signal，不创建 CAP-08 Current Authority，不产生 candidate declaration，不修改 Runtime、数据库角色或业务 schema。  
> PR-1 在 PR-0 生效后才允许执行 authority reconciliation、S0 machine-readable freeze、exact-SHA transport、共享数学 test vectors、S1 successor status seed/Registry rule，以及由外部管理员凭据执行的一次性 platform-security role bootstrap；它不得实现或运行 CAP-08 B00、T00–T23、G00–G02、persisted late correction、Residual、Calibration、Shadow 或产品写能力。  
> PR-2～PR-6 只能使用各自全新 disposable PostgreSQL database 的 slice-acceptance run；唯一可形成 MCFT-CAP-08 closure evidence 的 formal run 必须由 PR-7 在两个独立 fresh PostgreSQL database 中从 B00 开始完整执行。  
> PR-1 与 PR-7 的外部生效均要求 candidate tree 与最终 merge tree 完全等价；tree delta 非零时，candidate evidence 不得投影到 merge SHA。  
> 在 PR-0 protected merge、PR-1 protected merge、PR-1 exact merge-SHA attestation PASS 和 immutable artifact readback 生效前，MCFT-CAP-08 继续保持 `NOT_AUTHORIZED`。

---

# 0. 本版修订的决定性裁决

v0.3.0 的主要问题不是 Runtime 机制方向错误，而是它直接把上传总任务书中的新标准当成已经生效的 repository authority，忽略了当前仓库仍保留的旧 Master 标准：

```text
旧 repository Master:
30 天 / 720 Tick
五情景
late Evidence 创建新 revision

新项目总任务书 / MCFT-CAP-08 方向:
24 Tick
三情景
append-forward late Evidence
```

本版不再容忍两套正式完成定义并存。

## 0.1 选择的 authority reconciliation 方案

本版选择：

```text
方案 B

24-Tick / 三情景 / append-forward
成为新的 Stage 1A closure authority

但必须先通过治理 PR 正式修改：
- repository Master
- Stage-1 closure authority
- DT-02 Implementation Map
- Vertical Capability Matrix
- CAP-04 successor boundary note
- Candidate Authority Registry
- MCFT-CAP-08 taskbook and resolved manifest
```

在该治理 PR 的 merged-main exact-SHA proof 通过前：

```text
MCFT-CAP-08 design frozen:
false

MCFT-CAP-08 implementation authorized:
false

MCFT-CAP-08 Stage 1A completion claim:
forbidden
```

## 0.2 旧要求如何处理

旧要求不得静默删除，而是正式重分类：

```text
720 continuous hourly ticks
→ LONG_HORIZON_REPLAY_STABILITY_QUALIFICATION
→ 不再是 MCFT-CAP-08 Stage 1A closure 前置

五情景：
0 / 10 / 20 / 30 / delay
→ EXTENDED_IRRIGATION_SCENARIO_QUALIFICATION
→ 不再是 MCFT-CAP-08 Stage 1A closure 前置

late Evidence new revision
→ HISTORICAL_REVISION_REPROCESSING_QUALIFICATION
→ 不再是 MCFT-CAP-08 Stage 1A closure 前置
```

这些能力在 MCFT-CAP-08 完成后仍保持：

```text
NOT_ESTABLISHED
```

后续必须通过独立 taskbook 或 production-hardening authority 决定归属。

## 0.3 新 Stage 1A 精确含义

Authority Reconciliation 生效后，Stage 1A 定义为：

```text
one governed field / season / zone
one formal Replay lineage and revision
one complete bootstrap Runtime root
24 continuous successful committed hourly Tick
24 successful 72-hour Forecast
24 three-option Scenario Set
one replayed historical Decision/Execution/Outcome episode
24 Forecast Verification Observations
24 canonical Forecast Residual
16 Calibration cases
8 Holdout cases
one Calibration Candidate
one Shadow Evaluation
zero Model Activation
fresh-process restart and recovery
late Evidence append-forward correction
complete Read Model / Timeline / Trace / Operator readback
```

Stage 1A 允许声明：

```text
STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE
```

仍禁止声明：

```text
Replay-backed Minimum Field Twin validated
Minimum Complete Field Twin complete
Shadow-online complete
Controlled-action feedback complete
Production Twin complete
```

## 0.4 当前实际 Freeze Gate 状态

截至 repository main：

```text
82c99e84e0813142ff15dccf852876033d853730
```

实际状态为：

| Freeze Gate | 当前状态 |
|---|---|
| 1. Master 更新 | FAIL |
| 2. Stage-1 Closure Authority V2 | FAIL |
| 3. 旧 720/five-scenario/revision 重分类 | FAIL |
| 4. Matrix 同步 | FAIL |
| 5. Implementation Map 同步 | FAIL |
| 6. CAP-04 successor reconciliation | FAIL |
| 7. Registry 预登记 CAP-08 | FAIL |
| 8. CAP-07 R2 artifact 可读 | PASS |
| 9. B00 machine-readable freeze | FAIL |
| 10. FVO mapping machine-readable freeze | FAIL |
| 11. Late math qualification | FAIL |
| 12. Micro-sequence machine-readable freeze | FAIL |
| 13. Progress resolver canonical predicates | FAIL |
| 14. Digest policy machine-readable freeze | FAIL |
| 15. Bounded writer role provisioned and verified | FAIL |
| 16. Exact changed-file manifest | FAIL |
| 17. PR-1 exact-SHA effectiveness | FAIL |

因此：

```text
effective Freeze Gate completion:
1 / 17

taskbook frozen:
false

PR-0 / P-1B Registry Bootstrap:
permitted

Authoritative PR-1:
blocked until PR-0 protected merge

PR-2 / S1 Runtime implementation:
forbidden
```

---

## 0.5 v0.3.5 新增的冻结裁决

本版保留 v0.3.4 已通过的 Runtime 设计，只定点修复 Delivery Policy 下的首次候选自举和逐 Slice candidate authority graph：

```text
Registry bootstrap:
PR-0 / P-1B must merge before PR-1
same-PR modified Registry is not trusted
PR-0 has no Candidate Declaration and creates no CAP-08 status file

Registry transition scope:
Candidate Registry registers only explicit delivery candidate signals
non-candidate authority fields remain validated by schema, focused acceptance,
semantic snapshot, finalizer, exact-SHA attestation and authority consistency Gate

Per-Slice candidate graph:
PR-1 seeds/registers S1 for PR-2
PR-2 seeds/registers S2 for PR-3
PR-3 seeds/registers S3 for PR-4
PR-4 seeds/registers S4 for PR-5
PR-5 seeds/registers S5 for PR-6
PR-6 seeds/registers S6 for PR-7
PR-7 registers no MCFT-CAP-09 authority

T09/T10 time semantics:
T09 outcome interval underway; FVO-10 not observed and not available
T10 observed_at = T10; Outcome Observation identity = FVO-10

PR-1 semantic snapshot:
exactly 20 authoritative files frozen for Candidate Declaration
status file included; all remaining changed files covered by changed-file manifest
and focused acceptance

phase-engine stability:
phase_engine_contract_digest is the semantic gate
phase_engine_source_digest is audit evidence, not the sole stability predicate
```

此前已冻结且保持不变：

```text
full posterior-to-posterior late transport
24 FVO / 24 Residual due-obligation map
T16 R-01 + R-16
candidate/merge tree equivalence
business schema structure versus privilege-graph digest separation
shared late-correction test vectors
fresh-database slice acceptance
PR-7-only final formal closure runs
```

因此，本版允许立即进入 PR-0 / P-1B Registry Bootstrap；authoritative PR-1 仍须等待 PR-0 protected merge 后才能打开，PR-2/S1 继续禁止。

# 1. Authority 模型与 SSOT 统一

## 1.1 Authority 按职责分层

本项目不再把所有文件硬排成一条模糊优先级，而是按职责明确 authority：

### A. 架构与完成语义 authority

```text
GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md
+
GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2.md/json
+
本 MCFT-CAP-08 taskbook digest 及其 externally effective frozen projection
```

决定：

- Stage 1A、1B、1C 的完成定义；
- 24 Tick / 三情景 / append-forward 的边界；
- MCFT-CAP-08、09、10 的顺序与 nonclaims。

### B. 当前交付授权 authority

```text
MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json
+
capability-specific CURRENT-AUTHORITY / RESOLVED-MANIFEST
```

决定：

- 当前是否可修改 Runtime source；
- 当前 active Slice；
- exact candidate transition；
- successor 是否获授权。

### C. 已完成能力证据 authority

```text
protected merge commit
+
exact merge-SHA status
+
immutable R2 artifact
+
authorized-store readback
```

决定：

- predecessor 是否 externally effective；
- closure 是否真实成立；
- successor 是否可消费。

### D. 同步目录与导航 SSOT

```text
GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
```

它们必须与 A/B/C 同步，不能继续作为陈旧但标记 `COMPLETE` 的第二套答案。

## 1.2 Authority drift Gate

Authority Reconciliation 后，新增全仓 Gate：

```text
MCFT_AUTHORITY_CONSISTENCY_V1
```

必须验证：

```text
Master Stage 1 definition
= Stage-1 Closure Authority V2
= CAP-08 taskbook completion boundary

Candidate Registry frontier
= capability resolved manifest frontier

Matrix capability statuses
= externally effective capability evidence

Implementation Map latest frontier
= current main and Registry

CAP-04 successor boundary note
= current Stage 1A definition
```

任一不一致：

```text
candidate declaration:
REJECTED

Runtime implementation:
BLOCKED
```

---

# 2. Registry Bootstrap 与 Authority Reconciliation Sequence

## 2.1 第一合法动作 — PR-0 / P-1B Candidate Registry Bootstrap

当前 trusted main Registry 只登记 MCFT-CAP-06 与 MCFT-CAP-07。Delivery Policy 冻结：

```text
candidate_integrity_registry_source:
PR target branch / trusted default branch

pr_modified_registry_trusted_for_same_pr:
false

unregistered capability/status/field/value:
CANDIDATE_INVALIDATED
```

因此，PR-1 不能在同一个 PR 中新增 CAP-08 Registry entry、创建 Current Authority 并依赖该 entry 为自身授权。第一合法动作必须是一个独立普通 PR：

```text
PR-0 / P-1B:
MCFT-CAP-08 Candidate Registry Bootstrap

changed file:
docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json

creates CAP-08 Current Authority:
false

creates any cap_08 status JSON:
false

Candidate Declaration:
absent

Runtime source delta:
0

business schema / ACL / database role delta:
0

canonical Runtime data delta:
0
```

PR-0 只在 Registry 中预注册 PR-1 将来会产生的唯一显式 delivery candidate signal：

```text
status_file:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-AUTHORITY-V1.json

field_path:
status

allowed_candidate_value:
AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE

focused_workflow:
mcft-cap-08-authority-reconciliation

standard_workflow:
ci

predecessor_effective_evidence_required:
true
```

PR-0 不产生 candidate signal，因此走普通 protected release lane。PR-0 merge 后，Registry entry 必须存在于 main，随后 PR-1 才能合法创建 Current Authority 并声明 candidate。

## 2.2 PR-0 exact changed-file boundary 与 exit gate

PR-0 exact changed-file boundary 默认只能包含：

```text
docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json
```

若现有 Delivery Policy acceptance 需要同步更新通用 schema/fixture 才能识别 CAP-08 entry，则必须先记录 Architecture Deviation，并把所有额外文件加入 PR-0 exact boundary；不得借机加入 CAP-08 taskbook、Current Authority、Runtime source、workflow、database bootstrap 或其他 S0 文件。

PR-0 exit gate：

```text
standard CI:
PASS

candidate declaration detected:
false

CAP-08 Registry entry on merged main:
true

Current Authority file on merged main:
false

PR-1 status transition registered by trusted base Registry:
true
```

PR-0 不建立 MCFT-CAP-08 implementation authority，也不改变 `implementation_status = NOT_AUTHORIZED`。

## 2.3 PR-1 Authority Reconciliation scope

PR-0 protected merge 后，下一合法动作才是 authority-and-platform-security authoritative PR：

```text
PR-1:
MCFT-CAP-08 Authority Reconciliation,
Predecessor Consumption,
S0 Machine-Readable Freeze,
S1 Successor Candidate Seed,
Exact-SHA Transport,
and Platform Security Bootstrap

contains logical stages:
AR-0 + P-1 + S0 + SG-1 + PS-0 + AT-0

trusted Registry prerequisite:
PR-0 entry present on target main

Runtime domain code delta:
0

business schema migration delta:
0

canonical Runtime data delta:
0

route/frontend product delta:
0

CAP-08 B00/T00-T23/G00-G02 execution:
0

platform role DDL:
ALLOWED_EXACTLY_FOR_geox_mcft_cap08_runner_v1

administrative credential source:
EXTERNAL_ONLY

Runtime credential fallback:
FORBIDDEN
```

PR-1 不再被称为“纯 governance-only”，因为它允许一个独立的一次性数据库角色 bootstrap，并建立 CAP-08 专用 exact-SHA attestation transport。该 bootstrap 属于 platform security，不属于 Runtime implementation；不得创建业务表、索引、业务函数、触发器、canonical facts、projection rows 或 Runtime checkpoint。

PR-1 还必须创建 `GEOX-MCFT-CAP-08-S1-DELIVERY-STATUS-V1.json` 的非候选 seed，并在 Registry 中预注册 PR-2/S1 的 candidate signal。PR-1 对 Registry 的该修改只供后继 PR-2 使用，不得被 PR-1 自身 candidate integrity 消费。

## 2.4 PR-1 exact changed-file boundary 类别

PR-1 的最终 exact changed-file set 必须由：

```text
GEOX-MCFT-CAP-08-CHANGED-FILE-BOUNDARY-V1.json
```

以排序后的完整路径集合冻结。最低必须覆盖以下类别。

### A. Repository authority 与同步 SSOT

```text
docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md

docs/digital_twin/mcft/
GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2.md
GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2.json

docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md

docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json

docs/digital_twin/mcft/
MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json
```

### B. CAP-04 非变异 successor reconciliation

```text
docs/digital_twin/mcft/cap_04/
GEOX-MCFT-CAP-04-SUCCESSOR-BOUNDARY-RECONCILIATION-V1.md
GEOX-MCFT-CAP-04-SUCCESSOR-BOUNDARY-RECONCILIATION-V1.json

CAP-04 historical taskbook:
GEOX-MCFT-CAP-04-TASK.md
must remain byte-unchanged
```

### C. CAP-08 authority、S0 与 candidate frontier

```text
docs/digital_twin/mcft/cap_08/
GEOX-MCFT-CAP-08-TASK.md
GEOX-MCFT-CAP-08-RESOLVED-MANIFEST-V1.json
GEOX-MCFT-CAP-08-CURRENT-AUTHORITY-V1.json
GEOX-MCFT-CAP-08-S1-DELIVERY-STATUS-V1.json
GEOX-MCFT-CAP-08-PREDECESSOR-CONSUMPTION-V1.json
GEOX-MCFT-CAP-08-REUSE-ADJUDICATION-V1.json
GEOX-MCFT-CAP-08-PROGRESS-RECOVERY-ADJUDICATION-V1.json
GEOX-MCFT-CAP-08-REALITY-SCOPE-V1.json
GEOX-MCFT-CAP-08-REPLAY-DATASET-MANIFEST-V1.json
GEOX-MCFT-CAP-08-24-TICK-RUN-CONTRACT-V1.json
GEOX-MCFT-CAP-08-LATE-CORRECTION-MATH-V1.json
GEOX-MCFT-CAP-08-LATE-CORRECTION-TEST-VECTORS-V1.json
GEOX-MCFT-CAP-08-TRANSACTION-MICRO-SEQUENCE-V1.json
GEOX-MCFT-CAP-08-PHASE-ORCHESTRATION-CONTRACT-V1.json
GEOX-MCFT-CAP-08-RESIDUAL-WINDOW-ORACLE-V1.json
GEOX-MCFT-CAP-08-DETERMINISM-DIGEST-POLICY-V1.json
GEOX-MCFT-CAP-08-WRITER-AUTHORITY-V1.json
GEOX-MCFT-CAP-08-HARD-ACCEPTANCE-LEDGER-V1.json
GEOX-MCFT-CAP-08-CHANGED-FILE-BOUNDARY-V1.json
GEOX-MCFT-CAP-08-WORKFLOW-DECLARATION-V1.json
GEOX-MCFT-CAP-08-PR1-EFFECTIVENESS-CONTRACT-V1.json
GEOX-MCFT-CAP-08-CANDIDATE-MERGE-TREE-EQUIVALENCE-V1.json
GEOX-MCFT-CAP-08-SCHEMA-PRIVILEGE-DIGEST-POLICY-V1.json
GEOX-MCFT-CAP-08-RUN-CLASSIFICATION-V1.json
```

### D. Platform security bootstrap

```text
apps/server/src/infra/
mcft_cap08_database_platform_bootstrap_v1.ts

scripts/runtime_acceptance/
ACCEPTANCE_MCFT_CAP_08_PLATFORM_SECURITY_BOOTSTRAP_DB.ts
ACCEPTANCE_MCFT_CAP_08_WRITER_PRIVILEGE_NEGATIVE_DB.ts
ACCEPTANCE_MCFT_CAP_08_LATE_CORRECTION_MATH.ts
ACCEPTANCE_MCFT_CAP_08_PROGRESS_PREDICATES_DB.ts
ACCEPTANCE_MCFT_CAP_08_ZERO_RUNTIME_DATA_DELTA_DB.ts
```

### E. Governance、preflight 与 exact-SHA transport

```text
package.json

.github/workflows/
mcft-cap-08-authority-reconciliation.yml
mcft-cap-08-exact-sha-attestation.yml

scripts/governance_acceptance/
ACCEPTANCE_MCFT_CAP_08_AUTHORITY_RECONCILIATION.cjs
ACCEPTANCE_MCFT_CAP_08_CHANGED_FILE_BOUNDARY.cjs
ACCEPTANCE_MCFT_CAP_08_CANDIDATE_MERGE_TREE_EQUIVALENCE.cjs
ACCEPTANCE_MCFT_CAP_08_EXACT_SHA_ATTESTATION.cjs
mcft_cap08_pr1_artifact_finalize.cjs
```

允许复用现有通用 retention store；若复用需要修改通用脚本，则该通用脚本也必须进入 exact changed-file set。禁止隐式依赖 CAP-07 专用 workflow，因为其 path trigger、artifact identity、status context 和 finalizer 均是 CAP-07 专用。

### 2.4.1 PR-1 Candidate Declaration semantic snapshot set

Delivery Policy Candidate Declaration 的 `semantic_snapshot_files` 与 `semantic_snapshot_blobs` 必须严格冻结为以下 20 个文件，顺序规范化后由 candidate head 计算 blob SHA。Current Authority status file 必须包含在集合中：

```text
01 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-AUTHORITY-V1.json
02 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md
03 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-RESOLVED-MANIFEST-V1.json
04 docs/digital_twin/mcft/GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2.json
05 docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md
06 docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-SUCCESSOR-BOUNDARY-RECONCILIATION-V1.json
07 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-REALITY-SCOPE-V1.json
08 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-REPLAY-DATASET-MANIFEST-V1.json
09 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-24-TICK-RUN-CONTRACT-V1.json
10 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-LATE-CORRECTION-MATH-V1.json
11 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-LATE-CORRECTION-TEST-VECTORS-V1.json
12 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TRANSACTION-MICRO-SEQUENCE-V1.json
13 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PHASE-ORCHESTRATION-CONTRACT-V1.json
14 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PROGRESS-RECOVERY-ADJUDICATION-V1.json
15 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-RESIDUAL-WINDOW-ORACLE-V1.json
16 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-DETERMINISM-DIGEST-POLICY-V1.json
17 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-WRITER-AUTHORITY-V1.json
18 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CHANGED-FILE-BOUNDARY-V1.json
19 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PR1-EFFECTIVENESS-CONTRACT-V1.json
20 docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-WORKFLOW-DECLARATION-V1.json
```

冻结规则：

```text
semantic_snapshot_file_count = 20
semantic_snapshot_blob_count = 20
status_file_included = true
file order = exact numbered order frozen above
blob SHA = exact candidate-head Git blob SHA
missing/extra/duplicate/path mismatch/blob mismatch = candidate invalidated
```

未进入这 20 个 semantic snapshot 的其他 PR-1 文件仍必须由 exact changed-file manifest、focused acceptance、authority consistency Gate、artifact finalizer 和 exact-SHA attestation覆盖。Semantic snapshot 不是 changed-file boundary 的替代品。

## 2.5 CAP-04 历史边界修正方式

冻结的 CAP-04 历史 Taskbook 不得原地修改。

CAP-04 历史事实保持：

```text
CAP-04 established:
72-hour Forecast
three-option Scenario Runtime

CAP-04 did not by itself establish:
end-to-end Replay closure
Residual/Calibration chain
Decision/Execution/Outcome chain
24-Tick final closure
```

PR-1 新增独立 successor reconciliation：

```text
GEOX-MCFT-CAP-04-SUCCESSOR-BOUNDARY-RECONCILIATION-V1.md/json
```

该文件只表达后继 authority 关系：

```text
CAP-04 historical taskbook:
byte-unchanged

CAP-04 historical completion:
unchanged

old five-scenario Gate A reference:
superseded only for successor closure semantics by
GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2

CAP-04 itself closes Stage 1A:
false
```

Master、Stage-1 Closure Authority V2、Matrix 和 Implementation Map 必须引用该 reconciliation 文件；不得通过向冻结 taskbook 追加 amendment 静默改变历史语义。

## 2.6 Conditional authority、Registry signal 与 successor graph

PR-1 merge commit 中的 Current Authority 不得伪装成已经有效。Repository 必须保存 conditional candidate state：

```text
record_status:
COMMITTED_CONDITIONAL_AUTHORITY

status:
AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE

implementation_authorized:
false

runtime_source_authorized:
false

bounded_replay_runner_authorized:
false

bounded_canonical_transaction_authorized:
false

effectiveness_condition:
PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS

effective_status_when_attested:
IN_PROGRESS

effective_next_slice_when_attested:
S1

bounded_replay_runner_authorized_when_attested:
true

bounded_canonical_transaction_authorized_when_attested:
true

production_runtime_source_authorized_when_attested:
false

postmerge_ssot_writeback_allowed:
false
```

### 2.6.1 PR-0 trusted Registry entry

PR-0 必须把以下 entry 合入 main。Candidate Registry 只登记“哪个字段值表示 delivery candidate transition”，不是通用 authority schema validator：

```json
{
  "capability_line": "MCFT-CAP-08",
  "registry_bootstrap_kind": "P_1B_PRE_REGISTER_PR1_CURRENT_AUTHORITY_CANDIDATE",
  "current_candidate_authority": false,
  "candidate_declaration_enabled": true,
  "candidate_authority_scope": "PR1_CURRENT_AUTHORITY_ONLY_UNTIL_SUCCESSOR_RULES_MERGE",
  "authoritative_candidate_status_paths": [
    "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-AUTHORITY-V1.json"
  ],
  "candidate_transition_fields": [
    {
      "status_file": "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-AUTHORITY-V1.json",
      "field_path": "status",
      "allowed_candidate_values": ["AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE"],
      "focused_workflow": "mcft-cap-08-authority-reconciliation",
      "standard_workflow": "ci",
      "predecessor_effective_evidence_required": true
    }
  ],
  "terminal_state": "S6_FINAL_CLOSURE_CANDIDATE_PENDING_EXACT_MERGE_SHA_ATTESTATION",
  "successor_capability_authorized": false,
  "implementation_authorized": false,
  "runtime_source_authorized": false,
  "canonical_write_authorized": false,
  "mcft_cap_09_authorized": false
}
```

不得进入 Registry candidate transition rule 的 Current Authority fields 包括但不限于：

```text
record_status
implementation_authorized
runtime_source_authorized
bounded_replay_runner_authorized
bounded_canonical_transaction_authorized
effectiveness_condition
effective_status_when_attested
effective_next_slice_when_attested
bounded_replay_runner_authorized_when_attested
bounded_canonical_transaction_authorized_when_attested
production_runtime_source_authorized_when_attested
postmerge_ssot_writeback_allowed
taskbook_digest
resolved_manifest_digest
changed_file_boundary_digest
writer_authority_digest
```

这些字段继续由：

```text
JSON schema
S0 focused acceptance
semantic snapshot
changed-file manifest
artifact finalizer
exact-SHA attestation
authority consistency Gate
```

进行完整校验。未登记的“候选信号”仍 fail closed；未登记的普通 authority 字段不应被误判成独立 delivery transition。

### 2.6.2 S1–S6 successor status seed contract

每个实现 PR 必须预先为后继 PR 创建一个非候选 status seed，并把后继唯一 candidate signal 注册到 Registry。当前 PR 修改后的 Registry 不为当前 PR 自授权，只在 protected merge 后供下一 PR 使用。

统一 seed 最低字段：

```text
schema_version
capability_line_id = MCFT-CAP-08
slice_id
record_status = PRE_REGISTERED_SUCCESSOR_STATUS_SEED
candidate_field
candidate_value = false
implementation_authorized = false
effectiveness_condition
candidate_effective_status_when_attested
candidate_effective_next_slice_when_attested
predecessor_effective_evidence_requirement
predecessor_semantic_artifact_digest
runtime_authority_delta
canonical_write_authority_delta
production_runtime_source_authorized = false
postmerge_ssot_writeback_allowed = false
```

候选实现 PR 只能把其预登记的 `sN_candidate_implemented` 从 `false` 改为 `true`，并补齐 exact candidate artifact/digest 字段；不得在同一 PR 中发明新的当前候选 field/value。

### 2.6.2.1 Exact successor seed semantics

| Seed file | candidate_field | effective_status_when_attested | effective_next_slice_when_attested | runtime_authority_delta | canonical_write_authority_delta |
|---|---|---|---|---|---|
| S1 | `s1_candidate_implemented` | `S1_BASE_RUNTIME_IMPLEMENTED_EFFECTIVE` | `S2` | `BASE_REPLAY_RANGE_ENGINE_ENABLED` | `BOUNDED_B00_TICK_FORECAST_SCENARIO_WRITES` |
| S2 | `s2_candidate_implemented` | `S2_REPLAY_EPISODE_IMPLEMENTED_EFFECTIVE` | `S3` | `DECISION_ACTION_OUTCOME_PROVIDER_ENABLED` | `BOUNDED_G_H_OUTCOME_WRITES` |
| S3 | `s3_candidate_implemented` | `S3_RECOVERY_LATE_EVIDENCE_IMPLEMENTED_EFFECTIVE` | `S4` | `RECOVERY_AND_LATE_UPDATE_PROVIDER_ENABLED` | `BOUNDED_LATE_APPEND_FORWARD_WRITES` |
| S4 | `s4_candidate_implemented` | `S4_RESIDUAL_CALIBRATION_SHADOW_IMPLEMENTED_EFFECTIVE` | `S5` | `RESIDUAL_AND_MODEL_GOVERNANCE_PROVIDER_ENABLED` | `BOUNDED_C_D_WRITES_WITH_ZERO_ACTIVATION` |
| S5 | `s5_candidate_implemented` | `S5_READ_MODEL_OPERATOR_IMPLEMENTED_EFFECTIVE` | `S6` | `READ_MODEL_AND_OPERATOR_SURFACES_ENABLED` | `ZERO_PRODUCT_WRITE_AUTHORITY_DELTA` |
| S6 | `s6_candidate_implemented` | `MCFT_CAP_08_COMPLETE` | `null` | `FINAL_CLOSURE_ONLY` | `NO_SUCCESSOR_WRITE_AUTHORITY` |

所有 seed 还必须冻结：

```text
effectiveness_condition = PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS
predecessor_effective_evidence_requirement = REQUIRED
predecessor_semantic_artifact_digest = null until candidate implementation PR
production_runtime_source_authorized = false
postmerge_ssot_writeback_allowed = false
```

S6 的 `effective_next_slice_when_attested = null` 不构成 CAP-09 授权；MCFT-CAP-09 必须继续由独立后继治理任务建立。

### 2.6.3 Exact successor Registry rules

PR-1 必须在其 Registry 更新中补入正式的：

```text
resolved_manifest_ref
taskbook_ref
candidate_authority_scope = PR1_AUTHORITY_RECONCILIATION_THROUGH_PR7_FINAL_CLOSURE
```

这些是非候选 Registry metadata，不为 PR-1 自身提供 candidate transition；PR-1 的 candidate integrity 仍只消费 PR-0 已在 base main 注册的 Current Authority `status` rule。

PR-1 合并时新增 S1 path/rule，供 PR-2 使用：

```json
{
  "status_file": "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-DELIVERY-STATUS-V1.json",
  "field_path": "s1_candidate_implemented",
  "allowed_candidate_values": [true],
  "focused_workflow": "mcft-cap-08-s1-base-runtime",
  "standard_workflow": "ci",
  "predecessor_effective_evidence_required": true
}
```

PR-2 合并时新增 S2 path/rule，供 PR-3 使用：

```json
{
  "status_file": "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-DELIVERY-STATUS-V1.json",
  "field_path": "s2_candidate_implemented",
  "allowed_candidate_values": [true],
  "focused_workflow": "mcft-cap-08-s2-replay-episode",
  "standard_workflow": "ci",
  "predecessor_effective_evidence_required": true
}
```

PR-3 合并时新增 S3 path/rule，供 PR-4 使用：

```json
{
  "status_file": "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json",
  "field_path": "s3_candidate_implemented",
  "allowed_candidate_values": [true],
  "focused_workflow": "mcft-cap-08-s3-recovery-late-evidence",
  "standard_workflow": "ci",
  "predecessor_effective_evidence_required": true
}
```

PR-4 合并时新增 S4 path/rule，供 PR-5 使用：

```json
{
  "status_file": "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-DELIVERY-STATUS-V1.json",
  "field_path": "s4_candidate_implemented",
  "allowed_candidate_values": [true],
  "focused_workflow": "mcft-cap-08-s4-residual-calibration-shadow",
  "standard_workflow": "ci",
  "predecessor_effective_evidence_required": true
}
```

PR-5 合并时新增 S5 path/rule，供 PR-6 使用：

```json
{
  "status_file": "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json",
  "field_path": "s5_candidate_implemented",
  "allowed_candidate_values": [true],
  "focused_workflow": "mcft-cap-08-s5-read-model-operator",
  "standard_workflow": "ci",
  "predecessor_effective_evidence_required": true
}
```

PR-6 合并时新增 S6 path/rule，供 PR-7 使用：

```json
{
  "status_file": "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json",
  "field_path": "s6_candidate_implemented",
  "allowed_candidate_values": [true],
  "focused_workflow": "mcft-cap-08-s6-final-closure",
  "standard_workflow": "ci",
  "predecessor_effective_evidence_required": true
}
```

PR-7 不得预注册、创建或授权 MCFT-CAP-09 Current Authority。CAP-09 继续：

```text
successor_capability_authorized = false
mcft_cap_09_authorized = false
```

### 2.6.4 Successor graph and file ownership

| PR | 当前 PR 使用的 trusted-base candidate rule | 当前 PR 创建的后继 seed | 当前 PR 注册、供后继使用的 rule |
|---|---|---|---|
| PR-0 | none；普通 PR | none | PR-1 Current Authority `status` |
| PR-1 | Current Authority `status=AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE` | S1 status | PR-2 `s1_candidate_implemented=true` |
| PR-2 | S1 candidate | S2 status | PR-3 `s2_candidate_implemented=true` |
| PR-3 | S2 candidate | S3 status | PR-4 `s3_candidate_implemented=true` |
| PR-4 | S3 candidate | S4 status | PR-5 `s4_candidate_implemented=true` |
| PR-5 | S4 candidate | S5 status | PR-6 `s5_candidate_implemented=true` |
| PR-6 | S5 candidate | S6 status | PR-7 `s6_candidate_implemented=true` |
| PR-7 | S6 final candidate | none | none；CAP-09 remains unauthorized |

每个后继 seed 和 Registry rule 必须在创建它的前驱 PR protected merge 后，才成为下一 PR 可依赖的 trusted authority。

Exact-SHA workflow 只读证明 merge commit，不修改 Registry。它通过 artifact 中的：

```text
effective_delivery_frontier_projection.effective_status
effective_delivery_frontier_projection.effective_next_slice
effective_authority_projection.bounded_replay_runner_authorized
effective_authority_projection.bounded_canonical_transaction_authorized
```

形成外部有效授权。

## 2.7 PR-1 exact-SHA effectiveness contract

PR-1 candidate workflow 必须在 exact candidate head 产生 S0 authority evidence；protected merge 后，CAP-08 专用 exact-SHA workflow 只允许在 candidate tree 与 merge tree 完全等价时将该证据投影到 merge SHA。

### 2.7.1 Candidate / merge tree identity

必须记录并验证：

```text
candidate_head_sha
candidate_tree_sha
merge_commit_sha
merge_tree_sha
candidate_to_merge_tree_delta
attested_tree_sha
```

有效条件：

```text
candidate_to_merge_tree_delta = 0
candidate_tree_sha = merge_tree_sha
attested_tree_sha = merge_tree_sha
```

任何 base update、merge resolution、自动格式化或其他 tree delta 导致两棵树不一致时：

```text
PR-1 candidate evidence projection:
FORBIDDEN

exact-SHA attestation:
FAIL

next authorized action:
refresh/rebase candidate and rerun exact candidate checks
```

若使用 merge queue：

```text
required checks must pass on merge-group tree
merge_group_tree_sha must equal candidate_tree_sha
final merge_tree_sha must equal merge_group_tree_sha
```

只通过 candidate commit SHA 相等、文件名集合相等或 patch 摘要相等均不足以替代 Git tree SHA 等价证明。

### 2.7.2 Exact merge-SHA workflow obligations

PR-1 merge 后，CAP-08 专用 exact-SHA workflow 必须：

```text
checkout trusted current main attestation implementation
attest exact merge SHA and merge tree
read candidate-head evidence locator
prove candidate tree = merge tree
read CAP-07 R2 predecessor artifact
validate PR-1 changed-file boundary
validate taskbook and machine-file digests
revalidate S0 artifact digests against attested tree
provision role in disposable PostgreSQL using external-admin credential
verify exact catalog grants and revokes
run negative privilege probes
prove business schema structural digest unchanged
prove actual privilege graph delta equals expected writer-authority delta
prove zero canonical Runtime data delta
emit deterministic authority artifact
upload immutable R2 archive
read back authorized-store object
publish commit status:
mcft-cap-08/pr1-exact-sha-attestation
```

结构与权限证明必须拆分：

```text
business_schema_structure_digest_before
business_schema_structure_digest_after
require equality

privilege_graph_digest_before
privilege_graph_digest_after
expected_privilege_delta_digest
actual_privilege_delta_digest
require actual = expected
```

`business_schema_structure_digest` 必须包含业务 schema 的 relation/column/type/constraint/index/function/trigger 结构，但排除：

```text
ACL
role membership
owner
comments
```

`privilege_graph_digest` 必须覆盖：

```text
role flags
role membership
schema ACL
table/view ACL
sequence ACL
function ACL
default privileges
```

PR-1 Artifact 至少包含：

```text
subject_sha
status
capability_line_id
slice_id = MCFT-CAP-08.S0
candidate_head_sha
candidate_tree_sha
merge_commit_sha
merge_tree_sha
candidate_to_merge_tree_delta = 0
attested_tree_sha = merge_tree_sha
merge_group_tree_sha when applicable
taskbook_digest
resolved_manifest_digest
changed_file_boundary_digest
writer_authority_digest
platform_bootstrap_source_digest
predecessor_artifact_locator/readback
catalog_grant_proof
negative_privilege_proof
business_schema_structure_digest_before
business_schema_structure_digest_after
privilege_graph_digest_before
privilege_graph_digest_after
expected_privilege_delta_digest
actual_privilege_delta_digest
privilege_delta_match = true
zero_canonical_runtime_data_delta
effective_delivery_frontier_projection
effective_authority_projection
retention_locator/readback
```

只有 exact-SHA artifact `PASS`、tree equivalence PASS 且 immutable readback 成功后，外部有效投影才允许：

```text
taskbook_status_when_attested:
FROZEN_TASKBOOK

bounded_replay_runner_authorized:
true

bounded_canonical_transaction_authorized:
true

bounded_writer_identity:
geox_mcft_cap08_runner_v1

next_authorized_slice:
S1

production_runtime_source_authorized:
false
```

在 exact-SHA PASS 前，即使 disposable acceptance database 或某个环境已创建 role，也不得运行 CAP-08 canonical transaction。

## 2.8 PR-1 focused acceptance boundary

PR-1 只允许证明：

```text
authority consistency
CAP-07 R2 predecessor consumption
latest-main alignment
CAP-04 taskbook byte preservation
machine-readable B00/FVO/micro-sequence/digest contracts
pure late-correction math qualification
progress-resolver predicate schema and query qualification
platform bootstrap capability
relation-level least privilege
negative database privileges
business schema structural digest equality
zero canonical Runtime write delta
exact-SHA artifact transport
```

PR-1 禁止执行或声称：

```text
formal B00 canonical root
T00-T23 Runtime chain
G00-G02
Replay Decision/Execution/Outcome chain
late correction persisted Runtime behavior
24 Residual
Calibration Candidate
Shadow Evaluation
24-Tick Timeline
closure semantic digest
closure Hard Acceptance
```

这些证明分别属于 PR-2～PR-6 的 slice acceptance 和 PR-7 的 final formal closure run。

---

# 3. 前驱事实与双基线

## 3.1 CAP-07 closure authority

```text
closure subject SHA:
81579b7f67a3dcd3cf557abbf29c9462d8b7736b

exact-SHA workflow:
29836198341

artifact:
8497395139

retention:
R2
```

## 3.2 最新 repository baseline

```text
main:
82c99e84e0813142ff15dccf852876033d853730

meaning:
Merge PR #2619
governed local demo and exact-scope navigator
```

PR #2619：

```text
post-closure remediation:
true

candidate transition:
false

MCFT-CAP-08 authority:
false

Runtime source authority:
false
```

## 3.3 P-1 必须同时消费

```text
CAP-07 S6 candidate status
CAP-07 merge commit
CAP-07 exact-SHA status
CAP-07 R2 artifact/readback
PR #2619 merge
latest main tree
Candidate Authority Registry
updated Matrix/Implementation Map
```

---

# 4. 任务定义

## 4.1 MCFT-CAP-08 建立什么

MCFT-CAP-08 第一次证明，前驱能力可以在同一 formal scope、同一 formal Runtime lineage/revision、同一个 PostgreSQL 数据库中组成一条连续 persisted chain：

```text
Formal Bootstrap Runtime Root
↓
24 hourly Tick
↓
State / Dynamics / Assimilation
↓
72-hour Forecast
↓
Three Scenarios
↓
Replayed Human Decision
↓
Replay Approval / Plan Evidence
↓
Replay Execution Receipt
↓
Action Feedback
↓
Outcome Observation
↓
Updated State / Forecast / Scenario
↓
24 Forecast Verification Observations
↓
24 Forecast Residual
↓
16 Calibration + 8 Holdout
↓
Calibration Candidate
↓
Shadow Evaluation
↓
Candidate non-consumption
↓
CAP-07 Read Model / Timeline / Trace / Operator
```

## 4.2 不建立什么

```text
720-Tick long-horizon qualification
five-scenario extended qualification
historical tick revision/reprocessing runtime
live sensor ingestion
shadow-online Runtime
background scheduler
automatic Recommendation
automatic Approval
AO-ACT
Dispatch
device control
automatic Model Activation
causal effect proof
ROI proof
Field Memory learning
multi-field scale
commercial productization completion
Minimum Complete Field Twin complete
```

## 4.3 Vertical 与 horizontal ID 区分

```text
MCFT-CAP-08:
vertical capability line
24-Tick End-to-End Closure

MCFT-08:
horizontal owner work package
First-class State Runtime
```

MCFT-CAP-08 completion 不自动把 horizontal `MCFT-08` 的所有长期目标标为 COMPLETE。

---

# 5. Formal scope 与 Bootstrap Runtime Root

## 5.1 Six-key scope

默认使用：

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
```

## 5.2 与 #2619 local demo 隔离

可以复用六键空间语义，但不得复用：

```text
local-demo lineage
local-demo checkpoint
local-demo Runtime Config
local-demo canonical facts
local-demo projections
```

作为 CAP-08 authority。

## 5.3 Formal Bootstrap Root

为消除 FVO-00 和跨-lineage predecessor 缺口，正式链必须先建立一个完整 bootstrap root：

```text
bootstrap_id:
B00

counted_as_successful_CAP08_tick:
false

same formal lineage as T00-T23:
true

same formal revision as T00-T23:
true
```

B00 至少包含：

```text
one active lineage object
one frozen revision identity
one Reality Binding
one Runtime Config
one bootstrap State
one bootstrap Runtime Tick
one bootstrap Checkpoint
one previous Forecast result
one persisted next-tick handoff
```

允许 bootstrap Forecast 为 existing A0 BLOCKED result；它不进入 24 successful Forecast cardinality，也不用于 24 Residual mapping。

## 5.4 Formal run identity

```text
run_contract_id:
GEOX-MCFT-CAP-08-24-TICK-RUN-CONTRACT-V1

formal_run_id:
deterministic scope+dataset+config hash identity

lineage_strategy:
NEW_FORMAL_REPLAY_LINEAGE

revision_strategy:
ONE_FROZEN_REVISION

runtime_start:
S0 exact canonical UTC hour

T00:
runtime_start

T23:
runtime_start + PT23H

T24:
forecast-verification target only
not a committed Runtime Tick
```

---

# 6. 24 Forecast Verification Observations 与 Residual 映射

## 6.1 修正后的映射

取消 v0.3.0 的 `FVO-00` predecessor Forecast 依赖。

正式映射：

```text
T00 Forecast H=1 → FVO-01 observed at T01
T01 Forecast H=1 → FVO-02 observed at T02
...
T22 Forecast H=1 → FVO-23 observed at T23
T23 Forecast H=1 → FVO-24 observed at T24
```

因此：

```text
successful Tick:
24

successful Forecast:
24

Forecast Verification Observation:
24

Forecast Residual:
24
```

## 6.2 FVO-24

```text
observed_at:
T24

committed/qualified:
G00 post-run residual phase

creates T24 Runtime Tick:
false

eligible_for_state_assimilation:
false

eligible_for_forecast_evaluation:
true
```

这样可以完成 T23 Forecast 的 H=1 验证，而不制造第 25 个 Tick。

## 6.3 FVO-01 late profile

固定 late case：

```text
FVO-01
forecast source:
T00 H=1

observed_at:
T01

available_to_runtime_at:
T16

first eligible Runtime Tick:
T16

historical State/Forecast rewrite:
false

current correction:
append-forward at T16
```

## 6.4 Residual IDs

```text
R-01 ... R-24
```

每个 Residual 与一个 Forecast/FVO pair 一一对应：

```text
R-i:
Forecast T(i-1) H=1
+
FVO-i
```

Residual membership 按：

```text
forecast_target_time
```

排序，不按 commit time 排序。因此 R-01 虽在 T16 才 commit，仍是 ordered set 第一项。

## 6.5 24 条 Residual window

默认：

```text
Calibration:
R-01 ... R-16

Holdout:
R-17 ... R-24
```

S0 可在不改变 16+8 cardinality 的前提下调整 membership，以满足 CAP-06 regime qualification；必须冻结 exact ordered refs/hashes。

## 6.6 Per-Tick FVO / Residual due-obligation map

`GEOX-MCFT-CAP-08-24-TICK-RUN-CONTRACT-V1.json` 必须为每个 Tick 或 post-run phase 冻结：

```text
phase_id
due_fvo_ids
due_residual_ids
selected_state_observation_ids
late_state_correction_observation_ids
residual_only_observation_ids
observed_but_not_available_ids
```

默认 authoritative map：

| Phase | due_fvo_ids | due_residual_ids | selected_state_observation_ids | late_state_correction_observation_ids | residual_only_observation_ids | observed_but_not_available_ids |
|---|---|---|---|---|---|---|
| T00 | — | — | — | — | — | — |
| T01 | — | — | — | — | — | FVO-01 |
| T02 | FVO-02 | R-02 | FVO-02 | — | — | FVO-01 still hidden |
| T03 | FVO-03 | R-03 | FVO-03 | — | — | FVO-01 still hidden |
| T04 | FVO-04 | R-04 | FVO-04 | — | — | FVO-01 still hidden |
| T05 | FVO-05 | R-05 | — | — | FVO-05 | FVO-01 still hidden |
| T06 | FVO-06 | R-06 | — | — | FVO-06 | FVO-01 still hidden |
| T07 | FVO-07 | R-07 | — | — | FVO-07 | FVO-01 still hidden |
| T08 | FVO-08 | R-08 | — | — | FVO-08 | FVO-01 still hidden |
| T09 | FVO-09 | R-09 | — | — | FVO-09 | FVO-01 still hidden |
| T10 | FVO-10 | R-10 | FVO-10 | — | — | FVO-01 still hidden |
| T11 | FVO-11 | R-11 | — | — | FVO-11 | FVO-01 still hidden |
| T12 | FVO-12 | R-12 | — | — | FVO-12 | FVO-01 still hidden |
| T13 | FVO-13 | R-13 | — | — | FVO-13 | FVO-01 still hidden |
| T14 | FVO-14 | R-14 | — | — | FVO-14 | FVO-01 still hidden |
| T15 | FVO-15 | R-15 | — | — | FVO-15 | FVO-01 still hidden |
| T16 | FVO-01, FVO-16 | R-01, R-16 | — | FVO-01 | FVO-16 | — |
| T17 | FVO-17 | R-17 | — | — | FVO-17 | — |
| T18 | FVO-18 | R-18 | — | — | FVO-18 | — |
| T19 | FVO-19 | R-19 | — | — | FVO-19 | — |
| T20 | FVO-20 | R-20 | — | — | FVO-20 | — |
| T21 | FVO-21 | R-21 | — | — | FVO-21 | — |
| T22 | FVO-22 | R-22 | FVO-22 | — | — | — |
| T23 | FVO-23 | R-23 | — | — | FVO-23 | — |
| G00 | FVO-24 | R-24 | — | — | FVO-24 | — |

冻结身份：

```text
T09 Outcome interval:
underway after execution
FVO-10 observed_at event has not occurred
FVO-10 unavailable to Runtime
FVO-10 not due for assimilation or residual

Outcome Observation at T10:
observed_at = T10
available_to_runtime_at <= T10 frozen Evidence cutoff
exactly the same canonical Evidence identity as FVO-10
eligible_for_state_assimilation = true
eligible_for_forecast_evaluation = true

FVO-16 at T16:
eligible_for_state_assimilation = false
eligible_for_forecast_evaluation = true
residual-only

FVO-01 at T16:
late_state_correction_observation
not ordinary assimilation
also forms R-01
```

任一 phase 的 actual due set 与 run contract 不一致时，barrier 必须 fail closed；不得用额外或缺失 Residual 调整到总数 24。

# 7. Replay Dataset

## 7.1 Evidence classes

至少包含：

```text
FVO-01 ... FVO-24
State-assimilation observations
rainfall observations
historical ET / ET0
future weather assumptions
Approval Assertion Evidence
Approved Plan Snapshot Evidence
Execution Receipt Evidence
Outcome Observation Evidence
one late-available observation
one LIMITED observation
one competing spatial-mismatch observation
one competing unit-invalid observation
```

## 7.2 每条 Evidence 最低字段

```text
source identity
binding purpose
source record identity
observed_at
received_at
available_to_runtime_at
scope
layer/depth
metric
value
unit
quality
transformation chain
eligible_for_state_assimilation
eligible_for_forecast_evaluation
content hash
```

## 7.3 State assimilation 与 Forecast evaluation 分离

每条 observation 必须显式标记两种目的：

```text
eligible_for_state_assimilation
eligible_for_forecast_evaluation
```

允许：

```text
Residual-only FVO
State-assimilation + Residual FVO
rejected State candidate but valid Forecast evaluation
late append-forward State correction
```

不得因为形成 Residual 就自动进入 State。

---

# 8. State、Dynamics 与普通 Assimilation

## 8.1 State coordinate

```text
root_zone_water_storage_mm
root_zone_mean_vwc_fraction
water_stress_state
root_zone_depth_mm
```

exact root-zone depth、layer mapping 和 physical bounds 由 S0 冻结。

## 8.2 Dynamics

复用：

```text
water(t)
=
water(t-1)
+ effective rainfall
+ executed irrigation
- evapotranspiration
- runoff
- drainage
```

必须保存：

```text
input refs/hashes
mass-balance trace
physical clipping
process variance
Runtime Config ref/hash
previous State ref/hash
```

## 8.3 普通 observation update

复用 predecessor observation operator 和 scalar assimilation：

```text
POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1
SCALAR_GAUSSIAN_ASSIMILATION_V1
```

每个 Tick 保存：

```text
prior
predicted observation
actual observation or explicit absence
innovation
gain/weight
posterior
uncertainty
disposition
evaluated/applied/rejected refs
```

## 8.4 NO_OBSERVATION Tick

至少一个 Tick：

```text
selected observation:
none

State:
Dynamics-only

new immutable posterior:
required

uncertainty:
increased or preserved by frozen math
```

---

# 9. Late Observation Temporal Correction

v0.3.0 的“复用普通 assimilation + lateness penalty”不足以定义跨 15 小时状态修正；v0.3.3 只传播 Dynamics sensitivity，也没有包含 T02、T03、T04 等中间 ordinary Assimilation 对扰动的影响。本版冻结：

```text
LATE_OBSERVATION_APPEND_FORWARD_CORRECTION_V1
+
DETERMINISTIC_PAIRED_FULL_POSTERIOR_TRANSITION_SENSITIVITY_V1
```

## 9.1 语义边界

```text
historical observation event time:
τ

current first-visible Tick:
t

τ < t

historical object rewrite:
false

new historical revision:
false for Stage 1A

current State correction:
allowed only at t

full historical replay:
forbidden
```

## 9.2 T16 frozen update order

T16 不执行 ordinary State observation assimilation：

```text
FVO-16:
forecast-evaluation eligible
state-assimilation ineligible
residual-only

FVO-01:
late correction source
```

T16 A phase 固定为：

```text
Dynamics from T15 posterior
↓
base T16 posterior with no ordinary observation update
↓
LATE_APPEND_FORWARD correction from FVO-01
↓
final T16 posterior
```

随后：

```text
B(T16) Scenario
C(T16) R-01 + R-16
barrier
```

不得在实现阶段改成 “ordinary FVO-16 first” 或其他双更新顺序。

## 9.3 输入

```text
historical base prior mean at τ:
x_base_tau

historical base prior variance at τ:
P_base_tau

late observation:
y_tau

observation operator:
H_tau

observation + representativeness variance:
R_tau

current base posterior before late correction:
x_base_t

current base posterior variance before late correction:
P_base_t

immutable full transition inputs/traces:
τ+1 ... t

quality weight:
q

lag hours:
delta_h

lag decay parameter:
lambda

physical bounds:
x_min / x_max

minimum variance:
P_min
```

## 9.4 Historical innovation

```text
r_tau = y_tau - H_tau * x_base_tau

S_tau = H_tau^2 * P_base_tau + R_tau
```

若：

```text
S_tau <= 0
```

则 fail closed。

## 9.5 Full posterior-to-posterior sensitivity transport

每个中间 Tick `k` 定义完整冻结 operator：

```text
g_k(x_plus_{k-1}) =
  OrdinaryAssimilation_k(
    Dynamics_k(x_plus_{k-1}),
    frozen Evidence selection/disposition_k,
    frozen Runtime Config_k,
    frozen quality and clipping policy_k
  )
```

若 Tick `k` 没有 ordinary selected observation，则 `OrdinaryAssimilation_k` 是冻结的 identity/Dynamics-only posterior composition。若 observation 被 reject/context-only，则必须重现同一 disposition，不得因 paired perturbation 重新选择 Evidence。

使用：

```text
x_plus_{k-1}^{+} = x_plus_{k-1} + epsilon
x_plus_{k-1}^{-} = x_plus_{k-1} - epsilon

g_k_plus  = g_k(x_plus_{k-1}^{+})
g_k_minus = g_k(x_plus_{k-1}^{-})

a_k = clamp(
  [g_k_plus - g_k_minus] / [2 * epsilon],
  0,
  a_max
)
```

方法 ID：

```text
DETERMINISTIC_PAIRED_FULL_POSTERIOR_TRANSITION_SENSITIVITY_V1
```

要求：

- 使用 immutable historical Dynamics inputs；
- 使用同一 frozen Evidence candidate set、selection outcome、quality 和 disposition；
- 使用同一 Runtime Config；
- 重算 Dynamics、predicted observation、ordinary Assimilation、posterior 和 physical clipping；
- 不写入 paired calculation 的任何 canonical object；
- 不替换历史 State；
- `epsilon` 和 `a_max` 在 S0 冻结；
- paired calculation deterministic；
- non-finite paired output fail closed。

累计 transport：

```text
Phi_t_tau = product(a_k), k = τ+1 ... t
```

该 transport 包含 T02、T03、T04 等 intermediate ordinary observation updates 的影响，不得退化为仅对 water Dynamics 函数求导。

## 9.6 Lag/quality attenuation

```text
d = exp(-lambda * delta_h)

w = clamp(q * d, 0, 1)

C_t_tau = w * Phi_t_tau * P_base_tau
```

## 9.7 Delayed gain 与 current correction

```text
K_late = C_t_tau * H_tau / S_tau

delta_x_t = K_late * r_tau

x_plus_t =
clamp(
  x_base_t + delta_x_t,
  x_min,
  x_max
)
```

## 9.8 Variance

```text
raw_reduction = K_late^2 * S_tau

variance_reduction =
min(
  raw_reduction,
  max(0, P_base_t - P_min)
)

P_plus_t =
P_base_t - variance_reduction
```

要求：

```text
P_min <= P_plus_t <= P_base_t
```

若 cross-covariance、gain、mean、variance、paired transition output 或 `Phi_t_tau` 非有限，必须 REJECTED。

## 9.9 Eligibility

late correction 只有在以下条件全部满足时允许：

```text
exact historical Forecast/State/Observation trace exists
same six-key scope
same formal lineage/revision
unit and coordinate compatible
quality PASS or LIMITED
lag <= max_lag_hours
all intermediate Dynamics and ordinary Assimilation inputs available
all intermediate Evidence selection/disposition identities frozen
Phi finite
physical bounds valid
observation not previously applied
```

否则：

```text
disposition:
REJECTED or CONTEXT_ONLY

State correction:
0
```

## 9.10 Persisted trace

使用现有 `twin_assimilation_update_v1` 的 additive late profile，至少保存：

```text
assimilation_mode:
LATE_APPEND_FORWARD

historical_observation_ref/hash
historical_event_time
current_application_time
lag_hours
historical_base_prior_ref/hash
current_base_posterior_ref/hash
transition_trace_refs/hashes
ordinary_assimilation_trace_refs/hashes
frozen_evidence_selection_refs/hashes
epsilon
paired_plus_outputs
paired_minus_outputs
a_k values
Phi_t_tau
quality_weight
lag_decay
C_t_tau
S_tau
K_late
historical_innovation
current_correction_delta
posterior mean/variance
physical clipping
disposition
```

默认：

```text
new canonical object type:
NONE
```

若现有 contract 不能容纳 additive profile，PR-1 必须先做 Architecture Deviation Adjudication；不得在 PR-4 implementation 中临时发明语义。

## 9.11 Shared qualification test vectors

PR-1 必须冻结：

```text
GEOX-MCFT-CAP-08-LATE-CORRECTION-TEST-VECTORS-V1.json
```

至少包含：

```text
normal positive residual
normal negative residual
LIMITED quality
maximum allowed lag
lag rejection
physical upper clipping
physical lower clipping
non-finite rejection
intermediate ordinary assimilation
zero transition sensitivity
variance floor
deterministic rerun
```

每个 vector 至少冻结：

```text
vector_id
input moments
frozen intermediate transition inputs
frozen Evidence selections/dispositions
Runtime Config digest
expected a_k sequence
expected Phi_t_tau
expected gain/correction
expected posterior mean/variance
expected clipping/disposition
expected deterministic digest
```

PR-1 acceptance script 只能消费这些 machine-readable vectors；不得在测试代码中维护第二套 expected values。PR-4 的生产实现必须直接通过同一文件的全部 vectors，且不得修改 vector expected values；任何更新必须回到 architecture authority PR。

# 10. Forecast 与 Scenario

## 10.1 Forecast

每个 T00–T23：

```text
source posterior:
same Tick State

point 1:
T + PT1H

point 72:
T + PT72H

point count:
72
```

总计：

```text
24 Forecast
1728 Forecast points
```

## 10.2 Stage 1A 三情景

Authority Reconciliation 后冻结：

```text
NO_ACTION
IRRIGATE_NOW_15MM
IRRIGATE_NOW_25MM
```

总计：

```text
24 Scenario Set
72 options
5184 trajectory points
```

## 10.3 三情景 nonclaims

```text
Scenario is not Recommendation
Scenario is not Policy approval
Scenario is not execution
three-option Stage 1A does not establish extended five-scenario qualification
```

---

# 11. Replayed Decision / Execution / Outcome Episode

## 11.1 正式名称

```text
ONE_REPLAYED_HISTORICAL_DECISION_EXECUTION_OUTCOME_EPISODE
```

不得称为：

```text
Controlled Action Closure
Twin-driven execution
real action loop
Stage 1C
```

## 11.2 对象分离

```text
Scenario
≠ Human Decision

Human Decision
≠ Approval Assertion

Approval Assertion
≠ Approved Plan Snapshot

Approved Plan
≠ Execution Receipt

Execution Receipt
≠ Action Feedback

Action Feedback
≠ Outcome Observation

Outcome Observation
≠ causal effect proof
```

## 11.3 默认 replay values

```text
approved_amount_mm:
15.000000

executed_amount_mm:
13.600000

coverage_fraction:
0.910000

target_scope_equivalent_amount_mm:
12.376000
```

S0 必须用现有 contract/mathematics 重新资格确认。

---

# 12. Transaction Micro-sequence

本版新增：

```text
GEOX-MCFT-CAP-08-TRANSACTION-MICRO-SEQUENCE-V1
```

## 12.1 Phase vocabulary

```text
E:
Replay Evidence ingress / visibility established

H:
Action Feedback commit

A:
State Tick atomic commit

B:
Scenario commit

G:
Human Decision link commit

C:
Forecast Residual commit

D:
post-run Model Governance commit

F:
operational attempt / failure evidence
```

## 12.2 每 Tick 的通用顺序

```text
1. Resolve persisted progress
2. Establish Evidence visibility cutoff
3. E: ensure due Evidence is canonical and visible
4. H: commit due Action Feedback before A, if same-Tick consumption is intended
5. Freeze caller-owned database snapshot for A
6. A: atomic State/Forecast/Tick/Checkpoint commit
7. B: commit/recover Scenario from A Forecast
8. G: commit designated Decision after B
9. C: commit all Residual obligations first qualified at this Tick
10. verify full Tick barrier
11. only then permit next Tick
```

`C` 在 `A` 后是有意冻结：

- ordinary/current assimilation 使用 observation inside A；
- C evaluates a historical Forecast against the same observation；
- C 可引用 A 中的 Assimilation Update；
- C 不作为 A 的 prerequisite；
- next Tick 在 due C 完成前不得开始。

## 12.3 T08 execution receipt

```text
Receipt available_to_runtime_at <= T08 cutoff
↓
H(T08) commit
↓
A(T08) Evidence Window consumes H
↓
executed amount enters first legal T08 interval
```

若 H 未在 A snapshot 前 commit：

```text
T08 consumption:
forbidden

first legal consumption:
T09
```

formal dataset 必须固定选择其中一种。本任务书默认前者。

## 12.3.1 T09 outcome interval underway

```text
physical execution already occurred
post-execution outcome interval underway
Outcome/FVO-10 observed_at event not yet occurred
Outcome/FVO-10 available_to_runtime_at not established
A(T09) must not select or consume FVO-10
C(T09) commits only R-09
```

T09 不允许创建一个“已观察但不可用”的 FVO-10。FVO-10 的唯一 observation event time 是 T10。

## 12.4 T10 Outcome = FVO-10

T10 使用一个 canonical Evidence identity，同时承担 Outcome 与 Forecast Verification 两种 purpose：

```text
E Outcome Observation = FVO-10 observed_at T10 and visible by T10 cutoff
eligible_for_state_assimilation = true
eligible_for_forecast_evaluation = true
↓
A(T10) ordinary assimilation and posterior
↓
B(T10) Scenario
↓
C(T10) R-10 linked to the same FVO-10 and A Assimilation
```

不得复制成两个语义相同但 identity 不同的 Evidence 对象，也不得让同一个 observation 形成两个 Residual。

## 12.5 T16 late evidence + ordinary due residual

```text
E FVO-01 first visible
E FVO-16 visible as residual-only
↓
A(T16) Dynamics-only base posterior
↓
A(T16) LATE_APPEND_FORWARD correction from FVO-01
↓
B(T16) Scenario
↓
C(T16) R-01 linked to late Assimilation
C(T16) R-16 linked to residual-only FVO-16
↓
full barrier
```

冻结要求：

```text
ordinary FVO-16 State assimilation:
forbidden

R-01 count:
1

R-16 count:
1

next Tick before both C obligations complete:
forbidden
```

## 12.5.1 Stable phase orchestration skeleton

PR-1 的 S0 machine contract 必须冻结：

```text
GEOX-MCFT-CAP-08-PHASE-ORCHESTRATION-CONTRACT-V1.json
```

PR-2 从第一版 range engine 起必须实现稳定扩展点：

```text
resolve
→ E
→ H
→ A
→ B
→ G
→ C
→ barrier
```

概念接口：

```text
Cap08TickPhasePlanV1
- phase ordering
- Tick identity
- frozen visibility cutoff
- A update profile
- required barrier members

Cap08DueObligationSetV1
- due Evidence/FVO
- due H action feedback
- due G decision link
- due C residuals
- post-run D obligations when applicable

Cap08TickBarrierV1
- canonical completion predicates
- due obligation cardinality
- idempotent readback
- legal next Tick decision
```

PR-2 中允许：

```text
E obligations:
base dataset

H obligations:
empty

A obligations:
base State/Forecast Tick

B obligations:
Scenario

G obligations:
empty

C obligations:
empty
```

后继切片只能增加 provider：

```text
PR-3:
G/H provider

PR-4:
recovery provider + A late-update profile provider

PR-5:
C Residual provider + post-run D provider
```

禁止 PR-3～PR-5 重写主 range loop 或改变 phase ordering。PR-2 必须同时产出：

```text
phase_engine_contract_digest
phase_engine_source_digest
```

`phase_engine_contract_digest` 是规范化语义契约 digest，至少覆盖：

```text
phase ordering
provider interfaces
barrier contract
due-obligation schema
progress-resolver integration point
idempotency semantics
```

后续 PR 的 acceptance 必须证明 `phase_engine_contract_digest` 不变，除非先通过 Architecture Deviation Adjudication。`phase_engine_source_digest` 只作为审计证据；允许因 bug fix、类型收紧或非语义重构变化，但必须记录 source delta、重新通过 contract conformance 和全部 focused acceptance，不得把 source byte digest 作为唯一语义稳定性判据。

## 12.6 G00–G02

```text
G00:
E FVO-24
C R-24
read back exactly 24 Residual
freeze/verify 16+8 windows

G01:
D Calibration Candidate

G02:
D Shadow Evaluation
prove non-consumption
```

D 永远不得进入 T00–T23 的 active Runtime Config。

---

# 13. Deterministic Progress Resolver

当前设计状态必须拆分：

```text
PROGRESS_RESOLVER_STATE_MACHINE:
DEFINED

PROGRESS_RESOLVER_CANONICAL_PREDICATES:
PENDING_S0_MACHINE_READABLE_FREEZE

PROGRESS_RESOLVER_IMPLEMENTATION:
NOT_AUTHORIZED
```

## 13.1 Contract

```text
CAP08_RUN_PROGRESS_V1

canonical object:
NO

database write:
NO

authority:
existing facts / projections / checkpoint /
idempotency / visibility / pointers
```

## 13.2 Required states

```text
RUN_NOT_ESTABLISHED
BOOTSTRAP_PENDING
BOOTSTRAP_COMPLETE

TICK_EVIDENCE_PENDING
TICK_H_PENDING
ACTION_H_COMMITTED_A_CONSUMPTION_PENDING
TICK_A_PENDING
TICK_A_COMMITTED_B_PENDING
TICK_B_COMMITTED_G_PENDING
TICK_B_COMMITTED_C_PENDING
TICK_G_COMMITTED_C_PENDING
OUTCOME_A_COMMITTED_C_RESIDUAL_PENDING
LATE_A_CORRECTION_COMMITTED_C_RESIDUAL_PENDING
TICK_C_PENDING
TICK_COMPLETE

G00_FINAL_OBSERVATION_PENDING
G00_FINAL_RESIDUAL_PENDING
RESIDUAL_SET_INCOMPLETE
RESIDUAL_SET_COMPLETE

D_CANDIDATE_PENDING
D_CANDIDATE_COMMITTED
D_SHADOW_PENDING
D_SHADOW_COMMITTED

RUN_COMPLETE
FAILED_CLOSED_CONFLICT
```

## 13.3 每个 state 的 S0 machine-readable predicate

PR-1 必须在：

```text
GEOX-MCFT-CAP-08-PROGRESS-RECOVERY-ADJUDICATION-V1.json
```

中为每个 state 冻结以下字段：

```text
state_id
predicate_version
required_relations
required_object_types
required_cardinality
required_scope_fields
required_lineage_ref/hash
required_revision_ref/hash
required_checkpoint_ref/hash
required_predecessor_refs/hashes
idempotency_identity_template
completion_query_id
completion_predicate
legal_next_operation_id
retry_result
response_loss_readback_result
concurrency_result
conflict_error_code
zero_write_assertion
```

`completion_predicate` 必须是可由 acceptance 执行的 canonical/SQL predicate，不得只是自然语言描述。

当前 taskbook 只冻结 state vocabulary 和 predicate schema；实际 exact predicates 必须由 PR-1/S0 机器文件和 PostgreSQL acceptance 证明。

## 13.4 Barrier rule

下一 Tick 只有在前一 Tick 达到：

```text
TICK_COMPLETE
```

后才能开始。

`A+B` 不再足以表示 CAP-08 full Tick complete；designated G/C obligations 也必须完成。

---

# 14. 24 Residual、Calibration 与 Shadow

## 14.1 Cardinality

```text
Residual:
exactly 24

Calibration:
exactly 16

Holdout:
exactly 8

Candidate:
exactly 1

Shadow:
exactly 1

Model Activation:
exactly 0
```

## 14.2 Window identity

必须冻结：

```text
ordered residual refs
ordered residual hashes
residual_set_hash
calibration_window_hash
holdout_window_hash
case_input_set_hash
regime distribution
```

## 14.3 Candidate oracle

默认复用 CAP-06：

```text
parameter:
dynamics_parameters.drainage_coefficient_per_hour

base:
0.030000

expected candidate:
0.034000

grid points:
21
```

S0 必须对新的 CAP-08 formal dataset 重新资格确认。

若不是 `0.034000`：

```text
implementation:
blocked

silent expected-value rewrite:
forbidden
```

## 14.4 Shadow

exact 8 holdout cases：

```text
deterministic paired replay
future leakage:
0

candidate active:
false

active Runtime Config changed:
false

State/checkpoint changed by D:
false
```

---

# 15. Restart、Failure、Response-loss 与 Concurrency

## 15.1 Fresh-process split

默认：

```text
process A:
B00 + T00 ... T11

hard termination:
after T11 full Tick barrier

process B:
T12 ... T23 + G00 ... G02
```

worker B 只允许读取数据库。

## 15.2 Pre-commit fault

至少在 A 前和 A 内持久化阶段注入：

```text
zero partial mandatory member
zero checkpoint advance
zero pointer advance
zero partial projection
retry exactly one semantic result
```

## 15.3 Post-commit response loss

至少覆盖 A、H、C、D：

```text
commit succeeded
response lost
fresh lookup by idempotency
same canonical result
zero duplicate fact/projection
```

## 15.4 Concurrency

同 scope、同 run、同 operation identity：

```text
one winner
one idempotent readback or fenced conflict
zero duplicate current pointer
zero duplicate canonical object
```

---

# 16. Determinism Digest Policy

v0.3.0 将 semantic chain 和 operational evidence 混入一个 closure digest，无法稳定。本版拆为三层。

## 16.1 Semantic chain digest

```text
semantic_chain_digest_v1
```

覆盖：

```text
B00 semantic root
T00-T23 semantic canonical objects
State / Forecast / Scenario
Decision / Plan / Action Feedback
R-01 ... R-24
Candidate / Shadow
Runtime Config and Reality Binding refs/hashes
ordered Trace semantic edges
```

排除：

```text
worker identity
lease owner
attempt timestamps
process IDs
raw operational logs
F-family run-instance metadata
```

两次完整 Replay 必须 byte-identical。

## 16.2 Operational invariant digest

```text
operational_invariant_digest_v1
```

覆盖规范化谓词：

```text
fault stage IDs
expected rollback outcomes
restart boundary
response-loss recovery outcomes
concurrency winner count
duplicate count
progress-resolver terminal states
projection rebuild equality
```

排除：

```text
wall-clock timestamp
worker name
lease token
job ID
run-specific random identifier
```

两次运行必须一致。

## 16.3 Operational instance manifest

```text
operational_instance_manifest_v1
```

保存真实 run-specific 证据。其 digest 每次可以不同，不参与 semantic determinism equality。

## 16.4 Closure digest

```text
closure_digest_v1 =
hash(
  taskbook_digest,
  run_contract_digest,
  semantic_chain_digest,
  operational_invariant_digest,
  hard_acceptance_ledger_digest
)
```

HA-01 只要求：

```text
semantic_chain_digest:
identical

operational_invariant_digest:
identical

closure_digest:
identical
```

不要求 raw operational instance manifest 相同。

## 16.5 Two-run identity rule

PR-7 determinism proof 使用：

```text
formal_run_id:
deterministic semantic identity
same in RUN_A and RUN_B

run_instance_id:
operational execution identity
different in RUN_A and RUN_B
excluded from semantic_chain_digest
included only in operational_instance_manifest
```

要求：

```text
RUN_A and RUN_B use independent fresh databases
no canonical object is copied between runs
no projection or checkpoint is reused between runs
RUN_A closure candidate refs are not substituted into RUN_B
semantic_chain_digest A = B
operational_invariant_digest A = B
closure_digest A = B
```

---

# 17. Authority 与数据库身份

## 17.1 CAP-07 read path 与 `geox_runtime_v1` 的真实权限事实

必须区分应用路径与数据库角色：

```text
CAP-07 GET adapters:
application-level zero-write

geox_runtime_v1:
legacy commercial Runtime database role
not a least-privilege read-only database identity
```

当前数据库 bootstrap 对 `geox_runtime_v1` 授予了广泛 DML、sequence 和 function 权限。因此，本任务书不得把它描述为数据库层面的 GET-only reader。

冻结裁决：

```text
geox_runtime_v1 used by CAP-07 GET adapters:
allowed

geox_runtime_v1 used as CAP-08 bounded writer:
forbidden

geox_runtime_v1 privilege expansion in CAP-08:
forbidden

CAP-07 product zero-write:
must continue to be proven at application behavior level
```

## 17.2 Bounded writer provisioning owner 与生命周期

本版选择 provisioning 方案 B：

```text
baseline role presence:
NOT_PRESENT_ON_PR_1_BASE_ade35875ff6f5ef92ec76f04ab9fc302c57f700e

owner PR:
PR-1

change class:
PLATFORM_SECURITY_BOOTSTRAP_ONLY

role:
geox_mcft_cap08_runner_v1

credential source:
external administrative credential only

Runtime credential fallback:
forbidden
```

PR-1 必须新增独立 one-shot bootstrap source：

```text
apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.ts
```

其唯一数据库结构副作用是创建/规范化 `geox_mcft_cap08_runner_v1` 及其 exact grants/revokes。禁止：

```text
business table DDL
index DDL
business function/trigger DDL
canonical fact write
projection write
Runtime execution
schema CREATE
ALTER/DROP/TRUNCATE business objects
GRANT OPTION
role assumption
```

PR-1 exact-SHA 证明的是：

```text
bootstrap capability:
EXTERNALLY_EFFECTIVE

acceptance database role:
PROVISIONED_AND_VERIFIED
```

它不等于所有未来数据库已经永久 provisioned。每个 fresh/disposable/closure database 在首次 CAP-08 transaction 前都必须：

```text
run external-admin bootstrap
verify bootstrap source digest
verify exact role flags
verify exact grants/revokes
run negative privilege probe
only then expose bounded runner credential
```

## 17.3 Bounded writer relation-level authority

`GEOX-MCFT-CAP-08-WRITER-AUTHORITY-V1.json` 必须冻结：

```text
role_name
login/inherit/superuser/createdb/createrole/bypassrls flags
database CONNECT
schema USAGE
exact table allowlist
exact table privileges
exact sequence allowlist
exact sequence privileges
exact function allowlist
exact function EXECUTE privileges
explicit revokes
forbidden relation patterns
relation_level_authority_boundary
application_scope_enforcement_contract
repository_cas_enforcement_contract
bootstrap source digest
```

授权原则：

```text
only existing append/transaction paths required by A/B/C/D/G/H/F
no blanket ALL TABLES grant
no blanket ALL SEQUENCES grant
no blanket ALL FUNCTIONS grant
no default privilege broad grant
no unrelated commercial domain writes
```

PR-1 exact-SHA acceptance 必须以 PostgreSQL catalog 查询证明实际 grants 与机器文件完全一致。允许对象的可达性测试只能在 disposable database 或显式 transaction rollback probe 中进行，不得留下 canonical Runtime data。禁止对象的 INSERT/UPDATE/DELETE/DDL/role-assumption 必须全部失败。

## 17.3.1 Business schema structure 与 privilege graph 分离证明

PR-1 会创建 role 并执行 GRANT/REVOKE，因此 ACL 图必然发生授权范围内的变化。不得使用包含 ACL 的单一 schema digest 同时声称“零 schema delta”。

机器政策：

```text
GEOX-MCFT-CAP-08-SCHEMA-PRIVILEGE-DIGEST-POLICY-V1.json
```

必须定义：

```text
business_schema_structure_digest
- relations
- columns/types/defaults/nullability
- constraints
- indexes
- functions/triggers definitions
- excludes ACL, ownership, role membership, comments

privilege_graph_digest
- role attributes
- memberships
- database/schema/relation/sequence/function ACL
- default privileges
```

验收：

```text
business_schema_structure_digest_before
=
business_schema_structure_digest_after

actual_privilege_delta_digest
=
expected_privilege_delta_digest

expected_privilege_delta_digest =
hash(normalized privilege-delta projection derived from
GEOX-MCFT-CAP-08-WRITER-AUTHORITY-V1)
```

所有未在 writer authority allowlist 中出现的 privilege delta 都必须 fail closed。

## 17.4 Scope/run-contract enforcement：选择应用层 + canonical validation + CAS

本任务线明确选择：

```text
DATABASE_ROLE_BOUNDARY:
RELATION_LEVEL_LEAST_PRIVILEGE_ONLY

SIX_KEY_SCOPE_ENFORCEMENT:
APPLICATION_INPUT_VALIDATION

FORMAL_RUN_ID_ENFORCEMENT:
RUN_CONTRACT_VALIDATION

LINEAGE_REVISION_ENFORCEMENT:
CANONICAL_IDENTITY_VALIDATION
+
REPOSITORY_CAS_AND_FENCING

DIRECT_SQL_ROW_LEVEL_SCOPE_ISOLATION:
NOT_ESTABLISHED
```

数据库 role 本身不能证明只允许：

```text
tenantA
projectA
field_c8_demo
one formal_run_id
one lineage/revision
```

因此不得作出 DB-native row isolation claim。S1 及后续实现必须通过 bounded runner service 和 repository 证明：

```text
exact six-key scope required
formal_run_id equals frozen run contract
lineage/revision equals active authority
checkpoint/state/forecast predecessor refs and hashes exact
wrong scope fails before write
wrong run ID fails before write
wrong lineage/revision fails before write
stale checkpoint or fencing token fails closed
idempotent identity conflict fails closed
```

若未来要求数据库原生 row-level scope isolation，必须另立 authority，允许 RLS、session-bound scope guard 或 SECURITY DEFINER transaction API；不得把该能力追认到 MCFT-CAP-08。

## 17.5 Runtime authority

```text
one-shot formal runner:
authorized only by external PR-1 exact-SHA effective projection
and only after target database bootstrap verification

public HTTP writer:
never authorized in CAP-08

background scheduler:
never authorized in CAP-08

live source:
never authorized in CAP-08

production Runtime database role:
not authorized as CAP-08 writer
```

---

# 18. 对象与事务复用

默认复用：

```text
twin_runtime_lineage_v1
twin_runtime_config_v1
twin_runtime_tick_v1
twin_runtime_checkpoint_v1
twin_evidence_window_v1
twin_state_transition_v1
twin_assimilation_update_v1
twin_state_estimate_v1
twin_forecast_run_v1
twin_scenario_set_v1
twin_decision_record_v1
twin_action_feedback_v1
twin_forecast_residual_v1
twin_calibration_candidate_v1
twin_shadow_evaluation_v1
twin_runtime_health_v1
```

事务族：

```text
A_STATE_TICK_COMMIT
B_SCENARIO_COMMIT
C_FORECAST_RESIDUAL_COMMIT
D_MODEL_GOVERNANCE_STEP_COMMIT
F operational evidence
G_HUMAN_DECISION_LINK_COMMIT
H_ACTION_FEEDBACK_COMMIT
Replay Evidence ingress
```

默认：

```text
new canonical object type:
NONE

new transaction family:
NONE
```

允许的设计变化仅包括：

```text
existing object additive profile/version
bounded application orchestration
zero-write progress resolver
bounded writer role
```

---

# 19. Formal 24-Tick Event Plan

S0 必须把本表及 §6.6 的 per-phase due-obligation map 物化为同一个机器可读 run contract。

| Tick | 事件 | 关键证明 |
|---:|---|---|
| B00 | Formal bootstrap root | same lineage/revision；full persisted handoff；不计入 24 Tick |
| T00 | first successful State/Forecast/Scenario | F00 established；FVO-01 target=T01 |
| T01 | FVO-01 observed but unavailable；NO_OBSERVATION State Tick | no-future；late evidence hidden |
| T02 | FVO-02 normal PASS observation | ordinary accepted assimilation；R-02 |
| T03 | FVO-03 LIMITED | downweighted assimilation；R-03 |
| T04 | FVO-04 valid + competing invalid observation | valid selection；invalid rejection；R-04 |
| T05 | after B, Replay Human Decision G | Scenario ≠ Recommendation；Decision ≠ Approval |
| T06 | Approval Assertion + Plan Evidence visible | evidence separation |
| T07 | physical execution occurs, receipt unavailable | no premature State consumption |
| T08 | H Action Feedback before A | executed amount enters first legal interval |
| T09 | post-execution outcome interval underway；FVO-10 not observed and not available | no premature outcome use；R-09 only |
| T10 | Outcome Observation = FVO-10；A ordinary update；B；C R-10 | one Evidence identity serves State assimilation and Forecast evaluation |
| T11 | pre-commit fault + retry；process A final full barrier | rollback；one result |
| T12 | process B fresh start；post-commit response-loss probe | DB-only recovery |
| T13 | normal Tick | persisted continuity |
| T14 | FVO-01 still unavailable | no-future |
| T15 | FVO-01 still unavailable | no-future |
| T16 | FVO-01 late + FVO-16 residual-only；A late correction；B；C R-01 + R-16 | full posterior transport；two due Residual；history immutable |
| T17 | consume T16 corrected posterior | persisted correction handoff |
| T18 | normal Tick | progress resolver |
| T19 | normal Tick | Candidate absent |
| T20 | normal Tick | Shadow absent |
| T21 | normal Tick | active config base |
| T22 | designated final ordinary observation update | latest ordinary correction |
| T23 | final successful State/Forecast/Scenario/Checkpoint | F23 target=T24；24th Tick |
| G00 | FVO-24 at T24；R-24；read 24 Residual | no T24 Runtime Tick |
| G01 | Candidate D | exactly one；not active |
| G02 | Shadow D | exactly one；non-consumption |

---

# 20. Delivery Graph：一个 Registry Bootstrap PR + 七个 authoritative delivery PR

为避免切片实现顺序与最终事件时序互相污染，本版先冻结三类 run。

## 20.1 Run classification

### A. `S0_PLATFORM_SECURITY_ACCEPTANCE_RUN`

只用于 PR-1：

```text
disposable PostgreSQL
no CAP-08 canonical Runtime chain
role bootstrap/catalog/negative probes
machine contract qualification
business schema structural digest equality
zero canonical Runtime data delta
```

### B. `SLICE_ACCEPTANCE_RUN`

只用于 PR-2～PR-6：

```text
dedicated acceptance run_id
dedicated fresh disposable PostgreSQL database
dedicated lineage/revision when canonical writes are required
not final_formal_run_id
not closure evidence
not reusable by PR-7
not eligible for candidate declaration
isolated-schema mode forbidden until separately established
```

每个 slice acceptance 可以验证本切片实现，但必须保留：

```text
FINAL_FORMAL_CLOSURE_NOT_EXECUTED
```

### C. `FINAL_FORMAL_CLOSURE_RUN`

这是只允许 PR-7 创建的 run class。为满足 determinism acceptance，PR-7 必须执行两个完整实例：

```text
semantic formal_run_id:
same deterministic scope+dataset+config identity in A and B

operational run_instance_id:
distinct A / B values
excluded from semantic digest

FINAL_FORMAL_CLOSURE_RUN_A:
fresh PostgreSQL
canonical closure candidate chain

FINAL_FORMAL_CLOSURE_RUN_B:
second fresh PostgreSQL
determinism verification chain
not stitched with A
```

两个实例都必须满足：

```text
new formal lineage inside its own database
one frozen revision
B00 then T00-T23 then G00-G02
all E/H/A/B/G/C/D/F obligations enabled from the beginning
no reuse of PR-2 ... PR-6 canonical objects
no cross-run object or projection stitching
```

`RUN_A` 是 closure candidate subject；`RUN_B` 只证明 deterministic equivalence。只有 PR-7 的 run set 有资格用于 HA-01～HA-24 和 closure declaration。

## 20.2 PR-0 / P-1B — Candidate Registry Bootstrap

```text
modify only trusted Candidate Registry by default
pre-register PR-1 Current Authority status candidate
freeze PR-1 focused/standard workflow names
no CAP-08 status JSON
no Candidate Declaration
no Runtime source
no database role or ACL delta
standard protected merge
```

Exit condition：CAP-08 PR-1 candidate rule is present on main and trusted by subsequent PR target-branch integrity checks.

## 20.3 PR-1 — AR-0 + P-1 + S0 + SG-1 + PS-0 + AT-0

```text
authority reconciliation
Master/Matrix/Map synchronization
CAP-04 non-mutating successor reconciliation
CAP-07 predecessor consumption
taskbook freeze candidate
Reality/dataset/run contract machine freeze
pure late math qualification
micro-sequence machine file
progress-resolver canonical predicate definitions
digest policy machine file
bounded writer exact relation authority
application/CAS scope enforcement contract
external-admin platform role bootstrap
CAP-08 exact-SHA workflow and artifact transport
create S1 non-candidate delivery-status seed
register S1 candidate rule for PR-2
no Runtime domain code
no business schema
no canonical Runtime data
no final formal run
```

## 20.4 PR-2 — S1 Base 24-Tick Runtime Implementation

前置条件：

```text
PR-0 Registry bootstrap protected merge:
PASS

PR-1 protected merge:
PASS

PR-1 exact-SHA artifact/readback:
PASS

effective_next_slice:
S1

taskbook_status_when_attested:
FROZEN_TASKBOOK

target database bounded writer bootstrap:
PROVISIONED_AND_VERIFIED
```

范围：

```text
implement B00 and T00-T23 base State/Forecast/Scenario capability
implement Cap08TickPhasePlanV1
implement Cap08DueObligationSetV1
implement Cap08TickBarrierV1
implement stable resolve/E/H/A/B/G/C/barrier range engine
implement empty G/H/C providers for S1
emit phase_engine_contract_digest
emit phase_engine_source_digest for audit
validate with fresh-database SLICE_ACCEPTANCE_RUN
no final_formal_run_id
create S2 non-candidate delivery-status seed
register S2 candidate rule for PR-3
no Decision/Action/late/Residual/Calibration closure claim
```

PR-2 不得把其 24 Tick acceptance chain 当作最终 formal chain；否则 PR-3/PR-4 无法合法把 H(T08)、Outcome(T10) 和 late correction(T16) 放入 A snapshot 前后的正确位置。

PR-2 的 range engine 必须是后续切片的稳定骨架。PR-3～PR-5 只能新增 obligation/update providers，不能重写 phase engine contract；后续 acceptance 必须验证 `phase_engine_contract_digest` 保持不变。

## 20.5 PR-3 — S2 Replay Decision/Execution/Outcome

```text
implement G/H obligation providers
Outcome Evidence = FVO-10 identity
ordinary outcome Assimilation
Action Feedback ordering
preserve phase_engine_contract_digest
record phase_engine_source_digest and explain any source delta
validate using fresh-database SLICE_ACCEPTANCE_RUN
create S3 non-candidate delivery-status seed
register S3 candidate rule for PR-4
no reuse as final closure evidence
```

## 20.6 PR-4 — S3 Recovery and Late Evidence

```text
implement fresh-process recovery provider
progress resolver
pre-commit failure
response-loss
concurrency
A late-update profile provider
full posterior transport late correction
pass shared late-correction test vectors unchanged
preserve phase_engine_contract_digest
record phase_engine_source_digest and explain any source delta
validate using fresh-database SLICE_ACCEPTANCE_RUN
no historical rewrite
create S4 non-candidate delivery-status seed
register S4 candidate rule for PR-5
no reuse as final closure evidence
```

## 20.7 PR-5 — S4 Residual / Calibration / Shadow

```text
implement C Residual obligation provider for R-01 ... R-24
implement post-run D Candidate/Shadow provider
freeze 16+8 windows
Candidate
Shadow
non-consumption
preserve phase_engine_contract_digest
record phase_engine_source_digest and explain any source delta
validate using fresh-database SLICE_ACCEPTANCE_RUN
no Model Activation
create S5 non-candidate delivery-status seed
register S5 candidate rule for PR-6
no reuse as final closure evidence
```

## 20.8 PR-6 — S5 Read Model and Operator Integration

```text
ten Runtime surfaces
Timeline/Trace/pagination
scope navigator regression
zero-write product read
validate against fresh-database full-feature SLICE_ACCEPTANCE_RUN
create S6 non-candidate delivery-status seed
register S6 final candidate rule for PR-7
no final closure declaration
```

## 20.9 PR-7 — S6 Final Closure

PR-7 必须从空白正式环境重新执行，不得拼接前六个 PR 的 canonical outputs。PR-7 不得创建或注册 MCFT-CAP-09 authority、status seed 或 candidate rule。

本任务线选择：

```text
CANDIDATE_HEAD_FULL_RUN_PLUS_TREE_EQUIVALENT_MERGE_ATTESTATION
```

Candidate head 阶段：

```text
two independent fresh PostgreSQL databases or serially recreated fresh databases
external-admin bounded writer bootstrap and verification in each database
one shared deterministic formal_run_id
separate operational run_instance_id A/B
new formal lineage/revision in each database
formal B00
T00-T23 with G/H/C/late barriers active from the beginning
G00-G02
all 24 Hard Acceptance in RUN_A
same semantic and operational invariant digests in RUN_B
zero cross-run object stitching
candidate closure artifact produced for candidate_head_sha/tree
closure_candidate_subject_sha = candidate_head_sha
any candidate-head change invalidates RUN_A / RUN_B evidence
```

Protected merge 后，exact merge-SHA workflow 不重复两个完整 run，而是必须：

```text
record candidate_head_sha and candidate_tree_sha
record merge_commit_sha and merge_tree_sha
prove candidate_to_merge_tree_delta = 0
prove attested_tree_sha = merge_tree_sha
revalidate candidate closure artifact file/digest refs against merge tree
revalidate required checks and merge-group tree when applicable
upload/read back immutable R2 artifact for merge SHA
produce external completion projection for merge SHA
```

若 candidate tree 与 merge tree 不等价：

```text
candidate closure evidence projection:
FORBIDDEN

MCFT-CAP-08 completion:
NOT_EFFECTIVE

required action:
refresh candidate and rerun RUN_A / RUN_B
```

PR-7 closure artifact 至少保存：

```text
candidate_head_sha
candidate_tree_sha
merge_commit_sha
merge_tree_sha
candidate_to_merge_tree_delta = 0
attested_tree_sha = merge_tree_sha
merge_group_tree_sha when applicable
RUN_A locator/digests
RUN_B locator/digests
semantic_chain_digest equality
operational_invariant_digest equality
closure_digest equality
HA ledger digest
required check results
R2 retention locator/readback
```

禁止任何额外：

```text
proof carrier
temporary source PR
dual candidate tree
postmerge manual proof PR
slice acceptance object promoted into final closure chain
candidate artifact projected across nonzero merge-tree delta
```

# 21. Slice Exit Gates

PR-2～PR-6 的 exit gate 证明“实现切片可用”，不证明最终 formal chain 已建立。

## 21.1 PR-2 / S1

```text
base B00 implementation:
PASS

base 24-Tick range implementation:
PASS

SLICE_ACCEPTANCE_RUN successful Tick:
24

new State:
24

successful Forecast:
24

Scenario Set:
24

stable phase skeleton:
PASS

phase_engine_contract_digest:
FROZEN

empty G/H/C providers:
PASS

final_formal_run_id created:
false

Restart/late/action/residual/calibration closure claims:
false

S2 successor status seed:
CREATED_NON_CANDIDATE

S2 Registry rule for PR-3:
PRESENT_IN_CANDIDATE_TREE_FOR_POSTMERGE_TRUST
```

## 21.2 PR-3 / S2

```text
fresh-database replay episode acceptance:
PASS

Replay Decision:
1

Approval Assertion:
1

Approved Plan:
1

Execution Receipt:
1

Action Feedback:
1

Outcome:
>=1

micro-sequence G/H ordering:
PASS

phase_engine_contract_digest unchanged:
PASS

final closure evidence:
false

AO-ACT:
0

Dispatch:
0

S3 successor status seed:
CREATED_NON_CANDIDATE

S3 Registry rule for PR-4:
PRESENT_IN_CANDIDATE_TREE_FOR_POSTMERGE_TRUST
```

## 21.3 PR-4 / S3

```text
fresh-database fresh-process resume:
PASS

progress resolver:
PASS

pre-commit rollback:
PASS

response-loss recovery:
PASS

concurrency:
PASS

late temporal correction:
PASS

shared late-correction test vectors:
PASS

phase_engine_contract_digest unchanged:
PASS

historical rewrite:
0

S4 successor status seed:
CREATED_NON_CANDIDATE

S4 Registry rule for PR-5:
PRESENT_IN_CANDIDATE_TREE_FOR_POSTMERGE_TRUST

final closure evidence:
false
```

## 21.4 PR-5 / S4

```text
fresh-database Residual:
24

Calibration:
16

Holdout:
8

Candidate:
1

Shadow:
1

Activation:
0

phase_engine_contract_digest unchanged:
PASS

S5 successor status seed:
CREATED_NON_CANDIDATE

S5 Registry rule for PR-6:
PRESENT_IN_CANDIDATE_TREE_FOR_POSTMERGE_TRUST

final closure evidence:
false
```

## 21.5 PR-6 / S5

```text
CAP-07 surfaces:
PASS

Timeline full-feature slice dataset:
PASS

Operator route:
PASS

zero-write:
PASS

S6 successor status seed:
CREATED_NON_CANDIDATE

S6 Registry rule for PR-7:
PRESENT_IN_CANDIDATE_TREE_FOR_POSTMERGE_TRUST

final closure evidence:
false
```

## 21.6 PR-7 / S6

```text
fresh final database:
PASS

shared deterministic formal_run_id:
PASS

RUN_A / RUN_B operational instance separation:
PASS

fresh database per complete run:
PASS

zero slice-output or cross-run object reuse:
PASS

formal B00 + T00-T23 + G00-G02 in both runs:
PASS

semantic determinism:
PASS

operational invariant determinism:
PASS

24 HA:
PASS

MCFT-CAP-09 status seed / Registry rule:
ABSENT

protected merge:
PASS

candidate_tree_sha = merge_tree_sha:
PASS

candidate_to_merge_tree_delta:
0

attested_tree_sha = merge_tree_sha:
PASS

exact merge-SHA R2 artifact/readback:
PASS
```

---

# 22. Master Hard Acceptance

| # | Item ID | Requirement |
|---:|---|---|
| 01 | `HA-01` | 两次完整 run 的 `semantic_chain_digest`、`operational_invariant_digest` 和 `closure_digest` 一致；raw operational instance metadata 不要求逐字节一致。 |
| 02 | `HA-02` | B00 建立完整 formal bootstrap root；T00–T23 exactly 24 successful committed hourly Tick；同 lineage/revision；无小时跳跃。 |
| 03 | `HA-03` | 每个 Tick 产生新的 immutable State，并引用 previous State、Evidence Window、Transition、Assimilation、Model/Config。 |
| 04 | `HA-04` | 无 observation Tick 使用 Dynamics-only progression，uncertainty 按冻结数学变化。 |
| 05 | `HA-05` | ordinary valid observation 形成 predicted observation、Innovation、Assimilation 和 posterior。 |
| 06 | `HA-06` | posterior 不得直接覆盖为 observation；所有等值必须有数学证明。 |
| 07 | `HA-07` | LIMITED、spatial mismatch、unit invalid、stale 或异常 observation 被 downweight/reject。 |
| 08 | `HA-08` | T00–T23 每 Tick exactly one successful 72-point Forecast。 |
| 09 | `HA-09` | 每个 Forecast exactly one three-option Scenario Set：0/15/25 mm。 |
| 10 | `HA-10` | Evidence cutoff 后才 available 的 observation 不得被当前 Tick 消费。 |
| 11 | `HA-11` | Observed weather 与 Assumed future weather refs 可区分。 |
| 12 | `HA-12` | Scenario、Decision、Approval Assertion、Plan、Execution Receipt、Action Feedback、Outcome 保持独立。 |
| 13 | `HA-13` | approved、executed、coverage、target-scope-equivalent amount 分别保存。 |
| 14 | `HA-14` | H 必须在 A snapshot 前 commit 才能被同 Tick Dynamics 消费；否则推迟至下一 Tick。 |
| 15 | `HA-15` | T10 Outcome Observation 与 FVO-10 为同一 canonical Evidence identity；A ordinary update、B Scenario、C exactly one R-10 按 micro-sequence 完成。 |
| 16 | `HA-16` | ordinary或late Assimilation 均不得修改 active Model/Config/lineage authority。 |
| 17 | `HA-17` | T00–T23 Forecast 与 FVO-01–24 一一映射；due-obligation map exact；T16 commits R-01 and R-16；total exactly 24 Residual；16+8 ordered windows、zero overlap。 |
| 18 | `HA-18` | Candidate 与 8-case Shadow persisted；Candidate not active；active config unchanged。 |
| 19 | `HA-19` | fresh process 仅依赖数据库和 deterministic progress resolver 继续，覆盖 H/A/B/G/C/D pending states。 |
| 20 | `HA-20` | FVO-01 在 T16 使用 full posterior-to-posterior sensitivity 的 `LATE_OBSERVATION_APPEND_FORWARD_CORRECTION_V1`；FVO-16 residual-only；历史 hash 不变；next Tick 消费 corrected posterior。 |
| 21 | `HA-21` | Forecast、Scenario、Decision、Plan 不得创建 Recommendation、AO-ACT、Dispatch 或设备命令。 |
| 22 | `HA-22` | pre-commit、response-loss、concurrency、retry 不产生 partial/duplicate Tick、Fact、Projection 或 pointer。 |
| 23 | `HA-23` | B00、24 Tick、24 Forecast/Scenario、Replay episode、24 Residual、Candidate、Shadow、restart/late trace 全链可追溯。 |
| 24 | `HA-24` | Operator 通过 pagination/range 读取完整链；所有产品 GET 前后 write delta=0。 |

Ledger 唯一主键：

```text
item_id
```

---

# 23. Cardinality Oracle

```text
formal bootstrap Runtime root:
exactly 1

bootstrap State:
exactly 1

bootstrap Tick:
exactly 1

bootstrap Checkpoint:
exactly 1

bootstrap Forecast result:
exactly 1
not counted as successful CAP-08 Forecast

successful committed T00-T23 Tick:
exactly 24

new posterior State:
exactly 24

bootstrap-inclusive State:
exactly 25

successful Forecast:
exactly 24

Forecast points:
exactly 1728

Scenario Set:
exactly 24

Scenario options:
exactly 72

Scenario trajectory points:
exactly 5184

Forecast Verification Observation:
exactly 24

Forecast Residual:
exactly 24

Replay Human Decision:
exactly 1

Replay Approval Assertion:
exactly 1

Replay Approved Plan:
exactly 1

Replay Execution Receipt:
exactly 1

Action Feedback:
exactly 1

Outcome Observation:
at least 1

Calibration cases:
exactly 16

Holdout cases:
exactly 8

Calibration Candidate:
exactly 1

Shadow Evaluation:
exactly 1

Model Activation:
exactly 0

active Runtime Config switch:
exactly 0

Recommendation:
exactly 0

AO-ACT:
exactly 0

Dispatch:
exactly 0
```

---

# 24. CAP-07 Read Model 与 Operator

## 24.1 Ten canonical GET surfaces

```text
/runtime
/runtime/states
/runtime/forecasts
/runtime/scenarios
/runtime/action-lifecycle
/runtime/residuals
/runtime/model-governance
/runtime/trace
/runtime/timeline
/runtime/health
```

## 24.2 Scope paths

```text
GET /api/v1/fields
GET /api/v1/fields/:field_id/runtime-scope-options
/operator/fields
```

要求：

```text
operator_token:
200

write-only token:
403

formal Field/Season:
discoverable

heavy Field Detail aggregate:
not consumed
```

## 24.3 最小产品语义

MCFT-CAP-08 只需新增：

```text
24-Tick chronological grouping
State evolution
Forecast/Scenario evolution
ordinary vs late correction
Replay action episode
restart/failure boundaries
Candidate/Shadow non-activation
load-more / fixed-root pagination
```

不做全面产品化。MCFT-CAP-08 后进入：

```text
OPX-A — Product Foundation
```

---

# 25. CI 与交付纪律

## 25.1 PR-1 S0 preflight

PR-1 必须在根 `package.json` 冻结：

```text
pnpm mcft:cap08:preflight:s0
```

只覆盖：

```text
authority consistency
CAP-07 R2 consumption/readback
latest-main alignment
CAP-04 taskbook byte preservation
changed-file boundary
server typecheck/build for platform bootstrap source
machine-readable JSON/schema validation
B00/FVO/run-classification contract validation
pure late-correction math qualification using shared test vectors
full posterior transition sensitivity vectors including intermediate ordinary Assimilation
micro-sequence and per-phase due-obligation contract validation
phase orchestration skeleton contract validation
progress-resolver predicate schema/query qualification
digest policy validation
disposable PostgreSQL platform bootstrap
catalog grants/revokes equality
negative privilege probes
business schema structural digest equality
expected versus actual privilege-graph delta equality
candidate/merge tree-equivalence contract selfcheck
zero canonical Runtime data delta
exact-SHA artifact construction selfcheck
```

必须明确不覆盖：

```text
B00 canonical Runtime execution
T00-T23
G00-G02
Replay action episode persisted closure
late correction Runtime persistence
24 Residual
Candidate/Shadow Runtime chain
Timeline closure
HA-01 ... HA-24
```

## 25.2 Slice preflights

PR-2～PR-6 各自必须有 slice-specific preflight。它们必须：

```text
create SLICE_ACCEPTANCE_RUN
use a new fresh disposable PostgreSQL database for every run
forbid isolated-schema substitution
set final_formal_run_id = null
emit slice_acceptance_only = true
preserve FINAL_FORMAL_CLOSURE_NOT_EXECUTED
```

不得使用统一脚本把切片证据伪装成完整 closure evidence。

## 25.3 Closure preflight

仅 PR-7 允许冻结并执行：

```text
pnpm mcft:cap08:preflight:closure
```

覆盖：

```text
two fresh PostgreSQL run instances
fresh target-database writer bootstrap in each instance
shared deterministic formal_run_id
separate operational run_instance_id A/B
formal B00 in each run
T00-T23 in each run
Replay Decision/Execution/Outcome
restart/failure/response-loss/concurrency
late correction
R-01 ... R-24
16+8
Candidate/Shadow
server/web
CAP-07 readback
scope navigator
24-Tick Timeline
semantic_chain_digest
operational_invariant_digest
closure_digest
HA-01 ... HA-24
```

## 25.4 Workflow transport

PR-1 必须建立两个独立 workflow：

```text
mcft-cap-08-authority-reconciliation.yml
→ PR/exact-candidate validation
→ S0 preflight only

mcft-cap-08-exact-sha-attestation.yml
→ push main / workflow_dispatch exact SHA
→ trusted current-main attestation implementation
→ read-only subject proof
→ candidate-tree / merge-tree equivalence proof
→ artifact digest revalidation against attested merge tree
→ immutable R2 upload/readback
→ commit status publication
```

Exact-SHA workflow 不得复用 CAP-07 专用 status context 或 artifact identity。

## 25.5 Workflow modes

```text
EXACT_CANDIDATE_MODE
SUCCESSOR_REGRESSION_MODE
MERGE_GROUP_MODE
CANDIDATE_MERGE_TREE_EQUIVALENCE_MODE
SKIP_SUCCESS
EXACT_MERGE_SHA_ATTESTATION_MODE
```

## 25.6 禁止

```text
CI source transport
temporary source-export workflow
proof-only PR
second candidate tree
stale predecessor seed applied to successor
manual rewrite of authority after merge
postmerge Registry mutation
candidate artifact projected across nonzero merge-tree delta
slice acceptance promoted to closure evidence
PR-1 execution of final Runtime chain
```

---

# 26. Local Acceptance

## 26.1 PR-1 Windows PowerShell acceptance

PR-1 必须产出 Windows PowerShell 可执行流程：

```text
exact head checkout
clean disposable PostgreSQL
pnpm mcft:cap08:preflight:s0
external-admin platform bootstrap
bounded writer-role catalog verification
negative privilege probes
machine contract validation
pure late math qualification from shared test vectors
business schema structural digest equality
expected/actual privilege-graph delta equality
candidate/merge tree-equivalence selfcheck
zero canonical Runtime data delta
exact-SHA artifact construction selfcheck
```

PR-1 local acceptance 禁止：

```text
formal B00 Runtime execution
T00-T23
G00-G02
24-Tick Timeline
closure digest
HA-01 ... HA-24
```

## 26.2 PR-2～PR-6 local acceptance

每个切片运行必须使用：

```text
new fresh disposable PostgreSQL database
full migration/bootstrap for that database
slice-specific run_id
slice-specific lineage/revision when required
slice_acceptance_only=true
final_formal_run_id=null
```

当前不允许以 isolated schema 替代 fresh database。只有另行建立以下能力后才可重新讨论：

```text
schema-qualified repository abstraction
search_path isolation
migration isolation
role privilege isolation
```

PR-3～PR-5 还必须验证：

```text
phase_engine_contract_digest unchanged
only obligation/update providers changed
```

## 26.3 PR-7 closure local acceptance

只有 PR-7 执行：

```text
two clean disposable PostgreSQL runs
platform bootstrap and grant verification in each run
pnpm mcft:cap08:preflight:closure
shared deterministic formal_run_id
separate operational run_instance_id A/B
B00 in each run
T00-T23 in each run
G00-G02 in each run
server/web
scope navigator
24-Tick Timeline
zero-write read probe
semantic/operational/closure digest verification
```

Cleanup：

```text
DISPOSABLE_LOCAL_DATABASE_OR_VOLUME_ONLY
```

不得为 append-only formal facts 提供 surgical DELETE。

---

# 27. Completion Declaration

仅在 PR-7 exact merge-SHA R2 attestation PASS 后：

```text
MCFT-CAP-08:
COMPLETE

canonical_name:
24-Tick End-to-End Closure

completion_level:
STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE

authority_reconciliation:
PASS

formal_bootstrap_root:
PASS

successful_committed_ticks:
24

successful_forecasts:
24

scenario_sets:
24

forecast_verification_observations:
24

forecast_residuals:
24

calibration_cases:
16

holdout_cases:
8

replayed_decision_execution_outcome_episode:
PASS

fresh_process_restart:
PASS

late_append_forward_correction:
PASS

semantic_determinism:
PASS

operational_invariant_determinism:
PASS

candidate:
PASS

shadow:
PASS

candidate_consumed:
false

model_activation:
false

CAP-07 readback:
PASS

Operator full-chain Timeline:
PASS

product_read_write_delta:
0

long_horizon_720_tick_qualification:
false

extended_five_scenario_qualification:
false

historical_revision_reprocessing:
false

shadow_online:
false

controlled_action_feedback_1C:
false

minimum_complete_field_twin_complete:
false

MCFT-CAP-09 authorized:
false
```

---

# 28. Completion Nonclaims

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

# 29. Freeze Gate

本文件从：

```text
REGISTRY_BOOTSTRAP_GRAPH_FROZEN_PENDING_PR_0_EFFECTIVENESS
```

转为外部有效：

```text
FROZEN_TASKBOOK
```

必须满足：

1. PR-1 更新 Master；
2. Stage-1 Closure Authority V2 建立；
3. old 720/five-scenario/revision 要求完成重分类；
4. Matrix 同步至 CAP-07 complete / CAP-08 conditional candidate frontier；
5. Implementation Map 同步；
6. CAP-04 successor reconciliation 独立文件建立，历史 taskbook byte-unchanged；
7. PR-0 / P-1B 已先行 protected merge，使 trusted main Registry 预登记 PR-1 Current Authority 的唯一 candidate signal；PR-1 仅登记 S1 后继 candidate signal，所有显式 delivery candidate signal 都使用对象式 rule，非候选 authority fields 由 S0 machine contract、semantic snapshot、focused acceptance、finalizer 与 exact-SHA attestation 校验；
8. CAP-07 R2 artifact 可读且 authorized-store readback PASS；
9. B00 full root machine-readable freeze；
10. FVO-01–24 mapping、T10 Outcome=FVO-10 identity、T16 R-01+R-16 due-obligation map machine-readable freeze；
11. full posterior-to-posterior late correction math qualification PASS；shared test vectors frozen，含 intermediate ordinary Assimilation；
12. transaction micro-sequence 与 stable phase orchestration skeleton machine-readable freeze；
13. progress resolver canonical predicates frozen and query-qualified，且不执行 CAP-08 final Runtime chain；
14. digest policy 和 run classification machine-readable freeze；
15. platform bootstrap capability 有效；fresh disposable acceptance DB role provisioned；business schema structural digest unchanged；actual privilege delta equals Writer Authority；negative probes PASS；per-fresh-database bootstrap precondition frozen；
16. exact changed-file boundary 冻结，包含 package script、CAP-08 workflows、tree-equivalence contract/acceptance、shared late vectors、phase skeleton、schema/privilege digest policy、attestation/finalizer、bootstrap acceptance、S1 delivery-status seed；PR-1 Candidate Declaration exact 20-file semantic snapshot set frozen；
17. PR-1 protected merge、candidate_tree = merge_tree、candidate_to_merge_tree_delta = 0、exact merge-SHA attestation PASS、immutable R2 upload/readback PASS，artifact external effective projection 指向 S1。

任一失败：

```text
implementation_status:
NOT_AUTHORIZED

PR_2_S1_RUNTIME_AUTHORIZED:
false
```

---

# 30. 当前裁决

```text
THREE_WAY_ALIGNMENT:
NOT_YET_EFFECTIVE

REPOSITORY_FACT_ALIGNMENT:
PASS

REPOSITORY_SSOT_DRIFT:
CONFIRMED

AUTHORITY_RECONCILIATION_STRATEGY:
OPTION_B

TASKBOOK_ARCHITECTURE_DIRECTION:
PASS

TASKBOOK_INTERNAL_CONSISTENCY:
PASS

P0_BLOCKERS:
0

P1_FREEZE_OBLIGATIONS:
FROZEN_PENDING_PR_1_REPOSITORY_PROOF

PR_1_SCOPE_COHERENCE:
PASS

PR_1_CHANGED_FILE_BOUNDARY_MODEL:
FROZEN

CANDIDATE_REGISTRY_TRANSITION_SCHEMA:
DELIVERY_CANDIDATE_SIGNAL_ONLY_OBJECT_REGISTRATION_FROZEN

REGISTRY_BOOTSTRAP_MODEL:
PR_0_P_1B_FROZEN

PER_SLICE_CANDIDATE_AUTHORITY_GRAPH:
S1_THROUGH_S6_SUCCESSOR_PRE_REGISTRATION_FROZEN

PR_1_SEMANTIC_SNAPSHOT_SET:
EXACT_20_FILES_FROZEN

EXTERNAL_EFFECTIVENESS_PROJECTION_MODEL:
FROZEN

CANDIDATE_MERGE_TREE_EQUIVALENCE_MODEL:
FROZEN

SLICE_ACCEPTANCE_RUN_ISOLATION:
FRESH_DISPOSABLE_POSTGRESQL_DATABASE_ONLY

FINAL_FORMAL_RUN_AUTHORITY:
PR_7_ONLY

WRITER_SCOPE_ENFORCEMENT:
APPLICATION_VALIDATION_PLUS_CANONICAL_IDENTITY_PLUS_REPOSITORY_CAS

DATABASE_ROW_LEVEL_SCOPE_ISOLATION:
NOT_ESTABLISHED

SCHEMA_PRIVILEGE_PROOF_MODEL:
STRUCTURE_DIGEST_EQUALITY_PLUS_EXACT_PRIVILEGE_DELTA

FVO_BOOTSTRAP_GAP:
RESOLVED_BY_B00_AND_FVO_01_TO_24

FVO_RESIDUAL_DUE_MAP:
FROZEN

LATE_EVIDENCE_MATH:
FULL_POSTERIOR_TO_POSTERIOR_SENSITIVITY_FROZEN

LATE_CORRECTION_SHARED_TEST_VECTORS:
REQUIRED_AND_FROZEN_IN_PR_1

TRANSACTION_MICRO_SEQUENCE:
DEFINED

PHASE_ORCHESTRATION_SKELETON:
FROZEN_FOR_PR_2_IMPLEMENTATION

PHASE_ENGINE_STABILITY_PROOF:
CONTRACT_DIGEST_GATING_PLUS_SOURCE_DIGEST_AUDIT

PROGRESS_RESOLVER_STATE_MACHINE:
DEFINED

PROGRESS_RESOLVER_CANONICAL_PREDICATES:
PENDING_S0_MACHINE_READABLE_FREEZE

DETERMINISM_DOMAIN_SPLIT:
DEFINED

FREEZE_GATE_EFFECTIVE_COMPLETION:
1_OF_17

READY_TO_CREATE_PR_0_BRANCH:
YES

READY_TO_OPEN_REGISTRY_BOOTSTRAP_PR:
YES

READY_TO_OPEN_AUTHORITATIVE_PR_1:
NO_PENDING_PR_0_PROTECTED_MERGE

TASKBOOK_FREEZE_APPROVAL:
PENDING_PR_1_EXACT_SHA_EFFECTIVENESS

IMPLEMENTATION_AUTHORIZED:
FALSE

PR_2_S1_RUNTIME_AUTHORIZED:
FALSE

FIRST_LEGAL_ACTION:
PR-0 / P-1B MCFT-CAP-08 CANDIDATE REGISTRY BOOTSTRAP

PR_1_OPEN_BEFORE_PR_0_EFFECTIVE:
FORBIDDEN

RUNTIME_SOURCE_CHANGE_BEFORE_PR_1_EFFECTIVE:
FORBIDDEN
```

# 30.1 实施启动边界

本文件经项目负责人批准后可以立即开始：

```text
PR-0 branch creation
PR-0 exact Registry-only edit
standard CI and Candidate Detector non-declaration proof
PR-0 protected merge
```

PR-0 merge 前不得开始：

```text
authoritative PR-1 candidate declaration
CAP-08 Current Authority creation
S0 machine-readable artifacts in an authoritative candidate PR
platform-security role bootstrap
CAP-08 exact-SHA authority workflow candidate execution
```

PR-0 protected merge 后，才可以开始：

```text
PR-1 branch creation from updated main
PR-1 authority reconciliation edits
S0 machine-readable artifact implementation
S1 delivery-status seed and successor Registry rule
platform-security role bootstrap implementation
CAP-08 exact-SHA workflow implementation
PR-1 focused S0 acceptance
```

PR-1 完成后仍不得开始：

```text
formal B00 Runtime execution
T00-T23 Runtime orchestration
A/B/C/D/G/H canonical transaction execution
late correction Runtime implementation
CAP-08 public route
background worker
PR-2/S1 source changes
```

PR-2/S1 的唯一授权事件是：

```text
PR-0 Registry bootstrap present on trusted main
+
PR-1 protected merge
+
exact merge-SHA attestation status PASS
+
candidate_tree_sha = merge_tree_sha
+
candidate_to_merge_tree_delta = 0
+
immutable R2 artifact upload/readback PASS
+
17 / 17 Freeze Gate PASS
+
effective_delivery_frontier_projection.effective_next_slice = S1
+
effective_authority_projection.bounded_replay_runner_authorized = true
+
effective_authority_projection.bounded_canonical_transaction_authorized = true
+
S1 delivery-status seed and trusted Registry candidate rule present on main
+
target fresh database bootstrap and catalog verification PASS
```

不要求、也不允许 exact-SHA workflow 在 merge 后修改 Registry。

---

# 31. v0.3.5 Revision Summary

相对 v0.3.4，本版完成五项 Delivery Policy 定点修订，并保留已通过的 Runtime 设计：

```text
1. 增加 PR-0 / P-1B Candidate Registry Bootstrap：
   PR-0 只修改 trusted Registry，预注册 PR-1 Current Authority status candidate；
   不创建 CAP-08 status JSON，不产生 Candidate Declaration，不允许同 PR 自授权

2. Registry 只登记真正的 delivery candidate signal：
   PR-1 只依赖 Current Authority status rule；
   digest、authorization booleans、effectiveness fields 等普通 authority 字段
   由 schema、semantic snapshot、focused acceptance、finalizer 和 exact-SHA 校验

3. 冻结 S1～S6 successor status/Registry graph：
   每个 PR 为后继创建非候选 seed，并注册下一 PR 的唯一 candidate signal；
   PR-7 不创建或授权 MCFT-CAP-09

4. 修正 T09/T10 Outcome/FVO-10 时间：
   T09 仅表示 outcome interval underway，FVO-10 尚未 observed/available；
   T10 observed_at=T10，Outcome Observation 与 FVO-10 为同一 identity

5. 冻结 PR-1 exact 20-file semantic snapshot set；
   同时把 phase-engine 稳定性判据改为 contract digest gating，
   source digest 仅作为审计证据
```

当前可执行结论：

```text
READY_TO_CREATE_PR_0_BRANCH = YES
READY_TO_OPEN_REGISTRY_BOOTSTRAP_PR = YES
READY_TO_OPEN_AUTHORITATIVE_PR_1 = NO_PENDING_PR_0_PROTECTED_MERGE
PR_2_S1_RUNTIME_AUTHORIZED = FALSE
IMPLEMENTATION_AUTHORIZED = FALSE
```

本版完成任务书内部的 Registry bootstrap 与逐 Slice authority graph 修订。下一步只能先实施 PR-0 / P-1B；PR-0 进入 protected main 后，才允许打开 authoritative PR-1。

</details>
