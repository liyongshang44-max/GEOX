import type { Pool } from "pg";

import type { TenantTriple } from "./runtime_v1.js";

type SkillTraceRow = {
  fact_id: string;
  occurred_at: string;
  record_json: any;
};

export async function getSkillTraceByIdV1(pool: Pool, tenant: TenantTriple, traceId: string): Promise<any | null> {
  const q = await pool.query<SkillTraceRow>(
    `SELECT fact_id, occurred_at, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'skill_run_v1'
        AND (record_json::jsonb->'payload'->>'tenant_id') = $1
        AND (record_json::jsonb->'payload'->>'project_id') = $2
        AND (record_json::jsonb->'payload'->>'group_id') = $3
        AND (
          (record_json::jsonb->'payload'->'skill_trace'->>'trace_id') = $4
          OR (record_json::jsonb->'payload'->>'trace_id') = $4
        )
      ORDER BY occurred_at DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, traceId],
  );

  const row = q.rows?.[0];
  if (!row) return null;
  const payload = row.record_json?.payload ?? {};
  return {
    trace_id: traceId,
    skill_run_id: String(payload.run_id ?? row.fact_id),
    skill_id: payload.skill_id ?? null,
    trace: payload.skill_trace ?? payload.trace ?? payload,
    occurred_at: row.occurred_at,
  };
}
