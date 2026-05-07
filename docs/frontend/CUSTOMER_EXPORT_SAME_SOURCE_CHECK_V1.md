# CUSTOMER_EXPORT_SAME_SOURCE_CHECK_V1

> 状态：CURRENT / P0 Gate 说明  
> 适用范围：GEOX Customer export 页面与客户页面同源验收  
> 目标读者：前端开发、测试、交付负责人

## 1. 文档目的

本文定义 GEOX Customer 前端 P0 的导出同源规则。

P0 要求：

```text
页面看到什么，导出报告就应表达同一套结论。
页面和导出必须使用同一 ViewModel、同一 label、同一空态、同一数据源。
```

禁止出现：

```text
页面一套状态判断，导出一套状态判断。
页面显示“验收通过”，导出显示 raw SUCCESS/PASS。
页面显示“暂无 ROI”，导出伪造节水收益。
页面显示“暂无地块记忆”，导出写“系统已学习”。
```

## 2. 同源对象

P0 有三类 export。

| 页面 | Export 页面 | 必须复用 ViewModel | 数据源 |
|---|---|---|---|
| `CustomerDashboardPage` | `CustomerDashboardExportPage` | `buildCustomerDashboardVm` | `fetchCustomerDashboardAggregate` |
| `FieldReportPage` | `FieldReportExportPage` | `buildFieldReportVm` | `fetchFieldReport` |
| `OperationReportPage` | `CustomerReportExportPage` | `buildOperationReportVm` | `fetchOperationReport` |

说明：

- `/customer/operations/:operationId/export` 的正式 export 文件是 `CustomerReportExportPage.tsx`。
- `OperationReportExportPage.tsx` 如存在，只能作为兼容 re-export：

```ts
export { default } from "./CustomerReportExportPage";
```

## 3. Dashboard Export 同源规则

`CustomerDashboardExportPage` 必须：

```text
调用 fetchCustomerDashboardAggregate()
调用 buildCustomerDashboardVm()
使用 DashboardExportBlocks 或等价同源渲染组件
```

禁止：

```text
重新计算 KPI
重新命名 open alerts 为“待审批处方”
显示“在线地块 / 总地块”
显示“今日待决策”
直接调用 /api/v1/reports/customer-dashboard/aggregate 之外的调试接口
直接调用 raw facts / admin / healthz / openapi
```

Dashboard 页面和 export 必须保持一致：

```text
KPI 文案一致
风险地块一致
待处理事项一致
设备摘要一致
ROI 空态一致
近期作业摘要一致
```

## 4. Field Export 同源规则

`FieldReportExportPage` 必须：

```text
调用 fetchFieldReport(fieldId)
调用 buildFieldReportVm(report)
使用 FieldExportBlocks 或等价同源渲染组件
```

禁止：

```text
重新计算风险等级
重新拼 recent operations
批量请求 operation reports 拼 Field Memory
用 operation count / device count / ROI count 推导 Field Memory
显示假地图
显示假天气
伪造 ROI
```

Field 页面和 export 必须保持一致：

```text
地块名称一致
风险等级一致
诊断结论一致
近期作业一致
设备摘要一致
ROI 摘要或空态一致
Field Memory 摘要或空态一致
```

## 5. Operation Export 同源规则

`CustomerReportExportPage` 在 operation 模式下必须：

```text
调用 fetchOperationReport(operationId)
调用 buildOperationReportVm(report)
使用 OperationExportBlocks 或等价同源渲染组件
```

OperationReport export 必须展示与页面同源的八段闭环：

```text
建议
处方合同
审批
执行 / as-executed
证据
验收
ROI
田块记忆
```

禁止：

```text
回退到旧六段结构
重新写 “为什么做 / 谁批准 / 怎么执行 / 有什么证据 / 验收结果 / 最终结论” 的旧导出
直接显示 DONE / MISSING / PENDING / AVAILABLE
主视图显示 Skill trace
伪造 evidence-pack-summary
伪造 ROI
伪造 Field Memory
```

如缺数据，必须显示同源空态：

```text
未形成正式处方
审批记录暂不可用
暂无实际执行记录
暂无证据包摘要
验收结果尚未生成
暂无可量化价值记录
暂无可展示的地块记忆
```

## 6. Label 同源规则

页面和导出必须共用：

