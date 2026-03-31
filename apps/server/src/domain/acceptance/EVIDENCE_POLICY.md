# Evidence Policy (阶段4收口冻结)

## 证据等级定义

### A. 调试证据（不可用于正式验收）
- `sim_trace`

### B. 设备正式证据（满足其一）
- 结构化设备指标（`metrics` 非空）
- 被认可的设备执行日志（非 `sim_trace` 且在 allowlist）

### C. 人工正式证据（满足其一）
- 照片
- 视频
- 轨迹
- 明确的人工作业上传证据（`artifacts`）

## 业务规则
1. receipt 已 executed 且只有 `sim_trace`：`INVALID_EXECUTION`
2. receipt 已 executed 且有正式证据：`PENDING_ACCEPTANCE`
3. 无 receipt：保持原有 `RUNNING / PENDING` 逻辑

## 缺失原因
- only sim_trace -> `evidence_invalid`
- 完全无证据 -> `evidence_missing`
