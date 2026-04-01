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

type LatestFieldTelemetry = {
  tenant_id: string;
  field_id: string;
  device_id: string | null;
  soil_moisture: number | null;
};

type ProgramBinding = {
  program_id: string;
  field_id: string;
  season_id: string;
  tenant: TenantTriple;
  crop_code: string;
};

type ScanTarget = {
  tenant_id: string;
  field_id: string;
  season_id: string;
};

const AGENT_SOURCE = "jobs/agronomy_agent";
const DEDUPE_WINDOW_MINUTES = 30;
const DEFAULT_SOIL_MOISTURE = 30;

function safeString(v: any): string {
  return String(v ?? "").trim();
}

async function loadLatestSoilTelemetryByField(pool: Pool): Promise<LatestFieldTelemetry[]> {
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
     SELECT DISTINCT ON (s.tenant_id, b.field_id)
       s.tenant_id,
       b.field_id,
       s.device_id,
       s.soil_moisture
     FROM latest_soil s
     JOIN latest_binding b
       ON b.tenant_id = s.tenant_id
      AND b.device_id = s.device_id
     WHERE b.field_id IS NOT NULL
       AND b.field_id <> ''
     ORDER BY s.tenant_id, b.field_id, s.ts DESC`,
  );

  return (q.rows ?? []).map((row: any) => ({
    tenant_id: safeString(row.tenant_id),
    device_id: safeString(row.device_id) || null,
    field_id: safeString(row.field_id),
    soil_moisture: Number.isFinite(Number(row.soil_moisture)) ? Number(row.soil_moisture) : null,
  })).filter((row) => row.tenant_id && row.field_id);
}

async function loadActivePrograms(pool: Pool): Promise<ProgramBinding[]> {
  const q = await pool.query(
    `WITH ranked_programs AS (
      SELECT
        record_json,
        ROW_NUMBER() OVER (
          PARTITION BY
            (record_json::jsonb#>>'{payload,tenant_id}'),
            (record_json::jsonb#>>'{payload,field_id}'),
            (record_json::jsonb#>>'{payload,season_id}')
          ORDER BY
            CASE WHEN (record_json::jsonb#>>'{payload,program_id}') LIKE 'prg_chain_%' THEN 1 ELSE 0 END ASC,
            CASE
              WHEN COALESCE((record_json::jsonb#>>'{payload,updated_ts}'), '') ~ '^[0-9]+$'
              THEN (record_json::jsonb#>>'{payload,updated_ts}')::bigint
              ELSE 0
            END DESC,
            CASE
              WHEN COALESCE((record_json::jsonb#>>'{payload,created_ts}'), '') ~ '^[0-9]+$'
              THEN (record_json::jsonb#>>'{payload,created_ts}')::bigint
              ELSE 0
            END DESC,
            occurred_at DESC,
            fact_id DESC
        ) AS rn
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'field_program_v1'
    )
    SELECT record_json
    FROM ranked_programs
    WHERE rn = 1`,
  );

  const blockedStatus = new Set(["CANCELLED", "COMPLETED", "ARCHIVED"]);
  return (q.rows ?? [])
    .map((row: any) => row?.record_json?.payload ?? {})
    .map((payload: any) => {
      const status = safeString(payload.status).toUpperCase();
      return {
        status,
        program_id: safeString(payload.program_id),
        field_id: safeString(payload.field_id),
        season_id: safeString(payload.season_id),
        tenant: {
          tenant_id: safeString(payload.tenant_id),
          project_id: safeString(payload.project_id),
          group_id: safeString(payload.group_id),
        },
        crop_code: safeString(payload.crop_code),
      };
    })
    .filter((x) => x.program_id && x.field_id && x.tenant.tenant_id && !blockedStatus.has(x.status))
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

async function existsPendingOperationPlan(pool: Pool, tenant: TenantTriple, program_id: string): Promise<boolean> {
  const q = await pool.query(
    `SELECT 1
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,program_id}') = $4
        AND UPPER(COALESCE(record_json::jsonb#>>'{payload,status}', '')) NOT IN ('SUCCEEDED','SUCCESS','DONE','FAILED','ERROR','CANCELLED','REJECTED','ARCHIVED')
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, program_id],
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
  let created = 0;
  let skipped = 0;
  const skippedByReason: AgentRunResult["skipped_by_reason"] = {
    no_program: 0,
    no_crop_code: 0,
    no_telemetry: 0,
    duplicate: 0,
  };
  let runError: unknown = null;
  let scannedCount = 0;

  try {
    const [programs, telemetryRows] = await Promise.all([
      loadActivePrograms(pool),
      loadLatestSoilTelemetryByField(pool),
    ]);
    const telemetryByField = new Map(telemetryRows.map((row) => [`${row.tenant_id}::${row.field_id}`, row]));
    const targets = new Map<string, ScanTarget>();
    for (const program of programs) {
      const key = `${program.tenant.tenant_id}::${program.field_id}::${program.season_id}`;
      targets.set(key, { tenant_id: program.tenant.tenant_id, field_id: program.field_id, season_id: program.season_id });
    }
    for (const telemetry of telemetryRows) {
      const key = `${telemetry.tenant_id}::${telemetry.field_id}::`;
      if (!targets.has(key)) {
        targets.set(key, { tenant_id: telemetry.tenant_id, field_id: telemetry.field_id, season_id: "" });
      }
    }

    const programByTarget = new Map(programs.map((program) => [`${program.tenant.tenant_id}::${program.field_id}::${program.season_id}`, program]));
    for (const target of targets.values()) {
      scannedCount += 1;
      const program = programByTarget.get(`${target.tenant_id}::${target.field_id}::${target.season_id}`);
      if (!program) {
        skipped += 1;
        skippedByReason.no_program += 1;
        console.log("[agronomy-agent] skipped:no_program", { field_id: target.field_id, season_id: target.season_id || null });
        continue;
      }
      console.log("[agronomy-agent] selected_program", {
        field_id: program.field_id,
        season_id: program.season_id || null,
        program_id: program.program_id,
      });
      const telemetry = telemetryByField.get(`${program.tenant.tenant_id}::${program.field_id}`);
      const soilMoisture = telemetry?.soil_moisture;
      if (!Number.isFinite(soilMoisture ?? Number.NaN)) {
        skippedByReason.no_telemetry += 1;
        console.log("[agronomy-agent] skipped:no_telemetry", { field_id: program.field_id });
      }
      const effectiveSoilMoisture = Number.isFinite(soilMoisture ?? Number.NaN)
        ? Number(soilMoisture)
        : DEFAULT_SOIL_MOISTURE;

      if (!program.program_id) {
        skipped += 1;
        skippedByReason.no_program += 1;
        console.log("[agronomy-agent] skipped:no_program", { field_id: program.field_id, season_id: program.season_id || null });
        continue;
      }
      if (!program.tenant.tenant_id || !program.tenant.project_id || !program.tenant.group_id) {
        skipped += 1;
        skippedByReason.no_program += 1;
        console.log("[agronomy-agent] skipped:no_program", { field_id: program.field_id, season_id: program.season_id || null });
        continue;
      }
      if (!program.crop_code) {
        skipped += 1;
        skippedByReason.no_crop_code += 1;
        console.log("[agronomy-agent] skipped:no_crop_code", { program_id: program.program_id });
        continue;
      }

      const hasPendingPlan = await existsPendingOperationPlan(pool, program.tenant, program.program_id);
      if (hasPendingPlan) {
        skipped += 1;
        skippedByReason.duplicate += 1;
        console.log("[agronomy-agent] skipped:duplicate", { field_id: program.field_id, program_id: program.program_id });
        continue;
      }

      const agronomy = evaluateAgronomy({
        crop_code: program.crop_code,
        soil_moisture: effectiveSoilMoisture,
      });

      const action_type = "IRRIGATE";
      const reason_code = safeString(agronomy.reason) || "soil_moisture_below_optimal";
      const duplicated = await existsRecentRecommendation(pool, program.tenant, program.program_id, program.field_id, action_type, reason_code);
      if (duplicated) {
        skipped += 1;
        skippedByReason.duplicate += 1;
        console.log("[agronomy-agent] skipped:duplicate", { field_id: program.field_id, program_id: program.program_id });
        continue;
      }

      const recommendation_id = `rec_agent_${randomUUID().replace(/-/g, "")}`;
      const basePayload = {
        tenant_id: program.tenant.tenant_id,
        project_id: program.tenant.project_id,
        group_id: program.tenant.group_id,
        program_id: program.program_id,
        field_id: program.field_id,
        device_id: telemetry?.device_id ?? null,
        season_id: program.season_id || null,
        action_type,
        reason_codes: [reason_code],
        title: "系统建议",
        summary: `根据当前作物模型（${program.crop_code}），建议进行灌溉处理`,
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
              actual: effectiveSoilMoisture,
            },
          ],
          confidence: 0.8,
          suggested_action: {
            action_type: "irrigation.start",
            summary: basePayload.summary,
            parameters: {
              program_id: program.program_id,
              crop_code: program.crop_code,
              soil_moisture: effectiveSoilMoisture,
            },
          },
          created_ts: Date.now(),
          model_version: "agronomy_agent_v1",
        },
      });

      created += 1;
      console.log("[agronomy-agent] recommendation created", {
        field_id: program.field_id,
        season_id: program.season_id || null,
        program_id: program.program_id,
        crop_code: program.crop_code,
        action_type,
      });
    }
  } catch (error: any) {
    runError = error;
    console.error(`[agronomy-agent] scan error message=${String(error?.message ?? error)}`);
  } finally {
    console.log("[agronomy-agent] scan result", {
      scanned: scannedCount,
      created,
      skipped,
    });
  }
  if (runError) {
    // Keep runtime alive and report partial counters for observability.
  }
  return { scanned: scannedCount, created, skipped, skipped_by_reason: skippedByReason };
}

export type { AgentRunResult, TenantTriple };
