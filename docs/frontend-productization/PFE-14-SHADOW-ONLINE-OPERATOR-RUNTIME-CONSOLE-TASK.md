<!-- docs/frontend-productization/PFE-14-SHADOW-ONLINE-OPERATOR-RUNTIME-CONSOLE-TASK.md -->
# PFE-14 Shadow-Online Operator Runtime Console Promotion
# PFE-14 Shadow-Online 操作员运行控制台升级任务书

Status: PFE-14 COMPLETE TASKBOOK v0.1  
Language: zh-CN  
Product line: PFE  
Target surface: Operator Runtime Console  
Runtime dependency: MCFT-CAP-09 Shadow-Online Promotion  
Target mode: SHADOW_ONLINE_READ_ONLY  
Write impact: NONE by default  
Backend impact: NONE in this task line  
Database impact: NONE in this task line  
Controlled action impact: NONE  
Production launch: NOT CLAIMED  
Commercial launch: NOT CLAIMED  

---

## 0. 文档定位

PFE-14 是 PFE-13 Frontend Product v1 Freeze 之后的正式前端能力线。

PFE-13 已冻结 Formal Product Frontend v1，并规定：

```text
route change       -> new phase required
capability change  -> new phase required
visual change      -> regression evidence required
copy change        -> i18n evidence required
bundle change      -> budget evidence required
```

因此，MCFT-CAP-09 的 Shadow-online Runtime 能力不得通过普通页面修改、零散 CSS 修复或 legacy Operator Twin 页面扩展进入产品前端。PFE-14 负责建立独立、受治理、可验收、可回归的 Shadow-online Operator Runtime Console 前端升级线。

本任务书只授权任务线设计和后续分片治理。它本身不授权 Runtime 实现、后端写入、数据库迁移、自动控制、AO-ACT、Dispatch、Model Activation 或生产上线。

---

## 1. 权威前驱

### 1.1 前端前驱

```text
PFE-13 Frontend Product v1 Freeze
manifest:
docs/frontend-productization/PFE-13-FREEZE-MANIFEST.json
```

必须继承：

```text
frozen                         true
productionLaunch               false
commercialLaunch               false
liveDeviceConnected            false
productionGatewayOnline        false
fieldPilotStarted              false
aoActDispatchEnabled           false
```

### 1.2 Runtime 前驱

```text
MCFT-CAP-09 Shadow-Online Promotion
current authority:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json
```

任务书建立时，MCFT-CAP-09 的受信 authority 为：

```text
status                         PRE_CANDIDATE_GOVERNANCE_FOUNDATION
implementation_authorized      false
runtime_source_authorized      false
live_ingestion_authorized      false
background_scheduler_authorized false
canonical_write_authorized     false
candidate_declaration_authorized false
```

因此 PFE-14 可以立即推进仓库结算、前端数据契约、状态矩阵、视觉基础和现有 GET-only 页面重构；不得在 MCFT-CAP-09 正式读契约出现前硬编码或伪造 SHADOW_ONLINE、Scheduler、Backfill、Recovery、Evidence Freshness 等 Runtime 事实。

---

## 2. 产品目标

PFE-14 将当前：

```text
Replay-backed
GET-only
工程审查型 Field Runtime
```

升级为：

```text
Shadow-online capable
GET-only
面向操作员的持续运行观察界面
```

操作员必须能够回答：

1. 当前运行模式是 Replay 还是 Shadow-online。
2. 当前精确 tenant/project/group/field/season/zone 范围是什么。
3. 最近一个 UTC 调度时隙是否完成。
4. 下一个调度时隙何时到来。
5. Evidence 是否新鲜、完整并满足运行资格。
6. 是否存在漏跑、补跑、重启恢复或陈旧数据降级。
7. 当前 State 和 Forecast 是什么。
8. Forecast 是否具备 Scenario 来源资格。
9. Runtime 为什么处于等待、运行、完成、受限、补跑、恢复或阻塞状态。
10. 页面结论能否追溯到 canonical object、Evidence、Timeline 和 Trace。

