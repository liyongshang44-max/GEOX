import type { TelemetryHealthInput } from "../domain/alert_engine";
import { projectAlertListV1, type AlertActionOverrideV1, type AlertListFilterV1, type AlertListOperationInputV1, type AlertListScopeV1 } from "./alert_list_v1";
import { AlertSeverity, type AlertV1 } from "./alert_v1";
import { isSlaBreached } from "../domain/alert_sla";

export const DEFAULT_WORKFLOW_STATUS_V1 = "OPEN" as const;
export const DEFAULT_WORKFLOW_PRIORITY_V1 = 3;

export type AlertWorkflowStatusV1 = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "ACKED" | "RESOLVED" | "CLOSED";

export type AlertWorkflowRecordV1 = {
  alert_id: string;
  workflow_status?: AlertWorkflowStatusV1 | null;
  assignee_actor_id?: string | null;
  assignee_name?: string | null;
  priority?: number | null;
  sla_due_at?: number | null;
  last_note?: string | null;
};

export type AlertWorkItemV1 = AlertV1 & {
  workflow_status: AlertWorkflowStatusV1;
  assignee: {
    actor_id: string | null;
    name: string | null;
  };
  priority: number;
  sla_due_at: number | null;
  sla_breached: boolean;
  last_note: string | null;
  field_id: string | null;
  operation_plan_id: string | null;
  device_id: string | null;
};

export type AlertWorkboardFilterV1 = AlertListFilterV1 & {
  workflow_status?: AlertWorkflowStatusV1[];
  assignee_actor_id?: string[];
  priority_min?: number | null;
  priority_max?: number | null;
  sla_breached?: boolean | null;
};

export type AlertWorkboardArgsV1 = {
  scope: AlertListScopeV1 & { field_ids?: string[] };
  operations: AlertListOperationInputV1[];
  telemetry_health: TelemetryHealthInput[];
  action_overrides?: AlertActionOverrideV1[];
  workflow: AlertWorkflowRecordV1[];
  device_field_map?: Map<string, string>;
  operation_field_map?: Map<string, string>;
  operation_device_map?: Map<string, string>;
  filter?: AlertWorkboardFilterV1;
  nowMs: number;
};

function severityRank(severity: AlertSeverity): number {
  if (severity === AlertSeverity.CRITICAL) return 4;
  if (severity === AlertSeverity.HIGH) return 3;
  if (severity === AlertSeverity.MEDIUM) return 2;
  return 1;
}

function normalizePositiveInt(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.trunc(n));
}

function includesNeedle(value: unknown, needle: string): boolean {
  return String(value ?? "").toLowerCase().includes(needle);
}

function relationOf(alert: AlertV1, args: AlertWorkboardArgsV1): { field_id: string | null; operation_plan_id: string | null; device_id: string | null } {
  if (alert.object_type === "FIELD") {
    return {
      field_id: String(alert.object_id ?? "") || null,
      operation_plan_id: null,
      device_id: null,
    };
  }

  if (alert.object_type === "DEVICE") {
    const device_id = String(alert.object_id ?? "") || null;
    const field_id = device_id ? String(args.device_field_map?.get(device_id) ?? "") || null : null;
    return { field_id, operation_plan_id: null, device_id };
  }

  if (alert.object_type === "OPERATION") {
    const operation_plan_id = String(alert.object_id ?? "") || null;
    const field_id = operation_plan_id ? String(args.operation_field_map?.get(operation_plan_id) ?? "") || null : null;
    const device_id = operation_plan_id ? String(args.operation_device_map?.get(operation_plan_id) ?? "") || null : null;
    return { field_id, operation_plan_id, device_id };
  }

  return { field_id: null, operation_plan_id: null, device_id: null };
}

