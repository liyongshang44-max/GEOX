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
  status: string;
};

type ScanTarget = {
  tenant_id: string;
  field_id: string;
  season_id: string;
};

const AGENT_SOURCE = "jobs/agronomy_agent";
const DEDUPE_WINDOW_MINUTES = 30;
const DEFAULT_SOIL_MOISTURE = 30;
const DEBUG_FIELD_ID = "field_c8_demo";
const DEBUG_SEASON_ID = "season_demo";
const ALLOWED_PROGRAM_STATUSES = new Set(["ACTIVE", "DRAFT"]);

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
    `SELECT
      (record_json::jsonb#>>'{payload,program_id}') AS program_id,
      (record_json::jsonb#>>'{payload,field_id}') AS field_id,
      (record_json::jsonb#>>'{payload,season_id}') AS season_id,
      (record_json::jsonb#>>'{payload,tenant_id}') AS tenant_id,
      (record_json::jsonb#>>'{payload,project_id}') AS project_id,
      (record_json::jsonb#>>'{payload,group_id}') AS group_id,
      (record_json::jsonb#>>'{payload,crop_code}') AS crop_code,
      (record_json::jsonb#>>'{payload,status}') AS status,
      (record_json::jsonb#>>'{payload,updated_ts}') AS updated_ts,
      (record_json::jsonb#>>'{payload,created_ts}') AS created_ts,
      occurred_at,
      fact_id
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'field_program_v1'`,
  );

  const blockedStatus = new Set(["CANCELLED", "COMPLETED", "ARCHIVED"]);
  const parsed = (q.rows ?? [])
    .map((row: any) => {
      const updatedTs = safeString(row.updated_ts);
      const createdTs = safeString(row.created_ts);
      return {
        status: safeString(row.status).toUpperCase(),
        program_id: safeString(row.program_id),
        field_id: safeString(row.field_id),
        season_id: safeString(row.season_id),
        tenant: {
          tenant_id: safeString(row.tenant_id),
          project_id: safeString(row.project_id),
          group_id: safeString(row.group_id),
        },
        crop_code: safeString(row.crop_code),
        updated_ts: /^[0-9]+$/.test(updatedTs) ? Number(updatedTs) : 0,
        created_ts: /^[0-9]+$/.test(createdTs) ? Number(createdTs) : 0,
        occurred_at_ms: row.occurred_at ? new Date(row.occurred_at).getTime() : 0,
        fact_id: safeString(row.fact_id),
      };
    })
    .filter((x) => x.program_id && x.field_id && x.tenant.tenant_id && !blockedStatus.has(x.status));

  parsed.sort((a, b) => {
    const chainA = a.program_id.startsWith("prg_chain_") ? 1 : 0;
    const chainB = b.program_id.startsWith("prg_chain_") ? 1 : 0;
    if (chainA !== chainB) return chainA - chainB;
    if (a.updated_ts !== b.updated_ts) return b.updated_ts - a.updated_ts;
    if (a.created_ts !== b.created_ts) return b.created_ts - a.created_ts;
    if (a.occurred_at_ms !== b.occurred_at_ms) return b.occurred_at_ms - a.occurred_at_ms;
    return b.fact_id.localeCompare(a.fact_id);
  });

  const dedup = new Map<string, ProgramBinding>();
  for (const item of parsed) {
    const key = `${item.tenant.tenant_id}::${item.field_id}::${item.season_id}`;
    if (!dedup.has(key)) {
      dedup.set(key, {
        program_id: item.program_id,
        field_id: item.field_id,
        season_id: item.season_id,
        tenant: item.tenant,
        crop_code: item.crop_code,
        status: item.status,
      });
    }
  }
  return Array.from(dedup.values());
}

