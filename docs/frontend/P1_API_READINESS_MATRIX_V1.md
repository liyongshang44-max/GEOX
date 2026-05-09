# P1_API_READINESS_MATRIX_V1

状态：P1-A0 API readiness baseline.
目的：防止开发团队把“推荐 API / 后续聚合 API / operator API”误判为当前已有能力，确保每个前端任务的 Done 判定有明确 API 依据。

## 1. Readiness 状态枚举

| 状态 | 含义 | 是否可直接作为 Done |
|---|---|---|
| 已存在 | 当前仓库已有正式 API，且前端已有或可直接通过现有 adapter 调用 | 可以，但仍需满足页面/边界验收 |
| Preview 已存在 | 当前已有可演示或聚合 API，但口径不能代表 P1 正式目标 API | 只能算 Preview，不能替代 P1 正式 API Done |
| adapter 可包 | 后端已有相邻能力，但需要 customer/operator adapter 封装后才能给页面使用 | adapter 落地前不能 Done |
| 需新增 | 当前缺少足够 API，需要新增正式接口 | 不能 Done |
| 未接入 | 当前阶段不接入或尚未接入 | 不能 Done，只能 fallback |
| 禁止误用 | 不属于当前客户/运营前端可调用能力 | 不能 Done，也不能被页面直连 |

## 2. Customer API Readiness

| API 路径 | 当前状态 | 阻塞阶段 | fallback 策略 | fallback 是否可标记 Done | 备注 |
|---|---|---|---|---|---|
| `GET /api/v1/customer/cockpit/overview` | 需新增 | P1-A / cockpit 正式聚合 | 使用 `GET /api/v1/reports/customer-dashboard/aggregate` 做 Preview 展示 | 否，Preview 不能替代正式 cockpit API Done | 目标 cockpit API，不得误写为当前已有 |
| `GET /api/v1/customer/fields` | 已存在（P2-A customer facade） | P1-A-01 / P1-A-04 | 临时 `/customer/fields/index` 或正式空态 | 是（只读 facade 范围内） | 用于正式 `/customer/fields` |
| `GET /api/v1/customer/operations` | 已存在（P2-A customer facade） | P1-A-02 / P1-A-04 | 临时 `/customer/operations/index` 或正式空态 | 是（只读 facade 范围内） | 用于正式 `/customer/operations` |
| `GET /api/v1/customer/reports` | 已存在（P2-A customer facade） | P1-A-03 / P1-A-04 | 报告中心显示正式空态 | 是（只读 facade 范围内） | 用于 `/customer/reports` 报告中心 |
| `GET /api/v1/customer/roi-ledger?field_id=&operation_id=` | 未接入 | P1-A-07 / P1-C-02 | 显示“暂无可量化价值记录” | 否，除非任务目标仅为只读入口空态 | 不得伪造节水、节人工、收益金额 |
| `GET /api/v1/customer/fields/:fieldId/memory` | 未接入 | P1-A-08 / P1-C-03 | 显示“暂无可展示的田块记忆” | 否，除非任务目标仅为空态收口 | 不得用 operation count / device count / ROI count 推导记忆 |

## 3. Reports / Existing API Readiness

| API 路径 | 当前状态 | 阻塞阶段 | fallback 策略 | fallback 是否可标记 Done | 备注 |
|---|---|---|---|---|---|
| `GET /api/v1/reports/customer-dashboard/aggregate` | Preview 已存在 | P1-A0 | 空态展示；作为 Dashboard Preview 数据源 | 只能标记 P1-A0 Preview Done，不能标记正式 cockpit API Done | 当前 Dashboard 数据源；不是 `customer/cockpit/overview` 的替代完成项 |
| `GET /api/v1/reports/field/:fieldId` | 已存在 | P1-A0 | 加载错误态 / 正式空态 | 是，可支撑 FieldReport P1-A0 Done | 当前 FieldReport 数据源 |
| `GET /api/v1/reports/operation/:operationId` | 已存在 | P1-A0 | 加载错误态 / 正式空态 | 是，可支撑 OperationReport P1-A0 Done | 当前 OperationReport 数据源；A-06 证据三态只使用内嵌 evidence fallback |

## 4. Evidence API Readiness

| API 路径 | 当前状态 | 阻塞阶段 | fallback 策略 | fallback 是否可标记 Done | 备注 |
|---|---|---|---|---|---|
| `GET /api/v1/operations/:operationId/evidence-pack-summary` | 未接入 | P1-A-06 / P1-B 后端协作 / P1-C 深化 | 使用 `GET /api/v1/reports/operation/:operationId` 内嵌 evidence 字段进行三态 fallback | A-06 可标记 fallback Done；不能标记 evidence summary API Done | 未接入前不得显示“下载证据包”，不得伪造 manifest / sha256 / download |

## 5. Operator API Readiness

