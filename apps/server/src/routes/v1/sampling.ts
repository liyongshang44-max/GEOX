import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { SamplingServiceV1 } from "../../services/sampling/sampling_service_v1.js";
import { requireAoActAnyScopeV0 } from "../../auth/ao_act_authz_v0.js";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isIntMs(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Math.floor(v) === v && v > 0;
}

function isObjectRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function badRequest(reply: any, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function requireSamplingWriteAuth(req: any, reply: any) {
  return requireAoActAnyScopeV0(req, reply, [
    "fields.write",
    "telemetry.write",
    "acceptance.evaluate",
    "security.admin",
  ]);
}

function requireSamplingReadAuth(req: any, reply: any) {
  return requireAoActAnyScopeV0(req, reply, [
    "fields.read",
    "telemetry.read",
    "ao_act.index.read",
    "security.admin",
  ]);
}

function tenantMatchesAuth(body: any, auth: any): boolean {
  return String(body?.tenant_id ?? "") === auth.tenant_id
    && String(body?.project_id ?? "") === auth.project_id
    && String(body?.group_id ?? "") === auth.group_id;
}

const PLAN_REASONS = new Set(["BASELINE", "DIAGNOSTIC", "FOLLOWUP", "COMPLIANCE"]);
const SAMPLE_TYPES = new Set(["SOIL", "TISSUE", "WATER"]);
const CHAIN_STATUSES = new Set(["RECORDED", "MISSING", "BROKEN"]);
const QUALITY_STATUSES = new Set(["PASS", "NEEDS_REVIEW", "INVALID"]);
const EVIDENCE_KINDS = new Set(["raw_sample_v1", "marker_v1", "import_run_v1", "fact_id"]);

function isValidEvidenceRefArray(v: unknown, mustNonEmpty: boolean): boolean {
  if (!Array.isArray(v)) return false;
  if (mustNonEmpty && v.length < 1) return false;
  for (const entry of v) {
    if (!isObjectRecord(entry)) return false;
    if (!isNonEmptyString((entry as any).kind) || !isNonEmptyString((entry as any).ref_id)) return false;
    if (!EVIDENCE_KINDS.has((entry as any).kind)) return false;
  }
  return true;
}

export function registerSamplingV1Routes(app: FastifyInstance, pool: Pool): void {
  const service = new SamplingServiceV1(pool);

  app.post("/api/v1/sampling/plan", async (req, reply) => {
    const auth = requireSamplingWriteAuth(req, reply);
    if (!auth) return;
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.tenant_id)) return badRequest(reply, "MISSING_OR_INVALID:tenant_id");
    if (!isNonEmptyString(body.project_id)) return badRequest(reply, "MISSING_OR_INVALID:project_id");
    if (!isNonEmptyString(body.group_id)) return badRequest(reply, "MISSING_OR_INVALID:group_id");
    if (!isNonEmptyString(body.field_id)) return badRequest(reply, "MISSING_OR_INVALID:field_id");
    if (body.zone_id != null && !isNonEmptyString(body.zone_id)) return badRequest(reply, "MISSING_OR_INVALID:zone_id");
    if (!isNonEmptyString(body.reason) || !PLAN_REASONS.has(body.reason)) return badRequest(reply, "MISSING_OR_INVALID:reason");
    if (!isNonEmptyString(body.sample_type) || !SAMPLE_TYPES.has(body.sample_type)) return badRequest(reply, "MISSING_OR_INVALID:sample_type");
    if (body.operation_id != null && !isNonEmptyString(body.operation_id)) return badRequest(reply, "MISSING_OR_INVALID:operation_id");
    if (body.operation_plan_id != null && !isNonEmptyString(body.operation_plan_id)) return badRequest(reply, "MISSING_OR_INVALID:operation_plan_id");
    if (body.required_depth_cm != null && (typeof body.required_depth_cm !== "number" || !Number.isFinite(body.required_depth_cm))) return badRequest(reply, "MISSING_OR_INVALID:required_depth_cm");
    if (typeof body.required_points !== "number" || !Number.isInteger(body.required_points) || body.required_points <= 0) return badRequest(reply, "MISSING_OR_INVALID:required_points");
    if (!isValidEvidenceRefArray(body.evidence_refs, false)) return badRequest(reply, "MISSING_OR_INVALID:evidence_refs");
    if (!tenantMatchesAuth(body, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const created = await service.createPlan(body);
    return reply.send({ ok: true, ...created });
  });

  app.post("/api/v1/sampling/receipt", async (req, reply) => {
    const auth = requireSamplingWriteAuth(req, reply);
    if (!auth) return;
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.plan_id)) return badRequest(reply, "MISSING_OR_INVALID:plan_id");
    if (!isNonEmptyString(body.sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");
    if (!isNonEmptyString(body.tenant_id)) return badRequest(reply, "MISSING_OR_INVALID:tenant_id");
    if (!isNonEmptyString(body.project_id)) return badRequest(reply, "MISSING_OR_INVALID:project_id");
    if (!isNonEmptyString(body.group_id)) return badRequest(reply, "MISSING_OR_INVALID:group_id");
    if (!isNonEmptyString(body.field_id)) return badRequest(reply, "MISSING_OR_INVALID:field_id");
    if (!isIntMs(body.collected_at_ts)) return badRequest(reply, "MISSING_OR_INVALID:collected_at_ts");
    if (!isNonEmptyString(body.collector_actor_id)) return badRequest(reply, "MISSING_OR_INVALID:collector_actor_id");
    if (!isNonEmptyString(body.sample_type) || !SAMPLE_TYPES.has(body.sample_type)) return badRequest(reply, "MISSING_OR_INVALID:sample_type");
    if (!isValidEvidenceRefArray(body.evidence_refs, true)) return badRequest(reply, "MISSING_OR_INVALID:evidence_refs");
    if (!isNonEmptyString(body.chain_of_custody_status) || !CHAIN_STATUSES.has(body.chain_of_custody_status)) return badRequest(reply, "MISSING_OR_INVALID:chain_of_custody_status");
    if (body.ao_sense_receipt_fact_id != null && !isNonEmptyString(body.ao_sense_receipt_fact_id)) return badRequest(reply, "MISSING_OR_INVALID:ao_sense_receipt_fact_id");
    if (!tenantMatchesAuth(body, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const plan = await service.findPlanById(body.plan_id);
    if (!plan) return reply.status(404).send({ ok: false, error: "NOT_FOUND:plan_id" });
    if (plan.tenant_id !== body.tenant_id || plan.project_id !== body.project_id || plan.group_id !== body.group_id || plan.field_id !== body.field_id) {
      return badRequest(reply, "MISMATCH:plan_scope");
    }
    const allowOverride = body.sample_type_override === true;
    if (plan.sample_type !== body.sample_type && !(allowOverride && isNonEmptyString(body.override_reason))) {
      return badRequest(reply, "MISMATCH:sample_type");
    }
    if (isNonEmptyString(body.ao_sense_receipt_fact_id)) {
      const hasMatchedFactRef = Array.isArray(body.evidence_refs)
        && body.evidence_refs.some((e: any) => e?.kind === "fact_id" && e?.ref_id === body.ao_sense_receipt_fact_id);
      if (!hasMatchedFactRef) return badRequest(reply, "MISMATCH:ao_sense_receipt_fact_id");
      const aoSenseReceiptExists = await service.hasFactByIdAndType(body.ao_sense_receipt_fact_id, "ao_sense_receipt_v1");
      if (!aoSenseReceiptExists) return badRequest(reply, "NOT_FOUND:ao_sense_receipt_fact_id");
    }

    const created = await service.createReceipt(body);
    return reply.send({ ok: true, ...created });
  });

  app.post("/api/v1/sampling/lab-result", async (req, reply) => {
    const auth = requireSamplingWriteAuth(req, reply);
    if (!auth) return;
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");
    if (!isIntMs(body.imported_at_ts)) return badRequest(reply, "MISSING_OR_INVALID:imported_at_ts");
    if (!isObjectRecord(body.metrics)) return badRequest(reply, "MISSING_OR_INVALID:metrics");
    if (!isObjectRecord(body.units)) return badRequest(reply, "MISSING_OR_INVALID:units");
    if (!isValidEvidenceRefArray(body.evidence_refs, true)) return badRequest(reply, "MISSING_OR_INVALID:evidence_refs");
    if (!isNonEmptyString(body.quality_status) || !QUALITY_STATUSES.has(body.quality_status)) return badRequest(reply, "MISSING_OR_INVALID:quality_status");

    const receipt = await service.findReceiptBySampleId(body.sample_id);
    if (!receipt) return reply.status(404).send({ ok: false, error: "NOT_FOUND:sample_receipt" });
    if (!tenantMatchesAuth(receipt, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const created = await service.createLabResult(body);
    return reply.send({ ok: true, ...created });
  });

  app.post("/api/v1/sampling/acceptance/evaluate", async (req, reply) => {
    const auth = requireSamplingWriteAuth(req, reply);
    if (!auth) return;
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.plan_id)) return badRequest(reply, "MISSING_OR_INVALID:plan_id");
    if (!isNonEmptyString(body.sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");
    if (body.import_id != null && !isNonEmptyString(body.import_id)) return badRequest(reply, "MISSING_OR_INVALID:import_id");
    const plan = await service.findPlanById(body.plan_id);
    if (!plan) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    if (!tenantMatchesAuth(plan, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const receipt = await service.findReceiptBySampleId(body.sample_id);
    if (!receipt) {
      const created = await service.createAcceptance({
        plan_id: body.plan_id,
        sample_id: body.sample_id,
        import_id: body.import_id,
        tenant_id: String(plan.tenant_id),
        project_id: String(plan.project_id),
        group_id: String(plan.group_id),
        verdict: "INSUFFICIENT_EVIDENCE",
        reasons: ["MISSING_SAMPLE_RECEIPT"],
        evidence_refs: [],
      });
      return reply.send({ ok: true, ...created, verdict: "INSUFFICIENT_EVIDENCE", reasons: ["MISSING_SAMPLE_RECEIPT"] });
    }
    if (receipt.plan_id !== body.plan_id) return badRequest(reply, "MISMATCH:plan_id");
    if (receipt.sample_id !== body.sample_id) return badRequest(reply, "MISMATCH:sample_id");
    if (!tenantMatchesAuth(receipt, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    if (!tenantMatchesAuth(receipt, plan)) return badRequest(reply, "MISMATCH:receipt_scope");
    if (!Array.isArray(receipt.evidence_refs) || receipt.evidence_refs.length < 1) {
      const created = await service.createAcceptance({
        plan_id: body.plan_id,
        sample_id: body.sample_id,
        import_id: body.import_id,
        tenant_id: String(receipt.tenant_id ?? ""),
        project_id: String(receipt.project_id ?? ""),
        group_id: String(receipt.group_id ?? ""),
        verdict: "INSUFFICIENT_EVIDENCE",
        reasons: ["MISSING_RECEIPT_EVIDENCE_REFS"],
        evidence_refs: [],
      });
      return reply.send({ ok: true, ...created, verdict: "INSUFFICIENT_EVIDENCE", reasons: ["MISSING_RECEIPT_EVIDENCE_REFS"] });
    }

    const labResult = await service.findLabResultBySampleId(body.sample_id, body.import_id);
    if (!labResult) {
      const created = await service.createAcceptance({
        plan_id: body.plan_id,
        sample_id: body.sample_id,
        import_id: body.import_id,
        tenant_id: String(receipt.tenant_id ?? ""),
        project_id: String(receipt.project_id ?? ""),
        group_id: String(receipt.group_id ?? ""),
        verdict: "INSUFFICIENT_EVIDENCE",
        reasons: ["MISSING_LAB_RESULT_IMPORT"],
        evidence_refs: receipt.evidence_refs as any[],
      });
      return reply.send({ ok: true, ...created, verdict: "INSUFFICIENT_EVIDENCE", reasons: ["MISSING_LAB_RESULT_IMPORT"] });
    }

    if (labResult.sample_id !== body.sample_id) return badRequest(reply, "MISMATCH:sample_id");
    const quality = String(labResult.quality_status ?? "").toUpperCase();
    const coc = String(receipt.chain_of_custody_status ?? "").toUpperCase();
    let verdict: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE" = "INSUFFICIENT_EVIDENCE";
    const reasons: string[] = [];

    if (quality === "INVALID") {
      verdict = "FAIL";
      reasons.push("LAB_QUALITY_INVALID");
    } else if (quality === "NEEDS_REVIEW") {
      verdict = "INSUFFICIENT_EVIDENCE";
      reasons.push("LAB_QUALITY_NEEDS_REVIEW");
    } else if (coc === "BROKEN") {
      verdict = "FAIL";
      reasons.push("CHAIN_OF_CUSTODY_BROKEN");
    } else if (coc === "MISSING") {
      verdict = "INSUFFICIENT_EVIDENCE";
      reasons.push("CHAIN_OF_CUSTODY_MISSING");
    } else if (quality === "PASS" && coc === "RECORDED") {
      verdict = "PASS";
      reasons.push("QUALITY_PASS_AND_COC_RECORDED");
    } else {
      verdict = "INSUFFICIENT_EVIDENCE";
      reasons.push("UNCLASSIFIED_EVIDENCE_STATE");
    }

    const evidence_refs = [...(Array.isArray(receipt.evidence_refs) ? receipt.evidence_refs : []), ...(Array.isArray(labResult.evidence_refs) ? labResult.evidence_refs : [])];
    const created = await service.createAcceptance({
      plan_id: body.plan_id,
      sample_id: body.sample_id,
      import_id: body.import_id ?? String(labResult.import_id ?? ""),
      tenant_id: String(receipt.tenant_id ?? ""),
      project_id: String(receipt.project_id ?? ""),
      group_id: String(receipt.group_id ?? ""),
      verdict,
      reasons,
      evidence_refs: evidence_refs as any[],
    });
    return reply.send({ ok: true, ...created, verdict, reasons });
  });

  app.get("/api/v1/sampling/plan/:plan_id", async (req, reply) => {
    const auth = requireSamplingReadAuth(req, reply);
    if (!auth) return;
    const plan_id = (req.params as any)?.plan_id;
    if (!isNonEmptyString(plan_id)) return badRequest(reply, "MISSING_OR_INVALID:plan_id");

    const found = await service.getPlan(plan_id);
    if (!found || !tenantMatchesAuth(found, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, fact: found });
  });

  app.get("/api/v1/sampling/sample/:sample_id", async (req, reply) => {
    const auth = requireSamplingReadAuth(req, reply);
    if (!auth) return;
    const sample_id = (req.params as any)?.sample_id;
    if (!isNonEmptyString(sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");

    const found = await service.getSample(sample_id);
    if (!found || !tenantMatchesAuth(found, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, fact: found });
  });
}
