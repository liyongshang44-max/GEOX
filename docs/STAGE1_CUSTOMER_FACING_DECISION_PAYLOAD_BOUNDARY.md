# GEOX Stage-1 Customer-facing Decision Payload 边界冻结文件

## 1. 文档目的

本文件用于冻结当前仓库中 recommendation 相关 decision payload 的 customer-facing 边界。

本文件只描述当前 GitHub main 已实现的 recommendation 输出分层事实，不扩展到 future UI、future sales copy 或 future internal debug tooling 设计。

本文件关注的是：

- 哪些 recommendation 字段属于 customer-facing 输出
- 哪些 recommendation 字段属于 internal debug / internal-only payload
- 当前 detail / control-plane detail 输出面禁止泄漏哪些 internal 信息
- recommendation explain 当前允许暴露到什么层级

---

## 2. 当前 customer-facing payload 的基本口径

当前 recommendation customer-facing 输出，面向的是：

- recommendation list
- recommendation detail
- recommendation control-plane detail

这些输出面当前允许承载的是：

- recommendation 基本标识
- recommendation 状态
- recommendation confidence
- recommendation summary / suggested action
- 简化后的 explain
- pipeline 进度摘要

当前 customer-facing payload 不应直接承载 internal debug payload 或 internal-only source payload。

---

## 3. 当前 customer-facing explain 边界

当前 recommendation 对外 explain 的允许字段为：

- `trigger_source_fields`
- `action_summary`
- `rule_hit_summary`

这意味着当前 customer-facing explain 是一个已经压缩过的 explain 结构，只保留客户、运营或审批侧可直接理解的 recommendation 解释信息。

当前 recommendation explain 不应直接暴露 internal rule tracing 或 internal source tracing。

---

## 4. 当前 internal debug explain 边界

以下结构当前属于 internal debug explain 范围：

- `source_states`
- `triggered_rules`
- `reasoning_path`

这些字段属于 internal 推理过程信息，而不是 customer-facing explanation。

因此，当前 recommendation 对外 detail / control-plane detail 输出中，不应直接暴露这些 internal debug explain 字段。

---

## 5. 当前 internal-only data sources 边界

当前 recommendation payload 内部仍可能保留 internal support source 或 internal-only source，例如：

- `field_sensing_overview_v1`
- `field_fertility_state_v1`
- `image_recognition`

这些 source 当前可以存在于 internal payload、support path 或数据记录层中，但不应直接构成 customer-facing route 的对外输出。

也就是说，customer-facing route 不应把这些 internal-only source 名称或其原始 payload 直接暴露出来。

---

## 6. 当前禁止直接暴露的 internal / compatibility 字段

截至当前仓库状态，以下字段不应直接出现在 customer-facing recommendation detail / control-plane detail 输出中：

- `internal_debug_explain`
- `data_sources.internal_only`
- `field_sensing_overview_v1`
- `field_fertility_state_v1`
- `image_recognition`
- `sensor_quality`
- `irrigation_need_level`
- `canopy_state`
- `water_flow_state`

这些字段要么属于 internal-only source，要么属于 compatibility / non-customer-facing 字段，不应成为当前 customer-facing recommendation contract 的组成部分。

---

## 7. 当前 customer-facing payload 冻结结论

截至当前仓库状态，recommendation customer-facing payload 已冻结为以下边界：

### 7.1 允许面向外部的 recommendation explain

- `trigger_source_fields`
- `action_summary`
- `rule_hit_summary`

### 7.2 不允许面向外部的 internal explain

- `source_states`
- `triggered_rules`
- `reasoning_path`

### 7.3 不允许直接向外暴露的 internal-only source

- `field_sensing_overview_v1`
- `field_fertility_state_v1`
- `image_recognition`

### 7.4 不允许直接向外暴露的 internal / compatibility 字段

- `sensor_quality`
- `irrigation_need_level`
- `canopy_state`
- `water_flow_state`

---

## 8. 当前测试约束口径

截至本文件冻结时，第二组 customer-facing decision payload 边界已有对应测试约束；具体测试文件与覆盖范围以后续仓库核实结果为准。

---

## 9. 文档定位

本文件只陈述当前仓库 recommendation customer-facing payload 的已实现边界事实。

本文件不声明高于仓库现实的上位政策，也不将 future visualization、future sales copy、future debug exposure 视为当前已冻结能力。

后续如 recommendation 对外 payload 边界发生变更，应先更新实现与测试，再更新本文件。