export function projectAlertWorkboardV1(args: AlertWorkboardArgsV1): AlertWorkItemV1[] {
  const listFilter: AlertListFilterV1 = {
    ...(args.filter ?? {}),
    field_ids: args.scope.field_ids,
    device_field_map: args.device_field_map,
  };

  const base = projectAlertListV1({
    scope: {
      tenant_id: args.scope.tenant_id,
      project_id: args.scope.project_id,
      group_id: args.scope.group_id,
    },
    operations: args.operations,
    telemetry_health: args.telemetry_health,
    action_overrides: args.action_overrides,
    filter: listFilter,
    nowMs: args.nowMs,
  });

  const workflowByAlert = new Map<string, AlertWorkflowRecordV1>();
  for (const item of args.workflow) {
    if (!item?.alert_id) continue;
    workflowByAlert.set(String(item.alert_id), item);
  }

  let items: AlertWorkItemV1[] = base.map((alert) => {
    const workflow = workflowByAlert.get(alert.alert_id);
    const sla_due_at = (workflow?.sla_due_at != null && Number.isFinite(Number(workflow.sla_due_at)))
      ? Math.trunc(Number(workflow.sla_due_at))
      : null;
    const workflow_status = workflow?.workflow_status ?? DEFAULT_WORKFLOW_STATUS_V1;
    const priority = normalizePositiveInt(workflow?.priority, DEFAULT_WORKFLOW_PRIORITY_V1);
    const rel = relationOf(alert, args);

    return {
      ...alert,
      workflow_status,
      assignee: {
        actor_id: workflow?.assignee_actor_id ?? null,
        name: workflow?.assignee_name ?? null,
      },
      priority,
      sla_due_at,
      sla_breached: isSlaBreached({ slaDueAt: sla_due_at, now: args.nowMs }),
      last_note: workflow?.last_note ?? null,
      field_id: rel.field_id,
      operation_plan_id: rel.operation_plan_id,
      device_id: rel.device_id,
    };
  });

  const workflowSet = new Set(args.filter?.workflow_status ?? []);
  if (workflowSet.size > 0) items = items.filter((item) => workflowSet.has(item.workflow_status));

  const assigneeSet = new Set((args.filter?.assignee_actor_id ?? []).map((x) => String(x).trim()).filter(Boolean));
  if (assigneeSet.size > 0) items = items.filter((item) => assigneeSet.has(String(item.assignee.actor_id ?? "")));

  if (args.filter?.priority_min != null && Number.isFinite(args.filter.priority_min)) {
    items = items.filter((item) => item.priority >= Math.trunc(Number(args.filter?.priority_min)));
  }
  if (args.filter?.priority_max != null && Number.isFinite(args.filter.priority_max)) {
    items = items.filter((item) => item.priority <= Math.trunc(Number(args.filter?.priority_max)));
  }
  if (typeof args.filter?.sla_breached === "boolean") {
    items = items.filter((item) => item.sla_breached === args.filter?.sla_breached);
  }
  const queryNeedle = String(args.filter?.query ?? "").trim().toLowerCase();
  if (queryNeedle) {
    items = items.filter((item) => {
      if (includesNeedle(item.assignee.actor_id, queryNeedle)) return true;
      if (includesNeedle(item.assignee.name, queryNeedle)) return true;
      if (includesNeedle(item.field_id, queryNeedle)) return true;
      if (includesNeedle(item.operation_plan_id, queryNeedle)) return true;
      if (includesNeedle(item.device_id, queryNeedle)) return true;
      if (includesNeedle(item.workflow_status, queryNeedle)) return true;
      if (includesNeedle(item.last_note, queryNeedle)) return true;
      return false;
    });
  }

  items.sort((a, b) => {
    if (a.sla_breached !== b.sla_breached) return a.sla_breached ? -1 : 1;
    const bySeverity = severityRank(b.severity) - severityRank(a.severity);
    if (bySeverity !== 0) return bySeverity;
    return Date.parse(a.triggered_at) - Date.parse(b.triggered_at);
  });

  return items;
}
