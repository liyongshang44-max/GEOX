import type { Pool } from "pg";

export type PestDiseaseInspectionReportProjectionV1 = {
  inspection_id: string | null;
  assessment_id: string | null;
  review_id: string | null;
  inspection_acceptance_id: string | null;

  assessment_status: "CONFIRMED" | "SUSPECTED" | "RULED_OUT" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | null;
  target_type: "PEST" | "DISEASE" | "WEED" | "UNKNOWN_STRESS" | null;
  suspected_issue_code: string | null;
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "NEEDS_REVIEW" | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  evidence_tier: "FORMAL" | "TECHNICAL" | "WARNING" | "MANUAL_REVIEW" | null;

  media_count: number;
  geo_evidence_present: boolean;
  reviewed_by_human: boolean;

  review_required: boolean;
  review_status: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED" | null;

  acceptance_status: "PASS" | "FAIL" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | "MISSING";
  customer_visible_eligible: boolean;
  blocking_reasons: string[];
};

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

function parseRecordJson(v: unknown): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string" || !v.trim()) return null;
  try { return JSON.parse(v); } catch { return null; }
}

function toText(v: unknown): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    return s || null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function normalizeEnum<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = String(v ?? "").trim().toUpperCase();
  return allowed.includes(s as T) ? s as T : null;
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

function latestByType(facts: FactRow[], type: string): FactRow | null {
  return [...facts].reverse().find((row) => String(row.record_json?.type ?? "") === type) ?? null;
}

async function queryInspectionIdFromOperationPlan(pool: Pool, tenant: TenantTriple, operation_plan_id: string): Promise<string | null> {
  const res = await pool.query(
    `SELECT record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operation_plan_id],
  ).catch(() => ({ rows: [] as any[] }));
  const payload = parseRecordJson(res.rows?.[0]?.record_json)?.payload ?? {};
  return toText(
    payload?.pest_disease_inspection_id
    ?? payload?.inspection_id
    ?? payload?.pest_disease_inspection?.inspection_id
    ?? payload?.meta?.pest_disease_inspection_id
    ?? payload?.meta?.inspection_id,
  );
}

async function queryInspectionFacts(pool: Pool, tenant: TenantTriple, inspection_id: string): Promise<FactRow[]> {
  const res = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'inspection_id') = $1
        AND (record_json::jsonb->>'tenant_id') = $2
        AND (record_json::jsonb->>'project_id') = $3
        AND (record_json::jsonb->>'group_id') = $4
        AND (record_json::jsonb->>'type') IN (
          'pest_disease_inspection_request_v1',
          'pest_disease_observation_v1',
          'pest_disease_signal_v1',
          'pest_disease_inspection_assessment_v1',
          'pest_disease_inspection_review_v1',
          'pest_disease_inspection_acceptance_v1'
        )
      ORDER BY occurred_at ASC, fact_id ASC`,
    [inspection_id, tenant.tenant_id, tenant.project_id, tenant.group_id],
  ).catch(() => ({ rows: [] as any[] }));
  return (res.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseRecordJson(row.record_json),
  }));
}

function observationSetForAssessment(observations: FactRow[], assessment: any | null): FactRow[] {
  const refs = new Set(asList(assessment?.observation_refs));
  if (!refs.size) return observations;
  const matched = observations.filter((row) => refs.has(String(row.record_json?.observation_id ?? "")) || refs.has(row.fact_id));
  return matched.length ? matched : observations;
}

function evidenceStats(observations: FactRow[]) {
  const media_count = observations.reduce((sum, row) => {
    const media = row.record_json?.media_refs;
    return sum + (Array.isArray(media) ? media.length : 0);
  }, 0);
  const geo_evidence_present = observations.some((row) => {
    const geo = row.record_json?.geo_point;
    return geo && Number.isFinite(Number(geo.lat)) && Number.isFinite(Number(geo.lng));
  });
  const time_present = observations.some((row) => Number.isFinite(Number(row.record_json?.captured_at_ts)) && Number(row.record_json?.captured_at_ts) > 0);
  return { media_count, geo_evidence_present, time_present };
}

function buildBlockingReasons(params: {
  assessment: any | null;
  acceptance_status: PestDiseaseInspectionReportProjectionV1["acceptance_status"];
  review_status: PestDiseaseInspectionReportProjectionV1["review_status"];
  media_count: number;
  geo_evidence_present: boolean;
  time_present: boolean;
  skillOnly: boolean;
}): string[] {
  const base = asList(params.assessment?.blocking_reasons);
  const out = new Set<string>(base);
  if (params.media_count < 1) out.add("pest_disease_missing_media");
  if (!params.geo_evidence_present) out.add("pest_disease_missing_geo");
  if (!params.time_present) out.add("missing:captured_at_ts");
  if (params.skillOnly) out.add("pest_disease_skill_signal_only");
  if (params.review_status === "PENDING" || (params.assessment?.review_required && params.review_status !== "APPROVED")) out.add("pest_disease_review_pending");
  if (params.review_status === "REJECTED") out.add("pest_disease_review_rejected");
  if (params.acceptance_status !== "PASS") out.add("pest_disease_suspected_review_required");
  if (params.acceptance_status === "PASS") out.add("pest_disease_acceptance_pass_not_treatment");
  if (String(params.assessment?.assessment_status ?? "").toUpperCase() === "CONFIRMED") out.add("pest_disease_inspection_confirmed_no_spray");
  return [...out].filter(Boolean);
}

