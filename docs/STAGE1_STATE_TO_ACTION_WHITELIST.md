# GEOX Stage-1 状态到动作引用白名单

## 1. 文档目的

本文件用于冻结 GEOX 第二组已经在当前仓库中落地并可核实的 recommendation / trigger 边界口径：

- 哪些 Stage-1 sensing 字段允许进入正式动作判断
- 哪些字段只能作为辅助诊断或解释信号
- 哪些 internal / compatibility 字段禁止重新进入正式 trigger 主链

本文件不是新的算法设计文档，也不是未来规划文档。
本文件只描述当前仓库已经实现并被测试覆盖的 recommendation / trigger 边界事实。

## 2. 适用范围

本文件适用于以下对象：

1. recommendation generate 的 formal trigger 判断
2. recommendation → submit-approval 的 provenance 边界
3. customer-facing recommendation explain 的来源口径
4. internal debug payload 与 customer-facing payload 的分层说明

本文件不适用于：

1. fields / dashboard 第一组 Stage-1 summary contract 的字段定义
2. approval / operation / dispatch / receipt / acceptance 后半段控制链路
3. future successor contract 或新状态扩展设计

## 3. 当前仓库已冻结的三层边界

当前仓库中，Stage-1 recommendation / trigger 已按三层边界收口：

### 3.1 formal action trigger fields

这是允许直接进入 recommendation formal trigger eligibility 的字段层。

当前仓库已冻结为：

- `irrigation_effectiveness`
- `leak_risk`

这两个字段属于 Stage-1 正式动作判断字段。
当前 recommendation 主链只允许基于这两个字段形成 formal trigger。

### 3.2 support-only fields

这是允许参与 explain / support / diagnosis，但不得单独形成 formal trigger 的字段层。

当前仓库已冻结为：

- `canopy_temp_status`
- `evapotranspiration_risk`
- `sensor_quality_level`

这些字段可以进入 customer-facing explain 或 support signal，
但不能单独使 recommendation 进入 formal trigger eligible 状态。

### 3.3 forbidden trigger fields

这是明确禁止重新进入正式 trigger 主链的字段层。

当前仓库已冻结为：

- `fertility_state`
- `salinity_risk_state`
- `canopy_state`
- `water_flow_state`
- `irrigation_need_state`
- `irrigation_need_level`
- `sensor_quality`

这些字段即使仍存在于 internal payload、compatibility path 或 support path 中，
也不得单独形成 formal trigger。

## 4. formal action trigger fields 说明

### 4.1 `irrigation_effectiveness`

角色：formal action trigger field

当前仓库事实：

- recommendation formal trigger 可由 `irrigation_effectiveness = low` 形成
- recommendation generate 的 Stage-1 boundary 测试已覆盖该行为

使用口径：

- 允许进入 formal trigger eligibility
- 允许进入 submit-approval provenance
- 允许进入 customer-facing trigger_source_fields

### 4.2 `leak_risk`

角色：formal action trigger field

当前仓库事实：

- recommendation formal trigger 可由 `leak_risk = high` 形成
- recommendation generate 的 Stage-1 boundary 测试已覆盖该行为

使用口径：

- 允许进入 formal trigger eligibility
- 允许进入 submit-approval provenance
- 允许进入 customer-facing trigger_source_fields

## 5. support-only fields 说明

### 5.1 `canopy_temp_status`

角色：support-only field

使用口径：

- 允许进入 explain
- 允许进入 support signal
- 不得单独形成 formal trigger

### 5.2 `evapotranspiration_risk`

角色：support-only field

使用口径：

- 允许进入 explain
- 允许进入 support signal
- 不得单独形成 formal trigger

### 5.3 `sensor_quality_level`

角色：support-only field

使用口径：

- 允许进入 explain
- 允许进入 support signal
- 不得单独形成 formal trigger
- customer-facing 只能使用 `sensor_quality_level`，不得回落到 internal-only 的 `sensor_quality`

## 6. forbidden trigger fields 说明

以下字段在当前仓库中已被视为 formal trigger 禁入项：

- `fertility_state`
- `salinity_risk_state`
- `canopy_state`
- `water_flow_state`
- `irrigation_need_state`
- `irrigation_need_level`
- `sensor_quality`

当前仓库事实：

- recommendation Stage-1 boundary 测试已覆盖 forbidden field 拒绝行为
- forbidden field 不得重新包装成 formal trigger source
- forbidden field 若仍被 internal support path 引用，也不得提升为 formal provenance

## 7. 当前 recommendation / trigger 使用规则

当前仓库 recommendation / trigger 已满足以下规则：

1. formal trigger source 使用 Stage-1 formal action fields
2. support-only fields 不得单独触发 formal recommendation
3. forbidden trigger fields 不得进入 formal trigger main chain
4. recommendation submit-approval 必须带有 formal trigger provenance
5. simulator execute 仍禁止 recommendation / approval / operation id 直执行

## 8. customer-facing 与 internal payload 的当前边界

当前仓库 recommendation 输出面已做分层：

### 8.1 customer-facing explain

当前对外 explain 只保留：

- `trigger_source_fields`
- `action_summary`
- `rule_hit_summary`

### 8.2 internal debug explain

当前 internal debug explain 属于 internal payload，
不应出现在 customer-facing detail 或 control-plane detail 的对外返回中。

### 8.3 internal-only data sources

当前 recommendation payload 内部仍可能保留 internal support source，
例如：

- `field_sensing_overview_v1`
- `field_fertility_state_v1`
- `image_recognition`

但这些 internal-only source 不应直接作为 customer-facing route 输出的一部分。

## 9. 当前仓库可核实的实现与测试范围

截至本文件写入时，当前仓库已可核实的第二组相关对象包括：

- Stage-1 action boundary helper
- recommendation generate formal trigger 收口
- submit-approval provenance 校验
- customer-facing / internal payload 分层
- recommendation / control-plane / execute 边界测试

本文件只陈述这些已证实实现与测试所对应的边界结论，
不宣称高于仓库现实的上位规则。

## 10. 当前冻结结论

当前仓库 recommendation / trigger 已冻结为：

formal action trigger fields：

- `irrigation_effectiveness`
- `leak_risk`

support-only fields：

- `canopy_temp_status`
- `evapotranspiration_risk`
- `sensor_quality_level`

forbidden trigger fields：

- `fertility_state`
- `salinity_risk_state`
- `canopy_state`
- `water_flow_state`
- `irrigation_need_state`
- `irrigation_need_level`
- `sensor_quality`

后续 recommendation / trigger / approval provenance 的任何修改，都应保持与当前仓库已实现并已测试的这组边界一致。