---

## 3. 非目标与禁止声明

PFE-14 不建立：

```text
automatic recommendation
automatic approval
AO-ACT creation
dispatch
device control
model activation
production gateway
production launch
commercial launch
customer report generation
ROI mutation
Field Memory mutation
```

PFE-14 完成不得被解释为：

```text
MCFT-CAP-09 complete
Minimum Complete Field Twin complete
live production established
real field pilot started
controlled action enabled
```

---

## 4. 仓库事实基线

### 4.1 三端产品边界

正式产品前端继续分为：

```text
Operator Runtime Console
Customer Portal
Admin Console
```

PFE-14 只修改 Operator Runtime Console。

不得把 Scheduler、lease、fencing、canonical object、raw Evidence、Trace 和 Runtime degradation 等内部对象泄露到 Customer Portal。数据库治理、配置、导入、权限和后台管理仍属于 Admin Console。

### 4.2 当前正式 Operator route family

PFE-14 必须复用当前 canonical route family：

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
/operator/pilot
```

禁止新增第二套 Shadow route family：

```text
/operator/shadow/*
/operator/mcft9/*
/app/operator/shadow/*
```

### 4.3 精确范围

所有正式 Runtime 读取必须保留六键：

```text
tenant_id
project_id
group_id
field_id
season_id
zone_id
```

不得降级为仅 field_id，也不得使用 UI 默认值补写缺失范围。

### 4.4 单一真相来源

正式 PFE-14 页面只允许读取 canonical Runtime API。

禁止：

```text
legacy API truth fallback
frontend fixture truth fallback
frontend computed scheduler slot
frontend computed freshness verdict
frontend inferred Runtime mode
frontend inferred production status
frontend synthesized canonical object
```

---

## 5. 当前仓库问题与治理要求

### 5.1 双实现并存

仓库中同时存在：

```text
legacy Operator Twin / Field Twin pages
PFE-era FieldRuntime ViewModel/adapters
MCFT canonical Field Runtime route page
```

PFE-14 必须冻结 canonical owner：

```text
apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx
apps/web/src/api/mcftFieldTwinRuntime.ts
apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
```

其他页面只能被分类为：

```text
LEGACY_VISIBLE_BY_URL_ONLY
MIGRATION_SOURCE
DELETE_CANDIDATE_AFTER_ACCEPTANCE
```

### 5.2 Runtime mode 硬编码

现有 UI 中的 Replay-backed、not connected、not online、not started 和 disabled nonclaim 不能永久硬编码。

PFE-14 必须从受治理读契约读取：

```text
runtime_mode
runtime_stage
live_device_status
production_gateway_status
scheduler_status
controlled_execution_status
```

### 5.3 演示范围常量

正式 Shadow-online 页面不得默认绑定：

```text
field_c8_demo
season_2026_c8_corn
zone_mcft_c8_water_001
```

演示值只能在明确的 demo profile 中出现，不得成为 production-like 默认范围。

### 5.4 Route inventory 偏差

PFE-13 route inventory 与后续 canonical route code 之间存在 action-lifecycle、evidence-trace 等演进差异。

PFE-14 S0 必须重新建立 route ownership inventory，并明确：

```text
FORMAL
ALIAS
LEGACY_URL_ONLY
MIGRATION_SOURCE
NOT_AUTHORIZED
```

### 5.5 视觉系统分裂

当前仓库同时存在：

```text
APPLE_UI_GUIDELINES
Product Design System v1
operatorShell.css
operatorFieldRuntime.css
legacy operator CSS
```

PFE-14 必须建立 Operator-scoped Apple-inspired visual convergence，不得继续增加第四套页面级样式体系。

---

## 6. 信息架构

### 6.1 Operator 一级导航

目标导航：

```text
总览
地块
证据
运行健康
试点
设置
```

规则：

- Forecast 保留为 Field Runtime tab，不作为一级入口。
- Calibration 保留为 Field Runtime tab，不作为一级入口。
- Evidence 只有在全局 Evidence read contract 存在时启用；否则隐藏，不显示无效 coming-soon 项。
- Health 只有在 console-level aggregation contract 存在时作为一级入口；否则由 Field Runtime Health tab 承担。
- Settings 必须有真实页面后才启用。
- 不允许通过一排 disabled 导航模拟产品完整度。

### 6.2 Field Runtime tabs

完整能力：

```text
总览
证据
状态
预测
情景
行动生命周期
残差验证
校准
运行健康
审计
```

默认主标签：

```text
总览 / 证据 / 状态 / 预测 / 运行健康 / 审计
```

低频能力进入“更多”菜单或二级 segmented control：

```text
情景 / 行动生命周期 / 残差验证 / 校准
```

---

## 7. 页面任务

### 7.1 Runtime Overview

路由：

```text
/operator/twin
```

首屏回答：

```text
当前模式
最近运行
下一时隙
Evidence 新鲜度
需要关注的运行事件
```

页面结构：

```text
Runtime Context Header
Current Runtime Summary
24-hour Scheduler Strip
Governed Field Runtimes
Recent Runtime Events
Nonclaim Boundary
```

首屏禁止突出：

```text
lease token
object hash
source fact ref
response instance hash
```

技术字段进入 progressive disclosure。

### 7.2 Scope Navigator

路由：

```text
/operator/fields
```

流程：

```text
地块 -> 季节 -> 管理分区 -> 打开 Runtime
```

必须显示：

```text
field name
runtime mode
latest tick
Evidence freshness
Runtime establishment status
missing scope keys
```

没有权威 zone-list API 时，可以保留 zone_id 显式输入，但必须显示“未发现权威分区目录”，不得猜测生产 zone。

### 7.3 Field Runtime Header

固定显示：

```text
Field name
Season
Zone
Runtime mode
Last completed slot
Last Evidence time
Read-only
```

只允许：

```text
刷新
复制范围链接
打开技术详情
```

### 7.4 Evidence

必须展示：

```text
eligible boundary
observed_at
ingested_at
coverage
maximum gap
freshness
future-excluded Evidence
late Evidence
out-of-order Evidence
missing sources
```

Freshness 必须显示：

```text
latest Evidence time
server response time
age
threshold
verdict source
```

### 7.5 State

默认展示：

```text
state label
value
unit
confidence class
Evidence count
estimate time
```

技术对象进入展开层：

```text
state_id
object_hash
source_fact_ref
assimilation_update
posterior_state
```

### 7.6 Forecast

必须展示：

```text
forecast status
horizon
generated_at
source state
Evidence cutoff
scenario eligibility
blocked reason
```

必须显示：

```text
Forecast != Fact
Forecast != Recommendation
Forecast != Action
```

### 7.7 Runtime Health

必须展示：

```text
current scheduler slot
latest completed slot
next target slot
persistent cursor
scheduler lag
missed slot count
backfill state
restart recovery state
Evidence freshness
degradation reason
lease state
fencing state
```

首屏：

```text
运行状态
最近时隙
下一时隙
Evidence 新鲜度
待补跑数量
```

第二层：

```text
24-hour slot strip
restart/recovery timeline
backfill queue
stale/missing-data events
```

第三层技术详情：

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

### 7.8 Audit

保留：

```text
canonical refs
object types
object hashes
source facts
response hashes
Trace nodes
Timeline events
validation summaries
limitations
```

默认折叠，不得将长 hash 作为主标题。

---

## 8. Apple-inspired 视觉系统

PFE-14 使用 Apple 式产品原则，不复制 Apple 品牌、商标、专有资产或字体文件。

### 8.1 原则

```text
Clarity     信息层级清楚
Deference   界面让位于数据
Depth       使用层次而非重边框堆叠
Continuity  状态变化连续但克制
```

### 8.2 字体

系统字体栈：

```css
-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif
```

正式 Operator surface 只允许：

```text
400 regular
500 medium
600 semibold
```

禁止 750/800/850/900。

### 8.3 色彩

基础方向：

```text
page background      #F5F5F7
primary panel        translucent/white
primary text         #1D1D1F
secondary text       #6E6E73
separator            rgba(60,60,67,0.16)
GEOX accent          restrained deep green
```

GEOX green 只用于：

```text
selected state
link
focus
scope identity
```

状态不能只依赖颜色。

### 8.4 圆角与阴影

```text
main container radius   20px
card radius             16px
control radius          10-12px
pill                    only for true short status
```

阴影：

```text
default panel  0 1px 2px rgba(0,0,0,0.04)
overlay        0 8px 24px rgba(0,0,0,0.08)
```

### 8.5 信息密度

默认视图：

```text
meaning
time
status
source summary
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

### 8.6 动效

允许：

```text
hover
focus
tab transition
drawer
details expand
refresh state
```

时长：

```text
fast    160ms
normal  220ms
```

必须支持 prefers-reduced-motion。

禁止持续脉冲、闪烁、自动滚动、常驻旋转和无意义数字跳动。

---

## 9. 最小前端读契约

PFE-14 不允许通过已有对象自行拼装 Shadow-online 结论。

MCFT-CAP-09 或其正式只读投影至少需要提供：

```text
runtime_mode
runtime_stage
request_scope
latest_completed_slot
latest_tick_ref
latest_tick_status
latest_tick_started_at
latest_tick_completed_at
next_target_slot
next_target_at
scheduler_lag_ms
persistent_cursor_ref
cursor_slot
lease_status
lease_owner
fencing_token
missed_slot_count
backfill_status
backfill_queue_depth
oldest_backfill_slot
restart_detected
recovery_status
recovered_checkpoint_ref
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
forecast_status
scenario_source_eligible
response_started_at
response_instance_hash
```

服务端应同时提供或冻结：

```text
refresh_after_seconds
cache_control
response_started_at
```

前端不得用 1 秒轮询制造实时感。

---

## 10. 状态矩阵

所有正式页面必须处理：

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

404 MCFT_RUNTIME_NOT_ESTABLISHED 不得显示为普通空列表。

---

## 11. 实施切片

### S0 Post-freeze Authority and Repository Reconciliation

交付：

```text
Taskbook
Current Authority
Route Ownership Inventory
MCFT-09 Dependency Map
Changed-file Boundary
Static Acceptance
```

S0 不修改 React、CSS、route、API client、backend、database、package 或 workflow。

### S1 Frontend Read Contract and State Matrix

交付：

```text
Shadow-online ViewModel contract
API field source map
state matrix
copy/nonclaim contract
forbidden inference rules
```

不声称后端已实现缺失字段。

### S2 Apple Visual Foundation

交付：

```text
Operator visual tokens v2
font/radius/shadow/spacing convergence
status primitives
technical detail disclosure
segmented navigation
drawer/details patterns
reduced-motion baseline
```

视觉 fixture 只能用于组件开发，不能进入 formal Runtime truth path。

### S3 Operator Shell Consolidation

交付：

```text
valid navigation only
dynamic Runtime context slot
single nonclaim context area
Operator-owned styles
legacy navigation removal
```

### S4 Scope and Runtime Overview

交付：

```text
exact scope navigator
Runtime overview
latest/next slot
Evidence freshness
24-hour scheduler strip
```

依赖 MCFT-09 Scheduler/Evidence read contract。

### S5 Field Runtime Core Promotion

交付：

```text
Evidence
State
Forecast
Scenario eligibility
```

依赖 MCFT-09 formal State/Forecast readback。

### S6 Scheduler and Health Product Surface

交付：

```text
cursor
lease
fencing
missed slot
backfill
restart
stale/degraded health
```

依赖 MCFT-09 S3/S4 read models。

### S7 Trace and Qualification Readback

交付：

```text
O00-O23 slot history
runtime event timeline
Trace
exact Evidence links
```

依赖 MCFT-09 controlled run evidence。

### S8 Product Quality Closure

交付：

```text
i18n
accessibility
responsive
state coverage
visual regression
bundle budget
```

### S9 Candidate and Exact Frontend Freeze

交付：

```text
exact Candidate tree
accepted merge-tree equality
route inventory freeze
visual approval
handoff
```

---

## 12. Changed-file 原则

PFE-14 可能涉及：

```text
apps/web/src/layouts/OperatorLayout.tsx
apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
apps/web/src/features/operator/fieldRuntime/*
apps/web/src/api/mcftFieldTwinRuntime.ts
apps/web/src/design-system/product/*
apps/web/src/styles/operatorShell.css
apps/web/src/styles/operatorFieldRuntime.css
apps/web/src/styles/productDesignSystem.css
apps/web/src/lib/productSurfaceLabels.ts
scripts/frontend_acceptance/ACCEPTANCE_PFE_14_*.cjs
docs/frontend-productization/PFE-14-*
```

每个 Slice 必须进一步收窄 allowlist。

默认禁止：

```text
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
Customer pages
Admin pages
facts writers
AO-ACT routes
package dependencies
pnpm lockfile
```

后端契约必须由 MCFT-CAP-09 自己的 capability line 交付，不得混入 PFE-14 PR。

---

## 13. Hard Acceptance

```text
HA-01  PFE-13 predecessor freeze consumed
HA-02  MCFT-09 exact read authority explicitly bound
HA-03  canonical route owner unique
HA-04  no duplicate Shadow route family
HA-05  exact six-key scope preserved
HA-06  all formal requests GET-only
HA-07  zero POST/PUT/PATCH/DELETE dependency
HA-08  Runtime mode is not hardcoded
HA-09  Shadow-online label only appears from authority
HA-10  no fixture or frontend synthesis in formal mode
HA-11  scheduler slot and clock use server timestamps
HA-12  Evidence freshness uses authoritative threshold
HA-13  future Evidence exclusions visible
HA-14  late/out-of-order Evidence visible
HA-15  missed slot and ordered backfill visible
HA-16  restart and recovery visible
HA-17  stale/missing-data degradation explicit
HA-18  Forecast and Scenario eligibility boundaries preserved
HA-19  no Recommendation/Approval/AO-ACT/Dispatch affordance
HA-20  technical refs use progressive disclosure
HA-21  Chinese and English copy complete
HA-22  keyboard and focus acceptance pass
HA-23  reduced-motion acceptance pass
HA-24  1440/768/390 viewport acceptance pass
HA-25  no horizontal page overflow
HA-26  loading/empty/error/degraded/backfill/recovered states covered
HA-27  visual regression evidence produced
HA-28  bundle budget passes
HA-29  typecheck and web build pass
HA-30  exact frontend Candidate tree equals accepted merge tree
```

---

## 14. 完成声明

只有 S9 exact frontend authority 成立后，允许声明：

```text
PFE_14_SHADOW_ONLINE_OPERATOR_READ_SURFACE_COMPLETE
```

该声明只表示：

```text
Shadow-online Runtime has a governed, read-only, traceable and regression-ready Operator product surface.
```

它不自动表示任何 Runtime、生产、商业化或受控执行完成声明。

---

## 15. 当前第一合法动作

```text
PFE_14_S0_POST_FREEZE_AUTHORITY_AND_REPOSITORY_RECONCILIATION
```

顺序：

1. 落库本任务书。
2. 建立 PFE-14 Current Authority。
3. 结算 route ownership 与双实现。
4. 建立 MCFT-09 dependency map。
5. 冻结 S0 changed-file boundary。
6. 建立并运行 S0 静态验收。
7. 在 S0 effective 前保持 React Runtime claim delta 为零。
