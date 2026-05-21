import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import GeoxContracts from "@geox/contracts";
import type { AcceptanceResultV1Payload } from "@geox/contracts";

import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";
import { evaluateAcceptanceV1 } from "../domain/acceptance/engine_v1.js";
import { evidencePolicyFromReceiptV1, type FormalEvidenceSourceLaneV1, type FormalEvidencePolicyResultV1 } from "../domain/evidence/formal_evidence_policy_v1.js";
import { appendSkillRunFact, appendSkillTraceFact, digestJson } from "../domain/skill_registry/facts.js";
import { listJudgeResultsV2, loadJudgeResultV2 } from "../domain/judge/judge_result_v2.js";
import { recordMemoryV1 } from "../services/field_memory_service.js";
import { createFailSafeEventV1, createManualTakeoverV1 } from "../services/fail_safe_service_v1.js";
import { auditContextFromRequestV1, recordSecurityAuditEventV1 } from "../services/security_audit_service_v1.js";

const FACT_SOURCE_ACCEPTANCE_V1 = "api/v1/acceptance";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type AcceptanceWriteVerdictV1 = "PASS" | "FAIL" | "PARTIAL" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE";
type AcceptanceSourceLaneV1 = "FORMAL_OPERATION" | "SIMULATED_DEV_ONLY" | "DEBUG_ONLY" | "UNKNOWN";

