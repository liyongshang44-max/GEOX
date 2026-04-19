# GEOX Stage-1 Recommendation / Trigger 边界冻结文件

## 1. 文档目的

本文件用于冻结当前仓库中 Stage-1 sensing 进入 recommendation / trigger 主链的正式边界。

本文件只描述当前 GitHub main 已实现的 recommendation / trigger 事实，不作为未来规则扩展设计文档，也不替代第一组 Stage-1 summary contract 文件。

本文件关注的是：

- recommendation formal input layer 是什么
- 哪些字段允许形成 formal trigger
- 哪些字段只能作为 support signal
- 哪些字段禁止重新进入 formal trigger 主链
- 当前 recommendation generate 的失败边界是什么

---

## 2. 当前 recommendation formal input layer

当前仓库 recommendation generate 的正式输入层为：

- `stage1_sensing_summary`

当前 recommendation formal trigger 不得直接由以下对象替代：

- `field_sensing_overview_v1`
- `field_fertility_state_v1`
- fields / dashboard internal mixed read-model route
- compatibility-only state
- internal-only 聚合字段

当前 recommendation formal trigger eligibility 必须先从 `stage1_sensing_summary` 中提取 formal trigger signals，再进入 recommendation 主链。

---

## 3. 当前 formal trigger fields

当前仓库 recommendation / trigger 的 formal action fields 冻结如下：

- `irrigation_effectiveness`
- `leak_risk`

当前 recommendation formal trigger 行为为：

- `irrigation_effectiveness = low` 时，可形成 formal recommendation trigger
- `leak_risk = high` 时，可形成 formal recommendation trigger

除以上两项外，当前仓库不存在其他已实现的 formal trigger field。

---

## 4. 当前 support-only fields

当前仓库 recommendation / trigger 的 support-only fields 冻结如下：

- `canopy_temp_status`
- `evapotranspiration_risk`
- `sensor_quality_level`

这些字段当前允许进入：

- recommendation explain
- support signal
- diagnosis / 辅助说明

这些字段当前不得单独进入：

- formal trigger eligibility
- formal trigger provenance
- submit-approval gating

也就是说，support-only field 可以解释 recommendation，但不能单独使 recommendation 成为 formal trigger recommendation。

---

## 5. 当前 forbidden trigger inputs

当前仓库 recommendation / trigger 主链禁止重新引入以下字段作为 formal trigger source：

- `fertility_state`
- `salinity_risk_state`
- `canopy_state`
- `water_flow_state`
- `irrigation_need_state`
- `irrigation_need_level`
- `sensor_quality`

这些字段当前即使仍存在于 internal payload、support path、compatibility path 中，也不得单独形成 formal trigger。

---

## 6. 当前 recommendation generate 的边界行为

截至当前仓库状态，recommendation generate 已满足以下边界：

### 6.1 formal trigger 成功条件

以下任一条件满足时，可形成 formal trigger recommendation：

- `irrigation_effectiveness = low`
- `leak_risk = high`

### 6.2 support-only 不触发

以下字段单独存在时，不形成 formal trigger recommendation：

- `canopy_temp_status`
- `evapotranspiration_risk`
- `sensor_quality_level`

当前行为是 generate 失败，并返回：

- `FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE`

### 6.3 forbidden field 拒绝

当输入中出现 forbidden trigger field 时，不允许进入 formal trigger 主链。

当前仓库已存在 forbidden field 拒绝行为，对应错误语义为：

- `STAGE1_FORBIDDEN_TRIGGER_FIELD`

### 6.4 overview 不能单独触发

即使 `field_sensing_overview_v1` 内部已有足够 soil / canopy 等指标，只要 formal trigger fields 不成立，也不能单独形成 recommendation trigger。

当前行为是 generate 失败，并返回：

- `FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE`

### 6.5 formal input layer 缺失失败

当 `stage1_sensing_summary` formal input layer 缺失时，recommendation generate 不进入 formal trigger 主链。

当前行为是 generate 失败，并返回：

- `FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE`

---

## 7. 当前 recommendation / trigger 冻结结论

当前仓库 recommendation / trigger 已冻结为以下口径：

### formal input layer

- `stage1_sensing_summary`

### formal trigger fields

- `irrigation_effectiveness`
- `leak_risk`

### support-only fields

- `canopy_temp_status`
- `evapotranspiration_risk`
- `sensor_quality_level`

### forbidden trigger inputs

- `fertility_state`
- `salinity_risk_state`
- `canopy_state`
- `water_flow_state`
- `irrigation_need_state`
- `irrigation_need_level`
- `sensor_quality`

---

## 8. 当前测试约束口径

截至本文件冻结时，第二组 recommendation / trigger 边界已有对应测试约束；具体测试文件与覆盖范围以后续仓库核实结果为准。

---

## 9. 文档定位

本文件只陈述当前仓库 recommendation / trigger 边界的已实现事实。

本文件不声明高于仓库现实的上位政策，也不将尚未实现的 future rule、future field、future chain 视为已冻结能力。

后续如 recommendation / trigger 边界发生变更，应先更新实现与测试，再更新本文件。
