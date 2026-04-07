# Fertility Precheck 发布门禁清单（团队统一引用）

> 适用范围：`apps/server/src/domain/sensing/fertility_precheck_e2e.test.ts` + `apps/server/src/domain/sensing/fertility_precheck_regression_matrix.md`。

## Gate 1：回归矩阵必须全绿（阻断）

- 执行命令：`pnpm -C apps/server test:sensing:closed-loop`
- 判定标准：4 个固定场景全部通过（dry / high salinity / normal / missing observation）。
- 阻断条件：任一场景失败，**必须阻断发布**。

## Gate 2：固定断言一致性（阻断）

每个场景都必须同时通过以下固定断言：

1. `derived state`：`fertility_level` / `recommendation_bias` / `salinity_risk` / `confidence`。
2. `field read model`：同字段 + `computed_at_ts_ms` + `multisource_derived_state_merged`。
3. `precheck hints`：`reason_code + action_hint` 精确匹配；`routedActionHints` 精确匹配。

- 阻断条件：任一字段值漂移、断言缺失或新增未评审断言，**必须阻断发布**。

## Gate 3：可复现性（阻断）

- 场景输入与 `source_ts_ms` 固定，不允许在发布前临时改值。
- 使用统一命令执行，不允许用替代脚本绕过。
- lockfile 与依赖版本保持一致。

- 阻断条件：出现不可复现结果（同 commit 重跑结果不一致）或执行方式不一致，**必须阻断发布**。

## Gate 4：基线可比对（阻断）

发布前必须对比最近一次通过基线（同一测试文件 + 同一命令），至少核对：

- 场景数量是否仍为 4；
- 三层断言是否有改动；
- 失败用例名称是否新增。

- 阻断条件：无法完成基线对比或存在未审批差异，**必须阻断发布**。

## Gate 5：归档与追溯（阻断）

CI/发布流程必须归档：

- 测试原始日志；
- 测试结果统计；
- 对应 commit SHA 与执行时间。

- 阻断条件：无法追溯到上述任一证据，**必须阻断发布**。

---

## 发布阻断清单（可复制到发布单）

以下任一项为「是」，则发布状态必须标记为 **BLOCKED**：

- [ ] 回归命令未通过或未执行。
- [ ] 4 个固定场景未全部覆盖。
- [ ] `derived state` 固定断言失败。
- [ ] `field read model` 固定断言失败。
- [ ] `precheck hints` 固定断言失败。
- [ ] 与基线差异未审批。
- [ ] 测试证据（日志/结果/SHA）缺失。
