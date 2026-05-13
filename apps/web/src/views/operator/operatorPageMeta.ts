export type OperatorPageKey =
  | "workbench"
  | "approvals"
  | "dispatch"
  | "acceptance"
  | "evidence"
  | "devicesAlerts"
  | "roiLedger"
  | "fieldMemory";

export const OPERATOR_PAGE_META: Record<OperatorPageKey, { title: string; lead: string; emptyTitle: string; emptyDescription: string }> = {
  workbench: {
    title: "运营总队列",
    lead: "汇总审批、派发、验收、证据、设备与异常待办。",
    emptyTitle: "运营总队列暂无待办",
    emptyDescription: "当前没有需要运营处理的审批、派发、验收、证据、设备或异常事项。",
  },
  approvals: {
    title: "审批中心",
    lead: "集中处理建议、处方与关键动作授权。",
    emptyTitle: "审批中心暂无待办",
    emptyDescription: "当前没有需要审批的建议、处方或关键动作授权。",
  },
  dispatch: {
    title: "派发状态",
    lead: "查看任务生成、派发、接单与回执状态。",
    emptyTitle: "派发状态暂无待办",
    emptyDescription: "当前没有需要派发、重试或追踪回执的任务。",
  },
  acceptance: {
    title: "验收中心",
    lead: "复核执行结果、证据充分性与验收结论。",
    emptyTitle: "验收中心暂无待办",
    emptyDescription: "当前没有需要复核、补证或确认结论的验收事项。",
  },
  evidence: {
    title: "证据中心",
    lead: "查看证据包状态与导出任务。",
    emptyTitle: "证据中心暂无任务",
    emptyDescription: "当前没有需要生成、刷新或复核的证据包导出任务。",
  },
  devicesAlerts: {
    title: "设备与告警中心",
    lead: "查看设备在线、离线、告警与确认状态。",
    emptyTitle: "设备与告警中心暂无待办",
    emptyDescription: "当前没有需要确认、关闭或排查的设备与告警事项。",
  },
  roiLedger: {
    title: "ROI 明细账",
    lead: "追踪作业价值假设、成本、收益证据与学习状态。",
    emptyTitle: "ROI 明细账暂无记录",
    emptyDescription: "当前没有可复核的作业价值假设、成本、收益证据或学习状态记录。",
  },
  fieldMemory: {
    title: "田块记忆中心",
    lead: "查看地块、设备、作业和诊断学习记录。",
    emptyTitle: "田块记忆中心暂无记录",
    emptyDescription: "当前没有可复核的地块、设备、作业或诊断学习记录。",
  },
};
