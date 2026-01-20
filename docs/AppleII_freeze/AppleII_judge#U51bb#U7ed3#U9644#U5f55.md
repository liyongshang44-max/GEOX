# 🍎 Apple II · Judge — 冻结附录（Enums & Constraints）
Doc ID：GEOX-AII-00-APP-A  
Status：READY TO FREEZE  
Applies to：Apple II（Judge）  
Depends on：Apple I Phase-5（Evidence-Only Monitoring）

> 本附录冻结：Apple II 的枚举、字段级约束与单向依赖规则。  
> 目标：防止自证循环、避免控制语义渗透、确保可审计可回放。

---

## A. 单向依赖原则（One-way Dependency, FROZEN）

### A.1 允许的依赖方向
1) Evidence / State → ProblemState  
2) ProblemState → LBCandidate  
3) ProblemState → AO-SENSE

### A.2 明确禁止
- 禁止：LBCandidate → ProblemState（作为输入证据或证明）
- 禁止：AO-SENSE 在无 ProblemState 情况下独立产生
- 禁止：任何 Control / AO 许可语义进入 Apple II（HardNo/Warn/OK/Priority 等）

---

## B. ProblemStateV1（核心锚点）枚举与字段约束（FROZEN）

### B.1 ProblemStateTypeV1（枚举）
用于字段：`ProblemStateV1.type`

- `INSUFFICIENT_EVIDENCE`  
  证据不足：覆盖稀疏/关键指标缺失/窗口太短
- `TIME_COVERAGE_GAPPY`  
  时间覆盖断裂：gaps 影响连续性
- `EVIDENCE_STALE`  
  证据过期：新鲜度不足（stale），不支撑当前判断

- `EVIDENCE_CONFLICT`  
  证据冲突：多指标/多源矛盾（仅声明冲突，不解释原因）
- `REFERENCE_CONFLICT`  
  对照冲突：与对照/参照视图矛盾，无法解释一致

- `SENSOR_SUSPECT`  
  传感器可疑：漂移/污染/失真可能（由 QC + 对照差异 + 突变形态触发）
- `SENSOR_HEALTH_DEGRADED`  
  设备健康降级：掉线/低电/频繁重启/校准过期等影响可信度
- `QC_CONTAMINATION`  
  QC 污染：suspect/bad 占比高或集中在关键时段

- `REFERENCE_MISSING`  
  缺对照/缺基线：无法构建参照视图（历史同季/邻域/对照点缺失）
- `SCALE_POLICY_BLOCKED`  
  尺度策略阻断：存在跨尺度诱惑但被 Scale Policy 禁止外推（仅声明阻断）

- `WINDOW_NOT_SUPPORT`  
  窗口不支持：只覆盖异常尾巴/边界太近/不可解释窗口
- `EXCLUSION_WINDOW_ACTIVE`  
  排除窗口激活：处于不可解释窗口（如 post-rain/post-maintenance）导致判读降级

- `MARKER_PRESENT`  
  存在 marker/overlay：有事实标注被写入 Ledger（不解释）

---

### B.2 ProblemStateConfidenceV1（枚举）
用于字段：`ProblemStateV1.confidence`

- `HIGH`
- `MEDIUM`
- `LOW`
- `UNKNOWN`

> 注意：该置信度仅表示“问题态成立的把握”，不具备任何行动含义。

---

### B.3 UncertaintySourceV1（枚举）
用于字段：`ProblemStateV1.uncertainty_sources[]`

- `SPARSE_SAMPLING`：采样稀疏/点数不足  
- `MISSING_KEY_METRIC`：缺关键指标  
- `TIME_GAPS`：时间断档  
- `STALE_EVIDENCE`：新鲜度不足  
- `MULTI_SOURCE_CONFLICT`：同指标多源冲突  
- `MULTI_METRIC_CONFLICT`：多指标逻辑冲突  
- `QC_SUSPECT_OR_BAD`：QC 质量不佳  
- `SENSOR_HEALTH_ISSUE`：设备健康问题  
- `REFERENCE_NOT_AVAILABLE`：参照不可用  
- `SCALE_POLICY_LIMITATION`：尺度策略限制（禁止外推）  
- `EXCLUSION_WINDOW`：不可解释/排除窗口  
- `MARKER_DEPENDENCY`：依赖人工标注才能理解（但标注不等于结论）

---

### B.4 ProblemStateV1 字段级硬约束（FROZEN）

#### B.4.1 输入白名单（Allowed Inputs）
ProblemStateV1 只能基于以下输入生成（作为证据来源）：
- `StateVectorV1`（来自 Apple I）
- `Evidence Ledger`：`Observables + QC + Markers`
- `Reference Views`（允许的对照视图）
- `SpatialUnit & Scale Policy`
- `window {startTs,endTs}`

#### B.4.2 输入黑名单（Forbidden Inputs）
ProblemStateV1 明确禁止引用或消费：
- `LBCandidateV1`（任何形式：ID、摘要、派生指标、模型输出）
- 任何 `Action / AO / Control` 结果（包括许可、裁决、处方）
- 人工主观结论（除非以 `marker_v1` 写入 Ledger）

