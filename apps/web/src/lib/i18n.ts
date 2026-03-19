export type Locale = "zh" | "en";
export type TranslateFn = (key: string) => string;

export const messages = {
  zh: {
    operation: {
      title: "作业控制",
      desc: "统一查看推荐、审批与执行闭环。",
      list: "作业列表",
      detail: "作业详情",
      timeline: "作业时间线",
      kpi_today: "今日作业",
      kpi_success_rate: "成功率",
      kpi_failed: "失败",
      kpi_running: "执行中",
      filters: {
        field: "地块",
        device: "设备",
        status: "状态",
        all_fields: "全部地块",
        all_devices: "全部设备",
        all_status: "全部状态",
      },
      status: {
        success: "成功",
        failed: "失败",
        running: "执行中",
        pending: "待执行",
      },
      labels: {
        field: "地块",
        device: "设备",
        action: "作业",
        start: "开始时间",
        end: "结束时间",
        duration: "执行时长",
        failure_reason: "失败原因",
      },
      actions: { refresh: "刷新" },
      timelineLabel: {
        RECOMMENDATION_CREATED: "推荐生成",
        APPROVAL_REQUESTED: "发起审批",
        APPROVED: "审批通过",
        REJECTED: "审批拒绝",
        TASK_DISPATCHED: "任务下发",
        DEVICE_ACK: "设备执行",
        EXECUTING: "执行中",
        SUCCEEDED: "执行完成",
        FAILED: "执行失败",
      },
    },
    field: {
      currentOperation: "当前作业",
      recentTimeline: "最近动态",
      riskAlerts: "风险与告警",
      progress: "进度",
      noRisk: "暂无风险",
    },
    common: { none: "-", unknown: "未知", ids: "编号信息" },
  },
  en: {
    operation: {
      title: "Operation Console",
      desc: "Unified lifecycle across recommendation, approval, and execution.",
      list: "Operation List",
      detail: "Operation Detail",
      timeline: "Operation Timeline",
      kpi_today: "Today's Operations",
      kpi_success_rate: "Success Rate",
      kpi_failed: "Failed",
      kpi_running: "Running",
      filters: {
        field: "Field",
        device: "Device",
        status: "Status",
        all_fields: "All Fields",
        all_devices: "All Devices",
        all_status: "All Status",
      },
      status: {
        success: "Success",
        failed: "Failed",
        running: "Running",
        pending: "Pending",
      },
      labels: {
        field: "Field",
        device: "Device",
        action: "Operation",
        start: "Start Time",
        end: "End Time",
        duration: "Duration",
        failure_reason: "Failure Reason",
      },
      actions: { refresh: "Refresh" },
      timelineLabel: {
        RECOMMENDATION_CREATED: "Recommendation Created",
        APPROVAL_REQUESTED: "Approval Requested",
        APPROVED: "Approved",
        REJECTED: "Rejected",
        TASK_DISPATCHED: "Task Dispatched",
        DEVICE_ACK: "Device Ack",
        EXECUTING: "Executing",
        SUCCEEDED: "Succeeded",
        FAILED: "Failed",
      },
    },
    field: {
      currentOperation: "Current Operation",
      recentTimeline: "Recent Timeline",
      riskAlerts: "Risk & Alerts",
      progress: "Progress",
      noRisk: "No risk alerts",
    },
    common: { none: "-", unknown: "Unknown", ids: "IDs" },
  },
} as const;

export function resolveLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function t(locale: Locale, key: string): string {
  const parts = key.split(".");
  let cur: any = messages[locale];
  for (const p of parts) cur = cur?.[p];
  return typeof cur === "string" ? cur : key;
}

export function mapStatusToText(status: string, tf: TranslateFn): string {
  const s = String(status ?? "").toUpperCase();
  if (s === "SUCCESS" || s === "SUCCEEDED") return tf("operation.status.success");
  if (s === "FAILED") return tf("operation.status.failed");
  if (s === "RUNNING" || s === "EXECUTING" || s === "DISPATCHED") return tf("operation.status.running");
  return tf("operation.status.pending");
}
