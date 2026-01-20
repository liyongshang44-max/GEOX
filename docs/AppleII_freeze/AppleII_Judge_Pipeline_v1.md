🍎 Apple II · Judge — Pipeline v1 (Deterministic & Silent-by-Default)
Doc ID：GEOX-AII-02  
Status：READY TO FREEZE  
Applies to：Apple II（Judge）

Depends on：
• GEOX-AII-01 ProblemStateV1 Schema（FROZEN）  
• GEOX-AII-03 ReferenceViewV1（FROZEN）  
• GEOX-P0-00 SpatialUnit & Scale Policy（FROZEN）  
• GEOX-P0-01 Evidence & QC Policy（FROZEN）  
• GEOX-AII-00-APP-A Enums & Constraints（FROZEN）

────────────────────────────────

冻结声明（Constitutional Statement）

本文件冻结 Apple II · Judge 的执行流水线顺序、触发条件与沉默规则。

Judge 是一个：
• 确定性的（deterministic）  
• 无随机性的（no randomness）  
• 默认沉默的（silent-by-default）  

问题态声明系统。

Judge 不“找问题”，  
Judge 只在问题态客观成立时发声。

────────────────────────────────
1. 总体原则（Global Principles, FROZEN）

### 1.1 Silent by Default（默认沉默）

在给定以下输入：
• subjectRef  
• scale  
• window  

的情况下：

若不存在任何已定义的 ProblemState 条件成立，  
Judge 不得输出任何 ProblemStateV1 对象。

沉默 ≠ 正常  
沉默 = “未检测到可声明的问题态”

Judge 不得：
• 输出 “OK / NORMAL / STABLE” 等正向状态  
• 输出空壳 ProblemState  
• 用沉默表达健康或安全  

【★FROZEN ADDITION】
Silent-by-default 不代表 Pipeline 未执行。

在每一次 Judge 调用中：
• Pipeline 必须完整执行至终点或首个命中阶段  
• 即使最终无 ProblemState 输出，也必须视为一次有效判读  

是否输出 ProblemState，  
不影响 Judge 执行的完整性与可审计性。

────────────────────────────────
2. Pipeline 总览（Fixed Order, FROZEN）

Judge Pipeline v1 的执行顺序 **严格固定**，  
不得调整、跳步、并行重排或事后回溯：

1️⃣ Input Assembly  
2️⃣ Evidence Sufficiency Check  
3️⃣ Time Coverage Check  
4️⃣ QC / Device Health Check  
5️⃣ Reference Assembly（可选）  
6️⃣ Conflict Detection  
7️⃣ Scale Policy Check  
8️⃣ Exclusion Window / Marker Check  
9️⃣ ProblemState Emission  
🔟 AO-SENSE Derivation（仅在 ProblemState 存在时）

冻结规则（FROZEN）：
一旦某一阶段命中 ProblemState 条件，  
后续阶段不得再执行。

────────────────────────────────
3. 各阶段规则（Stage Rules）

### 3.1 Input Assembly（FROZEN）

输入必须显式指定：
• subjectRef  
• scale  
• window {startTs, endTs}  

允许输入：
• Evidence Ledger  
• QC summary  
• Series API 切片  
• StateVectorV1（可选）  

禁止输入：
• LBCandidate  
• AO / Control  
• 任何行动、许可或裁决结果  

若缺失 subjectRef 或 window：  
→ Pipeline 直接中止（不得生成 ProblemState）

────────────────
### 3.2 Evidence Sufficiency Check（FROZEN）

判定内容：
• window 内 raw_sample 覆盖是否不足  
• 是否缺失关键 metric  

关键 metric 规则（FROZEN）：
• 关键 metric 集合必须来自实现配置或冻结策略  
• Judge 不得自行推断、扩展或学习关键 metric  

阈值规则（FROZEN）：
• sufficiency 判定阈值不得硬编码  
• 必须来自配置或冻结常量  

若成立：  
→ 生成 ProblemState：  
• problem_type = INSUFFICIENT_EVIDENCE  
• uncertainty_sources 包含 SPARSE_SAMPLING / MISSING_KEY_METRIC  
→ 进入 Stage 9

────────────────
### 3.3 Time Coverage Check（FROZEN）

判定内容：
• window 内是否存在显著 gap  
• 是否仅覆盖异常尾部或窗口边界  

阈值规则（FROZEN）：
• gap 判定规则必须来自配置或冻结策略  
• Judge 不得基于经验猜测 gap 严重程度  

若成立：  
→ 生成 ProblemState：  
• problem_type = TIME_COVERAGE_GAPPY 或 WINDOW_NOT_SUPPORT  
→ 进入 Stage 9

────────────────
### 3.4 QC / Device Health Check（FROZEN）

