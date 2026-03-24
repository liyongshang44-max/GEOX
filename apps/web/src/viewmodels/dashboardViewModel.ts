import type {
  DashboardAcceptanceRiskItem,
  DashboardEvidenceItem,
  DashboardOverview,
  DashboardPendingActionItem,
} from "../api/dashboard";

function fmtTs(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtIso(iso: string | null | undefined): string {
  if (!iso) return "-";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? fmtTs(ms) : iso;
}

function statusTone(status: string): string {
  if (["OPEN", "ACKED", "RUNNING", "PENDING"].includes(status)) return "warn";
  if (["DONE", "SUCCESS", "executed"].includes(status)) return "ok";
  if (["ERROR", "FAILED", "failed"].includes(status)) return "bad";
  return "default";
}

export function buildDashboardViewModel(params: {
  overview: DashboardOverview | null;
  activePrograms: any[];
  evidenceItems: DashboardEvidenceItem[];
  riskItems: DashboardAcceptanceRiskItem[];
  pendingActions: DashboardPendingActionItem[];
}) {
  const { overview, activePrograms, evidenceItems, riskItems, pendingActions } = params;
  const summary = overview?.summary ?? { field_count: 0, online_device_count: 0, open_alert_count: 0, running_task_count: 0 };

  return {
    kpis: [
      { label: "地块数", value: String(summary.field_count), hint: "当前租户田块总数" },
      { label: "在线设备数", value: String(summary.online_device_count), hint: "最近 15 分钟心跳在线" },
      { label: "告警数", value: String(summary.open_alert_count), hint: "OPEN + ACKED 活跃事件" },
      { label: "进行中作业数", value: String(summary.running_task_count), hint: "运行中的作业任务" },
    ],
    priorityPrograms: activePrograms.slice(0, 6).map((p: any) => ({
      id: String(p.program_id ?? p.id ?? "-"),
      title: String(p.name ?? p.program_id ?? "Unnamed Program"),
      status: String(p.status ?? "UNKNOWN"),
      fieldId: String(p.field_id ?? "-"),
      seasonId: String(p.season_id ?? "-"),
    })),
    pendingActions: pendingActions.slice(0, 8).map((a) => ({
      id: String(a.id ?? a.key),
      label: String(a.label ?? a.key),
      status: String(a.status ?? "PENDING"),
      to: a.to || "/operations",
      tone: statusTone(String(a.status ?? "PENDING").toUpperCase()),
    })),
    evidenceSummary: evidenceItems.slice(0, 8).map((e) => ({
      id: String(e.job_id ?? "-"),
      status: String(e.status ?? "UNKNOWN"),
      scope: String(e.scope_type ?? "-"),
      time: fmtIso(e.updated_at || e.created_at || null),
      tone: statusTone(String(e.status ?? "").toUpperCase()),
    })),
    riskSummary: riskItems.slice(0, 8).map((r) => ({
      id: String(r.id),
      title: r.title,
      fieldId: String(r.field_id ?? "-"),
      level: String(r.level ?? "UNKNOWN"),
      time: fmtIso(r.occurred_at || null),
      tone: statusTone(String(r.level ?? "").toUpperCase()),
    })),
    quickActions: overview?.quick_actions ?? [],
  };
}
