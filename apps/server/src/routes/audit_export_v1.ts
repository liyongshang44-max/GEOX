import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0";

type AuditObjectType = "ALL" | "EXPORT" | "ALERT" | "RECEIPT" | "APPROVAL" | "DISPATCH";

type DeviceBindingMaps = {
  deviceToField: Map<string, string>;
  fieldToDevices: Map<string, Set<string>>;
};

function badRequest(reply: any, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function parseLimit(q: any, fallback = 10, max = 50): number {
  const raw = Number(q?.limit ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(raw)));
}

function parseWindowStart(q: any): number {
  const raw = Number(q?.from_ts_ms ?? Date.now() - 7 * 24 * 60 * 60 * 1000);
  return Number.isFinite(raw) ? raw : Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function parseWindowEnd(q: any): number {
  const raw = Number(q?.to_ts_ms ?? Date.now() + 60 * 1000);
  return Number.isFinite(raw) ? raw : Date.now() + 60 * 1000;
}

function parseObjectType(q: any): AuditObjectType {
  const raw = String(q?.object_type ?? "ALL").trim().toUpperCase();
  if (["EXPORT", "ALERT", "RECEIPT", "APPROVAL", "DISPATCH"].includes(raw)) return raw as AuditObjectType;
  return "ALL";
}

function normalizeId(v: any): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 128) return null;
  if (!/^[A-Za-z0-9_\-:.]+$/.test(s)) return null;
  return s;
}

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function parseJsonMaybe(v: any): any {
  if (v == null) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try { return JSON.parse(v); } catch { return null; }
}

function shouldIncludeDataset(objectType: AuditObjectType, dataset: AuditObjectType): boolean {
  return objectType === "ALL" || objectType === dataset;
}

function extractApprovalFieldId(request: any): string | null {
  const proposal = request?.payload?.proposal ?? {};
  const target = proposal?.target ?? request?.payload?.target ?? null;
  if (typeof target === "string") {
    const m = target.match(/^field:([A-Za-z0-9_\-:.]+)$/i);
    if (m) return m[1];
  }
  if (target && typeof target === "object") {
    const ref = normalizeId(target.ref ?? target.id ?? null);
    const kind = String(target.kind ?? "").trim().toUpperCase();
    if (kind === "FIELD" || kind === "field") return ref;
  }
  return null;
}

function extractReceiptDeviceId(receipt: any): string | null {
  return normalizeId(receipt?.payload?.device_id ?? receipt?.device_id ?? null);
}

async function loadBindingMaps(pool: Pool, tenantId: string): Promise<DeviceBindingMaps> {
  const q = await pool.query(
    `SELECT device_id, field_id
       FROM device_binding_index_v1
      WHERE tenant_id = $1`,
    [tenantId]
  );
  const deviceToField = new Map<string, string>();
  const fieldToDevices = new Map<string, Set<string>>();
  for (const row of q.rows ?? []) {
    const deviceId = normalizeId(row.device_id);
    const fieldId = normalizeId(row.field_id);
    if (!deviceId || !fieldId) continue;
    deviceToField.set(deviceId, fieldId);
    const bucket = fieldToDevices.get(fieldId) ?? new Set<string>();
    bucket.add(deviceId);
    fieldToDevices.set(fieldId, bucket);
  }
  return { deviceToField, fieldToDevices };
}

