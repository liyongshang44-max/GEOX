import type { OperationReportV1 } from "../projections/report_v1";
import { AlertSeverity, createAlertV1, type AlertV1 } from "../projections/alert_v1";

type TenantScope = { tenant_id: string; project_id: string; group_id: string };

export type TelemetryHealthInput = TenantScope & {
  device_id: string;
  field_id?: string | null;
  heartbeat_lag_ms?: number | null;
  telemetry_lag_ms?: number | null;
  packet_loss_ratio?: number | null;
  parser_error_ratio?: number | null;
  low_battery?: boolean | null;
};

function iso(tsMs: number): string {
  return new Date(tsMs).toISOString();
}

// 任务书规则（固定 5 条）
// 1) INVALID_EXECUTION
// 2) ACCEPTANCE_FAIL / MISSING_EVIDENCE
// 3) PENDING_ACCEPTANCE_OVER_30M
// 4) HEARTBEAT_STALE
// 5) TELEMETRY_QUALITY_DEGRADED（延迟/丢包/解析错误/低电量）
export function deriveAlertsFromOperationReport(report: OperationReportV1, nowMs: number): AlertV1[] {
  const scope: TenantScope = {
    tenant_id: report.identifiers.tenant_id,
    project_id: report.identifiers.project_id,
    group_id: report.identifiers.group_id,
  };
  const triggeredAt = report.generated_at || iso(nowMs);
  const out: AlertV1[] = [];

  if (report.execution.invalid_execution) {
    out.push(
      createAlertV1({
        ...scope,
        category: "INVALID_EXECUTION",
        severity: AlertSeverity.CRITICAL,
        title: "作业执行异常",
        message: "检测到作业执行链路异常，建议立即核查并视情况切换人工接管。",
        recommended_action: "立即核查执行链路与证据完整性，必要时切换人工接管。",
        reasons: [report.execution.invalid_reason ?? "INVALID_EXECUTION"],
        triggered_at: triggeredAt,
        object_type: "OPERATION",
        object_id: report.identifiers.operation_id,
      })
    );
  }

  if (report.acceptance.status === "FAIL" || report.acceptance.missing_evidence) {
    out.push(
      createAlertV1({
        ...scope,
        category: "ACCEPTANCE_FAILURE",
        severity: AlertSeverity.HIGH,
        title: "验收失败或证据缺失",
        message: "作业验收失败或关键证据缺失，请尽快补证并重新验收。",
        recommended_action: "补齐缺失证据并重新验收，若连续失败请暂停自动执行。",
        reasons: [
          report.acceptance.status === "FAIL" ? "ACCEPTANCE_FAIL" : "MISSING_EVIDENCE",
          ...report.acceptance.missing_items,
        ],
        triggered_at: triggeredAt,
        object_type: "OPERATION",
        object_id: report.identifiers.operation_id,
      })
    );
  }

  if (report.sla.pending_acceptance_over_30m) {
    out.push(
      createAlertV1({
        ...scope,
        category: "PENDING_ACCEPTANCE_TIMEOUT",
        severity: AlertSeverity.MEDIUM,
        title: "验收超时",
        message: "作业处于待验收状态超过 30 分钟，请催办并检查回执链路。",
        recommended_action: "催办验收流程并检查回执上传链路。",
        reasons: [
          "PENDING_ACCEPTANCE_OVER_30M",
          ...(report.sla.invalid_reasons ?? []).map((x) => String(x)),
        ],
        triggered_at: triggeredAt,
        object_type: "OPERATION",
        object_id: report.identifiers.operation_id,
      })
    );
  }

  return out;
}

export function deriveAlertsFromTelemetryHealth(input: TelemetryHealthInput, nowMs: number): AlertV1[] {
  const triggeredAt = iso(nowMs);
  const out: AlertV1[] = [];

  if ((input.heartbeat_lag_ms ?? 0) >= 15 * 60 * 1000) {
    out.push(
      createAlertV1({
        tenant_id: input.tenant_id,
        project_id: input.project_id,
        group_id: input.group_id,
        category: "DEVICE_HEARTBEAT_STALE",
        severity: AlertSeverity.HIGH,
        title: "设备心跳过期",
        message: "设备长时间未上报心跳，请检查电源、网络和在线状态。",
        recommended_action: "检查设备在线状态、电源和网络连接。",
        reasons: [`heartbeat_lag_ms=${Math.round(Number(input.heartbeat_lag_ms ?? 0))}`],
        triggered_at: triggeredAt,
        object_type: "DEVICE",
        object_id: input.device_id,
      })
    );
  }

  const degradedReasons: string[] = [];
  if ((input.telemetry_lag_ms ?? 0) >= 10 * 60 * 1000) degradedReasons.push(`telemetry_lag_ms=${Math.round(Number(input.telemetry_lag_ms ?? 0))}`);
  if ((input.packet_loss_ratio ?? 0) >= 0.2) degradedReasons.push(`packet_loss_ratio=${Number(input.packet_loss_ratio).toFixed(2)}`);
  if ((input.parser_error_ratio ?? 0) >= 0.1) degradedReasons.push(`parser_error_ratio=${Number(input.parser_error_ratio).toFixed(2)}`);
  if (input.low_battery === true) degradedReasons.push("low_battery=true");

  if (degradedReasons.length > 0) {
    out.push(
      createAlertV1({
        tenant_id: input.tenant_id,
        project_id: input.project_id,
        group_id: input.group_id,
        category: "TELEMETRY_HEALTH_DEGRADED",
        severity: AlertSeverity.MEDIUM,
        title: "遥测质量下降",
        message: "检测到遥测延迟/丢包/解析异常或低电量，请排查采集链路。",
        recommended_action: "检查采集链路质量，必要时重启设备或调整上报频率。",
        reasons: degradedReasons,
        triggered_at: triggeredAt,
        object_type: "DEVICE",
        object_id: input.device_id,
      })
    );
  }

  return out;
}
