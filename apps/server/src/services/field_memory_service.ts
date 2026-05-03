import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";

import type { FieldMemoryTypeV1, FieldMemoryV1 } from "@geox/contracts";

type DbConn = Pool | PoolClient;

type RecordMemoryInput = {
  type: "operation_outcome" | "execution_reliability" | "skill_performance" | FieldMemoryTypeV1;
  project_id?: string;
  group_id?: string;
  operation_id?: string;
  field_id: string;
  metrics?: Record<string, unknown>;
  skill_refs?: Array<{ skill_id?: string; skill_version?: string; skill_run_id?: string; trace_id?: string }>;
  skill_id?: string;
  evidence_refs?: unknown[];
  prescription_id?: string;
  recommendation_id?: string;
  summary?: string;
  season_id?: string;
  task_id?: string;
  acceptance_id?: string;
  roi_id?: string;
  skill_trace_ref?: string;
};

export function normalizeMemoryType(type: string): FieldMemoryTypeV1 {
  if (type === "operation_outcome") return "FIELD_RESPONSE_MEMORY";
  if (type === "execution_reliability") return "DEVICE_RELIABILITY_MEMORY";
  if (type === "skill_performance") return "SKILL_PERFORMANCE_MEMORY";
  return type as FieldMemoryTypeV1;
}

function num(v: unknown): number | undefined { const n = Number(v); return Number.isFinite(n) ? n : undefined; }

export async function recordMemoryV1(db: DbConn, tenant_id: string, input: RecordMemoryInput): Promise<FieldMemoryV1> {
  const memory_type = normalizeMemoryType(input.type);
  const memory_id = crypto.randomUUID();
  const metrics = input.metrics ?? {};
  const before_value = num((metrics as any).before_soil_moisture ?? (metrics as any).before_value);
  const after_value = num((metrics as any).after_soil_moisture ?? (metrics as any).after_value);
  const delta_value = num((metrics as any).soil_moisture_delta ?? (after_value != null && before_value != null ? after_value - before_value : undefined));
  const confidence = num((metrics as any).confidence) ?? 0.8;
  const skill_refs = Array.isArray(input.skill_refs) ? input.skill_refs : [];
  const firstSkillRef = skill_refs.find((x: any) => String(x?.skill_id ?? "").trim());
  const skill_id =
    String(input.skill_id ?? "").trim()
    || String(firstSkillRef?.skill_id ?? "").trim()
    || undefined;
  const skill_trace_ref =
    String(input.skill_trace_ref ?? "").trim()
    || String(firstSkillRef?.trace_id ?? firstSkillRef?.skill_run_id ?? "").trim()
    || undefined;
  const metric_key =
    memory_type === "FIELD_RESPONSE_MEMORY" ? "soil_moisture_response" :
    memory_type === "DEVICE_RELIABILITY_MEMORY" ? "valve_response_status" :
    "irrigation_skill_outcome";
  const metric_value = memory_type === "DEVICE_RELIABILITY_MEMORY"
    ? ((metrics as any).success === false ? 0 : 1)
    : undefined;
  const summary_text = input.summary?.trim() || `Field memory recorded: ${memory_type}`;
  const occurred_at = new Date().toISOString();

  await db.query(
    `INSERT INTO field_memory_v1 (
      memory_id, tenant_id, project_id, group_id, field_id, season_id, crop_id, memory_type, metric_key, metric_value, metric_unit,
      before_value, after_value, baseline_value, delta_value, target_range, confidence, source_type, source_id,
      operation_id, recommendation_id, prescription_id, task_id, acceptance_id, roi_id, skill_id, skill_trace_ref,
      evidence_refs, summary_text, occurred_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
      $12,$13,$14,$15,$16::jsonb,$17,$18,$19,
      $20,$21,$22,$23,$24,$25,$26,$27,
      $28::jsonb,$29,$30
    )`,
    [
      memory_id, tenant_id, input.project_id ?? "projectA", input.group_id ?? "groupA", input.field_id, input.season_id ?? null, null,
      memory_type, metric_key, metric_value ?? null, null, before_value ?? null, after_value ?? null, null, delta_value ?? null,
      JSON.stringify((metrics as any).target_range ?? null), confidence, memory_type === "DEVICE_RELIABILITY_MEMORY" ? "skill_run" : "acceptance",
      input.acceptance_id ?? input.operation_id ?? memory_id, input.operation_id ?? null, input.recommendation_id ?? null,
      input.prescription_id ?? null, input.task_id ?? null, input.acceptance_id ?? null, input.roi_id ?? null, skill_id,
      skill_trace_ref, JSON.stringify(input.evidence_refs ?? []), summary_text, occurred_at,
    ],
  );

  return {
    memory_id, tenant_id, project_id: input.project_id ?? "projectA", group_id: input.group_id ?? "groupA", field_id: input.field_id, season_id: input.season_id, memory_type,
    metric_key, metric_value, before_value, after_value, delta_value, confidence,
    source_type: memory_type === "DEVICE_RELIABILITY_MEMORY" ? "skill_run" : "acceptance",
    source_id: input.acceptance_id ?? input.operation_id ?? memory_id,
    operation_id: input.operation_id, recommendation_id: input.recommendation_id, prescription_id: input.prescription_id,
    task_id: input.task_id, acceptance_id: input.acceptance_id, roi_id: input.roi_id,
    skill_id, skill_trace_ref, evidence_refs: input.evidence_refs ?? [], summary_text, occurred_at, created_at: occurred_at,
  };
}
