import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import { computeCostBreakdown } from "../agronomy/cost_model.js";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type RoiConfidenceLevelV1 = "HIGH" | "MEDIUM" | "LOW";
export type RoiConfidenceBasisV1 = "measured" | "estimated" | "assumed";

export type RoiConfidenceV1 = {
  level: RoiConfidenceLevelV1;
  basis: RoiConfidenceBasisV1;
  reasons: string[];
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
  confidence: RoiConfidenceV1;
  evidence_refs: any[];
  calculation_method: string;
  assumptions: any;
  uncertainty_notes: string | null;
  skill_trace_id: string | null;
  skill_refs: Array<{
    skill_id: string;
    skill_version?: string;
    trace_id?: string;
    run_id?: string;
  }>;
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
  evidence_refs: any[];
};

type AsAppliedRow = {
  as_applied_id: string;
  zone_id: string | null;
  application: any;
};

type RoiCandidate = {
  roi_type: string;
  baseline: any;
  actual: any;
  delta: any;
  confidence: RoiConfidenceV1;
  evidence_refs: any[];
  calculation_method: string;
  assumptions: any;
  uncertainty_notes: string | null;
};

type SkillRefV1 = {
  skill_id: string;
  skill_version?: string;
  trace_id?: string;
  run_id?: string;
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
  const confidence = parseJsonMaybe(row.confidence) ?? {};
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
    confidence: {
      level: confidence.level === "HIGH" || confidence.level === "MEDIUM" || confidence.level === "LOW" ? confidence.level : "LOW",
      basis: confidence.basis === "measured" || confidence.basis === "estimated" || confidence.basis === "assumed" ? confidence.basis : "assumed",
      reasons: Array.isArray(confidence.reasons) ? confidence.reasons.map((x: unknown) => String(x)) : ["missing_confidence_payload"],
    },
    evidence_refs: parseJsonMaybe(row.evidence_refs) ?? [],
    calculation_method: String(row.calculation_method ?? "manual_or_external_v1"),
    assumptions: parseJsonMaybe(row.assumptions) ?? {},
    uncertainty_notes: row.uncertainty_notes == null ? null : String(row.uncertainty_notes),
    skill_trace_id: row.skill_trace_id == null ? null : String(row.skill_trace_id),
    skill_refs: normalizeSkillRefs(parseJsonMaybe(row.skill_refs)),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function normalizeSkillRefs(value: unknown): SkillRefV1[] {
  if (!Array.isArray(value)) return [];
  const out: SkillRefV1[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const skill_id = String((item as any).skill_id ?? "").trim();
    if (!skill_id) continue;
    const skill_version = String((item as any).skill_version ?? "").trim() || undefined;
    const trace_id = String((item as any).trace_id ?? "").trim() || undefined;
    const run_id = String((item as any).run_id ?? "").trim() || undefined;
    out.push({ skill_id, skill_version, trace_id, run_id });
  }
  return out;
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
    evidence_refs: parseJsonMaybe(row.evidence_refs) ?? [],
  };
}

function mapAsAppliedRow(row: any): AsAppliedRow {
  return {
    as_applied_id: String(row.as_applied_id ?? ""),
    zone_id: row.zone_id == null ? null : String(row.zone_id),
    application: parseJsonMaybe(row.application) ?? {},
  };
}

function buildConfidence(input: {
  basis: RoiConfidenceBasisV1;
  hasMeasuredActual: boolean;
  hasBaseline: boolean;
  reasons: string[];
}): RoiConfidenceV1 {
  if (input.basis === "assumed") {
    return { level: "LOW", basis: "assumed", reasons: input.reasons };
  }
  if (input.hasMeasuredActual && input.hasBaseline && input.basis === "measured") {
    return { level: "HIGH", basis: "measured", reasons: input.reasons };
  }
  if (!input.hasBaseline) {
    return { level: "MEDIUM", basis: input.basis, reasons: input.reasons };
  }
  return { level: "MEDIUM", basis: input.basis, reasons: input.reasons };
}

function normalizeEvidenceRefs(value: unknown): any[] {
  return Array.isArray(value) ? value.filter((x) => x != null) : [];
}