```text
apps/web/src/lib/customerLabels.ts
apps/web/src/lib/customerEmptyStates.ts
```

必须共用或等价复用：

```text
customerStatusLabel
customerRiskLabel
customerAcceptanceLabel
customerEvidenceLabel
customerRoiLabel
customerFieldMemoryLabel
customerPrescriptionLabel
customerExecutionLabel
customerSectionStatusLabel
customerTimelineStatusLabel
getCustomerEmptyState
```

禁止在 export 页面定义：

```text
STATUS_MAP
RISK_MAP
ACCEPTANCE_MAP
ROI_MAP
FIELD_MEMORY_MAP
```

## 7. API 同源规则

Export 页面只能使用 customer API adapter：

```text
fetchCustomerDashboardAggregate
fetchFieldReport
fetchOperationReport
```

禁止 export 页面 import：

```text
../api/reports
../api/admin
../api/debug
../api/devtools
```

禁止 export 页面直接引用：

```text
/api/v1/facts
/api/admin
/healthz
/openapi
legacy/control
raw_telemetry
raw facts
```

## 8. Gate 脚本

脚本：

```text
apps/web/scripts/check-customer-export-same-source.mjs
```

package script：

```bash
pnpm --filter @geox/web run check:customer-export-same-source
```

脚本必须检查：

```text
CustomerDashboardExportPage 必须 import buildCustomerDashboardVm
FieldReportExportPage 必须 import buildFieldReportVm
CustomerReportExportPage 必须 import buildOperationReportVm
Export 页面不得定义 STATUS_MAP / RISK_MAP / ACCEPTANCE_MAP
Export 页面不得 import raw/debug/admin/devtools API
OperationReportExportPage 如存在，必须纯 re-export 到 CustomerReportExportPage
```

## 9. 推荐脚本逻辑

`check-customer-export-same-source.mjs` 至少应包含以下检查：

```text
requiredImports:
  src/views/CustomerDashboardExportPage.tsx → buildCustomerDashboardVm
  src/views/FieldReportExportPage.tsx → buildFieldReportVm
  src/views/CustomerReportExportPage.tsx → buildOperationReportVm

forbiddenMapSymbols:
  STATUS_MAP
  RISK_MAP
  ACCEPTANCE_MAP

forbiddenApiTokens:
  ../api/reports
  ../api/admin
  ../api/debug
  ../api/devtools
  raw_telemetry
  legacy/control

optionalCompatOperationExport:
  src/views/OperationReportExportPage.tsx
  if exists, must be pure:
    export { default } from "./CustomerReportExportPage";
```

脚本发现违规必须 `process.exit(1)`。

## 10. 人工验收清单

Dashboard export：

```text
/customer/dashboard 与 /customer/export KPI 一致
不显示“在线地块 / 总地块”
不显示“今日待决策”
不显示假天气
不显示假地图
```

Field export：

```text
/customer/fields/:fieldId 与 /customer/fields/:fieldId/export 风险一致
ROI 有则一致，无则同为空态
Field Memory 有则一致，无则同为空态
不出现天气卡
不出现 fake map
```

Operation export：

```text
/customer/operations/:operationId 与 /customer/operations/:operationId/export 均为八段闭环
八段标题一致
八段状态一致
八段空态一致
技术详情不抢主视图
不出现旧六段 export 文件逻辑
```

## 11. 失败示例

以下情况必须判失败：

```text
Export 页面 import ../api/reports
Export 页面定义 STATUS_MAP
Export 页面定义 RISK_MAP
Export 页面定义 ACCEPTANCE_MAP
OperationReportExportPage 是旧六段完整实现
Dashboard export 显示 P0 不允许 KPI
Field export 显示假 Field Memory
Operation export 显示 DONE / MISSING / PENDING raw 状态
```

## 12. 通过标准

同源检查通过必须同时满足：

```bash
pnpm --filter @geox/web run check:customer-export-same-source
pnpm --filter @geox/web run check:customer-boundary
pnpm --filter @geox/web run lint:operation-status-convergence
pnpm --filter @geox/web run typecheck
pnpm --filter @geox/web run build
```

并且人工确认：

```text
页面与导出的客户文案一致
页面与导出的空态一致
页面与导出的客户结论一致
Export 不暴露 raw/debug/admin/healthz/OpenAPI
```

满足以上条件后，P0 customer export 可判定为交付通过。