export async function buildPestDiseaseInspectionReportProjectionV1(pool: Pool, params: {
  tenant: TenantTriple;
  operation_plan_id: string;
  operation_id?: string | null;
  inspection_id?: string | null;
}): Promise<PestDiseaseInspectionReportProjectionV1 | null> {
  const inspection_id = toText(params.inspection_id) ?? await queryInspectionIdFromOperationPlan(pool, params.tenant, params.operation_plan_id);
  if (!inspection_id) return null;
  const facts = await queryInspectionFacts(pool, params.tenant, inspection_id);
  if (!facts.length) return null;

  const observations = facts.filter((row) => row.record_json?.type === "pest_disease_observation_v1");
  const signals = facts.filter((row) => row.record_json?.type === "pest_disease_signal_v1");
  const assessmentRow = latestByType(facts, "pest_disease_inspection_assessment_v1");
  const reviewRow = latestByType(facts, "pest_disease_inspection_review_v1");
  const acceptanceRow = latestByType(facts, "pest_disease_inspection_acceptance_v1");
  const assessment = assessmentRow?.record_json ?? null;
  const review = reviewRow?.record_json ?? null;
  const acceptance = acceptanceRow?.record_json ?? null;
  const scopedObservations = observationSetForAssessment(observations, assessment);
  const evidence = evidenceStats(scopedObservations);
  const reviewStatus = normalizeEnum(review?.review_status, ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED", "ESCALATED"] as const)
    ?? (assessment?.review_required ? "PENDING" : "NOT_REQUIRED");
  const acceptanceStatus = normalizeEnum(acceptance?.verdict, ["PASS", "FAIL", "NEEDS_REVIEW", "INSUFFICIENT_EVIDENCE"] as const) ?? "MISSING";
  const reviewed_by_human = reviewStatus === "APPROVED";
  const skillOnly = observations.length < 1 && signals.length > 0;
  const review_required = Boolean(assessment?.review_required) || normalizeEnum(assessment?.confidence, ["HIGH", "MEDIUM", "LOW"] as const) === "LOW";
  const blocking_reasons = buildBlockingReasons({
    assessment,
    acceptance_status: acceptanceStatus,
    review_status: reviewStatus,
    media_count: evidence.media_count,
    geo_evidence_present: evidence.geo_evidence_present,
    time_present: evidence.time_present,
    skillOnly,
  });
  const customer_visible_eligible = Boolean(
    assessment
    && acceptanceStatus === "PASS"
    && evidence.media_count > 0
    && evidence.geo_evidence_present
    && evidence.time_present
    && (!review_required || reviewed_by_human)
    && reviewStatus !== "REJECTED"
    && reviewStatus !== "ESCALATED"
    && !skillOnly,
  );

  return {
    inspection_id,
    assessment_id: toText(assessment?.assessment_id),
    review_id: toText(review?.review_id),
    inspection_acceptance_id: toText(acceptance?.inspection_acceptance_id),
    assessment_status: normalizeEnum(assessment?.assessment_status, ["CONFIRMED", "SUSPECTED", "RULED_OUT", "NEEDS_REVIEW", "INSUFFICIENT_EVIDENCE"] as const),
    target_type: normalizeEnum(assessment?.target_type, ["PEST", "DISEASE", "WEED", "UNKNOWN_STRESS"] as const),
    suspected_issue_code: toText(assessment?.suspected_issue_code),
    severity: normalizeEnum(assessment?.severity, ["NONE", "LOW", "MEDIUM", "HIGH", "NEEDS_REVIEW"] as const),
    confidence: normalizeEnum(assessment?.confidence, ["HIGH", "MEDIUM", "LOW"] as const),
    evidence_tier: normalizeEnum(assessment?.evidence_tier, ["FORMAL", "TECHNICAL", "WARNING", "MANUAL_REVIEW"] as const),
    media_count: evidence.media_count,
    geo_evidence_present: evidence.geo_evidence_present,
    reviewed_by_human,
    review_required,
    review_status: reviewStatus,
    acceptance_status: acceptanceStatus,
    customer_visible_eligible,
    blocking_reasons,
  };
}
