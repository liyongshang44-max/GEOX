# GEOX 地块页产品表达冻结文件

## 目的

冻结第四组在地块页上的 customer-facing 表达边界，明确：

- 默认客户视图当前讲什么
- 哪些技术对象当前不再进入默认主视图
- `useFieldDetail` 的当前职责边界
- 哪些内容当前仅放在次级页签或技术层

本文件只约束当前已验过的表达层，不重新定义感知、建议、作业、验收事实。

---

## 一、地块页默认客户视图冻结

地块页默认客户视图指：

- `FieldDetailPage.tsx`
- 默认 `overview` 页签

基于当前已验代码，默认客户视图当前主要围绕以下五类信息组织：

1. 当前状态
2. 为什么要处理
3. 最近建议
4. 最近作业
5. 最近验收

当前默认区块表现为：

- 当前状态区
- 当前风险与建议区
- 最近作业与验收区

---

## 二、默认客户视图当前不直接展示的对象

基于当前已验代码，默认客户视图当前未直接展示以下对象：

- `field_sensing_overview_v1`
- `field_fertility_state_v1`
- `source_observation_ids`
- source devices
- recommendation bias
- salinity risk
- explain codes
- internal V1 读模型面板

说明：

此处描述的是当前已验过的默认页面状态，不等同于对所有未来页面形态的超前承诺。

---

## 三、现场/实时状态表达边界

现场态、实时态、设备态信息当前仍可存在，但已从默认 overview 主首屏降级到次级页签。

当前已验状态下，以下信息集中放在 `realtime` 页签中的“实时状态 / 现场数据”区：

- 土壤湿度
- 温度
- 设备状态
- 最近心跳

因此当前冻结口径为：

- 允许存在现场态信息
- 当前默认 overview 不以这些实时指标作为首屏主叙事

---

## 四、地图与轨迹表达边界

GIS / 轨迹相关内容当前允许存在于：

- `trajectory` 页签

其当前作用是：

- 展示真实轨迹或无轨迹状态
- 展示地图对象与业务含义
- 支撑现场理解与专家查看

其当前定位不是默认客户主叙事首屏。

---

## 五、经营配置与设备绑定表达边界

经营配置与设备绑定相关内容当前允许存在于：

- `config` 页签

其当前作用是：

- 查看当前经营方案
- 查看设备绑定关系
- 完成从田块绑定设备
- 进入方案与设备管理

其当前定位不是默认客户首屏，而是配置/运维入口。

---

## 六、`useFieldDetail` 职责冻结

`useFieldDetail.ts` 当前允许继续承担：

- 并发加载
- 页面装配
- evidence 摘要对象装配
- current program / operations / geometry / map layers 组织

基于当前已验代码，`useFieldDetail.ts` 当前已不再通过默认页面链路暴露：

- `fieldReadModelV1`
- `parseFieldReadModelV1(...)` 派生出的 internal read model 对象

因此当前冻结结论为：

默认客户页面链路中，`useFieldDetail` 已不再承担 internal read model 向客户状态的直接暴露。

---

## 七、默认客户叙事顺序冻结

基于当前已验页面状态，地块页默认客户视图当前叙事顺序可概括为：

1. 当前经营状态
2. 当前风险与建议
3. 最近作业与验收

当前不以以下内容作为默认客户首屏主叙事：

- V1 读模型面板
- source ids / source devices
- 解释码
- telemetry 指标优先

---

## 八、当前冻结结论

当前第四组地块页表达冻结结论为：

- 默认 overview 首屏当前不再直接展示 V1 读模型面板
- 默认 overview 首屏当前主要讲状态、原因、建议、作业、验收
- 实时/现场数据当前已集中到 `realtime` 页签
- `useFieldDetail` 当前已不再把 `fieldReadModelV1` 暴露到默认客户页面链路

后续若地块页默认客户表达发生明显变化，应同步更新本文件。
