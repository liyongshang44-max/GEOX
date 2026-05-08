export type CustomerEmptyStateKey =
  | "NO_KPI_SUMMARY"
  | "NO_RISK_FIELDS"
  | "NO_RECENT_OPERATIONS"
  | "NO_PENDING_ACTIONS"
  | "NO_DEVICE_HEALTH"
  | "NO_ROI"
  | "NO_FIELD_MEMORY"
  | "NO_PRESCRIPTION"
  | "NO_APPROVAL"
  | "NO_AS_EXECUTED"
  | "NO_AS_APPLIED"
  | "NO_EVIDENCE"
  | "NO_ACCEPTANCE"
  | "WEATHER_UNAVAILABLE"
  | "MAP_UNAVAILABLE";

export type CustomerEmptyState = {
  title: string;
  description: string;
  severity: "neutral" | "info" | "warning";
};

const EMPTY_STATES: Record<CustomerEmptyStateKey, CustomerEmptyState> = {
  NO_KPI_SUMMARY: { title: "暂无经营状态摘要", description: "当前没有可展示的经营指标。", severity: "info" },
  NO_RISK_FIELDS: { title: "暂无风险地块", description: "当前没有需要重点关注的风险地块。", severity: "info" },
  NO_RECENT_OPERATIONS: { title: "暂无近期作业", description: "当前时间窗内没有可展示的近期作业。", severity: "info" },
  NO_PENDING_ACTIONS: { title: "暂无待处理事项", description: "当前无需新增人工跟进行动。", severity: "info" },
  NO_DEVICE_HEALTH: { title: "暂无设备状态摘要", description: "当前没有可展示的设备在线健康数据。", severity: "info" },
  NO_ROI: { title: "暂无可量化价值记录", description: "本周期尚未形成可审计的价值指标。", severity: "neutral" },
  NO_FIELD_MEMORY: { title: "暂无可展示的田块记忆", description: "当前缺少可复用的田块响应记忆。", severity: "neutral" },
  NO_PRESCRIPTION: { title: "未形成正式处方", description: "当前作业尚未沉淀为正式可执行处方。", severity: "warning" },
  NO_APPROVAL: { title: "暂无审批记录", description: "当前未查询到正式审批人和审批结论。", severity: "warning" },
  NO_AS_EXECUTED: { title: "暂无实际执行记录", description: "当前未采集到实际执行记录。", severity: "warning" },
  NO_AS_APPLIED: { title: "暂无覆盖记录", description: "当前未采集到覆盖证据。", severity: "warning" },
  NO_EVIDENCE: { title: "暂无有效证据", description: "当前缺少可用于验收的证据条目。", severity: "warning" },
  NO_ACCEPTANCE: { title: "暂无验收结论", description: "当前验收结果尚未形成。", severity: "warning" },
  WEATHER_UNAVAILABLE: { title: "天气数据不可用", description: "当前不展示天气卡，避免伪造天气信息。", severity: "info" },
  MAP_UNAVAILABLE: { title: "暂无地块范围图", description: "暂无地块范围数据，当前以列表方式展示。", severity: "info" },
};

export function getCustomerEmptyState(key: CustomerEmptyStateKey): CustomerEmptyState {
  return EMPTY_STATES[key];
}