#### B.4.3 证据引用约束（Evidence Ref Whitelist）
字段：`ProblemStateV1.supporting_evidence_refs[]`  
- ✅ 仅允许引用：Ledger/StateVector/ReferenceView 的可回放片段或统计摘要  
- ❌ 禁止引用：`LBCandidateV1`（防止解释结构反证本体）

---

## C. JudgeReportV1 的证据状态枚举（FROZEN）

### C.1 EvidenceAvailabilityV1
字段：`JudgeReportV1.evidence_status.availability`
- `ENOUGH`
- `SPARSE`
- `MISSING`

### C.2 EvidenceConsistencyV1
字段：`JudgeReportV1.evidence_status.consistency`
- `CONSISTENT`
- `CONFLICTING`
- `UNKNOWN`

### C.3 TimeCoverageV1
字段：`JudgeReportV1.evidence_status.time_coverage`
- `CONTINUOUS`
- `GAPPY`
- `STALE`

---

## D. LBCandidateV1（解释结构）枚举与限制（FROZEN）

### D.1 StatusWordV1（中性状态词）
字段：`LBCandidateV1.status_word`

- `STABLE`
- `DRIFTING`
- `UNSTABLE`
- `NEEDS_VERIFICATION`

> 禁止出现任何控制裁决词（HardNo/Warn/OK/Priority）或建议/处方词。

### D.2 LBCandidateV1 的硬限制（FROZEN）
- 只能解释 `ProblemStateV1`
- 允许多候选并列、允许冲突、允许撤销
- 不具备任何行动含义
- ❌ 不允许作为 `ProblemStateV1` 的输入或证据
- ❌ 不允许直接生成 AO / Control

---

## E. AO-SENSE（补观测请求）枚举与字段约束（FROZEN）

### E.1 SensePriorityV1（采集优先级）
字段：`AO_SENSE.priority`

- `LOW`
- `MEDIUM`
- `HIGH`

> 仅表示采集优先级，不映射行动合法性/风险裁决。

---

### E.2 SenseTargetTypeV1（去哪里）
字段：`AO_SENSE.target.type`

- `SPATIAL_UNIT`：某个 SpatialUnit
- `SENSOR_POINT`：具体传感器/点位
- `ROUTE`：巡田路线（仍需绑定 SpatialUnit）
- `REFERENCE_POINT`：对照点/对照传感器（新增或复核）

---

### E.3 SenseMethodV1（看什么/怎么补）
字段：`AO_SENSE.method`

- `PHOTO`：拍照/影像
- `FIELD_SCOUTING`：人工巡检结构化记录
- `SOIL_SAMPLE`：土样
- `HANDHELD_RECHECK`：手持仪表复测
- `SENSOR_CALIBRATION`：传感器校准/复核
- `ADD_CONTROL_POINT`：增设对照点/对照传感器

---

### E.4 AO-SENSE 字段级硬约束（FROZEN）

#### E.4.1 绑定规则（Mandatory Binding）
- 字段：`AO_SENSE.problem_state_id`  
  - ✅ 必填（MUST）
  - 需能确定性回溯到同一 `ProblemStateV1`

#### E.4.2 独立存在禁止（No Standalone AO-SENSE）
- ❌ AO-SENSE 不允许在没有 ProblemState 的情况下单独产生  
- 任何缺失 `problem_state_id` 的 AO-SENSE 对象视为 **无效（INVALID）**

#### E.4.3 内容白名单（Allowed Content）
AO-SENSE 仅允许表达：
- 去哪里（SpatialUnit / sensor / 区域）
- 看什么（observable / metric / 方法）
- 为什么需要（关联到 ProblemState 的不确定性类型）
- 期望减少的不确定性类型

#### E.4.4 内容黑名单（Forbidden Content）
AO-SENSE 不得包含：
- “做/改/干预”的请求（ENTER/APPLY/REMOVE/STRUCT/EXTRACT 等）
- 作业处方、阈值建议、收益叙事
- 任何行动合法性暗示

---

## F. 禁用词（UI/文案/协议语义，FROZEN）

Apple II 输出（ProblemState/LB/AO-SENSE）不得出现以下语义（含同义表达）：
- 控制裁决：`HardNo / Warn / OK / Priority`、legal/illegal/allow/deny
- 建议与处方：should / recommend / need to / must / optimal / effective
- 因果诊断：cause / diagnosis / deficiency / disease confirmed
- 作业暗示：irrigate / fertilize / spray / intervene / operate

---

## G. 兼容钩子（可选字段，建议保留）

> 以下为兼容后续 Step 与 Apple III 的“只读钩子”，不引入控制语义（可选但建议保留）

- `ProblemStateV1.state_inputs_used[]`：本次引用的 state 字段/版本（若接入 Step1/2 资产）
- `ProblemStateV1.system_degraded`：是否触发降级（对齐 Step10）
- `AO_SENSE.requested_actor_role`：`HUMAN_SENSOR | DEVICE_SENSOR`（对齐 Step8）

---

## 版本声明
- 本附录冻结后：任何新增枚举项必须走“版本升级”，不得静默变更。
- 任意字段若引入控制语义，自动判定为越权（属于 Apple III 范畴）。

---