function traceIdFromAsExecuted(asExecuted: AsExecutedRow): string | null {
  if (typeof asExecuted?.planned?.trace_id === "string" && asExecuted.planned.trace_id.trim()) return asExecuted.planned.trace_id.trim();
  if (typeof asExecuted?.planned?.metadata?.trace_id === "string" && asExecuted.planned.metadata.trace_id.trim()) return asExecuted.planned.metadata.trace_id.trim();
  if (typeof asExecuted?.executed?.trace_id === "string" && asExecuted.executed.trace_id.trim()) return asExecuted.executed.trace_id.trim();
  return null;
}

function toWaterLiters(amount: number | null, unitRaw: unknown): number | null {
  if (amount == null) return null;
  const unit = String(unitRaw ?? "").trim().toLowerCase();
  if (unit === "l") return amount;
  if (unit === "m³" || unit === "m3") return amount * 1000;
  return null;
}

export function computeWaterSavedEntry(asExecuted: AsExecutedRow): RoiCandidate | null {
  const plannedAmount = toNum(asExecuted?.planned?.amount);
  const executedAmount = toNum(asExecuted?.executed?.amount);
  const plannedUnit = String(asExecuted?.planned?.unit ?? "").trim();
  const executedUnit = String(asExecuted?.executed?.unit ?? plannedUnit).trim();

  if (plannedAmount == null || executedAmount == null || !plannedUnit) return null;

  const unitNorm = plannedUnit.toLowerCase();
  const allowed = new Set(["l", "m³", "m3", "mm"]);
  if (!allowed.has(unitNorm)) return null;
  if (executedUnit && executedUnit.toLowerCase() !== unitNorm) return null;

  const delta = plannedAmount - executedAmount;
  return {
    roi_type: "WATER_SAVED",
    baseline: {
      source: "prescription_planned_amount",
      amount: plannedAmount,
      unit: plannedUnit,
    },
    actual: {
      source: "as_executed_amount",
      amount: executedAmount,
      unit: plannedUnit,
    },
    delta: {
      amount: delta,
      unit: plannedUnit,
      interpretation: delta > 0 ? "water_saved" : delta < 0 ? "water_overuse" : "no_change",
    },
    confidence: buildConfidence({
      basis: "measured",
      hasMeasuredActual: true,
      hasBaseline: true,
      reasons: ["planned_amount_present", "executed_amount_present", "unit_supported"],
    }),
    evidence_refs: normalizeEvidenceRefs(asExecuted.evidence_refs),
    calculation_method: "planned_minus_executed_amount_v1",
    assumptions: {
      baseline_source: "prescription_planned_amount",
      actual_source: "as_executed_observed_amount",
      trace_id: traceIdFromAsExecuted(asExecuted),
    },
    uncertainty_notes: null,
  };
}

export function computeCostImpactEntry(asExecuted: AsExecutedRow): RoiCandidate | null {
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

  const hasBaseline = baselineCost != null;
  const confidence = buildConfidence({
    basis: hasBaseline ? "measured" : "estimated",
    hasMeasuredActual: true,
    hasBaseline,
    reasons: hasBaseline
      ? ["actual_resource_usage_measured", "baseline_from_prescription_planned_amount"]
      : ["actual_resource_usage_measured", "baseline_missing_use_assumption"],
  });

  return {
    roi_type: "COST_IMPACT",
    baseline: hasBaseline
      ? {
          source: "prescription_planned_amount",
          ...baselineCost,
          resource_usage: { water_l: plannedWaterL, electric_kwh: 0, chemical_ml: 0 },
        }
      : {
          source: "assumption",
          note: "baseline unavailable: planned amount not convertible to water volume",
        },
    actual: {
      source: "as_executed_resource_usage",
      ...actualCost,
      resource_usage: { water_l, electric_kwh, chemical_ml },
    },
    delta: {
      total_cost_delta: hasBaseline ? (baselineCost?.total_cost ?? 0) - actualCost.total_cost : null,
      currency: "cost_unit",
    },
    confidence,
    evidence_refs: normalizeEvidenceRefs(asExecuted.evidence_refs),
    calculation_method: "compute_cost_breakdown_v1",
    assumptions: hasBaseline
      ? { baseline_source: "prescription_planned_amount", trace_id: traceIdFromAsExecuted(asExecuted) }
      : { baseline_source: "assumption_only", trace_id: traceIdFromAsExecuted(asExecuted) },
    uncertainty_notes: hasBaseline ? null : "baseline cost relies on assumption because planned unit conversion is unavailable",
  };
}

