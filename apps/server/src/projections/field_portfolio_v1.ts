import type { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

export type FieldPortfolioRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FieldPortfolioSortBy =
  | "risk"
  | "open_alerts"
  | "pending_acceptance"
  | "last_operation_at"
  | "cost"
  | "updated_at"
  | "field_name";

export type FieldPortfolioItemV1 = {
  field_id: string;
  field_name: string | null;
  group_id: string;
  tags: string[];
  risk_level: FieldPortfolioRiskLevel;
  risk_reasons: string[];
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
  updated_at: string | null;
};

export type FieldPortfolioListResponseV1 = {
  ok: true;
  count: number;
  total: number;
  page: number;
  page_size: number;
  items: FieldPortfolioItemV1[];
  summary: {
    total_fields: number;
    by_risk: { low: number; medium: number; high: number; critical: number };
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
  tags?: string[];
  risk_levels?: FieldPortfolioRiskLevel[];
  has_open_alerts?: boolean;
  has_pending_acceptance?: boolean;
  query?: string;
  sort_by?: FieldPortfolioSortBy;
  sort_order?: "asc" | "desc";
  page?: number;
  page_size?: number;
};

const RISK_RANK: Record<FieldPortfolioRiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

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
  if (v === "CRITICAL") return "CRITICAL";
  if (v === "HIGH") return "HIGH";
  if (v === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function normalizeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => str(x)).filter(Boolean);
}

function cmpNullableString(a: string | null, b: string | null): number {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
}

function maxRisk(a: FieldPortfolioRiskLevel, b: FieldPortfolioRiskLevel): FieldPortfolioRiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

function makeEmptyItem(fieldId: string, fieldName: string | null, groupId: string): FieldPortfolioItemV1 {
  return {
    field_id: fieldId,
    field_name: fieldName,
    group_id: groupId,
    tags: [],
    risk_level: "LOW",
    risk_reasons: [],
    alert_summary: { open_count: 0, high_or_above_count: 0 },
    pending_acceptance_summary: { pending_acceptance_count: 0, invalid_execution_count: 0 },
    latest_operation: { happened_at: null, action_type: null, status: null },
    cost_summary: { estimated_total: 0, actual_total: 0 },
    telemetry: { last_telemetry_at: null, device_offline: false },
    updated_at: null,
  };
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
    [args.tenant.tenant_id, args.tenant.project_id, args.tenant.group_id, scopedFieldIds.length ? scopedFieldIds : null],
  ).catch(() => ({ rows: [] as any[] }));

  const itemsMap = new Map<string, FieldPortfolioItemV1>();
  for (const row of fieldQ.rows ?? []) {
    const fieldId = str((row as any).field_id);
    if (!fieldId) continue;
    itemsMap.set(fieldId, makeEmptyItem(fieldId, str((row as any).name) || null, args.tenant.group_id));
  }

  const opQ = await args.pool.query(
    `SELECT operation_plan_id, operation_id, field_id, action_type, status, updated_ts_ms
       FROM operation_plan_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND ($4::text[] IS NULL OR field_id = ANY($4::text[]))`,
    [args.tenant.tenant_id, args.tenant.project_id, args.tenant.group_id, scopedFieldIds.length ? scopedFieldIds : null],
  ).catch(() => ({ rows: [] as any[] }));

  const allOperationIds: string[] = [];
  for (const row of opQ.rows ?? []) {
    const fieldId = str((row as any).field_id);
    if (!fieldId) continue;
    if (!itemsMap.has(fieldId)) itemsMap.set(fieldId, makeEmptyItem(fieldId, null, args.tenant.group_id));

    const operationId = str((row as any).operation_id) || str((row as any).operation_plan_id);
    if (operationId) allOperationIds.push(operationId);

    const item = itemsMap.get(fieldId)!;
    const opUpdatedMs = toNum((row as any).updated_ts_ms);
    if (opUpdatedMs >= toMs(item.latest_operation.happened_at)) {
      item.latest_operation = {
        happened_at: toIsoOrNull(opUpdatedMs),
        action_type: str((row as any).action_type) || null,
        status: str((row as any).status) || null,
      };
    }
    if (opUpdatedMs >= toMs(item.updated_at)) item.updated_at = toIsoOrNull(opUpdatedMs);
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
      [args.tenant.tenant_id, args.tenant.project_id, args.tenant.group_id, Array.from(new Set(allOperationIds))],
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

    if (ts < windowStartMs) continue;

    const item = itemsMap.get(fieldId)!;
    const finalStatus = str(rec?.execution?.final_status).toUpperCase();
    if (finalStatus === "PENDING_ACCEPTANCE") item.pending_acceptance_summary.pending_acceptance_count += 1;
    if (finalStatus === "INVALID_EXECUTION") item.pending_acceptance_summary.invalid_execution_count += 1;

    item.cost_summary.estimated_total += toNum(rec?.cost?.estimated_total);
    item.cost_summary.actual_total += toNum(rec?.cost?.actual_total);

    const opTs = toMs(rec?.execution?.execution_finished_at) || toMs(rec?.generated_at);
    if (opTs >= toMs(item.latest_operation.happened_at)) {
      item.latest_operation = {
        happened_at: toIsoOrNull(opTs),
        action_type: str(rec?.execution?.action_type) || item.latest_operation.action_type,
        status: finalStatus || item.latest_operation.status,
      };
    }
    if (opTs >= toMs(item.updated_at)) item.updated_at = toIsoOrNull(opTs);
  }

  const alertQ = await args.pool.query(
    `SELECT object_type, object_id, severity, status, raised_ts_ms
       FROM alert_event_index_v1
      WHERE tenant_id = $1
        AND status IN ('OPEN', 'ACKED')
        AND ($2::text[] IS NULL OR (
          (object_type = 'FIELD' AND object_id = ANY($2::text[]))
          OR (object_type = 'DEVICE' AND object_id IN (
            SELECT device_id FROM device_binding_index_v1 WHERE tenant_id = $1 AND field_id = ANY($2::text[])
          ))
        ))`,
    [args.tenant.tenant_id, scopedFieldIds.length ? scopedFieldIds : null],
  ).catch(() => ({ rows: [] as any[] }));

  const deviceFieldQ = await args.pool.query(
    `SELECT d.device_id, COALESCE(d.field_id, b.field_id) AS field_id,
            d.last_telemetry_ts_ms, d.last_heartbeat_ts_ms
       FROM device_status_index_v1 d
       LEFT JOIN device_binding_index_v1 b
         ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
      WHERE d.tenant_id = $1
        AND ($2::text[] IS NULL OR COALESCE(d.field_id, b.field_id) = ANY($2::text[]))`,
    [args.tenant.tenant_id, scopedFieldIds.length ? scopedFieldIds : null],
  ).catch(() => ({ rows: [] as any[] }));

  const deviceToField = new Map<string, string>();
  for (const row of deviceFieldQ.rows ?? []) {
    const fieldId = str((row as any).field_id);
    const deviceId = str((row as any).device_id);
    if (!fieldId || !deviceId || !itemsMap.has(fieldId)) continue;
    deviceToField.set(deviceId, fieldId);

    const item = itemsMap.get(fieldId)!;
    const telemetryMs = Math.max(toNum((row as any).last_telemetry_ts_ms), toNum((row as any).last_heartbeat_ts_ms));
    if (telemetryMs >= toMs(item.telemetry.last_telemetry_at)) item.telemetry.last_telemetry_at = toIsoOrNull(telemetryMs);

    const lastHeartbeatMs = toNum((row as any).last_heartbeat_ts_ms);
    const isOffline = !(lastHeartbeatMs > 0 && (nowMs - lastHeartbeatMs) <= 15 * 60 * 1000);
    item.telemetry.device_offline = item.telemetry.device_offline || isOffline;

    if (telemetryMs >= toMs(item.updated_at)) item.updated_at = toIsoOrNull(telemetryMs);
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
      [args.tenant.tenant_id, args.tenant.project_id, args.tenant.group_id, fieldsInScope],
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
    if (sev === "HIGH" || sev === "CRITICAL") item.alert_summary.high_or_above_count += 1;

    const riskFromAlert: FieldPortfolioRiskLevel = sev === "CRITICAL" ? "CRITICAL" : (sev === "HIGH" ? "HIGH" : (sev === "MEDIUM" ? "MEDIUM" : "LOW"));
    alertRiskByField.set(fieldId, maxRisk(alertRiskByField.get(fieldId) ?? "LOW", riskFromAlert));

    const reasonSet = alertReasonByField.get(fieldId) ?? new Set<string>();
    for (const r of normalizeList((row as any).reasons)) {
      if (reasonSet.size >= 3) break;
      reasonSet.add(r);
    }
    alertReasonByField.set(fieldId, reasonSet);

  }

  const riskLevelFilter = new Set((args.risk_levels ?? []).map((x) => normalizeRiskLevel(x)));
  const tagsFilter = new Set((args.tags ?? []).map((x) => str(x).toLowerCase()).filter(Boolean));
  const queryNeedle = str(args.query).toLowerCase();

  const filteredItems = [...itemsMap.values()].map((item) => {
    const reportRisk = latestReportRiskByField.get(item.field_id);
    const alertLevel = alertRiskByField.get(item.field_id) ?? "LOW";
    const reasonsFromAlerts = [...(alertReasonByField.get(item.field_id) ?? new Set<string>())];
    const reasons = Array.from(new Set([
      ...reasonsFromAlerts,
      ...(reportRisk?.reasons ?? []),
    ])).slice(0, 3);

    const fieldTags = fieldTagMap.get(item.field_id) ?? [];
    return {
      ...item,
      tags: fieldTags,
      risk_level: maxRisk(alertLevel, reportRisk?.level ?? "LOW"),
      risk_reasons: reasons,
      cost_summary: {
        estimated_total: Number(item.cost_summary.estimated_total.toFixed(2)),
        actual_total: Number(item.cost_summary.actual_total.toFixed(2)),
      },
    };
  }).filter((item) => {
    if (tagsFilter.size > 0) {
      const tagSet = new Set<string>(item.tags.map((tag) => str(tag).toLowerCase()).filter(Boolean));
      const hit = [...tagsFilter].some((tag) => tagSet.has(tag));
      if (!hit) return false;
    }
    if (riskLevelFilter.size > 0 && !riskLevelFilter.has(item.risk_level)) return false;

    if (typeof args.has_open_alerts === "boolean") {
      const hasOpenAlerts = item.alert_summary.open_count > 0;
      if (hasOpenAlerts !== args.has_open_alerts) return false;
    }
    if (typeof args.has_pending_acceptance === "boolean") {
      const hasPending = item.pending_acceptance_summary.pending_acceptance_count > 0;
      if (hasPending !== args.has_pending_acceptance) return false;
    }
    if (queryNeedle) {
      const name = str(item.field_name).toLowerCase();
      const id = str(item.field_id).toLowerCase();
      if (!name.includes(queryNeedle) && !id.includes(queryNeedle)) return false;
    }
    return true;
  });

  const sortBy = args.sort_by ?? "risk";
  const direction = args.sort_order === "asc" ? 1 : -1;

  const sortedItems = filteredItems.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "field_name":
        cmp = cmpNullableString(a.field_name, b.field_name);
        break;
      case "open_alerts":
        cmp = a.alert_summary.open_count - b.alert_summary.open_count;
        break;
      case "pending_acceptance":
        cmp = a.pending_acceptance_summary.pending_acceptance_count - b.pending_acceptance_summary.pending_acceptance_count;
        break;
      case "last_operation_at":
        cmp = toMs(a.latest_operation.happened_at) - toMs(b.latest_operation.happened_at);
        break;
      case "cost":
        cmp = a.cost_summary.estimated_total - b.cost_summary.estimated_total;
        break;
      case "updated_at":
        cmp = toMs(a.updated_at) - toMs(b.updated_at);
        break;
      case "risk":
      default:
        cmp = RISK_RANK[a.risk_level] - RISK_RANK[b.risk_level];
        break;
    }
    if (cmp !== 0) return cmp * direction;
    return cmpNullableString(a.field_id, b.field_id);
  });

  const total = sortedItems.length;
  const page = Number.isFinite(args.page) ? Math.max(1, Math.floor(Number(args.page))) : 1;
  const pageSize = Number.isFinite(args.page_size) ? Math.max(1, Math.min(200, Math.floor(Number(args.page_size)))) : 20;
  const start = (page - 1) * pageSize;
  const items = sortedItems.slice(start, start + pageSize);

  return {
    ok: true,
    count: items.length,
    total,
    page,
    page_size: pageSize,
    items,
    summary: {
      total_fields: total,
      by_risk: {
        low: sortedItems.filter((x) => x.risk_level === "LOW").length,
        medium: sortedItems.filter((x) => x.risk_level === "MEDIUM").length,
        high: sortedItems.filter((x) => x.risk_level === "HIGH").length,
        critical: sortedItems.filter((x) => x.risk_level === "CRITICAL").length,
      },
      total_open_alerts: sortedItems.reduce((s, x) => s + x.alert_summary.open_count, 0),
      total_pending_acceptance: sortedItems.reduce((s, x) => s + x.pending_acceptance_summary.pending_acceptance_count, 0),
      total_invalid_execution: sortedItems.reduce((s, x) => s + x.pending_acceptance_summary.invalid_execution_count, 0),
      total_estimated_cost: Number(sortedItems.reduce((s, x) => s + x.cost_summary.estimated_total, 0).toFixed(2)),
      total_actual_cost: Number(sortedItems.reduce((s, x) => s + x.cost_summary.actual_total, 0).toFixed(2)),
      offline_fields: sortedItems.filter((x) => x.telemetry.device_offline).length,
    },
  };
}
