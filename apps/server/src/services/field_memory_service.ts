import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";

import type {
  FieldMemoryMetricV1,
  FieldMemorySkillRefV1,
  FieldMemoryTypeV1,
  FieldMemoryV1,
} from "@geox/contracts";

type DbConn = Pool | PoolClient;

type RecordMemoryInput = {
  type: FieldMemoryTypeV1;
  operation_id?: string;
  field_id: string;
  metrics: FieldMemoryMetricV1;
  skill_refs?: FieldMemorySkillRefV1[];
  evidence_refs?: string[];
  prescription_id?: string;
  recommendation_id?: string;
  summary?: string;
};

function asJsonArrayOrNull(input: unknown): unknown[] | null {
  return Array.isArray(input) && input.length > 0 ? input : null;
}

function buildSummary(input: RecordMemoryInput): string {
  if (typeof input.summary === "string" && input.summary.trim().length > 0) {
    return input.summary.trim();
  }
  return `Field memory recorded for ${input.type}`;
}

export function createFieldMemoryService(db: DbConn, tenant_id: string) {
  async function recordMemory(input: RecordMemoryInput): Promise<FieldMemoryV1> {
    return recordMemoryV1(db, tenant_id, input);
  }

  return {
    recordMemory,
  };
}

export type FieldMemoryService = ReturnType<typeof createFieldMemoryService>;
export type { RecordMemoryInput };

export async function recordMemoryV1(db: DbConn, tenant_id: string, input: RecordMemoryInput): Promise<FieldMemoryV1> {
  const memory_id = crypto.randomUUID();
  const created_at = Date.now();

  const row: FieldMemoryV1 = {
    memory_id,
    tenant_id,
    field_id: input.field_id,
    operation_id: input.operation_id,
    prescription_id: input.prescription_id,
    recommendation_id: input.recommendation_id,
    memory_type: input.type,
    summary: buildSummary(input),
    metrics: input.metrics ?? {},
    skill_refs: asJsonArrayOrNull(input.skill_refs) as FieldMemorySkillRefV1[] | undefined,
    evidence_refs: asJsonArrayOrNull(input.evidence_refs) as string[] | undefined,
    created_at,
  };

  await db.query(
    `INSERT INTO field_memory_v1 (
      memory_id,
      tenant_id,
      field_id,
      operation_id,
      prescription_id,
      recommendation_id,
      memory_type,
      summary,
      metrics,
      skill_refs,
      evidence_refs,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12)`,
    [
      row.memory_id,
      row.tenant_id,
      row.field_id,
      row.operation_id ?? null,
      row.prescription_id ?? null,
      row.recommendation_id ?? null,
      row.memory_type,
      row.summary,
      JSON.stringify(row.metrics ?? {}),
      JSON.stringify(row.skill_refs ?? null),
      JSON.stringify(row.evidence_refs ?? null),
      row.created_at,
    ],
  );

  return row;
}
