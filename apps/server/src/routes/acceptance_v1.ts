import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import GeoxContracts from "@geox/contracts";
import type { AcceptanceResultV1Payload } from "@geox/contracts";

import { requireAoActAnyScopeV0, requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { evaluateAcceptanceV1 } from "../domain/acceptance/engine_v1.js";
import { appendSkillRunFact, appendSkillTraceFact, digestJson } from "../domain/skill_registry/facts.js";
import { listJudgeResultsV2, loadJudgeResultV2 } from "../domain/judge/judge_result_v2.js";
import { recordMemoryV1 } from "../services/field_memory_service.js";

const FACT_SOURCE_ACCEPTANCE_V1 = "api/v1/acceptance";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

const EvaluateRequestSchema = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  group_id: z.string().min(1),
  act_task_id: z.string().min(1),
  judge_result_ids: z.array(z.string().min(1)).optional(),
  execution_judge_id: z.string().min(1).optional()
});

const AcceptanceReadQuerySchema = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  group_id: z.string().min(1),
  act_task_id: z.string().min(1),
  limit: z.union([z.string(), z.number()]).optional()
});

function requireTenantMatchOr404(
  auth: { tenant_id: string; project_id: string; group_id: string },
  target: TenantTriple,
  reply: any
): boolean {
  if (auth.tenant_id !== target.tenant_id || auth.project_id !== target.project_id || auth.group_id !== target.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function normalizeRecordJson(v: unknown): any {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
}

async function loadTaskFact(pool: Pool, actTaskId: string, tenant: TenantTriple): Promise<{ fact_id: string; occurred_at: string | null; record_json: any } | null> {
  const sql = `
    SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb)->>'type' = 'ao_act_task_v0'
      AND (record_json::jsonb)#>>'{payload,act_task_id}' = $1
      AND (record_json::jsonb)#>>'{payload,tenant_id}' = $2
      AND (record_json::jsonb)#>>'{payload,project_id}' = $3
      AND (record_json::jsonb)#>>'{payload,group_id}' = $4
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT 1
  `;
  const r = await pool.query(sql, [actTaskId, tenant.tenant_id, tenant.project_id, tenant.group_id]);
  if (!r.rows?.length) return null;
  return {
    fact_id: String(r.rows[0].fact_id),
    occurred_at: r.rows[0].occurred_at ? String(r.rows[0].occurred_at) : null,
    record_json: normalizeRecordJson(r.rows[0].record_json)
  };
}

async function loadReceiptFact(pool: Pool, actTaskId: string, tenant: TenantTriple): Promise<{ fact_id: string; record_json: any } | null> {
  const sql = `
    SELECT fact_id, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb)->>'type' = 'ao_act_receipt_v0'
      AND (record_json::jsonb)#>>'{payload,act_task_id}' = $1
      AND (record_json::jsonb)#>>'{payload,tenant_id}' = $2
      AND (record_json::jsonb)#>>'{payload,project_id}' = $3
      AND (record_json::jsonb)#>>'{payload,group_id}' = $4
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT 1
  `;
  const r = await pool.query(sql, [actTaskId, tenant.tenant_id, tenant.project_id, tenant.group_id]);
  if (!r.rows?.length) return null;
  return {
    fact_id: String(r.rows[0].fact_id),
    record_json: normalizeRecordJson(r.rows[0].record_json)
  };
}

function deriveTelemetryFromReceipt(receipt: any): Record<string, number> {
  const observed = (receipt?.payload?.observed_parameters ?? {}) as Record<string, unknown>;
  const directDuration = Number((observed as any).duration_min);
  if (Number.isFinite(directDuration) && directDuration > 0) {
    return { duration_min: directDuration };
  }

  const startTs = Number(receipt?.payload?.execution_time?.start_ts);
  const endTs = Number(receipt?.payload?.execution_time?.end_ts);
  if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs) {
    return { duration_min: (endTs - startTs) / 60000 };
  }

  return {};
}

function normalizeGeoPoint(raw: any): { lat: number; lon: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const lat = Number(raw?.lat ?? raw?.latitude ?? raw?.location?.lat ?? raw?.location?.latitude);
  const lon = Number(raw?.lon ?? raw?.lng ?? raw?.longitude ?? raw?.location?.lon ?? raw?.location?.lng ?? raw?.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

async function loadFieldPolygon(pool: Pool, tenantId: string, fieldId: string | null): Promise<any | null> {
  if (!fieldId) return null;
  const q = await pool.query(`SELECT geojson FROM field_polygon_v1 WHERE tenant_id = $1 AND field_id = $2`, [tenantId, fieldId]);
  if (!q.rows?.length) return null;
  return normalizeRecordJson(q.rows[0].geojson);
}

async function loadTrackPoints(pool: Pool, tenant: TenantTriple, deviceId: string | null, startTs: number | null, endTs: number | null): Promise<Array<{ lat: number; lon: number; ts_ms: number }>> {
  if (!deviceId || !startTs || !endTs || endTs < startTs) return [];
  const q = await pool.query(
    `SELECT COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) AS ts_ms,
            (record_json::jsonb #> '{payload,geo}') AS geo_json
       FROM facts
      WHERE (record_json::jsonb #>> '{entity,tenant_id}') = $1
        AND (record_json::jsonb #>> '{entity,device_id}') = $2
        AND (record_json::jsonb ->> 'type') IN ('raw_telemetry_v1','device_heartbeat_v1')
        AND (record_json::jsonb #> '{payload,geo}') IS NOT NULL
        AND COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) BETWEEN $3 AND $4
      ORDER BY ts_ms ASC`,
    [tenant.tenant_id, deviceId, startTs, endTs]
  );
  const strictPoints = (q.rows ?? []).map((row: any) => {
    const geo = normalizeGeoPoint(normalizeRecordJson(row.geo_json) ?? row.geo_json);
    const ts_ms = Number(row.ts_ms ?? 0);
    if (!geo || !Number.isFinite(ts_ms) || ts_ms <= 0) return null;
    return { lat: geo.lat, lon: geo.lon, ts_ms };
  }).filter(Boolean) as Array<{ lat: number; lon: number; ts_ms: number }>;
  if (strictPoints.length > 0) return strictPoints;

  const fallbackQ = await pool.query(
    `SELECT COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) AS ts_ms,
            (record_json::jsonb #> '{payload,geo}') AS geo_json
       FROM facts
      WHERE (record_json::jsonb #>> '{entity,tenant_id}') = $1
        AND (record_json::jsonb #>> '{entity,device_id}') = $2
        AND (record_json::jsonb ->> 'type') IN ('raw_telemetry_v1','device_heartbeat_v1')
        AND (record_json::jsonb #> '{payload,geo}') IS NOT NULL
      ORDER BY ts_ms DESC
      LIMIT 500`,
    [tenant.tenant_id, deviceId]
  );
  return (fallbackQ.rows ?? []).map((row: any) => {
    const geo = normalizeGeoPoint(normalizeRecordJson(row.geo_json) ?? row.geo_json);
    const ts_ms = Number(row.ts_ms ?? 0);
    if (!geo || !Number.isFinite(ts_ms) || ts_ms <= 0) return null;
    return { lat: geo.lat, lon: geo.lon, ts_ms };
  }).filter(Boolean).reverse() as Array<{ lat: number; lon: number; ts_ms: number }>;
}

async function inferFieldIdFromDeviceBinding(pool: Pool, tenantId: string, deviceId: string | null): Promise<string | null> {
  if (!deviceId) return null;
  const q = await pool.query(
    `SELECT field_id
       FROM device_binding_index_v1
      WHERE tenant_id = $1 AND device_id = $2
      ORDER BY bound_ts_ms DESC
      LIMIT 1`,
    [tenantId, deviceId]
  );
  return q.rows?.length ? String(q.rows[0].field_id ?? "").trim() || null : null;
}

async function loadProgramAcceptancePolicyRef(
  pool: Pool,
  tenant: TenantTriple,
  programId: string | null
): Promise<string | null> {
  if (!programId) return null;
  const q = await pool.query(
    `SELECT (record_json::jsonb #>> '{payload,acceptance_policy_ref}') AS acceptance_policy_ref
       FROM facts
      WHERE (record_json::jsonb ->> 'type') = 'field_program_v1'
        AND (record_json::jsonb #>> '{payload,tenant_id}') = $1
        AND (record_json::jsonb #>> '{payload,project_id}') = $2
        AND (record_json::jsonb #>> '{payload,group_id}') = $3
        AND (record_json::jsonb #>> '{payload,program_id}') = $4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, programId]
  );
  if (!q.rows?.length) return null;
  const value = String(q.rows[0].acceptance_policy_ref ?? "").trim();
  return value || null;
}

async function loadLatestExecutionJudgeForTask(pool: Pool, tenant: TenantTriple, task_id: string): Promise<string | null> {
  const rows = await listJudgeResultsV2(pool, {
    ...tenant,
    judge_kind: "EXECUTION",
    task_id,
    limit: 1,
  });
  return rows[0]?.judge_id ?? null;
}



type AcceptanceDerivedStates = {
  water_flow_state: Record<string, any> | null;
  fertility_state: Record<string, any> | null;
  sensor_quality_state: Record<string, any> | null;
};

async function loadAcceptanceDerivedStates(pool: Pool, tenant: TenantTriple, fieldId: string | null): Promise<AcceptanceDerivedStates> {
  if (!fieldId) {
    return { water_flow_state: null, fertility_state: null, sensor_quality_state: null };
  }
  const q = await pool.query(
    `SELECT DISTINCT ON (state_type) state_type, payload_json
       FROM derived_sensing_state_index_v1
      WHERE tenant_id = $1
        AND field_id = $2
        AND ($3::text IS NULL OR project_id = $3)
        AND ($4::text IS NULL OR group_id = $4)
        AND state_type = ANY($5::text[])
      ORDER BY state_type, computed_at_ts_ms DESC`,
    [tenant.tenant_id, fieldId, tenant.project_id, tenant.group_id, ["water_flow_state", "fertility_state", "sensor_quality_state"]]
  ).catch(() => ({ rows: [] as any[] }));

  const byType = new Map<string, Record<string, any>>();
  for (const row of q.rows ?? []) {
    byType.set(String(row.state_type), normalizeRecordJson(row.payload_json) ?? row.payload_json ?? null);
  }
  return {
    water_flow_state: byType.get("water_flow_state") ?? null,
    fertility_state: byType.get("fertility_state") ?? null,
    sensor_quality_state: byType.get("sensor_quality_state") ?? null,
  };
}
export function toVerdict(result: "PASSED" | "FAILED" | "INCONCLUSIVE"): "PASS" | "FAIL" | "PARTIAL" {
  if (result === "PASSED") return "PASS";
  if (result === "FAILED") return "FAIL";
  return "PARTIAL";
}

function finiteOptionalMetric(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function buildAcceptanceMetrics(params: { evaluated: { score?: number; metrics: Record<string, number> }; expectedDurationMin: number | null }): AcceptanceResultV1Payload["metrics"] {
  const m = params.evaluated.metrics ?? {};
  const inFieldRatio = Number(m.in_field_ratio);
  const coverageRatio = Number(params.evaluated.score ?? m.coverage_ratio ?? 0);
  const expected = Number(params.expectedDurationMin);
  const actual = Number(m.actual_duration);
  const telemetryDelta = Number.isFinite(expected) && expected > 0 && Number.isFinite(actual)
    ? Math.abs(actual - expected) / expected
    : 0;
  const out: AcceptanceResultV1Payload["metrics"] = {
    coverage_ratio: Number.isFinite(coverageRatio) ? coverageRatio : 0,
    in_field_ratio: Number.isFinite(inFieldRatio) ? inFieldRatio : 0,
    telemetry_delta: Number.isFinite(telemetryDelta) ? telemetryDelta : 0
  };

  const zoneApplicationCount = finiteOptionalMetric(m.zone_application_count);
  if (zoneApplicationCount !== undefined) out.zone_application_count = zoneApplicationCount;

  const zoneCompletionRate = finiteOptionalMetric(m.zone_completion_rate);
  if (zoneCompletionRate !== undefined) out.zone_completion_rate = zoneCompletionRate;

  const avgZoneCoveragePercent = finiteOptionalMetric(m.avg_zone_coverage_percent);
  if (avgZoneCoveragePercent !== undefined) out.avg_zone_coverage_percent = avgZoneCoveragePercent;

  const maxZoneDeviationPercent = finiteOptionalMetric(m.max_zone_deviation_percent);
  if (maxZoneDeviationPercent !== undefined) out.max_zone_deviation_percent = maxZoneDeviationPercent;

  return out;
}

export function registerAcceptanceV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/acceptance/evaluate", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["acceptance.read", "ao_act.index.read"]);
      if (!auth) return;

      const body = EvaluateRequestSchema.parse((req as any).body ?? {});
      const tenant: TenantTriple = {
        tenant_id: body.tenant_id,
        project_id: body.project_id,
        group_id: body.group_id
      };
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      const taskFact = await loadTaskFact(pool, body.act_task_id, tenant);
      if (!taskFact) return reply.status(404).send({ ok: false, error: "TASK_NOT_FOUND" });

      const receiptFact = await loadReceiptFact(pool, body.act_task_id, tenant);
      if (!receiptFact) return reply.status(404).send({ ok: false, error: "RECEIPT_NOT_FOUND" });

      const taskPayload = taskFact.record_json?.payload ?? {};
      const telemetry = deriveTelemetryFromReceipt(receiptFact.record_json);
      const taskFactOccurredAtMs = Number(Date.parse(String(taskFact?.occurred_at ?? ""))) || null;
      const device_id = typeof taskPayload?.meta?.device_id === "string"
        ? taskPayload.meta.device_id
        : (typeof taskPayload?.device_id === "string" ? taskPayload.device_id : null);
      const fieldIdFromPayload = typeof taskPayload.field_id === "string" ? taskPayload.field_id : null;
      const field_id = fieldIdFromPayload || await inferFieldIdFromDeviceBinding(pool, tenant.tenant_id, device_id);
      const start_ts_raw = Number(taskPayload?.time_window?.start_ts ?? 0);
      const end_ts_raw = Number(taskPayload?.time_window?.end_ts ?? 0);
      const start_ts = Number.isFinite(start_ts_raw) && start_ts_raw > 0 ? start_ts_raw : (taskFactOccurredAtMs ?? Date.now() - 2 * 60 * 60 * 1000);
      const end_ts = Number.isFinite(end_ts_raw) && end_ts_raw > 0 ? end_ts_raw : (start_ts + 2 * 60 * 60 * 1000);
      const program_id = typeof taskPayload?.program_id === "string" ? taskPayload.program_id : null;
      const [field_polygon, track_points, acceptance_policy_ref, derived_states] = await Promise.all([
        loadFieldPolygon(pool, tenant.tenant_id, field_id),
        loadTrackPoints(pool, tenant, device_id, start_ts, end_ts),
        loadProgramAcceptancePolicyRef(pool, tenant, program_id),
        loadAcceptanceDerivedStates(pool, tenant, field_id)
      ]);
      const executionJudgeId = await loadLatestExecutionJudgeForTask(pool, tenant, body.act_task_id);
      const executionJudgeIdFromInput = typeof body.execution_judge_id === "string" ? body.execution_judge_id.trim() : "";
      let executionJudge = null as Awaited<ReturnType<typeof loadJudgeResultV2>> | null;
      if (executionJudgeIdFromInput) {
        executionJudge = await loadJudgeResultV2(pool, { ...tenant, judge_id: executionJudgeIdFromInput });
        if (!executionJudge) return reply.status(404).send({ ok: false, error: "EXECUTION_JUDGE_NOT_FOUND" });
        if (executionJudge.judge_kind !== "EXECUTION") {
          return reply.status(400).send({ ok: false, error: "INVALID_EXECUTION_JUDGE_KIND" });
        }
      }

      const effectiveExecutionJudgeId = executionJudgeIdFromInput || executionJudgeId || "";
      const judgeResultIds = Array.from(new Set([
        ...(body.judge_result_ids ?? []),
        ...(effectiveExecutionJudgeId ? [effectiveExecutionJudgeId] : [])
      ]));

      const evaluated = evaluateAcceptanceV1({
        action_type: String(taskPayload.action_type ?? ""),
        parameters: (taskPayload.parameters ?? {}) as Record<string, any>,
        telemetry: { ...telemetry, field_polygon, track_points },
        receipt: receiptFact.record_json ?? {},
        water_flow_state: derived_states.water_flow_state,
        fertility_state: derived_states.fertility_state,
        sensor_quality_state: derived_states.sensor_quality_state,
        acceptance_policy_ref
      });
      const trace_id =
        String(taskPayload?.trace_id ?? taskPayload?.meta?.trace_id ?? "").trim()
        || `trace_${randomUUID().replace(/-/g, "")}`;
      await appendSkillTraceFact(pool, {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        trace_id,
        skill_run_id: null,
        inputs: {
          action_type: String(taskPayload.action_type ?? ""),
          parameters: taskPayload.parameters ?? {},
          acceptance_policy_ref,
        },
        outputs: {
          result: evaluated.result,
          metrics: evaluated.metrics,
          explanation_codes: evaluated.explanation_codes ?? [],
        },
        confidence: { level: "MEDIUM", basis: "estimated", reasons: ["acceptance_engine_v1"] },
        evidence_refs: [taskFact.fact_id, receiptFact.fact_id, ...judgeResultIds],
      });
      await appendSkillRunFact(pool, {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        skill_id: evaluated.acceptance_skill_id ?? "acceptance_manual_fallback_v1",
        version: evaluated.acceptance_skill_version ?? "v1",
        category: "ACCEPTANCE",
        status: "ACTIVE",
        result_status: evaluated.result === "PASSED" ? "SUCCESS" : (evaluated.result === "FAILED" ? "FAILED" : "SKIPPED"),
        trigger_stage: "after_acceptance",
        scope_type: "FIELD",
        rollout_mode: "DIRECT",
        bind_target: field_id ?? body.act_task_id,
        operation_id: null,
        task_id: body.act_task_id,
        operation_plan_id: typeof taskPayload.operation_plan_id === "string" ? taskPayload.operation_plan_id : null,
        field_id,
        device_id,
        input_digest: digestJson({ action_type: taskPayload.action_type, parameters: taskPayload.parameters, receipt: receiptFact.record_json?.payload ?? {}, derived_states, acceptance_policy_ref }),
        output_digest: digestJson(evaluated),
        error_code: null,
        duration_ms: 0,
      });

      const acceptanceFactId = randomUUID();
      const nowIso = new Date().toISOString();
      const expectedDurationMin = Number(taskPayload?.parameters?.duration_min);
      const acceptanceRecord = {
        type: "acceptance_result_v1",
        payload: GeoxContracts.AcceptanceResultV1PayloadSchema.parse({
          acceptance_id: acceptanceFactId,
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          act_task_id: body.act_task_id,
          field_id: field_id ?? "unknown_field",
          operation_plan_id: typeof taskPayload.operation_plan_id === "string" ? taskPayload.operation_plan_id : undefined,
          trace_id,
          program_id: typeof taskPayload.program_id === "string" ? taskPayload.program_id : undefined,
          verdict: toVerdict(evaluated.result),
          metrics: buildAcceptanceMetrics({ evaluated, expectedDurationMin: Number.isFinite(expectedDurationMin) ? expectedDurationMin : null }),
          rule_id: evaluated.rule_id,
          explanation_codes: evaluated.explanation_codes,
          acceptance_skill_id: evaluated.acceptance_skill_id,
          acceptance_skill_version: evaluated.acceptance_skill_version,
          input_digest: digestJson({ action_type: taskPayload.action_type, parameters: taskPayload.parameters, receipt: receiptFact.record_json?.payload ?? {}, derived_states, acceptance_policy_ref }),
          output_digest: digestJson({ result: evaluated.result, verdict: toVerdict(evaluated.result), explanation_codes: evaluated.explanation_codes, metrics: evaluated.metrics }),
          evaluated_at: nowIso,
          evidence_refs: [taskFact.fact_id, receiptFact.fact_id, ...judgeResultIds],
          execution_judge_id: effectiveExecutionJudgeId || undefined,
          execution_judge_verdict: executionJudge?.verdict || undefined
        })
      };

      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [acceptanceFactId, FACT_SOURCE_ACCEPTANCE_V1, acceptanceRecord]
      );

      if (acceptanceRecord.payload.verdict === "PASS" && field_id) {
        const soilMoistureDeltaRaw = Number((receiptFact.record_json?.payload?.observed_parameters ?? {})?.soil_moisture_delta);
        const soil_moisture_delta = Number.isFinite(soilMoistureDeltaRaw) ? soilMoistureDeltaRaw : undefined;
        await recordMemoryV1(pool, tenant.tenant_id, {
          type: "operation_outcome",
          operation_id: typeof taskPayload.operation_id === "string" ? taskPayload.operation_id : undefined,
          field_id,
          metrics: {
            success: true,
            acceptance_passed: true,
            soil_moisture_delta,
          },
          evidence_refs: [taskFact.fact_id, receiptFact.fact_id, ...judgeResultIds],
          summary: `Acceptance passed for task ${body.act_task_id}`,
        }).catch(() => undefined);
      }

      return reply.send({
        ok: true,
        verdict: acceptanceRecord.payload.verdict,
        fact_id: acceptanceFactId,
        judge_result_ids_used: judgeResultIds
      });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v1/acceptance/results", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["acceptance.read", "ao_act.index.read"]);
      if (!auth) return;

      const q = AcceptanceReadQuerySchema.parse((req as any).query ?? {});
      const tenant: TenantTriple = {
        tenant_id: q.tenant_id,
        project_id: q.project_id,
        group_id: q.group_id
      };
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      const limitRaw = Number(q.limit ?? 20);
      const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.trunc(limitRaw))) : 20;

      const out = await pool.query(
        `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
           FROM facts
          WHERE (record_json::jsonb->>'type') = 'acceptance_result_v1'
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,project_id}') = $2
            AND (record_json::jsonb#>>'{payload,group_id}') = $3
            AND (record_json::jsonb#>>'{payload,act_task_id}') = $4
          ORDER BY occurred_at DESC, fact_id DESC
          LIMIT ${limit}`,
        [tenant.tenant_id, tenant.project_id, tenant.group_id, q.act_task_id]
      );

      return reply.send({
        ok: true,
        items: (out.rows ?? []).map((row: any) => ({
          fact_id: String(row.fact_id),
          occurred_at: row.occurred_at,
          record_json: normalizeRecordJson(row.record_json)
        }))
      });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });
}
