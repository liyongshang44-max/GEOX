import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { evaluateAgronomy } from "../domain/agronomy/agronomy_engine";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

type AgentRunResult = {
  scanned: number;
  created: number;
  skipped: number;
  skipped_by_reason: {
    no_program: number;
    no_crop_code: number;
    no_telemetry: number;
    duplicate: number;
  };
};

type LatestDeviceTelemetry = {
  tenant_id: string;
  device_id: string;
  field_id: string;
  soil_moisture: number;
};

type ProgramBinding = {
  program_id: string;
  tenant: TenantTriple;
  season_id: string;
  crop_code: string;
};

const AGENT_SOURCE = "jobs/agronomy_agent";
const DEDUPE_WINDOW_MINUTES = 30;

function safeString(v: any): string {
  return String(v ?? "").trim();
}

async function loadLatestSoilTelemetry(pool: Pool): Promise<LatestDeviceTelemetry[]> {
  const q = await pool.query(
    `WITH latest_soil AS (
       SELECT DISTINCT ON (tenant_id, device_id)
         tenant_id,
         device_id,
         value_num AS soil_moisture,
         ts
       FROM telemetry_index_v1
       WHERE metric = 'soil_moisture' AND value_num IS NOT NULL
       ORDER BY tenant_id, device_id, ts DESC
     ), latest_binding AS (
       SELECT DISTINCT ON (tenant_id, device_id)
         tenant_id,
         device_id,
         field_id,
         COALESCE(bound_ts_ms, 0) AS bound_ts_ms
       FROM device_binding_index_v1
       ORDER BY tenant_id, device_id, COALESCE(bound_ts_ms, 0) DESC
     )
     SELECT s.tenant_id, s.device_id, b.field_id, s.soil_moisture
     FROM latest_soil s
     JOIN latest_binding b
       ON b.tenant_id = s.tenant_id
      AND b.device_id = s.device_id
     WHERE b.field_id IS NOT NULL
       AND b.field_id <> ''`,
  );

  return (q.rows ?? []).map((row: any) => ({
    tenant_id: safeString(row.tenant_id),
    device_id: safeString(row.device_id),
    field_id: safeString(row.field_id),
    soil_moisture: Number(row.soil_moisture),
  })).filter((row) => row.tenant_id && row.device_id && row.field_id && Number.isFinite(row.soil_moisture));
}

async function loadProgramBindings(pool: Pool, item: LatestDeviceTelemetry): Promise<ProgramBinding[]> {
  const q = await pool.query(
    `SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,program_id}'))
        record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'field_program_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,field_id}') = $2
      ORDER BY (record_json::jsonb#>>'{payload,program_id}'), occurred_at DESC, fact_id DESC`,
    [item.tenant_id, item.field_id],
  );
  const blockedStatus = new Set(["CANCELLED", "COMPLETED", "ARCHIVED"]);
  return (q.rows ?? [])
    .map((row: any) => row?.record_json?.payload ?? {})
    .map((payload: any) => {
      const status = safeString(payload.status).toUpperCase();
      return {
        status,
        program_id: safeString(payload.program_id),
        tenant: {
          tenant_id: safeString(payload.tenant_id) || item.tenant_id,
          project_id: safeString(payload.project_id),
          group_id: safeString(payload.group_id),
        },
        season_id: safeString(payload.season_id),
        crop_code: safeString(payload.crop_code),
      };
    })
    .filter((x) => x.program_id && !blockedStatus.has(x.status))
    .map(({ status: _status, ...rest }) => rest);
}

