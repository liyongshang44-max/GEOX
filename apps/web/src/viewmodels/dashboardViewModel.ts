import type { DashboardAcceptanceRiskItem, DashboardEvidenceItem, DashboardPendingActionItem } from "../api/dashboard";

export type DashboardVM = {
  controlPlane?: any | null;
  summary: {
    activePrograms: number;
    priorityPrograms: number;
    pendingActions: number;
    dataIssues: number;
  };
  priorityPrograms: Array<{
    id: string;
    name: string;
    fieldCrop: string;
    status: "ACTIVE" | "BLOCKED";
    actionStatus: "监测中" | "待审批" | "可执行" | "已阻断";
    nextStep: string;
    riskReason: string;
    updatedAt: string;
  }>;
  pendingActions: Array<{
    id: string;
    actionType: string;
    programName: string;
    mode: "AUTO" | "需审批" | "阻断";
    reason: string;
    buttonText: string;
    disabled: boolean;
  }>;
  risks: {
    acceptance: Array<{ title: string; programName: string; reason: string; suggestion: string }>;
    dataGaps: Array<{ title: string; impact: string; nextStep: string }>;
  };
  evidence: {
    recentPackages: Array<{ id: string; status: string; updatedAt: string }>;
    recentPassed: Array<{ programName: string; operation: string; when: string }>;
    recentFailed: Array<{ programName: string; operation: string; when: string }>;
  };
};

function formatTs(value: unknown): string {
  if (!value) return "-";
  const raw = String(value);
  const ms = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  if (!Number.isFinite(ms)) return raw;
  return new Date(ms).toLocaleString();
}

function actionStatus(program: any): "监测中" | "待审批" | "可执行" | "已阻断" {
  const mode = String(program?.next_action_hint?.mode ?? program?.next_action_hint?.decision_mode ?? "").toUpperCase();
  const kind = String(program?.next_action_hint?.kind ?? "").toUpperCase();
  if (mode === "BLOCKED") return "已阻断";
  if (mode === "APPROVAL_REQUIRED") return "待审批";
  if (kind === "ON_TRACK" || kind === "STABLE_EXECUTION" || kind === "DATA_INSUFFICIENT") return "监测中";
  return "可执行";
}

function nextStepText(program: any): string {
  const mode = String(program?.next_action_hint?.mode ?? program?.next_action_hint?.decision_mode ?? "").toUpperCase();
  const kind = String(program?.next_action_hint?.kind ?? "").toUpperCase();

  if (mode === "BLOCKED") return "当前不可执行";
  if (mode === "APPROVAL_REQUIRED") return "需人工确认";
  if (kind === "ON_TRACK" || kind === "STABLE_EXECUTION") return "当前无需新增操作";
  if (kind === "DATA_INSUFFICIENT") return "正在等待关键数据更新";
  return "建议尽快执行下一步动作";
}

function riskReasonText(program: any): string {
  const reason = String(program?.current_risk_summary?.reason ?? "").trim();
  if (reason) return reason;

  const dataStatus = String(program?.efficiency_summary?.data_status ?? program?.efficiency_data_status ?? "").toUpperCase();
  if (dataStatus.includes("INSUFFICIENT")) {
    return "缺少最近 24 小时土壤湿度数据，暂无法生成灌溉建议，下一轮采集后重新评估。";
  }

  return "缺少设备回执数据，暂无法确认执行结果，收到设备回执后更新状态。";
}

function pendingMode(status: unknown): "AUTO" | "需审批" | "阻断" {
  const s = String(status ?? "").toUpperCase();
  if (s.includes("APPROVAL")) return "需审批";
  if (s.includes("BLOCK")) return "阻断";
  return "AUTO";
}

function pendingReason(action: DashboardPendingActionItem): string {
  const label = String(action.label ?? action.key ?? "").toLowerCase();
  if (label.includes("irrig") || label.includes("灌溉")) return "土壤湿度连续低于目标区间，建议执行灌溉。";
  if (label.includes("spray") || label.includes("喷洒")) return "病虫害风险上升，建议尽快执行喷洒。";
  if (label.includes("inspect") || label.includes("巡检")) return "现场状态发生波动，建议人工巡检确认。";
  return "当前作业完成后重新计算建议，已生成待处理动作。";
}

