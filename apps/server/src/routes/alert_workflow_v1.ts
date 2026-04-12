import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";

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
  app.addHook("onReady", async () => { await ensureAlertWorkflowV1Schema(pool); });
}
