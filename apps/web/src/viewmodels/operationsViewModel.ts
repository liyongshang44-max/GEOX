import type { OperationStateItemV1 } from "../api";
import { normalizeOperationFinalStatus } from "../lib/operationLabels";

export type OperationQueueStatus = "待执行" | "已派发" | "已回执" | "已完成" | "未通过";
export type AcceptanceStatus = "通过" | "未通过" | "待验收";

export type OperationItem = {
  operationId: string;
  operationType: string;
  programId: string;
  deviceField: string;
  status: OperationQueueStatus;
  statusTone: "success" | "inProgress" | "warning" | "danger";
  updatedAt: string;
  acceptance: AcceptanceStatus;
  acceptanceReason: string;
  nextSuggestion: string;
  taskId: string;
  dispatchCommandId: string;
  receipt: {
    status: string;
    time: string;
    message: string;
  };
  evidenceId: string;
  trajectoryPoints: string;
  coverage: string;
};

export type OperationsVM = {
  summary: {
    ready: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
  groups: {
    ready: OperationItem[];
    inProgress: OperationItem[];
    completed: OperationItem[];
    failed: OperationItem[];
  };
  selectedOperation: OperationItem | null;
};

function fmtTs(ts: unknown): string {
  if (!ts) return "-";
  const n = Number(ts);
  if (Number.isFinite(n) && n > 0) return new Date(n).toLocaleString();
  const ms = Date.parse(String(ts));
  if (Number.isFinite(ms)) return new Date(ms).toLocaleString();
  return String(ts);
}

function opTypeText(type: unknown): string {
  const raw = String(type ?? "").toUpperCase();
  if (raw.includes("IRRIG")) return "灌溉";
  if (raw.includes("SPRAY")) return "喷洒";
  if (raw.includes("INSPECT")) return "巡检";
  return "作业";
}

function mapStatus(item: OperationStateItemV1): { status: OperationQueueStatus; tone: OperationItem["statusTone"] } {
  const finalStatus = normalizeOperationFinalStatus(item.final_status);
  if (finalStatus === "FAILED" || finalStatus === "INVALID_EXECUTION") return { status: "未通过", tone: "danger" };
  if (finalStatus === "SUCCESS") return { status: "已完成", tone: "success" };
  if (finalStatus === "PENDING_ACCEPTANCE" || finalStatus === "RUNNING") return { status: "已派发", tone: "inProgress" };
  return { status: "待执行", tone: "warning" };
}

function acceptanceText(program: any, op: OperationStateItemV1): { status: AcceptanceStatus; reason: string; suggestion: string; coverage: string } {
  const verdict = String(program?.latest_acceptance_result?.verdict ?? "").toUpperCase();
  const ratio = Number(program?.latest_acceptance_result?.metrics?.in_field_ratio ?? NaN);
  const coverage = Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : "-";

  if (verdict.includes("PASS") || verdict.includes("ACCEPT")) {
    return {
      status: "通过",
      reason: Number.isFinite(ratio)
        ? `验收通过，覆盖率达到目标阈值（${coverage}）。`
        : "验收通过，执行覆盖达到阈值。",
      suggestion: "可作为交付证据归档。",
      coverage,
    };
  }

  if (verdict.includes("FAIL") || String(op.final_status ?? "").toUpperCase() === "FAILED") {
    return {
      status: "未通过",
      reason: "验收未通过，原因：轨迹覆盖不足或关键数据缺失。",
      suggestion: "建议：重新执行或人工复核。",
      coverage,
    };
  }

  return {
    status: "待验收",
    reason: "当前作业已执行，系统正在等待验收计算结果。",
    suggestion: "建议：保持监测，收到验收结果后确认是否交付。",
    coverage,
  };
}

function inferReceiptMessage(item: OperationStateItemV1): string {
  const receipt = String(item.receipt_status ?? "").toUpperCase();
  if (receipt === "ACKED") return "已收到设备回执，等待最终验收。";
  if (receipt === "FAILED") return "设备回执失败，请检查设备在线状态与下发参数。";
  return "系统正在等待设备回执。";
}

export function buildOperationsViewModel(args: {
  operations: OperationStateItemV1[];
  portfolio: any[];
  trajectories: Map<string, any>;
  selectedId: string;
}): OperationsVM {
  const programsById = new Map<string, any>();
  for (const p of args.portfolio ?? []) programsById.set(String(p?.program_id ?? ""), p);

  const items: OperationItem[] = (args.operations ?? []).map((op) => {
    const programId = String(op.program_id ?? "-");
    const program = programsById.get(programId);
    const mapped = mapStatus(op);
    const acceptance = acceptanceText(program, op);
    const trajectory = args.trajectories.get(String(op.task_id ?? ""));
    const pointCount = Number(trajectory?.payload?.point_count ?? 0);

    return {
      operationId: String(op.operation_id ?? "-"),
      operationType: opTypeText(op.action_type),
      programId,
      deviceField: `${String(op.device_id ?? "-")} / ${String(op.field_id ?? "-")}`,
      status: mapped.status,
      statusTone: mapped.tone,
      updatedAt: fmtTs(op.last_event_ts),
      acceptance: acceptance.status,
      acceptanceReason: acceptance.reason,
      nextSuggestion: acceptance.suggestion,
      taskId: String(op.task_id ?? "-"),
      dispatchCommandId: String((op as any).command_id ?? (op as any).dispatch_command_id ?? "-"),
      receipt: {
        status: String(op.receipt_status ?? "-"),
        time: fmtTs(op.last_event_ts),
        message: inferReceiptMessage(op),
      },
      evidenceId: String((program as any)?.latest_evidence?.artifact_uri ?? (program as any)?.latest_evidence?.evidence_id ?? "-"),
      trajectoryPoints: pointCount > 0 ? String(pointCount) : "0",
      coverage: acceptance.coverage,
    };
  });

  const groups = {
    ready: items.filter((x) => x.status === "待执行"),
    inProgress: items.filter((x) => x.status === "已派发" || x.status === "已回执"),
    completed: items.filter((x) => x.status === "已完成"),
    failed: items.filter((x) => x.status === "未通过"),
  };

  return {
    summary: {
      ready: groups.ready.length,
      inProgress: groups.inProgress.length,
      completed: groups.completed.length,
      failed: groups.failed.length,
    },
    groups,
    selectedOperation:
      items.find((x) => x.operationId === args.selectedId) ??
      groups.failed[0] ??
      groups.inProgress[0] ??
      groups.ready[0] ??
      groups.completed[0] ??
      null,
  };
}
