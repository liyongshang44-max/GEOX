# 发布前验收确认（2026-04-07）

## 验收结论（按口径）

| 验收项 | 结论 | 证据 |
|---|---|---|
| 感知闭环可跑通 | ⚠️ 代码侧阻塞项已修复，待基础设施就绪后复跑 | `node scripts/acceptance/ACCEPTANCE_MINIMAL_SENSING_E2E_V1.cjs` 已不再报 `MISSING_ENV:AO_ACT_TOKEN`，当前阻塞为 `ECONNREFUSED 127.0.0.1:5432`（本地数据库未启动） |
| 两条分流规则稳定生效 | ✅ 已通过 | `pnpm --filter @geox/server exec node --import tsx --test src/domain/controlplane/dispatch_decision_strategy.contract.test.ts`，3/3 用例通过（默认策略排序、租户/项目覆盖、执行器性能因子） |
| 前端状态可解释展示 | ✅ 已通过 | `apps/web/test/i18n_render.test.ts` 与 `apps/web/test/operation_detail_hook_order.test.ts` 共 6/6 用例通过 |

---

## 发布 checklist

### A. 必做（上线门禁）
- [x] 为最小闭环验收脚本增加默认 token 兜底（仍建议在 staging 显式注入 `AO_ACT_TOKEN`）。
- [x] 修复 server 侧 workspace 包导出一致性（`@geox/skill-registry` / `@geox/device-skills` 切换为 ESM 源码导出）。
- [x] 修复 `apps/web/test/i18n_render.test.ts` 中 `program.spatialSummary` / `program.trajectorySummary` 缺失翻译。
- [x] 修复 `apps/web/test/operation_detail_hook_order.test.ts` 与 `OperationDetailPage.tsx` hook 变量命名不一致问题。
- [ ] 重新执行以下门禁命令并全部通过：
  - [ ] `pnpm --filter @geox/server exec node --import tsx --test src/domain/controlplane/dispatch_decision_strategy.contract.test.ts`
  - [ ] `apps/server/node_modules/.bin/tsx --test apps/web/test/i18n_render.test.ts apps/web/test/operation_detail_hook_order.test.ts`
  - [ ] `node scripts/acceptance/ACCEPTANCE_MINIMAL_SENSING_E2E_V1.cjs`

### B. 建议（发布质量）
- [x] 在发布说明中声明“分流策略合同测试已通过，感知闭环待环境补齐后二次确认”。
- [ ] 增加一条针对“前端状态解释文案完整性”的 CI（防止键名回退为原 key）。
- [ ] 增加一条针对 `OperationDetailPage` 的结构化测试（AST 或快照）替代字符串匹配，降低脆弱性。

---

## 回滚策略

### 1) 应用层快速回滚（推荐）
- 保留当前发布前 commit SHA（记为 `PREV_SHA`）。
- 若发布后出现状态展示异常或分流异常：
  1. 立即回滚到 `PREV_SHA`。
  2. 对外仅保留“已验证通过”的分流策略版本。
  3. 关闭新增 UI 文案开关（若已接入 feature flag，则退回 stable 文案集）。

### 2) 配置层回滚（低风险）
- 将 dispatch 策略配置回滚至默认组合（不启用 tenant/project 覆写）。
- 暂停依赖未完成翻译键的新前端视图入口，避免用户看到原始 key。

### 3) 数据与运行态兜底
- 感知链路异常时，维持只读可观测模式：禁止自动下发，仅保留告警与人工确认路径。
- 记录回滚窗口内的异常 operation_id，发布后补偿重放。

---

## 已知风险列表

1. **闭环验收基础设施依赖风险（高）**
   - 最小闭环脚本当前主要依赖数据库与本地服务可达性；若 `127.0.0.1:5432` 不可用将无法完成端到端确认。

2. **包导出漂移风险（中）**
   - 本次已修复导出路径与 ESM 语义；后续新增包仍需统一导出规范，防止再次出现运行时导出差异。

3. **前端可解释性回归风险（低）**
   - 当前 6/6 用例通过；后续页面重构仍可能触发基于源码字符串匹配的脆弱断言。

4. **测试脆弱性风险（中）**
   - 部分前端测试基于源码字符串匹配，对重构非常敏感，容易出现“功能正常但测试失败”或“测试误判”。
