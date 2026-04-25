import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

type ReceiptLookupInput = TenantTriple & {
  task_id: string;
  receipt_id?: string | null;
};

type ReceiptRow = {
  fact_id: string;
  occurred_at: string;
  record_json: any;
};

type PrescriptionRow = {
  prescription_id: string;
  recommendation_id: string;
  field_id: string | null;
  season_id: string | null;
  zone_id: string | null;
  operation_type: string | null;
  operation_amount: any;
};

type CreateAsExecutedInput = TenantTriple & {
  task_id: string;
  receipt_id?: string | null;
};

export type AsExecutedRow = {
  as_executed_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  task_id: string;
  receipt_id: string;
  prescription_id: string | null;
  field_id: string | null;
  executor: any;
  planned: any;
  executed: any;
  deviation: any;
  evidence_refs: any;
  receipt_refs: any;
  log_refs: any;
  confidence: any;
  created_at: string;
  updated_at: string;
};

export type AsAppliedRow = {
  as_applied_id: string;
  as_executed_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string | null;
  task_id: string;
  receipt_id: string;
  prescription_id: string | null;
  geometry: any;
  coverage: any;
  application: any;
  evidence_refs: any;
  log_refs: any;
  created_at: string;
  updated_at: string;
};

function parseJsonMaybe(v: unknown): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeReceiptStatus(payload: any): "CONFIRMED" | "FAILED" | "INSUFFICIENT_RECEIPT" {
  const status = String(payload?.status ?? "").trim().toLowerCase();
  const hasException = payload?.exception && typeof payload.exception === "object";
  if (status === "executed") return "CONFIRMED";
  if (status === "not_executed") return "FAILED";
  if (hasException && status !== "executed") return "FAILED";
  return "INSUFFICIENT_RECEIPT";
}

function dedupeArray(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of values) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function buildEvidenceRefs(payload: any): unknown[] {
  const refs = Array.isArray(payload?.evidence_refs) ? payload.evidence_refs : [];
  const artifacts = Array.isArray(payload?.evidence_artifact_ids)
    ? payload.evidence_artifact_ids.map((id: unknown) => ({ artifact_id: id }))
    : [];
  const metas = Array.isArray(payload?.evidence_meta) ? payload.evidence_meta : [];
  return dedupeArray([...refs, ...artifacts, ...metas]);
}

function getByPath(source: any, path: string[]): string | null {
  let cur = source;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = cur[key];
  }
  if (typeof cur === "string") {
    const v = cur.trim();
    return v || null;
  }
  if (typeof cur === "number" && Number.isFinite(cur)) return String(cur);
  return null;
}

