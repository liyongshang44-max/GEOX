# GEOX Metric 展示分级策略 V1

状态：冻结，用于产品化收口

适用范围：Telemetry metric 在 customer-facing 与 professional-facing 页面中的展示分级、固定归宿与来源标注口径

负责人：Product / Governance

---

## 1. 目标

本文件冻结 GEOX telemetry metric 的正式展示口径，解决以下问题：

- contracts 定义的 telemetry metric 范围大于当前产品主叙事范围
- Stage-1 sensing 当前仅将其中一部分 metric 作为正式推理输入
- 前端页面不允许继续自行拼接“哪些 metric 应该显示、显示在哪里、怎么命名”

本文件只定义展示策略，不修改以下内容：

- telemetry-ingest payload 契约
- device_observation 契约
- Stage-1 sensing inference 业务行为

---

## 2. 已核事实基线

当前 contracts 正式定义 11 个 telemetry metric：

- `air_temperature`
- `air_humidity`
- `soil_moisture`
- `light_lux`
- `soil_ec`
- `soil_ph`
- `soil_temperature`
- `canopy_temperature`
- `soil_salinity_index`
- `water_flow_rate`
- `water_pressure`

当前 Stage-1 sensing 官方映射中，以下 metric 已进入当前正式推理路径：

- `soil_moisture`
- `canopy_temperature`
- `soil_ec`
- `air_temperature`
- `air_humidity`
- `water_flow_rate`
- `water_pressure`

其中，一部分 metric 已接近 customer summary 使用场景，另一部分虽进入当前推理路径，但不适合进入 customer-facing 主叙事。

本策略的职责，是把“已进入当前推理路径”和“适不适合 customer-facing 主展示”这两个维度拆开，避免语义混淆。

---

## 3. 单一来源原则（强约束）

1. Display policy 必须只有一个正式上游来源。
2. 前端不得在页面本地自定义 metric 展示规则。
3. 所有展示到 Dashboard、Field、Device、Explain、Evidence、Recommendation、Operation telemetry 局部区域的 metric，必须能追溯到本 policy。
4. 未被本 policy 正式分级的 metric，不得随机出现在 customer-facing 主路径。

说明：

本策略优先要求工程侧将共享 display policy 放在：

`packages/contracts`

以减少前后端双份定义与口径漂移。

---

## 4. 正式 display tier 定义

V1 当前正式启用的 display tier 只有以下 3 个：

### 4.1 `customer_primary`

用于：

- Dashboard 主摘要 / 主卡
- customer-facing 主路径
- 销售演示主叙事

### 4.2 `customer_secondary`

用于：

- Field summary
- 趋势区
- supporting explanation 区域

说明：

进入该层的 metric 可以进入客户可见路径，但不进入 Dashboard 第一排主 KPI 叙事。

### 4.3 `professional_detail`

用于：

- Field technical detail
- Device detail
- Agronomy / diagnostics / professional investigation

说明：

进入该层的 metric 可以正式展示，但不属于 customer-facing 主叙事。

### 4.4 关于 `raw_only`

`raw_only` 不作为 V1 当前正式启用的 display tier。

它只保留为 reasoning_status 维度中的一个状态概念，用于表达“仅原始观测展示”的语义。

V1 当前没有任何量产 customer-facing metric 被分配到 `raw_only` display tier。

---

## 5. 正式 reasoning_status 定义（写死）

reasoning_status 必须冻结为以下正式枚举，不允许页面自行拼接字符串：

- `PRIMARY_REASONING_INPUT`
- `SECONDARY_REASONING_INPUT`
- `PROFESSIONAL_ONLY`
- `RAW_ONLY`
- `NOT_IN_CURRENT_REASONING`

### 5.1 `PRIMARY_REASONING_INPUT`

已进入当前正式推理路径，且允许进入 customer-facing 主叙事。

### 5.2 `SECONDARY_REASONING_INPUT`

已进入当前正式推理路径，但不进入 primary customer story。

它可以出现在：

- customer secondary 区域
- professional detail 区域
- explain / evidence supporting basis