export function computeExecutionReliabilityEntry(asExecuted: AsExecutedRow): RoiCandidate {
  const status = String(asExecuted?.executed?.status ?? "INSUFFICIENT_RECEIPT").toUpperCase();
  const sentiment = status === "CONFIRMED" ? "positive" : status === "FAILED" ? "negative" : "uncertain";

  const basis: RoiConfidenceBasisV1 = status === "INSUFFICIENT_RECEIPT" ? "assumed" : "estimated";

  return {
    roi_type: "EXECUTION_RELIABILITY",
    baseline: {},
    actual: { status, sentiment },
    delta: {},
    confidence: buildConfidence({
      basis,
      hasMeasuredActual: false,
      hasBaseline: false,
      reasons: ["mapped_from_as_executed_status"],
    }),
    evidence_refs: normalizeEvidenceRefs(asExecuted.evidence_refs),
    calculation_method: "status_to_reliability_mapping_v1",
    assumptions: {
      status_mapping: {
        CONFIRMED: "positive",
        FAILED: "negative",
        INSUFFICIENT_RECEIPT: "uncertain",
      },
      trace_id: traceIdFromAsExecuted(asExecuted),
    },
    uncertainty_notes: status === "INSUFFICIENT_RECEIPT" ? "insufficient execution receipt evidence" : null,
  };
}

function computeLaborSavedEntry(asExecuted: AsExecutedRow): RoiCandidate | null {
  const labor = asExecuted?.executed?.labor;
  if (!labor || typeof labor !== "object") return null;

  const plannedMinutes = toNum(asExecuted?.planned?.labor?.duration_minutes);
  const actualMinutes = toNum(labor?.duration_minutes);

  return {
    roi_type: "LABOR_SAVED",
    baseline: plannedMinutes == null
      ? { source: "assumption", note: "planned labor missing" }
      : { source: "planned_labor", duration_minutes: plannedMinutes },
    actual: {
      source: "as_executed_labor",
      duration_minutes: actualMinutes,
      worker_count: toNum(labor?.worker_count),
      details: labor,
    },
    delta: plannedMinutes != null && actualMinutes != null
      ? { duration_minutes: plannedMinutes - actualMinutes }
      : {},
    confidence: buildConfidence({
      basis: plannedMinutes == null ? "assumed" : "estimated",
      hasMeasuredActual: actualMinutes != null,
      hasBaseline: plannedMinutes != null,
      reasons: plannedMinutes == null
        ? ["actual_labor_present", "baseline_labor_missing"]
        : ["actual_labor_present", "baseline_labor_present"],
    }),
    evidence_refs: normalizeEvidenceRefs(asExecuted.evidence_refs),
    calculation_method: "labor_duration_comparison_v1",
    assumptions: plannedMinutes == null
      ? { baseline_source: "assumption", trace_id: traceIdFromAsExecuted(asExecuted) }
      : { baseline_source: "planned_labor", trace_id: traceIdFromAsExecuted(asExecuted) },
    uncertainty_notes: plannedMinutes == null ? "planned labor baseline missing" : null,
  };
}



function getVariableZoneApplications(asApplied: AsAppliedRow | null): Array<{
  zone_id: string;
  planned_amount: number;
  applied_amount: number;
  unit: string;
  coverage_percent: number;
  deviation_amount?: number;
  deviation_percent?: number;
  status?: string;
}> {
  if (!asApplied || String(asApplied?.application?.mode ?? "").trim().toUpperCase() !== "VARIABLE_BY_ZONE") return [];
  const zones = asApplied?.application?.zone_applications;
  if (!Array.isArray(zones) || zones.length === 0) return [];
  const out: Array<{
    zone_id: string;
    planned_amount: number;
    applied_amount: number;
    unit: string;
    coverage_percent: number;
    deviation_amount?: number;
    deviation_percent?: number;
    status?: string;
  }> = [];
  for (const zone of zones) {
    const zone_id = String(zone?.zone_id ?? "").trim();
    const planned_amount = toNum(zone?.planned_amount);
    const applied_amount = toNum(zone?.applied_amount);
    const coverage_percent = toNum(zone?.coverage_percent);
    const unit = String(zone?.unit ?? "").trim();
    if (!zone_id || planned_amount == null || applied_amount == null || coverage_percent == null || !unit) return [];
    out.push({
      zone_id,
      planned_amount,
      applied_amount,
      unit,
      coverage_percent,
      deviation_amount: toNum(zone?.deviation_amount) ?? (applied_amount - planned_amount),
      deviation_percent: toNum(zone?.deviation_percent) ?? (planned_amount > 0 ? ((applied_amount - planned_amount) / planned_amount) * 100 : undefined),
      status: String(zone?.status ?? "").trim() || undefined,
    });
  }
  return out;
}

