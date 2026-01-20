# 🍎 Apple II · Judge — Judge Logic Rules v1（Deterministic Ruleset）
Doc ID：GEOX-AII-04
Status：READY TO FREEZE
Applies to：Apple II（Judge）
Depends on：
- GEOX-AII-02 Pipeline v1（FROZEN）
- GEOX-AII-01 ProblemStateV1 Schema（FROZEN）
- GEOX-AII-03 ReferenceViewV1（FROZEN）
- GEOX-AII-00-APP-A Enums & Constraints（FROZEN）
- GEOX-P0-00 SpatialUnit & Scale Policy（FROZEN）
- GEOX-P0-01 Evidence & QC Policy（FROZEN）

────────────────────────────────

## 冻结声明（Constitutional Statement）

本文件冻结 Apple II v1 的“判定规则集（Logic Ruleset）”：
- 全部规则是确定性的（deterministic）
- 不含随机性、不含模型评分、不含学习
- 阈值不得硬编码；必须来自 Judge 配置（冻结常量或显式配置文件）
- 未覆盖情形不得“发明新枚举”；必须：
  - 沉默（silent-by-default），或
  - 回落为既有 ProblemStateType / uncertainty_sources / confidence

────────────────────────────────

## 0. 规则输入与输出边界（FROZEN）

### 0.1 Allowed Inputs（白名单）
- Evidence Ledger 切片（raw_sample_v1, marker_v1, overlay_v1）
- QC 信息（quality: ok/suspect/bad；exclusion_reason 只作为标签，不重解释）
- Series API（严格 window 裁剪；不插值、不补点、不平滑）
- ReferenceViewV1（可选、只读、可持久化但不强制）
- StateVectorV1（可选；仅用于组织不确定性说明；不可作为必要依赖）

### 0.2 Forbidden Inputs（黑名单）
- LBCandidateV1（任何形式）
- AO / Control / 执行结果（任何形式）
- 人工主观结论（除非已写入 marker_v1）

### 0.3 Output（唯一锚点）
- 允许输出：ProblemStateV1（最多一个/每 window），以及其派生 AO-SENSE（可选）
- 不得输出：OK/NORMAL/STABLE 等“正向状态对象”

────────────────────────────────

## 1. 判定所需的最小统计（FROZEN）

所有统计必须从 window 内证据切片计算得到，且可复算。

### 1.1 基本统计
- total_samples: window 内 raw_sample 总点数（所有 metric×sensor）
- per_metric_sample_count[metric]
- per_sensor_sample_count[sensor_id]
- per_sensor_metric_count[sensor_id][metric]

### 1.2 QC 统计（按 window）
- qc_mix_all: { ok_count, suspect_count, bad_count, ok_pct, suspect_pct, bad_pct }
- qc_mix_by_sensor[sensor_id]
- qc_mix_by_metric[metric]

### 1.3 时间覆盖统计（按每条序列）
对每个 (sensor_id, metric)：
- ts_sorted: 该序列 window 内的时间戳升序数组（ms）
- gaps: 相邻采样间隔（ms）
- max_gap_ms
- coverage_span_ms = (last_ts - first_ts)（若 <2 点则为 0）
- window_span_ms = (endTs - startTs)

### 1.4 ReferenceView 对比统计（若启用）
对每个 ReferenceViewV1：
- overlap_ratio
- primary_sample_count / reference_sample_count
- qc_mix_primary / qc_mix_reference
- delta_hint（仅数值/标签，不解释）

────────────────────────────────

## 2. 配置键（Configuration Keys, FROZEN）

Judge v1 必须以配置驱动阈值，不得硬编码。最小配置键如下（命名冻结）：

- required_metrics[]: string[]
- sufficiency.min_total_samples: number
- sufficiency.min_samples_per_required_metric: number
- time_coverage.max_allowed_gap_ms: number
- time_coverage.min_coverage_ratio: number   # 可选；例如 coverage_span/window_span
- qc.bad_pct_threshold: number               # 0..1
- qc.suspect_pct_threshold: number           # 0..1
- marker.exclusion_kinds[]: string[]         # 由 marker/overlay 的 kind 或标签决定（实现需对齐 Apple I ledger 现状）
- reference.enable: boolean
- reference.kinds_enabled[]: ReferenceViewKindV1[]
- conflict.min_overlap_ratio: number         # 0..1
- conflict.delta_numeric_threshold: number   # 仅数值阈值，不解释；用于“差异显著”提示
- conflict.min_points_in_overlap: number
- determinism.tie_breaker: "LEXICOGRAPHIC"