判定内容：
• suspect / bad 占比是否超过冻结阈值  
• 是否存在设备健康异常证据  

阈值规则（FROZEN）：
• QC 比例阈值不得硬编码  
• 必须来自 Evidence & QC Policy  

若成立：  
→ 生成 ProblemState：  
• problem_type = QC_CONTAMINATION 或 SENSOR_HEALTH_DEGRADED  
→ 进入 Stage 9

────────────────
### 3.5 Reference Assembly（OPTIONAL, FROZEN）

触发条件：
• 存在配置的参照类型（历史 / 对照传感器 / 邻域）  
• 且不违反 Scale Policy  

规则：
• ReferenceView 仅用于组织对照  
• 不得生成伪参照  
• 不得跨尺度推导  

若无法构建任何 ReferenceView：  
→ 本阶段 **不得** 生成 ProblemState  
→ 留待后续阶段判断

────────────────
### 3.6 Conflict Detection（FROZEN）

基于：
• 多指标  
• 多传感器  
• ReferenceView（若存在）  

判定是否存在：
• 稳定的  
• 可复现的  
• 非 QC 可解释的偏离  

否定性规则（FROZEN）：
• 单点异常  
• 短时波动  
• 完全可由 QC suspect/bad 解释的差异  

不得触发 Conflict Detection。

若成立：  
→ 生成 ProblemState：  
• problem_type = EVIDENCE_CONFLICT 或 REFERENCE_CONFLICT  
→ 进入 Stage 9

────────────────
### 3.7 Scale Policy Check（FROZEN）

若任何推断尝试涉及跨 scale：  
→ 生成 ProblemState：  
• problem_type = SCALE_POLICY_BLOCKED  

冻结规则：
• 不允许生成任何替代性判断  
• 不允许通过 ReferenceView 绕过尺度限制  

────────────────
### 3.8 Exclusion Window / Marker Check（FROZEN）

若 window 内存在：
• 排除类 marker  
• 维护 / 校准 / 干预标注  

→ 生成 ProblemState：  
• problem_type = EXCLUSION_WINDOW_ACTIVE 或 MARKER_PRESENT  

────────────────
### 3.9 ProblemState Emission（FROZEN）

规则：
• 每个 window 最多生成一个 ProblemStateV1  
• 若多个条件成立：  
→ 选择最上游阶段首次命中的 ProblemState  
→ 不合并、不叠加、不排序  

ProblemStateV1 必须包含：
• Step1 钩子字段  
• state_layer_hint  
• rate_class_hint  
• problem_scope  
• uncertainty_sources（非空）  

【★FROZEN ADDITION】
若 ProblemState 的触发依赖于：
• Evidence Sufficiency  
• Time Coverage  
• QC / Device Health  
• Conflict Detection  
• ReferenceView  

则 supporting_evidence_refs **至少必须包含一个可回放的 EvidenceRef**
（ledger_slice / qc_summary / reference_view 之一）。

仅当 ProblemState 完全由“策略阻断类规则”触发  
（如 SCALE_POLICY_BLOCKED），  
supporting_evidence_refs 允许为空。

【★FROZEN ADDITION】
ProblemStateV1.confidence 的生成必须是：
• 规则映射（rule-based）  
• 与 problem_type 明确对应  
• 不得引入概率、评分或模型推断  

confidence 仅表达：
“在当前证据与规则下，问题态成立的确定性强弱”，  
不得表达风险、严重性或优先级。

────────────────
### 3.10 AO-SENSE Derivation（FROZEN）

仅在 ProblemState 已生成时允许。

AO-SENSE：
• 必须绑定 problem_state_id  
• 仅用于减少 uncertainty_sources  
• 不得表达任何行动、干预或控制语义  

AO-SENSE 不得：
• 独立存在  
• 取代 ProblemState  
• 绑定 reference_view_id 作为主锚点  

────────────────────────────────
4. 决定性与可回放（Determinism, FROZEN）

在相同：
• Evidence  
• QC  
• subjectRef  
• scale  
• window  

条件下：

Judge Pipeline 必须产生：
• 相同的 ProblemState（或同样的沉默）  
• 相同的 AO-SENSE（若存在）  

禁止：
• 随机性  
• 时间相关状态  
• 历史缓存影响输出  

────────────────────────────────
5. 冻结结论（Freeze Verdict）

• Pipeline 顺序已冻结  
• 默认沉默规则已冻结  
• 每 window 单一 ProblemState 原则已冻结  
• ReferenceView 为可选组织组件  
• AO-SENSE 仅作为 ProblemState 派生物  
• Judge 不得“找问题”，只声明已成立的问题态  

Apple II · Judge Pipeline v1  
READY TO FREEZE