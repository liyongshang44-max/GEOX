# SKILL_VISUALIZATION_AND_EXPLAINABILITY_V1

> 版本：v1  
> 状态：落库文档（实现对齐）  
> 更新时间：2026-04-09

## 1. 目标与范围

本文档定义 GEOX Web 端在 **Skill 可视化** 与 **Explainability（可解释性）** 相关页面上的统一实现约束，覆盖以下页面与 API 适配层：

- `apps/web/src/features/dashboard/pages/CommercialDashboardPage.tsx`
- `apps/web/src/features/fields/pages/FieldDetailPage.tsx`
- `apps/web/src/features/operations/pages/OperationDetailPage.tsx`
- `apps/web/src/components/operations/OperationSkillTraceCard.tsx`
- `apps/web/src/features/programs/pages/AgronomyRecommendationsPage.tsx`
- `apps/web/src/api/*`（兼容映射集中层）

核心原则：

1. **页面层不做历史字段散点兜底**；
2. **兼容映射统一沉淀在 `apps/web/src/api/*`**；
3. “为什么推荐”等可解释区块必须读取规范路径，不在 UI 做多分支猜测。

---

## 2. Dashboard：Skill Runs 可视化

### 2.1 数据源

- 主数据源：`/api/v1/skill-runs`
- 兼容回退：`/api/v1/skills/runs`

由 `apps/web/src/api/skills.ts#listSkillRuns` 统一处理：

- 归一化字段：
  - `run_id`
  - `skill_id`
  - `status`
  - `started_ts_ms`
  - `finished_ts_ms`
  - `scope`

### 2.2 展示要求

在 Dashboard 的技能区块至少展示：

1. 成功运行统计（success）
2. 失败运行统计（failed/error/timeout）
3. 异常 skill 数（失败类状态按 `skill_id` 去重）
4. 最近 10 条 run

---

## 3. Field Detail：感知解释增强

### 3.1 展示字段

在感知解释卡（`field_sensing_overview_v1` 与 `field_fertility_state_v1`）中增加：

- `source_observation_ids`
- 来源设备（`source_devices`）

### 3.2 兼容策略

解析层在 `apps/web/src/lib/fieldReadModelV1.ts` 统一兼容以下字段别名：

- observation id：
  - `source_observation_ids_json`
  - `source_observation_ids`
- source devices：
  - `source_devices_json`
  - `source_devices`
  - `source_device_ids_json`
  - `source_device_ids`
  - `device_ids`

页面层仅使用标准化后的：

- `sensing.sourceObservationIds`
- `sensing.sourceDevices`
- `fertility.sourceObservationIds`
- `fertility.sourceDevices`

---

## 4. Operation Detail：skill_trace[] 时间线

### 4.1 统一数据结构

`apps/web/src/api/operations.ts` 将新旧结构统一为 `OperationSkillTraceItemV2[]`：

- `stage`
- `skill_id`
- `status`
- `explanation_codes`
- `run_id`（可选）
- `started_ts_ms` / `finished_ts_ms`（可选）

兼容输入：

- 新结构：`skill_trace[]`
- 旧结构：`legacy_skill_trace`

### 4.2 UI 渲染要求

`OperationSkillTraceCard` 采用 timeline 语义展示：

- 按时间排序（`started_ts_ms` 优先，缺失时用 `finished_ts_ms`）
- 每条展示 `stage + status + explanation_codes (+ run_id)`

---

## 5. Agronomy Recommendations：严格 explain 路径

### 5.1 强约束

“为什么推荐”区块 **仅** 读取：

- `recommendation.explain`

### 5.2 兼容映射

`apps/web/src/api/programs.ts` 在 control-plane list/detail 返回中统一保证：

- 若后端返回旧字段 `explain`，映射到 `recommendation.explain`

因此页面层无需判断 `selected.explain`、`selected.reasoning` 等历史路径。

---

## 6. API 层兼容映射清单（v1）

### 6.1 `apps/web/src/api/skills.ts`

- `listSkillRuns`：新接口优先 + 旧接口回退
- `normalizeSkillRunSummary`：统一 run 标识、状态、时间、scope

### 6.2 `apps/web/src/api/operations.ts`

- `normalizeSkillTraceItem`
- `normalizeSkillTrace`
- 在 `fetchOperationStates` / `fetchOperationDetail` 出口统一转换

### 6.3 `apps/web/src/api/programs.ts`

- `normalizeRecommendationExplain`
- 在 `fetchAgronomyRecommendationsControlPlane` / `fetchAgronomyRecommendationDetailControlPlane` 出口统一注入规范 explain 路径

---

## 7. 验收要点（Checklist）

1. Dashboard 可看到 success/failed/异常 skill 数与最近 10 条 run。
2. Field 解释卡能显示 observation ids 与来源设备。
3. Operation 技能追踪按 timeline 呈现 `stage/status/explanation_codes`。
4. “为什么推荐”只消费 `recommendation.explain`。
5. 兼容逻辑集中在 `apps/web/src/api/*`，页面层无分散旧字段判断。

---

## 8. 后续演进建议

- 在 `skill_trace[]` 中补充统一的 `occurred_ts_ms`，减少前端排序推断。
- 对 `recommendation.explain` 建立 JSON Schema 与契约测试。
- Dashboard 增加异常 skill drill-down（按 skill_id 跳转 runs 列表并自动筛选）。