说明（FROZEN）：
- 若缺失 required_metrics 配置，则 Judge 不得自行推断关键指标；应回落为 INSUFFICIENT_EVIDENCE（MISSING_KEY_METRIC）。

────────────────────────────────

## 3. ProblemState 触发规则（Rule Set, FROZEN）

> 注意：顺序必须与 GEOX-AII-02 Pipeline 一致；命中即停止后续阶段。

### 3.1 Stage-2: Evidence Sufficiency → INSUFFICIENT_EVIDENCE
触发任一条件即命中：
- total_samples < sufficiency.min_total_samples
- 对任一 required_metric：per_metric_sample_count[metric] < sufficiency.min_samples_per_required_metric

输出约束（FROZEN）：
- problem_type = INSUFFICIENT_EVIDENCE
- uncertainty_sources 至少包含：
  - SPARSE_SAMPLING（若 total_samples 不足）
  - MISSING_KEY_METRIC（若关键 metric 缺失/不足）
- confidence：
  - 若触发来自“硬阈值不足”（total_samples/required_metrics 不足），推荐 HIGH；
  - 若仅边界不足（刚好低于阈值）可 MEDIUM；
  - 具体映射必须固定为规则映射（不允许概率/评分）。
- problem_scope（建议规则）：
  - 若缺失集中在某 sensor → sensor_point
  - 若整体稀疏/缺指标 → spatial_unit
- supporting_evidence_refs：至少 qc_summary 或 ledger_slice（可回放）

### 3.2 Stage-3: Time Coverage → TIME_COVERAGE_GAPPY / WINDOW_NOT_SUPPORT
触发条件（可配置化）：
- 任一关键序列 (sensor, metric) 的 max_gap_ms > time_coverage.max_allowed_gap_ms
- 或 coverage_span_ms / window_span_ms < time_coverage.min_coverage_ratio（若启用）
- 或 window 边界效应：仅 1 个点或点集中在窗口一端（规则需固定化）

输出约束：
- TIME_COVERAGE_GAPPY：强调 gaps
- WINDOW_NOT_SUPPORT：强调窗口形态不支撑（例如只覆盖尾巴）
- uncertainty_sources 至少包含 TIME_GAPS
- supporting_evidence_refs：ledger_slice 或 qc_summary（可回放）

### 3.3 Stage-4: QC / Device Health → QC_CONTAMINATION / SENSOR_HEALTH_DEGRADED
触发条件（固定阈值来自配置）：
- qc_mix_all.bad_pct >= qc.bad_pct_threshold 或 qc_mix_all.suspect_pct >= qc.suspect_pct_threshold
- 或在 window 内存在明确设备健康类 marker/overlay（由 marker.exclusion_kinds 配置识别）

输出约束：
- QC_CONTAMINATION：以 QC 分布为主依据
- SENSOR_HEALTH_DEGRADED：以设备健康/维护/掉线标注为主依据（必须有 evidence ref）
- uncertainty_sources 至少包含 QC_SUSPECT_OR_BAD 或 SENSOR_HEALTH_ISSUE
- supporting_evidence_refs：必须包含 qc_summary 或 marker/overlay 的 ledger_slice

### 3.4 Stage-5: Reference Assembly（可选）→ 仅产出 ReferenceView，不直接产出 ProblemState
- 若 reference.enable=false：跳过
- 若 enable=true：
  - 仅允许 kind ∈ reference.kinds_enabled
  - 必须遵守 Scale Policy（同尺度）
  - 参照选择必须使用 GEOX-AII-03 的唯一键与确定性选择规则

### 3.5 Stage-6: Conflict Detection → EVIDENCE_CONFLICT / REFERENCE_CONFLICT / SENSOR_SUSPECT
Conflict Detection 的最低判定条件（必须同时满足）：
- overlap_ratio >= conflict.min_overlap_ratio
- overlap 内有效点数 >= conflict.min_points_in_overlap
- 差异幅度达到 conflict.delta_numeric_threshold（仅数值；不解释原因）
- 且差异不能完全由 QC 差（suspect/bad）解释（否定性规则）

输出选择（固定优先级，FROZEN）：
1) 若冲突发生在 “主序列 vs 参照序列”（ReferenceView） → REFERENCE_CONFLICT
2) 否则若冲突发生在 “多源/多传感器/多指标” → EVIDENCE_CONFLICT
3) 若冲突形态更像“某个 sensor 偏离群体”，且 QC/参考支持“可疑” → SENSOR_SUSPECT
   - 注意：SENSOR_SUSPECT 仍然是不确定性声明，不是“谁坏了”的裁决
   - 必须有 supporting_evidence_refs（reference_view + qc_summary + ledger_slice 至少其一）

