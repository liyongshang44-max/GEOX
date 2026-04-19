# GEOX 第一阶段 field sensing summary 冻结口径

## 一、文档目的

本文件用于冻结 GEOX 第一阶段正式 field sensing summary 对外口径，作为后续产品组、决策组、销售叙事组、接口组、前端组共同依赖的唯一 summary 合同依据。

本文件不讨论所有 internal read model 的完整结构，也不讨论未来 Stage-2 或更高阶段的 sensing summary 扩展。  
本文件只讨论当前 GitHub main 中已经真实落入 Stage-1 sensing contract、正式投影、正式 route 与主详情 contract 的 customer-facing field sensing summary 口径。

本文件的目标是切断后续所有“客户页到底该展示哪个字段”“哪些字段只是内部聚合”“哪些字段可以进正式 contract”“freshness/no_data/fallback 到底怎么解释”的猜测空间。

## 二、适用范围

本文件直接适用于以下对象与链路：

1. `field_sensing_summary_stage1_v1` 正式投影  
2. fields 子域正式 Stage-1 sensing route  
3. field 主详情中的 `stage1_sensing_summary`

本文件同时适用于与上述正式 contract 共享同一 Stage-1 sensing contract 的 customer-facing sensing summary 实现。dashboard 子域若复用同一正式 contract，则应以同一 Stage-1 sensing contract 为准。

本文件不适用于：

`field_sensing_overview_v1` internal overview 全量结构  
internal/debug/compatibility route 返回的 mixed read-model payload  
compatibility-only fields  
future Stage-2 / Stage-3 sensing summary contract  
前端自行拼装的临时扩展字段

## 三、summary 合同总述

第一阶段正式 field sensing summary 的冻结原则如下：

1. `stage1_sensing_summary` 是当前 field 级 customer-facing sensing source-of-truth  
2. `field_sensing_overview_v1` 是 internal aggregation source，不是正式对外合同  
3. `sensing-read-models` 相关 mixed payload 是 internal/debug/compatibility contract，不是 customer-facing source-of-truth  
4. field 主详情中的其他聚合字段，例如 `summary`、`sensor_trends`、`recent_alerts`、`map_layers`，不属于 Stage-1 sensing contract  
5. compatibility-only state 或 internal-only 字段不得进入正式 customer-facing summary

## 四、customer-facing Stage-1 summary 合同结构

当前第一阶段正式 customer-facing field sensing summary 顶层结构冻结为以下字段集合：

`canopy_temp_status`  
`evapotranspiration_risk`  
`sensor_quality_level`  
`irrigation_effectiveness`  
`leak_risk`  
`official_soil_metrics_json`  
`freshness`  
`confidence`  
`computed_at_ts_ms`  
`updated_ts_ms`

这些字段构成第一阶段正式 customer-facing sensing summary 的最小合同集合。除非通过 successor contract 升级，否则后续任何组不得自行扩大该字段集。

## 五、customer-facing summary 字段定义

### 5.1 `canopy_temp_status`

中文语义：冠层温度状态  
来源状态：`canopy_temperature_state`  
字段角色：customer-facing diagnostic field  
是否允许为空：允许  
空值语义：当前缺少足够输入形成正式状态，不能由前端猜值  
前端展示建议：用于表达当前冠层温度状态，应以状态文案或等级文案呈现  
说明：该字段是正式 contract 字段，不得被 internal canopy compatibility 字段替代

### 5.2 `evapotranspiration_risk`

中文语义：蒸散风险  
来源状态：`evapotranspiration_risk_state`  
字段角色：customer-facing diagnostic field  
是否允许为空：允许  
空值语义：当前缺少足够输入形成正式状态  
前端展示建议：用于表达蒸散风险水平，应定位为诊断和辅助判断字段  
说明：该字段虽为正式 contract 字段，但当前 Stage-1 classification 中属于 diagnostic state 映射结果，不应被包装成当前 Stage-1 决策主状态

### 5.3 `sensor_quality_level`

中文语义：传感器质量等级  
来源状态：`sensor_quality_state`  
字段角色：customer-facing diagnostic field  
是否允许为空：允许  
空值语义：当前缺少足够质量输入，不能默认等于 good/fair/poor 任一等级  
前端展示建议：用于表达当前传感器质量等级  
说明：customer-facing 正式字段只能是 `sensor_quality_level`，不得使用 internal-only 的 `sensor_quality`

### 5.4 `irrigation_effectiveness`

