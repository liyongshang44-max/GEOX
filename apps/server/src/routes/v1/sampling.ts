import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { SamplingServiceErrorV1, SamplingServiceV1 } from "../../services/sampling/sampling_service_v1.js";
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

function handleSamplingServiceError(reply: any, error: unknown) {
  if (error instanceof SamplingServiceErrorV1) {
    return reply.status(error.statusCode).send({ ok: false, error: error.message });
  }
  throw error;
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

const PLAN_REASONS = new Set(["LOW_CONFIDENCE", "NUTRIENT_CHECK", "SOIL_MOISTURE_VALIDATION", "MODEL_GAP", "MANUAL_REQUEST"]);
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
    if (!auth) return reply;
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
    if (!auth) return reply;
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
    const planRecord = plan.record_json;
    if (planRecord.tenant_id !== body.tenant_id || planRecord.project_id !== body.project_id || planRecord.group_id !== body.group_id || planRecord.field_id !== body.field_id) {
      return badRequest(reply, "MISMATCH:plan_scope");
    }
    const allowOverride = body.sample_type_override === true;
    if (planRecord.sample_type !== body.sample_type && !(allowOverride && isNonEmptyString(body.override_reason))) {
      return badRequest(reply, "MISMATCH:sample_type");
    }
    if (isNonEmptyString(body.ao_sense_receipt_fact_id)) {
      const hasMatchedFactRef = Array.isArray(body.evidence_refs)
        && body.evidence_refs.some((e: any) => e?.kind === "fact_id" && e?.ref_id === body.ao_sense_receipt_fact_id);
      if (!hasMatchedFactRef) return badRequest(reply, "MISMATCH:ao_sense_receipt_fact_id");
      const aoSenseReceiptExists = await service.hasFactByIdAndType(body.ao_sense_receipt_fact_id, "ao_sense_receipt_v1");
      if (!aoSenseReceiptExists) return badRequest(reply, "NOT_FOUND:ao_sense_receipt_fact_id");
    }

    try {
      const created = await service.createReceipt({ ...body, sampling_plan_fact_id: plan.fact_id });
      return reply.send({ ok: true, ...created, sampling_plan_fact_id: plan.fact_id });
    } catch (error) {
      return handleSamplingServiceError(reply, error);
    }
  });

  app.post("/api/v1/sampling/lab-result", async (req, reply) => {
    const auth = requireSamplingWriteAuth(req, reply);
    if (!auth) return reply;
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");
    if (body.sample_receipt_fact_id != null && !isNonEmptyString(body.sample_receipt_fact_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_receipt_fact_id");
    if (!isIntMs(body.imported_at_ts)) return badRequest(reply, "MISSING_OR_INVALID:imported_at_ts");
    if (!isObjectRecord(body.metrics)) return badRequest(reply, "MISSING_OR_INVALID:metrics");
    if (!isObjectRecord(body.units)) return badRequest(reply, "MISSING_OR_INVALID:units");
    if (!isValidEvidenceRefArray(body.evidence_refs, true)) return badRequest(reply, "MISSING_OR_INVALID:evidence_refs");
    if (!isNonEmptyString(body.quality_status) || !QUALITY_STATUSES.has(body.quality_status)) return badRequest(reply, "MISSING_OR_INVALID:quality_status");

    try {
      const receipt = isNonEmptyString(body.sample_receipt_fact_id)
        ? await service.findReceiptByFactId(body.sample_receipt_fact_id, body.sample_id, auth)
        : await service.findReceiptBySampleId(body.sample_id, auth);
      if (!receipt) return reply.status(404).send({ ok: false, error: "NOT_FOUND:sample_receipt" });
      const receiptRecord = receipt.record_json;
      if (!tenantMatchesAuth(receiptRecord, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
      const receiptPlanId = String(receiptRecord.plan_id ?? "").trim();
      const receiptPlanFactId = String(receiptRecord.sampling_plan_fact_id ?? "").trim();
      if (!receiptPlanId || !receiptPlanFactId) return badRequest(reply, "MISSING_EXACT:sample_receipt_plan_ref");
      const plan = await service.findPlanById(receiptPlanId);
      if (!plan) return reply.status(404).send({ ok: false, error: "NOT_FOUND:sampling_plan_v1" });
      if (plan.fact_id !== receiptPlanFactId) return badRequest(reply, "MISMATCH:sampling_plan_fact_id");
      if (!tenantMatchesAuth(plan.record_json, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
      if (String(plan.record_json.field_id ?? "") !== String(receiptRecord.field_id ?? "")) return badRequest(reply, "MISMATCH:plan_field_id");

      const created = await service.createLabResult({
        ...body,
        sample_receipt_fact_id: receipt.fact_id,
        sampling_plan_fact_id: plan.fact_id,
        plan_id: receiptPlanId,
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        field_id: String(receiptRecord.field_id ?? ""),
      });
      return reply.send({ ok: true, ...created, sample_receipt_fact_id: receipt.fact_id });
    } catch (error) {
      return handleSamplingServiceError(reply, error);
    }
  });

  app.post("/api/v1/sampling/acceptance/evaluate", async (req, reply) => {
    const auth = requireSamplingWriteAuth(req, reply);
    if (!auth) return reply;
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.plan_id)) return badRequest(reply, "MISSING_OR_INVALID:plan_id");
    if (!isNonEmptyString(body.sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");
    if (body.import_id != null && !isNonEmptyString(body.import_id)) return badRequest(reply, "MISSING_OR_INVALID:import_id");

    const plan = await service.findPlanById(body.plan_id);
    if (!plan) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const planRecord = plan.record_json;
    if (!tenantMatchesAuth(planRecord, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    try {
      const receipt = await service.findReceiptBySampleId(body.sample_id, auth, plan.fact_id);
      if (!receipt) {
        const created = await service.createAcceptance({
          plan_id: body.plan_id,
          sample_id: body.sample_id,
          import_id: body.import_id,
          tenant_id: String(planRecord.tenant_id),
          project_id: String(planRecord.project_id),
          group_id: String(planRecord.group_id),
          field_id: String(planRecord.field_id),
          sampling_plan_fact_id: plan.fact_id,
          sample_receipt_fact_id: null,
          lab_result_fact_id: null,
          verdict: "INSUFFICIENT_EVIDENCE",
          reasons: ["MISSING_SAMPLE_RECEIPT"],
          evidence_refs: [],
        });
        return reply.send({ ok: true, ...created, verdict: "INSUFFICIENT_EVIDENCE", reasons: ["MISSING_SAMPLE_RECEIPT"] });
      }

      const receiptRecord = receipt.record_json;
      if (receiptRecord.plan_id !== body.plan_id) return badRequest(reply, "MISMATCH:plan_id");
      if (receiptRecord.sampling_plan_fact_id !== plan.fact_id) return badRequest(reply, "MISMATCH:sampling_plan_fact_id");
      if (receiptRecord.sample_id !== body.sample_id) return badRequest(reply, "MISMATCH:sample_id");
      if (!tenantMatchesAuth(receiptRecord, auth)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
      if (!tenantMatchesAuth(receiptRecord, planRecord)) return badRequest(reply, "MISMATCH:receipt_scope");
      if (!Array.isArray(receiptRecord.evidence_refs) || receiptRecord.evidence_refs.length < 1) {
        const created = await service.createAcceptance({
          plan_id: body.plan_id,
          sample_id: body.sample_id,
          import_id: body.import_id,
          tenant_id: String(receiptRecord.tenant_id ?? ""),
          project_id: String(receiptRecord.project_id ?? ""),
          group_id: String(receiptRecord.group_id ?? ""),
          field_id: String(receiptRecord.field_id ?? ""),
          sampling_plan_fact_id: plan.fact_id,
          sample_receipt_fact_id: receipt.fact_id,
          lab_result_fact_id: null,
          verdict: "INSUFFICIENT_EVIDENCE",
          reasons: ["MISSING_RECEIPT_EVIDENCE_REFS"],
          evidence_refs: [],
        });
        return reply.send({ ok: true, ...created, verdict: "INSUFFICIENT_EVIDENCE", reasons: ["MISSING_RECEIPT_EVIDENCE_REFS"] });
      }

      const labResult = await service.findLabResultBySampleId(body.sample_id, body.import_id, receipt.fact_id);
      if (!labResult) {
        const created = await service.createAcceptance({
          plan_id: body.plan_id,
          sample_id: body.sample_id,
          import_id: body.import_id,
          tenant_id: String(receiptRecord.tenant_id ?? ""),
          project_id: String(receiptRecord.project_id ?? ""),
          group_id: String(receiptRecord.group_id ?? ""),
          field_id: String(receiptRecord.field_id ?? ""),
          sampling_plan_fact_id: plan.fact_id,
          sample_receipt_fact_id: receipt.fact_id,
          lab_result_fact_id: null,
          verdict: "INSUFFICIENT_EVIDENCE",
          reasons: ["MISSING_LAB_RESULT_IMPORT"],
          evidence_refs: receiptRecord.evidence_refs as any[],
        });
        return reply.send({ ok: true, ...created, verdict: "INSUFFICIENT_EVIDENCE", reasons: ["MISSING_LAB_RESULT_IMPORT"] });
      }

      const labRecord = labResult.record_json;
      if (labRecord.sample_id !== body.sample_id) return badRequest(reply, "MISMATCH:sample_id");
      if (labRecord.sample_receipt_fact_id !== receipt.fact_id) return badRequest(reply, "MISMATCH:sample_receipt_fact_id");
      if (labRecord.sampling_plan_fact_id !== plan.fact_id) return badRequest(reply, "MISMATCH:lab_sampling_plan_fact_id");
      if (labRecord.plan_id !== body.plan_id) return badRequest(reply, "MISMATCH:lab_plan_id");

      const quality = String(labRecord.quality_status ?? "").toUpperCase();
      const coc = String(receiptRecord.chain_of_custody_status ?? "").toUpperCase();
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

      const evidence_refs = [
        ...(Array.isArray(receiptRecord.evidence_refs) ? receiptRecord.evidence_refs : []),
        ...(Array.isArray(labRecord.evidence_refs) ? labRecord.evidence_refs : []),
        { kind: "fact_id", ref_id: plan.fact_id },
        { kind: "fact_id", ref_id: receipt.fact_id },
        { kind: "fact_id", ref_id: labResult.fact_id },
      ];
      const created = await service.createAcceptance({
        plan_id: body.plan_id,
        sample_id: body.sample_id,
        import_id: body.import_id ?? String(labRecord.import_id ?? ""),
        tenant_id: String(receiptRecord.tenant_id ?? ""),
        project_id: String(receiptRecord.project_id ?? ""),
        group_id: String(receiptRecord.group_id ?? ""),
        field_id: String(receiptRecord.field_id ?? ""),
        sampling_plan_fact_id: plan.fact_id,
        sample_receipt_fact_id: receipt.fact_id,
        lab_result_fact_id: labResult.fact_id,
        verdict,
        reasons,
        evidence_refs: evidence_refs as any[],
      });
      return reply.send({
        ok: true,
        ...created,
        verdict,
        reasons,
        sampling_plan_fact_id: plan.fact_id,
        sample_receipt_fact_id: receipt.fact_id,
        lab_result_fact_id: labResult.fact_id,
      });
    } catch (error) {
      return handleSamplingServiceError(reply, error);
    }
  });

  app.get("/api/v1/sampling/plan/:plan_id", async (req, reply) => {
    const auth = requireSamplingReadAuth(req, reply);
    if (!auth) return reply;
    const plan_id = (req.params as any)?.plan_id;
    if (!isNonEmptyString(plan_id)) return badRequest(reply, "MISSING_OR_INVALID:plan_id");

    const found = await service.getPlan(plan_id);
    const scopeRecord = (found as any)?.record_json ?? found;
    if (!found || !tenantMatchesAuth(scopeRecord, auth)) {
      return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    }
    return reply.send({ ok: true, fact: found });
  });

  app.get("/api/v1/sampling/sample/:sample_id", async (req, reply) => {
    const auth = requireSamplingReadAuth(req, reply);
    if (!auth) return reply;
    const sample_id = (req.params as any)?.sample_id;
    if (!isNonEmptyString(sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");

    try {
      const found = await service.getSample(sample_id, auth);
      const scopeRecord = (found as any)?.record_json ?? found;
      if (!found || !tenantMatchesAuth(scopeRecord, auth)) {
        return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
      }
      return reply.send({ ok: true, fact: found });
    } catch (error) {
      return handleSamplingServiceError(reply, error);
    }
  });
}
