export type DeviceAnomalyTypeV1 =
  | "DEVICE_OFFLINE"
  | "SENSOR_DRIFT"
  | "STALE_TELEMETRY"
  | "RECEIPT_MISSING_REQUIRED_EVIDENCE"
  | "DISPATCH_ACK_MISSING"
  | "EXECUTOR_NOT_ACKED"
  | "EXECUTION_FAILED"
  | "EVIDENCE_INSUFFICIENT";

export type DeviceAnomalyReportV1 = {
  scenario_type: "DEVICE_ANOMALY";
  anomaly_types: DeviceAnomalyTypeV1[];
  impact_scope: { field_id: string | null; device_id: string | null; act_task_id: string | null; operation_id: string | null };
  system_block_reason: string;
  missing_evidence: string[];
  manual_takeover_required: boolean;
  manual_takeover_status: "NONE" | "REQUESTED" | "ACKED" | "COMPLETED";
  fail_safe_triggered: boolean;
  fail_safe_status: "NONE" | "OPEN" | "ACKED" | "COMPLETED" | "RESOLVED";
  customer_next_action: string;
  customer_visible_eligible: false;
  needs_review: true;
  operation_success_allowed: false;
  roi_customer_visible_allowed: false;
  field_memory_customer_visible_allowed: false;
};

function upper(v: unknown): string { return String(v ?? "").trim().toUpperCase(); }
function text(v: unknown): string { return String(v ?? "").trim(); }
function uniq(values: unknown[]): string[] { return Array.from(new Set(values.map((x) => text(x)).filter(Boolean))); }
function hasAny(hay: string, needles: string[]): boolean { return needles.some((n) => hay.includes(n)); }

export function inferDeviceAnomalyTypesV1(input: unknown): DeviceAnomalyTypeV1[] {
  const r: any = input ?? {};
  const corpus = uniq([
    ...(Array.isArray(r?.risk?.reasons) ? r.risk.reasons : []),
    ...(Array.isArray(r?.formal_scenario?.blocking_reasons) ? r.formal_scenario.blocking_reasons : []),
    ...(Array.isArray(r?.acceptance?.missing_items) ? r.acceptance.missing_items : []),
    r?.fail_safe?.trigger,
    r?.fail_safe?.reason_code,
    r?.manual_takeover?.reason,
    r?.execution?.invalid_reason,
    r?.execution?.final_status,
    r?.evidence?.evidence_status,
    ...((Array.isArray(r?.status_chain) ? r.status_chain : []).map((x: any) => x?.reason)),
  ]).join("|").toUpperCase();

  const out = new Set<DeviceAnomalyTypeV1>();
  if (hasAny(corpus, ["OFFLINE", "DEVICE_OFFLINE", "HEARTBEAT_TIMEOUT"])) out.add("DEVICE_OFFLINE");
  if (hasAny(corpus, ["SENSOR_DRIFT", "DRIFT"])) out.add("SENSOR_DRIFT");
  if (hasAny(corpus, ["STALE_TELEMETRY", "TELEMETRY_STALE", "STATUS_UNKNOWN"])) out.add("STALE_TELEMETRY");
  if (hasAny(corpus, ["RECEIPT_MISSING", "MISSING_RECEIPT", "REQUIRED_EVIDENCE"])) out.add("RECEIPT_MISSING_REQUIRED_EVIDENCE");
  if (hasAny(corpus, ["DISPATCH_ACK_MISSING", "ACK_MISSING"])) out.add("DISPATCH_ACK_MISSING");
  if (hasAny(corpus, ["EXECUTOR_NOT_ACKED", "NOT_ACKED"])) out.add("EXECUTOR_NOT_ACKED");
  if (hasAny(corpus, ["EXECUTION_FAILED", "FAILED", "INVALID_EXECUTION"])) out.add("EXECUTION_FAILED");
  if (hasAny(corpus, ["INSUFFICIENT_EVIDENCE", "MISSING_EVIDENCE", "EVIDENCE_MISSING"])) out.add("EVIDENCE_INSUFFICIENT");
  return [...out];
}

