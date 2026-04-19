# GEOX 第一阶段感知派生状态清单

## 一、文档目的

本文件用于冻结 GEOX 第一阶段正式感知派生状态清单，作为后续产品组、决策组、销售叙事组、接口组共同依赖的唯一状态口径依据。

本文件不讨论农业理论上的所有可能状态，也不讨论未来可能增加的 sensing intelligence。
本文件只讨论当前 GitHub main 中已经真实进入 GEOX 第一阶段感知闭环、并已经在正式 contract、projection、route 和测试中形成边界的派生状态集合。

本文件的目标是切断后续所有“这个 state 到底是不是第一阶段正式状态”“这个 state 能不能直接给客户看”“这个 state 能不能被决策链使用”的猜测空间。

## 二、适用范围

本文件直接适用于以下对象与链路：

1. sensing inference pipeline  
2. Stage-1 sensing contract  
3. `field_sensing_summary_stage1_v1` 正式投影  
4. fields 子域正式 Stage-1 sensing route  
5. field 主详情中的 `stage1_sensing_summary`

本文件同时适用于与上述正式 contract 共享同一 Stage-1 sensing contract 的 customer-facing sensing summary 实现。dashboard 子域若复用同一正式 contract，则应以同一 Stage-1 sensing contract 为准。

本文件不适用于：

尚未进入正式 Stage-2 或更高阶段的扩展状态  
仅用于 internal/debug/compatibility 路径的历史状态  
control-plane / approval / execution / acceptance 主链状态  
前端临时拼装出来的解释性文案或展示标签

## 三、状态分层模型

为防止后续继续把“可展示状态”“诊断状态”“兼容状态”混在一起，第一阶段正式感知派生状态固定拆为三层。

### 3.1 第一层：official decision states

这是第一阶段允许进入后续经营判断、动作建议、产品主叙事的正式状态层。

其特点是：

直接服务于灌溉闭环、风险判断、有效性判断  
可以进入 customer-facing Stage-1 sensing summary  
可以被后续产品和决策逻辑作为正式状态引用  
必须以正式 Stage-1 sensing contract 为准

### 3.2 第二层：official diagnostic states

这是第一阶段允许进入正式合同，但主要承担诊断、说明、补充判断作用的状态层。

其特点是：

可进入正式 contract  
可被客户看到  
但其主要用途不是直接驱动经营动作，而是支撑诊断、解释和辅助感知判断

### 3.3 第三层：compatibility-only states

这是仅为兼容、历史遗留或内部保留而存在的状态层。

其特点是：

不得再作为 customer-facing Stage-1 summary 的正式状态来源  
不得被新逻辑重新拉回正式决策主口径  
即使在 internal/debug 路径中仍可见，也不构成第一阶段正式合同的一部分

## 四、第一阶段正式 decision states

根据当前主链和 `STAGE1_STATE_CLASSIFICATION` 的真实冻结口径，第一阶段正式 decision states 冻结为以下状态。

### 4.1 `irrigation_effectiveness_state`

中文语义：灌溉有效性状态  
状态层级：official decision state

来源输入：
`water_flow_rate`  
`water_pressure`

主要聚合字段：
`inlet_flow_lpm`  
`pressure_drop_kpa`

输出语义：
用于表达当前灌溉执行是否有效，是第一阶段灌溉闭环最核心的正式状态之一。

正式 summary 对应字段：
`irrigation_effectiveness`

是否允许进入 customer-facing summary：允许  
是否允许被后续决策逻辑引用：允许  
是否允许被销售叙事直接引用：允许

冻结说明：  
`irrigation_effectiveness_state` 是第一阶段最具销售价值的正式 decision state 之一。  
后续任何“灌溉是否生效”的判断，必须以该状态及其正式 summary 字段为准，不得由前端或产品层自行拼装。

### 4.2 `leak_risk_state`

中文语义：泄漏风险状态  
状态层级：official decision state

来源输入：
`water_flow_rate`  
`water_pressure`

主要聚合字段：
`inlet_flow_lpm`  
`pressure_drop_kpa`

输出语义：
用于表达当前水路是否存在泄漏或异常流量/压力相关风险，是第一阶段灌溉闭环的重要风险状态。

正式 summary 对应字段：
`leak_risk`

是否允许进入 customer-facing summary：允许  
是否允许被后续决策逻辑引用：允许  
是否允许被销售叙事直接引用：允许

冻结说明：  
`leak_risk_state` 是第一阶段正式 risk decision state。  
后续任何关于“是否可能存在水路泄漏风险”的客户侧表达，应以 `leak_risk` 正式字段为准。

## 五、第一阶段正式 diagnostic states

根据当前主链和 `STAGE1_STATE_CLASSIFICATION` 的真实冻结口径，第一阶段正式 diagnostic states 冻结为以下状态。

### 5.1 `canopy_temperature_state`

中文语义：冠层温度状态  
状态层级：official diagnostic state

来源输入：
`canopy_temperature`  
`air_temperature`  
`air_humidity`

