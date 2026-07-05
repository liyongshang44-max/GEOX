<!-- docs/frontend-productization/F1-B-SHELL-BILINGUAL-INTEGRATION.md -->
# F1-B Shell / Navigation Bilingual Integration

## Phase

F1-B Shell / Navigation Bilingual Integration follows F1-A Locale Infrastructure Hardening.

F1-B wires language selection into the three formal frontend shells and localizes shell-level copy.

## Purpose

F1-B makes the language toggle visible in Customer, Operator, and Admin formal shells.

F1-B localizes shell-level navigation, shell title/subtitle/lead, shell boundary copy, account scope copy, route policy copy, and Operator runtime nonclaims.

## Preconditions

F1-A must already provide:

```text
LocaleToggle
LocaleProvider / useLocale stable contract
localizedText helper
product surface label registry
F1-A locale infrastructure acceptance
```

## Allowed files

```text
apps/web/src/layouts/CustomerLayout.tsx
apps/web/src/layouts/OperatorLayout.tsx
apps/web/src/layouts/AdminLayout.tsx
apps/web/src/styles/customerShell.css
apps/web/src/styles/operatorShell.css
apps/web/src/styles/adminShell.css
apps/web/src/lib/productSurfaceLabels.ts
scripts/frontend_acceptance/ACCEPTANCE_F1_B_SHELL_BILINGUAL_INTEGRATION_V1.cjs
docs/frontend-productization/F1-B-SHELL-BILINGUAL-INTEGRATION.md
```

## Forbidden files

```text
apps/web/src/app/App.tsx
apps/web/src/app/routes/
apps/web/src/features/
apps/web/src/views/
apps/web/src/components/common/LocaleToggle.tsx
apps/web/src/lib/locale.tsx
apps/server/
migrations/
packages/contracts/
fixtures/
.github/
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

## Shell integration scope

F1-B covers:

```text
LocaleToggle placement
formal nav labels
shell title / subtitle / lead
shell boundary copy
runtime nonclaims
account scope copy
route policy copy
```

F1-B does not translate page-body copy.

## Customer shell bilingual scope

Customer shell integration covers:

```text
Dashboard
Fields
Operations
Reports
Export
Authorized scope pending
Reading access scope
Preview scope
Global preview
No authorized fields
Contact operations to enable access
Authorized scope confirmed
```

Chinese shell copy includes:

```text
经营总览
地块
作业
报告
导出
授权范围待确认
正在读取权限
预览范围
全域预览
暂无授权地块
请联系运营开通
授权范围已确认
```

## Operator shell bilingual scope

Operator shell integration covers:

```text
Overview
Fields
Evidence
Forecast
Calibration
Health
Pilot
Settings
Route active
Route preserved
Coming soon
Runtime Mode: Replay-backed Demo
Live Device: Not connected
Production Gateway: Not online
Field Pilot: Not started
Controlled Execution: Disabled
```

Chinese shell copy includes:

```text
总览
地块
证据
预测
校准
健康
试点
设置
路由可用
路由保留
即将开放
运行模式：回放支撑演示
实时设备：未连接
生产网关：未上线
田间试点：未开始
受控执行：已禁用
```

## Admin shell bilingual scope

Admin shell integration covers:

```text
Dashboard
Fields
Operations
Devices
Evidence
Runtime Health
Config
Internal governance surface
Read-only shell boundary
Formal navigation
Admin routes only
Route family
Surface mode
Governed readback
```

Chinese shell copy includes:

```text
总览
地块
作业
设备
证据
运行健康
配置
内部治理界面
只读 Shell 边界
正式导航
仅后台管理路由
路由族
界面模式
治理回查
```

## Nonclaim translation boundary

Runtime nonclaims must stay negative in both languages.

Allowed Operator nonclaims:

```text
Live Device: Not connected
Production Gateway: Not online
Field Pilot: Not started
Controlled Execution: Disabled
实时设备：未连接
生产网关：未上线
田间试点：未开始
受控执行：已禁用
```

## Formal nav pollution guard

Formal nav must not expose engineering phase names, fixtures, acceptance surfaces, debug surfaces, internal ledgers, or execution controls.

Admin URL-only compatibility routes must not enter formal nav.

Operator route-preserved or coming-soon slots may exist, but visible labels must remain product concepts.

## Acceptance

```text
node scripts/frontend_acceptance/ACCEPTANCE_F1_B_SHELL_BILINGUAL_INTEGRATION_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

Acceptance is static repo read-only. It does not start the app, call backend, call DB, write facts, or mutate source.

## Non-goals

F1-B does not translate full product pages.
F1-B does not translate Field Runtime tab content.
F1-B does not translate Replay Demo page-body copy.
F1-B does not translate Pilot Readiness page-body copy.
F1-B does not translate Customer report body.
F1-B does not translate Admin page body.
F1-B does not translate backend values.
F1-B does not translate raw evidence or identifiers.
F1-B does not change route topology.
F1-B does not change runtime semantics.
F1-B does not introduce package dependencies.

## Next phase

F1-B prepares F1-C Operator Formal Surface Bilingualization.

F1-C may cover Operator formal surface page-level copy beyond shell chrome.
