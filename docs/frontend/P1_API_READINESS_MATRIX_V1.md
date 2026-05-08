# P1_API_READINESS_MATRIX_V1

状态：P1-A0 API readiness baseline.
目的：明确 P1 前端所需 API 的当前状态、阻塞阶段、fallback 策略，以及是否允许标记 Done。

## 1. 状态枚举

| 状态 | 含义 |
|---|---|
| 已存在 | 当前仓库已有正式 API 或当前客户 adapter 已可调用 |
| adapter 可包 | 后端已有相邻能力，但客户前端需要 customer/operator adapter 封装 |
| 需新增 | 当前没有足够 API，需新增正式接口 |
| 未接入 | 不在当前阶段接入，不得作为 Done 条件 |

## 2. Customer API Readiness

| API 路径 | 当前状态 | 阻塞阶段 | fallback 策略 | 是否允许标记 Done | 备注 |
|---|---|---|---|---|---|
| `/api/v1/reports/customer-dashboard/aggregate` | 已存在 | P1-A0 | 空态展示 | 是 | Dashboard 当前数据源 |
| `/api/v1/reports/field/:fieldId` | 已存在 | P1-A0 | 加载错误/正式空态 | 是 | FieldReport 当前数据源 |
| `/api/v1/reports/operation/:operationId` | 已存在 | P1-A0 | 加载错误/正式空态 | 是 | OperationReport 当前数据源 |
| `/api/v1/customer/fields` | adapter 可包 | P1-A | 无列表时正式空态 | 否，A-01/A-04 前不允许 | 用于正式 `/customer/fields` |
| `/api/v1/customer/operations` | adapter 可包 | P1-A | 无列表时正式空态 | 否，A-02/A-04 前不允许 | 用于正式 `/customer/operations` |
| `/api/v1/customer/reports` | 需新增 | P1-A | 报告中心空态 | 否，A-03/A-04 前不允许 | 用于 `/customer/reports` |
| `/api/v1/customer/prescriptions/:id` | 需新增或 adapter 可包 | P1-A | 未形成正式处方 | 否，A-05 前不允许 | 处方详情抽屉只读版 |
| `/api/v1/operations/:operationId/evidence-pack-summary` | 未接入 | P1-A/P1-C | 使用 report 内嵌证据摘要；无 summary 三态降级 | 否 | 未接入前不得显示“下载证据包” |
| `/api/v1/customer/roi-ledger` | 未接入 | P1-A/P1-C | 显示“暂无可量化价值记录” | 否 | 不得伪造 ROI 明细 |
| `/api/v1/customer/field-memory` | 未接入 | P1-A/P1-C | 显示“暂无可展示的田块记忆” | 否 | 不得伪造学习结果 |
| 推荐生成 API | 未接入客户前端 | 非 P1-A0 | 不在客户主界面承诺 | 否 | 不得误写成当前已有 API |

## 3. Operator API Readiness

| API 路径 / 能力 | 当前状态 | 阻塞阶段 | fallback 策略 | 是否允许标记 Done | 备注 |
|---|---|---|---|---|---|
| approvals list / approve API | adapter 可包 | P1-B | 无审批记录空态 | 否，B-03 前不允许 | 必须走正式 approval adapter |
| dispatch / task state API | adapter 可包 | P1-B | 派发状态空态 | 否，B-04 前不允许 | 不直连 legacy control API |
| acceptance list / detail API | adapter 可包 | P1-B | 验收队列空态 | 否，B-05 前不允许 | final_status/read model 为准 |
| evidence center API | adapter 可包 | P1-B | 证据中心空态 | 否，B-06 前不允许 | 不展示裸文件路径 |
| devices + alerts API | adapter 可包 | P1-C | 设备/告警空态 | 否，C-01 前不允许 | 不展示 credential secret payload |
| alert ACK / close API | adapter 可包 | P1-C | 操作不可用提示 | 否，C-05 前不允许 | 不绕过权限与审批边界 |
| device credential status API | 需新增或 adapter 可包 | P1-C | 只读状态空态 | 否，C-06 前不允许 | 只展示状态，不展示 secret |

## 4. 禁止误判为已存在的能力

以下能力即使后端存在相邻数据，也不得在 P1-A0 标记为 Done：

```text
正式 /customer/fields 列表 API
正式 /customer/operations 列表 API
正式 /customer/reports 报告中心 API
operation-level evidence summary API
证据包下载 API
ROI Ledger 客户明细 API
Field Memory 客户明细 API
推荐生成 API
OperatorShell API 聚合
设备凭证状态客户可读 API
```

## 5. Fallback 策略

| 缺口 | fallback |
|---|---|
| 无客户范围 | 授权范围待确认 |
| 搜索未接入 | disabled，placeholder 为“搜索功能暂未开放” |
| 无 geometry | 暂无地块 geometry，当前以列表方式展示 |
| 无证据 | 暂无有效证据。 |
| 有证据无摘要 | 已有证据记录，暂无证据包摘要。 |
| 有证据包摘要 | 证据包已形成，可查看摘要。 |
| 无 ROI | 暂无可量化价值记录 |
| 无田块记忆 | 暂无可展示的田块记忆 |
| 无 operator 数据 | 运营空态，不显示 debug/healthz/raw facts |

## 6. Done 判定规则

允许标记 Done 的条件：

- API 状态为“已存在”；或
- 对应任务明确允许 adapter 包装，且 adapter 已落地、页面不直连禁止 API；或
- 缺口有正式空态，并且任务目标本身就是“空态收口”。

不允许标记 Done 的条件：

- 仅有文案但无 API/adapter。
- 仅靠 mock 数据演示。
- 页面直接调用 admin/debug/raw facts/raw telemetry。
- 把“需新增”或“未接入”写成“已存在”。
- evidence summary 未接入却展示下载证据包。
- 推荐 API 未接入却在客户主界面承诺自动生成建议。

## 7. P1-A0 验收标准

- Matrix 覆盖客户侧和运营侧 P1 所需 API。
- 每个 API 有当前状态、阻塞阶段、fallback 和 Done 判定。
- 推荐 API 不被误写为当前已有。
- operation-level evidence summary/download 不被误写为当前已有。
- P1-A0 文档无缺口。
