# Sensing 回归矩阵与发布开关（2026-04-07）

## 1) 回归矩阵（必须全量覆盖）

> 目标：覆盖 observation、有无盐风险、多设备同 field 冲突 三个核心维度。

| Case ID | Observation | 盐风险 | 多设备同 field 冲突 | 预期 recommendation_bias | 预期 precheck | 预期页面行为 |
|---|---|---|---|---|---|---|
| RM-01 | 有 | 低 | 否 | `irrigate_first` 或 `wait/fertilize`（按湿度） | 可命中/可为空（按规则） | 正常展示 read model v1 |
| RM-02 | 有 | 高 | 否 | `inspect` 优先 | 应命中 `inspect` | 正常展示 read model v1 |
| RM-03 | 无 | N/A | 否 | `inspect`（NO_DEVICE_OBSERVATION） | 不强制命中 | 页面允许 fallback（不崩溃） |
| RM-04 | 有 | 低 | 是 | 不因冲突崩溃；结果可回退到保守建议 | precheck 可关闭验证 | 页面 fallback 可用 |
| RM-05 | 有 | 高 | 是 | `inspect` 保守优先 | precheck 命中或被开关关闭 | 页面 fallback 可用 |
| RM-06 | 无 | N/A | 是 | `inspect`（保守） | precheck 可关闭验证 | 页面 fallback 可用 |

### 建议最小执行方式

- 先跑 RM-01 / RM-02 验证正向路径。
- 再跑 RM-03 验证无 observation 容错。
- 最后跑 RM-04~RM-06 验证冲突与 fallback 兜底。

---

## 2) 发布开关（补齐）

### 2.1 read model 新旧切换（前端）

- `VITE_ENABLE_FIELD_READ_MODEL_V1`
  - `1`（默认）：启用新 read model 解析。
  - `0`：关闭新 read model 展示，页面退回旧路径。

### 2.2 precheck 规则开关（后端）

- `GEOX_ENABLE_RECOMMENDATION_PRECHECK_V1`
  - `1`（默认）：`/api/v1/recommendations/generate` 按 `field_fertility_state_v1` 注入 precheck 约束。
  - `0`：关闭 recommendation precheck 约束注入。

- `GEOX_ENABLE_AO_ACT_PRECHECK_V1`
  - `1`（默认）：`/api/control/ao_act/tasks` 执行 AO-ACT precheck。
  - `0`：关闭 AO-ACT precheck，返回空 precheck 结果（不阻断主链路）。

### 2.3 页面 fallback 开关（前端）

- `VITE_ENABLE_FIELD_READ_MODEL_LEGACY_FALLBACK`
  - `1`：read model 字段缺失时允许 legacy fallback。
  - `0`（默认）：严格按 v1 字段显示。

- `VITE_ENABLE_LEGACY_AGRONOMY_FALLBACK`
  - `1`（默认）：control-plane API 失败时允许 agronomy 页面退回 legacy API。
  - `0`：禁用页面 fallback，用于强一致压测。

---

## 3) 发布建议（顺序）

1. 先开 read model v1 + 保留页面 fallback。
2. 灰度打开 recommendation precheck，再观察 RM-02 / RM-05 命中率。
3. 最后打开 AO-ACT precheck；稳定后再逐步收紧 fallback。
