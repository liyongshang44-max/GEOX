import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { projectFieldProgramStateV1 } from "../projections/field_program_state_v1";
import { projectProgramStateV1 } from "../projections/program_state_v1";
import { projectProgramPortfolioV1 } from "../projections/program_portfolio_v1";
import { deriveProgramFeedbackV1 } from "../domain/program/program_feedback_v1";
import { projectProgramTimelineV1 } from "../projections/program_timeline_v1";
import { projectProgramCostV1 } from "../projections/program_cost_v1";
import { projectProgramSlaV1 } from "../projections/program_sla_v1";
import { projectProgramEfficiencyV1 } from "../projections/program_efficiency_v1";
import { compileProgramActionsV1 } from "../domain/planner/compiler_v1";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
const PROGRAM_STATUSES = new Set(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED", "ARCHIVED"]);

const ProgramPrioritySchema = z.enum(["low", "medium", "high"]);
const ProgramCreateBodySchema = z.object({
  tenant_id: z.string().min(1).optional(),
  project_id: z.string().min(1).optional(),
  group_id: z.string().min(1).optional(),
  program_id: z.string().min(1).optional(),
  field_id: z.string().min(1),
  season_id: z.string().min(1),
  crop_code: z.string(),
  variety_code: z.string().min(1).nullable().optional(),
  goal_profile: z.object({
    yield_priority: ProgramPrioritySchema,
    quality_priority: ProgramPrioritySchema,
    residue_priority: ProgramPrioritySchema,
    water_saving_priority: ProgramPrioritySchema,
    cost_priority: ProgramPrioritySchema
  }),
  constraints: z.object({
    forbid_pesticide_classes: z.array(z.string()),
    forbid_fertilizer_types: z.array(z.string()),
    max_irrigation_mm_per_day: z.number().finite().nullable().optional(),
    manual_approval_required_for: z.array(z.string()),
    allow_night_irrigation: z.boolean()
  }),
  budget: z.object({
    max_cost_total: z.number().finite().nullable().optional(),
    currency: z.string().min(1)
  }).nullable().optional(),
  execution_policy: z.object({
    mode: z.enum(["approval_required", "auto_allowed"]),
    auto_execute_allowed_task_types: z.array(z.string())
  }).default({ mode: "approval_required", auto_execute_allowed_task_types: [] }),
  acceptance_policy_ref: z.string().min(1).nullable().optional(),
  evidence_policy_ref: z.string().min(1).nullable().optional(),
  status: z.string().optional()
});


function tenantFromReq(req: any, auth: any): TenantTriple {
  const q = req.query ?? {};
  return {
    tenant_id: String(q.tenant_id ?? req.body?.tenant_id ?? auth.tenant_id),
    project_id: String(q.project_id ?? req.body?.project_id ?? auth.project_id),
    group_id: String(q.group_id ?? req.body?.group_id ?? auth.group_id)
  };
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

async function insertFact(pool: Pool, source: string, record_json: any): Promise<string> {
  const fact_id = randomUUID();
  await pool.query(
    `INSERT INTO facts (fact_id, source, record_json, occurred_at)
     VALUES ($1, $2, $3::jsonb, NOW())`,
    [fact_id, source, JSON.stringify(record_json)]
  );
  return fact_id;
}

async function loadLatestProgramFact(pool: Pool, program_id: string, tenant: TenantTriple): Promise<{ fact_id: string; payload: any } | null> {
  const q = await pool.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='field_program_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
        AND (record_json::jsonb#>>'{payload,project_id}')=$2
        AND (record_json::jsonb#>>'{payload,group_id}')=$3
        AND (record_json::jsonb#>>'{payload,program_id}')=$4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, program_id]
  );
  if (!q.rows?.length) return null;
  const row: any = q.rows[0];
  return { fact_id: String(row.fact_id), payload: row.record_json?.payload ?? {} };
}

export function registerProgramsCoreV1Routes(app: FastifyInstance, pool: Pool, opts: { read?: boolean; write?: boolean } = {}): void {
  const enableRead = opts.read !== false;
  const enableWrite = opts.write !== false;
  const post = (path: string, handler: any) => { if (enableWrite) app.post(path, handler); };
  const get = (path: string, handler: any) => { if (enableRead) app.get(path, handler); };
  post("/api/v1/programs", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const parsedBody = ProgramCreateBodySchema.safeParse((req as any).body ?? {});
    if (!parsedBody.success) return reply.status(400).send({ ok: false, error: "INVALID_PROGRAM_SCHEMA", details: parsedBody.error.issues });
    const body = parsedBody.data;
    const now = Date.now();
    const program_id = String(body.program_id ?? `prg_${randomUUID().replace(/-/g, "")}`).trim();
    const field_id = String(body.field_id ?? "").trim();
    const season_id = String(body.season_id ?? "").trim();
    const crop_code = String(body.crop_code || "corn").trim();
    const status = String(body.status ?? "DRAFT").trim().toUpperCase();
    if (!program_id || !field_id || !season_id || !crop_code) return reply.status(400).send({ ok: false, error: "MISSING_REQUIRED_FIELDS" });
    if (!PROGRAM_STATUSES.has(status)) return reply.status(400).send({ ok: false, error: "INVALID_STATUS" });

    const record = {
      type: "field_program_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        program_id,
        field_id,
        season_id,
        crop_code,
        variety_code: body.variety_code ?? null,
        goal_profile: body.goal_profile,
        constraints: body.constraints,
        budget: body.budget ?? null,
        execution_policy: body.execution_policy ?? { mode: "approval_required", auto_execute_allowed_task_types: [] },
        acceptance_policy_ref: body.acceptance_policy_ref ?? null,
        evidence_policy_ref: body.evidence_policy_ref ?? null,
        status,
        created_ts: now,
        updated_ts: now
      }
    };
    const fact_id = await insertFact(pool, "api/v1/programs", record);
    return reply.send({ ok: true, program_id, fact_id });
  });

  get("/api/v1/programs", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const q: any = (req as any).query ?? {};
    const limit = Math.max(1, Math.min(Number(q.limit ?? 100) || 100, 300));

    let items = await projectFieldProgramStateV1(pool, tenant);
    if (q.field_id) items = items.filter((x) => x.field_id === String(q.field_id));
    if (q.season_id) items = items.filter((x) => x.season_id === String(q.season_id));
    if (q.status) items = items.filter((x) => x.status === String(q.status));
    return reply.send({ ok: true, count: items.slice(0, limit).length, items: items.slice(0, limit) });
  });

  get("/api/v1/program-portfolio", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const q: any = (req as any).query ?? {};
    const limit = Math.max(1, Math.min(Number(q.limit ?? 100) || 100, 300));

    let items = await projectProgramPortfolioV1(pool, tenant);
    if (q.field_id) items = items.filter((x) => x.field_id === String(q.field_id));
    if (q.season_id) items = items.filter((x) => x.season_id === String(q.season_id));
    if (q.status) items = items.filter((x) => x.status === String(q.status));
    if (q.next_action_priority) items = items.filter((x) => x.next_action_hint?.priority === String(q.next_action_priority).toUpperCase());

    return reply.send({ ok: true, count: items.slice(0, limit).length, items: items.slice(0, limit) });
  });

  get("/api/v1/programs/:program_id", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const item = (await projectFieldProgramStateV1(pool, tenant)).find((x) => x.program_id === program_id);
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });


  get("/api/v1/programs/:program_id/state", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const item = (await projectProgramStateV1(pool, tenant)).find((x) => x.program_id === program_id);
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });

  get("/api/v1/programs/:program_id/timeline", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const items = await projectProgramTimelineV1(pool, tenant, program_id);
    if (!items.length) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, program_id, count: items.length, items });
  });

  get("/api/v1/programs/:program_id/feedback-history", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const program = (await projectProgramStateV1(pool, tenant)).find((x) => x.program_id === program_id);
    if (!program) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const q = await pool.query(
      `SELECT occurred_at, (record_json::jsonb) AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'acceptance_result_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
          AND (record_json::jsonb#>>'{payload,program_id}') = $4
        ORDER BY occurred_at ASC
        LIMIT 200`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, program_id]
    );

    const results = (q.rows ?? []).map((row: any) => ({
      ...((row.record_json?.payload ?? {}) as any),
      evaluated_at_ts: Number(Date.parse(String(row.record_json?.payload?.evaluated_at ?? row.occurred_at))) || 0
    }));

    const items = results.map((_, idx) => {
      const historyResults = results.slice(0, idx + 1);
      const feedback = deriveProgramFeedbackV1({
        program,
        acceptanceResults: historyResults,
        trajectories: historyResults.map((x: any) => x.metrics ?? {}),
        recentTasks: []
      });
      const latest = historyResults[historyResults.length - 1] ?? {};
      return {
        ts: Number(latest.evaluated_at_ts ?? 0),
        acceptance_result: String(latest.verdict ?? ""),
        current_stage: feedback.current_stage,
        current_goal_progress: feedback.current_goal_progress,
        next_action_hint: feedback.next_action_hint
      };
    });

    return reply.send({ ok: true, program_id, count: items.length, items });
  });

  get("/api/v1/programs/:program_id/trajectories", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const q = await pool.query(
      `SELECT (record_json::jsonb #>> '{payload,act_task_id}') AS act_task_id,
              (record_json::jsonb #>> '{payload,field_id}') AS field_id,
              (record_json::jsonb #>> '{payload,meta,device_id}') AS device_id,
              (record_json::jsonb #>> '{payload,time_window,start_ts}')::bigint AS start_ts,
              (record_json::jsonb #>> '{payload,time_window,end_ts}')::bigint AS end_ts
         FROM facts
        WHERE (record_json::jsonb ->> 'type') = 'ao_act_task_v0'
          AND (record_json::jsonb #>> '{payload,tenant_id}') = $1
          AND (record_json::jsonb #>> '{payload,project_id}') = $2
          AND (record_json::jsonb #>> '{payload,group_id}') = $3
          AND (record_json::jsonb #>> '{payload,program_id}') = $4
        ORDER BY start_ts DESC NULLS LAST
        LIMIT 200`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, program_id]
    );

    return reply.send({
      ok: true,
      program_id,
      items: (q.rows ?? []).map((row: any) => ({
        type: "operation_trajectory_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          program_id,
          act_task_id: row.act_task_id ?? null,
          field_id: row.field_id ?? null,
          device_id: row.device_id ?? null,
          start_ts: row.start_ts ?? null,
          end_ts: row.end_ts ?? null,
          line: null,
          point_count: 0,
        }
      }))
    });
  });

  post("/api/v1/programs/:program_id/resource-usage", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const existing = await loadLatestProgramFact(pool, program_id, tenant);
    if (!existing) return reply.status(404).send({ ok: false, error: "PROGRAM_NOT_FOUND" });

    const body: any = (req as any).body ?? {};
    const usageFact = {
      type: "resource_usage_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        program_id,
        act_task_id: body.act_task_id ?? null,
        resource_usage: {
          fuel_l: Number(body?.resource_usage?.fuel_l ?? body?.fuel_l ?? 0) || 0,
          electric_kwh: Number(body?.resource_usage?.electric_kwh ?? body?.electric_kwh ?? 0) || 0,
          water_l: Number(body?.resource_usage?.water_l ?? body?.water_l ?? 0) || 0,
          chemical_ml: Number(body?.resource_usage?.chemical_ml ?? body?.chemical_ml ?? 0) || 0
        },
        source: body.source ?? "manual",
        recorded_ts: Number(body.recorded_ts ?? Date.now())
      }
    };
    const fact_id = await insertFact(pool, "api/v1/programs/resource-usage", usageFact);
    return reply.send({ ok: true, fact_id, program_id });
  });

  post("/api/v1/programs/:program_id/cost-records", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const existing = await loadLatestProgramFact(pool, program_id, tenant);
    if (!existing) return reply.status(404).send({ ok: false, error: "PROGRAM_NOT_FOUND" });

    const body: any = (req as any).body ?? {};
    const amount = Number(body.cost_amount ?? body.amount ?? body.total_cost);
    if (!Number.isFinite(amount)) return reply.status(400).send({ ok: false, error: "INVALID_COST_AMOUNT" });

    const costFact = {
      type: "cost_record_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        program_id,
        act_task_id: body.act_task_id ?? null,
        cost_amount: amount,
        currency: String(body.currency ?? existing.payload?.budget?.currency ?? "USD"),
        category: body.category ?? "operation",
        source: body.source ?? "manual",
        recorded_ts: Number(body.recorded_ts ?? Date.now())
      }
    };
    const fact_id = await insertFact(pool, "api/v1/programs/cost-records", costFact);
    return reply.send({ ok: true, fact_id, program_id });
  });

  post("/api/v1/programs/:program_id/sla-evaluations", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const existing = await loadLatestProgramFact(pool, program_id, tenant);
    if (!existing) return reply.status(404).send({ ok: false, error: "PROGRAM_NOT_FOUND" });

    const body: any = (req as any).body ?? {};
    const met = body.met == null ? undefined : Boolean(body.met);
    const status = String(body.status ?? (met == null ? "UNKNOWN" : (met ? "MET" : "BREACH"))).toUpperCase();
    const evaluationFact = {
      type: "sla_evaluation_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        program_id,
        sla_name: body.sla_name ?? "execution_latency",
        target_value: body.target_value ?? null,
        actual_value: body.actual_value ?? null,
        met: met ?? (status === "MET"),
        status,
        source: body.source ?? "manual",
        recorded_ts: Number(body.recorded_ts ?? Date.now())
      }
    };
    const fact_id = await insertFact(pool, "api/v1/programs/sla-evaluations", evaluationFact);
    return reply.send({ ok: true, fact_id, program_id });
  });

  get("/api/v1/programs/:program_id/cost", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const item = (await projectProgramCostV1(pool, tenant)).find((x) => x.program_id === program_id);
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });

  get("/api/v1/programs/:program_id/sla", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const item = (await projectProgramSlaV1(pool, tenant)).find((x) => x.program_id === program_id);
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });

  get("/api/v1/programs/:program_id/efficiency", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const item = (await projectProgramEfficiencyV1(pool, tenant)).find((x) => x.program_id === program_id);
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });

  get("/api/v1/programs/:program_id/actions", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const compiled = await compileProgramActionsV1(pool, tenant, program_id);
    if (!compiled) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, program_id, candidate_actions: compiled.candidate_actions });
  });

  post("/api/v1/programs/:program_id/transitions", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const body: any = (req as any).body ?? {};
    const status = String(body.status ?? "").trim().toUpperCase();
    if (!PROGRAM_STATUSES.has(status)) return reply.status(400).send({ ok: false, error: "INVALID_STATUS" });

    const existing = await loadLatestProgramFact(pool, program_id, tenant);
    if (!existing) return reply.status(404).send({ ok: false, error: "PROGRAM_NOT_FOUND" });

    const transition = {
      type: "field_program_transition_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        program_id,
        from_status: existing.payload?.status ?? null,
        status,
        trigger: String(body.trigger ?? "manual_transition"),
        reason: body.reason ?? null,
        actor_id: auth.actor_id,
        created_ts: Date.now()
      }
    };
    const transition_fact_id = await insertFact(pool, "api/v1/programs/transitions", transition);

    const patchedProgram = {
      type: "field_program_v1",
      payload: {
        ...existing.payload,
        status,
        updated_ts: Date.now()
      }
    };
    const program_fact_id = await insertFact(pool, "api/v1/programs/transitions", patchedProgram);
    return reply.send({ ok: true, program_id, status, transition_fact_id, program_fact_id });
  });

  post("/api/v1/programs/:program_id/notes", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const existing = await loadLatestProgramFact(pool, program_id, tenant);
    if (!existing) return reply.status(404).send({ ok: false, error: "PROGRAM_NOT_FOUND" });

    const body: any = (req as any).body ?? {};
    const note = String(body.note ?? "").trim();
    if (!note) return reply.status(400).send({ ok: false, error: "MISSING_NOTE" });

    const note_id = String(body.note_id ?? `pnote_${randomUUID().replace(/-/g, "")}`);
    const noteFact = {
      type: "field_program_note_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        note_id,
        program_id,
        field_id: existing.payload.field_id,
        season_id: existing.payload.season_id ?? null,
        title: body.title ?? null,
        note,
        tags: Array.isArray(body.tags) ? body.tags.map((x: any) => String(x)) : [],
        author_id: auth.actor_id,
        created_ts: Date.now(),
        updated_ts: null
      }
    };
    const fact_id = await insertFact(pool, "api/v1/programs/notes", noteFact);
    return reply.send({ ok: true, note_id, fact_id });
  });

  get("/api/v1/fields/:field_id/programs", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const field_id = String((req.params as any)?.field_id ?? "").trim();
    if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });

    const items = (await projectFieldProgramStateV1(pool, tenant)).filter((x) => x.field_id === field_id);
    return reply.send({ ok: true, count: items.length, items });
  });

  get("/api/v1/fields/:field_id/programs/by-season", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const field_id = String((req.params as any)?.field_id ?? "").trim();
    if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });

    const items = (await projectProgramPortfolioV1(pool, tenant)).filter((x) => x.field_id === field_id);
    const grouped = new Map<string, typeof items>();
    for (const item of items) {
      const key = String(item.season_id || "UNKNOWN");
      const list = grouped.get(key) ?? [];
      list.push(item);
      grouped.set(key, list);
    }

    const seasons = Array.from(grouped.entries()).map(([season_id, seasonItems]) => ({
      season_id,
      count: seasonItems.length,
      programs: seasonItems.sort((a, b) => b.updated_at_ts - a.updated_at_ts)
    }));

    return reply.send({ ok: true, field_id, count: items.length, seasons });
  });


  get("/api/v1/fields/:field_id/program-state", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const field_id = String((req.params as any)?.field_id ?? "").trim();
    if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });

    const items = (await projectProgramStateV1(pool, tenant)).filter((x) => x.field_id === field_id);
    const item = items.find((x) => x.status === "ACTIVE") ?? items[0] ?? null;
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });

  get("/api/v1/fields/:field_id/current-program", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const field_id = String((req.params as any)?.field_id ?? "").trim();
    if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });

    const active = (await projectFieldProgramStateV1(pool, tenant)).filter((x) => x.field_id === field_id);
    const item = active.find((x) => x.status === "ACTIVE") ?? active[0] ?? null;
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });

  get("/api/v1/seasons/:season_id/programs", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const season_id = String((req.params as any)?.season_id ?? "").trim();
    if (!season_id) return reply.status(400).send({ ok: false, error: "MISSING_SEASON_ID" });

    const items = (await projectFieldProgramStateV1(pool, tenant)).filter((x) => x.season_id === season_id);
    return reply.send({ ok: true, count: items.length, items });
  });

  get("/api/v1/seasons/:season_id/program-portfolio", async (req: any, reply: any) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const season_id = String((req.params as any)?.season_id ?? "").trim();
    if (!season_id) return reply.status(400).send({ ok: false, error: "MISSING_SEASON_ID" });

    const items = (await projectProgramPortfolioV1(pool, tenant)).filter((x) => x.season_id === season_id);
    return reply.send({ ok: true, season_id, count: items.length, items });
  });
}
