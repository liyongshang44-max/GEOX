export type Locale = "zh" | "en";

const messages = {
  zh: {
    operation: {
      title: "作业中心",
      desc: "统一查看推荐、审批与执行闭环。",
      kpi_today: "今日作业",
      kpi_success_rate: "成功率",
      kpi_failed: "失败数",
      kpi_running: "执行中",
      list: "作业列表",
      detail: "作业详情",
      filters: {
        field: "地块",
        device: "设备",
        status: "状态",
        all_fields: "全部地块",
        all_devices: "全部设备",
        all_status: "全部状态",
      },
      status: { SUCCESS: "成功", FAILED: "失败", RUNNING: "执行中", PENDING: "待执行" },
      timeline: { title: "时间线", empty: "暂无事件" },
      labels: {
        field: "地块",
        device: "设备",
        action: "作业",
        start: "开始时间",
        end: "结束时间",
        failure_reason: "失败原因",
      },
      actions: { refresh: "刷新" },
    },
    common: { unknown: "未知", none: "-" },
    field: {
      current_operation: "当前作业",
      recent_timeline: "最近操作时间线",
      risk_alerts: "风险与告警",
      progress: "进度",
      no_risk: "暂无风险",
    },
  },
  en: {
    operation: {
      title: "Operations",
      desc: "Unified lifecycle across recommendation, approval, and execution.",
      kpi_today: "Today's Operations",
      kpi_success_rate: "Success Rate",
      kpi_failed: "Failed",
      kpi_running: "Running",
      list: "Operation List",
      detail: "Operation Detail",
      filters: {
        field: "Field",
        device: "Device",
        status: "Status",
        all_fields: "All Fields",
        all_devices: "All Devices",
        all_status: "All Status",
      },
      status: { SUCCESS: "Success", FAILED: "Failed", RUNNING: "Running", PENDING: "Pending" },
      timeline: { title: "Timeline", empty: "No timeline events" },
      labels: {
        field: "Field",
        device: "Device",
        action: "Operation",
        start: "Start Time",
        end: "End Time",
        failure_reason: "Failure Reason",
      },
      actions: { refresh: "Refresh" },
    },
    common: { unknown: "Unknown", none: "-" },
    field: {
      current_operation: "Current Operation",
      recent_timeline: "Recent Timeline",
      risk_alerts: "Risk & Alerts",
      progress: "Progress",
      no_risk: "No risk alerts",
    },
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
