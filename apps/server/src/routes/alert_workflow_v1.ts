import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0";
import { enforceFieldScopeOrDeny, hasFieldAccess } from "../auth/route_role_authz";
import { projectOperationStateV1 } from "../projections/operation_state_v1";
import { projectReportV1 as projectOperationReportV1 } from "./reports_v1";
import { projectAlertWorkboardV1, type AlertWorkflowStatusV1 } from "../projections/alert_workboard_v1";
import type { AlertActionOverrideV1, AlertListOperationInputV1 } from "../projections/alert_list_v1";
import type { TelemetryHealthInput } from "../domain/alert_engine";
import { deriveDefaultSlaDueAt } from "../domain/alert_sla";

export type AlertWorkflowStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "ACKED" | "RESOLVED" | "CLOSED";

const ALERT_WORKFLOW_STATUS_ORDER: AlertWorkflowStatus[] = ["OPEN", "ASSIGNED", "IN_PROGRESS", "ACKED", "RESOLVED", "CLOSED"];
const ALERT_WORKFLOW_STATUS_SET = new Set<AlertWorkflowStatus>(ALERT_WORKFLOW_STATUS_ORDER);

type UpdateAlertWorkflowParams = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  alert_id: string;
  status: AlertWorkflowStatus;
  updated_by: string;
  updated_at: number;
  assignee_actor_id?: string | null;
  assignee_name?: string | null;
  priority?: number | null;
  sla_due_at?: number | null;
  assigned_at?: number | null;
  acked_at?: number | null;
  resolved_at?: number | null;
  last_note?: string | null;
  allow_cross_step?: boolean;
  allow_rollback?: boolean;
  expected_version?: number | null;
};

export type OperationWorkflowV1Row = {
  operation_id: string;
  owner_actor_id: string | null;
  owner_name: string | null;
  last_note: string | null;
  updated_at: number;
  updated_by: string;
};

type UpsertOperationWorkflowParams = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  operation_id: string;
  owner_actor_id?: string | null;
  owner_name?: string | null;
  last_note?: string | null;
  updated_by: string;
  updated_at: number;
};

function compareWorkflowStatus(a: AlertWorkflowStatus, b: AlertWorkflowStatus): number {
  return ALERT_WORKFLOW_STATUS_ORDER.indexOf(a) - ALERT_WORKFLOW_STATUS_ORDER.indexOf(b);
}

export function isValidAlertWorkflowStatus(raw: any): raw is AlertWorkflowStatus {
  return ALERT_WORKFLOW_STATUS_SET.has(String(raw ?? "").trim().toUpperCase() as AlertWorkflowStatus);
}

function validateAlertWorkflowTransition(fromStatus: AlertWorkflowStatus, toStatus: AlertWorkflowStatus, opts?: { allow_cross_step?: boolean; allow_rollback?: boolean }): { ok: true } | { ok: false; error: string; detail: { from: AlertWorkflowStatus; to: AlertWorkflowStatus } } {
  const cmp = compareWorkflowStatus(toStatus, fromStatus);
  if (cmp === 0) return { ok: true };
  if (cmp < 0 && !opts?.allow_rollback) {
    return { ok: false, error: "INVALID_STATUS_TRANSITION", detail: { from: fromStatus, to: toStatus } };
  }
  if (cmp > 1 && !opts?.allow_cross_step) {
    return { ok: false, error: "INVALID_STATUS_TRANSITION", detail: { from: fromStatus, to: toStatus } };
  }
  return { ok: true };
}

