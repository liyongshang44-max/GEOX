import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { buildAcceptanceResult } from "../domain/acceptance/acceptance_engine_v1.js";
import { inferEvidenceLevel, type EvidenceLevel } from "../domain/acceptance/evidence_policy.js";
import { projectOperationStateFromFacts, type OperationProjectionFactRow } from "../projections/operation_state_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; source: string | null; record_json: any };
type SkillRunMatch = {
  source: "skill_run_v1" | "acceptance_skill_meta" | "none";
  skill_id: string | null;
  skill_version: string | null;
  explanation_codes: string[];
  trigger_stage: string | null;
  run_id: string | null;
  matched_at: string | null;
};

function tenantFromReq(req: any, auth: any): TenantTriple {
  const q = req.query ?? {};
  return {
    tenant_id: String(q.tenant_id ?? auth.tenant_id),
    project_id: String(q.project_id ?? auth.project_id),
    group_id: String(q.group_id ?? auth.group_id)
  };
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function parseRecordJson(v: unknown): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function toText(v: unknown): string | null {
  if (typeof v === "string") {
    const x = v.trim();
    return x || null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function toMs(v: unknown): number {
  const ts = Date.parse(String(v ?? ""));
  return Number.isFinite(ts) ? ts : 0;
}

function normalizeStage(value: unknown): string {
  const x = String(value ?? "").trim().toLowerCase();
  if (x === "before_approval") return "after_recommendation";
  return x;
}

function getPreferredStagesForArtifact(kind: string | null): string[] {
  const normalized = String(kind ?? "").trim().toLowerCase();
  if (normalized.includes("note")) return ["after_acceptance", "before_acceptance"];
  return ["before_acceptance", "after_acceptance", "before_dispatch", "after_recommendation", "before_recommendation"];
}

function buildArtifactSkillMatch(input: {
  artifactTs: string;
  artifactKind: string | null;
  skillRunRows: FactRow[];
  acceptancePayload: any;
}): SkillRunMatch {
  const artifactMs = toMs(input.artifactTs);
  const preferredStages = getPreferredStagesForArtifact(input.artifactKind);
  const scored = input.skillRunRows.map((row) => {
    const payload = row.record_json?.payload ?? {};
    const stage = normalizeStage(payload.trigger_stage);
    const stageIdx = preferredStages.indexOf(stage);
    const stagePenalty = stageIdx >= 0 ? stageIdx : preferredStages.length + 3;
    const tsPenalty = Math.abs(toMs(row.occurred_at) - artifactMs);
    return { row, payload, stage, stagePenalty, tsPenalty };
  }).sort((a, b) => (a.stagePenalty - b.stagePenalty) || (a.tsPenalty - b.tsPenalty));

  const best = scored[0];
  if (best) {
    return {
      source: "skill_run_v1",
      skill_id: toText(best.payload.skill_id),
      skill_version: toText(best.payload.version),
      explanation_codes: Array.isArray(best.payload.explanation_codes) ? best.payload.explanation_codes.map((x: unknown) => String(x)).filter(Boolean) : [],
      trigger_stage: best.stage || null,
      run_id: toText(best.payload.run_id),
      matched_at: best.row.occurred_at
    };
  }

  const acceptanceSkillId = toText(input.acceptancePayload?.acceptance_skill_id);
  const acceptanceSkillVersion = toText(input.acceptancePayload?.acceptance_skill_version);
  if (acceptanceSkillId || acceptanceSkillVersion) {
    return {
      source: "acceptance_skill_meta",
      skill_id: acceptanceSkillId,
      skill_version: acceptanceSkillVersion,
      explanation_codes: Array.isArray(input.acceptancePayload?.explanation_codes) ? input.acceptancePayload.explanation_codes.map((x: unknown) => String(x)).filter(Boolean) : [],
      trigger_stage: "before_acceptance",
      run_id: null,
      matched_at: toText(input.acceptancePayload?.generated_at)
    };
  }

  return {
    source: "none",
    skill_id: null,
    skill_version: null,
    explanation_codes: [],
    trigger_stage: null,
    run_id: null,
    matched_at: null
  };
}

async function queryFacts(pool: Pool, sql: string, args: unknown[]): Promise<FactRow[]> {
  const q = await pool.query(sql, args);
  return (q.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    source: typeof row.source === "string" ? row.source : null,
    record_json: parseRecordJson(row.record_json) ?? row.record_json
  }));
}

async function loadOperationProjectionFacts(input: {
  pool: Pool;
  tenant: TenantTriple;
  operationPlanId: string;
  actTaskId: string | null;
  recommendationId: string | null;
  approvalRequestId: string | null;
}): Promise<OperationProjectionFactRow[]> {
  const rows: FactRow[] = [];
  const { pool, tenant, operationPlanId, actTaskId, recommendationId, approvalRequestId } = input;

  rows.push(...await queryFacts(
    pool,
    `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb#>>'{payload,tenant_id}')=$1
        AND (record_json::jsonb#>>'{payload,project_id}')=$2
        AND (record_json::jsonb#>>'{payload,group_id}')=$3
        AND (
          ((record_json::jsonb->>'type')='operation_plan_v1' AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$4)
          OR ((record_json::jsonb->>'type')='operation_plan_transition_v1' AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$4)
          OR ((record_json::jsonb->>'type')='acceptance_result_v1' AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$4)
        )
      ORDER BY occurred_at ASC, fact_id ASC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId]
  ));

  if (actTaskId) {
    rows.push(...await queryFacts(
      pool,
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (
            ((record_json::jsonb->>'type')='ao_act_task_v0' AND (record_json::jsonb#>>'{payload,act_task_id}')=$4)
            OR ((record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1') AND ((record_json::jsonb#>>'{payload,act_task_id}')=$4 OR (record_json::jsonb#>>'{payload,task_id}')=$4))
            OR ((record_json::jsonb->>'type')='acceptance_result_v1' AND (record_json::jsonb#>>'{payload,act_task_id}')=$4)
            OR ((record_json::jsonb->>'type') IN ('work_assignment_upserted_v1','work_assignment_status_changed_v1','work_assignment_submitted_v1') AND (record_json::jsonb#>>'{payload,act_task_id}')=$4)
          )
        ORDER BY occurred_at ASC, fact_id ASC`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId]
    ));
  }

  if (recommendationId) {
    rows.push(...await queryFacts(
      pool,
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='decision_recommendation_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (record_json::jsonb#>>'{payload,recommendation_id}')=$4
        ORDER BY occurred_at ASC, fact_id ASC`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, recommendationId]
    ));
  }

  if (approvalRequestId) {
    rows.push(...await queryFacts(
      pool,
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('approval_request_v1','approval_decision_v1')
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (record_json::jsonb#>>'{payload,request_id}')=$4
        ORDER BY occurred_at ASC, fact_id ASC`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, approvalRequestId]
    ));
  }

  const dedup = new Map<string, OperationProjectionFactRow>();
  for (const row of rows) dedup.set(row.fact_id, row as OperationProjectionFactRow);
  return [...dedup.values()].sort((a, b) => toMs(a.occurred_at) - toMs(b.occurred_at));
}

