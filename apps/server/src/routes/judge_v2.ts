import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { requireAoActAnyScopeV0, requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { evaluateAgronomyJudgeV2 } from "../domain/judge/agronomy_judge_v2.js";
import { evaluateEvidenceJudgeV2 } from "../domain/judge/evidence_judge_v2.js";
import { evaluateExecutionJudgeV2 } from "../domain/judge/execution_judge_v2.js";
import {
  buildJudgeResultV2,
  insertJudgeResultV2,
  listJudgeResultsV2,
  loadJudgeResultV2,
} from "../domain/judge/judge_result_v2.js";
import { recordMemoryV1 } from "../services/field_memory_service.js";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

function requireTenantMatchOr404(reply: FastifyReply, auth: TenantTriple, target: TenantTriple): boolean {
  if (auth.tenant_id !== target.tenant_id || auth.project_id !== target.project_id || auth.group_id !== target.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

const TenantSchema = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  group_id: z.string().min(1),
});

const EvaluateEvidenceRequestSchema = TenantSchema.extend({
  field_id: z.string().min(1).optional(),
  device_id: z.string().min(1).optional(),
  soil_moisture: z.number().optional(),
  observed_at_ts_ms: z.number().optional(),
  now_ts_ms: z.number().optional(),
  last_heartbeat_ts_ms: z.number().optional(),
  last_telemetry_ts_ms: z.number().optional(),
  evidence_refs: z.array(z.unknown()).optional(),
});

const EvaluateAgronomyRequestSchema = TenantSchema.extend({
  evidence_judge_id: z.string().min(1).optional(),
  recommendation_id: z.string().min(1).optional(),
  prescription_id: z.string().min(1).optional(),
  field_id: z.string().min(1).optional(),
  season_id: z.string().min(1).optional(),
  device_id: z.string().min(1).optional(),
  soil_moisture: z.number().optional(),
  evidence_judge_verdict: z.string().min(1).optional(),
  evidence_refs: z.array(z.unknown()).optional(),
  source_refs: z.array(z.unknown()).optional(),
});

const EvaluateExecutionRequestSchema = TenantSchema.extend({
  prescription_id: z.string().min(1).optional(),
  field_id: z.string().min(1).optional(),
  device_id: z.string().min(1).optional(),
  receipt: z.object({
    receipt_id: z.string().min(1).optional(),
    task_id: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    evidence_refs: z.array(z.unknown()).optional(),
  }).nullable().optional(),
  as_executed: z.object({
    as_executed_id: z.string().min(1).optional(),
    task_id: z.string().min(1).optional(),
  }).nullable().optional(),
  as_applied: z.object({
    as_applied_id: z.string().min(1).optional(),
  }).nullable().optional(),
  pre_soil_moisture: z.number().optional(),
  post_soil_moisture: z.number().optional(),
  evidence_refs: z.array(z.unknown()).optional(),
  source_refs: z.array(z.unknown()).optional(),
});

const ReadJudgeRequestSchema = TenantSchema.extend({
  judge_id: z.string().min(1),
});

const ListByKindSchema = TenantSchema.extend({
  judge_kind: z.enum(["EVIDENCE", "AGRONOMY", "EXECUTION"]),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const ListByFieldSchema = TenantSchema.extend({
  field_id: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const ListByTaskSchema = TenantSchema.extend({
  task_id: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const ListByPrescriptionSchema = TenantSchema.extend({
  prescription_id: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export function registerJudgeV2Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/judge/health", async () => ({ ok: true, module: "judge_v2" }));

  app.post("/api/v1/judge/evidence/evaluate", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["judge.execution.write", "ao_act.task.write"]);
      if (!auth) return;
      const body = EvaluateEvidenceRequestSchema.parse((req as any).body ?? {});
      if (!requireTenantMatchOr404(reply, auth, body)) return;

      const judgeResult = buildJudgeResultV2(evaluateEvidenceJudgeV2(body));
      const inserted = await insertJudgeResultV2(pool, judgeResult);
      return reply.send({ ok: true, judge_result: inserted });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.post("/api/v1/judge/agronomy/evaluate", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["judge.execution.write", "ao_act.task.write"]);
      if (!auth) return;
      const body = EvaluateAgronomyRequestSchema.parse((req as any).body ?? {});
      if (!requireTenantMatchOr404(reply, auth, body)) return;

      const judgeResult = buildJudgeResultV2(evaluateAgronomyJudgeV2(body));
      const inserted = await insertJudgeResultV2(pool, judgeResult);
      return reply.send({ ok: true, judge_result: inserted });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.post("/api/v1/judge/execution/evaluate", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["judge.execution.write", "ao_act.task.write"]);
      if (!auth) return;
      const body = EvaluateExecutionRequestSchema.parse((req as any).body ?? {});
      if (!requireTenantMatchOr404(reply, auth, body)) return;

      const judgeResult = buildJudgeResultV2(evaluateExecutionJudgeV2(body));
      const inserted = await insertJudgeResultV2(pool, judgeResult);
      const executionDeviationRaw = Number((inserted.outputs as any)?.execution_deviation);
      const execution_deviation = Number.isFinite(executionDeviationRaw) ? executionDeviationRaw : undefined;
      const ack_latency_ms = Number((inserted.outputs as any)?.ack_latency_ms ?? (inserted.outputs as any)?.response_time_ms);
      const field_id = String(inserted.field_id ?? body.field_id ?? "").trim();
      if (field_id) {
        await recordMemoryV1(pool, body.tenant_id, {
          type: "execution_reliability",
          project_id: body.project_id,
          group_id: body.group_id,
          operation_id: String(inserted.task_id ?? body.receipt?.task_id ?? "").trim() || undefined,
          prescription_id: String(inserted.prescription_id ?? body.prescription_id ?? "").trim() || undefined,
          field_id,
          metrics: {
            execution_deviation,
            success: inserted.verdict === "PASS",
            ack_latency_ms: Number.isFinite(ack_latency_ms) ? ack_latency_ms : 0,
            receipt_complete: true,
            timeout: false,
          },
          skill_refs: [{
            skill_id: "mock_valve_control_skill_v1",
            skill_run_id: String((inserted as any).judge_id ?? (inserted as any).task_id ?? "execution_judge").trim(),
          }],
          evidence_refs: Array.isArray(inserted.evidence_refs)
            ? inserted.evidence_refs.map((v) => String(v)).filter((v) => v.length > 0)
            : [],
          summary: `Execution judge ${inserted.verdict} for ${field_id}`,
        }).catch(() => undefined);
      }
      return reply.send({ ok: true, judge_result: inserted });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v1/judge/results/:judge_id", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["judge.read", "ao_act.index.read"]);
      if (!auth) return;
      const params = ReadJudgeRequestSchema.parse({ ...(req as any).query, ...(req as any).params });
      if (!requireTenantMatchOr404(reply, auth, params)) return;

      const item = await loadJudgeResultV2(pool, params);
      if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, judge_result: item });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v1/judge/results/by-kind/:judge_kind", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["judge.read", "ao_act.index.read"]);
      if (!auth) return;
      const input = ListByKindSchema.parse({ ...(req as any).query, ...(req as any).params });
      if (!requireTenantMatchOr404(reply, auth, input)) return;
      const items = await listJudgeResultsV2(pool, input);
      return reply.send({ ok: true, items });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v1/judge/results/by-field/:field_id", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["judge.read", "ao_act.index.read"]);
      if (!auth) return;
      const input = ListByFieldSchema.parse({ ...(req as any).query, ...(req as any).params });
      if (!requireTenantMatchOr404(reply, auth, input)) return;
      const items = await listJudgeResultsV2(pool, input);
      return reply.send({ ok: true, items });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v1/judge/results/by-task/:task_id", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["judge.read", "ao_act.index.read"]);
      if (!auth) return;
      const input = ListByTaskSchema.parse({ ...(req as any).query, ...(req as any).params });
      if (!requireTenantMatchOr404(reply, auth, input)) return;
      const items = await listJudgeResultsV2(pool, input);
      return reply.send({ ok: true, items });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v1/judge/results/by-prescription/:prescription_id", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["judge.read", "ao_act.index.read"]);
      if (!auth) return;
      const input = ListByPrescriptionSchema.parse({ ...(req as any).query, ...(req as any).params });
      if (!requireTenantMatchOr404(reply, auth, input)) return;
      const items = await listJudgeResultsV2(pool, input);
      return reply.send({ ok: true, items });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });
}
