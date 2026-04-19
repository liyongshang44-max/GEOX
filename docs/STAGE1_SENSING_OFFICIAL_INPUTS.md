# GEOX 第一阶段感知标准输入清单

## 一、文档目的

本文件用于冻结 GEOX 第一阶段正式感知输入白名单，作为后续产品组、决策组、销售叙事组、接口组共同依赖的唯一输入口径依据。

本文件不是农业常识清单，也不是设备厂商能力罗列。
本文件只讨论当前 GitHub main 中已经真实进入 GEOX 第一阶段感知业务闭环的输入层定义，并将其正式区分为：

第一类：第一阶段正式商业闭环输入  
第二类：仓库支持但不纳入第一阶段正式商业闭环的输入  
第三类：仅保留为兼容或历史归一用途的别名

本文件的目标是切断后续所有“这个 metric 到底算不算正式输入”的猜测空间。

## 二、适用范围

本文件直接适用于以下对象与链路：

1. 遥测 ingress 层  
2. `device_observation_v1` 及 observation canonicalization 层  
3. sensing inference pipeline  
4. `field_sensing_summary_stage1_v1` 正式投影  
5. fields 子域正式 Stage-1 sensing route  
6. field 主详情中的 `stage1_sensing_summary`

本文件同时适用于与上述正式 contract 共享同一 Stage-1 sensing contract 的 customer-facing sensing summary 实现。dashboard 子域若复用同一正式 contract，则应以同一 Stage-1 sensing contract 为准。

本文件不适用于：

未来尚未进入正式 Stage-2 或更高阶段的 sensing 扩展  
纯设备运行态 heartbeat 本身  
control-plane / approval / execution / acceptance 主链  
UI 临时展示字段拼装逻辑

## 三、输入层分层模型

为避免后续再把“原始 metric 名”、“observation 字段名”、“pipeline 聚合字段名”、“summary 展示指标名”混在一起，第一阶段正式感知输入合同固定拆为三层。

### 3.1 第一层：Stage-1 official pipeline canonical inputs

这是第一阶段正式业务输入白名单的唯一源头。

其含义是：

真正进入 `device_observation_v1` 归一与 sensing inference 主链的 canonical input metrics。  
后续任何人问“第一阶段正式输入白名单是什么”，默认指的就是这一层。

当前 Stage-1 official pipeline canonical inputs 为：

`soil_moisture`  
`canopy_temperature`  
`soil_ec`  
`air_temperature`  
`air_humidity`  
`water_flow_rate`  
`water_pressure`

这组集合是第一阶段正式输入白名单的唯一正式答案。

### 3.2 第二层：Stage-1 official pipeline aggregate fields

这是第一阶段 sensing pipeline 在聚合和推理过程中实际使用的标准字段层。

其含义是：

canonical input 经过 observation 映射后，在 pipeline 内部使用的稳定字段名。  
它不是新的输入白名单，而是第一层输入在 pipeline 内部的标准承接层。

当前 Stage-1 official pipeline aggregate fields 至少包括：

`soil_moisture_pct`  
`canopy_temp_c`  
`ec_ds_m`  
`ambient_temp_c`  
`relative_humidity_pct`  
`inlet_flow_lpm`  
`pressure_drop_kpa`

这层字段不应被后续组误读为“又一套独立的正式输入白名单”。

### 3.3 第三层：Stage-1 official customer summary soil metrics subset

这是第一阶段 customer-facing summary 中允许出现的土壤/营养指标展示子集。

其含义是：

为正式 Stage-1 customer-facing summary 服务的展示指标子集。  
它不是完整的 pipeline canonical input 白名单，也不是完整的 pipeline aggregate field 集。

当前 Stage-1 official customer summary soil metrics subset 为：

`soil_moisture_pct`  
`ec_ds_m`  
`fertility_index`  
`n`  
`p`  
`k`

这里必须特别强调：

这组 summary soil metrics 只是正式 customer-facing sensing summary 中的展示子集。  
它不等于第一阶段正式输入白名单。  
后续若有人把这组 summary 指标误当作 complete official input whitelist，属于违反第一组冻结规则。

## 四、第一阶段正式输入白名单

以下内容描述第一阶段正式 pipeline canonical input whitelist。

### 4.1 `soil_moisture`

中文语义：土壤湿度正式输入  
输入层角色：Stage-1 official pipeline canonical input  
进入 observation canonical fields：`soil_moisture`、`soil_moisture_pct`  
进入 pipeline aggregate fields：`soil_moisture_pct`  
主要下游状态：`fertility_state`、`salinity_risk_state`  
是否进入 customer-facing summary：不直接作为 customer-facing 顶层状态字段，但可通过 `official_soil_metrics_json` 进入 summary 展示  
第一阶段是否启用：启用