export async function ensureAlertWorkflowV1Schema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_workflow_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      alert_id TEXT NOT NULL,
      assignee_actor_id TEXT NULL,
      assignee_name TEXT NULL,
      status TEXT NOT NULL,
      priority SMALLINT NOT NULL DEFAULT 5,
      sla_due_at BIGINT NULL,
      assigned_at BIGINT NULL,
      acked_at BIGINT NULL,
      resolved_at BIGINT NULL,
      last_note TEXT NULL,
      updated_by TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      version BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (tenant_id, alert_id),
      CONSTRAINT alert_workflow_v1_status_ck CHECK (status IN ('OPEN','ASSIGNED','IN_PROGRESS','ACKED','RESOLVED','CLOSED'))
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS alert_workflow_v1_alert_lookup_idx ON alert_workflow_v1 (tenant_id, alert_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS alert_workflow_v1_status_updated_idx ON alert_workflow_v1 (tenant_id, status, updated_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS alert_workflow_v1_assignee_idx ON alert_workflow_v1 (tenant_id, assignee_actor_id, updated_at DESC);`);
}

export async function ensureOperationWorkflowV1Schema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS operation_workflow_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      owner_actor_id TEXT NULL,
      owner_name TEXT NULL,
      last_note TEXT NULL,
      updated_at BIGINT NOT NULL,
      updated_by TEXT NOT NULL,
      PRIMARY KEY (tenant_id, operation_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS operation_workflow_v1_lookup_idx ON operation_workflow_v1 (tenant_id, operation_id, updated_at DESC);`);
}

export async function upsertOperationWorkflowV1(clientConn: PoolClient, params: UpsertOperationWorkflowParams): Promise<void> {
  const now_ms = Number.isFinite(params.updated_at) ? Math.trunc(params.updated_at) : Date.now();
  await clientConn.query(
    `INSERT INTO operation_workflow_v1
      (tenant_id, project_id, group_id, operation_id, owner_actor_id, owner_name, last_note, updated_at, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (tenant_id, operation_id)
     DO UPDATE SET
      project_id = EXCLUDED.project_id,
      group_id = EXCLUDED.group_id,
      owner_actor_id = EXCLUDED.owner_actor_id,
      owner_name = EXCLUDED.owner_name,
      last_note = EXCLUDED.last_note,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by`,
    [
      params.tenant_id,
      params.project_id,
      params.group_id,
      params.operation_id,
      params.owner_actor_id ?? null,
      params.owner_name ?? null,
      params.last_note ?? null,
      now_ms,
      params.updated_by,
    ]
  );
}

export async function getOperationWorkflowV1(clientConn: PoolClient, params: {
  tenant_id: string;
  operation_id: string;
}): Promise<OperationWorkflowV1Row | null> {
  const q = await clientConn.query(
    `SELECT operation_id, owner_actor_id, owner_name, last_note, updated_at, updated_by
       FROM operation_workflow_v1
      WHERE tenant_id = $1 AND operation_id = $2
      LIMIT 1`,
    [params.tenant_id, params.operation_id]
  );
  if ((q.rowCount ?? 0) === 0) return null;
  const row = q.rows[0];
  return {
    operation_id: String(row.operation_id ?? ""),
    owner_actor_id: row.owner_actor_id == null ? null : String(row.owner_actor_id),
    owner_name: row.owner_name == null ? null : String(row.owner_name),
    last_note: row.last_note == null ? null : String(row.last_note),
    updated_at: Number(row.updated_at ?? 0),
    updated_by: String(row.updated_by ?? ""),
  };
}

export async function listOperationWorkflowV1(pool: Pool, params: {
  tenant_id: string;
  operation_ids: string[];
}): Promise<Map<string, OperationWorkflowV1Row>> {
  const ids = params.operation_ids.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!ids.length) return new Map();
  const q = await pool.query(
    `SELECT operation_id, owner_actor_id, owner_name, last_note, updated_at, updated_by
       FROM operation_workflow_v1
      WHERE tenant_id = $1
        AND operation_id = ANY($2::text[])`,
    [params.tenant_id, ids]
  );
  const out = new Map<string, OperationWorkflowV1Row>();
  for (const row of q.rows ?? []) {
    const operation_id = String(row.operation_id ?? "").trim();
    if (!operation_id) continue;
    out.set(operation_id, {
      operation_id,
      owner_actor_id: row.owner_actor_id == null ? null : String(row.owner_actor_id),
      owner_name: row.owner_name == null ? null : String(row.owner_name),
      last_note: row.last_note == null ? null : String(row.last_note),
      updated_at: Number(row.updated_at ?? 0),
      updated_by: String(row.updated_by ?? ""),
    });
  }
  return out;
}