export function buildDeviceAnomalyReportV1(report: any): DeviceAnomalyReportV1 {
  const anomalyTypes = inferDeviceAnomalyTypesV1(report);
  const missingEvidence = uniq(report?.acceptance?.missing_items ?? report?.device_anomaly?.missing_evidence ?? []);
  const blockReason = text(report?.execution?.invalid_reason ?? report?.formal_scenario?.blocking_reasons?.[0] ?? report?.fail_safe?.trigger) || "设备异常或证据不足，系统阻断并需人工复核";
  const manualStatusRaw = upper(report?.manual_takeover?.status ?? report?.device_anomaly?.manual_takeover_status);
  const manual_takeover_status = (["NONE", "REQUESTED", "ACKED", "COMPLETED"].includes(manualStatusRaw) ? manualStatusRaw : "NONE") as DeviceAnomalyReportV1["manual_takeover_status"];
  const failSafeStatusRaw = upper(report?.fail_safe?.status ?? report?.device_anomaly?.fail_safe_status);
  const fail_safe_status = (["NONE", "OPEN", "ACKED", "COMPLETED", "RESOLVED"].includes(failSafeStatusRaw) ? failSafeStatusRaw : "NONE") as DeviceAnomalyReportV1["fail_safe_status"];
  return {
    scenario_type: "DEVICE_ANOMALY",
    anomaly_types: anomalyTypes,
    impact_scope: {
      field_id: text(report?.identifiers?.field_id) || null,
      device_id: text(report?.as_executed?.device_id) || null,
      act_task_id: text(report?.identifiers?.act_task_id) || null,
      operation_id: text(report?.identifiers?.operation_id) || null,
    },
    system_block_reason: blockReason,
    missing_evidence: missingEvidence,
    manual_takeover_required: manual_takeover_status !== "NONE" || fail_safe_status !== "NONE",
    manual_takeover_status,
    fail_safe_triggered: fail_safe_status !== "NONE" || Boolean(text(report?.fail_safe?.trigger)),
    fail_safe_status,
    customer_next_action: text(report?.device_anomaly?.customer_next_action) || "需复核并补充证据，必要时人工接管后再恢复自动执行",
    customer_visible_eligible: false,
    needs_review: true,
    operation_success_allowed: false,
    roi_customer_visible_allowed: false,
    field_memory_customer_visible_allowed: false,
  };
}

export function applyDeviceAnomalyReportGuardV1(report: any): any {
  const anomaly = buildDeviceAnomalyReportV1(report);
  const finalStatus = upper(report?.execution?.final_status);
  const blockedSuccess = ["SUCCESS", "SUCCEEDED", "PASS"].includes(finalStatus);
  const guardedFinalStatus = blockedSuccess ? "BLOCKED_BY_DEVICE_ANOMALY" : (report?.execution?.final_status ?? "NEEDS_REVIEW");
  return {
    ...report,
    device_anomaly: anomaly,
    formal_scenario: {
      ...(report?.formal_scenario ?? {}),
      scenario_type: "DEVICE_ANOMALY",
      formal_chain_status: "NEEDS_REVIEW",
      evidence_status: "MISSING",
      customer_visible_eligible: false,
      needs_review: true,
      blocking_reasons: uniq([...(report?.formal_scenario?.blocking_reasons ?? []), anomaly.system_block_reason, ...anomaly.missing_evidence]),
    },
    execution: { ...(report?.execution ?? {}), final_status: guardedFinalStatus },
    acceptance: { ...(report?.acceptance ?? {}), status: "FAIL" },
    customer_visible_eligible: false,
    needs_review: true,
    roi_ledger: {
      ...(report?.roi_ledger ?? {}),
      summary: {
        ...((report?.roi_ledger ?? {}).summary ?? {}),
        has_customer_visible_value: false,
        trusted_value_items: 0,
      },
    },
    field_memory: {
      ...(report?.field_memory ?? {}),
      hidden_by_guard: true,
    },
  };
}