冻结说明：  
`soil_moisture` 是正式输入白名单成员。  
customer-facing summary 中展示的通常不是 `soil_moisture` 原名，而是其 summary soil subset 形态 `soil_moisture_pct`。

### 4.2 `canopy_temperature`

中文语义：冠层温度正式输入  
输入层角色：Stage-1 official pipeline canonical input  
进入 observation canonical fields：`canopy_temperature`、`canopy_temp_c`、`canopy_temp`、`temperature_c`  
进入 pipeline aggregate fields：`canopy_temp_c`  
主要下游状态：`fertility_state`、`salinity_risk_state`、`canopy_temperature_state`、`evapotranspiration_risk_state`  
是否进入 customer-facing summary：是  
第一阶段是否启用：启用

冻结说明：  
`canopy_temperature` 是第一阶段灌溉/环境相关正式状态的重要输入。  
其 customer-facing 结果主要通过 `canopy_temp_status` 和与蒸散风险相关的状态体现，而不是直接把原始输入裸露给客户。

### 4.3 `soil_ec`

中文语义：土壤电导率正式输入  
输入层角色：Stage-1 official pipeline canonical input  
进入 observation canonical fields：`soil_ec`、`ec_ds_m`、`soil_ec_ds_m`  
进入 pipeline aggregate fields：`ec_ds_m`  
主要下游状态：`fertility_state`、`salinity_risk_state`  
是否进入 customer-facing summary：不直接作为 customer-facing 顶层状态字段，但可通过 `official_soil_metrics_json` 进入 summary 展示  
第一阶段是否启用：启用

冻结说明：  
`soil_ec` 是正式输入白名单成员。  
其 customer-facing summary 展示层主要体现为 `ec_ds_m`，而不是 `soil_ec` 原名。

### 4.4 `air_temperature`

中文语义：环境温度正式输入  
输入层角色：Stage-1 official pipeline canonical input  
进入 observation canonical fields：`air_temperature`、`ambient_temp_c`、`air_temp_c`、`ambient_temperature_c`  
进入 pipeline aggregate fields：`ambient_temp_c`  
主要下游状态：`canopy_temperature_state`、`evapotranspiration_risk_state`  
是否进入 customer-facing summary：是，通过下游状态进入  
第一阶段是否启用：启用

冻结说明：  
`air_temperature` 是第一阶段正式输入，不应被误写为 customer summary soil subset。  
它的价值主要体现在环境风险和冠层温度相关状态上。

### 4.5 `air_humidity`

中文语义：环境湿度正式输入  
输入层角色：Stage-1 official pipeline canonical input  
进入 observation canonical fields：`air_humidity`、`relative_humidity_pct`、`humidity_pct`、`rh_pct`  
进入 pipeline aggregate fields：`relative_humidity_pct`  
主要下游状态：`canopy_temperature_state`、`evapotranspiration_risk_state`  
是否进入 customer-facing summary：是，通过下游状态进入  
第一阶段是否启用：启用

冻结说明：  
`air_humidity` 是环境相关正式输入白名单成员。  
它不是 summary soil metrics 子集的一部分，但它确实进入正式 business sensing 主链。

### 4.6 `water_flow_rate`

中文语义：水流量正式输入  
输入层角色：Stage-1 official pipeline canonical input  
进入 observation canonical fields：`water_flow_rate`、`inlet_flow_lpm`、`inlet_lpm`  
进入 pipeline aggregate fields：`inlet_flow_lpm`  
主要下游状态：`irrigation_effectiveness_state`、`leak_risk_state`  
是否进入 customer-facing summary：是，通过正式状态进入  
第一阶段是否启用：启用

冻结说明：  
`water_flow_rate` 是第一阶段灌溉闭环最关键的正式输入之一。  
它不以原始 metric 名直接进入 customer-facing summary，而通过灌溉效果与泄漏风险相关状态对外体现。

### 4.7 `water_pressure`

中文语义：水压正式输入  
输入层角色：Stage-1 official pipeline canonical input  
进入 observation canonical fields：`water_pressure`、`pressure_drop_kpa`、`pressure_kpa`  
进入 pipeline aggregate fields：`pressure_drop_kpa`  
主要下游状态：`irrigation_effectiveness_state`、`leak_risk_state`  
是否进入 customer-facing summary：是，通过正式状态进入  
第一阶段是否启用：启用

冻结说明：  
`water_pressure` 与 `water_flow_rate` 一起构成灌溉效果和泄漏风险判断的重要正式输入。  
后续组不得绕开正式状态层直接把水压原始指标作为 customer-facing 主口径。

## 五、Stage-1 official pipeline aggregate fields 说明

以下字段属于第一阶段 pipeline 使用的标准聚合字段层，不等于独立输入白名单：

`soil_moisture_pct`  
`canopy_temp_c`  
`ec_ds_m`  
`ambient_temp_c`  
`relative_humidity_pct`  
`inlet_flow_lpm`  
`pressure_drop_kpa`

