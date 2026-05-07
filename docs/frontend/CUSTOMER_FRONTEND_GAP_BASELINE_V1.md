# CUSTOMER_FRONTEND_GAP_BASELINE_V1

> 目的：形成 A03 的 P0/P1/P2 缺口基线，避免把后续能力误当 P0 开发。

| 条目 | 当前状态 | P0 处理方式 | P1/P2 后续方式 | 禁止伪造项 |
|---|---|---|---|---|
| `/api/v1/customer/cockpit/overview` | P1，不依赖 | P0 不接入 | P1 再接入 cockpit 聚合能力 | 不得伪造 cockpit 总览数字 |
| `/api/v1/customer/fields/map` | P1，不依赖 | P0 不接入 | P1 接入地块地图能力 | 不得伪造地图结果 |
| `/api/v1/operations/:id/evidence-pack-summary` | P1，不依赖 | P0 不直连该接口 | P1 统一纳入 evidence-pack 聚合链路 | 不得伪造证据包摘要 |
| `/api/v1/weather/forecast` | P2，不依赖 | P0 不接入 | P2 引入天气预测能力 | 不得伪造天气数据 |
| `/customer/fields` | P1，不做 | P0 不新增路由 | P1 建字段列表页 | 不得在 P0 暴露该路由 |
| `/customer/operations` | P1，不做 | P0 不新增路由 | P1 建作业列表页 | 不得在 P0 暴露该路由 |
| `/customer/reports` | P1，不做 | P0 不新增路由 | P1 建统一报告入口 | 不得在 P0 暴露该路由 |
| `/operator/*` | P1/P2，不做 | P0 不可访问 | P1/P2 在 operator 域实现 | 不得在 customer 端暴露 operator 能力 |
| 真实地图 / 卫星底图 | P2，不做 | P0 不做 | P2 接入真实地图服务 | 不得用静态假图冒充真实地图 |
| 天气卡 | P2，不做 | P0 不做 | P2 基于天气 API 实现 | 不得在 P0 伪造天气卡 |

## 验收标准

- `docs/frontend/CUSTOMER_FRONTEND_ROUTE_MAP_V1.md` 存在并含 Route Map 表格。
- `docs/frontend/CUSTOMER_DATA_SOURCE_MAP_V1.md` 存在并含 Data Source Map 表格。
- `docs/frontend/CUSTOMER_FRONTEND_GAP_BASELINE_V1.md` 存在并含 Gap Baseline 表格。
- 文档不得把 `/customer/fields`、`/customer/operations`、`/customer/reports` 写成 P0。
- 文档不得把 `/api/v1/customer/cockpit/overview` 写成当前可用接口。

## Boundary Exemptions (customer-boundary-allow)

> 所有豁免必须采用 `// customer-boundary-allow: <reason>` 格式，缺少 reason 视为失败。

当前基线豁免项（由 boundary 脚本输出同步）：

- 暂无。
