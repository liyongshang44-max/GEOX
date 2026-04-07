# Fertility Precheck 发布门禁清单

> 适用范围：`fertility_precheck_e2e.test.ts` 回归矩阵（dry / high salinity / normal wait-fertilize / observation missing）。

## Gate 1：回归矩阵必须全绿（强制）

- 命令：`pnpm -C apps/server test:sensing:closed-loop`
- 判定标准：5 个场景全部通过，且无 flaky（同一 commit 连续执行至少 2 次结果一致）。
- 任一失败：**禁止上线**。

## Gate 2：每个场景固定断言必须一致（强制）

每个场景都必须同时覆盖并通过以下三层断言：

1. Derived state（`fertility_level` / `recommendation_bias` / `salinity_risk` / `confidence`）。
2. Field read model（同字段 + `computed_at_ts_ms` + `multisource_derived_state_merged`）。
3. Precheck action hint（`routedActionHints` 精确匹配）。

任一层断言漂移（新增、缺失、值变化）：**禁止上线**。

## Gate 3：可复现（Reproducible）（强制）

- 固定输入：每个场景固定 `source_ts_ms`、传感器值、期望输出。
- 固定执行命令：统一使用 Gate 1 命令，不允许临时改参数。
- 固定依赖版本：以 lockfile 为准，不允许未记录依赖漂移。

任一条件不满足：**禁止上线**。

## Gate 4：可比对（Comparable）（强制）

- 产出必须可与基线 commit 对比（同一测试命令、同一测试文件）。
- 对比维度至少包含：
  - 场景数量是否变化；
  - 各场景 `derived` / `field` / `precheck_action_hints` 是否变化；
  - 失败用例名称是否新增。

无法完成基线对比：**禁止上线**。

## Gate 5：可归档（Archivable）（强制）

- CI 需归档以下内容至少 30 天：
  - 测试原始日志（stdout/stderr）；
  - 测试报告（通过/失败统计）；
  - 对应 commit SHA 与执行时间戳。
- 建议将本门禁文档和测试日志链接写入发布单。

未归档或归档不可追溯：**禁止上线**。
