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

function blockedSamplingReportView(reason: string, plan_id: string | null = null): SamplingReportViewV1 {
  return {
    ...emptySamplingReportView(),
    plan_id,
    blocking_reasons: [reason],
  };
}

export async function buildSamplingReportViewV1(pool: Pool, params: SamplingScope): Promise<SamplingReportViewV1> {
  const scope = [params.tenant_id, params.project_id, params.group_id];
  const requestedPlanId = toText(params.plan_id);
  const operationIds = uniqueTextList([
    params.operation_id,
    ...(Array.isArray(params.operation_ids) ? params.operation_ids : []),
  ]);

  if (!requestedPlanId && operationIds.length < 1) return emptySamplingReportView();

  let resolvedPlanId: string | null = requestedPlanId;
  let relationPlanFactId: string | null = null;

  if (!resolvedPlanId && operationIds.length > 0) {
    const relationRows = await pool.query(
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
    if ((relationRows.rows?.length ?? 0) > 1) {
      return blockedSamplingReportView("AMBIGUOUS_SAMPLING_OPERATION_RELATION");
    }
    const relation = relationRows.rows?.[0]?.record_json ?? null;
    resolvedPlanId = toText(relation?.plan_id);
    relationPlanFactId = toText(relation?.sampling_plan_fact_id);
  }

  if (!resolvedPlanId) return emptySamplingReportView();

  const expectedPlanFactId = `sp_${resolvedPlanId}`;
  if (relationPlanFactId && relationPlanFactId !== expectedPlanFactId) {
    return blockedSamplingReportView("SAMPLING_RELATION_PLAN_FACT_MISMATCH", resolvedPlanId);
  }

  const planRow = await pool.query(
    `SELECT fact_id, record_json
       FROM facts
      WHERE fact_id=$4
        AND (record_json::jsonb->>'type')='sampling_plan_v1'
        AND (record_json::jsonb->>'tenant_id')=$1
        AND (record_json::jsonb->>'project_id')=$2
        AND (record_json::jsonb->>'group_id')=$3
        AND (record_json::jsonb->>'plan_id')=$5
      LIMIT 1`,
    [...scope, expectedPlanFactId, resolvedPlanId],
  );
  const planFactId = toText(planRow.rows?.[0]?.fact_id);
  const planJson: any = planRow.rows?.[0]?.record_json ?? null;
  if (!planFactId || !planJson) return blockedSamplingReportView("SAMPLING_PLAN_EXACT_FACT_NOT_FOUND", resolvedPlanId);

  const receiptRows = await pool.query(
    `SELECT fact_id, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='sample_receipt_v1'
        AND (record_json::jsonb->>'tenant_id')=$1
        AND (record_json::jsonb->>'project_id')=$2
        AND (record_json::jsonb->>'group_id')=$3
        AND (record_json::jsonb->>'plan_id')=$4
      LIMIT 2`,
    [...scope, resolvedPlanId],
  );
  if ((receiptRows.rows?.length ?? 0) > 1) {
    return blockedSamplingReportView("AMBIGUOUS_SAMPLE_RECEIPT_FOR_PLAN", resolvedPlanId);
  }

  const receiptFactId = toText(receiptRows.rows?.[0]?.fact_id);
  const receipt: any = receiptRows.rows?.[0]?.record_json ?? null;
  if (receipt && toText(receipt?.sampling_plan_fact_id) !== planFactId) {
    return blockedSamplingReportView("SAMPLE_RECEIPT_PLAN_FACT_MISMATCH", resolvedPlanId);
  }
  const sampleId = toText(receipt?.sample_id);

  let acceptance: any = null;
  let lab: any = null;

  if (sampleId) {
    const acceptanceRows = await pool.query(
      `SELECT fact_id, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='sampling_acceptance_v1'
          AND (record_json::jsonb->>'tenant_id')=$1
          AND (record_json::jsonb->>'project_id')=$2
          AND (record_json::jsonb->>'group_id')=$3
          AND (record_json::jsonb->>'plan_id')=$4
          AND (record_json::jsonb->>'sample_id')=$5
        LIMIT 2`,
      [...scope, resolvedPlanId, sampleId],
    );
    if ((acceptanceRows.rows?.length ?? 0) > 1) {
      return blockedSamplingReportView("AMBIGUOUS_SAMPLING_ACCEPTANCE_FOR_PLAN", resolvedPlanId);
    }
    acceptance = acceptanceRows.rows?.[0]?.record_json ?? null;

    if (acceptance) {
      if (toText(acceptance?.sampling_plan_fact_id) !== planFactId) {
        return blockedSamplingReportView("SAMPLING_ACCEPTANCE_PLAN_FACT_MISMATCH", resolvedPlanId);
      }
      if (toText(acceptance?.sample_receipt_fact_id) !== receiptFactId) {
        return blockedSamplingReportView("SAMPLING_ACCEPTANCE_RECEIPT_FACT_MISMATCH", resolvedPlanId);
      }

      const labFactId = toText(acceptance?.lab_result_fact_id);
      if (labFactId) {
        const labRow = await pool.query(
          `SELECT fact_id, record_json
             FROM facts
            WHERE fact_id=$4
              AND (record_json::jsonb->>'type')='lab_result_import_v1'
              AND (record_json::jsonb->>'tenant_id')=$1
              AND (record_json::jsonb->>'project_id')=$2
              AND (record_json::jsonb->>'group_id')=$3
              AND (record_json::jsonb->>'sample_id')=$5
            LIMIT 1`,
          [...scope, labFactId, sampleId],
        );
        lab = labRow.rows?.[0]?.record_json ?? null;
        if (!lab) return blockedSamplingReportView("SAMPLING_ACCEPTANCE_LAB_FACT_NOT_FOUND", resolvedPlanId);
        if (toText(lab?.sample_receipt_fact_id) !== receiptFactId) {
          return blockedSamplingReportView("LAB_RESULT_RECEIPT_FACT_MISMATCH", resolvedPlanId);
        }
      }
    } else {
      const labRows = await pool.query(
        `SELECT fact_id, record_json
           FROM facts
          WHERE (record_json::jsonb->>'type')='lab_result_import_v1'
            AND (record_json::jsonb->>'tenant_id')=$1
            AND (record_json::jsonb->>'project_id')=$2
            AND (record_json::jsonb->>'group_id')=$3
            AND (record_json::jsonb->>'sample_id')=$4
          LIMIT 2`,
        [...scope, sampleId],
      );
      if ((labRows.rows?.length ?? 0) > 1) {
        return blockedSamplingReportView("AMBIGUOUS_LAB_RESULT_FOR_SAMPLE", resolvedPlanId);
      }
      lab = labRows.rows?.[0]?.record_json ?? null;
      if (lab && toText(lab?.sample_receipt_fact_id) !== receiptFactId) {
        return blockedSamplingReportView("LAB_RESULT_RECEIPT_FACT_MISMATCH", resolvedPlanId);
      }
    }
  }

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
