# Route Dependency Guard（Compatibility / Legacy 依赖阻新增）

## 目标

将“禁止新增 compatibility / legacy route 依赖”从文档约束升级为可执行规则，保证新 PR 能被机器自动拦截。

## 检查入口

- 本地/CI统一命令：`pnpm run ci:route-dependency-guard`
- Server 标准检查入口（透传到同一脚本）：`pnpm --filter @geox/server check:route-dependency-guard`
- CI 接入：`.github/workflows/ci.yml` 的 `build-test` 作业已执行该命令。

## 检查范围

脚本：`scripts/check_route_dependency_guard.cjs`

扫描路径：

- `apps/web/src/**`
- `apps/server/src/**`
- `apps/server/scripts/**`

## 禁止新增依赖的接口

- `/api/telemetry/v1/query`
- `/api/v1/telemetry/latest`
- `/api/v1/telemetry/series`
- `/api/v1/telemetry/metrics`
- `/api/control/ao_act/task`
- `/api/control/ao_act/receipt`
- `/api/control/ao_act/index`

## 阻新增策略（基线冻结）

当前规则仅检查 **与 diff base 相比新增的代码行**（`git diff <base>...HEAD` 中的 `+` 行）：

- 新增依赖：直接失败。
- 历史存量：本轮不强制清零，可保留在基线内。

这保证“先阻新增，再渐进迁移”，避免一次性炸全仓。

## 白名单（允许暂存 compatibility 调用）

> 仅允许用于兼容层/迁移层自身，不可扩散到新业务流。

1. `apps/server/src/routes/legacy/**`
   - 原因：legacy 路由自身实现与回放逻辑需要保留历史协议。
   - 迁移责任：Server/Controlplane 路由维护者。
2. `apps/server/src/routes/v1/*compat*`
   - 原因：显式兼容入口（仅为过渡期适配）。
   - 迁移责任：对应 v1 主入口 owner（按模块归属）。
3. `apps/server/src/routes/**/*(legacy|compat|compatibility|migration)*.ts`
   - 原因：显式迁移/兼容 adapter 文件。
   - 迁移责任：发起迁移的 feature owner + server reviewer。

## 失败输出（示例）

```text
[route-dependency-guard] 检查失败：发现新增 compatibility/legacy route 依赖。
apps/web/src/pages/demo.tsx:42 新增依赖 /api/v1/telemetry/latest
该接口属于 Compatibility API
新流应改为依赖 /api/v1/operations/* 或 operation_state 主链 read model
```

## Successor 指引

- telemetry compatibility 接口：优先改为 `/api/v1/operations/*` 或 `operation_state` 主链 read model。
- AO-ACT control compatibility 接口：优先改为 `/api/v1/actions/*` + `operation_state` 主链 read model。
