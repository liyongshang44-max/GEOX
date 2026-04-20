# GEOX 前端 customer-facing 表达边界文件

## 目的

冻结第四组在前端 customer-facing 层面的统一表达边界，明确：

- 哪些对象当前允许直接进入客户页面
- 哪些对象当前只进入技术附录、专家区或次级页签
- 哪些回退点当前已由脚本做初步锁定

本文件适用于：

- 客户首页
- 地块页默认客户视图
- 作业页默认客户视图

本文件只描述当前已验过的前端表达边界，不扩展后端事实口径。

---

## 一、customer-facing 白名单（当前页面允许直接使用的表达对象）

基于当前已验代码，默认 customer-facing 页面当前允许直接使用以下对象类型：

### 1. customer-facing summary
例如：

- 地块状态汇总
- 风险汇总
- 经营汇总
- 待处理事项
- Top 风险对象

### 2. customer-facing status
例如：

- 当前状态
- 风险结论
- 最新建议
- 执行状态
- 验收状态
- 证据完整性
- 下一步动作

### 3. operation detail 主口径派生结果
作业页默认客户表达当前继续使用：

- operation detail 主链
- operation detail view model
- evidence / acceptance 客户态结果

### 4. customer-facing evidence / acceptance 结果
例如：

- 验收状态
- 验收摘要
- 缺失项
- 证据包状态
- 正式证据数量
- 调试证据数量（当前页面若已展示）

### 5. customer-facing 映射结果
例如：

- 风险等级映射文案
- 状态标签
- 客户可读说明

---

## 二、customer-facing 黑名单（当前不直接高权重展示的对象）

基于当前已验代码，默认 customer-facing 页面当前未直接高权重展示以下对象：

- internal read model 名称
- `field_sensing_overview_v1`
- `field_fertility_state_v1`
- `source_observation_ids`
- source devices
- debug trace
- skill trace 原始工程命名
- execution trace 原始技术字段
- 原始 API 路径标题
- 组件结构英文占位标题

说明：

此处描述的是当前已验页面状态，不等同于对所有未来页面形态的超前承诺。

---

## 三、页面级边界（当前冻结状态）

### 1. 客户首页

当前客户首页：

- `/dashboard/customer`

当前主要表达：

- 地块状态
- 经营汇总
- 待处理事项
- Top 风险地块

基于当前已验代码，当前未直接高权重展示：

- `/api/v1/...` 接口路径标题
- internal read model 名称
- telemetry/debug source 对象名

---

### 2. 地块页默认客户视图

当前地块页默认客户视图：

- `FieldDetailPage.tsx`
- 默认 `overview` 页签

当前主要表达：

- 当前状态
- 当前风险与建议
- 最近作业与验收

基于当前已验代码，当前未直接高权重展示：

- V1 读模型面板
- `field_sensing_overview_v1`
- `field_fertility_state_v1`
- `source_observation_ids`
- source devices
- recommendation bias 等技术对象

同时，现场/实时状态信息当前已集中在 `realtime` 页签，而非默认首屏主叙事。

---

### 3. 作业页默认客户视图

当前作业页默认客户视图：

- `OperationDetailPage.tsx`

当前主要表达：

- 为什么触发
- 执行到哪了
- 证据是否完整
- 验收结果
- 下一步

基于当前已验代码，以下对象当前已不再高权重停留在默认主视图：

- Task ID
- source
- 规则版本
- 审计附录
- `Skill Trace` 原始命名
- `Detail Aside` 英文占位命名

这些对象当前已收进技术附录、业务化摘要或对应折叠区中。

---

## 四、技术附录与次级页签规则（当前状态）

基于当前已验页面状态，技术对象当前允许存在，但主要进入以下位置：

### 1. 技术附录
例如作业页中的：

- `技术附录（默认关闭）`

当前可承载：

- 来源与解释
- 技能执行诊断
- 执行过程（技术字段）
- 规则与原因代码
- 审计附录

### 2. 次级页签
例如地块页中的：

- `realtime`
- `trajectory`
- `config`

当前用于承载：

- 实时状态 / 现场数据
- GIS / 轨迹
- 经营配置 / 设备绑定

当前冻结口径为：

- 技术对象允许存在
- 当前不再以默认客户主视图高权重形式直接出现
- 当前主要进入技术附录或次级页签

---

## 五、当前已存在的边界锁定

基于当前已验代码，前端已存在：

- `apps/web/scripts/check-customer-facing-boundary.mjs`

该脚本当前已对若干回退点做初步锁定，包括：

- `field_sensing_overview_v1`
- `field_fertility_state_v1`
- `source_observation_ids`
- `/api/v1/`
- `Skill Trace`
- `Detail Aside`
- Task ID 不得回到主执行过程区
- `OperationSkillTraceCard` 需位于技术附录附近
- “来源与解释”“审计附录”不应以普通主 section 直接上屏

说明：

当前脚本属于边界锁定基础设施，描述的是当前已存在状态。

---

## 六、当前回退判定口径

基于当前第四组已验页面状态，以下情况应视为 customer-facing 表达回退：

1. internal read model 重新出现在客户首页或地块页默认首屏  
2. `fieldReadModelV1` 再次进入默认客户页面 hook 链路  
3. Task ID / source / 规则版本重新高权重进入作业页主视图  
4. skill trace / 审计附录重新以普通 section 直接展开  
5. 页面重新出现 `Skill Trace`、`Detail Aside` 等工程命名或占位标题

---

## 七、当前冻结结论

当前第四组 customer-facing 表达边界冻结结论为：

- 首页、地块页、作业页默认客户视图当前已完成页面层基本收口
- internal 对象当前已从默认主视图中移出或降级
- 技术对象当前主要进入技术附录、业务化摘要或次级页签
- 当前已存在回退边界脚本，用于锁定关键风险点

后续若页面默认客户表达发生明显变化，应同步更新本文件。
