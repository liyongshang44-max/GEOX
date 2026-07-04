<!-- docs/frontend-productization/H60-FIELD-RUNTIME-CONSOLIDATION.md -->
# H60 Field Runtime Consolidation
# H60 地块运行视图收口

Status: H60-A IA CONTRACT / former H60.0 IA CONTRACT  
Language: zh-CN  
Scope: Frontend Productization / Field Runtime IA / ViewModel Contract / No-write Boundary  
Repo basis: main after H59 Operator Runtime Console Shell merge  
Write impact: NONE  
Backend impact: NONE  
Seed impact: NONE  
DB impact: NONE  
Runtime route impact in H60-A: NONE  
Runtime route impact in H60.0: NONE  

---

## 0. 阶段定义与编号 alias

H60 定义为：

```text
H60 Field Runtime Consolidation
H60 地块运行视图收口
```

H60 的目标不是把现有页面合并得更少，而是把 Operator Runtime Console 中的单地块界面收口为正式产品级 Field Runtime。

后续正式编号统一使用 H60-A / H60-B / H60-C。旧编号只作为 alias 保留，便于理解既有 PR、acceptance 和历史讨论。

```text
H60-A = former H60.0 Field Runtime IA Contract
H60-B = former H60.1 Field Runtime Route Ownership
H60-C = former H60.2 Field Runtime Layout + Tabs
H60-D = former H60.3 Overview / State / Evidence Summary
H60-E = former H60.4 Evidence Tab
H60-F = former H60.5 Forecast Tab
H60-G = former H60.6 Scenario Tab Read-only Split
H60-H = former H60.7 Residual / Verification Tab
H60-I = former H60.8 Calibration Tab
H60-J = Health Placeholder
H60-K = Audit Drawer / Audit Tab
```

H60-A 只冻结信息架构、route family 设计、legacy route 策略、ViewModel contract、scenario submission isolation、write boundary 和 acceptance plan。

H60.0 只冻结信息架构、route family 设计、legacy route 策略、ViewModel contract、scenario submission isolation、write boundary 和 acceptance plan。

H60-A 不改 React 页面，不新增 route，不重写 route table，不改 CSS，不改 backend，不改 DB，不改 facts writer。

H60.0 不改 React 页面，不新增 route，不重写 route table，不改 CSS，不改 backend，不改 DB，不改 facts writer。

---

## 1. H60 产品问题

Field Runtime 必须回答：

```text
这块地现在处于什么运行状态？
证据是否充分？
系统当前相信什么？
预测窗口是否可用？
预测后是否有误差复核？
是否需要校准？
运行健康是否足够？
哪些内容只是 replay-backed，而不是 live production？
哪些操作仍然被禁止？
```

H60 不以工程对象为中心：

```text
operator_field_twin_workspace_v1
forecast_window_v1
scenario_compare_v1
operator_field_twin_evidence_quality_v1
operator_field_twin_calibration_replay_v1
operator_field_twin_post_irrigation_verification_v1
```

H60 以产品链路为中心：

```text
Evidence → State → Forecast → Residual → Calibration → Health → Audit
```

Pilot Readiness 在 H63 成为独立 product surface。H60 只允许预留 disabled / not_enabled 入口，不得宣称 field pilot started。

---

## 2. 当前仓库事实

当前仓库已经存在多组 field-scoped operator twin 页面和 legacy routes。

现有 workspace 已展示状态向量、数据覆盖、证据摘要、数据缺口、layers、情景边界、建议候选、H31-H45 决策到水分响应闭环、只读边界等能力。

现有 forecast 页面已经是 field-scoped forecast panel，只展示 forecast window limits 和 risk timeline；它不比较 scenarios、不提交 recommendation、不 approve、不 dispatch、不创建 AO-ACT task。

现有 evidence 页面是 read-only evidence/data quality page，只复核 evidence quality，不写 facts、不提交 recommendations、不执行 control actions。

现有 scenario 页面是 H60 的主要隔离点。它包含 `SubmitScenarioToRecommendationPanel`，因此不能直接进入 canonical Field Runtime 主链路。

现有 calibration 页面是 read-only calibration replay，只做 replay visibility，不做 state-changing actions。

现有 post-irrigation 页面是 read-only response verification，不写 Field Memory、ROI、facts、control sends、approvals、recommendations、tasks。

因此 H60 的策略是：

```text
保留现有能力
建立正式 Field Runtime 信息架构
设计 canonical field runtime route family
保留旧 /operator/twin/fields/* 为 legacy URL
把写入口降级或隔离
把内部对象折叠成产品视图
```

---

## 3. H60 最终产品形态

Field Runtime 目标结构：

```text
Field Runtime

Header
  Field name
  Runtime Mode
  Replay / Live status
  Evidence freshness
  Freeze status
  Read-only boundary
  Legacy route status

Primary Tabs
  Overview
  Evidence
  State
  Forecast
  Scenario
  Residual
  Calibration
  Health
  Audit
```

