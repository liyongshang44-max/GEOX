<!-- docs/frontend-productization/PFE-14-SHADOW-ONLINE-OPERATOR-RUNTIME-CONSOLE-TASK.md -->
# PFE-14 Shadow-Online Operator Runtime Console Promotion
# PFE-14 Shadow-Online 操作员运行控制台升级任务书

```text
document_id: PFE-14-TASK-V0.2-MASTER-ALIGNED
status: CURRENT_TASKBOOK
language: zh-CN
product_line: PFE
target_surface: Operator Runtime Console
frontend_predecessor: PFE-13 Frontend Product v1 Freeze
runtime_dependency: MCFT-CAP-09 Shadow-Online Promotion
target_mode: SHADOW_ONLINE_READ_ONLY
stage_scope: ONE_GOVERNED_SIX_KEY_SCOPE
write_impact: NONE
backend_impact: NONE_IN_PFE_LINE
database_impact: NONE_IN_PFE_LINE
controlled_action_impact: NONE
production_launch: NOT_CLAIMED
commercial_launch: NOT_CLAIMED
prototype_class: TARGET_STATE_PRODUCT_PROTOTYPE
```

---

## 0. 修订裁决

v0.2 取代 v0.1 作为 PFE-14 当前设计权威，但不否定已经有效的 S0–S3 历史交付。

本次修订用于消除三类偏差：

```text
1. 当前实现、目标态产品原型、正式运行证据曾被混为一谈；
2. v0.1 将 /operator/pilot 和多项未来导航写入当前正式路由基线；
3. v0.1 要求 MCFT-CAP-09 动态提供设备、生产网关、试点和受控执行状态，超出了 CAP-09 Stage 1B 闭包义务。
```

v0.2 的核心裁决是：

```text
PFE-14 是 MCFT-CAP-09 单一六键 Scope 的只读产品化前端；
不是多地块并发运营平台；
不是设备控制台；
不是生产网关控制台；
不是建议、审批或执行工作台；
不是当前仓库页面截图任务；
原型必须按本任务书目标态设计，并明确标注为目标态原型。
```

---

## 1. 权威链与继承边界

### 1.1 总任务书继承

PFE-14 必须服从：

```text
docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md
```

继承以下不可协商边界：

```text
Reality is not Evidence.
Evidence is not State.
Forecast is not Scenario.
Scenario is not Recommendation.
Decision is not Approval.
Approval is not Dispatch.
Dispatch is not Execution.
Replay Twin is not Production Twin.
```

Stage 1B 只建立：

```text
continuous online Evidence ingress
actual hourly scheduling
same canonical Runtime semantics
restart/backfill/degradation handling
online State / Forecast / Runtime Health readback
zero effect on real-world action
```

Stage 1B 不建立：

```text
MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE
production deployment
automatic recommendation
automatic approval
AO-ACT creation
dispatch
model activation
```

### 1.2 MCFT-CAP-09 继承