export function computeVariableWaterSavedEntry(asExecuted: AsExecutedRow, asApplied: AsAppliedRow | null): RoiCandidate | null {
  const zones = getVariableZoneApplications(asApplied);
  if (!zones.length) return null;
  const supported = new Set(["mm", "l", "m3", "m³"]);
  const units = Array.from(new Set(zones.map((z) => z.unit.toLowerCase())));
  if (units.length !== 1 || !supported.has(units[0])) return null;
  const unit = zones[0].unit;
  const planned_total = zones.reduce((s, z) => s + z.planned_amount, 0);
  const actual_total = zones.reduce((s, z) => s + z.applied_amount, 0);
  const delta = planned_total - actual_total;
  return { roi_type: "VARIABLE_WATER_SAVED", baseline: { source: "variable_prescription_zone_rates", total_planned_amount: planned_total, unit, zone_count: zones.length, zone_baselines: zones.map((z) => ({ zone_id: z.zone_id, planned_amount: z.planned_amount, unit: z.unit })) }, actual: { source: "as_applied_zone_applications", total_applied_amount: actual_total, unit, zone_actuals: zones.map((z) => ({ zone_id: z.zone_id, applied_amount: z.applied_amount, unit: z.unit })) }, delta: { amount: delta, unit, interpretation: delta > 0 ? "water_saved" : delta < 0 ? "water_overuse" : "no_change" }, confidence: { level: "HIGH", basis: "measured", reasons: ["variable_zone_planned_amount_present", "variable_zone_applied_amount_present", "as_applied_zone_applications_present"] }, evidence_refs: normalizeEvidenceRefs(asExecuted.evidence_refs), calculation_method: "variable_zone_planned_minus_applied_v1", assumptions: { baseline_source: "prescription_zone_rates", actual_source: "as_applied_zone_applications", trace_id: traceIdFromAsExecuted(asExecuted) }, uncertainty_notes: null };
}

export function computeZoneCompletionRateEntry(asExecuted: AsExecutedRow, asApplied: AsAppliedRow | null): RoiCandidate | null {
  const zones = getVariableZoneApplications(asApplied);
  if (!zones.length) return null;
  const completed_count = zones.filter((z) => ["APPLIED", "PARTIAL"].includes(String(z.status ?? "").toUpperCase())).length;
  const zone_count = zones.length;
  const completion_rate = zone_count > 0 ? completed_count / zone_count : 0;
  const avg_coverage_percent = zones.reduce((s, z) => s + z.coverage_percent, 0) / zone_count;
  return { roi_type: "ZONE_COMPLETION_RATE", baseline: { source: "variable_prescription_expected_zones", expected_zone_count: zone_count, required_coverage_percent: 95 }, actual: { source: "as_applied_zone_applications", completed_zone_count: completed_count, zone_count, completion_rate, avg_coverage_percent }, delta: { missing_zone_count: zone_count - completed_count, coverage_gap_percent: 95 - avg_coverage_percent }, confidence: { level: "HIGH", basis: "measured", reasons: ["zone_applications_present", "coverage_percent_present"] }, evidence_refs: normalizeEvidenceRefs(asExecuted.evidence_refs), calculation_method: "zone_completion_rate_v1", assumptions: { required_coverage_percent: 95, trace_id: traceIdFromAsExecuted(asExecuted) }, uncertainty_notes: null };
}