### 3.6 Stage-7: Scale Policy Check → SCALE_POLICY_BLOCKED
触发条件：
- 任何需要跨 scale 才能完成的推断被检测到（实现必须显式检测输入是否跨 scale）
输出约束：
- problem_type = SCALE_POLICY_BLOCKED
- uncertainty_sources 包含 SCALE_POLICY_LIMITATION
- supporting_evidence_refs：允许为空（策略阻断可以无证据切片），但若存在对照展示，可引用 reference_view

### 3.7 Stage-8: Exclusion Window / Marker → EXCLUSION_WINDOW_ACTIVE / MARKER_PRESENT
触发条件：
- window 内存在排除/维护/校准/干预类 marker/overlay（由配置识别）
输出约束：
- EXCLUSION_WINDOW_ACTIVE：用于“排除窗激活”（强语义：此窗口判读降级）
- MARKER_PRESENT：用于“存在标注事实”（弱语义：仅声明存在）
- supporting_evidence_refs：必须引用 marker/overlay 的 ledger_slice

────────────────────────────────

## 4. Step1 Hooks 赋值规则（FROZEN）

每个 ProblemStateV1 必须写入以下字段，不得省略，不得为 null：
- state_layer_hint
- rate_class_hint
- problem_scope

v1 规则（冻结）：
- 默认填 unknown
- 仅当实现中存在“确定性映射表”时才可赋非 unknown
- 映射表必须是配置/冻结常量，不得用启发式猜测

建议最小映射（允许但不强制）：
- INSUFFICIENT_EVIDENCE / TIME_COVERAGE_GAPPY / EVIDENCE_STALE:
  - state_layer_hint = unknown
  - rate_class_hint = fast
- SENSOR_HEALTH_DEGRADED / QC_CONTAMINATION:
  - problem_scope = sensor_point
- SCALE_POLICY_BLOCKED:
  - problem_scope = reference_view 或 unknown

────────────────────────────────

## 5. ProblemState 的确定性构造伪代码（FROZEN）

```pseudo
function judge(subjectRef, scale, window):
  assert window.endTs > window.startTs
  inputs = assemble_inputs(subjectRef, scale, window)

  if missing(subjectRef) or missing(window): return SILENT

  stats = compute_stats(inputs)  # all replayable

  # Stage 2: sufficiency
  if insufficient(stats, config):
     return emit_problem("INSUFFICIENT_EVIDENCE", See `doc/AppleII/GEOX-AII-04.md` for the complete frozen rules.)

  # Stage 3: time coverage
  if gappy_or_window_not_support(stats, config):
     return emit_problem("TIME_COVERAGE_GAPPY" or "WINDOW_NOT_SUPPORT", See `doc/AppleII/GEOX-AII-04.md` for the complete frozen rules.)

  # Stage 4: QC / device health
  if qc_or_device_bad(stats, config):
     return emit_problem("QC_CONTAMINATION" or "SENSOR_HEALTH_DEGRADED", See `doc/AppleII/GEOX-AII-04.md` for the complete frozen rules.)

  # Stage 5: reference assembly (optional)
  refs = []
  if config.reference.enable:
     refs = build_reference_views(inputs, config)  # may be empty

  # Stage 6: conflict detection
  if conflict_detected(stats, refs, config):
     return emit_problem("REFERENCE_CONFLICT" or "EVIDENCE_CONFLICT" or "SENSOR_SUSPECT", See `doc/AppleII/GEOX-AII-04.md` for the complete frozen rules.)

  # Stage 7: scale policy
  if scale_policy_blocked(inputs, config):
     return emit_problem("SCALE_POLICY_BLOCKED", See `doc/AppleII/GEOX-AII-04.md` for the complete frozen rules.)

  # Stage 8: exclusion/marker
  if exclusion_or_marker_present(inputs, config):
     return emit_problem("EXCLUSION_WINDOW_ACTIVE" or "MARKER_PRESENT", See `doc/AppleII/GEOX-AII-04.md` for the complete frozen rules.)

  # Silent by default
  return SILENT ProblemState emission 后（仅当存在 ProblemState）：
	•	derive AO-SENSE（只为减少 uncertainty_sources）
	•	AO-SENSE 必须绑定 problem_state_id
	•	不得产生控制/行动语义

────────────────────────────────

6. 冻结结论（Freeze Verdict）
	•	规则集为确定性、配置驱动、默认沉默
	•	阈值不得硬编码
	•	未覆盖情形不得扩展枚举；应沉默或回落为既有枚举
	•	规则顺序与 Pipeline 一致，命中即停止
READY TO FREEZE