export function registerEvidenceBundleV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operations/:operationPlanId/evidence-bundle", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const operationPlanId = String((req.params as any)?.operationPlanId ?? "").trim();
    if (!operationPlanId) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_PLAN_ID" });

    const planRows = await queryFacts(
      pool,
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='operation_plan_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$4
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId]
    );
    const plan = planRows[0];
    if (!plan) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const planPayload = plan.record_json?.payload ?? {};
    const actTaskId = toText(planPayload.act_task_id);
    const recommendationId = toText(planPayload.recommendation_id);
    const approvalRequestId = toText(planPayload.approval_request_id);

    const taskRows = actTaskId
      ? await queryFacts(
        pool,
        `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
           FROM facts
          WHERE (record_json::jsonb->>'type')='ao_act_task_v0'
            AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
            AND (record_json::jsonb#>>'{payload,project_id}')=$2
            AND (record_json::jsonb#>>'{payload,group_id}')=$3
            AND (record_json::jsonb#>>'{payload,act_task_id}')=$4
          ORDER BY occurred_at DESC, fact_id DESC
          LIMIT 1`,
        [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId]
      )
      : [];
    const task = taskRows[0] ?? null;

    const receiptRows = await queryFacts(
      pool,
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (
            (record_json::jsonb#>>'{payload,operation_plan_id}')=$4
            OR ($5::text IS NOT NULL AND ((record_json::jsonb#>>'{payload,act_task_id}')=$5 OR (record_json::jsonb#>>'{payload,task_id}')=$5))
          )
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId, actTaskId]
    );
    const receipt = receiptRows[0] ?? null;

    const artifactRows = await queryFacts(
      pool,
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='evidence_artifact_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (
            (record_json::jsonb#>>'{payload,operation_plan_id}')=$4
            OR ($5::text IS NOT NULL AND (record_json::jsonb#>>'{payload,act_task_id}')=$5)
          )
        ORDER BY occurred_at ASC, fact_id ASC`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId, actTaskId]
    );

    const acceptanceRows = await queryFacts(
      pool,
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='acceptance_result_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (
            (record_json::jsonb#>>'{payload,operation_plan_id}')=$4
            OR ($5::text IS NOT NULL AND (record_json::jsonb#>>'{payload,act_task_id}')=$5)
          )
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId, actTaskId]
    );
    const acceptancePayload = acceptanceRows[0]?.record_json?.payload ?? null;

    const skillRunRows = await queryFacts(
      pool,
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='skill_run_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (
            (record_json::jsonb#>>'{payload,operation_plan_id}')=$4
            OR (record_json::jsonb#>>'{payload,operation_id}')=$4
          )
        ORDER BY occurred_at ASC, fact_id ASC`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId]
    );

    const artifactItems = artifactRows.map((row) => {
      const p = row.record_json?.payload ?? {};
      const evidenceLevel = inferEvidenceLevel(p.kind) as EvidenceLevel;
      const skill = buildArtifactSkillMatch({
        artifactTs: toText(p.created_at) ?? row.occurred_at,
        artifactKind: toText(p.kind),
        skillRunRows,
        acceptancePayload
      });
      return {
        artifact_id: toText(p.artifact_id) ?? row.fact_id,
        act_task_id: toText(p.act_task_id),
        operation_plan_id: toText(p.operation_plan_id),
        kind: toText(p.kind),
        evidence_level: evidenceLevel,
        url: toText(p.url),
        text: toText(p.text),
        created_at: toText(p.created_at) ?? row.occurred_at,
        created_by: toText(p.created_by),
        skill_id: skill.skill_id,
        skill_version: skill.skill_version,
        explanation_codes: skill.explanation_codes,
        skill_source: {
          source: skill.source,
          trigger_stage: skill.trigger_stage,
          run_id: skill.run_id,
          matched_at: skill.matched_at
        }
      };
    });

    const builtAcceptance = buildAcceptanceResult({
      operation_plan_id: operationPlanId,
      hasReceipt: Boolean(receipt),
      evidenceCount: artifactItems.length
    });
    const acceptance = acceptancePayload
      ? {
        acceptance_id: toText(acceptancePayload.acceptance_id) ?? builtAcceptance.acceptance_id,
        operation_plan_id: toText(acceptancePayload.operation_plan_id) ?? operationPlanId,
        verdict: toText(acceptancePayload.verdict) ?? builtAcceptance.verdict,
        missing_evidence: Array.isArray(acceptancePayload.missing_evidence) ? acceptancePayload.missing_evidence : builtAcceptance.missing_evidence,
        explanation_codes: Array.isArray(acceptancePayload.explanation_codes) ? acceptancePayload.explanation_codes : [],
        skill_meta: {
          skill_id: toText(acceptancePayload.acceptance_skill_id),
          version: toText(acceptancePayload.acceptance_skill_version),
          input_digest: toText(acceptancePayload.input_digest),
          output_digest: toText(acceptancePayload.output_digest),
        },
        generated_at: toText(acceptancePayload.generated_at) ?? acceptanceRows[0].occurred_at
      }
      : builtAcceptance;

    const taskPayload = task?.record_json?.payload ?? {};
    const receiptPayload = receipt?.record_json?.payload ?? {};
    const executor = {
      id: toText(receiptPayload?.executor_id?.id) ?? toText(receiptPayload.executor_id) ?? toText(taskPayload?.executor_id?.id) ?? toText(taskPayload.executor_id),
      kind: toText(receiptPayload?.executor_id?.kind) ?? toText(taskPayload?.executor_id?.kind),
      label: toText(receiptPayload.executor_label) ?? toText(taskPayload.executor_label)
    };

    const projectionFacts = await loadOperationProjectionFacts({
      pool,
      tenant,
      operationPlanId,
      actTaskId,
      recommendationId,
      approvalRequestId
    });
    const projected = projectOperationStateFromFacts(projectionFacts).find((x) => x.operation_plan_id === operationPlanId || x.operation_id === operationPlanId);
    const timeline = (projected?.timeline ?? []).map((x) => ({ ts: x.ts, type: x.type, label: x.label }));
    const skillTrace = projected?.skill_trace ?? null;
    const skillTraceSummary = {
      stages: {
        crop_skill: skillTrace?.crop_skill ?? null,
        agronomy_skill: skillTrace?.agronomy_skill ?? null,
        device_skill: skillTrace?.device_skill ?? null,
        acceptance_skill: skillTrace?.acceptance_skill ?? null,
      },
      success_count: [
        skillTrace?.crop_skill,
        skillTrace?.agronomy_skill,
        skillTrace?.device_skill,
        skillTrace?.acceptance_skill,
      ].filter((x) => String(x?.result_status ?? "").toUpperCase() === "SUCCESS").length,
    };
    const levelCounts: Record<EvidenceLevel, number> = { DEBUG: 0, FORMAL: 0, STRONG: 0 };
    for (const item of artifactItems) {
      const level = String(item.evidence_level ?? "").toUpperCase() as EvidenceLevel;
      if (levelCounts[level] != null) levelCounts[level] += 1;
    }

    return reply.send({
      ok: true,
      item: {
        operation_plan_id: operationPlanId,
        act_task_id: actTaskId,
        executor,
        receipt: receipt
          ? {
            fact_id: receipt.fact_id,
            occurred_at: receipt.occurred_at,
            status: toText(receiptPayload.status),
            receipt_id: toText(receiptPayload.receipt_id),
            payload: receiptPayload
          }
          : null,
        artifacts: artifactItems,
        evidence_summary: {
          artifact_count: artifactItems.length,
          level_counts: levelCounts,
        },
        acceptance,
        timeline,
        skill_trace_summary: skillTraceSummary
      }
    });
  });
}
