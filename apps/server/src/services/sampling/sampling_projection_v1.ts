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

type FactRow = {
  fact_id: string;
  record_json: any;
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

function emptySamplingReportView(blockingReasons: string[] = []): SamplingReportViewV1 {
  return {
    plan_id: null,
    sample_id: null,
    sample_type: null,
    zone_id: null,
    collected_at_ts: null,
    lab_result_status: "MISSING",
    acceptance_status: "MISSING",
    customer_visible_eligible: false,
    blocking_reasons: blockingReasons,
  };
}

function blockedFromPlan(planId: string | null, planJson: any, reasons: string[]): SamplingReportViewV1 {
  const sampleTypeRaw = String(planJson?.sample_type ?? "").toUpperCase();
  return {
    ...emptySamplingReportView(reasons),
    plan_id: planId,
    sample_type: (["SOIL", "TISSUE", "WATER"].includes(sampleTypeRaw) ? sampleTypeRaw : null) as SamplingReportViewV1["sample_type"],
    zone_id: toText(planJson?.zone_id),
  };
}

async function queryAtMostOne(pool: Pool, sql: string, params: unknown[]): Promise<{ row: FactRow | null; ambiguous: boolean }> {
  const result = await pool.query(sql, params);
  if ((result.rows?.length ?? 0) > 1) return { row: null, ambiguous: true };
  return { row: (result.rows?.[0] as FactRow | undefined) ?? null, ambiguous: false };
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
  let relationPlanFactId: string | null = null;

  if (!resolvedPlanId && operationIds.length > 0) {
    const relation = await queryAtMostOne(
      pool,
      `SELECT fact_id, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='sampling_operation_relation_v1'
          AND (record_json::jsonb->>'tenant_id')=$1
          AND (record_json::jsonb->>'project_id')=$2
          AND (record_json::jsonb->>'group_id')=$3
          AND (
            (record_json::jsonb->>'operation_id') = ANY($4::text[])
            OR (record_json::jsonb->>'operation_plan_id') = ANY($4::text[])
          )
        LIMIT 2`,
      [...scope, operationIds],
    );
    if (relation.ambiguous) return emptySamplingReportView(["AMBIGUOUS_SAMPLING_OPERATION_RELATION"]);
    resolvedPlanId = toText(relation.row?.record_json?.plan_id);
    relationPlanFactId = toText(relation.row?.record_json?.sampling_plan_fact_id);
    if (resolvedPlanId && (!relationPlanFactId || relationPlanFactId !== `sp_${resolvedPlanId}`)) {
      return emptySamplingReportView(["SAMPLING_OPERATION_RELATION_EXACT_PLAN_REF_MISSING"]);
    }
  }

  if (!resolvedPlanId) return emptySamplingReportView();

  const planFactId = relationPlanFactId ?? `sp_${resolvedPlanId}`;
  const planResult = await pool.query(
    `SELECT fact_id, record_json
       FROM facts
      WHERE fact_id=$4
        AND (record_json::jsonb->>'type')='sampling_plan_v1'
        AND (record_json::jsonb->>'tenant_id')=$1
        AND (record_json::jsonb->>'project_id')=$2
        AND (record_json::jsonb->>'group_id')=$3
        AND (record_json::jsonb->>'plan_id')=$5
      LIMIT 1`,
    [...scope, planFactId, resolvedPlanId],
  );
  const planRow = (planResult.rows?.[0] as FactRow | undefined) ?? null;
  const planJson: any = planRow?.record_json ?? null;
  if (!planRow) return emptySamplingReportView(["SAMPLING_PLAN_NOT_FOUND"]);

  const receipt = await queryAtMostOne(
    pool,
    `SELECT fact_id, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='sample_receipt_v1'
        AND (record_json::jsonb->>'tenant_id')=$1
        AND (record_json::jsonb->>'project_id')=$2
        AND (record_json::jsonb->>'group_id')=$3
        AND (record_json::jsonb->>'plan_id')=$4
        AND (record_json::jsonb->>'sampling_plan_fact_id')=$5
      LIMIT 2`,
    [...scope, resolvedPlanId, planRow.fact_id],
  );
  if (receipt.ambiguous) return blockedFromPlan(resolvedPlanId, planJson, ["AMBIGUOUS_SAMPLE_RECEIPT_FOR_PLAN"]);
  const receiptRow = receipt.row;
  const receiptJson: any = receiptRow?.record_json ?? null;
  const sampleId = toText(receiptJson?.sample_id);

  if (!receiptRow || !sampleId) {
    return blockedFromPlan(resolvedPlanId, planJson, ["SAMPLE_RECEIPT_MISSING"]);
  }

  const lab = await queryAtMostOne(
    pool,
    `SELECT fact_id, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='lab_result_import_v1'
        AND (record_json::jsonb->>'sample_id')=$1
        AND (record_json::jsonb->>'sample_receipt_fact_id')=$2
        AND (record_json::jsonb->>'sampling_plan_fact_id')=$3
      LIMIT 2`,
    [sampleId, receiptRow.fact_id, planRow.fact_id],
  );
  if (lab.ambiguous) {
    return {
      ...blockedFromPlan(resolvedPlanId, planJson, ["AMBIGUOUS_LAB_RESULT_FOR_SAMPLE"]),
      sample_id: sampleId,
      zone_id: toText(receiptJson?.zone_id ?? planJson?.zone_id),
      collected_at_ts: toNum(receiptJson?.collected_at_ts),
    };
  }
  const labRow = lab.row;
  const labJson: any = labRow?.record_json ?? null;

  const acceptance = await queryAtMostOne(
    pool,
    `SELECT fact_id, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='sampling_acceptance_v1'
        AND (record_json::jsonb->>'tenant_id')=$1
        AND (record_json::jsonb->>'project_id')=$2
        AND (record_json::jsonb->>'group_id')=$3
        AND (record_json::jsonb->>'plan_id')=$4
        AND (record_json::jsonb->>'sample_id')=$5
        AND (record_json::jsonb->>'sampling_plan_fact_id')=$6
        AND (record_json::jsonb->>'sample_receipt_fact_id')=$7
        AND (
          $8::text IS NULL
          OR (record_json::jsonb->>'lab_result_fact_id')=$8
        )
      LIMIT 2`,
    [...scope, resolvedPlanId, sampleId, planRow.fact_id, receiptRow.fact_id, labRow?.fact_id ?? null],
  );
  if (acceptance.ambiguous) {
    return {
      ...blockedFromPlan(resolvedPlanId, planJson, ["AMBIGUOUS_SAMPLING_ACCEPTANCE_FOR_CHAIN"]),
      sample_id: sampleId,
      zone_id: toText(receiptJson?.zone_id ?? planJson?.zone_id),
      collected_at_ts: toNum(receiptJson?.collected_at_ts),
    };
  }
  const acceptanceJson: any = acceptance.row?.record_json ?? null;

  const sampleTypeRaw = String(receiptJson?.sample_type ?? planJson?.sample_type ?? "").toUpperCase();
  const sample_type = (["SOIL", "TISSUE", "WATER"].includes(sampleTypeRaw) ? sampleTypeRaw : null) as SamplingReportViewV1["sample_type"];
  const labRaw = String(labJson?.quality_status ?? "").toUpperCase();
  const lab_result_status = (["PASS", "NEEDS_REVIEW", "INVALID"].includes(labRaw) ? labRaw : "MISSING") as SamplingReportViewV1["lab_result_status"];
  const verdict = String(acceptanceJson?.verdict ?? "").toUpperCase();
  const acceptance_status = (verdict === "PASS" ? "PASS" : verdict === "FAIL" ? "FAIL" : verdict === "INSUFFICIENT_EVIDENCE" ? "NEEDS_REVIEW" : "MISSING") as SamplingReportViewV1["acceptance_status"];
  const blocking_reasons = Array.isArray(acceptanceJson?.reasons)
    ? acceptanceJson.reasons.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
    : [];

  const exactChain =
    Boolean(labRow)
    && Boolean(acceptance.row)
    && receiptJson?.sampling_plan_fact_id === planRow.fact_id
    && labJson?.sampling_plan_fact_id === planRow.fact_id
    && acceptanceJson?.sampling_plan_fact_id === planRow.fact_id
    && acceptanceJson?.sample_receipt_fact_id === receiptRow.fact_id
    && acceptanceJson?.lab_result_fact_id === labRow?.fact_id
    && labJson?.sample_receipt_fact_id === receiptRow.fact_id
    && labJson?.plan_id === resolvedPlanId;

  return {
    plan_id: resolvedPlanId,
    sample_id: sampleId,
    sample_type,
    zone_id: toText(receiptJson?.zone_id ?? planJson?.zone_id),
    collected_at_ts: toNum(receiptJson?.collected_at_ts),
    lab_result_status,
    acceptance_status,
    customer_visible_eligible: exactChain && lab_result_status === "PASS" && acceptance_status === "PASS",
    blocking_reasons: exactChain ? blocking_reasons : [...blocking_reasons, "SAMPLING_EXACT_CHAIN_NOT_ESTABLISHED"],
  };
}
