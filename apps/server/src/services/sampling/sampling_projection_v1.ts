import type { Pool } from "pg";

type SamplingScope = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id?: string | null;
  operation_id?: string | null;
  operation_ids?: string[] | null;
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

function uniqueTextList(values: unknown[]): string[] {
  return Array.from(new Set(
    values
      .map((v) => toText(v))
      .filter((v): v is string => Boolean(v))
  ));
}

function emptySamplingReportView(): SamplingReportViewV1 {
  return {
    plan_id: null,
    sample_id: null,
    sample_type: null,
    zone_id: null,
    collected_at_ts: null,
    lab_result_status: "MISSING",
    acceptance_status: "MISSING",
    customer_visible_eligible: false,
    blocking_reasons: [],
  };
}

export async function buildSamplingReportViewV1(pool: Pool, params: SamplingScope): Promise<SamplingReportViewV1> {
  const scope = [params.tenant_id, params.project_id, params.group_id];
  const plan = toText(params.plan_id);
  const operationIds = uniqueTextList([
    params.operation_id,
    ...(Array.isArray(params.operation_ids) ? params.operation_ids : []),
  ]);

  if (!plan && operationIds.length < 1) return emptySamplingReportView();

  let resolvedPlanId: string | null = plan;

  if (!resolvedPlanId && operationIds.length > 0) {
    const relationRow = await pool.query(
      `SELECT record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='sampling_operation_relation_v1'
          AND (record_json::jsonb->>'tenant_id')=$1
          AND (record_json::jsonb->>'project_id')=$2
          AND (record_json::jsonb->>'group_id')=$3
          AND (
            (record_json::jsonb->>'operation_id') = ANY($4::text[])
            OR (record_json::jsonb->>'operation_plan_id') = ANY($4::text[])
          )
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [...scope, operationIds],
    );
    resolvedPlanId = toText(relationRow.rows?.[0]?.record_json?.plan_id);
  }

  if (!resolvedPlanId) return emptySamplingReportView();

  const planRow = await pool.query(
      `SELECT record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='sampling_plan_v1'
          AND (record_json::jsonb->>'tenant_id')=$1
          AND (record_json::jsonb->>'project_id')=$2
          AND (record_json::jsonb->>'group_id')=$3
          AND (record_json::jsonb->>'plan_id')=$4
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [...scope, resolvedPlanId],
    );

  const planJson: any = planRow.rows?.[0]?.record_json ?? null;
  resolvedPlanId = toText(planJson?.plan_id) ?? resolvedPlanId;

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