| API 路径 | 当前状态 | 阻塞阶段 | fallback 策略 | fallback 是否可标记 Done | 备注 |
|---|---|---|---|---|---|
| `GET /api/v1/operator/workbench` | 已存在，只读 facade | P1-B-02 | 使用正式 API，不再依赖 fallback | 是（只读 facade 范围内） | 只读总队列；无数据返回 200+items:[]；writeReady/exportReady=false |
| `GET /api/v1/operator/approvals` | adapter 可包 | P1-B-03 | 无审批记录空态 | 否，operator adapter 未落地前不能 Done | 必须走正式 approval adapter，不绕过审批边界 |
| `GET /api/v1/operator/dispatch` | 已存在，只读 facade | P1-B-04 | 使用正式 API，不再依赖 fallback | 是（只读 facade 范围内） | 派发只读门面；无数据返回 200+items:[]；writeReady/exportReady=false |
| `GET /api/v1/operator/acceptance` | 已存在，只读 facade | P1-B-05 | 使用正式 API，不再依赖 fallback | 是（只读 facade 范围内） | 验收只读门面；无数据返回 200+items:[]；writeReady/exportReady=false |
| `GET /api/v1/operator/evidence` | 已存在，只读 facade | P1-B-06 | 使用正式 API，不再依赖 fallback | 是（只读 facade 范围内） | 证据中心只读门面；无数据返回 200+items:[]；operator evidence export 写操作未 ready |
| `GET /api/v1/evidence/export-jobs` | 已存在，只读 facade | P1-B-06 | 作为 operator evidence 兼容只读入口 | 是（只读 facade 范围内） | export-jobs 兼容只读门面；无数据返回 200+items:[]；operator evidence export 写操作未 ready |
| `GET /api/v1/operator/devices-alerts?limit=&field_id=&device_id=&online_status=` | 已存在，只读 facade | P1-C-01 | 使用正式 API，不再依赖 fallback | 是（只读 facade 范围内） | 支持 limit(默认 100，最大 300) + in-memory 过滤；ACK/close 写操作未 ready；revoke 写操作未 ready；不展示 device credential secret payload |
| `GET /api/v1/operator/field-memory` | 已存在，只读 facade | P1-C-03 | 使用正式 API，不再依赖 fallback | 是（只读 facade 范围内） | 需要认证；200(已认证且有读权限)/401(未认证 AUTH_MISSING)/403(已认证但无 field_memory.read 或 ao_act.index.read) 均为合法口径；acceptance evaluate 写操作未 ready |
| `GET /api/v1/operator/roi-ledger` | 已存在，只读 facade | P1-C-02 | 使用正式 API，不再依赖 fallback | 是（只读 facade 范围内） | evidence_ref 已规范化；无证据不得 MEASURED；approval 写操作未 ready |

写操作未 ready 统一口径：operator approval 写操作未 ready；operator dispatch/retry 写操作未 ready；operator acceptance evaluate 写操作未 ready；operator evidence export 写操作未 ready；alert ACK/close 写操作未 ready；device revoke 写操作未 ready。

## 6. 推荐 API 防误用规则

P1-A0 明确禁止把推荐 API 写成当前已有客户前端 API。

以下能力不得被标记为“已存在”或作为 P1-A0 Done 条件：

```text
POST /api/v1/customer/recommendations/generate
POST /api/v1/recommendations/generate
POST /api/v1/decision/recommendations/generate
任何 recommendation trigger / agronomy recommendation 生成 API
任何直接触发处方生成、审批生成、任务生成的客户主界面 API
```

原因：P1-A0 的客户前端任务是客户可读和边界收口，不是新增推荐生成链路。推荐链路必须走正式 decision/recommendation/approval/operation 主链治理，不能由客户页面直接触发。

## 7. Fallback Done 判定

| fallback 场景 | 允许展示 | 是否可标记 Done | 限制 |
|---|---:|---:|---|
| dashboard aggregate 作为 Dashboard 数据源 | 是 | 仅 P1-A0 Preview Done | 不能替代 `GET /api/v1/customer/cockpit/overview` |
| field report API 加载失败 | 是 | 是，若错误态客户可读 | 不得显示 stack trace/raw JSON |
| operation report API 加载失败 | 是 | 是，若错误态客户可读 | 不得显示 stack trace/raw JSON |
| 无 geometry | 是 | 是，若任务目标为空态收口 | 文案固定为“暂无地块 geometry，当前以列表方式展示” |
| 无证据 | 是 | A-06 fallback Done 可通过 | 文案固定为“暂无有效证据。” |
| 有证据但无证据包摘要 | 是 | A-06 fallback Done 可通过 | 文案固定为“已有证据记录，暂无证据包摘要。” |
| 有证据包摘要 | 是 | 仅当 report 内嵌 summary 存在 | 不代表 evidence-pack-summary API 已接入 |
| 无 ROI ledger API | 是 | 仅只读入口/空态任务可通过 | 不得伪造 ROI 明细 |
| 无 Field Memory API | 是 | 仅只读入口/空态任务可通过 | 不得伪造田块记忆 |
| operator API（除 devices-alerts/field-memory/roi-ledger）未接入 | 是 | 不能 Done | 只能显示运营空态，不得直连 debug/healthz/raw facts |

## 8. 禁止误判为已存在的能力

即使后端存在相邻数据，也不得在 P1-A0 标记为当前已有：

```text
（注：第 5 节已标注“已存在，只读 facade”的 operator API，且第 2 节已标注“已存在（P2-A customer facade）”的 customer fields / operations / reports，不属于本节禁止误判范围。）
GET /api/v1/customer/cockpit/overview
GET /api/v1/customer/roi-ledger?field_id=&operation_id=
GET /api/v1/customer/fields/:fieldId/memory
GET /api/v1/operations/:operationId/evidence-pack-summary
GET /api/v1/operator/approvals
推荐生成 API
证据包下载 API
```

## 9. 页面调用边界

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
recommendation generate APIs
```

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

## 10. P1-A0 验收标准

- Customer / Reports / Evidence / Operator 所列 API 均有 readiness 状态。
- 每个 API 都有 fallback 策略和 fallback Done 判定。
- dashboard aggregate fallback 明确只能算 Preview。
- 推荐 API 不被误写成当前已有 API。
- evidence-pack-summary API 不被误写成当前已有 API。
- 未接入 API 不作为正式页面 Done 条件。