Tab 含义：

```text
Overview      = 总览当前地块运行状态
Evidence      = 证据链、覆盖率、质量、缺口
State         = 当前状态估计与置信边界
Forecast      = 预测窗口与未来风险时间线
Scenario      = 情景比较，只读；提交建议候选必须隔离
Residual      = post-irrigation / verification / response delta
Calibration   = replay / calibration inputs / calibration gaps
Health        = H62 前先做 disabled placeholder 或 read-only shell
Audit         = evidence refs / H31-H45 chain / trace / freeze refs
```

---

## 4. H60-A 和后续阶段边界

H60-A 只冻结 route design，不创建 route。

H60.0 只冻结 route design，不创建 route。

H60-B 才允许修改 `apps/web/src/app/App.tsx` 并新增 canonical route family。

H60.1 才允许修改 `apps/web/src/app/App.tsx` 并新增 canonical route family。

H60-C 才允许新增 Field Runtime layout、tabs、boundary banner、ViewModel helper。

H60.2 才允许新增 Field Runtime layout、tabs、boundary banner、ViewModel helper。

H60-D 之后才迁移具体 tab 内容。

H60.3 之后才迁移具体 tab 内容。

---

## 5. Canonical route family 设计

H60 目标 canonical product route family：

```text
/operator/fields
/operator/fields/:fieldId
/operator/fields/:fieldId/evidence
/operator/fields/:fieldId/state
/operator/fields/:fieldId/forecast
/operator/fields/:fieldId/scenario
/operator/fields/:fieldId/residual
/operator/fields/:fieldId/calibration
/operator/fields/:fieldId/health
/operator/fields/:fieldId/audit
```

其中 `/operator/fields/:fieldId` 是 Field Runtime 主入口。

H60-A 不新增这些 route。H60-A 只把它们冻结为 route contract。

H60.0 不新增这些 route。H60.0 只把它们冻结为 route contract。

---

## 6. Legacy route preservation

以下 legacy routes 必须保留：

```text
/operator/twin/fields/:fieldId
/operator/twin/fields/:fieldId/forecast
/operator/twin/fields/:fieldId/scenarios
/operator/twin/fields/:fieldId/evidence
/operator/twin/fields/:fieldId/calibration
/operator/twin/fields/:fieldId/post-irrigation
```

H60 推荐先使用方案 A：旧 route 继续渲染旧页面，但顶部显示 legacy route notice。

H60 不在早期直接 redirect legacy routes。若后续采用 redirect，必须先有 route behavior acceptance。

---

## 7. H60 禁止 route

H60 仍然禁止：

```text
/app/operator/* broad wildcard
删除旧 /operator/twin/fields/*
删除 /operator/twin/gateway-demo
把 /operator/workbench generation 重新接成主线
把 /operator/dispatch 重新接成正式 Field Runtime 主线
把 /operator/roi-ledger 重新接成正式 Field Runtime 主线
把 /operator/field-memory 重新接成正式 Field Runtime 主线
```

---

## 8. Field Runtime ViewModel Contract

H60 不应让组件直接消费多种后端对象。必须建立 Field Runtime ViewModel。

目标文件在 H60-C 之后允许新增：

```text
apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts
apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx
apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabs.tsx
apps/web/src/features/operator/fieldRuntime/FieldRuntimeBoundaryBanner.tsx
apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditDrawer.tsx
```

目标文件在 H60.2 之后允许新增。

目标 ViewModel：

```ts
type FieldRuntimeViewModel = {
  identity: FieldRuntimeIdentity;
  runtimeMode: RuntimeModeSummary;
  tabs: FieldRuntimeTabState[];
  overview: FieldRuntimeOverview;
  evidence: FieldRuntimeEvidenceSummary;
  state: FieldRuntimeStateSummary;
  forecast: FieldRuntimeForecastSummary;
  scenario: FieldRuntimeScenarioSummary;
  residual: FieldRuntimeResidualSummary;
  calibration: FieldRuntimeCalibrationSummary;
  health: FieldRuntimeHealthSummary;
  audit: FieldRuntimeAuditSummary;
  boundary: FieldRuntimeBoundary;
};
```

Identity：

```ts
type FieldRuntimeIdentity = {
  fieldId: string;
  fieldName: string;
  tenantId?: string | null;
  projectId?: string | null;
  groupId?: string | null;
  sourceRouteFamily: "canonical_operator_field_runtime" | "legacy_operator_twin_field";
};
```

Runtime mode：

```ts
type RuntimeModeSummary = {
  runtimeMode: "Replay-backed Demo";
  liveDevice: "Not connected";
  productionGateway: "Not online";
  fieldPilot: "Not started";
  aoActDispatch: "Disabled";
};
```

