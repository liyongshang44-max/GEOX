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
  return Array.from(new Set(values.map((v) => toText(v)).filter((v): v is string => Boolean(v))));
}

function emptySamplingReportView(blocking_reasons: string[] = []): SamplingReportViewV1 {
  return {
    plan_id: null,
    sample_id: null,
    sample_type: null,
    zone_id: null,
    collected_at_ts: null,
    lab_result_status: "MISSING",
    acceptance_status: "MISSING",
    customer_visible_eligible: false,
    blocking_reasons,
  };
}

function rowRecord(row: any): any {
  return row?.record_json ?? null;
}

export async function buildSamplingReportViewV1(pool: Pool, params: SamplingScope): Promise<SamplingReportViewV1> {
  const scope = [params.tenant_id, params.project_id, params.group_id];
  const requestedPlanId = toText(params.plan_id);
  const operationIds = uniqueTextList([
    params.operation_id,
    ...(Array.isArray(params.operation_ids) ? params.operation_ids : []),
  ]);

  if (!requestedPlanId && operationIds.length < 1) return emptySamplingReportView();

  let planRow: any = null;

  if (requestedPlanId) {
    const planRows = await pool.query(
      `SELECT fact_id, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='sampling_plan_v1'
          AND (record_json::jsonb->>'tenant_id')=$1
          AND (record_json::jsonb->>'project_id')=$2
          AND (record_json::jsonb->>'group_id')=$3
          AND (record_json::jsonb->>'plan_id')=$4
        LIMIT 2`,
      [...scope, requestedPlanId],
    );
    if ((planRows.rows?.length ?? 0) > 1) return emptySamplingReportView(["AMBIGUOUS_SAMPLING_PLAN_BINDING"]);
    planRow = planRows.rows?.[0] ?? null;
  } else {
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
          )`,
      [...scope, operationIds],
    );
    const planFactIds = uniqueTextList((relationRows.rows ?? []).map((row: any) => rowRecord(row)?.plan_fact_id));
    if (planFactIds.length > 1) return emptySamplingReportView(["AMBIGUOUS_SAMPLING_PLAN_BINDING"]);
    const planFactId = planFactIds[0] ?? null;
    if (!planFactId) return emptySamplingReportView();
    const exactPlan = await pool.query(
      `SELECT fact_id, record_json
         FROM facts
        WHERE fact_id=$1
          AND (record_json::jsonb->>'type')='sampling_plan_v1'
          AND (record_json::jsonb->>'tenant_id')=$2
          AND (record_json::jsonb->>'project_id')=$3
          AND (record_json::jsonb->>'group_id')=$4
        LIMIT 1`,
      [planFactId, ...scope],
    );
    planRow = exactPlan.rows?.[0] ?? null;
  }

  const plan: any = rowRecord(planRow);
  if (!planRow || !plan) return emptySamplingReportView();

  const planFactId = toText(plan.plan_fact_id);
  const planId = toText(plan.plan_id);
  if (!planFactId || planRow.fact_id !== planFactId) return emptySamplingReportView(["SAMPLING_PLAN_EXACT_IDENTITY_MISSING"]);

  const receiptRows = await pool.query(
    `SELECT fact_id, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='sample_receipt_v1'
        AND (record_json::jsonb->>'tenant_id')=$1
        AND (record_json::jsonb->>'project_id')=$2
        AND (record_json::jsonb->>'group_id')=$3
        AND (record_json::jsonb->>'plan_fact_id')=$4
      LIMIT 2`,
    [...scope, planFactId],
  );

  if ((receiptRows.rows?.length ?? 0) > 1) {
    return {
      ...emptySamplingReportView(["AMBIGUOUS_SAMPLE_RECEIPT_BINDING"]),
      plan_id: planId,
      sample_type: (["SOIL", "TISSUE", "WATER"].includes(String(plan.sample_type ?? "").toUpperCase())
        ? String(plan.sample_type).toUpperCase()
        : null) as SamplingReportViewV1["sample_type"],
      zone_id: toText(plan.zone_id),
    };
  }

  const receiptRow: any = receiptRows.rows?.[0] ?? null;
  const receipt: any = rowRecord(receiptRow);
  if (!receiptRow || !receipt) {
    return {
      ...emptySamplingReportView(),
      plan_id: planId,
      sample_type: (["SOIL", "TISSUE", "WATER"].includes(String(plan.sample_type ?? "").toUpperCase())
        ? String(plan.sample_type).toUpperCase()
        : null) as SamplingReportViewV1["sample_type"],
      zone_id: toText(plan.zone_id),
    };
  }

  const receiptFactId = toText(receipt.receipt_fact_id);
  const sampleId = toText(receipt.sample_id);
  const exactReceiptOk = Boolean(
    receiptFactId
    && receiptRow.fact_id === receiptFactId
    && receipt.plan_fact_id === planFactId
    && receipt.plan_id === planId
  );
  if (!exactReceiptOk) {
    return {
      ...emptySamplingReportView(["SAMPLE_RECEIPT_EXACT_BINDING_INVALID"]),
      plan_id: planId,
      sample_id: sampleId,
      zone_id: toText(receipt.zone_id ?? plan.zone_id),
      collected_at_ts: toNum(receipt.collected_at_ts),
    };
  }

  const acceptanceRows = await pool.query(
    `SELECT fact_id, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='sampling_acceptance_v1'
        AND (record_json::jsonb->>'tenant_id')=$1
        AND (record_json::jsonb->>'project_id')=$2
        AND (record_json::jsonb->>'group_id')=$3
        AND (record_json::jsonb->>'plan_fact_id')=$4
        AND (record_json::jsonb->>'receipt_fact_id')=$5
        AND (record_json::jsonb->>'sample_id')=$6
      LIMIT 2`,
    [...scope, planFactId, receiptFactId, sampleId],
  );

  if ((acceptanceRows.rows?.length ?? 0) > 1) {
    return {
      ...emptySamplingReportView(["AMBIGUOUS_SAMPLING_ACCEPTANCE_BINDING"]),
      plan_id: planId,
      sample_id: sampleId,
      sample_type: (["SOIL", "TISSUE", "WATER"].includes(String(receipt.sample_type ?? plan.sample_type ?? "").toUpperCase())
        ? String(receipt.sample_type ?? plan.sample_type).toUpperCase()
        : null) as SamplingReportViewV1["sample_type"],
      zone_id: toText(receipt.zone_id ?? plan.zone_id),
      collected_at_ts: toNum(receipt.collected_at_ts),
    };
  }

  const acceptanceRow: any = acceptanceRows.rows?.[0] ?? null;
  const acceptance: any = rowRecord(acceptanceRow);

  let labRow: any = null;
  let exactBlocking: string[] = [];

  if (acceptance) {
    const labFactId = toText(acceptance.lab_fact_id);
    if (!labFactId
      || acceptanceRow.fact_id !== toText(acceptance.acceptance_fact_id)
      || acceptance.plan_fact_id !== planFactId
      || acceptance.receipt_fact_id !== receiptFactId
      || acceptance.sample_id !== sampleId) {
      exactBlocking.push("SAMPLING_ACCEPTANCE_EXACT_BINDING_INVALID");
    } else {
      const exactLab = await pool.query(
        `SELECT fact_id, record_json
           FROM facts
          WHERE fact_id=$1
            AND (record_json::jsonb->>'type')='lab_result_import_v1'
          LIMIT 1`,
        [labFactId],
      );
      labRow = exactLab.rows?.[0] ?? null;
      const lab = rowRecord(labRow);
      if (!labRow
        || labRow.fact_id !== toText(lab?.lab_fact_id)
        || lab?.plan_fact_id !== planFactId
        || lab?.receipt_fact_id !== receiptFactId
        || lab?.sample_id !== sampleId
        || lab?.import_id !== acceptance.import_id) {
        labRow = null;
        exactBlocking.push("SAMPLING_ACCEPTANCE_LAB_BINDING_INVALID");
      }
    }
  } else {
    const labRows = await pool.query(
      `SELECT fact_id, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='lab_result_import_v1'
          AND (record_json::jsonb->>'plan_fact_id')=$1
          AND (record_json::jsonb->>'receipt_fact_id')=$2
          AND (record_json::jsonb->>'sample_id')=$3
        LIMIT 2`,
      [planFactId, receiptFactId, sampleId],
    );
    if ((labRows.rows?.length ?? 0) > 1) exactBlocking.push("AMBIGUOUS_LAB_RESULT_BINDING");
    else labRow = labRows.rows?.[0] ?? null;
  }

  const lab: any = rowRecord(labRow);
  if (labRow && labRow.fact_id !== toText(lab?.lab_fact_id)) {
    labRow = null;
    exactBlocking.push("LAB_RESULT_EXACT_IDENTITY_INVALID");
  }

  const sampleTypeRaw = String(receipt.sample_type ?? plan.sample_type ?? "").toUpperCase();
  const sample_type = (["SOIL", "TISSUE", "WATER"].includes(sampleTypeRaw) ? sampleTypeRaw : null) as SamplingReportViewV1["sample_type"];
  const labRaw = String(lab?.quality_status ?? "").toUpperCase();
  const lab_result_status = (["PASS", "NEEDS_REVIEW", "INVALID"].includes(labRaw) ? labRaw : "MISSING") as SamplingReportViewV1["lab_result_status"];
  const verdict = String(acceptance?.verdict ?? "").toUpperCase();
  const acceptance_status = (verdict === "PASS" ? "PASS" : verdict === "FAIL" ? "FAIL" : verdict === "INSUFFICIENT_EVIDENCE" ? "NEEDS_REVIEW" : "MISSING") as SamplingReportViewV1["acceptance_status"];
  const acceptanceReasons = Array.isArray(acceptance?.reasons)
    ? acceptance.reasons.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const blocking_reasons = uniqueTextList([...exactBlocking, ...acceptanceReasons]);

  return {
    plan_id: planId,
    sample_id: sampleId,
    sample_type,
    zone_id: toText(receipt.zone_id ?? plan.zone_id),
    collected_at_ts: toNum(receipt.collected_at_ts),
    lab_result_status,
    acceptance_status,
    customer_visible_eligible: exactBlocking.length === 0 && lab_result_status === "PASS" && acceptance_status === "PASS",
    blocking_reasons,
  };
}
