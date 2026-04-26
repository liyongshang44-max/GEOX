import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import type { JudgeKindV2, JudgeResultV2, JudgeVerdictV2 } from "@geox/contracts";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type JudgeResultV2CreateInput = TenantTriple & {
  judge_kind: JudgeKindV2;
  verdict: JudgeVerdictV2;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: string[];
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  confidence?: JudgeResultV2["confidence"];
  evidence_refs?: unknown[];
  source_refs?: unknown[];
  field_id?: string | null;
  season_id?: string | null;
  device_id?: string | null;
  recommendation_id?: string | null;
  prescription_id?: string | null;
  task_id?: string | null;
  receipt_id?: string | null;
  as_executed_id?: string | null;
  as_applied_id?: string | null;
};

export type JudgeResultV2ListInput = TenantTriple & {
  judge_kind?: JudgeKindV2;
  task_id?: string;
  recommendation_id?: string;
  limit?: number;
};

function normalizeJson(v: unknown): any {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
}

function asStringOrNull(v: unknown): string | null {
  const value = String(v ?? "").trim();
  return value.length > 0 ? value : null;
}

export function mapJudgeResultV2Row(row: any): JudgeResultV2 {
  return {
    judge_id: String(row.judge_id),
    judge_kind: String(row.judge_kind) as JudgeKindV2,
    tenant_id: String(row.tenant_id),
    project_id: String(row.project_id),
    group_id: String(row.group_id),
    field_id: asStringOrNull(row.field_id),
    season_id: asStringOrNull(row.season_id),
    device_id: asStringOrNull(row.device_id),
    recommendation_id: asStringOrNull(row.recommendation_id),
    prescription_id: asStringOrNull(row.prescription_id),
    task_id: asStringOrNull(row.task_id),
    receipt_id: asStringOrNull(row.receipt_id),
    as_executed_id: asStringOrNull(row.as_executed_id),
    as_applied_id: asStringOrNull(row.as_applied_id),
    verdict: String(row.verdict) as JudgeVerdictV2,
    severity: String(row.severity) as JudgeResultV2["severity"],
    reasons: Array.isArray(normalizeJson(row.reasons)) ? normalizeJson(row.reasons) : [],
    inputs: (normalizeJson(row.inputs) ?? {}) as Record<string, unknown>,
    outputs: (normalizeJson(row.outputs) ?? {}) as Record<string, unknown>,
    confidence: (normalizeJson(row.confidence) ?? {
      level: "LOW",
      basis: "assumed",
      reasons: ["default_confidence"],
    }) as JudgeResultV2["confidence"],
    evidence_refs: Array.isArray(normalizeJson(row.evidence_refs)) ? normalizeJson(row.evidence_refs) : [],
    source_refs: Array.isArray(normalizeJson(row.source_refs)) ? normalizeJson(row.source_refs) : [],
    created_at: String(row.created_at),
    created_ts_ms: Number(row.created_ts_ms ?? 0),
  };
}

export function buildJudgeResultV2(input: JudgeResultV2CreateInput): JudgeResultV2 {
  const judge_id = randomUUID();
  const created_ts_ms = Date.now();
  const created_at = new Date(created_ts_ms).toISOString();
  return {
    judge_id,
    judge_kind: input.judge_kind,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id ?? null,
    season_id: input.season_id ?? null,
    device_id: input.device_id ?? null,
    recommendation_id: input.recommendation_id ?? null,
    prescription_id: input.prescription_id ?? null,
    task_id: input.task_id ?? null,
    receipt_id: input.receipt_id ?? null,
    as_executed_id: input.as_executed_id ?? null,
    as_applied_id: input.as_applied_id ?? null,
    verdict: input.verdict,
    severity: input.severity,
    reasons: input.reasons ?? [],
    inputs: input.inputs ?? {},
    outputs: input.outputs ?? {},
    confidence: input.confidence ?? { level: "LOW", basis: "assumed", reasons: ["manual"] },
    evidence_refs: input.evidence_refs ?? [],
    source_refs: input.source_refs ?? [],
    created_at,
    created_ts_ms,
  };
}