export function computeVariableExecutionReliabilityEntry(asExecuted: AsExecutedRow, asApplied: AsAppliedRow | null): RoiCandidate | null {
  const zones = getVariableZoneApplications(asApplied);
  if (!zones.length) return null;
  const zone_count = zones.length;
  const skipped_count = zones.filter((z) => String(z.status ?? "").toUpperCase() === "SKIPPED").length;
  const partial_count = zones.filter((z) => String(z.status ?? "").toUpperCase() === "PARTIAL").length;
  const applied_count = zones.filter((z) => String(z.status ?? "").toUpperCase() === "APPLIED").length;
  const deviations = zones.map((z) => Math.abs(toNum(z.deviation_percent) ?? (z.planned_amount > 0 ? ((z.applied_amount - z.planned_amount) / z.planned_amount) * 100 : 0)));
  const max_abs_deviation_percent = deviations.length ? Math.max(...deviations) : 0;
  const avg_abs_deviation_percent = deviations.length ? deviations.reduce((s, v) => s + v, 0) / deviations.length : 0;
  const deviation_over_threshold_count = deviations.filter((d) => d > 15).length;
  return { roi_type: "VARIABLE_EXECUTION_RELIABILITY", baseline: { source: "variable_prescription_execution_expectation", expected_status: "APPLIED", expected_zone_count: zone_count, expected_max_deviation_percent: 15 }, actual: { source: "as_applied_zone_applications", zone_count, applied_count, partial_count, skipped_count, max_abs_deviation_percent, avg_abs_deviation_percent }, delta: { skipped_count, partial_count, deviation_over_threshold_count }, confidence: { level: "HIGH", basis: "measured", reasons: ["zone_status_present", "zone_deviation_present"] }, evidence_refs: normalizeEvidenceRefs(asExecuted.evidence_refs), calculation_method: "variable_execution_reliability_v1", assumptions: { expected_max_deviation_percent: 15, trace_id: traceIdFromAsExecuted(asExecuted) }, uncertainty_notes: null };
}

export function computeRoiLedgerEntriesFromAsExecuted(asExecuted: AsExecutedRow, asApplied?: AsAppliedRow | null): RoiCandidate[] {
  const entries: RoiCandidate[] = [];
  const variableWaterSaved = computeVariableWaterSavedEntry(asExecuted, asApplied ?? null);
  if (variableWaterSaved) entries.push(variableWaterSaved);

  const zoneCompletion = computeZoneCompletionRateEntry(asExecuted, asApplied ?? null);
  if (zoneCompletion) entries.push(zoneCompletion);

  const variableReliability = computeVariableExecutionReliabilityEntry(asExecuted, asApplied ?? null);
  if (variableReliability) entries.push(variableReliability);

  const waterSaved = computeWaterSavedEntry(asExecuted);
  if (waterSaved) entries.push(waterSaved);

  const costImpact = computeCostImpactEntry(asExecuted);
  if (costImpact) entries.push(costImpact);

  entries.push(computeExecutionReliabilityEntry(asExecuted));

  const laborSaved = computeLaborSavedEntry(asExecuted);
  if (laborSaved) entries.push(laborSaved);

  // 禁止生成没有 evidence/confidence 的记录。
  return entries.filter((entry) => {
    const hasEvidence = Array.isArray(entry.evidence_refs) && entry.evidence_refs.length > 0;
    const hasConfidence = Boolean(entry.confidence?.level && entry.confidence?.basis && Array.isArray(entry.confidence?.reasons));
    return hasEvidence && hasConfidence;
  });
}

async function getAsExecutedById(pool: Pool, input: TenantTriple & { as_executed_id: string }): Promise<AsExecutedRow | null> {
  const q = await pool.query(
    `SELECT as_executed_id, tenant_id, project_id, group_id, task_id, prescription_id, field_id,
            planned::jsonb AS planned,
            executed::jsonb AS executed,
            evidence_refs::jsonb AS evidence_refs
       FROM as_executed_record_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND as_executed_id = $4
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.as_executed_id]
  );

  return q.rows?.[0] ? mapAsExecutedRow(q.rows[0]) : null;
}

async function listAsAppliedByAsExecuted(pool: Pool, input: TenantTriple & { as_executed_id: string }): Promise<AsAppliedRow[]> {
  const q = await pool.query(
    `SELECT as_applied_id, zone_id, application::jsonb AS application
       FROM as_applied_map_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND as_executed_id = $4
      ORDER BY created_at DESC, as_applied_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.as_executed_id]
  );
  return (q.rows ?? []).map(mapAsAppliedRow);
}

