import type { Pool } from "pg";
import { projectProgramCostFromFacts } from "./program_cost_v1";
import { projectProgramSlaFromFacts } from "./program_sla_v1";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

export type ProgramEfficiencyV1 = {
  program_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  cost_efficiency_score: number | null;
  sla_compliance_rate: number | null;
  efficiency_index: number | null;
  data_status: "OK" | "INSUFFICIENT_DATA";
  updated_at_ts: number;
};

function parseRecordJson(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function str(v: any): string {
  return String(v ?? "").trim();
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function projectProgramEfficiencyFromFacts(rows: FactRow[]): ProgramEfficiencyV1[] {
  const facts = rows.map((row) => ({ ...row, record_json: parseRecordJson(row.record_json) ?? row.record_json }));
  const costs = projectProgramCostFromFacts(facts);
  const slas = projectProgramSlaFromFacts(facts);

  const slaByProgram = new Map(slas.map((x) => [x.program_id, x]));

  const out: ProgramEfficiencyV1[] = costs.map((cost) => {
    const sla = slaByProgram.get(cost.program_id);
    const hasCostFacts = cost.record_count > 0;
    const hasUsageFacts = cost.resource_record_count > 0;
    const hasSlaFacts = (sla?.total_checks ?? 0) > 0;
    const hasAnyEfficiencyInput = hasCostFacts || hasUsageFacts || hasSlaFacts;

    if (!hasAnyEfficiencyInput) {
      return {
        program_id: cost.program_id,
        tenant_id: cost.tenant_id,
        project_id: cost.project_id,
        group_id: cost.group_id,
        cost_efficiency_score: null,
        sla_compliance_rate: null,
        efficiency_index: null,
        data_status: "INSUFFICIENT_DATA",
        updated_at_ts: Math.max(cost.updated_at_ts, sla?.updated_at_ts ?? 0)
      };
    }

    const totalResource = cost.resource_usage_totals.fuel_l + cost.resource_usage_totals.electric_kwh + cost.resource_usage_totals.water_l + cost.resource_usage_totals.chemical_ml;
    const unitCost = totalResource > 0 ? cost.total_cost / totalResource : cost.total_cost;
    const costEfficiency = clamp01(1 / (1 + Math.max(0, unitCost)));
    const slaRate = clamp01(sla?.compliance_rate ?? 0);
    const efficiencyIndex = clamp01(costEfficiency * 0.6 + slaRate * 0.4);

    return {
      program_id: cost.program_id,
      tenant_id: cost.tenant_id,
      project_id: cost.project_id,
      group_id: cost.group_id,
      cost_efficiency_score: costEfficiency,
      sla_compliance_rate: slaRate,
      efficiency_index: efficiencyIndex,
      data_status: "OK",
      updated_at_ts: Math.max(cost.updated_at_ts, sla?.updated_at_ts ?? 0)
    };
  });

  return out.sort((a, b) => b.updated_at_ts - a.updated_at_ts);
}

async function loadFacts(pool: Pool, tenant: TenantTriple): Promise<FactRow[]> {
  const sql = `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') IN ('field_program_v1', 'cost_record_v1', 'resource_usage_v1', 'sla_evaluation_v1')
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
    ORDER BY occurred_at ASC, fact_id ASC`;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id]);
  return (res.rows ?? []).map((row: any) => ({
    fact_id: str(row.fact_id),
    occurred_at: String(row.occurred_at),
    record_json: parseRecordJson(row.record_json) ?? row.record_json
  }));
}

export async function projectProgramEfficiencyV1(pool: Pool, tenant: TenantTriple): Promise<ProgramEfficiencyV1[]> {
  const facts = await loadFacts(pool, tenant);
  return projectProgramEfficiencyFromFacts(facts);
}
