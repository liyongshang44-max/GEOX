import type { Pool } from "pg";

type SamplingScope = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id?: string | null;
  operation_id?: string | null;
  plan_id?: string | null;
};

export type SamplingReportViewV1 = {
  plan_id: string | null;
  sample_id: string | null;
  sample_type: "SOIL" | "TISSUE" | "WATER" | null;
  zone_id: string | null;
  collected_at_ts: number | null;
  lab_result_status: "PASS" | "NEEDS_REVIEW" | "INVALID" | "MISSING";
  acceptance_status: "PASS" | "NEEDS_REVIEW" | "FAIL" | "MISSING";
  customer_visible_eligible: boolean;
  blocking_reasons: string[];
};

function toText(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function buildSamplingReportViewV1(pool: Pool, params: SamplingScope): Promise<SamplingReportViewV1> {
  const scope = [params.tenant_id, params.project_id, params.group_id];
  const plan = toText(params.plan_id);
  const field = toText(params.field_id);

  const planRow = plan
    ? await pool.query(
      `SELECT record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='sampling_plan_v1'
          AND (record_json::jsonb->>'tenant_id')=$1
          AND (record_json::jsonb->>'project_id')=$2
          AND (record_json::jsonb->>'group_id')=$3
          AND (record_json::jsonb->>'plan_id')=$4
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [...scope, plan],
    )
    : await pool.query(
      `SELECT record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='sampling_plan_v1'
          AND (record_json::jsonb->>'tenant_id')=$1
          AND (record_json::jsonb->>'project_id')=$2
          AND (record_json::jsonb->>'group_id')=$3
          AND ($4::text IS NULL OR (record_json::jsonb->>'field_id')=$4)
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [...scope, field],
    );

  const planJson: any = planRow.rows?.[0]?.record_json ?? null;
  const resolvedPlanId = toText(planJson?.plan_id) ?? plan;

  const receiptRow = resolvedPlanId
    ? await pool.query(
      `SELECT record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='sample_receipt_v1'
          AND (record_json::jsonb->>'tenant_id')=$1
          AND (record_json::jsonb->>'project_id')=$2
          AND (record_json::jsonb->>'group_id')=$3
          AND (record_json::jsonb->>'plan_id')=$4
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [...scope, resolvedPlanId],
    )
    : { rows: [] as any[] };
  const receipt: any = receiptRow.rows?.[0]?.record_json ?? null;
  const sampleId = toText(receipt?.sample_id);

  const labRow = sampleId
    ? await pool.query(
      `SELECT record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='lab_result_import_v1'
          AND (record_json::jsonb->>'sample_id')=$1
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [sampleId],
    )
    : { rows: [] as any[] };
  const lab: any = labRow.rows?.[0]?.record_json ?? null;
  const importId = toText(lab?.import_id);

  const acceptanceRow = sampleId
    ? await pool.query(
      `SELECT record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='sampling_acceptance_v1'
          AND (record_json::jsonb->>'sample_id')=$1
          AND ($2::text IS NULL OR (record_json::jsonb->>'import_id')=$2 OR (record_json::jsonb->>'plan_id')=$3)
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [sampleId, importId, resolvedPlanId],
    )
    : { rows: [] as any[] };
  const acceptance: any = acceptanceRow.rows?.[0]?.record_json ?? null;

  const sampleTypeRaw = String(receipt?.sample_type ?? planJson?.sample_type ?? "").toUpperCase();
  const sample_type = (["SOIL", "TISSUE", "WATER"].includes(sampleTypeRaw) ? sampleTypeRaw : null) as SamplingReportViewV1["sample_type"];
  const labRaw = String(lab?.quality_status ?? "").toUpperCase();
  const lab_result_status = (["PASS", "NEEDS_REVIEW", "INVALID"].includes(labRaw) ? labRaw : "MISSING") as SamplingReportViewV1["lab_result_status"];
  const verdict = String(acceptance?.verdict ?? "").toUpperCase();
  const acceptance_status = (verdict === "PASS" ? "PASS" : verdict === "FAIL" ? "FAIL" : verdict === "INSUFFICIENT_EVIDENCE" ? "NEEDS_REVIEW" : "MISSING") as SamplingReportViewV1["acceptance_status"];
  const blocking_reasons = Array.isArray(acceptance?.reasons) ? acceptance.reasons.map((x: unknown) => String(x ?? "").trim()).filter(Boolean) : [];

  return {
    plan_id: resolvedPlanId,
    sample_id: sampleId,
    sample_type,
    zone_id: toText(receipt?.zone_id ?? planJson?.zone_id),
    collected_at_ts: toNum(receipt?.collected_at_ts),
    lab_result_status,
    acceptance_status,
    customer_visible_eligible: lab_result_status === "PASS" && acceptance_status === "PASS",
    blocking_reasons,
  };
}
