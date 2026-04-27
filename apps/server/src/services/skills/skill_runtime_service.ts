import type { Pool } from "pg";

import { projectSkillRegistryReadV1 } from "../../projections/skill_registry_read_v1.js";
import { toInt } from "./skill_trace_service.js";
import type { TenantTriple } from "./skill_trace_service.js";

type SkillRunReadRow = {
  fact_id: string;
  skill_id: string;
  version: string;
  category: string | null;
  status: string | null;
  result_status: string | null;
  bind_target: string | null;
  operation_id: string | null;
  field_id: string | null;
  device_id: string | null;
  input_digest: string | null;
  output_digest: string | null;
  payload_json: any;
  occurred_at: string;
  updated_at_ts_ms: number;
  lifecycle_version: number | null;
};

const CATEGORY_MAP: Record<string, "sensing" | "agronomy" | "device" | "acceptance"> = {
  SENSING: "sensing",
  OBSERVABILITY: "sensing",
  OPS: "sensing",
  CONTROL: "sensing",
  AGRONOMY: "agronomy",
  DEVICE: "device",
  ACCEPTANCE: "acceptance",
};

function normalizeCategory(value: unknown): "sensing" | "agronomy" | "device" | "acceptance" | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return CATEGORY_MAP[value.trim().toUpperCase()] ?? null;
}

function normalizeStatus(value: unknown): "success" | "failed" {
  return String(value ?? "").trim().toUpperCase() === "SUCCESS" ? "success" : "failed";
}

function parseEpochMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return Math.trunc(asNumber);
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function toExplanationCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean);
}

export async function listSkillRuns(pool: Pool, tenant: TenantTriple, query: Record<string, unknown>) {
  await projectSkillRegistryReadV1(pool, tenant);

  const where = ["tenant_id = $1", "project_id = $2", "group_id = $3", "fact_type = 'skill_run_v1'"];
  const params: unknown[] = [tenant.tenant_id, tenant.project_id, tenant.group_id];

  const fieldId = typeof query.field_id === "string" ? query.field_id.trim() : "";
  if (fieldId) {
    params.push(fieldId);
    where.push(`field_id = $${params.length}`);
  }
  const deviceId = typeof query.device_id === "string" ? query.device_id.trim() : "";
  if (deviceId) {
    params.push(deviceId);
    where.push(`device_id = $${params.length}`);
  }
  const normalizedCategory = normalizeCategory(query.category);
  if (normalizedCategory) {
    params.push(String(query.category).trim().toUpperCase());
    where.push(`category = $${params.length}`);
  }
  const normalizedStatus = typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
  if (normalizedStatus === "success") where.push("result_status = 'SUCCESS'");
  else if (normalizedStatus === "failed") where.push("result_status <> 'SUCCESS'");

  const limit = Math.min(200, Math.max(1, toInt(query.limit, 50)));
  params.push(limit);

  const rowsQ = await pool.query<SkillRunReadRow>(
    `SELECT *
       FROM skill_registry_read_v1
      WHERE ${where.join(" AND ")}
      ORDER BY updated_at_ts_ms DESC
      LIMIT $${params.length}`,
    params,
  );

  const items = (rowsQ.rows ?? []).map((row) => {
    const payload = row.payload_json ?? {};
    const started_at_ts_ms =
      parseEpochMs(payload.started_at_ts_ms) ??
      parseEpochMs(payload.execution_started_at_ts_ms) ??
      parseEpochMs(payload.started_at) ??
      parseEpochMs(payload.execution_started_at) ??
      row.updated_at_ts_ms;
    const finished_at_ts_ms =
      parseEpochMs(payload.finished_at_ts_ms) ??
      parseEpochMs(payload.execution_finished_at_ts_ms) ??
      parseEpochMs(payload.finished_at) ??
      parseEpochMs(payload.execution_finished_at) ??
      parseEpochMs(row.occurred_at) ??
      row.updated_at_ts_ms;

    return {
      skill_run_id: String(payload.run_id ?? row.fact_id),
      skill_id: String(row.skill_id),
      category: normalizeCategory(row.category) ?? normalizeCategory(payload.category) ?? "sensing",
      status: normalizeStatus(row.result_status ?? row.status ?? payload.result_status ?? payload.status),
      started_at_ts_ms,
      finished_at_ts_ms,
      target: {
        ...(row.field_id ? { field_id: row.field_id } : {}),
        ...(row.device_id ? { device_id: row.device_id } : {}),
      },
      input_digest: String(row.input_digest ?? payload.input_digest ?? ""),
      output_digest: String(row.output_digest ?? payload.output_digest ?? ""),
      explanation_codes: toExplanationCodes(payload.explanation_codes),
    };
  });

  return { items, limit };
}

export async function listSkillRunsLegacy(pool: Pool, tenant: TenantTriple, query: Record<string, unknown>) {
  await projectSkillRegistryReadV1(pool, tenant);
  const page = Math.max(1, toInt(query.page, 1));
  const page_size = Math.min(200, Math.max(1, toInt(query.page_size, 20)));
  const offset = (page - 1) * page_size;

  const where = ["tenant_id = $1", "project_id = $2", "group_id = $3", "fact_type = 'skill_run_v1'"];
  const params: unknown[] = [tenant.tenant_id, tenant.project_id, tenant.group_id];
  const pushEq = (field: string, value?: unknown) => {
    if (typeof value !== "string" || !value.trim()) return;
    params.push(value.trim());
    where.push(`${field} = $${params.length}`);
  };

  pushEq("operation_id", query.operation_id ?? query.operation);
  pushEq("field_id", query.field_id);
  pushEq("device_id", query.device_id);

  const countQ = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM skill_registry_read_v1 WHERE ${where.join(" AND ")}`, params);
  params.push(page_size, offset);
  const rowsQ = await pool.query<SkillRunReadRow>(
    `SELECT * FROM skill_registry_read_v1 WHERE ${where.join(" AND ")} ORDER BY updated_at_ts_ms DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    page,
    page_size,
    total: Number(countQ.rows?.[0]?.total ?? 0),
    items: (rowsQ.rows ?? []).map((row) => ({
      run_id: row.payload_json?.run_id ?? row.fact_id,
      skill_id: row.skill_id,
      version: row.version,
      result_status: row.result_status,
      operation_id: row.operation_id,
      field_id: row.field_id,
      device_id: row.device_id,
      bind_target: row.bind_target,
      duration_ms: row.payload_json?.duration_ms ?? null,
      lifecycle_version: row.lifecycle_version ?? row.payload_json?.lifecycle_version ?? null,
      error_code: row.payload_json?.error_code ?? null,
      occurred_at: row.occurred_at,
    })),
  };
}
