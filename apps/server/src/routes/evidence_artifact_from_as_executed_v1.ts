import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { buildEvidenceArtifactsFromAsExecutedV1 } from "../domain/evidence/evidence_artifact_from_as_executed_v1.js";

function tenantFromBody(body: any, auth: any) { return { tenant_id: String(body?.tenant_id ?? auth.tenant_id).trim(), project_id: String(body?.project_id ?? auth.project_id).trim(), group_id: String(body?.group_id ?? auth.group_id).trim() }; }
function responseCode(status: string): number { return status === "EVIDENCE_ARTIFACTS_RECORDED" ? 200 : status === "REJECTED_AS_EXECUTED_NOT_FOUND" ? 404 : status === "REJECTED_DUPLICATE" ? 409 : status === "REJECTED_INVALID_INPUT" ? 400 : 422; }
async function findDuplicate(pool: Pool, tenant_id: string, idempotency_key: string) { const q = await pool.query(`SELECT fact_id, record_json::jsonb AS record_json FROM facts WHERE (record_json::jsonb->>'type') = 'operator_as_executed_evidence_artifact_submission_v1' AND (record_json::jsonb#>>'{payload,tenant_id}') = $1 AND (record_json::jsonb#>>'{payload,idempotency_key}') = $2 ORDER BY occurred_at DESC, fact_id DESC LIMIT 1`, [tenant_id, idempotency_key]); return q.rows?.[0] ?? null; }

export function registerEvidenceArtifactFromAsExecutedV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/evidence-artifacts/from-as-executed", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "evidence.artifact.write");
    if (!auth) return reply;
    if (!["executor", "operator", "admin"].includes(String(auth.role))) return reply.status(403).send({ ok: false, error: "AUTH_ROLE_SCOPE_DENIED" });
    const body: any = req.body ?? {}; const tenant = tenantFromBody(body, auth);
    if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) return reply.status(400).send({ ok:false, error:"MISSING_TENANT_SCOPE" });
    if (tenant.tenant_id !== auth.tenant_id || tenant.project_id !== auth.project_id || tenant.group_id !== auth.group_id) return reply.status(404).send({ ok:false, error:"NOT_FOUND" });
    const field_id = String(body?.field_id ?? "").trim(); const as_executed_id = String(body?.as_executed_id ?? "").trim(); const task_id = String(body?.task_id ?? "").trim(); const receipt_id = String(body?.receipt_id ?? "").trim(); const operator_id = String(body?.operator_id ?? auth.actor_id).trim(); const idempotency_key = String(body?.idempotency_key ?? "").trim();
    if (!field_id || !as_executed_id || !task_id || !receipt_id || !operator_id || !idempotency_key) return reply.status(400).send({ ok:false, status:"REJECTED_INVALID_INPUT", error:"REJECTED_INVALID_INPUT", evidence_artifacts_created:false, acceptance_created:false, water_response_verification_created:false, roi_created:false, field_memory_created:false });
    const duplicate = await findDuplicate(pool, tenant.tenant_id, idempotency_key);
    if (duplicate) { const payload = duplicate.record_json?.payload ?? {}; return reply.status(409).send({ ok:false, ...payload, status:"REJECTED_DUPLICATE", duplicate:true, evidence_artifacts_created:false, acceptance_created:false, water_response_verification_created:false, roi_created:false, field_memory_created:false }); }
    const ae = await pool.query(`SELECT as_executed_id, tenant_id, project_id, group_id, field_id, task_id, receipt_id, prescription_id, planned::jsonb AS planned, executed::jsonb AS executed, evidence_refs::jsonb AS evidence_refs, receipt_refs::jsonb AS receipt_refs, log_refs::jsonb AS log_refs FROM as_executed_record_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND as_executed_id=$4 LIMIT 1`, [tenant.tenant_id, tenant.project_id, tenant.group_id, as_executed_id]);
    const built = buildEvidenceArtifactsFromAsExecutedV1({ ...tenant, field_id, zone_id: body?.zone_id == null ? null : String(body.zone_id).trim(), operator_id, idempotency_key, materialization_reason: String(body?.materialization_reason ?? "").trim(), asExecutedRecord: ae.rows?.[0] ?? null, as_executed_id, task_id, receipt_id, operation_plan_id: body?.operation_plan_id == null || String(body.operation_plan_id).trim() === "" ? null : String(body.operation_plan_id).trim(), submission_id: `sub_${randomUUID()}`, created_at: new Date().toISOString() });
    if (built.submission.status !== "EVIDENCE_ARTIFACTS_RECORDED") return reply.status(responseCode(built.submission.status)).send({ ok:false, ...built.submission });
    const client = await pool.connect();
    try { await client.query("BEGIN"); await client.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [built.submission.submission_id, "operator_as_executed_evidence_artifact_submission_api", JSON.stringify({ type:"operator_as_executed_evidence_artifact_submission_v1", payload: built.submission })]); for (const a of built.artifacts) await client.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb) ON CONFLICT (fact_id) DO NOTHING", [a.fact_id, "operator_as_executed_evidence_artifact_submission_api", JSON.stringify(a.record)]); await client.query("COMMIT"); }
    catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
    return reply.send({ ok:true, ...built.submission });
  });
}