这些字段的角色是：

为 sensing pipeline 提供稳定聚合字段名  
为正式 derived states 提供统一推理输入  
为 summary 投影提供稳定来源字段

后续规则：

不得把 aggregate field layer 误当成新的 official input whitelist。  
不得在产品文档中把 aggregate field layer 和 telemetry canonical input 混作同一层。  
不得在 customer-facing contract 中随意直接裸露 aggregate fields，除非已被 summary contract 明确允许。

## 六、Stage-1 official customer summary soil metrics subset 说明

以下字段属于第一阶段正式 customer-facing sensing summary 的土壤/营养展示子集：

`soil_moisture_pct`  
`ec_ds_m`  
`fertility_index`  
`n`  
`p`  
`k`

其角色是：

customer-facing summary 展示子结构  
soil/nutrient 相关指标的受控对外展示层  
正式 customer-facing contract 的一个子集容器，而不是正式输入白名单本身

后续规则：

不得把这组字段误当成完整 Stage-1 input whitelist。  
不得由前端或销售侧继续向这个子集随意增加新指标。  
后续若要扩展 Stage-1 以外的 summary soil subset，必须通过 successor contract 显式升级。

## 七、supported but non-official metrics

当前仓库支持但不纳入第一阶段正式商业闭环的输入或指标对象，至少包括以下几类：

1. 纯历史别名  
例如与 `soil_moisture_pct`、`ec_ds_m` 相关的历史别名。这些对象用于兼容归一，不构成新的正式白名单成员。

2. summary-facing 衍生指标  
例如 `fertility_index`、`n`、`p`、`k`。  
这些字段可以进入 customer-facing summary soil subset，但它们不是第一阶段正式 pipeline canonical input whitelist 的成员。

3. 诊断/运行态字段  
包括仓库支持、可进入诊断层或运行态语义的字段，但它们不纳入第一阶段正式输入合同，不应与正式 pipeline canonical inputs 混作同层对象。

冻结规则如下：

supported but non-official metrics 可以保留，但不得被后续组重新提升为第一阶段正式输入白名单，除非通过 successor contract 正式升级。

## 八、compatibility aliases

为保证历史兼容与 canonicalization，当前仓库允许部分兼容别名存在。

典型示例如下：

`soil_moisture_pct` 的兼容别名：`soil_moisture`、`moisture_pct`  
`ec_ds_m` 的兼容别名：`ec`、`soil_ec_ds_m`、`salinity_ec_ds_m`  
`fertility_index` 的兼容别名：`soil_fertility_index`  
`n` 的兼容别名：`nitrogen`、`soil_n`  
`p` 的兼容别名：`phosphorus`、`soil_p`  
`k` 的兼容别名：`potassium`、`soil_k`

冻结规则如下：

1. compatibility alias 的存在仅用于归一与历史兼容  
2. compatibility alias 不构成新的正式输入白名单成员  
3. 后续任何新逻辑不得直接以 compatibility alias 作为正式 source-of-truth  
4. 文档、前端、产品、销售叙事均应优先引用正式 canonical 名称或 summary contract 名称，而不是历史别名

## 九、heartbeat / runtime status 与 sensing input 的边界

第一组必须特别冻结这一边界：

device runtime status 与 sensing diagnostic input 不是同一层。

冻结定义如下：

1. heartbeat online/offline、last heartbeat、heartbeat freshness 等属于 device runtime status  
2. sensor quality diagnostic state 属于 sensing diagnostic state  
3. 二者可以业务相关，但默认不可等同  
4. heartbeat 字段不得被默认当作 `sensor_quality_state` 的正式直接输入  
5. 若未来需要引入 bridge rule，必须显式建模，不得通过隐式约定或前端猜测完成

这条边界是第一组正式输入口径中的硬约束。

## 十、后续使用规则

自本清单冻结后，后续所有组必须遵守以下规则：

1. 问“第一阶段正式输入白名单是什么”，默认只指 Stage-1 official pipeline canonical inputs  
2. aggregate fields 不得被误当成新的 input whitelist  
3. summary soil subset 不得被误当成 complete pipeline input whitelist  
4. compatibility alias 不得作为新逻辑主口径  
5. 若未来进入 Stage-2/Stage-3 sensing contract，必须以 successor contract 形式扩展，不得直接重写本清单

## 十一、最终冻结结论

第一阶段正式感知输入白名单已经形成如下稳定结论：

正式 pipeline canonical input whitelist 为：

`soil_moisture`  
`canopy_temperature`  
`soil_ec`  
`air_temperature`  
`air_humidity`  
`water_flow_rate`  
`water_pressure`

其下游通过 official pipeline aggregate fields 和 official customer summary soil subset 进入 sensing inference 与 customer-facing Stage-1 summary。

后续所有团队必须以此为第一阶段正式输入口径，不得再自行推断或发明新的 Stage-1 正式输入定义。