async function loadLatestProgramsByField(pool: Pool): Promise<ProgramBinding[]> {
  const q = await pool.query(
    `SELECT
      (record_json::jsonb#>>'{payload,program_id}') AS program_id,
      (record_json::jsonb#>>'{payload,field_id}') AS field_id,
      (record_json::jsonb#>>'{payload,season_id}') AS season_id,
      (record_json::jsonb#>>'{payload,tenant_id}') AS tenant_id,
      (record_json::jsonb#>>'{payload,project_id}') AS project_id,
      (record_json::jsonb#>>'{payload,group_id}') AS group_id,
      (record_json::jsonb#>>'{payload,crop_code}') AS crop_code,
      (record_json::jsonb#>>'{payload,status}') AS status,
      (record_json::jsonb#>>'{payload,updated_ts}') AS updated_ts,
      (record_json::jsonb#>>'{payload,created_ts}') AS created_ts,
      occurred_at,
      fact_id
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'field_program_v1'`,
  );

  const blockedStatus = new Set(["CANCELLED", "COMPLETED", "ARCHIVED"]);
  const parsed = (q.rows ?? [])
    .map((row: any) => {
      const updatedTs = safeString(row.updated_ts);
      const createdTs = safeString(row.created_ts);
      return {
        status: safeString(row.status).toUpperCase(),
        program_id: safeString(row.program_id),
        field_id: safeString(row.field_id),
        season_id: safeString(row.season_id),
        tenant: {
          tenant_id: safeString(row.tenant_id),
          project_id: safeString(row.project_id),
          group_id: safeString(row.group_id),
        },
        crop_code: safeString(row.crop_code),
        updated_ts: /^[0-9]+$/.test(updatedTs) ? Number(updatedTs) : 0,
        created_ts: /^[0-9]+$/.test(createdTs) ? Number(createdTs) : 0,
        occurred_at_ms: row.occurred_at ? new Date(row.occurred_at).getTime() : 0,
        fact_id: safeString(row.fact_id),
      };
    })
    .filter((x) => x.program_id && x.field_id && x.tenant.tenant_id && !blockedStatus.has(x.status));

  parsed.sort((a, b) => {
    const chainA = a.program_id.startsWith("prg_chain_") ? 1 : 0;
    const chainB = b.program_id.startsWith("prg_chain_") ? 1 : 0;
    if (chainA !== chainB) return chainA - chainB;
    if (a.updated_ts !== b.updated_ts) return b.updated_ts - a.updated_ts;
    if (a.created_ts !== b.created_ts) return b.created_ts - a.created_ts;
    if (a.occurred_at_ms !== b.occurred_at_ms) return b.occurred_at_ms - a.occurred_at_ms;
    return b.fact_id.localeCompare(a.fact_id);
  });

  const dedup = new Map<string, ProgramBinding>();
  for (const item of parsed) {
    const key = `${item.tenant.tenant_id}::${item.field_id}`;
    if (!dedup.has(key)) {
      dedup.set(key, {
        program_id: item.program_id,
        field_id: item.field_id,
        season_id: item.season_id,
        tenant: item.tenant,
        crop_code: item.crop_code,
        status: item.status,
      });
    }
  }
  return Array.from(dedup.values());
}