### 5.3 `PROFESSIONAL_ONLY`

仅适用于专业展示层，不代表进入当前主推理链。

### 5.4 `RAW_ONLY`

仅原始观测展示，不作为当前正式推理输入。

### 5.5 `NOT_IN_CURRENT_REASONING`

虽在 contracts 中正式存在，但未进入当前正式推理路径。

---

## 6. 共享 policy 最小字段集（结构契约）

为避免执行组在共享常量落地时再次自由发挥，正式共享 policy 至少必须包含以下字段：

- `metric`
- `display_tier`
- `reasoning_status`
- `display_label_zh`
- `display_label_en`
- `canonical_unit`
- `show_on_dashboard`
- `show_on_field_summary`
- `show_on_field_detail`
- `show_on_device_detail`
- `show_on_explain`
- `source_field_key` 或 `source_field_aliases`

说明：

如果工程实现需要增加更多布尔位或固定路由字段，可以在此基础上扩展，但不得删减上述最小字段集，也不得改写其语义。

---

## 7. 固定页面归宿规则

### 7.1 `soil_moisture` 固定归宿（强约束）

`soil_moisture` 不允许继续作为“前端现拼是否展示”的指标。

它的正式固定归宿为：

- Field 页面 -> 土壤状态卡 / 区域
- Field 页面 -> 趋势区
- Explain / Evidence / Agronomy basis 中，当其被直接引用时必须可见

其正式口径为：

- `display_tier = customer_secondary`
- `reasoning_status = SECONDARY_REASONING_INPUT`

说明：

`soil_moisture` 已进入当前正式推理路径，但在 V1 中不提升为 Dashboard 第一排主 KPI。

---

## 8. 来源标签规则

每个已展示的 metric，必须具备以下之一：

- 正式来源字段
- 等价预留字段

可接受字段名例如：

- `source_kind`
- `source_label`
- `source_type`
- `data_origin`

推荐标准值：

- `device_observation`
- `external_background`
- `derived_state`
- `mixed`

说明：

本要求的目标，是避免“来源标签只是视觉文案，但没有字段承载”的假实现。

---

## 9. 正式 metric 分类表

| metric | canonical_unit | display_tier | reasoning_status | display_label_zh | display_label_en | 固定页面归宿 / 正式去向 | 页面规则 |
|---|---|---|---|---|---|---|---|
| `air_temperature` | `°C` | `customer_primary` | `PRIMARY_REASONING_INPUT` | 空气温度 | Air Temperature | Dashboard / Field summary / Explain / telemetry-consuming operation 局部区域 | 可进入 customer-facing 主路径 |
| `air_humidity` | `%RH` | `customer_primary` | `PRIMARY_REASONING_INPUT` | 空气湿度 | Air Humidity | Dashboard / Field summary / Explain / telemetry-consuming operation 局部区域 | 可进入 customer-facing 主路径 |
| `canopy_temperature` | `°C` | `customer_primary` | `PRIMARY_REASONING_INPUT` | 冠层温度 | Canopy Temperature | Dashboard / Field summary / Explain | 可进入 customer-facing 主路径 |
| `water_flow_rate` | `L/min` | `customer_primary` | `PRIMARY_REASONING_INPUT` | 灌溉流量 | Irrigation Flow Rate | Dashboard / Field summary / irrigation telemetry 局部区域 / Explain | 可进入 customer-facing 主路径 |
| `water_pressure` | `kPa` | `customer_primary` | `PRIMARY_REASONING_INPUT` | 灌溉压力 | Irrigation Pressure | Dashboard / Field summary / irrigation telemetry 局部区域 / Explain | 可进入 customer-facing 主路径 |
| `soil_moisture` | `%VWC` | `customer_secondary` | `SECONDARY_REASONING_INPUT` | 土壤湿度 | Soil Moisture | Field 页面土壤状态区 / Field 趋势区 / Explain-Evidence basis | 固定归宿，前端不得现拼 |
| `soil_ec` | `dS/m` | `professional_detail` | `SECONDARY_REASONING_INPUT` | 土壤电导率 | Soil Electrical Conductivity | Field technical detail / Device detail / Diagnostics | 已进入当前推理路径，但不得进入 primary customer story |
| `soil_ph` | `pH` | `professional_detail` | `NOT_IN_CURRENT_REASONING` | 土壤酸碱度 | Soil pH | Field technical detail / Device detail / Professional investigation | 若展示，不得描述为当前主决策核心指标 |
| `soil_temperature` | `°C` | `professional_detail` | `NOT_IN_CURRENT_REASONING` | 土壤温度 | Soil Temperature | Field technical detail / Device detail / Professional investigation | 若展示，不得描述为当前主决策核心指标 |
| `soil_salinity_index` | `index` | `professional_detail` | `NOT_IN_CURRENT_REASONING` | 土壤盐分指数 | Soil Salinity Index | Field technical detail / Device detail / Professional investigation | 若展示，不得描述为当前主决策核心指标 |
| `light_lux` | `lux` | `professional_detail` | `NOT_IN_CURRENT_REASONING` | 光照强度 | Light Intensity | Device detail / Professional investigation | 若展示，不得描述为当前主决策核心指标 |