中文语义：灌溉有效性  
来源状态：`irrigation_effectiveness_state`  
字段角色：customer-facing decision field  
是否允许为空：允许  
空值语义：当前缺少足够流量/压力输入形成正式状态  
前端展示建议：用于表达当前灌溉执行是否有效，可进入客户侧主叙事  
说明：这是第一阶段 customer-facing summary 中最核心的正式 decision 字段之一

### 5.5 `leak_risk`

中文语义：泄漏风险  
来源状态：`leak_risk_state`  
字段角色：customer-facing decision field  
是否允许为空：允许  
空值语义：当前缺少足够流量/压力输入形成正式状态  
前端展示建议：用于表达当前泄漏或水路异常风险  
说明：这是第一阶段 customer-facing summary 中最核心的正式 risk decision 字段之一

### 5.6 `official_soil_metrics_json`

中文语义：正式土壤/营养指标子结构  
来源：Stage-1 official summary soil metrics subset  
字段角色：customer-facing summary sub-structure  
是否允许为空：允许，允许为空数组  
空值语义：当前没有足够土壤/营养指标进入正式 summary subset，不代表系统错误  
前端展示建议：只按正式 subset 受控呈现，不得全量平铺 internal soil indicator 容器  
说明：这是正式 summary 子结构，不等于 complete input whitelist，也不等于 internal overview 的 soil aggregation 容器

### 5.7 `freshness`

中文语义：summary 新鲜度  
来源：refresh / freshness contract  
字段角色：customer-facing freshness field  
是否允许为空：不允许，若无法判断则必须返回 `unknown`  
允许值：`fresh`、`stale`、`unknown`  
前端展示建议：用于说明当前 summary 的时效性，不得由前端重新发明枚举  
说明：`freshness` 是正式 Stage-1 summary 合同字段，必须遵守统一枚举

### 5.8 `confidence`

中文语义：summary 置信度  
来源：summary projection 计算或 contract 承载  
字段角色：customer-facing supporting field  
是否允许为空：允许  
空值语义：当前无法给出稳定置信度  
前端展示建议：若展示，应使用谨慎文案；若不展示，不得自行推断其他值  
说明：`confidence` 是正式 summary 合同允许字段，但展示策略可由产品层控制

### 5.9 `computed_at_ts_ms`

中文语义：summary 计算时间戳  
来源：summary projection  
字段角色：contract metadata field  
是否允许为空：允许  
空值语义：当前 summary 尚未形成稳定计算结果  
前端展示建议：通常不作为主客户字段突出展示，但属于正式 contract 元数据  
说明：该字段可用于系统内部或高可信场景说明，不得被前端误当业务状态字段

### 5.10 `updated_ts_ms`

中文语义：summary 投影更新时间戳  
来源：summary projection  
字段角色：contract metadata field  
是否允许为空：不允许  
空值语义：不适用，正式 summary 投影必须携带该时间戳  
前端展示建议：通常不作为主客户字段突出展示，但属于正式 contract 元数据  
说明：该字段用于标识当前 summary projection 的最终更新时间，不得被前端误当业务状态字段。

## 六、official soil metrics 子结构冻结规则

`official_soil_metrics_json` 当前是第一阶段正式 customer-facing summary 中唯一允许承载土壤/营养展示指标的正式子结构。

其冻结规则如下：

1. 只能承载 Stage-1 official summary soil metrics subset  
2. 当前允许的 metric 范围仅包括：  
   `soil_moisture_pct`  
   `ec_ds_m`  
   `fertility_index`  
   `n`  
   `p`  
   `k`  
3. 不得把 internal overview 中更宽的 soil indicators 全量平铺进 customer-facing summary  
4. 不得把 Stage-1 official pipeline canonical inputs 直接裸露成 soil summary 子结构  
5. 若未来需要扩展更多 soil summary metrics，必须通过 successor contract 升级，而不是直接修改 Stage-1

## 七、customer-facing forbidden fields

以下字段当前禁止进入第一阶段正式 customer-facing summary：

`sensing_overview`  
`fertility_state`  
`salinity_risk_state`  
`sensor_quality`  
`irrigation_need_level`  
`canopy_state`  
`water_flow_state`  
`irrigation_need_state`

冻结说明如下：

1. `sensing_overview` 是 internal aggregation payload，不是正式 customer-facing contract  
2. `fertility_state`、`salinity_risk_state` 属于 internal/secondary state，不是当前 Stage-1 customer-facing summary 正式字段  
3. `sensor_quality` 是 internal-only 字段，customer-facing 只能使用 `sensor_quality_level`  
4. `irrigation_need_level` 及其源状态 `irrigation_need_state` 已属于 compatibility-only 路径  
5. `canopy_state`、`water_flow_state` 属于 compatibility-only state，不得再进入 Stage-1 customer-facing summary