async function loadDebugProgramCandidatesForField(pool: Pool): Promise<any[]> {
  const q = await pool.query(
    `SELECT
        (record_json::jsonb#>>'{payload,program_id}') AS program_id,
        (record_json::jsonb#>>'{payload,field_id}') AS field_id,
        (record_json::jsonb#>>'{payload,season_id}') AS season_id,
        (record_json::jsonb#>>'{payload,crop_code}') AS crop_code,
        (record_json::jsonb#>>'{payload,status}') AS status,
        (record_json::jsonb#>>'{payload,updated_ts}') AS updated_ts,
        (record_json::jsonb#>>'{payload,created_ts}') AS created_ts,
        occurred_at,
        fact_id
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'field_program_v1'
        AND (record_json::jsonb#>>'{payload,field_id}') = $1
        AND (record_json::jsonb#>>'{payload,season_id}') = $2
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 20`,
    [DEBUG_FIELD_ID, DEBUG_SEASON_ID],
  );
  return q.rows ?? [];
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

async function createOperationPlanFromRecommendation(
  pool: Pool,
  tenant: TenantTriple,
  input: {
    recommendation_id: string;
    program_id: string;
    field_id: string;
    season_id: string | null;
    action_type: string;
    device_id: string | null;
  },
): Promise<string> {
  const operation_plan_id = `opl_agent_${randomUUID().replace(/-/g, "")}`;
  const now = Date.now();
  await insertFact(pool, AGENT_SOURCE, {
    type: "operation_plan_v1",
    payload: {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id,
      recommendation_id: input.recommendation_id,
      program_id: input.program_id,
      field_id: input.field_id,
      season_id: input.season_id,
      device_id: input.device_id,
      action_type: input.action_type,
      status: "CREATED",
      created_ts: now,
      updated_ts: now,
    },
  });
  await insertFact(pool, AGENT_SOURCE, {
    type: "operation_plan_transition_v1",
    payload: {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id,
      status: "CREATED",
      trigger: "agronomy_agent_auto_create",
      created_ts: now,
    },
  });
  return operation_plan_id;
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
    const [programs, latestProgramsByField, telemetryRows, debugCandidates] = await Promise.all([
      loadActivePrograms(pool),
      loadLatestProgramsByField(pool),
      loadLatestSoilTelemetryByField(pool),
      loadDebugProgramCandidatesForField(pool),
    ]);
    console.log("[agronomy-agent] scan loaded", { programs: programs.length, telemetry_fields: telemetryRows.length });
    console.log("[agronomy-agent] debug:field_c8_demo:program_candidates", debugCandidates);
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

    const programsByTarget = new Map<string, ProgramBinding[]>();
    for (const program of programs) {
      const key = `${program.tenant.tenant_id}::${program.field_id}::${program.season_id}`;
      const arr = programsByTarget.get(key) ?? [];
      arr.push(program);
      programsByTarget.set(key, arr);
    }
    for (const target of targets.values()) {
      scannedCount += 1;
      const hasSeasonId = safeString(target.season_id).length > 0;
      let matchMode = hasSeasonId ? "field+season" : "field_fallback";
      let rawCandidates: ProgramBinding[] = [];
      if (hasSeasonId) {
        rawCandidates = programsByTarget.get(`${target.tenant_id}::${target.field_id}::${target.season_id}`) ?? [];
      }
      if (!rawCandidates.length) {
        const fallbackByTenantField = latestProgramsByField.filter(
          (item) => item.tenant.tenant_id === target.tenant_id && item.field_id === target.field_id,
        );
        const fallbackByFieldOnly = fallbackByTenantField.length
          ? []
          : latestProgramsByField.filter((item) => item.field_id === target.field_id);
        rawCandidates = fallbackByTenantField.length ? fallbackByTenantField : fallbackByFieldOnly;
        matchMode = "field_fallback";
      }
      let candidates = rawCandidates.filter((candidate) => ALLOWED_PROGRAM_STATUSES.has(candidate.status));
      if (!candidates.length && hasSeasonId) {
        const fallbackByTenantField = latestProgramsByField.filter(
          (item) => item.tenant.tenant_id === target.tenant_id && item.field_id === target.field_id,
        );
        const fallbackByFieldOnly = fallbackByTenantField.length
          ? []
          : latestProgramsByField.filter((item) => item.field_id === target.field_id);
        rawCandidates = fallbackByTenantField.length ? fallbackByTenantField : fallbackByFieldOnly;
        candidates = rawCandidates.filter((candidate) => ALLOWED_PROGRAM_STATUSES.has(candidate.status));
        matchMode = "field_fallback";
      }
      const rejectedProgramStatuses = rawCandidates
        .filter((candidate) => !ALLOWED_PROGRAM_STATUSES.has(candidate.status))
        .map((candidate) => candidate.status || "UNKNOWN");
      const selectedPrograms: ProgramBinding[] = matchMode === "field_fallback" ? candidates : candidates.slice(0, 1);
      const selectedProgram: ProgramBinding | null = selectedPrograms[0] ?? null;
      const telemetryHit = telemetryByField.has(`${target.tenant_id}::${target.field_id}`) ? 1 : 0;
      const programHit = candidates.length;
      console.log("[agronomy-agent] scan target", {
        field_id: target.field_id,
        season_id: target.season_id || null,
        match_mode: matchMode,
        telemetry_hits: telemetryHit,
        program_hits: programHit,
        selected_program_id: selectedProgram?.program_id ?? null,
        selected_program_status: selectedProgram?.status ?? null,
        crop_code: selectedProgram?.crop_code ?? null,
        rejected_program_statuses: rejectedProgramStatuses,
      });
      console.log("[agronomy-agent] selected_program", {
        field_id: target.field_id,
        season_id: target.season_id || null,
        selected_program_id: selectedProgram?.program_id ?? null,
        selected_program_status: selectedProgram?.status ?? null,
        rejected_program_statuses: rejectedProgramStatuses,
        crop_code: selectedProgram?.crop_code ?? null,
        match_mode: matchMode,
        selected_program_ids: selectedPrograms.map((item) => item.program_id),
      });
      if (target.field_id === DEBUG_FIELD_ID && (target.season_id || "") === DEBUG_SEASON_ID) {
        console.log("[agronomy-agent] debug:field_c8_demo:selected", {
          field_id: target.field_id,
          season_id: target.season_id,
          selected_program_id: selectedProgram?.program_id ?? null,
          crop_code: selectedProgram?.crop_code ?? null,
        });
      }
      if (!selectedProgram) {
        skipped += 1;
        skippedByReason.no_program += 1;
        console.log("[agronomy-agent] skipped:no_program", { field_id: target.field_id, season_id: target.season_id || null });
        console.log("[agronomy-agent] branch", { result: "skipped:no_program", field_id: target.field_id, season_id: target.season_id || null });
        continue;
      }
      for (const selectedProgramItem of selectedPrograms) {
        console.log("[agronomy-agent] candidate attempt", {
          field_id: selectedProgramItem.field_id,
          season_id: selectedProgramItem.season_id || null,
          program_id: selectedProgramItem.program_id,
          crop_code: selectedProgramItem.crop_code,
          match_mode: matchMode,
        });
        const telemetry = telemetryByField.get(`${selectedProgramItem.tenant.tenant_id}::${selectedProgramItem.field_id}`);
        const soilMoisture = telemetry?.soil_moisture;
        if (!Number.isFinite(soilMoisture ?? Number.NaN)) {
          skippedByReason.no_telemetry += 1;
          console.log("[agronomy-agent] skipped:no_telemetry", { field_id: selectedProgramItem.field_id });
          console.log("[agronomy-agent] branch", { result: "skipped:no_telemetry", field_id: selectedProgramItem.field_id, season_id: selectedProgramItem.season_id || null, program_id: selectedProgramItem.program_id });
        }
        const effectiveSoilMoisture = Number.isFinite(soilMoisture ?? Number.NaN)
          ? Number(soilMoisture)
          : DEFAULT_SOIL_MOISTURE;

        if (!selectedProgramItem.program_id) {
          skipped += 1;
          skippedByReason.no_program += 1;
          console.log("[agronomy-agent] skipped:no_program", { field_id: selectedProgramItem.field_id, season_id: selectedProgramItem.season_id || null });
          console.log("[agronomy-agent] branch", { result: "skipped:no_program", field_id: selectedProgramItem.field_id, season_id: selectedProgramItem.season_id || null });
          continue;
        }
        if (!selectedProgramItem.tenant.tenant_id || !selectedProgramItem.tenant.project_id || !selectedProgramItem.tenant.group_id) {
          skipped += 1;
          skippedByReason.no_program += 1;
          console.log("[agronomy-agent] skipped:no_program", { field_id: selectedProgramItem.field_id, season_id: selectedProgramItem.season_id || null });
          console.log("[agronomy-agent] branch", { result: "skipped:no_program", field_id: selectedProgramItem.field_id, season_id: selectedProgramItem.season_id || null });
          continue;
        }
        if (!selectedProgramItem.crop_code) {
          skipped += 1;
          skippedByReason.no_crop_code += 1;
          console.log("[agronomy-agent] skipped:no_crop_code", { program_id: selectedProgramItem.program_id });
          console.log("[agronomy-agent] branch", { result: "skipped:no_crop_code", field_id: selectedProgramItem.field_id, season_id: selectedProgramItem.season_id || null, program_id: selectedProgramItem.program_id });
          continue;
        }

        const hasPendingPlan = await existsPendingOperationPlan(pool, selectedProgramItem.tenant, selectedProgramItem.program_id);
        if (hasPendingPlan) {
          skipped += 1;
          skippedByReason.duplicate += 1;
          console.log("[agronomy-agent] skipped:duplicate", { field_id: selectedProgramItem.field_id, program_id: selectedProgramItem.program_id });
          console.log("[agronomy-agent] branch", { result: "skipped:duplicate", field_id: selectedProgramItem.field_id, season_id: selectedProgramItem.season_id || null, program_id: selectedProgramItem.program_id });
          continue;
        }

        const cropCode = safeString(selectedProgramItem.crop_code).toLowerCase();
        let action_type = "IRRIGATE";
        let reason_code = "soil_moisture_below_optimal";
        let recommendation_type = "irrigation_recommendation_v1";
        let suggested_action_type = "irrigation.start";
        let summary = `根据当前作物模型（${selectedProgramItem.crop_code}），建议进行灌溉处理`;
        switch (cropCode) {
          case "corn": {
            const agronomy = evaluateAgronomy({
              crop_code: selectedProgramItem.crop_code,
              soil_moisture: effectiveSoilMoisture,
            });
            action_type = "IRRIGATE";
            reason_code = safeString(agronomy.reason) || "soil_moisture_below_optimal";
            recommendation_type = "irrigation_recommendation_v1";
            suggested_action_type = "irrigation.start";
            summary = `根据当前作物模型（${selectedProgramItem.crop_code}），建议进行灌溉处理`;
            break;
          }
          case "tomato": {
            action_type = "FERTILIZE";
            reason_code = "tomato_nutrient_maintenance";
            recommendation_type = "fertilization_recommendation_v1";
            suggested_action_type = "fertilization.apply";
            summary = `根据当前作物模型（${selectedProgramItem.crop_code}），建议进行追肥处理`;
            break;
          }
          default: {
            const agronomy = evaluateAgronomy({
              crop_code: selectedProgramItem.crop_code,
              soil_moisture: effectiveSoilMoisture,
            });
            action_type = "IRRIGATE";
            reason_code = safeString(agronomy.reason) || "soil_moisture_below_optimal";
            recommendation_type = "irrigation_recommendation_v1";
            suggested_action_type = "irrigation.start";
            summary = `根据当前作物模型（${selectedProgramItem.crop_code}），建议进行灌溉处理`;
            break;
          }
        }
        const duplicated = await existsRecentRecommendation(pool, selectedProgramItem.tenant, selectedProgramItem.program_id, selectedProgramItem.field_id, action_type, reason_code);
        if (duplicated) {
          skipped += 1;
          skippedByReason.duplicate += 1;
          console.log("[agronomy-agent] skipped:duplicate", { field_id: selectedProgramItem.field_id, program_id: selectedProgramItem.program_id });
          console.log("[agronomy-agent] branch", { result: "skipped:duplicate", field_id: selectedProgramItem.field_id, season_id: selectedProgramItem.season_id || null, program_id: selectedProgramItem.program_id });
          continue;
        }

        const recommendation_id = `rec_agent_${randomUUID().replace(/-/g, "")}`;
        const basePayload = {
          tenant_id: selectedProgramItem.tenant.tenant_id,
          project_id: selectedProgramItem.tenant.project_id,
          group_id: selectedProgramItem.tenant.group_id,
          program_id: selectedProgramItem.program_id,
          field_id: selectedProgramItem.field_id,
          device_id: telemetry?.device_id ?? null,
          season_id: selectedProgramItem.season_id || null,
          action_type,
          reason_codes: [reason_code],
          title: "系统建议",
          summary,
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
            recommendation_type,
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
              action_type: suggested_action_type,
              summary: basePayload.summary,
              parameters: {
                program_id: selectedProgramItem.program_id,
                crop_code: selectedProgramItem.crop_code,
                soil_moisture: effectiveSoilMoisture,
              },
            },
            created_ts: Date.now(),
            model_version: "agronomy_agent_v1",
          },
        });
        await createOperationPlanFromRecommendation(pool, selectedProgramItem.tenant, {
          recommendation_id,
          program_id: selectedProgramItem.program_id,
          field_id: selectedProgramItem.field_id,
          season_id: selectedProgramItem.season_id || null,
          action_type,
          device_id: telemetry?.device_id ?? null,
        });

        created += 1;
        console.log("[agronomy-agent] recommendation created", {
          field_id: selectedProgramItem.field_id,
          season_id: selectedProgramItem.season_id || null,
          program_id: selectedProgramItem.program_id,
          crop_code: selectedProgramItem.crop_code,
          action_type,
        });
        console.log("[agronomy-agent] branch", { result: "created", field_id: selectedProgramItem.field_id, season_id: selectedProgramItem.season_id || null, program_id: selectedProgramItem.program_id });
      }
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