---

## 10. 页面级使用规则

### 10.1 Dashboard

Dashboard 只允许展示：

- `customer_primary`

禁止：

- 未正式分级的 metric 出现在主卡
- `customer_secondary` 或 `professional_detail` metric 被抬升到主 KPI 第一排

### 10.2 Field 页面

Field summary 可展示：

- `customer_primary`
- `customer_secondary`

Field technical detail 可展示：

- `professional_detail`

其中：

- `soil_moisture` 必须按固定页面归宿出现
- 不允许页面本地条件判断将其隐藏或随意迁移

### 10.3 Device detail

Device detail 可以展示比 Dashboard / Field summary 更宽的 metric 覆盖，但必须满足：

- 仅展示已被本 policy 正式分级的 metric
- contracts 中虽定义、但未被本 policy 正式分级的 metric，不得默认渲染

说明：

Device detail 不得成为“技术垃圾桶页面”。

### 10.4 Explain / Evidence / Recommendation

当 telemetry metric 被直接引用时，页面必须能够表达：

- 友好名称
- 值
- 单位
- 来源字段或等价预留字段
- reasoning_status

同时增加解释性约束：

- 若引用的是 `professional_detail` 指标，或 `NOT_IN_CURRENT_REASONING` 指标，不得将其描述为当前主决策核心指标
- 技术上显示 reasoning_status 不能替代文案约束

### 10.5 Operation 范围规则

Operation 页面仅处理“直接消费 telemetry metric 的局部区域”。

本策略不要求重构 operation 全页，不允许借机扩大页面改造范围。

---

## 11. 反向约束

以下 customer-facing 主路径禁止出现未正式分级 metric：

- Dashboard 第一排主卡
- customer-facing summary 区
- 销售演示 headline summary
- 任何对外主叙事区域

---

## 12. 面向工程实现的最低要求

工程执行必须满足：

1. display policy 的正式共享定义优先落在 `packages/contracts`
2. `reasoning_status` 使用冻结枚举，不允许页面拼字符串
3. `soil_moisture` 具备固定页面归宿，不允许现拼
4. `soil_ec` 必须保持：
   - `display_tier = professional_detail`
   - `reasoning_status = SECONDARY_REASONING_INPUT`
5. 来源标签必须为正式字段或等价预留字段
6. Device detail 只展示正式分级 metric
7. 未正式分级 metric 不得出现在 customer-facing 主路径
8. Operation 改造范围仅限 telemetry-consuming 局部区域

---

## 13. 产品解释说明

本策略不是为了把所有 telemetry metric 都抬到 customer-facing 页面。

本策略的目标，是在不破坏现有 contracts 和 sensing 主链的前提下，建立一套：

- 客户看得懂
- 销售讲得清
- 开发实现不漂移
- 专业层仍可深入

的正式展示分级口径。