PFE-14 绑定：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
```

正式产品范围必须与 CAP-09 一致：

```text
one tenant
one project
one group
one field
one season
one governed zone
one active Runtime lineage
one persistent sequential scheduler
one PostgreSQL canonical store
```

PFE-14 不得把单 Scope Stage 1B 原型画成：

```text
multi-field concurrent runtime
portfolio scheduler
all-fields shadow operations
production device fleet
commercial farm operations center
```

### 1.3 前端前驱

PFE-14 继承 PFE-13：

```text
frozen: true
productionLaunch: false
commercialLaunch: false
liveDeviceConnected: false
productionGatewayOnline: false
fieldPilotStarted: false
aoActDispatchEnabled: false
```

任意 route、capability、visual、copy、bundle 变化必须分别取得对应治理和验收证据。

---

## 2. 当前仓库事实与目标态的严格分层

### 2.1 当前已实现层

截至 PFE-14 S3 effective，仓库已实现：

```text
Operator-owned Apple-inspired shell
primary navigation: 运行总览 / 地块
Replay-backed Demo default context
Read-only boundary
technical-detail progressive disclosure
canonical /operator/fields/* route family
```

当前实现不得被描述为：

```text
Shadow-online active
Scheduler active
Evidence freshness established
Backfill established
Restart recovery established
Runtime Health established
```

### 2.2 目标态产品层

PFE-14 最终目标是：

```text
one governed Scope
Shadow-online capable
GET-only
continuous operating observation
traceable to canonical Runtime objects and Evidence
```

目标态页面回答：

```text
当前 Scope 是什么
当前模式是什么
最近一个实际 UTC slot 是否完成
下一个 slot 是什么
Evidence 是否具备资格
State / Forecast / Health 当前是什么
是否存在 stale / missed / backfill / recovery / blocked
为什么得到该结论
```

### 2.3 正式运行证据层

只有 MCFT-CAP-09 的正式 authority、exact run、read model 和 API response 才能作为正式运行证据。

前端代码、设计稿、原型图、Story fixture、截图和视觉验收均不是 Runtime 事实来源。

---

## 3. 原型权威

PFE-14 只允许两类视觉产物。

### 3.1 CURRENT_IMPLEMENTATION_REFERENCE

用于说明当前仓库已经实现什么。

必须严格来自：

```text
current main code
browser render
accepted fixtures already owned by the current page
```

不得补画未实现页面、按钮、状态或数据。

### 3.2 TARGET_STATE_PRODUCT_PROTOTYPE

用于定义 PFE-14 S4–S9 的最终产品设计。

必须满足：

```text
依据本任务书，而不是照抄当前页面；
明确标注“目标态原型 / 非当前运行数据”；
只展示一个六键 Scope；
可以使用冻结的 design-only sample dataset；
不得把 sample data 表述为仓库事实、现场事实或验收证据；
不得出现自动 Recommendation / Approval / AO-ACT / Dispatch；
不得出现 production gateway online 或 live device connected；
不得暗示多地块并发 Shadow Runtime 已成立。
```

目标态原型必须使用统一样例：

```text
tenant_id: tenant_sample
project_id: project_sample
group_id: group_sample
field_id: field_sample
season_id: season_sample
zone_id: zone_sample
runtime_mode: SHADOW_ONLINE_SAMPLE
sample_badge: 目标态原型 / 非当前运行数据
```

样例中的时间、数值、状态必须带 `SAMPLE` 或在页面固定位置持续显示原型标识。

---

## 4. 产品信息架构

### 4.1 一级导航

PFE-14 的正式一级导航冻结为：

```text
运行总览
地块
```

原因：

```text
CAP-09 是单 Scope；
Evidence 与 Runtime Health 都是该 Scope 的 Runtime 组成；
没有 console-level global Evidence aggregation contract；
没有 console-level global Health aggregation contract；
/operator/pilot 当前没有正式 route ownership；
Settings 不属于 CAP-09 Shadow-online read surface。
```

PFE-14 禁止增加：

```text
全局证据
全局运行健康
试点
设置
Forecast 一级入口
Calibration 一级入口
```

这些能力若未来需要，必须另开任务线或单独 route authority。

### 4.2 当前正式路由族

PFE-14 复用：

```text
/operator/twin
/operator/fields
/operator/fields/:fieldId
/operator/fields/:fieldId/state
/operator/fields/:fieldId/forecast
/operator/fields/:fieldId/scenario
/operator/fields/:fieldId/action-lifecycle
/operator/fields/:fieldId/residual
/operator/fields/:fieldId/calibration
/operator/fields/:fieldId/evidence-trace
/operator/fields/:fieldId/health
/operator/fields/:fieldId/evidence
/operator/fields/:fieldId/audit
```

分类：

```text
/evidence -> alias of evidence-trace
/audit    -> alias of evidence-trace
```

不再把 `/operator/pilot` 列为 PFE-14 正式路由。

禁止第二套 Shadow route family：

```text
/operator/shadow/*
/operator/mcft9/*
/app/operator/shadow/*
```

### 4.3 Field Runtime tabs

主标签：

```text
总览
证据
状态
预测
运行健康
审计
```

“更多”分组：

```text
情景
行动生命周期
残差验证
校准
```

行动生命周期只允许读取既有可信执行 Evidence；不得创建 Decision、Approval、Task、Dispatch 或 Receipt。

---

## 5. 页面定义

### 5.1 Runtime Overview — `/operator/twin`

目标：对当前唯一受治理 Scope 提供运行摘要，不做多地块组合。

首屏：

```text
Runtime Context
Exact Scope
Latest Completed Slot
Next Target Slot
Evidence Eligibility
Current Runtime Health
```

第二层：

```text
24-hour O00–O23 slot strip
recent runtime events
stale / missed / backfill / recovery summary
State / Forecast status summary
```

第三层技术详情：

```text
canonical refs
checkpoint ref
cursor ref
response hash
limitations
```

不得出现：

```text
all fields
field portfolio
fleet health
automatic action status
AO-ACT dispatch activity
```

### 5.2 Exact Scope Navigator — `/operator/fields`

流程：

```text
field -> season -> zone -> open Runtime
```

必须保持六键：

```text
tenant_id
project_id
group_id
field_id
season_id
zone_id
```

没有权威 zone-list API 时：

```text
保留 zone_id 显式输入
显示“未发现权威分区目录”
不自动补写 demo zone
不把 field_c8_demo 等值包装成生产默认值
```

Scope Navigator 可以列出可选择的 Field/Season，但不能暗示多个 Scope 同时运行 Shadow-online。

### 5.3 Field Runtime Header

固定显示：

```text
Field
Season
Zone
Runtime Mode
Read-only
Latest Completed Slot
Latest Eligible Evidence
```

允许操作：

```text
刷新
复制精确 Scope 链接
打开技术详情
```

刷新策略必须来自服务端建议或用户动作，不允许 1 秒轮询制造实时感。

### 5.4 Evidence

必须展示：

```text
eligible boundary
observed_at
ingested_at
coverage
maximum gap
freshness
future excluded
late Evidence
out-of-order Evidence
missing sources
```

Freshness 判定必须来自权威读模型，不得由浏览器阈值计算。

### 5.5 State

产品层：

```text
state label
value
unit
confidence class
Evidence count
estimate time
status / limitation
```

技术层：

```text
state_id
assimilation_update
posterior_state
source refs
object hash
```

State 不是 Sensor Reading。

### 5.6 Forecast

展示：

```text
COMPLETED / BLOCKED
forecast horizon
generated_at
source State
Evidence cutoff
Scenario eligibility
blocked reason
```

固定非声明：

```text
Forecast is not Fact.
Forecast is not Recommendation.
Forecast is not Action.
```

### 5.7 Runtime Health

产品层必须展示：

```text
current slot status
latest completed slot
next target slot
scheduler lag
missed slot count
backfill status
restart / recovery status
Evidence freshness
degradation reason
```

技术详情可以展示，但不是 PFE-14 最小产品合同：

```text
lease owner
fencing token
cursor identity
checkpoint ref
content hashes
response hashes
```

状态词汇：

```text
等待下一时隙
运行中
已完成
数据受限
Evidence 陈旧
补跑中
已恢复
阻塞
未建立
```

### 5.8 Audit / Evidence Trace

保留：

```text
canonical refs
object types
source facts
Trace nodes
Timeline events
validation summary
limitations
```

默认折叠长 ID、hash 和 raw payload。

---

## 6. Runtime context 与非声明

### 6.1 必须来自 MCFT-CAP-09 读模型

```text
runtime_mode
runtime_stage
request_scope
scheduler / slot status
Evidence eligibility and freshness
State status
Forecast status
Scenario eligibility
backfill / recovery / degradation status
response time
```

### 6.2 继续作为受治理静态非声明

以下内容不属于 MCFT-CAP-09 必须动态提供的产品字段：

```text
Live Device: Not connected
Production Gateway: Not online
Field Pilot: Not started
Controlled Execution: Disabled
```

只有独立 authority 改变这些事实后，前端才可切换。

PFE-14 不得要求 CAP-09 为这些非声明增加动态 API 字段。

---

## 7. 最小读合同

### 7.1 必需产品字段

```text
runtime_mode
runtime_stage
request_scope
latest_completed_slot
latest_tick_status
latest_tick_started_at
latest_tick_completed_at
next_target_slot
next_target_at
scheduler_lag_ms
missed_slot_count
backfill_status
restart_detected
recovery_status
latest_evidence_observed_at
latest_evidence_ingested_at
evidence_age_ms
freshness_status
coverage_ratio
maximum_gap_ms
future_excluded_count
late_evidence_count
out_of_order_count
runtime_degradation_status
degradation_reason_codes
state_status
forecast_status
scenario_source_eligible
response_started_at
refresh_after_seconds
```

### 7.2 可选技术字段

```text
latest_tick_ref
persistent_cursor_ref
cursor_slot
lease_status
lease_owner
fencing_token
backfill_queue_depth
oldest_backfill_slot
recovered_checkpoint_ref
response_instance_hash
content_hashes
```

可选技术字段缺失不得阻塞产品层 readback；但存在时必须进入 progressive disclosure。

---

## 8. 状态矩阵

正式页面必须处理：

```text
LOADING
EMPTY
NO_SCOPE
RUNTIME_NOT_ESTABLISHED
SHADOW_NOT_AUTHORIZED
WAITING_FOR_FIRST_SLOT
RUNNING
COMPLETED
DEGRADED_STALE_EVIDENCE
DEGRADED_MISSING_DATA
BACKFILLING
RECOVERED
BLOCKED
FORBIDDEN
API_ERROR
```

每个状态必须定义：

```text
title
explanation
source
safe next action
forbidden action
auto-retry policy
```

404 `MCFT_RUNTIME_NOT_ESTABLISHED` 不得显示成普通空列表。

---

## 9. Apple-inspired 视觉系统

PFE-14 使用 Apple 式产品原则，不复制 Apple 商标、资产、专有字体或 macOS 控件。

### 9.1 原则

```text
Clarity
Deference
Depth
Continuity
```

### 9.2 字体与字重

```css
-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif
```

只允许：

```text
400 regular
500 medium
600 semibold
```

### 9.3 色彩与层级

```text
page background   #F5F5F7
primary panel     white / restrained translucent
primary text      #1D1D1F
secondary text    #6E6E73
separator         rgba(60,60,67,0.16)
GEOX accent       restrained deep green
```

绿色只用于选择、链接、焦点和受治理 Scope 身份，不作为大面积农业主题装饰。

### 9.4 形状与阴影

```text
main container radius   20px
card radius             16px
control radius          10–12px
pill                    true short status only
panel shadow            0 1px 2px rgba(0,0,0,0.04)
overlay shadow          0 8px 24px rgba(0,0,0,0.08)
```

### 9.5 信息披露

默认视图：

```text
meaning
status
time
source summary
limitation
```

展开视图：

```text
ID
schema
hash
refs
raw payload
validation detail
```

### 9.6 动效与可访问性

```text
fast: 160ms
normal: 220ms
prefers-reduced-motion: required
focus-visible: required
keyboard navigation: required
status must not rely on color alone
```

禁止持续脉冲、闪烁、自动滚动、常驻旋转和无意义数字跳动。

---

## 10. 实施切片

### S0 — Repository Reconciliation

已有效：Taskbook、authority、route ownership、dependency map、changed-file boundary、static acceptance。

### S1 — Frontend Read Contract

已有效：ViewModel、field source map、state matrix、copy/nonclaim、forbidden inference。

### S2 — Apple Visual Foundation

已有效：Operator visual tokens、segmented control、technical disclosure、focus/reduced-motion baseline。

### S3 — Operator Shell Consolidation

已有效：一级导航仅“运行总览 / 地块”、Operator-owned shell、单一 Runtime context area。

### S4 — Single-Scope Runtime Overview

依赖：MCFT-CAP-09 Scheduler + Evidence Availability 权威读合同。

交付：

```text
single exact Scope overview
latest / next slot
Evidence eligibility / freshness
24-hour O00–O23 strip
Runtime context binding
```

### S5 — State / Forecast / Evidence Promotion

依赖：online State / Forecast readback。

### S6 — Runtime Health

依赖：scheduler、restart、backfill、stale/degraded read models。

### S7 — Trace and Qualification Readback

依赖：formal O00–O23 controlled run evidence。

### S8 — Product Quality Closure

```text
i18n
accessibility
responsive
state coverage
visual regression
bundle budget
```

### S9 — Exact Frontend Freeze

```text
exact Candidate tree
accepted merge-tree equality
route inventory freeze
visual approval
handoff
```

---

## 11. Changed-file 原则

允许范围按 Slice 收窄，主要位于：

```text
apps/web/src/layouts/OperatorLayout.tsx
apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
apps/web/src/features/operator/fieldRuntime/*
apps/web/src/api/mcftFieldTwinRuntime.ts
apps/web/src/design-system/product/*
apps/web/src/styles/operatorShellApple.css
apps/web/src/styles/operatorRuntimeVisualSystem.css
apps/web/src/styles/operatorFieldRuntime.css
apps/web/src/lib/productSurfaceLabels.ts
scripts/frontend_acceptance/ACCEPTANCE_PFE_14_*.cjs
docs/frontend-productization/PFE-14-*
```

默认禁止：

```text
apps/server/*
migrations/*
packages/contracts/*
formal Runtime fixtures
Customer pages
Admin pages
facts writers
AO-ACT routes
package dependencies
pnpm lockfile
```

后端读合同必须由 MCFT-CAP-09 或其独立受治理投影交付，不得混入 PFE-14 PR。

---

## 12. Hard Acceptance

```text
HA-01  PFE-13 predecessor freeze consumed
HA-02  Master V2 and MCFT-CAP-09 authority explicitly bound
HA-03  single six-key Scope preserved
HA-04  no multi-field concurrent Shadow-online claim
HA-05  canonical route owner unique
HA-06  /operator/pilot not claimed by PFE-14
HA-07  no duplicate Shadow route family
HA-08  all formal requests GET-only
HA-09  zero POST/PUT/PATCH/DELETE dependency
HA-10  Shadow-online label only appears from authority
HA-11  no frontend synthesis of scheduler/freshness/runtime mode
HA-12  static device/gateway/pilot/execution nonclaims preserved
HA-13  slot and clock use server timestamps
HA-14  Evidence freshness uses authoritative verdict
HA-15  future Evidence exclusions visible
HA-16  late/out-of-order Evidence visible
HA-17  missed slot/backfill/recovery visible when authorized
HA-18  Forecast and Scenario eligibility boundaries preserved
HA-19  no Recommendation/Approval/AO-ACT/Dispatch affordance
HA-20  technical refs use progressive disclosure
HA-21  target-state prototype is labelled non-runtime sample
HA-22  prototype uses one frozen six-key sample Scope
HA-23  prototype does not claim repository implementation
HA-24  Chinese and English copy complete
HA-25  keyboard and focus acceptance pass
HA-26  reduced-motion acceptance pass
HA-27  1440/768/390 viewport acceptance pass
HA-28  no horizontal page overflow
HA-29  visual regression and bundle budget pass
HA-30  exact frontend Candidate tree equals accepted merge tree
```

---

## 13. 完成声明

只有 S9 exact frontend authority 成立后，允许声明：

```text
PFE_14_SHADOW_ONLINE_OPERATOR_READ_SURFACE_COMPLETE
```

该声明只表示：

```text
one governed Stage 1B Scope has a read-only, traceable, regression-ready Operator product surface
```

不表示：

```text
MCFT-CAP-09 complete
Minimum Complete Field Twin complete
production launch
commercial launch
live device deployment
production gateway
field pilot
controlled action
```

---

## 14. 当前状态与第一合法动作

```text
S0: EFFECTIVE
S1: EFFECTIVE
S2: EFFECTIVE
S3: EFFECTIVE
S4: BLOCKED
```

阻塞原因：

```text
MCFT-CAP-09 Scheduler Summary read contract absent
MCFT-CAP-09 Evidence Availability read contract absent
background scheduler authority absent
```

当前第一合法动作：

```text
MCFT_CAP_09_PROVIDE_AUTHORIZED_SCHEDULER_AND_EVIDENCE_AVAILABILITY_READ_CONTRACT
```

合同成立后，前端下一动作：

```text
PFE_14_S4_SINGLE_SCOPE_RUNTIME_OVERVIEW_AUTHORIZATION
```