async function existsRecentRecommendation(
  pool: Pool,
  tenant: TenantTriple,
  program_id: string,
  field_id: string,
  action_type: string,
  reason_code: string,
): Promise<boolean> {
  const q = await pool.query(
    `SELECT 1
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'recommendation_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,program_id}') = $4
        AND (record_json::jsonb#>>'{payload,field_id}') = $5
        AND (record_json::jsonb#>>'{payload,action_type}') = $6
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(record_json::jsonb#>'{payload,reason_codes}', '[]'::jsonb)) AS r(code)
          WHERE r.code = $7
        )
        AND occurred_at >= NOW() - ($8::text || ' minutes')::interval
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, program_id, field_id, action_type, reason_code, String(DEDUPE_WINDOW_MINUTES)],
  );
  return (q.rowCount ?? 0) > 0;
}

async function insertFact(pool: Pool, source: string, record_json: any): Promise<string> {
  const fact_id = randomUUID();
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [fact_id, source, record_json],
  );
  return fact_id;
}

export async function runAgronomyAgentOnce(pool: Pool): Promise<AgentRunResult> {
  console.log("[agronomy-agent] scan start");
  let latestTelemetry: LatestDeviceTelemetry[] = [];
  let created = 0;
  let skipped = 0;
  const skippedByReason: AgentRunResult["skipped_by_reason"] = {
    no_program: 0,
    no_crop_code: 0,
    no_telemetry: 0,
    duplicate: 0,
  };
  let runError: unknown = null;

  try {
    latestTelemetry = await loadLatestSoilTelemetry(pool);
    for (const item of latestTelemetry) {
      if (!Number.isFinite(item.soil_moisture)) {
        skipped += 1;
        skippedByReason.no_telemetry += 1;
        console.log(`[agronomy-agent] skipped:no_telemetry field=${item.field_id} device=${item.device_id}`);
        continue;
      }

      const bindings = await loadProgramBindings(pool, item);
      if (!bindings.length) {
        skipped += 1;
        skippedByReason.no_program += 1;
        console.log(`[agronomy-agent] skipped:no_program field=${item.field_id} device=${item.device_id}`);
        continue;
      }
      for (const binding of bindings) {
        if (!binding.tenant.tenant_id || !binding.tenant.project_id || !binding.tenant.group_id) {
          skipped += 1;
          skippedByReason.no_program += 1;
          console.log(`[agronomy-agent] skipped:no_program field=${item.field_id} device=${item.device_id}`);
          continue;
        }
        if (!binding.crop_code) {
          skipped += 1;
          skippedByReason.no_crop_code += 1;
          console.log(`[agronomy-agent] skipped:no_crop_code field=${item.field_id} program=${binding.program_id}`);
          continue;
        }

        const agronomy = evaluateAgronomy({
          crop_code: binding.crop_code,
          soil_moisture: item.soil_moisture,
        });

        if (!agronomy.should_irrigate) {
          skipped += 1;
          continue;
        }

        const action_type = "IRRIGATE";
        const reason_code = safeString(agronomy.reason) || "soil_moisture_below_optimal";
        const duplicated = await existsRecentRecommendation(pool, binding.tenant, binding.program_id, item.field_id, action_type, reason_code);
        if (duplicated) {
          skipped += 1;
          skippedByReason.duplicate += 1;
          console.log(`[agronomy-agent] skipped:duplicate field=${item.field_id} program=${binding.program_id} action=${action_type}`);
          continue;
        }

        const recommendation_id = `rec_agent_${randomUUID().replace(/-/g, "")}`;
        const basePayload = {
          tenant_id: binding.tenant.tenant_id,
          project_id: binding.tenant.project_id,
          group_id: binding.tenant.group_id,
          program_id: binding.program_id,
          field_id: item.field_id,
          device_id: item.device_id,
          season_id: binding.season_id || null,
          action_type,
          reason_codes: [reason_code],
          title: "系统建议",
          summary: `根据当前作物模型（${binding.crop_code}），建议进行灌溉处理`,
        };

        await insertFact(pool, AGENT_SOURCE, {
          type: "recommendation_v1",
          payload: {
            ...basePayload,
            recommendation_id,
            created_ts: Date.now(),
          },
        });

        await insertFact(pool, AGENT_SOURCE, {
          type: "decision_recommendation_v1",
          payload: {
            ...basePayload,
            recommendation_id,
            recommendation_type: "irrigation_recommendation_v1",
            status: "proposed",
            evidence_refs: ["telemetry:soil_moisture"],
            rule_hit: [
              {
                rule_id: "agronomy_agent_soil_moisture_v1",
                matched: true,
                actual: item.soil_moisture,
              },
            ],
            confidence: 0.8,
            suggested_action: {
              action_type: "irrigation.start",
              summary: basePayload.summary,
              parameters: {
                program_id: binding.program_id,
                crop_code: binding.crop_code,
                soil_moisture: item.soil_moisture,
              },
            },
            created_ts: Date.now(),
            model_version: "agronomy_agent_v1",
          },
        });

        created += 1;
        console.log(`[agronomy-agent] recommendation created field=${item.field_id} program=${binding.program_id} action=${action_type}`);
      }
    }
  } catch (error: any) {
    runError = error;
    console.error(`[agronomy-agent] scan error message=${String(error?.message ?? error)}`);
  } finally {
    console.log(
      `[agronomy-agent] scan done scanned=${latestTelemetry.length} created=${created} skipped=${skipped} ` +
      `skipped:no_program=${skippedByReason.no_program} skipped:no_crop_code=${skippedByReason.no_crop_code} ` +
      `skipped:no_telemetry=${skippedByReason.no_telemetry} skipped:duplicate=${skippedByReason.duplicate}`,
    );
  }
  if (runError) {
    // Keep runtime alive and report partial counters for observability.
  }
  return { scanned: latestTelemetry.length, created, skipped, skipped_by_reason: skippedByReason };
}

export type { AgentRunResult, TenantTriple };