主要聚合字段：
`canopy_temp_c`  
`ambient_temp_c`  
`relative_humidity_pct`

输出语义：
用于表达冠层温度相关的状态判断，是蒸散风险、环境诊断与作物状态理解的重要诊断层状态。

正式 summary 对应字段：
`canopy_temp_status`

是否允许进入 customer-facing summary：允许  
是否允许被后续决策逻辑引用：允许，但主要作为诊断与辅助判断  
是否允许被销售叙事直接引用：允许，但应定位为诊断性说明，不宜夸张成独立经营结论

冻结说明：  
`canopy_temperature_state` 是正式 diagnostic state，不是 compatibility 状态。  
后续任何“冠层温度状态”类表述，应通过 `canopy_temp_status` 进入客户视图，而不是直接暴露内部 payload。

### 5.2 `evapotranspiration_risk_state`

中文语义：蒸散风险状态  
状态层级：official diagnostic state

来源输入：
`canopy_temperature`  
`air_temperature`  
`air_humidity`

主要聚合字段：
`canopy_temp_c`  
`ambient_temp_c`  
`relative_humidity_pct`

输出语义：
用于表达当前环境与冠层相关的蒸散风险水平，是第一阶段正式感知闭环中的重要诊断状态。

正式 summary 对应字段：
`evapotranspiration_risk`

是否允许进入 customer-facing summary：允许  
是否允许被后续决策逻辑引用：允许，但主要作为诊断与辅助判断，不属于当前 Stage-1 contract 冻结的 decision state  
是否允许被销售叙事直接引用：允许，但必须以正式 contract 字段为准，且不得表述为当前 Stage-1 正式动作决策状态

冻结说明：  
`evapotranspiration_risk_state` 当前在 `STAGE1_STATE_CLASSIFICATION` 中被冻结为 official diagnostic state，而不是 official decision state。  
它可以进入正式合同、可以给客户看、可以辅助判断，但不能被文档或产品叙事提升为当前 Stage-1 contract 明确冻结的 decision state。

### 5.3 `sensor_quality_state`

中文语义：传感器质量状态  
状态层级：official diagnostic state

来源输入：
传感器质量相关 observation canonical fields，以及正式 contract 中已冻结的诊断输入边界

输出语义：
用于表达传感器数据质量、可信度、退化程度等诊断性信息。

正式 summary 对应字段：
`sensor_quality_level`

internal-only 衍生字段：
`sensor_quality`

是否允许进入 customer-facing summary：允许，但仅以 `sensor_quality_level` 形式进入  
是否允许被后续决策逻辑引用：允许，主要作为诊断与数据可信度辅助判断  
是否允许被销售叙事直接引用：允许，但必须使用正式 customer-facing 字段，不得使用 internal-only 字段

冻结说明：  
`sensor_quality_state` 属于第一阶段正式 diagnostic state。  
customer-facing 正式字段只能是 `sensor_quality_level`。  
`sensor_quality` 仅保留为 internal-only 字段，不得重新拉回正式对外合同。

## 六、第一阶段 internal/secondary states

当前仓库主链中还存在部分真实派生状态，但它们在第一阶段不属于 customer-facing 正式 decision/diagnostic 主叙事层，本文冻结为 internal/secondary states。

### 6.1 `fertility_state`

中文语义：肥力状态  
状态层级：internal/secondary state

来源输入：
`soil_moisture`  
`canopy_temperature`  
`soil_ec`

主要聚合字段：
`soil_moisture_pct`  
`canopy_temp_c`  
`ec_ds_m`

输出语义：
用于表达与土壤肥力相关的内部推断状态。

是否进入 customer-facing Stage-1 summary：不直接进入  
当前在 fields internal/debug 路径中是否仍可见：可见  
是否允许作为新客户合同字段：不允许  
是否允许后续产品层自行拉回正式 summary：不允许

冻结说明：  
`fertility_state` 当前虽然仍是仓库真实状态，但它不属于第一阶段 customer-facing Stage-1 sensing summary 正式白名单。  
后续若要让肥力状态进入更高阶段正式合同，必须通过 successor contract，而不是直接修改 Stage-1。

### 6.2 `salinity_risk_state`

中文语义：盐分风险状态  
状态层级：internal/secondary state

来源输入：
`soil_moisture`  
`canopy_temperature`  
`soil_ec`

主要聚合字段：
`soil_moisture_pct`  
`canopy_temp_c`  
`ec_ds_m`

输出语义：
用于表达与盐分风险相关的内部推断状态。

是否进入 customer-facing Stage-1 summary：不直接进入  
是否允许作为新客户合同字段：不允许  
是否允许后续产品层自行拉回正式 summary：不允许

冻结说明：  
`salinity_risk_state` 当前属于 internal/secondary state。  
它在仓库中可存在，但不属于第一阶段正式 customer-facing sensing contract 的状态层。

## 七、compatibility-only states

