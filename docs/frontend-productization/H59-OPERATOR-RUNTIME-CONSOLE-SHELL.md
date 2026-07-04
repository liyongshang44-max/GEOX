<!-- docs/frontend-productization/H59-OPERATOR-RUNTIME-CONSOLE-SHELL.md -->
# H59 Operator Runtime Console Shell
# H59 操作员运行控制台壳层

Status: H59 IMPLEMENTATION CONTRACT  
Language: zh-CN  
Scope: Frontend Productization / Operator Runtime Console Shell  
Repo basis: H58.0 Frontend Productization Plan merged by PR #2246  
Write impact: NONE  
Backend impact: NONE  
Seed impact: NONE  
DB impact: NONE  
Runtime route impact: NONE  

---

## 0. 目的

H59 将当前 Operator shell 从研究阶段的 Operator Twin shell 收口为正式产品壳层：

```text
GEOX Operator Runtime Console
操作员运行控制台
```

H59 只改 shell 叙事、主导航、只读边界和 replay/live nonclaim 展示。

H59 不重写页面、不新增正式 route、不删除旧 route、不改变 backend contract。

---

## 1. 上游基线

H59 必须继承 H58 已冻结内容：

```text
Operator Runtime Console
Customer Portal
Admin Console
```

Operator 一级导航冻结为：

```text
Overview
Fields
Evidence
Forecast
Calibration
Health
Pilot
Settings
```

Field Runtime 链路冻结为：

```text
Evidence → State → Forecast → Residual → Calibration → Health → Pilot
```

Replay/live nonclaim 必须显式展示：

```text
Runtime Mode: Replay-backed Demo
Live Device: Not connected
Production Gateway: Not online
Field Pilot: Not started
AO-ACT Dispatch: Disabled
```

---

## 2. H59 允许改动

H59 允许改动：

```text
apps/web/src/layouts/OperatorLayout.tsx
apps/web/src/styles/operatorShell.css
scripts/frontend_acceptance/ACCEPTANCE_H59_OPERATOR_RUNTIME_CONSOLE_SHELL_V1.cjs
docs/frontend-productization/H59-OPERATOR-RUNTIME-CONSOLE-SHELL.md
```

H59 可以新增 reusable component / helper / view model：

```text
apps/web/src/features/operator/runtimeConsole/*
```

但 H59 不允许新增 Page、Route、Shell。

---

## 3. H59 禁止事项

H59 不得：

```text
改 App.tsx route topology
新增 /operator/health
新增 /operator/pilot
新增 /operator/fields
新增 /app/operator/* broad wildcard
删除 /operator/twin/*
删除 /operator/twin/gateway-demo
打开 AO-ACT
打开 dispatch
写 ROI
写 Field Memory
改 backend
改 DB
改 facts writer
```

---

## 4. Shell 产品表达

H59 后，Operator shell 应显示：

```text
GEOX Operator Runtime Console
操作员运行控制台
```

H59 后，以下表达不得作为正式导航出现：

```text
Twin 总览
Gateway Demo
Operator Workbench
Approvals
Dispatch
Acceptance
ROI Ledger
Field Memory
Judge Config
Sim Config
Dev Tools
Admin Acceptance
```

注意：旧 route 可以保留，旧页面也可以继续通过 URL 可达。H59 只是把它们从正式产品导航中移除。

---

## 5. H59 导航状态

H59 的正式导航必须存在：

| Item | H59 状态 | 说明 |
| --- | --- | --- |
| Overview | enabled | 指向当前 preserved `/operator/twin`。 |
| Fields | route-preserved / disabled | Field Runtime route 不在 H59 新增。 |
| Evidence | coming-soon / disabled | Evidence Center route 不在 H59 新增。 |
| Forecast | coming-soon / disabled | Forecast 是后续 Field Runtime tab，不是 recommendation。 |
| Calibration | coming-soon / disabled | Calibration 后续进入 Field Runtime tab；不写 model update。 |
| Health | coming-soon / disabled | H62 才建立 Runtime Health product surface。 |
| Pilot | coming-soon / disabled | H63 才建立 Pilot Readiness product surface。 |
| Settings | coming-soon / disabled | H59 只冻结导航 slot，不新增 route。 |

H59 不得为了导航完整而新增 route。

---

## 6. Runtime nonclaim banner

H59 shell 必须在主内容顶部展示 runtime mode / live-device nonclaims。

最低字段：

```text
Runtime Mode: Replay-backed Demo
Live Device: Not connected
Production Gateway: Not online
Field Pilot: Not started
AO-ACT Dispatch: Disabled
```

这些字段必须是产品界面可见信息，不得只放在 audit drawer、注释或测试脚本中。

### 6.1 Banner CSS 要求

H59 必须为 runtime mode banner 提供专用 CSS：

```text
.operatorRuntimeModeBanner
.operatorRuntimeModeBanner strong
```

CSS 要求：

```text
横向/换行稳定展示五个 nonclaim
视觉上区别于 sidebar meta
不使用红黄绿风险语义
不暗示 live production
不影响 Customer/Admin shell
```

---

## 7. Legacy route 保留

H59 必须保留旧 route 字符串和路由行为：

```text
/operator/twin
/operator/twin/production-workflow
/operator/twin/gateway-demo
/operator/twin/fields/:fieldId
/operator/twin/fields/:fieldId/forecast
/operator/twin/fields/:fieldId/scenarios
/operator/twin/fields/:fieldId/evidence
/operator/twin/fields/:fieldId/calibration
/operator/twin/fields/:fieldId/post-irrigation
```

H59 不得新增 broad route：

```text
/app/operator/*
```

---

## 8. Changed-file allowlist

H59 PR 只允许改动：

```text
apps/web/src/layouts/OperatorLayout.tsx
apps/web/src/styles/operatorShell.css
docs/frontend-productization/H59-OPERATOR-RUNTIME-CONSOLE-SHELL.md
scripts/frontend_acceptance/ACCEPTANCE_H59_OPERATOR_RUNTIME_CONSOLE_SHELL_V1.cjs
apps/web/src/features/operator/runtimeConsole/*
```

若 PR diff 中出现其他文件，必须先拆 PR 或重新定义任务边界。

---

## 9. 验收

必跑：

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H58_FRONTEND_PRODUCTIZATION_PLAN_V1.cjs
node scripts/frontend_acceptance/ACCEPTANCE_H59_OPERATOR_RUNTIME_CONSOLE_SHELL_V1.cjs
pnpm run typecheck:web
```

H59 acceptance 范围：

```text
static repo read only
git diff metadata read only
no app startup
no API call
no DB call
no facts write
no backend write
no route deletion
no source mutation
```

---

## 10. 完成定义

H59 完成只表示：

```text
Operator shell 已经从 Operator Twin shell 改为 Operator Runtime Console shell
正式导航已经出现
未实现导航项使用 disabled / coming-soon / route-preserved
Runtime nonclaim banner 已经进入 shell
Runtime nonclaim banner 已有专用 CSS
H59 changed-file allowlist 已进入 acceptance
旧 operator twin route 保持可达
未新增 broad /app/operator/* wildcard
未打开任何写入口
```

H59 不表示：

```text
Field Runtime 已完成
Runtime Health 页面已完成
Pilot Readiness 页面已完成
Customer Portal cleanup 已完成
Admin Console cleanup 已完成
live device 已接入
production gateway 已在线
field pilot 已开始
```