async function getPrescriptionSkillRef(pool: Pool, input: TenantTriple & { prescription_id: string }): Promise<SkillRefV1 | null> {
  const q = await pool.query(
    `SELECT skill_trace_id, skill_trace
       FROM prescription_contract_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND prescription_id = $4
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.prescription_id]
  );
  const row = q.rows?.[0];
  if (!row) return null;
  const skillTrace = parseJsonMaybe(row.skill_trace);
  const skill_id = String(skillTrace?.skill_id ?? "").trim();
  if (!skill_id) return null;
  return {
    skill_id,
    skill_version: String(skillTrace?.skill_version ?? "").trim() || undefined,
    trace_id: String(row.skill_trace_id ?? skillTrace?.trace_id ?? "").trim() || undefined,
  };
}

async function upsertRoiCandidate(pool: Pool, input: {
  tenant: TenantTriple;
  asExecuted: AsExecutedRow;
  asApplied: AsAppliedRow | null;
  candidate: RoiCandidate;
  skill_trace_id?: string | null;
  skill_refs?: SkillRefV1[];
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
      uncertainty_notes,
      skill_trace_id,
      skill_refs
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19,$20::jsonb,$21,$22,$23::jsonb
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
      JSON.stringify(input.candidate.confidence),
      JSON.stringify(input.candidate.evidence_refs),
      input.candidate.calculation_method,
      JSON.stringify(input.candidate.assumptions ?? {}),
      input.candidate.uncertainty_notes,
      input.skill_trace_id ?? null,
      JSON.stringify(normalizeSkillRefs(input.skill_refs ?? [])),
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

  if (!fallback.rows?.[0]) throw new Error("ROI_LEDGER_WRITE_FAILED");
  return { row: mapRoiRow(fallback.rows[0]), idempotent: true };
}

export async function createRoiLedgersFromAsExecuted(pool: Pool, input: TenantTriple & {
  as_executed_id: string;
  skill_trace_id?: string | null;
  skill_refs?: SkillRefV1[];
}): Promise<{
  idempotent: boolean;
  roi_ledgers: RoiLedgerRow[];
}> {
  const asExecuted = await getAsExecutedById(pool, input);
  if (!asExecuted) throw new Error("AS_EXECUTED_NOT_FOUND");

  const asApplied = (await listAsAppliedByAsExecuted(pool, input))[0] ?? null;
  const candidates = computeRoiLedgerEntriesFromAsExecuted(asExecuted, asApplied);
  const executionTrace = parseJsonMaybe(asExecuted?.executed?.skill_trace);
  const executionTraceId = String(asExecuted?.executed?.skill_trace_id ?? executionTrace?.trace_id ?? "").trim() || null;
  const baseSkillRefs = normalizeSkillRefs(asExecuted?.executed?.skill_refs);
  if (executionTrace && typeof executionTrace === "object" && typeof executionTrace.skill_id === "string") {
    baseSkillRefs.push({
      skill_id: String(executionTrace.skill_id),
      skill_version: String(executionTrace.skill_version ?? "").trim() || undefined,
      trace_id: executionTraceId ?? (String(executionTrace.trace_id ?? "").trim() || undefined),
      run_id: String(asExecuted?.executed?.run_id ?? "").trim() || undefined,
    });
  }
  if (asExecuted.prescription_id) {
    const prescriptionSkillRef = await getPrescriptionSkillRef(pool, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      prescription_id: asExecuted.prescription_id,
    });
    if (prescriptionSkillRef) baseSkillRefs.push(prescriptionSkillRef);
  }
  const resolvedSkillRefs = normalizeSkillRefs([...(input.skill_refs ?? []), ...baseSkillRefs]);
  const resolvedSkillTraceId = String(input.skill_trace_id ?? "").trim() || executionTraceId || resolvedSkillRefs[0]?.trace_id || null;

  const out: RoiLedgerRow[] = [];
  let allIdempotent = candidates.length > 0;

  for (const candidate of candidates) {
    const upserted = await upsertRoiCandidate(pool, {
      tenant: { tenant_id: input.tenant_id, project_id: input.project_id, group_id: input.group_id },
      asExecuted,
      asApplied,
      candidate,
      skill_trace_id: resolvedSkillTraceId,
      skill_refs: resolvedSkillRefs,
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