export async function insertJudgeResultV2(pool: Pool, result: JudgeResultV2): Promise<JudgeResultV2> {
  const r = await pool.query(
    `INSERT INTO judge_result_v2 (
      judge_id, judge_kind,
      tenant_id, project_id, group_id,
      field_id, season_id, device_id,
      recommendation_id, prescription_id, task_id, receipt_id, as_executed_id, as_applied_id,
      verdict, severity, reasons,
      inputs, outputs, confidence,
      evidence_refs, source_refs,
      created_at, created_ts_ms
    ) VALUES (
      $1, $2,
      $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11, $12, $13, $14,
      $15, $16, $17::jsonb,
      $18::jsonb, $19::jsonb, $20::jsonb,
      $21::jsonb, $22::jsonb,
      $23::timestamptz, $24
    ) RETURNING *`,
    [
      result.judge_id,
      result.judge_kind,
      result.tenant_id,
      result.project_id,
      result.group_id,
      result.field_id ?? null,
      result.season_id ?? null,
      result.device_id ?? null,
      result.recommendation_id ?? null,
      result.prescription_id ?? null,
      result.task_id ?? null,
      result.receipt_id ?? null,
      result.as_executed_id ?? null,
      result.as_applied_id ?? null,
      result.verdict,
      result.severity,
      JSON.stringify(result.reasons ?? []),
      JSON.stringify(result.inputs ?? {}),
      JSON.stringify(result.outputs ?? {}),
      JSON.stringify(result.confidence ?? { level: "LOW", basis: "assumed", reasons: ["manual"] }),
      JSON.stringify(result.evidence_refs ?? []),
      JSON.stringify(result.source_refs ?? []),
      result.created_at,
      result.created_ts_ms,
    ]
  );
  return mapJudgeResultV2Row(r.rows[0]);
}

export async function loadJudgeResultV2(pool: Pool, input: TenantTriple & { judge_id: string }): Promise<JudgeResultV2 | null> {
  const r = await pool.query(
    `SELECT *
       FROM judge_result_v2
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND judge_id = $4
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.judge_id]
  );
  if (!r.rows?.length) return null;
  return mapJudgeResultV2Row(r.rows[0]);
}

export async function listJudgeResultsV2(
  pool: Pool,
  input: JudgeResultV2ListInput
): Promise<JudgeResultV2[]> {
  const params: unknown[] = [input.tenant_id, input.project_id, input.group_id];
  const where: string[] = ["tenant_id = $1", "project_id = $2", "group_id = $3"];

  if (input.judge_kind) {
    params.push(input.judge_kind);
    where.push(`judge_kind = $${params.length}`);
  }
  if (input.task_id) {
    params.push(input.task_id);
    where.push(`task_id = $${params.length}`);
  }
  if (input.recommendation_id) {
    params.push(input.recommendation_id);
    where.push(`recommendation_id = $${params.length}`);
  }

  const limit = Math.max(1, Math.min(200, Number(input.limit ?? 20) || 20));
  const sql = `SELECT * FROM judge_result_v2 WHERE ${where.join(" AND ")} ORDER BY created_ts_ms DESC LIMIT ${limit}`;
  const r = await pool.query(sql, params);
  return (r.rows ?? []).map(mapJudgeResultV2Row);
}

export async function createJudgeResultV2(pool: Pool, input: JudgeResultV2CreateInput): Promise<JudgeResultV2> {
  return insertJudgeResultV2(pool, buildJudgeResultV2(input));
}

export async function getJudgeResultV2ById(pool: Pool, input: TenantTriple & { judge_id: string }): Promise<JudgeResultV2 | null> {
  return loadJudgeResultV2(pool, input);
}