export function registerAuditExportV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/audit-export/overview", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const q: any = (req as any).query ?? {};
    const field_id = normalizeId(q.field_id);
    const device_id = normalizeId(q.device_id);
    const object_type = parseObjectType(q);
    const limit = parseLimit(q);
    const from_ts_ms = parseWindowStart(q);
    const to_ts_ms = parseWindowEnd(q);
    if (to_ts_ms <= from_ts_ms) return badRequest(reply, "INVALID_TIME_WINDOW");

    const tenant_id = String(auth.tenant_id ?? "");
    const project_id = String(auth.project_id ?? "");
    const group_id = String(auth.group_id ?? "");

    const bindings = await loadBindingMaps(pool, tenant_id);
    const scopedDeviceIds = field_id ? Array.from(bindings.fieldToDevices.get(field_id) ?? []) : [];

    const export_jobs = shouldIncludeDataset(object_type, "EXPORT")
      ? await (async () => {
          const res = await pool.query(
            `SELECT job_id, scope_type, scope_id, status, created_ts_ms, updated_ts_ms, artifact_path, artifact_sha256, error
               FROM evidence_export_job_index_v1
              WHERE tenant_id = $1
                AND updated_ts_ms >= $2
                AND updated_ts_ms <= $3
              ORDER BY updated_ts_ms DESC
              LIMIT $4`,
            [tenant_id, from_ts_ms, to_ts_ms, limit * 3]
          );
          return (res.rows ?? []).filter((row: any) => {
            const scopeType = String(row.scope_type ?? "").toUpperCase();
            const scopeId = normalizeId(row.scope_id);
            if (device_id && !(scopeType === "DEVICE" && scopeId === device_id)) return false;
            if (field_id) {
              if (scopeType === "FIELD" && scopeId === field_id) return true;
              if (scopeType === "DEVICE" && scopeId && scopedDeviceIds.includes(scopeId)) return true;
              return false;
            }
            return true;
          }).slice(0, limit).map((row: any) => ({
            job_id: String(row.job_id),
            scope_type: String(row.scope_type),
            scope_id: row.scope_id ? String(row.scope_id) : null,
            status: String(row.status),
            created_ts_ms: Number(row.created_ts_ms),
            updated_ts_ms: Number(row.updated_ts_ms),
            artifact_path: row.artifact_path ? String(row.artifact_path) : null,
            artifact_sha256: row.artifact_sha256 ? String(row.artifact_sha256) : null,
            error: row.error ? String(row.error) : null,
          }));
        })()
      : [];

    const alert_events = shouldIncludeDataset(object_type, "ALERT")
      ? await (async () => {
          const res = await pool.query(
            `SELECT event_id, rule_id, object_type, object_id, metric, status, raised_ts_ms, acked_ts_ms, closed_ts_ms, last_value_json
               FROM alert_event_index_v1
              WHERE tenant_id = $1
                AND raised_ts_ms >= $2
                AND raised_ts_ms <= $3
              ORDER BY raised_ts_ms DESC
              LIMIT $4`,
            [tenant_id, from_ts_ms, to_ts_ms, limit * 3]
          );
          return (res.rows ?? []).filter((row: any) => {
            const objType = String(row.object_type ?? "").toUpperCase();
            const objId = normalizeId(row.object_id);
            if (device_id && !(objType === "DEVICE" && objId === device_id)) return false;
            if (field_id && !((objType === "FIELD" && objId === field_id) || (objType === "DEVICE" && objId && scopedDeviceIds.includes(objId)))) return false;
            return true;
          }).slice(0, limit).map((row: any) => ({
            event_id: String(row.event_id),
            rule_id: String(row.rule_id),
            object_type: String(row.object_type),
            object_id: String(row.object_id),
            metric: String(row.metric),
            status: String(row.status),
            raised_ts_ms: Number(row.raised_ts_ms),
            acked_ts_ms: row.acked_ts_ms == null ? null : Number(row.acked_ts_ms),
            closed_ts_ms: row.closed_ts_ms == null ? null : Number(row.closed_ts_ms),
            last_value_json: row.last_value_json == null ? null : String(row.last_value_json),
          }));
        })()
      : [];

    const approvals = shouldIncludeDataset(object_type, "APPROVAL")
      ? await (async () => {
          const res = await pool.query(
            `WITH reqs AS (
               SELECT occurred_at, fact_id, source, (record_json::jsonb) AS record_json
                 FROM facts
                WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
                  AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
                  AND (record_json::jsonb#>>'{payload,project_id}') = $2
                  AND (record_json::jsonb#>>'{payload,group_id}') = $3
                  AND occurred_at >= $4::timestamptz
                  AND occurred_at <= $5::timestamptz
             ),
             latest_decision AS (
               SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,request_id}'))
                      (record_json::jsonb#>>'{payload,request_id}') AS request_id,
                      occurred_at,
                      fact_id,
                      (record_json::jsonb) AS record_json
                 FROM facts
                WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
                  AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
                  AND (record_json::jsonb#>>'{payload,project_id}') = $2
                  AND (record_json::jsonb#>>'{payload,group_id}') = $3
                ORDER BY (record_json::jsonb#>>'{payload,request_id}'), occurred_at DESC, fact_id DESC
             )
             SELECT r.fact_id, r.occurred_at, r.source, r.record_json, d.record_json AS decision_json
               FROM reqs r
               LEFT JOIN latest_decision d
                 ON (r.record_json#>>'{payload,request_id}') = d.request_id
              ORDER BY r.occurred_at DESC, r.fact_id DESC
              LIMIT $6`,
            [tenant_id, project_id, group_id, isoFromMs(from_ts_ms), isoFromMs(to_ts_ms), limit * 3]
          );
          return (res.rows ?? []).map((row: any) => {
            const request = parseJsonMaybe(row.record_json) ?? row.record_json;
            const decision = parseJsonMaybe(row.decision_json);
            const approvalFieldId = extractApprovalFieldId(request);
            return {
              request_id: String(request?.payload?.request_id ?? ""),
              status: String(decision?.payload?.decision ?? request?.payload?.status ?? "PENDING"),
              occurred_at: String(row.occurred_at),
              request_fact_id: String(row.fact_id),
              decision_fact_id: decision?.payload?.decision_id ? String(decision.payload.decision_id) : null,
              act_task_id: normalizeId(decision?.payload?.act_task_id ?? null),
              action_type: request?.payload?.proposal?.action_type ? String(request.payload.proposal.action_type) : null,
              target: request?.payload?.proposal?.target ?? null,
              field_id: approvalFieldId,
              request,
              decision,
            };
          }).filter((row: any) => {
            if (field_id && row.field_id !== field_id) return false;
            if (device_id) return false;
            return true;
          }).slice(0, limit);
        })()
      : [];

    const dispatches = shouldIncludeDataset(object_type, "DISPATCH")
      ? await (async () => {
          const res = await pool.query(
            `SELECT fact_id, occurred_at, source, (record_json::jsonb) AS record_json
               FROM facts
              WHERE (record_json::jsonb->>'type') = 'ao_act_task_dispatched_v1'
                AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
                AND (record_json::jsonb#>>'{payload,project_id}') = $2
                AND (record_json::jsonb#>>'{payload,group_id}') = $3
                AND occurred_at >= $4::timestamptz
                AND occurred_at <= $5::timestamptz
              ORDER BY occurred_at DESC, fact_id DESC
              LIMIT $6`,
            [tenant_id, project_id, group_id, isoFromMs(from_ts_ms), isoFromMs(to_ts_ms), limit * 3]
          );
          return (res.rows ?? []).map((row: any) => {
            const dispatch = parseJsonMaybe(row.record_json) ?? row.record_json;
            const did = normalizeId(dispatch?.payload?.device_id ?? dispatch?.entity?.device_id ?? null);
            return {
              fact_id: String(row.fact_id),
              occurred_at: String(row.occurred_at),
              act_task_id: normalizeId(dispatch?.payload?.act_task_id ?? null),
              action_type: dispatch?.payload?.action_type ? String(dispatch.payload.action_type) : null,
              device_id: did,
              field_id: did ? bindings.deviceToField.get(did) ?? null : null,
              dispatch,
            };
          }).filter((row: any) => {
            if (device_id && row.device_id !== device_id) return false;
            if (field_id && row.field_id !== field_id) return false;
            return true;
          }).slice(0, limit);
        })()
      : [];

    const receipts = shouldIncludeDataset(object_type, "RECEIPT")
  ? await (async () => {
      const dispatchLookupQ = await pool.query(
        `SELECT
            (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
            (record_json::jsonb#>>'{payload,device_id}') AS device_id
           FROM facts
          WHERE (record_json::jsonb->>'type') = 'ao_act_task_dispatched_v1'
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,project_id}') = $2
            AND (record_json::jsonb#>>'{payload,group_id}') = $3`,
        [tenant_id, project_id, group_id]
      );

      const dispatchByTask = new Map<string, string>();
      for (const row of dispatchLookupQ.rows ?? []) {
        const taskId = normalizeId(row.act_task_id);
        const deviceId = normalizeId(row.device_id);
        if (!taskId || !deviceId) continue;
        if (!dispatchByTask.has(taskId)) {
          dispatchByTask.set(taskId, deviceId);
        }
      }

      const res = await pool.query(
        `SELECT fact_id, occurred_at, source, (record_json::jsonb) AS record_json
           FROM facts
          WHERE (record_json::jsonb->>'type') = 'ao_act_receipt_v0'
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,project_id}') = $2
            AND (record_json::jsonb#>>'{payload,group_id}') = $3
            AND occurred_at >= $4::timestamptz
            AND occurred_at <= $5::timestamptz
          ORDER BY occurred_at DESC, fact_id DESC
          LIMIT $6`,
        [tenant_id, project_id, group_id, isoFromMs(from_ts_ms), isoFromMs(to_ts_ms), limit * 3]
      );

      return (res.rows ?? []).map((row: any) => {
        const receipt = parseJsonMaybe(row.record_json) ?? row.record_json;
        const actTaskId = normalizeId(receipt?.payload?.act_task_id ?? null);
        const payloadDeviceId = extractReceiptDeviceId(receipt);
        const dispatchDeviceId = actTaskId ? (dispatchByTask.get(actTaskId) ?? null) : null;
        const resolvedDeviceId = payloadDeviceId ?? dispatchDeviceId;

        return {
          fact_id: String(row.fact_id),
          occurred_at: String(row.occurred_at),
          source: String(row.source),
          act_task_id: actTaskId,
          device_id: resolvedDeviceId,
          field_id: resolvedDeviceId ? (bindings.deviceToField.get(resolvedDeviceId) ?? null) : null,
          status: String(receipt?.payload?.status ?? "unknown"),
          receipt,
        };
      }).filter((row: any) => {
        if (device_id && row.device_id !== device_id) return false;
        if (field_id && row.field_id !== field_id) return false;
        return true;
      }).slice(0, limit);
    })()
  : [];

    return reply.send({
      ok: true,
      filters: {
        field_id: field_id ?? null,
        device_id: device_id ?? null,
        object_type,
        from_ts_ms,
        to_ts_ms,
        limit,
      },
      summary: {
        export_job_count: export_jobs.length,
        alert_event_count: alert_events.length,
        open_alert_count: alert_events.filter((x: any) => String(x.status) === "OPEN").length,
        approval_count: approvals.length,
        dispatch_count: dispatches.length,
        receipt_count: receipts.length,
      },
      export_jobs,
      alert_events,
      approvals,
      dispatches,
      receipts,
    });
  });
}