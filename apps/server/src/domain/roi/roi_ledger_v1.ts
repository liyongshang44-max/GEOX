import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import { computeCostBreakdown } from "../agronomy/cost_model.js";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type RoiLedgerRow = {
  roi_ledger_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  operation_id: string | null;
  task_id: string | null;
  prescription_id: string | null;
  as_executed_id: string | null;
  as_applied_id: string | null;
  field_id: string | null;
  season_id: string | null;
  zone_id: string | null;
  roi_type: string;
  baseline: any;
  actual: any;
  delta: any;
  confidence: any;
  evidence_refs: any;
  calculation_method: string;
  assumptions: any;
  uncertainty_notes: string | null;
  created_at: string;
  updated_at: string;
};

type AsExecutedRow = {
  as_executed_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  task_id: string;
  prescription_id: string | null;
  field_id: string | null;
  planned: any;
  executed: any;
  deviation: any;
  evidence_refs: any;
  confidence: any;
};

type AsAppliedRow = {
  as_applied_id: string;
  zone_id: string | null;
  coverage: any;
  application: any;
};

type RoiCandidate = {
  roi_type: string;
  baseline: any;
  actual: any;
  delta: any;
  confidence: any;
  evidence_refs: any[];
  calculation_method: string;
  assumptions: any;
  uncertainty_notes: string | null;
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

function mapRoiRow(row: any): RoiLedgerRow {
  return {
    roi_ledger_id: String(row.roi_ledger_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
    operation_id: row.operation_id == null ? null : String(row.operation_id),
    task_id: row.task_id == null ? null : String(row.task_id),
    prescription_id: row.prescription_id == null ? null : String(row.prescription_id),
    as_executed_id: row.as_executed_id == null ? null : String(row.as_executed_id),
    as_applied_id: row.as_applied_id == null ? null : String(row.as_applied_id),
    field_id: row.field_id == null ? null : String(row.field_id),
    season_id: row.season_id == null ? null : String(row.season_id),
    zone_id: row.zone_id == null ? null : String(row.zone_id),
    roi_type: String(row.roi_type ?? ""),
    baseline: parseJsonMaybe(row.baseline) ?? {},
    actual: parseJsonMaybe(row.actual) ?? {},
    delta: parseJsonMaybe(row.delta) ?? {},
    confidence: parseJsonMaybe(row.confidence) ?? {},
    evidence_refs: parseJsonMaybe(row.evidence_refs) ?? [],
    calculation_method: String(row.calculation_method ?? "manual_or_external_v1"),
    assumptions: parseJsonMaybe(row.assumptions) ?? {},
    uncertainty_notes: row.uncertainty_notes == null ? null : String(row.uncertainty_notes),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapAsExecutedRow(row: any): AsExecutedRow {
  return {
    as_executed_id: String(row.as_executed_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
    task_id: String(row.task_id ?? ""),
    prescription_id: row.prescription_id == null ? null : String(row.prescription_id),
    field_id: row.field_id == null ? null : String(row.field_id),
    planned: parseJsonMaybe(row.planned) ?? {},
    executed: parseJsonMaybe(row.executed) ?? {},
    deviation: parseJsonMaybe(row.deviation) ?? {},
    evidence_refs: parseJsonMaybe(row.evidence_refs) ?? [],
    confidence: parseJsonMaybe(row.confidence) ?? {},
  };
}

function mapAsAppliedRow(row: any): AsAppliedRow {
  return {
    as_applied_id: String(row.as_applied_id ?? ""),
    zone_id: row.zone_id == null ? null : String(row.zone_id),
    coverage: parseJsonMaybe(row.coverage) ?? {},
    application: parseJsonMaybe(row.application) ?? {},
  };
}

function toWaterLiters(amount: number | null, unitRaw: unknown): number | null {
  if (amount == null) return null;
  const unit = String(unitRaw ?? "").trim().toLowerCase();
  if (unit === "l") return amount;
  if (unit === "m³" || unit === "m3") return amount * 1000;
  return null;
}

function pickWaterSavedCandidate(asExecuted: AsExecutedRow): RoiCandidate | null {
  const plannedAmount = toNum(asExecuted?.planned?.amount);
  const executedAmount = toNum(asExecuted?.executed?.amount);
  const plannedUnit = String(asExecuted?.planned?.unit ?? "").trim();
  const executedUnit = String(asExecuted?.executed?.unit ?? plannedUnit).trim();

  if (plannedAmount == null || executedAmount == null) return null;

  const unitNorm = plannedUnit.toLowerCase();
  const allowed = new Set(["l", "m³", "m3", "mm"]);
  if (!allowed.has(unitNorm)) return null;
  if (String(executedUnit || plannedUnit).toLowerCase() !== unitNorm) return null;

  const baselineValue = plannedAmount;
  const actualValue = executedAmount;
  const deltaValue = baselineValue - actualValue;

  return {
    roi_type: "WATER_SAVED",
    baseline: { amount: baselineValue, unit: plannedUnit },
    actual: { amount: actualValue, unit: plannedUnit },
    delta: {
      amount: deltaValue,
      unit: plannedUnit,
      interpretation: deltaValue > 0 ? "water_saved" : deltaValue < 0 ? "water_overuse" : "no_change",
    },
    confidence: {
      ...(asExecuted.confidence ?? {}),
      measured_or_estimated: "measured",
    },
    evidence_refs: Array.isArray(asExecuted.evidence_refs) ? asExecuted.evidence_refs : [],
    calculation_method: "planned_minus_executed_amount_v1",
    assumptions: {
      source: "as_executed_record_v1",
      unit_consistent: true,
    },
    uncertainty_notes: null,
  };
}

function pickCostImpactCandidate(asExecuted: AsExecutedRow): RoiCandidate | null {
  const usage = asExecuted?.executed?.resource_usage ?? {};
  const water_l = toNum(usage?.water_l);
  const electric_kwh = toNum(usage?.electric_kwh);
  const chemical_ml = toNum(usage?.chemical_ml);

  if (water_l == null && electric_kwh == null && chemical_ml == null) return null;

  const actualCost = computeCostBreakdown({
    water_l: water_l ?? 0,
    electric_kwh: electric_kwh ?? 0,
    chemical_ml: chemical_ml ?? 0,
  });

  const plannedAmount = toNum(asExecuted?.planned?.amount);
  const plannedUnit = asExecuted?.planned?.unit;
  const plannedWaterL = toWaterLiters(plannedAmount, plannedUnit);

  const baselineCost = plannedWaterL == null
    ? null
    : computeCostBreakdown({ water_l: plannedWaterL, electric_kwh: 0, chemical_ml: 0 });

  const baselineTotal = baselineCost?.total_cost ?? null;
  const actualTotal = actualCost.total_cost;

  return {
    roi_type: "COST_IMPACT",
    baseline: baselineCost
      ? {
          ...baselineCost,
          resource_usage: { water_l: plannedWaterL, electric_kwh: 0, chemical_ml: 0 },
        }
      : {},
    actual: {
      ...actualCost,
      resource_usage: { water_l, electric_kwh, chemical_ml },
    },
    delta: {
      total_cost_delta: baselineTotal == null ? null : baselineTotal - actualTotal,
      currency: "cost_unit",
    },
    confidence: {
      ...(asExecuted.confidence ?? {}),
      measured_or_estimated: "estimated",
    },
    evidence_refs: Array.isArray(asExecuted.evidence_refs) ? asExecuted.evidence_refs : [],
    calculation_method: "compute_cost_breakdown_v1",
    assumptions: baselineCost
      ? { baseline_from_planned_water_volume: true }
      : { baseline_missing_reason: "planned_amount_unit_not_convertible_to_water_volume" },
    uncertainty_notes: baselineCost ? null : "baseline cost unavailable due to planned unit conversion constraints",
  };
}

function pickExecutionReliabilityCandidate(asExecuted: AsExecutedRow): RoiCandidate {
  const status = String(asExecuted?.executed?.status ?? "INSUFFICIENT_RECEIPT").toUpperCase();
  const sentiment = status === "CONFIRMED" ? "positive" : status === "FAILED" ? "negative" : "uncertain";

  return {
    roi_type: "EXECUTION_RELIABILITY",
    baseline: {},
    actual: {
      status,
      sentiment,
    },
    delta: {},
    confidence: {
      ...(asExecuted.confidence ?? {}),
      measured_or_estimated: "estimated",
    },
    evidence_refs: Array.isArray(asExecuted.evidence_refs) ? asExecuted.evidence_refs : [],
    calculation_method: "status_to_reliability_mapping_v1",
    assumptions: {
      mapping: {
        CONFIRMED: "positive",
        FAILED: "negative",
        INSUFFICIENT_RECEIPT: "uncertain",
      },
    },
    uncertainty_notes: status === "INSUFFICIENT_RECEIPT" ? "insufficient receipt evidence" : null,
  };
}

function pickLaborSavedCandidate(asExecuted: AsExecutedRow): RoiCandidate | null {
  const labor = asExecuted?.executed?.labor;
  if (!labor || typeof labor !== "object") return null;

  const plannedMinutes = toNum(asExecuted?.planned?.labor?.duration_minutes);
  const actualMinutes = toNum(labor?.duration_minutes);

  return {
    roi_type: "LABOR_SAVED",
    baseline: plannedMinutes == null ? {} : { duration_minutes: plannedMinutes },
    actual: {
      duration_minutes: actualMinutes,
      worker_count: toNum(labor?.worker_count),
      details: labor,
    },
    delta: plannedMinutes != null && actualMinutes != null
      ? { duration_minutes: plannedMinutes - actualMinutes }
      : {},
    confidence: {
      ...(asExecuted.confidence ?? {}),
      measured_or_estimated: "estimated",
    },
    evidence_refs: Array.isArray(asExecuted.evidence_refs) ? asExecuted.evidence_refs : [],
    calculation_method: "labor_duration_comparison_v1",
    assumptions: plannedMinutes == null
      ? { baseline_missing_reason: "planned_labor_missing" }
      : { baseline_from_planned_labor: true },
    uncertainty_notes: plannedMinutes == null ? "baseline labor missing from planned payload" : null,
  };
}

async function getAsExecutedById(pool: Pool, input: TenantTriple & { as_executed_id: string }): Promise<AsExecutedRow | null> {
  const q = await pool.query(
    `SELECT as_executed_id, tenant_id, project_id, group_id, task_id, prescription_id, field_id,
            planned::jsonb AS planned,
            executed::jsonb AS executed,
            deviation::jsonb AS deviation,
            evidence_refs::jsonb AS evidence_refs,
            confidence::jsonb AS confidence
       FROM as_executed_record_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND as_executed_id = $4
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.as_executed_id]
  );

  return q.rows?.[0] ? mapAsExecutedRow(q.rows[0]) : null;
}

async function listAsAppliedByAsExecuted(pool: Pool, input: TenantTriple & { as_executed_id: string }): Promise<AsAppliedRow[]> {
  const q = await pool.query(
    `SELECT as_applied_id, zone_id, coverage::jsonb AS coverage, application::jsonb AS application
       FROM as_applied_map_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND as_executed_id = $4
      ORDER BY created_at DESC, as_applied_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.as_executed_id]
  );
  return (q.rows ?? []).map(mapAsAppliedRow);
}

async function upsertRoiCandidate(pool: Pool, input: {
  tenant: TenantTriple;
  asExecuted: AsExecutedRow;
  asApplied: AsAppliedRow | null;
  candidate: RoiCandidate;
}): Promise<{ row: RoiLedgerRow; idempotent: boolean }> {
  const existing = await pool.query(
    `SELECT *
       FROM roi_ledger_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND as_executed_id = $4
        AND roi_type = $5
      LIMIT 1`,
    [input.tenant.tenant_id, input.tenant.project_id, input.tenant.group_id, input.asExecuted.as_executed_id, input.candidate.roi_type]
  );
  if (existing.rows?.[0]) {
    return { row: mapRoiRow(existing.rows[0]), idempotent: true };
  }

  const inserted = await pool.query(
    `INSERT INTO roi_ledger_v1 (
      roi_ledger_id,
      tenant_id,
      project_id,
      group_id,
      operation_id,
      task_id,
      prescription_id,
      as_executed_id,
      as_applied_id,
      field_id,
      season_id,
      zone_id,
      roi_type,
      baseline,
      actual,
      delta,
      confidence,
      evidence_refs,
      calculation_method,
      assumptions,
      uncertainty_notes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19,$20::jsonb,$21
    )
    ON CONFLICT (tenant_id, project_id, group_id, as_executed_id, roi_type)
    DO NOTHING
    RETURNING *`,
    [
      randomUUID(),
      input.tenant.tenant_id,
      input.tenant.project_id,
      input.tenant.group_id,
      null,
      input.asExecuted.task_id,
      input.asExecuted.prescription_id,
      input.asExecuted.as_executed_id,
      input.asApplied?.as_applied_id ?? null,
      input.asExecuted.field_id,
      input.asExecuted?.planned?.season_id ?? null,
      input.asApplied?.zone_id ?? input.asExecuted?.planned?.zone_id ?? null,
      input.candidate.roi_type,
      JSON.stringify(input.candidate.baseline ?? {}),
      JSON.stringify(input.candidate.actual ?? {}),
      JSON.stringify(input.candidate.delta ?? {}),
      JSON.stringify(input.candidate.confidence ?? {}),
      JSON.stringify(Array.isArray(input.candidate.evidence_refs) ? input.candidate.evidence_refs : []),
      input.candidate.calculation_method,
      JSON.stringify(input.candidate.assumptions ?? {}),
      input.candidate.uncertainty_notes,
    ]
  );

  if (inserted.rows?.[0]) {
    return { row: mapRoiRow(inserted.rows[0]), idempotent: false };
  }

  const fallback = await pool.query(
    `SELECT *
       FROM roi_ledger_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND as_executed_id = $4
        AND roi_type = $5
      LIMIT 1`,
    [input.tenant.tenant_id, input.tenant.project_id, input.tenant.group_id, input.asExecuted.as_executed_id, input.candidate.roi_type]
  );

  if (!fallback.rows?.[0]) {
    throw new Error("ROI_LEDGER_WRITE_FAILED");
  }

  return { row: mapRoiRow(fallback.rows[0]), idempotent: true };
}

export async function createRoiLedgersFromAsExecuted(pool: Pool, input: TenantTriple & { as_executed_id: string }): Promise<{
  idempotent: boolean;
  roi_ledgers: RoiLedgerRow[];
}> {
  const asExecuted = await getAsExecutedById(pool, input);
  if (!asExecuted) throw new Error("AS_EXECUTED_NOT_FOUND");

  const asApplied = (await listAsAppliedByAsExecuted(pool, input))[0] ?? null;

  const candidates: RoiCandidate[] = [];
  const waterSaved = pickWaterSavedCandidate(asExecuted);
  if (waterSaved) candidates.push(waterSaved);

  const costImpact = pickCostImpactCandidate(asExecuted);
  if (costImpact) candidates.push(costImpact);

  candidates.push(pickExecutionReliabilityCandidate(asExecuted));

  const laborSaved = pickLaborSavedCandidate(asExecuted);
  if (laborSaved) candidates.push(laborSaved);

  const out: RoiLedgerRow[] = [];
  let allIdempotent = candidates.length > 0;

  for (const candidate of candidates) {
    const upserted = await upsertRoiCandidate(pool, {
      tenant: {
        tenant_id: input.tenant_id,
        project_id: input.project_id,
        group_id: input.group_id,
      },
      asExecuted,
      asApplied,
      candidate,
    });
    out.push(upserted.row);
    allIdempotent = allIdempotent && upserted.idempotent;
  }

  return {
    idempotent: allIdempotent,
    roi_ledgers: out,
  };
}

async function listByQuery(pool: Pool, sql: string, params: unknown[]): Promise<RoiLedgerRow[]> {
  const q = await pool.query(sql, params);
  return (q.rows ?? []).map(mapRoiRow);
}

export async function listRoiLedgerByAsExecuted(pool: Pool, input: TenantTriple & { as_executed_id: string }): Promise<RoiLedgerRow[]> {
  return listByQuery(
    pool,
    `SELECT *
       FROM roi_ledger_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND as_executed_id = $4
      ORDER BY created_at DESC, roi_ledger_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.as_executed_id]
  );
}

export async function listRoiLedgerByTask(pool: Pool, input: TenantTriple & { task_id: string }): Promise<RoiLedgerRow[]> {
  return listByQuery(
    pool,
    `SELECT *
       FROM roi_ledger_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND task_id = $4
      ORDER BY created_at DESC, roi_ledger_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.task_id]
  );
}

export async function listRoiLedgerByPrescription(pool: Pool, input: TenantTriple & { prescription_id: string }): Promise<RoiLedgerRow[]> {
  return listByQuery(
    pool,
    `SELECT *
       FROM roi_ledger_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND prescription_id = $4
      ORDER BY created_at DESC, roi_ledger_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.prescription_id]
  );
}

export async function listRoiLedgerByField(pool: Pool, input: TenantTriple & { field_id: string }): Promise<RoiLedgerRow[]> {
  return listByQuery(
    pool,
    `SELECT *
       FROM roi_ledger_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
      ORDER BY created_at DESC, roi_ledger_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.field_id]
  );
}