当前第一阶段需要明确冻结的 compatibility-only states 如下。

### 7.1 `canopy_state`

中文语义：历史冠层状态兼容名  
状态层级：compatibility-only state

当前保留原因：
历史命名兼容与旧读模型兼容路径保留

是否允许进入 customer-facing Stage-1 summary：不允许  
是否允许作为正式 source-of-truth：不允许  
是否允许被后续新逻辑直接依赖：不允许

冻结说明：  
`canopy_state` 是当前仓库 contract 明确冻结的 compatibility-only state。  
它不得再作为 Stage-1 customer-facing summary 的正式状态来源。  
正式 customer-facing 冠层相关状态应使用 `canopy_temperature_state` 及其映射字段 `canopy_temp_status`。

### 7.2 `water_flow_state`

中文语义：历史水流状态兼容名  
状态层级：compatibility-only state

当前保留原因：
历史命名兼容与旧读模型兼容路径保留

是否允许进入 customer-facing Stage-1 summary：不允许  
是否允许作为正式 source-of-truth：不允许  
是否允许被后续新逻辑直接依赖：不允许

冻结说明：  
`water_flow_state` 是当前仓库 contract 明确冻结的 compatibility-only state。  
它不得再作为 Stage-1 customer-facing summary 的正式状态来源。  
正式 customer-facing 灌溉/水路相关状态应使用 `irrigation_effectiveness_state`、`leak_risk_state` 及其正式 summary 映射字段。

### 7.3 `irrigation_need_state`

中文语义：灌溉需求状态  
状态层级：compatibility-only state

当前保留原因：
历史兼容与旧逻辑兼容路径保留

是否允许进入 customer-facing Stage-1 summary：不允许  
是否允许作为正式 source-of-truth：不允许  
是否允许单独构成正式 hasData：不允许  
是否允许继续被新产品逻辑依赖：不允许

冻结说明：  
`irrigation_need_state` 虽然在仓库中仍保留 compatibility-only 路径，但它已经不是第一阶段正式状态白名单成员。  
对应的 `irrigation_need_level` 不得再作为 Stage-1 customer-facing summary 正式字段。  
后续任何新逻辑若继续使用该状态，均视为违反第一组冻结规则。

## 八、状态与 summary 字段映射关系

第一阶段正式状态与 summary 字段映射关系冻结如下：

`canopy_temperature_state` → `canopy_temp_status`  
`evapotranspiration_risk_state` → `evapotranspiration_risk`  
`sensor_quality_state` → `sensor_quality_level`（customer-facing）  
`sensor_quality_state` → `sensor_quality`（internal-only）  
`irrigation_effectiveness_state` → `irrigation_effectiveness`  
`leak_risk_state` → `leak_risk`

兼容状态映射：

`irrigation_need_state` → `irrigation_need_level`（compatibility-only，不属于正式 Stage-1 customer-facing summary）

同时需要明确：

`canopy_state` 是 `canopy_temperature_state` / `evapotranspiration_risk_state` 的 compatibility-only alias source。  
`water_flow_state` 是 `irrigation_effectiveness_state` / `leak_risk_state` 的 compatibility-only alias source。

internal/secondary 状态：

`fertility_state` 不进入 Stage-1 customer-facing summary  
`salinity_risk_state` 不进入 Stage-1 customer-facing summary

冻结规则如下：

1. 正式 customer-facing summary 只能使用正式映射结果  
2. internal-only 字段不得重新进入 customer-facing contract  
3. compatibility-only 映射不得重新进入 customer-facing contract  
4. 后续若要增加新映射，必须通过 successor contract，而不是直接修改 Stage-1 合同

## 九、状态使用规则

自本清单冻结后，后续所有组必须遵守以下规则：

1. official decision states 可进入客户主叙事与后续正式决策引用  
2. official diagnostic states 可进入正式合同，但主要承担诊断与辅助说明作用  
3. internal/secondary states 不得由前端、产品、销售侧自行拉回正式 customer-facing contract  
4. compatibility-only states 不得重新被包装为正式状态  
5. 后续任何动作、告警、推荐，若要引用第一阶段正式状态，必须以 Stage-1 sensing contract 和正式 summary 字段为准  
6. 若未来进入 Stage-2/Stage-3 sensing contract，必须通过 successor contract 明确升级

## 十、最终冻结结论

第一阶段正式感知派生状态清单已经形成如下稳定结论：

第一阶段正式 decision states：

`irrigation_effectiveness_state`  
`leak_risk_state`

第一阶段正式 diagnostic states：

`canopy_temperature_state`  
`evapotranspiration_risk_state`  
`sensor_quality_state`

第一阶段 internal/secondary states：

`fertility_state`  
`salinity_risk_state`

第一阶段 compatibility-only states：

`canopy_state`  
`water_flow_state`  
`irrigation_need_state`

后续所有团队必须以此为第一阶段正式状态口径，不得再自行推断、平铺或重新升级 compatibility-only/internal 状态为 Stage-1 正式状态。