export async function upsertAlertWorkflowV1(clientConn: PoolClient, params: UpdateAlertWorkflowParams): Promise<{ ok: true; status: AlertWorkflowStatus; version: number } | { ok: false; error: string; detail?: any }> {
  const now_ms = Number.isFinite(params.updated_at) ? Math.trunc(params.updated_at) : Date.now();
  const normalizedStatus = String(params.status ?? "").trim().toUpperCase() as AlertWorkflowStatus;
  if (!isValidAlertWorkflowStatus(normalizedStatus)) return { ok: false, error: "INVALID_WORKFLOW_STATUS" };

  const curQ = await clientConn.query(
    `SELECT status, version FROM alert_workflow_v1 WHERE tenant_id = $1 AND alert_id = $2 LIMIT 1 FOR UPDATE`,
    [params.tenant_id, params.alert_id]
  );

  if ((curQ.rowCount ?? 0) === 0) {
    const seedTransition = validateAlertWorkflowTransition("OPEN", normalizedStatus, {
      allow_cross_step: params.allow_cross_step,
      allow_rollback: params.allow_rollback,
    });
    if (!seedTransition.ok) return seedTransition;

    const version = 0;
    await clientConn.query(
      `INSERT INTO alert_workflow_v1
        (tenant_id, project_id, group_id, alert_id, assignee_actor_id, assignee_name, status, priority, sla_due_at, assigned_at, acked_at, resolved_at, last_note, updated_by, updated_at, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (tenant_id, alert_id) DO NOTHING`,
      [
        params.tenant_id,
        params.project_id,
        params.group_id,
        params.alert_id,
        params.assignee_actor_id ?? null,
        params.assignee_name ?? null,
        normalizedStatus,
        params.priority ?? 5,
        params.sla_due_at ?? null,
        params.assigned_at ?? null,
        params.acked_at ?? null,
        params.resolved_at ?? null,
        params.last_note ?? null,
        params.updated_by,
        now_ms,
        version,
      ]
    );
    return { ok: true, status: normalizedStatus, version };
  }

  const currentStatus = String(curQ.rows[0]?.status ?? "OPEN").trim().toUpperCase() as AlertWorkflowStatus;
  const currentVersion = Number(curQ.rows[0]?.version ?? 0);
  if (!isValidAlertWorkflowStatus(currentStatus)) return { ok: false, error: "INVALID_STORED_WORKFLOW_STATUS" };

  const transition = validateAlertWorkflowTransition(currentStatus, normalizedStatus, {
    allow_cross_step: params.allow_cross_step,
    allow_rollback: params.allow_rollback,
  });
  if (!transition.ok) return transition;

  if (params.expected_version != null && Number(params.expected_version) !== currentVersion) {
    return { ok: false, error: "WORKFLOW_VERSION_CONFLICT", detail: { expected: Number(params.expected_version), current: currentVersion } };
  }

  const nextVersion = currentVersion + 1;
  const upd = await clientConn.query(
    `UPDATE alert_workflow_v1
        SET project_id = $3,
            group_id = $4,
            assignee_actor_id = COALESCE($5, assignee_actor_id),
            assignee_name = COALESCE($6, assignee_name),
            status = $7,
            priority = COALESCE($8, priority),
            sla_due_at = COALESCE($9, sla_due_at),
            assigned_at = COALESCE($10, assigned_at),
            acked_at = COALESCE($11, acked_at),
            resolved_at = COALESCE($12, resolved_at),
            last_note = COALESCE($13, last_note),
            updated_by = $14,
            updated_at = $15,
            version = $16
      WHERE tenant_id = $1 AND alert_id = $2 AND version = $17`,
    [
      params.tenant_id,
      params.alert_id,
      params.project_id,
      params.group_id,
      params.assignee_actor_id ?? null,
      params.assignee_name ?? null,
      normalizedStatus,
      params.priority ?? null,
      params.sla_due_at ?? null,
      params.assigned_at ?? null,
      params.acked_at ?? null,
      params.resolved_at ?? null,
      params.last_note ?? null,
      params.updated_by,
      now_ms,
      nextVersion,
      currentVersion,
    ]
  );
  if ((upd.rowCount ?? 0) === 0) {
    return { ok: false, error: "WORKFLOW_VERSION_CONFLICT", detail: { expected: currentVersion, current: currentVersion } };
  }
  return { ok: true, status: normalizedStatus, version: nextVersion };
}

