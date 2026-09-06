import type { Pool } from "pg";

import { computeSkillRegistryReadRowsV1 } from "../../projections/skill_registry_read_v1.js";
import { toInt } from "./skill_trace_service.js";
import type { TenantTriple } from "./skill_trace_service.js";

type SkillRunReadRow = {
  fact_type: string;
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
  const projected = await computeSkillRegistryReadRowsV1(pool, tenant) as SkillRunReadRow[];
  let rows = projected.filter((row) => row.fact_type === "skill_run_v1");

  const fieldId = typeof query.field_id === "string" ? query.field_id.trim() : "";
  if (fieldId) rows = rows.filter((row) => row.field_id === fieldId);

  const deviceId = typeof query.device_id === "string" ? query.device_id.trim() : "";
  if (deviceId) rows = rows.filter((row) => row.device_id === deviceId);

  const normalizedCategory = normalizeCategory(query.category);
  if (normalizedCategory) {
    const legacySqlEquivalent = String(query.category).trim().toUpperCase();
    rows = rows.filter((row) => String(row.category ?? "") === legacySqlEquivalent);
  }

  const normalizedStatus = typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
  if (normalizedStatus === "success") rows = rows.filter((row) => String(row.result_status ?? "") === "SUCCESS");
  else if (normalizedStatus === "failed") rows = rows.filter((row) => String(row.result_status ?? "") !== "SUCCESS");

  const limit = Math.min(200, Math.max(1, toInt(query.limit, 50)));
  const items = rows.slice(0, limit).map((row) => {
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
  const projected = await computeSkillRegistryReadRowsV1(pool, tenant) as SkillRunReadRow[];
  const page = Math.max(1, toInt(query.page, 1));
  const page_size = Math.min(200, Math.max(1, toInt(query.page_size, 20)));
  const offset = (page - 1) * page_size;

  let rows = projected.filter((row) => row.fact_type === "skill_run_v1");
  const operationId = typeof (query.operation_id ?? query.operation) === "string" ? String(query.operation_id ?? query.operation).trim() : "";
  if (operationId) rows = rows.filter((row) => row.operation_id === operationId);
  const fieldId = typeof query.field_id === "string" ? query.field_id.trim() : "";
  if (fieldId) rows = rows.filter((row) => row.field_id === fieldId);
  const deviceId = typeof query.device_id === "string" ? query.device_id.trim() : "";
  if (deviceId) rows = rows.filter((row) => row.device_id === deviceId);

  const total = rows.length;
  const pageRows = rows.slice(offset, offset + page_size);
  return {
    page,
    page_size,
    total,
    items: pageRows.map((row) => ({
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
