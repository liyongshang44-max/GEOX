# ADR-0005 · Judge Config Patch v1 端到端验收结论

## 状态

已通过（Accepted）

## 背景

GEOX Judge 需要在不破坏系统闭合性（SSOT 唯一真值、语义不可变、可审计可复现）的前提下，引入“前端可配置参数”的能力。该能力必须满足：

* 前端不创建新规则、不修改语义结构；
* 所有修改均可被后端静态校验与静态拒绝；
* Preview、Save、Run 三阶段配置指纹一致。

本 ADR 记录 Judge Config Patch v1 的设计冻结与端到端验收结果。

## 决策

采用 **Judge Config Manifest v1 + Patch v1（replace-only）** 方案：

* `config/judge/default.json` 为唯一 SSOT；
* Manifest 作为前端唯一授权的“可编辑视图”；
* Patch 为 replace-only 的参数化派生；
* Judge 运行时输出 `effective_config_hash` 作为配置指纹。

## 冻结规范（摘要）

* **只读字段**：`schema_version`、`required_metrics`、`evidence.*`、`marker.exclusion_kinds`、`determinism.*` 等；
* **可改字段（allowlist）**：仅限阈值/开关/枚举子集（sufficiency / time_coverage / qc / reference / conflict）；
* **Patch 规则**：仅 `op=replace`，命中 allowlist，类型/范围/枚举校验；
* **拒绝策略**：未知字段/路径 → 400，SSOT hash 不匹配 → 409，无 silent ignore。

## 实现范围

* 后端：

  * `/api/judge/config`（manifest 输出）
  * `/api/judge/config/patch`（validate + preview/apply）
  * `/api/judge/run`（支持 inline patch，输出 `effective_config_hash`）
* 前端：

  * Manifest 驱动的 Judge Config 编辑页（中文 UI）
  * Preview / Save / Run 闭环

## 验收结果（P0）

### 1. Manifest 权威性

* GET `/api/judge/config` 输出与 SSOT 对齐；
* editable 列表与 allowlist 完全一致；
* 不暴露任何语义层字段。

### 2. 静态拒绝

* 越权路径（如 `evidence.*`）→ 400 PATH_NOT_ALLOWED；
* SSOT hash 不匹配 → 409 Conflict；
* 行为可复现、无静默忽略。

### 3. 闭环一致性（关键）

* Preview 返回 `effective_hash`；
* Save 后 localStorage 中 patch 结构正确、绑定 `ssot_hash`；
* Run 阶段输出 `effective_config_hash`；
* **Preview.effective_hash === Run.effective_config_hash**。

### 4. 语义守恒

* 在证据不足场景，仅输出不确定性说明；
* 不输出“正常/健康/建议”等越权结论。

## 结论

Judge Config Patch v1 实现了：

* 前端参数化能力；
* 严格的后端静态治理；
* 端到端可审计、可复现的配置闭环。

该方案**满足当前阶段的工程与治理要求**，可以作为 v1 正式基线。

## 后续

* v2 可选方向：profile 化、历史 patch 版本管理、权限化；
* 任何演进不得破坏 v1 的 SSOT 与闭合性原则。