type FormalAcceptanceGateV1 = {
  formal_evidence_passed: boolean;
  formal_execution_passed: boolean;
  non_simulated_chain: boolean;
  formal_acceptance: boolean;
  source_lane: AcceptanceSourceLaneV1;
  is_simulated: boolean;
  blocking_reasons: string[];
  customer_visible_eligible: boolean;
  trust_level: "FORMAL_ACCEPTED" | "NEEDS_REVIEW" | "INSUFFICIENT_FORMAL_EVIDENCE" | "SIMULATED_DEV_ONLY";
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

function requireTenantMatchOr404(auth: TenantTriple & { role?: string }, target: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== target.tenant_id || auth.project_id !== target.project_id || auth.group_id !== target.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function requireAcceptanceEvaluateRoleV1(reply: any, auth: any): boolean {
  const role = String(auth?.role ?? "").trim();
  if (role === "admin" || role === "operator") return true;
  reply.status(403).send({ ok: false, error: "ACCEPTANCE_EVALUATE_ROLE_DENIED" });
  return false;
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
  return { fact_id: String(r.rows[0].fact_id), occurred_at: r.rows[0].occurred_at ? String(r.rows[0].occurred_at) : null, record_json: normalizeRecordJson(r.rows[0].record_json) };
}

async function loadReceiptFact(pool: Pool, actTaskId: string, tenant: TenantTriple): Promise<{ fact_id: string; record_json: any } | null> {
  const sql = `
    SELECT fact_id, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb)->>'type' IN ('ao_act_receipt_v0','ao_act_receipt_v1')
      AND COALESCE((record_json::jsonb)#>>'{payload,act_task_id}', (record_json::jsonb)#>>'{payload,task_id}') = $1
      AND (record_json::jsonb)#>>'{payload,tenant_id}' = $2
      AND (record_json::jsonb)#>>'{payload,project_id}' = $3
      AND (record_json::jsonb)#>>'{payload,group_id}' = $4
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT 1
  `;
  const r = await pool.query(sql, [actTaskId, tenant.tenant_id, tenant.project_id, tenant.group_id]);
  if (!r.rows?.length) return null;
  return { fact_id: String(r.rows[0].fact_id), record_json: normalizeRecordJson(r.rows[0].record_json) };
}

async function loadLatestExecutionJudgeForTask(pool: Pool, tenant: TenantTriple, task_id: string): Promise<string | null> {
  const rows = await listJudgeResultsV2(pool, { ...tenant, judge_kind: "EXECUTION", task_id, limit: 1 });
  return rows[0]?.judge_id ?? null;
}

export function toVerdict(result: "PASSED" | "FAILED" | "INCONCLUSIVE"): "PASS" | "FAIL" | "PARTIAL" {
  if (result === "PASSED") return "PASS";
  if (result === "FAILED") return "FAIL";
  return "PARTIAL";
}

function deriveTelemetryFromReceipt(receipt: any): Record<string, number> {
  const observed = (receipt?.payload?.observed_parameters ?? {}) as Record<string, unknown>;
  const directDuration = Number((observed as any).duration_min);
  if (Number.isFinite(directDuration) && directDuration > 0) return { duration_min: directDuration };
  const startTs = Number(receipt?.payload?.execution_time?.start_ts);
  const endTs = Number(receipt?.payload?.execution_time?.end_ts);
  if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs) return { duration_min: (endTs - startTs) / 60000 };
  return {};
}

function toSourceLane(lanes: FormalEvidenceSourceLaneV1[]): AcceptanceSourceLaneV1 {
  if (lanes.includes("SIMULATED_DEV_ONLY")) return "SIMULATED_DEV_ONLY";
  if (lanes.includes("DEBUG_ONLY")) return "DEBUG_ONLY";
  if (lanes.includes("FORMAL_OPERATION")) return "FORMAL_OPERATION";
  return "UNKNOWN";
}

function isPassLike(value: unknown): boolean {
  const status = String(value ?? "").trim().toUpperCase();
  return ["PASS", "PASSED", "SUCCESS", "SUCCEEDED", "VALID"].includes(status);
}

function hasExecutionJudgePass(executionJudge: any): boolean {
  if (!executionJudge || typeof executionJudge !== "object") return false;
  return isPassLike(executionJudge.verdict)
    || isPassLike(executionJudge.result)
    || isPassLike(executionJudge.status)
    || isPassLike(executionJudge.payload?.verdict)
    || isPassLike(executionJudge.record_json?.payload?.verdict);
}

function collectReceiptEvidenceItems(receipt: any): any[] {
  const payload = receipt?.payload ?? {};
  const lists = [
    payload.artifacts,
    payload.artifact_refs,
    payload.logs_refs,
    payload.logs,
    payload.media_refs,
    payload.media,
    payload.photo_refs,
    payload.metrics,
    payload.metric_refs,
  ];
  return lists.flatMap((v) => Array.isArray(v) ? v : []);
}

function hasReceiptCompletenessSkillPass(receipt: any): boolean {
  const payload = receipt?.payload ?? {};
  const candidates = [
    payload.receipt_completeness,
    payload.receipt_completeness_skill,
    payload.meta?.receipt_completeness,
    payload.meta?.receipt_completeness_skill,
    ...(Array.isArray(payload.skill_results) ? payload.skill_results : []),
  ];
  return candidates.some((candidate) => {
    const raw = JSON.stringify(candidate ?? "").toLowerCase();
    return raw.includes("receipt_completeness") && (isPassLike(candidate?.verdict) || isPassLike(candidate?.result) || isPassLike(candidate?.status));
  });
}

function hasFormalExecutionEvidenceV1(receipt: any, policy: FormalEvidencePolicyResultV1): boolean {
  if (!policy.formal_evidence_passed) return false;
  const evidenceItems = collectReceiptEvidenceItems(receipt);
  const formalExecutionMarkers = [
    "water_delivery_receipt",
    "delivery_receipt",
    "water_delivery",
    "in_field_trajectory",
    "formal_trajectory",
    "coverage_evidence",
    "coverage_receipt",
    "coverage_percent",
    "post_effect",
    "effect_observation",
    "soil_moisture_delta",
    "as_applied",
    "flow_meter",
    "meter_reading",
  ];
  return evidenceItems.some((item) => {
    const raw = JSON.stringify(item ?? "").toLowerCase();
    if (!raw || raw.includes("sim_trace") || raw.includes("debug") || raw.includes("flight_table") || raw.includes("flight-table")) return false;
    return formalExecutionMarkers.some((marker) => raw.includes(marker));
  });
}

function buildFormalAcceptanceGateV1(receipt: any, executionJudge: any): FormalAcceptanceGateV1 {
  const policy = evidencePolicyFromReceiptV1(receipt ?? {});
  const source_lane = toSourceLane(policy.source_lanes);
  const executionJudgePassed = hasExecutionJudgePass(executionJudge);
  const receiptCompletenessSkillPassed = hasReceiptCompletenessSkillPass(receipt ?? {});
  const formalExecutionEvidencePassed = hasFormalExecutionEvidenceV1(receipt ?? {}, policy);
  const formal_execution_passed = executionJudgePassed || receiptCompletenessSkillPassed || formalExecutionEvidencePassed;
  const is_simulated = policy.simulated_artifact_count > 0 || source_lane === "SIMULATED_DEV_ONLY" || source_lane === "DEBUG_ONLY";
  const non_simulated_chain = !is_simulated;
  const formal_evidence_passed = policy.formal_evidence_passed;
  const formal_acceptance = formal_evidence_passed && formal_execution_passed && non_simulated_chain && source_lane === "FORMAL_OPERATION";
  const blocking_reasons = Array.from(new Set([
    ...policy.blocking_reasons,
    ...(!formal_evidence_passed ? ["FORMAL_EVIDENCE_REQUIRED"] : []),
    ...(!formal_execution_passed ? ["FORMAL_EXECUTION_EVIDENCE_REQUIRED"] : []),
    ...(is_simulated ? ["SIMULATED_OR_DEBUG_EVIDENCE_NOT_FORMAL"] : []),
    ...(source_lane !== "FORMAL_OPERATION" ? ["FORMAL_OPERATION_SOURCE_LANE_REQUIRED"] : []),
  ]));
  return {
    formal_evidence_passed,
    formal_execution_passed,
    non_simulated_chain,
    formal_acceptance,
    source_lane,
    is_simulated,
    blocking_reasons: formal_acceptance ? [] : blocking_reasons,
    customer_visible_eligible: formal_acceptance,
    trust_level: formal_acceptance ? "FORMAL_ACCEPTED" : is_simulated ? "SIMULATED_DEV_ONLY" : formal_evidence_passed ? "NEEDS_REVIEW" : "INSUFFICIENT_FORMAL_EVIDENCE",
  };
}

function applyFormalAcceptanceGateV1(verdict: "PASS" | "FAIL" | "PARTIAL", gate: FormalAcceptanceGateV1): AcceptanceWriteVerdictV1 {
  if (verdict !== "PASS") return verdict;
  if (gate.formal_acceptance) return "PASS";
  if (!gate.formal_evidence_passed) return "INSUFFICIENT_EVIDENCE";
  return "NEEDS_REVIEW";
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
  const telemetryDelta = Number.isFinite(expected) && expected > 0 && Number.isFinite(actual) ? Math.abs(actual - expected) / expected : 0;
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
      const auth = requireAoActAnyScopeV0(req, reply, ["acceptance.evaluate", "ao_act.task.write"]);
      if (!auth) return;
      if (!requireAcceptanceEvaluateRoleV1(reply, auth)) return;
      const body = EvaluateRequestSchema.parse((req as any).body ?? {});
      const tenant: TenantTriple = { tenant_id: body.tenant_id, project_id: body.project_id, group_id: body.group_id };
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      const taskFact = await loadTaskFact(pool, body.act_task_id, tenant);
      if (!taskFact) return reply.status(404).send({ ok: false, error: "TASK_NOT_FOUND" });
      const receiptFact = await loadReceiptFact(pool, body.act_task_id, tenant);
      if (!receiptFact) return reply.status(404).send({ ok: false, error: "RECEIPT_NOT_FOUND" });

      const taskPayload = taskFact.record_json?.payload ?? {};
      const receiptPayload = receiptFact.record_json?.payload ?? {};
      const device_id = typeof taskPayload?.meta?.device_id === "string" ? taskPayload.meta.device_id : (typeof taskPayload?.device_id === "string" ? taskPayload.device_id : null);
      const field_id = typeof taskPayload.field_id === "string" ? taskPayload.field_id : (typeof receiptPayload.field_id === "string" ? receiptPayload.field_id : null);
      const executionJudgeId = await loadLatestExecutionJudgeForTask(pool, tenant, body.act_task_id);
      const executionJudgeIdFromInput = typeof body.execution_judge_id === "string" ? body.execution_judge_id.trim() : "";
      let executionJudge = null as Awaited<ReturnType<typeof loadJudgeResultV2>> | null;
      if (executionJudgeIdFromInput) {
        executionJudge = await loadJudgeResultV2(pool, { ...tenant, judge_id: executionJudgeIdFromInput });
        if (!executionJudge) return reply.status(404).send({ ok: false, error: "EXECUTION_JUDGE_NOT_FOUND" });
        if (executionJudge.judge_kind !== "EXECUTION") return reply.status(400).send({ ok: false, error: "INVALID_EXECUTION_JUDGE_KIND" });
      } else if (executionJudgeId) {
        executionJudge = await loadJudgeResultV2(pool, { ...tenant, judge_id: executionJudgeId });
      }
      const effectiveExecutionJudgeId = executionJudgeIdFromInput || executionJudgeId || "";
      const judgeResultIds = Array.from(new Set([...(body.judge_result_ids ?? []), ...(effectiveExecutionJudgeId ? [effectiveExecutionJudgeId] : [])]));

      const evaluated = evaluateAcceptanceV1({
        action_type: String(taskPayload.action_type ?? ""),
        parameters: (taskPayload.parameters ?? {}) as Record<string, any>,
        telemetry: deriveTelemetryFromReceipt(receiptFact.record_json),
        receipt: receiptFact.record_json ?? {},
        water_flow_state: null,
        fertility_state: null,
        sensor_quality_state: null,
        acceptance_policy_ref: null,
      });
      const formalGate = buildFormalAcceptanceGateV1(receiptFact.record_json ?? {}, executionJudge);
      const initialVerdict = toVerdict(evaluated.result);
      const gatedVerdict = applyFormalAcceptanceGateV1(initialVerdict, formalGate);
      const trace_id = String(taskPayload?.trace_id ?? taskPayload?.meta?.trace_id ?? "").trim() || `trace_${randomUUID().replace(/-/g, "")}`;

      await appendSkillTraceFact(pool, {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        trace_id,
        skill_run_id: null,
        inputs: { action_type: String(taskPayload.action_type ?? ""), parameters: taskPayload.parameters ?? {} },
        outputs: { result: evaluated.result, metrics: evaluated.metrics, explanation_codes: evaluated.explanation_codes ?? [], formal_gate: formalGate },
        confidence: { level: "MEDIUM", basis: "estimated", reasons: ["acceptance_engine_v1", "formal_acceptance_gate_v1"] },
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
        result_status: gatedVerdict === "PASS" ? "SUCCESS" : (gatedVerdict === "FAIL" ? "FAILED" : "SKIPPED"),
        trigger_stage: "after_acceptance",
        scope_type: "FIELD",
        rollout_mode: "DIRECT",
        bind_target: field_id ?? body.act_task_id,
        operation_id: null,
        task_id: body.act_task_id,
        operation_plan_id: typeof taskPayload.operation_plan_id === "string" ? taskPayload.operation_plan_id : null,
        field_id,
        device_id,
        input_digest: digestJson({ action_type: taskPayload.action_type, parameters: taskPayload.parameters, receipt: receiptPayload }),
        output_digest: digestJson({ evaluated, gatedVerdict, formalGate }),
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
          verdict: gatedVerdict,
          metrics: buildAcceptanceMetrics({ evaluated, expectedDurationMin: Number.isFinite(expectedDurationMin) ? expectedDurationMin : null }),
          rule_id: evaluated.rule_id,
          explanation_codes: Array.from(new Set([...(evaluated.explanation_codes ?? []), ...formalGate.blocking_reasons])),
          acceptance_skill_id: evaluated.acceptance_skill_id,
          acceptance_skill_version: evaluated.acceptance_skill_version,
          input_digest: digestJson({ action_type: taskPayload.action_type, parameters: taskPayload.parameters, receipt: receiptPayload }),
          output_digest: digestJson({ result: evaluated.result, initialVerdict, gatedVerdict, explanation_codes: evaluated.explanation_codes, metrics: evaluated.metrics, formalGate }),
          evaluated_at: nowIso,
          evidence_refs: [taskFact.fact_id, receiptFact.fact_id, ...judgeResultIds],
          execution_judge_id: effectiveExecutionJudgeId || undefined,
          execution_judge_verdict: executionJudge?.verdict || undefined,
          receipt_id: String(receiptPayload?.receipt_id ?? receiptFact.fact_id ?? "").trim() || undefined,
          formal_gate: formalGate,
          formal_acceptance: formalGate.formal_acceptance,
          formal_evidence_passed: formalGate.formal_evidence_passed,
          formal_execution_passed: formalGate.formal_execution_passed,
          non_simulated_chain: formalGate.non_simulated_chain,
          source_lane: formalGate.source_lane,
          is_simulated: formalGate.is_simulated,
          blocking_reasons: formalGate.blocking_reasons,
          customer_visible_eligible: formalGate.customer_visible_eligible,
          trust_level: formalGate.trust_level,
        })
      };

      await pool.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [acceptanceFactId, FACT_SOURCE_ACCEPTANCE_V1, acceptanceRecord]);

      if (acceptanceRecord.payload.verdict === "PASS" && acceptanceRecord.payload.formal_acceptance === true && field_id) {
        const observedParams = (receiptPayload?.observed_parameters ?? {}) as Record<string, unknown>;
        const soilMoistureDeltaRaw = Number(observedParams?.soil_moisture_delta);
        const pre_soil_moisture = Number(observedParams?.pre_soil_moisture ?? observedParams?.before_soil_moisture ?? 0.18);
        const post_soil_moisture = Number(observedParams?.post_soil_moisture ?? observedParams?.after_soil_moisture ?? (Number.isFinite(pre_soil_moisture) && Number.isFinite(soilMoistureDeltaRaw) ? pre_soil_moisture + soilMoistureDeltaRaw : 0.24));
        const opId = typeof taskPayload.operation_plan_id === "string" ? taskPayload.operation_plan_id : (typeof taskPayload.operation_id === "string" ? taskPayload.operation_id : body.act_task_id);
        const evidenceRefs = [taskFact.fact_id, receiptFact.fact_id, ...judgeResultIds, acceptanceFactId];
        await recordMemoryV1(pool, tenant.tenant_id, {
          type: "FIELD_RESPONSE_MEMORY",
          operation_id: opId,
          task_id: body.act_task_id,
          field_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          acceptance_id: acceptanceFactId,
          formal_acceptance_id: acceptanceFactId,
          memory_lane: "FORMAL_FIELD_MEMORY",
          trust_level: "FORMAL_ACCEPTED",
          source_lane: "FORMAL_OPERATION",
          customer_visible_memory: true,
          learning_eligible: true,
          metrics: {
            before_soil_moisture: Number.isFinite(pre_soil_moisture) ? pre_soil_moisture : 0.18,
            after_soil_moisture: Number.isFinite(post_soil_moisture) ? post_soil_moisture : 0.24,
            soil_moisture_delta: Number.isFinite(soilMoistureDeltaRaw) ? soilMoistureDeltaRaw : undefined,
            target_range: { min: 0.22, max: 0.28 },
            success: true,
            acceptance_passed: true,
          },
          evidence_refs: evidenceRefs,
          summary: `Formal acceptance passed for task ${body.act_task_id}`,
        });
      }

      if (acceptanceRecord.payload.verdict === "FAIL" || acceptanceRecord.payload.verdict === "PARTIAL" || acceptanceRecord.payload.verdict === "NEEDS_REVIEW" || acceptanceRecord.payload.verdict === "INSUFFICIENT_EVIDENCE") {
        const trigger = acceptanceRecord.payload.verdict === "FAIL" ? "ACCEPTANCE_FAILED" : "ACCEPTANCE_NEEDS_REVIEW";
        const fs = await createFailSafeEventV1(pool, { ...tenant, act_task_id: body.act_task_id, field_id: field_id ?? null, trigger_type: trigger as any, severity: acceptanceRecord.payload.verdict === "FAIL" ? "HIGH" : "MEDIUM", reason_code: trigger, blocked_action: "acceptance.evaluate", source: "api/v1/acceptance/evaluate" });
        await createManualTakeoverV1(pool, { ...tenant, fail_safe_event_id: fs.fail_safe_event_id, act_task_id: body.act_task_id, field_id: field_id ?? null, reason_code: trigger });
      }

      await recordSecurityAuditEventV1(pool, {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        ...auditContextFromRequestV1(req, auth),
        action: "acceptance.evaluated",
        target_type: "acceptance",
        target_id: acceptanceFactId,
        field_id: field_id ?? undefined,
        result: "ALLOW",
        source: "api/v1/acceptance/evaluate",
        metadata: { act_task_id: body.act_task_id, verdict: acceptanceRecord.payload.verdict, formal_acceptance: acceptanceRecord.payload.formal_acceptance, acceptance_skill_id: acceptanceRecord.payload.acceptance_skill_id }
      });

      return reply.send({
        ok: true,
        verdict: acceptanceRecord.payload.verdict,
        fact_id: acceptanceFactId,
        judge_result_ids_used: judgeResultIds,
        acceptance: {
          verdict: acceptanceRecord.payload.verdict,
          explanation_codes: acceptanceRecord.payload.explanation_codes,
          formal_acceptance: acceptanceRecord.payload.formal_acceptance,
          formal_evidence_passed: acceptanceRecord.payload.formal_evidence_passed,
          source_lane: acceptanceRecord.payload.source_lane,
          is_simulated: acceptanceRecord.payload.is_simulated,
          blocking_reasons: acceptanceRecord.payload.blocking_reasons,
          customer_visible_eligible: acceptanceRecord.payload.customer_visible_eligible,
          metrics: {
            formal_evidence_count: Number(evaluated.metrics?.formal_evidence_count ?? 0),
            simulated_evidence_count: Number(evaluated.metrics?.simulated_evidence_count ?? 0),
            formal_execution_passed: formalGate.formal_execution_passed ? 1 : 0,
            non_simulated_chain: formalGate.non_simulated_chain ? 1 : 0,
          },
        }
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
      const tenant: TenantTriple = { tenant_id: q.tenant_id, project_id: q.project_id, group_id: q.group_id };
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
      return reply.send({ ok: true, items: (out.rows ?? []).map((row: any) => ({ fact_id: String(row.fact_id), occurred_at: row.occurred_at, record_json: normalizeRecordJson(row.record_json) })) });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });
}
