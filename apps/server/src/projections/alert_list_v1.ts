import { deriveAlertsFromOperationReport, deriveAlertsFromTelemetryHealth, type TelemetryHealthInput } from "../domain/alert_engine";
import { projectOperationReportV1, type OperationReportV1 } from "./report_v1";
import type { OperationStateV1 } from "./operation_state_v1";
import { AlertSeverity, type AlertStatus, type AlertV1 } from "./alert_v1";

export type AlertListScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type AlertListOperationInputV1 = {
  operation_plan_id: string;
  operation_state: OperationStateV1;
  evidence_bundle: {
    artifacts?: unknown[];
    logs?: unknown[];
    media?: unknown[];
    metrics?: unknown[];
  };
  acceptance: {
    verdict?: unknown;
    missing_evidence?: unknown;
    generated_at?: unknown;
    status?: unknown;
  } | null;
  receipt: {
    execution_started_at?: unknown;
    execution_finished_at?: unknown;
  } | null;
  cost?: {
    estimated_total?: unknown;
    actual_total?: unknown;
    actual_water_cost?: unknown;
    actual_electric_cost?: unknown;
    actual_chemical_cost?: unknown;
    estimated_water_cost?: unknown;
    estimated_electric_cost?: unknown;
    estimated_chemical_cost?: unknown;
  };
  generated_at?: string;
};

export type AlertActionOverrideV1 = {
  alert_id: string;
  status: AlertStatus;
};

export type AlertListFilterV1 = {
  field_ids?: string[];
  object_type?: AlertV1["object_type"] | null;
  object_id?: string | null;
  status?: AlertStatus[];
  severity?: AlertSeverity[];
  category?: string[];
  device_field_map?: Map<string, string>;
};

export function projectReportV1(input: {
  scope: AlertListScopeV1;
  operation: AlertListOperationInputV1;
  nowMs: number;
}): OperationReportV1 {
  return projectOperationReportV1({
    tenant: input.scope,
    operation_plan_id: input.operation.operation_plan_id,
    operation_state: input.operation.operation_state,
    evidence_bundle: input.operation.evidence_bundle,
    acceptance: input.operation.acceptance,
    receipt: input.operation.receipt,
    cost: input.operation.cost ?? {},
    now_ms: input.nowMs,
  });
}

function severityRank(severity: AlertSeverity): number {
  if (severity === AlertSeverity.CRITICAL) return 4;
  if (severity === AlertSeverity.HIGH) return 3;
  if (severity === AlertSeverity.MEDIUM) return 2;
  return 1;
}

export function projectAlertListV1(input: {
  scope: AlertListScopeV1;
  operations: AlertListOperationInputV1[];
  telemetry_health: TelemetryHealthInput[];
  action_overrides?: AlertActionOverrideV1[];
  filter?: AlertListFilterV1;
  nowMs: number;
}): AlertV1[] {
  const merged = new Map<string, AlertV1>();

  for (const operation of input.operations) {
    const report = projectReportV1({ scope: input.scope, operation, nowMs: input.nowMs });
    const alerts = deriveAlertsFromOperationReport(report, input.nowMs);
    for (const alert of alerts) {
      if (
        alert.tenant_id !== input.scope.tenant_id
        || alert.project_id !== input.scope.project_id
        || alert.group_id !== input.scope.group_id
      ) continue;
      merged.set(alert.alert_id, alert);
    }
  }

  for (const health of input.telemetry_health) {
    if (
      health.tenant_id !== input.scope.tenant_id
      || health.project_id !== input.scope.project_id
      || health.group_id !== input.scope.group_id
    ) continue;
    const alerts = deriveAlertsFromTelemetryHealth(health, input.nowMs);
    for (const alert of alerts) merged.set(alert.alert_id, alert);
  }

  const statusOverrides = new Map<string, AlertStatus>();
  for (const item of input.action_overrides ?? []) statusOverrides.set(item.alert_id, item.status);

  let items = Array.from(merged.values()).map((alert) => ({
    ...alert,
    status: statusOverrides.get(alert.alert_id) ?? alert.status,
  }));

  const fieldSet = new Set((input.filter?.field_ids ?? []).map((x) => String(x).trim()).filter(Boolean));
  if (fieldSet.size > 0) {
    const deviceFieldMap = input.filter?.device_field_map ?? new Map<string, string>();
    items = items.filter((item) => {
      if (item.object_type === "FIELD") return fieldSet.has(String(item.object_id ?? ""));
      if (item.object_type === "DEVICE") return fieldSet.has(String(deviceFieldMap.get(String(item.object_id ?? "")) ?? ""));
      return false;
    });
  }

  if (input.filter?.object_type) items = items.filter((item) => item.object_type === input.filter?.object_type);
  if (input.filter?.object_id) items = items.filter((item) => String(item.object_id) === String(input.filter?.object_id));

  const statusSet = new Set(input.filter?.status ?? []);
  if (statusSet.size > 0) items = items.filter((item) => statusSet.has(item.status));

  const severitySet = new Set(input.filter?.severity ?? []);
  if (severitySet.size > 0) items = items.filter((item) => severitySet.has(item.severity));

  const categorySet = new Set((input.filter?.category ?? []).map((x) => String(x).trim().toUpperCase()).filter(Boolean));
  if (categorySet.size > 0) items = items.filter((item) => categorySet.has(String(item.category ?? "").trim().toUpperCase()));

  items.sort((a, b) => {
    const bySeverity = severityRank(b.severity) - severityRank(a.severity);
    if (bySeverity !== 0) return bySeverity;
    return Date.parse(b.triggered_at) - Date.parse(a.triggered_at);
  });

  return items;
}
