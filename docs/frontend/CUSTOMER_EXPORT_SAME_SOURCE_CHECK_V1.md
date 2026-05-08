# CUSTOMER_EXPORT_SAME_SOURCE_CHECK_V1

状态：P1-A0 export same-source governance baseline.
目的：确保客户页面与导出报告使用同一 API、同一 ViewModel、同一 label、同一空态，避免导出页形成第二套业务结论。

## 1. 核心原则

```text
页面看到什么，导出报告就表达同一套客户结论。
```

禁止出现：

```text
页面显示“暂无可量化价值记录”，导出伪造节水收益。
页面显示“暂无可展示的田块记忆”，导出写“系统已学习”。
页面显示“已有证据记录，暂无证据包摘要”，导出写“证据包已下载”。
页面显示客户化状态，导出显示 SUCCESS / PASS / PENDING raw enum。
```

## 2. 同源对象

| 页面 | Export 页面 | 必须复用 API | 必须复用 ViewModel | 当前状态 |
|---|---|---|---|---|
| `CustomerDashboardPage` | `CustomerDashboardExportPage` | `fetchCustomerDashboardAggregate` | `buildCustomerDashboardVm` | 已存在 |
| `FieldReportPage` | `FieldReportExportPage` | `fetchFieldReport` | `buildFieldReportVm` | 已存在 |
| `OperationReportPage` | `CustomerReportExportPage` | `fetchOperationReport` | `buildOperationReportVm` | 已存在 |

兼容文件 `OperationReportExportPage.tsx` 如存在，只能作为薄 re-export：

```ts
export { default } from "./CustomerReportExportPage";
```

## 3. Dashboard Export 要求

Dashboard export 必须：

- 与 `/customer/dashboard` 使用同一 aggregate API。
- 与页面使用同一 VM。
- 与页面使用同一客户标签和空态。

禁止：

```text
重新计算 KPI
重新拼风险地块
显示未在页面中出现的假地图、假天气、假设备在线率
直接调用 admin/debug/raw facts/raw telemetry
```

## 4. Field Export 要求

Field export 必须：

- 与 `/customer/fields/:fieldId` 使用同一 field report API。
- 与页面使用 `buildFieldReportVm`。
- field_name 优先。
- 无 ROI / 田块记忆 / geometry 时使用同一正式空态。

禁止：

```text
用 field_id 作为主标题
伪造 geometry
伪造地图
伪造 ROI
伪造田块记忆
显示 FieldReport / Field Memory 英文工程直出
```

## 5. Operation Export 要求

Operation export 必须与 `/customer/operations/:operationId` 保持八段闭环一致：

```text
建议
处方
审批
执行
证据
验收
价值记录
记忆
```

证据段必须遵守三态：

| 状态 | 文案 |
|---|---|
| 无证据 | 暂无有效证据。 |
| 有证据但无证据包摘要 | 已有证据记录，暂无证据包摘要。 |
| 有证据包摘要 | 证据包已形成，可查看摘要。 |

禁止：

```text
伪造 manifest
伪造 sha256
显示裸文件路径
显示假下载按钮
operation evidence summary API 未接入前显示“下载证据包”
```

## 6. Label 同源要求

页面和导出必须共用：

```text
apps/web/src/lib/customerLabels.ts
apps/web/src/lib/customerEmptyStates.ts
```

禁止 export 页面自定义：

```text
STATUS_MAP
RISK_MAP
ACCEPTANCE_MAP
ROI_MAP
FIELD_MEMORY_MAP
```

技术折叠字段如进入导出或技术附录，必须使用 `labelCustomerTechnicalField(...)` 或等价映射，不能直接显示 raw key。

## 7. API 同源要求

Export 页面只允许通过客户 adapter 取数：

```text
fetchCustomerDashboardAggregate
fetchFieldReport
fetchOperationReport
```

禁止 export 页面直接调用：

```text
/api/admin/*
/api/debug/*
/api/v1/facts/*
/api/v1/raw-telemetry/*
/healthz
/api/v1/openapi.json
legacy control API
device credential APIs
```

## 8. Gate 脚本要求

脚本目标文件：

```text
apps/web/scripts/check-customer-export-same-source.mjs
```

建议 package script：

```bash
pnpm --filter @geox/web run check:customer-export-same-source
```

脚本至少检查：

- Dashboard export import `buildCustomerDashboardVm`。
- Field export import `buildFieldReportVm`。
- Operation export import `buildOperationReportVm`。
- Export 页面不得定义 `STATUS_MAP` / `RISK_MAP` / `ACCEPTANCE_MAP`。
- Export 页面不得 import admin/debug/devtools/raw API。
- `OperationReportExportPage.tsx` 如存在，必须 re-export 到 `CustomerReportExportPage`。

## 9. P1-A0 验收标准

- 三类 export 文档同源要求明确。
- 未接入 evidence package summary/download API 时不得写成现有能力。
- 导出页不得出现 raw enum、raw JSON、stack trace。
- 页面和导出的客户空态一致。
- 页面和导出的状态文案一致。