Boundary：

```ts
type FieldRuntimeBoundary = {
  readOnly: true;
  canWriteFacts: false;
  canCreateRecommendation: boolean;
  canApprove: false;
  canDispatch: false;
  canCreateAoActTask: false;
  canWriteRoi: false;
  canWriteFieldMemory: false;
  visibleWarnings: string[];
};
```

Canonical Field Runtime 主链路中 `canCreateRecommendation` 必须为 false。

---

## 9. Tab state contract

每个 Field Runtime tab 必须有三态：

```text
available
limited
not_enabled
```

这些状态不得使用红黄绿风险语义表达业务判断。

Health 在 H60 可以是：

```text
not_enabled / pending H62
```

Pilot readiness 不能在 H60 中被宣称为 field pilot started。

---

## 10. Boundary banner contract

Field Runtime 必须固定展示：

```text
Runtime Mode: Replay-backed Demo
Live Device: Not connected
Production Gateway: Not online
Field Pilot: Not started
AO-ACT Dispatch: Disabled
Read-only Field Runtime
```

这些信息必须位于 canonical Field Runtime header 或 boundary banner 中，不能只放在 audit drawer。

---

## 11. Scenario submission isolation

H60 canonical scenario tab 必须只读。

Canonical route：

```text
/operator/fields/:fieldId/scenario
```

不得 import 或 render：

```text
SubmitScenarioToRecommendationPanel
```

Canonical scenario tab 必须显示：

```text
Scenario is a projection, not a task.
Scenario is not a recommendation.
No approval / dispatch / AO-ACT.
```

Legacy route：

```text
/operator/twin/fields/:fieldId/scenarios
```

可以暂时保留旧 submission panel，但必须标记为：

```text
legacy / governed action surface
not canonical Field Runtime
human-gated
not dispatch
not AO-ACT
```

---

## 12. Product language restrictions

Canonical Field Runtime 主标题不得使用：

```text
Twin 工作区
Gateway Demo
H31-H45 决策到水分响应闭环
forecast_window_v1
scenario_compare_v1
operator_field_twin_*
```

这些 contract names 可以进入 audit drawer、data-contract attribute 或 technical detail，不得作为主产品标题。

Forecast 必须显示：

```text
Forecast is not a recommendation.
Forecast does not create task.
Forecast does not imply action.
```

Residual 必须显示：

```text
Residual is an accuracy / response review.
Residual is not causal proof.
Residual does not write ROI.
Residual does not write Field Memory.
```

Calibration 必须禁止表达：

```text
model updated
calibration applied
learning completed
```

Health 必须显示：

```text
Runtime Health product surface is planned for H62.
This tab does not claim production monitoring.
```

---

## 13. H60 PR sequence

H60 拆分为：

```text
H60-A Field Runtime IA Contract
H60-B Field Runtime Route Ownership
H60-C Field Runtime Layout + Tabs
H60-D Overview / State / Evidence Summary
H60-E Evidence Tab
H60-F Forecast Tab
H60-G Scenario Tab Read-only Split
H60-H Residual / Verification Tab
H60-I Calibration Tab
H60-J Health Placeholder
H60-K Audit Drawer / Audit Tab
```

旧编号 alias：

```text
H60.0 Field Runtime IA Contract
H60.1 Field Runtime Route Ownership
H60.2 Field Runtime Layout + Tabs
H60.3 Overview / State / Evidence Summary
H60.4 Evidence Tab
H60.5 Forecast Tab
H60.6 Scenario Tab Read-only Split
H60.7 Residual / Verification Tab
H60.8 Calibration Tab
H60.9 Audit Drawer / Chain
```

H60-A 输出：

```text
docs/frontend-productization/H60-FIELD-RUNTIME-CONSOLIDATION.md
docs/frontend-productization/H60-FIELD-RUNTIME-ROUTE-MATRIX.md
scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_IA_CONTRACT_V1.cjs
```

H60.0 输出同上。

H60-A 不改 React 页面。

H60.0 不改 React 页面。

---

## 14. H60-A 完成定义

H60-A 完成只表示：

```text
Field Runtime IA 已冻结
canonical route family 已设计但未实现
legacy route preservation 已冻结
ViewModel contract 已冻结
scenario submission isolation 已冻结
write boundary 已冻结
H60 acceptance plan 已冻结
```

H60.0 完成只表示同一范围。

H60-A 不表示：

```text
/operator/fields route 已存在
FieldRuntimeLayout 已实现
Field Runtime tabs 已实现
Scenario tab 已拆分
Residual tab 已迁移
Calibration tab 已迁移
Runtime Health 已完成
Pilot readiness 已完成
live device 已接入
production gateway 已在线
field pilot 已开始
```

H60.0 不表示同一范围。
