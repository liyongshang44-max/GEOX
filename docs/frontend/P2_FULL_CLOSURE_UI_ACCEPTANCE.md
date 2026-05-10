# P2 Full Closure UI Acceptance

版本：P2.2-FE-G

目标：防止前端在后续迭代中重新退化成“页面存在，但闭环不完整”的状态。

本验收不是视觉检查，也不是端到端业务数据验收。它是源码级 release gate，用来确认 P2.2 前端闭环的关键入口、同源边界、权限边界和正式空态仍然存在。

## 一、必须保留的闭环能力

### 1. Evidence Delivery UI

`OperatorEvidencePage` 必须保留以下能力：

- 读取 session：`fetchSessionMe`
- 使用权限判断：`hasOperatorPermission`
- 使用统一权限 gate：`PermissionGate`
- 使用 `export_evidence` 权限键
- 创建证据导出任务：`createOperatorEvidenceExportJob`
- 查询 / 刷新 job detail：`fetchOperatorEvidenceJobDetail`
- 显示 `sha256`，如果后端返回
- 权限不足文案：`缺少会话权限：operator_evidence_export`

前端不得绕过后端权限；UI gate 只是前置禁用，不替代后端授权。

### 2. Spatial Execution UI

`OperationReportPage` 必须保留：

- `EvidencePackMetadataBlock`
- as-applied / as-executed 展示逻辑
- `OperationSpatialExecutionPanel`
- 计划区域图层
- 实际覆盖图层
- 执行轨迹
- 计划-实际偏差
- 无 evidence_ref 时显示“计划-实际偏差待补充证据来源”

`FieldReportPage` 必须保留：

- `FieldGisMap`
- `plannedGeoJson={vm.mapLayers.plannedGeoJson}`
- `coverageGeoJson={vm.mapLayers.coverageGeoJson}`
- `markers={vm.mapLayers.deviceMarkers}`
- `trajectorySegments={vm.mapLayers.trajectorySegments}`
- `acceptancePoints={vm.mapLayers.acceptancePoints}`

除明确无数据的正式空态外，不允许把 planned / coverage / markers / trajectory / acceptance 固定传空值来替代真实图层 adapter。

### 3. Weather Interference UI

必须存在 weather API client：

- `fetchWeatherHistory`
- `fetchWeatherForecast`
- `fetchOperationEnvironmentContext`

页面必须保留：

- `WeatherInterferencePanel`
- `FieldWeatherSummaryCard`
- unavailable 正式空态
- “天气用于辅助解释和学习排除，不直接替代验收结论”的边界文案

天气不得直接替代验收结论，不得被写成验收通过 / 失败的直接原因。

### 4. Learning Closure UI

必须存在 Skill Trace / Learning Closure 能力：

- `operatorSkillTrace.ts`
- `LearningClosurePanel`
- `operatorLearningClosureVm.ts`
- Field Memory 页面接入 Learning Closure
- ROI 页面接入 Learning Closure
- OperationReport 技术折叠保留 `#operation-skill-trace` 锚点

当出现降雨干扰学习排除时，UI 必须明确展示：

`因降雨干扰，本次结果未进入灌溉效果学习。`

### 5. Permission Consistency UI

必须存在：

- `PermissionGate`
- approval 使用 `approve`
- dispatch 使用 `dispatch`
- acceptance 使用 `acceptance`
- evidence export 使用 `export_evidence`
- alert ACK 使用 `ack`
- alert close 使用 `close_alert`
- device credential revoke 使用 `revoke_device_credential`

普通 operator 不允许看到可点击 revoke。最多显示只读状态。

权限不足文案必须使用统一口径：

`缺少会话权限：<permission_label>`

### 6. Customer Export Same-Source

客户导出版必须和页面版同源。

Operation export 必须展示：

- `evidence_pack_summary` status
- `sha256`，如果后端返回
- `as_executed` summary
- `as_applied` coverage status
- weather interference summary
- ROI nature：实测 / 估算 / 假设
- Field Memory learning summary

Field export 必须展示：

- 地块 geometry 状态
- 近期作业覆盖状态
- 天气摘要
- ROI 摘要
- Field Memory 摘要

导出页不得直接调用：

- debug API
- admin API
- legacy control API
- weather API
- operator evidence API
- operator skill trace API
- operator field memory API
- operator ROI API

导出页不得伪造：

- 天气数据
- 地图 / GeoJSON
- 覆盖图层
- 执行轨迹
- 验收点
- 下载入口

导出页只能消费：

- `/api/v1/reports/operation/:id`
- `/api/v1/reports/field/:id`
- `/api/v1/reports/customer-dashboard/aggregate`

以及基于这些 payload 构建的 VM。

## 二、自动 gate

新增命令：

```bash
pnpm --filter @geox/web run check:p2-full-closure-ui
```

该命令执行：

```bash
node ./scripts/check-p2-full-closure-ui.mjs
```

脚本会做源码级检查，包括：

- Evidence export UI 是否保留 session / permission / job creation / job refresh / sha256
- OperationReport 是否保留 evidence metadata / as-applied / weather / memory / skill trace
- FieldReport 是否保留 GIS map 和非固定空图层 adapter
- weather API client 是否存在
- SkillTrace / LearningClosure 组件或 fallback 是否存在
- operator 写操作是否统一使用 session permission
- revoke 是否不对普通 operator 开放
- export same-source 是否仍通过
- package.json 是否暴露 `check:p2-full-closure-ui`

## 三、P2.2 前端全量验收命令

进入仓库根目录后执行：

```bash
pnpm --filter @geox/web run typecheck
pnpm --filter @geox/web run build
pnpm --filter @geox/web run lint
pnpm --filter @geox/web run check:customer-boundary
pnpm --filter @geox/web run check:customer-routes
pnpm --filter @geox/web run check:no-raw-enum-customer
pnpm --filter @geox/web run check:operator-boundary
pnpm --filter @geox/web run check:customer-export-same-source
pnpm --filter @geox/web run check:p2-full-closure-ui
```

全部通过后，P2.2 Frontend Full Production Closure 才允许进入合并。

## 四、禁止事项

禁止为了通过页面展示而绕过 VM / report payload。

禁止在 customer export 页面二次调用业务 API 拼天气、证据、Skill Trace 或 Field Memory。

禁止在客户主界面显示 raw skill trace、debug JSON、secret、token、credential、本地路径、runtime path 或 S3 原始地址。

禁止在没有数据时伪造地图、覆盖、轨迹、验收点、天气、下载入口或学习结论。

禁止用前端枚举推断最终作业状态。客户侧最终状态必须来自后端 operation_state / report payload。