export function registerAlertWorkflowV1Routes(app: FastifyInstance, pool: Pool): void {
  app.addHook("onReady", async () => {
    await ensureAlertWorkflowV1Schema(pool);
    await ensureOperationWorkflowV1Schema(pool);
  });

  const canWrite = (auth: AoActAuthContextV0): boolean => auth.role === "operator" || auth.role === "admin";
  const canRead = (auth: AoActAuthContextV0): boolean =>
    auth.role === "client" || auth.role === "viewer" || auth.role === "operator" || auth.role === "admin";
  const parseId = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    return /^[A-Za-z0-9_\-:.]+$/.test(s) ? s : null;
  };
  const normalizeCsv = (v: unknown): string[] => {
    const raw = Array.isArray(v) ? v : [v];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const chunk of raw) {
      for (const token of String(chunk ?? "").split(",")) {
        const item = token.trim();
        if (!item || seen.has(item)) continue;
        seen.add(item);
        out.push(item);
      }
    }
    return out;
  };
  const normalizeStatusList = (v: unknown): AlertWorkflowStatusV1[] =>
    normalizeCsv(v)
      .map((x) => String(x).trim().toUpperCase())
      .filter((x): x is AlertWorkflowStatusV1 => isValidAlertWorkflowStatus(x));

  const requireScope = (
    req: any,
    reply: any,
    scope: "alerts.read" | "alerts.write"
  ): AoActAuthContextV0 | null => {
    const injected = (app as any).alertWorkflowRequireScopeV0;
    if (typeof injected === "function") return injected(req, reply, scope);
    return requireAoActScopeV0(req, reply, scope);
  };

  const listOperationInputsForAlertProjection = async (
    auth: AoActAuthContextV0,
    opts: { skipFieldScope?: boolean } = {}
  ): Promise<AlertListOperationInputV1[]> => {
    const states = await projectOperationStateV1(pool, {
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
    });
    const scoped = opts.skipFieldScope
      ? states
      : states.filter((x) => hasFieldAccess(auth, String(x.field_id ?? "")));
    const reports = await Promise.all(scoped.map((state) => projectOperationReportV1({
      pool,
      tenant: { tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id },
      operationState: state,
    })));
    return reports.map((report) => ({
      operation_plan_id: String(report.identifiers.operation_plan_id ?? report.identifiers.operation_id ?? ""),
      operation_state: {
        operation_id: report.identifiers.operation_id,
        operation_plan_id: report.identifiers.operation_plan_id,
        tenant_id: report.identifiers.tenant_id,
        project_id: report.identifiers.project_id,
        group_id: report.identifiers.group_id,
        field_id: report.identifiers.field_id,
        device_id: report.identifiers.device_id,
        action_type: report.execution.action_type,
        status: report.execution.status,
        final_status: report.execution.final_status,
        acceptance: report.acceptance,
        timeline: report.timeline,
      },
      evidence_bundle: report.evidence_bundle ?? {},
      acceptance: report.acceptance ?? null,
      receipt: report.receipt ?? null,
      cost: report.cost ?? {},
      generated_at: report.generated_at,
    }));
  };

  const listTelemetryHealthInputsForAlertProjection = async (
    auth: AoActAuthContextV0,
    opts: { skipFieldScope?: boolean } = {}
  ): Promise<TelemetryHealthInput[]> => {
    const q = await pool.query(
      `SELECT d.device_id,
              COALESCE(d.field_id, b.field_id) AS field_id,
              d.last_heartbeat_ts_ms,
              d.last_telemetry_ts_ms,
              d.battery_percent
         FROM device_status_index_v1 d
         LEFT JOIN device_binding_index_v1 b
           ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
        WHERE d.tenant_id = $1`,
      [auth.tenant_id]
    );
    const nowMs = Date.now();
    const out: TelemetryHealthInput[] = [];
    for (const row of q.rows ?? []) {
      const field_id = String(row.field_id ?? "").trim() || null;
      if (!opts.skipFieldScope && field_id && !hasFieldAccess(auth, field_id)) continue;
      const lastHeartbeat = Number(row.last_heartbeat_ts_ms ?? 0);
      const lastTelemetry = Number(row.last_telemetry_ts_ms ?? 0);
      const batteryPercent = Number(row.battery_percent ?? 100);
      out.push({
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        device_id: String(row.device_id ?? ""),
        field_id,
        heartbeat_lag_ms: Number.isFinite(lastHeartbeat) && lastHeartbeat > 0 ? Math.max(0, nowMs - lastHeartbeat) : null,
        telemetry_lag_ms: Number.isFinite(lastTelemetry) && lastTelemetry > 0 ? Math.max(0, nowMs - lastTelemetry) : null,
        packet_loss_ratio: null,
        parser_error_ratio: null,
        low_battery: Number.isFinite(batteryPercent) ? batteryPercent < 20 : null,
      });
    }
    return out;
  };

  const listAlertActionOverrides = async (auth: AoActAuthContextV0): Promise<AlertActionOverrideV1[]> => {
    const q = await pool.query(
      `SELECT DISTINCT ON (alert_id) alert_id, status
         FROM alert_actions_v1
        WHERE tenant_id = $1
        ORDER BY alert_id, acted_at DESC`,
      [auth.tenant_id]
    );
    return (q.rows ?? [])
      .map((row: any) => ({ alert_id: String(row.alert_id ?? ""), status: String(row.status ?? "").trim().toUpperCase() }))
      .filter((x): x is AlertActionOverrideV1 => Boolean(x.alert_id && (x.status === "OPEN" || x.status === "ACKED" || x.status === "CLOSED")));
  };

  const listWorkflowRows = async (auth: AoActAuthContextV0): Promise<any[]> => {
    const q = await pool.query(
      `SELECT alert_id, status, assignee_actor_id, assignee_name, priority, sla_due_at, last_note
         FROM alert_workflow_v1
        WHERE tenant_id = $1`,
      [auth.tenant_id]
    );
    return q.rows ?? [];
  };

  const listDeviceFieldMap = async (tenant_id: string): Promise<Map<string, string>> => {
    const q = await pool.query(
      `SELECT d.device_id, COALESCE(d.field_id, b.field_id) AS field_id
         FROM device_status_index_v1 d
         LEFT JOIN device_binding_index_v1 b
           ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
        WHERE d.tenant_id = $1`,
      [tenant_id]
    );
    const map = new Map<string, string>();
    for (const row of q.rows ?? []) {
      const did = String(row.device_id ?? "").trim();
      const fid = String(row.field_id ?? "").trim();
      if (did && fid) map.set(did, fid);
    }
    return map;
  };

  const buildOperationFieldMap = (operations: AlertListOperationInputV1[]): Map<string, string> => {
    const out = new Map<string, string>();
    for (const item of operations) {
      const operationId = String(item.operation_state?.operation_id ?? item.operation_plan_id ?? "").trim();
      const fieldId = String(item.operation_state?.field_id ?? "").trim();
      if (operationId && fieldId) out.set(operationId, fieldId);
    }
    return out;
  };

  const buildOperationDeviceMap = (operations: AlertListOperationInputV1[]): Map<string, string> => {
    const out = new Map<string, string>();
    for (const item of operations) {
      const operationId = String(item.operation_state?.operation_id ?? item.operation_plan_id ?? "").trim();
      const deviceId = String(item.operation_state?.device_id ?? "").trim();
      if (operationId && deviceId) out.set(operationId, deviceId);
    }
    return out;
  };

  const projectWorkboardItemsCore = async (
    auth: AoActAuthContextV0,
    filter: any = {},
    opts: { skipFieldScope?: boolean } = {}
  ) => {
    const [operations, telemetry_health, action_overrides, workflow, device_field_map] = await Promise.all([
      listOperationInputsForAlertProjection(auth, { skipFieldScope: opts.skipFieldScope }),
      listTelemetryHealthInputsForAlertProjection(auth, { skipFieldScope: opts.skipFieldScope }),
      listAlertActionOverrides(auth),
      listWorkflowRows(auth),
      listDeviceFieldMap(auth.tenant_id),
    ]);
    const operation_field_map = buildOperationFieldMap(operations);
    const operation_device_map = buildOperationDeviceMap(operations);

    return projectAlertWorkboardV1({
      scope: {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        field_ids: Array.isArray(auth.allowed_field_ids) ? auth.allowed_field_ids : [],
      },
      operations,
      telemetry_health,
      action_overrides,
      workflow: workflow.map((row: any) => ({
        alert_id: String(row.alert_id ?? ""),
        workflow_status: String(row.status ?? "OPEN").trim().toUpperCase() as AlertWorkflowStatusV1,
        assignee_actor_id: row.assignee_actor_id ?? null,
        assignee_name: row.assignee_name ?? null,
        priority: row.priority == null ? null : Number(row.priority),
        sla_due_at: row.sla_due_at == null ? null : Number(row.sla_due_at),
        last_note: row.last_note ?? null,
      })),
      device_field_map,
      operation_field_map,
      operation_device_map,
      filter,
      nowMs: Date.now(),
    });
  };

  const projectWorkboardItems = async (
    auth: AoActAuthContextV0,
    filter: any = {},
    opts: { skipFieldScope?: boolean } = {}
  ) => {
    const injected = (app as any).alertWorkflowProjectWorkboardItems;
    if (typeof injected === "function") return injected(auth, filter, opts);
    return projectWorkboardItemsCore(auth, filter, opts);
  };

  const resolveAlertFieldId = async (auth: AoActAuthContextV0, alert_id: string): Promise<string | null> => {
    const injected = (app as any).alertWorkflowResolveAlertFieldId;
    if (typeof injected === "function") return injected(auth, alert_id);

    const items = await projectWorkboardItemsCore(auth, { object_id: alert_id }, { skipFieldScope: true });
    const target = items.find((it: any) => String(it.alert_id ?? "") === alert_id) ?? null;
    if (!target) return null;
    const objectType = String(target.object_type ?? "").toUpperCase();
    const objectId = String(target.object_id ?? "").trim();
    if (!objectId) return null;
    if (objectType === "FIELD") return objectId;
    if (objectType === "DEVICE") return String(target.field_id ?? "").trim() || null;
    if (objectType === "OPERATION") return String(target.field_id ?? "").trim() || null;
    return null;
  };

  app.get("/api/v1/alerts/workboard", async (req, reply) => {
    const auth = requireScope(req, reply, "alerts.read");
    if (!auth) return reply;
    if (!canRead(auth)) return reply.status(403).send({ ok: false, error: "AUTH_ROLE_DENIED" });
    const query: any = (req.query ?? {});
    const filter = {
      workflow_status: normalizeStatusList(query.workflow_status ?? query.workflowStatus),
      assignee_actor_id: normalizeCsv(query.assignee_actor_id ?? query.assigneeActorId),
      priority_min: query.priority_min != null ? Number(query.priority_min) : null,
      priority_max: query.priority_max != null ? Number(query.priority_max) : null,
      sla_breached: query.sla_breached == null ? null : String(query.sla_breached).toLowerCase() === "true",
    };
    const items = await projectWorkboardItems(auth, filter, { skipFieldScope: false });
    return reply.send({ ok: true, items, total: items.length });
  });

  const writeHandler = async (
    req: any,
    reply: any,
    opts: { status: AlertWorkflowStatus; withAssignedAt?: boolean; withResolvedAt?: boolean; preserveStatus?: boolean }
  ) => {
    const auth = requireScope(req, reply, "alerts.write");
    if (!auth) return reply;
    const alert_id = parseId((req.params as any)?.alert_id);
    if (!alert_id) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const field_id = await resolveAlertFieldId(auth, alert_id); // 1) alert->field relation resolve.
    if (!field_id) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    if (!enforceFieldScopeOrDeny(auth, field_id, reply, { asNotFound: true })) return reply;
    if (!canWrite(auth)) return reply.status(403).send({ ok: false, error: "AUTH_ROLE_DENIED" }); // 2) role.
    const targetItems = await projectWorkboardItems(auth, { object_id: alert_id }, { skipFieldScope: false });
    const target = targetItems.find((it: any) => String(it.alert_id ?? "") === alert_id) ?? null;
    if (!target) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const body: any = req.body ?? {};
    const now = Date.now();
    const hasSlaDueAt = Object.prototype.hasOwnProperty.call(body, "sla_due_at");
    const parsedSlaDueAt = hasSlaDueAt
      ? (body.sla_due_at == null
        ? null
        : (Number.isFinite(Number(body.sla_due_at)) ? Math.trunc(Number(body.sla_due_at)) : null))
      : null;
    const derivedDefaultSlaDueAt = (!hasSlaDueAt && opts.status === "ASSIGNED")
      ? deriveDefaultSlaDueAt({ severity: target.severity, triggeredAt: target.triggered_at })
      : null;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const cur = await client.query(
        `SELECT status, version FROM alert_workflow_v1 WHERE tenant_id = $1 AND alert_id = $2 LIMIT 1`,
        [auth.tenant_id, alert_id]
      );
      const currentStatus = String(cur.rows?.[0]?.status ?? "OPEN").trim().toUpperCase() as AlertWorkflowStatus;
      const currentVersion = Number(cur.rows?.[0]?.version ?? 0);
      const result = await upsertAlertWorkflowV1(client, {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        alert_id,
        status: opts.preserveStatus ? currentStatus : opts.status,
        assignee_actor_id: parseId(body.assignee_actor_id) ?? null,
        assignee_name: typeof body.assignee_name === "string" ? body.assignee_name.trim() || null : null,
        priority: body.priority == null ? null : Math.max(1, Math.trunc(Number(body.priority))),
        sla_due_at: hasSlaDueAt ? parsedSlaDueAt : derivedDefaultSlaDueAt,
        assigned_at: opts.withAssignedAt ? now : null,
        resolved_at: opts.withResolvedAt ? now : null,
        last_note: typeof body.note === "string" ? body.note.trim() || null : null,
        updated_by: auth.actor_id,
        updated_at: now,
        expected_version: body.expected_version == null ? currentVersion : Number(body.expected_version),
      });
      if (!result.ok) {
        await client.query("ROLLBACK");
        const code = result.error === "WORKFLOW_VERSION_CONFLICT" ? 409 : 400;
        return reply.status(code).send({ ok: false, error: result.error, detail: result.detail ?? null });
      }
      await client.query("COMMIT");
      return reply.send({
        ok: true,
        alert_id,
        workflow_status: result.status,
        version: result.version,
        updated_by: auth.actor_id,
        updated_at: now,
      });
    } catch (err: any) {
      try { await client.query("ROLLBACK"); } catch {}
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(err?.message ?? err) });
    } finally {
      client.release();
    }
  };

  app.post("/api/v1/alerts/:alert_id/assign", async (req, reply) => writeHandler(req, reply, { status: "ASSIGNED", withAssignedAt: true }));
  app.post("/api/v1/alerts/:alert_id/start", async (req, reply) => writeHandler(req, reply, { status: "IN_PROGRESS" }));
  app.post("/api/v1/alerts/:alert_id/note", async (req, reply) => writeHandler(req, reply, { status: "OPEN", preserveStatus: true }));
  app.post("/api/v1/alerts/:alert_id/resolve", async (req, reply) => writeHandler(req, reply, { status: "RESOLVED", withResolvedAt: true }));
  app.post("/api/v1/alerts/:alert_id/close", async (req, reply) => writeHandler(req, reply, { status: "CLOSED" }));
}
