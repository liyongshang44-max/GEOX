import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { evaluateAgronomyJudgeV2 } from "../domain/judge/agronomy_judge_v2.js";
import { evaluateEvidenceJudgeV2 } from "../domain/judge/evidence_judge_v2.js";
import { evaluateExecutionJudgeV2 } from "../domain/judge/execution_judge_v2.js";
import {
  buildJudgeResultV2,
  insertJudgeResultV2,
  listJudgeResultsV2,
  loadJudgeResultV2,
} from "../domain/judge/judge_result_v2.js";

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
  task_id: z.string().min(1).optional(),
  receipt_id: z.string().min(1).optional(),
  evidence_refs: z.array(z.unknown()).optional(),
  source_refs: z.array(z.unknown()).optional(),
  min_evidence_count: z.number().int().min(1).optional(),
});

const EvaluateAgronomyRequestSchema = TenantSchema.extend({
  recommendation_id: z.string().min(1).optional(),
  prescription_id: z.string().min(1).optional(),
  field_id: z.string().min(1).optional(),
  season_id: z.string().min(1).optional(),
  device_id: z.string().min(1).optional(),
  soil_moisture: z.number().optional(),
  deficit_threshold: z.number().optional(),
  evidence_refs: z.array(z.unknown()).optional(),
  source_refs: z.array(z.unknown()).optional(),
});

const EvaluateExecutionRequestSchema = TenantSchema.extend({
  task_id: z.string().min(1),
  receipt_id: z.string().min(1).optional(),
  prescription_id: z.string().min(1).optional(),
  as_executed_id: z.string().min(1).optional(),
  as_applied_id: z.string().min(1).optional(),
  field_id: z.string().min(1).optional(),
  device_id: z.string().min(1).optional(),
  expected_amount: z.number().optional(),
  executed_amount: z.number().optional(),
  tolerance_percent: z.number().nonnegative().optional(),
  evidence_refs: z.array(z.unknown()).optional(),
  source_refs: z.array(z.unknown()).optional(),
});

const ListJudgeRequestSchema = TenantSchema.extend({
  judge_kind: z.enum(["EVIDENCE", "AGRONOMY", "EXECUTION"]).optional(),
  task_id: z.string().min(1).optional(),
  recommendation_id: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const ReadJudgeRequestSchema = TenantSchema.extend({
  judge_id: z.string().min(1),
});

export function registerJudgeV2Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v2/judge/health", async () => ({ ok: true, module: "judge_v2" }));

  app.post("/api/v2/judge/evidence/evaluate", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
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

  app.post("/api/v2/judge/agronomy/evaluate", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
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

  app.post("/api/v2/judge/execution/evaluate", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
      if (!auth) return;
      const body = EvaluateExecutionRequestSchema.parse((req as any).body ?? {});
      if (!requireTenantMatchOr404(reply, auth, body)) return;

      const judgeResult = buildJudgeResultV2(evaluateExecutionJudgeV2(body));
      const inserted = await insertJudgeResultV2(pool, judgeResult);
      return reply.send({ ok: true, judge_result: inserted });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v2/judge/results", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
      if (!auth) return;
      const query = ListJudgeRequestSchema.parse((req as any).query ?? {});
      if (!requireTenantMatchOr404(reply, auth, query)) return;

      const items = await listJudgeResultsV2(pool, query);
      return reply.send({ ok: true, items });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v2/judge/results/:judge_id", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
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
}