function mapAsExecutedRow(row: any): AsExecutedRow {
  return {
    as_executed_id: String(row.as_executed_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
    task_id: String(row.task_id ?? ""),
    receipt_id: String(row.receipt_id ?? ""),
    prescription_id: row.prescription_id == null ? null : String(row.prescription_id),
    field_id: row.field_id == null ? null : String(row.field_id),
    executor: parseJsonMaybe(row.executor) ?? {},
    planned: parseJsonMaybe(row.planned) ?? {},
    executed: parseJsonMaybe(row.executed) ?? {},
    deviation: parseJsonMaybe(row.deviation) ?? {},
    evidence_refs: parseJsonMaybe(row.evidence_refs) ?? [],
    receipt_refs: parseJsonMaybe(row.receipt_refs) ?? [],
    log_refs: parseJsonMaybe(row.log_refs) ?? [],
    confidence: parseJsonMaybe(row.confidence) ?? {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapAsAppliedRow(row: any): AsAppliedRow {
  return {
    as_applied_id: String(row.as_applied_id ?? ""),
    as_executed_id: String(row.as_executed_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
    field_id: row.field_id == null ? null : String(row.field_id),
    task_id: String(row.task_id ?? ""),
    receipt_id: String(row.receipt_id ?? ""),
    prescription_id: row.prescription_id == null ? null : String(row.prescription_id),
    geometry: parseJsonMaybe(row.geometry) ?? {},
    coverage: parseJsonMaybe(row.coverage) ?? {},
    application: parseJsonMaybe(row.application) ?? {},
    evidence_refs: parseJsonMaybe(row.evidence_refs) ?? [],
    log_refs: parseJsonMaybe(row.log_refs) ?? [],
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapReceiptRow(row: any): ReceiptRow {
  return {
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseJsonMaybe(row.record_json) ?? {},
  };
}

function pickExecutedAmount(payload: any, plannedUnit: string | null): { amount: number | null; unit: string | null } {
  const observed = payload?.observed_parameters ?? {};
  const amountObs = toNum(observed?.amount);
  if (amountObs != null) return { amount: amountObs, unit: plannedUnit };

  const executedAmountObs = toNum(observed?.executed_amount);
  if (executedAmountObs != null) return { amount: executedAmountObs, unit: plannedUnit };

  const water = toNum(payload?.resource_usage?.water_l);
  if (water != null && plannedUnit) {
    const unit = plannedUnit.toLowerCase();
    if (unit === "l") return { amount: water, unit: plannedUnit };
    if (unit === "m³" || unit === "m3") return { amount: water / 1000, unit: plannedUnit };
  }

  const chemicalMl = toNum(payload?.resource_usage?.chemical_ml);
  if (chemicalMl != null && plannedUnit && plannedUnit.toLowerCase() === "ml") {
    return { amount: chemicalMl, unit: plannedUnit };
  }

  return { amount: null, unit: plannedUnit };
}

function buildDeviation(plannedAmount: number | null, executedAmount: number | null): any {
  if (plannedAmount == null || executedAmount == null || plannedAmount === 0) return {};
  const amount_delta = executedAmount - plannedAmount;
  const amount_delta_percent = (amount_delta / plannedAmount) * 100;
  return { amount_delta, amount_delta_percent };
}

function buildGeometry(payload: any): any {
  const coverage = payload?.execution_coverage ?? {};
  if (String(coverage?.kind ?? "") === "field") {
    return {
      type: "field_ref",
      field_ref: coverage?.ref ?? null,
    };
  }
  if (payload?.location_summary && typeof payload.location_summary === "object") {
    return {
      type: "path_summary",
      path_summary: payload.location_summary,
    };
  }
  return { type: "unknown" };
}

function buildCoverage(payload: any): any {
  const observed = payload?.observed_parameters ?? {};
  const coverage_percent = toNum(observed?.coverage_percent);
  if (coverage_percent != null) return { coverage_percent };
  if (String(payload?.execution_coverage?.kind ?? "") === "field") return { coverage_percent: 100 };
  return { coverage_percent: null };
}

async function findPrescriptionById(pool: Pool, input: TenantTriple & { prescription_id: string }): Promise<PrescriptionRow | null> {
  const q = await pool.query(
    `SELECT prescription_id, recommendation_id, field_id, season_id, zone_id, operation_type, operation_amount::jsonb AS operation_amount
       FROM prescription_contract_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND prescription_id = $4
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.prescription_id]
  );
  if (!q.rows?.[0]) return null;
  const row = q.rows[0];
  return {
    prescription_id: String(row.prescription_id),
    recommendation_id: String(row.recommendation_id ?? ""),
    field_id: row.field_id == null ? null : String(row.field_id),
    season_id: row.season_id == null ? null : String(row.season_id),
    zone_id: row.zone_id == null ? null : String(row.zone_id),
    operation_type: row.operation_type == null ? null : String(row.operation_type),
    operation_amount: parseJsonMaybe(row.operation_amount) ?? {},
  };
}

async function findPrescriptionByRecommendation(pool: Pool, input: TenantTriple & { recommendation_id: string }): Promise<PrescriptionRow | null> {
  const q = await pool.query(
    `SELECT prescription_id, recommendation_id, field_id, season_id, zone_id, operation_type, operation_amount::jsonb AS operation_amount
       FROM prescription_contract_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND recommendation_id = $4
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.recommendation_id]
  );
  if (!q.rows?.[0]) return null;
  const row = q.rows[0];
  return {
    prescription_id: String(row.prescription_id),
    recommendation_id: String(row.recommendation_id ?? ""),
    field_id: row.field_id == null ? null : String(row.field_id),
    season_id: row.season_id == null ? null : String(row.season_id),
    zone_id: row.zone_id == null ? null : String(row.zone_id),
    operation_type: row.operation_type == null ? null : String(row.operation_type),
    operation_amount: parseJsonMaybe(row.operation_amount) ?? {},
  };
}

async function resolvePrescription(pool: Pool, params: { tenant: TenantTriple; task_id: string; receipt: ReceiptRow }): Promise<{ prescription: PrescriptionRow | null; confidence: number; resolved_by: string }> {
  const payload = params.receipt.record_json?.payload ?? {};

  const directCandidates = [
    getByPath(payload, ["observed_parameters", "prescription_id"]),
    getByPath(payload, ["parameters", "prescription_id"]),
    getByPath(payload, ["prescription_id"]),
  ].filter(Boolean) as string[];

  for (const candidate of directCandidates) {
    const found = await findPrescriptionById(pool, { ...params.tenant, prescription_id: candidate });
    if (found) return { prescription: found, confidence: 0.95, resolved_by: "receipt_payload_prescription_id" };
  }

  const taskFacts = await pool.query(
    `SELECT record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (
          (record_json::jsonb#>>'{payload,act_task_id}') = $4
          OR (record_json::jsonb#>>'{payload,command_id}') = $4
          OR (record_json::jsonb#>>'{payload,task_id}') = $4
          OR (record_json::jsonb#>>'{payload,proposal,meta,act_task_id}') = $4
          OR (record_json::jsonb#>>'{payload,proposal,meta,task_id}') = $4
        )
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 20`,
    [params.tenant.tenant_id, params.tenant.project_id, params.tenant.group_id, params.task_id]
  );

  let recommendationIdCandidate: string | null = getByPath(payload, ["recommendation_id"]);

  for (const row of taskFacts.rows ?? []) {
    const fact = parseJsonMaybe(row.record_json) ?? {};
    const factPayload = fact?.payload ?? {};
    const candidate =
      getByPath(factPayload, ["parameters", "prescription_id"]) ||
      getByPath(factPayload, ["prescription_id"]) ||
      getByPath(factPayload, ["proposal", "parameters", "prescription_id"]) ||
      getByPath(factPayload, ["proposal", "meta", "prescription_id"]);
    if (candidate) {
      const found = await findPrescriptionById(pool, { ...params.tenant, prescription_id: candidate });
      if (found) return { prescription: found, confidence: 0.85, resolved_by: "task_or_approval_fact_prescription_id" };
    }
    if (!recommendationIdCandidate) {
      recommendationIdCandidate =
        getByPath(factPayload, ["recommendation_id"]) ||
        getByPath(factPayload, ["proposal", "meta", "recommendation_id"]);
    }
  }

  if (recommendationIdCandidate) {
    const foundByRecommendation = await findPrescriptionByRecommendation(pool, {
      ...params.tenant,
      recommendation_id: recommendationIdCandidate,
    });
    if (foundByRecommendation) {
      return { prescription: foundByRecommendation, confidence: 0.65, resolved_by: "recommendation_link" };
    }
  }

  return { prescription: null, confidence: 0.3, resolved_by: "not_found" };
}

function toAsExecutedPayload(params: {
  input: CreateAsExecutedInput;
  receipt: ReceiptRow;
  resolvedReceiptId: string;
  prescription: PrescriptionRow | null;
  prescriptionConfidence: number;
  prescriptionResolvedBy: string;
}): Omit<AsExecutedRow, "as_executed_id" | "created_at" | "updated_at"> {
  const payload = params.receipt.record_json?.payload ?? {};
  const status = normalizeReceiptStatus(payload);
  const taskId = String(payload?.act_task_id ?? payload?.command_id ?? params.input.task_id ?? "").trim();

  const plannedAmount = toNum(params.prescription?.operation_amount?.amount);
  const plannedUnit = params.prescription?.operation_amount?.unit ? String(params.prescription.operation_amount.unit) : null;
  const executedAmountInfo = pickExecutedAmount(payload, plannedUnit);

  return {
    tenant_id: params.input.tenant_id,
    project_id: params.input.project_id,
    group_id: params.input.group_id,
    task_id: taskId,
    receipt_id: params.resolvedReceiptId,
    prescription_id: params.prescription?.prescription_id ?? null,
    field_id: params.prescription?.field_id ?? (payload?.field_id ? String(payload.field_id) : null),
    executor: {
      type: String(payload?.executor_id?.kind ?? "unknown"),
      id: String(payload?.executor_id?.id ?? ""),
    },
    planned: params.prescription
      ? {
          source: "prescription",
          operation_type: params.prescription.operation_type,
          amount: plannedAmount,
          unit: plannedUnit,
          prescription_id: params.prescription.prescription_id,
          recommendation_id: params.prescription.recommendation_id,
          field_id: params.prescription.field_id,
          season_id: params.prescription.season_id,
          zone_id: params.prescription.zone_id,
        }
      : {
          source: taskId ? "task" : "unknown",
          task_id: taskId || null,
        },
    executed: {
      status,
      receipt_status: payload?.status ?? null,
      started_at: payload?.execution_time?.start_ts ?? null,
      completed_at: payload?.execution_time?.end_ts ?? null,
      resource_usage: payload?.resource_usage ?? {},
      labor: payload?.labor ?? {},
      observed_parameters: payload?.observed_parameters ?? {},
      exception: payload?.exception ?? null,
      amount: executedAmountInfo.amount,
      unit: executedAmountInfo.unit,
    },
    deviation: buildDeviation(plannedAmount, executedAmountInfo.amount),
    evidence_refs: buildEvidenceRefs(payload),
    receipt_refs: [{ fact_id: params.receipt.fact_id }],
    log_refs: Array.isArray(payload?.logs_refs) ? payload.logs_refs : [],
    confidence: {
      score: params.prescriptionConfidence,
      prescription_resolved_by: params.prescriptionResolvedBy,
    },
  };
}

async function findAsExecutedByUniqueKey(pool: Pool, input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  task_id: string;
  receipt_id: string;
}): Promise<AsExecutedRow | null> {
  const q = await pool.query(
    `SELECT *
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND task_id = $4
        AND receipt_id = $5
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.task_id, input.receipt_id]
  );
  return q.rows?.[0] ? mapAsExecutedRow(q.rows[0]) : null;
}

async function findAsAppliedByUniqueKey(pool: Pool, input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  task_id: string;
  receipt_id: string;
}): Promise<AsAppliedRow | null> {
  const q = await pool.query(
    `SELECT *
       FROM as_applied_map_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND task_id = $4
        AND receipt_id = $5
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.task_id, input.receipt_id]
  );
  return q.rows?.[0] ? mapAsAppliedRow(q.rows[0]) : null;
}

function buildAsAppliedPayload(params: { as_executed: AsExecutedRow; receipt: ReceiptRow }): Omit<AsAppliedRow, "as_applied_id" | "created_at" | "updated_at"> {
  const payload = params.receipt.record_json?.payload ?? {};
  const planned = params.as_executed.planned ?? {};
  const executed = params.as_executed.executed ?? {};
  const geometry = buildGeometry(payload);
  const coverage = buildCoverage(payload);

  return {
    as_executed_id: params.as_executed.as_executed_id,
    tenant_id: params.as_executed.tenant_id,
    project_id: params.as_executed.project_id,
    group_id: params.as_executed.group_id,
    field_id: params.as_executed.field_id,
    task_id: params.as_executed.task_id,
    receipt_id: params.as_executed.receipt_id,
    prescription_id: params.as_executed.prescription_id ?? null,
    geometry,
    coverage,
    application: {
      zone_id: planned?.zone_id ?? null,
      planned_amount: toNum(planned?.amount),
      planned_unit: planned?.unit ?? null,
      applied_amount: toNum(executed?.amount),
      applied_unit: executed?.unit ?? planned?.unit ?? null,
      rate: null,
    },
    evidence_refs: params.as_executed.evidence_refs,
    log_refs: params.as_executed.log_refs,
  };
}

export async function resolveReceiptFact(pool: Pool, input: ReceiptLookupInput): Promise<ReceiptRow | null> {
  const receiptId = String(input.receipt_id ?? "").trim();

  if (receiptId) {
    const q = await pool.query(
      `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
          AND (
            fact_id = $4
            OR (record_json::jsonb#>>'{payload,receipt_id}') = $4
          )
        ORDER BY CASE WHEN fact_id = $4 THEN 0 ELSE 1 END, occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [input.tenant_id, input.project_id, input.group_id, receiptId]
    );
    if (q.rows?.[0]) return mapReceiptRow(q.rows[0]);
  }

  const qByTask = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1')
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (
          (record_json::jsonb#>>'{payload,act_task_id}') = $4
          OR (record_json::jsonb#>>'{payload,command_id}') = $4
          OR fact_id = $4
        )
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.task_id]
  );

  return qByTask.rows?.[0] ? mapReceiptRow(qByTask.rows[0]) : null;
}

export async function createAsExecutedFromReceipt(pool: Pool, input: CreateAsExecutedInput): Promise<{
  as_executed: AsExecutedRow;
  as_applied: AsAppliedRow;
  idempotent: boolean;
}> {
  const receipt = await resolveReceiptFact(pool, input);
  if (!receipt) throw new Error("RECEIPT_NOT_FOUND");

  const payload = receipt.record_json?.payload ?? {};
  const taskId = String(payload?.act_task_id ?? payload?.command_id ?? input.task_id ?? "").trim();
  if (!taskId) throw new Error("INVALID_RECEIPT_TASK_ID");

  const resolvedReceiptId = String(payload?.receipt_id ?? input.receipt_id ?? receipt.fact_id).trim() || receipt.fact_id;
  const existing = await findAsExecutedByUniqueKey(pool, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    task_id: taskId,
    receipt_id: resolvedReceiptId,
  });

  let asExecuted: AsExecutedRow;
  let asExecutedIdempotent = false;

  if (existing) {
    asExecuted = existing;
    asExecutedIdempotent = true;
  } else {
    const { prescription, confidence, resolved_by } = await resolvePrescription(pool, {
      tenant: {
        tenant_id: input.tenant_id,
        project_id: input.project_id,
        group_id: input.group_id,
      },
      task_id: taskId,
      receipt,
    });

    const mapped = toAsExecutedPayload({
      input: { ...input, task_id: taskId },
      receipt,
      resolvedReceiptId,
      prescription,
      prescriptionConfidence: confidence,
      prescriptionResolvedBy: resolved_by,
    });

    const insert = await pool.query(
      `INSERT INTO as_executed_record_v1 (
        as_executed_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        task_id,
        receipt_id,
        prescription_id,
        executor,
        planned,
        executed,
        deviation,
        evidence_refs,
        receipt_refs,
        log_refs,
        confidence
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb
      )
      ON CONFLICT (tenant_id, project_id, group_id, task_id, receipt_id) DO NOTHING
      RETURNING *`,
      [
        randomUUID(),
        mapped.tenant_id,
        mapped.project_id,
        mapped.group_id,
        mapped.field_id,
        mapped.task_id,
        mapped.receipt_id,
        mapped.prescription_id,
        JSON.stringify(mapped.executor),
        JSON.stringify(mapped.planned),
        JSON.stringify(mapped.executed),
        JSON.stringify(mapped.deviation),
        JSON.stringify(mapped.evidence_refs),
        JSON.stringify(mapped.receipt_refs),
        JSON.stringify(mapped.log_refs),
        JSON.stringify(mapped.confidence),
      ]
    );

    if (insert.rows?.[0]) {
      asExecuted = mapAsExecutedRow(insert.rows[0]);
    } else {
      const afterConflict = await findAsExecutedByUniqueKey(pool, {
        tenant_id: mapped.tenant_id,
        project_id: mapped.project_id,
        group_id: mapped.group_id,
        task_id: mapped.task_id,
        receipt_id: mapped.receipt_id,
      });
      if (!afterConflict) throw new Error("AS_EXECUTED_WRITE_FAILED");
      asExecuted = afterConflict;
      asExecutedIdempotent = true;
    }
  }

  const existingApplied = await findAsAppliedByUniqueKey(pool, {
    tenant_id: asExecuted.tenant_id,
    project_id: asExecuted.project_id,
    group_id: asExecuted.group_id,
    task_id: asExecuted.task_id,
    receipt_id: asExecuted.receipt_id,
  });

  let asApplied: AsAppliedRow;
  let asAppliedIdempotent = false;

  if (existingApplied) {
    asApplied = existingApplied;
    asAppliedIdempotent = true;
  } else {
    const payload = buildAsAppliedPayload({ as_executed: asExecuted, receipt });
    const insertedApplied = await pool.query(
      `INSERT INTO as_applied_map_v1 (
        as_applied_id,
        as_executed_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        task_id,
        receipt_id,
        prescription_id,
        geometry,
        coverage,
        application,
        evidence_refs,
        log_refs
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb
      )
      ON CONFLICT (tenant_id, project_id, group_id, task_id, receipt_id) DO NOTHING
      RETURNING *`,
      [
        randomUUID(),
        payload.as_executed_id,
        payload.tenant_id,
        payload.project_id,
        payload.group_id,
        payload.field_id,
        payload.task_id,
        payload.receipt_id,
        payload.prescription_id,
        JSON.stringify(payload.geometry),
        JSON.stringify(payload.coverage),
        JSON.stringify(payload.application),
        JSON.stringify(payload.evidence_refs),
        JSON.stringify(payload.log_refs),
      ]
    );

    if (insertedApplied.rows?.[0]) {
      asApplied = mapAsAppliedRow(insertedApplied.rows[0]);
    } else {
      const fallback = await findAsAppliedByUniqueKey(pool, {
        tenant_id: payload.tenant_id,
        project_id: payload.project_id,
        group_id: payload.group_id,
        task_id: payload.task_id,
        receipt_id: payload.receipt_id,
      });
      if (!fallback) throw new Error("AS_APPLIED_WRITE_FAILED");
      asApplied = fallback;
      asAppliedIdempotent = true;
    }
  }

  return {
    as_executed: asExecuted,
    as_applied: asApplied,
    idempotent: asExecutedIdempotent && asAppliedIdempotent,
  };
}

export async function getAsExecutedById(pool: Pool, input: TenantTriple & { as_executed_id: string }): Promise<AsExecutedRow | null> {
  const q = await pool.query(
    `SELECT *
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND as_executed_id = $4
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.as_executed_id]
  );
  return q.rows?.[0] ? mapAsExecutedRow(q.rows[0]) : null;
}

export async function listAsExecutedByTask(pool: Pool, input: TenantTriple & { task_id: string }): Promise<AsExecutedRow[]> {
  const q = await pool.query(
    `SELECT *
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND task_id = $4
      ORDER BY created_at DESC, as_executed_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.task_id]
  );
  return (q.rows ?? []).map(mapAsExecutedRow);
}

export async function listAsExecutedByReceipt(pool: Pool, input: TenantTriple & { receipt_id: string }): Promise<AsExecutedRow[]> {
  const q = await pool.query(
    `SELECT *
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND receipt_id = $4
      ORDER BY created_at DESC, as_executed_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.receipt_id]
  );
  return (q.rows ?? []).map(mapAsExecutedRow);
}

export async function listAsExecutedByPrescription(pool: Pool, input: TenantTriple & { prescription_id: string }): Promise<Array<{ as_executed: AsExecutedRow; as_applied: AsAppliedRow | null }>> {
  const q = await pool.query(
    `SELECT
      ae.*,
      am.as_applied_id,
      am.as_executed_id AS am_as_executed_id,
      am.field_id AS am_field_id,
      am.geometry,
      am.coverage,
      am.application,
      am.evidence_refs AS am_evidence_refs,
      am.log_refs AS am_log_refs,
      am.created_at AS am_created_at,
      am.updated_at AS am_updated_at
     FROM as_executed_record_v1 ae
     LEFT JOIN as_applied_map_v1 am
       ON am.tenant_id = ae.tenant_id
      AND am.project_id = ae.project_id
      AND am.group_id = ae.group_id
      AND am.task_id = ae.task_id
      AND am.receipt_id = ae.receipt_id
     WHERE ae.tenant_id = $1
       AND ae.project_id = $2
       AND ae.group_id = $3
       AND ae.prescription_id = $4
     ORDER BY ae.created_at DESC, ae.as_executed_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.prescription_id]
  );

  return (q.rows ?? []).map((row: any) => {
    const as_executed = mapAsExecutedRow(row);
    const as_applied = row.as_applied_id
      ? mapAsAppliedRow({
          as_applied_id: row.as_applied_id,
          as_executed_id: row.am_as_executed_id,
          tenant_id: row.tenant_id,
          project_id: row.project_id,
          group_id: row.group_id,
          field_id: row.am_field_id,
          task_id: row.task_id,
          receipt_id: row.receipt_id,
          prescription_id: row.prescription_id,
          geometry: row.geometry,
          coverage: row.coverage,
          application: row.application,
          evidence_refs: row.am_evidence_refs,
          log_refs: row.am_log_refs,
          created_at: row.am_created_at,
          updated_at: row.am_updated_at,
        })
      : null;
    return { as_executed, as_applied };
  });
}
