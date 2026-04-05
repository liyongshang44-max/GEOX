# GEOX 前端产品化收口任务书（Stage 10）

## 0. 任务定义

将 GEOX 前端从“功能展示界面”整改为“远程农业经营控制台”。

本轮只做前端信息架构与表达收口：
- 用现有读模型（不大改 API 契约）
- 统一业务语言、状态词、按钮层级
- 打通 Dashboard -> Field -> Operation -> Program 主线

---

## 1. 页面目标（按主线）

### 1.1 CommercialDashboardPage（主入口）

**目标**：5 秒内让用户知道“当前最重要事项”。

**固定 6 区块**：
1. 顶部总览带（建议数/执行中/待验收/风险田块/产值成本净值）
2. 今日最重要动作（<=3）
3. 风险田块列表（地块视角）
4. 最近执行结果（最近 5 条）
5. 经营趋势（产值/成本/成功率/无效执行率）
6. 客户报告与证据入口（收口）

**要求**：
- 每条重要动作可“直接执行”或“进详情”
- 首页优先行动，不展开技术细节

---

### 1.2 FieldDetailPage（田块作战页）

**目标**：围绕“某块田当前怎么管”形成指挥界面。

**固定 5 区块**：
1. 田块头部（名称/面积/作物/阶段/健康/更新时间/主 CTA）
2. 当前状态（土壤湿度/温度/空气湿度/设备在线/遥测摘要）
3. 风险与建议（风险、推荐动作、不执行后果、建议原因）
4. 最近作业与验收（3~5 条）
5. GIS/轨迹/热区（增强区，后置）

---

### 1.3 OperationDetailPage（单次作业故事页）

**目标**：用户在一个页面读懂“为什么做、怎么做、做成没、值不值”。

**固定 6 区块**：
1. 故事头（状态/田块/执行对象/时间/主按钮）
2. 决策依据（recommendation、触发原因、当前指标、不执行风险）
3. 执行过程（task/dispatch/receipt，业务语言时间线）
4. 证据与验收（evidence、acceptance、missing evidence）
5. 价值归因（收益/风险降低/成本变化/对目标影响）
6. 审计补充（折叠）

---

### 1.4 ProgramDetailPage（经营方案页）

**目标**：表达“目标—策略—执行结果”而非实时监控拼盘。

**固定 4 区块**：
1. 目标卡（作物/品种/目标产量/限制/经营目标）
2. 进度卡（阶段/重点/里程碑/偏差）
3. 策略卡（当前主规则/当前建议/建议原因）
4. 最近影响卡（最近作业是否推动目标前进、风险影响）

---

## 2. 文件级任务拆解

## 2.1 页面层

### `apps/web/src/views/CommercialDashboardPage.tsx`
- 组装并固定 6 个一级区块
- 将“风险”统一改为地块列表表达，不展示原始告警流水
- Top Actions 收敛到 3 条并统一结构（田块/动作/原因/风险/预计影响）
- 增加客户报告/证据收口入口

### `apps/web/src/views/FieldDetailPage.tsx`
- 重排结构为 5 区块（GIS 后置）
- 强化主 CTA（查看建议 / 发起作业）

### `apps/web/src/views/OperationDetailPage.tsx`
- 把现有信息按 6 区块重排
- 时间线标签改业务词，避免技术事件名裸露
- 证据与验收提升为主区

### `apps/web/src/views/ProgramDetailPage.tsx`
- 收敛为 4 区块
- 移除与 Dashboard/Operation 重复的信息

### `apps/web/src/views/OperationsPage.tsx`
- 强化从列表进入“故事页”路径
- 提供状态筛选与统一状态词映射

### `apps/web/src/views/ProgramListPage.tsx`
- 列表表达聚焦经营目标与偏差，不再堆技术指标

---

## 2.2 视图模型层

### `apps/web/src/viewmodels/dashboardViewModel.ts`
- 输出 Dashboard 六区块所需结构
- 将后端字段转换为统一状态词与展示文案

### `apps/web/src/viewmodels/fieldDetailViewModel.ts`
- 输出田块作战页 5 区块结构

### `apps/web/src/viewmodels/operationDetailViewModel.ts`
- 输出作业故事页 6 区块结构
- 时间线业务化文案映射在此统一处理

### `apps/web/src/viewmodels/programDetailViewModel.ts`
- 输出 Program 四区块结构

### `apps/web/src/lib/operationLabels.ts`
- 全站状态词统一映射（见第 3 节）

---

## 2.3 样式层

### `apps/web/src/styles/dashboard.css`
- 首页六区块布局、顶部总览带、主 CTA 强调

### `apps/web/src/styles/field.css`
- 田块作战页信息优先级样式

### `apps/web/src/styles/operation.css`
- 作业故事页时间线与证据区强化

### `apps/web/src/styles/program.css`
- 经营页目标与偏差表达样式

### `apps/web/src/styles/cards.css`
- 卡片密度下调，统一间距、标题、次级文本

### `apps/web/src/styles/layout.css`
- 页面主次层级统一

### `apps/web/src/styles/base.css`
- 状态色与按钮语义规范落地

---

## 3. 文案与交互口径

## 3.1 状态词（全站唯一）
仅允许：
- 待处理
- 待执行
- 执行中
- 待验收
- 已完成
- 执行无效
- 存在风险

## 3.2 按钮语义（全站唯一）
- 主按钮：处理当前最重要事项
- 次按钮：查看详情
- 弱按钮：刷新 / 返回 / 导出

## 3.3 文案规范
- 中文为主，不混杂英文状态码
- 先结论后解释
- 空态语气统一（简洁、可行动）

---

## 4. 组件拆分建议（防止页面继续膨胀）

## Dashboard
- `DashboardOverviewBand`
- `DashboardTopActions`
- `DashboardRiskFields`
- `DashboardRecentExecutions`
- `DashboardBusinessTrend`
- `DashboardReportEntry`

## Field
- `FieldHeaderCard`
- `FieldCurrentStateCard`
- `FieldRiskSuggestionCard`
- `FieldRecentOperationsCard`
- `FieldMapPanel`

## Operation
- `OperationStoryHeader`
- `OperationDecisionPanel`
- `OperationExecutionTimeline`
- `OperationEvidenceAcceptancePanel`
- `OperationValueImpactPanel`
- `OperationAuditCollapse`

## Program
- `ProgramGoalCard`
- `ProgramProgressCard`
- `ProgramStrategyCard`
- `ProgramImpactCard`

---

## 5. 开发顺序（严格）

1. 先改 viewmodel（统一输出）
2. 再改页面骨架（区块重排）
3. 再改文案映射（状态词统一）
4. 最后改样式（密度/层级/按钮）
5. 回归验证全链路跳转与关键 CTA

---

## 6. 验收清单（产品标准）

## Dashboard
- 5 秒内识别最重要事项
- 一级区块 <= 6
- 至少 1 条可直接进入执行路径
- 风险按“地块+动作”表达

## Field
- 快速看到：状态、风险、最近动作、下一步建议
- GIS 后置，不抢叙事
- 空态/异常态可用

## Operation
- 单页读懂：为何执行、如何执行、是否成功、如何验收、造成什么影响
- 时间线为业务语言
- 证据与验收为主块

## Program
- 清楚表达目标、偏差、策略与执行影响
- 不与 Dashboard/Operation 重复

## 全站
- 状态词统一
- 按钮层级统一
- 卡片密度下降
- 主次明确
- 无“调试页观感”

---

## 7. 非目标（本轮不做）

- 不大改 API 契约
- 不新增复杂图表库
- 不做 AI 优化
- 不做大屏视觉工程

