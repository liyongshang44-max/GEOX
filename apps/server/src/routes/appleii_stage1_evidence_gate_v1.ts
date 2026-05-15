import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";
import { evaluateFormalStage1TriggerGateV1 } from "../domain/decision/stage1_action_boundary_v1.js";
import { appendProblemStateAndUncertaintyFactsV1 } from "../domain/sensing/problem_state_uncertainty_v1.js";
import { refreshFieldReadModelsWithObservabilityV1 } from "../services/field_read_model_refresh_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

function tenantMatches(auth: any, tenant: TenantTriple, reply: FastifyReply): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function isRecommendationGenerateRequest(req: any): boolean {
  const method = String(req.method ?? "").toUpperCase();
  const url = String(req.url ?? "");
  return method === "POST" && url.split("?")[0] === "/api/v1/recommendations/generate";
}

export function registerAppleIIStage1EvidenceGateV1(app: FastifyInstance, pool: Pool): void {
  app.addHook("preHandler", async (req, reply) => {
    if (!isRecommendationGenerateRequest(req)) return;
    const body: any = req.body ?? {};
    const deviceId = String(body.device_id ?? "").trim();
    const fieldId = String(body.field_id ?? "").trim();
    if (!deviceId || !fieldId) return;

    const auth = requireAoActAnyScopeV0(req, reply, ["recommendation.read", "ao_act.index.read"]);
    if (!auth) return reply;
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id),
    };
    if (!tenantMatches(auth, tenant, reply)) return reply;

    const refreshed = await refreshFieldReadModelsWithObservabilityV1(pool, {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      field_id: fieldId,
      device_id: deviceId,
    });
    const stage1Summary = refreshed.sensing_summary_stage1.payload;
    if (!stage1Summary || typeof stage1Summary !== "object") return;

    const problemStateOutput = await appendProblemStateAndUncertaintyFactsV1(pool, {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      field_id: fieldId,
      device_id: deviceId,
      stage1Summary: stage1Summary as Record<string, any>,
    });

    const gate = evaluateFormalStage1TriggerGateV1(stage1Summary);
    if (gate.status === "NEEDS_EVIDENCE") {
      return reply.status(400).send({
        ok: false,
        error: "NEEDS_EVIDENCE",
        reason_codes: gate.reason_codes,
        problem_state_v1: problemStateOutput.problem_state_v1,
        uncertainty_envelope_v1: problemStateOutput.uncertainty_envelope_v1,
        problem_state_ref: `problem_state_v1:${problemStateOutput.problem_state_v1.problem_state_id}`,
        uncertainty_envelope_ref: `uncertainty_envelope_v1:${problemStateOutput.uncertainty_envelope_v1.uncertainty_envelope_id}`,
        fact_ids: problemStateOutput.fact_ids,
        evidence_sufficiency_v1: (stage1Summary as any).evidence_sufficiency_v1 ?? null,
        time_coverage_v1: (stage1Summary as any).time_coverage_v1 ?? null,
        device_health_snapshot_v1: (stage1Summary as any).device_health_snapshot_v1 ?? null,
        conflict_detection_v1: (stage1Summary as any).conflict_detection_v1 ?? null,
      });
    }
  });
}