export function buildDashboardViewModel(params: {
  controlPlane?: any | null;
  overview: any;
  portfolio: any[];
  pendingActions: DashboardPendingActionItem[];
  riskItems: DashboardAcceptanceRiskItem[];
  evidenceItems: DashboardEvidenceItem[];
}): DashboardVM {
  const cp = params.controlPlane?.item ?? null;
  if (cp) {
    return {
      controlPlane: cp,
      summary: {
        activePrograms: Number(cp?.headline_cards?.find((x: any) => x.key === "active_programs")?.value ?? 0),
        priorityPrograms: Number(cp?.headline_cards?.find((x: any) => x.key === "priority_items")?.value ?? 0),
        pendingActions: Number(cp?.headline_cards?.find((x: any) => x.key === "pending_actions")?.value ?? 0),
        dataIssues: Number(cp?.headline_cards?.find((x: any) => x.key === "data_gap")?.value ?? 0),
      },
      priorityPrograms: [],
      pendingActions: [],
      risks: { acceptance: [], dataGaps: [] },
      evidence: { recentPackages: [], recentPassed: [], recentFailed: [] },
    };
  }

  const portfolio = Array.isArray(params.portfolio) ? params.portfolio : [];
  const activePrograms = portfolio.filter((p) => String(p?.status ?? "").toUpperCase() !== "ARCHIVED");

  const priorityPrograms = activePrograms
    .filter((p) => {
      const state = actionStatus(p);
      return state !== "监测中" || String(p?.current_risk_summary?.level ?? "").toUpperCase() === "HIGH";
    })
    .slice(0, 8)
    .map((p) => ({
      id: String(p?.program_id ?? p?.id ?? "-"),
      name: String(p?.program_id ?? p?.name ?? "Program"),
      fieldCrop: `${String(p?.field_id ?? "-")} / ${String(p?.crop_code ?? "-")}`,
      status: (String(p?.status ?? "ACTIVE").toUpperCase() === "BLOCKED" ? "BLOCKED" : "ACTIVE") as "ACTIVE" | "BLOCKED",
      actionStatus: actionStatus(p),
      nextStep: nextStepText(p),
      riskReason: riskReasonText(p),
      updatedAt: formatTs(p?.updated_at ?? p?.updatedAt),
    }));

  const queue = (Array.isArray(params.pendingActions) ? params.pendingActions : []).slice(0, 10).map((a) => {
    const mode = pendingMode(a.status);
    return {
      id: String(a.id ?? a.key ?? "-"),
      actionType: String(a.label ?? a.key ?? "待处理动作"),
      programName: String((a as any).program_id ?? (a as any).program_name ?? "未关联 Program"),
      mode,
      reason: pendingReason(a),
      buttonText: mode === "AUTO" ? "立即执行" : mode === "需审批" ? "提交审批" : "查看原因",
      disabled: mode === "阻断",
    };
  });

  const acceptance = (Array.isArray(params.riskItems) ? params.riskItems : []).slice(0, 6).map((r) => ({
    title: String(r.title ?? "验收待复核"),
    programName: String((r as any).program_id ?? r.field_id ?? "未关联 Program"),
    reason: String((r as any).reason ?? "验收结果异常，需人工复核。"),
    suggestion: String((r as any).suggestion ?? "建议动作：复检 / 重做"),
  }));

  const dataGaps = activePrograms
    .filter((p) => riskReasonText(p).includes("缺少"))
    .slice(0, 6)
    .map((p) => ({
      title: String(p?.program_id ?? "Program"),
      impact: riskReasonText(p),
      nextStep: actionStatus(p) === "已阻断" ? "收到设备回执后更新状态" : "下一轮采集后重新评估",
    }));

  const recentPackages = (Array.isArray(params.evidenceItems) ? params.evidenceItems : []).slice(0, 6).map((e) => ({
    id: String((e as any).receipt_fact_id ?? (e as any).operation_plan_id ?? "-"),
    status: String((e as any).status ?? "UNKNOWN"),
    updatedAt: formatTs((e as any).finished_at ?? (e as any).created_at),
  }));

  const recentPassed = activePrograms
    .filter((p) => String(p?.latest_acceptance_result?.verdict ?? "").toUpperCase().includes("PASS"))
    .slice(0, 4)
    .map((p) => ({
      programName: String(p?.program_id ?? "Program"),
      operation: String(p?.latest_acceptance_result?.summary ?? "最近作业验收通过"),
      when: formatTs(p?.latest_acceptance_result?.occurred_at ?? p?.updated_at),
    }));

  const recentFailed = activePrograms
    .filter((p) => String(p?.latest_acceptance_result?.verdict ?? "").toUpperCase().includes("FAIL"))
    .slice(0, 4)
    .map((p) => ({
      programName: String(p?.program_id ?? "Program"),
      operation: String(p?.latest_acceptance_result?.summary ?? "最近作业验收失败"),
      when: formatTs(p?.latest_acceptance_result?.occurred_at ?? p?.updated_at),
    }));

  const priorityCount = activePrograms.filter((p) => {
    const s = actionStatus(p);
    return s === "待审批" || s === "可执行" || s === "已阻断";
  }).length;

  const dataIssues = activePrograms.filter((p) => {
    const reason = riskReasonText(p);
    const eff = Number(p?.execution_reliability ?? p?.efficiency_index ?? 1);
    return reason.includes("缺少") || (Number.isFinite(eff) && eff < 0.6);
  }).length;

  return {
    summary: {
      activePrograms: activePrograms.length,
      priorityPrograms: priorityCount,
      pendingActions: queue.length,
      dataIssues,
    },
    priorityPrograms,
    pendingActions: queue,
    risks: { acceptance, dataGaps },
    evidence: { recentPackages, recentPassed, recentFailed },
  };
}
