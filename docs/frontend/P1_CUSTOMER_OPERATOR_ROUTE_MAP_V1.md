# P1_CUSTOMER_OPERATOR_ROUTE_MAP_V1

状态：P1 route governance baseline.
目的：把 P1 客户路由与运营路由分层，避免 customer/operator/admin/debug 边界混乱。

## 1. 路由分层原则

P1 前端分为两类正式产品界面：

```text
/customer/*  客户层：客户可理解、可导出、可销售演示
/operator/*  运营层：内部交付、审批、派发、验收、证据复核
```

客户层不得暴露 operator/admin/debug 入口。运营层不得直接暴露 debug/healthz/raw facts/device credential secret payload。

## 2. Customer 当前路由

| 路由 | 当前状态 | 阶段 | 说明 |
|---|---|---|---|
| `/customer/dashboard` | 已存在 | P1-A0 | 客户总览 |
| `/customer/export` | 已存在 | P1-A0 | 客户总览导出 |
| `/customer/fields/index` | 临时存在 | P1-A0/P1-A 迁移 | P1-A-01 后迁移到 `/customer/fields` |
| `/customer/operations/index` | 临时存在 | P1-A0/P1-A 迁移 | P1-A-02 后迁移到 `/customer/operations` |
| `/customer/fields/:fieldId` | 已存在 | P1-A0 | 地块病历 |
| `/customer/fields/:fieldId/export` | 已存在 | P1-A0 | 地块报告导出 |
| `/customer/operations/:operationId` | 已存在 | P1-A0 | 作业闭环报告 |
| `/customer/operations/:operationId/export` | 已存在 | P1-A0 | 作业报告导出 |

## 3. Customer P1 目标路由

| 路由 | 阶段 | 状态 | 任务编号 | Done 条件 |
|---|---|---|---|---|
| `/customer/fields` | P1-A | 待正式收口 | A-01 | 替代 `/customer/fields/index`，客户可读列表，不泄露 raw id |
| `/customer/operations` | P1-A | 待正式收口 | A-02 | 替代 `/customer/operations/index`，列表状态客户化 |
| `/customer/reports` | P1-A | 待新增 | A-03 | 报告中心，同源导出入口 |
| `/customer/fields/:fieldId` | P1-A0/P1-A | 已有，继续治理 | A0-02 | field_name 优先，正式空态 |
| `/customer/operations/:operationId` | P1-A0/P1-A | 已有，继续治理 | A0-03/A0-04 | 证据三态，技术折叠客户化 |

## 4. Operator P1 目标路由

| 路由 | 阶段 | 状态 | 任务编号 | 说明 |
|---|---|---|---|---|
| `/operator` | P1-B | 待新增 | B-01 | OperatorShell 与默认入口 |
| `/operator/workbench` | P1-B | 待新增 | B-02 | 只读总队列 |
| `/operator/approvals` | P1-B | 待新增 | B-03 | 审批中心 |
| `/operator/dispatch` | P1-B | 待新增 | B-04 | 派发状态页 |
| `/operator/acceptance` | P1-B | 待新增 | B-05 | 验收中心 |
| `/operator/evidence` | P1-B | 待新增 | B-06 | 证据中心 |
| `/operator/devices-alerts` | P1-C | 已存在，只读 facade | C-01 | 设备与告警中心（支持 limit/field_id/device_id/online_status；ACK/close 写操作未 ready；revoke 写操作未 ready） |
| `/operator/roi-ledger` | P1-C | 已存在，只读 facade | C-02 | ROI 运营明细（evidence_ref 已规范化；无证据不得 MEASURED；approval 写操作未 ready） |
| `/operator/field-memory` | P1-C | 已存在，只读 facade | C-03 | 田块记忆运营中心；需要认证且合法状态 200/401/403（acceptance evaluate 写操作未 ready） |

field-memory 鉴权口径：
- `200`：认证通过且有 `field_memory.read` 或 `ao_act.index.read`。
- `401`：未认证或缺少 token（典型返回：`{"ok":false,"error":"AUTH_MISSING"}`）。
- `403`：已认证但无权限（返回：`{"error":"FORBIDDEN","message":"当前身份无权查看运营田块记忆明细。"}`）。
- 前端 adapter/VM 必须将 `401/403` 统一进入“未登录或权限不足”正式错误态，不得回退到 customer 摘要、不得伪装 empty。

## 5. Customer 禁止路由

客户层禁止出现：

```text
/admin/*
/debug/*
/devtools/*
/operator/*
/healthz
/openapi
/legacy/*
/api/admin/*
/api/debug/*
/api/v1/facts/*
/api/v1/raw-telemetry/*
/api/v1/devices/*/credentials
/api/v1/skill-registry/write
```

## 6. Operator 禁止直连能力

运营层禁止直接调用：

```text
debug
healthz
raw facts
device credential secret payload
migration
OpenAPI
legacy control API without adapter
```

Operator 可以展示内部运营状态，但必须经过 operator adapter 或正式 v1 API。禁止把 debug/healthz 当作业务数据源。

## 7. 导航规则

CustomerShell 只允许：

```text
总览
地块
作业
报告
```

OperatorShell 只允许：

```text
工作台
审批
派发
验收
证据
设备与告警
价值记录
田块记忆
```

两者不得互相混入主导航。

## 8. 迁移策略

P1-A 结束时：

- `/customer/fields/index` 不再作为正式文档 URL。
- `/customer/operations/index` 不再作为正式文档 URL。
- CustomerShell 指向 `/customer/fields`、`/customer/operations`、`/customer/reports`。

P1-B 开始前：

- operator 路由必须有独立 shell。
- operator boundary check 必须先建立。
- customer route check 必须禁止 operator 链接进入 customer 主导航。

## 9. 验收标准

- customer 和 operator 路由边界清晰。
- 临时 index 路由有迁移策略。
- customer 禁止路由明确。
- operator 禁止直连能力明确。
- P1-A0 不把 operator 路由写成当前已有。
