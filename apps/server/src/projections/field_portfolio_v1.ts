import type { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

export type FieldPortfolioRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type FieldPortfolioItemV1 = {
  field_id: string;
  field_name: string | null;
  tags: string[];
  risk: {
    level: FieldPortfolioRiskLevel;
    reasons: string[];
  };
  alert_summary: {
    open_count: number;
    high_or_above_count: number;
  };
  pending_acceptance_summary: {
    pending_acceptance_count: number;
    invalid_execution_count: number;
  };
  latest_operation: {
    happened_at: string | null;
    action_type: string | null;
    status: string | null;
  };
  cost_summary: {
    estimated_total: number;
    actual_total: number;
  };
  telemetry: {
    last_telemetry_at: string | null;
    device_offline: boolean;
  };
};

export type FieldPortfolioListResponseV1 = {
  ok: true;
  count: number;
  items: FieldPortfolioItemV1[];
  summary: {
    total_fields: number;
    by_risk: { low: number; medium: number; high: number };
    total_open_alerts: number;
    total_pending_acceptance: number;
    total_invalid_execution: number;
    total_estimated_cost: number;
    total_actual_cost: number;
    offline_fields: number;
  };
};

export type ProjectFieldPortfolioListV1Args = {
  pool: Pool;
  tenant: TenantTriple;
  field_ids?: string[];
  nowMs?: number;
  windowMs?: number;
};

const RISK_RANK: Record<FieldPortfolioRiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const ALERT_SEVERITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toMs(v: unknown): number {
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? t : 0;
}

function toIsoOrNull(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

function normalizeRiskLevel(raw: unknown): FieldPortfolioRiskLevel {
  const v = str(raw).toUpperCase();
  if (v === "HIGH") return "HIGH";
  if (v === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function maxRisk(a: FieldPortfolioRiskLevel, b: FieldPortfolioRiskLevel): FieldPortfolioRiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

function normalizeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => str(x)).filter(Boolean);
}

export async function projectFieldPortfolioListV1(args: ProjectFieldPortfolioListV1Args): Promise<FieldPortfolioListResponseV1> {
  const nowMs = Number.isFinite(args.nowMs) ? Number(args.nowMs) : Date.now();
  const windowMs = Number.isFinite(args.windowMs) ? Math.max(60_000, Number(args.windowMs)) : 30 * 24 * 60 * 60 * 1000;
  const windowStartMs = nowMs - windowMs;

  const scopedFieldIds = Array.from(new Set((args.field_ids ?? []).map((x) => str(x)).filter(Boolean)));

  const fieldQ = await args.pool.query(
    `SELECT field_id, name
       FROM field_index_v1
      WHERE tenant_id = $1
        AND ($2::text = '' OR project_id = $2)
        AND ($3::text = '' OR group_id = $3)
        AND ($4::text[] IS NULL OR field_id = ANY($4::text[]))`,
    [args.tenant.tenant_id, args.tenant.project_id, args.tenant.group_id, scopedFieldIds.length ? scopedFieldIds : null]
  ).catch(() => ({ rows: [] as any[] }));

  const itemsMap = new Map<string, FieldPortfolioItemV1>();
  for (const row of fieldQ.rows ?? []) {
    const fieldId = str((row as any).field_id);
    if (!fieldId) continue;
    itemsMap.set(fieldId, {
      field_id: fieldId,
      field_name: str((row as any).name) || null,
      tags: [],
      risk: { level: "LOW", reasons: [] },
      alert_summary: { open_count: 0, high_or_above_count: 0 },
      pending_acceptance_summary: { pending_acceptance_count: 0, invalid_execution_count: 0 },
      latest_operation: { happened_at: null, action_type: null, status: null },
      cost_summary: { estimated_total: 0, actual_total: 0 },
      telemetry: { last_telemetry_at: null, device_offline: false },
    });
  }

  const opQ = await args.pool.query(
    `SELECT operation_plan_id, operation_id, field_id, action_type, status, updated_ts_ms
       FROM operation_plan_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND ($4::text[] IS NULL OR field_id = ANY($4::text[]))`,
    [args.tenant.tenant_id, args.tenant.project_id, args.tenant.group_id, scopedFieldIds.length ? scopedFieldIds : null]
  ).catch(() => ({ rows: [] as any[] }));

  const opByField = new Map<string, string[]>();
  const allOperationIds: string[] = [];
  for (const row of opQ.rows ?? []) {
    const fieldId = str((row as any).field_id);
    if (!fieldId) continue;
    if (!itemsMap.has(fieldId)) {
      itemsMap.set(fieldId, {
        field_id: fieldId,
        field_name: null,
        tags: [],
        risk: { level: "LOW", reasons: [] },
        alert_summary: { open_count: 0, high_or_above_count: 0 },
        pending_acceptance_summary: { pending_acceptance_count: 0, invalid_execution_count: 0 },
        latest_operation: { happened_at: null, action_type: null, status: null },
        cost_summary: { estimated_total: 0, actual_total: 0 },
        telemetry: { last_telemetry_at: null, device_offline: false },
      });
    }

    const operationId = str((row as any).operation_id) || str((row as any).operation_plan_id);
    if (!operationId) continue;
    const arr = opByField.get(fieldId) ?? [];
    arr.push(operationId);
    opByField.set(fieldId, arr);
    allOperationIds.push(operationId);

    const opUpdatedMs = toNum((row as any).updated_ts_ms);
    const item = itemsMap.get(fieldId)!;
    const curLatestMs = toMs(item.latest_operation.happened_at);
    if (opUpdatedMs >= curLatestMs) {
      item.latest_operation = {
        happened_at: toIsoOrNull(opUpdatedMs),
        action_type: str((row as any).action_type) || null,
        status: str((row as any).status) || null,
      };
    }
  }

  const factQ = allOperationIds.length > 0
    ? await args.pool.query(
      `SELECT occurred_at, (record_json::jsonb) AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'operation_report_v1'
          AND (record_json::jsonb#>>'{identifiers,tenant_id}') = $1
          AND (record_json::jsonb#>>'{identifiers,project_id}') = $2
          AND (record_json::jsonb#>>'{identifiers,group_id}') = $3
          AND (
            (record_json::jsonb#>>'{identifiers,operation_id}') = ANY($4::text[])
            OR (record_json::jsonb#>>'{identifiers,operation_plan_id}') = ANY($4::text[])
          )
        ORDER BY occurred_at DESC`,
      [args.tenant.tenant_id, args.tenant.project_id, args.tenant.group_id, Array.from(new Set(allOperationIds))]
    ).catch(() => ({ rows: [] as any[] }))
    : { rows: [] as any[] };

  const latestReportRiskByField = new Map<string, { level: FieldPortfolioRiskLevel; reasons: string[]; ts: number }>();
  for (const row of factQ.rows ?? []) {
    const rec = (row as any).record_json ?? {};
    const fieldId = str(rec?.identifiers?.field_id);
    if (!fieldId || !itemsMap.has(fieldId)) continue;
    const ts = toMs((row as any).occurred_at) || toMs(rec.generated_at);
    const level = normalizeRiskLevel(rec?.risk?.level);
    const reasons = normalizeList(rec?.risk?.reasons);

    const prev = latestReportRiskByField.get(fieldId);
    if (!prev || ts > prev.ts) latestReportRiskByField.set(fieldId, { level, reasons, ts });

    if (ts >= windowStartMs) {
      const item = itemsMap.get(fieldId)!;
      const finalStatus = str(rec?.execution?.final_status).toUpperCase();
      if (finalStatus === "PENDING_ACCEPTANCE") item.pending_acceptance_summary.pending_acceptance_count += 1;
      if (finalStatus === "INVALID_EXECUTION") item.pending_acceptance_summary.invalid_execution_count += 1;
      item.cost_summary.estimated_total += toNum(rec?.cost?.estimated_total);
      item.cost_summary.actual_total += toNum(rec?.cost?.actual_total);

      const opFinished = toMs(rec?.execution?.execution_finished_at);
      const opGenerated = toMs(rec?.generated_at);
      const opTs = opFinished || opGenerated;
      if (opTs >= toMs(item.latest_operation.happened_at)) {
        item.latest_operation = {
          happened_at: toIsoOrNull(opTs),
          action_type: str(rec?.execution?.action_type) || item.latest_operation.action_type,
          status: finalStatus || item.latest_operation.status,
        };
      }
    }
  }

  const alertQ = await args.pool.query(
    `SELECT object_type, object_id, severity, status, category, COALESCE(reasons, ARRAY[]::text[]) AS reasons, raised_ts_ms
       FROM alert_event_index_v1
      WHERE tenant_id = $1
        AND status IN ('OPEN', 'ACKED')
        AND ($2::text[] IS NULL OR (
          (object_type = 'FIELD' AND object_id = ANY($2::text[]))
          OR (object_type = 'DEVICE' AND object_id IN (
            SELECT device_id FROM device_binding_index_v1 WHERE tenant_id = $1 AND field_id = ANY($2::text[])
          ))
        ))`,
    [args.tenant.tenant_id, scopedFieldIds.length ? scopedFieldIds : null]
  ).catch(() => ({ rows: [] as any[] }));

  const deviceFieldQ = await args.pool.query(
    `SELECT d.device_id, COALESCE(d.field_id, b.field_id) AS field_id,
            d.last_telemetry_ts_ms, d.last_heartbeat_ts_ms
       FROM device_status_index_v1 d
       LEFT JOIN device_binding_index_v1 b
         ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
      WHERE d.tenant_id = $1
        AND ($2::text[] IS NULL OR COALESCE(d.field_id, b.field_id) = ANY($2::text[]))`,
    [args.tenant.tenant_id, scopedFieldIds.length ? scopedFieldIds : null]
  ).catch(() => ({ rows: [] as any[] }));

  const deviceToField = new Map<string, string>();
  for (const row of deviceFieldQ.rows ?? []) {
    const fieldId = str((row as any).field_id);
    const deviceId = str((row as any).device_id);
    if (!fieldId || !deviceId || !itemsMap.has(fieldId)) continue;
    deviceToField.set(deviceId, fieldId);

    const item = itemsMap.get(fieldId)!;
    const lastTelemetryMs = toNum((row as any).last_telemetry_ts_ms);
    if (lastTelemetryMs >= toMs(item.telemetry.last_telemetry_at)) {
      item.telemetry.last_telemetry_at = toIsoOrNull(lastTelemetryMs);
    }
    const lastHeartbeatMs = toNum((row as any).last_heartbeat_ts_ms);
    const isOffline = !(lastHeartbeatMs > 0 && (nowMs - lastHeartbeatMs) <= 15 * 60 * 1000);
    item.telemetry.device_offline = item.telemetry.device_offline || isOffline;
  }

  const fieldsInScope = [...itemsMap.keys()];
  const fieldTagMap = new Map<string, string[]>();
  if (fieldsInScope.length > 0) {
    const tagQ = await args.pool.query(
      `SELECT field_id, tag
         FROM field_tags_v1
        WHERE tenant_id = $1
          AND ($2::text = '' OR project_id = $2)
          AND ($3::text = '' OR group_id = $3)
          AND field_id = ANY($4::text[])`,
      [args.tenant.tenant_id, args.tenant.project_id, args.tenant.group_id, fieldsInScope]
    ).catch(() => ({ rows: [] as any[] }));

    for (const row of tagQ.rows ?? []) {
      const fieldId = str((row as any).field_id);
      const tag = str((row as any).tag);
      if (!fieldId || !tag || !itemsMap.has(fieldId)) continue;
      const current = fieldTagMap.get(fieldId) ?? [];
      if (!current.includes(tag)) current.push(tag);
      fieldTagMap.set(fieldId, current);
    }
  }

  const alertRiskByField = new Map<string, FieldPortfolioRiskLevel>();
  const alertReasonByField = new Map<string, Set<string>>();
  for (const row of alertQ.rows ?? []) {
    const objectType = str((row as any).object_type).toUpperCase();
    const objectId = str((row as any).object_id);
    const fieldId = objectType === "FIELD" ? objectId : (objectType === "DEVICE" ? (deviceToField.get(objectId) ?? "") : "");
    if (!fieldId || !itemsMap.has(fieldId)) continue;

    const item = itemsMap.get(fieldId)!;
    item.alert_summary.open_count += 1;
    const sev = str((row as any).severity).toUpperCase();
    if ((ALERT_SEVERITY_RANK[sev] ?? 0) >= ALERT_SEVERITY_RANK.HIGH) item.alert_summary.high_or_above_count += 1;

    const riskFromAlert: FieldPortfolioRiskLevel = (sev === "CRITICAL" || sev === "HIGH") ? "HIGH" : (sev === "MEDIUM" ? "MEDIUM" : "LOW");
    alertRiskByField.set(fieldId, maxRisk(alertRiskByField.get(fieldId) ?? "LOW", riskFromAlert));

    const reasonSet = alertReasonByField.get(fieldId) ?? new Set<string>();
    for (const r of normalizeList((row as any).reasons)) {
      if (reasonSet.size >= 3) break;
      reasonSet.add(r);
    }
    alertReasonByField.set(fieldId, reasonSet);
  }

  const resultItems: FieldPortfolioItemV1[] = [...itemsMap.values()].map((item) => {
    const alertLevel = alertRiskByField.get(item.field_id) ?? null;
    const reportRisk = latestReportRiskByField.get(item.field_id);
    const reasonsFromAlerts = [...(alertReasonByField.get(item.field_id) ?? new Set<string>())];
    const reasons = Array.from(new Set([
      ...reasonsFromAlerts,
      ...(reportRisk?.reasons ?? []),
    ])).slice(0, 3);

    return {
      ...item,
      tags: fieldTagMap.get(item.field_id) ?? [],
      risk: {
        level: alertLevel ?? reportRisk?.level ?? "LOW",
        reasons,
      },
      cost_summary: {
        estimated_total: Number(item.cost_summary.estimated_total.toFixed(2)),
        actual_total: Number(item.cost_summary.actual_total.toFixed(2)),
      },
    };
  }).sort((a, b) => {
    const byRisk = RISK_RANK[b.risk.level] - RISK_RANK[a.risk.level];
    if (byRisk !== 0) return byRisk;
    return toMs(b.latest_operation.happened_at) - toMs(a.latest_operation.happened_at);
  });

  const summary = {
    total_fields: resultItems.length,
    by_risk: {
      low: resultItems.filter((x) => x.risk.level === "LOW").length,
      medium: resultItems.filter((x) => x.risk.level === "MEDIUM").length,
      high: resultItems.filter((x) => x.risk.level === "HIGH").length,
    },
    total_open_alerts: resultItems.reduce((s, x) => s + x.alert_summary.open_count, 0),
    total_pending_acceptance: resultItems.reduce((s, x) => s + x.pending_acceptance_summary.pending_acceptance_count, 0),
    total_invalid_execution: resultItems.reduce((s, x) => s + x.pending_acceptance_summary.invalid_execution_count, 0),
    total_estimated_cost: Number(resultItems.reduce((s, x) => s + x.cost_summary.estimated_total, 0).toFixed(2)),
    total_actual_cost: Number(resultItems.reduce((s, x) => s + x.cost_summary.actual_total, 0).toFixed(2)),
    offline_fields: resultItems.filter((x) => x.telemetry.device_offline).length,
  };

  return { ok: true, count: resultItems.length, items: resultItems, summary };
}
