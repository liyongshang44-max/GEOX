# CUSTOMER_FRONTEND_MVP_V1

状态：P1-A0 / customer frontend governance baseline.
适用范围：`apps/web/src/layouts/CustomerLayout.tsx`、`apps/web/src/views/*Customer*`、`FieldReportPage`、`OperationReportPage`、customer export pages、customer viewmodels、`components/customer`。

## 1. 产品定位

GEOX Customer Frontend 的 P1 MVP 不是后台管理台，不是遥感大屏，也不是 raw data explorer。

它的最小产品定位是：

```text
客户能从经营总览进入地块病历，再进入作业闭环报告，并导出同源客户报告。
```

客户可理解主链：

```text
发现风险 -> 形成建议 -> 审批 -> 执行 -> 证据 -> 验收 -> 价值记录 -> 田块记忆
```

## 2. P1-A0 冻结范围

P1-A0 只做前端治理基线，不扩业务能力：

- CustomerShell 客户文案与占位清理。
- FieldReport 客户文案与空态清理。
- Operation Evidence 三态表达修复。
- 技术折叠字段 label 客户化。
- docs/frontend 治理文档补齐。
- API readiness matrix 建立。
- customer route / raw enum 检查脚本准备。

## 3. 当前客户页面

| 页面 | 当前路由 | 组件 | 当前定位 |
|---|---|---|---|
| 客户总览 | `/customer/dashboard` | `CustomerDashboardPage` | 客户经营总览 |
| 总览导出 | `/customer/export` | `CustomerDashboardExportPage` | 总览报告导出 |
| 地块病历 | `/customer/fields/:fieldId` | `FieldReportPage` | 单地块报告 |
| 地块导出 | `/customer/fields/:fieldId/export` | `FieldReportExportPage` | 单地块报告导出 |
| 作业报告 | `/customer/operations/:operationId` | `OperationReportPage` | 单作业闭环报告 |
| 作业导出 | `/customer/operations/:operationId/export` | `CustomerReportExportPage` | 单作业报告导出 |

临时 index 路由 `/customer/fields/index`、`/customer/operations/index` 如存在，只能作为 P1-A 迁移过渡，不得长期作为正式客户 URL。

## 4. P1 目标客户页面

| 页面 | 目标路由 | 阶段 | 要求 |
|---|---|---|---|
| 客户总览 | `/customer/dashboard` | P1-A0 | 已有，继续收口 |
| 地块列表 | `/customer/fields` | P1-A | 替代 `/customer/fields/index` |
| 作业列表 | `/customer/operations` | P1-A | 替代 `/customer/operations/index` |
| 报告中心 | `/customer/reports` | P1-A | 汇总总览/地块/作业报告入口 |
| 地块病历 | `/customer/fields/:fieldId` | P1-A0/P1-A | field_name 优先，field_id 不作主标题 |
| 作业报告 | `/customer/operations/:operationId` | P1-A0/P1-A | 八段闭环，证据三态 |

## 5. 客户层禁止直接调用

客户层禁止直接调用：

```text
admin
debug
legacy
healthz
raw telemetry
raw facts
device credentials
skill registry write APIs
```

## 6. 客户主界面禁止显示

客户主界面禁止显示：

```text
operation_id
recommendation_id
prescription_id
approval_request_id
act_task_id
receipt_id
evidence_id
acceptance_id
skill_run_id
skill_trace_id
roi_id
field_memory_id
raw JSON
stack trace
SUCCESS
FAILED
PENDING
MISSING
AVAILABLE
PASS
DONE
INVALID_EXECUTION
PENDING_ACCEPTANCE
```

技术折叠区可以保留排障信息，但必须默认关闭，并使用客户可理解 label，例如：

```text
作业编号（技术排障）
处方编号（技术排障）
技能追踪编号（技术排障）
原始状态码（技术排障）
错误堆栈（技术排障）
```

## 7. ViewModel 原则

```text
API adapter -> ViewModel -> Page -> Component
```

页面只负责加载、错误态和布局。业务翻译、空态、状态收敛必须在 ViewModel 或 shared label 层完成。

## 8. Export 同源原则

导出页面必须复用同源 API 与同源 VM：

| 页面 | 导出 | VM |
|---|---|---|
| Dashboard | `CustomerDashboardExportPage` | `buildCustomerDashboardVm` |
| FieldReport | `FieldReportExportPage` | `buildFieldReportVm` |
| OperationReport | `CustomerReportExportPage` | `buildOperationReportVm` |

禁止导出页重新定义状态映射、重新计算风险、伪造 ROI、伪造田块记忆、伪造证据包摘要。

## 9. P1-A0 Done 标准

P1-A0 可标记 Done 必须满足：

- CustomerShell 无工程阶段文案、硬编码客户名和假数据。
- FieldReport 无 `FieldReport`、`Field Memory` 英文直出。
- 无 geometry 时不显示假地图，显示正式空态。
- OperationReport 证据段三态可区分。
- 技术折叠区 label 客户化且默认关闭。
- docs/frontend 七份文档齐全。
- API readiness matrix 不把未接入 API 写成当前已有。

## 10. 非目标

P1-A0 不做：

- operator 工作台完整开发。
- evidence package 下载。
- recommendation 生成 API 新接入。
- device credential 管理。
- raw facts / raw telemetry 客户展示。
- 地图 geometry 伪造。
- 天气数据伪造。