## 八、internal summary / internal overview 边界

当前仓库仍然保留 internal summary / internal overview 相关结构，但这些结构不得被后续组误读为正式 customer-facing contract。

冻结边界如下：

1. `field_sensing_overview_v1` 属于 internal aggregation source  
2. `sensing-read-models` route 属于 internal/debug/compatibility contract  
3. internal payload 中即使出现 `sensing_summary_stage1`，也不改变该 route 的非正式合同属性  
4. customer-facing source-of-truth 只能是正式 Stage-1 sensing summary contract  
5. field 主详情中的其他 field detail 聚合字段，不属于 sensing source-of-truth

## 九、refresh / freshness 承载语义

第一阶段正式 field sensing summary 中，refresh 与 freshness 的承载规则冻结如下。

### 9.1 summary payload 内承载

`freshness` 是 summary payload 的正式字段，允许值固定为：

`fresh`  
`stale`  
`unknown`

解释如下：

`fresh`：当前 summary 处于有效时效窗口内  
`stale`：当前 summary 已过期，但仍可读  
`unknown`：当前无法确认新鲜度

### 9.2 route envelope 内承载

正式 route 中还允许存在 `stage1_refresh` 或等价 envelope 元数据，用于表达 refresh 状态与刷新时间。

`status` 的正式解释固定为：

`ok`：本次刷新成功，返回当前有效结果  
`fallback_stale`：本次刷新未得到新结果，返回最近一次快照，结果可读但已过期  
`no_data`：当前没有足够数据形成正式 Stage-1 summary  
`error`：刷新失败且无可用 fallback

冻结规则如下：

1. 前端不得自行重定义 refresh/freshness 枚举  
2. `no_data` 不等于系统错误  
3. compatibility-only 字段不得单独构成正式 hasData  
4. customer-facing 文案若要表达 freshness 或 refresh，必须以正式 contract 枚举为准

## 十、fields 子域中的 contract 边界

当前 fields 子域中，正式 sensing contract 边界冻结如下：

1. `/api/v1/fields/:field_id/sensing-summary` 是 customer-facing Stage-1 sensing source-of-truth route  
2. `/api/v1/fields/:field_id/sensing-read-models` 是 internal/debug/compatibility route，不是 source-of-truth  
3. `GET /api/v1/fields/:field_id` 主详情中，`stage1_sensing_summary` 是正式 sensing contract 部分  
4. 主详情中的 `summary`、`sensor_trends`、`recent_alerts`、`map_layers` 等仅为 field detail 非合同聚合字段  
5. 后续产品页与字段页若需要感知正式口径，应直接依赖 `stage1_sensing_summary`，不得绕回 mixed read-model 或其他 detail 聚合字段自行拼装

## 十一、后续使用规则

自本文件冻结后，后续所有组必须遵守以下规则：

1. customer-facing field sensing source-of-truth 只认正式 Stage-1 sensing summary contract  
2. internal overview 不得被产品层继续当正式 summary 使用  
3. compatibility-only 字段不得重新进入 customer-facing contract  
4. internal-only 字段不得通过前端映射重新包装成 customer-facing 正式字段  
5. customer-facing soil metrics 只能来自 official summary soil metrics subset  
6. 若未来进入 Stage-2/Stage-3 sensing summary contract，必须通过 successor contract 升级，不得直接改写 Stage-1

## 十二、最终冻结结论

第一阶段正式 field sensing summary 对外口径已经形成如下稳定结论：

1. 正式 customer-facing field sensing source-of-truth 是 `stage1_sensing_summary`  
2. 正式 customer-facing summary 顶层字段固定为：  
   `canopy_temp_status`  
   `evapotranspiration_risk`  
   `sensor_quality_level`  
   `irrigation_effectiveness`  
   `leak_risk`  
   `official_soil_metrics_json`  
   `freshness`  
   `confidence`  
   `computed_at_ts_ms`  
   `updated_ts_ms`  
3. customer-facing forbidden fields 已冻结，不得重新进入正式合同  
4. internal overview、mixed read-model、field detail 其他聚合字段，不得再被误读为正式 Stage-1 sensing contract  
5. refresh / freshness / no_data / fallback 语义已冻结，后续不得再由前端或产品层自行解释

后续所有团队必须以本文件为第一阶段 field sensing summary 的唯一正式对外口径，不得再自行裁剪、扩写、降级或重命名正式 customer-facing sensing contract。
